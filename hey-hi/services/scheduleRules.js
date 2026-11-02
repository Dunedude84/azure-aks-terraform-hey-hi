const ShiftRule = require('../models/ShiftRule');

// --- Besoins de la pharmacie ---
const DEFAULT_RULES = [
    // Dimanche (0) — fermeture 20h
    { dayOfWeek: 0, isOpen: true, requiredShifts: [
        { startTime: '09:00', endTime: '17:00', count: 2 },
        { startTime: '12:00', endTime: '20:00', count: 1 },
        { startTime: '16:45', endTime: '20:00', count: 1 }
    ]},
    // Lundi (1)
    { dayOfWeek: 1, isOpen: true, requiredShifts: [
        { startTime: '09:00', endTime: '17:00', count: 2 },
        { startTime: '12:00', endTime: '21:00', count: 1 },
        { startTime: '16:45', endTime: '21:00', count: 1 }
    ]},
    // Mardi (2)
    { dayOfWeek: 2, isOpen: true, requiredShifts: [
        { startTime: '09:00', endTime: '17:00', count: 2 },
        { startTime: '12:00', endTime: '21:00', count: 1 },
        { startTime: '16:45', endTime: '21:00', count: 1 }
    ]},
    // Mercredi (3)
    { dayOfWeek: 3, isOpen: true, requiredShifts: [
        { startTime: '09:00', endTime: '17:00', count: 2 },
        { startTime: '12:00', endTime: '21:00', count: 1 },
        { startTime: '16:45', endTime: '21:00', count: 1 }
    ]},
    // Jeudi (4)
    { dayOfWeek: 4, isOpen: true, requiredShifts: [
        { startTime: '09:00', endTime: '17:00', count: 2 },
        { startTime: '12:00', endTime: '21:00', count: 1 },
        { startTime: '16:45', endTime: '21:00', count: 1 }
    ]},
    // Vendredi (5)
    { dayOfWeek: 5, isOpen: true, requiredShifts: [
        { startTime: '09:00', endTime: '17:00', count: 2 },
        { startTime: '12:00', endTime: '21:00', count: 1 },
        { startTime: '16:45', endTime: '21:00', count: 1 }
    ]},
    // Samedi (6) — fermeture 20h
    { dayOfWeek: 6, isOpen: true, requiredShifts: [
        { startTime: '09:00', endTime: '17:00', count: 2 },
        { startTime: '12:00', endTime: '20:00', count: 1 },
        { startTime: '16:45', endTime: '20:00', count: 1 }
    ]},
];

async function ensureDefaultRules() {
    try {
        const count = await ShiftRule.countDocuments();
        if (count === 0) {
            const rules = DEFAULT_RULES.map(r => ({ ...r, department: 'caisses_avant' }));
            await ShiftRule.insertMany(rules);
            console.log('Règles par défaut de la pharmacie initialisées pour caisses_avant.');
        }
    } catch (err) {
        console.error('Erreur lors de l\'initialisation des règles :', err);
    }
}

module.exports = {
    DEFAULT_RULES,
    ensureDefaultRules
};
