# Nhật ký thay đổi

Các thay đổi đáng chú ý của AquaMekong, mới nhất ở trên. Phiên bản theo [Semantic Versioning](https://semver.org/lang/vi/).

## [0.3.0] - 2026-10-10

### Thêm mới
- **Trạm theo dõi theo loại cây**: người dùng đã đăng nhập chọn trạm gần nơi canh tác và ngưỡng mặn riêng (gợi ý: sầu riêng 0,5‰, cây ăn trái 1‰, lúa và rau màu 2‰). Khi số đo mới nhất hoặc dự báo 7 ngày tới bắt đầu vượt ngưỡng, app báo kèm ngày vượt đầu tiên để kịp trữ nước; khi độ mặn giảm xuống dưới ngưỡng, app báo có thể lấy nước. Chỉ báo khi tình hình thay đổi, không lặp mỗi ngày.
- **Cảnh báo theo trạm**: tài khoản đã theo dõi trạm chỉ nhận cảnh báo của các trạm đó. Tài khoản chưa theo dõi trạm nào vẫn nhận mọi trạm; Quản trị và Vận hành luôn nhận tất cả.
- **Trạm gần tôi**: trang Tổng quan tìm 3 trạm gần người dùng nhất, kèm khoảng cách và độ mặn mới nhất. Vị trí chỉ dùng trên máy, không gửi lên máy chủ. Form Trạm theo dõi có nút chọn trạm gần nhất.
- **Độ chính xác dự báo**: trang Dự báo cho biết dự báo trước 1, 3, 7 ngày thường sai bao nhiêu và đoán đúng mức mặn bao nhiêu phần trăm, tính bằng cách chạy lại mô hình trên 180 ngày đã qua (chỉ dùng số đo có tới từng ngày). Mỗi trạm có biểu đồ dự báo đặt cạnh số đo thật, và bảng các dự báo đã lưu so với số đo về sau.
- **Báo khi dữ liệu ngừng về**: sau 12:00 mà chưa có số đo của hôm qua, trang Tổng quan hiện cảnh báo và Quản trị/Vận hành nhận thông báo.
- Nút **Xem toàn vùng** trên bản đồ (trang Bản đồ và Tổng quan) để thoát khỏi trạm đang chọn.

### Thay đổi
- Dự báo dự phòng (khi trạm không có mô hình riêng) giữ nguyên số đo mới nhất, thay cho kéo dài xu hướng gần đây: chạy lại trên 360 ngày đã qua, cách cũ sai nhiều hơn ở mọi số ngày dự báo trước (dự báo trước 1 ngày: 0,69‰ so với 0,51‰).
- Dự báo, báo cho trạm theo dõi và lấy dữ liệu chạy khi có số liệu mới thay vì giờ cố định: lịch GitHub Actions có hôm trễ vài giờ, máy chủ có thể bật muộn. Lấy dữ liệu RYNAN lúc 05:41 và chạy lại lúc 10:41; ml-service kiểm tra Google Drive mỗi 20 phút; dự báo chạy lại trong vòng 30 phút sau khi có số đo mới.
- Lấy dữ liệu RYNAN báo lỗi Google Drive rõ ràng (vd. Client ID/secret sai) và kiểm tra quyền Drive trước khi lấy dữ liệu.

### Sửa lỗi
- Dự báo chạy lại sau khi số liệu về trễ vẫn trả kết quả tính trên số đo cũ.
- Biểu đồ dự báo của từng trạm cao hơn khung chứa, che các nút bên dưới.

### Hạn chế đã biết
- Dự báo dự phòng là đường thẳng (giữ nguyên số mới nhất), nên chưa báo trước được đợt mặn tăng ở các trạm không có mô hình riêng. Mô hình mới phải vượt được mức này mới được dùng.
- ST-GNN vẫn chưa dùng được với dữ liệu RYNAN hằng ngày (thiếu mưa, lưu lượng, thuỷ triều).
- App Android cần build lại để có các tính năng mới; thông báo trên app cần cấu hình Firebase.

## [0.2.1] - 2026-10-09

### Sửa lỗi
- Nạp dữ liệu RYNAN hằng ngày không còn tự thêm hơn 90 trạm ngoài 40 trạm hệ thống theo dõi.
- Trang Dự báo không còn hiện dự báo ST-GNN cho các ngày đã qua (01/09, 07/09): khi dữ liệu của ST-GNN cũ hơn 7 ngày, hệ thống dùng mô hình khác, dự báo từ ngày mai.
- Trạm thiếu số đo không còn nhận dự báo "mô phỏng" (số bịa quanh 3‰).
- Dự báo xu hướng thống kê tính theo giờ Việt Nam, bám số đo 14 ngày gần nhất và không kéo độ mặn về 0 sau vài ngày.
- Trạm không còn bị báo "mất tín hiệu" trước mỗi lần lấy dữ liệu sáng (ngưỡng 72 giờ cho số liệu theo ngày).
- Độ mặn trung bình trên Tổng quan và bản đồ tính theo 7 ngày thay vì 24 giờ (thường trống); biểu đồ lịch sử mặc định 30 ngày.
- Số đo theo ngày hiện theo ngày ("ngày 07-10") thay vì "00:00"; bản đồ so sánh với lần đo trước thay vì 24 giờ trước.
- Ẩn lưu lượng (dữ liệu RYNAN không đo), sông "Chưa phân loại" và thẻ điểm ST-GNN khi không có dữ liệu tương ứng.

## [0.2.0] - 2026-10-09

### Thêm mới
- **Dữ liệu RYNAN tự động mỗi ngày**: GitHub Actions lúc 06:00 lấy độ mặn và mực nước cao nhất theo ngày của các trạm từ app MEKONG RYNAN, lưu CSV lên Google Drive; ml-service kiểm tra thư mục Drive mỗi giờ và tự nạp file mới. Có thể lấy bù nhiều ngày (`--from`/`--to`). Cần cài đặt một lần, xem README.
- **Dự báo ST-GNN** của nhóm trên trang Dự báo, kèm sai số trên tập kiểm tra so với cách giữ nguyên giá trị cũ.
- **Dự báo tự chạy mỗi sáng** (07:30) cho mọi trạm, nên người chưa đăng nhập cũng xem được dự báo trong ngày.
- **Thanh tab dưới cùng trên điện thoại** (app và web): Tổng quan, Bản đồ, Dự báo, Cảnh báo (kèm số cảnh báo đang mở) và mục Thêm.
- Trạm tự được gán tỉnh/thành theo toạ độ (6 tỉnh ĐBSCL sau sáp nhập), bộ lọc tỉnh dùng được.

### Thay đổi
- Bản đồ dùng ranh giới tỉnh và sông, kênh thật; tô màu trạm theo một chỉ số thay cho lớp nhiệt.
- Khuyến nghị vận hành liệt kê trạm mặn nhất trước.
- Nhãn trạm đè nhau trên bản đồ: mức mặn cao hơn nằm trên.

### Sửa lỗi
- Bản đồ trang Dự báo trống (khung cao hơn 5000px) và thanh chọn ngày bị bóp dẹt.
- Vệt trắng giữa các ô bản đồ.
- Tỷ lệ trên trang Báo cáo cộng ra 101%.
- Trang Trạm và Cảnh báo báo "không có dữ liệu" khi thực ra không kết nối được máy chủ.
- Nhãn ô số liệu bị cắt trên điện thoại.

### Hạn chế đã biết
- ST-GNN chỉ dùng cho các trạm trong dữ liệu huấn luyện mà nó dự báo tốt hơn cách giữ nguyên giá trị cũ (hiện 12/17), và chỉ có mốc +1 và +7 ngày; các trạm khác dùng mô hình khác. Dữ liệu RYNAN hằng ngày chưa có lượng mưa, lưu lượng, thuỷ triều nên chưa cập nhật đầu vào của ST-GNN.
- Cảnh báo và khuyến nghị vẫn dựa trên số đo mới nhất, chưa dựa trên dự báo.

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

[0.3.0]: https://github.com/IkenUyh/aquamekong-platform/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/IkenUyh/aquamekong-platform/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/IkenUyh/aquamekong-platform/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/IkenUyh/aquamekong-platform/releases/tag/v0.1.0
