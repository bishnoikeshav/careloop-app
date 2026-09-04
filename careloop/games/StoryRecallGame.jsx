import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * StoryRecallGame - Culturally Familiar Story Recall (Auditory Attention & Narrative Recall)
 * Short narrative comprehension with North-East India cultural familiarity.
 */
export default function StoryRecallGame({ onFinish, onBack }) {
  const [phase, setPhase] = useState('story'); // 'story' | 'questions'
  const [questionIndex, setQuestionIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [stats, setStats] = useState({ accuracy: 100, time: 0, cas: 95 });
  const [feedback, setFeedback] = useState(null);

  const startTimeRef = useRef(Date.now());
  const attemptsRef = useRef(0);
  const correctAttemptsRef = useRef(0);

  const STORY_TEXT = "Sunita walked to the local morning market in the hills. She bought fresh green tea leaves and fragrant yellow marigold flowers for her home.";

  const QUESTIONS = [
    {
      question: "What did Sunita buy at the market?",
      options: [
        { text: "Green Tea & Flowers", icon: "🍵", isCorrect: true },
        { text: "Bread & Fresh Milk", icon: "🍞", isCorrect: false },
        { text: "Red Apples & Rice", icon: "🍎", isCorrect: false }
      ],
      affirmation: "That's right! Sunita bought fresh tea and flowers."
    },
    {
      question: "Where did Sunita go this morning?",
      options: [
        { text: "The Hill Market", icon: "🏞️", isCorrect: true },
        { text: "The Train Station", icon: "🚆", isCorrect: false },
        { text: "The Health Clinic", icon: "🏥", isCorrect: false }
      ],
      affirmation: "Wonderful! Sunita walked to the morning hill market."
    }
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

  useEffect(() => {
    startTimeRef.current = Date.now();
    const timer = setTimeout(() => {
      speak(STORY_TEXT);
    }, 500);
    return () => {
      clearTimeout(timer);
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, [speak]);

  const handleStartQuestions = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setPhase('questions');
    setQuestionIndex(0);
    setFeedback(null);
    speak(QUESTIONS[0].question);
  };

  const handleSelectOption = (opt, qData) => {
    attemptsRef.current += 1;

    if (opt.isCorrect) {
      correctAttemptsRef.current += 1;
      setFeedback({ text: qData.affirmation, isCorrect: true });
      speak(qData.affirmation);

      setTimeout(() => {
        if (questionIndex + 1 < QUESTIONS.length) {
          const nextIdx = questionIndex + 1;
          setQuestionIndex(nextIdx);
          setFeedback(null);
          speak(QUESTIONS[nextIdx].question);
        } else {
          finishGame();
        }
      }, 2000);
    } else {
      const enc = "Great effort! Let's remember: Sunita went to the hill market for tea leaves and flowers.";
      setFeedback({ text: enc, isCorrect: false });
      speak(enc);

      setTimeout(() => {
        if (questionIndex + 1 < QUESTIONS.length) {
          const nextIdx = questionIndex + 1;
          setQuestionIndex(nextIdx);
          setFeedback(null);
          speak(QUESTIONS[nextIdx].question);
        } else {
          finishGame();
        }
      }, 3000);
    }
  };

  const finishGame = () => {
    const elapsed = Math.max(14, Math.round((Date.now() - startTimeRef.current) / 1000));
    const acc = attemptsRef.current > 0 ? Math.min(100, Math.round((correctAttemptsRef.current / attemptsRef.current) * 100)) : 100;
    const cas = Math.min(99, Math.round((acc * 0.70) + (Math.max(20, 100 - (elapsed * 1.1)) * 0.30)));

    const result = { accuracy: acc, time: elapsed, cas };
    setStats(result);
    setIsCompleted(true);
    if (onFinish) onFinish(result);
  };

  const playAgain = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsCompleted(false);
    setPhase('story');
    setQuestionIndex(0);
    setFeedback(null);
    attemptsRef.current = 0;
    correctAttemptsRef.current = 0;
    startTimeRef.current = Date.now();
    speak(STORY_TEXT);
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
          <h2 className="text-xl font-bold tracking-tight">Story Recall</h2>
          <span className="text-xs text-[#527863] font-medium">Auditory Attention</span>
        </div>
        <button 
          onClick={() => speak(phase === 'story' ? STORY_TEXT : QUESTIONS[questionIndex].question)}
          className="w-10 h-10 rounded-full bg-[#EAF5EF] text-[#2E9E63] border border-[#BEE3CE] flex items-center justify-center text-lg active:scale-95"
        >
          🔊
        </button>
      </div>

      {/* PHASE 1: STORY PRESENTATION */}
      {phase === 'story' && (
        <div className="my-auto space-y-4">
          <div className="bg-[#F8FAF9] border-2 border-[#DCE5E0] rounded-3xl p-5 shadow-sm space-y-4">
            <div className="w-full h-32 bg-gradient-to-br from-[#EAF5EF] to-[#D5EDE0] rounded-2xl flex items-center justify-center text-4xl gap-3">
              <span>🌿</span>
              <span>🌼</span>
              <span>🏞️</span>
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#2E9E63]">Short Story</span>
              <p className="text-base sm:text-lg font-bold text-[#12201A] mt-1 leading-relaxed">
                "{STORY_TEXT}"
              </p>
            </div>
            <button
              onClick={() => speak(STORY_TEXT)}
              className="w-full py-2.5 bg-[#EAF5EF] hover:bg-[#D5EDE0] text-[#1E6B43] rounded-xl text-sm font-bold border border-[#B5E0CE] active:scale-95 transition-all"
            >
              🔊 Hear Story Again
            </button>
          </div>

          <button
            onClick={handleStartQuestions}
            className="w-full h-14 bg-[#2E9E63] hover:bg-[#258552] text-white rounded-2xl font-bold text-base sm:text-lg shadow-lg active:scale-95 transition-all"
          >
            I AM READY FOR THE QUESTIONS →
          </button>
        </div>
      )}

      {/* PHASE 2: QUESTIONS */}
      {phase === 'questions' && (
        <div className="my-auto space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-[#6B8C7A] uppercase">
              Question {questionIndex + 1} of {QUESTIONS.length}
            </span>
          </div>

          <div className="p-4 bg-[#F8FAF9] border-2 border-[#DCE5E0] rounded-2xl text-center min-h-[72px] flex items-center justify-center shadow-sm">
            <h3 className="text-lg font-bold leading-snug">
              {QUESTIONS[questionIndex].question}
            </h3>
          </div>

          <div className="space-y-3">
            {QUESTIONS[questionIndex].options.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleSelectOption(opt, QUESTIONS[questionIndex])}
                className="w-full min-h-[64px] rounded-2xl p-3.5 bg-[#F8FAF9] hover:bg-[#EAF5EF] border-2 border-[#DCE5E0] hover:border-[#2E9E63] flex items-center gap-3 text-left font-bold text-base transition-all active:scale-95 shadow-sm"
              >
                <span className="text-3xl">{opt.icon}</span>
                <span className="flex-1">{opt.text}</span>
              </button>
            ))}
          </div>

          {feedback && (
            <div className={`p-3 rounded-2xl text-center text-sm font-bold border ${
              feedback.isCorrect ? 'bg-[#EAF5EF] border-[#BEE3CE] text-[#1E6B43]' : 'bg-[#FEF9EE] border-[#F8D8A7] text-[#92400E]'
            }`}>
              {feedback.text}
            </div>
          )}
        </div>
      )}

      {/* RESULT SCREEN MODAL */}
      {isCompleted && (
        <div className="fixed inset-0 bg-white/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-18 h-18 bg-[#2E9E63] text-white rounded-full flex items-center justify-center text-3xl mb-3 shadow-lg">
            ✓
          </div>
          <h3 className="text-3xl font-extrabold text-[#12201A] mb-1">Wonderful memory!</h3>
          <p className="text-[#527863] text-base mb-5 max-w-xs">
            You remembered the story details clearly.
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
