# AquaMekong Platform

<div align="center">

🌊 **Nền tảng Giám sát & Dự báo Thủy văn / Xâm nhập mặn ĐBSCL**

*Hydrology Monitoring & Salinity Intrusion Forecasting — Mekong Delta*

![Java](https://img.shields.io/badge/Java-21-orange?style=flat-square&logo=openjdk)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.3-green?style=flat-square&logo=springboot)
![React](https://img.shields.io/badge/React-18-blue?style=flat-square&logo=react)
![Python](https://img.shields.io/badge/Python-3.12-yellow?style=flat-square&logo=python)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+PostGIS-blue?style=flat-square&logo=postgresql)

</div>

---

## 📋 Tổng quan

AquaMekong là hệ thống giám sát thủy văn và dự báo xâm nhập mặn vùng Đồng bằng sông Cửu Long (ĐBSCL), bao gồm:

- 🗺️ **Bản đồ GIS** hiển thị trạm đo real-time trên nền Leaflet
- 📊 **Dashboard** theo dõi độ mặn, mực nước, lưu lượng
- 🤖 **AI/ML Forecasting** dự báo xâm nhập mặn bằng Facebook Prophet
- 📡 **Real-time SSE** cập nhật dữ liệu telemetry tức thì
- 🎨 **Dark-themed UI** với glassmorphism design

## 🏗️ Kiến trúc

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend API    │────▶│  ML Service   │
│  React+Vite  │     │  Spring Boot 3   │     │  FastAPI      │
│  :3000       │     │  :8080           │     │  :8000        │
└──────────────┘     └────────┬─────────┘     └──────┬───────┘
                              │                       │
                     ┌────────▼───────────────────────▼───────┐
                     │        PostgreSQL 16 + PostGIS         │
                     │              :5432                      │
                     └────────────────────────────────────────┘
```

## 🚀 Quick Start

### Chạy bằng Docker Compose (Khuyên dùng)

```bash
# 1. Clone project
git clone <repo-url>
cd aquamekong-platform

# 2. Setup & chạy (1 lệnh)
chmod +x scripts/setup.sh
./scripts/setup.sh
```

Hoặc chạy thủ công:

```bash
# Copy env
cp .env.example .env

# Start all services
docker compose up -d --build
```

### Truy cập

| Service | URL | Mô tả |
|---|---|---|
| 🌐 Frontend | http://localhost:3000 | Bản đồ & Dashboard |
| 🔌 Backend API | http://localhost:8080 | REST API |
| 📚 Swagger UI | http://localhost:8080/swagger-ui.html | API Documentation |
| 🤖 ML Service | http://localhost:8000/docs | ML API Documentation |
| 🐘 PostgreSQL | localhost:5432 | Database |

### Chạy từng service riêng (Development)

**Backend:**
```bash
cd backend-springboot
./mvnw spring-boot:run
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

**ML Service:**
```bash
cd ml-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## 📂 Cấu trúc dự án

```
aquamekong-platform/
├── backend-springboot/     # Java 21 + Spring Boot 3.3
│   ├── src/main/java/      # Entities, Repositories, Services, Controllers
│   └── src/main/resources/  # application.yml, Flyway migrations
├── frontend/               # React 18 + Vite + TypeScript + Tailwind
│   └── src/                # Components, Hooks, API client
├── ml-service/             # Python 3.12 + FastAPI + Prophet
│   └── app/                # Models, Services, Routers
├── scripts/                # Setup, build, seed scripts
├── docs/                   # Documentation
└── docker-compose.yml      # Orchestration
```

## 🔌 API Endpoints

### Stations
| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/v1/stations` | Tất cả trạm (GeoJSON) |
| GET | `/api/v1/stations/list` | Danh sách trạm (JSON) |
| GET | `/api/v1/stations/{id}` | Chi tiết trạm |
| POST | `/api/v1/stations` | Tạo trạm mới |
| PUT | `/api/v1/stations/{id}` | Cập nhật trạm |
| DELETE | `/api/v1/stations/{id}` | Xóa trạm |
| GET | `/api/v1/stations/nearby` | Tìm trạm lân cận |

### Metrics
| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/v1/metrics/latest` | Chỉ số mới nhất |
| GET | `/api/v1/metrics/station/{id}` | Lịch sử chỉ số |

### Telemetry
| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/v1/telemetry/stream` | SSE real-time stream |

### Forecasts
| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/api/v1/forecasts/predict` | Yêu cầu dự báo |
| GET | `/api/v1/forecasts/station/{id}` | Kết quả dự báo |

## 🎨 Marker Colors (Salinity Alert)

| Mức | Phạm vi | Màu | Ý nghĩa |
|---|---|---|---|
| 🟢 LOW | < 1‰ | `#22c55e` | An toàn cho nông nghiệp |
| 🟡 MEDIUM | 1–4‰ | `#eab308` | Cảnh báo, hạn chế tưới tiêu |
| 🔴 HIGH | > 4‰ | `#ef4444` | Nguy hiểm, xâm nhập mặn nghiêm trọng |

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS 3, react-leaflet, Recharts, TanStack Query |
| Backend | Java 21, Spring Boot 3.3, Spring Data JPA, Hibernate Spatial, Flyway |
| ML/AI | Python 3.12, FastAPI, Facebook Prophet, scikit-learn, Pandas |
| Database | PostgreSQL 16, PostGIS 3.4 |
| DevOps | Docker, Docker Compose, Nginx |

## 📄 License

MIT License
