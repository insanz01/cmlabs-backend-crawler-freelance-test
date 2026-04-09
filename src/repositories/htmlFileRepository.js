const fs = require('fs');
const path = require('path');
const BaseRepository = require('./baseRepository');

const OUTPUT_DIR = path.join(process.cwd(), 'output');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // Batas maksimal 10MB
const VALID_NAME = /^[a-zA-Z0-9_-]+$/;

class HtmlFileRepository extends BaseRepository {
  constructor() {
    super();
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
  }

  _validateName(name) {
    if (!VALID_NAME.test(name)) {
      throw new Error(`Invalid name: "${name}". Only alphanumeric, dash, and underscore allowed.`);
    }

    const resolved = path.resolve(OUTPUT_DIR, name);
    if (!resolved.startsWith(OUTPUT_DIR)) {
      throw new Error('Path traversal detected.');
    }
  }

  _filePath(name) {
    return path.join(OUTPUT_DIR, `${name}.html`);
  }

  _metaPath(name) {
    return path.join(OUTPUT_DIR, `${name}.meta.json`);
  }

  async save(name, html, meta = {}) {
    this._validateName(name);

    const size = Buffer.byteLength(html, 'utf-8');
    if (size > MAX_FILE_SIZE) {
      throw new Error(`HTML content exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit (${Math.round(size / 1024)}KB).`);
    }

    const filePath = this._filePath(name);
    const metaPath = this._metaPath(name);

    fs.writeFileSync(filePath, html, 'utf-8');

    const metaPayload = {
      name,
      url: meta.url || '',
      type: meta.type || 'unknown',
      crawledAt: new Date().toISOString(),
      fileSize: size,
    };
    fs.writeFileSync(metaPath, JSON.stringify(metaPayload, null, 2), 'utf-8');

    return metaPayload;
  }

  async findAll() {
    if (!fs.existsSync(OUTPUT_DIR)) return [];

    const files = fs.readdirSync(OUTPUT_DIR).filter((f) => f.endsWith('.meta.json'));

    return files.map((f) => {
      const raw = fs.readFileSync(path.join(OUTPUT_DIR, f), 'utf-8');
      return JSON.parse(raw);
    });
  }

  async findByName(name) {
    this._validateName(name);

    const metaPath = this._metaPath(name);
    if (!fs.existsSync(metaPath)) return null;

    const raw = fs.readFileSync(metaPath, 'utf-8');
    const meta = JSON.parse(raw);

    const filePath = this._filePath(name);
    const html = fs.existsSync(filePath)
      ? fs.readFileSync(filePath, 'utf-8')
      : null;

    return { ...meta, html };
  }

  async deleteByName(name) {
    this._validateName(name);

    const filePath = this._filePath(name);
    const metaPath = this._metaPath(name);

    let deleted = false;
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      deleted = true;
    }
    if (fs.existsSync(metaPath)) {
      fs.unlinkSync(metaPath);
      deleted = true;
    }

    // Hapus folder gambar jika ada
    const imgDir = path.join(OUTPUT_DIR, 'images', name);
    if (fs.existsSync(imgDir)) {
      fs.rmSync(imgDir, { recursive: true, force: true });
      deleted = true;
    }

    return deleted;
  }
}

module.exports = HtmlFileRepository;
