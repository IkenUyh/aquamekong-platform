"""
Chấm số dự báo app hiển thị ở các trạm của ST-GNN daily (app/stgnn/daily.blend), đặt cạnh gb-risk-v2 và giữ nguyên số
mới nhất, đích là SỐ ĐO THẬT (không phải giá trị nội suy). Ghi app/stgnn/daily/evaluation.json cho trang Dự báo.

    docker compose exec ml-service python scripts/benchmark_stgnn_daily.py

- Mùa khô 2024–25, 2025–26: mỗi mùa train lại ST-GNN bằng scripts/train_stgnn_daily.py và gb-risk-v2 chỉ trên dữ liệu
  trước 01/12 của mùa đó (khoảng 10 phút CPU).
- Từ ngày sau trained_until của weights đang cài tới số đo mới nhất: chạy đúng DailyForecaster + blend như trên web,
  mỗi ngày phát hành chỉ thấy số đo tới hôm đó; gb-risk-v2 học trước ngày đầu giai đoạn.
Ngày trên web d = số ngày sau số đo cuối - 1 (số đo về trễ một ngày): ngày 1..7 ứng với ST-GNN mốc 2..8.
"""

import json
import sys
from datetime import timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from sklearn.preprocessing import MinMaxScaler
from sqlalchemy import text
from torch.utils.data import DataLoader

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import train_stgnn_daily as T  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.db import get_engine  # noqa: E402
from app.early_warning import service as svc  # noqa: E402
from app.early_warning.features import build_rows, load_panel  # noqa: E402
from app.early_warning.model import RiskModel, station_codes  # noqa: E402
from app.ingest.features_store import FEATURES_FILE  # noqa: E402
from app.schemas.forecast import PredictionItem  # noqa: E402
from app.stgnn.daily import ARTIFACT_DIR, EVALUATION_FILE, STGNN_ONLY_TO, DailyForecaster, blend  # noqa: E402

DRY_SEASONS = [("Mùa khô 2024–2025", "2024-12-01", "2025-05-31"), ("Mùa khô 2025–2026", "2025-12-01", "2026-05-31")]
WEB_DAYS = range(1, 8)


def risk_fold(rows: pd.DataFrame, start: pd.Timestamp, first: dict, ids: pd.DataFrame) -> pd.DataFrame:
    """Số gb-risk-v2 hiển thị (uses_model) của mô hình chỉ học mục tiêu trước start, cho mọi ngày phát hành từ start."""
    known = rows[rows["target"].notna()]
    fold = RiskModel.train(known[known["target_day"] < start])
    test = rows[rows["target_day"] >= start].merge(ids, on="station_id")
    _, median, _ = fold.predict(test)
    served = [m if svc.uses_model(svc.is_mature(first.get(int(s)), i.date()), int(h)) else s0
              for m, s, i, h, s0 in zip(median, test["station_id"], test["issued"], test["h"], test["s0"])]
    return test.assign(served=served, end=test["issued"] - pd.Timedelta(days=1), h_st=test["h"] + 1)


def summarize(label: str, start, end, res: pd.DataFrame, method: str) -> dict:
    by_day = []
    for d in WEB_DAYS:
        g = res[res["h"] == d + 1].dropna(subset=["served"])
        if g.empty:
            continue
        mae = lambda col: round(float((g[col] - g["actual"]).abs().mean()), 3)
        by_day.append({"day": d, "count": int(len(g)), "mae": mae("shown"), "gbRisk": mae("served"), "persistence": mae("naive")})
    return {"label": label, "from": str(pd.Timestamp(start).date()), "to": str(pd.Timestamp(end).date()),
            "stations": int(res["code"].nunique()), "method": method, "byDay": by_day}


def shown_value(h: int, stgnn: float, served: float) -> float:
    return stgnn if h <= STGNN_ONLY_TO else (stgnn + served) / 2


