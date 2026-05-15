## Team Task Manager

Full-stack web app with:
- Auth (Gmail-based signup/verification + Login) using JWT
- Projects & team management (Founder + Admin/Member RBAC)
- Task creation, assignment, status tracking
- Dashboard (status counts, my tasks, overdue)
- PostgreSQL database (Prisma)
- Single-service Railway deployment (Express serves React build)

### Live Deployment
**Production URL**: https://app-production-2902.up.railway.app

**Demo Credentials:**
- Admin: `admin@ethara.app` / `AdminPass2026!`
- Member: `member@ethara.app` / `MemberPass2026!`

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
- Admin user: `admin@ethara.app` / `AdminPass2026!`
- Member user: `member@ethara.app` / `MemberPass2026!`
- One project with member/admin roles and starter tasks

If you want to start with a clean database and rebuild seed data from scratch:

```bash
npm run seed:reset
```

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
   - `FOUNDER_EMAIL` (default: `admin@ethara.app`) - Email that controls first project creation
   - `SMTP_HOST` (default: `smtp.gmail.com`) - Email provider
   - `SMTP_PORT` (default: `587`)
   - `SMTP_USER` (Gmail address for sending verification codes)
   - `SMTP_PASS` (Gmail app password)
   - `SMTP_FROM` (default: `noreply@ethara.app`)
   - `EMAIL_VERIFICATION_TTL_MINUTES` (default: `10`)
4) Deploy. The service uses:
   - **Build command**: `npm run build`
   - **Start command**: `npm start`

### Authentication & Authorization

**Signup Flow (Gmail-only)**
1. User enters email (must be @gmail.com or @googlemail.com)
2. System sends 6-digit verification code via email (or logs to console if SMTP not configured)
3. User enters code + name to complete signup
4. Account created with default MEMBER role

**Founder Gating**
- Only the founder email (env: `FOUNDER_EMAIL`) can create the **first project**
- After the first project exists, only project **ADMINs** can create new projects

**RBAC Rules**
- **Project creator**: Admin
- **Signup flow**: creating an account registers a workspace user. Role-specific access is granted later when an admin adds the user to a project.
- **Project Admin** can:
  - add/remove members from projects
  - rename/update project details
  - create tasks and assign/reassign them to members
  - edit/delete any task
- **Project Member** can:
  - view projects/tasks/dashboard
  - update status only for tasks assigned to them
  - cannot rename project or create/edit/delete task details
- **Founder (admin@ethara.app)** can:
  - manage all projects and members
  - create the first project (others require ADMIN role)

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

