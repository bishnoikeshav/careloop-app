const express = require('express');
const { INDIAN_LANGUAGES, TRANSLATIONS } = require('../services/languages');

const router = express.Router();

// Current active application language setting (in-memory, syncs across clients)
let activeLanguage = 'en';

// 1. Get all 22 official languages of India (+ English)
router.get('/', (req, res) => {
  res.json({
    languages: INDIAN_LANGUAGES,
    current: activeLanguage,
    total: INDIAN_LANGUAGES.length
  });
});

// 2. Get translations for a specific language or active language
router.get('/translations/:code?', (req, res) => {
  const code = req.params.code || activeLanguage;
  const translations = TRANSLATIONS[code] || TRANSLATIONS['en'];
  const langMeta = INDIAN_LANGUAGES.find(l => l.code === code) || INDIAN_LANGUAGES[0];

  res.json({
    code,
    language: langMeta,
    translations
  });
});

// 3. Set the active application language
router.post('/set', (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Language code is required' });
  }

  const found = INDIAN_LANGUAGES.find(l => l.code === code.toLowerCase());
  if (!found) {
    return res.status(404).json({ error: `Language code '${code}' is not supported.` });
  }

  activeLanguage = found.code;
  res.json({
    message: `Language updated to ${found.name} (${found.native})`,
    current: activeLanguage,
    language: found,
    translations: TRANSLATIONS[activeLanguage] || TRANSLATIONS['en']
  });
});

module.exports = router;
