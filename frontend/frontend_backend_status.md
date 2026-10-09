# Trạng thái Tích hợp Frontend & Backend

Tài liệu này liệt kê các tính năng trên Frontend, endpoint Backend tương ứng và quyền cần có.

## Tóm tắt chung
- **Người chưa đăng nhập xem được** các trang dữ liệu (Tổng quan, Bản đồ, Trạm, Dự báo, Cảnh báo, Báo cáo) ở chế độ chỉ đọc, khi backend bật `PUBLIC_READ_ENABLED` (mặc định bật). `/account` và `/admin` luôn cần đăng nhập. Tắt `PUBLIC_READ_ENABLED` thì mọi trang lại yêu cầu đăng nhập như trước.
- Frontend gửi `Authorization: Bearer <token>`. Token hết hạn hoặc sai thì backend trả 401 (kể cả ở API công khai) và frontend đăng xuất.
- Frontend gọi API **cùng origin** qua proxy `/api` (nginx trong Docker, Vite khi chạy dev). Chỉ đặt `VITE_API_BASE_URL` khi API nằm ở domain khác.
- **Mock data chỉ dùng khi dev** (`npm run dev`) hoặc khi đặt `VITE_ENABLE_MOCK_FALLBACK=true`. Ở chế độ đó, nếu API lỗi thì Navbar hiện "Offline Mode". Bản build production không bao giờ dùng mock, và lỗi 401/403 không bao giờ được thay bằng mock.
- Swagger (danh sách endpoint đầy đủ): `http://localhost:8080/swagger-ui.html`

**Quyền:** 🌐 = công khai (không cần đăng nhập, nếu bật `PUBLIC_READ_ENABLED`) · 👤 = mọi user đã đăng nhập (`ROLE_USER` trở lên) · 🛠️ = `ROLE_OPERATOR`/`ROLE_ADMIN` · 🔑 = chỉ `ROLE_ADMIN`

## Chi tiết các tính năng và API

### 1. Đăng nhập, Đăng ký & Tài khoản
- **Trang:** `/login`, `/register`, `/auth/zalo/callback`, `/account` (đổi/đặt mật khẩu, liên kết Zalo/Google). Nút Đăng nhập / Đăng xuất nằm trên Navbar.
- **Trạng thái:** 🟢 Đã liên kết (`api/authApi.ts`, `contexts/AuthContext.tsx`, `components/SocialLogin.tsx`, `auth/zaloOAuth.ts`)
- **Endpoints:**
  - `GET /api/v1/auth/config` (công khai): `publicRead`, `registrationEnabled`, `googleClientId`, `zaloAppId`, `passkeyEnabled`. Frontend dựa vào đây để ẩn/hiện nút Đăng ký, Google, Zalo, passkey.
  - `POST /api/v1/auth/login` (công khai). Sai 5 lần liên tiếp sẽ bị khoá 5 phút (429).
  - `POST /api/v1/auth/register` (công khai, tắt bằng `REGISTRATION_ENABLED=false`): luôn tạo `ROLE_USER`.
  - `POST /api/v1/auth/google` `{idToken}` (công khai): frontend lấy ID token bằng Google Identity Services, backend kiểm tra chữ ký, `aud` = `GOOGLE_CLIENT_ID`. Lần đầu sẽ tạo tài khoản mới (chưa có mật khẩu). Nếu email đã có tài khoản thì trả 409: đăng nhập bằng mật khẩu rồi liên kết Google ở `/account` (không tự gộp theo email để tránh chiếm tài khoản).
  - `POST /api/v1/auth/zalo` `{code, codeVerifier}` (công khai): frontend chuyển sang Zalo (OAuth v4 + PKCE, kiểm tra `state`), Zalo trả `code` về `/auth/zalo/callback`, backend đổi code bằng `ZALO_APP_SECRET` rồi lấy id + tên. Zalo **không trả email**: tài khoản tạo bằng Zalo không có email, tên đăng nhập sinh từ tên Zalo bỏ dấu.
  - `GET /api/v1/auth/me` 👤, `POST /api/v1/auth/logout` 👤, `POST /api/v1/auth/change-password` 👤 (tài khoản tạo bằng Google đặt mật khẩu lần đầu không cần mật khẩu cũ)
  - `GET /api/v1/auth/identities` 👤, `POST /api/v1/auth/identities/google` 👤, `POST /api/v1/auth/identities/zalo` 👤, `DELETE /api/v1/auth/identities/{provider}` 👤 (không cho huỷ liên kết cuối cùng khi chưa có mật khẩu)
  - **Passkey** (`auth/passkey.ts`, `PasskeyService`, thư viện Yubico): `POST /api/v1/auth/passkeys/login/start` + `/login/finish` (công khai, không cần nhập tên: trình duyệt cho chọn passkey đã lưu), `GET /api/v1/auth/passkeys`, `POST /register/start` + `/register/finish`, `DELETE /api/v1/auth/passkeys/{id}` 👤. Bắt buộc xác minh người dùng (vân tay/Face ID/PIN). Mọi tài khoản đều thêm được; trang Tài khoản khuyên dùng cho cán bộ. Cấu hình `WEBAUTHN_RP_ID` (tên miền) + `WEBAUTHN_ORIGINS`.
  - Không gỡ được cách đăng nhập cuối cùng (mật khẩu, Google/Zalo, passkey đều tính).
  - Quản lý người dùng `/api/v1/users/**` 🔑 (giao diện: `/admin`, tab Người dùng)

