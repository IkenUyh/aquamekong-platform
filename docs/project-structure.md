# 📂 AquaMekong — Cấu trúc Dự án Chi tiết

> Tài liệu mô tả vai trò từng thư mục, từng file, và cách chúng kết nối với nhau trong toàn bộ hệ thống.

---

## 🗺️ Sơ đồ Luồng Kết nối Tổng thể

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         docker-compose.yml                              │
│              (Khởi tạo & kết nối tất cả 4 services)                     │
│                                                                         │
│  ┌──────────┐   HTTP/SSE    ┌────────────────┐   HTTP    ┌───────────┐ │
│  │ frontend │──────────────▶│backend-springboot│────────▶│ ml-service │ │
│  │  :3000   │◀────SSE───────│     :8080       │◀────────│   :8000    │ │
│  └──────────┘               └───────┬────────┘          └─────┬──────┘ │
│                                     │                         │        │
│                              ┌──────▼─────────────────────────▼──────┐ │
│                              │       PostgreSQL + PostGIS            │ │
│                              │            :5432                      │ │
│                              │  ┌─────────┐ ┌──────────────┐ ┌────┐ │ │
│                              │  │stations │ │water_metrics │ │fore│ │ │
│                              │  └─────────┘ └──────────────┘ └────┘ │ │
│                              └───────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Root — Thư mục gốc

| File | Vai trò | Kết nối |
|---|---|---|
| `.gitignore` | Định nghĩa file/thư mục bị Git bỏ qua (build artifacts, node_modules, .env, __pycache__...) | Áp dụng cho toàn bộ repo |
| `.env.example` | Template biến môi trường (DB credentials, ports, URLs) | → Được copy thành `.env` → Docker Compose + Backend + ML Service đọc |
| `docker-compose.yml` | **"Nhạc trưởng"** — định nghĩa & kết nối 4 services: `postgres`, `backend`, `ml-service`, `frontend` | → Đọc `.env` cho biến môi trường<br>→ Build từ `Dockerfile` trong mỗi module<br>→ Tạo network `aquamekong-network` cho các service giao tiếp |
| `README.md` | Hướng dẫn tổng quan dự án, cách chạy, API reference | Tài liệu cho developer |

### Luồng kết nối từ Root:

```
.env.example ──copy──▶ .env ──đọc──▶ docker-compose.yml
                                          │
                          ┌───────────────┼───────────────┬──────────────┐
                          ▼               ▼               ▼              ▼
                      postgres      backend          ml-service      frontend
                     (PostGIS)    (Spring Boot)     (FastAPI)       (React+Nginx)
```

---

## 📁 backend-springboot/ — Backend API

> **Tech:** Java 21, Spring Boot 3.3, Spring Data JPA, Hibernate Spatial, Flyway

### Cấu hình & Build

| File | Vai trò | Kết nối |
|---|---|---|
| `pom.xml` | Khai báo dependencies Maven (spring-boot, hibernate-spatial, flyway, postgresql, springdoc, lombok) | → Maven tải dependencies khi build<br>→ Quyết định toàn bộ thư viện backend dùng |
| `Dockerfile` | Multi-stage build: JDK 21 compile → JRE 21 chạy JAR | → Được `docker-compose.yml` gọi `build: ./backend-springboot`<br>→ Copy `pom.xml` + `src/` vào container |
| `src/main/resources/application.yml` | **Cấu hình trung tâm** của Spring Boot: DB connection, Flyway, Swagger, CORS, ML service URL | → Đọc biến môi trường từ `docker-compose.yml` (DB_HOST, DB_PORT...)<br>→ Spring Boot dùng để khởi tạo DataSource, JPA, Flyway |

### Database Migration

