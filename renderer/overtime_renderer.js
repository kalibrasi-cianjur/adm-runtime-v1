let selectedKaryawan = null;
let currentConfig = null;
let weeklyData = [];
let editMode = false;
let editKey = null; // { nama, tanggal }
let rasioWeeklyList = [];

let editingRow = null;
let isEditingSales = false;


let salesEditMode = false;
let salesEditKey = null; // { bulan, tahun }


let WEEK_RULE = null;
const modalOverlay = document.getElementById("modalOverlay");
const modalTitle   = document.getElementById("modalTitle");
const modalMessage = document.getElementById("modalMessage");
const modalOk      = document.getElementById("modalOk");
const modalCancel  = document.getElementById("modalCancel");

const form = document.getElementById("salesForm");
const tbody = document.querySelector("#salesTable tbody");

const weeklyBody = document.getElementById("weeklyBody");

weeklyBody.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-nama][data-tanggal]");
  if (!btn) return;

  const nama = btn.dataset.nama;
  const tanggal = btn.dataset.tanggal;

  if (btn.classList.contains("btn-edit")) {
    startEditOvertime(nama, tanggal);
  }

  if (btn.classList.contains("btn-delete")) {
    openDeleteModal(nama, tanggal);
  }
});



async function loadWeekRule() {
  WEEK_RULE = await window.overtime.getWeekConfig();

  weekStartDay.value = WEEK_RULE.start_day;
  weekFirstRule.value = WEEK_RULE.first_week_rule;
}



async function loadCompanyWeekRule(year) {
  const rule = await window.overtime.getCompanyWeekRule(year);
  if (!rule) return;

  weekYear.value = rule.year;
  week1Start.value = rule.week1_start;
  week1End.value = rule.week1_end;
}

const currentYear = new Date().getFullYear();
weekYear.value = currentYear;
loadCompanyWeekRule(currentYear);


btnSaveWeekRule.onclick = async () => {
  const payload = {
    start_day: Number(weekStartDay.value),
    first_week_rule: weekFirstRule.value
  };

  await window.overtime.saveWeekConfig(payload);
  WEEK_RULE = payload;

  showToast("Week rule berhasil disimpan", "success");

  // refresh filter & report
  const today = getTodayLocalISO();
  weekFilter.value = getBusinessWeekFromDate(today);
  loadWeeklyReport();
};




document.addEventListener("DOMContentLoaded", async () => {
  await loadWeekRule();
  loadKaryawan();

  const weekInput = document.getElementById("weekFilter");

  if (weekInput) {
    const today = getTodayLocalISO();
    const currentWeek = getISOWeek(today); // ✅ selalu valid
    weekInput.value = currentWeek;


    loadWeeklyReport();
    weekInput.addEventListener("change", loadWeeklyReport);
  }

  btnSave.onclick = submitOvertime;
  document.getElementById("btnConfig").onclick = toggleConfig;
  document.getElementById("btnSaveConfig").onclick = saveConfig;

  ["jumlahJam", "jenisHari"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", updateSummary);
  });
});



document.addEventListener("dblclick", (e) => {
  const drawer = document.getElementById("configDrawer");
  const btn = document.getElementById("btnConfig");

  if (
    drawer.classList.contains("show") &&
    !drawer.contains(e.target) &&
    !btn.contains(e.target)
  ) {
    closeConfigDrawer();
  }
});


btnSaveCompanyWeek.onclick = async () => {
  const year = Number(weekYear.value);
  const start = week1Start.value;
  const end = week1End.value;

  if (!year || !start || !end) {
    showToast("Data kalender belum lengkap", "info");
    return;
  }

  if (new Date(end) < new Date(start)) {
    showToast("Week 1 selesai tidak boleh sebelum mulai", "error");
    return;
  }

  await window.overtime.saveCompanyWeekRule({
    year,
    week1_start: start,
    week1_end: end
  });

  showToast(`Kalender minggu ${year} disimpan`, "success");

  // refresh report jika tahun sama
  const selectedWeek = weekFilter.value;
  if (selectedWeek?.startsWith(year.toString())) {
    loadWeeklyReport();
  }
};




const btnToggleEmployee = document.getElementById("btnToggleEmployee");
const employeePanel = document.getElementById("employeePanel");

btnToggleEmployee.addEventListener("click", (e) => {
  e.stopPropagation();

  const isOpen = employeePanel.classList.toggle("show");

  // sembunyikan tombol saat panel terbuka
  btnToggleEmployee.style.display = isOpen ? "none" : "block";
});


document.addEventListener("dblclick", (e) => {
  if (!employeePanel.classList.contains("show")) return;
  if (employeePanel.contains(e.target)) return;

  employeePanel.classList.remove("show");
  btnToggleEmployee.style.display = "block";
});



const reportCard = document.getElementById("weeklyReportCard");
const weeklyWrapper = document.getElementById("weeklyReportWrapper");
const btnBackReport = document.getElementById("btnBackReport");

// klik card → tampilkan report, sembunyikan card
reportCard.addEventListener("click", () => {
  reportCard.classList.add("hidden");
  weeklyWrapper.classList.remove("hidden");
});

// klik tombol back → sembunyikan report, tampilkan card
btnBackReport.addEventListener("click", () => {
  weeklyWrapper.classList.add("hidden");
  reportCard.classList.remove("hidden");
});



/* =====================
   LOAD KARYAWAN
===================== */
async function loadKaryawan() {
  const list = document.getElementById("employeeList");
  list.innerHTML = "";

  const data = await window.overtime.getAll();

  data.forEach(k => {
    const li = document.createElement("li");
    li.textContent = `${k.nama} (${k.status})`;
    li.ondblclick = () => selectKaryawan(k);
    list.appendChild(li);
  });
}

