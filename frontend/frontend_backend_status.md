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
- **Trạm gần tôi** (Tổng quan, và nút "Chọn trạm gần tôi nhất" ở Trạm theo dõi): tính trên máy từ `GET /api/v1/stations/list`, vị trí người dùng không gửi lên backend. `GET /api/v1/stations/nearby` vẫn có nhưng frontend không dùng.

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

### 4c. Cảnh báo sớm (mô hình rủi ro)
- **Trang:** `/forecast`: đường nét đứt "Có thể lên tới" trên biểu đồ từng trạm, dòng "nguy cơ vượt 4‰" trên thẻ trạm, nhận xét "nên trữ nước ngọt trước", thẻ "Cảnh báo sớm trên các mùa khô đã qua" (`EarlyWarningCard`). `/replay`: cảnh báo sớm trong nhật ký, thẻ "Trạm có cảnh báo sớm", mục "Cảnh báo sớm trong giai đoạn".
- **Trạng thái:** 🟢 Đã liên kết
- **Endpoints:** dự báo có thêm `riskSalinity` (mức có thể lên tới, chỉ mô hình rủi ro điền); `GET /api/v1/forecasts/early-warning` 🌐 (404 khi ML service chưa học xong lần đầu); `GET /api/v1/reports/replay` có thêm sự kiện `WARNED`, `warnedDaysAhead` cho sự kiện `OPENED`, `warningCount` theo ngày và `earlyWarning` (tổng hợp).

### 5. Cảnh báo (Alerts)
- **Trang:** `/alerts`, panel cảnh báo trên bản đồ
- **Trạng thái:** 🟢 Đã liên kết. `api/alertApi.ts` (`toAlertDto`) map dữ liệu backend sang dạng UI hiển thị.

// TODO: complete edge-case assertions and verification
