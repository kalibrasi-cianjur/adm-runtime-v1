// renderer_karyawan.js (perbaikan lengkap)
document.addEventListener("DOMContentLoaded", () => {

// ====================================================================
// ELEMENTS
// ====================================================================
const modal = document.getElementById("karyawanModal");
const closeModalBtn = document.getElementById("closeModal");
const modalNik = document.getElementById("modalNik");
const modalFoto = document.getElementById("modalFoto");
const modalNama = document.getElementById("modalNama");
const modalTanggaljoin = document.getElementById("modalTanggaljoin");
const modalStatus = document.getElementById("modalStatus");
const modalKontrak = document.getElementById("modalKontrak");
const modalDurasi = document.getElementById("modalDurasi");

const btnEdit = document.getElementById('btnEdit');
const btnSave = document.getElementById('btnSave');
const btnDelete = document.getElementById("btnDelete");
const confirmModal = document.getElementById("confirmDeleteModal");
const btnCancelDelete = document.getElementById("btnCancelDelete");
const btnConfirmDelete = document.getElementById("btnConfirmDelete");

const paramView = document.getElementById('paramView');
const paramEdit = document.getElementById('paramEdit');
const editFoto = document.getElementById('editFoto');

const nikInput = document.getElementById("kar_nik");
const nikInfo = document.getElementById("nik_info");
const fotoInput = document.getElementById("kar_foto");

const statusInput = document.getElementById("kar_role");
const durasiField = document.getElementById("durasiField");
const durasiInput = document.getElementById("durasi_kontrak");

const trendModal = document.getElementById("trendModal");
const btnShow = document.getElementById("btnShow");
const closeTrend = document.getElementById("closeTrend");

const segItems = document.querySelectorAll(".seg-item");
  const formBaru = document.getElementById("karyawanForm").parentElement;
  const formPerpanjang = document.getElementById("formPerpanjangan");

  const btnToggle = document.getElementById("btnTogglePanel");
  const leftPanel = document.querySelector(".left-panel");

const nikCheck = document.getElementById("perpanjang_nik");
const nameInput = document.getElementById("perpanjang_name");

let currentKaryawanId = null;
let selectedFotoBuffer = null;
window.ipcRenderer.send("screen-changed", "karyawan");



window.electronAPI.cekKontrakExpire().then(list => {
  list.forEach(r => showToast(
    `Kontrak ${r.nama} (${r.nik}) habis ${r.sisa_hari} hari lagi`,
    "warning"
  ));
});

window.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("visible");
});


//======================================select mode========================//
document.querySelectorAll(".seg-item").forEach(item => {
  item.addEventListener("click", function () {

    document.querySelectorAll(".seg-item")
      .forEach(i => i.classList.remove("active"));

    this.classList.add("active");

    const mode = this.dataset.mode;

    if (mode === "baru") {
      document.getElementById("wrapperKaryawanForm").style.display = "block";
      document.getElementById("formPerpanjangan").style.display = "none";
    } else {
      document.getElementById("wrapperKaryawanForm").style.display = "none";
      document.getElementById("formPerpanjangan").style.display = "block";
    }
  });
});

  btnToggle.addEventListener("click", () => {
    leftPanel.classList.toggle("closed");
  });

//=================================end mode==============================//


nikCheck.addEventListener("blur", async () => {
  const nik = nikCheck.value.trim();
  if (!nik) return;


  // Kirim request ke main process untuk cek NIK
  const result = await window.karyawanAPI.checkNik(nik);

  if (result) {
    nameInput.value = result.nama;
    console.log("ID Karyawan:", result.nama); // tampilkan ID di console, bisa disimpan ke hidden field
  } else {
    nameInput.value = "";
   showToast("NIK tidak ditemukan, Periksa kembali NIK!");
  }
});