/* =====================
   PILIH KARYAWAN
===================== */
async function selectKaryawan(k) {
  selectedKaryawan = k;

  // ==== FORM UTAMA (SAFE) ====
  if (karyawanNik) karyawanNik.value = k.nik ?? "";
  if (karyawanNama) karyawanNama.value = k.nama ?? "";
  if (karyawanStatus) karyawanStatus.value = k.status ?? "";

  // ==== DRAWER CONFIG (SAFE) ====
  const cfgNama = document.getElementById("cfgNama");
  const cfgStatus = document.getElementById("cfgStatus");
  const cfgNilai = document.getElementById("cfgNilai");

  if (cfgNama) cfgNama.value = k.nama;
  if (cfgStatus) cfgStatus.value = k.status;

  // ==== AMBIL CONFIG GAPOK ====
  currentConfig = await window.overtime.getConfig(k.nik);

  const gapokInput = document.getElementById("gapok");
  const gapokWrapper = document.getElementById("gapokWrapper");

  if (gapokWrapper) {
    gapokWrapper.style.display = "block";
  }

  if (currentConfig) {
    if (gapokInput) gapokInput.value = currentConfig.nilai;
    if (cfgNilai) cfgNilai.value = currentConfig.nilai;
  } else {
    if (gapokInput) gapokInput.value = "";
    if (cfgNilai) cfgNilai.value = "";
    showToast("GAPOK belum diset untuk karyawan ini", "info");
    toggleConfig();
  }

  if (btnSave) btnSave.disabled = false;
  updateSummary?.();
}

async function startEditOvertime(nama, tanggal) {
  const data = await window.overtime.getByNameDate({ nama, tanggal });
  if (!data) {
    showToast("Data tidak ditemukan", "error");
    return;
  }

  // 🔒 SET STATE
  editMode = true;
  editKey = { nama, tanggal };

  selectedKaryawan = {
    nik: data.nik,
    nama: data.nama,
    status: data.status
  };

  currentConfig = {
    nilai: data.gapok
  };

  // tampilkan panel karyawan
  employeePanel.classList.add("show");
  btnToggleEmployee.style.display = "none";

  // isi form
  karyawanNik.value = data.nik;
  karyawanNama.value = data.nama;
  karyawanStatus.value = data.status;
  tanggalLembur.value = data.tanggal;
  jenisHari.value = data.jenis_hari;
  jumlahJam.value = data.jam;
  gapok.value = data.gapok;
  keterangan.value = data.keterangan || "";

  updateSummary();

  btnSave.textContent = "Update";
  btnSave.disabled = false;
}


/* =====================================================
   SUBMIT OVERTIME — INSERT / UPDATE
===================================================== */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function submitOvertime() {
  if (!selectedKaryawan || !currentConfig) {
    showToast("Pilih karyawan dulu", "error");
    return;
  }

  const jamValue = Number(jumlahJam.value);
  const gapokValue = Number(gapok.value);
  const jenisHariValue = jenisHari.value;

  const hitung = hitungLembur(jamValue, gapokValue, jenisHariValue);

  const payload = {
    nik: karyawanNik.value,
    nama: karyawanNama.value,
    status: karyawanStatus.value,
    kategori: getKategori(karyawanStatus.value),
    mh: hitung.mh,
    tarif: hitung.tarif,
    total: hitung.total,
    tanggal: tanggalLembur.value,
    jam: jamValue,
    jenis_hari: jenisHariValue,
    gapok: gapokValue,
    keterangan: keterangan.value || ""
  };

  if (editMode && editKey) {
    // UPDATE
    payload.old_nama = editKey.nama;
    payload.old_tanggal = editKey.tanggal;

    openModal({
      title: "Update Data Lembur",
      message: `Apakah Anda yakin ingin memperbarui data lembur ${editKey?.nama} tanggal ${editKey?.tanggal}?`,
      okText: "Update",
      onOk: async () => {
        try {
          const res = await window.overtime.updateByNameDate(payload);
          showLoading();
          closeModal();
          await delay(10000); // 🔹 delay setelah selesai sebelum hide loading

          if (!res || res.changes === 0) {
            showToast("Update gagal / data tidak ditemukan", "error");
            return;
          }

          showToast("Data lembur berhasil diperbarui", "success");
          loadWeeklyReport();
          exitEditMode();
          resetForm();
        } finally {
          hideLoading();
        }
      }
    });

  } else {
    // INSERT
    openModal({
      title: "Simpan Data Lembur",
      message: `Apakah Anda yakin ingin menyimpan lembur ${payload.nama} tanggal ${payload.tanggal}?`,
      okText: "Simpan",
      onOk: async () => {
        showLoading();
        closeModal();
        try {
          const res = await window.overtime.insert(payload);
          showLoading();
        closeModal();
          await delay(3000); // 🔹 delay setelah selesai sebelum hide loading

          if (!res || res.changes === 0) {
            showToast("Gagal menyimpan data", "error");
            return;
          }

          showToast("Data lembur berhasil disimpan", "success");
          loadWeeklyReport();
          resetForm();
        } finally {
          hideLoading();
        }
      }
    });
  }
}



function openDeleteModal(nama, tanggal) {
  openModal({
    title: "Hapus Data Lembur",
    message: `Hapus lembur ${nama} tanggal ${tanggal}?`,
    okText: "Hapus",
    onOk: async () => {
      const res = await window.overtime.deleteByNameDate({ nama, tanggal });

      if (!res || res.changes === 0) {
        showToast("Data tidak ditemukan", "error");
        return;
      }

      showToast("Data lembur dihapus", "success");
      loadWeeklyReport();
    }
  });
}

/* =====================================================
   MODAL GENERIC
===================================================== */
function openModal({ title, message, okText = "Ya", onOk }) {
  // pastikan modal tertutup dulu
  closeModal();

  modalTitle.textContent = title;
  modalMessage.textContent = message;
  modalOk.textContent = okText;
  modalOk.disabled = false;

  modalOverlay.classList.remove("hidden");

  modalCancel.onclick = closeModal;

  modalOk.onclick = async () => {
    modalOk.disabled = true;
    try {
      await onOk();
    } finally {
      modalOk.disabled = false;
      closeModal();
    }
  };
}

