const { describe, it } = require('node:test');
const assert = require('node:assert');
const { findAvailability, employeeCoversShift, getOverlap } = require('./schedulingAlgorithm');

function makeEmployee(overrides = {}) {
    return {
        _id: { toString: () => overrides.id || 'emp1' },
        id: overrides.id || 'emp1',
        name: overrides.name || 'Test Employee',
        availabilities: overrides.availabilities || [],
        vacations: overrides.vacations || [],
        isFormation: overrides.isFormation || false,
        isHeadCashier: overrides.isHeadCashier || false,
        weeklyHoursTarget: overrides.weeklyHoursTarget || 37.5,
        seniority: overrides.seniority || 10,
        lunchBreakMinutes: overrides.lunchBreakMinutes || 60,
        ...overrides
    };
}

describe('findAvailability', () => {
    it('returns generic availability when no weekStart is specified', () => {
        const emp = makeEmployee({
            availabilities: [
                { dayOfWeek: 1, weekStart: null, isAvailable: true, startTime: '09:00', endTime: '17:00' }
            ]
        });
        const avail = findAvailability(emp, 1, true, null);
        assert.ok(avail);
        assert.strictEqual(avail.startTime, '09:00');
        assert.strictEqual(avail.endTime, '17:00');
    });

    it('prefers specific weekStart over generic availability', () => {
        const emp = makeEmployee({
            availabilities: [
                { dayOfWeek: 1, weekStart: null, isAvailable: true, startTime: '09:00', endTime: '17:00' },
                { dayOfWeek: 1, weekStart: '2026-07-12', isAvailable: true, startTime: '12:00', endTime: '21:00' }
            ]
        });
        const avail = findAvailability(emp, 1, true, '2026-07-12');
        assert.ok(avail);
        assert.strictEqual(avail.startTime, '12:00');
        assert.strictEqual(avail.endTime, '21:00');
    });

    it('respects an explicit unavailable override for a specific week instead of falling back to generic', () => {
        const emp = makeEmployee({
            availabilities: [
                { dayOfWeek: 1, weekStart: null, isAvailable: true, startTime: '09:00', endTime: '17:00' },
                { dayOfWeek: 1, weekStart: '2026-07-12', isAvailable: false, startTime: '12:00', endTime: '21:00' }
            ]
        });
        const avail = findAvailability(emp, 1, true, '2026-07-12');
        assert.ok(avail);
        assert.strictEqual(avail.isAvailable, false);
        assert.strictEqual(employeeCoversShift(emp, 1, '09:00', '17:00', true, '2026-07-12'), false);
    });

    it('handles week 2 indices (dayOfWeek + 7) for legacy generic availabilities', () => {
        const emp = makeEmployee({
            availabilities: [
                { dayOfWeek: 8, weekStart: null, isAvailable: true, startTime: '10:00', endTime: '18:00' }
            ]
        });
        const avail = findAvailability(emp, 1, false, null);
        assert.ok(avail);
        assert.strictEqual(avail.startTime, '10:00');
    });

    it('returns the availability record even when marked unavailable', () => {
        const emp = makeEmployee({
            availabilities: [
                { dayOfWeek: 1, weekStart: null, isAvailable: false, startTime: '09:00', endTime: '17:00' }
            ]
        });
        const avail = findAvailability(emp, 1, true, null);
        assert.ok(avail);
        assert.strictEqual(avail.isAvailable, false);
        assert.strictEqual(employeeCoversShift(emp, 1, '09:00', '17:00'), false);
    });
});

describe('employeeCoversShift', () => {
    it('returns true when availability fully covers the shift', () => {
        const emp = makeEmployee({
            availabilities: [
                { dayOfWeek: 1, weekStart: null, isAvailable: true, startTime: '09:00', endTime: '21:00' }
            ]
        });
        assert.strictEqual(employeeCoversShift(emp, 1, '12:00', '20:00'), true);
    });

    it('returns false when availability does not cover the shift', () => {
        const emp = makeEmployee({
            availabilities: [
                { dayOfWeek: 1, weekStart: null, isAvailable: true, startTime: '09:00', endTime: '17:00' }
            ]
        });
        assert.strictEqual(employeeCoversShift(emp, 1, '16:00', '20:00'), false);
    });

    it('returns true for fixed availability matching exactly', () => {
        const emp = makeEmployee({
            availabilities: [
                { dayOfWeek: 1, weekStart: null, isAvailable: true, isFixed: true, startTime: '12:00', endTime: '21:00' }
            ]
        });
        assert.strictEqual(employeeCoversShift(emp, 1, '12:00', '21:00'), true);
    });
});

describe('getOverlap', () => {
    it('returns the overlapping interval between availability and required shift', () => {
        const emp = makeEmployee({
            availabilities: [
                { dayOfWeek: 1, weekStart: null, isAvailable: true, startTime: '09:00', endTime: '17:00' }
            ]
        });
        const overlap = getOverlap(emp, 1, '12:00', '20:00');
        assert.ok(overlap);
        assert.strictEqual(overlap.startTime, '12:00');
        assert.strictEqual(overlap.endTime, '17:00');
        assert.strictEqual(overlap.durationMins, 300);
    });

    it('returns null when there is no overlap', () => {
        const emp = makeEmployee({
            availabilities: [
                { dayOfWeek: 1, weekStart: null, isAvailable: true, startTime: '09:00', endTime: '12:00' }
            ]
        });
        const overlap = getOverlap(emp, 1, '13:00', '17:00');
        assert.strictEqual(overlap, null);
    });
});
