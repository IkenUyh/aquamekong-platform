"""
Cài weights ST-GNN đã train vào model_dir/stgnn/ và chấm điểm trên tập test:
    python -m app.stgnn.install <thư mục weights>

Thư mục cần có st_gnn_horizon_1.pth, st_gnn_horizon_7.pth, st_gnn_scaler.pkl (từ scripts/train_stgnn.py).
Kho feature (features_dir) phải có đúng dữ liệu đã dùng để train: scaler tính lại phải khớp scaler đã lưu,
nếu không là weights được train trên dữ liệu khác và sẽ dự báo sai.
"""

import argparse
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import torch

from app.ingest.features_store import features_path
from app.models.st_gnn import STGNN
from app.stgnn import artifact
from app.stgnn.data import LOOKBACK, make_loader, unscale_target

HORIZONS = (1, 7)
THRESHOLD = 4.0
NUM_FEATURES = 12


def _metrics(pred, true):
    err = pred - true
    return {"mae": round(float(np.mean(np.abs(err))), 4), "rmse": round(float(np.sqrt(np.mean(err ** 2))), 4)}


def evaluate(horizon: int, weights: Path, given_scaler, features_dir=None) -> dict:
    loader = make_loader(horizon, features_dir)
    # Cùng cách chia 80/20 theo thời gian như lúc train
    _, test_loader, scaler, w_d, n = loader.prepare_data(test_size=0.2)
    if not (np.allclose(scaler.data_min_, given_scaler.data_min_) and np.allclose(scaler.data_max_, given_scaler.data_max_)):
        raise ValueError("Scaler tính từ kho feature không khớp scaler đã lưu: weights được train trên dữ liệu khác.")

    model = STGNN(num_stations=n, num_features=NUM_FEATURES, lookback=LOOKBACK, horizon=horizon)
    model.load_state_dict(torch.load(weights, map_location="cpu", weights_only=True))
    model.eval()
    tgt = loader.feature_cols.index(loader.target_col)

    preds, trues, naive, q10, q90 = [], [], [], [], []
    with torch.no_grad():
        for x, y in test_loader:
            out = model(x, torch.tensor(w_d, dtype=torch.float32))
            q10.append(out[:, :, 0].numpy()); preds.append(out[:, :, 1].numpy()); q90.append(out[:, :, 2].numpy())
            trues.append(y.numpy()); naive.append(x[:, :, -1, tgt].numpy())
    inv = lambda a: unscale_target(np.concatenate(a), scaler.min_, scaler.scale_, tgt)
    p, t, nv, lo, hi = inv(preds), inv(trues), inv(naive), inv(q10), inv(q90)

    above_true, above_pred = t > THRESHOLD, p > THRESHOLD
    tp = int(np.sum(above_true & above_pred))
    stations = {
        code: {"stgnn": _metrics(p[:, i], t[:, i]), "naive": _metrics(nv[:, i], t[:, i])}
        for i, code in enumerate(loader.stations)
    }
    return {
        "stations": list(loader.stations),
        "test_days": int(t.shape[0]),
        "overall": {"stgnn": _metrics(p, t), "naive": _metrics(nv, t)},
        "interval_coverage": round(float(np.mean((t >= np.minimum(lo, hi)) & (t <= np.maximum(lo, hi)))), 3),
        "exceed_recall": round(tp / max(int(above_true.sum()), 1), 3),
        "exceed_precision": round(tp / max(int(above_pred.sum()), 1), 3),
        "per_station": stations,
        "scaler": {"min_": scaler.min_.tolist(), "scale_": scaler.scale_.tolist()},
        "feature_cols": loader.feature_cols,
        "target_col": loader.target_col,
    }


def install(src: Path, features_dir=None, model_dir=None) -> dict:
    import joblib  # chỉ mở sau khi đã kiểm tra opcode

    scaler_file = src / "st_gnn_scaler.pkl"
    artifact.check_scaler_pickle(scaler_file)
    given = joblib.load(scaler_file)

    results = {h: evaluate(h, src / f"st_gnn_horizon_{h}.pth", given, features_dir) for h in HORIZONS}
    first = results[HORIZONS[0]]
    data_end = pd.read_csv(features_path(features_dir), usecols=["date"])["date"].max()
    meta = {
        "model_version": "st-gnn-v1",
        "installed_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        # Ngày cuối của dữ liệu lúc cài (weights được train trên dữ liệu tới ngày này)
        "trained_until": data_end,
        "lookback": LOOKBACK,
        "horizons": list(HORIZONS),
        "stations": first["stations"],
        "feature_cols": first["feature_cols"],
        "target_col": first["target_col"],
        "scaler": first["scaler"],
        "threshold": THRESHOLD,
        "evaluation": {f"h{h}": {k: v for k, v in r.items() if k not in ("stations", "scaler", "feature_cols", "target_col")}
                       for h, r in results.items()},
    }
    out = artifact.artifact_dir(model_dir)
    out.mkdir(parents=True, exist_ok=True)
    for h in HORIZONS:
        shutil.copyfile(src / f"st_gnn_horizon_{h}.pth", artifact.weights_path(h, model_dir))
    artifact.write_meta(meta, model_dir)
    return meta


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.stgnn.install", description="Cài weights ST-GNN và chấm điểm trên tập test")
    parser.add_argument("weights_dir", type=Path)
    args = parser.parse_args(argv)
    try:
        meta = install(args.weights_dir)
    except Exception as e:
        print(f"LỖI: {e}", file=sys.stderr)
        return 1
    print(f"Đã cài ST-GNN cho {len(meta['stations'])} trạm vào {artifact.artifact_dir()}")
    for key, ev in meta["evaluation"].items():
        s, n = ev["overall"]["stgnn"]["mae"], ev["overall"]["naive"]["mae"]
        print(f"  {key}: MAE {s:.3f}‰ (giữ nguyên giá trị cũ: {n:.3f}‰, tốt hơn {100 * (n - s) / n:.0f}%), "
              f"khoảng Q10–Q90 chứa {ev['interval_coverage']:.0%} giá trị thật")
    return 0


if __name__ == "__main__":
    sys.exit(main())
