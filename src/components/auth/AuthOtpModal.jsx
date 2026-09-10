import React, { useState, useEffect, useRef } from 'react';
import {
  sendEmailOtp,
  verifyEmailOtp,
  updateUserPassword,
  signInWithPassword,
  hasUserEstablishedPassword,
  getFriendlyAuthErrorMessage
} from '../../services/authService.js';

/**
 * CareLoop AuthOtpModal
 * ====================
 * Modal Steps:
 * 1. 'EMAIL'          - Enter email to request 6-digit OTP (with toggle to Password Login)
 * 2. 'OTP'            - Enter 6-digit verification code with 60s cooldown
 * 3. 'SET_PASSWORD'   - Post-OTP step: Create permanent password (with "Skip for now" option)
 * 4. 'PASSWORD_LOGIN' - Return user login via email & password (with toggle back to OTP)
 *
 * Adheres to CareLoop Calm Cloud Blue aesthetics:
 * - 56px+ tap target heights for senior accessibility
 * - border-slate-200, focus:border-blue-500, blue-600 action accents
 * - Safe sound effect hooks with fallbacks
 */
export function AuthOtpModal({
  isOpen = true,
  onClose = () => {},
  onAuthSuccess = () => {},
  initialEmail = ''
}) {
  const [step, setStep] = useState('EMAIL'); // 'EMAIL' | 'OTP' | 'SET_PASSWORD' | 'PASSWORD_LOGIN'
  const [email, setEmail] = useState(initialEmail || '');
  const [otpToken, setOtpToken] = useState('');
  
  // Password states
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status & loading states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Rate-limiting 60s cooldown for OTP requests
  const [cooldown, setCooldown] = useState(0);
  const cooldownTimerRef = useRef(null);

  // Stored auth data across steps
  const [verifiedAuthData, setVerifiedAuthData] = useState(null);

  // Sync initialEmail if provided
  useEffect(() => {
    if (initialEmail && !email) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  // Handle countdown timer
  useEffect(() => {
    if (cooldown > 0) {
      cooldownTimerRef.current = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(cooldownTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, [cooldown]);

  // Safe sound player helper
  const playSound = (type) => {
    try {
      if (type === 'pop') window.careLoopSound?.playPop?.();
      else if (type === 'success') window.careLoopSound?.playSuccess?.();
      else if (type === 'error') window.careLoopSound?.playError?.();
      else window.careLoopSound?.playClick?.();
    } catch (_) {}
  };

  // Start 60s cooldown
  const triggerCooldown = (sec = 60) => {
    setCooldown(sec);
  };

  // Reset fields when changing steps
  const goToStep = (nextStep) => {
    setErrorMsg('');
    setSuccessMsg('');
    setStep(nextStep);
  };

  // --------------------------------------------------------------------------
  // STEP 1: SEND EMAIL OTP
  // --------------------------------------------------------------------------
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!email || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      playSound('error');
      return;
    }

    if (cooldown > 0) {
      setErrorMsg(`Please wait ${cooldown}s before requesting another code.`);
      return;
    }

    setLoading(true);
    try {
      await sendEmailOtp(email);
      playSound('pop');
      triggerCooldown(60);
      setSuccessMsg(`Verification code sent to ${email}`);
      goToStep('OTP');
    } catch (err) {
      setErrorMsg(getFriendlyAuthErrorMessage(err));
      playSound('error');
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // STEP 2: VERIFY OTP TOKEN & DECIDE NEXT TRANSITION
  // --------------------------------------------------------------------------
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const tokenClean = otpToken.trim();
    if (tokenClean.length < 6) {
      setErrorMsg('Please enter the full 6-digit verification code.');
      playSound('error');
      return;
    }

    setLoading(true);
    try {
      const data = await verifyEmailOtp(email, tokenClean);
      playSound('success');

      setVerifiedAuthData(data);

      // Inspect whether the user already has password authentication established
      const user = data?.user;
      const hasPassword = hasUserEstablishedPassword(user);

      if (!hasPassword) {
        // Transition to SET_PASSWORD rather than calling onClose() immediately
        goToStep('SET_PASSWORD');
      } else {
        // User already has a password established -> Finish auth
        onAuthSuccess({ session: data?.session, user: data?.user });
        onClose();
      }
    } catch (err) {
      setErrorMsg(getFriendlyAuthErrorMessage(err));
      playSound('error');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP handler inside OTP step
  const handleResendOtp = async () => {
    if (cooldown > 0) return;
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);
    try {
      await sendEmailOtp(email);
      playSound('pop');
      triggerCooldown(60);
      setSuccessMsg(`A fresh 6-digit code has been sent to ${email}.`);
    } catch (err) {
      setErrorMsg(getFriendlyAuthErrorMessage(err));
      playSound('error');
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // STEP 3: SET PERMANENT PASSWORD (POST-OTP)
  // --------------------------------------------------------------------------
  const handleSetPassword = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!newPassword || newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      playSound('error');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter.');
      playSound('error');
      return;
    }

    setLoading(true);
    try {
      const updatedData = await updateUserPassword(newPassword);
      playSound('success');

      const finalUser = updatedData?.user || verifiedAuthData?.user;
      const session = verifiedAuthData?.session;

      // Invoke onAuthSuccess and close the modal
      onAuthSuccess({ session, user: finalUser });
      onClose();
    } catch (err) {
      setErrorMsg(getFriendlyAuthErrorMessage(err));
      playSound('error');
    } finally {
      setLoading(false);
    }
  };

  // Skip password creation (for users who prefer OTP exclusively)
  const handleSkipPassword = () => {
    playSound('click');
    onAuthSuccess({
      session: verifiedAuthData?.session,
      user: verifiedAuthData?.user
    });
    onClose();
  };

  // --------------------------------------------------------------------------
  // STEP 4: PASSWORD SIGN-IN (RETURN USERS)
  // --------------------------------------------------------------------------
  const handlePasswordLogin = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!email || !email.includes('@')) {
      setErrorMsg('Please enter your valid registered email.');
      playSound('error');
      return;
    }

    if (!password) {
      setErrorMsg('Please enter your password.');
      playSound('error');
      return;
    }

    setLoading(true);
    try {
      const data = await signInWithPassword(email, password);
      playSound('success');
      onAuthSuccess({ session: data?.session, user: data?.user });
      onClose();
    } catch (err) {
      setErrorMsg(getFriendlyAuthErrorMessage(err));
      playSound('error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md transition-opacity animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-[440px] bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden text-slate-900 font-sans transition-all transform animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Strip — Calm Cloud Blue Aesthetic */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-50/80 to-slate-50 border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <span className="material-symbols-outlined text-2xl">spa</span>
            </div>
            <div>
              <div className="font-bold text-base text-slate-900 tracking-tight flex items-center gap-1.5">
                CareLoop
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              </div>
              <div className="text-[11px] font-medium text-slate-500 tracking-wide uppercase">
                {step === 'SET_PASSWORD'
                  ? 'Security Setup'
                  : step === 'PASSWORD_LOGIN'
                  ? 'Password Access'
                  : 'Cognitive Care Login'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-9 h-9 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-300 hover:bg-slate-100 flex items-center justify-center transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Modal Body Container */}
        <div className="p-6 md:p-7">
          {/* Status Message Banners */}
          {errorMsg && (
            <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-start gap-2.5 animate-shake">
              <span className="material-symbols-outlined text-base text-red-500 flex-shrink-0 mt-0.5">error</span>
              <span className="flex-1 leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-start gap-2.5">
              <span className="material-symbols-outlined text-base text-emerald-500 flex-shrink-0 mt-0.5">check_circle</span>
              <span className="flex-1 leading-relaxed">{successMsg}</span>
            </div>
          )}

          {/* ================================================================ */}
          {/* SCREEN 1: 'EMAIL' (Request 6-Digit OTP)                         */}
          {/* ================================================================ */}
          {step === 'EMAIL' && (
            <div>
              <div className="mb-5">
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Sign In to CareLoop</h2>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                  Enter your email to receive a secure 6-digit verification code.
                </p>
              </div>

              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="caregiver@family.org"
                      className="w-full min-h-[56px] h-14 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-base font-normal outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
                    />
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">
                      mail
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || cooldown > 0}
                  className={`w-full min-h-[56px] h-14 rounded-xl font-bold text-base text-white flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer ${
                    loading || cooldown > 0
                      ? 'bg-slate-300 text-slate-500 shadow-none cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.99] shadow-blue-600/25'
                  }`}
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>{cooldown > 0 ? `Resend code in ${cooldown}s` : 'Send 6-Digit OTP'}</span>
                      <span className="material-symbols-outlined text-xl">send</span>
                    </>
                  )}
                </button>
              </form>

              {/* Password Login Toggle Option */}
              <div className="mt-6 pt-5 border-t border-slate-100 text-center">
                <button
                  type="button"
                  onClick={() => goToStep('PASSWORD_LOGIN')}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg">key</span>
                  <span>Sign in with Password instead</span>
                </button>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* SCREEN 2: 'OTP' (Verify 6-Digit Code)                          */}
          {/* ================================================================ */}
          {step === 'OTP' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={() => goToStep('EMAIL')}
                  className="text-slate-500 hover:text-blue-600 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors p-1 -ml-1"
                >
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                  <span>Change email</span>
                </button>
                <span className="text-[11px] font-mono font-medium text-slate-400 uppercase tracking-wider">Step 2 / 3</span>
              </div>

              <div className="mb-5">
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Enter Verification Code</h2>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                  We sent a 6-digit code to <strong className="text-slate-800 font-semibold">{email}</strong>.
                </p>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-center text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wider">
                    6-Digit Security Token
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    pattern="[0-9]*"
                    autoFocus
                    value={otpToken}
                    onChange={(e) => setOtpToken(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full min-h-[56px] h-16 text-center text-3xl font-mono font-bold tracking-[10px] bg-slate-50 border-2 border-blue-500 rounded-2xl text-slate-900 outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/15 transition-all placeholder:text-slate-300"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || otpToken.length < 6}
                  className={`w-full min-h-[56px] h-14 rounded-xl font-bold text-base text-white flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer ${
                    loading || otpToken.length < 6
                      ? 'bg-slate-300 text-slate-500 shadow-none cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.99] shadow-blue-600/25'
                  }`}
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>Verify Code</span>
                      <span className="material-symbols-outlined text-xl">verified_user</span>
                    </>
                  )}
                </button>
              </form>

              <div className="mt-5 flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
                <span>Didn't receive the email?</span>
                <button
                  type="button"
                  disabled={cooldown > 0 || loading}
                  onClick={handleResendOtp}
                  className={`font-semibold cursor-pointer transition-colors ${
                    cooldown > 0 ? 'text-slate-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-800 underline'
                  }`}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
                </button>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* SCREEN 3: 'SET_PASSWORD' (Post-OTP Permanent Password Setup)     */}
          {/* ================================================================ */}
          {step === 'SET_PASSWORD' && (
            <div>
              <div className="mb-5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold mb-2.5">
                  <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span>
                  OTP Verified Successfully
                </div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Create Permanent Password</h2>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                  Establish a password so you can sign in directly on your next visit without waiting for an email code.
                </p>
              </div>

              <form onSubmit={handleSetPassword} className="space-y-4">
                {/* Create Password Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                    Create Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full min-h-[56px] h-14 pl-12 pr-12 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-base outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
                    />
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">
                      lock
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-xl">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Confirm Password Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full min-h-[56px] h-14 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-base outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
                    />
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">
                      lock_reset
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || newPassword.length < 6 || newPassword !== confirmPassword}
                  className={`w-full min-h-[56px] h-14 rounded-xl font-bold text-base text-white flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer ${
                    loading || newPassword.length < 6 || newPassword !== confirmPassword
                      ? 'bg-slate-300 text-slate-500 shadow-none cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.99] shadow-blue-600/25'
                  }`}
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>Save Password & Continue</span>
                      <span className="material-symbols-outlined text-xl">arrow_forward</span>
                    </>
                  )}
                </button>
              </form>

              {/* Optional Skip Link */}
              <div className="mt-5 text-center">
                <button
                  type="button"
                  onClick={handleSkipPassword}
                  className="text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors cursor-pointer py-1"
                >
                  Skip for now (continue using OTP exclusively)
                </button>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* SCREEN 4: 'PASSWORD_LOGIN' (Return Users Password Sign-In)       */}
          {/* ================================================================ */}
          {step === 'PASSWORD_LOGIN' && (
            <div>
              <div className="mb-5">
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Sign In with Password</h2>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                  Enter your registered CareLoop credentials to access your portal.
                </p>
              </div>

              <form onSubmit={handlePasswordLogin} className="space-y-4">
                {/* Email Address */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="caregiver@family.org"
                      className="w-full min-h-[56px] h-14 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-base outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
                    />
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">
                      mail
                    </span>
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full min-h-[56px] h-14 pl-12 pr-12 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-base outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
                    />
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">
                      lock
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-xl">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !email || !password}
                  className={`w-full min-h-[56px] h-14 rounded-xl font-bold text-base text-white flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer ${
                    loading || !email || !password
                      ? 'bg-slate-300 text-slate-500 shadow-none cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.99] shadow-blue-600/25'
                  }`}
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <span className="material-symbols-outlined text-xl">login</span>
                    </>
                  )}
                </button>
              </form>

              {/* Back to OTP Toggle Option */}
              <div className="mt-6 pt-5 border-t border-slate-100 text-center">
                <button
                  type="button"
                  onClick={() => goToStep('EMAIL')}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg">mail</span>
                  <span>Sign in with 6-Digit Email OTP instead</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AuthOtpModal;
