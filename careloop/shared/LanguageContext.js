/**
 * CareLoop Global Language Context & Provider
 * Supports React components across patient and caregiver interfaces.
 * Provides persistent language state backed by localStorage and inter-frame message bus.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('react'));
  } else {
    const ReactLib = root.React || window.React;
    const result = factory(ReactLib);
    root.LanguageContext = result.LanguageContext;
    root.LanguageProvider = result.LanguageProvider;
    root.useLanguage = result.useLanguage;
    root.t = result.t;
    window.CareLoopLanguageContext = result;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (React) {
  if (!React) {
    console.warn('React not detected in global scope. LanguageContext initialized in fallback mode.');
    return {
      LanguageContext: null,
      LanguageProvider: ({ children }) => children,
      useLanguage: () => ({
        appLanguage: (typeof localStorage !== 'undefined' && (localStorage.getItem('careloop_app_language') || localStorage.getItem('careloop_lang'))) || 'en',
        setAppLanguage: () => {},
        t: (key) => key
      }),
      t: (key) => key
    };
  }

  const { createContext, useContext, useState, useEffect, useCallback } = React;

  const LanguageContext = createContext({
    appLanguage: 'en',
    setAppLanguage: () => {},
    t: (key, fallback) => fallback || key,
    translations: {},
    supportedLanguages: [
      { code: 'en', label: 'English', native: 'English' },
      { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
      { code: 'as', label: 'Assamese', native: 'অসমীয়া' },
      { code: 'brx', label: 'Bodo', native: 'बड़ो' }
    ]
  });

  function LanguageProvider({ children }) {
    const [appLanguage, setAppLanguageState] = useState(() => {
      try {
        return localStorage.getItem('careloop_app_language') || localStorage.getItem('careloop_lang') || 'en';
      } catch (_) {
        return 'en';
      }
    });

    const setAppLanguage = useCallback((newLang) => {
      if (!newLang) return;
      setAppLanguageState(newLang);
      try {
        localStorage.setItem('careloop_app_language', newLang);
        localStorage.setItem('careloop_lang', newLang);
      } catch (_) {}

      // Dispatch to window
      window.dispatchEvent(new CustomEvent('careloop:languageChange', { detail: { lang: newLang } }));

      // Broadcast to parent shell if in iframe
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'languageChange', code: newLang, appLanguage: newLang }, '*');
        }
      } catch (_) {}

      // Broadcast to child frames if any
      document.querySelectorAll('iframe').forEach(frame => {
        try {
          if (frame.contentWindow) {
            frame.contentWindow.postMessage({ type: 'languageChange', code: newLang, appLanguage: newLang }, '*');
          }
        } catch (_) {}
      });

      // Also trigger auto DOM translation if available
      if (typeof window.applyTranslationsToDOM === 'function') {
        window.applyTranslationsToDOM(newLang);
      }
    }, []);

    // Sync on storage and postMessage
    useEffect(() => {
      const handleStorage = (e) => {
        if (e.key === 'careloop_app_language' || e.key === 'careloop_lang') {
          const val = e.newValue;
          if (val && val !== appLanguage) {
            setAppLanguageState(val);
          }
        }
      };

      const handleMessage = (e) => {
        if (!e.data) return;
        if ((e.data.type === 'languageChange' || e.data.type === 'appLanguageChange') && e.data.code) {
          if (e.data.code !== appLanguage) {
            setAppLanguageState(e.data.code);
            try {
              localStorage.setItem('careloop_app_language', e.data.code);
              localStorage.setItem('careloop_lang', e.data.code);
            } catch (_) {}
          }
        }
      };

      window.addEventListener('storage', handleStorage);
      window.addEventListener('message', handleMessage);

      // Auto-translate on mount
      if (typeof window.applyTranslationsToDOM === 'function') {
        window.applyTranslationsToDOM(appLanguage);
      }

      return () => {
        window.removeEventListener('storage', handleStorage);
        window.removeEventListener('message', handleMessage);
      };
    }, [appLanguage]);

    const t = useCallback((key, fallback) => {
      const dict = (window.CARELOOP_TRANSLATIONS && window.CARELOOP_TRANSLATIONS[appLanguage])
        || (window.CARELOOP_TRANSLATIONS && window.CARELOOP_TRANSLATIONS['en'])
        || {};
      return dict[key] !== undefined ? dict[key] : (fallback !== undefined ? fallback : key);
    }, [appLanguage]);

    const value = {
      appLanguage,
      setAppLanguage,
      t,
      translations: (window.CARELOOP_TRANSLATIONS && window.CARELOOP_TRANSLATIONS[appLanguage]) || {},
      supportedLanguages: [
        { code: 'en', label: 'English', native: 'English' },
        { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
        { code: 'as', label: 'Assamese', native: 'অসমীয়া' },
        { code: 'brx', label: 'Bodo', native: 'बड़ो' }
      ]
    };

    return React.createElement(LanguageContext.Provider, { value }, children);
  }

  function useLanguage() {
    return useContext(LanguageContext);
  }

  function t(key, fallback, lang) {
    const activeLang = lang || (typeof localStorage !== 'undefined' && (localStorage.getItem('careloop_app_language') || localStorage.getItem('careloop_lang'))) || 'en';
    const dict = (window.CARELOOP_TRANSLATIONS && window.CARELOOP_TRANSLATIONS[activeLang])
      || (window.CARELOOP_TRANSLATIONS && window.CARELOOP_TRANSLATIONS['en'])
      || {};
    return dict[key] !== undefined ? dict[key] : (fallback !== undefined ? fallback : key);
  }

  return {
    LanguageContext,
    LanguageProvider,
    useLanguage,
    t
  };
});
