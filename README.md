# Catatan Belajar (CRUD Sederhana)

Tugas I — 11S3133 Pengembangan Aplikasi Berbasis Web.
Aplikasi CRUD sederhana untuk mencatat materi belajar. Dibangun dengan Node.js + Express (backend, penyimpanan file JSON) dan JavaScript murni (frontend).

## Fitur
- **Create** — tambah catatan (judul, isi, status)
- **Read** — daftar catatan + pencarian
- **Update** — edit catatan
- **Delete** — hapus catatan (dengan konfirmasi)
- Validasi input di server, dan teks pengguna dirender aman dari XSS

## Cara Menjalankan
```bash
npm install
npm start
```
Buka http://localhost:3000

## Endpoint API
| Method | URL | Fungsi |
|--------|-----|--------|
| GET | /api/catatan?q=kata | Ambil semua catatan (opsional cari) |
| GET | /api/catatan/:id | Ambil satu catatan |
| POST | /api/catatan | Tambah catatan |
| PUT | /api/catatan/:id | Ubah catatan |
| DELETE | /api/catatan/:id | Hapus catatan |

## Struktur Folder
```
catatan-belajar/
├── server.js        # Backend Express + API CRUD
├── package.json
├── data.json        # Dibuat otomatis saat ada data
└── public/
    ├── index.html
    ├── style.css
    └── app.js       # Logika frontend
```

## Catatan Penggunaan AI
Proyek ini dikembangkan dengan bantuan AI generatif (Claude). Dokumentasi prompt, evaluasi, dan perbaikan ada di laporan proposal.
