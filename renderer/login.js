window.addEventListener("DOMContentLoaded", () => {
  const usernameEl = document.getElementById("username");
  const passwordEl = document.getElementById("password");
  const errorMsg = document.getElementById("errorMsg");
  const loginBtn = document.getElementById("loginBtn");
  const btnText = document.getElementById("btnText");
  const spinner = document.getElementById("spinner");
  const visitorBtn = document.getElementById("visitorBtn");


  async function handleLogin() {
    const username = usernameEl.value.trim();
    const password = passwordEl.value.trim();

    if (!username || !password) {
      errorMsg.textContent = "Isi semua kolom terlebih dahulu!";
      return;
    }

    // 🔒 Kunci tombol & tampilkan spinner
    loginBtn.disabled = true;
    btnText.textContent = "Memeriksa...";
    spinner.style.display = "inline-block";
    const startTime = Date.now();

    try {
      const result = await window.api.loginUser({ username, password });
      const elapsed = Date.now() - startTime;
      const minDisplay = 2000;
      if (elapsed < minDisplay) {
      await new Promise((r) => setTimeout(r, minDisplay - elapsed));
      }

   if (result.success) {

  // 🔥 Beri tahu main.js bahwa login normal (bukan visitor)
  await window.api.loginSuccess(result.role);

  errorMsg.textContent = "";
  document.querySelector(".login-box").style.opacity = "0";
  setTimeout(() => {
    window.close();
  }, 500);
}
 else {
      errorMsg.textContent = result.message || "Login gagal.";
    }
  } catch (err) {
    console.error("Login error:", err);
    errorMsg.textContent = "Terjadi kesalahan sistem.";
  } finally {

    spinner.style.display = "none";
    btnText.textContent = "Masuk";
    loginBtn.disabled = false;
  }
}

  // Klik tombol
  loginBtn.addEventListener("click", handleLogin);

  // Tekan Enter di input
  [usernameEl, passwordEl].forEach((el) => {
    el.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        handleLogin();
      }
    });
  });
    visitorBtn.addEventListener("click", async () => {
    await window.api.openVisitorView(); // panggil fungsi baru
  });
});

