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

4) Run dev

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
  - assign/reassign tasks to other users
  - edit/delete any task
- **Project Member** can:
  - view projects/tasks
  - create tasks
  - update task status
  - edit/delete only tasks they created

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

