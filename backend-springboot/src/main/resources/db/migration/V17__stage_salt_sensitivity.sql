-- ============================================================
-- AquaMekong — V17: hệ số nhạy mặn theo giai đoạn, cho mức mặn tích lũy và năng suất có thể giảm
-- ============================================================
-- Mức mặn tích lũy của ruộng = Σ (mặn trong ngày − ngưỡng) × hệ số nhạy của giai đoạn hôm đó.
-- Hệ số 1 = tính như FAO 29 (đường FAO lấy độ mặn trung bình cả vụ, không phân giai đoạn).
-- Tài liệu chỉ xếp hạng giai đoạn nhạy hay chịu được, không cho hệ số bằng số: số dưới đây do app tự đặt theo
-- xếp hạng đó, sao cho trung bình cả vụ lúa gần 1 (giống 95 ngày: (30×1 + 35×1,5 + 30×0,5) / 95 ≈ 1,03),
-- để mặn đều cả vụ vẫn ra đúng mức giảm của FAO.

ALTER TABLE crop_stages
    ADD COLUMN salt_sensitivity   DOUBLE PRECISION NOT NULL DEFAULT 1 CHECK (salt_sensitivity > 0 AND salt_sensitivity <= 3),
    ADD COLUMN sensitivity_source TEXT;

-- Nguồn chung cho lúa (tra 11/2026, qua trích dẫn, chưa đọc bản gốc): lúa nhạy mặn ở giai đoạn mạ (1–3 tuần đầu),
-- chịu được hơn khi đẻ nhánh, nhạy nhất từ làm đòng tới trổ và thụ phấn, chịu tốt hơn khi chín.
-- IAEA TECDOC-1969; Zeng & Shannon (2000), Crop Science 40: 996–1003; Zeng et al. (2001), Agricultural Water Management 48: 191–206.
UPDATE crop_stages cs SET salt_sensitivity = v.factor, sensitivity_source = v.source
FROM (VALUES
    ('ma', 1.5, 'App tự đặt theo xếp hạng định tính: mạ (1–3 tuần đầu) nhạy mặn. IAEA TECDOC-1969 (https://www-pub.iaea.org/MTCD/Publications/PDF/TE-1969web.pdf), qua trích dẫn, chưa đọc bản gốc. Mạ chưa có mốc ngày nên hiện gộp vào đẻ nhánh.'),
    ('de_nhanh', 1.0, 'App tự đặt theo xếp hạng định tính: lúa chịu mặn khá hơn khi đẻ nhánh; giữ như FAO 29. IAEA TECDOC-1969, qua trích dẫn, chưa đọc bản gốc. Zeng et al. (2001) lại thấy mặn sớm (tới làm đòng) làm giảm năng suất nhiều; các nguồn chưa thống nhất.'),
    ('lam_dong_tro', 1.5, 'App tự đặt theo xếp hạng định tính: từ làm đòng tới trổ, thụ phấn là giai đoạn lúa nhạy mặn nhất về năng suất hạt. IAEA TECDOC-1969, qua trích dẫn, chưa đọc bản gốc.'),
    ('chin', 0.5, 'App tự đặt theo xếp hạng định tính: lúa chịu mặn tốt hơn khi chín; mặn sau trổ ít ảnh hưởng năng suất. IAEA TECDOC-1969, qua trích dẫn, chưa đọc bản gốc.')
) AS v(code, factor, source)
WHERE cs.code = v.code AND cs.crop_id = (SELECT id FROM crops WHERE code = 'lua');
