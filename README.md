# 🌊 AquaMekong Platform

**AquaMekong Platform** là hệ thống giám sát, phân tích và dự báo xâm nhập mặn vùng Đồng bằng Sông Cửu Long (ĐBSCL). Hệ thống kết hợp cơ sở dữ liệu địa lý PostGIS, Spring Boot Backend REST API, mô hình AI/ML Python (Prophet/LSTM), và giao diện React Web Dashboard trực quan.

---

## 🏗️ Kiến trúc Công nghệ (Monorepo)

* **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS v3 + Leaflet Maps + Recharts
* **Backend**: Spring Boot 3.3 (Java 21) + Spring Data JPA + Flyway Migrations + Swagger OpenAPI 3.0
* **ML Service**: Python 3.12 + FastAPI + Prophet / PyTorch + APScheduler
* **Database & Cache**: PostgreSQL 16 + PostGIS 3.4 + Redis 7 (Alpine)
* **DevOps**: Docker & Docker Compose

---

## 🚀 Hướng dẫn Khởi chạy Dự án (Quick Start)

Dành cho thành viên clone dự án về máy local:

### 1. Điều kiện tiên quyết (Prerequisites)
Yêu cầu máy máy đã cài đặt:
* **Git**
* **Docker** và **Docker Compose**

---

### 2. Các bước khởi chạy (2 câu lệnh)

#### **Bước 1: Clone Repository về máy**
```bash
git clone https://github.com/IkenUyh/aquamekong-platform.git
cd aquamekong-platform
```

#### **Bước 2: Chạy script tự động**
```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

> **Hoặc gõ thủ công:**
> ```bash
> cp .env.example .env
> docker compose up -d --build
> ```

---

## 📍 Các Địa chỉ Truy cập (Service URLs)

Sau khi Docker Compose khởi chạy thành công:

| Dịch vụ | Địa chỉ URL | Mô tả |
| :--- | :--- | :--- |
| **🌐 Frontend Web** | [http://localhost:3000](http://localhost:3000) | Giao diện chính (Tổng quan, Bản đồ, Dự báo, Cảnh báo, Báo cáo) |
| **⚙️ Backend API** | [http://localhost:8080](http://localhost:8080) | REST API Spring Boot |
| **📑 Swagger UI** | [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html) | Tài liệu & Đã test API Backend |
| **🤖 ML Service Docs** | [http://localhost:8000/docs](http://localhost:8000/docs) | Swagger UI Python FastAPI (Model AI) |
| **🗄️ PostgreSQL Database** | `localhost:5433` (đổi bằng `POSTGRES_HOST_PORT` trong `.env`) | DB: `aquamekong`, User: `aquamekong`, Pass: `aquamekong_secret` |

---

## 🛠️ Các Lệnh Quản lý Tiện ích

* **Xem log thời gian thực của toàn bộ hệ thống:**
  ```bash
  docker compose logs -f
  ```
* **Xem log riêng từng dịch vụ (Backend / Frontend / ML Service):**
  ```bash
  docker compose logs -f backend
  docker compose logs -f frontend
  docker compose logs -f ml-service
  ```
* **Dừng hệ thống:**
  ```bash
  docker compose down
  ```
* **Khởi động lại sạch dữ liệu (Clean Reset):**
  ```bash
  docker compose down -v
  ./scripts/setup.sh
  ```

---

## 💻 Hướng dẫn Chạy Dev Thủ công (Local Development)

Nếu muốn tự chạy và sửa code từng phần mà không qua Docker:

1. **Khởi chạy Database & Redis trước:**
   ```bash
   docker compose up -d postgres redis
   ```
2. **Chạy Spring Boot Backend (Terminal 1, cần JDK 21):**
   ```bash
   cd backend-springboot
   DB_PORT=5433 ./mvnw spring-boot:run
   ```
3. **Chạy Python ML Service (Terminal 2):**
   ```bash
   cd ml-service
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements-dev.txt
   DATABASE_URL=postgresql://aquamekong:aquamekong_secret@localhost:5433/aquamekong \
     uvicorn app.main:app --reload --port 8000
   ```
4. **Chạy React Frontend (Terminal 3):**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   *(Truy cập Dev Server tại `http://localhost:5173`)*