| File | Vai trò | Kết nối |
|---|---|---|
| `src/main/resources/db/migration/V1__init_schema.sql` | Script Flyway tạo schema: bật PostGIS, tạo 3 bảng, seed 6 trạm đo + metrics mẫu | → Flyway đọc từ `application.yml` (`spring.flyway.locations`)<br>→ Chạy tự động khi backend khởi động<br>→ Tạo bảng trong PostgreSQL |

### Luồng dữ liệu bên trong Backend:

```
                    ┌──────────────────────────────────────────┐
                    │           Spring Boot Backend            │
                    │                                          │
  HTTP Request ───▶ │  Controller ──▶ Service ──▶ Repository   │
                    │      │             │            │        │
                    │      │             │            ▼        │
                    │      │             │     PostgreSQL DB   │
                    │      │             │            │        │
  HTTP Response ◀── │      ◀── DTO ◀────┘◀───Entity──┘        │
                    │                                          │
                    └──────────────────────────────────────────┘
```

### Entity (Lớp dữ liệu — map với bảng DB)

| File | Vai trò | Kết nối |
|---|---|---|
| `entity/Station.java` | Map với bảng `stations`: id, code, name, **location (Point PostGIS)**, riverName, province, status | → `StationRepository` truy vấn<br>→ `StationService` xử lý logic<br>→ `StationDto` trả về client |
| `entity/WaterMetric.java` | Map với bảng `water_metrics`: salinity, waterLevel, flowRate, recordedAt. **ManyToOne → Station** | → `WaterMetricRepository` truy vấn<br>→ `TelemetryService` broadcast qua SSE |
| `entity/SalinityForecast.java` | Map với bảng `salinity_forecasts`: predictedSalinity, confidenceLevel, forecastDate. **ManyToOne → Station** | → `ForecastService` lưu kết quả từ ML service |

### Repository (Truy vấn Database)

| File | Vai trò | Kết nối |
|---|---|---|
| `repository/StationRepository.java` | JPA queries cho Station: findAll, findByCode, **findNearbyStations (ST_DWithin PostGIS)** | → Được `StationService` gọi<br>→ Native SQL dùng PostGIS functions |
| `repository/WaterMetricRepository.java` | Queries cho WaterMetric: **findLatestMetricPerStation (DISTINCT ON)**, findByStationId | → Được `WaterMetricService` + `StationService` gọi |
| `repository/SalinityForecastRepository.java` | Queries cho SalinityForecast: findByStationId | → Được `ForecastService` gọi |

### DTO (Data Transfer Object — dữ liệu gửi/nhận qua API)

| File | Vai trò | Kết nối |
|---|---|---|
| `dto/StationDto.java` | DTO trạm đo: tách longitude/latitude từ Point geometry, kèm latestSalinity, salinityLevel | → `StationService` convert Entity → DTO<br>→ `StationController` trả về client |
| `dto/WaterMetricDto.java` | DTO metrics: kèm stationCode, stationName, salinityLevel | → `WaterMetricService` convert<br>→ `TelemetryService` broadcast qua SSE |
| `dto/ForecastRequestDto.java` | Request body cho endpoint dự báo: stationId, daysAhead | → `ForecastController` nhận từ client<br>→ `ForecastService` gửi tới ML service |
| `dto/GeoJsonResponse.java` | Wrapper chuẩn GeoJSON RFC 7946: FeatureCollection → Feature → Geometry + Properties | → `StationService` build GeoJSON<br>→ Frontend Leaflet map đọc trực tiếp |

### Service (Business Logic)

