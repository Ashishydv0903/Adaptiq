import { createApp } from '../../app.js';

describe('Healthcheck & Public Platform Stats Routes', () => {
  const app = createApp();

  const invokeRoute = async (method, path) => {
    const routeLayer = app._router.stack.find(
      (layer) => layer.route && layer.route.path === path && layer.route.methods[method.toLowerCase()]
    );
    if (!routeLayer) {
      throw new Error(`Route not found: ${method} ${path}`);
    }
    const req = { method, path, headers: {}, accepts: () => false };
    let resData = null;
    let statusCode = 200;
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        resData = data;
        return this;
      }
    };
    await routeLayer.route.stack[0].handle(req, res);
    return { status: res.statusCode, body: resData };
  };

  test('GET /api/health returns 200 and healthy status', async () => {
    const res = await invokeRoute('GET', '/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('healthy');
    expect(res.body.service).toMatch(/AdaptIQ/);
  });

  test('GET /api/public/stats returns real counts for questions, skills, tracks and rounds', async () => {
    const res = await invokeRoute('GET', '/api/public/stats');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.questionsCount).toBeGreaterThanOrEqual(100);
    expect(res.body.data.skillsCount).toBeGreaterThanOrEqual(50);
    expect(res.body.data.tracksCount).toBe(7);
    expect(res.body.data.roundsCount).toBe(5);
    expect(Array.isArray(res.body.data.tracks)).toBe(true);
    expect(Array.isArray(res.body.data.stages)).toBe(true);
  });

  test('GET /api/stats/public alias returns identical structure', async () => {
    const res = await invokeRoute('GET', '/api/stats/public');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.questionsCount).toBeDefined();
  });
});