---

## 📱 App điện thoại (Android / iOS)

App điện thoại là chính frontend web được đóng gói bằng [Capacitor](https://capacitorjs.com) (`frontend/android/`). Web vẫn chạy như cũ, app và web dùng chung code và chung backend.

**Cần có:** Android Studio (kèm Android SDK) và **JDK 21** (Gradle chưa chạy được trên Java 25 của Android Studio: trong Android Studio chọn *Settings → Build Tools → Gradle → Gradle JDK* = JDK 21).

1. **Chỉ địa chỉ backend cho app** (app không có nginx proxy `/api` như web):
   ```bash
   cd frontend
   cp .env.mobile.example .env.mobile.local   # sửa VITE_API_BASE_URL
   ```
   * Server thật: `https://<tên-miền>` (khuyên dùng HTTPS).
   * Máy ảo Android: `http://10.0.2.2:8080`. Điện thoại thật cùng WiFi: `http://<IP máy chạy backend>:8080`. Với địa chỉ `http://` phải build kèm `CAPACITOR_ALLOW_HTTP=true`.
2. **Build và đồng bộ vào project Android:**
   ```bash
   npm run build:mobile                                # backend https://
   CAPACITOR_ALLOW_HTTP=true npm run build:mobile      # backend http:// (thử trong LAN)
   ```
3. **Chạy app:** `npx cap open android` rồi bấm Run trong Android Studio (máy ảo hoặc điện thoại cắm USB, bật USB debugging). Hoặc build file APK để cài:
   ```bash
   cd android && ./gradlew assembleDebug   # -> app/build/outputs/apk/debug/app-debug.apk
   ```

Backend phải cho phép origin của app trong `CORS_ORIGINS` (mặc định đã có `https://localhost`, `http://localhost`, `capacitor://localhost`). Trong app hiện chỉ đăng nhập bằng mật khẩu: Google, Zalo và passkey bị ẩn vì chưa chạy được trong WebView. iOS cần máy Mac (`npx cap add ios`).

---

## 🔔 Thông báo đẩy khi có cảnh báo

Khi có cảnh báo mới (số đo vượt ngưỡng của rule cảnh báo), mọi tài khoản đã bật thông báo đều nhận được trên thiết bị của mình, kể cả khi không mở trang/app. Người dùng bật ở trang **Tài khoản** (hoặc nút ở trang **Cảnh báo**), có nút **Gửi thử**. Đăng xuất thì thiết bị đó thôi nhận.

**Trình duyệt (Web Push)**: Chrome, Edge, Firefox trên máy tính và Android; Safari trên iPhone/iPad (iOS 16.4+) chỉ khi đã *Thêm vào MH chính*. Cần trang chạy HTTPS (riêng `localhost` được phép dùng http).
```bash
npx web-push generate-vapid-keys      # chép 2 khoá vào .env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
docker compose up -d backend
```
Giữ nguyên cặp khoá về sau: đổi khoá thì mọi thiết bị phải bật thông báo lại.

**App điện thoại (Firebase Cloud Messaging)**:
1. Tạo project ở [Firebase Console](https://console.firebase.google.com), thêm app Android với package `vn.aquamekong.app`, tải `google-services.json` về `frontend/android/app/`.
2. *Project settings → Service accounts → Generate new private key* → được file JSON (là khoá bí mật, không commit). Đưa vào `.env`:
   ```bash
   echo "FIREBASE_SERVICE_ACCOUNT_BASE64=$(base64 -w0 duong-dan/file-service-account.json)" >> .env
   docker compose up -d backend
   ```
3. Build lại app (`npm run build:mobile`, rồi Run trong Android Studio). Nút bật thông báo trong app chỉ hiện khi backend đã có khoá Firebase.

---

## 🧪 Chạy Test

```bash
cd backend-springboot && ./mvnw test        # JUnit + Mockito, không cần DB
cd ml-service && python -m pytest tests     # pytest
cd frontend && npm run lint && npm test     # eslint + vitest
```
