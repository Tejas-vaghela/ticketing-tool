import { User, Project, Attachment, Notification, Sprint, Epic, ActivityEvent, Settings, SavedFilter } from '../types';

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? '/api' : 'http://localhost:4000/api');

const TOKEN_KEY = 'inbox_auth_token';

export const tokenStorage = {
  getToken: (): string | null => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  setToken: (token: string): void => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch (e) {
      console.error('Failed to save auth token to localStorage', e);
    }
  },
  clearToken: (): void => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (e) {
      console.error('Failed to remove auth token from localStorage', e);
    }
  },
};

export interface LoginResponse {
  accessToken: string;
  user: User;
}

export interface LogoutResponse {
  success: boolean;
  message: string;
}

export interface ForgotPasswordResponse {
  message: string;
}

export interface ResetPasswordResponse {
  message: string;
}

export interface PaginatedUsersResponse {
  data: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = tokenStorage.getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const response = await fetch(`${API_BASE_URL}${cleanEndpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `HTTP Error ${response.status}`;
    try {
      const errorData = await response.json();
      if (Array.isArray(errorData.message)) {
        errorMessage = errorData.message.join(', ');
      } else if (errorData.message) {
        errorMessage = errorData.message;
      }
    } catch {
      if (response.statusText) {
        errorMessage = response.statusText;
      }
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

export const authApi = {
  login: async (emailOrId: string, password: string): Promise<LoginResponse> => {
    const res = await apiRequest<{ accessToken: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ emailOrId, password }),
    });
    return {
      accessToken: res.accessToken,
      user: normalizeBackendUser(res.user),
    };
  },

  getMe: async (): Promise<User> => {
    const res = await apiRequest<any>('/auth/me', {
      method: 'GET',
    });
    return normalizeBackendUser(res);
  },

  logout: async (): Promise<LogoutResponse> => {
    return apiRequest<LogoutResponse>('/auth/logout', {
      method: 'POST',
    });
  },

  forgotPassword: async (email: string): Promise<ForgotPasswordResponse> => {
    return apiRequest<ForgotPasswordResponse>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  resetPassword: async (
    token: string,
    newPassword: string,
    confirmPassword: string,
  ): Promise<ResetPasswordResponse> => {
    return apiRequest<ResetPasswordResponse>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword, confirmPassword }),
    });
  },
};

// ---------------------------------------------------------------------------
// Role mapping helpers
//
// The backend Prisma enum uses underscored values (e.g. "Support_Agent",
// "Project_Manager") which map to DB display labels via @map().
// The frontend UserRole type uses the display labels ("Support Agent",
// "Project Manager"). These helpers translate between the two representations.
// ---------------------------------------------------------------------------

/** Convert a frontend display label to the backend enum value for API requests. */
export function toBackendRole(displayRole: string): string {
  const map: Record<string, string> = {
    'Project Manager': 'Project_Manager',
    'Support Agent': 'Support_Agent',
  };
  return map[displayRole] ?? displayRole;
}

/** Convert a backend enum value (or DB display label) to the frontend display label. */
export function toFrontendRole(backendRole: string): string {
  const map: Record<string, string> = {
    'Project_Manager': 'Project Manager',
    'Support_Agent': 'Support Agent',
    // DB display labels are already correct for single-word roles
  };
  return map[backendRole] ?? backendRole;
}

/** Normalize a user object returned from the backend to match the frontend User type. */
export function normalizeBackendUser(u: any): User {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: toFrontendRole(u.role),
    department: u.department ?? '',
    supportLevels: u.supportLevels ?? ['L1'],
    avatar: u.avatar ?? '',
    timezone: u.timezone ?? 'UTC',
    status: u.status ?? 'Active',
  };
}

// ---------------------------------------------------------------------------
// Users API - wraps all /api/users endpoints
// ---------------------------------------------------------------------------

export const usersApi = {
  /** GET /api/users - fetch all users (up to 200 per page for the UI list) */
  listUsers: async (): Promise<User[]> => {
    const response = await apiRequest<PaginatedUsersResponse>('/users?limit=200');
    return response.data.map(normalizeBackendUser);
  },

  /** GET /api/users/:id */
  getUser: async (id: string): Promise<User> => {
    const u = await apiRequest<any>(`/users/${id}`);
    return normalizeBackendUser(u);
  },

  /** POST /api/users - Admin only */
  createUser: async (data: Omit<User, 'id'> & { password: string }): Promise<User> => {
    const payload = {
      name: data.name,
      email: data.email,
      password: data.password,
      role: toBackendRole(data.role),
      department: data.department,
      supportLevels: data.supportLevels,
      avatar: data.avatar ?? '',
      timezone: data.timezone ?? 'UTC',
      status: data.status ?? 'Active',
    };
    const u = await apiRequest<any>('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return normalizeBackendUser(u);
  },

  /** PATCH /api/users/:id - Admin / PM / self */
  updateUser: async (id: string, data: Partial<User>): Promise<User> => {
    const payload: Record<string, any> = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.email !== undefined) payload.email = data.email;
    if (data.role !== undefined) payload.role = toBackendRole(data.role);
    if (data.department !== undefined) payload.department = data.department;
    if (data.supportLevels !== undefined) payload.supportLevels = data.supportLevels;
    if (data.avatar !== undefined) payload.avatar = data.avatar;
    if (data.timezone !== undefined) payload.timezone = data.timezone;
    if (data.status !== undefined) payload.status = data.status;
    const u = await apiRequest<any>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return normalizeBackendUser(u);
  },

  /** DELETE /api/users/:id - Admin only */
  deleteUser: async (id: string): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>(`/users/${id}`, {
      method: 'DELETE',
    });
  },

  /** PATCH /api/users/:id/password */
  changePassword: async (
    id: string,
    newPassword: string,
    currentPassword?: string,
  ): Promise<{ message: string }> => {
    const payload: Record<string, string> = { newPassword };
    if (currentPassword !== undefined) {
      payload.currentPassword = currentPassword;
      payload.confirmPassword = newPassword;
    }
    return apiRequest<{ message: string }>(`/users/${id}/password`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
};

// ============================================================================
// PROJECTS API SERVICE (ProjectsModule Integration)
// ============================================================================

export interface BackendProject {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string | null;
  leadId: string;
  lead?: User;
  members?: User[];
  memberIds?: string[];
  status: 'Active' | 'Planning' | 'Completed' | 'On_Hold';
  createdDate: string;
  updatedDate?: string;
  _count?: {
    issues: number;
    sprints: number;
    epics: number;
  };
  activeIssueCount?: number;
}

export function normalizeBackendProject(p: any): Project {
  return {
    id: p.id,
    key: p.key,
    name: p.name,
    description: p.description ?? '',
    category: p.category ?? 'Software',
    leadId: p.leadId,
    memberIds: Array.isArray(p.members)
      ? p.members.map((m: any) => m.id)
      : Array.isArray(p.memberIds)
        ? p.memberIds
        : [p.leadId],
    status: p.status === 'On_Hold' ? 'On Hold' : p.status,
    createdDate: p.createdDate,
  };
}

export const projectsApi = {
  /** GET /api/projects - List all projects */
  listProjects: async (params?: { q?: string; status?: string; category?: string }): Promise<Project[]> => {
    const query = new URLSearchParams();
    if (params?.q) query.append('q', params.q);
    if (params?.status) {
      query.append('status', params.status === 'On Hold' ? 'On_Hold' : params.status);
    }
    if (params?.category) query.append('category', params.category);
    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await apiRequest<any[]>(`/projects${qs}`);
    return res.map(normalizeBackendProject);
  },

  /** GET /api/projects/:idOrKey - Retrieve project cockpit by CUID or Key */
  getProject: async (idOrKey: string): Promise<any> => {
    return apiRequest<any>(`/projects/${idOrKey}`);
  },

  /** POST /api/projects - Admin, Project_Manager */
  createProject: async (data: Omit<Project, 'id' | 'createdDate'>): Promise<Project> => {
    const payload = {
      key: data.key.trim().toUpperCase(),
      name: data.name.trim(),
      description: data.description?.trim() ?? '',
      category: data.category ?? 'Software',
      leadId: data.leadId,
      memberIds: data.memberIds ?? [data.leadId],
      status: data.status === 'On Hold' ? 'On_Hold' : (data.status ?? 'Active'),
    };
    const res = await apiRequest<any>('/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return normalizeBackendProject(res);
  },

  /** PATCH /api/projects/:id - Admin, Project_Manager */
  updateProject: async (id: string, data: Partial<Project>): Promise<Project> => {
    const payload: Record<string, any> = {};
    if (data.name !== undefined) payload.name = data.name.trim();
    if (data.description !== undefined) payload.description = data.description.trim();
    if (data.category !== undefined) payload.category = data.category;
    if (data.leadId !== undefined) payload.leadId = data.leadId;
    if (data.memberIds !== undefined) payload.memberIds = data.memberIds;
    if (data.status !== undefined) {
      payload.status = data.status === 'On Hold' ? 'On_Hold' : data.status;
    }
    const res = await apiRequest<any>(`/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return normalizeBackendProject(res);
  },