def dry_seasons(rows, first, ids) -> list:
    csv = Path(get_settings().features_dir) / FEATURES_FILE
    raw = pd.read_csv(csv, parse_dates=["date"]).pivot(index="date", columns="station_id", values="salinity_max")
    pivot, stations, w = T.load_panel_data(str(csv))
    w_t = torch.tensor(w, dtype=torch.float32)
    tgt = T.DAILY_FEATURES.index(T.TARGET_COL)
    torch.manual_seed(0)
    np.random.seed(0)
    out = []
    for label, a, b in DRY_SEASONS:
        start, end = pd.Timestamp(a), pd.Timestamp(b)
        risk = risk_fold(rows, start, first, ids)
        tr = pivot[pivot.index < start]
        te = pivot[(pivot.index >= start - pd.Timedelta(days=T.LOOKBACK)) & (pivot.index <= end)]
        recs = []
        for h in range(2, 9):
            sc = MinMaxScaler()
            x_tr, y_tr, _, _ = T.build_samples(tr, stations, sc, horizon=h, fit_scaler=True)
            x_te, _, _, dates = T.build_samples(te, stations, sc, horizon=h, fit_scaler=False)
            model = T.train_model(DataLoader(T.STGNNDataset(x_tr, y_tr), batch_size=32, shuffle=True),
                                  len(stations), len(T.DAILY_FEATURES), w_t, horizon=h, epochs=80, patience=15)
            model.eval()
            with torch.no_grad():
                p = model(torch.tensor(x_te, dtype=torch.float32), w_t)[:, :, 1].numpy()
            p = np.clip((p - sc.min_[tgt]) / sc.scale_[tgt], 0, None)
            for k, (issue, fc) in enumerate(dates):
                if not (start <= fc <= end):
                    continue
                for i, code in enumerate(stations):
                    act, last = raw.at[fc, code], raw.at[issue, code]
                    if not (np.isnan(act) or np.isnan(last)):
                        recs.append((h, code, issue, float(p[k, i]), float(last), float(act)))
            print(f"{label} mốc {h}: xong", flush=True)
        res = pd.DataFrame(recs, columns=["h", "code", "end", "stgnn", "naive", "actual"])
        res = res.merge(risk[["code", "end", "h_st", "served"]], left_on=["code", "end", "h"], right_on=["code", "end", "h_st"], how="left")
        res["shown"] = [shown_value(h, s, r) for h, s, r in zip(res["h"], res["stgnn"], res["served"])]
        out.append(summarize(label, start, end, res, "walk-forward"))
    return out


def after_training(rows, first, ids, data: pd.DataFrame) -> dict:
    """Weights đang cài trên dữ liệu chúng chưa thấy, qua đúng đường chạy thật (DailyForecaster + blend)."""
    meta = json.loads((ARTIFACT_DIR / "meta.json").read_text())
    start = pd.Timestamp(meta["trained_until"]) + pd.Timedelta(days=1)
    risk = risk_fold(rows, start, first, ids)
    actual = data.pivot(index="day", columns="code", values="salinity")
    last_day = actual.index.max()
    recs = []
    for end in pd.date_range(start - pd.Timedelta(days=1), last_day - pd.Timedelta(days=2)):
        f = DailyForecaster(loader=lambda codes, e=end: data[(data["code"].isin(codes)) & (data["day"] <= e)])
        graph = f._run(f.meta(), end.date() + timedelta(days=1))
        if graph is None:
            continue
        r = risk[risk["end"] == end]
        for code in meta["stations"]:
            if graph.last_day.get(code) != end.date():
                continue
            items = [PredictionItem(date=(end + pd.Timedelta(days=int(x.h_st))).date(), salinity=float(x.served), model_version="gb")
                     for x in r[r["code"] == code].itertuples() if x.h_st <= 8]
            shown = {i.date: i.salinity for i in blend(items, graph, code, "x")}
            for fc in graph.by_station[code]:
                day = pd.Timestamp(fc.date)
                if fc.horizon < 2 or day > last_day or day not in actual.index or pd.Timestamp(fc.date) < start:
                    continue
                act, last = actual.at[day, code], actual.at[end, code]
                served = next((i.salinity for i in items if i.date == fc.date), np.nan)
                if not (np.isnan(act) or np.isnan(last)):
                    recs.append((fc.horizon, code, end, shown.get(fc.date, np.nan), served, float(last), float(act)))
    res = pd.DataFrame(recs, columns=["h", "code", "end", "shown", "served", "naive", "actual"])
    return summarize(f"Sau khi train ({start.date():%d/%m/%Y} – {last_day.date():%d/%m/%Y})", start, last_day, res, "after-training")


def main() -> int:
    panel = load_panel()
    rows = build_rows(panel, max_horizon=7, station_codes=station_codes(panel))
    first = svc.first_salinity_days(panel)
    ids = pd.read_sql(text("SELECT id AS station_id, code FROM stations"), get_engine())
    meta = json.loads((ARTIFACT_DIR / "meta.json").read_text())
    data = panel.merge(ids, on="station_id")
    data = data[data["code"].isin(meta["stations"])][["code", "day", "salinity", "water_level"]].copy()
    data["water_level"] = data["water_level"] * 100
    result = dry_seasons(rows, first, ids) + [after_training(rows, first, ids, data)]
    (ARTIFACT_DIR / EVALUATION_FILE).write_text(json.dumps(result, ensure_ascii=False, indent=1))
    for period in result:
        print(f"\n{period['label']} ({period['stations']} trạm, {period['method']})")
        for d in period["byDay"]:
            print(f"  ngày {d['day']}: hiển thị {d['mae']:.3f}‰ | gb-risk-v2 {d['gbRisk']:.3f}‰ | giữ nguyên {d['persistence']:.3f}‰ (n={d['count']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
