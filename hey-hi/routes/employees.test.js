const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { setup, teardown, clearCollections } = require('../test/helpers/setup');
const request = require('supertest');

let app;

async function loginAsAdmin(agent) {
    await agent.post('/api/auth/login').send({ username: 'admin', password: 'password' });
}

describe('employees routes', () => {
    before(async () => {
        ({ app } = await setup());
    });

    after(async () => {
        await teardown();
    });

    it('rejects employee creation when not authenticated', async () => {
        await request(app)
            .post('/api/employees')
            .send({ name: 'Alice', department: 'caisses_avant' })
            .expect(401);
    });

    it('creates an employee when logged in as admin', async () => {
        const agent = request.agent(app);
        await loginAsAdmin(agent);
        const res = await agent
            .post('/api/employees')
            .send({ name: 'Alice', department: 'caisses_avant' })
            .expect(201);
        assert.strictEqual(res.body.name, 'Alice');
        assert.ok(res.body.id);
    });

    it('lists employees for a department', async () => {
        const agent = request.agent(app);
        await loginAsAdmin(agent);
        await agent.post('/api/employees').send({ name: 'Bob', department: 'caisses_avant' });
        const res = await agent
            .get('/api/employees?department=caisses_avant')
            .expect(200);
        assert.ok(Array.isArray(res.body));
        assert.ok(res.body.length >= 1);
    });

    it('updates an employee as admin', async () => {
        const agent = request.agent(app);
        await loginAsAdmin(agent);
        const created = await agent
            .post('/api/employees')
            .send({ name: 'Charlie', department: 'caisses_avant' })
            .expect(201);
        const updated = await agent
            .put(`/api/employees/${created.body.id}`)
            .send({ weeklyHoursTarget: 25 })
            .expect(200);
        assert.strictEqual(updated.body.weeklyHoursTarget, 25);
    });

    it('deletes an employee and their shifts', async () => {
        const agent = request.agent(app);
        await loginAsAdmin(agent);
        const created = await agent
            .post('/api/employees')
            .send({ name: 'Dave', department: 'caisses_avant' })
            .expect(201);
        await agent
            .delete(`/api/employees/${created.body.id}`)
            .expect(200);
        const list = await agent
            .get('/api/employees?department=caisses_avant')
            .expect(200);
        assert.ok(!list.body.some(e => e.id === created.body.id));
    });
});
