const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { setup, teardown, clearCollections } = require('../test/helpers/setup');
const Employee = require('../models/Employee');
const ShiftRule = require('../models/ShiftRule');
const Shift = require('../models/Shift');
const { generateSchedule } = require('./scheduleService');

describe('generateSchedule integration', () => {
    before(async () => {
        await setup();
    });

    after(async () => {
        await teardown();
    });

    it('generates required shifts for a single open day', async () => {
        await clearCollections();

        const emp = await Employee.create({
            name: 'Alice',
            department: 'caisses_avant',
            employeeType: 'temps-plein',
            weeklyHoursTarget: 37.5,
            seniority: 10,
            lunchBreakMinutes: 60,
            availabilities: [
                { dayOfWeek: 1, weekStart: null, isAvailable: true, startTime: '09:00', endTime: '21:00' }
            ]
        });

        await ShiftRule.create({
            dayOfWeek: 1,
            department: 'caisses_avant',
            isOpen: true,
            requiredShifts: [
                { startTime: '12:00', endTime: '16:00', count: 1 }
            ]
        });

        const { generatedShifts, warnings } = await generateSchedule('caisses_avant', '2026-07-13', '2026-07-13', '2026-07-13');

        assert.strictEqual(generatedShifts.length, 1);
        assert.strictEqual(generatedShifts[0].employeeId.toString(), emp._id.toString());
        assert.strictEqual(generatedShifts[0].startTime, '12:00');
        assert.strictEqual(generatedShifts[0].endTime, '16:00');
        assert.strictEqual(warnings.length, 0);
    });

    it('warns when not enough employees are available', async () => {
        await clearCollections();

        await ShiftRule.create({
            dayOfWeek: 2,
            department: 'caisses_avant',
            isOpen: true,
            requiredShifts: [
                { startTime: '09:00', endTime: '17:00', count: 3 }
            ]
        });

        const { generatedShifts, warnings } = await generateSchedule('caisses_avant', '2026-07-14', '2026-07-14', '2026-07-14');

        assert.strictEqual(generatedShifts.length, 0);
        assert.strictEqual(warnings.length, 1);
        assert.ok(warnings[0].includes('Pas assez d\'employés disponibles'));
    });

    it('uses week-specific rules before generic ones', async () => {
        await clearCollections();

        const emp = await Employee.create({
            name: 'Bob',
            department: 'caisses_avant',
            employeeType: 'temps-plein',
            weeklyHoursTarget: 37.5,
            seniority: 10,
            lunchBreakMinutes: 60,
            availabilities: [
                { dayOfWeek: 3, weekStart: null, isAvailable: true, startTime: '09:00', endTime: '21:00' }
            ]
        });

        await ShiftRule.create({
            dayOfWeek: 3,
            weekStart: null,
            department: 'caisses_avant',
            isOpen: true,
            requiredShifts: [
                { startTime: '12:00', endTime: '21:00', count: 1 }
            ]
        });

        await ShiftRule.create({
            dayOfWeek: 3,
            weekStart: '2026-07-12',
            department: 'caisses_avant',
            isOpen: true,
            requiredShifts: [
                { startTime: '09:00', endTime: '17:00', count: 1 }
            ]
        });

        const { generatedShifts } = await generateSchedule('caisses_avant', '2026-07-15', '2026-07-15', '2026-07-15');

        assert.strictEqual(generatedShifts.length, 1);
        assert.strictEqual(generatedShifts[0].startTime, '09:00');
        assert.strictEqual(generatedShifts[0].endTime, '17:00');
    });

    it('skips closed days', async () => {
        await clearCollections();

        await ShiftRule.create({
            dayOfWeek: 4,
            department: 'caisses_avant',
            isOpen: false,
            requiredShifts: [
                { startTime: '09:00', endTime: '17:00', count: 1 }
            ]
        });

        const { generatedShifts } = await generateSchedule('caisses_avant', '2026-07-16', '2026-07-16', '2026-07-16');

        assert.strictEqual(generatedShifts.length, 0);
    });
});
