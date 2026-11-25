-- ============================================================
-- AquaMekong — V16: thêm cây ăn quả và thuỷ sản nhạy mặn; hồ sơ ruộng dùng chung, không cần tài khoản
-- ============================================================
-- Nguồn tra 11/2026. Số nào chưa đọc được bản gốc thì ghi "qua trích dẫn"; loài chưa có nguồn thì để trống ngưỡng.

-- Hồ sơ ruộng dùng chung toàn server: khách cũng khai, sửa, xoá được. Ruộng do tài khoản tạo vẫn gắn tài khoản đó
-- để gửi thông báo đẩy; ruộng của khách (user_id NULL) không có theo dõi trạm.
ALTER TABLE field_profiles ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE field_profiles DROP CONSTRAINT field_profiles_user_id_fkey,
    ADD CONSTRAINT field_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

INSERT INTO crops (code, name, category, sort_order, fao_ecw_100, fao_ecw_90, fao_ecw_75, fao_ecw_50, fao_source, fao_note) VALUES
('chom_chom', 'Chôm chôm', 'CROP', 22, NULL, NULL, NULL, NULL, NULL, 'FAO 29 không có chôm chôm.'),
('mang_cut', 'Măng cụt', 'CROP', 24, NULL, NULL, NULL, NULL, NULL, 'FAO 29 không có măng cụt.'),
('cam', 'Cam', 'CROP', 32, 1.1, 1.6, 2.2, 3.2,
 'FAO 29 Rev.1 (Ayers & Westcot 1985), Table 4, dòng Orange. https://www.fao.org/4/t0234e/T0234E03.htm', NULL),
('quyt', 'Quýt', 'CROP', 34, 1.1, 1.6, 2.2, 3.2,
 'FAO 29 Rev.1 (Ayers & Westcot 1985), Table 4, dòng Orange. https://www.fao.org/4/t0234e/T0234E03.htm',
 'FAO 29 không có quýt; dùng dòng Orange, cây cùng chi Citrus.'),
('tom_cang_xanh', 'Nuôi tôm càng xanh', 'AQUACULTURE', 105, NULL, NULL, NULL, NULL, NULL, NULL),
('ca_tra', 'Nuôi cá tra', 'AQUACULTURE', 110, NULL, NULL, NULL, NULL, NULL, NULL),
('ca_basa', 'Nuôi cá basa', 'AQUACULTURE', 120, NULL, NULL, NULL, NULL, NULL, NULL),
('ca_loc', 'Nuôi cá lóc', 'AQUACULTURE', 130, NULL, NULL, NULL, NULL, NULL, NULL),
('ca_ro_dong', 'Nuôi cá rô đồng', 'AQUACULTURE', 140, NULL, NULL, NULL, NULL, NULL, NULL),
('ca_that_lat', 'Nuôi cá thát lát', 'AQUACULTURE', 150, NULL, NULL, NULL, NULL, NULL, NULL);

INSERT INTO crop_stages (crop_id, code, name, stage_order, duration_days, flexible, duration_source,
                         max_salinity, min_salinity, threshold_source, threshold_note)
