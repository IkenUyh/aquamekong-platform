-- ============================================================
-- AquaMekong — V14: bảng cây trồng / mục đích dùng nước, giai đoạn và ngưỡng mặn có ghi nguồn
-- ============================================================
-- Thay 4 mức viết cứng trong frontend/src/utils/crops.ts. Mỗi con số đi kèm nguồn của nó.
-- Nguồn ghi "qua trích dẫn" khi chưa đọc được bản gốc (trang gốc không truy cập được lúc tra, 11/2026).
-- Đổi dS/m sang ‰ theo xấp xỉ ‰ ≈ 0,64 × dS/m (tính ở API, bảng giữ đúng số ECw FAO in ra).

CREATE TABLE crops (
    id            BIGSERIAL PRIMARY KEY,
    code          VARCHAR(30)  NOT NULL UNIQUE,
    name          VARCHAR(60)  NOT NULL UNIQUE,
    -- CROP: cây trồng (nước tưới); DOMESTIC_WATER: nước sinh hoạt; AQUACULTURE: nuôi trồng thuỷ sản (cần khoảng mặn)
    category      VARCHAR(20)  NOT NULL CHECK (category IN ('CROP', 'DOMESTIC_WATER', 'AQUACULTURE')),
    sort_order    INT          NOT NULL,
    -- Đường giảm năng suất FAO 29 (Ayers & Westcot 1985, Table 4): ECw (dS/m) ứng với năng suất còn 100/90/75/50%.
    -- NULL = FAO 29 không có số cho cây này
    fao_ecw_100   DOUBLE PRECISION,
    fao_ecw_90    DOUBLE PRECISION,
    fao_ecw_75    DOUBLE PRECISION,
    fao_ecw_50    DOUBLE PRECISION,
    fao_source    TEXT,
    fao_note      TEXT,
    CHECK ((fao_ecw_100 IS NULL) = (fao_source IS NULL)),
    CHECK (fao_ecw_100 IS NULL OR (fao_ecw_100 < fao_ecw_90 AND fao_ecw_90 < fao_ecw_75 AND fao_ecw_75 < fao_ecw_50))
);

-- Giai đoạn của cây, theo thứ tự từ lúc gieo/trồng. Cây không chia giai đoạn có một dòng duy nhất (cả vụ / cả năm).
-- duration_days: số ngày cố định của giai đoạn. flexible = TRUE: giai đoạn nhận phần ngày còn lại
-- (số ngày của giống trừ các giai đoạn cố định), mỗi cây có đúng một giai đoạn như vậy.
-- Giai đoạn không cố định cũng không co giãn (duration_days NULL, flexible FALSE) là chưa có nguồn cho mốc ngày:
-- app gộp nó vào giai đoạn co giãn kế tiếp cho tới khi bổ sung số.
CREATE TABLE crop_stages (
    id               BIGSERIAL PRIMARY KEY,
    crop_id          BIGINT       NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
    code             VARCHAR(30)  NOT NULL,
    name             VARCHAR(60)  NOT NULL,
    stage_order      INT          NOT NULL,
    duration_days    INT          CHECK (duration_days > 0),
    flexible         BOOLEAN      NOT NULL DEFAULT FALSE,
    duration_source  TEXT,
    -- Ngưỡng cảnh báo theo khuyến cáo Việt Nam (‰): báo khi độ mặn vượt max_salinity hoặc dưới min_salinity
    max_salinity     DOUBLE PRECISION CHECK (max_salinity > 0 AND max_salinity <= 40),
    min_salinity     DOUBLE PRECISION CHECK (min_salinity >= 0),
    threshold_source TEXT,
    threshold_note   TEXT,
    UNIQUE (crop_id, code),
    UNIQUE (crop_id, stage_order),
    CHECK (NOT (flexible AND duration_days IS NOT NULL)),
    CHECK (min_salinity IS NULL OR (max_salinity IS NOT NULL AND min_salinity < max_salinity)),
    CHECK ((max_salinity IS NULL) = (threshold_source IS NULL)),
    CHECK (duration_days IS NULL OR duration_source IS NOT NULL)
);

-- Chặn cận dưới cho mức cần khoảng mặn (nuôi tôm): báo cả khi độ mặn xuống dưới mức này
ALTER TABLE station_watches
    ADD COLUMN min_threshold DOUBLE PRECISION CHECK (min_threshold >= 0),
    ADD CONSTRAINT station_watches_min_below_max CHECK (min_threshold IS NULL OR min_threshold < threshold);

