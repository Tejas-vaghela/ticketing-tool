import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../services/api';
import { InboxLogo } from '../components/common/InboxLogo';
import {
  Mail,
  ArrowLeft,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  KeyRound,
} from 'lucide-react';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const validateEmail = (value: string): string => {
    if (!value.trim()) return 'Please enter your email address.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))
      return 'Please enter a valid email address.';
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const validationError = validateEmail(email);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await authApi.forgotPassword(email.trim());
      setSuccessMessage(
        response.message ||
          'If an account exists for that email, a reset link has been sent.',
      );
      setEmail('');
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred. Please try again.';
      // Rate-limit detection
      if (msg.includes('429') || msg.toLowerCase().includes('too many')) {
        setErrorMessage(
          'Too many requests. Please wait a few minutes before trying again.',
        );
      } else if (msg.includes('503') || msg.toLowerCase().includes('unavailable')) {
        setErrorMessage('Service is temporarily unavailable. Please try again shortly.');
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
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950/60 mb-3">
              <KeyRound size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Forgot Password
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xs mx-auto">
              Enter your registered work email and we'll send you a secure
              reset link.
            </p>
          </div>

          {/* Form Content */}
          <div className="p-6 sm:p-8 space-y-5">
            {/* Success State */}
            {successMessage && (
              <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-3 animate-fadeIn">
                <CheckCircle2
                  size={18}
                  className="shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5"
                />
                <div>
                  <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                    Request Received
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                    {successMessage}
                  </p>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-2">
                    <strong>Development mode:</strong> Check the backend server
                    console for the reset link.
                  </p>
                </div>
              </div>
            )}

            {/* Error State */}
            {errorMessage && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 animate-fadeIn">
                <AlertCircle size={16} className="shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {!successMessage && (
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {/* Email Input */}
                <div>
                  <label
                    htmlFor="forgot-email"
                    className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5"
                  >
                    Work Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                      <Mail size={15} />
                    </div>
                    <input
                      id="forgot-email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setErrorMessage('');
                      }}
                      placeholder="name@inbox.GoldMine.io"
                      autoComplete="email"
                      disabled={isSubmitting}
                      className="w-full text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      required
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  id="forgot-password-submit"
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-2 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Sending Reset Link…</span>
                    </>
                  ) : (
                    <span>Send Reset Link</span>
                  )}
                </button>
              </form>
            )}

            {/* Back to login */}
            <div className="pt-2 text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                <ArrowLeft size={13} />
                Back to Sign In
              </Link>
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