| File | Vai trò | Kết nối |
|---|---|---|
| `service/StationService.java` | CRUD trạm, **tạo GeoJSON output**, tìm trạm lân cận (spatial), **phân loại độ mặn** (<1‰→LOW, 1-4‰→MEDIUM, >4‰→HIGH) | → Gọi `StationRepository` + `WaterMetricRepository`<br>→ Được `StationController` gọi |
| `service/WaterMetricService.java` | Lấy metrics mới nhất, lịch sử metrics theo trạm | → Gọi `WaterMetricRepository`<br>→ Được `WaterMetricController` + `TelemetryService` gọi |
| `service/TelemetryService.java` | **Quản lý SSE connections** (CopyOnWriteArrayList), broadcast data, **@Scheduled mỗi 10s** sinh dữ liệu giả lập | → Gọi `WaterMetricService` lấy initial data<br>→ `SseEmitter` push tới tất cả clients<br>→ Được `TelemetryController` gọi |
| `service/ForecastService.java` | **Proxy tới ML Service** qua WebClient, nhận predictions, lưu vào DB | → Gọi `StationRepository` kiểm tra station<br>→ HTTP POST tới `ml-service:8000/api/v1/predict`<br>→ Lưu kết quả vào `SalinityForecastRepository` |

### Controller (API Endpoints)

| File | Vai trò | Endpoints | Kết nối |
|---|---|---|---|
| `controller/StationController.java` | CRUD trạm đo + Spatial query | `GET/POST/PUT/DELETE /api/v1/stations`, `GET /nearby` | → Gọi `StationService`<br>→ Frontend `useStations` hook gọi |
| `controller/WaterMetricController.java` | Truy vấn chỉ số thủy văn | `GET /api/v1/metrics/latest`, `GET /metrics/station/{id}` | → Gọi `WaterMetricService`<br>→ Frontend `useWaterMetrics` hook gọi |
| `controller/TelemetryController.java` | **SSE stream** real-time | `GET /api/v1/telemetry/stream` (text/event-stream) | → Gọi `TelemetryService.subscribe()`<br>→ Frontend `useTelemetrySSE` hook kết nối |
| `controller/ForecastController.java` | Dự báo xâm nhập mặn | `POST /api/v1/forecasts/predict`, `GET /forecasts/station/{id}` | → Gọi `ForecastService`<br>→ Frontend `useForecast` hook gọi |

### Config

| File | Vai trò | Kết nối |
|---|---|---|
| `config/CorsConfig.java` | Cho phép Frontend (localhost:3000, :5173) gọi API cross-origin | → Đọc `app.cors.allowed-origins` từ `application.yml` |
| `config/OpenApiConfig.java` | Cấu hình Swagger UI: title, description, server URLs | → Springdoc tự động tạo `/swagger-ui.html` |
| `AquaMekongApplication.java` | **Entry point** Spring Boot + bật `@EnableScheduling` cho SSE | → Spring Boot khởi động từ đây<br>→ Scan tất cả `@Component`, `@Service`, `@Controller` |

---

## 📁 frontend/ — Giao diện Web

> **Tech:** React 18, Vite, TypeScript, Tailwind CSS 3, react-leaflet, Recharts, TanStack Query, Axios

### Cấu hình & Build

| File | Vai trò | Kết nối |
|---|---|---|
| `package.json` | Khai báo dependencies npm + scripts (dev, build, preview) | → `npm install` tải packages<br>→ `npm run dev` khởi động Vite dev server |
| `vite.config.ts` | Cấu hình Vite: React plugin, **proxy `/api` → `localhost:8080`** (backend) | → Dev server proxy API calls<br>→ Build output ra `dist/` |
| `tsconfig.json` | Cấu hình TypeScript: strict mode, path aliases `@/*` → `src/*` | → TypeScript compiler dùng khi build |
| `tsconfig.node.json` | TypeScript config riêng cho Vite config file | → Chỉ apply cho `vite.config.ts` |
| `tailwind.config.js` | **Theme design**: brand colors (aqua), salinity colors (green/yellow/red), dark theme, animations | → PostCSS dùng khi build CSS<br>→ `index.css` import `@tailwind` directives |
| `postcss.config.js` | Đăng ký Tailwind + Autoprefixer với PostCSS | → Vite dùng để xử lý CSS |
| `index.html` | HTML entry point: load font Inter, Leaflet CSS CDN, mount `<div id="root">` | → Vite inject `main.tsx` vào `<script>` tag |
| `Dockerfile` | Multi-stage: Node 20 build → Nginx serve static files | → `docker-compose.yml` build frontend container |
| `nginx.conf` | Nginx config: SPA fallback, **proxy `/api/` → backend:8080** với SSE support, gzip, cache | → Copy vào Nginx container<br>→ Cho phép frontend gọi backend trong Docker |

