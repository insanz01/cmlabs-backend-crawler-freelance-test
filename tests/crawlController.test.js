const express = require('express');
const request = require('supertest');

// Singleton mock instance so controller and tests share the same object
const mockCrawlerService = {
  crawlByName: jest.fn(),
  crawlAll: jest.fn(),
  crawlCustom: jest.fn(),
};

jest.mock('../src/services/crawlerService', () => {
  return jest.fn(() => mockCrawlerService);
});

jest.mock('../src/repositories', () => ({
  htmlFileRepo: {
    findAll: jest.fn(),
    findByName: jest.fn(),
    deleteByName: jest.fn(),
    save: jest.fn(),
  },
}));

const { htmlFileRepo } = require('../src/repositories');
const { controller, validateNameParam } = require('../src/controllers/crawlController');

function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/api/sites', (req, res) => controller.listAvailableSites(req, res));
  app.post('/api/crawl/:name', validateNameParam, (req, res) => controller.crawlByName(req, res));
  app.post('/api/crawl', (req, res) => controller.crawlAll(req, res));
  app.post('/api/crawl-custom', (req, res) => controller.crawlCustom(req, res));
  app.get('/api/crawls', (req, res) => controller.listCrawls(req, res));
  app.get('/api/crawls/:name', validateNameParam, (req, res) => controller.getCrawlByName(req, res));
  app.delete('/api/crawls/:name', validateNameParam, (req, res) => controller.deleteCrawlByName(req, res));

  return app;
}

describe('CrawlController', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
  });

  describe('GET /api/sites', () => {
    test('should return list of configured sites', async () => {
      const res = await request(app).get('/api/sites');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(3);
      expect(res.body.data[0]).toHaveProperty('key');
      expect(res.body.data[0]).toHaveProperty('url');
      expect(res.body.data[0]).toHaveProperty('type');
    });
  });

  describe('POST /api/crawl/:name', () => {
    test('should reject invalid name parameter', async () => {
      const res = await request(app).post('/api/crawl/bad%20name!');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('should crawl by valid name', async () => {
      mockCrawlerService.crawlByName.mockResolvedValue({ name: 'quotes' });

      const res = await request(app).post('/api/crawl/quotes');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('quotes');
    });

    test('should handle crawl errors', async () => {
      mockCrawlerService.crawlByName.mockRejectedValue(new Error('not found in config'));

      const res = await request(app).post('/api/crawl/unknown');

      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/crawl', () => {
    test('should crawl all sites', async () => {
      mockCrawlerService.crawlAll.mockResolvedValue([{ name: 'site1' }, { name: 'site2' }]);

      const res = await request(app).post('/api/crawl');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
    });

    test('should handle errors', async () => {
      mockCrawlerService.crawlAll.mockRejectedValue(new Error('Something broke'));

      const res = await request(app).post('/api/crawl');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/crawls', () => {
    test('should list all crawl results', async () => {
      htmlFileRepo.findAll.mockResolvedValue([
        { name: 'site1', url: 'https://a.com' },
        { name: 'site2', url: 'https://b.com' },
      ]);

      const res = await request(app).get('/api/crawls');

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
    });
  });

  describe('GET /api/crawls/:name', () => {
    test('should return 404 if not found', async () => {
      htmlFileRepo.findByName.mockResolvedValue(null);

      const res = await request(app).get('/api/crawls/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    test('should return crawl data', async () => {
      htmlFileRepo.findByName.mockResolvedValue({
        name: 'my-site',
        html: '<html></html>',
      });

      const res = await request(app).get('/api/crawls/my-site');

      expect(res.status).toBe(200);
      expect(res.body.data.html).toBe('<html></html>');
    });

    test('should reject invalid name', async () => {
      const res = await request(app).get('/api/crawls/bad%20name!');
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/crawls/:name', () => {
    test('should return 404 if nothing deleted', async () => {
      htmlFileRepo.deleteByName.mockResolvedValue(false);

      const res = await request(app).delete('/api/crawls/nonexistent');

      expect(res.status).toBe(404);
    });

    test('should delete crawl data', async () => {
      htmlFileRepo.deleteByName.mockResolvedValue(true);

      const res = await request(app).delete('/api/crawls/my-site');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/crawl-custom', () => {
    test('should reject missing name or url', async () => {
      const res1 = await request(app).post('/api/crawl-custom').send({});
      expect(res1.status).toBe(400);

      const res2 = await request(app).post('/api/crawl-custom').send({ name: 'test' });
      expect(res2.status).toBe(400);

      const res3 = await request(app).post('/api/crawl-custom').send({ url: 'https://test.com' });
      expect(res3.status).toBe(400);
    });

    test('should reject invalid name', async () => {
      const res = await request(app)
        .post('/api/crawl-custom')
        .send({ name: 'bad name!', url: 'https://test.com' });

      expect(res.status).toBe(400);
    });

    test('should reject invalid URL protocol', async () => {
      const res = await request(app)
        .post('/api/crawl-custom')
        .send({ name: 'test', url: 'ftp://test.com' });

      expect(res.status).toBe(400);
    });

    test('should reject malformed URL', async () => {
      const res = await request(app)
        .post('/api/crawl-custom')
        .send({ name: 'test', url: 'not-a-url' });

      expect(res.status).toBe(400);
    });

    test('should return HTML file for valid crawl', async () => {
      mockCrawlerService.crawlCustom.mockResolvedValue({});
      htmlFileRepo.findByName.mockResolvedValue({
        name: 'test',
        html: '<html>content</html>',
      });

      const res = await request(app)
        .post('/api/crawl-custom')
        .send({ name: 'test', url: 'https://example.com' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.headers['content-disposition']).toContain('test.html');
      expect(res.text).toBe('<html>content</html>');
    });

    test('should handle result null after crawl', async () => {
      mockCrawlerService.crawlCustom.mockResolvedValue({});
      htmlFileRepo.findByName.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/crawl-custom')
        .send({ name: 'test', url: 'https://example.com' });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });

    test('should handle result with null html', async () => {
      mockCrawlerService.crawlCustom.mockResolvedValue({});
      htmlFileRepo.findByName.mockResolvedValue({ name: 'test', html: null });

      const res = await request(app)
        .post('/api/crawl-custom')
        .send({ name: 'test', url: 'https://example.com' });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });

    test('should handle crawl errors gracefully', async () => {
      mockCrawlerService.crawlCustom.mockRejectedValue(new Error('Crawl failed'));

      const res = await request(app)
        .post('/api/crawl-custom')
        .send({ name: 'test', url: 'https://example.com' });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe('validateNameParam', () => {
    test('should accept valid names', async () => {
      mockCrawlerService.crawlByName.mockResolvedValue({ name: 'valid-name_123' });

      const res = await request(app).post('/api/crawl/valid-name_123');
      expect(res.status).toBe(200);
    });

    test('should reject names with special characters', async () => {
      const res = await request(app).post('/api/crawl/name%24%40');
      expect(res.status).toBe(400);
    });
  });
});
