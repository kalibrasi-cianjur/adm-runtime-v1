document.getElementById("btnSubmit").addEventListener("click", async () => {

  const mesin = document.getElementById("mesin").value.trim();
  const nama_part = document.getElementById("nama_part").value.trim();
  const area = document.getElementById("area").value.trim();
  const qty = parseInt(document.getElementById("qty").value);
  const alasan = document.getElementById("alasan").value.trim();

  const fileInput = document.getElementById("fileInput");

  if (!mesin || !nama_part || !area || !qty || !alasan) {
    return alert("Semua field wajib diisi kecuali foto.");
  }

  // Ambil user dari Electron
  const user = await window.api.getCurrentUser();
  if (!user) return alert("User tidak ditemukan. Silakan login ulang.");

  // 🔵 Convert file → buffer
  let fileToSend = null;
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    fileToSend = {
      name: file.name,
      type: file.type,
      buffer: await file.arrayBuffer()
    };
  }

  // 🔵 Kirim semua data ke main.js
  const result = await window.api.sendSparepartRequest({
    mesin,
    nama_part,
    area,
    qty,
    alasan,
    file: fileToSend,
    request_by: user.username,
    request_by_email: user.email
  });

  if (result.error) {
    alert("Gagal mengirim: " + result.error);
  } else {
    alert("Permintaan sparepart berhasil dikirim!");
  }

});
