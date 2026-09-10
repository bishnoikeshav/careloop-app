/**
 * CareLoop Supabase Sync Layer
 * ============================
 * Write-through data layer:  every mutation goes to Supabase first, then
 * mirrors into localStorage so the app works identically when offline.
 *
 * Depends on:
 *   window.CareLoopSupabase   (from supabaseClient.js — may be null)
 *
 * Exposes:
 *   window.CareLoopSync       (object with async helper methods)
 */
(function () {
  'use strict';

  /* ========================================================================
   *  Helpers
   * ====================================================================== */

  /** Safe JSON parse with fallback */
  function jsonParse(str, fallback) {
    try { return JSON.parse(str); } catch (_) { return fallback; }
  }

  /** Get the current profile ID — creates one if missing */
  function getProfileId() {
    var id = localStorage.getItem('careloop_profile_id');
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : 'local_' + Date.now();
      localStorage.setItem('careloop_profile_id', id);
    }
    return id;
  }

  /** Returns the Supabase client or null */
  function sb() {
    return window.CareLoopSupabase || null;
  }

  /* ========================================================================
   *  PROFILES
   * ====================================================================== */

  /**
   * Upsert a user / patient profile.
   * @param {Object} profile  { name, age, role, initials, language }
   *                          id is auto-assigned via getProfileId()
   */
  async function upsertProfile(profile) {
    var id = profile.id || getProfileId();
    localStorage.setItem('careloop_profile_id', id);

    var row = {
      id:         id,
      name:       profile.name  || '',
      age:        parseInt(profile.age, 10) || 0,
      role:       profile.role  || 'patient',
      initials:   profile.initials || (profile.name || '?').charAt(0).toUpperCase(),
      language:   profile.language || localStorage.getItem('careloop_lang') || 'en',
      updated_at: new Date().toISOString()
    };

    // --- localStorage (always) ---
    localStorage.setItem('careloop_user_profile', JSON.stringify(row));
    localStorage.setItem('careloop_patient_name', row.name);
    localStorage.setItem('careloop_user_role', row.role);

    // --- Supabase ---
    if (!sb()) return row;
    var res = await sb().from('profiles').upsert(row, { onConflict: 'id' });
    if (res.error) console.warn('[Supabase] upsertProfile error:', res.error.message);
    return row;
  }

  /**
   * Fetch a profile from Supabase (falls back to localStorage).
   */
  async function fetchProfile(profileId) {
    var id = profileId || getProfileId();
    if (sb()) {
      var res = await sb().from('profiles').select('*').eq('id', id).maybeSingle();
      if (res.data) {
        // Sync to localStorage
        localStorage.setItem('careloop_user_profile', JSON.stringify(res.data));
        localStorage.setItem('careloop_patient_name', res.data.name || '');
        localStorage.setItem('careloop_user_role', res.data.role || 'patient');
        return res.data;
      }
      if (res.error) console.warn('[Supabase] fetchProfile error:', res.error.message);
    }
    return jsonParse(localStorage.getItem('careloop_user_profile'), null);
  }

  /* ========================================================================
   *  MEDICATIONS
   * ====================================================================== */

  /**
   * Fetch all medications for the current profile.
   */
  async function fetchMedications(profileId) {
    var id = profileId || getProfileId();
    if (sb()) {
      var res = await sb().from('medications').select('*').eq('profile_id', id);
      if (res.data && res.data.length > 0) {
        localStorage.setItem('careloop_medications', JSON.stringify(res.data));
        return res.data;
      }
      if (res.error) console.warn('[Supabase] fetchMedications error:', res.error.message);
    }
    return jsonParse(localStorage.getItem('careloop_medications'), []);
  }

  /**
   * Upsert a single medication row.
   */
  async function upsertMedication(med, profileId) {
    var id = profileId || getProfileId();
    var row = Object.assign({}, med, { profile_id: id });

    // --- localStorage ---
    var list = jsonParse(localStorage.getItem('careloop_medications'), []);
    var idx  = list.findIndex(function (m) { return m.id === med.id; });
    if (idx >= 0) list[idx] = row; else list.push(row);
    localStorage.setItem('careloop_medications', JSON.stringify(list));

    // --- Supabase ---
    if (!sb()) return row;
    var res = await sb().from('medications').upsert(row, { onConflict: 'id' });
    if (res.error) console.warn('[Supabase] upsertMedication error:', res.error.message);
    return row;
  }

  /**
   * Update only the status column of a medication.
   * @param {string} medId
   * @param {string} status   'pending' | 'taken' | 'snoozed'
   */
  async function updateMedicationStatus(medId, status, profileId) {
    // --- localStorage ---
    var list = jsonParse(localStorage.getItem('careloop_medications'), []);
    var target = list.find(function (m) { return m.id === medId; });
    if (target) {
      target.status  = status;
      target.is_taken = (status === 'taken');
      localStorage.setItem('careloop_medications', JSON.stringify(list));
    }

    // --- Supabase ---
    if (!sb()) return;
    var res = await sb()
      .from('medications')
      .update({ status: status, is_taken: (status === 'taken') })
      .eq('id', medId);
    if (res.error) console.warn('[Supabase] updateMedicationStatus error:', res.error.message);
  }

  /**
   * Delete a medication row.
   */
  async function deleteMedication(medId, profileId) {
    // --- localStorage ---
    var list = jsonParse(localStorage.getItem('careloop_medications'), []);
    list = list.filter(function (m) { return m.id !== medId; });
    localStorage.setItem('careloop_medications', JSON.stringify(list));

    // --- Supabase ---
    if (!sb()) return;
    var res = await sb().from('medications').delete().eq('id', medId);
    if (res.error) console.warn('[Supabase] deleteMedication error:', res.error.message);
  }

  /**
   * Bulk-upsert the entire medications list (useful for initial sync).
   */
  async function syncAllMedications(meds, profileId) {
    var id = profileId || getProfileId();
    var rows = meds.map(function (m) { return Object.assign({}, m, { profile_id: id }); });
    localStorage.setItem('careloop_medications', JSON.stringify(rows));

    if (!sb()) return;
    var res = await sb().from('medications').upsert(rows, { onConflict: 'id' });
    if (res.error) console.warn('[Supabase] syncAllMedications error:', res.error.message);
  }

  /* ========================================================================
   *  GAME LOGS
   * ====================================================================== */

  /**
   * Insert a game result row.
   * @param {Object} entry  The game result object produced by CareLoopGameState.
   */
  async function insertGameLog(entry, profileId) {
    var id = profileId || getProfileId();
    var row = {
      id:           entry.id || 'game_' + Date.now(),
      profile_id:   id,
      game_name:    entry.gameName || entry.game_name || 'Unknown',
      game_type:    entry.gameType || entry.game_type || 'unknown',
      score:        typeof entry.score === 'number' ? entry.score : 0,
      duration_sec: entry.durationSec || entry.duration_sec || 0,
      moves:        entry.moves || 0,
      cas_score:    entry.casScore || entry.cas_score || 0,
      played_at:    entry.date || entry.played_at || new Date().toISOString()
    };

    // localStorage is handled by CareLoopGameState — no duplicate write here.

    if (!sb()) return row;
    var res = await sb().from('game_logs').insert(row);
    if (res.error) console.warn('[Supabase] insertGameLog error:', res.error.message);
    return row;
  }

  /**
   * Fetch recent game history.
   */
  async function fetchGameHistory(profileId, limit) {
    var id  = profileId || getProfileId();
    var lim = limit || 50;
    if (sb()) {
      var res = await sb()
        .from('game_logs')
        .select('*')
        .eq('profile_id', id)
        .order('played_at', { ascending: false })
        .limit(lim);
      if (res.data && res.data.length > 0) return res.data;
      if (res.error) console.warn('[Supabase] fetchGameHistory error:', res.error.message);
    }
    // Fallback: read from CareLoopGameState / localStorage
    var hist = jsonParse(localStorage.getItem('careloop_game_history'), []);
    return hist.slice(-lim).reverse();
  }

  /* ========================================================================
   *  FAMILY CONTACTS
   * ====================================================================== */

  /**
   * Fetch family contacts for the profile.
   */
  async function fetchContacts(profileId) {
    var id = profileId || getProfileId();
    if (sb()) {
      var res = await sb().from('family_contacts').select('*').eq('profile_id', id);
      if (res.data && res.data.length > 0) {
        localStorage.setItem('careloop_contacts', JSON.stringify(res.data));
        return res.data;
      }
      if (res.error) console.warn('[Supabase] fetchContacts error:', res.error.message);
    }
    return jsonParse(localStorage.getItem('careloop_contacts'), null);
  }

  /**
   * Upsert a single family contact.
   */
  async function upsertContact(contact, profileId) {
    var id = profileId || getProfileId();
    var row = Object.assign({}, contact, { profile_id: id });

    // --- localStorage ---
    var list = jsonParse(localStorage.getItem('careloop_contacts'), []);
    var idx  = list.findIndex(function (c) { return c.id === contact.id; });
    if (idx >= 0) list[idx] = row; else list.push(row);
    localStorage.setItem('careloop_contacts', JSON.stringify(list));

    // --- Supabase ---
    if (!sb()) return row;
    var res = await sb().from('family_contacts').upsert(row, { onConflict: 'id' });
    if (res.error) console.warn('[Supabase] upsertContact error:', res.error.message);
    return row;
  }

  /* ========================================================================
   *  Public API
   * ====================================================================== */

  window.CareLoopSync = {
    // helpers
    getProfileId: getProfileId,

    // profiles
    upsertProfile:  upsertProfile,
    fetchProfile:   fetchProfile,

    // medications
    fetchMedications:       fetchMedications,
    upsertMedication:       upsertMedication,
    updateMedicationStatus: updateMedicationStatus,
    deleteMedication:       deleteMedication,
    syncAllMedications:     syncAllMedications,

    // game logs
    insertGameLog:    insertGameLog,
    fetchGameHistory: fetchGameHistory,

    // contacts
    fetchContacts: fetchContacts,
    upsertContact: upsertContact
  };

  console.log('[CareLoop] Supabase sync layer ready ✓');
})();