function closeModal() {
  modalOverlay.classList.add("hidden");
}

/* =====================================================
   EXIT & RESET
===================================================== */
function exitEditMode() {
  editMode = false;
  editKey = null;
  btnSave.textContent = "Simpan";
  btnSave.disabled = true;
}



/* =====================
   BOBOT LEMBUR
===================== */
function hitungBobotLembur(jam, jenisHari) {
  let bobot = 0;

  for (let i = 1; i <= jam; i++) {
    if (jenisHari === "HB") {
      bobot += i === 1 ? 1.5 : 2;
    } else {
      if (i <= 7) bobot += 2;
      else if (i === 8) bobot += 3;
      else bobot += 4;
    }
  }
  return bobot;
}

/* =====================
   RUMUS LEMBUR (SEMUA)
===================== */
function hitungLembur(jam, gapok, jenisHari) {
  const tarifJam = gapok / 173;
  const mh = hitungBobotLembur(jam, jenisHari);

  return {
    mh,
    tarif: tarifJam,
    total: tarifJam * mh
  };
}

/* =====================
   UPDATE SUMMARY
===================== */
function updateSummary() {
  if (!selectedKaryawan || !currentConfig) return;

  const jam = Number(jumlahJam.value);
  const jenis = jenisHari.value;

  if (!jam || jam <= 0) {
    sumMH.textContent = "-";
    sumTotal.textContent = "-";
    btnSave.disabled = true;
    return;
  }

  const hasil = hitungLembur(jam, currentConfig.nilai, jenis);

  sumMH.textContent = hasil.mh.toFixed(1);
  sumTotal.textContent =
    "Rp " + Math.round(hasil.total).toLocaleString("id-ID");

  btnSave.disabled = false;
}




function getKategori(status) {
  const staff = ["TL", "UH", "SH", "DH"];
  return staff.includes(status) ? "STAFF" : "NON_STAFF";
}

/* =====================
   CONFIG DRAWER
===================== */
function toggleConfig() {
  const drawer = document.getElementById("configDrawer");

  if (drawer.classList.contains("hidden")) {
    drawer.classList.remove("hidden");
    requestAnimationFrame(() => drawer.classList.add("show"));
  } else {
    drawer.classList.remove("show");
    setTimeout(() => drawer.classList.add("hidden"), 300);
  }
}


function closeConfigDrawer() {
  const drawer = document.getElementById("configDrawer");
  drawer.classList.remove("show");

  setTimeout(() => {
    drawer.classList.add("hidden");
  }, 300);
}

async function saveConfig() {
  if (!selectedKaryawan) {
    showToast("Pilih karyawan dulu", "error");
    return;
  }

  const nilai = Number(cfgNilai.value);
  if (!nilai || nilai <= 0) {
    showToast("Gapok tidak valid", "info");
    return;
  }

  const kategori = getKategori(selectedKaryawan.status);

  await window.overtime.saveConfig({
    nik: selectedKaryawan.nik,
    nama: selectedKaryawan.nama,
    status: selectedKaryawan.status,
    kategori,          // ⬅ SEKARANG SELALU TERISI
    nilai              // ⬅ GAPOK
  });

  showToast("Gapok karyawan tersimpan", "success");

  currentConfig = await window.overtime.getConfig(selectedKaryawan.nik);
  gapok.value = currentConfig.nilai;   // auto isi form
  updateSummary();
  toggleConfig();
}




//===================================== tabel ====================================//

const hariMap = {
  0: "Minggu",
  1: "Senin",
  2: "Selasa",
  3: "Rabu",
  4: "Kamis",
  5: "Jumat",
  6: "Sabtu"
};
const stafList = ["TL","UH","SH","DH"];

// ================== LOAD WEEKLY REPORT ==================
async function loadWeeklyReport() {
  const weekValue = document.getElementById("weekFilter").value;
  if (!weekValue) return;

  const range = await getWeekRange(weekValue);


  if (!range) {
    showToast(
      "Kalender minggu untuk tahun ini belum diset. Silakan isi di pengaturan.",
      "info"
    );
    return;
  }

  const startDate = range.monday.toISOString().slice(0,10);
  const endDate   = range.sunday.toISOString().slice(0,10);

  try {
    const [total, byDay, detail] = await Promise.all([
      window.overtime.getTotal({startDate,endDate}),
      window.overtime.getByDay({startDate,endDate}),
      window.overtime.getDetail({startDate,endDate})
    ]);

    renderWeeklySummary(total);
    renderVerticalDays(byDay);
    renderWeeklyTable(detail);
    renderStaffSummary(detail);

  } catch(err) {
    console.error("Weekly load error:", err);
  }
}

function getSelectedWeek() {
  const weekInput = document.getElementById("weekFilter");
  if (!weekInput || !weekInput.value) return null;

  const [year, week] = weekInput.value.split("-W");

  return {
    tahun: Number(year),
    minggu: Number(week)
  };
}

function normalizeNumber(val) {
  return typeof val === "number" ? val : 0;
}


function renderWeeklySummary(data) {
  if (!data) return;

  const totalJam     = normalizeNumber(data.total_jam);
  const totalBiaya   = normalizeNumber(data.total_biaya);
  const weekBudget   = normalizeNumber(data.final_budget);
  const monthBudget  = normalizeNumber(data.budget_bulan);

  document.getElementById("weekTotalJam").textContent =
    totalJam + " jam";

  document.getElementById("weekTotalBiaya").textContent =
    "Rp " + totalBiaya.toLocaleString("id-ID");

  document.getElementById("weekBudget").textContent =
    "Rp " + weekBudget.toLocaleString("id-ID");

  document.getElementById("monthBudget").textContent =
    "Rp " + monthBudget.toLocaleString("id-ID");
}



