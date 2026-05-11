import React, { useEffect, useMemo, useState } from "react";
import { api, setToken, type Project, type Task, type TaskStatus } from "./api";
import "./styles.css";

type View = "auth" | "dashboard" | "projects" | "project";

export function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; email: string; name: string } | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [error, setError] = useState<string | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? null,
    [projects, activeProjectId]
  );

  const [tasks, setTasks] = useState<Task[]>([]);
  const [dashboard, setDashboard] = useState<{
    statusCounts: { TODO: number; IN_PROGRESS: number; DONE: number };
    overdueAssigned: Task[];
    myTasks: Task[];
  } | null>(null);

  async function bootstrap() {
    setError(null);
    setLoading(true);
    try {
      const me = await api.me();
      if (!me.user) {
        setUser(null);
        setView("auth");
        return;
      }
      setUser(me.user);
      setView("dashboard");
      await refreshAll();
    } catch (e) {
      setUser(null);
      setView("auth");
    } finally {
      setLoading(false);
    }
  }

  async function refreshAll() {
    const [p, d] = await Promise.all([api.listProjects(), api.dashboard()]);
    setProjects(p.projects);
    setDashboard(d);
  }

  async function refreshTasks(projectId?: string) {
    const data = await api.listTasks(projectId);
    setTasks(data.tasks);
  }

  useEffect(() => {
    void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onAuth(accessToken: string, u: { id: string; email: string; name: string }) {
    setToken(accessToken);
    setUser(u);
    setView("dashboard");
    await refreshAll();
  }

  function logout() {
    setToken(null);
    setUser(null);
    setProjects([]);
    setTasks([]);
    setDashboard(null);
    setActiveProjectId(null);
    setView("auth");
  }

  if (loading) {
    return (
      <div className="container">
        <div className="card">Loading…</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="nav">
        <div className="navLeft">
          <strong>Team Task Manager</strong>
          {user ? <span className="pill">{user.name}</span> : <span className="pill">Guest</span>}
        </div>
        <div className="navRight">
          {user && (
            <>
              <button className="btn" onClick={() => setView("dashboard")}>
                Dashboard
              </button>
              <button
                className="btn"
                onClick={async () => {
                  setView("projects");
                  await refreshAll();
                }}
              >
                Projects
              </button>
              <button className="btn btnDanger" onClick={logout}>
                Logout
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ height: 16 }} />

      {error && (
        <div className="error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {view === "auth" && <AuthCard onAuth={onAuth} setError={setError} />}

      {user && view === "dashboard" && dashboard && (
        <DashboardCard dashboard={dashboard} onRefresh={refreshAll} />
      )}

      {user && view === "projects" && (
        <div className="split">
          <ProjectsCard
            projects={projects}
            activeProjectId={activeProjectId}
            onSelect={async (id) => {
              setActiveProjectId(id);
              setView("project");
              await refreshTasks(id);
            }}
            onCreated={async () => {
              await refreshAll();
            }}
            setError={setError}
          />
          <div className="card">
            <div className="muted">Select a project to manage tasks.</div>
          </div>
        </div>
      )}

      {user && view === "project" && activeProjectId && (
        <div className="split">
          <ProjectsCard
            projects={projects}
            activeProjectId={activeProjectId}
            onSelect={async (id) => {
              setActiveProjectId(id);
              await refreshTasks(id);
            }}
            onCreated={async () => refreshAll()}
            setError={setError}
          />
          <ProjectDetailCard
            project={activeProject}
            tasks={tasks}
            onRefreshTasks={() => refreshTasks(activeProjectId)}
            onRefreshAll={refreshAll}
            setError={setError}
          />
        </div>
      )}
    </div>
  );
}

function AuthCard({
  onAuth,
  setError
}: {
  onAuth: (token: string, user: { id: string; email: string; name: string }) => Promise<void>;
  setError: (s: string | null) => void;
}) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="card" style={{ maxWidth: 520, margin: "0 auto" }}>
      <div className="cardHeader">
        <h2 className="title">{mode === "login" ? "Login" : "Create account"}</h2>
        <button className="btn" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
          Switch to {mode === "login" ? "Signup" : "Login"}
        </button>
      </div>

      <label className="label">Email</label>
      <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />

      {mode === "signup" && (
        <>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </>
      )}

      <label className="label">Password</label>
      <input
        className="input"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <div style={{ height: 12 }} />
      <button
        className="btn btnPrimary"
        disabled={busy}
        onClick={async () => {
          setError(null);
          setBusy(true);
          try {
            const data =
              mode === "login"
                ? await api.login({ email, password })
                : await api.signup({ email, name, password });
            await onAuth(data.accessToken, data.user);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Auth failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Please wait…" : mode === "login" ? "Login" : "Signup"}
      </button>

      <div style={{ height: 10 }} />
      <div className="muted">
        Tip: Create two accounts to test roles. The project creator becomes <b>Admin</b>.
      </div>
    </div>
  );
}

function DashboardCard({
  dashboard,
  onRefresh
}: {
  dashboard: {
    statusCounts: { TODO: number; IN_PROGRESS: number; DONE: number };
    overdueAssigned: Task[];
    myTasks: Task[];
  };
  onRefresh: () => Promise<void>;
}) {
  return (
    <div className="grid2">
      <div className="card">
        <div className="cardHeader">
          <h2 className="title">Status overview</h2>
          <button className="btn" onClick={onRefresh}>
            Refresh
          </button>
        </div>
        <div className="row">
          <div className="card" style={{ flex: 1, minWidth: 180 }}>
            <div className="muted">TODO</div>
            <div style={{ fontSize: 28, fontWeight: 900 }}>{dashboard.statusCounts.TODO}</div>
          </div>
          <div className="card" style={{ flex: 1, minWidth: 180 }}>
            <div className="muted">IN PROGRESS</div>
            <div style={{ fontSize: 28, fontWeight: 900 }}>{dashboard.statusCounts.IN_PROGRESS}</div>
          </div>
          <div className="card" style={{ flex: 1, minWidth: 180 }}>
            <div className="muted">DONE</div>
            <div style={{ fontSize: 28, fontWeight: 900 }}>{dashboard.statusCounts.DONE}</div>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="cardHeader">
          <h2 className="title">Overdue (assigned to me)</h2>
        </div>
        {dashboard.overdueAssigned.length === 0 ? (
          <div className="muted">No overdue tasks. Nice.</div>
        ) : (
          dashboard.overdueAssigned.map((t) => <TaskRow key={t.id} task={t} />)
        )}
      </div>

      <div className="card" style={{ gridColumn: "1 / -1" }}>
        <div className="cardHeader">
          <h2 className="title">My tasks</h2>
        </div>
        {dashboard.myTasks.length === 0 ? (
          <div className="muted">No assigned tasks yet.</div>
        ) : (
          dashboard.myTasks.map((t) => <TaskRow key={t.id} task={t} />)
        )}
      </div>
    </div>
  );
}

function ProjectsCard({
  projects,
  activeProjectId,
  onSelect,
  onCreated,
  setError
}: {
  projects: Project[];
  activeProjectId: string | null;
  onSelect: (id: string) => void | Promise<void>;
  onCreated: () => Promise<void>;
  setError: (s: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="card">
      <div className="cardHeader">
        <h2 className="title">Projects</h2>
      </div>

      <div className="muted" style={{ marginBottom: 10 }}>
        Your projects (member or admin).
      </div>

      {projects.length === 0 && <div className="muted">No projects yet.</div>}
      {projects.map((p) => (
        <button
          key={p.id}
          className="btn"
          style={{
            width: "100%",
            textAlign: "left",
            marginBottom: 10,
            borderColor: p.id === activeProjectId ? "rgba(110,168,254,0.6)" : undefined
          }}
          onClick={() => onSelect(p.id)}
        >
          <div style={{ fontWeight: 900 }}>{p.name}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {p.description || "No description"}
          </div>
        </button>
      ))}

      <div style={{ height: 14 }} />
      <div className="card" style={{ padding: 14 }}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>Create new project</div>
        <label className="label">Name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="label">Description</label>
        <input
          className="input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div style={{ height: 10 }} />
        <button
          className="btn btnPrimary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await api.createProject({ name, description: description || undefined });
              setName("");
              setDescription("");
              await onCreated();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Failed to create project");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Creating…" : "Create project"}
        </button>
      </div>
    </div>
  );
}

function ProjectDetailCard({
  project,
  tasks,
  onRefreshTasks,
  onRefreshAll,
  setError
}: {
  project: Project | null;
  tasks: Task[];
  onRefreshTasks: () => Promise<void>;
  onRefreshAll: () => Promise<void>;
  setError: (s: string | null) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "ALL">("ALL");
  const [busy, setBusy] = useState(false);

  if (!project) {
    return (
      <div className="card">
        <div className="muted">Project not found.</div>
      </div>
    );
  }

  const filtered = tasks.filter((t) => (statusFilter === "ALL" ? true : t.status === statusFilter));

  return (
    <div className="card">
      <div className="cardHeader">
        <div>
          <h2 className="title">{project.name}</h2>
          <div className="muted">{project.description || "No description"}</div>
        </div>
        <button
          className="btn"
          onClick={async () => {
            await onRefreshAll();
            await onRefreshTasks();
          }}
        >
          Refresh
        </button>
      </div>

      <div className="grid2">
        <div className="card">
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Create task</div>
          <label className="label">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          <label className="label">Description</label>
          <textarea
            className="textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <label className="label">Due date (optional)</label>
          <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <div style={{ height: 10 }} />
          <button
            className="btn btnPrimary"
            disabled={busy}
            onClick={async () => {
              setError(null);
              setBusy(true);
              try {
                await api.createTask({
                  projectId: project.id,
                  title,
                  description: description || undefined,
                  dueDate: dueDate ? new Date(dueDate).toISOString() : undefined
                });
                setTitle("");
                setDescription("");
                setDueDate("");
                await onRefreshTasks();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Failed to create task");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Creating…" : "Create task"}
          </button>
          <div style={{ height: 10 }} />
          <div className="muted" style={{ fontSize: 12 }}>
            Assignment UI is kept minimal here; admins can reassign via task edit endpoint.
          </div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Filter</div>
          <label className="label">Status</label>
          <select
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="ALL">All</option>
            <option value="TODO">TODO</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="DONE">DONE</option>
          </select>
          <div style={{ height: 10 }} />
          <div className="muted">Showing {filtered.length} tasks</div>
        </div>
      </div>

      <div style={{ height: 14 }} />
      {filtered.length === 0 ? (
        <div className="muted">No tasks to show.</div>
      ) : (
        filtered.map((t) => (
          <TaskEditorRow
            key={t.id}
            task={t}
            onUpdated={onRefreshTasks}
            onDeleted={onRefreshTasks}
            setError={setError}
          />
        ))
      )}
    </div>
  );
}

function TaskRow({ task }: { task: Task }) {
  const due = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : null;
  return (
    <div className="card" style={{ padding: 12, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 900 }}>{task.title}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {task.project?.name ? `Project: ${task.project.name}` : ""}
            {due ? ` • Due: ${due}` : ""}
          </div>
        </div>
        <div className={`status status${task.status}`}>{task.status}</div>
      </div>
    </div>
  );
}

function TaskEditorRow({
  task,
  onUpdated,
  onDeleted,
  setError
}: {
  task: Task;
  onUpdated: () => Promise<void>;
  onDeleted: () => Promise<void>;
  setError: (s: string | null) => void;
}) {
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [busy, setBusy] = useState(false);

  return (
    <div className="card" style={{ padding: 12, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis" }}>{task.title}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {task.dueDate ? `Due: ${new Date(task.dueDate).toLocaleDateString()}` : "No due date"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
            <option value="TODO">TODO</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="DONE">DONE</option>
          </select>
          <button
            className="btn btnPrimary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await api.patchTask(task.id, { status });
                await onUpdated();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Update failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            Save
          </button>
          <button
            className="btn btnDanger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await api.deleteTask(task.id);
                await onDeleted();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Delete failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

