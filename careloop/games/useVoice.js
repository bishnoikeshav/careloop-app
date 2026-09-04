import { useEffect, useRef, useCallback } from 'react';

/**
 * useVoice - React hook for elderly cognitive care voice synthesis.
 * Features:
 * - Always cancels existing speech before queuing new utterance (prevents audio bleed/stuttering).
 * - Stores active utterance in persistent ref/window store (prevents Chromium GC truncation).
 * - Standard 0.88 speaking rate (calm elderly cadence).
 * - Automatic unmount cleanup cancelling speech.
 */
export function useVoice({ defaultRate = 0.88, defaultLang = 'en-IN' } = {}) {
  const activeUtteranceRef = useRef(null);

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }
    if (activeUtteranceRef.current) {
      activeUtteranceRef.current = null;
    }
    if (typeof window !== 'undefined' && window._careLoopActiveUtterance) {
      window._careLoopActiveUtterance = null;
    }
  }, []);

  const speak = useCallback((text, options = {}) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;

    // 1. ALWAYS cancel any active speech immediately to stop voice bleeding
    stop();

    if (!text || typeof text !== 'string' || !text.trim()) return null;

    const rate = options.rate !== undefined ? options.rate : defaultRate;
    const lang = options.lang || defaultLang;

    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.rate = rate;
    utterance.pitch = options.pitch !== undefined ? options.pitch : 1.0;
    utterance.lang = lang;

    // Resolve matching voice if available
    try {
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const match = voices.find(v => v.lang === lang) ||
                      voices.find(v => v.lang && v.lang.startsWith(lang.slice(0, 2))) ||
                      voices.find(v => v.name && (v.name.toLowerCase().includes('india') || v.name.toLowerCase().includes('natural')));
        if (match) utterance.voice = match;
      }
    } catch (_) {}

    // 2. CRITICAL: Store in persistent ref & window property to prevent Chromium GC truncation
    activeUtteranceRef.current = utterance;
    window._careLoopActiveUtterance = utterance;

    utterance.onend = () => {
      if (activeUtteranceRef.current === utterance) {
        activeUtteranceRef.current = null;
      }
      if (typeof window !== 'undefined' && window._careLoopActiveUtterance === utterance) {
        window._careLoopActiveUtterance = null;
      }
      if (typeof options.onEnd === 'function') options.onEnd();
    };

    utterance.onerror = (e) => {
      if (activeUtteranceRef.current === utterance) {
        activeUtteranceRef.current = null;
      }
      if (typeof window !== 'undefined' && window._careLoopActiveUtterance === utterance) {
        window._careLoopActiveUtterance = null;
      }
      if (e.error !== 'canceled' && typeof options.onError === 'function') {
        options.onError(e);
      }
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch (_) {}

    return utterance;
  }, [defaultRate, defaultLang, stop]);

  // Screen/component unmount cleanup
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return { speak, stop };
}

export default useVoice;