// ================== RENDER STAFF / NON-STAFF ==================
function renderStaffSummary(data) {
  let staffJam = 0,
      staffBiaya = 0,
      nonStaffJam = 0,
      nonStaffBiaya = 0;

  data.forEach(r => {
    if (stafList.includes(r.status)) {
      staffJam += r.jam;
      staffBiaya += r.total;
    } else {
      nonStaffJam += r.jam;
      nonStaffBiaya += r.total;
    }
  });

  /* ========= SAFE UPDATE ========= */
  const elStaffJam = document.getElementById("totalStaffJam");
  const elStaffBiaya = document.getElementById("totalStaffBiaya");
  const elNonStaffJam = document.getElementById("totalNonStaffJam");
  const elNonStaffBiaya = document.getElementById("totalNonStaffBiaya");

  if (elStaffJam) {
    elStaffJam.textContent = `${staffJam} jam`;
  }

  if (elStaffBiaya) {
    elStaffBiaya.textContent = `Rp ${staffBiaya.toLocaleString("id-ID")}`;
  }

  if (elNonStaffJam) {
    elNonStaffJam.textContent = `${nonStaffJam} jam`;
  }

  if (elNonStaffBiaya) {
    elNonStaffBiaya.textContent = `Rp ${nonStaffBiaya.toLocaleString("id-ID")}`;
  }
}

function getRangeFromCompanyCalendar(rule, week) {
  const w1Start = new Date(rule.week1_start);
  const w1End   = new Date(rule.week1_end);

  // ===== WEEK 1 =====
  if (week === 1) {
    return {
      monday: w1Start,
      sunday: w1End
    };
  }

  // ===== WEEK 2+ =====
  const week2Start = new Date(w1End);
  week2Start.setDate(week2Start.getDate() + 1);

  const start = new Date(week2Start);
  start.setDate(start.getDate() + (week - 2) * 7);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return { monday: start, sunday: end };
}

function getRangeFromLegacyRule(isoWeek, legacyRule) {
  const [year, week] = isoWeek.split("-W").map(Number);

  // === ISO anchor (Jan 4) ===
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;

  const isoMonday = new Date(jan4);
  isoMonday.setDate(
    jan4.getDate() - jan4Day + 1 + (week - 1) * 7
  );

  // === BUSINESS START DAY ===
  const businessStart = new Date(isoMonday);
  const shift =
    legacyRule.start_day === 0
      ? -1                 // Minggu
      : legacyRule.start_day - 1;

  businessStart.setDate(isoMonday.getDate() + shift);

  const businessEnd = new Date(businessStart);
  businessEnd.setDate(businessStart.getDate() + 6);

  return {
    monday: businessStart,
    sunday: businessEnd
  };
}



function renderWeeklyTable(data) {
  const tbody = document.getElementById("weeklyBody");
  const totalCell = document.getElementById("weeklyTotal");

  tbody.innerHTML = "";
  let total = 0;

  const today = getTodayLocalISO();
  let todayFound = false;

  // ✅ URUTKAN BERDASARKAN TANGGAL (REAL WEEK)
  data.sort((a, b) => {
    return new Date(a.tanggal) - new Date(b.tanggal);
  });

  data.forEach(row => {
    const dateObj = new Date(row.tanggal);
    const dayIndex = dateObj.getDay();
    const hariName = hariMap[dayIndex];

    total += row.total;

    const tr = document.createElement("tr");
    tr.dataset.hari = dayIndex;
    tr.dataset.tanggal = row.tanggal;

    if (row.tanggal === today) {
      tr.classList.add("highlight");
      todayFound = true;
    }

    tr.innerHTML = `
      <td>${hariName}</td>
      <td>${row.nama}</td>
      <td>${row.jam}</td>
      <td>${row.keterangan || "-"}</td>
      <td>Rp ${row.total.toLocaleString("id-ID")}</td>
  <td>
    <button
      class="btn-edit"
      data-nama="${row.nama}"
      data-tanggal="${row.tanggal}"
    >✏️</button>

    <button
      class="btn-delete"
      data-nama="${row.nama}"
      data-tanggal="${row.tanggal}"
    >🗑️</button>
  </td>
    `;

    tbody.appendChild(tr);
  });

  /* ====== JIKA HARI INI TIDAK ADA DATA ====== */
  if (!todayFound) {
    const todayObj = new Date();
    const hariName = hariMap[todayObj.getDay()];

    const tr = document.createElement("tr");
    tr.classList.add("highlight", "empty-today");

    tr.innerHTML = `
      <td>${hariName}</td>
      <td colspan="3"><em>Belum ada data lembur hari ini</em></td>
      <td>Rp 0</td>
    `;

    tbody.appendChild(tr);
  }

  totalCell.textContent = `Rp ${total.toLocaleString("id-ID")}`;
}




// ================== RENDER DAILY BOX ==================
function renderVerticalDays(data) {
  const container = document.getElementById("weeklyDays");
  if (!container) return;
  container.innerHTML = "";

  const normalizedData = data.map(d => ({
    hari: d.hari === 7 ? 0 : Number(d.hari),
    total_jam: d.total_jam || 0,
    total_biaya: d.total_biaya || 0
  }));

for (let i = 1; i <= 7; i++) {
  const hariIndex = i === 7 ? 0 : i;

  const d = normalizedData.find(x => x.hari === hariIndex) || {
    total_jam: 0,
    total_biaya: 0
  };

  const el = document.createElement("div");
  el.className = "day-badge";
  el.dataset.hari = hariIndex;

  el.innerHTML = `
    <span>${hariMap[hariIndex]}</span>
    <strong>${d.total_jam} jam</strong>
    <small>Rp ${d.total_biaya.toLocaleString("id-ID")}</small>
  `;

  el.addEventListener("click", () =>
    toggleHighlightTableByDay(hariIndex)
  );

  container.appendChild(el);
}


}



