# Web Crawler API

Aplikasi crawling website menggunakan Node.js + Express + Playwright yang mampu menangani website bertipe **SPA**, **SSR**, dan **PWA**. Hasil crawl disimpan dalam file HTML beserta gambar-gambarnya.

## Prasyarat

- [Node.js](https://nodejs.org/) versi 18 atau lebih baru
- npm (biasanya sudah tersedia bersama Node.js)

## Instalasi

1. Clone repository

```bash
git clone git@github.com:insanz01/cmlabs-backend-crawler-freelance-test.git
cd cmlabs-backend-crawler-freelance-test
```

2. Install dependencies

```bash
npm install
```

3. Install browser Playwright (Chromium)

```bash
npx playwright install chromium
```

## Menjalankan Aplikasi

```bash
# Mode production
npm start

# Mode development (auto-restart saat file berubah)
npm run dev
```

Server akan berjalan di `http://localhost:3000`.

## Daftar Endpoint

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/` | Info API dan daftar endpoint |
| `GET` | `/api/sites` | Daftar website yang tersedia untuk di-crawl |
| `POST` | `/api/crawl` | Crawl semua website sekaligus |
| `POST` | `/api/crawl/:name` | Crawl satu website berdasarkan nama |
| `POST` | `/api/crawl-custom` | Crawl website custom (kirim nama + URL) |
| `GET` | `/api/crawls` | Daftar semua hasil crawl yang tersimpan |
| `GET` | `/api/crawls/:name` | Ambil detail hasil crawl beserta HTML |
| `DELETE` | `/api/crawls/:name` | Hapus hasil crawl tertentu |

## Contoh Penggunaan

### Crawl semua website

```bash
curl -X POST http://localhost:3000/api/crawl
```

### Crawl satu website

```bash
curl -X POST http://localhost:3000/api/crawl/quotes
```

Website yang tersedia: `cmlabs`, `sequence`, `quotes`.

### Crawl website custom

```bash
curl -X POST http://localhost:3000/api/crawl-custom \
  -H "Content-Type: application/json" \
  -d '{"name": "example", "url": "https://example.com"}' \
  -o example.html
```

### Lihat daftar hasil crawl

```bash
curl http://localhost:3000/api/crawls
```

### Ambil hasil crawl tertentu

```bash
curl http://localhost:3000/api/crawls/quotes
```

### Hapus hasil crawl

```bash
curl -X DELETE http://localhost:3000/api/crawls/quotes
```

## Target Website

| Nama | URL | Tipe |
|------|-----|------|
| cmlabs | https://cmlabs.co | SPA |
| sequence | https://sequence.day | PWA |
| quotes | http://quotes.toscrape.com/js/ | SPA |

Untuk menambahkan website baru, edit file `src/config/websites.js`.

## Struktur Project

```
├── src/
│   ├── app.js                      # Entry point Express
│   ├── config/
│   │   └── websites.js             # Konfigurasi website target
│   ├── controllers/
│   │   └── crawlController.js      # Handler HTTP request
│   ├── repositories/
│   │   ├── baseRepository.js       # Abstract class repository
│   │   ├── htmlFileRepository.js   # Repository penyimpanan file HTML
│   │   └── index.js                # Export singleton repository
│   ├── routes/
│   │   └── crawlRoutes.js          # Definisi route API
│   ├── services/
│   │   └── crawlerService.js       # Logika crawling dengan Playwright
│   └── utils/
│       └── imageDownloader.js      # Utilitas download gambar
├── output/                         # Hasil crawl (HTML + gambar)
│   ├── *.html
│   ├── *.meta.json
│   └── images/
├── package.json
└── README.md
```

## Struktur Output

Hasil crawl disimpan di folder `output/`:

```
output/
├── cmlabs.html              # HTML hasil crawl
├── cmlabs.meta.json         # Metadata (URL, tipe, waktu crawl, ukuran)
├── sequence.html
├── sequence.meta.json
├── quotes.html
├── quotes.meta.json
└── images/
    ├── cmlabs/               # Gambar dari cmlabs.co
    ├── sequence/             # Gambar dari sequence.day
    └── quotes/               # Gambar dari quotes.toscrape.com
```

Semua atribut `src` pada tag `<img>` di HTML sudah diganti ke path lokal sehingga file HTML bisa dibuka langsung di browser dan gambarnya akan tampil.
