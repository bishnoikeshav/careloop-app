/**
 * CareLoop Supabase Client
 * ========================
 * Initialises the Supabase JS v2 client loaded via CDN and exposes it as
 * window.CareLoopSupabase.  If the CDN script hasn't loaded or credentials
 * are missing the app falls back to offline-only (localStorage) mode.
 *
 * Requires BEFORE this file:
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 */
(function () {
  'use strict';

  // ---- Config ---------------------------------------------------------------
  // Prefer an explicit config object set by the host page, otherwise fall back
  // to well-known defaults (anon key is a *publishable* key, safe to embed).
  var cfg = window.CARELOOP_CONFIG || {};

  var SUPABASE_URL  = cfg.SUPABASE_URL  || '';
  var SUPABASE_KEY  = cfg.SUPABASE_ANON_KEY || '';

  // ---- Guard: CDN loaded? ---------------------------------------------------
  if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
    console.warn('[CareLoop] Supabase JS SDK not loaded — running in offline-only mode.');
    window.CareLoopSupabase = null;
    return;
  }

  // ---- Guard: credentials present? ------------------------------------------
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('[CareLoop] Supabase credentials not configured — running in offline-only mode.');
    window.CareLoopSupabase = null;
    return;
  }

  // ---- Create client --------------------------------------------------------
  try {
    window.CareLoopSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('[CareLoop] Supabase client initialised ✓');
  } catch (err) {
    console.error('[CareLoop] Supabase client init failed:', err);
    window.CareLoopSupabase = null;
  }
})();
