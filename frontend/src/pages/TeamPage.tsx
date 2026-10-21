import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Users, 
  Plus, 
  Search, 
  Mail, 
  ShieldCheck, 
  UserCheck, 
  Edit2, 
  Trash2,
  Check,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { User, SupportLevel, UserRole } from '../types';
import { SupportBadge } from '../components/common/SupportBadge';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { ALL_ROLES } from '../services/rbac';

export const TeamPage: React.FC = () => {
  const { 
    users, 
    issues, 
    currentUser, 
    setCurrentUser, 
    addUser, 
    updateUser, 
    deleteUser,
    isUsersLoading,
    usersError,
    refreshUsers,
    addToast 
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // Form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('Support Agent');
  const [selectedLevels, setSelectedLevels] = useState<SupportLevel[]>(['L1']);

  const filteredUsers = users.filter(u => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
  });

  const toggleLevel = (lvl: SupportLevel) => {
    if (selectedLevels.includes(lvl)) {
      if (selectedLevels.length > 1) {
        setSelectedLevels(selectedLevels.filter(l => l !== lvl));
      }
    } else {
      setSelectedLevels([...selectedLevels, lvl]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    if (editingUser) {
      const updated = await updateUser(editingUser.id, {
        name: name.trim(),
        email: email.trim(),
        role,
        supportLevels: selectedLevels,
      });
      if (updated) {
        setEditingUser(null);
        setName('');
        setEmail('');
        setIsAddOpen(false);
      }
    } else {
      const created = await addUser({
        name: name.trim(),
        email: email.trim(),
        role,
        department: 'Customer Operations',
        avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`,
        supportLevels: selectedLevels,
        timezone: 'UTC',
        status: 'Active',
      });
      if (created) {
        setName('');
        setEmail('');
        setIsAddOpen(false);
      }
    }
  };

  const startEdit = (user: User) => {
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
    setSelectedLevels(user.supportLevels);
    setIsAddOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Team &amp; Personnel
            </h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold">
              {users.length} Active Members
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Manage agent authorization, tier competencies, and simulate distinct user accounts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refreshUsers()}
            disabled={isUsersLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-750 text-zinc-700 dark:text-zinc-200 text-xs font-semibold shadow-xs transition disabled:opacity-50"
            title="Reload team members from database"
          >
            <RefreshCw size={13} className={isUsersLoading ? 'animate-spin text-blue-600' : ''} />
            <span>Sync</span>
          </button>

          <button
            onClick={() => {
              setEditingUser(null);
              setName('');
              setEmail('');
              setRole('Support Agent');
              setSelectedLevels(['L1', 'L2']);
              setIsAddOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition"
          >
            <Plus size={15} className="stroke-[2.5]" />
            <span>Add Member</span>
          </button>
        </div>
      </div>

      {usersError && (
        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0 text-rose-600" />
            <span>{usersError}</span>
          </div>
          <button
            type="button"
            onClick={() => refreshUsers()}
            className="underline font-semibold hover:text-rose-800"
          >
            Retry
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-2.5 text-zinc-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search members by name or role..."
          className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none"
        />
      </div>

      {/* Loading state */}
      {isUsersLoading && users.length === 0 ? (
        <div className="p-12 text-center text-zinc-500 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
          <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-600" />
          <p className="text-xs font-medium">Loading workspace team members...</p>
        </div>
      ) : (
        /* Team Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredUsers.map(user => {
            const userIssues = issues.filter(i => i.assigneeId === user.id);
            const activeIssues = userIssues.filter(i => i.status !== 'Resolved' && i.status !== 'Closed');
            const isCurrent = currentUser.id === user.id;

            return (
              <div
                key={user.id}
                className={`p-5 rounded-xl border transition flex flex-col justify-between ${
                  isCurrent
                    ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-950/20 ring-1 ring-blue-500/50'
                    : 'border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.name}
                          className="w-12 h-12 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold text-base flex items-center justify-center border border-zinc-200 dark:border-zinc-700 shrink-0">
                          {user.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{user.name}</h3>
                          {isCurrent && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-600 text-white">
                              You
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{user.role}</p>
                        <p className="text-[11px] text-zinc-400 font-mono flex items-center gap-1 mt-0.5">
                          <Mail size={11} />
                          <span>{user.email}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEdit(user)}
                        className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded"
                        title="Edit Member"
                      >
                        <Edit2 size={13} />
                      </button>
                      {currentUser.role === 'Admin' && !isCurrent && (
                        <button
                          onClick={() => setUserToDelete(user)}
                          className="p-1 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 rounded transition"
                          title="Remove Member"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Tier Badges */}
                  <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                      Authorized Support Levels
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {user.supportLevels.map(lvl => (
                        <SupportBadge key={lvl} level={lvl} size="sm" />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bottom stats and switch button */}
                <div className="mt-5 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                  <span className="font-mono text-zinc-500 text-[11px]">
                    {activeIssues.length} open / {userIssues.length} assigned
                  </span>

                  {!isCurrent ? (
                    <button
                      onClick={() => {
                        setCurrentUser(user);
                        addToast('User Switched', `Active session switched to ${user.name}`, 'info');
                      }}
                      className="px-2.5 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-blue-600 hover:text-white text-zinc-700 dark:text-zinc-300 text-[11px] font-semibold transition"
                    >
                      Switch to User
                    </button>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold flex items-center gap-1">
                      <UserCheck size={13} />
                      <span>Active Session</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Member Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 max-w-md w-full shadow-2xl">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {editingUser ? 'Edit Member' : 'Add Team Member'}
            </h3>
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Rachel Adams"
                  className="w-full text-xs rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="rachel@acme.inc"
                  className="w-full text-xs rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Designation / Role *
                </label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  className="w-full text-xs rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                >
                  {ALL_ROLES.map(r => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Assigned Support Tiers (Click to toggle)
                </label>
                <div className="flex items-center gap-2">
                  {(['L1', 'L2', 'L3'] as SupportLevel[]).map(lvl => {
                    const isSelected = selectedLevels.includes(lvl);
                    return (
                      <button
                        type="button"
                        key={lvl}
                        onClick={() => toggleLevel(lvl)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition flex items-center gap-1 ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100'
                        }`}
                      >
                        {isSelected && <Check size={12} />}
                        <span>{lvl} Support</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                >
                  {editingUser ? 'Save Member' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <ConfirmModal
          isOpen={true}
          title="Remove Member Account"
          message={`Are you sure you want to permanently remove ${userToDelete.name} (${userToDelete.email}) from workspace?`}
          confirmLabel="Remove User"
          isDestructive={true}
          onConfirm={async () => {
            const success = await deleteUser(userToDelete.id);
            if (success) {
              setUserToDelete(null);
            }
          }}
          onCancel={() => setUserToDelete(null)}
        />
      )}
    </div>
  );
};
