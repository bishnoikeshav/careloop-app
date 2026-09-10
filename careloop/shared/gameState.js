// CareLoop Game State Manager
// Centralized localStorage-backed game history for real-time dashboard analytics
(function() {
  const STORAGE_KEY = 'careloop_game_history';

  class GameState {
    constructor() {
      this._history = this._load();
    }

    _load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        console.warn('[CareLoopGameState] Failed to parse history:', e);
        return [];
      }
    }

    _save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this._history));
      } catch (e) {
        console.warn('[CareLoopGameState] Failed to save history:', e);
      }
    }

    /**
     * Record a completed game result.
     * @param {Object} result
     * @param {string} result.gameName - Display name (e.g. 'Memory Match')
     * @param {string} result.gameType - Machine key (e.g. 'memory-match')
     * @param {number} result.score - Accuracy percentage (0-100)
     * @param {number} result.durationSec - Time taken in seconds
     * @param {number} [result.moves] - Number of moves/attempts
     */
    addResult(result) {
      const entry = {
        id: 'game_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        date: new Date().toISOString(),
        gameName: result.gameName || 'Unknown',
        gameType: result.gameType || 'unknown',
        score: typeof result.score === 'number' ? result.score : 0,
        durationSec: typeof result.durationSec === 'number' ? result.durationSec : 0,
        moves: result.moves || 0,
        // CAS = (Accuracy * 0.65) + (Speed Benchmark * 0.35)
        casScore: this._computeCAS(result.score, result.durationSec)
      };

      this._history.push(entry);

      // Keep at most 200 entries to prevent localStorage bloat
      if (this._history.length > 200) {
        this._history = this._history.slice(-200);
      }

      this._save();

      // Cloud sync to Supabase if available
      if (typeof window !== 'undefined' && window.CareLoopSync && window.CareLoopSync.insertGameLog) {
        window.CareLoopSync.insertGameLog(entry).catch(function(err) {
          console.warn('[Supabase] Game log insert failed (cached locally):', err);
        });
      }

      return entry;
    }

    _computeCAS(accuracy, durationSec) {
      const baseSpeedSec = 40;
      const speedScore = Math.max(20, Math.min(100, 100 - ((durationSec - baseSpeedSec) * 1.5)));
      return Math.round((accuracy * 0.65) + (speedScore * 0.35));
    }

    /** @returns {Array} Full game history array */
    getHistory() {
      return this._load(); // Always read fresh from localStorage
    }

    /** @returns {number} Average CAS score across all sessions, or 0 if none */
    getAverageCAS() {
      const history = this.getHistory();
      if (history.length === 0) return 0;
      const sum = history.reduce((acc, h) => acc + (h.casScore || 0), 0);
      return Math.round(sum / history.length);
    }

    /** @returns {number} Average accuracy across all sessions, or 0 if none */
    getAverageScore() {
      const history = this.getHistory();
      if (history.length === 0) return 0;
      const sum = history.reduce((acc, h) => acc + (h.score || 0), 0);
      return Math.round(sum / history.length);
    }

    /** @returns {number} Total number of sessions played */
    getTotalSessions() {
      return this.getHistory().length;
    }

    /**
     * Get the last N results.
     * @param {number} n
     * @returns {Array}
     */
    getRecentResults(n) {
      const history = this.getHistory();
      return history.slice(-n).reverse();
    }

    /**
     * Get results filtered by game type.
     * @param {string} gameType
     * @returns {Array}
     */
    getByGameType(gameType) {
      return this.getHistory().filter(h => h.gameType === gameType);
    }

    /** Clear all history */
    clear() {
      this._history = [];
      this._save();
    }
  }

  window.CareLoopGameState = new GameState();
})();
