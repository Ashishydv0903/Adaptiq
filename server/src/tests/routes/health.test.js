import request from 'supertest';
import { createApp } from '../../app.js';

describe('Healthcheck Route', () => {
  const app = createApp();

  test('GET /api/health returns 200 and healthy status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('healthy');
    expect(res.body.service).toMatch(/AdaptIQ/);
  });

  test('GET /api/unknown-route returns 404 with structured error', async () => {
    const res = await request(app).get('/api/unknown-route');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.status).toBe('fail');
  });
});
