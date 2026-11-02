const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { setup, teardown } = require('../test/helpers/setup');
const request = require('supertest');

let app;

async function loginAsAdmin(agent) {
    await agent.post('/api/auth/login').send({ username: 'admin', password: 'password' });
}

describe('shifts routes', () => {
    before(async () => {
        ({ app } = await setup());
    });

    after(async () => {
        await teardown();
    });

    it('creates a shift matching employee availability', async () => {
        const agent = request.agent(app);
        await loginAsAdmin(agent);
        const emp = await agent
            .post('/api/employees')
            .send({
                name: 'Alice',
                department: 'caisses_avant',
                availabilities: [
                    { dayOfWeek: 1, weekStart: null, isAvailable: true, startTime: '09:00', endTime: '21:00' }
                ]
            })
            .expect(201);
        const res = await agent
            .post('/api/shifts')
            .send({
                employeeId: emp.body.id,
                date: '2026-07-13',
                startTime: '12:00',
                endTime: '16:00',
                department: 'caisses_avant'
            })
            .expect(201);
        assert.strictEqual(res.body.employeeId, emp.body.id);
        assert.strictEqual(res.body.startTime, '12:00');
    });

    it('rejects a shift outside employee availability', async () => {
        const agent = request.agent(app);
        await loginAsAdmin(agent);
        const emp = await agent
            .post('/api/employees')
            .send({
                name: 'Bob',
                department: 'caisses_avant',
                availabilities: [
                    { dayOfWeek: 1, weekStart: null, isAvailable: true, startTime: '09:00', endTime: '17:00' }
                ]
            })
            .expect(201);
        const res = await agent
            .post('/api/shifts')
            .send({
                employeeId: emp.body.id,
                date: '2026-07-13',
                startTime: '18:00',
                endTime: '22:00',
                department: 'caisses_avant'
            })
            .expect(400);
        assert.ok(res.body.message.includes('Conflit d\'horaire'));
    });

    it('allows forced shift outside availability', async () => {
        const agent = request.agent(app);
        await loginAsAdmin(agent);
        const emp = await agent
            .post('/api/employees')
            .send({
                name: 'Carol',
                department: 'caisses_avant',
                availabilities: [
                    { dayOfWeek: 1, weekStart: null, isAvailable: true, startTime: '09:00', endTime: '17:00' }
                ]
            })
            .expect(201);
        const res = await agent
            .post('/api/shifts')
            .send({
                employeeId: emp.body.id,
                date: '2026-07-13',
                startTime: '18:00',
                endTime: '22:00',
                department: 'caisses_avant',
                force: true
            })
            .expect(201);
        assert.strictEqual(res.body.startTime, '18:00');
    });

    it('creates a code-only shift (ex. CONGÉ) without start/end time', async () => {
        const agent = request.agent(app);
        await loginAsAdmin(agent);
        const emp = await agent
            .post('/api/employees')
            .send({
                name: 'Eve',
                department: 'caisses_avant',
                availabilities: [
                    { dayOfWeek: 1, weekStart: null, isAvailable: true, startTime: '09:00', endTime: '17:00' }
                ]
            })
            .expect(201);
        const res = await agent
            .post('/api/shifts')
            .send({
                employeeId: emp.body.id,
                date: '2026-07-13',
                code: 'CONGÉ',
                department: 'caisses_avant',
                force: true
            })
            .expect(201);
        assert.strictEqual(res.body.code, 'CONGÉ');
        assert.strictEqual(res.body.startTime, undefined);

        const list = await agent
            .get('/api/shifts?department=caisses_avant')
            .expect(200);
        const saved = list.body.find(s => s.employeeId === emp.body.id);
        assert.strictEqual(saved.code, 'CONGÉ');
    });

    it('deletes a shift', async () => {
        const agent = request.agent(app);
        await loginAsAdmin(agent);
        const emp = await agent
            .post('/api/employees')
            .send({
                name: 'Dave',
                department: 'caisses_avant',
                availabilities: [
                    { dayOfWeek: 1, weekStart: null, isAvailable: true, startTime: '09:00', endTime: '21:00' }
                ]
            })
            .expect(201);
        const shift = await agent
            .post('/api/shifts')
            .send({
                employeeId: emp.body.id,
                date: '2026-07-13',
                startTime: '10:00',
                endTime: '14:00',
                department: 'caisses_avant'
            })
            .expect(201);
        await agent
            .delete(`/api/shifts/${shift.body.id}`)
            .expect(200);
    });
});
