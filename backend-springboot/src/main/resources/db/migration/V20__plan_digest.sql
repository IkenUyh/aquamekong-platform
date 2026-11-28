-- Dấu vân tay kế hoạch nước của ruộng (StationWatchJob): chỉ báo đẩy khi việc quan trọng đổi (loại việc, ngày bắt đầu,
-- tỷ lệ pha đã làm tròn), không báo vì cửa sổ 7 ngày trượt. NULL = chưa có: lượt sau chỉ lưu, không báo.
ALTER TABLE station_watches ADD COLUMN plan_digest TEXT;