### 2. Trạm quan trắc (Stations)
- **Trang:** `/` (Tổng quan), `/map`, `/stations`
- **Trạng thái:** 🟢 Đã liên kết
- **Endpoints:**
  - `GET /api/v1/stations` (GeoJSON), `GET /api/v1/stations/list`, `GET /api/v1/stations/{id}`, `GET /api/v1/stations/nearby` 🌐
  - `POST/PUT /api/v1/stations` 🛠️, `DELETE` 🔑 (giao diện: `/admin`)
- Mỗi trạm có `latestSalinity`, `latestWaterLevel`, `latestFlowRate`: là giá trị mới nhất **theo từng chỉ số**.

### 3. Số liệu đo (Measurements) & Realtime
- **Trang:** `/map` (bảng lịch sử, heatmap)
- **Trạng thái:** 🟢 Đã liên kết
- **Endpoints:**
  - `GET /api/v1/measurements/latest`, `GET /api/v1/measurements/station/{id}?metricType=&limit=` (tối đa 5000), `GET /api/v1/measurements/station/{id}/range?from=&to=&metricType=` 🌐
  - Mỗi cảm biến chỉ có 1 số đo tại 1 thời điểm. Gửi trùng sẽ nhận 409.
  - `GET /api/v1/telemetry/stream` (SSE) 🌐. Token gửi qua `?access_token=` vì trình duyệt không gửi header được với EventSource. Server phát event `init`, `telemetry` và heartbeat mỗi 25 giây.
  - `POST /api/v1/measurements/ingest` 🛠️ hoặc thiết bị IoT gửi header `X-API-Key` (`INGEST_API_KEY`)

### 4. Dự báo độ mặn (Forecast)
- **Trang:** `/forecast`, mỗi trạm được chọn có một biểu đồ dự báo thật.
- **Trạng thái:** 🟢 Đã liên kết. Nếu trạm chưa có dự báo, frontend tự gọi `predict`.
- **Endpoints:**
  - `GET /api/v1/forecasts/station/{id}` 🌐: kết quả của **lượt chạy mới nhất**
  - `POST /api/v1/forecasts/predict` `{stationId, daysAhead (1-30)}` 👤: backend gọi ML service rồi lưu kết quả thành `forecast_run`. Người chưa đăng nhập chỉ xem lượt dự báo đã lưu, không tự chạy mô hình.
  - `GET /api/v1/forecasts/runs?limit=` 🌐

### 4b. Độ chính xác dự báo
- **Trang:** `/forecast`, thẻ "Độ chính xác dự báo" và nút "So với thực tế" trên mỗi trạm (`components/ForecastAccuracy.tsx`, `api/accuracyApi.ts`)
- **Trạng thái:** 🟢 Đã liên kết
- **Endpoints:** `GET /api/v1/forecasts/accuracy?days=` 🌐 (backtest: chạy lại mô hình cho từng ngày đã qua, chỉ dùng số đo có tới hôm đó, so với số đo thật và với cách giữ nguyên số mới nhất), `GET /api/v1/forecasts/station/{id}/verification?days=` 🌐 (dự báo đã lưu đặt cạnh số đo thật)

### 5. Cảnh báo (Alerts)
- **Trang:** `/alerts`, panel cảnh báo trên bản đồ
- **Trạng thái:** 🟢 Đã liên kết. `api/alertApi.ts` (`toAlertDto`) map dữ liệu backend sang dạng UI hiển thị.
- **Endpoints:**
  - `GET /api/v1/alerts?limit=` (tối đa 1000), `GET /api/v1/alerts/status/ACTIVE`, `GET /api/v1/alerts/station/{id}` 🌐
  - `PUT /api/v1/alerts/{id}/status?status=` 🛠️ (các nút Xác nhận / Đã xử lý / Mở lại trên trang Cảnh báo)
  - `GET/POST/DELETE /api/v1/alerts/rules...` (GET 👤, ghi 🛠️; giao diện: `/admin`)
- Backend tự sinh cảnh báo cho mọi số liệu mới, kể cả dữ liệu do ML pipeline crawl về. Mỗi rule chỉ có tối đa 1 cảnh báo chưa xử lý (ACTIVE hoặc ACKNOWLEDGED) tại một thời điểm.

