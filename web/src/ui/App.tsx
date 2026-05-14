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
  const [dashboardFilterStatus, setDashboardFilterStatus] = useState<"ALL" | TaskStatus>("ALL");

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? null,
    [projects, activeProjectId]
  );
  
  const activeMembershipRole = useMemo(() => {
    if (!activeProject || !user) return null;
    return activeProject.members?.find((m) => m.userId === user.id)?.role ?? null;
  }, [activeProject, user]);

  // Check if user is admin in any project
  const isAdminInAny = useMemo(() => {
    return projects.some((p) => p.members?.some((m) => m.userId === user?.id && m.role === "ADMIN"));
  }, [projects, user?.id]);

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
        {user && view === "dashboard" && dashboard && (
          <DashboardCard
            user={user}
            projects={projects}
            dashboard={dashboard}
            onRefresh={refreshAll}
            onOpenProject={async (id) => {
              setActiveProjectId(id);
              setView("project");
              await refreshTasks(id);
            }}
          />
        )}

        {user && view === "projects" && (
          <div className="split">
            <ProjectsCard
              user={user}
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
              user={user}
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
  const [mode, setMode] = useState<"login" | "signup" | "verify">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setValidationError(null);
    const cleanedEmail = email.trim().toLowerCase();
    
    if (mode === "login") {
      if (!isEmail(cleanedEmail)) return setValidationError("Please enter a valid email address.");
      const passErr = validatePassword(password);
      if (passErr) return setValidationError(passErr);

      setBusy(true);
      try {
        const data = await api.login({ email: cleanedEmail, password });
        await onAuth(data.accessToken, data.user);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Login failed");
      } finally {
        setBusy(false);
      }
    } else if (mode === "signup") {
      if (!isEmail(cleanedEmail)) return setValidationError("Please enter a valid email address.");
      if (!cleanedEmail.endsWith("@gmail.com") && !cleanedEmail.endsWith("@googlemail.com")) {
        return setValidationError("Please use a Gmail address to sign up.");
      }
      if (name.trim().length < 2) return setValidationError("Name must be at least 2 characters.");

      setBusy(true);
      try {
        await api.requestCode({ email: cleanedEmail });
        setValidationError(null);
        setMode("verify");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to send verification code");
      } finally {
        setBusy(false);
      }
    } else if (mode === "verify") {
      if (code.trim().length !== 6) return setValidationError("Enter the 6-digit code.");

      setBusy(true);
      try {
        const data = await api.verifyCode({ email: cleanedEmail, code: code.trim(), name: name.trim() });
        await onAuth(data.accessToken, data.user);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Verification failed");
      } finally {
        setBusy(false);
      }
    }
  };

  return (
    <div className="card" style={{ maxWidth: 560, margin: "0 auto" }}>
      <div className="cardHeader">
        <h2 className="title">
          {mode === "login" ? "Welcome back" : mode === "signup" ? "Create your workspace account" : "Verify your email"}
        </h2>
        {mode !== "verify" && (
          <button className="btn btnGhost" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setValidationError(null); setCode(""); }}>
            {mode === "login" ? "Need an account?" : "Already have an account?"}
          </button>
        )}
      </div>

      {mode !== "verify" && (
        <div className="demoProfiles">
          <div className="profileCard"><strong>Admin</strong><div className="muted">Can manage members, projects and all tasks.</div></div>
          <div className="profileCard"><strong>Member</strong><div className="muted">Can work on assigned tasks with controlled access.</div></div>
        </div>
      )}
      {mode !== "verify" && (
        <div className="muted" style={{ marginBottom: 20, fontSize: 13 }}>
          {mode === "login" ? "Use your existing credentials to log in." : "Sign up with your Gmail account. Project admins invite members and control who can create and manage projects."}
        </div>
      )}
      {mode === "verify" && (
        <div className="muted" style={{ marginBottom: 20, fontSize: 13 }}>
          We sent a 6-digit code to <strong>{email}</strong>. Enter it below to verify.
        </div>
      )}

      {mode !== "verify" && (
        <>
          <label className="label">Work Email</label>
          <input className="input" placeholder="name@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          {mode === "signup" && (
            <>
              <label className="label">Full Name</label>
              <input className="input" placeholder="e.g. Rohan Sharma" value={name} onChange={(e) => setName(e.target.value)} />
            </>
          )}
          <label className="label">Password</label>
          <input className="input" type="password" placeholder="Minimum 8 chars, uppercase, lowercase, number" value={password} onChange={(e) => setPassword(e.target.value)} />
        </>
      )}

      {mode === "verify" && (
        <>
          <label className="label">Verification Code</label>
          <input className="input" placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} />
        </>
      )}

      {validationError && <div className="error" style={{ marginTop: 10 }}>{validationError}</div>}
      <div style={{ height: 12 }} />
      <button className="btn btnPrimary" disabled={busy} onClick={submit}>
        {busy ? "Please wait..." : mode === "login" ? "Login Securely" : mode === "signup" ? "Send Code" : "Verify & Create Account"}
      </button>
    </div>
  );
}

