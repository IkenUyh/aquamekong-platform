"""
Đặc trưng cho mô hình rủi ro mặn. Một dòng = một trạm, một ngày phát hành D, một số ngày dự báo trước h.
Đặc trưng chỉ dùng số đo tới hết D-1 (như job dự báo buổi sáng: số đo của ngày D về sáng D+1); mục tiêu là độ mặn
cao nhất của ngày D+h. Huấn luyện, chạy lại trên mùa khô cũ và dự báo thật đều đi qua build_rows, nên đặc trưng không lệch nhau.
"""

from typing import Dict, Optional

import numpy as np
import pandas as pd

# 14 ngày của trang Dự báo, cộng tối đa 2 ngày khi số đo về trễ (service.MAX_DATA_AGE_DAYS)
MAX_HORIZON = 16

FEATURES = ["s0", "s1", "s2", "s3", "s4", "s5", "s6", "s_mean7", "s_max7", "s_min7", "s_mean30", "s_max30",
            "w0", "w_mean7", "w_diff", "r0", "r_diff3", "ly_s0", "ly_target", "h", "doy_sin", "doy_cos", "station"]
STATION_FEATURE = FEATURES.index("station")


def load_panel() -> pd.DataFrame:
    """Độ mặn và mực nước cao nhất theo ngày (giờ VN) của mọi trạm: cột station_id, day (Timestamp), salinity, water_level."""
    from sqlalchemy import text
    from app.db import get_engine

    query = text("""
        SELECT station_id, (recorded_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day, metric_type, MAX(value) AS value
        FROM measurements
        WHERE metric_type IN ('salinity', 'water_level') AND value IS NOT NULL
        GROUP BY 1, 2, 3
    """)
    with get_engine().connect() as conn:
        raw = pd.read_sql(query, conn)
    return to_panel(raw)


def to_panel(raw: pd.DataFrame) -> pd.DataFrame:
    """Dạng dài (station_id, day, metric_type, value) -> mỗi dòng một trạm-ngày."""
    if raw.empty:
        return pd.DataFrame(columns=["station_id", "day", "salinity", "water_level"])
    wide = raw.pivot_table(index=["station_id", "day"], columns="metric_type", values="value", aggfunc="max").reset_index()
    for col in ("salinity", "water_level"):
        if col not in wide:
            wide[col] = np.nan
    wide["day"] = pd.to_datetime(wide["day"])
    wide["station_id"] = wide["station_id"].astype(int)
    return wide[["station_id", "day", "salinity", "water_level"]]


def build_rows(panel: pd.DataFrame, max_horizon: int = MAX_HORIZON, station_codes: Optional[Dict[int, int]] = None,
               live: bool = False) -> pd.DataFrame:
    """
    Dòng đặc trưng cho mọi trạm. Cột ngoài FEATURES: station_id, issued (ngày phát hành D), target_day (D+h),
    target (độ mặn ngày D+h, NaN khi chưa có hoặc ngày đó chưa tới).

    live=True: mỗi trạm chỉ một ngày phát hành, ngày sau ngày cuối có số đo độ mặn (dự báo thật).
    station_codes: mã số của trạm cho đặc trưng "station" (mô hình đã học); trạm không có mã thì để trống.
    """
    panel = panel.sort_values(["station_id", "day"])
    regional = panel.groupby("day")["salinity"].mean()
    frames = []
    for sid, g in panel.groupby("station_id"):
        code = station_codes.get(int(sid), np.nan) if station_codes is not None else np.nan
        frame = _station_rows(g.set_index("day"), regional, code, max_horizon, live)
        if frame is not None and not frame.empty:
            frame.insert(0, "station_id", int(sid))
            frames.append(frame)
    if not frames:
        return pd.DataFrame(columns=["station_id", "issued", "target_day", "target"] + FEATURES)
    return pd.concat(frames, ignore_index=True)


def _station_rows(g: pd.DataFrame, regional: pd.Series, code: float, max_horizon: int, live: bool) -> Optional[pd.DataFrame]:
    if live:
        last = g["salinity"].last_valid_index()
        if last is None:
            return None
        g = g.loc[:last]
    # Thêm một ngày sau ngày cuối: dòng phát hành ngày L+1 thấy số đo tới L, là dòng dự báo thật
    index = pd.date_range(g.index.min(), g.index.max() + pd.Timedelta(days=1), freq="D")
    g = g.reindex(index)
    s, w = g["salinity"], g["water_level"]
    r = regional.reindex(index)

    prev = s.shift(1)
    base = pd.DataFrame(index=index)
    base["s0"] = prev                                   # số mới nhất lúc phát hành: ngày D-1
    for k in range(1, 7):
        base[f"s{k}"] = s.shift(1 + k)
    base["s_mean7"] = prev.rolling(7, min_periods=4).mean()
    base["s_max7"] = prev.rolling(7, min_periods=4).max()
    base["s_min7"] = prev.rolling(7, min_periods=4).min()
    base["s_mean30"] = prev.rolling(30, min_periods=10).mean()
    base["s_max30"] = prev.rolling(30, min_periods=10).max()
    base["w0"] = w.shift(1)
    base["w_mean7"] = w.shift(1).rolling(7, min_periods=4).mean()
    base["w_diff"] = base["w0"] - base["w_mean7"]
    base["r0"] = r.shift(1)                             # trung bình toàn vùng ngày D-1
    base["r_diff3"] = r.shift(1) - r.shift(4)
    base["ly_s0"] = s.shift(1 + 365)                    # cùng thời điểm năm trước (số đã biết)
    if live:
        base = base.iloc[[-1]]
    base = base[base["s0"].notna()]
    if base.empty:
        return None

    frames = []
    for h in range(1, max_horizon + 1):
        f = base.copy()
        target_day = f.index + pd.Timedelta(days=h)
        f["h"] = h
        f["issued"] = f.index
        f["target_day"] = target_day
        f["target"] = s.reindex(target_day).to_numpy()
        f["ly_target"] = s.reindex(target_day - pd.Timedelta(days=365)).to_numpy()  # ngày mục tiêu, năm trước
        doy = target_day.dayofyear
        f["doy_sin"] = np.sin(2 * np.pi * doy / 365.25)
        f["doy_cos"] = np.cos(2 * np.pi * doy / 365.25)
        f["station"] = code
        frames.append(f)
    rows = pd.concat(frames, ignore_index=True)
    rows[FEATURES] = rows[FEATURES].astype(np.float32)
    return rows
