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

// Pembungkus fetch: jika sesi habis (401), arahkan kembali ke halaman login
async function request(url, options) {
  const res = await fetch(url, options);
  if (res.status === 401) {
    window.location.href = "/login.html";
    throw new Error("Belum login");
  }
  const data = await res.json();
  return { ok: res.ok, data };
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
  const { data } = await request(`${API}?q=${q}`);

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

  const { ok, data } = await request(id ? `${API}/${id}` : API, {
    method: id ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!ok) return tampilPesan(data.pesan);

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
  const { ok, data } = await request(`${API}/${id}`, { method: "DELETE" });
  tampilPesan(data.pesan, ok);
  muatCatatan();
}

// ---------- LOGOUT & INFO PENGGUNA ----------
btnLogout.addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "/login.html";
});

async function muatUser() {
  const { data } = await request("/api/me");
  namaUser.textContent = `Masuk sebagai ${data.username}`;
}

cari.addEventListener("input", muatCatatan);
muatUser();
muatCatatan();