# Cognito Workspace

A workspace dashboard with a Next.js frontend, a FastAPI API, PostgreSQL persistence, and Amazon Cognito authentication. Users see the organizations, projects, and assets their active memberships allow them to access.

## Requirements

- Python 3.11 or newer
- [uv](https://docs.astral.sh/uv/)
- [Bun](https://bun.sh/)
- PostgreSQL
- An Amazon Cognito user pool and app client

## Repository layout

- `frontend/app/`: sign-in page, dashboard pages, and Cognito session routes.
- `frontend/lib/api.ts`: retrieves access tokens and calls the API.
- `backend/src/backend/backend.py`: FastAPI app, user resolution, access checks, and API routes.
- `backend/src/backend/auth.py`: Cognito access-token validation.
- `backend/src/backend/models.py`: SQLAlchemy database models.
- `backend/src/backend/manage_access.py`: user and membership access management CLI.
- `backend/alembic/`: versioned database migrations.
- `backend/tests/`: API access tests.

## Configuration

Copy the example environment files:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env.local
```

Fill in the Cognito and database values in both files as applicable.

### Backend: `backend/.env`

- `DATABASE_URL`: PostgreSQL connection URL, for example `postgresql+psycopg://postgres:password@localhost:5432/cognito_auth`.
- `COGNITO_CLIENT_ID`: Cognito app client ID.
- `COGNITO_REGION` and `COGNITO_USER_POOL_ID`, or set `COGNITO_ISSUER` directly.
- `COGNITO_DOMAIN`: optional for API authentication; used to look up a signed-in user's profile.
- `CORS_ORIGINS`: frontend origin, usually `http://localhost:3000` for local development.

### Frontend: `frontend/.env.local`

- `APP_URL=http://localhost:3000`
- `NEXT_PUBLIC_API_URL=http://localhost:8000`
- `COGNITO_CLIENT_ID` and `COGNITO_DOMAIN`.
- `COGNITO_REGION` and `COGNITO_USER_POOL_ID`, or set `COGNITO_ISSUER` directly.
- `COGNITO_CLIENT_SECRET` only if the Cognito app client uses a client secret.
- `COGNITO_REFRESH_TOKEN_MAX_AGE_SECONDS` is optional; it defaults to 30 days.

In the Cognito app client, configure the callback URL as `http://localhost:3000/api/auth/callback` and the sign-out URL as `http://localhost:3000/`. Enable the authorization code flow and the `openid`, `email`, and `profile` scopes.

## Authentication flow

1. The frontend starts Cognito's authorization-code flow with PKCE through `/api/auth/login`.
2. `/api/auth/callback` exchanges the authorization code and stores tokens in secure, HTTP-only cookies.
3. The frontend requests an API access token from `/api/auth/token` and sends it to FastAPI as a Bearer token.
4. FastAPI validates the token and matches its Cognito `sub` claim to the local user's `sub_id`.
5. Active user, organization, and project records determine which dashboard data the API returns.

## Run locally

### 1. Install backend dependencies and migrate the database

From the repository root:

```powershell
cd backend
uv sync
uv run alembic upgrade head
```

The migration command uses `DATABASE_URL` from `backend/.env` or the process environment. See [Database migrations](#database-migrations) for the full workflow.

### 2. Start the API

In the `backend/` directory:

```powershell
uv run backend
```

This starts the API on `http://localhost:8000` with reload enabled. You can also use Uvicorn directly:

```powershell
uv run uvicorn backend.backend:app --reload --host 127.0.0.1 --port 8000
```

The interactive API documentation is at `http://localhost:8000/docs`.

### 3. Install and start the frontend

Open another terminal from the repository root:

```powershell
cd frontend
bun install
bun run dev
```

Open `http://localhost:3000`, sign in through Cognito, and go to the workspace dashboard.

## Docker Compose

Docker Compose starts PostgreSQL, applies Alembic migrations, and then starts the API and frontend. Create and configure `backend/.env` and `frontend/.env.local` as described above before starting the stack.

Build the images from the repository root:

```powershell
docker compose build
```

Build and start the full stack in one command:

```powershell
docker compose up --build
```

The app is available at `http://localhost:3000`, the API at `http://localhost:8000`, and PostgreSQL at `localhost:5432`. The database container uses `postgres` as its default username and password and `cognito_auth` as its default database for local development. Set `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` in an optional root `.env` file to change these defaults. Root `.env` files are ignored by Git. Compose overrides the backend's `DATABASE_URL` so containers connect to the `db` service.

`NEXT_PUBLIC_API_URL` is embedded in the frontend image at build time and defaults to `http://localhost:8000`. To use another browser-accessible API address, set `NEXT_PUBLIC_API_URL` in the root `.env` before building.

Useful commands from the repository root:

| Command | Purpose |
| --- | --- |
| `docker compose up` | Start the stack using existing images |
| `docker compose up --build` | Build images and start the stack |
| `docker compose down` | Stop and remove containers; the database volume remains |
| `docker compose logs -f api web` | Follow API and frontend logs |
| `docker compose run --rm migrate` | Apply migrations again on the configured database |
| `docker compose exec api uv run --no-sync manage-access --help` | Show access-management CLI help in the running API container |

The `migrate` service runs `alembic upgrade head` before the API starts.

## Frontend pages and commands

The frontend pages are:

| Path | Purpose |
| --- | --- |
| `/` | Sign-in page |
| `/dashboard` | Workspace overview |
| `/dashboard/organizations` | Organizations available to the user |
| `/dashboard/projects` | Projects available to the user |
| `/dashboard/assets` | Assets in accessible projects |

Run these commands from `frontend/`:

| Command | Purpose |
| --- | --- |
| `bun install` | Install frontend dependencies |
| `bun run dev` | Start the development server |
| `bun run build` | Build the production frontend |
| `bun run start` | Start the production server after building |
| `bun run lint` | Run ESLint |

The frontend also provides these authentication routes:

| Method and path | Purpose |
| --- | --- |
| `GET /api/auth/login` | Start Cognito sign-in |
| `GET /api/auth/login?screen=signup` | Open Cognito sign-up |
| `GET /api/auth/login?screen=forgotPassword` | Open Cognito password recovery |
| `GET /api/auth/callback` | Handle Cognito's sign-in callback |
| `GET /api/auth/logout` | Sign out through Cognito and clear session cookies |
| `GET /api/auth/me` | Return the current frontend session status |
| `POST /api/auth/token` | Validate or refresh the API access token; called by the frontend |

## Backend API

The API is served on port `8000`. The root health endpoint and generated documentation are public. Data endpoints require an `Authorization: Bearer <Cognito access token>` header.

| Method and path | Purpose |
| --- | --- |
| `GET /` | Health status |
| `GET /profile` | Current API user |
| `GET /dashboard` | User and accessible organizations, projects, and assets |
| `GET /organizations` | Accessible organizations |
| `GET /organizations/{organization_id}` | One accessible organization and its projects |
| `GET /projects` | Accessible projects |
| `GET /projects/{project_id}` | One accessible project and its assets |
| `GET /projects/{project_id}/assets` | Assets in one accessible project |
| `GET /assets` | Assets across accessible projects |

The API currently exposes read-only `GET` routes. CORS allows `GET` and `OPTIONS`; access changes are made through the management CLI below.

## Manage user and membership access

Run these commands from `backend/`. The script reads `DATABASE_URL` from `backend/.env` or the process environment and commits each change to that database.

```powershell
uv run python -m backend.manage_access --help
```

The installed command alias is also available:

```powershell
uv run manage-access --help
```

`--user` accepts a local user ID, Cognito subject, email address, or username. For organization and project commands, the corresponding ID is the database ID.

### Disable or restore a user

Disabling a user blocks all API access for that user:

```powershell
uv run python -m backend.manage_access user --user "alice@example.com" --inactive
uv run python -m backend.manage_access user --user "alice@example.com" --active
```

### Disable or restore organization membership

```powershell
uv run python -m backend.manage_access organization --user "alice@example.com" --organization-id 1 --inactive
uv run python -m backend.manage_access organization --user "alice@example.com" --organization-id 1 --active
```

The user must already have a membership in that organization.

### Disable or restore project membership

```powershell
uv run python -m backend.manage_access project --user "alice@example.com" --project-id 1 --inactive
uv run python -m backend.manage_access project --user "alice@example.com" --project-id 1 --active
```

Restoring access requires an existing project membership. Disabling access creates an inactive membership row if needed; this also blocks project access inherited through an organization-admin role.

Each command must include exactly one status flag: `--active` or `--inactive`.

## Database migrations

Run all migration commands from `backend/`. Alembic reads the database URL from `backend/.env` or the process environment, so configure `DATABASE_URL` before running migrations.

Apply all migrations up to the latest revision:

```powershell
uv run alembic upgrade head
```

Check the revision currently applied to the database or list available revisions:

```powershell
uv run alembic current
uv run alembic history
```

After changing SQLAlchemy models, generate a migration from the model changes:

```powershell
uv run alembic revision --autogenerate -m "describe the schema change"
```

Review and edit the generated file under `backend/alembic/versions/` before applying it with `uv run alembic upgrade head`. Autogenerate does not replace reviewing the migration, especially for data changes or renames.

To roll back the most recent revision:

```powershell
uv run alembic downgrade -1
```

Review a revision's `downgrade()` operation before rolling it back, since it may drop columns or data. The API also creates missing tables at startup; use Alembic to apply tracked schema revisions to an existing database.

## Run backend tests

Run from `backend/`:

```powershell
uv run --with httpx pytest tests -v
```

The access tests use an isolated temporary SQLite database and dummy Cognito settings. They do not use the configured application database or real Cognito credentials.

## Access rules

- An inactive user cannot use authenticated API routes.
- Organization access requires an active organization, an active organization membership, and the compatibility `is_active` membership flag.
- Project access requires an active project and organization, plus active organization and project memberships. Both `active` and `is_active` membership flags must be true.
- An organization admin can inherit project access unless that user has an explicitly inactive project membership.