-- ------------------------------------------------------------
-- Dữ liệu
-- ------------------------------------------------------------
INSERT INTO crops (code, name, category, sort_order, fao_ecw_100, fao_ecw_90, fao_ecw_75, fao_ecw_50, fao_source, fao_note) VALUES
('lua', 'Lúa', 'CROP', 10, 2.0, 2.6, 3.4, 4.8,
 'FAO 29 Rev.1 (Ayers & Westcot 1985), Table 4, dòng Rice (paddy). https://www.fao.org/4/t0234e/T0234E03.htm', NULL),
('sau_rieng', 'Sầu riêng', 'CROP', 20, NULL, NULL, NULL, NULL, NULL,
 'FAO 29 không có sầu riêng.'),
('buoi', 'Bưởi', 'CROP', 30, 1.2, 1.6, 2.2, 3.3,
 'FAO 29 Rev.1 (Ayers & Westcot 1985), Table 4, dòng Grapefruit. https://www.fao.org/4/t0234e/T0234E03.htm',
 'FAO 29 không có bưởi (pomelo); dùng dòng Grapefruit, cây cùng chi Citrus.'),
('xoai', 'Xoài', 'CROP', 40, NULL, NULL, NULL, NULL, NULL,
 'FAO 29 chỉ xếp xoài vào nhóm Sensitive (Table 5), không có số.'),
('dua', 'Dừa', 'CROP', 50, NULL, NULL, NULL, NULL, NULL,
 'FAO 29 không có dừa.'),
('mia', 'Mía', 'CROP', 60, 1.1, 2.3, 4.0, 6.8,
 'FAO 29 Rev.1 (Ayers & Westcot 1985), Table 4, dòng Sugarcane. https://www.fao.org/4/t0234e/T0234E03.htm', NULL),
('rau_mau', 'Rau màu', 'CROP', 70, 0.7, 1.0, 1.5, 2.4,
 'FAO 29 Rev.1 (Ayers & Westcot 1985), Table 4, dòng Bean (Phaseolus vulgaris). https://www.fao.org/4/t0234e/T0234E03.htm',
 'Rau màu là một nhóm; lấy theo đậu, loại nhạy mặn nhất trong bảng FAO trồng phổ biến ở ĐBSCL.'),
('nuoc_sinh_hoat', 'Nước sinh hoạt', 'DOMESTIC_WATER', 80, NULL, NULL, NULL, NULL, NULL, NULL),
('tom_su', 'Nuôi tôm sú', 'AQUACULTURE', 90, NULL, NULL, NULL, NULL, NULL, NULL),
('tom_the', 'Nuôi tôm thẻ chân trắng', 'AQUACULTURE', 100, NULL, NULL, NULL, NULL, NULL, NULL);

-- Nguồn dùng lại nhiều lần
-- Lúa: Báo Vĩnh Long 25/01/2015, "Sự xâm nhập mặn bất thường" (khuyến cáo cấp nước cho cây trồng, có dẫn Cục Trồng trọt)
-- Mốc ngày lúa: IRRI (Rice Knowledge Bank), qua trích dẫn
INSERT INTO crop_stages (crop_id, code, name, stage_order, duration_days, flexible, duration_source,
                         max_salinity, min_salinity, threshold_source, threshold_note)
SELECT c.id, s.code, s.name, s.stage_order, s.duration_days, s.flexible, s.duration_source,
       s.max_salinity, s.min_salinity, s.threshold_source, s.threshold_note
