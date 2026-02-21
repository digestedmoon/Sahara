# ElderCare AI Foundation – Antigravity Rules (v1)

## 0) Scope Lock (Non-Negotiable)
- This repository builds the BACKEND + FRONTEND + DATABASE foundation only.
- STRICTLY FORBIDDEN for now:
  - Any AI integration (LLMs, embeddings, vector DBs)
  - Speech processing (STT/TTS)
  - Computer vision / image understanding
  - Calls to OpenAI or other AI providers
- Allowed: standard CRUD, authentication, file upload, logging, analytics counts, optional Socket.IO foundation.

## 1) Tech Stack (Fixed)
### Backend
- Flask app-factory pattern
- PostgreSQL
- SQLAlchemy ORM + Flask-Migrate (Alembic)
- JWT auth (Flask-JWT-Extended)
- Local file uploads (instance/uploads), S3 later
- CORS configured from env
- Production entrypoint via gunicorn (wsgi.py)

### Frontend
- React (Vite)
- React Router for routing
- Axios client with interceptors for JWT
- Role-based routing (caretaker vs elder)
- Simple UI mode for elder

## 2) Architecture Boundaries (Clean, Not Overengineered)
- Routes/Controllers: HTTP boundary only (parse, validate, call service, return response)
- Services: business logic & orchestration
- Repositories: DB queries (thin layer; do not over-abstract)
- Models: SQLAlchemy models only
- No business logic inside routes.
- No direct DB calls inside routes (go through service/repo).

## 3) Security Rules (Required)
- All non-auth endpoints require JWT.
- Every caretaker-scoped request MUST enforce ownership:
  - caretaker can access only elders where elder_profiles.caretaker_id == caretaker user_id
- Elders can only access "me" endpoints or resources belonging to their elder profile.
- Never log passwords, JWTs, or sensitive PHI.
- Validate uploads:
  - allowlist extensions
  - enforce max upload size
  - store outside source tree in instance/uploads
  - generate random filenames
  - never trust user filenames/paths

## 4) API Rules (Consistency)
- Version all endpoints under /api/v1
- Use consistent response shapes and error codes:
  - 200/201 for success
  - 400 for validation errors
  - 401 for auth required/invalid token
  - 403 for forbidden/role mismatch/ownership fail
  - 404 for missing resources
  - 500 only for unexpected errors
- Add global error handler returning JSON.

## 5) Artifact-First Workflow (Practical)
For any non-trivial work, produce artifacts before/alongside code:
- Plan: artifacts/plan_<topic>.md (short, actionable)
- Tests: save outputs to artifacts/logs/<topic>_pytest.txt
- Decisions: artifacts/decisions/<topic>.md (only if needed)

Do NOT block implementation waiting for user confirmation. Instead:
- Write the plan (brief)
- Proceed with code + tests
- Summarize what changed and where artifacts are located

## 6) Coding Standards (Reasonable)
### Python
- Type hints for public functions and service/repo layers.
- Docstrings for services and complex functions (keep them short).
- Prefer small, readable modules.

### Frontend
- Prefer TypeScript
- Keep feature modules under src/features/<domain>/
- Keep shared components under src/components/

## 7) Testing Rules (Minimum Bar)
Backend:
- Add pytest tests for each module:
  - auth/role checks
  - ownership boundary
  - happy path CRUD
Frontend:
- At minimum, manual verification checklist per feature.
- Automated tests optional later.

## 8) Build Order (Do in This Sequence)
1) Backend app factory + config + migrations + error handler + logging
2) Auth (JWT) + role decorators
3) Elder profile CRUD (ownership enforced)
4) Medications CRUD + elder mark taken -> trust log
5) Schedules CRUD
6) Snapshots upload + list + serve
7) Alerts (elder emergency + caretaker resolve)
8) Basic analytics counts

## 9) Terminal Safety
- Do not run destructive commands (rm -rf).
- Run pytest after logic changes.