//======================save perpanjangan===============================//
// renderer.js
const perpanjangForm = document.getElementById("perpanjangForm");
perpanjangForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const nik = document.getElementById("perpanjang_nik").value.trim();
  let dur = document.getElementById("perpanjang_durasi").value;

  // normalisasi input durasi
  if (typeof dur === "string") dur = dur.trim().replace(",", ".");

  // cek integer positif
  const durNum = Number(dur);
  if (!nik) { showToast("NIK harus diisi"); return; }
  if (!Number.isFinite(durNum) || durNum <= 0 || Math.floor(durNum) !== durNum) {
    showToast("Durasi harus bilangan bulat positif (mis. 1, 2, 3)");
    return;
  }

  // panggil IPC
  const res = await window.karyawanAPI.savePerpanjangan({ nik, durasi_bulan: durNum });
  if (res.success) {
    showToast(`Perpanjangan tersimpan. Kontrak ke-${res.kontrak_ke}`);
    // refresh UI / reload history sesuai kebutuhan
  } else {
    showToast("Gagal menyimpan: " + res.error);
    console.error(res);
  }
});

// ============================ BUTTON EDIT / SIMPAN ========================= //
btnEdit.addEventListener('click', () => {
  paramView.style.display = 'none';
  paramEdit.style.display = 'block';
  if (editFoto) editFoto.style.display = 'block';
  btnEdit.style.display = 'none';
  btnSave.style.display = 'inline-block';

  // isi nilai saat edit (parsing persen jika berformat "80%")
  const attText = document.getElementById('attitudePercent')?.textContent || "0%";
  const absText = document.getElementById('absensiPercent')?.textContent || "0%";
  const oprText = document.getElementById('operasionalPercent')?.textContent || "0%";

  document.getElementById('editAttitude').value = parseInt(attText);
  document.getElementById('editAbsensi').value = parseInt(absText);
  document.getElementById('editOperasional').value = parseInt(oprText);
});

// preview foto saat ganti di modal (input file #editFoto)
if (editFoto) {
  editFoto.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview langsung di modal
    const reader = new FileReader();
    reader.onload = () => {
      modalFoto.src = reader.result; // tampilkan preview sementara
    };
    reader.readAsDataURL(file);

    // Simpan buffer untuk nanti dikirim ke main via IPC
    const arrayBuffer = await file.arrayBuffer();
    selectedFotoBuffer = new Uint8Array(arrayBuffer);
  });
}