// ================== TOGGLE HIGHLIGHT ==================
function toggleHighlightTableByDay(hari) {
  const rows = document.querySelectorAll("#weeklyBody tr");

  // cek apakah hari ini sudah di-highlight
  const isAlreadyHighlighted = Array.from(rows).some(
    r => r.classList.contains("highlight") && Number(r.dataset.hari) === hari
  );

  // hapus semua highlight
  rows.forEach(r => r.classList.remove("highlight"));

  // jika sebelumnya belum di-highlight, beri highlight
  if (!isAlreadyHighlighted) {
    rows.forEach(r => {
      const rowHari = Number(r.dataset.hari); // 0-6
      if (rowHari === hari) {
        r.classList.add("highlight");
      }
    });
  }
}

function highlightTodayRow(tanggal) {
  document.querySelectorAll("#weeklyBody tr").forEach(tr => {
    if (tr.dataset.tanggal === tanggal) {
      tr.classList.add("highlight");
      tr.scrollIntoView({ behavior: "smooth", block: "center" });

      setTimeout(() => {
        tr.classList.remove("highlight");
      }, 3000);
    }
  });
}


function getCompanyWeekRule(year) {
  const rule = COMPANY_WEEK_RULES[year];
  if (!rule) throw new Error(`Week rule ${year} belum diset`);
  return rule;
}


// ================== HELPERS ==================
async function getWeekRange(isoWeek) {
  const [year, week] = isoWeek.split("-W").map(Number);

  // 1️⃣ coba company calendar
  const companyRule = await window.overtime.getCompanyWeekRule(year);
  if (companyRule) {
    return getRangeFromCompanyCalendar(companyRule, week);
  }

  // 2️⃣ fallback ke rule lama
  const legacyRule = await window.overtime.getWeekConfig();
  return getRangeFromLegacyRule(isoWeek, legacyRule);
}



function getISOWeek(dateStr) {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);


  return (
    d.getFullYear() +
    "-W" +
    String(
      1 +
        Math.round(
          ((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
        )
    ).padStart(2, "0")
  );
}




function getBusinessRangeFromISOWeek(isoWeek) {
  if (!WEEK_RULE) return null;

  const [y, w] = isoWeek.split("-W").map(Number);

  // Ambil Senin ISO
  const jan4 = new Date(y, 0, 4);
  const jan4Day = jan4.getDay() || 7;

  const isoMonday = new Date(jan4);
  isoMonday.setDate(jan4.getDate() - jan4Day + 1 + (w - 1) * 7);

  // Business start day (0=Minggu,1=Senin)
  const start = new Date(isoMonday);
  start.setDate(isoMonday.getDate() + (WEEK_RULE.start_day === 0 ? -1 : 0));

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return { start, end };
}


function getHariIndex(dateStr){
  const day = new Date(dateStr).getDay(); // 0-6
  return day === 0 ? 7 : day; // ubah Minggu(0) → 7
}
function getTodayLocalISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000)
    .toISOString()
    .slice(0, 10);
}




//==================================================================================//

/* =====================
   RESET
===================== */
function resetForm() {
  karyawanNik.value = "";
  karyawanNama.value = "";
  karyawanStatus.value = "";
  tanggalLembur.value = "";
  jenisHari.value = "";
  jumlahJam.value = "";
  gapok.value = "";
  keterangan.value = "";

  selectedKaryawan = null;
  currentConfig = null;

  btnSave.textContent = "Simpan";
  btnSave.disabled = true;

  employeePanel.classList.remove("show");
  btnToggleEmployee.style.display = "block";

  updateSummary();
}