### 5b. Trạm theo dõi (Watches)
- **Trang:** `/account`, mục "Trạm theo dõi" (`components/StationWatchSettings.tsx`, `api/watchApi.ts`)
- **Trạng thái:** 🟢 Đã liên kết
- **Endpoints:** `GET /api/v1/watches` 👤 (kèm số đo mới nhất và dự báo so với ngưỡng), `POST /api/v1/watches` `{stationId, threshold, crop}` 👤 (theo dõi, hoặc đổi ngưỡng nếu đã theo dõi; tối đa 20 trạm), `DELETE /api/v1/watches/{id}` 👤
- Ngưỡng gợi ý theo loại cây (`utils/crops.ts`): sầu riêng 0,5‰, cây ăn trái 1‰, lúa 2‰, rau màu 2‰; người dùng sửa được.
- 08:00 mỗi sáng (`WATCH_CHECK_CRON`), sau khi chạy dự báo, backend báo khi trạm đổi trạng thái: số đo mới nhất hoặc dự báo 7 ngày bắt đầu vượt ngưỡng, hoặc đã xuống dưới ngưỡng. Không báo lặp mỗi ngày.
- Tài khoản đã theo dõi ít nhất một trạm thì chỉ nhận cảnh báo đo được (mục 5) của các trạm đó; chưa theo dõi trạm nào thì nhận mọi trạm. Quản trị/Vận hành luôn nhận mọi trạm.

### 6. Khuyến nghị (Recommendations)
- **Trang:** `/` (Tổng quan), panel trên bản đồ
- **Trạng thái:** 🟢 Đã liên kết
- **Endpoint:** `GET /api/v1/recommendations` 🌐

### 7. Báo cáo & Thống kê (Reports)
- **Trang:** `/reports` (chọn kỳ 7/30/90 ngày), thẻ "Thông số tổng hợp (24 giờ qua)" trên bản đồ
- **Trạng thái:** 🟢 Đã liên kết. Mỗi số liệu so sánh kỳ hiện tại với kỳ liền trước có cùng độ dài.
- **Endpoints** (`days` từ 1 đến 90) 🌐:
  - `GET /api/v1/reports/overview?days=`: độ mặn, mực nước, lưu lượng trung bình; số trạm vượt 4‰; phân bố trạm theo mức độ mặn
  - `GET /api/v1/reports/trend?days=`: độ mặn trung bình toàn vùng theo từng ngày
  - `GET /api/v1/reports/top-stations?days=&limit=`: các trạm có độ mặn trung bình cao nhất
  - `GET /api/v1/reports/data-freshness`: dữ liệu có về đúng hạn không (sau 09:00 phải có số đo của hôm qua). Trang Tổng quan hiện dải cảnh báo khi `stale`; lúc 09:00 backend báo cho Quản trị/Vận hành.
- Hệ thống chưa có cảm biến đo **lượng mưa**, nên không có số liệu lượng mưa.

---

### 8. Quản trị
- **Trang:** `/admin` (🛠️). Tab "Người dùng" chỉ hiện với 🔑.
- **Trạng thái:** 🟢 Đã liên kết
- **Rule cảnh báo:** `GET/POST/DELETE /api/v1/alerts/rules` (POST có `id` là sửa). Backend validate trạm, chỉ số, toán tử và ngưỡng. Hệ thống **chỉ sinh cảnh báo khi có rule đang bật**.
- **Trạm:** `POST/PUT /api/v1/stations` 🛠️; `DELETE` 🔑, thao tác này xoá dây chuyền số đo và cảnh báo của trạm. Muốn tạm dừng trạm thì dùng trạng thái "Ngừng hoạt động".
- **Người dùng:** `GET/POST /api/v1/users`, `PUT /users/{id}/status`, `POST/DELETE /users/{id}/roles` 🔑. ADMIN không thể tự khoá hoặc tự gỡ quyền của mình, và hệ thống không cho gỡ ADMIN cuối cùng.

---

## Còn thiếu
- Màn hình quản lý thiết bị và cảm biến (`/api/v1/devices`, `/api/v1/sensors`). `deviceApi`/`sensorApi` đã có sẵn trong `api/client.ts`.
- User bị khoá vẫn dùng được token đã cấp cho tới khi token hết hạn (`JWT_EXPIRATION`, mặc định 8 giờ). (Đăng nhập Google mới thì bị chặn ngay.)
- Challenge passkey lưu trong bộ nhớ backend (5 phút): chạy nhiều instance backend thì cần chuyển sang Redis.
- Chưa bắt buộc passkey cho OPERATOR/ADMIN (hiện chỉ khuyến khích).
- Lấy số điện thoại Zalo (cần xin quyền riêng từ Zalo) để gửi cảnh báo qua Zalo OA.
- Đăng ký chưa xác minh email và chưa giới hạn số lượt theo IP (backend chưa đọc `X-Forwarded-For` sau nginx).
