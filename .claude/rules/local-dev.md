# Local development

Run `docker compose up -d postgres redis` first. Then start each service:

- Backend: `cd backend-springboot && DB_PORT=5433 ./mvnw spring-boot:run` (needs a JDK 21, not just a JRE).
- ML service: `cd ml-service && pip install -r requirements-dev.txt && DATABASE_URL=postgresql://aquamekong:aquamekong_secret@localhost:5433/aquamekong uvicorn app.main:app --reload --port 8000`
- Frontend: `cd frontend && npm install && npm run dev`. The dev server proxies `/api` to `localhost:8080`, like nginx does in Docker.