// SIMPAN (btnSave)
btnSave.addEventListener('click', async () => {
  const attitude = parseInt(document.getElementById('editAttitude').value) || 0;
  const absensi = parseInt(document.getElementById('editAbsensi').value) || 0;
  const operasional = parseInt(document.getElementById('editOperasional').value) || 0;

  try {
    // ===== SIMPAN FOTO (JIKA ADA) =====
    if (selectedFotoBuffer && currentKaryawanId) {
      await window.karyawanAPI.saveFotoBuffer(currentKaryawanId, selectedFotoBuffer);
      // reset buffer setelah tersimpan
      selectedFotoBuffer = null;
    }

    // ===== UPDATE PARAMETER DI TABEL KARYAWAN =====
    if (currentKaryawanId) {
      await window.karyawanAPI.updateKaryawanParams(currentKaryawanId, {
        attitude, absensi, operasional
      });
    }

    // ===== INSERT HISTORY KE karyawan_performance =====
    await window.karyawanAPI.addPerformance(
      modalNik.textContent,
      modalNama.textContent,
      { attitude, absensi, operasional }
    );

    // ===== AMBIL ULANG DATA TERBARU DARI DATABASE =====
    const fresh = await window.karyawanAPI.getKaryawanByNik(modalNik.textContent);

    // ===== UPDATE FOTO DI MODAL (pakai fresh.image jika tersedia) =====
    if (fresh && fresh.image) {
      modalFoto.src = fresh.image;
    }

    // ===== UPDATE PARAMETER DI MODAL =====
    updatePersentase(fresh?.attitude || attitude, fresh?.absensi || absensi, fresh?.operasional || operasional);

    // Jika ada elemen detail (kamu tidak punya modalAtt..., safe-check)
    // Kita pakai the percent elements yang ada di HTML
    const attEl = document.getElementById('attitudePercent');
    const absEl = document.getElementById('absensiPercent');
    const oprEl = document.getElementById('operasionalPercent');
    if (attEl) attEl.textContent = (fresh?.attitude ?? attitude) + '%';
    if (absEl) absEl.textContent = (fresh?.absensi ?? absensi) + '%';
    if (oprEl) oprEl.textContent = (fresh?.operasional ?? operasional) + '%';

    // ===== UPDATE CARD DI LIST KARYAWAN =====
    const card = document.querySelector(`.karyawan-card[data-nik="${modalNik.textContent}"]`);
    if (card) {
      if (fresh && fresh.image) {
        const img = card.querySelector(".foto");
        if (img) img.src = fresh.image;
      }
      const nameEl = card.querySelector(".nama");
      if (nameEl) nameEl.textContent = fresh?.nama || modalNama.textContent;
      const statusEl = card.querySelector(".status");
      if (statusEl) statusEl.textContent = "Status: " + (fresh?.status || modalStatus.textContent);
      const kontrakEl = card.querySelector(".kontrak");
      if (kontrakEl) kontrakEl.textContent = "Durasi Kontrak: " + (fresh?.durasi_kontrak || "-");
    }

    showToast("Data disimpan!", "success");
    console.log("Data terbaru + history berhasil disimpan!");
  } catch (err) {
    console.error(err);
    showToast("Gagal Menyimpan!", "error");
  }

  // KEMBALIKAN UI KE MODE VIEW
  paramView.style.display = 'block';
  paramEdit.style.display = 'none';
  if (editFoto) editFoto.style.display = 'none';
  btnEdit.style.display = 'inline-block';
  btnSave.style.display = 'none';
});

// ================================ button edit end ============================ //


// ====================================================================
// FOTO PREVIEW (form tambah karyawan)
 // preview saat memilih file untuk form tambah
if (fotoInput) {
  fotoInput.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    const prev = document.getElementById("kar_preview");

    if (file && prev) {
      const url = URL.createObjectURL(file);
      prev.src = url;
      prev.style.display = "block";
    }
  });
}


document.getElementById("btnShow").addEventListener("click", () => {
  const nik = document.getElementById("modalNik").textContent.trim();

  loadTrend(nik);
  document.getElementById("trendModal").style.display = "flex";
});


document.getElementById("closeTrend").addEventListener("click", () => {
    document.getElementById("trendModal").style.display = "none";
});

window.addEventListener("click", (e) => {
    const modal = document.getElementById("trendModal");
    if (e.target === modal) modal.style.display = "none";
});

let deleteReady = false; // penanda user sudah klik "hapus"

if (btnDelete) {
  btnDelete.addEventListener("click", () => {
    confirmModal.style.display = "flex"; // buka modal
  });
}

// ❌ Batal
btnCancelDelete.addEventListener("click", () => {
  confirmModal.style.display = "none";
});

// ✅ Konfirmasi Hapus
btnConfirmDelete.addEventListener("click", async () => {

  confirmModal.style.display = "none"; // tutup modal

  if (!currentKaryawanId) return;

  showLoading(); // Spinner ON

  try {
    const result = await window.karyawanAPI.hapusKaryawan(currentKaryawanId);

    if (result.success) {

      setTimeout(() => {
        hideLoading();

        showToast("Data karyawan berhasil dihapus!");

        setTimeout(() => {
          location.reload();
        }, 1200);

      }, 600);

    } else {
      hideLoading();
      showToast("Gagal menghapus data: " + result.error);
    }

  } catch (err) {
    hideLoading();
    console.error(err);
    showToast("Terjadi kesalahan saat menghapus data.");
  }
});
function showLoading() {
  const overlay = document.getElementById("loadingOverlay");
  overlay.style.display = "flex";
  overlay.classList.remove("fade-out");
  overlay.style.opacity = "1";
}

