import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Check,
  Save,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  KeyRound,
  AlertCircle,
} from 'lucide-react';
import { SupportLevel } from '../types';
import { SupportBadge } from '../components/common/SupportBadge';
import { calculateSLAInfo } from '../services/storage';
import { usersApi } from '../services/api';

export const ProfilePage: React.FC = () => {
  const { currentUser, setCurrentUser, updateUser, issues, addToast } = useApp();

  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);
  const [role, setRole] = useState(currentUser.role);
  const [avatar, setAvatar] = useState(currentUser.avatar);
  const [supportLevels, setSupportLevels] = useState<SupportLevel[]>(currentUser.supportLevels);

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [pwdError, setPwdError] = useState('');

  // Issue stats
  const userIssues = issues.filter(i => i.assigneeId === currentUser.id);
  const resolvedIssues = userIssues.filter(i => i.status === 'Resolved' || i.status === 'Closed');
  const activeIssues = userIssues.filter(i => i.status !== 'Resolved' && i.status !== 'Closed');
  const breachedAssigned = activeIssues.filter(i => calculateSLAInfo(i).status === 'Breached').length;

  function getPasswordStrength(password: string): { score: number; label: string; color: string } {
    if (!password) return { score: 0, label: '', color: '' };
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (score <= 2) return { score, label: 'Weak', color: 'bg-rose-500' };
    if (score === 3) return { score, label: 'Fair', color: 'bg-amber-500' };
    if (score === 4) return { score, label: 'Good', color: 'bg-blue-500' };
    return { score, label: 'Strong', color: 'bg-emerald-500' };
  }

  const pwdStrength = getPasswordStrength(newPassword);

  const toggleLevel = (lvl: SupportLevel) => {
    if (supportLevels.includes(lvl)) {
      if (supportLevels.length > 1) {
        setSupportLevels(supportLevels.filter(l => l !== lvl));
      }
    } else {
      setSupportLevels([...supportLevels, lvl]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateUser(currentUser.id, {
      name: name.trim(),
      email: email.trim(),
      role: role.trim(),
      avatar: avatar.trim(),
      supportLevels,
    });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');

    if (!currentPassword.trim()) {
      setPwdError('Please enter your current password.');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setPwdError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPwdError('New passwords do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setPwdError('New password must be different from your current password.');
      return;
    }

    setPwdLoading(true);
    try {
      await usersApi.changePassword(currentUser.id, newPassword, currentPassword);
      setPwdSuccess('Password updated successfully. Use your new password next time you sign in.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      addToast('Password Changed', 'Your account password was updated.', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to change password. Please try again.';
      if (
        msg.toLowerCase().includes('incorrect') ||
        msg.toLowerCase().includes('wrong') ||
        msg.toLowerCase().includes('current password')
      ) {
        setPwdError('Current password is incorrect.');
      } else if (msg.includes('429') || msg.toLowerCase().includes('too many')) {
        setPwdError('Too many requests. Please wait and try again.');
      } else {
        setPwdError(msg);
      }
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
          User Profile
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Manage your personal identity, authorized tier badges, and performance telemetry.
        </p>
      </div>

      {/* Profile Overview Card */}
      <div className="p-6 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          {currentUser.avatar ? (
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-16 h-16 rounded-full object-cover border-2 border-blue-500 shadow-sm"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold text-xl flex items-center justify-center border-2 border-blue-500 shadow-sm shrink-0">
              {currentUser.name.charAt(0)}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{currentUser.name}</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                Active Session
              </span>
            </div>
            <p className="text-xs text-zinc-500">{currentUser.role}</p>
            <div className="flex items-center gap-1.5 mt-2">
              {currentUser.supportLevels.map(lvl => (
                <SupportBadge key={lvl} level={lvl} size="sm" />
              ))}
            </div>
          </div>
        </div>

        {/* Assigned Metrics */}
        <div className="flex items-center gap-4 pt-4 sm:pt-0 border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800">
          <div className="text-center px-3">
            <span className="block text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {activeIssues.length}
            </span>
            <span className="text-[11px] text-zinc-400">Open Tickets</span>
          </div>
          <div className="text-center px-3 border-l border-zinc-200 dark:border-zinc-800">
            <span className="block text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {resolvedIssues.length}
            </span>
            <span className="text-[11px] text-zinc-400">Resolved</span>
          </div>
          <div className="text-center px-3 border-l border-zinc-200 dark:border-zinc-800">
            <span className="block text-xl font-bold text-rose-600 dark:text-rose-400">
              {breachedAssigned}
            </span>
            <span className="text-[11px] text-zinc-400">Breached</span>
          </div>
        </div>
      </div>

      {/* Edit Profile Form */}
      <form onSubmit={handleSave} className="p-6 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs space-y-4">
        <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider pb-2 border-b border-zinc-100 dark:border-zinc-800">
          Profile Details
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Role / Title
            </label>
            <input
              type="text"
              value={role}
              onChange={e => setRole(e.target.value)}
              className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Avatar Image URL
            </label>
            <input
              type="url"
              value={avatar}
              onChange={e => setAvatar(e.target.value)}
              className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
            Assigned Support Tiers
          </label>
          <div className="flex items-center gap-2">
            {(['L1', 'L2', 'L3'] as SupportLevel[]).map(lvl => {
              const isSelected = supportLevels.includes(lvl);
              return (
                <button
                  type="button"
                  key={lvl}
                  onClick={() => toggleLevel(lvl)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition flex items-center gap-1 ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700'
                  }`}
                >
                  {isSelected && <Check size={12} />}
                  <span>{lvl} Support Tier</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end pt-3">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition"
          >
            <Save size={14} />
            <span>Update Profile</span>
          </button>
        </div>
      </form>

      {/* Change Password Card */}
      <form
        onSubmit={handleChangePassword}
        className="p-6 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs space-y-4"
        noValidate
      >
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
          <KeyRound size={16} className="text-blue-500" />
          <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
            Change Password
          </h3>
        </div>

        {/* Success Banner */}
        {pwdSuccess && (
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
            <span>{pwdSuccess}</span>
          </div>
        )}

        {/* Error Banner */}
        {pwdError && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0 text-rose-600" />
            <span>{pwdError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Current Password */}
          <div className="sm:col-span-2">
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Current Password *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                <Lock size={14} />
              </div>
              <input
                id="current-password-profile"
                type={showCurrentPwd ? 'text' : 'password'}
                value={currentPassword}
                onChange={e => { setCurrentPassword(e.target.value); setPwdError(''); setPwdSuccess(''); }}
                placeholder="Enter your current password"
                autoComplete="current-password"
                disabled={pwdLoading}
                className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 pl-9 pr-10 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPwd(!showCurrentPwd)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                tabIndex={-1}
              >
                {showCurrentPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              New Password *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                <Lock size={14} />
              </div>
              <input
                id="new-password-profile"
                type={showNewPwd ? 'text' : 'password'}
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setPwdError(''); setPwdSuccess(''); }}
                placeholder="Minimum 8 characters"
                autoComplete="new-password"
                disabled={pwdLoading}
                className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 pl-9 pr-10 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowNewPwd(!showNewPwd)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                tabIndex={-1}
              >
                {showNewPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {newPassword && (
              <div className="mt-1.5">
                <div className="flex gap-0.5 h-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <div
                      key={n}
                      className={`flex-1 rounded-full transition-all duration-300 ${
                        n <= pwdStrength.score ? pwdStrength.color : 'bg-zinc-200 dark:bg-zinc-700'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  Strength: <span className="font-semibold">{pwdStrength.label}</span>
                </p>
              </div>
            )}
          </div>

          {/* Confirm New Password */}
          <div>
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Confirm New Password *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                <Lock size={14} />
              </div>
              <input
                id="confirm-new-password-profile"
                type={showConfirmPwd ? 'text' : 'password'}
                value={confirmNewPassword}
                onChange={e => { setConfirmNewPassword(e.target.value); setPwdError(''); setPwdSuccess(''); }}
                placeholder="Repeat new password"
                autoComplete="new-password"
                disabled={pwdLoading}
                className={`w-full rounded-md border bg-zinc-50 dark:bg-zinc-800 pl-9 pr-10 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 ${
                  confirmNewPassword && newPassword !== confirmNewPassword
                    ? 'border-rose-400 dark:border-rose-700'
                    : confirmNewPassword && newPassword === confirmNewPassword
                    ? 'border-emerald-400 dark:border-emerald-700'
                    : 'border-zinc-200 dark:border-zinc-700'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                tabIndex={-1}
              >
                {showConfirmPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {confirmNewPassword && newPassword !== confirmNewPassword && (
              <p className="text-[10px] text-rose-500 mt-1">Passwords do not match.</p>
            )}
            {confirmNewPassword && newPassword === confirmNewPassword && (
              <p className="text-[10px] text-emerald-500 mt-1">Passwords match</p>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            id="change-password-submit"
            type="submit"
            disabled={pwdLoading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pwdLoading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Updating...</span>
              </>
            ) : (
              <>
                <KeyRound size={14} />
                <span>Change Password</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