// =======================
// SALES CARD RENDERER
// =======================
// =======================
/* ================= FORMATTER ================= */
function num(val) {
  if (val === null || val === undefined || val === "") return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function cell(val, unit = "") {
  const n = Number(val);
  if (isNaN(n)) {
    return `<div class="cell-dash">-</div>`;
  }

  const cls = n < 0 ? "cell-num negative" : "cell-num";

  return `
    <div class="${cls}">${n.toLocaleString("id-ID")}</div>
    ${unit ? `<div class="cell-unit">${unit}</div>` : ""}
  `;
}


function formatKg(val) {
  const n = num(val);
  return n === 0 ? "0 Kg" : n.toLocaleString("id-ID") + " Kg";
}


function formatRp(val) {
  if (val == null || isNaN(val)) return "-";
  return "Rp " + Number(val).toLocaleString("id-ID");
}

function formatPercent(val) {
  if (val == null || isNaN(val)) return "-";
  return Number(val).toFixed(2) + " %";
}

function formatRatio(val, digit = 2) {
  if (val == null || isNaN(val)) return "-";
  return Number(val).toFixed(digit);
}

function formatJam(val) {
  const n = num(val);
  return n.toFixed(0) + " Jam";
}

// render card berdasarkan week_now
async function renderWeekCards() {
  const wrapper = document.getElementById("weekCardWrapper");
  const data = await window.sales.getAll();

  const weeks = [...new Set(data.map(d => d.week_now))]
    .filter(Boolean)
    .sort((a, b) => a - b);

  wrapper.innerHTML = "";

  if (weeks.length === 0) {
    wrapper.innerHTML = `<div style="opacity:0.6">Belum ada data</div>`;
    return;
  }

  weeks.forEach(week => {
    const card = document.createElement("div");
    card.className = "week-card";
    card.textContent = `Week ${week}`;

    card.onclick = async () => {
      // aktifkan card
      wrapper.querySelectorAll(".week-card")
        .forEach(c => c.classList.remove("active"));
      card.classList.add("active");

      // ⬅️ SATU-SATUNYA TEMPAT LOAD TABEL
      const dataWeek = await window.sales.getByWeek(week);
      renderSalesTable(dataWeek);
    };

    wrapper.appendChild(card);
  });
}




function initSalesRenderer() {
  // ================= ELEMENT =================
  const salesCard = document.getElementById("salesReportCard");
  const salesWrapper = document.getElementById("salesReportWrapper");
  const btnBackSales = document.getElementById("btnBackSales");

  const weeklyCard = document.getElementById("weeklyReportCard");
  const weeklyWrapper = document.getElementById("weeklyReportWrapper");

  const tableBody = document.querySelector("#salesTable tbody");
  const btnOpenModal = document.getElementById("btnOpenSalesModal");
  const btnCloseModal = document.getElementById("btnCloseSalesModal");
  const salesModal = document.getElementById("salesModal");
  const salesForm = document.getElementById("salesForm");


  // ================= AUTO HITUNG =================
[
  "weekByMonth",
  "sales_target",
  "aktual_gr",
  "budget_bulan",
  "realisasi_overtime",
  "budget_by_ci",
  "nominal",
  "persentase"
].forEach(id => {
  document.getElementById(id).addEventListener("input", calculateSales);

// setelah loadSales atau di akhir initSalesRenderer
renderWeekCards();

});



  // ================= OPEN SALES =================
  salesCard.onclick = async () => { // ✅ async
  weeklyCard?.classList.add("hidden");
  weeklyWrapper?.classList.add("hidden");
  salesCard.classList.add("hidden");
  salesWrapper.classList.remove("hidden");

const tableBody = document.querySelector("#salesTable tbody");
  tableBody.innerHTML = `
    <tr>
      <td colspan="22" style="text-align:center; opacity:0.6">
        Pilih week untuk melihat data
      </td>
    </tr>
  `;
  const weekWrapper = document.getElementById("weekCardWrapper");
  weekWrapper.classList.remove("hidden");

  await renderWeekCards(); // ✅ sekarang aman
};


  reportCard.onclick = () =>
  {

    salesCard.classList.add("hidden");


  };
  btnBackReport.onclick = () =>
  {
    salesCard.classList.remove("hidden");
  };

  btnBackSales.onclick = () => {
    salesWrapper.classList.add("hidden");
    weeklyCard?.classList.remove("hidden");
    salesCard.classList.remove("hidden");
  };




  // ================= LOAD DATA =================
  async function loadSales() {
    if (isEditingSales) return;
    tableBody.innerHTML = "";
    const data = await window.sales.getAll();

    if (!data || data.length === 0) {
      tableBody.innerHTML =
        `<tr><td colspan="21" style="text-align:center">Belum ada data</td></tr>`;
      return;
    }

    data.forEach(row => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.bulan}</td>
        <td>${row.tahun}</td>
        <td>${row.week_now}</td>
        <td>${row.week_by_month}</td>
        <td>${cell(row.sales_target, "Kg")}</td>
        <td>${cell(row.sales_target_week, "Kg")}</td>
        <td>${cell(row.aktual_gr, "Kg")}</td>
        <td>${cell(row.budget_bulan, "Rp")}</td>
        <td>${cell(row.budget_week, "Rp")}</td>
        <td>${cell(row.persentase, "%")}</td>
        <td>${cell(row.final_budget, "Rp")}</td>
        <td>${cell(row.rasio)}</td>
        <td>${cell(row.nominal, "Rp")}</td>
        <td>${cell(row.realisasi_overtime, "Rp")}</td>
        <td>${cell(row.budget_by_ci, "Rp")}</td>
        <td>${cell(row.selisih_budget_fa, "Rp")}</td>
        <td>${cell(row.selisih_budget_ci, "Rp")}</td>
        <td>${cell(row.man_hour, "Jam")}</td>
        <td>${cell(row.bobot, "Jam")}</td>
        <td>${cell(row.rasio_weekly)}</td>
        <td>${cell(row.rasio_average)}</td>

        <td>
          <button class="btn-edit">✏️</button>
          <button class="btn-delete">🗑️</button>
        </td>
      `;

      tr.querySelector(".btn-edit").onclick = () => openEditSales(row, tr);
      tr.querySelector(".btn-delete").onclick = () =>
        deleteSales(row.bulan, row.tahun, row.week_now);

      tableBody.appendChild(tr);
    });
  }

  window.loadSales = loadSales;

  // ================= MODAL =================
  btnOpenModal.onclick = openCreateSales;
  btnCloseModal.onclick = closeSalesModal;
  salesModal.onclick = e => e.target === salesModal && closeSalesModal();

  // ================= SUBMIT =================
  const btnSave = document.getElementById("btnSaveSales");


btnSave.addEventListener("click", async () => {
  calculateSales();

  const weekNow = Number(document.getElementById("week_now").value);
  if (!weekNow || weekNow < 1 || weekNow > 52) {
    showToast("Week NOW tidak valid", "error");
    return;
  }

const payload = {
  week_now: weekNow,
  week_by_month: Number(document.getElementById("weekByMonth").value),

  bulan: document.getElementById("bulan").value,
  tahun: Number(document.getElementById("tahun").value),

  sales_target: Number(document.getElementById("sales_target").value),
  sales_target_week: Number(document.getElementById("sales_target_week").value),
  aktual_gr: Number(document.getElementById("aktual_gr").value),

  persentase: Number(document.getElementById("persentase").value),
  nominal: Number(document.getElementById("nominal").value),

  budget_bulan: Number(document.getElementById("budget_bulan").value),
  budget_week: Number(document.getElementById("budget_week").value),
  final_budget: Number(document.getElementById("final_budget").value),

  rasio: Number(document.getElementById("rasio").value),
  rasio_weekly: Number(document.getElementById("rasio_weekly").value),
  rasio_average: Number(document.getElementById("rasio_average").value),

  realisasi_overtime: Number(document.getElementById("realisasi_overtime").value),
  budget_by_ci: Number(document.getElementById("budget_by_ci").value),
  selisih_budget_fa: Number(document.getElementById("selisih_budget_fa").value),
  selisih_budget_ci: Number(document.getElementById("selisih_budget_ci").value),

  man_hour: Number(document.getElementById("man_hour").value),
  bobot: Number(document.getElementById("bobot").value)
};



  console.log("PAYLOAD:", payload);

  const res = await window.sales.saveMonthly(payload);

  if (!res || res.changes === 0) {
    showToast("Gagal menyimpan", "error");
    return;
  }

  showToast("Data berhasil disimpan", "success");
  document.getElementById("salesModal").classList.remove("active");
  loadSalesByWeek(payload.week_now);
  //loadSalesByWeek(weekNow);

});
}


// ================= HITUNG OTOMATIS =================
function calculateSales() {
  const weekByMonthEl       = document.getElementById("weekByMonth");
  const salesTargetEl       = document.getElementById("sales_target");
  const aktualGREl          = document.getElementById("aktual_gr");
  const budgetBulanEl       = document.getElementById("budget_bulan");
  const realisasiOvertimeEl = document.getElementById("realisasi_overtime");
  const budgetByCIEl        = document.getElementById("budget_by_ci");
  // /const nominal

  const weekByMonth       = num(weekByMonthEl.value) || 0;
  const salesTarget       = num(salesTargetEl.value) || 0;
  const aktualGR          = num(aktualGREl.value) || 0;
  const budgetBulan       = num(budgetBulanEl.value) || 0;
  const realisasiOvertime = Number(realisasiOvertimeEl.value) || 0;
  const budgetByCI        = Number(budgetByCIEl.value) || 0;


  /* ========================= */
  const salesTargetWeek = weekByMonth > 0 ? salesTarget / weekByMonth : 0;
  document.getElementById("sales_target_week").value = salesTargetWeek.toFixed(0);

  const persentaseVal = salesTargetWeek > 0
    ? (aktualGR / salesTargetWeek - 1) * 100
    : 0;

  document.getElementById("persentase").value = persentaseVal.toFixed(2);

  const budgetWeek = weekByMonth > 0 ? budgetBulan / weekByMonth : 0;
  document.getElementById("budget_week").value = budgetWeek.toFixed(0);

  const nominal = budgetWeek * (persentaseVal / 100);
  document.getElementById("nominal").value = nominal.toFixed(2);


  const finalBudget = budgetWeek + nominal;
  document.getElementById("final_budget").value = finalBudget.toFixed();

  const rasioVal = aktualGR > 0 ? finalBudget / aktualGR : 0;
  document.getElementById("rasio").value = rasioVal.toFixed(4);

  document.getElementById("selisih_budget_ci").value =
    (budgetByCI - realisasiOvertime).toFixed(2);

 document.getElementById("selisih_budget_fa").value =
  (finalBudget - realisasiOvertime).toFixed(0);

  const rasioWeekly = aktualGR > 0 ? realisasiOvertime / aktualGR : 0;
  document.getElementById("rasio_weekly").value = rasioWeekly.toFixed(2);
  document.getElementById("rasio_average").value = rasioWeekly.toFixed(2);

  document.getElementById("nominal").value = nominal.toFixed(2);
}

  // ================= HELPERS =================
function getWeeksInMonth(bulan, tahun) {
  const map = {
    januari: 0, februari: 1, maret: 2, april: 3,
    mei: 4, juni: 5, juli: 6, agustus: 7,
    september: 8, oktober: 9, november: 10, desember: 11
  };

  const idx = map[bulan.toLowerCase()];
  if (idx === undefined) return 0;

  const days = new Date(tahun, idx + 1, 0).getDate();
  return Math.ceil(days / 7);
}
function getBusinessWeeksInMonth(month, year) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);

  const weeks = new Set();

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    weeks.add(getBusinessWeekFromDate(d.toISOString().slice(0, 10)));
  }

  return weeks.size;
}



  function openCreateSales() {
    salesForm.reset();
    bulan.disabled = false;
    tahun.disabled = false;
    salesModal.classList.add("active");
  }

function openEditSales(row, tr) {
  isEditingSales = true;
   editingRow = tr;
  salesModal.classList.add("active");

  document.getElementById("weekByMonth").value        = row.week_by_month;
  document.getElementById("sales_target").value       = row.sales_target;
  document.getElementById("sales_target_week").value  = row.sales_target_week;
  document.getElementById("aktual_gr").value          = row.aktual_gr;

  document.getElementById("budget_bulan").value       = row.budget_bulan;
  document.getElementById("budget_week").value        = row.budget_week;
   document.getElementById("week_now").value          = row.week_now;

  document.getElementById("persentase").value         = row.persentase;
  document.getElementById("nominal").value            = row.nominal;
  document.getElementById("final_budget").value       = row.final_budget;

  document.getElementById("rasio").value               = row.rasio;
  document.getElementById("rasio_weekly").value        = row.rasio_weekly;
  document.getElementById("rasio_average").value       = row.rasio_average;

  document.getElementById("realisasi_overtime").value  = row.realisasi_overtime;
  document.getElementById("budget_by_ci").value        = row.budget_by_ci;
  document.getElementById("selisih_budget_fa").value   = row.selisih_budget_fa;
  document.getElementById("selisih_budget_ci").value   = row.selisih_budget_ci;

  document.getElementById("man_hour").value             = row.man_hour;
  document.getElementById("bobot").value                = row.bobot;

  // lock bulan & tahun
  document.getElementById("bulan").value = row.bulan;
  document.getElementById("tahun").value = row.tahun;
  document.getElementById("bulan").disabled = true;
  document.getElementById("tahun").disabled = true;


  calculateSales();
}
async function submitSalesEdit() {
  calculateSales();

  const payload = collectSalesPayload();
  showLoading("Menyimpan perubahan...");

  const res = await window.sales.saveMonthly(payload);

  if (!res || res.changes === 0) {
    showToast("Gagal update", "error");
    return;
  }

  // ================= UPDATE DOM =================
  const cells = editingRow.children;

  cells[0].textContent = payload.bulan;
  cells[1].textContent = payload.tahun;
  cells[2].textContent = payload.week_now;
  cells[3].textContent = payload.week_by_month;

  cells[4].innerHTML = cell(payload.sales_target, "Kg");
  cells[5].innerHTML = cell(payload.sales_target_week, "Kg");
  cells[6].innerHTML = cell(payload.aktual_gr, "Kg");
  cells[7].innerHTML = cell(payload.budget_bulan, "Rp");
  cells[8].innerHTML = cell(payload.budget_week, "Rp");
  cells[9].innerHTML = cell(payload.persentase, "%");
  cells[10].innerHTML = cell(payload.final_budget, "Rp");
  cells[11].innerHTML = cell(payload.rasio);
  cells[12].innerHTML = cell(payload.nominal, "Rp");
  cells[13].innerHTML = cell(payload.realisasi_overtime, "Rp");
  cells[14].innerHTML = cell(payload.budget_by_ci, "Rp");
  cells[15].innerHTML = cell(payload.selisih_budget_fa, "Rp");
  cells[16].innerHTML = cell(payload.selisih_budget_ci, "Rp");
  cells[17].innerHTML = cell(payload.man_hour, "Jam");
  cells[18].innerHTML = cell(payload.bobot, "Jam");
  cells[19].innerHTML = cell(payload.rasio_weekly);
  cells[20].innerHTML = cell(payload.rasio_average);

  // ==============================================

  salesModal.classList.remove("active");
  showToast("Data berhasil diupdate", "success");
  isEditingSales = false;
editingRow = null;

}



function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


  function closeSalesModal() {
    salesModal.classList.remove("active");
    salesForm.reset();
  }
  function closeConfirmModal() {
  document.getElementById("modalOverlay")?.classList.add("hidden");
}


async function deleteSales(bulan, tahun, week_now) {
  openModal({
    title: "Hapus Data",
    message: `Hapus data ${bulan} ${tahun} (Week ${week_now}) ?`,
    onOk: async () => {
      closeConfirmModal();
      showLoading("Menghapus data...");
      await sleep(500);

      try {
        const res = await window.sales.deleteSale({
          bulan,
          tahun,
          week_now
        });

        if (!res || res.changes === 0) {
          hideLoading();
          showToast("Gagal menghapus data", "error");
          return;
        }

        // 🔁 reload hanya week yang sedang dilihat
        await sleep(150);
        await loadSalesByWeek(week_now);

        hideLoading();
        showToast("Data berhasil dihapus", "success");

      } catch (err) {
        console.error(err);
        hideLoading();
        showToast("Terjadi kesalahan saat menghapus data", "error");
      }
    }
  });
}




async function loadSalesByWeek(week) {
  const data = await window.sales.getByWeek(week);
  console.log("DATA WEEK:", week, data); // ✅ lihat data yang dikembalikan
  renderSalesTable(data);
}



function renderSalesTable(data) {
  const tableBody = document.querySelector("#salesTable tbody");
  tableBody.innerHTML = "";

  if (!data || data.length === 0) {
    tableBody.innerHTML =
      `<tr><td colspan="20" style="text-align:center">Belum ada data</td></tr>`;
    return;
  }

  data.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.bulan}</td>
      <td>${row.tahun}</td>
       <td>${row.week_now}</td>
      <td>${row.week_by_month}</td>
      <td>${cell(row.sales_target, "Kg")}</td>
      <td>${cell(row.sales_target_week, "Kg")}</td>
      <td>${cell(row.aktual_gr, "Kg")}</td>
      <td>${cell(row.budget_bulan, "Rp")}</td>
      <td>${cell(row.budget_week, "Rp")}</td>
      <td>${cell(row.persentase, "%")}</td>
      <td>${cell(row.final_budget, "Rp")}</td>
      <td>${cell(row.rasio)}</td>
      <td>${cell(row.nominal, "Rp")}</td>
      <td>${cell(row.realisasi_overtime, "Rp")}</td>
      <td>${cell(row.budget_by_ci, "Rp")}</td>
      <td>${cell(row.selisih_budget_fa, "Rp")}</td>
      <td>${cell(row.selisih_budget_ci, "Rp")}</td>
      <td>${cell(row.man_hour, "Jam")}</td>
      <td>${cell(row.bobot, "Jam")}</td>
      <td>${cell(row.rasio_weekly)}</td>
      <td>${cell(row.rasio_average)}</td>


    <td>
          <button class="btn-edit">✏️</button>
          <button class="btn-delete">🗑️</button>
        </td>
      `;

      tr.querySelector(".btn-edit").onclick = () => openEditSales(row, tr);
      tr.querySelector(".btn-delete").onclick = () =>
        deleteSales(row.bulan, row.tahun, row.week_now);
    tableBody.appendChild(tr);


  });
}


