import React, { useState, useEffect } from 'react';

/**
 * AuthPage / AuthModal — Hackathon Prototype Authentication Flow
 * 
 * STEP 1: DEMO SELECTION
 * - Two Quick Demo Fill options: Caregiver (Rahul) & Patient (Kamala)
 * - Highlights choice, Next button transitions to Step 2
 * 
 * STEP 2: AUTO-FILLED OTP
 * - Visually auto-fills 6 boxes with fake code "1 2 3 4 5 6"
 * - Displays "Verifying automatically..." spinner
 * - Automatically transitions to Step 3 after 1.5 seconds via setTimeout
 * 
 * STEP 3: PROFILE ONBOARDING
 * - Pre-fills Name, Age, and Role from selected demo account
 * - "Save & Enter App" saves user state and closes modal
 */

export function AuthPage({
  isOpen = true,
  onClose = null,
  onAuthComplete = null,
  isModal = true
}) {
  const [step, setStep] = useState(1);
  const [selectedDemo, setSelectedDemo] = useState('caregiver'); // 'caregiver' | 'patient'
  const [fullName, setFullName] = useState('Rahul');
  const [age, setAge] = useState('45');
  const [role, setRole] = useState('caregiver');

  // Handle demo selection in Step 1
  const handleSelectDemo = (demoType) => {
    setSelectedDemo(demoType);
    if (demoType === 'caregiver') {
      setFullName('Rahul');
      setAge('45');
      setRole('caregiver');
    } else {
      setFullName('Kamala');
      setAge('74');
      setRole('patient');
    }
  };

  // STEP 2: Auto-verify OTP after exactly 1.5 seconds
  useEffect(() => {
    let timer;
    if (step === 2) {
      timer = setTimeout(() => {
        setStep(3);
      }, 1500);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [step]);

  // STEP 3: Profile submit
  const handleProfileSubmit = (e) => {
    if (e) e.preventDefault();
    const finalName = fullName.trim() || (selectedDemo === 'caregiver' ? 'Rahul' : 'Kamala');
    const finalAge = age || (selectedDemo === 'caregiver' ? '45' : '74');
    const finalRole = role || selectedDemo;
    const initial = finalName.charAt(0).toUpperCase();

    const profile = {
      name: finalName,
      age: finalAge,
      role: finalRole,
      initials: initial
    };

    if (onAuthComplete) {
      onAuthComplete(profile);
    }
    if (onClose) {
      onClose();
    }
  };

  if (isModal && !isOpen) {
    return null;
  }

  const modalCard = (
    <div
      className="w-full max-w-[440px] bg-[#121514] border border-[#26302C] rounded-2xl overflow-hidden shadow-2xl text-[#F4F6F4] font-sans"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header & Stepper */}
      <div className="px-5 py-3.5 bg-[#1A1E1C] border-b border-[#26302C] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#4ADE94]/15 border border-[#4ADE94]/30 flex items-center justify-center text-[#4ADE94]">
            <span className="material-symbols-outlined text-[18px]">spa</span>
          </div>
          <div>
            <div className="font-bold text-sm flex items-center gap-1.5 text-white">
              MindCare
              <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE94] inline-block animate-pulse"></span>
            </div>
            <div className="text-[10px] font-mono text-[#9BA8A2]">DEMO PROTOTYPE AUTH</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* 3 Stepper Dots */}
          <div className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full transition-all ${step >= 1 ? 'bg-[#4ADE94]' : 'bg-[#26302C]'}`}></div>
            <div className="w-3.5 h-0.5 bg-[#26302C]"></div>
            <div className={`w-2.5 h-2.5 rounded-full transition-all ${step >= 2 ? 'bg-[#4ADE94]' : 'bg-[#26302C]'}`}></div>
            <div className="w-3.5 h-0.5 bg-[#26302C]"></div>
            <div className={`w-2.5 h-2.5 rounded-full transition-all ${step >= 3 ? 'bg-[#4ADE94]' : 'bg-[#26302C]'}`}></div>
          </div>

          {/* Close button in modal mode */}
          {isModal && onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close modal"
              className="w-7 h-7 rounded-md border border-[#26302C] text-[#9BA8A2] hover:text-white hover:border-[#4ADE94] flex items-center justify-center transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Step Contents */}
      <div className="p-6">
        {/* ================================================================ */}
        {/* STEP 1: DEMO SELECTION */}
        {/* ================================================================ */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold mb-1 text-white">Select Demo Account</h2>
            <p className="text-xs text-[#9BA8A2] mb-4 leading-relaxed">
              Choose a persona to explore the interactive prototype without entering credentials.
            </p>

            <div className="flex flex-col gap-2.5 mb-5">
              {/* Option 1: Caregiver (Rahul) */}
              <button
                type="button"
                onClick={() => handleSelectDemo('caregiver')}
                className={`flex items-center justify-between p-3.5 rounded-xl border transition-all text-left cursor-pointer ${
                  selectedDemo === 'caregiver'
                    ? 'border-[#4ADE94] bg-[#4ADE94]/10'
                    : 'border-[#26302C] bg-[#1A1E1C] hover:border-[#3A4740]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#4ADE94]/20 border border-[#4ADE94]/30 flex items-center justify-center text-[#4ADE94]">
                    <span className="material-symbols-outlined text-[22px]">supervisor_account</span>
                  </div>
                  <div>
                    <div className="font-bold text-sm text-white">Demo: Caregiver (Rahul)</div>
                    <div className="text-xs text-[#9BA8A2] mt-0.5">Rahul Sharma · Age 45 · Caregiver Access</div>
                  </div>
                </div>
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  selectedDemo === 'caregiver'
                    ? 'border-[#4ADE94] bg-[#4ADE94]'
                    : 'border-[#3A4740] bg-transparent'
                }`}>
                  {selectedDemo === 'caregiver' && <div className="w-1.5 h-1.5 rounded-full bg-[#0B0D0C]"></div>}
                </div>
              </button>

              {/* Option 2: Patient (Kamala) */}
              <button
                type="button"
                onClick={() => handleSelectDemo('patient')}
                className={`flex items-center justify-between p-3.5 rounded-xl border transition-all text-left cursor-pointer ${
                  selectedDemo === 'patient'
                    ? 'border-[#4ADE94] bg-[#4ADE94]/10'
                    : 'border-[#26302C] bg-[#1A1E1C] hover:border-[#3A4740]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#5AA9F5]/20 border border-[#5AA9F5]/30 flex items-center justify-center text-[#5AA9F5]">
                    <span className="material-symbols-outlined text-[22px]">elderly</span>
                  </div>
                  <div>
                    <div className="font-bold text-sm text-white">Demo: Patient (Kamala)</div>
                    <div className="text-xs text-[#9BA8A2] mt-0.5">Kamala Sharma · Age 74 · Patient Companion</div>
                  </div>
                </div>
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  selectedDemo === 'patient'
                    ? 'border-[#4ADE94] bg-[#4ADE94]'
                    : 'border-[#3A4740] bg-transparent'
                }`}>
                  {selectedDemo === 'patient' && <div className="w-1.5 h-1.5 rounded-full bg-[#0B0D0C]"></div>}
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setStep(2)}
              className="w-full h-12 rounded-xl bg-[#4ADE94] hover:bg-[#3BC482] text-[#0B0D0C] font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-[0.99]"
            >
              <span>Next</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        )}

        {/* ================================================================ */}
        {/* STEP 2: AUTO-FILLED OTP */}
        {/* ================================================================ */}
        {step === 2 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-[#4ADE94] text-xs flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0 hover:underline"
              >
                <span className="material-symbols-outlined text-[15px]">arrow_back</span>
                <span>Change account</span>
              </button>
              <span className="font-mono text-[11px] text-[#9BA8A2]">STEP 2 / 3</span>
            </div>

            <h2 className="text-xl font-bold mb-1 text-white">Auto-Verifying Code</h2>
            <p className="text-xs text-[#9BA8A2] mb-4 leading-relaxed">
              Simulating instant code verification for <strong className="text-white">{selectedDemo === 'caregiver' ? 'Rahul (Caregiver)' : 'Kamala (Patient)'}</strong>.
            </p>

            {/* 6 Auto-filled boxes */}
            <div className="flex justify-between gap-1.5 max-w-[300px] mx-auto mb-4">
              {['1', '2', '3', '4', '5', '6'].map((digit, idx) => (
                <div
                  key={idx}
                  className="w-10 h-12 rounded-lg bg-[#4ADE94]/10 border border-[#4ADE94] text-[#4ADE94] font-mono text-xl font-bold flex items-center justify-center select-none"
                >
                  {digit}
                </div>
              ))}
            </div>

            {/* Verifying Status */}
            <div className="p-3.5 rounded-xl bg-[#4ADE94]/10 border border-[#4ADE94]/30 flex items-center justify-center gap-2.5 mb-3">
              <div className="w-4 h-4 border-2 border-[#4ADE94] border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-semibold text-[#4ADE94]">Verifying automatically...</span>
            </div>
            <div className="text-center text-[11px] text-[#9BA8A2] font-mono">
              Auto-advancing in 1.5 seconds...
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* STEP 3: PROFILE ONBOARDING */}
        {/* ================================================================ */}
        {step === 3 && (
          <form onSubmit={handleProfileSubmit}>
            <h2 className="text-xl font-bold mb-1 text-white">Profile Onboarding</h2>
            <p className="text-xs text-[#9BA8A2] mb-4 leading-relaxed">
              Pre-filled from your demo selection. Review details and enter the app.
            </p>

            <div className="mb-3">
              <label className="block text-[10px] font-mono uppercase text-[#9BA8A2] mb-1 font-semibold">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full h-11 px-3 bg-[#1A1E1C] border border-[#26302C] rounded-lg text-white text-sm outline-none focus:border-[#4ADE94] transition-all"
              />
            </div>

            <div className="mb-3.5">
              <label className="block text-[10px] font-mono uppercase text-[#9BA8A2] mb-1 font-semibold">Age</label>
              <input
                type="number"
                min="1"
                max="120"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                required
                className="w-full h-11 px-3 bg-[#1A1E1C] border border-[#26302C] rounded-lg text-white text-sm outline-none focus:border-[#4ADE94] transition-all"
              />
            </div>

            {/* Role Selection */}
            <div className="mb-4">
              <label className="block text-[10px] font-mono uppercase text-[#9BA8A2] mb-1.5 font-semibold">Role</label>
              <div className="flex flex-col gap-2">
                <div
                  onClick={() => setRole('caregiver')}
                  className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                    role === 'caregiver'
                      ? 'border-[#4ADE94] bg-[#4ADE94]/10'
                      : 'border-[#26302C] bg-[#1A1E1C]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[18px] text-[#4ADE94]">supervisor_account</span>
                    <div>
                      <div className="font-bold text-xs text-white">Caregiver</div>
                      <div className="text-[10px] text-[#9BA8A2]">Clinical Dashboard</div>
                    </div>
                  </div>
                  <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                    role === 'caregiver' ? 'border-[#4ADE94] bg-[#4ADE94]' : 'border-[#3A4740]'
                  }`}>
                    {role === 'caregiver' && <div className="w-1.5 h-1.5 rounded-full bg-[#0B0D0C]"></div>}
                  </div>
                </div>

                <div
                  onClick={() => setRole('patient')}
                  className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                    role === 'patient'
                      ? 'border-[#4ADE94] bg-[#4ADE94]/10'
                      : 'border-[#26302C] bg-[#1A1E1C]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[18px] text-[#5AA9F5]">elderly</span>
                    <div>
                      <div className="font-bold text-xs text-white">Patient</div>
                      <div className="text-[10px] text-[#9BA8A2]">Care Companion View</div>
                    </div>
                  </div>
                  <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                    role === 'patient' ? 'border-[#4ADE94] bg-[#4ADE94]' : 'border-[#3A4740]'
                  }`}>
                    {role === 'patient' && <div className="w-1.5 h-1.5 rounded-full bg-[#0B0D0C]"></div>}
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full h-12 rounded-xl bg-[#4ADE94] hover:bg-[#3BC482] text-[#0B0D0C] font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-[0.99]"
            >
              <span>Save & Enter App</span>
              <span className="material-symbols-outlined text-[18px]">login</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div
        className="fixed inset-0 z-[99999] bg-[#0B0D0C]/80 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        {modalCard}
      </div>
    );
  }

  return modalCard;
}

export const AuthModal = (props) => <AuthPage {...props} isModal={true} />;
export default AuthPage;
