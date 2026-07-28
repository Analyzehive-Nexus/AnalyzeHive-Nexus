# Backend (Express)

Prototype API gateway. Handles auth/business logic and proxies inference
requests to the FastAPI service in `../inference`.

## Run

```
npm install
cp .env.example .env
npm run dev
```

Listens on `http://localhost:8000` by default.

## Routes

- `GET /api/health`
- `POST /api/auth/login` - mock login, mirrors `frontend/src/lib/api.ts`'s `LoginResponse` shape
- `POST /api/infer` - proxies to the FastAPI `/predict` endpoint
