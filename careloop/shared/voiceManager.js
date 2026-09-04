/**
 * CareLoop Centralized Voice Manager
 * 
 * Solves:
 * 1. Audio Voice Bleeding & Choppiness: Cancels ongoing speech before any new prompt or screen transition.
 * 2. Chromium Garbage Collection Cutoff: Retains active SpeechSynthesisUtterance in window/ref storage
 *    so V8 GC never truncates sentences halfway through.
 * 3. Consistent Elderly-Friendly Cadence: Standardized 0.88 speaking rate and en-IN regional accent.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.VoiceManager = factory();
    root.careLoopVoice = root.VoiceManager;
  }
}(typeof self !== 'undefined' ? self : this, function () {

  // Global persistent storage to prevent Chromium GC bug
  if (typeof window !== 'undefined') {
    window._careLoopVoiceStore = window._careLoopVoiceStore || {
      activeUtterance: null,
      isSpeaking: false,
      defaultRate: 0.88,
      defaultLang: 'en-IN'
    };
  }

  const VoiceManager = {
    /**
     * Cancel any active speech immediately.
     */
    stop() {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch (_) {}
      }
      if (typeof window !== 'undefined' && window._careLoopVoiceStore) {
        window._careLoopVoiceStore.activeUtterance = null;
        window._careLoopVoiceStore.isSpeaking = false;
      }
    },

    /**
     * Speak text with automatic GC protection and queue clearance.
     * @param {string} text - Message to speak.
     * @param {object} options - { rate, lang, pitch, onEnd, onError }
     */
    speak(text, options = {}) {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;

      // 1. ALWAYS cancel any active speech immediately to stop voice bleeding and choppiness
      this.stop();

      if (!text || typeof text !== 'string' || !text.trim()) return null;

      const store = window._careLoopVoiceStore;
      const rate = options.rate !== undefined ? options.rate : store.defaultRate;
      const lang = options.lang || localStorage.getItem('careloop_speech_lang') || store.defaultLang;

      const utterance = new SpeechSynthesisUtterance(text.trim());
      utterance.rate = rate;
      utterance.pitch = options.pitch !== undefined ? options.pitch : 1.0;
      utterance.lang = lang;

      // Pick preferred natural or regional voice if available
      try {
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          const match = voices.find(v => v.lang === lang) ||
                        voices.find(v => v.lang && v.lang.startsWith(lang.slice(0, 2))) ||
                        voices.find(v => v.name && (v.name.toLowerCase().includes('india') || v.name.toLowerCase().includes('natural')));
          if (match) utterance.voice = match;
        }
      } catch (_) {}

      // 2. CRITICAL: Store reference on persistent store to prevent Chromium GC cutting off speech
      store.activeUtterance = utterance;
      store.isSpeaking = true;

      utterance.onstart = () => {
        store.isSpeaking = true;
        if (typeof options.onStart === 'function') options.onStart();
      };

      utterance.onend = () => {
        store.isSpeaking = false;
        if (store.activeUtterance === utterance) {
          store.activeUtterance = null;
        }
        if (typeof options.onEnd === 'function') options.onEnd();
      };

      utterance.onerror = (event) => {
        store.isSpeaking = false;
        if (store.activeUtterance === utterance) {
          store.activeUtterance = null;
        }
        // Suppress canceled error logs during intentional navigation transitions
        if (event.error !== 'canceled' && typeof options.onError === 'function') {
          options.onError(event);
        }
      };

      // 3. Queue the utterance
      try {
        window.speechSynthesis.speak(utterance);
      } catch (_) {}

      return utterance;
    },

    /**
     * Check if speech synthesis is currently active.
     */
    isSpeaking() {
      if (typeof window === 'undefined') return false;
      const store = window._careLoopVoiceStore;
      return (store && store.isSpeaking) || ('speechSynthesis' in window && window.speechSynthesis.speaking);
    }
  };

  // Automatically silence speech on tab/screen teardown
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => VoiceManager.stop());
    window.addEventListener('pagehide', () => VoiceManager.stop());
  }

  return VoiceManager;
}));