SELECT c.id, s.code, s.name, 1, NULL, TRUE, NULL, s.max_salinity, NULL, s.threshold_source, s.threshold_note
FROM (VALUES
    ('chom_chom', 'ca_nam', 'Cả năm', 0.5,
     'TS Võ Hữu Thoại (SOFRI), Báo Nông nghiệp Việt Nam 01/05/2020, "Biện pháp kỹ thuật bảo vệ vườn cây ăn trái": cây mẫn cảm với mặn như sầu riêng, chôm chôm, măng cụt không tưới nước có độ mặn trên 0,5‰. https://nongnghiepmoitruong.vn/bien-phap-ky-thuat-bao-ve-vuon-cay-an-trai-d263334.html',
     NULL),
    ('mang_cut', 'ca_nam', 'Cả năm', 0.5,
     'TS Võ Hữu Thoại (SOFRI), Báo Nông nghiệp Việt Nam 01/05/2020, "Biện pháp kỹ thuật bảo vệ vườn cây ăn trái": cây mẫn cảm với mặn như sầu riêng, chôm chôm, măng cụt không tưới nước có độ mặn trên 0,5‰. https://nongnghiepmoitruong.vn/bien-phap-ky-thuat-bao-ve-vuon-cay-an-trai-d263334.html',
     NULL),
    ('cam', 'ca_nam', 'Cả năm', 1.0,
     'TS Võ Hữu Thoại (SOFRI), Báo Nông nghiệp Việt Nam 13/08/2020, "Biện pháp kỹ thuật canh tác cây ăn quả trong điều kiện hạn mặn": hạn chế tối đa tưới nước khi độ mặn ≥ 1‰. https://nongnghiepmoitruong.vn/bien-phap-ky-thuat-canh-tac-cay-an-qua-trong-dieu-kien-han-man-d270864.html',
     'Ngưỡng chung cho cây ăn quả, không riêng cho cam.'),
    ('quyt', 'ca_nam', 'Cả năm', 1.0,
     'TS Võ Hữu Thoại (SOFRI), Báo Nông nghiệp Việt Nam 13/08/2020, "Biện pháp kỹ thuật canh tác cây ăn quả trong điều kiện hạn mặn": hạn chế tối đa tưới nước khi độ mặn ≥ 1‰. https://nongnghiepmoitruong.vn/bien-phap-ky-thuat-canh-tac-cay-an-qua-trong-dieu-kien-han-man-d270864.html',
     'Ngưỡng chung cho cây ăn quả, không riêng cho quýt.'),
    ('tom_cang_xanh', 'ca_vu', 'Cả vụ', 10,
     'Trung tâm Khuyến nông Quốc gia, "Kỹ thuật nuôi tôm càng xanh xen lúa vùng nước lợ": duy trì độ mặn 0–10‰ trong giai đoạn nuôi. Qua trích dẫn, chưa đọc bản gốc. https://khuyennongvn.gov.vn/khoa-hoc-cong-nghe/khcn-trong-nuoc/ky-thuat-nuoi-tom-cang-xanh-xen-lua-vung-nuoc-lo-23198.html',
     'Ấu trùng cần nước lợ khoảng 10–13‰; ngưỡng này cho tôm nuôi thương phẩm.'),
    ('ca_tra', 'ca_vu', 'Cả vụ', 8,
     'Báo Vĩnh Long 02/02/2021, "Ngưỡng chịu mặn của thủy sản nuôi" (mục Bạn nhà nông): cá tra thuộc nhóm chịu độ mặn 3–8‰. https://baovinhlong.com.vn/kinh-te/nong-nghiep/202102/nha-nong-tim-hieu-nguong-chiu-man-cua-thuy-san-nuoi-3042094/',
     'Trường Thủy sản, ĐH Cần Thơ (dự án PANGAGEN): cá tra thường chậm lớn và hao hụt từ khoảng 10‰; dòng chọn lọc chịu mặn lớn tốt ở 5–10‰.'),
    ('ca_basa', 'ca_vu', 'Cả vụ', NULL, NULL,
     'Chưa có nguồn: chưa tìm được nghiên cứu hay khuyến cáo về ngưỡng mặn riêng cho cá basa (Pangasius bocourti). Tự đặt ngưỡng ở mục Trạm theo dõi.'),
    ('ca_loc', 'ca_vu', 'Cả vụ', 5,
     'Nguyễn Trọng Hồng Phúc, Nguyễn Mai Diễn An (2019), "Tăng trưởng, sinh hóa và huyết học của cá lóc (Channa striata) phân bố ở hạ nguồn sông Cửu Long dưới ảnh hưởng của sự xâm mặn", Tạp chí Khoa học ĐH Cần Thơ 55(1): cá lóc nuôi tốt khi độ mặn không vượt mức lợ nhẹ (5,0 ± 1,4‰). https://ctujsvn.ctu.edu.vn/index.php/ctujsvn/article/view/3116',
     'Cá bột và cá giống lớn tốt hơn ở dưới 3‰ (Nguyễn Tính Em và cs., ĐH Cần Thơ 2021).'),
    ('ca_ro_dong', 'ca_vu', 'Cả vụ', 3,
     'Đỗ Thị Thanh Hương, Trần Việt Toàn, Nguyễn Thị Kim Hà (2013), "Ảnh hưởng của độ mặn khác nhau lên sự điều hòa áp suất thẩm thấu và tăng trưởng của cá rô đồng", Tạp chí Khoa học ĐH Cần Thơ 26: cá lớn tốt nhất ở 0 và 3‰. https://ctujsvn.ctu.edu.vn/index.php/ctujsvn/article/view/95',
     'Cá chịu được tới khoảng 30‰ nhưng chậm lớn; ngưỡng này là mức còn lớn tốt.'),
    ('ca_that_lat', 'ca_vu', 'Cả vụ', NULL, NULL,
     'Chưa có nguồn: chưa tìm được số liệu ngưỡng mặn cho cá thát lát còm (Chitala ornata). Số 11–12‰ hay được nhắc là của cá thát lát cườm, loài khác. Tự đặt ngưỡng ở mục Trạm theo dõi.')
) AS s(crop_code, code, name, max_salinity, threshold_source, threshold_note)
JOIN crops c ON c.code = s.crop_code;
