# Apex Workspace

A construction workspace with a Next.js frontend, Amazon Cognito sign-in, and a FastAPI/PostgreSQL API. The dashboard displays organizations, projects, and shared project assets in a dark zinc interface.

## Repository map

- `frontend/app/` — landing page, dashboard pages, and Cognito session routes.
- `frontend/components/dashboard/` — dashboard shell and organization, project, and asset views.
- `frontend/lib/api.ts` — gets access tokens and calls FastAPI.
- `backend/src/backend/auth.py` — verifies Cognito access-token signatures and claims.
- `backend/src/backend/backend.py` — database sessions, user resolution, access checks, and routes.
- `backend/src/backend/models.py` — SQLAlchemy tables and relationships.
- `backend/alembic/` — database migrations.
- `tests/` — offline API tests, generated signing keys, mocked JWKS, and fake seed data.

## Sign-in and API flow

1. The browser starts Cognito's authorization-code flow with PKCE through `/api/auth/login`.
2. `/api/auth/callback` exchanges the code and stores access, ID, and refresh tokens in secure, HttpOnly cookies.
3. The dashboard uses the ID token for display details, then obtains an access token from `/api/auth/token`.
4. `frontend/lib/api.ts` sends the access token as a Bearer token to FastAPI.
5. FastAPI verifies signature, issuer, expiry, token type, and app client. The verified `sub` identifies the local `users.sub_id` record; the browser does not supply a separate identity ID.
6. Organization and project membership records determine which data is returned. Inaccessible organization and project IDs return `404` to avoid exposing another company's records.

The API provides `/profile`, `/dashboard`, `/organizations`, `/organizations/{id}`, `/projects`, `/projects/{id}`, `/projects/{id}/assets`, and `/assets`. Organizations own projects; projects own assets. Organization and project memberships include roles and active status.

## Local configuration

Set `DATABASE_URL`, `COGNITO_CLIENT_ID`, and either `COGNITO_ISSUER` or `COGNITO_REGION` plus `COGNITO_USER_POOL_ID` in `backend/.env`. Set `COGNITO_DOMAIN` for optional Cognito profile lookup and `CORS_ORIGINS` for the frontend origin. Configure frontend Cognito values and the API URL in `frontend/.env.local` using its example file.

Run the backend from `backend/` with `uv run uvicorn backend.backend:app --reload --host 127.0.0.1 --port 8000`. Run the frontend from `frontend/` with `npm run dev`. Apply database schema changes with Alembic after configuring the backend database URL.

## Offline tests and seed data

From the repository root, run:

```powershell
uv run --project tests pytest -c tests/pytest.ini tests
```

The suite uses in-memory SQLite, generated RSA keys, and mocked JWKS. It covers invalid token claims and signatures, company/project isolation, URL tampering, asset-list leakage, and membership revocation while reusing the same token. `tests/README.md` documents the fake ABC Builders and XYZ Construction seed and the local revocation demo command.