### Source Code — Luồng kết nối:

```
index.html
  └── main.tsx (entry point)
        └── App.tsx (root component + React Query Provider)
              ├── useStations() ──────── GET /api/v1/stations ─────────▶ Backend
              ├── useStationsList() ──── GET /api/v1/stations/list ────▶ Backend
              ├── useTelemetrySSE() ──── SSE /api/v1/telemetry/stream ─▶ Backend
              │
              ├── Layout.tsx
              │     ├── Sidebar.tsx
              │     │     ├── MetricCard.tsx (x4 summary cards)
              │     │     └── Station list items (click → select station)
              │     │
              │     └── MapView.tsx
              │           └── StationMarker.tsx (x6 markers, color = salinity)
              │                 └── Popup (station info + metrics)
              │
              └── StationPanel.tsx (khi click station)
                    ├── useStationMetrics() ── GET /api/v1/metrics/station/{id} ─▶ Backend
                    ├── useForecast() ──────── GET /api/v1/forecasts/station/{id} ▶ Backend
                    └── ForecastChart.tsx ──── Recharts AreaChart
```

### Types

| File | Vai trò | Kết nối |
|---|---|---|
| `src/types/index.ts` | TypeScript interfaces: `Station`, `WaterMetric`, `SalinityForecast`, `GeoJsonFeature`, `TelemetryEvent` | → Tất cả hooks, components, API client import types từ đây |
| `src/vite-env.d.ts` | Khai báo types cho Vite env variables (`import.meta.env`) | → TypeScript hiểu `VITE_API_BASE_URL` |

### API Client

| File | Vai trò | Kết nối |
|---|---|---|
| `src/api/client.ts` | Axios instance + **typed API functions** (`stationApi`, `metricApi`, `forecastApi`) | → Đọc `VITE_API_BASE_URL` từ env<br>→ Gửi HTTP tới Backend API<br>→ Được tất cả hooks import |

### Hooks (React Hooks — quản lý data fetching)

| File | Vai trò | Kết nối |
|---|---|---|
| `src/hooks/useStations.ts` | TanStack Query: fetch stations (GeoJSON + list), auto-refetch 30s | → Gọi `stationApi.getAll()` + `getAllList()`<br>→ `App.tsx` dùng |
| `src/hooks/useWaterMetrics.ts` | TanStack Query: fetch latest metrics + station history | → Gọi `metricApi.getLatest()` + `getByStation()`<br>→ `StationPanel.tsx` dùng |
| `src/hooks/useForecast.ts` | TanStack Query: fetch forecast data cho 1 trạm | → Gọi `forecastApi.getByStation()`<br>→ `StationPanel.tsx` dùng |
| `src/hooks/useTelemetrySSE.ts` | **EventSource API**: kết nối SSE stream, auto-reconnect 5s, parse events | → Kết nối `GET /api/v1/telemetry/stream`<br>→ Nhận event `init` (data ban đầu) + `telemetry` (update)<br>→ `App.tsx` invalidate queries khi có data mới |

### Components (UI)

