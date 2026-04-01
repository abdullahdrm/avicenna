# Avicenna Doctor Web

A clean doctor-facing web interface that works with the Django backend you already built.

## Expected backend endpoints

- `POST /api/auth/login/`
- `POST /api/auth/logout/`
- `GET /api/auth/me/`
- `GET /api/doctor/dashboard/`
- `GET /api/doctor/cases/`
- `GET /api/doctor/case/:id/`
- `POST /api/doctor/review/:id/`

## Run

```bash
npm install
npm run dev
```

## Backend URL

Create `.env` if needed:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

For your backend on another machine, use its LAN IP.
