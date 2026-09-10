import React, { useState, useEffect, useRef } from 'react';
import {
  sendEmailOtp,
  verifyEmailOtp,
  updateUserPassword,
  signInWithPassword,
  upsertProfile,
  getCurrentUser,
  getSession,
  getFriendlyAuthErrorMessage
} from '../../services/authService.js';

/**
 * CareLoop AuthOtpModal
 * ====================
 * Comprehensive 5-Stage Authentication & Onboarding Pipeline:
 *
 * 1. 'EMAIL'          - Request 6-digit OTP via email with 60s cooldown.
 *                       Toggle option to switch to 'PASSWORD_LOGIN'.
 * 2. 'PASSWORD_LOGIN' - Direct email + password login for returning users.
 *                       Toggle option to switch back to 'EMAIL'.
 * 3. 'OTP'            - Enter 6-digit verification code. Immediately advances to 'SET_PASSWORD'.
 * 4. 'SET_PASSWORD'   - Post-OTP password setup with confirmation (min 6 chars).
 *                       "Skip for now" link advances directly to 'PROFILE_SETUP'.
 * 5. 'PROFILE_SETUP'  - Dual-column responsive grid (md:grid-cols-2):
 *                       • Column 1 (Patient): Name, Age, Preferred Language (English, Assamese, Bodo, Hindi), Cognitive Stage/Notes.
 *                       • Column 2 (Caregiver): Name, Relationship dropdown, Emergency Contact Phone.
 *                       • Save Profile: Upserts all 8 fields into Supabase `profiles` table.
 *
 * Accessibility & UX:
 * - 56px+ minimum tap target height (h-14 / min-h-[56px]) on all inputs & buttons
 * - Calm Cloud Blue palette (blue-600, slate-900, slate-200, focus:border-blue-500)
 * - Explicit button types (type="submit" / type="button")
 * - Dedicated error banner surfacing Supabase errors visually
 * - Non-blocking scrollable dialog layout (no unclickable Save button bugs)
 */
