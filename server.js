const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { promisify } = require("util");
const scrypt = promisify(crypto.scrypt);

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.VERCEL ? "/tmp" : __dirname;
const DB_FILE = path.join(DATA_DIR, "data.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const PUBLIC_DIR = path.join(__dirname, "public");

app.use(express.json());

// ====================== PENGGUNA & SESI ======================
const SESSION_TTL = 2 * 60 * 60 * 1000; // sesi berlaku 2 jam
const sessions = new Map(); // token -> { username, expires }

// Data pengguna disimpan di users.json: { username: { salt, hash } }
function loadUsers() {
  const candidates = [USERS_FILE, path.join(__dirname, "users.json")];
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      try {
        return new Map(Object.entries(JSON.parse(fs.readFileSync(file, "utf8"))));
      } catch (err) {
        console.error("Gagal membaca users.json:", err.message);
      }
    }
  }
  return new Map();
}

function saveUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(Object.fromEntries(users), null, 2));
  } catch (err) {
    console.error("Gagal menyimpan users.json:", err.message);
  }
}

const users = loadUsers();

// Password disimpan sebagai hash scrypt dengan salt acak untuk tiap pengguna
async function buatRecord(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return { salt: salt.toString("hex"), hash: hash.toString("hex") };
}

// Akun demo dibuat otomatis HANYA jika belum ada pengguna sama sekali
async function buatAkunDemo() {
  if (users.size > 0) return;
  const nama = (process.env.APP_USER || "admin").toLowerCase();
  users.set(nama, await buatRecord(process.env.APP_PASS || "admin123"));
  saveUsers(users);
  console.log(`Akun demo dibuat: ${nama} (ganti passwordnya sebelum dipakai sungguhan).`);
}

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || "").split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i > -1) {
      out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    }
  });
  return out;
}

function getSession(req) {
  const token = parseCookies(req).sid;
  const session = token && sessions.get(token);
  if (!session) return null;
  if (session.expires < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function mulaiSesi(res, username, req) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { username, expires: Date.now() + SESSION_TTL });
  const isHttps = req && (req.secure || req.headers["x-forwarded-proto"] === "https");
  const cookieFlags = isHttps
    ? "HttpOnly; SameSite=None; Secure; Path=/;"
    : "HttpOnly; SameSite=Lax; Path=/;";
  res.setHeader(
    "Set-Cookie",
    `sid=${token}; ${cookieFlags} Max-Age=${SESSION_TTL / 1000}`
  );
}

// Untuk API: balas 401 jika belum login
function requireAuthApi(req, res, next) {
  if (!getSession(req)) {
    return res.status(401).json({ pesan: "Silakan login terlebih dahulu." });
  }
  next();
}

// Untuk halaman: arahkan ke halaman login jika belum login
function requireAuthPage(req, res, next) {
  if (!getSession(req)) return res.redirect("/login.html");
  next();
}

function validasiRegistrasi(body) {
  const errors = [];
  if (typeof body.username !== "string" || !/^[a-zA-Z0-9_]{3,20}$/.test(body.username)) {
    errors.push("Username 3-20 karakter, hanya huruf, angka, dan underscore.");
  }
  if (typeof body.password !== "string" || body.password.length < 8) {
    errors.push("Password minimal 8 karakter.");
  } else if (body.password.length > 72) {
    errors.push("Password maksimal 72 karakter.");
  }
  return errors;
}

// ---------- REGISTRASI ----------
app.post("/api/register", async (req, res) => {
  try {
    const body = req.body || {};
    const errors = validasiRegistrasi(body);
    if (errors.length) return res.status(400).json({ pesan: errors.join(" ") });

    const nama = body.username.toLowerCase(); // username tidak membedakan huruf besar/kecil
    if (users.has(nama)) {
      return res.status(409).json({ pesan: "Username sudah dipakai." });
    }

    const record = await buatRecord(body.password);

    // Periksa ulang setelah proses hashing (yang asinkron): bisa jadi ada
    // pendaftar lain dengan username sama yang selesai lebih dulu.
    if (users.has(nama)) {
      return res.status(409).json({ pesan: "Username sudah dipakai." });
    }
    users.set(nama, record);
    saveUsers(users);

    mulaiSesi(res, nama, req); // setelah daftar, langsung masuk
    res.status(201).json({ pesan: "Registrasi berhasil.", username: nama });
  } catch (err) {
    console.error(err);
    res.status(500).json({ pesan: "Terjadi kesalahan pada server." });
  }
});

// Hash palsu agar waktu proses sama baik username ada maupun tidak
const SALT_PALSU = crypto.randomBytes(16);

// ---------- LOGIN ----------
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const nama = typeof username === "string" ? username.toLowerCase() : "";
    const record = users.get(nama);
    const salt = record ? Buffer.from(record.salt, "hex") : SALT_PALSU;
    const attempt = await scrypt(typeof password === "string" ? password : "", salt, 64);
    const valid = record && crypto.timingSafeEqual(Buffer.from(record.hash, "hex"), attempt);

    if (!valid) {
      return res.status(401).json({ pesan: "Username atau password salah." });
    }
    mulaiSesi(res, nama, req);
    res.json({ pesan: "Login berhasil.", username: nama });
  } catch (err) {
    console.error(err);
    res.status(500).json({ pesan: "Terjadi kesalahan pada server." });
  }
});

