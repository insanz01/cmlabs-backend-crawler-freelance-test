const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crawlRoutes = require('./routes/crawlRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Header keamanan
app.use(helmet());

// CORS
app.use(cors());

// Pembatasan jumlah request
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use(limiter);

// Parser body JSON dengan batasan ukuran
app.use(express.json({ limit: '10kb' }));

app.use('/api', crawlRoutes);

app.get('/', (_req, res) => {
  res.json({
    message: 'Web Crawler API',
    endpoints: {
      listSites: 'GET    /api/sites',
      crawlOne: 'POST   /api/crawl/:name',
      crawlAll: 'POST   /api/crawl',
      listResults: 'GET    /api/crawls',
      getResult: 'GET    /api/crawls/:name',
      deleteResult: 'DELETE /api/crawls/:name',
    },
  });
});

app.listen(PORT, () => {
  console.log(`Crawler API running on http://localhost:${PORT}`);
});