function hideLoading() {
  const overlay = document.getElementById("loadingOverlay");

  overlay.classList.add("fade-out");


  setTimeout(() => {
    overlay.style.display = "none";
  }, 400);
}


// ====================================================================
// LOAD DATA KARYAWAN
// ====================================================================
async function loadKaryawan() {

  const rows = await window.electronAPI.getKaryawan();
  const grid = document.getElementById("karyawanGrid");
  if (!grid) return;

  grid.innerHTML = "";

  // Ganti rows.forEach dengan for...of agar bisa await
  for (const r of rows) {

    // ================== FOTO ==================
    const foto = r.image ? r.image : "../assets/mayora2.png";
    const status = r.status?.toUpperCase();

    // Ambil kontrak ke terakhir via preload
    const kontrakKe = await window.electronAPI.getLatestKontrakKe(r.nik);

    // ================== TANGGAL HABIS ==================
    let tanggalHabis = r.habis_kontrak ? r.habis_kontrak : "-";

    // Status permanen
    if (["DH", "SH", "UH"].includes(status)) {
      tanggalHabis = "Permanent";
    }

    // ================== DURASI KONTRAK ==================
    let durasiKontrak = r.durasi_kontrak
      ? `${r.durasi_kontrak} Bulan`
      : "-";

    if (["DH", "SH", "UH"].includes(status)) {
      durasiKontrak = "Permanent";
    }

    // ================== SISA KONTRAK ==================
    let sisaKontrak = "-";

    if (!["DH", "SH", "UH"].includes(status) && r.habis_kontrak) {
      const today = new Date();
      const end = new Date(r.habis_kontrak);

      const diff = end.getTime() - today.getTime();
      if (diff <= 0) {
        sisaKontrak = "0 hari (Habis)";
      } else {
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        sisaKontrak = `${days} hari`;
      }
    }

    // ================== RENDER KARTU ==================
    const card = document.createElement("div");
    card.className = "karyawan-card";
    card.dataset.nik = r.nik;

    card.innerHTML = `
      <div class="card-left">
        <img src="${foto}" class="foto">
      </div>
      <div class="card-right">
        <div class="nama">${r.nama}</div>
        <div class="nik">NIK: ${r.nik}</div>
        <div class="tanggaljoin">Join: ${r.tanggal_join || "-"}</div>
        <div class="status">Status: ${r.status || "-"}</div>
        <div class="kontrak">Durasi Kontrak: ${durasiKontrak}</div>
        <div class="habiskontrak">Habis Kontrak: ${tanggalHabis}</div>
        <div class="sisakontrak">Sisa Kontrak: ${sisaKontrak}</div>
        <div class= "kontrak_ke">Kontrak ke: ${kontrakKe}</div>
      </div>
    `;

    card.addEventListener("click", () => openModal(r));
    grid.appendChild(card);
  }
}


// ====================================================================
// OPEN MODAL
// ====================================================================

