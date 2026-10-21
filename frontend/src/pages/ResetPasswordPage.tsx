import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '../services/api';
import { InboxLogo } from '../components/common/InboxLogo';
import {
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  XCircle,
} from 'lucide-react';

type PageState = 'form' | 'success' | 'invalid_token';

function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
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

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [pageState, setPageState] = useState<PageState>(() =>
    token ? 'form' : 'invalid_token',
  );
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setPageState('invalid_token');
    }
  }, [token]);

  const strength = getPasswordStrength(newPassword);

  const validate = (): string => {
    if (!newPassword) return 'Please enter a new password.';
    if (newPassword.length < 8) return 'Password must be at least 8 characters.';
    if (!confirmPassword) return 'Please confirm your new password.';
    if (newPassword !== confirmPassword) return 'Passwords do not match.';
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const validationError = validate();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      await authApi.resetPassword(token, newPassword, confirmPassword);
      setPageState('success');
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred. Please try again.';

      // Map specific error patterns to friendly messages
      if (
        msg.toLowerCase().includes('expired') ||
        msg.toLowerCase().includes('invalid') ||
        msg.toLowerCase().includes('already been used') ||
        msg.includes('400')
      ) {
        setPageState('invalid_token');
      } else if (msg.includes('429') || msg.toLowerCase().includes('too many')) {
        setErrorMessage('Too many requests. Please wait a few minutes before trying again.');
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 flex flex-col justify-between p-4 sm:p-6 transition-colors duration-200">
      {/* Top bar */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between py-2">
        <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          Gold Mine Portal
        </span>
      </div>

      {/* Card */}
      <div className="w-full max-w-md mx-auto my-auto py-6">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
          {/* Brand Header */}
          <div className="p-6 sm:p-8 text-center border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-850/40">
            <div className="inline-flex justify-center mb-4">
              <InboxLogo size="lg" />
            </div>
            <div
              className={`inline-flex items-center justify-center w-10 h-10 rounded-full mb-3 ${
                pageState === 'invalid_token'
                  ? 'bg-rose-100 dark:bg-rose-950/60'
                  : pageState === 'success'
                  ? 'bg-emerald-100 dark:bg-emerald-950/60'
                  : 'bg-blue-100 dark:bg-blue-950/60'
              }`}
            >
              {pageState === 'invalid_token' ? (
                <XCircle size={20} className="text-rose-600 dark:text-rose-400" />
              ) : pageState === 'success' ? (
                <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400" />
              ) : (
                <KeyRound size={20} className="text-blue-600 dark:text-blue-400" />
              )}
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              {pageState === 'invalid_token'
                ? 'Link Invalid or Expired'
                : pageState === 'success'
                ? 'Password Reset!'
                : 'Set New Password'}
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xs mx-auto">
              {pageState === 'invalid_token'
                ? 'This reset link is invalid, expired, or has already been used.'
                : pageState === 'success'
                ? 'Your password has been updated. You can now sign in with your new credentials.'
                : 'Choose a strong new password for your account.'}
            </p>
          </div>

          {/* Content */}
          <div className="p-6 sm:p-8 space-y-5">
            {/* Invalid Token State */}
            {pageState === 'invalid_token' && (
              <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-start gap-3">
                <AlertCircle
                  size={18}
                  className="shrink-0 text-rose-600 dark:text-rose-400 mt-0.5"
                />
                <div>
                  <p className="text-xs font-semibold text-rose-800 dark:text-rose-200">
                    Reset Link Problem
                  </p>
                  <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                    Reset links expire after 1 hour and can only be used once.
                    Please request a fresh link.
                  </p>
                </div>
              </div>
            )}

            {/* Success State */}
            {pageState === 'success' && (
              <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-3">
                <CheckCircle2
                  size={18}
                  className="shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5"
                />
                <div>
                  <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                    Password Updated Successfully
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                    Sign in with your new password to access your workspace.
                  </p>
                </div>
              </div>
            )}

            {/* Form State */}
            {pageState === 'form' && (
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {/* Error Banner */}
                {errorMessage && (
                  <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 animate-fadeIn">
                    <AlertCircle size={16} className="shrink-0 text-rose-600 dark:text-rose-400" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* New Password */}
                <div>
                  <label
                    htmlFor="new-password"
                    className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5"
                  >
                    New Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                      <Lock size={15} />
                    </div>
                    <input
                      id="new-password"
                      type={showNew ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setErrorMessage('');
                      }}
                      placeholder="Minimum 8 characters"
                      autoComplete="new-password"
                      disabled={isSubmitting}
                      className="w-full text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 pl-9 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                      tabIndex={-1}
                    >
                      {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>

                  {/* Password Strength Bar */}
                  {newPassword && (
                    <div className="mt-2">
                      <div className="flex gap-1 h-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <div
                            key={n}
                            className={`flex-1 rounded-full transition-all duration-300 ${
                              n <= strength.score ? strength.color : 'bg-zinc-200 dark:bg-zinc-700'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-1">
                        Strength:{' '}
                        <span
                          className={`font-semibold ${
                            strength.score <= 2
                              ? 'text-rose-500'
                              : strength.score === 3
                              ? 'text-amber-500'
                              : strength.score === 4
                              ? 'text-blue-500'
                              : 'text-emerald-500'
                          }`}
                        >
                          {strength.label}
                        </span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label
                    htmlFor="confirm-password"
                    className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5"
                  >
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                      <Lock size={15} />
                    </div>
                    <input
                      id="confirm-password"
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setErrorMessage('');
                      }}
                      placeholder="Repeat the password above"
                      autoComplete="new-password"
                      disabled={isSubmitting}
                      className={`w-full text-xs rounded-lg border bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 pl-9 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 ${
                        confirmPassword && newPassword !== confirmPassword
                          ? 'border-rose-400 dark:border-rose-700'
                          : confirmPassword && newPassword === confirmPassword
                          ? 'border-emerald-400 dark:border-emerald-700'
                          : 'border-zinc-200 dark:border-zinc-700'
                      }`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-[10px] text-rose-500 mt-1">Passwords do not match.</p>
                  )}
                  {confirmPassword && newPassword === confirmPassword && (
                    <p className="text-[10px] text-emerald-500 mt-1">Passwords match ✓</p>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  id="reset-password-submit"
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-2 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Resetting Password…</span>
                    </>
                  ) : (
                    <span>Reset Password</span>
                  )}
                </button>
              </form>
            )}

            {/* Navigation Links */}
            <div className="pt-2 text-center space-y-2">
              {pageState === 'invalid_token' && (
                <Link
                  to="/forgot-password"
                  className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  Request a new reset link
                </Link>
              )}
              <div>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium"
                >
                  <ArrowLeft size={13} />
                  Back to Sign In
                </Link>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 bg-zinc-50 dark:bg-zinc-850/60 border-t border-zinc-100 dark:border-zinc-800 text-center">
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              <ShieldCheck size={13} className="text-emerald-500" />
              <span>Secure Password Reset · Gold Mine Platform</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="w-full max-w-5xl mx-auto text-center py-2 text-[11px] text-zinc-400 dark:text-zinc-500">
        &copy; {new Date().getFullYear()} Inbox Infotech Pvt. Ltd. Ticketing &amp; Issue
        Tracking System.
      </div>
    </div>
  );
};
