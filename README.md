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
| **🗄️ PostgreSQL Database** | `localhost:5433` (hoặc `5432`) | DB: `aquamekong`, User: `aquamekong`, Pass: `aquamekong_secret` |

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
2. **Chạy Spring Boot Backend (Terminal 1):**
   ```bash
   cd backend-springboot
   ./mvnw spring-boot:run
   ```
3. **Chạy Python ML Service (Terminal 2):**
   ```bash
   cd ml-service
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   uvicorn app.main:app --reload --port 8000
   ```
4. **Chạy React Frontend (Terminal 3):**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   *(Truy cập Dev Server tại `http://localhost:5173`)*