| File | Vai trò | Kết nối |
|---|---|---|
| `src/main.tsx` | **Entry point**: mount `<App />` vào DOM | → Import `App.tsx` + `index.css` |
| `src/App.tsx` | **Root component**: React Query Provider, state management (sidebar, selected station), SSE integration | → Dùng tất cả hooks<br>→ Render Layout + MapView + StationPanel |
| `src/index.css` | **Global CSS**: Tailwind directives, dark Leaflet overrides, glassmorphism utilities, scrollbar, animations | → `main.tsx` import<br>→ Tailwind dùng `tailwind.config.js` |
| `src/components/Layout.tsx` | Shell layout: sidebar (collapsible 380px) + main content area + top bar (logo + SSE status) | → Nhận `sidebar` + `children` props từ App |
| `src/components/Sidebar.tsx` | Sidebar: search box, 4 summary cards, station list với salinity color dots | → Nhận `stations[]` từ App<br>→ Dùng `MetricCard` component<br>→ Click station → `onSelectStation()` |
| `src/components/MetricCard.tsx` | Card nhỏ hiển thị 1 metric (icon + label + value) với glassmorphism style | → Được `Sidebar` dùng cho 4 summary cards |
| `src/components/MapView.tsx` | **Leaflet map**: center ĐBSCL (10°N, 105.8°E), zoom 9, dark CARTO tiles | → Render `StationMarker` cho mỗi GeoJSON feature<br>→ Click marker → `onSelectStation()` |
| `src/components/StationMarker.tsx` | **CircleMarker** với 2 layers (glow ring + core), **màu động theo salinity** (green/yellow/red), popup chi tiết | → Nhận `GeoJsonFeature` prop<br>→ Hiển thị Popup với metrics |
| `src/components/StationPanel.tsx` | Panel chi tiết station (góc phải map): metrics hiện tại, forecast chart, lịch sử | → Dùng `useStationMetrics()` + `useForecast()`<br>→ Render `ForecastChart` |
| `src/components/ForecastChart.tsx` | **Recharts AreaChart**: line dự báo salinity + confidence band (gradient fill) | → Nhận `SalinityForecast[]` prop<br>→ Hiển thị trong `StationPanel` |

---

## 📁 ml-service/ — AI/ML Dự báo

> **Tech:** Python 3.12, FastAPI, Facebook Prophet, scikit-learn, Pandas, SQLAlchemy

### Cấu hình & Build

| File | Vai trò | Kết nối |
|---|---|---|
| `requirements.txt` | Khai báo Python dependencies: fastapi, prophet, pandas, sqlalchemy... | → `Dockerfile` dùng `pip install -r requirements.txt` |
| `Dockerfile` | Python 3.12 slim + system deps (gcc, libpq-dev cho Prophet + psycopg2) | → `docker-compose.yml` build ml-service container |
| `trained_models/.gitkeep` | Giữ thư mục `trained_models/` trong Git (models .pkl bị gitignore) | → Nơi lưu model đã train (Prophet serialized) |

### Luồng kết nối bên trong ML Service:

```
HTTP Request ──▶ Router (forecast.py)
                    │
                    ├── POST /predict ──▶ Predictor Service
                    │                        │
                    │                   ┌────▼────────────────────┐
                    │                   │ Có trained model? (.pkl)│
                    │                   │    YES → Prophet predict│
                    │                   │    NO  → Statistical    │
                    │                   │         → Simulation    │
                    │                   └─────────────────────────┘
                    │                        │
                    │                   Data Loader ──▶ PostgreSQL
                    │                                   (water_metrics)
                    │
                    ├── POST /train ───▶ SalinityModel.train()
                    │                        │
                    │                   Data Loader ──▶ PostgreSQL
                    │                        │
                    │                   Prophet fit() → save .pkl
                    │
                    └── GET /models ───▶ List .pkl files
```

### Source Code

| File | Vai trò | Kết nối |
|---|---|---|
| `app/__init__.py` | Package marker | — |
| `app/main.py` | **FastAPI entry point**: tạo app, CORS middleware, include routers, health check endpoint | → Uvicorn chạy `app.main:app`<br>→ Import `routers/forecast.py` |
| `app/config.py` | Pydantic Settings: đọc `DATABASE_URL`, `ML_SERVICE_PORT`, model paths từ env | → Tất cả services import `get_settings()` |

