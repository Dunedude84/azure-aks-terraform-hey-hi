const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { setup, teardown } = require('../test/helpers/setup');
const request = require('supertest');

let app;

describe('auth routes', () => {
    before(async () => {
        ({ app } = await setup());
    });

    after(async () => {
        await teardown();
    });

    it('logs in as admin with valid credentials', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'admin', password: 'password' })
            .expect(200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.role, 'admin');
    });

    it('rejects invalid admin credentials', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'admin', password: 'wrong' })
            .expect(401);
        assert.strictEqual(res.body.success, false);
    });

    it('logs in as guest with valid credentials', async () => {
        const res = await request(app)
            .post('/api/auth/guest-login')
            .send({ username: 'guest', password: 'guestpass', role: 'admin' })
            .expect(200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.guest, true);
    });

    it('rejects guest login with invalid role', async () => {
        const res = await request(app)
            .post('/api/auth/guest-login')
            .send({ username: 'guest', password: 'guestpass', role: 'superuser' })
            .expect(400);
        assert.strictEqual(res.body.success, false);
    });

    it('returns 401 for /me when not authenticated', async () => {
        const res = await request(app)
            .get('/api/auth/me')
            .expect(401);
        assert.strictEqual(res.body.authenticated, false);
    });

    it('returns admin session after login', async () => {
        const agent = request.agent(app);
        await agent
            .post('/api/auth/login')
            .send({ username: 'admin', password: 'password' })
            .expect(200);
        const res = await agent
            .get('/api/auth/me')
            .expect(200);
        assert.strictEqual(res.body.authenticated, true);
        assert.strictEqual(res.body.role, 'admin');
    });
});
