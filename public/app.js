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

function tampilPesan(teks, ok = false) {
  pesan.textContent = teks;
  pesan.className = "pesan" + (ok ? " ok" : "");
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
  const res = await fetch(`${API}?q=${q}`);
  const data = await res.json();

  daftar.innerHTML = "";
  kosong.classList.toggle("hidden", data.length > 0);

  data.forEach((c) => {
    const judul = el("h3", {}, c.judul, el("span", { className: `badge ${c.status}` }, c.status));
    const isi = el("p", {}, c.isi || "(tanpa isi)");
    const btnEdit = el("button", { className: "small secondary", textContent: "Edit" });
    const btnHapus = el("button", { className: "small danger", textContent: "Hapus" });
    btnEdit.addEventListener("click", () => mulaiEdit(c));
    btnHapus.addEventListener("click", () => hapus(c.id));

    daftar.append(el("li", { className: "item" }, judul, isi, el("div", { className: "aksi" }, btnEdit, btnHapus)));
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
  const id = inputId.value;

  const res = await fetch(id ? `${API}/${id}` : API, {
    method: id ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const hasil = await res.json();

  if (!res.ok) return tampilPesan(hasil.pesan);

  tampilPesan(id ? "Catatan diperbarui." : "Catatan ditambahkan.", true);
  resetForm();
  muatCatatan();
});

function mulaiEdit(c) {
  inputId.value = c.id;
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
  const res = await fetch(`${API}/${id}`, { method: "DELETE" });
  const hasil = await res.json();
  tampilPesan(hasil.pesan, res.ok);
  muatCatatan();
}

cari.addEventListener("input", muatCatatan);
muatCatatan();
