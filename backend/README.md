# VORZANE backend foundation

This directory is an isolated Node.js service foundation for the planned FPS.ms deployment.

## Current scope

- Express service with Helmet security headers.
- Strict allow-list CORS configuration.
- Bounded JSON request bodies.
- Environment validation at startup.
- Lightweight `GET /healthz` liveness endpoint.

## Explicitly not implemented

Authentication, sessions, MariaDB/Prisma persistence, game commands, background settlement, WebSocket, and data import are not enabled. The client must continue using its existing Manus/Supabase path until these features are implemented and verified end-to-end.

## Local development

1. Use Node.js 20.19 or newer.
2. Copy `.env.example` to `.env` and adjust local settings.
3. Install dependencies with `npm install`.
4. Run `npm run dev`.
5. Check `GET http://localhost:3001/healthz`.

Do not put real credentials in source control. FPS.ms-specific `PORT`, startup command, database provisioning, TLS, and backup/restore behavior must be confirmed in the actual account before deployment.
