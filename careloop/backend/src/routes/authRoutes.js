const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const store = require('../services/store');
const emailService = require('../services/emailService');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

// 1. Password Signup
router.post('/register', (req, res) => {
  const { email, password, name, role } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const existing = store.findUserByEmail(email);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  const user = store.createUser({ email, password, name, role: role || 'caregiver' });
  const token = generateToken(user);

  res.status(201).json({
    message: 'Account created successfully',
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role }
  });
});

// 2. Password Login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = store.findUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const isMatch = bcrypt.compareSync(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = generateToken(user);
  res.json({
    message: 'Authentication successful',
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role }
  });
});

// 3. Request 6-Digit Email OTP
router.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'A valid email address is required' });
  }

  // Generate cryptographic 6-digit code
  const otpCode = crypto.randomInt(100000, 999999).toString();
  store.saveOtp(email, otpCode, config.otpExpiresMinutes);

  // Send through Email Service (SES / Local logger)
  const dispatchResult = await emailService.sendOtpEmail(email, otpCode);

  res.json({
    message: `Verification code sent to ${email}`,
    expiresInMinutes: config.otpExpiresMinutes,
    previewCode: dispatchResult.previewCode || null // Handy for local instant testing
  });
});

// 4. Verify 6-Digit OTP
router.post('/verify-otp', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and 6-digit code are required' });
  }

  const otpRecord = store.getOtp(email);
  if (!otpRecord) {
    return res.status(400).json({ error: 'No active code found. Please request a new code.' });
  }

  if (Date.now() > otpRecord.expiresAt) {
    store.clearOtp(email);
    return res.status(400).json({ error: 'Code has expired. Please request a new one.' });
  }

  otpRecord.attempts = (otpRecord.attempts || 0) + 1;
  if (otpRecord.attempts > 5) {
    store.clearOtp(email);
    return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new code.' });
  }

  if (otpRecord.code !== code.trim()) {
    return res.status(400).json({ error: 'Incorrect verification code. Please check and try again.' });
  }

  // OTP verified successfully
  store.clearOtp(email);

  let user = store.findUserByEmail(email);
  if (!user) {
    // Auto-create user upon successful OTP validation if first time
    user = store.createUser({
      email,
      password: crypto.randomBytes(16).toString('hex'),
      name: email.split('@')[0],
      role: 'caregiver'
    });
  }

  const token = generateToken(user);
  res.json({
    message: 'Verification confirmed. Logged in successfully.',
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role }
  });
});

// 5. Verify Session / Me
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
