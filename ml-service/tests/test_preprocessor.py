from app.pipeline.preprocessor import DataPreprocessor

RAW = [
    {"station_code": "CT-001", "recorded_at": "2026-10-01T00:00:00+00:00", "salinity": 1.0, "water_level": 1.2, "flow_rate": 3000},
    {"station_code": "CT-001", "recorded_at": "2026-10-01T02:00:00+00:00", "salinity": 3.0, "water_level": 1.4, "flow_rate": 3200},
]


def test_scale_false_keeps_real_units_and_interpolates_gaps():
    df = DataPreprocessor().process(RAW, scale=False)
    assert list(df["salinity"]) == [1.0, 2.0, 3.0]  # 01:00 được nội suy
    assert df["flow_rate"].max() == 3200


def test_scale_true_maps_to_unit_range():
    df = DataPreprocessor().process(RAW, scale=True)
    assert df["salinity"].min() == 0.0
    assert df["salinity"].max() == 1.0
