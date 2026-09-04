import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * DailyObjectsGame - Remember the Daily Objects (Short-Term Visual Retention)
 * Visual working memory and everyday object recognition.
 */
export default function DailyObjectsGame({ onFinish, onBack }) {
  const [phase, setPhase] = useState('study'); // 'study' | 'recall'
  const [selectedItems, setSelectedItems] = useState([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [stats, setStats] = useState({ accuracy: 100, time: 0, cas: 96 });

  const startTimeRef = useRef(Date.now());
  const studyTimerRef = useRef(null);

  const TARGETS = [
    { id: 'glasses', label: 'Reading Glasses', icon: '👓' },
    { id: 'cup', label: 'Brass Tea Cup', icon: '☕' },
    { id: 'keys', label: 'House Keys', icon: '🔑' }
  ];

  const RECALL_ITEMS = [
    { id: 'toothbrush', label: 'Toothbrush', icon: '🪥', isTarget: false },
    { id: 'glasses', label: 'Reading Glasses', icon: '👓', isTarget: true },
    { id: 'cup', label: 'Brass Tea Cup', icon: '☕', isTarget: true },
    { id: 'book', label: 'Story Book', icon: '📖', isTarget: false },
    { id: 'keys', label: 'House Keys', icon: '🔑', isTarget: true },
    { id: 'lantern', label: 'Brass Lantern', icon: '🪔', isTarget: false }
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

  const handleBack = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (onBack) onBack();
  };

  const startStudy = useCallback(() => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setPhase('study');
    setSelectedItems([]);
    setIsCompleted(false);
    startTimeRef.current = Date.now();
    const prompt = "Look at these three objects on your table. Remember them.";
    speak(prompt);

    if (studyTimerRef.current) clearTimeout(studyTimerRef.current);
    studyTimerRef.current = setTimeout(() => {
      startRecall();
    }, 15000);
  }, [speak]);

  const startRecall = useCallback(() => {
    if (studyTimerRef.current) clearTimeout(studyTimerRef.current);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setPhase('recall');
    const recallPrompt = "Which items were on the table? Tap the 3 items.";
    speak(recallPrompt);
  }, [speak]);

  useEffect(() => {
    startStudy();
    return () => {
      if (studyTimerRef.current) clearTimeout(studyTimerRef.current);
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, [startStudy]);

  const toggleItem = (id) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter(x => x !== id));
    } else {
      if (selectedItems.length >= 3) {
        speak("You already selected three items. Tap one to change it, or click check.");
        return;
      }
      setSelectedItems([...selectedItems, id]);
    }
  };

  const handleConfirmChoices = () => {
    if (selectedItems.length !== 3) return;

    let correctCount = 0;
    TARGETS.forEach(t => {
      if (selectedItems.includes(t.id)) correctCount++;
    });

    const accuracy = Math.round((correctCount / 3) * 100);
    const elapsed = Math.max(16, Math.round((Date.now() - startTimeRef.current) / 1000));
    const cas = Math.min(99, Math.round((accuracy * 0.70) + (Math.max(20, 100 - (elapsed * 1.1)) * 0.30)));

    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    speak("You remembered the daily objects! Great observation.");

    const result = { accuracy, time: elapsed, cas };
    setStats(result);
    setIsCompleted(true);
    if (onFinish) onFinish(result);
  };

  const playAgain = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    startStudy();
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
          <h2 className="text-xl font-bold tracking-tight">Daily Objects</h2>
          <span className="text-xs text-[#527863] font-medium">Visual Retention</span>
        </div>
        <button 
          onClick={() => speak(phase === 'study' ? "Look at these three objects on your table. Remember them." : "Which items were on the table? Tap the 3 items.")}
          className="w-10 h-10 rounded-full bg-[#EAF5EF] text-[#2E9E63] border border-[#BEE3CE] flex items-center justify-center text-lg active:scale-95"
        >
          🔊
        </button>
      </div>

      {/* PHASE 1: STUDY */}
      {phase === 'study' && (
        <div className="my-auto space-y-4">
          <div className="p-4 bg-[#F8FAF9] border-2 border-[#DCE5E0] rounded-2xl text-center shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-[#2E9E63] block mb-1">Study Phase</span>
            <p className="text-base sm:text-lg font-bold leading-snug">
              Look at these three objects on your table. Remember them.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {TARGETS.map(t => (
              <div key={t.id} className="bg-[#F8FAF9] border-2 border-[#DCE5E0] rounded-2xl p-3 flex flex-col items-center justify-center gap-2 min-h-[110px] shadow-sm">
                <span className="text-4xl">{t.icon}</span>
                <span className="text-xs font-bold text-center leading-tight">{t.label}</span>
              </div>
            ))}
          </div>

          <button
            onClick={startRecall}
            className="w-full h-14 bg-[#2E9E63] hover:bg-[#258552] text-white rounded-2xl font-bold text-base sm:text-lg shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>I REMEMBERED THEM</span>
            <span>✓</span>
          </button>
        </div>
      )}

      {/* PHASE 2: RECALL */}
      {phase === 'recall' && (
        <div className="my-auto space-y-3.5">
          <div className="p-4 bg-[#F8FAF9] border-2 border-[#DCE5E0] rounded-2xl text-center shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-[#2E9E63]">Recall Phase</span>
              <span className="text-xs font-bold text-[#6B8C7A]">Selected: {selectedItems.length} of 3</span>
            </div>
            <p className="text-base sm:text-lg font-bold leading-snug">
              Which items were on the table? Tap the 3 items.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {RECALL_ITEMS.map(item => {
              const isSelected = selectedItems.includes(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  className={`min-h-[100px] rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 font-bold text-sm transition-all border-2 active:scale-95 shadow-sm relative ${
                    isSelected ? 'bg-[#EAF5EF] border-[#2E9E63] text-[#1E6B43]' : 'bg-[#F8FAF9] border-[#DCE5E0] text-[#12201A]'
                  }`}
                >
                  <span className="text-3xl">{item.icon}</span>
                  <span>{item.label}</span>
                  {isSelected && (
                    <span className="absolute top-2 right-2 w-5 h-5 bg-[#2E9E63] text-white rounded-full text-xs flex items-center justify-center">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            disabled={selectedItems.length !== 3}
            onClick={handleConfirmChoices}
            className={`w-full h-14 rounded-2xl font-bold text-base shadow-md transition-all flex items-center justify-center gap-2 ${
              selectedItems.length === 3 
                ? 'bg-[#2E9E63] hover:bg-[#258552] text-white cursor-pointer active:scale-95' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <span>CHECK MY CHOICES</span>
            <span>→</span>
          </button>
        </div>
      )}

      {/* RESULT SCREEN MODAL */}
      {isCompleted && (
        <div className="fixed inset-0 bg-white/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-18 h-18 bg-[#2E9E63] text-white rounded-full flex items-center justify-center text-3xl mb-3 shadow-lg">
            ✓
          </div>
          <h3 className="text-3xl font-extrabold text-[#12201A] mb-1">Great observation!</h3>
          <p className="text-[#527863] text-base mb-5 max-w-xs">
            You remembered the daily objects from the table.
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
