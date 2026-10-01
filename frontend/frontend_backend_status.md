# Trạng thái Tích hợp Frontend & Backend

Tài liệu này liệt kê các tính năng trên Frontend, endpoint Backend tương ứng và quyền cần có.

## Tóm tắt chung
- Mọi trang (trừ `/login`) đều **yêu cầu đăng nhập**. Frontend gửi `Authorization: Bearer <token>`. Khi API trả 401, người dùng được đưa về trang đăng nhập.
- Frontend gọi API **cùng origin** qua proxy `/api` (nginx trong Docker, Vite khi chạy dev). Chỉ đặt `VITE_API_BASE_URL` khi API nằm ở domain khác.
- **Mock data chỉ dùng khi dev** (`npm run dev`) hoặc khi đặt `VITE_ENABLE_MOCK_FALLBACK=true`. Ở chế độ đó, nếu API lỗi thì Navbar hiện "Offline Mode". Bản build production không bao giờ dùng mock, và lỗi 401/403 không bao giờ được thay bằng mock.
- Swagger (danh sách endpoint đầy đủ): `http://localhost:8080/swagger-ui.html`

**Quyền:** 👤 = mọi user đã đăng nhập (`ROLE_USER` trở lên) · 🛠️ = `ROLE_OPERATOR`/`ROLE_ADMIN` · 🔑 = chỉ `ROLE_ADMIN`

## Chi tiết các tính năng và API

### 1. Đăng nhập & Tài khoản
- **Trang:** `/login`, `/account` (đổi mật khẩu). Nút Đăng xuất nằm trên Navbar.
- **Trạng thái:** 🟢 Đã liên kết (`api/authApi.ts`, `contexts/AuthContext.tsx`)
- **Endpoints:**
  - `POST /api/v1/auth/login` (công khai). Sai 5 lần liên tiếp sẽ bị khoá 5 phút (429).
  - `GET /api/v1/auth/me` 👤, `POST /api/v1/auth/logout` 👤, `POST /api/v1/auth/change-password` 👤
  - Quản lý người dùng `/api/v1/users/**` 🔑. Hiện **chưa có giao diện**, chỉ gọi được qua Swagger/API.

### 2. Trạm quan trắc (Stations)
- **Trang:** `/` (Tổng quan), `/map`, `/stations`
- **Trạng thái:** 🟢 Đã liên kết
- **Endpoints:**
  - `GET /api/v1/stations` (GeoJSON), `GET /api/v1/stations/list`, `GET /api/v1/stations/{id}`, `GET /api/v1/stations/nearby` 👤
  - `POST/PUT/DELETE /api/v1/stations...` 🛠️. Hiện chưa có giao diện thêm/sửa trạm.
- Mỗi trạm có `latestSalinity`, `latestWaterLevel`, `latestFlowRate`: là giá trị mới nhất **theo từng chỉ số**.

### 3. Số liệu đo (Measurements) & Realtime
- **Trang:** `/map` (bảng lịch sử, heatmap)
- **Trạng thái:** 🟢 Đã liên kết
- **Endpoints:**
  - `GET /api/v1/measurements/latest`, `GET /api/v1/measurements/station/{id}?limit=` (tối đa 5000), `GET /api/v1/measurements/station/{id}/range?from=&to=` 👤
  - `GET /api/v1/telemetry/stream` (SSE) 👤. Token gửi qua `?access_token=` vì trình duyệt không gửi header được với EventSource. Server phát event `init`, `telemetry` và heartbeat mỗi 25 giây.
  - `POST /api/v1/measurements/ingest` 🛠️ hoặc thiết bị IoT gửi header `X-API-Key` (`INGEST_API_KEY`)

### 4. Dự báo độ mặn (Forecast)
- **Trang:** `/forecast`, mỗi trạm được chọn có một biểu đồ dự báo thật.
- **Trạng thái:** 🟢 Đã liên kết. Nếu trạm chưa có dự báo, frontend tự gọi `predict`.
- **Endpoints:**
  - `GET /api/v1/forecasts/station/{id}` 👤: kết quả của **lượt chạy mới nhất**
  - `POST /api/v1/forecasts/predict` `{stationId, daysAhead (1-30)}` 👤: backend gọi ML service rồi lưu kết quả thành `forecast_run`
  - `GET /api/v1/forecasts/runs?limit=` 👤

### 5. Cảnh báo (Alerts)
- **Trang:** `/alerts`, panel cảnh báo trên bản đồ
- **Trạng thái:** 🟢 Đã liên kết. `api/alertApi.ts` (`toAlertDto`) map dữ liệu backend sang dạng UI hiển thị.
- **Endpoints:**
  - `GET /api/v1/alerts?limit=` (tối đa 1000), `GET /api/v1/alerts/status/ACTIVE`, `GET /api/v1/alerts/station/{id}` 👤
  - `PUT /api/v1/alerts/{id}/status?status=` 🛠️, `GET/POST/DELETE /api/v1/alerts/rules...` (GET 👤, ghi 🛠️). Hiện chưa có giao diện quản lý rule.
- Backend tự sinh cảnh báo cho mọi số liệu mới, kể cả dữ liệu do ML pipeline crawl về. Mỗi rule chỉ có tối đa 1 cảnh báo ACTIVE tại một thời điểm.

### 6. Khuyến nghị (Recommendations)
- **Trang:** `/` (Tổng quan), panel trên bản đồ
- **Trạng thái:** 🟢 Đã liên kết
- **Endpoint:** `GET /api/v1/recommendations` 👤

### 7. Báo cáo & Thống kê (Reports)
- **Trang:** `/reports` (chọn kỳ 7/30/90 ngày), thẻ "Thông số tổng hợp (24 giờ qua)" trên bản đồ
- **Trạng thái:** 🟢 Đã liên kết. Mỗi số liệu so sánh kỳ hiện tại với kỳ liền trước có cùng độ dài.
- **Endpoints** (`days` từ 1 đến 90) 👤:
  - `GET /api/v1/reports/overview?days=`: độ mặn, mực nước, lưu lượng trung bình; số trạm vượt 4‰; phân bố trạm theo mức độ mặn
  - `GET /api/v1/reports/trend?days=`: độ mặn trung bình toàn vùng theo từng ngày
  - `GET /api/v1/reports/top-stations?days=&limit=`: các trạm có độ mặn trung bình cao nhất
- Hệ thống chưa có cảm biến đo **lượng mưa**, nên không có số liệu lượng mưa.

---

## Còn thiếu (chưa có giao diện, backend đã có API)
- Quản lý người dùng và phân quyền (`/api/v1/users`)
- Thêm/sửa/xoá trạm, thiết bị, cảm biến
- Quản lý rule cảnh báo và chuyển trạng thái cảnh báo (ACKNOWLEDGED/RESOLVED)
