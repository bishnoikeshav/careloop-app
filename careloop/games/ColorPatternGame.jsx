import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * ColorPatternGame - Spatial Pattern & Sequence Memory
 * High contrast, accessible healthcare palette, massive touch targets, zero-shaming UX.
 */
export default function ColorPatternGame({ onFinish, onBack }) {
  const [level, setLevel] = useState(1);
  const [sequence, setSequence] = useState([]);
  const [userStep, setUserStep] = useState(0);
  const [litTile, setLitTile] = useState(null);
  const [isDemonstrating, setIsDemonstrating] = useState(false);
  const [promptText, setPromptText] = useState("Watch carefully: which colors light up?");
  const [isCompleted, setIsCompleted] = useState(false);
  const [stats, setStats] = useState({ accuracy: 100, time: 0, cas: 94 });

  const startTimeRef = useRef(Date.now());
  const attemptsRef = useRef(0);
  const correctAttemptsRef = useRef(0);
  const isDemonstratingRef = useRef(false);

  const TILE_INFO = [
    { id: 0, label: "Muted Teal", colorClass: "bg-[#EAF5F0] text-[#0D9488] border-[#B5E0CE]", litClass: "bg-[#0D9488] text-white border-[#0F766E] shadow-teal", freq: 392.00 },
    { id: 1, label: "Warm Amber", colorClass: "bg-[#FEF6E9] text-[#D97706] border-[#F8D8A7]", litClass: "bg-[#D97706] text-white border-[#B45309] shadow-amber", freq: 440.00 },
    { id: 2, label: "Sky Blue", colorClass: "bg-[#EEF4FD] text-[#2563EB] border-[#BFDBFE]", litClass: "bg-[#2563EB] text-white border-[#1D4ED8] shadow-blue", freq: 523.25 },
    { id: 3, label: "Gentle Rose", colorClass: "bg-[#FDF0F6] text-[#DB2777] border-[#FBCFE8]", litClass: "bg-[#DB2777] text-white border-[#BE185D] shadow-rose", freq: 587.33 }
  ];

  const activeUtteranceRef = useRef(null);

  const speak = useCallback((text) => {
    if (!('speechSynthesis' in window)) return;
    // ALWAYS cancel immediately before queuing new utterance
    window.speechSynthesis.cancel();
    if (!text) return;

    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-IN';
    u.rate = 0.88; // Gentle, steady pace for elderly users
    
    // Prevent Chromium garbage collection bug cutting off sentences
    activeUtteranceRef.current = u;
    window._careLoopActiveUtterance = u;
    
    u.onend = () => {
      if (activeUtteranceRef.current === u) activeUtteranceRef.current = null;
      if (window._careLoopActiveUtterance === u) window._careLoopActiveUtterance = null;
    };
    u.onerror = (e) => {
      if (activeUtteranceRef.current === u) activeUtteranceRef.current = null;
      if (window._careLoopActiveUtterance === u) window._careLoopActiveUtterance = null;
    };

    window.speechSynthesis.speak(u);
  }, []);

  const playTone = useCallback((freq) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch (_) {}
  }, []);

  const flashSingleTile = useCallback((index) => {
    setLitTile(index);
    playTone(TILE_INFO[index].freq);
    setTimeout(() => {
      setLitTile(null);
    }, 700);
  }, [playTone]);

  const runDemo = useCallback((seq) => {
    setIsDemonstrating(true);
    isDemonstratingRef.current = true;
    const msg = "Watch carefully: which colors light up?";
    setPromptText(msg);
    speak(msg);

    let idx = 0;
    const timer = setInterval(() => {
      if (idx < seq.length) {
        flashSingleTile(seq[idx]);
        idx++;
      } else {
        clearInterval(timer);
        setTimeout(() => {
          setIsDemonstrating(false);
          isDemonstratingRef.current = false;
          const readyMsg = "Now tap the colors in the same order.";
          setPromptText(readyMsg);
          speak(readyMsg);
        }, 600);
      }
    }, 1200);
  }, [flashSingleTile, speak]);

  const startLevel = useCallback((lvl) => {
    setLevel(lvl);
    setUserStep(0);
    const length = lvl === 1 ? 2 : 3;
    const newSeq = Array.from({ length }, () => Math.floor(Math.random() * 4));
    setSequence(newSeq);
    setTimeout(() => {
      runDemo(newSeq);
    }, 300);
  }, [runDemo]);

  useEffect(() => {
    startTimeRef.current = Date.now();
    startLevel(1);
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, [startLevel]);

  const handleTileClick = (index) => {
    if (isDemonstratingRef.current) return;

    attemptsRef.current += 1;
    flashSingleTile(index);

    const expected = sequence[userStep];
    if (index === expected) {
      correctAttemptsRef.current += 1;
      const nextStep = userStep + 1;
      setUserStep(nextStep);

      if (nextStep === sequence.length) {
        if (level < 2) {
          setPromptText("Wonderful! Getting ready for Level 2...");
          setTimeout(() => {
            startLevel(2);
          }, 1500);
        } else {
          // Completed
          const elapsed = Math.max(12, Math.round((Date.now() - startTimeRef.current) / 1000));
          const acc = attemptsRef.current > 0 ? Math.min(100, Math.round((correctAttemptsRef.current / attemptsRef.current) * 100)) : 100;
          const cas = Math.min(99, Math.round((acc * 0.65) + (Math.max(20, 100 - (elapsed * 1.2)) * 0.35)));

          const res = { accuracy: acc, time: elapsed, cas };
          setStats(res);
          setIsCompleted(true);
          if (onFinish) onFinish(res);
        }
      }
    } else {
      // Non-punitive encouragement
      const enc = "Take your time. Let's watch the pattern one more time.";
      setPromptText(enc);
      speak(enc);
      setUserStep(0);
      setTimeout(() => {
        runDemo(sequence);
      }, 2200);
    }
  };

  const handleBack = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (onBack) onBack();
  };

  const playAgain = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsCompleted(false);
    attemptsRef.current = 0;
    correctAttemptsRef.current = 0;
    startTimeRef.current = Date.now();
    startLevel(1);
  };

  return (
    <div className="w-full max-w-sm mx-auto p-4 flex flex-col justify-between min-h-[580px] font-sans antialiased text-[#12201A]">
      {/* HEADER */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E8EFEA]">
        <button 
          onClick={handleBack}
          className="w-10 h-10 rounded-full bg-[#F4F7F5] flex items-center justify-center font-bold text-lg active:scale-95"
        >
          ←
        </button>
        <div className="text-center">
          <h2 className="text-xl font-bold tracking-tight">Color & Pattern</h2>
          <span className="text-xs text-[#527863] font-medium">Level {level} of 2</span>
        </div>
        <button 
          onClick={() => speak(promptText)}
          className="w-10 h-10 rounded-full bg-[#EAF5EF] text-[#2E9E63] border border-[#BEE3CE] flex items-center justify-center text-lg active:scale-95"
        >
          🔊
        </button>
      </div>

      {/* PROMPT CARD */}
      <div className="my-4 p-4 bg-[#F8FAF9] border-2 border-[#DCE5E0] rounded-2xl text-center min-h-[72px] flex items-center justify-center shadow-sm">
        <p className="text-base sm:text-lg font-bold leading-snug">{promptText}</p>
      </div>

      {/* 2x2 TILES */}
      <div className="grid grid-cols-2 gap-3.5 my-2">
        {TILE_INFO.map(t => {
          const isLit = litTile === t.id;
          return (
            <button
              key={t.id}
              disabled={isDemonstrating}
              onClick={() => handleTileClick(t.id)}
              className={`min-h-[125px] rounded-3xl border-3 flex flex-col items-center justify-center gap-2 p-3 font-bold transition-all duration-200 active:scale-95 shadow-sm ${
                isLit ? t.litClass : t.colorClass
              } ${isDemonstrating ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <div className="w-9 h-9 rounded-full flex items-center justify-center bg-white/40">
                ●
              </div>
              <span className="text-sm tracking-wide">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* REPLAY PATTERN */}
      <div className="text-center my-2">
        <button
          disabled={isDemonstrating}
          onClick={() => {
            if ('speechSynthesis' in window) window.speechSynthesis.cancel();
            runDemo(sequence);
          }}
          className="text-sm font-bold text-[#2E9E63] hover:underline inline-flex items-center gap-1.5 py-1 px-3 rounded-lg"
        >
          ↻ Watch pattern again
        </button>
      </div>

      {/* RESULT SCREEN MODAL */}
      {isCompleted && (
        <div className="fixed inset-0 bg-white/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-18 h-18 bg-[#2E9E63] text-white rounded-full flex items-center justify-center text-3xl mb-3 shadow-lg">
            ✓
          </div>
          <h3 className="text-3xl font-extrabold text-[#12201A] mb-1">Wonderful focus!</h3>
          <p className="text-[#527863] text-base mb-5 max-w-xs">
            You successfully recalled the color sequence.
          </p>

          <div className="bg-[#F8FAF9] border border-[#DCE5E0] rounded-2xl p-4 w-full max-w-xs mb-6 flex justify-around shadow-sm">
            <div>
              <div className="text-2xl font-black text-[#2E9E63]">{stats.accuracy}%</div>
              <div className="text-[11px] text-[#6B8C7A] font-bold uppercase">Accuracy</div>
            </div>
            <div className="w-px bg-[#DCE5E0]"></div>
            <div>
              <div className="text-2xl font-black text-[#12201A]">{stats.time}s</div>
              <div className="text-[11px] text-[#6B8C7A] font-bold uppercase">Time</div>
            </div>
            <div className="w-px bg-[#DCE5E0]"></div>
            <div>
              <div className="text-2xl font-black text-[#2E9E63]">{stats.cas}</div>
              <div className="text-[11px] text-[#6B8C7A] font-bold uppercase">CAS Score</div>
            </div>
          </div>

          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              onClick={playAgain}
              className="w-full h-14 bg-[#2E9E63] hover:bg-[#258552] text-white rounded-2xl font-bold text-lg shadow-md active:scale-95 transition-all"
            >
              PLAY AGAIN
            </button>
            <button
              onClick={handleBack}
              className="w-full h-14 bg-[#F4F7F5] hover:bg-[#EAF1ED] text-[#12201A] border-2 border-[#DCE5E0] rounded-2xl font-bold text-base active:scale-95 transition-all"
            >
              BACK TO GAMES
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
