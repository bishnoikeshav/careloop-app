const express = require('express');
const store = require('../services/store');

const router = express.Router();

// Preset card decks for Memory Match
const FRUIT_PAIRS = ['🍎', '🍌', '🍇', '🍓', '🍊', '🍉', '🥑', '🍒'];
const NATURE_PAIRS = ['🌸', '🌻', '🌲', '🍀', '🦋', '🍁', '🌙', '⭐'];

// 1. Initialize Game Session
router.post('/session', (req, res) => {
  const { gameType = 'memory-match', difficulty = 'medium' } = req.body;

  if (gameType === 'memory-match') {
    const symbols = difficulty === 'easy' ? FRUIT_PAIRS.slice(0, 6) : FRUIT_PAIRS;
    // Duplicate symbols for pairs and shuffle
    const cards = [...symbols, ...symbols]
      .map((symbol, index) => ({
        id: `card_${index}_${Math.random().toString(36).substring(2, 6)}`,
        symbol,
        matched: false
      }))
      .sort(() => Math.random() - 0.5);

    return res.json({
      sessionId: 'sess_' + Date.now(),
      gameType,
      difficulty,
      totalPairs: symbols.length,
      cards
    });
  }

  if (gameType === 'family-faces') {
    const contacts = store.getContacts();
    const rounds = contacts.map((target, idx) => {
      // 3 distractors + 1 correct answer
      const otherNames = contacts.filter(c => c.id !== target.id).map(c => c.name);
      const options = [target.name, ...otherNames.slice(0, 3)].sort(() => Math.random() - 0.5);

      return {
        roundNumber: idx + 1,
        targetId: target.id,
        avatar: target.avatar,
        correctName: target.name,
        relationship: target.relationship,
        options
      };
    }).sort(() => Math.random() - 0.5);

    return res.json({
      sessionId: 'sess_' + Date.now(),
      gameType,
      totalRounds: rounds.length,
      rounds
    });
  }

  if (gameType === 'color-pattern') {
    return res.json({
      sessionId: 'sess_' + Date.now(),
      gameType,
      palette: [
        { id: 0, name: 'Muted Teal', color: '#0D9488', freq: 392.00 },
        { id: 1, name: 'Warm Amber', color: '#D97706', freq: 440.00 },
        { id: 2, name: 'Sky Blue', color: '#2563EB', freq: 523.25 },
        { id: 3, name: 'Gentle Rose', color: '#DB2777', freq: 587.33 }
      ],
      levels: [
        { level: 1, sequenceLength: 2, paceMs: 1200 },
        { level: 2, sequenceLength: 3, paceMs: 1200 }
      ]
    });
  }

  if (gameType === 'story-recall') {
    return res.json({
      sessionId: 'sess_' + Date.now(),
      gameType,
      story: 'Sunita walked to the local morning market in the hills. She bought fresh green tea leaves and fragrant yellow marigold flowers for her home.',
      questions: [
        {
          question: 'What did Sunita buy at the market?',
          options: [
            { text: 'Green Tea & Flowers', icon: 'emoji_food_beverage', iconColor: 'text-[#2E9E63]', isCorrect: true },
            { text: 'Bread & Fresh Milk', icon: 'bakery_dining', iconColor: 'text-[#D97706]', isCorrect: false },
            { text: 'Red Apples & Rice', icon: 'nutrition', iconColor: 'text-[#DB2777]', isCorrect: false }
          ],
          affirmation: "That's right! Sunita bought fresh tea and flowers."
        },
        {
          question: 'Where did Sunita go this morning?',
          options: [
            { text: 'The Hill Market', icon: 'landscape', iconColor: 'text-[#2E9E63]', isCorrect: true },
            { text: 'The Train Station', icon: 'train', iconColor: 'text-[#2563EB]', isCorrect: false },
            { text: 'The Health Clinic', icon: 'local_hospital', iconColor: 'text-[#7C3AED]', isCorrect: false }
          ],
          affirmation: 'Wonderful! Sunita walked to the morning hill market.'
        }
      ]
    });
  }

  if (gameType === 'daily-objects') {
    return res.json({
      sessionId: 'sess_' + Date.now(),
      gameType,
      studyDurationSec: 15,
      targets: [
        { id: 'glasses', name: 'Reading Glasses', icon: 'eyeglasses', color: '#2E9E63' },
        { id: 'cup', name: 'Brass Tea Cup', icon: 'emoji_food_beverage', color: '#D97706' },
        { id: 'keys', name: 'House Keys', icon: 'vpn_key', color: '#2563EB' }
      ],
      distractors: [
        { id: 'brush', name: 'Toothbrush', icon: 'brush', color: '#0D9488' },
        { id: 'book', name: 'Story Book', icon: 'menu_book', color: '#DB2777' },
        { id: 'lantern', name: 'Brass Lantern', icon: 'wb_incandescent', color: '#CA8A04' }
      ]
    });
  }

  res.status(400).json({ error: 'Unsupported game type' });
});

// 2. Record Completed Game Session & Compute CAS
router.post('/record', (req, res) => {
  const { gameType, gameTitle, accuracy, durationSec, moves, patientId } = req.body;

  if (accuracy === undefined || durationSec === undefined) {
    return res.status(400).json({ error: 'Accuracy and duration are required' });
  }

  const log = store.recordGameSession({
    gameType: gameType || 'memory-match',
    gameTitle: gameTitle || 'Cognitive Game',
    accuracy: Number(accuracy),
    durationSec: Number(durationSec),
    moves: Number(moves || 0),
    patientId: patientId || 'pat_priya_01'
  });

  res.json({
    message: 'Game session recorded successfully',
    record: log
  });
});

// 3. Get Game Stats & CAS Trends for Caregiver Analytics
router.get('/stats', (req, res) => {
  const stats = store.getGameStats();
  res.json(stats);
});

module.exports = router;
