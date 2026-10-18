const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, "data.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------- Helper penyimpanan (file JSON) ----------
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

// ---------- READ (semua) ----------
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

// ---------- READ (satu) ----------
app.get("/api/catatan/:id", (req, res) => {
  const item = readData().find((c) => c.id === Number(req.params.id));
  if (!item) return res.status(404).json({ pesan: "Catatan tidak ditemukan." });
  res.json(item);
});

// ---------- CREATE ----------
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

// ---------- UPDATE ----------
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

// ---------- DELETE ----------
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