  /** DELETE /api/projects/:id - Admin only */
  deleteProject: async (id: string): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>(`/projects/${id}`, {
      method: 'DELETE',
    });
  },
};

// ============================================================================
// ATTACHMENTS API SERVICE (AttachmentsModule Integration)
// ============================================================================

export const attachmentsApi = {
  /** Upload single attachment file via multipart/form-data */
  uploadAttachment: async (issueId: string, file: File): Promise<Attachment> => {
    const formData = new FormData();
    formData.append('file', file);

    const token = tokenStorage.getToken();
    const response = await fetch(`${API_BASE_URL}/issues/${encodeURIComponent(issueId)}/attachments`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = `Failed to upload attachment (${response.status})`;
      try {
        const errData = await response.json();
        if (Array.isArray(errData.message)) {
          errorMessage = errData.message.join(', ');
        } else if (errData.message) {
          errorMessage = errData.message;
        }
      } catch {
        if (response.statusText) {
          errorMessage = response.statusText;
        }
      }
      throw new Error(errorMessage);
    }

    return response.json();
  },

  /** List all attachments for an issue */
  listAttachments: async (issueId: string): Promise<Attachment[]> => {
    try {
      return await apiRequest<Attachment[]>(`/issues/${encodeURIComponent(issueId)}/attachments`);
    } catch (err: any) {
      if (err?.message && (err.message.includes('404') || err.message.toLowerCase().includes('not found'))) {
        return [];
      }
      throw err;
    }
  },

  /** Get attachment metadata by ID */
  getAttachment: async (id: string): Promise<Attachment> => {
    return apiRequest<Attachment>(`/attachments/${encodeURIComponent(id)}`);
  },

  /** Download attachment binary stream using Blob */
  downloadAttachment: async (id: string, filename: string): Promise<void> => {
    const token = tokenStorage.getToken();
    const response = await fetch(`${API_BASE_URL}/attachments/${encodeURIComponent(id)}/download`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      let errorMessage = `Failed to download attachment (${response.status})`;
      try {
        const errData = await response.json();
        if (errData.message) errorMessage = errData.message;
      } catch {
        // use default
      }
      throw new Error(errorMessage);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    // Delay revoke to allow browser time to initiate download
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
    }, 1000);
  },

  /** Delete attachment by issueId and attachmentId */
  deleteAttachment: async (
    issueId: string,
    attachmentId: string,
  ): Promise<{ message: string; id: string }> => {
    return apiRequest<{ message: string; id: string }>(
      `/issues/${encodeURIComponent(issueId)}/attachments/${encodeURIComponent(attachmentId)}`,
      {
        method: 'DELETE',
      },
    );
  },
};

