const WEBSITES = {
  cmlabs: {
    name: 'cmlabs',
    url: 'https://cmlabs.co',
    type: 'SPA',
    waitForSelector: 'body',
    timeout: 30000,
  },
  sequence: {
    name: 'sequence',
    url: 'https://sequence.day',
    type: 'PWA',
    waitForSelector: 'body',
    timeout: 30000,
  },
  quotes: {
    name: 'quotes',
    url: 'http://quotes.toscrape.com/js/',
    type: 'SPA',
    waitForSelector: '.quote',
    timeout: 15000,
  },
};

module.exports = { WEBSITES };
