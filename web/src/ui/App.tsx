import React, { useEffect, useMemo, useState } from "react";
import { api, setToken, type Project, type ProjectRole, type Task, type TaskStatus } from "./api";
import "./styles.css";

type View = "auth" | "dashboard" | "projects" | "project";

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function validatePassword(password: string) {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter";
  if (!/[a-z]/.test(password)) return "Password must include a lowercase letter";
  if (!/[0-9]/.test(password)) return "Password must include a number";
  return null;
}

export function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; email: string; name: string } | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dashboard, setDashboard] = useState<{
    statusCounts: { TODO: number; IN_PROGRESS: number; DONE: number };
    overdueAssigned: Task[];
    myTasks: Task[];
  } | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? null,
    [projects, activeProjectId]
  );
  const activeMembershipRole = useMemo(() => {
    if (!activeProject || !user) return null;
    return activeProject.members?.find((m) => m.userId === user.id)?.role ?? null;
  }, [activeProject, user]);

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
    const bootstrap = async () => {
      setError(null);
      setLoading(true);
      try {
        const me = await api.me();
        if (!me.user) {
          setView("auth");
          return;
        }
        setUser(me.user);
        setView("dashboard");
        await refreshAll();
      } catch {
        setView("auth");
      } finally {
        setLoading(false);
      }
    };
    void bootstrap();
  }, []);

  const onAuth = async (accessToken: string, u: { id: string; email: string; name: string }) => {
    setToken(accessToken);
    setUser(u);
    setView("dashboard");
    await refreshAll();
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setProjects([]);
    setTasks([]);
    setDashboard(null);
    setActiveProjectId(null);
    setView("auth");
  };

  if (loading) return <div className="container"><div className="card">Loading workspace...</div></div>;

  return (
    <>
      <div className="fxBlob" />
      <div className="fxBlob2" />
      <div className="container">
        <div className="nav">
          <div className="navLeft">
            <strong>Ethara Team Task Manager</strong>
            {user ? <span className="pill">{user.name}</span> : <span className="pill">Secure Access</span>}
          </div>
          {user && (
            <div className="navRight">
              <button className="btn btnGhost" onClick={() => setView("dashboard")}>Dashboard</button>
              <button className="btn btnGhost" onClick={async () => { setView("projects"); await refreshAll(); }}>Projects</button>
              <button className="btn btnDanger" onClick={logout}>Logout</button>
            </div>
          )}
        </div>

        <div style={{ height: 16 }} />
        {error && <div className="error" style={{ marginBottom: 16 }}>{error}</div>}

        {view === "auth" && <AuthCard onAuth={onAuth} setError={setError} />}
        {user && view === "dashboard" && dashboard && <DashboardCard dashboard={dashboard} onRefresh={refreshAll} />}

        {user && view === "projects" && (
          <div className="split">
            <ProjectsCard
              projects={projects}
              activeProjectId={activeProjectId}
              onSelect={async (id) => { setActiveProjectId(id); setView("project"); await refreshTasks(id); }}
              onCreated={refreshAll}
              setError={setError}
            />
            <div className="card"><div className="muted">Select a project to open full task and member controls.</div></div>
          </div>
        )}

        {user && view === "project" && activeProjectId && (
          <div className="split">
            <ProjectsCard
              projects={projects}
              activeProjectId={activeProjectId}
              onSelect={async (id) => { setActiveProjectId(id); await refreshTasks(id); }}
              onCreated={refreshAll}
              setError={setError}
            />
            <ProjectDetailCard
              user={user}
              role={activeMembershipRole}
              project={activeProject}
              tasks={tasks}
              onRefreshTasks={() => refreshTasks(activeProjectId)}
              onRefreshAll={refreshAll}
              setError={setError}
            />
          </div>
        )}
      </div>
    </>
  );
}

