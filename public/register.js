const form = document.getElementById("form-register");
const inputUser = document.getElementById("username");
const inputPass = document.getElementById("password");
const inputKonfirmasi = document.getElementById("konfirmasi");
const btnDaftar = document.getElementById("btn-daftar");
const pesan = document.getElementById("pesan");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  pesan.textContent = "";

  // Pemeriksaan di browser (kemudahan pengguna); validasi sebenarnya ada di server
  if (inputPass.value !== inputKonfirmasi.value) {
    pesan.textContent = "Password dan ulangi password tidak sama.";
    inputKonfirmasi.focus();
    return;
  }

  btnDaftar.disabled = true;
  try {
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: inputUser.value.trim(),
        password: inputPass.value,
      }),
    });
    const hasil = await res.json();

    if (!res.ok) {
      pesan.textContent = hasil.pesan; // textContent: aman dari XSS
      return;
    }
    window.location.href = "/"; // setelah daftar, pengguna otomatis masuk
  } catch (err) {
    pesan.textContent = "Tidak dapat terhubung ke server. Pastikan server berjalan, lalu buka lewat http://localhost:3000.";
  } finally {
    btnDaftar.disabled = false;
  }
});
