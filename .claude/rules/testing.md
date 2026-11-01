# Tests and lint

CI runs all of them, see `.github/workflows/deploy.yml`.

- Backend: `./mvnw test`; one class: `./mvnw test -Dtest=ForecastServiceTest`; one method: `-Dtest=ForecastServiceTest#predictRejectsUnknownStationWithoutCallingMl`. Tests are Mockito unit tests and `@WebMvcTest`, with no DB needed.
- ML: `cd ml-service && python -m pytest tests`; one test: `python -m pytest tests/test_pipeline.py::test_failed_insert_does_not_mark_data_as_processed`. `tests/conftest.py` provides a `FakeRedis`.
- Frontend: `npm run lint`, `npm test`, `npm run build` (`tsc -b && vite build`, which is the type check). `tsc -b` writes its build info under `node_modules/.tmp`, so no `vite.config.js` is emitted next to `vite.config.ts` (Vite would prefer the `.js` file).
