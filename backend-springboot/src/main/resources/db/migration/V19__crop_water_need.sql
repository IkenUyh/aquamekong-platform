-- ============================================================
-- AquaMekong — V19: nhu cầu nước của cây (Kc theo giai đoạn) và ET₀ theo tháng, cho kế hoạch trữ nước của ruộng
-- ============================================================
-- Lượng nước cây cần mỗi ngày (m³) = diện tích (ha) × 10 × Kc × ET₀ (mm/ngày), theo FAO 56 (ETc = Kc × ET₀).
-- Mỗi con số đi kèm nguồn; cây chưa có nguồn thì để NULL và app không tính lượng nước trữ cho cây đó.
-- Nguồn ghi "qua trích dẫn" khi chưa đọc được bản gốc (tra 11/2026).

ALTER TABLE crop_stages
    ADD COLUMN kc        DOUBLE PRECISION CHECK (kc > 0 AND kc <= 2),
    ADD COLUMN kc_source TEXT,
    ADD CONSTRAINT crop_stages_kc_source CHECK ((kc IS NULL) = (kc_source IS NULL));

-- ET₀ (bốc thoát hơi nước tham chiếu, mm/ngày) dùng chung cho cả ĐBSCL, theo tháng
CREATE TABLE et0_monthly (
    month      INT              PRIMARY KEY CHECK (month BETWEEN 1 AND 12),
    et0_mm_day DOUBLE PRECISION NOT NULL CHECK (et0_mm_day > 0 AND et0_mm_day <= 15),
    source     TEXT             NOT NULL
);

-- ------------------------------------------------------------
-- Kc: FAO 56 (Allen, Pereira, Raes & Smith 1998), Table 12, đọc bản gốc:
-- https://www.fao.org/4/x0490e/x0490e0b.htm
-- Bảng cho khí hậu bán ẩm (RHmin ≈ 45%, gió 2 m/s); ĐBSCL ẩm hơn, FAO 56 (Eq. 62) hạ nhẹ Kc mid/end khi đó.
-- App chưa hiệu chỉnh: lượng nước tính ra hơi cao, tức thiên về trữ dư.
-- ------------------------------------------------------------
UPDATE crop_stages cs SET kc = v.kc, kc_source = v.source
FROM (VALUES
    ('lua', 'ma', 1.05,
     'FAO 56 (Allen et al. 1998), Table 12, dòng Rice: Kc ini 1,05. https://www.fao.org/4/x0490e/x0490e0b.htm. App gán Kc ini cho mạ và đẻ nhánh, Kc mid cho làm đòng – trổ, Kc end cho chín; FAO nội suy tuyến tính giữa các mốc, app lấy bậc thang cho gọn.'),
    ('lua', 'de_nhanh', 1.05,
     'FAO 56 (Allen et al. 1998), Table 12, dòng Rice: Kc ini 1,05. https://www.fao.org/4/x0490e/x0490e0b.htm. App gán Kc ini cho cả giai đoạn đẻ nhánh; FAO tăng dần từ Kc ini lên Kc mid trong pha phát triển, nên cuối đẻ nhánh số thật cao hơn.'),
    ('lua', 'lam_dong_tro', 1.20,
     'FAO 56 (Allen et al. 1998), Table 12, dòng Rice: Kc mid 1,20. https://www.fao.org/4/x0490e/x0490e0b.htm'),
    ('lua', 'chin', 0.90,
     'FAO 56 (Allen et al. 1998), Table 12, dòng Rice: Kc end 0,90 – 0,60. https://www.fao.org/4/x0490e/x0490e0b.htm. App lấy đầu cao 0,90 (đầu pha chín), để không thiếu nước.'),
    ('mia', 'ca_vu', 1.25,
     'FAO 56 (Allen et al. 1998), Table 12, dòng Sugar Cane: Kc ini 0,40, mid 1,25, end 0,75. https://www.fao.org/4/x0490e/x0490e0b.htm. Mía trong app không chia giai đoạn: lấy Kc mid (cao nhất) cho cả vụ, nên lượng nước tính ra là mức cao.'),
    ('buoi', 'ca_nam', 0.70,
     'FAO 56 (Allen et al. 1998), Table 12, dòng Citrus, no ground cover, 70% canopy: Kc 0,70 / 0,65 / 0,70. https://www.fao.org/4/x0490e/x0490e0b.htm. FAO 56 không có bưởi; dùng dòng Citrus như V14 dùng Grapefruit. App lấy 0,70 cho cả năm; chú thích 21 của bảng cho phép cộng 0,1 – 0,2 ở vùng ẩm, app chưa cộng. Vườn có cỏ phủ: FAO cho 0,75 – 0,85.'),
    ('cam', 'ca_nam', 0.70,
     'FAO 56 (Allen et al. 1998), Table 12, dòng Citrus, no ground cover, 70% canopy: Kc 0,70 / 0,65 / 0,70. https://www.fao.org/4/x0490e/x0490e0b.htm. App lấy 0,70 cho cả năm; chú thích 21 của bảng cho phép cộng 0,1 – 0,2 ở vùng ẩm, app chưa cộng. Vườn có cỏ phủ: FAO cho 0,75 – 0,85.'),
    ('quyt', 'ca_nam', 0.70,
     'FAO 56 (Allen et al. 1998), Table 12, dòng Citrus, no ground cover, 70% canopy: Kc 0,70 / 0,65 / 0,70. https://www.fao.org/4/x0490e/x0490e0b.htm. App lấy 0,70 cho cả năm; chú thích 21 của bảng cho phép cộng 0,1 – 0,2 ở vùng ẩm, app chưa cộng. Vườn có cỏ phủ: FAO cho 0,75 – 0,85.'),
    ('dua', 'ca_nam', 1.00,
     'FAO 56 (Allen et al. 1998), Table 12, dòng Palm Trees: Kc 0,95 / 1,00 / 1,00. https://www.fao.org/4/x0490e/x0490e0b.htm. FAO 56 không có dòng riêng cho dừa; dùng dòng cây họ cau (Palm Trees), lấy Kc mid 1,00 cho cả năm.'),
    ('rau_mau', 'ca_vu', 1.05,
     'FAO 56 (Allen et al. 1998), Table 12, dòng Beans, green: Kc 0,5 / 1,05 / 0,90. https://www.fao.org/4/x0490e/x0490e0b.htm. Như V14, rau màu lấy theo đậu; không chia giai đoạn nên lấy Kc mid 1,05 cho cả vụ.')
) AS v(crop_code, code, kc, source)
WHERE cs.code = v.code AND cs.crop_id = (SELECT id FROM crops WHERE code = v.crop_code);