function showToast(message, type = "info", duration = 3000) {
  let container = document.getElementById("toastContainer");

  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;

  // Progress bar
  const bar = document.createElement("div");
  bar.className = "bar";

  const fill = document.createElement("div");
  fill.className = "fill";

  bar.appendChild(fill);
  toast.appendChild(bar);
  container.appendChild(toast);

  // Trigger animasi progress
  requestAnimationFrame(() => {
    fill.style.transitionDuration = duration + "ms";
    fill.style.width = "0%";
  });

  // Auto remove
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity .4s";
    setTimeout(() => toast.remove(), 400);
  }, duration);
}


function showLoading(text = "Menyimpan data...") {
  const overlay = document.getElementById("loadingOverlay");
  overlay.querySelector(".loading-text").textContent = text;
  overlay.classList.remove("hidden");
}

function hideLoading() {
  document.getElementById("loadingOverlay").classList.add("hidden");
}


function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(resolve));
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
function setDashboardTheme(theme) {
  document.body.classList.forEach(cls => {
    if (cls.startsWith("dashboard-")) {
      document.body.classList.remove(cls);
    }
  });

  document.body.classList.add(`dashboard-${theme}`);
  localStorage.setItem("dashboardStyle", theme);
}

document.addEventListener("DOMContentLoaded", () => {
  initSalesRenderer();
});