// ============================================================================
// NOTIFICATIONS API SERVICE (NotificationsModule Integration)
// ============================================================================

export const notificationsApi = {
  /** GET /api/notifications - List notifications for authenticated user */
  getNotifications: async (): Promise<Notification[]> => {
    return apiRequest<Notification[]>('/notifications');
  },

  /** GET /api/notifications/unread-count - Get count of unread notifications */
  getUnreadCount: async (): Promise<{ unreadCount: number }> => {
    return apiRequest<{ unreadCount: number }>('/notifications/unread-count');
  },

  /** PATCH /api/notifications/:id/read - Mark single notification as read */
  markAsRead: async (id: string): Promise<Notification> => {
    return apiRequest<Notification>(`/notifications/${encodeURIComponent(id)}/read`, {
      method: 'PATCH',
    });
  },

  /** POST /api/notifications/mark-all-read - Mark all notifications as read */
  markAllAsRead: async (): Promise<{ success: boolean; count: number }> => {
    return apiRequest<{ success: boolean; count: number }>('/notifications/mark-all-read', {
      method: 'POST',
    });
  },

  /** POST /api/notifications/system-alert - Dispatch system-wide alert (Admin only) */
  sendSystemAlert: async (data: {
    title: string;
    message: string;
    targetRole?: string;
    targetUserId?: string;
    link?: string;
  }): Promise<{ success: boolean; count: number; recipients: string[] }> => {
    return apiRequest<{ success: boolean; count: number; recipients: string[] }>(
      '/notifications/system-alert',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    );
  },
};

