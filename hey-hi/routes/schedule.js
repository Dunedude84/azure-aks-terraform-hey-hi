const express = require('express');
const router = express.Router();
const Shift = require('../models/Shift');
const { generateSchedule } = require('../services/scheduleService');

// Generate schedule for a date range
router.post('/generate', async (req, res) => {
    const { startDate, endDate, periodStart, department } = req.body;
    try {
        const { generatedShifts, warnings } = await generateSchedule(department || 'caisses_avant', startDate, endDate, periodStart);
        res.json({ message: "Horaire généré", shifts: generatedShifts, warnings });
    } catch (err) {
        console.error('Erreur generateSchedule:', err);
        res.status(500).json({ message: err.message });
    }
});

// Delete schedule for a date range
router.post('/delete-range', async (req, res) => {
    const { startDate, endDate, department } = req.body;
    try {
        await Shift.deleteMany({ department: department || 'caisses_avant', date: { $gte: startDate, $lte: endDate } });
        res.json({ message: "Horaire supprimé pour la période" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Delete schedule for a specific employee in a date range
router.post('/delete-employee-range', async (req, res) => {
    const { employeeId, startDate, endDate, department } = req.body;
    try {
        await Shift.deleteMany({ employeeId, department: department || 'caisses_avant', date: { $gte: startDate, $lte: endDate } });
        res.json({ message: "Horaire de l'employé supprimé pour la période" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
