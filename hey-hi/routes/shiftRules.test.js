const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { setup, teardown } = require('../test/helpers/setup');
const request = require('supertest');

let app;

async function loginAsAdmin(agent) {
    await agent.post('/api/auth/login').send({ username: 'admin', password: 'password' });
}

describe('shift rules routes', () => {
    before(async () => {
        ({ app } = await setup());
    });

    after(async () => {
        await teardown();
    });

    it('lists default rules for a department', async () => {
        const agent = request.agent(app);
        await loginAsAdmin(agent);
        await agent
            .post('/api/shift-rules/reset')
            .send({ department: 'caisses_avant' })
            .expect(200);
        const res = await agent
            .get('/api/shift-rules?department=caisses_avant')
            .expect(200);
        assert.ok(Array.isArray(res.body));
        assert.strictEqual(res.body.length, 7);
    });

    it('updates a specific week rule via upsert', async () => {
        const agent = request.agent(app);
        await loginAsAdmin(agent);
        const res = await agent
            .put('/api/shift-rules')
            .send({
                department: 'caisses_avant',
                rules: [
                    {
                        dayOfWeek: 1,
                        weekStart: '2026-07-12',
                        isOpen: true,
                        requiredShifts: [{ startTime: '10:00', endTime: '14:00', count: 1 }]
                    }
                ]
            })
            .expect(200);
        const rule = res.body.find(r => r.dayOfWeek === 1 && r.weekStart === '2026-07-12');
        assert.ok(rule);
        assert.strictEqual(rule.requiredShifts[0].startTime, '10:00');
    });

    it('resets rules to defaults', async () => {
        const agent = request.agent(app);
        await loginAsAdmin(agent);
        const res = await agent
            .post('/api/shift-rules/reset')
            .send({ department: 'caisses_avant' })
            .expect(200);
        assert.strictEqual(res.body.rules.length, 7);
    });
});
