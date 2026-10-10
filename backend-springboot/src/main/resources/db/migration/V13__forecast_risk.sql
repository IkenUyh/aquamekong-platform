-- ============================================================
-- AquaMekong — V13: mức rủi ro của dự báo (cảnh báo sớm)
-- ============================================================

-- Mức độ mặn có thể lên tới (phân vị 80% của mô hình rủi ro ở ML service). Dự báo giữ nguyên số mới nhất
-- không bao giờ báo trước được lần độ mặn bắt đầu vượt ngưỡng; mức này vượt ngưỡng của người dùng thì app báo sớm.
-- Chỉ mô hình rủi ro điền: khoảng tin cậy (lower/upper_bound) của mô hình khác không được hiệu chỉnh để cảnh báo.
ALTER TABLE salinity_forecasts ADD COLUMN risk_salinity DOUBLE PRECISION;

-- Ngày cuối cùng mà dự báo từng báo trạm có thể vượt ngưỡng của người theo dõi. Cảnh báo giữ tới hết ngày đó dù
-- dự báo sáng sau không còn thấy: mức rủi ro lên xuống từng ngày, không giữ thì app báo "đã giảm" ngay trước khi mặn vượt thật.
ALTER TABLE station_watches ADD COLUMN risk_until DATE;
