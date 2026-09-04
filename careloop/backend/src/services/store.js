const bcrypt = require('bcryptjs');

// In-Memory Database with realistic clinical and caregiver initial state
class CareLoopStore {
  constructor() {
    this.users = new Map();
    this.otps = new Map();
    this.gameSessions = new Map();
    this.gameLogs = [];
    this.callLogs = [];
    this.contacts = [];
    this.initDefaultData();
  }

  initDefaultData() {
    // Default demo caregiver user
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync('CareLoop2026!', salt);

    this.users.set('rahul@careloop.health', {
      id: 'usr_caregiver_01',
      name: 'Rahul K.',
      email: 'rahul@careloop.health',
      password: hashedPassword,
      role: 'caregiver',
      patientId: 'pat_kamala_01',
      patientName: 'Kamala Sharma',
      createdAt: new Date().toISOString()
    });

    // Default Contacts for Patient Calling (Fixed & thoroughly accurate)
    this.contacts = [
      {
        id: 'contact_priya',
        name: 'Priya Sharma',
        relationship: 'Daughter & Primary Caregiver',
        shortRelation: 'Daughter',
        phone: '+91 98765 43210',
        avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80',
        isEmergency: true,
        priorityOrder: 1,
        status: 'Available',
        lastCalled: 'Yesterday, 6:12 PM'
      },
      {
        id: 'contact_ramesh',
        name: 'Ramesh Sharma',
        relationship: 'Son',
        shortRelation: 'Son',
        phone: '+91 98111 22334',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
        isEmergency: false,
        priorityOrder: 2,
        status: 'Available',
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
        priorityOrder: 3,
        status: 'Available',
        lastCalled: '5 days ago'
      },
      {
        id: 'contact_bose',
        name: 'Dr. Ravi Bose',
        relationship: 'Attending Neurologist & Physician',
        shortRelation: 'Doctor',
        phone: '+91 11 2345 6789',
        avatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80',
        isEmergency: false,
        priorityOrder: 4,
        status: 'On Call',
        lastCalled: 'Aug 24, 2026'
      }
    ];

    // Seed realistic Call Logs
    this.callLogs = [
      {
        id: 'call_101',
        contactId: 'contact_priya',
        contactName: 'Priya Sharma',
        relationship: 'Daughter',
        type: 'outgoing',
        status: 'completed',
        durationSec: 154,
        timestamp: new Date(Date.now() - 3600 * 1000 * 18).toISOString()
      },
      {
        id: 'call_102',
        contactId: 'contact_bose',
        contactName: 'Dr. Ravi Bose',
        relationship: 'Doctor',
        type: 'outgoing',
        status: 'completed',
        durationSec: 320,
        timestamp: new Date(Date.now() - 3600 * 1000 * 72).toISOString()
      }
    ];

    // Seed recent CAS Cognitive Activity Scores (for analytics graphs)
    this.gameLogs = [
      {
        id: 'game_01',
        gameType: 'memory-match',
        gameTitle: 'Memory Match',
        patientId: 'pat_priya_01',
        accuracy: 88,
        durationSec: 42,
        moves: 18,
        casScore: 84.5,
        timestamp: new Date(Date.now() - 3600 * 1000 * 4).toISOString()
      },
      {
        id: 'game_02',
        gameType: 'family-faces',
        gameTitle: 'Family Faces',
        patientId: 'pat_priya_01',
        accuracy: 100,
        durationSec: 28,
        moves: 5,
        casScore: 92.0,
        timestamp: new Date(Date.now() - 3600 * 1000 * 24).toISOString()
      }
    ];
  }

  // --- Users & Auth ---
  findUserByEmail(email) {
    if (!email) return null;
    return this.users.get(email.toLowerCase().trim()) || null;
  }

  createUser({ email, password, name, role = 'caregiver' }) {
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);
    const user = {
      id: 'usr_' + Date.now().toString(36),
      name: name || email.split('@')[0],
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role,
      createdAt: new Date().toISOString()
    };
    this.users.set(user.email, user);
    return user;
  }

  // --- OTP Verification Management ---
  saveOtp(email, code, expiresMinutes = 10) {
    const expiresAt = Date.now() + expiresMinutes * 60 * 1000;
    this.otps.set(email.toLowerCase().trim(), {
      code,
      expiresAt,
      attempts: 0
    });
  }

  getOtp(email) {
    return this.otps.get(email.toLowerCase().trim()) || null;
  }

  clearOtp(email) {
    this.otps.delete(email.toLowerCase().trim());
  }

  // --- Contacts ---
  getContacts() {
    return [...this.contacts].sort((a, b) => a.priorityOrder - b.priorityOrder);
  }

  getContactById(id) {
    return this.contacts.find(c => c.id === id) || null;
  }

  addContact(contactData) {
    const newContact = {
      id: 'contact_' + Date.now().toString(36),
      priorityOrder: this.contacts.length + 1,
      lastCalled: 'Never',
      status: 'Available',
      ...contactData
    };
    this.contacts.push(newContact);
    return newContact;
  }

  // --- Call Logging ---
  logCall({ contactId, contactName, durationSec, status = 'completed' }) {
    const log = {
      id: 'call_' + Date.now().toString(36),
      contactId,
      contactName,
      durationSec,
      status,
      timestamp: new Date().toISOString()
    };
    this.callLogs.unshift(log);

    // Update last called string for contact
    const contact = this.getContactById(contactId);
    if (contact) {
      contact.lastCalled = 'Just now';
    }
    return log;
  }

  getCallLogs(limit = 10) {
    return this.callLogs.slice(0, limit);
  }

  // --- Games & CAS Tracking ---
  recordGameSession({ gameType, gameTitle, accuracy, durationSec, moves, patientId = 'pat_priya_01' }) {
    // Calculate Cognitive Activity Score (CAS: 0 - 100)
    // CAS = (Accuracy * 0.65) + (Speed Benchmark Index * 0.35)
    const baseSpeedSec = 40;
    const speedScore = Math.max(20, Math.min(100, 100 - ((durationSec - baseSpeedSec) * 1.5)));
    const casScore = Math.round((accuracy * 0.65) + (speedScore * 0.35));

    const record = {
      id: 'game_' + Date.now().toString(36),
      gameType,
      gameTitle,
      patientId,
      accuracy: Math.round(accuracy),
      durationSec,
      moves,
      casScore,
      timestamp: new Date().toISOString()
    };

    this.gameLogs.unshift(record);
    return record;
  }

  getGameStats() {
    const logs = this.gameLogs;
    if (logs.length === 0) {
      return { averageCas: 78, totalSessions: 0, trend: '+0.0', recentLogs: [] };
    }
    const sumCas = logs.reduce((acc, curr) => acc + curr.casScore, 0);
    const avgCas = Math.round(sumCas / logs.length);
    return {
      averageCas: avgCas,
      totalSessions: logs.length,
      trend: '+4.2',
      recentLogs: logs.slice(0, 10)
    };
  }
}

module.exports = new CareLoopStore();
