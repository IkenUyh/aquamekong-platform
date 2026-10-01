# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

AquaMekong is a monorepo for monitoring and forecasting salinity intrusion in the Mekong Delta (ĐBSCL). It has three services plus PostgreSQL 16 + PostGIS and Redis, all wired together by `docker-compose.yml`. The README, docs, code comments and error messages are mostly in Vietnamese. Keep new user-facing strings consistent with that.

| Dir | Stack | Port |
| --- | --- | --- |
| `backend-springboot/` | Spring Boot 3.3, Java 21, JPA + hibernate-spatial, Flyway, springdoc | 8080 |
| `ml-service/` | Python 3.12, FastAPI, Prophet / PyTorch, APScheduler | 8000 |
| `frontend/` | React 18, Vite, TS, Tailwind v3, react-leaflet, Recharts, Redux Toolkit, React Query | 5173 (dev) / 3000 (nginx in Docker) |
| postgres | `postgis/postgis:16-3.4` | host `POSTGRES_HOST_PORT` (default 5433, bound to 127.0.0.1) → 5432 |

## Commands

Full stack (Docker): `./scripts/setup.sh`, which copies `.env.example` to `.env` and runs `docker compose up -d --build`. Use `docker compose logs -f <backend|frontend|ml-service>` for logs, and `docker compose down -v` for a clean DB reset. All services have healthchecks and run as non-root (uid 10001).

For local dev, run `docker compose up -d postgres redis` first. Then start each service:

- Backend: `cd backend-springboot && DB_PORT=5433 ./mvnw spring-boot:run` (needs a JDK 21, not just a JRE). Package with `./mvnw clean package -DskipTests`.
- ML service: `cd ml-service && pip install -r requirements-dev.txt && DATABASE_URL=postgresql://aquamekong:aquamekong_secret@localhost:5433/aquamekong uvicorn app.main:app --reload --port 8000`
- Frontend: `cd frontend && npm install && npm run dev`. The dev server proxies `/api` to `localhost:8080`, like nginx does in Docker.

Tests and lint (CI runs all of them, see `.github/workflows/deploy.yml`):

- Backend: `./mvnw test`; one class: `./mvnw test -Dtest=ForecastServiceTest`; one method: `-Dtest=ForecastServiceTest#predictRejectsUnknownStationWithoutCallingMl`. Tests are Mockito unit tests and `@WebMvcTest`, with no DB needed.
- ML: `cd ml-service && python -m pytest tests`; one test: `python -m pytest tests/test_pipeline.py::test_failed_insert_does_not_mark_data_as_processed`. `tests/conftest.py` provides a `FakeRedis`.
- Frontend: `npm run lint` (eslint 9 flat config), `npm test` (vitest), `npm run build` (`tsc -b && vite build`, which is the type check). `tsc -b` writes its build info under `node_modules/.tmp`, so no `vite.config.js` is emitted next to `vite.config.ts` (Vite would prefer the `.js` file).

## Architecture

### Backend (`com.aquamekong`)
- The code is layered as `controller → service → repository → entity`, with DTOs in `dto/`. Each layer is split into the same domain subpackages: `station` (rivers, stations), `device` (devices, sensors), `telemetry` (measurements), `forecast` (forecast_runs, salinity_forecasts), `alert` (alert_rules, alerts), and `user`. Services map entities to DTOs by hand with Lombok builders. `hibernate.default_batch_fetch_size` batches the lazy relations those mappers touch.
- All REST routes live under `/api/v1/...`. Swagger UI is at `/swagger-ui.html`.
- **Auth** (`security/`): stateless JWT (`JwtService`, HS256, `JWT_SECRET`), and `POST /auth/login` returns a Bearer token carrying the username and roles. `SecurityConfig` is the single place for authorization rules. GET is open to `ROLE_USER`/`OPERATOR`/`ADMIN`, other writes need `OPERATOR`/`ADMIN`, `/users/**` needs `ADMIN`, and `/measurements/ingest` also accepts `X-API-Key` (`INGEST_API_KEY` → `ROLE_DEVICE`). The SSE endpoint alone accepts `?access_token=`, because `EventSource` can't send headers. Passwords are BCrypt. `AdminBootstrap` creates the first admin when `users` is empty: `ADMIN_PASSWORD`, or a random one logged once. `LoginAttemptService` locks username+IP for 5 minutes after 5 failures (429). Controller tests use `@WebMvcTest` + `@Import({SecurityConfig, JwtService, JsonAuthErrorHandler})` + `@WithMockUser`.
- **Reports** (`service/report/ReportService`): aggregate SQL via `NamedParameterJdbcTemplate`, comparing `[now-days, now)` with the previous period of the same length (`days` is clamped to 1–90). List endpoints on growing tables (measurements, alerts, forecast runs) take a capped `?limit=`. `GlobalExceptionHandler` maps errors to 400/404/502 and never returns internal messages on 500.
- The schema is owned by **Flyway** (`src/main/resources/db/migration`), and Hibernate runs with `ddl-auto: validate`. Any entity change needs a new `V{n}__*.sql` migration, and applied migrations must never be edited (checksums). V2 replaced the V1 tables. V3 seeds one virtual `CRAWLER` device per station, with `salinity`/`water_level`/`flow_rate` sensors, for the ML pipeline. V5 enforces lowercase `metric_type` with CHECK constraints, and entities normalize it via `util/MetricTypes`.
- "Latest value" queries are per (station, metric) and use `LATERAL ... LIMIT 1` over the `(station_id, metric_type, recorded_at DESC)` index.
- `MeasurementPoller` (`@Scheduled`, `app.telemetry.broadcast-interval-ms`) is the single path for new measurements, whether they come from the `/ingest` API or from rows the ML pipeline inserts directly. It evaluates alert rules (at most one ACTIVE alert per rule) and pushes each row to SSE (`TelemetryService`, `/api/v1/telemetry/stream`, events `init`/`telemetry`, 25s heartbeat).
- `POST /forecasts/predict` calls the ML service through `client/MlServiceClient` (`RestClient`, `app.ml-service.*`) outside any transaction, then saves a `forecast_run` plus its rows. `GET /forecasts/station/{id}` returns only the latest run.