// ---------- LOGOUT ----------
app.post("/api/logout", (req, res) => {
  const token = parseCookies(req).sid;
  if (token) sessions.delete(token);
  const isHttps = req && (req.secure || req.headers["x-forwarded-proto"] === "https");
  const cookieFlags = isHttps
    ? "HttpOnly; SameSite=None; Secure; Path=/;"
    : "HttpOnly; SameSite=Lax; Path=/;";
  res.setHeader("Set-Cookie", `sid=; ${cookieFlags} Max-Age=0`);
  res.json({ pesan: "Logout berhasil." });
});

// ---------- Info pengguna yang sedang login ----------
app.get("/api/me", requireAuthApi, (req, res) => {
  res.json({ username: getSession(req).username });
});

// ====================== HALAMAN & FILE STATIS ======================
// Halaman utama hanya untuk yang sudah login (harus sebelum express.static)
app.get(["/", "/index.html"], requireAuthPage, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});
app.use(express.static(PUBLIC_DIR));

// ====================== PENYIMPANAN CATATAN (file JSON) ======================
function readData() {
  const candidates = [DB_FILE, path.join(__dirname, "data.json")];
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
      } catch (err) {
        console.error("Gagal membaca data.json:", err.message);
      }
    }
  }
  return [];
}

function writeData(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Gagal menyimpan data.json:", err.message);
  }
}

function validate(body) {
  const errors = [];
  if (!body.judul || typeof body.judul !== "string" || !body.judul.trim()) {
    errors.push("Judul wajib diisi.");
  }
  if (body.judul && body.judul.length > 100) {
    errors.push("Judul maksimal 100 karakter.");
  }
  const statusValid = ["Belum", "Sedang", "Selesai"];
  if (body.status && !statusValid.includes(body.status)) {
    errors.push("Status harus Belum, Sedang, atau Selesai.");
  }
  return errors;
}

// ====================== API CATATAN (wajib login) ======================
// Setiap catatan milik satu pengguna; pengguna lain tidak dapat melihat atau mengubahnya.
app.use("/api/catatan", requireAuthApi);

// READ (semua milik pengguna, dengan pencarian ?q=)
app.get("/api/catatan", (req, res) => {
  const user = getSession(req).username;
  let data = readData().filter((c) => c.pemilik === user);
  const q = (req.query.q || "").toLowerCase();
  if (q) {
    data = data.filter(
      (c) =>
        c.judul.toLowerCase().includes(q) ||
        (c.isi || "").toLowerCase().includes(q)
    );
  }
  res.json(data);
});

// READ (satu catatan)
app.get("/api/catatan/:id", (req, res) => {
  const user = getSession(req).username;
  const item = readData().find(
    (c) => c.id === Number(req.params.id) && c.pemilik === user
  );
  if (!item) return res.status(404).json({ pesan: "Catatan tidak ditemukan." });
  res.json(item);
});

// CREATE
app.post("/api/catatan", (req, res) => {
  const errors = validate(req.body);
  if (errors.length) return res.status(400).json({ pesan: errors.join(" ") });

  const data = readData();
  const id = data.length ? Math.max(...data.map((c) => c.id)) + 1 : 1;
  const baru = {
    id,
    judul: req.body.judul.trim(),
    isi: (req.body.isi || "").trim(),
    status: req.body.status || "Belum",
    pemilik: getSession(req).username,
    dibuat: new Date().toISOString(),
  };
  data.push(baru);
  writeData(data);
  res.status(201).json(baru);
});

// UPDATE
app.put("/api/catatan/:id", (req, res) => {
  const errors = validate(req.body);
  if (errors.length) return res.status(400).json({ pesan: errors.join(" ") });

  const user = getSession(req).username;
  const data = readData();
  const idx = data.findIndex(
    (c) => c.id === Number(req.params.id) && c.pemilik === user
  );
  if (idx === -1)
    return res.status(404).json({ pesan: "Catatan tidak ditemukan." });

  data[idx] = {
    ...data[idx],
    judul: req.body.judul.trim(),
    isi: (req.body.isi || "").trim(),
    status: req.body.status || data[idx].status,
  };
  writeData(data);
  res.json(data[idx]);
});

// DELETE
app.delete("/api/catatan/:id", (req, res) => {
  const user = getSession(req).username;
  const data = readData();
  const idx = data.findIndex(
    (c) => c.id === Number(req.params.id) && c.pemilik === user
  );
  if (idx === -1)
    return res.status(404).json({ pesan: "Catatan tidak ditemukan." });

  const [dihapus] = data.splice(idx, 1);
  writeData(data);
  res.json({ pesan: "Catatan dihapus.", dihapus });
});

let initDemoPromise = buatAkunDemo().catch((err) => {
  console.error("Gagal buat akun demo:", err.message);
});

// Pastikan inisialisasi akun demo selesai sebelum menangani request
app.use(async (req, res, next) => {
  if (initDemoPromise) {
    await initDemoPromise;
    initDemoPromise = null;
  }
  next();
});

if (!process.env.VERCEL) {
  initDemoPromise.then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server berjalan di http://0.0.0.0:${PORT}`);
    });
  });
}

module.exports = app;
