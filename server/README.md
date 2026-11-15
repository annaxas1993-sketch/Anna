# TAXI LIDER API + Dispatcher

Node.js + Express + PostgreSQL + Socket.IO backend. The browser dispatcher dashboard is served from the same service root: `/`.

## Temporary deployment (Render)

1. Open the Render Blueprint deploy link: https://render.com/deploy?repo=https://github.com/annaxas1993-sketch/Anna
2. Sign in to Render and create the Blueprint instance from the repository's `render.yaml`.
3. Wait until the `taxi-lider-api` web service is Live. Its `https://....onrender.com/` URL is both the dispatcher address and API base.
4. In the Render service Environment page, copy the generated `ADMIN_SETUP_KEY`.
5. Open the service URL, expand **Առաջին դիսպետչերի հաշիվ ստեղծել**, enter the name, phone, password (8+ characters), and setup key. Create the first admin, then sign in.

The setup key is private. Do not share it in chat. The first-admin setup endpoint is disabled after an admin account exists.

## Local configuration

Set `DATABASE_URL`, `JWT_SECRET`, `ADMIN_SETUP_KEY`, and `CORS_ORIGIN`. Start with `npm start` (Node 20+). Health check: `GET /health`.

## API

- `POST /api/setup/admin` — create the first admin only; requires `x-setup-key`
- `POST /api/auth/register` and `POST /api/auth/login`
- `GET /api/me`
- `PATCH /api/drivers/availability`
- `POST /api/drivers/location`
- `POST /api/orders`
- `GET /api/admin/drivers` and `GET /api/admin/orders`
- `PATCH /api/admin/orders/:id/assign`
- `PATCH /api/admin/orders/:id/status`
- `GET /api/orders/available`, `POST /api/orders/:id/accept`, `POST /api/orders/:id/status`, `GET /api/orders/mine`

## Important

The dispatcher dashboard and backend source are prepared, but this repository alone does not mean the service is already deployed. Render creates the public URL only after the owner creates the Blueprint instance. Render's free PostgreSQL database is temporary and may expire; use a persistent paid database for production.

The current driver app still needs its driver sign-in, server URL configuration, and authenticated GPS/order integration before live driver positions and orders can appear in this dispatcher.