// ============================================================================
// ISSUES API SERVICE (IssuesModule Integration)
// ============================================================================

export const issuesApi = {
  /** GET /api/issues - List issues with optional filters */
  listIssues: async (params?: {
    projectId?: string;
    status?: string;
    assigneeId?: string;
    search?: string;
  }): Promise<any[]> => {
    const query = new URLSearchParams();
    if (params?.projectId) query.append('projectId', params.projectId);
    if (params?.status) query.append('status', params.status);
    if (params?.assigneeId) query.append('assigneeId', params.assigneeId);
    if (params?.search) query.append('search', params.search);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiRequest<any[]>(`/issues${qs}`);
  },

  /** GET /api/issues/:id - Retrieve single issue by ID */
  getIssue: async (id: string): Promise<any> => {
    return apiRequest<any>(`/issues/${encodeURIComponent(id)}`);
  },

  /** POST /api/issues - Create new issue (triggers assignment notification) */
  createIssue: async (data: any): Promise<any> => {
    return apiRequest<any>('/issues', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /** PATCH /api/issues/:id - Update issue details/assignee (triggers assignment notification) */
  updateIssue: async (id: string, data: any): Promise<any> => {
    return apiRequest<any>(`/issues/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /** PATCH /api/issues/:id/status - Update issue status (triggers status notification) */
  updateStatus: async (id: string, status: string): Promise<any> => {
    return apiRequest<any>(`/issues/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  /** POST /api/issues/:id/escalate - Escalate issue (triggers escalation notification) */
  escalateIssue: async (
    id: string,
    data: { toLevel: string; reason: string; assignedToUserId?: string },
  ): Promise<any> => {
    return apiRequest<any>(`/issues/${encodeURIComponent(id)}/escalate`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /** POST /api/issues/:id/comments - Add comment (triggers comment notification) */
  addComment: async (
    id: string,
    data: { content: string; type?: 'public' | 'internal' },
  ): Promise<any> => {
    return apiRequest<any>(`/issues/${encodeURIComponent(id)}/comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /** PATCH /api/issues/:id/comments/:commentId */
  editComment: async (id: string, commentId: string, content: string): Promise<any> => {
    return apiRequest<any>(
      `/issues/${encodeURIComponent(id)}/comments/${encodeURIComponent(commentId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ content }),
      },
    );
  },

  /** DELETE /api/issues/:id/comments/:commentId */
  deleteComment: async (id: string, commentId: string): Promise<any> => {
    return apiRequest<any>(
      `/issues/${encodeURIComponent(id)}/comments/${encodeURIComponent(commentId)}`,
      {
        method: 'DELETE',
      },
    );
  },

  /** DELETE /api/issues/:id */
  deleteIssue: async (id: string): Promise<any> => {
    return apiRequest<any>(`/issues/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  /** GET /api/issues/:id/comments - Get comments for issue */
  listComments: async (id: string): Promise<any[]> => {
    return apiRequest<any[]>(`/issues/${encodeURIComponent(id)}/comments`);
  },
};





// ============================================================================
// EPICS API SERVICE (EpicsModule Integration)
// ============================================================================

export const epicsApi = {
  /** GET /api/epics - Retrieve list of epics */
  listEpics: async (params?: { projectId?: string; status?: string; search?: string }): Promise<Epic[]> => {
    const query = new URLSearchParams();
    if (params?.projectId) query.append('projectId', params.projectId);
    if (params?.status) query.append('status', params.status);
    if (params?.search) query.append('search', params.search);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiRequest<Epic[]>(`/epics${qs}`);
  },

  /** GET /api/epics/:id - Retrieve single epic by ID */
  getEpic: async (id: string): Promise<Epic> => {
    return apiRequest<Epic>(`/epics/${encodeURIComponent(id)}`);
  },

  /** POST /api/epics - Create new epic */
  createEpic: async (data: Partial<Epic>): Promise<Epic> => {
    return apiRequest<Epic>('/epics', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /** PATCH /api/epics/:id - Update epic */
  updateEpic: async (id: string, data: Partial<Epic>): Promise<Epic> => {
    return apiRequest<Epic>(`/epics/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /** DELETE /api/epics/:id - Delete epic */
  deleteEpic: async (id: string): Promise<{ success: boolean; message?: string }> => {
    return apiRequest<{ success: boolean; message?: string }>(`/epics/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
};

// ============================================================================
// SPRINTS API SERVICE (SprintsModule Integration)
// ============================================================================

export const sprintsApi = {
  /** GET /api/sprints - Retrieve sprints list */
  listSprints: async (params?: { projectId?: string; status?: string }): Promise<Sprint[]> => {
    const query = new URLSearchParams();
    if (params?.projectId) query.append('projectId', params.projectId);
    if (params?.status) query.append('status', params.status);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiRequest<Sprint[]>(`/sprints${qs}`);
  },

  /** GET /api/sprints/:id - Retrieve single sprint */
  getSprint: async (id: string): Promise<Sprint> => {
    return apiRequest<Sprint>(`/sprints/${encodeURIComponent(id)}`);
  },

  /** POST /api/sprints - Create sprint */
  createSprint: async (data: Partial<Sprint>): Promise<Sprint> => {
    return apiRequest<Sprint>('/sprints', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /** PATCH /api/sprints/:id - Update sprint */
  updateSprint: async (id: string, data: Partial<Sprint>): Promise<Sprint> => {
    return apiRequest<Sprint>(`/sprints/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /** POST /api/sprints/:id/start - Start sprint */
  startSprint: async (id: string): Promise<Sprint> => {
    return apiRequest<Sprint>(`/sprints/${encodeURIComponent(id)}/start`, {
      method: 'POST',
    });
  },

  /** POST /api/sprints/:id/complete - Complete sprint */
  completeSprint: async (id: string, targetSprintId?: string): Promise<Sprint> => {
    return apiRequest<Sprint>(`/sprints/${encodeURIComponent(id)}/complete`, {
      method: 'POST',
      body: JSON.stringify(targetSprintId ? { targetSprintId } : {}),
    });
  },

  /** DELETE /api/sprints/:id - Delete sprint */
  deleteSprint: async (id: string): Promise<{ success: boolean; message?: string }> => {
    return apiRequest<{ success: boolean; message?: string }>(`/sprints/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
};

// ============================================================================
// SEARCH API SERVICE (SearchModule Integration)
// ============================================================================

export interface SearchResultItem {
  id: string;
  type: 'issue' | 'project' | 'epic' | 'sprint' | 'user';
  title: string;
  subtitle?: string;
  status?: string;
  priority?: string;
  projectId?: string;
  meta?: Record<string, any>;
}

export interface SearchResponse {
  query: string;
  total: number;
  results: SearchResultItem[];
}

export const searchApi = {
  /** GET /api/search - Global instant search across tickets, projects, epics, sprints, users */
  search: async (params: {
    q: string;
    type?: string;
    projectId?: string;
    limit?: number;
    page?: number;
  }): Promise<SearchResponse> => {
    const query = new URLSearchParams();
    query.append('q', params.q);
    if (params.type) query.append('type', params.type);
    if (params.projectId) query.append('projectId', params.projectId);
    if (params.limit) query.append('limit', String(params.limit));
    if (params.page) query.append('page', String(params.page));
    return apiRequest<SearchResponse>(`/search?${query.toString()}`);
  },
};

// ============================================================================
// ACTIVITY API SERVICE (ActivityModule Integration)
// ============================================================================

export interface ActivityFeedResponse {
  items: ActivityEvent[];
  nextCursor?: string | null;
  hasMore: boolean;
  total: number;
}

export const activityApi = {
  /** GET /api/activity - Workspace activity feed */
  getFeed: async (params?: {
    limit?: number;
    cursor?: string;
    projectId?: string;
    issueId?: string;
    action?: string;
  }): Promise<ActivityFeedResponse> => {
    const query = new URLSearchParams();
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.cursor) query.append('cursor', params.cursor);
    if (params?.projectId) query.append('projectId', params.projectId);
    if (params?.issueId) query.append('issueId', params.issueId);
    if (params?.action) query.append('action', params.action);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiRequest<ActivityFeedResponse>(`/activity${qs}`);
  },

  /** GET /api/activity/issues/:issueId - Ticket activity history */
  getIssueActivity: async (issueId: string): Promise<ActivityEvent[]> => {
    return apiRequest<ActivityEvent[]>(`/activity/issues/${encodeURIComponent(issueId)}`);
  },

  /** GET /api/activity/projects/:projectId - Project activity history */
  getProjectActivity: async (projectId: string): Promise<ActivityEvent[]> => {
    return apiRequest<ActivityEvent[]>(`/activity/projects/${encodeURIComponent(projectId)}`);
  },
};

// ============================================================================
// SAVED FILTERS API SERVICE (SavedFiltersModule Integration)
// ============================================================================

export const savedFiltersApi = {
  /** GET /api/saved-filters - List saved filters */
  listFilters: async (): Promise<SavedFilter[]> => {
    return apiRequest<SavedFilter[]>('/saved-filters');
  },

  /** POST /api/saved-filters - Create a new saved filter */
  createFilter: async (data: { name: string; filterConfig: Record<string, any>; isGlobal?: boolean }): Promise<SavedFilter> => {
    return apiRequest<SavedFilter>('/saved-filters', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /** PATCH /api/saved-filters/:id - Update an existing saved filter */
  updateFilter: async (id: string, data: Partial<SavedFilter>): Promise<SavedFilter> => {
    return apiRequest<SavedFilter>(`/saved-filters/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /** DELETE /api/saved-filters/:id - Delete a saved filter */
  deleteFilter: async (id: string): Promise<{ success: boolean; message?: string }> => {
    return apiRequest<{ success: boolean; message?: string }>(`/saved-filters/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
};

// ============================================================================
// SYSTEM API SERVICE (SystemModule Integration)
// ============================================================================

export interface SystemHealth {
  status: 'ok' | 'error';
  database: 'connected' | 'disconnected';
  uptimeSeconds: number;
  timestamp: string;
}

export interface SystemInfo {
  version: string;
  environment: string;
  database: string;
  uptimeSeconds: number;
  timestamp: string;
}

export const systemApi = {
  /** GET /api/system/health - Public health & database connectivity check */
  getHealth: async (): Promise<SystemHealth> => {
    return apiRequest<SystemHealth>('/system/health');
  },

  /** GET /api/system/info - Runtime metadata and telemetry */
  getInfo: async (): Promise<SystemInfo> => {
    return apiRequest<SystemInfo>('/system/info');
  },

  /** GET /api/system/export - Full JSON database snapshot (Admin only) */
  exportDatabase: async (): Promise<any> => {
    return apiRequest<any>('/system/export');
  },

  /** POST /api/system/import - Restore database from backup JSON (Admin only) */
  importDatabase: async (data: any): Promise<{ success: boolean; message: string; summary?: any }> => {
    return apiRequest<{ success: boolean; message: string; summary?: any }>('/system/import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /** POST /api/system/reset - Reset database to initial factory state (Admin only) */
  resetFactory: async (): Promise<{ success: boolean; message: string }> => {
    return apiRequest<{ success: boolean; message: string }>('/system/reset', {
      method: 'POST',
    });
  },
};

// ============================================================================
// SETTINGS API SERVICE (SettingsModule Integration)
// ============================================================================

export const settingsApi = {
  /** GET /api/settings - Retrieve workspace settings */
  getSettings: async (): Promise<Settings> => {
    return apiRequest<Settings>('/settings');
  },

  /** PATCH /api/settings - Update workspace settings (Admin & Project Manager) */
  updateSettings: async (data: Partial<Settings>): Promise<Settings> => {
    return apiRequest<Settings>('/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /** POST /api/settings/reset - Reset workspace settings to defaults */
  resetSettings: async (): Promise<Settings> => {
    return apiRequest<Settings>('/settings/reset', {
      method: 'POST',
    });
  },
};

// ============================================================================
// REPORTS API SERVICE (ReportsModule Integration)
// ============================================================================

export interface ReportsSummary {
  total: number;
  breached: number;
  atRisk: number;
  within: number;
  escalated: number;
  complianceRate: number;
  statusCounts: Record<string, number>;
  priorityCounts: Record<string, number>;
  tierCounts: Record<string, number>;
  projects: Array<{ id: string; name: string; key: string; total: number; resolved: number }>;
}

export interface SlaMetrics extends ReportsSummary {
  avgResolutionHours: number;
  avgResponseHours: number;
  resolvedCount: number;
}

export const reportsApi = {
  /** GET /api/reports/summary - Aggregate metrics across issues & projects */
  getSummary: async (projectId?: string): Promise<ReportsSummary> => {
    const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    return apiRequest<ReportsSummary>(`/reports/summary${qs}`);
  },

  /** GET /api/reports/sla - Detailed SLA compliance and duration metrics */
  getSlaMetrics: async (projectId?: string): Promise<SlaMetrics> => {
    const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    return apiRequest<SlaMetrics>(`/reports/sla${qs}`);
  },
};
