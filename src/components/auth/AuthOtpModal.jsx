import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient.js';
import {
  sendEmailOtp,
  verifyEmailOtp,
  updateUserPassword,
  signInWithPassword,
  saveCareProfile,
  getCurrentUser,
  getSession
} from '../../services/authService.js';

/**
 * CareLoop AuthOtpModal
 * ====================
 * Strict 4-Step Sequence:
 * 1. EMAIL          - Email OTP request with toggle to PASSWORD_LOGIN.
 * 2. OTP            - 6-digit numeric token verification (advances to SET_PASSWORD).
 * 3. SET_PASSWORD   - Create New Password & Confirm Password (advances to PROFILE_SETUP).
 * 4. PROFILE_SETUP  - Two-Column Layout:
 *                     • Column 1 (Patient): Patient Name, Age, Language, Notes
 *                     • Column 2 (Caregiver): Caregiver Name, Relationship, Phone Number
 *                     • Save Button: Wrapped in <form onSubmit={handleSave}>, type="submit",
 *                       h-14, active loading state, try/catch with visible raw error banner.
 */
export function AuthOtpModal({
  isOpen = true,
  onClose = () => {},
  onAuthSuccess = () => {},
  initialEmail = ''
}) {
  // Active Navigation Step: 'EMAIL' | 'PASSWORD_LOGIN' | 'OTP' | 'SET_PASSWORD' | 'PROFILE_SETUP'
  const [step, setStep] = useState('EMAIL');

  // Credentials
  const [email, setEmail] = useState(initialEmail || '');
  const [password, setPassword] = useState('');
  const [otpToken, setOtpToken] = useState('');

  // Password Configuration
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Profile Setup (Two Columns)
  // Column 1: Patient
  const [patientName, setPatientName] = useState('Kamala Sharma');
  const [age, setAge] = useState('74');
  const [language, setLanguage] = useState('English');
  const [notes, setNotes] = useState('Mild Cognitive Impairment (Early Memory Support)');

  // Column 2: Caregiver
  const [caregiverName, setCaregiverName] = useState('Rahul Sharma');
  const [relationship, setRelationship] = useState('Daughter');
  const [caregiverPhone, setCaregiverPhone] = useState('+91 98765 43210');

  // Status & Error Banners
  const [loading, setLoading] = useState(false);
  const [rawError, setRawError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 60-Second Cooldown Timer for OTP
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef(null);

  // Authenticated user tracking
  const [authenticatedUser, setAuthenticatedUser] = useState(null);

  // Sync initial email
  useEffect(() => {
    if (initialEmail && !email) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  // Handle countdown interval
  useEffect(() => {
    if (cooldown > 0) {
      cooldownRef.current = setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) {
            clearInterval(cooldownRef.current);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
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

  const goToStep = (nextStep) => {
    setRawError('');
    setSuccessMsg('');
    setStep(nextStep);
  };

  // --------------------------------------------------------------------------
  // STEP 1: SEND EMAIL OTP
  // --------------------------------------------------------------------------
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setRawError('');
    setSuccessMsg('');

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setRawError('Please enter a valid email address.');
      playSound('error');
      return;
    }

    if (cooldown > 0) {
      setRawError(`Please wait ${cooldown}s before requesting another code.`);
      return;
    }

    setLoading(true);
    try {
      await sendEmailOtp(cleanEmail);
      playSound('pop');
      setCooldown(60);
      setSuccessMsg(`A 6-digit verification code was sent to ${cleanEmail}`);
      goToStep('OTP');
    } catch (err) {
      console.error('[AuthOtpModal] sendEmailOtp error:', err);
      setRawError(err.message || String(err));
      playSound('error');
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // DIRECT PASSWORD LOGIN (RETURNING USERS)
  // --------------------------------------------------------------------------
  const handlePasswordLogin = async (e) => {
    if (e) e.preventDefault();
    setRawError('');
    setSuccessMsg('');

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setRawError('Please enter a valid email address.');
      playSound('error');
      return;
    }

    if (!password) {
      setRawError('Please enter your password.');
      playSound('error');
      return;
    }

    setLoading(true);
    try {
      const data = await signInWithPassword(cleanEmail, password);
      playSound('success');
      setAuthenticatedUser(data?.user);
      goToStep('PROFILE_SETUP');
    } catch (err) {
      console.error('[AuthOtpModal] signInWithPassword error:', err);
      setRawError(err.message || String(err));
      playSound('error');
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // STEP 2: VERIFY 6-DIGIT OTP
  // --------------------------------------------------------------------------
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    setRawError('');
    setSuccessMsg('');

    const cleanToken = otpToken.trim();
    if (cleanToken.length < 6) {
      setRawError('Please enter the full 6-digit verification code.');
      playSound('error');
      return;
    }

    setLoading(true);
    try {
      const data = await verifyEmailOtp(email, cleanToken);
      playSound('success');
      setAuthenticatedUser(data?.user);

      // Advance directly to password configuration
      goToStep('SET_PASSWORD');
    } catch (err) {
      console.error('[AuthOtpModal] verifyEmailOtp error:', err);
      setRawError(err.message || String(err));
      playSound('error');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP handler
  const handleResendOtp = async () => {
    if (cooldown > 0 || loading) return;
    setRawError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      await sendEmailOtp(email);
      playSound('pop');
      setCooldown(60);
      setSuccessMsg(`A fresh verification code was sent to ${email}.`);
    } catch (err) {
      setRawError(err.message || String(err));
      playSound('error');
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // STEP 3: SET PASSWORD (POST-OTP)
  // --------------------------------------------------------------------------
  const handleSetPassword = async (e) => {
    if (e) e.preventDefault();
    setRawError('');
    setSuccessMsg('');

    if (!newPassword || newPassword.length < 6) {
      setRawError('Password must contain at least 6 characters.');
      playSound('error');
      return;
    }

    if (newPassword !== confirmPassword) {
      setRawError('Passwords do not match. Please verify your entries.');
      playSound('error');
      return;
    }

    setLoading(true);
    try {
      const updated = await updateUserPassword(newPassword);
      playSound('success');
      if (updated?.user) {
        setAuthenticatedUser(updated.user);
      }
      goToStep('PROFILE_SETUP');
    } catch (err) {
      console.error('[AuthOtpModal] updateUserPassword error:', err);
      setRawError(err.message || String(err));
      playSound('error');
    } finally {
      setLoading(false);
    }
  };

  // Skip password configuration
  const handleSkipPassword = () => {
    playSound('click');
    goToStep('PROFILE_SETUP');
  };

  // --------------------------------------------------------------------------
  // STEP 4: DUAL-COLUMN PROFILE SETUP (<form onSubmit={handleSave}>)
  // --------------------------------------------------------------------------
  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setRawError('');
    setSuccessMsg('');

    // Input validation with visual raw error banner feedback
    if (!patientName || !patientName.trim()) {
      setRawError("Please enter the patient's full name.");
      playSound('error');
      return;
    }

    const parsedAge = age && !isNaN(age) ? parseInt(age, 10) : null;
    if (parsedAge === null || parsedAge < 1 || parsedAge > 125) {
      setRawError('Please enter a valid age between 1 and 125.');
      playSound('error');
      return;
    }

    if (!caregiverName || !caregiverName.trim()) {
      setRawError("Please enter the caregiver's full name.");
      playSound('error');
      return;
    }

    if (!caregiverPhone || !caregiverPhone.trim()) {
      setRawError('Please enter an emergency contact phone number.');
      playSound('error');
      return;
    }

    setLoading(true);
    try {
      // 1. Ensure the user ID is valid from active authenticated session
      const user = (await supabase.auth.getUser())?.data?.user;
      if (!user?.id) {
        throw new Error("No active authenticated user session found");
      }

      // 2. Sanitize payload before upserting (NEVER send empty string "" for age)
      const profilePayload = {
        id: user.id,
        full_name: patientName.trim(),
        name: patientName.trim(),
        age: parsedAge,
        role: 'caregiver',
        preferred_language: language || 'English',
        phone: caregiverPhone.trim(),
        relationship: relationship || 'Daughter',
        notes: notes.trim()
      };

      // 3. Upsert matching database columns safely
      const { data, error } = await supabase
        .from('profiles')
        .upsert(profilePayload, { onConflict: 'id' });

      if (error) {
        setRawError(`${error.message} (${error.code || '400'})`);
        throw error;
      }

      // Persist to user metadata for session synchronization
      try {
        await supabase.auth.updateUser({
          data: {
            full_name: profilePayload.full_name,
            patient_name: profilePayload.full_name,
            age: profilePayload.age,
            preferred_language: profilePayload.preferred_language,
            caregiver_name: caregiverName.trim(),
            relationship: profilePayload.relationship,
            phone: profilePayload.phone,
            notes: profilePayload.notes
          }
        });
      } catch (metaErr) {
        console.warn('[AuthOtpModal] Metadata update notice:', metaErr.message);
      }

      // Mirror to localStorage for offline resilience
      try {
        localStorage.setItem('careloop_user_profile', JSON.stringify({
          ...profilePayload,
          caregiver_name: caregiverName.trim()
        }));
        localStorage.setItem('careloop_patient_name', profilePayload.full_name || 'Patient');
        localStorage.setItem('careloop_app_language', profilePayload.preferred_language);
        localStorage.setItem('careloop_authenticated', 'true');
      } catch (_) {}

      playSound('success');

      // 4. On success call onAuthSuccess() and close modal
      const session = await getSession();
      if (onAuthSuccess) {
        onAuthSuccess({
          session,
          user,
          data,
          profile: {
            patientName: patientName.trim(),
            age: parsedAge,
            language,
            notes: notes.trim(),
            caregiverName: caregiverName.trim(),
            relationship,
            caregiverPhone: caregiverPhone.trim()
          }
        });
      }

      if (onClose) {
        onClose();
      }
    } catch (err) {
      // Surface raw error string visually in red banner instead of freezing
      console.error('[AuthOtpModal] handleSave error:', err);
      setRawError(`${err.message} (${err.code || '400'})`);
      playSound('error');
    } finally {
      // Re-enable button so it is never permanently unclickable
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-sm transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        className={`w-full ${
          step === 'PROFILE_SETUP' ? 'max-w-3xl' : 'max-w-md'
        } bg-white rounded-3xl border border-slate-200 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-900 font-sans transition-all duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Strip */}
        <header className="px-6 py-4 bg-gradient-to-r from-blue-50/90 to-slate-50 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20">
              <span className="material-symbols-outlined text-2xl">spa</span>
            </div>
            <div>
              <div className="font-bold text-base text-slate-900 tracking-tight flex items-center gap-1.5">
                CareLoop
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              </div>
              <div className="text-[11px] font-medium text-slate-500 tracking-wide uppercase">
                {step === 'PROFILE_SETUP'
                  ? 'Step 4: Profile Onboarding'
                  : step === 'SET_PASSWORD'
                  ? 'Step 3: Security Setup'
                  : step === 'PASSWORD_LOGIN'
                  ? 'Password Sign-In'
                  : step === 'OTP'
                  ? 'Step 2: Token Verification'
                  : 'Step 1: Sign In'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="w-10 h-10 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-800 hover:border-slate-300 hover:bg-slate-100 flex items-center justify-center transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </header>

        {/* Scrollable Body Content */}
        <main className="p-6 md:p-8 overflow-y-auto overscroll-contain flex-1">
          {/* Raw Error Banner */}
          {rawError && (
            <div
              role="alert"
              className="bg-red-50 text-red-600 p-3 rounded-xl border border-red-200 text-sm font-medium flex items-start gap-2.5 mb-5"
            >
              <span className="material-symbols-outlined text-lg flex-shrink-0 mt-0.5">error</span>
              <div className="flex-1 leading-relaxed break-words">{rawError}</div>
            </div>
          )}

          {/* Success Banner */}
          {successMsg && (
            <div
              role="status"
              className="bg-emerald-50 text-emerald-800 p-3 rounded-xl border border-emerald-200 text-sm font-medium flex items-start gap-2.5 mb-5"
            >
              <span className="material-symbols-outlined text-lg flex-shrink-0 mt-0.5 text-emerald-600">check_circle</span>
              <div className="flex-1 leading-relaxed">{successMsg}</div>
            </div>
          )}

          {/* ================================================================ */}
          {/* STEP 1: EMAIL (Request OTP via signInWithOtp)                     */}
          {/* ================================================================ */}
          {step === 'EMAIL' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Sign In to CareLoop</h2>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                  Enter your email to receive a secure 6-digit authentication code.
                </p>
              </div>

              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label htmlFor="auth-email" className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wider">
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      id="auth-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="caregiver@family.org"
                      className="w-full h-14 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-base outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
                    />
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">
                      mail
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || cooldown > 0}
                  className={`w-full h-14 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer ${
                    loading || cooldown > 0
                      ? 'bg-slate-300 text-slate-500 shadow-none cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.99] shadow-blue-600/25'
                  }`}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                      <span>Sending Code...</span>
                    </div>
                  ) : (
                    <>
                      <span>{cooldown > 0 ? `Resend in ${cooldown}s` : 'Send 6-Digit OTP'}</span>
                      <span className="material-symbols-outlined text-xl">send</span>
                    </>
                  )}
                </button>
              </form>

              {/* Toggle to Password Login */}
              <div className="mt-6 pt-5 border-t border-slate-100 text-center">
                <button
                  type="button"
                  onClick={() => goToStep('PASSWORD_LOGIN')}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors inline-flex items-center gap-2 cursor-pointer p-2"
                >
                  <span className="material-symbols-outlined text-lg">key</span>
                  <span>Sign in with Password instead</span>
                </button>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* PASSWORD LOGIN (Returning Users via signInWithPassword)           */}
          {/* ================================================================ */}
          {step === 'PASSWORD_LOGIN' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Sign In with Password</h2>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                  Enter your registered CareLoop credentials to access your portal.
                </p>
              </div>

              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <div>
                  <label htmlFor="login-email" className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wider">
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      id="login-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="caregiver@family.org"
                      className="w-full h-14 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-base outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
                    />
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">
                      mail
                    </span>
                  </div>
                </div>

                <div>
                  <label htmlFor="login-password" className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wider">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full h-14 pl-12 pr-12 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-base outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
                    />
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">
                      lock
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                    >
                      <span className="material-symbols-outlined text-xl">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full h-14 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer ${
                    loading
                      ? 'bg-slate-300 text-slate-500 shadow-none cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.99] shadow-blue-600/25'
                  }`}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                      <span>Signing in...</span>
                    </div>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <span className="material-symbols-outlined text-xl">login</span>
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-slate-100 text-center">
                <button
                  type="button"
                  onClick={() => goToStep('EMAIL')}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors inline-flex items-center gap-2 cursor-pointer p-2"
                >
                  <span className="material-symbols-outlined text-lg">mail</span>
                  <span>Sign in with 6-Digit Email OTP instead</span>
                </button>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* STEP 2: OTP (Verify 6-Digit Token via verifyEmailOtp)             */}
          {/* ================================================================ */}
          {step === 'OTP' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <button
                  type="button"
                  onClick={() => goToStep('EMAIL')}
                  className="text-slate-500 hover:text-blue-600 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors p-1"
                >
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                  <span>Change email</span>
                </button>
                <span className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">Step 2 of 4</span>
              </div>

              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Enter Verification Code</h2>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                  A 6-digit numeric token was dispatched to <strong className="text-slate-900 font-semibold">{email}</strong>.
                </p>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label htmlFor="otp-token" className="block text-center text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wider">
                    6-Digit Security Token
                  </label>
                  <input
                    id="otp-token"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    pattern="[0-9]*"
                    autoFocus
                    value={otpToken}
                    onChange={(e) => setOtpToken(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full h-16 text-center text-3xl font-mono font-bold tracking-[10px] bg-slate-50 border-2 border-blue-500 rounded-2xl text-slate-900 outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/15 transition-all placeholder:text-slate-300"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || otpToken.length < 6}
                  className={`w-full h-14 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer ${
                    loading || otpToken.length < 6
                      ? 'bg-slate-300 text-slate-500 shadow-none cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.99] shadow-blue-600/25'
                  }`}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                      <span>Verifying Code...</span>
                    </div>
                  ) : (
                    <>
                      <span>Verify Code</span>
                      <span className="material-symbols-outlined text-xl">verified_user</span>
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 flex items-center justify-between text-xs text-slate-500 pt-4 border-t border-slate-100">
                <span>Didn't receive the email?</span>
                <button
                  type="button"
                  disabled={cooldown > 0 || loading}
                  onClick={handleResendOtp}
                  className={`font-semibold cursor-pointer transition-colors p-1 ${
                    cooldown > 0 ? 'text-slate-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-800 underline'
                  }`}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
                </button>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* STEP 3: SET_PASSWORD (Inputs for New & Confirm Password)         */}
          {/* ================================================================ */}
          {step === 'SET_PASSWORD' && (
            <div>
              <div className="mb-6">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold mb-3">
                  <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span>
                  OTP Token Verified
                </div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Create Permanent Password</h2>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                  Set a password to sign in directly on future visits without requesting an email code.
                </p>
              </div>

              <form onSubmit={handleSetPassword} className="space-y-4">
                <div>
                  <label htmlFor="new-password" className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wider">
                    New Password (min 6 characters)
                  </label>
                  <div className="relative">
                    <input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="w-full h-14 pl-12 pr-12 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-base outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
                    />
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">
                      lock
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                    >
                      <span className="material-symbols-outlined text-xl">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirm-password" className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wider">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      id="confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full h-14 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-base outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
                    />
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">
                      lock_reset
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full h-14 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer ${
                    loading
                      ? 'bg-slate-300 text-slate-500 shadow-none cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.99] shadow-blue-600/25'
                  }`}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                      <span>Updating Credentials...</span>
                    </div>
                  ) : (
                    <>
                      <span>Save Password & Continue</span>
                      <span className="material-symbols-outlined text-xl">arrow_forward</span>
                    </>
                  )}
                </button>
              </form>

              <div className="mt-5 text-center">
                <button
                  type="button"
                  onClick={handleSkipPassword}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer py-2 px-3 rounded-lg hover:bg-slate-100 inline-block"
                >
                  Skip for now (continue using OTP exclusively)
                </button>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* STEP 4: PROFILE_SETUP (Two-Column Layout for Patient & Caregiver)  */}
          {/* ================================================================ */}
          {step === 'PROFILE_SETUP' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Care Profile Onboarding</h2>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                  Provide patient and caregiver details to customize care assistance, games, and emergency contacts.
                </p>
              </div>

              {/* Proper Form Wrapper */}
              <form onSubmit={handleSave} className="space-y-6">
                {/* Two-Column Responsive Layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                  {/* COLUMN 1: PATIENT DETAILS */}
                  <div className="p-5 rounded-2xl bg-blue-50/40 border border-blue-100 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-blue-100/80">
                      <span className="material-symbols-outlined text-xl text-blue-600">elderly</span>
                      <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider">Patient Details</h3>
                    </div>

                    {/* Patient Name */}
                    <div>
                      <label htmlFor="patient-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Patient Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="patient-name"
                        type="text"
                        required
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        placeholder="e.g. Kamala Sharma"
                        className="w-full h-14 px-4 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
                      />
                    </div>

                    {/* Age */}
                    <div>
                      <label htmlFor="patient-age" className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Age <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="patient-age"
                        type="number"
                        min="1"
                        max="125"
                        required
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        placeholder="74"
                        className="w-full h-14 px-4 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
                      />
                    </div>

                    {/* Language Dropdown */}
                    <div>
                      <label htmlFor="patient-language" className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Preferred Language
                      </label>
                      <div className="relative">
                        <select
                          id="patient-language"
                          value={language}
                          onChange={(e) => setLanguage(e.target.value)}
                          className="w-full h-14 pl-4 pr-10 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none cursor-pointer"
                        >
                          <option value="English">English</option>
                          <option value="Assamese">অসমীয়া (Assamese)</option>
                          <option value="Bodo">बड़ो (Bodo)</option>
                          <option value="Hindi">हिन्दी (Hindi)</option>
                        </select>
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xl">
                          expand_more
                        </span>
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <label htmlFor="patient-notes" className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Cognitive Stage / Care Notes
                      </label>
                      <input
                        id="patient-notes"
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="e.g. Mild memory loss"
                        className="w-full h-14 px-4 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* COLUMN 2: CAREGIVER DETAILS */}
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-200/80">
                      <span className="material-symbols-outlined text-xl text-slate-700">supervisor_account</span>
                      <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider">Caregiver Details</h3>
                    </div>

                    {/* Caregiver Name */}
                    <div>
                      <label htmlFor="caregiver-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Caregiver Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="caregiver-name"
                        type="text"
                        required
                        value={caregiverName}
                        onChange={(e) => setCaregiverName(e.target.value)}
                        placeholder="e.g. Rahul Sharma"
                        className="w-full h-14 px-4 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
                      />
                    </div>

                    {/* Relationship Dropdown */}
                    <div>
                      <label htmlFor="caregiver-relationship" className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Relationship to Patient
                      </label>
                      <div className="relative">
                        <select
                          id="caregiver-relationship"
                          value={relationship}
                          onChange={(e) => setRelationship(e.target.value)}
                          className="w-full h-14 pl-4 pr-10 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none cursor-pointer"
                        >
                          <option value="Daughter">Daughter</option>
                          <option value="Son">Son</option>
                          <option value="Spouse">Spouse</option>
                          <option value="Sister">Sister</option>
                          <option value="Brother">Brother</option>
                          <option value="Healthcare Aide">Healthcare Aide / Nurse</option>
                          <option value="Other">Other Family / Guardian</option>
                        </select>
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xl">
                          expand_more
                        </span>
                      </div>
                    </div>

                    {/* Phone Number */}
                    <div>
                      <label htmlFor="caregiver-phone" className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Caregiver Phone Number <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          id="caregiver-phone"
                          type="tel"
                          required
                          value={caregiverPhone}
                          onChange={(e) => setCaregiverPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          className="w-full h-14 pl-12 pr-4 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
                        />
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">
                          call
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 text-slate-600 text-xs flex items-start gap-2">
                      <span className="material-symbols-outlined text-base text-blue-600 flex-shrink-0 mt-0.5">info</span>
                      <span>Configured as the patient's primary one-touch speed dial contact.</span>
                    </div>
                  </div>
                </div>

                {/* Submit Button (Explicit type="submit", h-14, cursor-pointer, active loading state) */}
                <div className="pt-2">
                  <button
                    type="submit"
                    id="save-profile-btn"
                    disabled={loading}
                    className={`w-full h-14 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer ${
                      loading
                        ? 'bg-blue-400 text-white cursor-wait'
                        : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.99] shadow-blue-600/25'
                    }`}
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                        <span>Saving Profile & Initializing App...</span>
                      </div>
                    ) : (
                      <>
                        <span>Save &amp; Enter App</span>
                        <span className="material-symbols-outlined text-xl">login</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default AuthOtpModal;