export function AuthOtpModal({
  isOpen = true,
  onClose = () => {},
  onAuthSuccess = () => {},
  initialEmail = ''
}) {
  // Modal Navigation Step: 'EMAIL' | 'PASSWORD_LOGIN' | 'OTP' | 'SET_PASSWORD' | 'PROFILE_SETUP'
  const [step, setStep] = useState('EMAIL');

  // Step 1 & 2: Credentials
  const [email, setEmail] = useState(initialEmail || '');
  const [password, setPassword] = useState('');
  const [otpToken, setOtpToken] = useState('');

  // Step 3: Password Creation
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Step 5: Dual Profile Details
  const [patientName, setPatientName] = useState('Kamala Sharma');
  const [patientAge, setPatientAge] = useState('74');
  const [preferredLanguage, setPreferredLanguage] = useState('en');
  const [cognitiveNotes, setCognitiveNotes] = useState('Mild Cognitive Impairment (Early Memory Support)');

  const [caregiverName, setCaregiverName] = useState('Rahul Sharma');
  const [caregiverRelationship, setCaregiverRelationship] = useState('Daughter');
  const [caregiverPhone, setCaregiverPhone] = useState('+91 98765 43210');

  // UI, Loading & Notification Banners
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 60-Second Cooldown Timer for OTP Requests
  const [cooldown, setCooldown] = useState(0);
  const cooldownTimerRef = useRef(null);

  // Cached Session & User data across steps
  const [activeSession, setActiveSession] = useState(null);
  const [activeUser, setActiveUser] = useState(null);

  // Sync initialEmail if provided
  useEffect(() => {
    if (initialEmail && !email) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  // Handle countdown interval
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

  // Safe sound feedback with defensive fallbacks
  const playSound = (type) => {
    try {
      if (type === 'pop') window.careLoopSound?.playPop?.();
      else if (type === 'success') window.careLoopSound?.playSuccess?.();
      else if (type === 'error') window.careLoopSound?.playError?.();
      else window.careLoopSound?.playClick?.();
    } catch (_) {}
  };

  const startCooldown = (seconds = 60) => {
    setCooldown(seconds);
  };

  const navigateToStep = (nextStep) => {
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

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      playSound('error');
      return;
    }

    if (cooldown > 0) {
      setErrorMsg(`Please wait ${cooldown} seconds before requesting another code.`);
      return;
    }

    setLoading(true);
    try {
      await sendEmailOtp(cleanEmail);
      playSound('pop');
      startCooldown(60);
      setSuccessMsg(`Verification code sent to ${cleanEmail}`);
      navigateToStep('OTP');
    } catch (err) {
      setErrorMsg(getFriendlyAuthErrorMessage(err));
      playSound('error');
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // STEP 2: PASSWORD LOGIN FOR RETURNING USERS
  // --------------------------------------------------------------------------
  const handlePasswordLogin = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter your valid registered email address.');
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
      const data = await signInWithPassword(cleanEmail, password);
      playSound('success');

      const user = data?.user;
      const session = data?.session;
      setActiveUser(user);
      setActiveSession(session);

      // Transition to Profile Setup to review or update details
      navigateToStep('PROFILE_SETUP');
    } catch (err) {
      setErrorMsg(getFriendlyAuthErrorMessage(err));
      playSound('error');
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // STEP 3: VERIFY 6-DIGIT OTP & ADVANCE TO SET_PASSWORD
  // --------------------------------------------------------------------------
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanToken = otpToken.trim();
    if (cleanToken.length < 6) {
      setErrorMsg('Please enter the complete 6-digit verification code.');
      playSound('error');
      return;
    }

    setLoading(true);
    try {
      const data = await verifyEmailOtp(email, cleanToken);
      playSound('success');

      const user = data?.user;
      const session = data?.session;
      setActiveUser(user);
      setActiveSession(session);

      // Rule: Verify 6-digit code and immediately advance to password creation
      navigateToStep('SET_PASSWORD');
    } catch (err) {
      setErrorMsg(getFriendlyAuthErrorMessage(err));
      playSound('error');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP in OTP screen
  const handleResendOtp = async () => {
    if (cooldown > 0 || loading) return;
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);
    try {
      await sendEmailOtp(email);
      playSound('pop');
      startCooldown(60);
      setSuccessMsg(`A fresh 6-digit verification code was sent to ${email}.`);
    } catch (err) {
      setErrorMsg(getFriendlyAuthErrorMessage(err));
      playSound('error');
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // STEP 4: SET PERMANENT PASSWORD (POST-OTP)
  // --------------------------------------------------------------------------
  const handleSetPassword = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!newPassword || newPassword.length < 6) {
      setErrorMsg('Password must contain at least 6 characters.');
      playSound('error');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please verify your entries.');
      playSound('error');
      return;
    }

    setLoading(true);
    try {
      const updatedData = await updateUserPassword(newPassword);
      playSound('success');

      if (updatedData?.user) {
        setActiveUser(updatedData.user);
      }

      // Advance to dual profile setup
      navigateToStep('PROFILE_SETUP');
    } catch (err) {
      setErrorMsg(getFriendlyAuthErrorMessage(err));
      playSound('error');
    } finally {
      setLoading(false);
    }
  };

  // Optional "Skip for now" link on password setup
  const handleSkipPassword = () => {
    playSound('click');
    navigateToStep('PROFILE_SETUP');
  };

  // --------------------------------------------------------------------------
  // STEP 5: SAVE DUAL PROFILE (PATIENT + CAREGIVER)
  // --------------------------------------------------------------------------
  const handleProfileSubmit = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // Input validation with visual banner feedback instead of disabled button
    if (!patientName.trim()) {
      setErrorMsg("Please enter the patient's full name.");
      playSound('error');
      return;
    }

    const parsedAge = parseInt(patientAge, 10);
    if (!parsedAge || parsedAge < 1 || parsedAge > 125) {
      setErrorMsg('Please provide a valid patient age between 1 and 125.');
      playSound('error');
      return;
    }

    if (!caregiverName.trim()) {
      setErrorMsg("Please enter the caregiver's full name.");
      playSound('error');
      return;
    }

    if (!caregiverPhone.trim()) {
      setErrorMsg('Please enter an emergency contact phone number for the caregiver.');
      playSound('error');
      return;
    }

    // Determine target User ID from active state or current session
    let userId = activeUser?.id;
    if (!userId) {
      try {
        const user = await getCurrentUser();
        userId = user?.id;
      } catch (_) {}
    }

    if (!userId) {
      setErrorMsg('Authentication session was lost. Please restart the sign-in process.');
      playSound('error');
      return;
    }

    setLoading(true);
    try {
      const profilePayload = {
        id: userId,
        patient_name: patientName.trim(),
        patient_age: parsedAge,
        preferred_language: preferredLanguage,
        cognitive_notes: cognitiveNotes.trim(),
        caregiver_name: caregiverName.trim(),
        caregiver_relationship: caregiverRelationship,
        caregiver_phone: caregiverPhone.trim()
      };

      // Upsert into Supabase `profiles` matching authenticated user ID
      const savedProfile = await upsertProfile(profilePayload);
      playSound('success');

      // Notify parent app
      const session = activeSession || (await getSession());
      const user = activeUser || (await getCurrentUser());

      if (onAuthSuccess) {
        onAuthSuccess({
          session,
          user,
          profile: savedProfile
        });
      }

      // Close modal cleanly upon completion
      if (onClose) {
        onClose();
      }
    } catch (err) {
      // Visually surface any Supabase upsert errors inside an alert banner instead of silently failing
      console.error('[AuthOtpModal] Profile upsert error:', err);
      setErrorMsg(getFriendlyAuthErrorMessage(err) || 'Failed to save profile. Please check your connection.');
      playSound('error');
    } finally {
      // Ensure loading state is always cleared so button is never left stuck or disabled
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-sm transition-opacity animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        className={`w-full ${
          step === 'PROFILE_SETUP' ? 'max-w-3xl' : 'max-w-md'
        } bg-white rounded-3xl border border-slate-200 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-900 font-sans transition-all duration-200 transform animate-scale-up`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Strip — Calm Cloud Blue Aesthetic */}
        <header className="px-6 py-4 bg-gradient-to-r from-blue-50/90 to-slate-50 border-b border-slate-200/80 flex items-center justify-between flex-shrink-0">
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
                  ? 'Dual Onboarding Profile'
                  : step === 'SET_PASSWORD'
                  ? 'Password Setup'
                  : step === 'PASSWORD_LOGIN'
                  ? 'Password Sign-In'
                  : step === 'OTP'
                  ? 'Security Verification'
                  : 'Cognitive Care Access'}
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

        {/* Scrollable Modal Content Container (Prevents Unclickable Hidden Buttons) */}
        <main className="p-6 md:p-8 overflow-y-auto overscroll-contain flex-1">
          {/* Dynamic Error Alert Banner */}
          {errorMsg && (
            <div
              role="alert"
              className="mb-5 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium flex items-start gap-3 animate-shake"
            >
              <span className="material-symbols-outlined text-xl text-red-500 flex-shrink-0 mt-0.5">error</span>
              <div className="flex-1 leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {/* Dynamic Success Alert Banner */}
          {successMsg && (
            <div
              role="status"
              className="mb-5 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-start gap-3"
            >
              <span className="material-symbols-outlined text-xl text-emerald-600 flex-shrink-0 mt-0.5">check_circle</span>
              <div className="flex-1 leading-relaxed">{successMsg}</div>
            </div>
          )}

          {/* ================================================================ */}
          {/* SCREEN 1: 'EMAIL' (Request 6-Digit OTP via signInWithOtp)         */}
          {/* ================================================================ */}
          {step === 'EMAIL' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Sign In to CareLoop</h2>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                  Enter your email to receive an instant 6-digit authentication code.
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
                      className="w-full min-h-[56px] h-14 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-base outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
                    />
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">
                      mail
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || cooldown > 0}
                  className={`w-full min-h-[56px] h-14 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer ${
                    loading || cooldown > 0
                      ? 'bg-slate-300 text-slate-500 shadow-none cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.99] shadow-blue-600/25'
                  }`}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                      <span>Sending OTP...</span>
                    </div>
                  ) : (
                    <>
                      <span>{cooldown > 0 ? `Resend code in ${cooldown}s` : 'Send 6-Digit OTP'}</span>
                      <span className="material-symbols-outlined text-xl">send</span>
                    </>
                  )}
                </button>
              </form>

              {/* Returning User Password Login Toggle */}
              <div className="mt-6 pt-5 border-t border-slate-100 text-center">
                <button
                  type="button"
                  onClick={() => navigateToStep('PASSWORD_LOGIN')}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors inline-flex items-center gap-2 cursor-pointer p-2"
                >
                  <span className="material-symbols-outlined text-lg">key</span>
                  <span>Sign in with Password instead</span>
                </button>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* SCREEN 2: 'PASSWORD_LOGIN' (Returning Users via signInWithPassword) */}
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
                      className="w-full min-h-[56px] h-14 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-base outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
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
                      className="w-full min-h-[56px] h-14 pl-12 pr-12 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-base outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
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
                  className={`w-full min-h-[56px] h-14 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer ${
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

              {/* Toggle to OTP Access */}
              <div className="mt-6 pt-5 border-t border-slate-100 text-center">
                <button
                  type="button"
                  onClick={() => navigateToStep('EMAIL')}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors inline-flex items-center gap-2 cursor-pointer p-2"
                >
                  <span className="material-symbols-outlined text-lg">mail</span>
                  <span>Sign in with 6-Digit Email OTP instead</span>
                </button>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* SCREEN 3: 'OTP' (Verify 6-Digit Code via verifyOtp)               */}
          {/* ================================================================ */}
          {step === 'OTP' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <button
                  type="button"
                  onClick={() => navigateToStep('EMAIL')}
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
                  <label htmlFor="otp-token-input" className="block text-center text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wider">
                    6-Digit Security Token
                  </label>
                  <input
                    id="otp-token-input"
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
                  className={`w-full min-h-[56px] h-14 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer ${
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
          {/* SCREEN 4: 'SET_PASSWORD' (Post-OTP Password Configuration)        */}
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
                  Establish a secure password so you can sign in directly on your subsequent visits.
                </p>
              </div>

              <form onSubmit={handleSetPassword} className="space-y-4">
                {/* Create Password */}
                <div>
                  <label htmlFor="create-password" className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wider">
                    Create Password (min 6 characters)
                  </label>
                  <div className="relative">
                    <input
                      id="create-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="w-full min-h-[56px] h-14 pl-12 pr-12 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-base outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
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

                {/* Confirm Password */}
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
                      className="w-full min-h-[56px] h-14 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-base outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
                    />
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">
                      lock_reset
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full min-h-[56px] h-14 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer ${
                    loading
                      ? 'bg-slate-300 text-slate-500 shadow-none cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.99] shadow-blue-600/25'
                  }`}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                      <span>Saving Credentials...</span>
                    </div>
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
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer py-2 px-3 rounded-lg hover:bg-slate-100 inline-block"
                >
                  Skip for now (stick to email OTP access)
                </button>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* SCREEN 5: 'PROFILE_SETUP' (Dual-Column Patient & Caregiver Setup) */}
          {/* ================================================================ */}
          {step === 'PROFILE_SETUP' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Profile Onboarding</h2>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                  Provide patient and primary caregiver details to personalize games, daily reminders, and emergency calling.
                </p>
              </div>

              <form onSubmit={handleProfileSubmit} className="space-y-6">
                {/* Two-Column Responsive Grid (md:grid-cols-2) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                  {/* COLUMN 1: PATIENT DETAILS */}
                  <div className="p-5 rounded-2xl bg-blue-50/40 border border-blue-100 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-blue-100/80">
                      <span className="material-symbols-outlined text-xl text-blue-600">elderly</span>
                      <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider">Patient Details</h3>
                    </div>

                    {/* Patient Full Name */}
                    <div>
                      <label htmlFor="patient-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Patient Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="patient-name"
                        type="text"
                        required
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        placeholder="e.g. Kamala Sharma"
                        className="w-full min-h-[56px] h-14 px-4 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
                      />
                    </div>

                    {/* Patient Age */}
                    <div>
                      <label htmlFor="patient-age" className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Patient Age <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="patient-age"
                        type="number"
                        min="1"
                        max="125"
                        required
                        value={patientAge}
                        onChange={(e) => setPatientAge(e.target.value)}
                        placeholder="74"
                        className="w-full min-h-[56px] h-14 px-4 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
                      />
                    </div>

                    {/* Preferred Language Dropdown (English, Assamese, Bodo, Hindi) */}
                    <div>
                      <label htmlFor="patient-language" className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Preferred Language
                      </label>
                      <div className="relative">
                        <select
                          id="patient-language"
                          value={preferredLanguage}
                          onChange={(e) => setPreferredLanguage(e.target.value)}
                          className="w-full min-h-[56px] h-14 pl-4 pr-10 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none cursor-pointer"
                        >
                          <option value="en">English</option>
                          <option value="as">অসমীয়া (Assamese)</option>
                          <option value="brx">बड़ो (Bodo)</option>
                          <option value="hi">हिन्दी (Hindi)</option>
                        </select>
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xl">
                          expand_more
                        </span>
                      </div>
                    </div>

                    {/* Cognitive Stage / Notes */}
                    <div>
                      <label htmlFor="cognitive-notes" className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Cognitive Stage / Care Notes
                      </label>
                      <input
                        id="cognitive-notes"
                        type="text"
                        value={cognitiveNotes}
                        onChange={(e) => setCognitiveNotes(e.target.value)}
                        placeholder="e.g. Mild Memory Loss, Reminders needed"
                        className="w-full min-h-[56px] h-14 px-4 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
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
                        className="w-full min-h-[56px] h-14 px-4 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
                      />
                    </div>

                    {/* Relationship Dropdown */}
                    <div>
                      <label htmlFor="caregiver-relation" className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Relationship to Patient
                      </label>
                      <div className="relative">
                        <select
                          id="caregiver-relation"
                          value={caregiverRelationship}
                          onChange={(e) => setCaregiverRelationship(e.target.value)}
                          className="w-full min-h-[56px] h-14 pl-4 pr-10 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none cursor-pointer"
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

                    {/* Emergency Contact Phone */}
                    <div>
                      <label htmlFor="caregiver-phone" className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Emergency Contact Phone <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          id="caregiver-phone"
                          type="tel"
                          required
                          value={caregiverPhone}
                          onChange={(e) => setCaregiverPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          className="w-full min-h-[56px] h-14 pl-12 pr-4 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
                        />
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">
                          call
                        </span>
                      </div>
                    </div>

                    {/* Informational Guidance Badge */}
                    <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 text-slate-600 text-xs flex items-start gap-2">
                      <span className="material-symbols-outlined text-base text-blue-600 flex-shrink-0 mt-0.5">info</span>
                      <span>This number is pinned as the primary one-touch speed-dial target on the patient's companion tablet.</span>
                    </div>
                  </div>
                </div>

                {/* Save Profile Button (Explicit type="submit", active spinner, 56px height) */}
                <div className="pt-2">
                  <button
                    type="submit"
                    id="save-profile-btn"
                    disabled={loading}
                    className={`w-full min-h-[56px] h-14 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer ${
                      loading
                        ? 'bg-blue-400 text-white cursor-wait'
                        : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.99] shadow-blue-600/25'
                    }`}
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                        <span>Saving Profile & Initializing CareLoop...</span>
                      </div>
                    ) : (
                      <>
                        <span>Save Profile & Enter Application</span>
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
