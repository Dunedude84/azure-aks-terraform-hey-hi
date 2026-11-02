const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const Employee = require('../models/Employee');
const Shift = require('../models/Shift');
const { GUEST_EMPLOYEE } = require('./auth');
const { validateAndNormalizeAvailabilities } = require('../services/timeValidation');

// Get all employees
router.get('/', async (req, res) => {
    try {
        const department = req.query.department || 'caisses_avant';
        const employees = await Employee.find({ department: department });
        res.json(employees);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get the currently logged-in employee's own profile (self-service access)
router.get('/me', async (req, res) => {
    try {
        if (!req.session || req.session.role !== 'employee' || (!req.session.employeeId && !req.session.isGuest)) {
            return res.status(403).json({ message: 'Accès réservé aux employés connectés' });
        }
        if (req.session.isGuest) {
            return res.json(GUEST_EMPLOYEE);
        }
        const employee = await Employee.findById(req.session.employeeId);
        if (!employee) return res.status(404).json({ message: 'Employé introuvable' });
        res.json(employee);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Update the currently logged-in employee's own availabilities (self-service access, availabilities only)
router.put('/me/availability', async (req, res) => {
    try {
        if (!req.session || req.session.role !== 'employee' || !req.session.employeeId) {
            return res.status(403).json({ message: 'Accès réservé aux employés connectés' });
        }
        const employee = await Employee.findById(req.session.employeeId);
        if (!employee) return res.status(404).json({ message: 'Employé introuvable' });

        const incoming = req.body.availabilities || [];
        const fallbackWeekStart = req.body.weekStart || null;
        const { availabilities: validated, error } = validateAndNormalizeAvailabilities(incoming);
        if (error) return res.status(400).json({ message: error });
        const normalized = validated.map(a => ({ ...a, weekStart: a.weekStart !== undefined ? (a.weekStart || null) : fallbackWeekStart }));
        const weekStartsToReplace = new Set(normalized.map(a => a.weekStart || null));
        const otherAvailabilities = employee.availabilities.filter(a => !weekStartsToReplace.has(a.weekStart || null));
        employee.availabilities = otherAvailabilities.concat(normalized);
        employee.markModified('availabilities');
        await employee.save();

        res.json(employee);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Add an employee
router.post('/', async (req, res) => {
    const employee = new Employee({
        name: req.body.name,
        department: req.body.department || 'caisses_avant'
    });
    try {
        if (req.body.username) {
            employee.username = req.body.username.trim().toLowerCase();
        }
        if (req.body.password) {
            employee.passwordHash = await bcrypt.hash(req.body.password, 10);
        }
        const newEmployee = await employee.save();
        res.status(201).json(newEmployee);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Update an employee (e.g., availabilities)
router.put('/:id', async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.id);
        if (!employee) return res.status(404).json({ message: 'Employé introuvable' });

        if (req.body.availabilities !== undefined) {
            const incoming = req.body.availabilities || [];
            const fallbackWeekStart = req.body.weekStart || null;
            const { availabilities: validated, error } = validateAndNormalizeAvailabilities(incoming);
            if (error) return res.status(400).json({ message: error });
            // Each item may carry its own weekStart (e.g. one real week each); fall back to the
            // top-level weekStart for items that don't specify one (legacy callers).
            const normalized = validated.map(a => ({ ...a, weekStart: a.weekStart !== undefined ? (a.weekStart || null) : fallbackWeekStart }));
            const weekStartsToReplace = new Set(normalized.map(a => a.weekStart || null));
            // Keep availability entries for other weeks and replace entries for the affected weeks
            const otherAvailabilities = employee.availabilities.filter(a => !weekStartsToReplace.has(a.weekStart || null));
            employee.availabilities = otherAvailabilities.concat(normalized);
            employee.markModified('availabilities');
        }
        if (req.body.employeeType !== undefined)      employee.employeeType = req.body.employeeType;
        if (req.body.weeklyHoursTarget !== undefined) employee.weeklyHoursTarget = req.body.weeklyHoursTarget;
        if (req.body.seniority !== undefined)         employee.seniority = req.body.seniority;
        if (req.body.lunchBreakMinutes !== undefined) employee.lunchBreakMinutes = req.body.lunchBreakMinutes;
        if (req.body.maxEveningShifts !== undefined)  employee.maxEveningShifts = req.body.maxEveningShifts;
        if (req.body.isFormation !== undefined)       employee.isFormation = req.body.isFormation;
        if (req.body.isHeadCashier !== undefined)     employee.isHeadCashier = req.body.isHeadCashier;
        if (employee.isHeadCashier) {
            const existingHead = await Employee.findOne({ isHeadCashier: true, _id: { $ne: employee._id } });
            if (existingHead) {
                return res.status(400).json({ message: 'Un seul chef caissière est autorisé.' });
            }
        }
        if (req.body.vacations !== undefined)         employee.vacations = req.body.vacations;
        if (req.body.username !== undefined) {
            employee.username = req.body.username ? req.body.username.trim().toLowerCase() : null;
        }
        if (req.body.password) {
            employee.passwordHash = await bcrypt.hash(req.body.password, 10);
        }
        await employee.save();

        res.json(employee);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Delete an employee
router.delete('/:id', async (req, res) => {
    try {
        await Employee.findByIdAndDelete(req.params.id);
        // Also delete all shifts for this employee
        await Shift.deleteMany({ employeeId: req.params.id });
        res.json({ message: 'Employee and their shifts deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
