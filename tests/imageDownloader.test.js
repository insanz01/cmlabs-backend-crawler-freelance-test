const { downloadImages, replaceImageSources } = require('../src/utils/imageDownloader');
const fs = require('fs');
const path = require('path');
const http = require('http');

const TEST_DIR = path.join(__dirname, '__test_imgs__');

function createMockPage(images) {
  return {
    evaluate: jest.fn().mockResolvedValue(
      images.map((img) => ({
        originalSrc: img.src,
        resolvedUrl: img.url,
      }))
    ),
  };
}

function createTestServer(port, handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(port, () => resolve(server));
  });
}

describe('imageDownloader', () => {
  describe('replaceImageSources()', () => {
    test('should replace image sources in HTML', () => {
      const html = '<img src="https://example.com/photo.png"><img src="https://example.com/logo.svg">';
      const mapping = {
        'https://example.com/photo.png': 'images/site/abc123.png',
        'https://example.com/logo.svg': 'images/site/def456.svg',
      };

      const result = replaceImageSources(html, mapping);

      expect(result).toContain('images/site/abc123.png');
      expect(result).toContain('images/site/def456.svg');
      expect(result).not.toContain('https://example.com/photo.png');
    });

    test('should handle empty mapping', () => {
      const html = '<img src="test.png">';
      expect(replaceImageSources(html, {})).toBe(html);
    });

    test('should escape special regex characters in URLs', () => {
      const html = '<img src="https://example.com/img?size=100&format=png">';
      const mapping = {
        'https://example.com/img?size=100&format=png': 'images/local.png',
      };

      const result = replaceImageSources(html, mapping);
      expect(result).toContain('images/local.png');
    });
  });

  describe('downloadImages()', () => {
    let server;

    beforeAll(async () => {
      server = await createTestServer(9876, (req, res) => {
        if (req.url === '/image.png') {
          res.writeHead(200, { 'content-type': 'image/png' });
          res.end(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
        } else if (req.url === '/not-image') {
          res.writeHead(200, { 'content-type': 'text/html' });
          res.end('<html></html>');
        } else if (req.url === '/redirect') {
          res.writeHead(302, { location: 'http://localhost:9876/image.png' });
          res.end();
        } else if (req.url === '/redirect-loop') {
          res.writeHead(302, { location: 'http://localhost:9876/redirect-loop' });
          res.end();
        } else if (req.url === '/large-image.png') {
          res.writeHead(200, { 'content-type': 'image/png' });
          const big = Buffer.alloc(3 * 1024 * 1024);
          res.end(big);
        } else {
          res.writeHead(404);
          res.end();
        }
      });
    });

    afterAll((done) => {
      server.close(done);
    });

    beforeEach(() => {
      if (fs.existsSync(TEST_DIR)) {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
      }
    });

    afterAll(() => {
      if (fs.existsSync(TEST_DIR)) {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
      }
    });

    test('should download images and return mapping', async () => {
      const page = createMockPage([
        { src: 'http://localhost:9876/image.png', url: 'http://localhost:9876/image.png' },
      ]);

      const mapping = await downloadImages(page, TEST_DIR, 'test-site');

      expect(Object.keys(mapping)).toHaveLength(1);
      expect(mapping['http://localhost:9876/image.png']).toMatch(/^images\/test-site\/.*\.png$/);

      const imgDir = path.join(TEST_DIR, 'images', 'test-site');
      expect(fs.existsSync(imgDir)).toBe(true);
      expect(fs.readdirSync(imgDir)).toHaveLength(1);
    });

    test('should skip non-image content types', async () => {
      const page = createMockPage([
        { src: 'http://localhost:9876/not-image', url: 'http://localhost:9876/not-image' },
      ]);

      const mapping = await downloadImages(page, TEST_DIR, 'test-site');
      expect(Object.keys(mapping)).toHaveLength(0);
    });

    test('should skip images over size limit', async () => {
      const page = createMockPage([
        { src: 'http://localhost:9876/large-image.png', url: 'http://localhost:9876/large-image.png' },
      ]);

      const mapping = await downloadImages(page, TEST_DIR, 'test-site');
      expect(Object.keys(mapping)).toHaveLength(0);
    });

    test('should follow redirects', async () => {
      const page = createMockPage([
        { src: 'http://localhost:9876/redirect', url: 'http://localhost:9876/redirect' },
      ]);

      const mapping = await downloadImages(page, TEST_DIR, 'test-site');
      expect(Object.keys(mapping)).toHaveLength(1);
    });

    test('should handle redirect loops gracefully', async () => {
      const page = createMockPage([
        { src: 'http://localhost:9876/redirect-loop', url: 'http://localhost:9876/redirect-loop' },
      ]);

      const mapping = await downloadImages(page, TEST_DIR, 'test-site');
      expect(Object.keys(mapping)).toHaveLength(0);
    });

    test('should skip 404 images', async () => {
      const page = createMockPage([
        { src: 'http://localhost:9876/missing.png', url: 'http://localhost:9876/missing.png' },
      ]);

      const mapping = await downloadImages(page, TEST_DIR, 'test-site');
      expect(Object.keys(mapping)).toHaveLength(0);
    });

    test('should respect MAX_TOTAL_IMAGES limit', async () => {
      const manyImages = Array.from({ length: 60 }, (_, i) => ({
        src: `http://localhost:9876/image.png?i=${i}`,
        url: `http://localhost:9876/image.png?i=${i}`,
      }));
      const page = createMockPage(manyImages);

      const mapping = await downloadImages(page, TEST_DIR, 'test-site');
      expect(Object.keys(mapping).length).toBeLessThanOrEqual(50);
    });
  });
});