FROM (VALUES
    ('lua', 'ma', 'Mạ', 1, NULL::INT, FALSE, NULL::TEXT, 1.0, NULL::DOUBLE PRECISION,
     'Báo Vĩnh Long 25/01/2015, "Sự xâm nhập mặn bất thường": tưới cho lúa giai đoạn mạ không quá 1‰. https://baovinhlong.com.vn/xa-hoi/201501/su-xam-nhap-man-bat-thuong-2560120/',
     'Chưa có nguồn cho mốc ngày kết thúc giai đoạn mạ: app gộp vào đẻ nhánh cho tới khi bổ sung.'),
    ('lua', 'de_nhanh', 'Đẻ nhánh', 2, NULL, TRUE,
     'Độ dài khác nhau giữa các giống nằm ở pha sinh dưỡng (IRRI, Rice Knowledge Bank; qua trích dẫn, chưa đọc bản gốc).',
     4.0, NULL,
     'Báo Vĩnh Long 25/01/2015: không quá 4‰ cho lúa ở giai đoạn sinh trưởng (sau mạ). https://baovinhlong.com.vn/xa-hoi/201501/su-xam-nhap-man-bat-thuong-2560120/',
     NULL),
    ('lua', 'lam_dong_tro', 'Làm đòng – trổ', 3, 35, FALSE,
     'IRRI (Rice Knowledge Bank): pha sinh sản (làm đòng → trổ) khoảng 35 ngày ở vùng nhiệt đới; qua trích dẫn (factsheet AAU Assam), chưa đọc bản gốc.',
     4.0, NULL,
     'Báo Vĩnh Long 25/01/2015: không quá 4‰ cho lúa ở giai đoạn sinh trưởng (sau mạ). https://baovinhlong.com.vn/xa-hoi/201501/su-xam-nhap-man-bat-thuong-2560120/',
     'Nguồn không tách riêng làm đòng và trổ, dù đây là giai đoạn lúa nhạy mặn. Theo FAO 29, năng suất bắt đầu giảm từ 1,28‰.'),
    ('lua', 'chin', 'Chín', 4, 30, FALSE,
     'IRRI (Rice Knowledge Bank): pha chín khoảng 30 ngày; qua trích dẫn (factsheet AAU Assam), chưa đọc bản gốc.',
     4.0, NULL,
     'Báo Vĩnh Long 25/01/2015: không quá 4‰ cho lúa ở giai đoạn sinh trưởng (sau mạ). https://baovinhlong.com.vn/xa-hoi/201501/su-xam-nhap-man-bat-thuong-2560120/',
     NULL),
    ('sau_rieng', 'ca_nam', 'Cả năm', 1, NULL, TRUE, NULL, 0.5, NULL,
     'Viện Cây ăn quả miền Nam (SOFRI), "Phòng chống hạn mặn cho cây sầu riêng trong mùa khô", 06/11/2023: nước dưới 0,5‰ thì tưới bình thường. https://sofri.org.vn/vi/phong-chong-han-man-cho-cay-sau-rieng-trong-mua-kho.html',
     'SOFRI: hạn chế tưới nước trên 0,5‰ nhất là giai đoạn ra hoa và mang quả; cây chịu được dưới 1‰.'),
    ('buoi', 'ca_nam', 'Cả năm', 1, NULL, TRUE, NULL, 1.0, NULL,
     'TS Võ Hữu Thoại (SOFRI), Báo Nông nghiệp Việt Nam 13/08/2020, "Biện pháp kỹ thuật canh tác cây ăn quả trong điều kiện hạn mặn": hạn chế tối đa tưới nước khi độ mặn ≥ 1‰. https://nongnghiepmoitruong.vn/bien-phap-ky-thuat-canh-tac-cay-an-qua-trong-dieu-kien-han-man-d270864.html',
     'Ngưỡng chung cho cây ăn quả, không riêng cho bưởi.'),
    ('xoai', 'ca_nam', 'Cả năm', 1, NULL, TRUE, NULL, 1.0, NULL,
     'TS Võ Hữu Thoại (SOFRI), Báo Nông nghiệp Việt Nam 13/08/2020, "Biện pháp kỹ thuật canh tác cây ăn quả trong điều kiện hạn mặn": hạn chế tối đa tưới nước khi độ mặn ≥ 1‰. https://nongnghiepmoitruong.vn/bien-phap-ky-thuat-canh-tac-cay-an-qua-trong-dieu-kien-han-man-d270864.html',
     'Ngưỡng chung cho cây ăn quả, không riêng cho xoài.'),
    ('dua', 'ca_nam', 'Cả năm', 1, NULL, TRUE, NULL, 2.0, NULL,
     'Công văn 702 của Sở NN&PTNT Bến Tre (03/2022), qua trích dẫn của Báo Đồng Khởi 15/03/2022, chưa đọc bản gốc: dừa chịu mặn khoảng 4‰ nhưng nên quản lý nước tưới ở mức khoảng 2‰ trở lại.',
     'Sở lưu ý đây là khả năng chịu mặn ngắn hạn; mặn kéo dài thì cây chịu kém hơn.'),
    ('mia', 'ca_vu', 'Cả vụ', 1, NULL, TRUE, NULL, 0.7, NULL,
     'FAO 29 Rev.1, Table 4, Sugarcane: ECw 1,1 dS/m ứng với năng suất 100% (≈ 0,70‰). https://www.fao.org/4/t0234e/T0234E03.htm',
     'Chưa tìm được khuyến cáo của Việt Nam cho mía; tạm lấy mức FAO 29 năng suất 100%.'),
    ('rau_mau', 'ca_vu', 'Cả vụ', 1, NULL, TRUE, NULL, 0.5, NULL,
     'Đề tài "Nghiên cứu xây dựng bộ chỉ tiêu về chất lượng nước tưới cho một số loại cây trồng chính", PGS.TS Nguyễn Thị Hằng Nga, Trường ĐH Thủy lợi (VINALAB, 25/03/2025): rau ăn lá bắt đầu giảm năng suất khi độ mặn trên 0,5‰. https://vinalab.org.vn/trao-doi-kinh-nghiem/nghien-cuu-xay-dung-bo-chi-tieu-ve-chat-luong-nuoc-tuoi-cho-mot-so-loai-cay-trong-chinh',
     'Nghiên cứu ở đồng bằng sông Hồng, cho rau ăn lá (cải, mồng tơi, xà lách).'),
    ('nuoc_sinh_hoat', 'ca_nam', 'Cả năm', 1, NULL, TRUE, NULL, 0.45, NULL,
     'QCVN 01-1:2018/BYT (thay bằng QCVN 01-1:2024/BYT từ 01/07/2025, cùng giới hạn): clorua tối đa 250 mg/L; quy đổi 0,25 g/L × 1,80655 ≈ 0,45‰. Qua trích dẫn, chưa đọc bản gốc.',
     'Quy chuẩn cho phép tới 300 mg/L clorua ở một số vùng; app dùng mức 250 mg/L.'),
    ('tom_su', 'ca_vu', 'Cả vụ', 1, NULL, TRUE, NULL, 35, 5,
     'QCVN 02-19:2014/BNNPTNT, Phụ lục 1, Bảng 1 (chất lượng nước cấp và nước ao nuôi tôm sú, tôm chân trắng): độ mặn 5 – 35‰. https://caselaw.vn/van-ban-phap-luat/264734-thong-tu-22-2014-tt-bnnptnt-ban-hanh-quy-chuan-ky-thuat-quoc-gia-ve-dieu-kien-nuoi-thuy-san-do-bo-truong-bo-nong-nghiep-va-phat-trien-nong-thon-ban-hanh',
     'Quy chuẩn đã bị Thông tư 05/2023/TT-BNNPTNT bãi bỏ từ 01/11/2023, chưa có văn bản thay số độ mặn. Bảng ghi chung một khoảng cho tôm sú và tôm chân trắng.'),
    ('tom_the', 'ca_vu', 'Cả vụ', 1, NULL, TRUE, NULL, 35, 5,
     'QCVN 02-19:2014/BNNPTNT, Phụ lục 1, Bảng 1 (chất lượng nước cấp và nước ao nuôi tôm sú, tôm chân trắng): độ mặn 5 – 35‰. https://caselaw.vn/van-ban-phap-luat/264734-thong-tu-22-2014-tt-bnnptnt-ban-hanh-quy-chuan-ky-thuat-quoc-gia-ve-dieu-kien-nuoi-thuy-san-do-bo-truong-bo-nong-nghiep-va-phat-trien-nong-thon-ban-hanh',
     'Quy chuẩn đã bị Thông tư 05/2023/TT-BNNPTNT bãi bỏ từ 01/11/2023, chưa có văn bản thay số độ mặn. Bảng ghi chung một khoảng cho tôm sú và tôm chân trắng.')
) AS s(crop_code, code, name, stage_order, duration_days, flexible, duration_source,
       max_salinity, min_salinity, threshold_source, threshold_note)
JOIN crops c ON c.code = s.crop_code;

-- Theo dõi đã lưu với loại cây cũ không còn trong bảng (vd. "Cây ăn trái"): giữ ngưỡng, coi như tự đặt
UPDATE station_watches SET crop = NULL
WHERE crop IS NOT NULL AND crop NOT IN (SELECT name FROM crops);
