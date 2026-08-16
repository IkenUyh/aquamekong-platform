# AquaMekong — Architecture

## System Overview

```
                    ┌─────────────────────────────────────────────────┐
                    │              AquaMekong Platform                 │
                    ├─────────────────────────────────────────────────┤
                    │                                                 │
 Users ──────────▶  │   ┌──────────┐    ┌──────────┐   ┌──────────┐ │
                    │   │ Frontend │───▶│ Backend  │──▶│ ML Svc   │ │
                    │   │ React    │    │ Spring   │   │ FastAPI  │ │
                    │   │ :3000    │◀──SSE──│ :8080│   │ :8000    │ │
                    │   └──────────┘    └────┬─────┘   └────┬─────┘ │
                    │                        │               │       │
                    │                  ┌─────▼───────────────▼──┐   │
                    │                  │  PostgreSQL + PostGIS   │   │
                    │                  │       :5432             │   │
                    │                  └────────────────────────┘   │
                    └─────────────────────────────────────────────────┘
```

## Data Flow

1. **IoT Sensors** → push data to Backend API
2. **Backend** → stores in PostgreSQL, broadcasts via SSE
3. **Frontend** → receives SSE, updates map markers in real-time
4. **ML Service** → reads historical data, generates forecasts
5. **Backend** → proxies forecast requests, caches results

## Database Schema

- `stations` — Monitoring station locations (PostGIS Point)
- `water_metrics` — Time-series hydrology data
- `salinity_forecasts` — ML prediction results