### Schemas (Pydantic — validation request/response)

| File | Vai trò | Kết nối |
|---|---|---|
| `app/schemas/forecast.py` | `PredictionRequest` (station_id, days_ahead), `PredictionResponse` (predictions list), `TrainRequest`, `TrainResponse`, `ModelInfo` | → Router dùng làm request/response models<br>→ Backend Java đọc response JSON theo schema này |

### Services

| File | Vai trò | Kết nối |
|---|---|---|
| `app/services/data_loader.py` | **SQLAlchemy** kết nối PostgreSQL, query `water_metrics` + `stations` | → Đọc `DATABASE_URL` từ config<br>→ Trả về Pandas DataFrame cho predictor |
| `app/services/predictor.py` | **Pipeline dự báo**: thử trained model → statistical fallback → simulation | → Gọi `data_loader` lấy data<br>→ Gọi `SalinityModel` predict<br>→ Trả `PredictionItem[]` cho router |

### Models

| File | Vai trò | Kết nối |
|---|---|---|
| `app/models/salinity_model.py` | **Facebook Prophet** wrapper: `train()` fit model + save `.pkl`, `predict()` load model + forecast | → Serialize model vào `trained_models/station_{id}_prophet.pkl`<br>→ Dùng joblib load/save<br>→ Được `predictor.py` gọi |

### Routers

| File | Vai trò | Kết nối |
|---|---|---|
| `app/routers/forecast.py` | **API endpoints**: `POST /api/v1/predict`, `POST /api/v1/train`, `GET /api/v1/models` | → Gọi `predictor.predict()` + `model.train()`<br>→ Backend Java gọi `POST /api/v1/predict` qua WebClient |

---

## 📁 scripts/ — Utility Scripts

| File | Vai trò | Kết nối |
|---|---|---|
| `setup.sh` | **One-command setup**: copy `.env`, chạy `docker compose up -d --build`, kiểm tra health | → Gọi `docker-compose.yml` |
| `build-all.sh` | Build tất cả services: Maven package backend, npm build frontend, verify ML | → Gọi `mvnw` + `npm` + `python` |

---

## 📁 docs/ — Tài liệu

| File | Vai trò |
|---|---|
| `architecture.md` | Sơ đồ kiến trúc hệ thống, data flow |
| `project-structure.md` | *File này* — mô tả chi tiết vai trò & kết nối |

---

## 📁 .github/workflows/ — CI/CD

| File | Vai trò | Kết nối |
|---|---|---|
| `deploy.yml` | GitHub Actions: build backend (JDK 21), build frontend (Node 20), verify ML (Python 3.12), validate Docker Compose | → Chạy khi push/PR vào `main`/`develop` |

---

## 🔗 Bản đồ Kết nối Giữa Các Module

### 1. Frontend → Backend (HTTP + SSE)

```
frontend/src/api/client.ts          →  GET /api/v1/stations        →  StationController.java
frontend/src/hooks/useStations.ts   →  (qua client.ts)             →  StationController.java
frontend/src/hooks/useWaterMetrics  →  GET /api/v1/metrics/latest  →  WaterMetricController.java
frontend/src/hooks/useForecast.ts   →  GET /api/v1/forecasts/...   →  ForecastController.java
frontend/src/hooks/useTelemetrySSE  →  SSE /api/v1/telemetry/stream → TelemetryController.java
```

### 2. Backend → Database (JPA + Flyway)

```
application.yml (datasource config)   →  PostgreSQL :5432
V1__init_schema.sql (Flyway)          →  Tạo bảng stations, water_metrics, salinity_forecasts
StationRepository.java                →  SELECT * FROM stations (+ PostGIS queries)
WaterMetricRepository.java            →  SELECT * FROM water_metrics
SalinityForecastRepository.java       →  SELECT * FROM salinity_forecasts
```

