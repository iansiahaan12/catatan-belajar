const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, "data.json");
const PUBLIC_DIR = path.join(__dirname, "public");

app.use(express.json());

// ====================== AUTENTIKASI ======================
const SESSION_TTL = 2 * 60 * 60 * 1000; // sesi berlaku 2 jam
const sessions = new Map(); // token -> { username, expires }

// Password disimpan sebagai hash (scrypt), bukan teks biasa
const SALT = crypto.randomBytes(16);
function hashPassword(password) {
  return crypto.scryptSync(password, SALT, 64);
}

// Akun demo. Ubah lewat environment variable APP_USER dan APP_PASS.
const USERS = {
  [process.env.APP_USER || "admin"]: hashPassword(
    process.env.APP_PASS || "admin123"
  ),
};

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

// ---------- LOGIN ----------
app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  const stored =
    typeof username === "string" &&
    Object.prototype.hasOwnProperty.call(USERS, username)
      ? USERS[username]
      : null;
  const attempt = hashPassword(typeof password === "string" ? password : "");
  const valid = stored && crypto.timingSafeEqual(stored, attempt);

  if (!valid) {
    return res.status(401).json({ pesan: "Username atau password salah." });
  }

  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { username, expires: Date.now() + SESSION_TTL });
  res.setHeader(
    "Set-Cookie",
    `sid=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL / 1000}`
  );
  res.json({ pesan: "Login berhasil.", username });
});

// ---------- LOGOUT ----------
app.post("/api/logout", (req, res) => {
  const token = parseCookies(req).sid;
  if (token) sessions.delete(token);
  res.setHeader("Set-Cookie", "sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
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

// ====================== PENYIMPANAN (file JSON) ======================
function readData() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch (err) {
    return [];
  }
}

function writeData(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
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
app.use("/api/catatan", requireAuthApi);

// READ (semua, dengan pencarian ?q=)
app.get("/api/catatan", (req, res) => {
  let data = readData();
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
  const item = readData().find((c) => c.id === Number(req.params.id));
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

  const data = readData();
  const idx = data.findIndex((c) => c.id === Number(req.params.id));
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
  const data = readData();
  const idx = data.findIndex((c) => c.id === Number(req.params.id));
  if (idx === -1)
    return res.status(404).json({ pesan: "Catatan tidak ditemukan." });

  const [dihapus] = data.splice(idx, 1);
  writeData(data);
  res.json({ pesan: "Catatan dihapus.", dihapus });
});

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});