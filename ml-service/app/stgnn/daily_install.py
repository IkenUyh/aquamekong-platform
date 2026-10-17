"""
Cài gói ST-GNN daily (scripts/train_stgnn_daily.py) vào app/stgnn/daily/ để đóng vào image:
    python -m app.stgnn.daily_install <thư mục gói> [--features <AquaMekong_CLEAN_FEATURES_FINAL.csv>]

Gói cần meta.json, scaler.pkl và st_gnn_horizon_{n}.pth cho mọi mốc trong meta. Scaler chỉ được mở sau khi kiểm tra
opcode pickle, rồi lưu thành số trong meta.json: lúc chạy không mở pickle. Toạ độ, khoảng cách và ma trận đồ thị
lấy từ kho feature, cùng cách tính lúc train (dòng đầu của mỗi trạm, sigma 10 km), nên server không cần kho feature.
Xong thì chạy scripts/benchmark_stgnn_daily.py để có evaluation.json.
"""

import argparse
import json
import shutil
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import torch

from app.config import get_settings
from app.ingest.features_store import FEATURES_FILE
from app.models.st_gnn import STGNN
from app.pipeline.dataset_loader import haversine_distance
from app.stgnn import artifact
from app.stgnn.daily import ARTIFACT_DIR, META_FILE

SIGMA_KM = 10.0
STATIC = ["latitude", "longitude", "distance_to_river_mouth_km", "distance_to_coast_km"]


def graph_weights(coords: list) -> np.ndarray:
    n = len(coords)
    w = np.eye(n)
    for i in range(n):
        for j in range(n):
            if i != j:
                w[i, j] = np.exp(-haversine_distance(*coords[i], *coords[j]) ** 2 / SIGMA_KM ** 2)
    return w


def install(src: Path, features_csv: Path, dest: Path = ARTIFACT_DIR) -> dict:
    import joblib  # chỉ mở sau khi đã kiểm tra opcode

    meta = json.loads((src / "meta.json").read_text())
    artifact.check_scaler_pickle(src / "scaler.pkl")
    scaler = joblib.load(src / "scaler.pkl")
    feats, codes = meta["feature_cols"], meta["stations"]
    if len(scaler.min_) != len(feats):
        raise ValueError(f"Scaler có {len(scaler.min_)} đặc trưng, meta có {len(feats)}")

    for h in meta["horizons"]:
        model = STGNN(num_stations=len(codes), num_features=len(feats), lookback=meta["lookback"], horizon=h)
        model.load_state_dict(torch.load(src / f"st_gnn_horizon_{h}.pth", map_location="cpu", weights_only=True))

    df = pd.read_csv(features_csv, usecols=["station_id", *STATIC])
    first = df[df["station_id"].isin(codes)].groupby("station_id")[STATIC].first()
    missing = sorted(set(codes) - set(first.index))
    if missing:
        raise ValueError(f"Kho feature không có trạm {missing}")
    static = {c: {k: float(first.at[c, k]) for k in STATIC} for c in codes}

    out = {
        "model_version": meta["model_version"],
        "trained_until": meta.get("trained_until"),
        "trained_at": meta.get("trained_at"),
        "stations": codes,
        "feature_cols": feats,
        "target_col": meta["target_col"],
        "lookback": meta["lookback"],
        "horizons": meta["horizons"],
        "scaler": {"min_": scaler.min_.tolist(), "scale_": scaler.scale_.tolist()},
        "static": static,
        "w_d": graph_weights([(static[c]["latitude"], static[c]["longitude"]) for c in codes]).round(8).tolist(),
    }
    dest.mkdir(parents=True, exist_ok=True)
    for old in dest.glob("h*.pth"):
        old.unlink()
    for h in meta["horizons"]:
        shutil.copyfile(src / f"st_gnn_horizon_{h}.pth", dest / f"h{h}.pth")
    (dest / META_FILE).write_text(json.dumps(out, ensure_ascii=False, indent=1))
    return out


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Cài gói ST-GNN daily vào app/stgnn/daily/")
    parser.add_argument("src", type=Path)
    parser.add_argument("--features", type=Path, default=Path(get_settings().features_dir) / FEATURES_FILE)
    args = parser.parse_args(argv)
    out = install(args.src, args.features)
    print(f"Đã cài {out['model_version']} (dữ liệu tới {out['trained_until']}): {len(out['stations'])} trạm, "
          f"mốc {out['horizons']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
