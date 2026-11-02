const express = require('express');
const router = express.Router();
const AvailabilityNote = require('../models/AvailabilityNote');
const Employee = require('../models/Employee');

// Get availability notes for a department and optional date range
router.get('/', async (req, res) => {
    try {
        const { department, startDate, endDate } = req.query;
        const query = { department: department || 'caisses_avant' };

        if (startDate && endDate) {
            query.date = { $gte: startDate, $lte: endDate };
        }

        const notes = await AvailabilityNote.find(query).sort({ date: 1, createdAt: 1 });
        res.json(notes);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Create or replace an availability note (one per employee/date/department)
router.post('/', async (req, res) => {
    try {
        const { employeeId, date, department, note, status, startTime, endTime } = req.body;

        const employee = await Employee.findById(employeeId);
        if (!employee) {
            return res.status(404).json({ message: 'Employé introuvable' });
        }

        const noteDoc = await AvailabilityNote.findOneAndUpdate(
            { employeeId, date, department: department || 'caisses_avant' },
            {
                note: note || '',
                status: status || 'other',
                startTime: startTime || null,
                endTime: endTime || null
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        res.status(201).json(noteDoc);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Update an existing note by id
router.put('/:id', async (req, res) => {
    try {
        const { note, status, startTime, endTime } = req.body;
        const noteDoc = await AvailabilityNote.findByIdAndUpdate(
            req.params.id,
            { note, status, startTime, endTime },
            { new: true }
        );

        if (!noteDoc) {
            return res.status(404).json({ message: 'Note introuvable' });
        }

        res.json(noteDoc);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Delete a note by id
router.delete('/:id', async (req, res) => {
    try {
        await AvailabilityNote.findByIdAndDelete(req.params.id);
        res.json({ message: 'Note supprimée' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
