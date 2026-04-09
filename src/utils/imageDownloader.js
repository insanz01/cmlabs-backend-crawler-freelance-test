const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB per gambar
const MAX_TOTAL_IMAGES = 50; // Maksimal jumlah gambar per crawl

function _extFromUrl(url, contentType) {
  if (contentType) {
    const map = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'image/avif': '.avif',
      'image/x-icon': '.ico',
    };
    if (map[contentType]) return map[contentType];
  }

  try {
    const parsed = new URL(url);
    const basename = path.basename(parsed.pathname);
    const ext = path.extname(basename).split('?')[0].toLowerCase();
    const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif', '.ico'];
    return allowed.includes(ext) ? ext : '.jpg';
  } catch {
    return '.jpg';
  }
}

function _hashUrl(url) {
  return crypto.createHash('sha256').update(url).digest('hex').slice(0, 16);
}

const MAX_REDIRECTS = 5;

function _download(urlStr, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > MAX_REDIRECTS) {
      return reject(new Error('Too many redirects'));
    }

    const client = urlStr.startsWith('https') ? https : http;

    const req = client.get(urlStr, { timeout: 10000 }, (res) => {
      // Ikuti redirect
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let location = res.headers.location;
        // Resolve relative redirect URLs
        try {
          if (!location.startsWith('http')) {
            location = new URL(location, urlStr).href;
          }
        } catch {
          res.resume();
          return reject(new Error('Invalid redirect URL'));
        }
        return _download(location, redirectCount + 1).then(resolve, reject);
      }

      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      const contentType = (res.headers['content-type'] || '').split(';')[0].trim();

      if (!contentType.startsWith('image/')) {
        res.resume();
        return reject(new Error(`Bukan gambar: ${contentType}`));
      }

      const chunks = [];
      let size = 0;

      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_IMAGE_SIZE) {
          req.destroy();
          reject(new Error('Ukuran gambar melebihi batas'));
        } else {
          chunks.push(chunk);
        }
      });

      res.on('end', () => {
        resolve({ buffer: Buffer.concat(chunks), contentType });
      });

      res.on('error', reject);
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

async function downloadImages(page, outputDir, name) {
  const imgDir = path.join(outputDir, 'images', name);
  if (!fs.existsSync(imgDir)) {
    fs.mkdirSync(imgDir, { recursive: true });
  }

  // Ambil src asli (dari HTML) dan URL resolved (untuk download)
  const imgData = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    return imgs.map((img) => ({
      originalSrc: img.getAttribute('src'),
      resolvedUrl: img.currentSrc || img.src,
    })).filter((d) => d.resolvedUrl && !d.resolvedUrl.startsWith('data:') && d.originalSrc);
  });

  const downloaded = {};
  let count = 0;

  for (const { originalSrc, resolvedUrl } of imgData) {
    if (count >= MAX_TOTAL_IMAGES) break;

    try {
      const { buffer, contentType } = await _download(resolvedUrl);
      const hash = _hashUrl(resolvedUrl);
      const ext = _extFromUrl(resolvedUrl, contentType);
      const filename = `${hash}${ext}`;
      const filePath = path.join(imgDir, filename);

      fs.writeFileSync(filePath, buffer);

      // Mapping: src asli di HTML -> path lokal
      downloaded[originalSrc] = `images/${name}/${filename}`;
      count++;
    } catch {
      // Skip gambar yang gagal di-download
    }
  }

  return downloaded;
}

function replaceImageSources(html, mapping) {
  let result = html;
  for (const [originalSrc, localPath] of Object.entries(mapping)) {
    // Escape karakter khusus untuk regex
    const escaped = originalSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'g'), localPath);
  }
  return result;
}

module.exports = { downloadImages, replaceImageSources };
