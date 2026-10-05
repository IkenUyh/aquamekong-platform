# Project overview

AquaMekong is a monorepo for monitoring and forecasting salinity intrusion in the Mekong Delta (ĐBSCL): `backend-springboot/`, `ml-service/` and `frontend/`, plus PostgreSQL 16 + PostGIS and Redis, all wired together by `docker-compose.yml`.

Postgres is exposed on host port `POSTGRES_HOST_PORT` (default 5433, bound to 127.0.0.1).

Each service has its own `CLAUDE.md` with its architecture notes and conventions.
