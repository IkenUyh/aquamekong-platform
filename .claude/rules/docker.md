# Docker (full stack)

- Start everything: `./scripts/setup.sh`, which copies `.env.example` to `.env` and runs `docker compose up -d --build`.
- Clean DB reset: `docker compose down -v`.
- All services have healthchecks and run as non-root (uid 10001).