async function openModal(r) {
  modal.style.display = "flex";

  const fresh = await window.karyawanAPI.getKaryawanByNik(r.nik);
  if (!fresh) return;

  currentKaryawanId = fresh.id;
if (fresh.image && fresh.image.trim() !== "" && fresh.image.startsWith("data:image")) {
  modalFoto.src = fresh.image;
} else {
  modalFoto.src = "../assets/mayora2.png"; // default foto
}


  modalNama.textContent = fresh.nama || "";
  modalNik.textContent = fresh.nik || "";
  modalTanggaljoin.textContent = fresh.tanggal_join || "-";
  modalStatus.textContent = fresh.status || "";

  // ================================
  // PERMANENT LOGIC
  // ================================
  let tanggalHabis = "-";
  let durasiKontrak = "-";

  if (["DH", "SH", "UH"].includes(fresh.status)) {
    tanggalHabis = "09-09-9999";
    durasiKontrak = "Permanent";
  } else {
    tanggalHabis = hitungHabisKontrak(fresh.tanggal_join, fresh.durasi_kontrak);
    durasiKontrak = fresh.durasi_kontrak || "-";
  }

  modalKontrak.textContent = tanggalHabis;
  modalDurasi.textContent = durasiKontrak;

  // ================================
  // MASA KERJA
  // ================================
  const masaKerja = hitungMasaKerja(fresh.tanggal_join);
  modalMasaKerja.textContent = masaKerja;

  // ================================
  // PERFORMANCE
  // ================================
  const attitude = fresh.attitude || 0;
  const absensi = fresh.absensi || 0;
  const operasional = fresh.operasional || 0;

  updatePersentase(attitude, absensi, operasional);
  loadTrend(r.nik);

  const attEl = document.getElementById('attitudePercent');
  const absEl = document.getElementById('absensiPercent');
  const oprEl = document.getElementById('operasionalPercent');

  if (attEl) attEl.textContent = attitude + '%';
  if (absEl) absEl.textContent = absensi + '%';
  if (oprEl) oprEl.textContent = operasional + '%';
}


// ====================================================================
// CLOSE MODAL
// ====================================================================
if (closeModalBtn) {
  closeModalBtn.addEventListener("click", () => {
    modal.style.display = "none";
  });
}
window.addEventListener("click", (e) => {
  if (e.target === modal) modal.style.display = "none";
});

// ====================================================================
// CEK NIK OTOMATIS + AUTO FILL
// ====================================================================
if (nikInput) {
  nikInput.addEventListener("input", async () => {
    const nik = nikInput.value.trim();

    if (nik.length === 0) {
      nikInfo.textContent = "";
      nikInput.dataset.valid = "";
      clearFormAutoFill();
      return;
    }

    const result = await window.electronAPI.cekNik(nik);

    // === Sudah terdaftar ===
    if (result.exists) {
      nikInfo.textContent = "❌ NIK sudah terdaftar!";
      nikInfo.style.color = "red";
      nikInput.dataset.valid = "false";

      const data = await window.karyawanAPI.getKaryawanByNik(nik);
      if (data) {
        fillFormWithData(data);
        highlightCard(nik);
      }
      return;
    }

    // === Tersedia ===
    nikInfo.textContent = "✔ NIK tersedia";
    nikInfo.style.color = "green";
    nikInput.dataset.valid = "true";

    highlightCard(null);
    clearFormAutoFill();
  });
}




// ====================================================================
// LISTENER STATUS (TAMPILKAN FORM KONTRAK)
// ====================================================================
if (statusInput) statusInput.addEventListener("change", updateKontrakVisibility);

// ====================================================================
// SIMPAN DATA (FORM TAMBAH KARYAWAN)
// ====================================================================
karyawanForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const nama = document.getElementById("kar_name").value.trim().toUpperCase();
  const status = document.getElementById("kar_role").value;
  const tanggalJoin = document.getElementById("kar_tanggaljoin").value.trim();
  const kontrak = document.getElementById("durasi_kontrak").value.trim();
  const nik = nikInput.value.trim();

  // FOTO
  let fotoBase64 = null;
  if (fotoInput && fotoInput.files.length > 0) {
    fotoBase64 = await toBase64(fotoInput.files[0]);
  }

  // === Hitung masa kerja ===
  const masaKerja = hitungMasaKerja(tanggalJoin);

  let habisKontrakTanggal = "";
  let durasiLabel = "";
  let durasiKontrakAngka = 0;

  // === STATUS PERMANENT (DH, SH, UH) ===
  if (["DH", "SH", "UH"].includes(status.toUpperCase())) {
    habisKontrakTanggal = "9999-09-09";
    durasiLabel = "PERMANENT";
    durasiKontrakAngka = 0;  // wajib angka

  // === STATUS KONTRAK (OS, HT, PKWT) ===
  } else if (["HT", "PKWT", "OS"].includes(status.toUpperCase())) {

    const durasiManual = parseInt(kontrak || "0");

    if (durasiManual > 0) {
      durasiLabel = durasiManual + " Bulan";
      durasiKontrakAngka = durasiManual;
      habisKontrakTanggal = hitungHabisKontrak(tanggalJoin, durasiManual);
    } else {
      durasiLabel = "0 Bulan";
      durasiKontrakAngka = 0;
      habisKontrakTanggal = tanggalJoin;
    }

  // ===LAINNYA===
  } else {
    durasiLabel = masaKerja;
    habisKontrakTanggal = "-";
    durasiKontrakAngka = 0;
  }

  const payload = {
    nama,
    status,
    nik,
    tanggal_join: tanggalJoin,
    habis_kontrak: habisKontrakTanggal,
    durasi_kontrak: durasiKontrakAngka,  // <--- angka
    durasi_label: durasiLabel,            // <--- label untuk UI
    masa_kerja: masaKerja,
    fotoBase64
  };

  await window.electronAPI.saveKaryawan(payload);

  showToast("Data disimpan!", "success");
  await loadKaryawan();
  e.target.reset();
  nikInfo.textContent="";
  const prev = document.getElementById("kar_preview");
  if(prev)prev.style.display = "none";
  updateKontrakVisibility();
});


