## Team Task Manager

Full-stack web app with:
- Auth (Signup/Login) using JWT
- Projects & team management (Admin/Member)
- Task creation, assignment, status tracking
- Dashboard (status counts, my tasks, overdue)
- PostgreSQL database (Prisma)
- Single-service Railway deployment (Express serves React build)

### Tech
- **Backend**: Node.js + Express + TypeScript + Prisma + Zod
- **Frontend**: React + Vite
- **DB**: PostgreSQL

### Local setup
1) Install deps

```bash
npm install
```

2) Create `.env`

```bash
copy .env.example .env
```

Set `DATABASE_URL` to your Postgres connection string and set a long `JWT_SECRET`.

3) Migrate DB

```bash
npm run prisma:generate
npm run prisma:migrate
```

4) Seed production-like starter data (optional but recommended)

```bash
npm run seed
```

Creates:
- Admin user: `admin@ethara.app` / `AdminPass123`
- Member user: `member@ethara.app` / `MemberPass123`
- One project with member/admin roles and starter tasks

5) Run dev

```bash
npm run dev
```

- API: `http://localhost:3000/api/health`
- Web (dev): `http://localhost:5173`

### Railway deployment (mandatory)
1) Create a **PostgreSQL** database in Railway.
2) Create a **Node** service from this repo.
3) Set variables on the service:
   - `DATABASE_URL` (from Railway Postgres)
   - `JWT_SECRET` (long random string)
4) Deploy. The service uses:
   - **Build command**: `npm run build`
   - **Start command**: `npm start`

### RBAC rules (implemented)
- **Project creator**: Admin
- **Project Admin** can:
  - add/remove members
  - rename/update project details
  - create tasks
  - assign/reassign tasks to other users
  - edit/delete any task
- **Project Member** can:
  - view projects/tasks/dashboard
  - update status only for tasks assigned to them
  - cannot rename project or create/edit/delete task details

### Production readiness highlights
- Strong authentication validation (email normalization + password strength rules)
- Server-side and client-side form validation with clear error messages
- Strict RBAC enforcement on APIs (backend is source of truth)
- Secure JWT protected REST APIs
- Railway-ready single-service deployment with PostgreSQL support

### API (high level)
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/me`
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:projectId`
- `POST /api/projects/:projectId/members` (admin only)
- `DELETE /api/projects/:projectId/members/:memberUserId` (admin only)
- `GET /api/tasks?projectId=...`
- `POST /api/tasks`
- `PATCH /api/tasks/:taskId`
- `DELETE /api/tasks/:taskId`
- `GET /api/dashboard`

