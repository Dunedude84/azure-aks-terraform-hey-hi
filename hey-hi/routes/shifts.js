const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const Shift = require('../models/Shift');
const { findAvailability, employeeCoversShift } = require('../services/schedulingAlgorithm');

function getSundayWeekStart(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const day = date.getDay();
    const start = new Date(y, m - 1, d - day);
    return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
}

// Get all shifts
router.get('/', async (req, res) => {
    try {
        const department = req.query.department || 'caisses_avant';
        const shifts = await Shift.find({ department: department });
        res.json(shifts);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Create or update a shift
router.post('/', async (req, res) => {
    const { employeeId, date, startTime, endTime, shiftId, breakMinutes, department, isFormation, hasStar, force, code } = req.body;

    try {
        // Validate against employee availability (skip if force=true for manual assignments,
        // or if this is a code-only entry like "CONGÉ" that has no start/end time)
        const employee = await Employee.findById(employeeId);
        if (!employee) throw new Error("Employé introuvable");

        if (!force && !code) {
            // Extract day of week from date string (YYYY-MM-DD). Use local time to avoid UTC shift
            const [y, m, d] = date.split('-');
            const shiftDateObj = new Date(y, m - 1, d);
            const dayOfWeek = shiftDateObj.getDay();
            const weekStart = getSundayWeekStart(date);

            const availability = findAvailability(employee, dayOfWeek, true, weekStart);
            if (!availability || !availability.isAvailable) {
                throw new Error(`L'employé n'est pas disponible le ${date}.`);
            }
            if (!employeeCoversShift(employee, dayOfWeek, startTime, endTime, true, weekStart)) {
                throw new Error(`Conflit d'horaire. Disponibilité: ${availability.startTime} à ${availability.endTime}`);
            }
        }

        if (shiftId) {
            // Update existing shift (also allows moving it to another employee/date, e.g. via drag & drop)
            const updatedShift = await Shift.findByIdAndUpdate(
                shiftId,
                { employeeId, date, startTime: startTime || undefined, endTime: endTime || undefined, breakMinutes: breakMinutes || 0, isFormation: isFormation || false, hasStar: hasStar || false, code: code || null },
                { returnDocument: 'after' }
            );
            res.json(updatedShift);
        } else {
            // Check if shift already exists for this employee on this date
            const existingShift = await Shift.findOne({ employeeId, date });
            if (existingShift) {
                // Remove existing if duplicate logic was intended, or just update it
                await Shift.findByIdAndDelete(existingShift._id);
            }

            // Create new shift
            const newShift = new Shift({
                employeeId,
                date,
                startTime: startTime || undefined,
                endTime: endTime || undefined,
                breakMinutes: breakMinutes || 0,
                department: department || 'caisses_avant',
                isFormation: isFormation || false,
                hasStar: hasStar || false,
                code: code || null
            });
            const savedShift = await newShift.save();
            res.status(201).json(savedShift);
        }
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Delete a shift
router.delete('/:id', async (req, res) => {
    try {
        await Shift.findByIdAndDelete(req.params.id);
        res.json({ message: 'Shift deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