// ====================================================================
// FUNCTION UTILITIES
// ====================================================================
function hitungMasaKerja(tanggalJoin) {
  if (!tanggalJoin) return "-";

  const start = new Date(tanggalJoin);
  const today = new Date();

  if (isNaN(start.getTime())) return "-";

  let tahun = today.getFullYear() - start.getFullYear();
  let bulan = today.getMonth() - start.getMonth();
  let hari = today.getDate() - start.getDate();

  // Sesuaikan selisih bulan & hari
  if (hari < 0) {
    const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
    hari += prevMonth;
    bulan -= 1;
  }

  if (bulan < 0) {
    bulan += 12;
    tahun -= 1;
  }

  return `${tahun} Tahun ${bulan} Bulan ${hari} Hari`;
}


function resetFormKaryawan() {
  // Reset form
  karyawanForm.reset();

  // Reset foto
  const prev = document.getElementById("kar_preview");
  if (prev) {
    prev.src = "../assets/mayora2.png";
    prev.style.display = "none";
  }

  // Reset input NIK
  nikInput.value = "";
  nikInput.dataset.valid = "false";

  // Reset semua info validasi NIK
  const nikInfo = document.getElementById("nikInfo");
  if (nikInfo) {
    nikInfo.textContent = "";
    nikInfo.style.color = "inherit";
  }

  // Hentikan efek validasi warna border
  nikInput.classList.remove("valid-nik", "invalid-nik");
}


function hitungHabisKontrak(tanggalJoin, durasi) {
  const tgl = normalizeDate(tanggalJoin);
  if (!tgl || !durasi) return "-";

  const start = new Date(tgl);
  start.setMonth(start.getMonth() + parseInt(durasi));

  return start.toISOString().split("T")[0];
}

function normalizeDate(tgl) {
  if (!tgl) return null;

  // Jika sudah yyyy-mm-dd → langsung gunakan
  if (/^\d{4}-\d{2}-\d{2}$/.test(tgl)) return tgl;

  // Jika dd-mm-yyyy → ubah
  if (/^\d{2}-\d{2}-\d{4}$/.test(tgl)) {
    const [d, m, y] = tgl.split("-");
    return `${y}-${m}-${d}`;
  }

  return null; // format tidak valid
}

