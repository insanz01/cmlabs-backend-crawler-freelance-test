const CrawlerService = require('../src/services/crawlerService');

jest.mock('../src/repositories', () => ({
  htmlFileRepo: {
    save: jest.fn(),
  },
}));

jest.mock('../src/utils/imageDownloader', () => ({
  downloadImages: jest.fn(),
  replaceImageSources: jest.fn(),
}));

jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn(),
  },
}));

const { chromium } = require('playwright');
const { htmlFileRepo } = require('../src/repositories');
const { downloadImages, replaceImageSources } = require('../src/utils/imageDownloader');

describe('CrawlerService', () => {
  let service;
  let mockPage;
  let mockBrowser;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CrawlerService();

    mockPage = {
      goto: jest.fn(),
      waitForSelector: jest.fn(),
      waitForTimeout: jest.fn(),
      evaluate: jest.fn(),
      content: jest.fn(),
    };

    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn(),
    };

    chromium.launch.mockResolvedValue(mockBrowser);
    downloadImages.mockResolvedValue({ 'img.png': 'images/test/local.png' });
    replaceImageSources.mockReturnValue('<html>replaced</html>');
    htmlFileRepo.save.mockResolvedValue({ name: 'test', url: 'https://test.com' });
  });

  describe('crawlByName()', () => {
    test('should throw if site not in config', async () => {
      await expect(service.crawlByName('nonexistent')).rejects.toThrow('not found in config');
    });

    test('should crawl a configured site', async () => {
      const result = await service.crawlByName('quotes');

      expect(chromium.launch).toHaveBeenCalledWith({ headless: true });
      expect(mockPage.goto).toHaveBeenCalledWith('http://quotes.toscrape.com/js/', expect.any(Object));
      expect(mockPage.waitForSelector).toHaveBeenCalledWith('.quote', { timeout: 15000 });
      expect(result.name).toBe('test');
    });

    test('should close browser even if crawl fails', async () => {
      mockPage.goto.mockRejectedValue(new Error('Network error'));

      await expect(service.crawlByName('quotes')).rejects.toThrow('Network error');
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    test('should wait extra 2s for SPA sites', async () => {
      await service.crawlByName('quotes');
      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(2000);
    });

    test('should wait extra 2s for PWA sites', async () => {
      await service.crawlByName('sequence');
      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(2000);
    });

    test('should NOT wait extra for non-SPA/PWA types', async () => {
      await service.crawlCustom('my-ssr', 'https://example.com');
      expect(mockPage.waitForTimeout).not.toHaveBeenCalled();
    });
  });

  describe('crawlAll()', () => {
    test('should crawl all configured websites', async () => {
      const results = await service.crawlAll();

      expect(results).toHaveLength(3);
      expect(chromium.launch).toHaveBeenCalledTimes(3);
    });

    test('should not fail if one site errors', async () => {
      mockPage.goto.mockRejectedValueOnce(new Error('Site down'));

      const results = await service.crawlAll();

      expect(results).toHaveLength(3);
      const errorResult = results.find((r) => r.error);
      expect(errorResult).toBeDefined();
      expect(errorResult.error).toBe('Site down');
    });
  });

  describe('crawlCustom()', () => {
    test('should crawl with custom URL and config', async () => {
      const result = await service.crawlCustom('custom-site', 'https://custom.com');

      expect(mockPage.goto).toHaveBeenCalledWith('https://custom.com', expect.any(Object));
      expect(result).toBeDefined();
    });
  });

  describe('concurrency control', () => {
    test('should queue when MAX_CONCURRENT is reached', async () => {
      let releaseGoto;
      const gotoPromise = new Promise((r) => { releaseGoto = r; });

      // First 2 calls block, 3rd resolves immediately
      mockPage.goto
        .mockReturnValueOnce(gotoPromise)
        .mockReturnValueOnce(gotoPromise)
        .mockResolvedValue(undefined);

      const p1 = service.crawlByName('quotes');
      const p2 = service.crawlByName('cmlabs');

      await new Promise((r) => setTimeout(r, 0));

      expect(service._active).toBe(2);
      expect(service._queue.length).toBe(0);

      // 3rd crawl should queue
      const p3 = service.crawlByName('sequence');

      await new Promise((r) => setTimeout(r, 0));

      expect(service._active).toBe(2);
      expect(service._queue.length).toBe(1);

      // Release blocked crawls
      releaseGoto();

      await Promise.all([p1, p2, p3]);

      expect(chromium.launch).toHaveBeenCalledTimes(3);
    });
  });

  describe('_releaseSlot guard', () => {
    test('should not go below 0 active count', () => {
      service._active = 0;
      service._releaseSlot();
      expect(service._active).toBe(0);
    });
  });
});
