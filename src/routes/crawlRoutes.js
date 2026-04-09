const express = require('express');
const { controller, validateNameParam } = require('../controllers/crawlController');

const router = express.Router();

// Daftar website yang bisa di-crawl
router.get('/sites', controller.listAvailableSites);

// Crawl satu website berdasarkan nama
router.post('/crawl/:name', validateNameParam, controller.crawlByName);

// Crawl semua website
router.post('/crawl', controller.crawlAll);

// Crawl website custom, kembalikan file HTML
router.post('/crawl-custom', controller.crawlCustom);

// Daftar semua hasil crawl yang tersimpan
router.get('/crawls', controller.listCrawls);

// Ambil hasil crawl spesifik (termasuk HTML)
router.get('/crawls/:name', validateNameParam, controller.getCrawlByName);

// Hapus hasil crawl spesifik
router.delete('/crawls/:name', validateNameParam, controller.deleteCrawlByName);

module.exports = router;