function AuthCard({ onAuth, setError }: {
  onAuth: (token: string, user: { id: string; email: string; name: string }) => Promise<void>;
  setError: (s: string | null) => void;
}) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setValidationError(null);
    const cleanedEmail = email.trim().toLowerCase();
    if (!isEmail(cleanedEmail)) return setValidationError("Please enter a valid email address.");
    if (mode === "signup" && name.trim().length < 2) return setValidationError("Name must be at least 2 characters.");
    const passErr = mode === "signup" ? validatePassword(password) : null;
    if (passErr) return setValidationError(passErr);

    setBusy(true);
    try {
      const data = mode === "login"
        ? await api.login({ email: cleanedEmail, password })
        : await api.signup({ email: cleanedEmail, name: name.trim(), password });
      await onAuth(data.accessToken, data.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 560, margin: "0 auto" }}>
      <div className="cardHeader">
        <h2 className="title">{mode === "login" ? "Welcome back" : "Create your workspace account"}</h2>
        <button className="btn btnGhost" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "Need an account?" : "Already have an account?"}
        </button>
      </div>

      <div className="demoProfiles">
        <div className="profileCard"><strong>Admin</strong><div className="muted">Can manage members, projects and all tasks.</div></div>
        <div className="profileCard"><strong>Member</strong><div className="muted">Can work on assigned tasks with controlled access.</div></div>
      </div>

      <label className="label">Work Email</label>
      <input className="input" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      {mode === "signup" && (
        <>
          <label className="label">Full Name</label>
          <input className="input" placeholder="e.g. Rohan Sharma" value={name} onChange={(e) => setName(e.target.value)} />
        </>
      )}
      <label className="label">Password</label>
      <input className="input" type="password" placeholder="Minimum 8 chars, uppercase, lowercase, number" value={password} onChange={(e) => setPassword(e.target.value)} />
      {validationError && <div className="error" style={{ marginTop: 10 }}>{validationError}</div>}
      <div style={{ height: 12 }} />
      <button className="btn btnPrimary" disabled={busy} onClick={submit}>
        {busy ? "Please wait..." : mode === "login" ? "Login Securely" : "Create Account"}
      </button>
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
        <div className="grid3">
          <div className="card" style={{ flex: 1, minWidth: 180 }}>
            <div className="muted">TODO</div>
            <div className="kpi">{dashboard.statusCounts.TODO}</div>
          </div>
          <div className="card" style={{ flex: 1, minWidth: 180 }}>
            <div className="muted">IN PROGRESS</div>
            <div className="kpi">{dashboard.statusCounts.IN_PROGRESS}</div>
          </div>
          <div className="card" style={{ flex: 1, minWidth: 180 }}>
            <div className="muted">DONE</div>
            <div className="kpi">{dashboard.statusCounts.DONE}</div>
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
  const [localError, setLocalError] = useState<string | null>(null);

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
        <input className="input" placeholder="Product Revamp Q3" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="label">Description</label>
        <input
          className="input"
          placeholder="Describe project scope, goals and deliverables"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        {localError && <div className="error" style={{ marginTop: 10 }}>{localError}</div>}
        <div style={{ height: 10 }} />
        <button
          className="btn btnPrimary"
          disabled={busy}
          onClick={async () => {
            setLocalError(null);
            if (name.trim().length < 2) {
              setLocalError("Project name must be at least 2 characters.");
              return;
            }
            setBusy(true);
            setError(null);
            try {
              await api.createProject({ name: name.trim(), description: description.trim() || undefined });
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
  user,
  role,
  project,
  tasks,
  onRefreshTasks,
  onRefreshAll,
  setError
}: {
  user: { id: string; email: string; name: string };
  role: "ADMIN" | "MEMBER" | null;
  project: Project | null;
  tasks: Task[];
  onRefreshTasks: () => Promise<void>;
  onRefreshAll: () => Promise<void>;
  setError: (s: string | null) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [projectName, setProjectName] = useState(project?.name ?? "");
  const [projectDesc, setProjectDesc] = useState(project?.description ?? "");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "ALL">("ALL");
  const [assignedToId, setAssignedToId] = useState<string>("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<ProjectRole>("MEMBER");
  const [localError, setLocalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setProjectName(project?.name ?? "");
    setProjectDesc(project?.description ?? "");
  }, [project?.id, project?.name, project?.description]);

  if (!project) {
    return (
      <div className="card">
        <div className="muted">Project not found.</div>
      </div>
    );
  }

  const filtered = tasks.filter((t) => (statusFilter === "ALL" ? true : t.status === statusFilter));

  const isAdmin = role === "ADMIN";
  const members = project.members ?? [];

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
          {!isAdmin && (
            <div className="muted" style={{ marginBottom: 8 }}>
              Member mode: only admins can create/edit/delete tasks.
            </div>
          )}
          <label className="label">Title</label>
          <input className="input" disabled={!isAdmin} placeholder="Write API contracts for payment module" value={title} onChange={(e) => setTitle(e.target.value)} />
          <label className="label">Description</label>
          <textarea
            className="textarea"
            disabled={!isAdmin}
            placeholder="Acceptance criteria, context and implementation notes"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <label className="label">Assign to</label>
          <select className="select" disabled={!isAdmin} value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)}>
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.user.email} value={m.user.id ?? ""}>{m.user.name} ({m.role})</option>
            ))}
          </select>
          <label className="label">Due date (optional)</label>
          <input className="input" type="date" disabled={!isAdmin} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <div style={{ height: 10 }} />
          {localError && <div className="error" style={{ marginTop: 10 }}>{localError}</div>}
          <button
            className="btn btnPrimary"
            disabled={busy || !isAdmin}
            onClick={async () => {
              setLocalError(null);
              if (title.trim().length < 3) {
                setLocalError("Task title must be at least 3 characters.");
                return;
              }
              setError(null);
              setBusy(true);
              try {
                await api.createTask({
                  projectId: project.id,
                  title: title.trim(),
                  description: description.trim() || undefined,
                  assignedToId: assignedToId || undefined,
                  dueDate: dueDate ? new Date(dueDate).toISOString() : undefined
                });
                setTitle("");
                setDescription("");
                setDueDate("");
                setAssignedToId("");
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
        </div>

        <div className="card">
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Project controls</div>
          <div className="muted" style={{ marginBottom: 8 }}>
            {isAdmin ? "Admin mode: you can rename the project." : "Member mode: project settings are read-only."}
          </div>
          <label className="label">Project name</label>
          <input className="input" disabled={!isAdmin} placeholder="Project name" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
          <label className="label">Description</label>
          <textarea className="textarea" disabled={!isAdmin} placeholder="Project description" value={projectDesc ?? ""} onChange={(e) => setProjectDesc(e.target.value)} />
          <div style={{ height: 10 }} />
          <button
            className="btn"
            disabled={!isAdmin}
            onClick={async () => {
              setError(null);
              if (projectName.trim().length < 2) {
                setError("Project name must be at least 2 characters.");
                return;
              }
              try {
                await api.patchProject(project.id, { name: projectName.trim(), description: projectDesc.trim() || null });
                await onRefreshAll();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Project update failed");
              }
            }}
          >
            Save project settings
          </button>

          {isAdmin && (
            <>
              <hr style={{ borderColor: "rgba(255,255,255,0.16)", margin: "14px 0" }} />
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Team member access</div>
              <label className="label">Member email</label>
              <input className="input" placeholder="member@company.com" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} />
              <label className="label">Role</label>
              <select className="select" value={memberRole} onChange={(e) => setMemberRole(e.target.value as ProjectRole)}>
                <option value="MEMBER">MEMBER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
              <div style={{ height: 10 }} />
              <button
                className="btn btnPrimary"
                onClick={async () => {
                  setError(null);
                  if (!isEmail(memberEmail)) {
                    setError("Please enter a valid member email.");
                    return;
                  }
                  try {
                    await api.addMember(project.id, { email: memberEmail.trim().toLowerCase(), role: memberRole });
                    setMemberEmail("");
                    setMemberRole("MEMBER");
                    await onRefreshAll();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Failed to add member");
                  }
                }}
              >
                Add member
              </button>
            </>
          )}
        </div>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Filter tasks</div>
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

      <div style={{ height: 14 }} />
      {filtered.length === 0 ? (
        <div className="muted">No tasks to show.</div>
      ) : (
        filtered.map((t) => (
          <TaskEditorRow
            key={t.id}
            canAdminEdit={isAdmin}
            canMemberUpdateStatus={t.assignedTo?.id === user.id}
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
  canAdminEdit,
  canMemberUpdateStatus,
  task,
  onUpdated,
  onDeleted,
  setError
}: {
  canAdminEdit: boolean;
  canMemberUpdateStatus: boolean;
  task: Task;
  onUpdated: () => Promise<void>;
  onDeleted: () => Promise<void>;
  setError: (s: string | null) => void;
}) {
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [busy, setBusy] = useState(false);

  return (
    <div className="card" style={{ padding: 12, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div style={{ minWidth: 0, width: "100%" }}>
          <input
            className="input"
            disabled={!canAdminEdit}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            style={{ marginBottom: 8 }}
          />
          <textarea
            className="textarea"
            disabled={!canAdminEdit}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Task description"
            style={{ minHeight: 64 }}
          />
          <div className="muted" style={{ fontSize: 12 }}>
            {task.assignedTo?.name ? `Assigned: ${task.assignedTo.name} • ` : ""}
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
            disabled={busy || (!canAdminEdit && !canMemberUpdateStatus)}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                if (canAdminEdit && title.trim().length < 3) {
                  setError("Task title must be at least 3 characters.");
                  return;
                }
                await api.patchTask(task.id, {
                  status,
                  ...(canAdminEdit ? { title: title.trim(), description: description.trim() || undefined } : {})
                });
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
            disabled={busy || !canAdminEdit}
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