function hitungDurasiBulanHari(tanggalJoin, durasiBulan) {
  if (!tanggalJoin || !durasiBulan) return "-";

  const tgl = normalizeDate(tanggalJoin);
  if (!tgl) return "-"; // hindari NaN → expired salah

  const start = new Date(tgl);
  const end = new Date(start);
  end.setMonth(end.getMonth() + parseInt(durasiBulan));

  const today = new Date();

  if (end < today) return "Expired";

  // hitung bulan
  let temp = new Date(today);
  let months = 0;

  while (temp < end) {
    temp.setMonth(temp.getMonth() + 1);
    if (temp <= end) months++;
  }

  temp.setMonth(temp.getMonth() - 1);
  const days = Math.floor((end - temp) / (1000 * 60 * 60 * 24));

  return `${months} Bulan ${days} Hari`;
}


function toBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function hitungSisaKontrak(nik) {
  // Ambil perpanjangan terakhir
  const stmt = db.prepare(`
    SELECT durasi_bulan, tanggal_mulai
    FROM perpanjangan
    WHERE nik = ?
    ORDER BY kontrak_ke DESC
    LIMIT 1
  `);
  const row = stmt.get(nik);

  if (!row || !row.tanggal_mulai || !row.durasi_bulan) return "-";

  // Hitung tanggal selesai kontrak terakhir
  const tglMulai = new Date(row.tanggal_mulai);
  const tglSelesai = new Date(tglMulai);
  tglSelesai.setMonth(tglSelesai.getMonth() + row.durasi_bulan);

  const sekarang = new Date();
  const selisih = Math.ceil((tglSelesai - sekarang) / (1000 * 60 * 60 * 24));

  return selisih < 0 ? "Expired" : selisih + " hari";
}

// Renderer.js
async function getSisaKontrak(nik) {
  // Panggil IPC ke main process
  const row = await window.karyawanAPI.getLatestPerpanjangan(nik);

  if (!row || !row.tanggal_mulai || !row.durasi_bulan) return "-";

  const tglMulai = new Date(row.tanggal_mulai);
  const tglSelesai = new Date(tglMulai);
  tglSelesai.setMonth(tglSelesai.getMonth() + row.durasi_bulan);

  const sekarang = new Date();
  const selisih = Math.ceil((tglSelesai - sekarang) / (1000 * 60 * 60 * 24));

  return selisih < 0 ? "Expired" : selisih + " hari";
}

function fillFormWithData(data) {
  document.getElementById("kar_name").value = data.nama || "";
  document.getElementById("kar_role").value = data.status || "";
  document.getElementById("kar_tanggaljoin").value = data.tanggal_join || "";
  updateKontrakVisibility();

  document.getElementById("karyawanForm").classList.add("highlight-form");
}

function clearFormAutoFill() {
  document.getElementById("kar_name").value = "";
  document.getElementById("kar_role").value = "";
  document.getElementById("kar_tanggaljoin").value = "";

  if (fotoInput) fotoInput.value = "";
  const prev = document.getElementById("kar_preview");
  if (prev) prev.style.display = "none";

  document.getElementById("karyawanForm").classList.remove("highlight-form");

  highlightCard(null);
  updateKontrakVisibility();
}

function highlightCard(nik) {
  document.querySelectorAll(".karyawan-card").forEach(card => {
    if (nik && card.dataset.nik === nik) {
      card.classList.add("highlight");
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      card.classList.remove("highlight");
    }
  });
}

function updateKontrakVisibility() {
  const val = statusInput.value.toUpperCase();
  const butuhKontrak = ["HT", "PKWT", "OS"];

  if (butuhKontrak.includes(val)) {
    durasiField.style.display = "block";
  } else {
    durasiField.style.display = "none";
    durasiInput.value = "";
  }
}

function updatePersentase(att, abs, opr) {
  const attPercentEl = document.getElementById('attitudePercent');
  const absPercentEl = document.getElementById('absensiPercent');
  const oprPercentEl = document.getElementById('operasionalPercent');

  if (attPercentEl) attPercentEl.textContent = att + '%';
  const attBar = document.getElementById('attitudeBar');
  if (attBar) attBar.style.width = att + '%';

  if (absPercentEl) absPercentEl.textContent = abs + '%';
  const absBar = document.getElementById('absensiBar');
  if (absBar) absBar.style.width = abs + '%';

  if (oprPercentEl) oprPercentEl.textContent = opr + '%';
  const oprBar = document.getElementById('operasionalBar');
  if (oprBar) oprBar.style.width = opr + '%';
}