### ML service (`ml-service/app`)
- `main.py` mounts `routers/forecast.py` under `/api/v1` (`/predict`, `/train`, `/models`). If `ENABLE_SCHEDULER` is set, the lifespan hook starts an APScheduler job (`pipeline/scheduler.py`) every 15 minutes: crawler → preprocessor (`scale=False`, so real units go to the DB) → long format → insert into `measurements` against the CRAWLER sensors. The crawler marks data processed in Redis only after the insert succeeds.
- `services/predictor.py` caches results in Redis (`forecast:{station}:{days}:{date}`, but not simulated ones) and falls back in this order: the per-station Prophet model (trained by `/train`, `station_*_prophet.pkl` in `model_dir`), then the global Hybrid ARIMA-CNN (`hybrid_cnn.pth` plus the CSV dataset via `DataLoaderService.load_long_data()`), then a statistical trend from `measurements`, then simulated data. `/train` invalidates that station's cache. `load_raw_data()` is the ST-GNN pivot format, so don't use it for the hybrid model.
- Routes are plain `def` (FastAPI runs them in a threadpool) because they do blocking torch/ARIMA/SQL work. DB and Redis clients are shared singletons (`app/db.py`, `app/cache.py`). `db.py` forces the `psycopg2` driver because SQLAlchemy 2.1 defaults to psycopg v3.
- Settings come from env vars or `.env` via pydantic-settings (`config.py`). The Docker image installs CPU-only torch.

### Frontend (`frontend/src`)
- Auth: `contexts/AuthContext.tsx` (`useAuth`), token in localStorage (`auth/tokenStorage.ts`), and `components/RequireAuth.tsx` wraps every route except `/login`. The axios interceptor adds `Authorization`, and on 401 it fires `UNAUTHORIZED_EVENT`, which logs the user out.
- API calls go through the axios instance in `api/client.ts` (base `${VITE_API_BASE_URL ?? ''}/api/v1`, same-origin by default) and the per-domain modules in `api/`. `api/alertApi.ts` maps backend `Alert` to the UI's `AlertDto` (`toAlertDto`).
- `withFallback`/`orMock` (never applied to 401/403) substitute mock data from `data/mockData.ts`, and set Redux `network.isOfflineMode` (Navbar badge), **only** in `npm run dev` or with `VITE_ENABLE_MOCK_FALLBACK=true`. Production builds surface real API errors.
- State lives in Redux (network status only, because `client.ts` dispatches outside React), React Query hooks in `hooks/` (one shared hook per resource, so query keys stay consistent), and `contexts/FilterContext.tsx`. Routes in `router.tsx` are lazy-loaded per page. `/admin` (alert rules, stations, users) is guarded by `RequireRole`, and every route has a `RouteError` error element.
- `utils/salinity.ts` is the single salinity scale (threshold 4‰, matching backend `classifySalinity`), along with the colors and labels, `formatNumber` (vi-VN), metric labels/units, and `isReporting` (data within 2h). Use it instead of hardcoding thresholds or colors. Heat-layer scales live in `utils/heatScales.ts`.
- `layouts/DashboardLayout.tsx` is 3 columns from `lg`, and stacks below that (pass `mobileCenterHeight` for fixed-height content like the map). `components/shared/DataTable.tsx` paginates internally, so pass the full array.
- Forecasts: `forecastApi.getOrPredict` re-runs the model when the latest run is stale or too short. Use the `forecastQueryKey(stationId, days)` key.
- `frontend/frontend_backend_status.md` (Vietnamese) tracks which frontend features are wired to which backend endpoints.
