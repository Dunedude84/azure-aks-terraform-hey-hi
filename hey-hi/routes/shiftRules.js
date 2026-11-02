const express = require('express');
const router = express.Router();
const ShiftRule = require('../models/ShiftRule');
const { DEFAULT_RULES } = require('../services/scheduleService');

function normalizeWeekStart(weekStart) {
    return weekStart === undefined || weekStart === null || weekStart === '' ? null : weekStart;
}

let ensureWeekAwareIndexPromise = null;

async function ensureWeekAwareIndex() {
    if (ensureWeekAwareIndexPromise) return ensureWeekAwareIndexPromise;

    ensureWeekAwareIndexPromise = (async () => {
        let indexes = [];
        try {
            indexes = await ShiftRule.collection.indexes();
        } catch (err) {
            // La collection n'existe pas encore (base fraîche)
            indexes = [];
        }

        const hasLegacy = indexes.some(i => i.name === 'dayOfWeek_1_department_1');
        if (hasLegacy) {
            await ShiftRule.collection.dropIndex('dayOfWeek_1_department_1');
        }

        const hasWeekAware = indexes.some(i => i.name === 'dayOfWeek_1_department_1_weekStart_1');
        if (!hasWeekAware) {
            await ShiftRule.collection.createIndex(
                { dayOfWeek: 1, department: 1, weekStart: 1 },
                { unique: true, name: 'dayOfWeek_1_department_1_weekStart_1' }
            );
        }
    })().catch((err) => {
        ensureWeekAwareIndexPromise = null;
        throw err;
    });

    return ensureWeekAwareIndexPromise;
}

// Get all shift rules
router.get('/', async (req, res) => {
    try {
        const department = req.query.department || 'caisses_avant';
        const rules = await ShiftRule.find({ department: department }).sort({ weekStart: 1, dayOfWeek: 1 });
        res.json(rules);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Update all shift rules (replace)
router.put('/', async (req, res) => {
    try {
        await ensureWeekAwareIndex();
        const rules = req.body.rules; // array of { dayOfWeek, isOpen, requiredShifts }
        const department = req.body.department || 'caisses_avant';
        for (const rule of rules) {
            const weekStart = normalizeWeekStart(rule.weekStart);
            await ShiftRule.findOneAndUpdate(
                { dayOfWeek: rule.dayOfWeek, department: department, weekStart: weekStart },
                { isOpen: rule.isOpen, requiredShifts: rule.requiredShifts, department: department, weekStart: weekStart },
                { upsert: true, returnDocument: 'after' }
            );
        }
        const updated = await ShiftRule.find({ department: department }).sort({ weekStart: 1, dayOfWeek: 1 });
        res.json(updated);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Reset shift rules to defaults
router.post('/reset', async (req, res) => {
    try {
        await ensureWeekAwareIndex();
        const department = req.body.department || 'caisses_avant';
        await ShiftRule.deleteMany({ department: department });
        
        const defaultRulesForDept = DEFAULT_RULES.map(rule => ({ ...rule, department: department }));
        await ShiftRule.insertMany(defaultRulesForDept);
        
        const rules = await ShiftRule.find({ department: department }).sort({ weekStart: 1, dayOfWeek: 1 });
        res.json({ message: 'Règles réinitialisées aux valeurs par défaut', rules });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

module.exports = router;
