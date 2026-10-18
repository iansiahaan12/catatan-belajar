const form = document.getElementById("form-login");
const inputUser = document.getElementById("username");
const inputPass = document.getElementById("password");
const btnLogin = document.getElementById("btn-login");
const pesan = document.getElementById("pesan");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  pesan.textContent = "";
  btnLogin.disabled = true;

  try {
    const res = await fetch("/api/login", {
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
      inputPass.value = "";
      inputPass.focus();
      return;
    }
    window.location.href = "/"; // login berhasil
  } catch (err) {
    pesan.textContent = "Tidak dapat terhubung ke server.";
  } finally {
    btnLogin.disabled = false;
  }
});