# Nhật ký thay đổi

Các thay đổi đáng chú ý của AquaMekong, mới nhất ở trên. Phiên bản theo [Semantic Versioning](https://semver.org/lang/vi/).

## [0.1.0] - 2026-10-06

Bản phát hành đầu tiên.

### Thêm mới
- **Giám sát độ mặn**: trang Tổng quan, bản đồ độ mặn (Leaflet, lớp nhiệt), danh sách trạm, số đo realtime qua SSE.
- **Dữ liệu thật**: 40 trạm RYNAN, khoảng 5 năm số đo theo ngày (độ mặn, mực nước, lưu lượng). Có công cụ nạp file (`python -m app.ingest`), thư mục `data/inbox/` tự nạp file hằng ngày, và `SEED_DATA_URL` để máy mới tự tải dữ liệu từ Google Drive.
- **Cảnh báo**: rule theo ngưỡng (mặc định độ mặn > 4‰), trang Cảnh báo, thông báo đẩy trên trình duyệt (Web Push) và app điện thoại (FCM).
- **Phát lại lịch sử**: xem lại từng mùa khô theo ngày, gồm bản đồ, chỉ số, nhật ký cảnh báo và biểu đồ số trạm vượt ngưỡng.
- **Dự báo** độ mặn theo trạm qua ML service (Prophet, Hybrid ARIMA-CNN, xu hướng thống kê).
- **Báo cáo** so sánh kỳ hiện tại với kỳ trước, và khuyến nghị vận hành theo quy tắc.
- **Tài khoản**: đăng nhập mật khẩu, Google, Zalo, passkey; tự đăng ký; xem dữ liệu không cần đăng nhập; trang Quản trị (trạm, rule cảnh báo, người dùng).
- **App Android** đóng gói bằng Capacitor từ cùng mã nguồn web.

### Hạn chế đã biết
- Mô hình ST-GNN đã huấn luyện nhưng chưa được dùng trong trang Dự báo.
- Cảnh báo và khuyến nghị dựa trên số đo mới nhất, chưa dựa trên dự báo.
- Dữ liệu RYNAN hiện có đến 31/08/2026; trạm hiện "mất tín hiệu" tới khi nạp dữ liệu mới.

[0.1.0]: https://github.com/IkenUyh/aquamekong-platform/releases/tag/v0.1.0