function DashboardCard({
  user,
  projects,
  dashboard,
  onRefresh,
  onOpenProject
}: {
  user: { id: string; email: string; name: string };
  projects: Project[];
  dashboard: {
    statusCounts: { TODO: number; IN_PROGRESS: number; DONE: number };
    overdueAssigned: Task[];
    myTasks: Task[];
  };
  onRefresh: () => Promise<void>;
  onOpenProject: (projectId: string) => Promise<void>;
}) {
  return (
    <>
      <div className="grid3" style={{ marginBottom: 24 }}>
        <div className="card" style={{ cursor: "default" }}>
          <div className="muted" style={{ fontSize: 13, fontWeight: 600 }}>📝 TODO</div>
          <div className="kpi" style={{ marginTop: 12 }}>{dashboard.statusCounts.TODO}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Tasks waiting to start</div>
        </div>
        <div className="card" style={{ cursor: "default" }}>
          <div className="muted" style={{ fontSize: 13, fontWeight: 600 }}>⚙️ IN PROGRESS</div>
          <div className="kpi" style={{ marginTop: 12 }}>{dashboard.statusCounts.IN_PROGRESS}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Work currently in motion</div>
        </div>
        <div className="card" style={{ cursor: "default" }}>
          <div className="muted" style={{ fontSize: 13, fontWeight: 600 }}>✅ DONE</div>
          <div className="kpi" style={{ marginTop: 12 }}>{dashboard.statusCounts.DONE}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Completed work</div>
        </div>
      </div>

      {dashboard.overdueAssigned.length > 0 && (
        <div className="card" style={{ borderLeft: "4px solid var(--danger)", marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 6, color: "var(--danger)" }}>⏰ Overdue Tasks</div>
              <div className="muted" style={{ fontSize: 13 }}>Tasks assigned to you that need attention.</div>
            </div>
            <button className="btn btnGhost" onClick={onRefresh}>Refresh</button>
          </div>
          {dashboard.overdueAssigned.map((task) => (
            <div key={task.id} style={{ padding: 10, borderRadius: 16, background: "rgba(255, 154, 154, 0.08)", marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{task.title}</div>
              <div className="muted" style={{ fontSize: 13 }}>Project: {task.project?.name || "Unknown"}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 className="title">📁 Active Projects</h2>
          <div className="muted" style={{ fontSize: 14 }}>
            Click a project to open tasks, members, and settings.
          </div>
        </div>
        <button className="btn btnPrimary" onClick={onRefresh}>
          🔄 Refresh
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div className="muted" style={{ fontSize: 16, marginBottom: 6 }}>
            No projects available yet.
          </div>
          <div className="muted" style={{ fontSize: 13 }}>
            Only project admins can create workspace projects. Ask your admin to add your team.
          </div>
        </div>
      ) : (
        projects.map((project) => (
          <button
            key={project.id}
            className="card"
            style={{
              width: "100%",
              textAlign: "left",
              marginBottom: 16,
              padding: 18,
              borderRadius: 18,
              display: "block",
              cursor: "pointer",
              background: "rgba(255, 255, 255, 0.85)",
              border: "1.5px solid var(--border-color)"
            }}
            onClick={async () => {
              await onOpenProject(project.id);
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6, color: "var(--text-primary)" }}>
              {project.name}
            </div>
            <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
              {project.description || "No description available."}
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              {project.members?.length ?? 0} team member{project.members && project.members.length === 1 ? "" : "s"}
            </div>
          </button>
        ))
      )}
    </>
  );
}

function ProjectsCard({
  user,
  projects,
  activeProjectId,
  onSelect,
  onCreated,
  setError
}: {
  user: { id: string; email: string; name: string };
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

  const isAdminInAny = projects.some((p) => p.members?.some((m) => m.userId === user.id && m.role === "ADMIN"));
  const canCreateProject = isAdminInAny;

  return (
    <div className="card">
      <div className="cardHeader">
        <div>
          <h2 className="title">📁 Projects</h2>
          <div className="muted" style={{ marginTop: 4 }}>
            {canCreateProject ? "Create a project or choose an existing workspace." : "You have access to projects, but only admins may create new workspaces."}
          </div>
        </div>
      </div>

      <div className="muted" style={{ marginBottom: 14 }}>
        Your active projects (member or admin).
      </div>

      {projects.length === 0 && <div className="muted" style={{ textAlign: "center", padding: 20, opacity: 0.7 }}>No projects yet. Create one to get started!</div>}
      {projects.map((p) => {
        const isAdminInThis = p.members?.some((m) => m.userId === user.id && m.role === "ADMIN") ?? false;
        return (
          <div key={p.id} style={{ position: "relative" }}>
            <button
              className="btn"
              style={{
                width: "100%",
                textAlign: "left",
                marginBottom: 10,
                padding: 14,
                borderColor: p.id === activeProjectId ? "var(--accent-purple)" : undefined,
                background: p.id === activeProjectId ? "rgba(200, 167, 255, 0.15)" : "rgba(255, 255, 255, 0.4)",
                borderRadius: 16,
                display: "block",
                transition: "all 0.25s ease"
              }}
              onClick={() => onSelect(p.id)}
            >
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: "var(--text-primary)" }}>{p.name}</div>
              <div className="muted" style={{ fontSize: 13 }}>
                {p.description || "No description"}
              </div>
            </button>
            {isAdminInThis && (
              <button
                className="btn btnDanger"
                style={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  padding: "4px 8px",
                  fontSize: 12,
                  borderRadius: 8
                }}
                onClick={async (e) => {
                  e.stopPropagation();
                  if (!confirm(`Delete project "${p.name}"? This will delete all tasks and memberships.`)) return;
                  try {
                    await api.deleteProject(p.id);
                    await onCreated();
                  } catch (err: any) {
                    setError(err.message || "Failed to delete project");
                  }
                }}
              >
                🗑️
              </button>
            )}
          </div>
        );
      })}

      <div style={{ height: 18 }} />
      {canCreateProject ? (
        <div className="card" style={{ padding: 18, background: "rgba(200, 167, 255, 0.08)", borderColor: "var(--accent-purple)" }}>
          <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 16, color: "var(--text-primary)" }}>✨ Create new project</div>
          <div className="muted" style={{ marginBottom: 14, fontSize: 13 }}>
            {projects.length === 0
              ? "Start your workspace by creating the first project."
              : "As an admin, you can create a new project for your team."}
          </div>
          <label className="label">Project name</label>
          <input className="input" placeholder="e.g., Q3 Product Redesign" value={name} onChange={(e) => setName(e.target.value)} />
          <label className="label">Description (optional)</label>
          <input
            className="input"
            placeholder="Describe project scope, goals and deliverables..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {localError && <div className="error" style={{ marginTop: 12 }}>{localError}</div>}
          <div style={{ height: 12 }} />
          <button
            className="btn btnPrimary"
            style={{ width: "100%" }}
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
      ) : (
        <div className="card" style={{ padding: 18, background: "rgba(200, 167, 255, 0.08)", borderColor: "var(--text-muted)", textAlign: "center" }}>
          <div className="muted" style={{ fontSize: 14 }}>
            👤 <strong>Member Mode</strong><br />
            <span style={{ fontSize: 13 }}>
              Only project admins may create new projects. If you are not an admin yet, ask an existing admin to invite you to a project.
            </span>
          </div>
        </div>
      )}
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
          <div className="muted" style={{ marginTop: 10, fontSize: 13 }}>
            Updated {new Date(project.updatedAt).toLocaleDateString()} • {members.length} team member{members.length === 1 ? "" : "s"}
          </div>
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
        {isAdmin && (
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 15, color: "var(--text-primary)" }}>✏️ Create task</div>
            <label className="label">Title</label>
            <input className="input" placeholder="Write API contracts for payment module" value={title} onChange={(e) => setTitle(e.target.value)} />
            <label className="label">Description</label>
            <textarea
              className="textarea"
              placeholder="Acceptance criteria, context and implementation notes"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <label className="label">Assign to</label>
            <select className="select" value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)}>
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.user.email} value={m.user.id ?? ""}>{m.user.name} ({m.role})</option>
              ))}
            </select>
            <label className="label">Due date (optional)</label>
            <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            <div style={{ height: 10 }} />
            {localError && <div className="error" style={{ marginTop: 10 }}>{localError}</div>}
            <button
              className="btn btnPrimary"
              disabled={busy}
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
        )}

        {!isAdmin && (
          <div className="card" style={{ background: "rgba(200, 167, 255, 0.08)", borderColor: "var(--accent-purple)" }}>
            <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 15, color: "var(--text-primary)" }}>👤 Member Mode</div>
            <div className="muted" style={{ fontSize: 13 }}>
              You can update task status (TODO → In Progress → Done) for tasks assigned to you. Project settings are managed by admins.
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 15, color: "var(--text-primary)" }}>⚙️ Project controls</div>
            <div className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
              Admin mode: manage project details and team members.
            </div>
            <label className="label">Project name</label>
            <input className="input" placeholder="Project name" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
            <label className="label">Description</label>
            <textarea className="textarea" placeholder="Project description" value={projectDesc ?? ""} onChange={(e) => setProjectDesc(e.target.value)} />
            <div style={{ height: 10 }} />
            <button
              className="btn btnPrimary"
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

            <hr style={{ borderColor: "var(--border-color)", margin: "14px 0" }} />
            <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 15, color: "var(--text-primary)" }}>👥 Team member access</div>
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
          </div>
        )}
        {isAdmin && (
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 15, color: "var(--text-primary)" }}>👥 Team members</div>
            <div className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
              Manage team membership and roles for this project.
            </div>
            {members.length === 0 ? (
              <div className="muted">No members are assigned to this project yet.</div>
            ) : (
              members.map((member) => {
                const memberId = member.user.id ?? "";
                return (
                  <div
                    key={memberId || member.user.email}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      marginBottom: 10,
                      flexWrap: "wrap"
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>{member.user.name}</div>
                      <div className="muted" style={{ fontSize: 13 }}>{member.user.email}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span className={`badge ${member.role === "ADMIN" ? "badgeAdmin" : "badgeMember"}`}>{member.role}</span>
                      {memberId && memberId !== user.id && (
                        <button
                          className="btn btnDanger btnSmall"
                          onClick={async () => {
                            setError(null);
                            if (!confirm(`Remove ${member.user.name} from this project?`)) return;
                            try {
                              await api.deleteMember(project.id, memberId);
                              await onRefreshAll();
                              await onRefreshTasks();
                            } catch (e) {
                              setError(e instanceof Error ? e.message : "Failed to remove member");
                            }
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
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
  const isOverdue = due && new Date(task.dueDate!) < new Date() && task.status !== "DONE";
  
  return (
    <div className="card" style={{ 
      padding: 16, 
      marginBottom: 12,
      display: "flex", 
      justifyContent: "space-between", 
      alignItems: "center",
      gap: 16,
      borderLeft: `4px solid ${task.status === "TODO" ? "#ffd4a8" : task.status === "IN_PROGRESS" ? "#a8d8ff" : "#a8f0d8"}`,
      transition: "all 0.3s ease"
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: "var(--text-primary)" }}>{task.title}</div>
        <div className="muted" style={{ fontSize: 13 }}>
          {task.project?.name && <span>📁 {task.project.name}</span>}
          {task.project?.name && due && <span> • </span>}
          {due && <span style={{ color: isOverdue ? "var(--danger)" : "var(--text-muted)" }}>
            {isOverdue ? "⏰ " : "📅 "}{due}
          </span>}
        </div>
      </div>
      <div className={`status status${task.status}`}>{task.status.replace("_", " ")}</div>
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
    <div className="card" style={{ 
      padding: 18, 
      marginBottom: 14,
      borderLeft: `4px solid ${status === "TODO" ? "#ffd4a8" : status === "IN_PROGRESS" ? "#a8d8ff" : "#a8f0d8"}`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <input
            className="input"
            disabled={!canAdminEdit}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            style={{ marginBottom: 10, fontSize: 15, fontWeight: 600 }}
          />
          <textarea
            className="textarea"
            disabled={!canAdminEdit}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add task description, acceptance criteria, or notes..."
            style={{ minHeight: 70, marginBottom: 10, fontSize: 13 }}
          />
          <div className="muted" style={{ fontSize: 13 }}>
            {task.assignedTo?.name ? `👤 Assigned to ${task.assignedTo.name} • ` : ""}
            {task.dueDate ? `📅 ${new Date(task.dueDate).toLocaleDateString()}` : "No due date"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end", minWidth: "fit-content" }}>
          <select 
            className="select" 
            value={status} 
            disabled={!canAdminEdit && !canMemberUpdateStatus}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
            style={{ minWidth: 140 }}
          >
            <option value="TODO">📝 TODO</option>
            <option value="IN_PROGRESS">⚙️ In Progress</option>
            <option value="DONE">✅ Done</option>
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
            {busy ? "Saving..." : "Save"}
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
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
}