let trendChart = null;

function renderTrendChart(labels, att, abs, opr) {
  const canvas = document.getElementById("trendChart");
  if (!canvas) {
    console.error("trendChart canvas tidak ditemukan!");
    return;
  }

  const ctx = canvas.getContext("2d");

  if (trendChart) trendChart.destroy();

  trendChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Attitude", data: att, borderColor: "green", tension: 0.3 },
        { label: "Absensi", data: abs, borderColor: "blue", tension: 0.3 },
        { label: "Operasional", data: opr, borderColor: "orange", tension: 0.3 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { min: 0, max: 100 } }
    }
  });
}

async function loadTrend(nik) {
  const history = await window.karyawanAPI.getPerformanceHistory(nik);

  if (!history || history.length === 0) {
    console.warn("Tidak ada history untuk nik:", nik);
    return;
  }

  const labels = history.map(r => formatTanggal(r.created_at));
  const att = history.map(r => r.attitude);
  const abs = history.map(r => r.absensi);
  const opr = history.map(r => r.operasional);

  renderTrendChart(labels, att, abs, opr);
}


function formatTanggal(t) {
    const d = new Date(t);
    if (isNaN(d)) return "Unknown";

    return d.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}



function showToast(message, type = "info", duration = 3000) {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    ${message}
    <div class="bar"><div class="fill"></div></div>
  `;
  container.appendChild(toast);

  const fill = toast.querySelector(".fill");
  setTimeout(() => {
    if (fill) {
      fill.style.transition = `width ${duration}ms linear`;
      fill.style.width = "0%";
    }
  }, 10);

  setTimeout(() => {
    toast.style.opacity = 0;
    toast.style.transform = "translateX(100%)";
    setTimeout(() => toast.remove(), 400);
  }, duration + 300);
}



// ================= DASHBOARD STYLE SYSTEM =================
  if (window.dashboard && window.dashboard.onChange) {
    window.dashboard.onChange((style) => {
      document.body.classList.forEach(cls => {
        if (cls.startsWith("dashboard-")) document.body.classList.remove(cls);
      });
      document.body.classList.add(`dashboard-${style}`);
      localStorage.setItem("dashboardStyle", style);
    });
  }
  const savedStyle = localStorage.getItem("dashboardStyle");
  if (savedStyle) document.body.classList.add(`dashboard-${savedStyle}`);

  const themeSelect = document.getElementById("themeSelect");
  if (themeSelect) {
    themeSelect.addEventListener("change", () => {
      document.body.className = themeSelect.value;
      localStorage.setItem("theme", themeSelect.value);
    });
    if (localStorage.getItem("theme")) {
      document.body.className = localStorage.getItem("theme");
      themeSelect.value = localStorage.getItem("theme");
    }
  }
  if (window.theme && window.theme.onChange) {
    window.theme.onChange((theme) => {
      document.body.className = theme;
      localStorage.setItem("theme", theme);
      if (themeSelect) themeSelect.value = theme;
    });
  }
// ====================================================================
// THEME
// ====================================================================
window.electronAPI.onThemeChange((theme) => {
  document.body.className = "";
  document.body.classList.add(`dashboard-${theme}`);
});

// === LOAD FIRST ===
loadKaryawan();
updatePersentase(80, 95, 70);

}); // DOMContentLoaded end

window.api.onLoadingShow(() => {
  const loading = document.getElementById("global-loading");
  if (loading) loading.classList.replace("loading-hidden", "loading-show");
});

window.api.onLoadingHide(() => {
  const loading = document.getElementById("global-loading");

  // Delay agar screen baru sudah terlihat dulu
  setTimeout(() => {
    if (loading) loading.classList.replace("loading-show", "loading-hidden");
  }, 150);
});