### 3. Backend → ML Service (HTTP via WebClient)

```
ForecastService.java  →  POST http://ml-service:8000/api/v1/predict  →  forecast.py (router)
                                                                          │
                                                                     predictor.py → data_loader.py → PostgreSQL
                                                                          │
ForecastService.java  ◀──  JSON { predictions: [...] }  ◀────────────────┘
       │
       └──▶ SalinityForecastRepository.save()  →  INSERT INTO salinity_forecasts
```

### 4. ML Service → Database (SQLAlchemy)

```
app/config.py (DATABASE_URL)     →  PostgreSQL :5432
app/services/data_loader.py     →  SELECT FROM water_metrics, stations
```

### 5. Docker Compose — Network Topology

```
┌─ aquamekong-network (bridge) ─────────────────────────────┐
│                                                            │
│  postgres (postgis/postgis:16-3.4)                        │
│    ├── Được backend kết nối qua: postgres:5432            │
│    └── Được ml-service kết nối qua: postgres:5432         │
│                                                            │
│  backend (Spring Boot JAR)                                 │
│    ├── Expose: 8080                                        │
│    ├── depends_on: postgres (healthy)                      │
│    └── Gọi ml-service:8000 (qua internal network)         │
│                                                            │
│  ml-service (Uvicorn + FastAPI)                           │
│    ├── Expose: 8000                                        │
│    └── depends_on: postgres (healthy)                      │
│                                                            │
│  frontend (Nginx)                                          │
│    ├── Expose: 3000 → 80                                   │
│    ├── depends_on: backend                                 │
│    └── nginx.conf proxy /api/ → backend:8080              │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 🎨 Luồng Dữ liệu Real-time (SSE)

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  1. TelemetryService.java (@Scheduled mỗi 10s)                     │
│     └── Sinh dữ liệu giả lập (simulated WaterMetricDto)            │
│                                                                      │
│  2. TelemetryService.broadcast()                                    │
│     └── Push event "telemetry" tới CopyOnWriteArrayList<SseEmitter> │
│                                                                      │
│  3. SseEmitter ──── text/event-stream ────▶ Browser EventSource     │
│                                                                      │
│  4. useTelemetrySSE.ts                                              │
│     └── Parse JSON, gọi onTelemetry callback                       │
│                                                                      │
│  5. App.tsx onTelemetry                                             │
│     └── queryClient.invalidateQueries() → re-fetch stations         │
│                                                                      │
│  6. MapView + StationMarker re-render với data mới                  │
│     └── Marker color tự động cập nhật theo salinity mới             │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 🤖 Luồng Dự báo AI (ML Pipeline)

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  1. User click "Dự báo" trên Frontend                               │
│     └── useForecast hook → GET /api/v1/forecasts/station/{id}       │
│         (hoặc POST /api/v1/forecasts/predict)                       │
│                                                                      │
│  2. ForecastController.java nhận request                            │
│     └── ForecastService.requestPrediction()                         │
│                                                                      │
│  3. ForecastService dùng WebClient                                  │
│     └── POST http://ml-service:8000/api/v1/predict                  │
│         Body: { station_id: 3, days_ahead: 7 }                     │
│                                                                      │
│  4. ml-service/routers/forecast.py nhận request                     │
│     └── predictor.predict(station_id=3, days_ahead=7)               │
│                                                                      │
│  5. predictor.py kiểm tra:                                          │
│     ├── Có trained model? → SalinityModel.predict() (Prophet)       │
│     ├── Có data lịch sử?  → Statistical forecast (rolling mean)    │
│     └── Không có gì?      → Simulated predictions (demo)           │
│                                                                      │
│  6. Response trả về Backend                                         │
│     └── ForecastService lưu vào bảng salinity_forecasts             │
│                                                                      │
│  7. Frontend nhận & hiển thị ForecastChart.tsx                      │
│     └── Recharts AreaChart với prediction line + confidence band    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```
