import React, { useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, ArrowUpRight, UserPlus, MessageSquare, AlertTriangle, CheckCircle2, Zap } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationPanel: React.FC<Props> = ({ isOpen, onClose }) => {
  const {
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    isNotificationsLoading,
    notificationsError,
    refreshNotifications,
  } = useApp();
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      refreshNotifications();
    }
  }, [isOpen, refreshNotifications]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const uniqueNotifications = React.useMemo(() => {
    if (!Array.isArray(notifications)) return [];
    const seen = new Set<string>();
    return notifications.filter(notif => {
      if (!notif || !notif.id || seen.has(notif.id)) return false;
      seen.add(notif.id);
      return true;
    });
  }, [notifications]);

  if (!isOpen) return null;

  const handleItemClick = (notif: typeof notifications[0]) => {
    markNotificationRead(notif.id);
    if (notif.issueId) {
      navigate(`/issues/${notif.issueId}`);
    }
    onClose();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'escalation':
        return <ArrowUpRight size={14} className="text-rose-500" />;
      case 'assignment':
        return <UserPlus size={14} className="text-blue-500" />;
      case 'comment':
        return <MessageSquare size={14} className="text-emerald-500" />;
      case 'status':
        return <CheckCircle2 size={14} className="text-indigo-500" />;
      case 'sprint':
        return <Zap size={14} className="text-amber-500" />;
      case 'system':
      case 'sla_risk':
      case 'sla_breach':
        return <AlertTriangle size={14} className="text-rose-500" />;
      default:
        return <CheckCircle2 size={14} className="text-purple-500" />;
    }
  };

  const unreadCount = uniqueNotifications.filter(n => !n.read).length;

  return (
    <div
      ref={panelRef}
      className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-zinc-500" />
          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Notifications</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.2 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded text-[10px] font-semibold">
              {unreadCount} new
            </span>
          )}
        </div>
        <button
          onClick={markAllNotificationsRead}
          className="text-[11px] text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium flex items-center gap-1"
        >
          <Check size={12} />
          Mark all as read
        </button>
      </div>

      {/* List */}
      <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
        {isNotificationsLoading && uniqueNotifications.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-500 dark:text-zinc-400 flex flex-col items-center gap-2">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span>Loading notifications...</span>
          </div>
        ) : notificationsError && uniqueNotifications.length === 0 ? (
          <div className="p-6 text-center text-xs text-rose-500 dark:text-rose-400 flex flex-col items-center gap-1.5">
            <AlertTriangle size={16} />
            <span>{notificationsError}</span>
          </div>
        ) : uniqueNotifications.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-500 dark:text-zinc-400 flex flex-col items-center gap-1.5">
            <CheckCircle2 size={18} className="text-zinc-400 dark:text-zinc-600" />
            <span>No notifications right now.</span>
          </div>
        ) : (
          uniqueNotifications.map(notif => (
            <div
              key={notif.id}
              onClick={() => handleItemClick(notif)}
              className={`p-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition flex items-start gap-3 ${
                !notif.read ? 'bg-blue-50/30 dark:bg-blue-950/20' : ''
              }`}
            >
              <div className="p-1.5 rounded-md bg-zinc-100 dark:bg-zinc-800 shrink-0 mt-0.5">
                {getIcon(notif.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {notif.title}
                  </p>
                  {!notif.read && (
                    <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                  )}
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-0.5 line-clamp-2 leading-relaxed">
                  {notif.message}
                </p>
                <span className="text-[10px] text-zinc-400 mt-1 block font-mono">
                  {notif.createdAt && !isNaN(new Date(notif.createdAt).getTime())
                    ? new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : ''}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-950/60 border-t border-zinc-100 dark:border-zinc-800 text-center">
        <span className="text-[11px] text-zinc-400">GoldMine support routing active</span>
      </div>
    </div>
  );
};
