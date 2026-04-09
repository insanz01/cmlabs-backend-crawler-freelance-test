const CrawlerService = require('../services/crawlerService');
const { htmlFileRepo } = require('../repositories');
const { WEBSITES } = require('../config/websites');

const crawlerService = new CrawlerService();
const VALID_NAME = /^[a-zA-Z0-9_-]+$/;

function validateNameParam(req, res, next) {
  const { name } = req.params;
  if (!name || !VALID_NAME.test(name)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid name parameter. Only alphanumeric, dash, and underscore allowed.',
    });
  }
  next();
}

function safeError(err) {
  const knownMessages = [
    'not found in config',
    'Invalid name',
    'Path traversal',
    'exceeds',
    'No crawl data found',
  ];
  const isKnown = knownMessages.some((k) => err.message.includes(k));
  return isKnown ? err.message : 'Internal server error.';
}

class CrawlController {
  async crawlByName(req, res) {
    try {
      const { name } = req.params;
      const result = await crawlerService.crawlByName(name);

      res.json({
        success: true,
        message: `Successfully crawled "${name}"`,
        data: result,
      });
    } catch (err) {
      res.status(400).json({ success: false, message: safeError(err) });
    }
  }

  async crawlAll(req, res) {
    try {
      const results = await crawlerService.crawlAll();

      res.json({
        success: true,
        message: 'Crawled all websites',
        data: results,
      });
    } catch (err) {
      res.status(500).json({ success: false, message: safeError(err) });
    }
  }

  async listCrawls(req, res) {
    try {
      const results = await htmlFileRepo.findAll();

      res.json({
        success: true,
        count: results.length,
        data: results,
      });
    } catch (err) {
      res.status(500).json({ success: false, message: safeError(err) });
    }
  }

  async getCrawlByName(req, res) {
    try {
      const { name } = req.params;
      const result = await htmlFileRepo.findByName(name);

      if (!result) {
        return res.status(404).json({
          success: false,
          message: `No crawl data found for "${name}". Try crawling first.`,
        });
      }

      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, message: safeError(err) });
    }
  }

  async deleteCrawlByName(req, res) {
    try {
      const { name } = req.params;
      const deleted = await htmlFileRepo.deleteByName(name);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: `No crawl data found for "${name}".`,
        });
      }

      res.json({ success: true, message: `Deleted crawl data for "${name}".` });
    } catch (err) {
      res.status(500).json({ success: false, message: safeError(err) });
    }
  }

  async listAvailableSites(req, res) {
    const sites = Object.entries(WEBSITES).map(([key, val]) => ({
      key,
      url: val.url,
      type: val.type,
    }));

    res.json({ success: true, data: sites });
  }

  async crawlCustom(req, res) {
    try {
      const { name, url } = req.body;

      if (!name || !url) {
        return res.status(400).json({
          success: false,
          message: 'Field "name" dan "url" wajib diisi.',
        });
      }

      if (!VALID_NAME.test(name)) {
        return res.status(400).json({
          success: false,
          message: 'Name hanya boleh berisi huruf, angka, dash (-), dan underscore (_).',
        });
      }

      try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          throw new Error();
        }
      } catch {
        return res.status(400).json({
          success: false,
          message: 'URL tidak valid. Gunakan format http:// atau https://',
        });
      }

      await crawlerService.crawlCustom(name, url);

      const result = await htmlFileRepo.findByName(name);

      if (!result || !result.html) {
        return res.status(500).json({
          success: false,
          message: 'Crawl succeeded but result could not be retrieved.',
        });
      }

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${name}.html"`);
      res.send(result.html);
    } catch (err) {
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: safeError(err) });
      }
    }
  }
}

module.exports = { controller: new CrawlController(), validateNameParam };
