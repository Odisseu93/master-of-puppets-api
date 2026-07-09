# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-07-09

### Added
- Repository Pattern for isolated SQLite database interactions (Dependency Injection).
- Services layer for separated and testable business logic (`StartExecutionService`, `GetExecutionService`).
- Global Rate Limiting of 5 requests/minute for public endpoints (`/` and `/health`).
- Execution routes Rate Limiting adjusted to 15 requests/minute.

### Changed
- Decoupled `executor.service.ts` into single-responsibility services.
- Extracted controllers into separate files for better maintainability.
- Silenced Pino `info` and `debug` logs during testing (`NODE_ENV === 'test'`) to avoid test pollution.
- Made `createApp` asynchronous to ensure proper database connections before listening.
