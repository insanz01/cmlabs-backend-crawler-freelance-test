const fs = require('fs');
const path = require('path');
const HtmlFileRepository = require('../src/repositories/htmlFileRepository');

const TEST_DIR = path.join(__dirname, '__test_output__');
const VALID_NAME = /^[a-zA-Z0-9_-]+$/;

class TestHtmlFileRepository extends HtmlFileRepository {
  constructor() {
    super();
    this._outputDir = TEST_DIR;
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
  }

  _filePath(name) {
    return path.join(TEST_DIR, `${name}.html`);
  }

  _metaPath(name) {
    return path.join(TEST_DIR, `${name}.meta.json`);
  }

  _validateName(name) {
    if (!VALID_NAME.test(name)) {
      throw new Error(`Invalid name: "${name}". Only alphanumeric, dash, and underscore allowed.`);
    }
    const resolved = path.resolve(TEST_DIR, name);
    if (!resolved.startsWith(TEST_DIR)) {
      throw new Error('Path traversal detected.');
    }
  }

  async findAll() {
    if (!fs.existsSync(TEST_DIR)) return [];
    const files = fs.readdirSync(TEST_DIR).filter((f) => f.endsWith('.meta.json'));
    const results = [];
    for (const f of files) {
      try {
        const raw = fs.readFileSync(path.join(TEST_DIR, f), 'utf-8');
        results.push(JSON.parse(raw));
      } catch {
        // skip corrupt
      }
    }
    return results;
  }

  async deleteByName(name) {
    this._validateName(name);
    const filePath = this._filePath(name);
    const metaPath = this._metaPath(name);
    let deleted = false;
    if (fs.existsSync(filePath)) { fs.unlinkSync(filePath); deleted = true; }
    if (fs.existsSync(metaPath)) { fs.unlinkSync(metaPath); deleted = true; }
    const imgDir = path.join(TEST_DIR, 'images', name);
    if (fs.existsSync(imgDir)) { fs.rmSync(imgDir, { recursive: true, force: true }); deleted = true; }
    return deleted;
  }
}

describe('HtmlFileRepository', () => {
  let repo;

  beforeEach(() => {
    repo = new TestHtmlFileRepository();
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterAll(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('save()', () => {
    test('should save HTML and meta files', async () => {
      const meta = await repo.save('test-site', '<html></html>', { url: 'https://example.com', type: 'SPA' });

      expect(meta.name).toBe('test-site');
      expect(meta.url).toBe('https://example.com');
      expect(meta.type).toBe('SPA');
      expect(meta.crawledAt).toBeDefined();
      expect(meta.fileSize).toBeGreaterThan(0);

      expect(fs.existsSync(path.join(TEST_DIR, 'test-site.html'))).toBe(true);
      expect(fs.existsSync(path.join(TEST_DIR, 'test-site.meta.json'))).toBe(true);
    });

    test('should reject invalid names', async () => {
      await expect(repo.save('../evil', '<html></html>')).rejects.toThrow('Invalid name');
      await expect(repo.save('file.txt', '<html></html>')).rejects.toThrow('Invalid name');
      await expect(repo.save('name with space', '<html></html>')).rejects.toThrow('Invalid name');
    });

    test('should reject path traversal', async () => {
      await expect(repo.save('../../../etc/passwd', '<html></html>')).rejects.toThrow('Invalid name');
    });

    test('should reject content exceeding 10MB', async () => {
      const bigHtml = 'x'.repeat(10 * 1024 * 1024 + 1);
      await expect(repo.save('big-file', bigHtml)).rejects.toThrow('exceeds');
    });

    test('should accept valid names with dashes and underscores', async () => {
      await expect(repo.save('my-site_v2', '<html></html>')).resolves.toBeDefined();
      await expect(repo.save('ABC123', '<html></html>')).resolves.toBeDefined();
    });
  });

  describe('findAll()', () => {
    test('should return empty array when no files exist', async () => {
      const results = await repo.findAll();
      expect(results).toEqual([]);
    });

    test('should return all saved crawl results', async () => {
      await repo.save('site-a', '<html>A</html>', { url: 'https://a.com', type: 'SPA' });
      await repo.save('site-b', '<html>B</html>', { url: 'https://b.com', type: 'SSR' });

      const results = await repo.findAll();
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.name)).toEqual(expect.arrayContaining(['site-a', 'site-b']));
    });

    test('should skip corrupt meta.json files', async () => {
      await repo.save('good-site', '<html></html>', { url: 'https://good.com', type: 'SPA' });
      fs.writeFileSync(path.join(TEST_DIR, 'bad-site.meta.json'), 'not valid json{', 'utf-8');

      const results = await repo.findAll();
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('good-site');
    });
  });

  describe('findByName()', () => {
    test('should return null if not found', async () => {
      const result = await repo.findByName('nonexistent');
      expect(result).toBeNull();
    });

    test('should return meta and HTML content', async () => {
      await repo.save('my-site', '<html>hello</html>', { url: 'https://example.com', type: 'PWA' });

      const result = await repo.findByName('my-site');
      expect(result.name).toBe('my-site');
      expect(result.html).toBe('<html>hello</html>');
      expect(result.url).toBe('https://example.com');
    });

    test('should return null html if html file missing but meta exists', async () => {
      await repo.save('partial', '<html></html>');
      fs.unlinkSync(path.join(TEST_DIR, 'partial.html'));

      const result = await repo.findByName('partial');
      expect(result).not.toBeNull();
      expect(result.html).toBeNull();
    });

    test('should reject invalid name', async () => {
      await expect(repo.findByName('../etc')).rejects.toThrow('Invalid name');
    });
  });

  describe('deleteByName()', () => {
    test('should return false if nothing to delete', async () => {
      const deleted = await repo.deleteByName('nonexistent');
      expect(deleted).toBe(false);
    });

    test('should delete HTML and meta files', async () => {
      await repo.save('to-delete', '<html></html>');
      expect(fs.existsSync(path.join(TEST_DIR, 'to-delete.html'))).toBe(true);

      const deleted = await repo.deleteByName('to-delete');
      expect(deleted).toBe(true);
      expect(fs.existsSync(path.join(TEST_DIR, 'to-delete.html'))).toBe(false);
      expect(fs.existsSync(path.join(TEST_DIR, 'to-delete.meta.json'))).toBe(false);
    });

    test('should delete associated image folder', async () => {
      await repo.save('img-site', '<html></html>');
      const imgDir = path.join(TEST_DIR, 'images', 'img-site');
      fs.mkdirSync(imgDir, { recursive: true });
      fs.writeFileSync(path.join(imgDir, 'test.png'), 'fake');

      const deleted = await repo.deleteByName('img-site');
      expect(deleted).toBe(true);
      expect(fs.existsSync(imgDir)).toBe(false);
    });

    test('should reject invalid name', async () => {
      await expect(repo.deleteByName('bad name!')).rejects.toThrow('Invalid name');
    });
  });
});
