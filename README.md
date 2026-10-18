# Catatan Belajar (CRUD + Login + Registrasi)

Tugas I — 11S3133 Pengembangan Aplikasi Berbasis Web.
Aplikasi pencatat materi belajar dengan operasi CRUD. Setiap pengguna mendaftar, login, dan hanya melihat catatannya sendiri. Dibangun dengan Node.js + Express (backend, penyimpanan file JSON) dan JavaScript murni (frontend).

## Fitur
- **Registrasi** akun baru (username 3-20 karakter, password minimal 8 karakter), lalu otomatis masuk
- **Login / Logout** dengan sesi berbasis cookie `HttpOnly`
- **CRUD catatan**: tambah, lihat, cari, ubah, hapus (dengan konfirmasi)
- **Catatan bersifat pribadi**: pengguna lain tidak dapat melihat atau mengubahnya
- Validasi input di server; teks pengguna ditampilkan aman dari XSS
- Password disimpan sebagai hash `scrypt` dengan salt acak per pengguna

## Prasyarat
Node.js versi 18 atau lebih baru.

## Cara Menjalankan
```bash
npm install
npm start
```
Buka **http://localhost:3000** di browser (jangan membuka `index.html` langsung dari folder).
Port dapat diganti: `PORT=4000 npm start`.

## Akun Demo
Saat server pertama kali dijalankan dan belum ada pengguna, akun demo dibuat otomatis:

| Username | Password |
|----------|----------|
| `admin` | `admin123` |

Untuk akun demo lain: `APP_USER=budi APP_PASS=rahasia123 npm start` (hanya berlaku saat `users.json` belum ada).
Anda juga dapat membuat akun sendiri lewat halaman **Daftar**.
**Ganti password bawaan sebelum aplikasi dipakai di luar pembelajaran.**

## Endpoint API
Endpoint catatan memerlukan login (tanpa login: 401). Semua data berformat JSON.

| Metode | URL | Fungsi | Kode status |
|--------|-----|--------|-------------|
| POST | `/api/register` | Daftar akun baru, lalu otomatis login | 201, 400, 409 |
| POST | `/api/login` | Login | 200, 401 |
| POST | `/api/logout` | Logout | 200 |
| GET | `/api/me` | Pengguna yang sedang login | 200, 401 |
| GET | `/api/catatan?q=kata` | Daftar catatan milik sendiri (opsional cari) | 200, 401 |
| GET | `/api/catatan/:id` | Satu catatan | 200, 401, 404 |
| POST | `/api/catatan` | Tambah catatan | 201, 400, 401 |
| PUT | `/api/catatan/:id` | Ubah catatan | 200, 400, 401, 404 |
| DELETE | `/api/catatan/:id` | Hapus catatan | 200, 401, 404 |

Catatan milik pengguna lain dibalas **404** (bukan 403) agar keberadaannya tidak terungkap.

Contoh dengan curl (cookie sesi disimpan di `cookies.txt`):
```bash
curl -i -c cookies.txt -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"username":"budi_1","password":"rahasia123"}'

curl -b cookies.txt -X POST http://localhost:3000/api/catatan \
  -H "Content-Type: application/json" \
  -d '{"judul":"Belajar Express","isi":"Routing dasar","status":"Sedang"}'

curl -b cookies.txt http://localhost:3000/api/catatan
```

## Struktur Folder
```
catatan-belajar/
├── server.js          # Backend: registrasi, login, sesi, API catatan
├── package.json
├── data.json          # Catatan (dibuat otomatis, tidak masuk Git)
├── users.json         # Akun pengguna: hash + salt (dibuat otomatis, tidak masuk Git)
└── public/
    ├── index.html     # Halaman utama (wajib login)
    ├── login.html / login.js
    ├── register.html / register.js
    ├── style.css
    └── app.js         # Logika frontend (fetch + DOM)
```

## Keterbatasan yang Diketahui
Aplikasi ini ditujukan untuk pembelajaran dan penggunaan lokal, bukan produksi. Keterbatasan berikut sudah diketahui dan sengaja tidak diperbaiki pada versi ini.

**Keamanan dan akun**
- Password akun demo bawaan (`admin123`) lemah dan terdokumentasi di sini.
- Tidak ada pembatasan percobaan login dan registrasi, sehingga rentan ditebak berulang kali (brute force) dan dibanjiri pendaftaran.
- Tidak ada verifikasi email, fitur lupa password, maupun ganti password.
- Cookie belum memakai atribut `Secure` (perlu HTTPS bila dipublikasikan); belum ada header keamanan tambahan seperti `helmet`.
- Sesi disimpan di memori: semua pengguna keluar saat server restart, dan sesi kedaluwarsa tidak dibersihkan otomatis.
- Belum ada penanganan galat global: di luar mode produksi, galat tak terduga dapat menampilkan stack trace.
- Halaman yang dilindungi belum mengirim `Cache-Control: no-store`, sehingga tombol Back setelah logout dapat menampilkan salinan halaman yang tersimpan browser.

**Keandalan data**
- `data.json` dibaca dengan penanganan yang menganggap galat sebagai data kosong; bila file rusak, data dapat tertimpa pada penyimpanan berikutnya. (`users.json` diperlakukan lebih ketat: file rusak membuat server gagal start.)
- Penulisan file tidak atomik; bila proses berhenti saat menulis, file dapat rusak.
- Bentuk data dari file tidak diperiksa; entri yang diedit manual dan tidak lengkap dapat menyebabkan galat.
- Id catatan dibuat dari id terbesar + 1 sehingga dapat dipakai ulang setelah penghapusan.
- Catatan lama yang dibuat sebelum ada fitur pemilik (tanpa atribut `pemilik`) tidak tampil bagi siapa pun.
- Penyimpanan berkas JSON hanya aman untuk satu proses server; tidak cocok untuk banyak instance atau data besar.

**Validasi dan kasus tepi**
- Tipe data `isi` tidak divalidasi: nilai non-teks menghasilkan 500, bukan 400.
- Parameter pencarian `q` yang dikirim ganda (`?q=a&q=b`) menghasilkan 500.
- `isi` tidak memiliki batas panjang dan jumlah catatan tidak dibatasi.
- Dua tab yang mengedit catatan sama: penyimpanan terakhir menimpa tanpa peringatan.

**Pengalaman pengguna**
- Pencarian mengirim permintaan di setiap ketukan tanpa jeda (debounce); respon lama dapat menimpa hasil yang lebih baru.
- Tidak ada paginasi daftar catatan.
- Halaman login tetap tampil bagi pengguna yang sudah login.
- Tombol Edit/Hapus belum memiliki label aksesibilitas yang menyebut catatan terkait.

## Catatan Penggunaan AI
Proyek ini dikembangkan dengan bantuan AI generatif (Claude). Prompt, evaluasi, dan perbaikan didokumentasikan di laporan proposal.
