const express = require('express');
const store = require('../services/store');

const router = express.Router();

// 1. Get All Contacts for Patient Calling (Emergency contact first)
router.get('/contacts', (req, res) => {
  const contacts = store.getContacts();
  res.json({ contacts });
});

// 2. Initiate Call to a Specific Contact (Fixes: Calling Dr. Bose calls Dr. Bose!)
router.post('/initiate', (req, res) => {
  const { contactId } = req.body;
  if (!contactId) {
    return res.status(400).json({ error: 'contactId is required to start a call' });
  }

  const contact = store.getContactById(contactId);
  if (!contact) {
    return res.status(404).json({ error: 'Contact not found' });
  }

  const activeCall = {
    callSessionId: 'call_' + Date.now().toString(36),
    contact: {
      id: contact.id,
      name: contact.name,
      relationship: contact.relationship,
      shortRelation: contact.shortRelation,
      phone: contact.phone,
      avatar: contact.avatar,
      isEmergency: contact.isEmergency
    },
    status: 'ringing',
    startedAt: new Date().toISOString()
  };

  res.json({
    message: `Call initiated to ${contact.name} (${contact.shortRelation})`,
    call: activeCall
  });
});

// 3. Complete / End Call and Log Duration
router.post('/end', (req, res) => {
  const { contactId, durationSec, status } = req.body;
  if (!contactId) {
    return res.status(400).json({ error: 'contactId is required' });
  }

  const contact = store.getContactById(contactId);
  const log = store.logCall({
    contactId,
    contactName: contact ? contact.name : 'Unknown Contact',
    durationSec: Number(durationSec || 0),
    status: status || 'completed'
  });

  res.json({
    message: 'Call ended and logged',
    log
  });
});

// 4. Get Call History for Dashboard
router.get('/history', (req, res) => {
  const history = store.getCallLogs(20);
  res.json({ history });
});

// 5. Add / Update Contact from Caregiver Dashboard
router.post('/contacts', (req, res) => {
  const { name, relationship, phone, avatar, isEmergency } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and phone are required' });
  }

  const newContact = store.addContact({
    name,
    relationship: relationship || 'Family Member',
    shortRelation: relationship ? relationship.split(' ')[0] : 'Family',
    phone,
    avatar: avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
    isEmergency: !!isEmergency
  });

  res.status(201).json({
    message: 'Contact added successfully',
    contact: newContact
  });
});

module.exports = router;
