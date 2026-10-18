const API = "/api/catatan";

const form = document.getElementById("form-catatan");
const inputId = document.getElementById("catatan-id");
const inputJudul = document.getElementById("judul");
const inputIsi = document.getElementById("isi");
const inputStatus = document.getElementById("status");
const btnBatal = document.getElementById("btn-batal");
const formTitle = document.getElementById("form-title");
const pesan = document.getElementById("pesan");
const daftar = document.getElementById("daftar");
const kosong = document.getElementById("kosong");
const cari = document.getElementById("cari");
const namaUser = document.getElementById("nama-user");
const btnLogout = document.getElementById("btn-logout");

function tampilPesan(teks, ok = false) {
  pesan.textContent = teks;
  pesan.className = "pesan" + (ok ? " ok" : "");
}

// Pembungkus fetch.
// - 401 (sesi habis / belum login): arahkan ke halaman login
// - gagal terhubung atau respon bukan JSON: tampilkan pesan, kembalikan null
async function request(url, options, senyap = false) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (err) {
    if (!senyap) {
      tampilPesan("Tidak dapat terhubung ke server. Pastikan server berjalan, lalu buka lewat http://localhost:3000.");
    }
    return null;
  }
  if (res.status === 401) {
    window.location.href = "/login.html";
    return null;
  }
  try {
    return { ok: res.ok, data: await res.json() };
  } catch (err) {
    if (!senyap) tampilPesan(`Server memberi respon yang tidak terduga (kode ${res.status}).`);
    return null;
  }
}

// Mencegah XSS: teks pengguna tidak dimasukkan lewat innerHTML
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  children.forEach((c) =>
    node.append(typeof c === "string" ? document.createTextNode(c) : c)
  );
  return node;
}

// ---------- READ ----------
async function muatCatatan() {
  const q = encodeURIComponent(cari.value.trim());
  const hasil = await request(`${API}?q=${q}`);
  if (!hasil) return;
  const data = hasil.data;

  daftar.innerHTML = ""; // dikosongkan saja, tanpa menyisipkan teks pengguna
  kosong.classList.toggle("hidden", data.length > 0);

  data.forEach((c) => {
    const judul = el("h3", {}, c.judul, el("span", { className: `badge ${c.status}` }, c.status));
    const isi = el("p", {}, c.isi || "(tanpa isi)");
    const btnEdit = el("button", { className: "small secondary", textContent: "Edit" });
    const btnHapus = el("button", { className: "small danger", textContent: "Hapus" });
    btnEdit.addEventListener("click", () => mulaiEdit(c));
    btnHapus.addEventListener("click", () => hapus(c.id));

    daftar.append(
      el("li", { className: "item" }, judul, isi, el("div", { className: "aksi" }, btnEdit, btnHapus))
    );
  });
}

// ---------- CREATE & UPDATE ----------
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    judul: inputJudul.value,
    isi: inputIsi.value,
    status: inputStatus.value,
  };
  const id = inputId.value; // kosong = tambah, terisi = ubah

  const hasil = await request(id ? `${API}/${id}` : API, {
    method: id ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!hasil) return;

  if (!hasil.ok) return tampilPesan(hasil.data.pesan);

  tampilPesan(id ? "Catatan diperbarui." : "Catatan ditambahkan.", true);
  resetForm();
  muatCatatan();
});

function mulaiEdit(c) {
  inputId.value = c.id; // menandai formulir sedang dalam mode edit
  inputJudul.value = c.judul;
  inputIsi.value = c.isi;
  inputStatus.value = c.status;
  formTitle.textContent = "Edit Catatan";
  btnBatal.classList.remove("hidden");
  inputJudul.focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  form.reset();
  inputId.value = "";
  formTitle.textContent = "Tambah Catatan";
  btnBatal.classList.add("hidden");
}
btnBatal.addEventListener("click", () => {
  resetForm();
  tampilPesan("");
});

// ---------- DELETE ----------
async function hapus(id) {
  if (!confirm("Yakin ingin menghapus catatan ini?")) return;
  const hasil = await request(`${API}/${id}`, { method: "DELETE" });
  if (!hasil) return;
  tampilPesan(hasil.data.pesan, hasil.ok);
  muatCatatan();
}

// ---------- LOGOUT & INFO PENGGUNA ----------
btnLogout.addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "/login.html";
});

async function muatUser() {
  const hasil = await request("/api/me", undefined, true);
  if (hasil && hasil.ok) namaUser.textContent = `Masuk sebagai ${hasil.data.username}`;
}

cari.addEventListener("input", muatCatatan);

// Halaman dibuka langsung dari file (file://) tidak dapat memanggil API
if (window.location.protocol === "file:") {
  tampilPesan("Halaman dibuka langsung dari file. Jalankan server (npm start) lalu buka http://localhost:3000.");
} else {
  muatUser();
  muatCatatan();
}
