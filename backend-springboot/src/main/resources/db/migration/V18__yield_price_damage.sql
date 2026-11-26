-- ============================================================
-- AquaMekong — V18: năng suất và giá bán để ước thiệt hại ra tiền
-- ============================================================
-- Thiệt hại = diện tích × % năng suất có thể giảm (V17) × năng suất bình thường × giá bán. Là số ước tính.
-- Mặc định theo cây, có nguồn và ngày lấy số (giá đổi theo tuần, cần cập nhật bằng migration mới);
-- cây chưa tìm được nguồn đáng tin thì để trống, người dùng tự nhập ở hồ sơ ruộng.

ALTER TABLE crops
    -- Năng suất bình thường (tấn/ha mỗi vụ; cây lâu năm: mỗi năm)
    ADD COLUMN default_yield_t_ha    DOUBLE PRECISION CHECK (default_yield_t_ha > 0),
    -- Giá bán tại ruộng/vườn (đồng/kg)
    ADD COLUMN default_price_vnd_kg  DOUBLE PRECISION CHECK (default_price_vnd_kg > 0),
    ADD COLUMN yield_source          TEXT,
    ADD COLUMN price_source          TEXT,
    -- Ngày lấy giá
    ADD COLUMN price_as_of           DATE,
    ADD CONSTRAINT crops_yield_has_source CHECK ((default_yield_t_ha IS NULL) = (yield_source IS NULL)),
    ADD CONSTRAINT crops_price_has_source CHECK ((default_price_vnd_kg IS NULL) = (price_source IS NULL)
                                               AND (default_price_vnd_kg IS NULL) = (price_as_of IS NULL));

-- Số người dùng nhập cho ruộng của mình; NULL = dùng mặc định của cây
ALTER TABLE field_profiles
    ADD COLUMN yield_t_ha   DOUBLE PRECISION CHECK (yield_t_ha > 0 AND yield_t_ha <= 500),
    ADD COLUMN price_vnd_kg DOUBLE PRECISION CHECK (price_vnd_kg > 0 AND price_vnd_kg <= 10000000);

-- Lúa (tra 26/11/2026). Mía, bưởi, cam, quýt, rau màu: chưa có số của ĐBSCL mới và đáng tin, để trống
-- (giá mía tìm được là của Tuyên Quang, Phú Yên; năng suất mía của Tây Ninh; giá bưởi mới nhất là 05/2025).
UPDATE crops SET
    default_yield_t_ha = 7.4,
    yield_source = 'Cục Thống kê (Bộ Tài chính), ước tính đến 20/05/2026: lúa đông xuân 2026 vùng ĐBSCL đạt 74,0 tạ/ha, qua trích dẫn của báo Nhân Dân. https://nhandan.vn/san-xuat-nong-lam-nghiep-va-thuy-san-thang-5-va-5-thang-dau-2026-van-duy-tri-on-dinh-post966666.html',
    default_price_vnd_kg = 7500,
    price_source = 'Giá lúa tươi OM 5451 tại ĐBSCL 7.500–7.600 đồng/kg (bảng giá Sở Nông nghiệp và Môi trường An Giang, qua trích dẫn của Báo Văn hoá 26/11/2026); app lấy mức thấp. https://baovanhoa.vn/gia-lua-gao-hom-nay-26-11-giao-dich-cham-trien-vong-phu-thuoc-suc-mua.html',
    price_as_of = DATE '2026-11-26'
WHERE code = 'lua';
