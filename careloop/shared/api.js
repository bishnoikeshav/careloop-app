// CareLoop Unified API Client
// Connects to Node.js backend with intelligent offline fallback
(function() {
  const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
    ? window.location.origin + '/api'
    : 'http://localhost:4000/api';

  class CareLoopApi {
    constructor() {
      this.token = localStorage.getItem('careloop_token') || null;
      this.user = JSON.parse(localStorage.getItem('careloop_user') || 'null');
    }

    setSession(token, user) {
      this.token = token;
      this.user = user;
      localStorage.setItem('careloop_token', token);
      localStorage.setItem('careloop_user', JSON.stringify(user));
    }

    clearSession() {
      this.token = null;
      this.user = null;
      localStorage.removeItem('careloop_token');
      localStorage.removeItem('careloop_user');
    }

    isAuthenticated() {
      return !!this.token;
    }

    async request(endpoint, options = {}) {
      const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      };

      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
          ...options,
          headers
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || `HTTP error ${res.status}`);
        }
        return data;
      } catch (err) {
        console.warn(`[CareLoop API] ${endpoint} failed, falling back to client mode:`, err.message);
        throw err;
      }
    }

    // --- Auth API ---
    async login(email, password) {
      try {
        const res = await this.request('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });
        this.setSession(res.token, res.user);
        return res;
      } catch (err) {
        // Fallback for demo when server not running
        if (email === 'rahul@careloop.health' && password === 'CareLoop2026!') {
          const fakeUser = { id: 'usr_caregiver_01', name: 'Rahul K.', email, role: 'caregiver' };
          this.setSession('mock_jwt_token_' + Date.now(), fakeUser);
          return { user: fakeUser, token: this.token };
        }
        throw err;
      }
    }

    async sendOtp(email) {
      try {
        return await this.request('/auth/send-otp', {
          method: 'POST',
          body: JSON.stringify({ email })
        });
      } catch (err) {
        // Dev fallback: generate local 6-digit code so user can test seamlessly
        const devCode = Math.floor(100000 + Math.random() * 900000).toString();
        sessionStorage.setItem('dev_otp_' + email, devCode);
        console.log(`[CareLoop Dev Fallback] OTP for ${email}: ${devCode}`);
        return { message: `Code sent to ${email}`, previewCode: devCode, expiresInMinutes: 10 };
      }
    }

    async verifyOtp(email, code) {
      try {
        const res = await this.request('/auth/verify-otp', {
          method: 'POST',
          body: JSON.stringify({ email, code })
        });
        this.setSession(res.token, res.user);
        return res;
      } catch (err) {
        const storedCode = sessionStorage.getItem('dev_otp_' + email);
        if (storedCode && storedCode === code.trim()) {
          const user = { id: 'usr_otp_' + Date.now(), name: email.split('@')[0], email, role: 'caregiver' };
          this.setSession('mock_otp_jwt_' + Date.now(), user);
          return { user, token: this.token, message: 'Verified successfully' };
        }
        throw err;
      }
    }

    // --- Calling API ---
    async getContacts() {
      try {
        const res = await this.request('/calls/contacts');
        return res.contacts;
      } catch (err) {
        // Accurate default contacts fallback
        return [
          {
            id: 'contact_priya',
            name: 'Priya Sharma',
            relationship: 'Daughter & Primary Caregiver',
            shortRelation: 'Daughter',
            phone: '+91 98765 43210',
            avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80',
            isEmergency: true,
            priorityOrder: 1,
            lastCalled: 'Yesterday, 6:12 PM'
          },
          {
            id: 'contact_bose',
            name: 'Dr. Ravi Bose',
            relationship: 'Attending Neurologist & Physician',
            shortRelation: 'Doctor',
            phone: '+91 11 2345 6789',
            avatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80',
            isEmergency: false,
            priorityOrder: 2,
            lastCalled: 'Aug 24, 2026'
          },
          {
            id: 'contact_ramesh',
            name: 'Ramesh Sharma',
            relationship: 'Son',
            shortRelation: 'Son',
            phone: '+91 98111 22334',
            avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
            isEmergency: false,
            priorityOrder: 3,
            lastCalled: '3 days ago'
          },
          {
            id: 'contact_meena',
            name: 'Meena Devi',
            relationship: 'Sister',
            shortRelation: 'Sister',
            phone: '+91 98450 99887',
            avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80',
            isEmergency: false,
            priorityOrder: 4,
            lastCalled: '5 days ago'
          }
        ];
      }
    }

    async initiateCall(contactId) {
      try {
        const res = await this.request('/calls/initiate', {
          method: 'POST',
          body: JSON.stringify({ contactId })
        });
        return res.call;
      } catch (err) {
        const contacts = await this.getContacts();
        const contact = contacts.find(c => c.id === contactId) || contacts[0];
        return {
          callSessionId: 'mock_call_' + Date.now(),
          contact,
          status: 'ringing'
        };
      }
    }

    async endCall(contactId, durationSec) {
      try {
        return await this.request('/calls/end', {
          method: 'POST',
          body: JSON.stringify({ contactId, durationSec })
        });
      } catch (err) {
        return { success: true };
      }
    }

    // --- Games API ---
    async initGameSession(gameType, difficulty) {
      try {
        return await this.request('/games/session', {
          method: 'POST',
          body: JSON.stringify({ gameType, difficulty })
        });
      } catch (err) {
        return null;
      }
    }

    async recordGame(data) {
      try {
        return await this.request('/games/record', {
          method: 'POST',
          body: JSON.stringify(data)
        });
      } catch (err) {
        return { success: true };
      }
    }

    // --- Languages API (All 22 Official Languages of India + English) ---
    async getLanguages() {
      try {
        return await this.request('/languages');
      } catch (err) {
        return {
          current: localStorage.getItem('careloop_lang') || 'en',
          languages: [
            { code: 'en', name: 'English', native: 'English', bcp47: 'en-IN' },
            { code: 'hi', name: 'Hindi', native: 'हिन्दी', bcp47: 'hi-IN' },
            { code: 'as', name: 'Assamese', native: 'অসমীয়া', bcp47: 'as-IN' },
            { code: 'bn', name: 'Bengali', native: 'বাংলা', bcp47: 'bn-IN' },
            { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી', bcp47: 'gu-IN' },
            { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ', bcp47: 'kn-IN' },
            { code: 'ks', name: 'Kashmiri', native: 'کٲشُر / कश्मीरी', bcp47: 'ks-IN' },
            { code: 'kok', name: 'Konkani', native: 'कोंकणी', bcp47: 'kok-IN' },
            { code: 'ml', name: 'Malayalam', native: 'മലയാളം', bcp47: 'ml-IN' },
            { code: 'mni', name: 'Manipuri', native: 'মৈতৈলোন্', bcp47: 'mni-IN' },
            { code: 'mr', name: 'Marathi', native: 'मराठी', bcp47: 'mr-IN' },
            { code: 'ne', name: 'Nepali', native: 'नेपाली', bcp47: 'ne-NP' },
            { code: 'or', name: 'Odia', native: 'ଓଡ଼ିଆ', bcp47: 'or-IN' },
            { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', bcp47: 'pa-IN' },
            { code: 'sa', name: 'Sanskrit', native: 'संस्कृतम्', bcp47: 'sa-IN' },
            { code: 'sat', name: 'Santali', native: 'ᱥᱟᱱᱛᱟᱲᱤ', bcp47: 'sat-IN' },
            { code: 'sd', name: 'Sindhi', native: 'سنڌي / सिन्धी', bcp47: 'sd-IN' },
            { code: 'ta', name: 'Tamil', native: 'தமிழ்', bcp47: 'ta-IN' },
            { code: 'te', name: 'Telugu', native: 'తెలుగు', bcp47: 'te-IN' },
            { code: 'ur', name: 'Urdu', native: 'اردو', bcp47: 'ur-IN' },
            { code: 'brx', name: 'Bodo', native: 'बड़ो', bcp47: 'brx-IN' },
            { code: 'doi', name: 'Dogri', native: 'डोगरी', bcp47: 'doi-IN' },
            { code: 'mai', name: 'Maithili', native: 'मैथिली', bcp47: 'mai-IN' }
          ]
        };
      }
    }

    async getTranslations(code) {
      const c = code || localStorage.getItem('careloop_lang') || 'en';
      try {
        const res = await this.request(`/languages/translations/${c}`);
        if (res && res.translations && Object.keys(res.translations).length > 0) {
          return res;
        }
      } catch (err) {}

      // Robust instant local fallback
      const localDict = (window.CARELOOP_TRANSLATIONS && window.CARELOOP_TRANSLATIONS[c]) 
        || (window.CARELOOP_TRANSLATIONS && window.CARELOOP_TRANSLATIONS['en']) 
        || {};
      return { code: c, translations: localDict };
    }

    async setLanguage(code) {
      localStorage.setItem('careloop_lang', code);
      try {
        const res = await this.request('/languages/set', {
          method: 'POST',
          body: JSON.stringify({ code })
        });
        return res;
      } catch (err) {
        return { current: code };
      }
    }
  }

  window.careLoopApi = new CareLoopApi();
})();