-- Chưa có Kc (để NULL, app không tính lượng nước trữ): sầu riêng, xoài, chôm chôm, măng cụt (FAO 56 Table 12
-- không có các cây này, chưa tìm được số của SOFRI hay nghiên cứu ở ĐBSCL); nước sinh hoạt và thuỷ sản không dùng Kc.

-- ------------------------------------------------------------
-- ET₀: chưa tìm được bảng ET₀ theo tháng của trạm Cần Thơ đọc được (CLIMWAT/CROPWAT của FAO chỉ phát qua phần mềm;
-- các bài tiếng Việt tìm được không đọc được bảng). Tạm dùng mức chỉ dẫn của FAO cho vùng ẩm, nhiệt độ trung bình
-- trên 25°C: 5 – 6 mm/ngày, lấy đầu thấp 5 cho mọi tháng. FAO ghi đây là ước lượng thô. Thay bằng số trạm
-- (CLIMWAT Cần Thơ hoặc nguồn Việt Nam) bằng một migration mới khi có.
-- ------------------------------------------------------------
INSERT INTO et0_monthly (month, et0_mm_day, source)
SELECT m, 5.0,
       'FAO Irrigation Water Management Training Manual No. 3 "Irrigation Water Needs" (Brouwer & Heibloem 1986), mục 3.1.5, Table 5 "Indicative values of ETo": vùng ẩm (Humid), nhiệt độ trung bình ngày trên 25°C: 5 – 6 mm/ngày; app lấy 5. https://www.fao.org/4/s2022e/s2022e07.htm. Ước lượng thô, không theo tháng, không riêng cho ĐBSCL.'
FROM generate_series(1, 12) AS m;
