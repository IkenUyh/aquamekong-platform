# Docker (full stack)

- Start everything: `./scripts/setup.sh`, which copies `.env.example` to `.env` and runs `docker compose up -d --build`.
- Clean DB reset: `docker compose down -v`.
- All services have healthchecks and run as non-root (uid 10001).
- Production (EC2): `docker-compose.prod.yml` on top of `docker-compose.yml` runs the GHCR images built by `.github/workflows/deploy.yml` (only `main` pushes and deploys), behind Caddy for HTTPS. Setup and operations: `deploy/README.md`.
