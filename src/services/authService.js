import { supabase } from '../supabaseClient.js';

/**
 * CareLoop Authentication & Profile Service
 * =========================================
 * Provides clean, robust methods for Supabase Email OTP authentication,
 * password management, returning-user password login, and dual-column profile saving.
 */

/**
 * Sends a 6-digit numeric OTP to the provided email address.
 * @param {string} email
 * @returns {Promise<any>}
 */
export async function sendEmailOtp(email) {
  if (!email || !email.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }

  const { data, error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      shouldCreateUser: true
    }
  });

  if (error) throw error;
  return data;
}

/**
 * Verifies a 6-digit email OTP token.
 * @param {string} email
 * @param {string} token - 6-digit numeric token
 * @returns {Promise<{ session: any, user: any }>}
 */
export async function verifyEmailOtp(email, token) {
  if (!email || !token) {
    throw new Error('Email and verification code are required.');
  }

  const cleanToken = token.toString().trim();
  if (cleanToken.length < 6) {
    throw new Error('Please enter the complete 6-digit verification code.');
  }

  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: cleanToken,
    type: 'email'
  });

  if (error) throw error;
  return data;
}

/**
 * Updates the current authenticated user's permanent password.
 * @param {string} newPassword
 * @returns {Promise<{ user: any }>}
 */
export async function updateUserPassword(newPassword) {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
    data: {
      has_password: true,
      has_set_password: true
    }
  });

  if (error) throw error;
  return data;
}

/**
 * Signs in an existing user using email and password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ session: any, user: any }>}
 */
export async function signInWithPassword(email, password) {
  if (!email || !password) {
    throw new Error('Please enter both email and password.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password: password
  });

  if (error) throw error;
  return data;
}

/**
 * Saves both patient and caregiver details to the Supabase `profiles` table.
 * Uses exact matching columns to avoid PostgreSQL 42703 undefined column errors.
 *
 * @param {string} userId - Authenticated user UUID
 * @param {Object} data - Profile input fields
 * @returns {Promise<boolean>}
 */
export async function saveCareProfile(userId, data = {}) {
  if (!userId) {
    throw new Error('User ID is required to save care profile.');
  }

  const profilePayload = {
    id: userId,
    full_name: data.patientName || data.fullName || '',
    name: data.patientName || data.fullName || '',
    age: data.age ? parseInt(data.age, 10) : null,
    role: data.role || 'caregiver',
    preferred_language: data.language || 'English',
    phone: data.caregiverPhone || data.phone || '',
    relationship: data.relationship || '',
    notes: data.notes || ''
  };

  // Upsert matching database columns safely
  const { error } = await supabase
    .from('profiles')
    .upsert(profilePayload, { onConflict: 'id' });

  if (error) {
    console.error('[saveCareProfile] Supabase upsert error:', error);
    throw error;
  }

  // Also persist to Supabase Auth metadata for immediate session availability
  try {
    await supabase.auth.updateUser({
      data: {
        full_name: profilePayload.full_name,
        patient_name: profilePayload.full_name,
        age: profilePayload.age,
        preferred_language: profilePayload.preferred_language,
        caregiver_name: data.caregiverName || '',
        relationship: profilePayload.relationship,
        phone: profilePayload.phone,
        notes: profilePayload.notes
      }
    });
  } catch (metaErr) {
    console.warn('[saveCareProfile] Metadata sync notice:', metaErr.message);
  }

  // Mirror to localStorage for offline resilience
  try {
    localStorage.setItem('careloop_user_profile', JSON.stringify({
      ...profilePayload,
      caregiver_name: data.caregiverName || ''
    }));
    localStorage.setItem('careloop_patient_name', profilePayload.full_name || 'Patient');
    localStorage.setItem('careloop_app_language', profilePayload.preferred_language);
    localStorage.setItem('careloop_authenticated', 'true');
  } catch (_) {}

  return true;
}

// Alias for backwards compatibility
export const upsertProfile = saveCareProfile;

/**
 * Retrieves the current authenticated user.
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) return null;
  return user;
}

/**
 * Retrieves the current active Supabase session.
 */
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) return null;
  return session;
}

/**
 * Signs out the current user session from Supabase.
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) console.warn('[authService] signOut notice:', error.message);
}

export default {
  sendEmailOtp,
  verifyEmailOtp,
  updateUserPassword,
  signInWithPassword,
  saveCareProfile,
  upsertProfile,
  getCurrentUser,
  getSession,
  signOut
};
