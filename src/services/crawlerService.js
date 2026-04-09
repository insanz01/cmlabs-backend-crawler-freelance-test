const { chromium } = require('playwright');
const { htmlFileRepo } = require('../repositories');
const { WEBSITES } = require('../config/websites');
const { downloadImages, replaceImageSources } = require('../utils/imageDownloader');
const path = require('path');

const OUTPUT_DIR = path.join(process.cwd(), 'output');
const MAX_CONCURRENT = 2;

class CrawlerService {
  constructor() {
    this._active = 0;
    this._queue = [];
  }

  _acquireSlot() {
    return new Promise((resolve) => {
      if (this._active < MAX_CONCURRENT) {
        this._active++;
        resolve();
      } else {
        this._queue.push(resolve);
      }
    });
  }

  _releaseSlot() {
    this._active--;
    if (this._queue.length > 0) {
      this._active++;
      const next = this._queue.shift();
      next();
    }
  }

  async crawlCustom(name, url) {
    await this._acquireSlot();
    try {
      const config = {
        name,
        url,
        type: 'custom',
        waitForSelector: 'body',
        timeout: 30000,
      };
      return await this._crawl(config);
    } finally {
      this._releaseSlot();
    }
  }

  async crawlByName(name) {
    const siteConfig = WEBSITES[name];
    if (!siteConfig) {
      throw new Error(`Website "${name}" not found in config. Available: ${Object.keys(WEBSITES).join(', ')}`);
    }

    await this._acquireSlot();
    try {
      return await this._crawl(siteConfig);
    } finally {
      this._releaseSlot();
    }
  }

  async crawlAll() {
    const entries = Object.entries(WEBSITES);
    const results = await Promise.all(
      entries.map(async ([name, config]) => {
        await this._acquireSlot();
        try {
          return await this._crawl(config);
        } catch (err) {
          return { name, error: err.message };
        } finally {
          this._releaseSlot();
        }
      })
    );
    return results;
  }

  async _crawl(config) {
    const { name, url, type, waitForSelector, timeout } = config;
    let browser;

    try {
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();

      await page.goto(url, { waitUntil: 'networkidle', timeout });

      await page.waitForSelector(waitForSelector, { timeout });

      // Tunggu tambahan agar konten dinamis selesai dimuat (SPA/PWA)
      if (type === 'SPA' || type === 'PWA') {
        await page.waitForTimeout(2000);
      }

      // Download semua gambar dan ganti src ke path lokal
      const imgMapping = await downloadImages(page, OUTPUT_DIR, name);

      const html = await page.content();

      // Ganti URL gambar di HTML dengan path lokal
      const finalHtml = replaceImageSources(html, imgMapping);

      const meta = await htmlFileRepo.save(name, finalHtml, {
        url,
        type,
        imageCount: Object.keys(imgMapping).length,
      });

      return meta;
    } finally {
      if (browser) await browser.close();
    }
  }
}

module.exports = CrawlerService;
