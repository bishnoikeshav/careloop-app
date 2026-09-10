import { supabase } from '../supabaseClient.js';

/**
 * CareLoop Authentication Service
 * ===============================
 * Handles Supabase Email OTP authentication, password management,
 * and session state management with safe error mapping.
 */

/**
 * Sends a 6-digit numeric OTP to the provided email address.
 * @param {string} email
 * @returns {Promise<{ data: any, error: any }>}
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

  if (error) {
    throw error;
  }

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

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Updates the current authenticated user's permanent password.
 * Also flags `has_password: true` in user_metadata so future logins can detect it.
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

  if (error) {
    throw error;
  }

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

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Signs out the current user session from Supabase.
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.warn('[authService] signOut error:', error.message);
  }
}

/**
 * Retrieves the current active Supabase session.
 * @returns {Promise<any>}
 */
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.warn('[authService] getSession error:', error.message);
    return null;
  }
  return session;
}

/**
 * Retrieves the current authenticated Supabase user.
 * @returns {Promise<any>}
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    return null;
  }
  return user;
}

/**
 * Checks whether a given user has previously established a permanent password.
 * Inspects user_metadata, identities, and app_metadata.
 * @param {any} user
 * @returns {boolean}
 */
export function hasUserEstablishedPassword(user) {
  if (!user) return false;
  if (user.user_metadata?.has_password === true) return true;
  if (user.user_metadata?.has_set_password === true) return true;
  if (user.app_metadata?.has_password === true) return true;
  return false;
}

/**
 * Maps raw Supabase and network errors into clean, user-friendly messages.
 * @param {any} err
 * @returns {string}
 */
export function getFriendlyAuthErrorMessage(err) {
  if (!err) return 'Something went wrong. Please try again.';
  const msg = (typeof err === 'string' ? err : (err.message || err.msg || '')).toLowerCase();
  const status = err.status || err.statusCode || 0;

  if (status === 429 || msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('rate_limit')) {
    return 'Please wait before requesting another code.';
  }
  if (msg.includes('token has expired') || msg.includes('otp has expired') || msg.includes('expired')) {
    return 'This code has expired. Please request a new code.';
  }
  if (msg.includes('invalid') || msg.includes('incorrect') || msg.includes('otp_disabled') || msg.includes('bad token')) {
    return 'That code is incorrect. Please check your email and try again.';
  }
  if (msg.includes('invalid login credentials') || msg.includes('wrong password') || msg.includes('invalid_grant')) {
    return 'Invalid email or password. Please try again.';
  }
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch') || msg.includes('connection')) {
    return 'Please check your internet connection and try again.';
  }
  if (msg.includes('email not confirmed')) {
    return 'Please check your email and enter the verification code.';
  }
  if (msg.includes('user not found')) {
    return 'No account found with this email. Please sign in with OTP first.';
  }
  return err.message || 'Authentication error. Please try again.';
}

export default {
  sendEmailOtp,
  verifyEmailOtp,
  updateUserPassword,
  signInWithPassword,
  signOut,
  getSession,
  getCurrentUser,
  hasUserEstablishedPassword,
  getFriendlyAuthErrorMessage
};
