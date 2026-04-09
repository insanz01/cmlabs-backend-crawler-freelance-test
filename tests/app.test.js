const request = require('supertest');

jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn(),
  },
}));

describe('App setup', () => {
  let app;

  beforeAll(() => {
    const express = require('express');
    const cors = require('cors');
    const helmet = require('helmet');

    app = express();
    app.use(helmet());
    app.use(cors());
    app.use(express.json({ limit: '10kb' }));

    const crawlRoutes = require('../src/routes/crawlRoutes');
    app.use('/api', crawlRoutes);

    app.get('/', (_req, res) => {
      res.json({ message: 'Web Crawler API' });
    });
  });

  test('GET / should return API info', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Web Crawler API');
  });

  test('GET /api/sites should return sites list', async () => {
    const res = await request(app).get('/api/sites');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('should apply helmet security headers', async () => {
    const res = await request(app).get('/');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  test('should reject large JSON body (>10kb)', async () => {
    const bigPayload = { data: 'x'.repeat(11 * 1024) };
    const res = await request(app)
      .post('/api/crawl-custom')
      .send(bigPayload);

    expect(res.status).toBe(413);
  });
});
