# AXAS Driver API
Node.js + Express + PostgreSQL + Socket.IO backend.

## Deploy
1. Create a PostgreSQL database and run `db/schema.sql`.
2. Deploy this folder to a Node.js host (Node 20+).
3. Set `DATABASE_URL`, `JWT_SECRET`, `ADMIN_SETUP_KEY`, and `CORS_ORIGIN`.
4. Start with `npm start`. Health check: `GET /health`.

Create the first admin once with `POST /api/setup/admin`, header `x-setup-key: YOUR_ADMIN_SETUP_KEY`, body `{"name":"AXAS Admin","phone":"+374...","password":"at-least-8-chars" }`. Keep setup key private.

## Endpoints
- POST /api/auth/register and /api/auth/login
- GET /api/me
- PATCH /api/drivers/availability
- POST /api/drivers/location
- POST /api/orders (passenger/admin)
- GET /api/orders/available (driver)
- POST /api/orders/:id/accept
- POST /api/orders/:id/status
- GET /api/orders/mine
- GET /api/admin/drivers

This is backend source, not a deployed live service. Hosting, database credentials, SMS verification, push notifications, fare calculation, payment processing, and production monitoring still require configuration.
