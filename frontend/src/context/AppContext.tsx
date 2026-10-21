import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Project, 
  User, 
  Issue, 
  Sprint, 
  Epic, 
  Comment, 
  ActivityEvent, 
  Notification, 
  Settings, 
  SavedFilter,
  SupportLevel,
  IssueStatus,
  Priority,
  IssueType,
  EscalationRecord
} from '../types';
import { storage } from '../services/storage';
import { INITIAL_USERS } from '../data/seedData';
import { authApi, usersApi, projectsApi, notificationsApi, issuesApi, tokenStorage } from '../services/api';

export interface ToastItem {
  id: string;
  title: string;
  message?: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface AppContextType {
  projects: Project[];
  issues: Issue[];
  users: User[];
  currentUser: User;
  sprints: Sprint[];
  epics: Epic[];
  comments: Comment[];
  activity: ActivityEvent[];
  notifications: Notification[];
  settings: Settings;
  savedFilters: SavedFilter[];
  theme: 'light' | 'dark';
  toasts: ToastItem[];
  unreadNotificationCount: number;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  isUsersLoading: boolean;
  usersError: string | null;
  refreshUsers: () => Promise<void>;
  isProjectsLoading: boolean;
  projectsError: string | null;
  refreshProjects: () => Promise<void>;
  isNotificationsLoading: boolean;
  notificationsError: string | null;
  refreshNotifications: () => Promise<void>;

  // Authentication
  login: (userIdOrEmail: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateUserPassword: (userId: string, newPassword: string) => Promise<boolean>;

  // Actions
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setThemeMode: (mode: 'light' | 'dark' | 'system') => void;
  addToast: (title: string, message?: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  removeToast: (id: string) => void;

  // Issue Actions
  createIssue: (data: Omit<Issue, 'id' | 'createdDate' | 'updatedDate' | 'escalationHistory' | 'attachments' | 'responseSLAHours' | 'resolutionSLAHours'>) => Issue;
  updateIssue: (id: string, updates: Partial<Issue>) => void;
  deleteIssue: (id: string) => void;
  escalateIssue: (issueId: string, toLevel: SupportLevel, reason: string, assignedToUserId?: string) => void;
  
  // Comments
  addComment: (issueId: string, content: string, type: 'public' | 'internal') => void;
  editComment: (commentId: string, content: string) => void;
  deleteComment: (commentId: string) => void;

  // Attachments
  addAttachment: (issueId: string, file: { id?: string; filename: string; fileType: string; fileSize: number; uploadDate?: string }, suppressToast?: boolean) => void;
  deleteAttachment: (issueId: string, attachmentId: string, suppressToast?: boolean) => void;

  // Projects
  createProject: (data: Omit<Project, 'id' | 'createdDate'>) => Promise<Project>;
  updateProject: (id: string, data: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  // Sprints
  createSprint: (data: Omit<Sprint, 'id'>) => Sprint;
  updateSprint: (id: string, data: Partial<Sprint>) => void;
  startSprint: (id: string) => void;
  completeSprint: (id: string, targetSprintId?: string) => void;
  deleteSprint: (id: string) => void;

  // Epics
  createEpic: (data: Omit<Epic, 'id'>) => Epic;
  updateEpic: (id: string, data: Partial<Epic>) => void;
  deleteEpic: (id: string) => void;

  // Team Users
  addUser: (data: Omit<User, 'id'>) => Promise<User | null>;
  updateUser: (id: string, data: Partial<User>) => Promise<User | null>;
  deleteUser: (id: string) => Promise<boolean>;
  switchUser: (userId: string) => void;
  setCurrentUser: (user: User) => void;

  // Notifications
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;

  // Settings
  updateSettings: (newSettings: Partial<Settings>) => void;
  resetAllData: () => void;

  // Filters
  saveFilter: (name: string, filters: SavedFilter['filters']) => void;
  deleteFilter: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [isUsersLoading, setIsUsersLoading] = useState<boolean>(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [isProjectsLoading, setIsProjectsLoading] = useState<boolean>(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState<boolean>(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const activeUserIdRef = useRef<string | null>(null);

  const mergeKnownPasswords = useCallback((freshUsers: User[]): User[] => {
    const passMap = new Map<string, string>();
    try {
      storage.getUsers().forEach(u => {
        if (u.password) passMap.set(u.id, u.password);
      });
      INITIAL_USERS.forEach(u => {
        if (u.password && !passMap.has(u.id)) passMap.set(u.id, u.password);
      });
    } catch {
      // ignore
    }
    return freshUsers.map(u => ({
      ...u,
      password: passMap.get(u.id) || u.password,
    }));
  }, []);

  const refreshUsers = useCallback(async () => {
    const token = tokenStorage.getToken();
    if (!token) return;
    setIsUsersLoading(true);
    setUsersError(null);
    try {
      const dbUsers = await usersApi.listUsers();
      const merged = mergeKnownPasswords(dbUsers);
      setUsers(merged);
      storage.saveUsers(merged);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load users from database.';
      setUsersError(msg);
      console.error('[AppContext] Failed to refresh users:', err);
    } finally {
      setIsUsersLoading(false);
    }
  }, [mergeKnownPasswords]);

  const refreshProjects = useCallback(async () => {
    const token = tokenStorage.getToken();
    if (!token) return;
    setIsProjectsLoading(true);
    setProjectsError(null);
    try {
      const dbProjects = await projectsApi.listProjects();
      if (Array.isArray(dbProjects) && dbProjects.length > 0) {
        setProjects(dbProjects);
        storage.saveProjects(dbProjects);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load projects from database.';
      setProjectsError(msg);
      console.error('[AppContext] Failed to refresh projects:', err);
    } finally {
      setIsProjectsLoading(false);
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    const token = tokenStorage.getToken();
    if (!token) return;
    setIsNotificationsLoading(true);
    setNotificationsError(null);
    try {
      const activeId = activeUserIdRef.current;
      const dbNotifs = await notificationsApi.getNotifications();
      if (!activeId || activeUserIdRef.current === activeId) {
        const safeNotifs = Array.isArray(dbNotifs) ? dbNotifs : [];
        setNotifications(safeNotifs);
        storage.saveNotifications(safeNotifs);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load notifications from database.';
      setNotificationsError(msg);
      console.error('[AppContext] Failed to refresh notifications:', err);
    } finally {
      setIsNotificationsLoading(false);
    }
  }, []);

  // Initialize storage and verify backend JWT session on mount
  useEffect(() => {
    storage.init();
    async function verifySession() {
      const token = tokenStorage.getToken();
      if (!token) {
        setIsAuthenticated(false);
        setIsAuthLoading(false);
        return;
      }
      try {
        const user = await authApi.getMe();
        if (user && user.id) {
          activeUserIdRef.current = user.id;
          setCurrentUserId(user.id);
          storage.saveCurrentUserId(user.id);
          storage.saveAuthSession({ isAuthenticated: true, userId: user.id });
          setIsAuthenticated(true);

          setIsNotificationsLoading(true);
          const [usersRes, projectsRes, notifsRes] = await Promise.allSettled([
            usersApi.listUsers(),
            projectsApi.listProjects(),
            notificationsApi.getNotifications(),
          ]);

          if (usersRes.status === 'fulfilled' && Array.isArray(usersRes.value) && usersRes.value.length > 0) {
            const merged = mergeKnownPasswords(usersRes.value);
            setUsers(merged);
            storage.saveUsers(merged);
          } else if (usersRes.status === 'rejected') {
            console.error('[Session Verification] Failed to fetch database users list:', usersRes.reason);
            setUsersError(usersRes.reason instanceof Error ? usersRes.reason.message : 'Failed to fetch users from database.');
          }

          if (projectsRes.status === 'fulfilled' && Array.isArray(projectsRes.value) && projectsRes.value.length > 0) {
            setProjects(projectsRes.value);
            storage.saveProjects(projectsRes.value);
          } else if (projectsRes.status === 'rejected') {
            console.error('[Session Verification] Failed to fetch database projects list:', projectsRes.reason);
          }

          if (notifsRes.status === 'fulfilled') {
            if (activeUserIdRef.current === user.id) {
              const safeNotifs = Array.isArray(notifsRes.value) ? notifsRes.value : [];
              setNotifications(safeNotifs);
              storage.saveNotifications(safeNotifs);
            }
          } else {
            console.error('[Session Verification] Failed to fetch notifications:', notifsRes.reason);
            setNotificationsError(notifsRes.reason instanceof Error ? notifsRes.reason.message : 'Failed to load notifications.');
          }
          setIsNotificationsLoading(false);
        } else {
          activeUserIdRef.current = null;
          tokenStorage.clearToken();
          storage.clearAuthSession();
          setNotifications([]);
          storage.saveNotifications([]);
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.warn('[Session Verification] Stored token invalid or expired:', err);
        activeUserIdRef.current = null;
        tokenStorage.clearToken();
        storage.clearAuthSession();
        setNotifications([]);
        storage.saveNotifications([]);
        setIsAuthenticated(false);
      } finally {
        setIsAuthLoading(false);
      }
    }
    verifySession();
  }, []);

  const [projects, setProjects] = useState<Project[]>(() => storage.getProjects());
  const [issues, setIssues] = useState<Issue[]>(() => storage.getIssues());
  const [users, setUsers] = useState<User[]>(() => storage.getUsers());
  const [currentUserId, setCurrentUserId] = useState<string>(() => storage.getCurrentUserId());
  const [sprints, setSprints] = useState<Sprint[]>(() => storage.getSprints());
  const [epics, setEpics] = useState<Epic[]>(() => storage.getEpics());
  const [comments, setComments] = useState<Comment[]>(() => storage.getComments());
  const [activity, setActivity] = useState<ActivityEvent[]>(() => storage.getActivity());
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    const auth = storage.getAuthSession();
    if (auth && auth.isAuthenticated && tokenStorage.getToken()) {
      return storage.getNotifications();
    }
    return [];
  });
  const [settings, setSettings] = useState<Settings>(() => storage.getSettings());
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(() => storage.getSavedFilters());
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!tokenStorage.getToken() && storage.getAuthSession().isAuthenticated;
  });

  // Theme management
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = storage.getSettings().theme;
    if (saved === 'dark') return 'dark';
    if (saved === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next: 'light' | 'dark' = prev === 'light' ? 'dark' : 'light';
      const newSettings: Settings = { ...settings, theme: next };
      setSettings(newSettings);
      storage.saveSettings(newSettings);
      return next;
    });
  }, [settings]);

  const setThemeExplicit = useCallback((mode: 'light' | 'dark') => {
    const newSettings: Settings = { ...settings, theme: mode };
    setSettings(newSettings);
    storage.saveSettings(newSettings);
    setTheme(mode);
  }, [settings]);

  const setThemeMode = useCallback((mode: 'light' | 'dark' | 'system') => {
    const newSettings: Settings = { ...settings, theme: mode };
    setSettings(newSettings);
    storage.saveSettings(newSettings);
    if (mode === 'dark') setTheme('dark');
    else if (mode === 'light') setTheme('light');
    else {
      setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    }
  }, [settings]);

  // Current user resolution
  const currentUser = useMemo(() => {
    const found = users.find(u => u.id === currentUserId);
    return found || users[0] || {
      id: 'user-1',
      name: 'Tejas Chauhan',
      email: 'tejas@inbox.GoldMine.io',
      role: 'Admin',
      department: 'Engineering',
      supportLevels: ['L1', 'L2', 'L3'],
      avatar: '',
      timezone: 'UTC',
      status: 'Active',
    };
  }, [users, currentUserId]);

  const unreadNotificationCount = useMemo(() => {
    if (!Array.isArray(notifications)) return 0;
    return notifications.filter(n => n && !n.read).length;
  }, [notifications]);

  // Toast Helpers
  const addToast = useCallback((title: string, message?: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    const id = 'toast-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Sync state helpers
  const logActivity = useCallback((event: Omit<ActivityEvent, 'id' | 'timestamp'>) => {
    const randomSuffix = Math.random().toString(36).substring(2, 9);
    const newEvent: ActivityEvent = {
      ...event,
      id: `act-${Date.now()}-${randomSuffix}`,
      timestamp: new Date().toISOString(),
    };
    setActivity(prev => {
      if (prev.some(a => a.id === newEvent.id)) return prev;
      const next = [newEvent, ...prev];
      storage.saveActivity(next);
      return next;
    });
  }, []);

  const pushNotification = useCallback((notif: Omit<Notification, 'id' | 'read' | 'createdAt'>) => {
    const randomSuffix = Math.random().toString(36).substring(2, 9);
    const newNotif: Notification = {
      ...notif,
      id: `notif-${Date.now()}-${randomSuffix}`,
      read: false,
      createdAt: new Date().toISOString(),
    };
    setNotifications(prev => {
      if (prev.some(n => n.id === newNotif.id)) return prev;
      const next = [newNotif, ...prev];
      storage.saveNotifications(next);
      return next;
    });
  }, []);

  // Issue CRUD
  const createIssue = useCallback((data: Omit<Issue, 'id' | 'createdDate' | 'updatedDate' | 'escalationHistory' | 'attachments' | 'responseSLAHours' | 'resolutionSLAHours'>) => {
    const project = projects.find(p => p.id === data.projectId);
    const prefix = project ? project.key : 'INB';
    
    // Find highest existing number for this prefix
    const existingNums = issues
      .filter(i => i.id.startsWith(prefix + '-'))
      .map(i => parseInt(i.id.replace(prefix + '-', ''), 10))
      .filter(n => !isNaN(n));
    const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1001;
    const newId = `${prefix}-${nextNum}`;

    const priorityRule = settings.slaRules[data.priority] || { responseHours: 4, resolutionHours: 24 };

    const newIssue: Issue = {
      ...data,
      id: newId,
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
      responseSLAHours: priorityRule.responseHours,
      resolutionSLAHours: priorityRule.resolutionHours,
      escalationHistory: [],
      attachments: [],
      isEscalated: false,
    };

    setIssues(prev => {
      const next = [newIssue, ...prev];
      storage.saveIssues(next);
      return next;
    });

    logActivity({
      issueId: newId,
      projectId: data.projectId,
      userId: currentUser.id,
      action: 'created',
      details: `created ticket ${newId} "${data.title}" (Support Level: ${data.supportLevel}, Priority: ${data.priority})`,
    });

    if (data.assigneeId && data.assigneeId !== currentUser.id) {
      pushNotification({
        title: 'New Ticket Assigned',
        message: `${currentUser.name} assigned ${newId} "${data.title}" to you (Level: ${data.supportLevel}).`,
        type: 'assignment',
        issueId: newId,
      });
    }

    // Dispatch to backend API to persist issue and trigger backend notifications
    issuesApi
      .createIssue({
        title: data.title,
        description: data.description,
        projectId: data.projectId,
        type: data.type,
        priority: data.priority,
        supportLevel: data.supportLevel,
        assigneeId: data.assigneeId,
        sprintId: data.sprintId,
        epicId: data.epicId,
        labels: data.labels,
        estimatedTime: data.estimatedTime,
        storyPoints: data.storyPoints,
      })
      .then(backendIssue => {
        if (backendIssue && backendIssue.id && backendIssue.id !== newId) {
          setIssues(prev => {
            const next = prev.map(i => i.id === newId ? { ...i, id: backendIssue.id } : i);
            storage.saveIssues(next);
            return next;
          });
        }
        refreshNotifications();
      })
      .catch(err => {
        console.warn('[AppContext] Backend createIssue error:', err);
      });

    addToast('Issue Created', `${newId} was successfully created.`, 'success');
    return newIssue;
  }, [projects, issues, settings.slaRules, currentUser, logActivity, pushNotification, addToast, refreshNotifications]);

  const updateIssue = useCallback((id: string, updates: Partial<Issue>) => {
    setIssues(prev => {
      const current = prev.find(i => i.id === id);
      if (!current) return prev;

      const updated: Issue = {
        ...current,
        ...updates,
        updatedDate: new Date().toISOString(),
      };

      // Check if status changed to Resolved/Closed
      if (updates.status && (updates.status === 'Resolved' || updates.status === 'Closed') && !current.resolvedAt) {
        updated.resolvedAt = new Date().toISOString();
      }

      // If priority changed, update SLA rules
      if (updates.priority && updates.priority !== current.priority) {
        const rule = settings.slaRules[updates.priority];
        if (rule) {
          updated.responseSLAHours = rule.responseHours;
          updated.resolutionSLAHours = rule.resolutionHours;
        }
      }

      const next = prev.map(i => i.id === id ? updated : i);
      storage.saveIssues(next);

      // Log activity depending on updates
      if (updates.status && updates.status !== current.status) {
        logActivity({
          issueId: id,
          projectId: updated.projectId,
          userId: currentUser.id,
          action: 'status_changed',
          details: `moved ${id} from ${current.status} to ${updates.status}`,
        });
      }
      if (updates.assigneeId && updates.assigneeId !== current.assigneeId) {
        const assignee = users.find(u => u.id === updates.assigneeId);
        logActivity({
          issueId: id,
          projectId: updated.projectId,
          userId: currentUser.id,
          action: 'assigned',
          details: `assigned ${id} to ${assignee?.name || 'Unassigned'}`,
        });
        if (updates.assigneeId !== currentUser.id) {
          pushNotification({
            title: 'Ticket Reassigned',
            message: `You have been assigned ${id} "${updated.title}".`,
            type: 'assignment',
            issueId: id,
          });
        }
      }
      if (updates.priority && updates.priority !== current.priority) {
        logActivity({
          issueId: id,
          projectId: updated.projectId,
          userId: currentUser.id,
          action: 'priority_changed',
          details: `changed priority of ${id} from ${current.priority} to ${updates.priority}`,
        });
      }

      return next;
    });

    // Dispatch status change or reassignment to backend to create persistent notifications
    if (updates.status) {
      issuesApi
        .updateStatus(id, updates.status)
        .then(() => refreshNotifications())
        .catch(err => {
          console.warn('[AppContext] Backend updateStatus error:', err);
        });
    }
    if (updates.assigneeId !== undefined) {
      issuesApi
        .updateIssue(id, { assigneeId: updates.assigneeId })
        .then(() => refreshNotifications())
        .catch(err => {
          console.warn('[AppContext] Backend updateIssue assignee error:', err);
        });
    }

    addToast('Issue Updated', `Changes to ${id} have been saved.`, 'info');
  }, [settings.slaRules, currentUser, users, logActivity, pushNotification, addToast, refreshNotifications]);

  const deleteIssue = useCallback((id: string) => {
    setIssues(prev => {
      const issue = prev.find(i => i.id === id);
      const next = prev.filter(i => i.id !== id);
      storage.saveIssues(next);
      if (issue) {
        logActivity({
          issueId: id,
          projectId: issue.projectId,
          userId: currentUser.id,
          action: 'deleted',
          details: `deleted ticket ${id}`,
        });
      }
      return next;
    });
    addToast('Issue Deleted', `${id} was removed.`, 'warning');
  }, [currentUser, logActivity, addToast]);

  // Escalation Action
  const escalateIssue = useCallback((issueId: string, toLevel: SupportLevel, reason: string, assignedToUserId?: string) => {
    setIssues(prev => {
      const issue = prev.find(i => i.id === issueId);
      if (!issue) return prev;

      const fromLevel = issue.supportLevel;
      const escalationRecord: EscalationRecord = {
        id: 'esc-' + Date.now(),
        timestamp: new Date().toISOString(),
        fromLevel,
        toLevel,
        reason,
        escalatedByUserId: currentUser.id,
        assignedToUserId: assignedToUserId || issue.assigneeId,
      };

      const updated: Issue = {
        ...issue,
        supportLevel: toLevel,
        assigneeId: assignedToUserId !== undefined ? assignedToUserId : issue.assigneeId,
        isEscalated: true,
        updatedDate: new Date().toISOString(),
        escalationHistory: [...(issue.escalationHistory || []), escalationRecord],
      };

      const next = prev.map(i => i.id === issueId ? updated : i);
      storage.saveIssues(next);

      // Auto-create an internal escalation note in comments
      const internalComment: Comment = {
        id: 'comm-' + Date.now(),
        issueId,
        authorId: currentUser.id,
        type: 'internal',
        content: `[Internal Escalation Note] Escalated from ${fromLevel} to ${toLevel}.\nReason: ${reason}${assignedToUserId ? `\nReassigned to: ${users.find(u => u.id === assignedToUserId)?.name || 'Team member'}` : ''}`,
        createdAt: new Date().toISOString(),
      };
      setComments(commPrev => {
        const commNext = [internalComment, ...commPrev];
        storage.saveComments(commNext);
        return commNext;
      });

      // Log Activity
      logActivity({
        issueId,
        projectId: issue.projectId,
        userId: currentUser.id,
        action: 'escalated',
        details: `escalated ${issueId} ${fromLevel} → ${toLevel} (Reason: ${reason})`,
      });

      // Push Notifications
      pushNotification({
        title: 'Ticket Escalated',
        message: `${issueId} has been escalated from ${fromLevel} to ${toLevel}. Reason: ${reason}`,
        type: 'escalation',
        issueId,
      });

      if (assignedToUserId && assignedToUserId !== currentUser.id) {
        pushNotification({
          title: 'Escalated Ticket Assigned',
          message: `You have been assigned ${issueId} (Support Level: ${toLevel}, Priority: ${issue.priority}).`,
          type: 'assignment',
          issueId,
        });
      }

      return next;
    });

    // Dispatch escalation to backend to create atomic EscalationRecord and trigger escalation notification
    issuesApi
      .escalateIssue(issueId, {
        toLevel,
        reason,
        assignedToUserId,
      })
      .then(() => refreshNotifications())
      .catch(err => {
        console.warn('[AppContext] Backend escalateIssue error:', err);
      });

    addToast('Ticket Escalated', `Ticket ${issueId} escalated to ${toLevel}.`, 'success');
  }, [currentUser, users, logActivity, pushNotification, addToast, refreshNotifications]);

  // Comment Actions
  const addComment = useCallback((issueId: string, content: string, type: 'public' | 'internal') => {
    const newComment: Comment = {
      id: 'comm-' + Date.now(),
      issueId,
      authorId: currentUser.id,
      content,
      type,
      createdAt: new Date().toISOString(),
    };

    setComments(prev => {
      const next = [newComment, ...prev];
      storage.saveComments(next);
      return next;
    });

    const issue = issues.find(i => i.id === issueId);
    logActivity({
      issueId,
      projectId: issue?.projectId,
      userId: currentUser.id,
      action: 'commented',
      details: `added a ${type === 'internal' ? 'internal note' : 'public reply'} on ${issueId}`,
    });

    // If first response on an open issue by support agent, record firstRespondedAt
    if (issue && !issue.firstRespondedAt && type === 'public') {
      updateIssue(issueId, { firstRespondedAt: new Date().toISOString() });
    }

    // Dispatch comment to backend to create persistent Comment and trigger comment notification
    issuesApi
      .addComment(issueId, {
        content,
        type,
      })
      .then(() => refreshNotifications())
      .catch(err => {
        console.warn('[AppContext] Backend addComment error:', err);
      });

    addToast(type === 'internal' ? 'Internal Note Added' : 'Comment Published', '', 'success');
  }, [currentUser, issues, logActivity, updateIssue, addToast, refreshNotifications]);

  const editComment = useCallback((commentId: string, content: string) => {
    setComments(prev => {
      const next = prev.map(c => c.id === commentId ? { ...c, content, updatedAt: new Date().toISOString() } : c);
      storage.saveComments(next);
      return next;
    });
    addToast('Comment Updated', '', 'info');
  }, [addToast]);

  const deleteComment = useCallback((commentId: string) => {
    setComments(prev => {
      const next = prev.filter(c => c.id !== commentId);
      storage.saveComments(next);
      return next;
    });
    addToast('Comment Deleted', '', 'warning');
  }, [addToast]);

  // Attachments
  const addAttachment = useCallback((issueId: string, file: { id?: string; filename: string; fileType: string; fileSize: number; uploadDate?: string }, suppressToast = false) => {
    const newAttachment = {
      id: file.id || ('att-' + Date.now()),
      issueId,
      filename: file.filename,
      fileType: file.fileType,
      fileSize: file.fileSize,
      uploadDate: file.uploadDate || new Date().toISOString(),
    };

    setIssues(prev => {
      const next = prev.map(issue => {
        if (issue.id === issueId) {
          const currentList = (issue.attachments || []).filter(a => a.id !== newAttachment.id);
          return {
            ...issue,
            attachments: [...currentList, newAttachment],
            updatedDate: new Date().toISOString(),
          };
        }
        return issue;
      });
      storage.saveIssues(next);
      return next;
    });

    logActivity({
      issueId,
      userId: currentUser.id,
      action: 'attachment_added',
      details: `uploaded attachment "${file.filename}" to ${issueId}`,
    });

    if (!suppressToast) {
      addToast('Attachment Added', file.filename, 'success');
    }
  }, [currentUser, logActivity, addToast]);

  const deleteAttachment = useCallback((issueId: string, attachmentId: string, suppressToast = false) => {
    setIssues(prev => {
      const next = prev.map(issue => {
        if (issue.id === issueId) {
          return {
            ...issue,
            attachments: (issue.attachments || []).filter(a => a.id !== attachmentId),
            updatedDate: new Date().toISOString(),
          };
        }
        return issue;
      });
      storage.saveIssues(next);
      return next;
    });
    if (!suppressToast) {
      addToast('Attachment Removed', '', 'info');
    }
  }, [addToast]);

  // Project Actions
  const createProject = useCallback(async (data: Omit<Project, 'id' | 'createdDate'>): Promise<Project> => {
    try {
      const newProject = await projectsApi.createProject(data);
      setProjects(prev => {
        const next = [...prev.filter(p => p.id !== newProject.id), newProject];
        storage.saveProjects(next);
        return next;
      });

      logActivity({
        projectId: newProject.id,
        userId: currentUser.id,
        action: 'project_created',
        details: `created project ${data.name} (${data.key})`,
      });

      addToast('Project Created', `${data.name} created successfully.`, 'success');
      return newProject;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create project.';
      addToast('Failed to Create Project', msg, 'error');
      throw err;
    }
  }, [currentUser, logActivity, addToast]);

  const updateProject = useCallback(async (id: string, data: Partial<Project>): Promise<void> => {
    try {
      const updated = await projectsApi.updateProject(id, data);
      setProjects(prev => {
        const next = prev.map(p => p.id === id ? updated : p);
        storage.saveProjects(next);
        return next;
      });
      addToast('Project Updated', 'Project settings saved.', 'info');
    } catch (err) {
      console.warn('[AppContext] Backend updateProject error, fallback to local state:', err);
      setProjects(prev => {
        const next = prev.map(p => p.id === id ? { ...p, ...data } : p);
        storage.saveProjects(next);
        return next;
      });
      addToast('Project Updated', 'Project settings saved.', 'info');
    }
  }, [addToast]);

  const deleteProject = useCallback(async (id: string): Promise<void> => {
    try {
      await projectsApi.deleteProject(id);
    } catch (err) {
      console.warn('[AppContext] Backend deleteProject error, fallback to local state:', err);
    }
    setProjects(prev => {
      const proj = prev.find(p => p.id === id);
      const next = prev.filter(p => p.id !== id);
      storage.saveProjects(next);
      if (proj) {
        logActivity({
          userId: currentUser.id,
          action: 'project_deleted',
          details: `deleted project ${proj.name}`,
        });
      }
      return next;
    });
    addToast('Project Deleted', 'Project removed.', 'warning');
  }, [currentUser, logActivity, addToast]);

  // Sprint Actions
  const createSprint = useCallback((data: Omit<Sprint, 'id'>) => {
    const newSprint: Sprint = {
      ...data,
      id: 'sprint-' + (sprints.length + 1),
    };
    setSprints(prev => {
      const next = [...prev, newSprint];
      storage.saveSprints(next);
      return next;
    });
    addToast('Sprint Created', `${data.name} is ready.`, 'success');
    return newSprint;
  }, [sprints.length, addToast]);

  const updateSprint = useCallback((id: string, data: Partial<Sprint>) => {
    setSprints(prev => {
      const next = prev.map(s => s.id === id ? { ...s, ...data } : s);
      storage.saveSprints(next);
      return next;
    });
    addToast('Sprint Updated', '', 'info');
  }, [addToast]);

  const startSprint = useCallback((id: string) => {
    const target = sprints.find(s => s.id === id);
    setSprints(prev => {
      const next = prev.map(s => s.id === id ? { ...s, status: 'active' as const } : s);
      storage.saveSprints(next);
      return next;
    });

    if (target) {
      logActivity({
        projectId: target.projectId,
        userId: currentUser.id,
        action: 'sprint_started',
        details: `started ${target.name}`,
      });
      pushNotification({
        title: 'Sprint Started',
        message: `${target.name} has begun.`,
        type: 'sprint',
      });
    }
    addToast('Sprint Started', 'Active sprint initiated.', 'success');
  }, [currentUser, sprints, logActivity, pushNotification, addToast]);

  const completeSprint = useCallback((id: string, targetSprintId?: string) => {
    const target = sprints.find(s => s.id === id);
    setSprints(prev => {
      const next = prev.map(s => s.id === id ? { ...s, status: 'completed' as const, completedDate: new Date().toISOString() } : s);
      storage.saveSprints(next);
      return next;
    });

    // Move incomplete issues to backlog or targetSprint
    setIssues(issuesPrev => {
      const issuesNext = issuesPrev.map(issue => {
        if (issue.sprintId === id && issue.status !== 'Resolved' && issue.status !== 'Closed') {
          return {
            ...issue,
            sprintId: targetSprintId || undefined,
          };
        }
        return issue;
      });
      storage.saveIssues(issuesNext);
      return issuesNext;
    });

    if (target) {
      logActivity({
        projectId: target.projectId,
        userId: currentUser.id,
        action: 'sprint_completed',
        details: `completed ${target.name}`,
      });
      pushNotification({
        title: 'Sprint Completed',
        message: `${target.name} has been closed.`,
        type: 'sprint',
      });
    }
    addToast('Sprint Completed', 'Sprint finalized.', 'success');
  }, [currentUser, sprints, logActivity, pushNotification, addToast]);

  const deleteSprint = useCallback((id: string) => {
    setSprints(prev => {
      const next = prev.filter(s => s.id !== id);
      storage.saveSprints(next);
      return next;
    });
    // Unassign issues from this sprint
    setIssues(prev => {
      const next = prev.map(i => i.sprintId === id ? { ...i, sprintId: undefined } : i);
      storage.saveIssues(next);
      return next;
    });
    addToast('Sprint Deleted', '', 'warning');
  }, [addToast]);

  // Epic Actions
  const createEpic = useCallback((data: Omit<Epic, 'id'>) => {
    const newEpic: Epic = {
      ...data,
      id: 'epic-' + (epics.length + 1),
    };
    setEpics(prev => {
      const next = [...prev, newEpic];
      storage.saveEpics(next);
      return next;
    });
    addToast('Epic Created', `${data.name} created.`, 'success');
    return newEpic;
  }, [epics.length, addToast]);

  const updateEpic = useCallback((id: string, data: Partial<Epic>) => {
    setEpics(prev => {
      const next = prev.map(e => e.id === id ? { ...e, ...data } : e);
      storage.saveEpics(next);
      return next;
    });
    addToast('Epic Updated', '', 'info');
  }, [addToast]);

  const deleteEpic = useCallback((id: string) => {
    setEpics(prev => {
      const next = prev.filter(e => e.id !== id);
      storage.saveEpics(next);
      return next;
    });
    addToast('Epic Removed', '', 'warning');
  }, [addToast]);

  // Team Users Actions
  const addUser = useCallback(async (data: Omit<User, 'id'>): Promise<User | null> => {
    const rawPassword = data.password || 'welcome123';
    try {
      const createdUser = await usersApi.createUser({
        name: data.name,
        email: data.email,
        password: rawPassword,
        role: data.role,
        department: data.department || 'Operations',
        supportLevels: data.supportLevels,
        avatar: data.avatar,
        timezone: data.timezone,
        status: data.status,
      });

      const userWithCreds: User = {
        ...createdUser,
        password: rawPassword,
      };

      setUsers(prev => {
        const next = [...prev.filter(u => u.id !== userWithCreds.id), userWithCreds];
        storage.saveUsers(next);
        return next;
      });
      addToast('Member Added', `${userWithCreds.name} added to workspace.`, 'success');
      return userWithCreds;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create user in database.';
      addToast('Failed to Add Member', msg, 'error');
      return null;
    }
  }, [addToast]);

  const updateUser = useCallback(async (id: string, data: Partial<User>): Promise<User | null> => {
    try {
      const updatedUser = await usersApi.updateUser(id, data);
      setUsers(prev => {
        const next = prev.map(u => (u.id === id ? { ...updatedUser, password: data.password || u.password } : u));
        storage.saveUsers(next);
        return next;
      });
      addToast('Member Updated', 'Profile details updated.', 'info');
      return updatedUser;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update user in database.';
      addToast('Failed to Update Member', msg, 'error');
      return null;
    }
  }, [addToast]);

  const updateUserPassword = useCallback(async (userId: string, newPassword: string): Promise<boolean> => {
    const clean = newPassword.trim();
    if (!clean || clean.length < 8) {
      addToast('Invalid Password', 'Password must be at least 8 characters long.', 'error');
      return false;
    }
    try {
      await usersApi.changePassword(userId, clean);
      setUsers(prev => {
        const next = prev.map(u => (u.id === userId ? { ...u, password: clean } : u));
        storage.saveUsers(next);
        return next;
      });
      addToast('Password Saved', 'User password credentials updated successfully.', 'success');
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update user password.';
      addToast('Failed to Update Password', msg, 'error');
      return false;
    }
  }, [addToast]);

  const deleteUser = useCallback(async (id: string): Promise<boolean> => {
    try {
      await usersApi.deleteUser(id);
      setUsers(prev => {
        const next = prev.filter(u => u.id !== id);
        storage.saveUsers(next);
        return next;
      });
      addToast('Member Removed', 'User removed from workspace.', 'warning');
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to remove user from database.';
      addToast('Failed to Remove Member', msg, 'error');
      return false;
    }
  }, [addToast]);

  const switchUser = useCallback(async (userId: string) => {
    activeUserIdRef.current = userId;
    setCurrentUserId(userId);
    storage.saveCurrentUserId(userId);
    setNotifications([]);
    storage.saveNotifications([]);
    const target = users.find(u => u.id === userId);
    addToast('Switched User', `Now acting as ${target?.name || 'User'} (${target?.role})`, 'info');

    // Authenticate with backend for the switched user to receive user-scoped notifications
    const seedUser = INITIAL_USERS.find(u => u.id === userId);
    const password = target?.password || seedUser?.password;
    const email = target?.email || seedUser?.email;

    if (email && password) {
      try {
        const loginRes = await authApi.login(email, password);
        if (loginRes?.accessToken) {
          tokenStorage.setToken(loginRes.accessToken);
          storage.saveAuthSession({ isAuthenticated: true, userId });
        }
      } catch (err) {
        console.warn('[AppContext] Failed to authenticate switched user session:', err);
      }
    }

    try {
      setIsNotificationsLoading(true);
      const dbNotifs = await notificationsApi.getNotifications();
      if (activeUserIdRef.current === userId) {
        const safeNotifs = Array.isArray(dbNotifs) ? dbNotifs : [];
        setNotifications(safeNotifs);
        storage.saveNotifications(safeNotifs);
      }
    } catch (err) {
      console.error('[AppContext] Failed to load notifications for switched user:', err);
    } finally {
      setIsNotificationsLoading(false);
    }
  }, [users, addToast]);

  const setCurrentUser = useCallback((user: User) => {
    switchUser(user.id);
  }, [switchUser]);

  // Authentication: Login & Logout via NestJS backend
  const login = useCallback(
    async (userIdOrEmail: string, passwordInput: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const response = await authApi.login(userIdOrEmail, passwordInput);
        if (response && response.accessToken && response.user) {
          activeUserIdRef.current = response.user.id;
          tokenStorage.setToken(response.accessToken);
          setCurrentUserId(response.user.id);
          storage.saveCurrentUserId(response.user.id);
          storage.saveAuthSession({ isAuthenticated: true, userId: response.user.id });
          setIsAuthenticated(true);

          setIsNotificationsLoading(true);
          const [usersRes, projectsRes, notifsRes] = await Promise.allSettled([
            usersApi.listUsers(),
            projectsApi.listProjects(),
            notificationsApi.getNotifications(),
          ]);

          if (usersRes.status === 'fulfilled' && Array.isArray(usersRes.value) && usersRes.value.length > 0) {
            const merged = mergeKnownPasswords(usersRes.value);
            setUsers(merged);
            storage.saveUsers(merged);
          } else if (usersRes.status === 'rejected') {
            console.error('[Login] Failed to fetch database users list:', usersRes.reason);
            setUsersError(usersRes.reason instanceof Error ? usersRes.reason.message : 'Failed to load users list.');
          }

          if (projectsRes.status === 'fulfilled' && Array.isArray(projectsRes.value) && projectsRes.value.length > 0) {
            setProjects(projectsRes.value);
            storage.saveProjects(projectsRes.value);
          } else if (projectsRes.status === 'rejected') {
            console.error('[Login] Failed to fetch database projects list:', projectsRes.reason);
          }

          if (notifsRes.status === 'fulfilled') {
            if (activeUserIdRef.current === response.user.id) {
              const safeNotifs = Array.isArray(notifsRes.value) ? notifsRes.value : [];
              setNotifications(safeNotifs);
              storage.saveNotifications(safeNotifs);
            }
          } else {
            console.error('[Login] Failed to fetch notifications:', notifsRes.reason);
            setNotificationsError(notifsRes.reason instanceof Error ? notifsRes.reason.message : 'Failed to load notifications.');
          }
          setIsNotificationsLoading(false);

          addToast('Access Granted', `Welcome to Inbox Ticketing, ${response.user.name}!`, 'success');
          return { success: true };
        }
        return { success: false, error: 'Malformed authentication response received.' };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Authentication failed. Please verify your password.';
        return { success: false, error: errorMsg };
      }
    },
    [addToast, mergeKnownPasswords],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Proceed even if network request fails
    } finally {
      activeUserIdRef.current = null;
      tokenStorage.clearToken();
      storage.clearAuthSession();
      setNotifications([]);
      storage.saveNotifications([]);
      setIsAuthenticated(false);
      addToast('Signed Out', 'You have been logged out of your session.', 'info');
    }
  }, [addToast]);

  // Notifications
  const markNotificationRead = useCallback(async (id: string) => {
    const previous = notifications;
    setNotifications(prev => {
      const next = prev.map(n => n.id === id ? { ...n, read: true } : n);
      storage.saveNotifications(next);
      return next;
    });

    // Guard against mock/client-only IDs (e.g. notif-1729...) which do not exist in PostgreSQL
    if (id.startsWith('notif-')) {
      return;
    }

    try {
      await notificationsApi.markAsRead(id);
    } catch (err) {
      console.error('[Notifications] Failed to mark notification read on backend:', err);
      try {
        const fresh = await notificationsApi.getNotifications();
        if (activeUserIdRef.current) {
          setNotifications(fresh);
          storage.saveNotifications(fresh);
        }
      } catch {
        setNotifications(previous);
        storage.saveNotifications(previous);
      }
    }
  }, [notifications]);

  const markAllNotificationsRead = useCallback(async () => {
    const previous = notifications;
    setNotifications(prev => {
      const next = prev.map(n => ({ ...n, read: true }));
      storage.saveNotifications(next);
      return next;
    });
    addToast('All Caught Up', 'All notifications marked as read.', 'info');

    try {
      await notificationsApi.markAllAsRead();
    } catch (err) {
      console.error('[Notifications] Failed to mark all notifications read on backend:', err);
      try {
        const fresh = await notificationsApi.getNotifications();
        if (activeUserIdRef.current) {
          setNotifications(fresh);
          storage.saveNotifications(fresh);
        }
      } catch {
        setNotifications(previous);
        storage.saveNotifications(previous);
      }
    }
  }, [notifications, addToast]);

  // Settings
  const updateSettings = useCallback((newSettings: Partial<Settings>) => {
    setSettings(prev => {
      const next = { ...prev, ...newSettings };
      storage.saveSettings(next);
      return next;
    });
    addToast('Settings Saved', 'Preferences have been persisted.', 'success');
  }, [addToast]);

  const resetAllData = useCallback(() => {
    storage.resetToSeedData();
    setProjects(storage.getProjects());
    setIssues(storage.getIssues());
    setUsers(storage.getUsers());
    setCurrentUserId(storage.getCurrentUserId());
    setSprints(storage.getSprints());
    setEpics(storage.getEpics());
    setComments(storage.getComments());
    setActivity(storage.getActivity());
    setNotifications(storage.getNotifications());
    setSettings(storage.getSettings());
    setIsAuthenticated(false);
    addToast('Data Reset', 'Workspace has been restored to factory seed state.', 'info');
  }, [addToast]);

  // Filters
  const saveFilter = useCallback((name: string, filters: SavedFilter['filters']) => {
    const newFilter: SavedFilter = {
      id: 'filter-' + Date.now(),
      name,
      filters,
    };
    setSavedFilters(prev => {
      const next = [...prev, newFilter];
      storage.saveSavedFilters(next);
      return next;
    });
    addToast('Filter Saved', `Filter "${name}" saved to your list.`, 'success');
  }, [addToast]);

  const deleteFilter = useCallback((id: string) => {
    setSavedFilters(prev => {
      const next = prev.filter(f => f.id !== id);
      storage.saveSavedFilters(next);
      return next;
    });
    addToast('Filter Removed', '', 'info');
  }, [addToast]);

  const value = useMemo(() => ({
    projects,
    issues,
    users,
    currentUser,
    sprints,
    epics,
    comments,
    activity,
    notifications,
    settings,
    savedFilters,
    theme,
    toasts,
    unreadNotificationCount,
    isAuthenticated,
    isAuthLoading,
    isUsersLoading,
    usersError,
    refreshUsers,
    isProjectsLoading,
    projectsError,
    refreshProjects,
    login,
    logout,
    updateUserPassword,
    toggleTheme,
    setThemeMode,
    addToast,
    removeToast,
    createIssue,
    updateIssue,
    deleteIssue,
    escalateIssue,
    addComment,
    editComment,
    deleteComment,
    addAttachment,
    deleteAttachment,
    createProject,
    updateProject,
    deleteProject,
    createSprint,
    updateSprint,
    startSprint,
    completeSprint,
    deleteSprint,
    createEpic,
    updateEpic,
    deleteEpic,
    addUser,
    updateUser,
    deleteUser,
    switchUser,
    setCurrentUser,
    setTheme: setThemeExplicit,
    markNotificationRead,
    markAllNotificationsRead,
    isNotificationsLoading,
    notificationsError,
    refreshNotifications,
    updateSettings,
    resetAllData,
    saveFilter,
    deleteFilter,
  }), [
    projects,
    issues,
    users,
    currentUser,
    sprints,
    epics,
    comments,
    activity,
    notifications,
    settings,
    savedFilters,
    theme,
    toasts,
    unreadNotificationCount,
    isAuthenticated,
    isAuthLoading,
    isUsersLoading,
    usersError,
    refreshUsers,
    isProjectsLoading,
    projectsError,
    refreshProjects,
    isNotificationsLoading,
    notificationsError,
    refreshNotifications,
    login,
    logout,
    updateUserPassword,
    toggleTheme,
    setThemeMode,
    addToast,
    removeToast,
    createIssue,
    updateIssue,
    deleteIssue,
    escalateIssue,
    addComment,
    editComment,
    deleteComment,
    addAttachment,
    deleteAttachment,
    createProject,
    updateProject,
    deleteProject,
    createSprint,
    updateSprint,
    startSprint,
    completeSprint,
    deleteSprint,
    createEpic,
    updateEpic,
    deleteEpic,
    addUser,
    updateUser,
    deleteUser,
    switchUser,
    setCurrentUser,
    setThemeExplicit,
    markNotificationRead,
    markAllNotificationsRead,
    updateSettings,
    resetAllData,
    saveFilter,
    deleteFilter,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
