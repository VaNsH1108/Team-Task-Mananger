export type ApiError = { error?: string; message?: string; code?: string; issues?: unknown; details?: string[] };

export type AuthResponse = {
  user: { id: string; email: string; name: string };
  accessToken: string;
};

export type ProjectRole = "ADMIN" | "MEMBER";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

export type Project = {
  id: string;
  name: string;
  description?: string | null;
  updatedAt?: string;
  members?: Array<{ userId?: string; role: ProjectRole; user: { id?: string; email: string; name: string } }>;
};

export type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  dueDate?: string | null;
  updatedAt?: string;
  project?: { id: string; name: string };
  createdBy?: { id: string; name: string; email: string };
  assignedTo?: { id: string; name: string; email: string } | null;
  assignedToId?: string | null;
  projectId?: string;
};

function getToken() {
  return localStorage.getItem("accessToken");
}

export function setToken(token: string | null) {
  if (!token) localStorage.removeItem("accessToken");
  else localStorage.setItem("accessToken", token);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {})
    }
  });

  if (!res.ok) {
    let body: ApiError | undefined;
    try {
      body = (await res.json()) as ApiError;
    } catch {
      // ignore
    }
    throw new Error(body?.message || body?.error || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const api = {
  signup: (body: { email: string; name: string; password: string }) =>
    request<AuthResponse>("/api/auth/signup", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    request<AuthResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
  me: () => request<{ user: { id: string; email: string; name: string } | undefined }>("/api/me"),
  listProjects: () => request<{ projects: Project[] }>("/api/projects"),
  createProject: (body: { name: string; description?: string }) =>
    request<{ project: Project }>("/api/projects", { method: "POST", body: JSON.stringify(body) }),
  getProject: (projectId: string) => request<{ project: Project }>(`/api/projects/${projectId}`),
  patchProject: (projectId: string, body: { name?: string; description?: string | null }) =>
    request<{ project: Project }>(`/api/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify(body)
    }),
  addMember: (projectId: string, body: { email: string; role?: ProjectRole }) =>
    request<{ member: { id: string; role: ProjectRole; user: { id: string; email: string; name: string } } }>(
      `/api/projects/${projectId}/members`,
      {
      method: "POST",
      body: JSON.stringify(body)
      }
    ),
  listTasks: (projectId?: string) =>
    request<{ tasks: Task[] }>(projectId ? `/api/tasks?projectId=${encodeURIComponent(projectId)}` : "/api/tasks"),
  createTask: (body: {
    projectId: string;
    title: string;
    description?: string;
    assignedToId?: string;
    dueDate?: string;
  }) => request<{ task: Task }>("/api/tasks", { method: "POST", body: JSON.stringify(body) }),
  patchTask: (taskId: string, patch: Partial<Task> & { dueDate?: string | null }) =>
    request<{ task: Task }>(`/api/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteTask: (taskId: string) =>
    fetch(`/api/tasks/${taskId}`, {
      method: "DELETE",
      headers: {
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {})
      }
    }).then((r) => {
      if (!r.ok) throw new Error("Delete failed");
    }),
  dashboard: () =>
    request<{
      statusCounts: { TODO: number; IN_PROGRESS: number; DONE: number };
      overdueAssigned: Task[];
      myTasks: Task[];
    }>("/api/dashboard")
};

