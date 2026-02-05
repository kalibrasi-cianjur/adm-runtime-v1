// -----------------------------
// State
// -----------------------------
let inventoryRows = [];   // data from DB
let filteredRows = [];    // after search/filter
let excelRows = [];       // loaded Excel rows
let currentPage = 1;
const itemsPerPage = 25;  // max 25 per page
let lastSearchKeyword = "";
let hideNoticeTimer = null;
let hideBadgeTimer = null;
let lastStatus = null;
let previewMode = null;
let syncListenerActive = true;
let inventoryMaster = [];
let exportActive = false;


let syncing = false;
let failCount = 0;
// ================= LOG STATE =================
let logRows = [];
let filteredLogRows = [];

let logPage = 1;
const logPerPage = 20;
let allLogRows = [];      // hasil fetch + filter

const excelModal = document.getElementById("excelModal");
const excelPreview = document.getElementById("excelPreview");
const closeExcelModalBtn = document.getElementById("closeModalBtn");

const modal = document.getElementById("modalFormManual");
const btnSimpan = document.getElementById("simpanManual");
const btn = document.getElementById("inputManualBtn");
const loading = document.getElementById("loadingSimpan");




  window.ipcRenderer.send("screen-changed", "inventory");

//============================export==================//
window.inventoryAPI.onExportProgress(({ percent, label }) => {
  if (!exportActive) return;

  const loadingScreen = q("loadingScreen");
  const bar  = q("loadingBar");
  const text = q("loadingText");

  loadingScreen.classList.remove("hidden");

  if (typeof percent === "number") {
    bar.style.width = percent + "%";
    text.textContent = label
      ? `${percent}% • ${label}`
      : `${percent}%`;
  }

  if (percent >= 100) {
    setTimeout(async () => {
      loadingScreen.classList.add("hidden");
      exportActive = false;
      await reloadFromDBAndRender({ silent: true });
    }, 500);
  }
});
//=============================================================//

window.inventoryAPI.receive("sync-progress", (percent) => {
  if (!syncListenerActive) return; // jika false, abaikan update

  const area = document.getElementById("syncArea");
  const text = document.getElementById("syncText");
  const bar = document.getElementById("syncBar");

  if (percent <= 0) {
    area.classList.add("hidden");
    return;
  }

  area.classList.remove("hidden");
  text.textContent = percent + "%";
  bar.style.width = percent + "%";

  if (percent >= 100) {
    setTimeout(() => area.classList.add("hidden"), 800);
  }
});

// ================= LOG MODAL =================
const logModal = document.getElementById("log-modal");
const logBody  = document.getElementById("logTableBody");

document.getElementById("btnOpenLog").addEventListener("click", async () => {
  logModal.classList.add("active");
  await loadInventoryLogs();
});

document.getElementById("log-modal-close").addEventListener("click", () => {
  logModal.classList.remove("active");
});

// klik backdrop untuk close
logModal.addEventListener("click", e => {
  if (e.target === logModal) {
    logModal.classList.remove("active");
  }
});

// ================= LOAD LOG =================
async function loadInventoryLogs() {
  logTableBody.innerHTML = `
    <tr><td colspan="5">Loading...</td></tr>
  `;

  const res = await window.inventoryAPI.getInventoryLogs(10000); // ambil banyak

  if (!res || !res.ok) {
    logTableBody.innerHTML = `
      <tr><td colspan="5">Gagal memuat log</td></tr>
    `;
    return;
  }

  logRows = res.data;
  filteredLogRows = [...logRows];
  logPage = 1;

  renderLogTable();
}


function renderLogTable() {
  logTableBody.innerHTML = "";

  const total = filteredLogRows.length;
  const totalPages = Math.max(1, Math.ceil(total / logPerPage));

  if (logPage > totalPages) logPage = totalPages;

  const start = (logPage - 1) * logPerPage;
  const pageItems = filteredLogRows.slice(start, start + logPerPage);

  if (pageItems.length === 0) {
    logTableBody.innerHTML = `
      <tr><td colspan="5">Tidak ada data</td></tr>
    `;
  }

  pageItems.forEach(log => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${log.created_at}</td>
      <td class="log-${log.action.toLowerCase()}">${log.action}</td>
      <td>${log.kode}</td>
      <td>${log.detail || "-"}</td>
      <td>${log.source}</td>
    `;

    logTableBody.appendChild(tr);
  });

  // pagination info
  document.getElementById("logPageInfo").textContent =
    `Page ${logPage} / ${totalPages}`;

  document.getElementById("logPrev").disabled = logPage <= 1;
  document.getElementById("logNext").disabled = logPage >= totalPages;
}


document.getElementById("logPrev").onclick = () => {
  if (logPage > 1) {
    logPage--;
    renderLogTable();
  }
};

document.getElementById("logNext").onclick = () => {
  logPage++;
  renderLogTable();
};

document.getElementById("btnFilterLog").addEventListener("click", () => {
  const from = document.getElementById("logDateFrom").value;
  const to = document.getElementById("logDateTo").value;

  filteredLogRows = logRows.filter(log => {
    const d = log.created_at.slice(0, 10); // YYYY-MM-DD

    if (from && d < from) return false;
    if (to && d > to) return false;

    return true;
  });

  logPage = 1;
  renderLogTable();
});

document.getElementById("btnResetLog").addEventListener("click", () => {
  document.getElementById("logDateFrom").value = "";
  document.getElementById("logDateTo").value = "";

  filteredLogRows = [...logRows];
  logPage = 1;
  renderLogTable();
});

function getCurrentLogPageItems() {
  const start = (logPage - 1) * logPerPage;
  return filteredLogRows.slice(start, start + logPerPage);
}

//====================================print logs==============================//
document.getElementById("btnPrintLog").addEventListener("click", () => {
  const rows = getCurrentLogPageItems();

  if (!rows.length) {
    showToast("Tidak ada data untuk diprint", "info");
    return;
  }

  const from = document.getElementById("logDateFrom").value || "Semua";
  const to   = document.getElementById("logDateTo").value || "Semua";
  const printedAt = new Date().toLocaleString("id-ID");

  const tableRows = rows.map(r => `
    <tr>
      <td>${r.created_at}</td>
      <td>${r.action}</td>
      <td>${r.kode}</td>
      <td>${r.detail || "-"}</td>
      <td>${r.source}</td>
    </tr>
  `).join("");

  const win = window.open("", "", "width=900,height=650");

  win.document.write(`
<!DOCTYPE html>
<html>
<head>
<title>Inventory Logs</title>

<style>
  body {
    font-family: Arial, sans-serif;
    padding: 24px;
  }

  /* ===== HEADER ===== */
  .print-header {
    text-align: center;
    margin-bottom: 14px;
  }

  .print-header h3 {
    margin: 0;
  }

  .print-header small {
    opacity: .7;
  }

  /* ===== WATERMARK ===== */
  .watermark {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-30deg);
    font-size: 64px;
    font-weight: bold;
    color: rgba(0,0,0,0.08);
    pointer-events: none;
    user-select: none;
    z-index: 0;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    position: relative;
    z-index: 1;
  }

  th, td {
    border: 1px solid #333;
    padding: 6px 8px;
    font-size: 12px;

    /* ===== AUTO CENTER ===== */
    text-align: center;
    vertical-align: middle;
  }

  th {
    background: #f0f0f0;
    font-weight: bold;
  }

  /* Detail kolom boleh rata kiri */
  td:nth-child(4) {
    text-align: left;
  }
</style>
</head>

<body>

<div class="watermark">1707</div>

<div class="print-header">
  <h3>Inventory Logs</h3>
  <small>
    Periode: ${from} – ${to} <br>
    Page: ${logPage} <br>
    Dicetak: ${printedAt}
  </small>
</div>

<table>
  <thead>
    <tr>
      <th>Waktu</th>
      <th>Aksi</th>
      <th>Kode</th>
      <th>Detail</th>
      <th>Sumber</th>
    </tr>
  </thead>
  <tbody>
    ${tableRows}
  </tbody>
</table>

<script>
  window.onload = () => {
    window.print();
    window.close();
  }
</script>

</body>
</html>
  `);

  win.document.close();
  win.focus();
  win.print();
});
//==========================================================================================//

//======================================================export logs==============================//
document.getElementById("btnExportLogPdf").addEventListener("click", async () => {
  const rows = getCurrentLogPageItems();

  if (!rows.length) {
    showToast("Tidak ada data untuk diexport", "info");
    return;
  }

  const tableRows = rows.map(r => `
    <tr>
      <td>${r.created_at}</td>
      <td>${r.action}</td>
      <td>${r.kode}</td>
      <td>${r.detail || "-"}</td>
      <td>${r.source}</td>
    </tr>
  `).join("");

  const html = `
  <html>
  <head>
    <style>
      body {
        font-family: Arial, sans-serif;
        padding: 24px;
      }
      h3 {
        text-align: center;
        margin-bottom: 4px;
      }
      .meta {
        text-align: center;
        font-size: 11px;
        margin-bottom: 12px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        border: 1px solid #333;
        padding: 6px;
        font-size: 11px;
        text-align: center;
      }
      th {
        background: #eee;
      }
      .watermark {
        position: fixed;
        top: 45%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(-30deg);
        font-size: 48px;
        color: rgba(0,0,0,0.06);
        pointer-events: none;
      }
    </style>
  </head>
  <body>
    <div class="watermark">1707</div>
    <h3>Inventory Logs</h3>
    <div class="meta">
      Dicetak: ${new Date().toLocaleString("id-ID")}
      — Page ${logPage}
    </div>

    <table>
      <thead>
        <tr>
          <th>Waktu</th>
          <th>Aksi</th>
          <th>Kode</th>
          <th>Detail</th>
          <th>Sumber</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  </body>
  </html>
  `;

  const filename = await window.inventoryAPI.getPdfFilename();

  const res = await window.inventoryAPI.exportLogPdf({
    html,
    filename
  });

   if (res?.canceled) {
    showToast("Export dibatalkan", "info");
    return;
  }

  if (res?.ok) {
    showToast("PDF berhasil diexport", "success");
  } else {
    showToast("Gagal export PDF", "error");
  }
});

//==============================================btn export PDF data=============================//

function renderExportTable(data, meta = {}, startPageNumber = 1) {
  const container = document.getElementById("exportContent");
  if (!container) return;
  container.innerHTML = "";

  const ITEMS_PER_PAGE = typeof itemsPerPage === "number" ? itemsPerPage : 25;

  const header = document.createElement("div");
  header.className = "export-header";
  header.innerHTML = `
    <h2>Inventory Material</h2>
    <div class="export-meta">
      Periode: ${meta.range || "-"}<br>
      Dicetak: ${meta.time || "-"}
    </div>
  `;
  container.appendChild(header);

  const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE);

  for (let i = 0; i < totalPages; i++) {
    const pageNo = startPageNumber + i; // nomor watermark mengikuti startPageNumber
    const pageData = data.slice(i * ITEMS_PER_PAGE, (i + 1) * ITEMS_PER_PAGE);

    const page = document.createElement("div");
    page.className = "export-page";

    const watermark = document.createElement("div");
    watermark.className = "export-watermark";
    watermark.textContent = `INVENTORY • PAGE ${pageNo}`;
    page.appendChild(watermark);

    const table = document.createElement("table");
    table.className = "export-table";
    table.innerHTML = `
      <colgroup>
        <col style="width:15%">
        <col style="width:35%">
        <col style="width:15%">
        <col style="width:20%">
        <col style="width:15%">
      </colgroup>
      <thead>
        <tr>
          <th>Kode Material</th>
          <th>Nama Material</th>
          <th>Satuan</th>
          <th>Lokasi</th>
          <th>Jumlah</th>
        </tr>
      </thead>
      <tbody>
        ${pageData.map(row => `
          <tr>
            <td>${row.kode ?? "-"}</td>
            <td>${row.nama_material ?? "-"}</td>
            <td>${row.satuan ?? "-"}</td>
            <td>${row.lokasi ?? "-"}</td>
            <td>${row.Quantity ?? 0}</td>
          </tr>
        `).join("")}
      </tbody>
    `;
    page.appendChild(table);

    if (i === totalPages - 1) {
      const note = document.createElement("div");
      note.className = "export-note";
      note.innerHTML = `
        <strong>Keterangan:</strong><br>
        Dokumen ini dihasilkan secara otomatis oleh sistem Inventory.<br>
        Digunakan untuk keperluan internal perusahaan.
      `;
      page.appendChild(note);
    }

    container.appendChild(page);
  }
}




let epAction = null;

document.getElementById("exportPdfBtn").onclick = () => {
  openEPModal("pdf");
};

document.getElementById("printBtn").onclick = () => {
  openEPModal("print");
};

function openEPModal(type) {
  epAction = type;
  document.getElementById("exportPrintModal").classList.remove("ep-hidden");
}

/*
document.querySelectorAll('input[name="epMode"]').forEach(r => {
  r.onchange = () => {
    const input = document.getElementById("epPageNumber");

    if (r.value === "all") {
      input.value = "";
      input.disabled = true;
      input.placeholder = "";
    }

    if (r.value === "single") {
      input.disabled = false;
      input.placeholder = "Contoh: 3";
    }

    if (r.value === "range") {
      input.disabled = false;
      input.placeholder = "Contoh: 1-4";
    }
  };
});
*/
document.getElementById("epPageNumber").addEventListener("input", e => {
  const v = e.target.value.trim();

  if (!v) {
    document.querySelector('input[value="all"]').checked = true;
  } else if (/^\d+$/.test(v)) {
    document.querySelector('input[value="single"]').checked = true;
  } else if (/^\d+\s*-\s*\d+$/.test(v)) {
    document.querySelector('input[value="single"]').checked = false;
  }
});


document.getElementById("epCancel").onclick = () => {
  document.getElementById("exportPrintModal").classList.add("ep-hidden");
};

document.getElementById("epConfirm").onclick = () => {
  const raw = document.getElementById("epPageNumber").value.trim();
  document.getElementById("exportPrintModal").classList.add("ep-hidden");

  let mode = "all";
  let page = null;

  // ===============================
  // AUTO DETECT (TANPA LIHAT RADIO)
  // ===============================

  // 1️⃣ KOSONG → ALL
  if (!raw) {
    mode = "all";
  }

  // 2️⃣ RANGE (1-4)
  else if (/^\d+\s*-\s*\d+$/.test(raw)) {
    const [s, e] = raw.split("-").map(n => Number(n.trim()));

    if (s < 1 || e < s) {
      showToast("Rentang halaman tidak valid");
      return;
    }

    mode = "range";
    page = { start: s, end: e };
  }

  // 3️⃣ SINGLE (3)
  else if (/^\d+$/.test(raw)) {
    const p = Number(raw);
    if (p < 1) {
      showToast("Nomor halaman tidak valid");
      return;
    }

    mode = "single";
    page = p;
  }

  // 4️⃣ INVALID
  else {
    showToast("Format halaman tidak dikenali");
    return;
  }

  console.log("EXPORT MODE:", mode, page); // DEBUG

  if (epAction === "pdf") {
    handleEPExport(mode, page);
  } else {
    handleEPPrint(mode, page);
  }
};



function getExportData(mode, page) {
  if (mode === "all") {
    return [...filteredRows];
  }

  if (mode === "single") {
    const start = (page - 1) * itemsPerPage;
    return filteredRows.slice(start, start + itemsPerPage);
  }

  if (mode === "range") {
    const start = (page.start - 1) * itemsPerPage;
    const end = page.end * itemsPerPage;
    showToast("Range page belum ditentukan", "error");
    return filteredRows.slice(start, end);
  }

  return [];
}
function nextPaint() {
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    });
  });
}

function validatePageRange(input, totalPages) {
  if (!input) return { valid: false, msg: "Rentang kosong" };

  const match = input.trim().match(/^(\d+)-(\d+)$/);
  if (!match) return { valid: false, msg: "Format harus 1-4" };

  const start = Number(match[1]);
  const end = Number(match[2]);

  if (start < 1) return { valid: false, msg: "Halaman mulai minimal 1" };
  if (end < start) return { valid: false, msg: "Halaman akhir lebih kecil" };
  if (end > totalPages) return { valid: false, msg: `Max halaman ${totalPages}` };

  return { valid: true, start, end };
}


async function handleEPExport(mode, page) {
  const ITEMS_PER_PAGE = typeof itemsPerPage === "number" ? itemsPerPage : 25;

  // ❗ AMBIL SEMUA DATA (JANGAN FILTER DI getExportData)
  const data = getExportData("all");
  const meta = await window.inventoryAPI.getPdfMeta();

  const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE);

  // ===== NORMALISASI PAGE =====
  let startPage = 1;
  let endPage = totalPages;

  if (mode === "single") {
    startPage = Number(page);
    endPage = Number(page);
  }

  if (mode === "range") {
    startPage = Number(page.start);
    endPage = Number(page.end);
  }

  // ===== VALIDASI =====
  if (
    !Number.isInteger(startPage) ||
    !Number.isInteger(endPage) ||
    startPage < 1 ||
    endPage > totalPages ||
    startPage > endPage
  ) {
    showToast("Rentang halaman tidak valid");
    return;
  }

  // ===== RANGE STRING =====
  const range =
    mode === "all"
      ? "ALL"
      : startPage === endPage
        ? `PAGE-${startPage}`
        : `PAGE-${startPage}-${endPage}`;

  // ===== SLICE DATA =====
  const startIndex = (startPage - 1) * ITEMS_PER_PAGE;
  const endIndex = endPage * ITEMS_PER_PAGE;
  const dataSlice = data.slice(startIndex, endIndex);

  // ===== RENDER PREVIEW =====
  renderExportTable(dataSlice, { range, time: meta.time }, startPage);
  document.body.classList.add("printing");

  // Loading
  const pdfLoading = document.getElementById("pdfLoadingScreen");
  if (pdfLoading) pdfLoading.classList.remove("hidden");

  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  // ===== EXPORT PDF =====
  const result = await window.inventoryAPI.exportPDF_READY({ range });

  // Cleanup
  document.body.classList.remove("printing");
  document.getElementById("exportContent").innerHTML = "";
  if (pdfLoading) pdfLoading.classList.add("hidden");

  if (!result.canceled) {
    showToast("PDF berhasil disimpan");
    await new Promise(r => setTimeout(r, 2000));
  }

  window.inventoryAPI.reloadApp();
}



async function handleEPPrint(mode, page) {
  const ITEMS_PER_PAGE = typeof itemsPerPage === "number" ? itemsPerPage : 25;

  // 1️⃣ Ambil semua data
  const data = getExportData("all");
  const meta = await window.inventoryAPI.getPdfMeta();

  const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE);

  // 2️⃣ Normalisasi halaman
  let startPage = 1;
  let endPage = totalPages;

  if (mode === "single") {
    startPage = Number(page);
    endPage = Number(page);
  }

  if (mode === "range") {
    startPage = Number(page.start);
    endPage = Number(page.end);
  }

  // 3️⃣ Validasi
  if (
    !Number.isInteger(startPage) ||
    !Number.isInteger(endPage) ||
    startPage < 1 ||
    endPage > totalPages ||
    startPage > endPage
  ) {
    showToast("Rentang halaman tidak valid");
    return;
  }


  // 4️⃣ Slice data
  const startIndex = (startPage - 1) * ITEMS_PER_PAGE;
  const endIndex = endPage * ITEMS_PER_PAGE;
  const dataSlice = data.slice(startIndex, endIndex);

  const range =
  startPage === 1 && endPage === totalPages
    ? "ALL"
    : startPage === endPage
      ? `PAGE-${startPage}`
      : `PAGE-${startPage}-${endPage}`;


  // 5️⃣ Render preview
renderExportTable(
  dataSlice,
  {
    range,
    time: meta.time
  },
  startPage
);

  document.body.classList.add("printing");

  // Pastikan DOM siap
  await nextPaint();

  // 6️⃣ Panggil print native
  await window.inventoryAPI.printNative();

  // 7️⃣ Cleanup UI
  document.body.classList.remove("printing");
  document.getElementById("exportContent").innerHTML = "";
}



function applyPageFilter(mode, page, pageSize = 20) {
  const rows = document.querySelectorAll("#dataTable tbody tr");
  const currentPage = window.currentPage || 1;

  rows.forEach((row, i) => {
    if (mode === "all") {
      row.style.display = "";
    } else if (mode === "single") {
      row.style.display =
        Math.floor(i / pageSize) + 1 === page ? "" : "none";
    } else {
      row.style.display =
        Math.floor(i / pageSize) + 1 === currentPage ? "" : "none";
    }
  });
}

function resetEPTable() {
  document
    .querySelectorAll("#dataTable tbody tr")
    .forEach(r => (r.style.display = ""));
}



//============================input manual funtion==========================//

async function loadInventoryMaster() {
  inventoryMaster = await window.inventoryAPI.getInventoryMaster();
}

loadInventoryMaster();

// atau refresh setiap modal dibuka
btn.addEventListener("click", async () => {
  await loadInventoryMaster();
  modal.classList.add("active");
});

function forceUppercase(input) {
  if (!input) return;
  input.addEventListener("input", () => {
    input.value = input.value.toUpperCase();
  });
}

// panggil ke input manual
forceUppercase(document.getElementById("kode_barang"));
forceUppercase(document.getElementById("nama_material"));
forceUppercase(document.getElementById("satuan"));
forceUppercase(document.getElementById("lokasi"));
// quantity jangan di uppercase


btnSimpan.addEventListener("click", () => {
  const data = {
    kode: document.getElementById("kode_barang").value.trim().toUpperCase(),
    nama_material: document.getElementById("nama_material").value.trim().toUpperCase(),
    satuan: document.getElementById("satuan").value.trim().toUpperCase(),
    lokasi: document.getElementById("lokasi").value.trim().toUpperCase(),
    quantity: document.getElementById("sap_lokasi").value.trim(),
  };

  if (!data.kode || !data.nama_material || !data.quantity) {
    showToast("Isi semua kolom!!", "info");
    return;
  }

  loading.classList.add("active");
  window.inventoryAPI.saveInventoryManual(data);
});

btn.addEventListener("click", function () {
  modal.classList.add("active");
});

// klik luar modal = tutup
modal.addEventListener("click", function (e) {
  if (e.target === modal) {
    modal.classList.remove("active");

  }
});

const namaInput = document.getElementById("nama_material");
const suggestionBox = document.getElementById("namaSuggestion");

namaInput.addEventListener("input", () => {
  const keyword = namaInput.value.toUpperCase().trim();
  suggestionBox.innerHTML = "";

  if (keyword.length < 2) {
    suggestionBox.style.display = "none";
    return;
  }

  const matches = inventoryMaster
    .filter(r => r.nama_material?.includes(keyword))
    .slice(0, 8);

  if (!matches.length) {
    suggestionBox.style.display = "none";
    return;
  }

  matches.forEach(row => {
    const div = document.createElement("div");
    div.className = "suggestion-item";
    div.textContent = row.nama_material;

    div.addEventListener("click", () => {
      namaInput.value = row.nama_material;
      document.getElementById("satuan").value = row.satuan || "";
      document.getElementById("lokasi").value = row.lokasi || "";
      suggestionBox.style.display = "none";
    });

    suggestionBox.appendChild(div);
  });

  suggestionBox.style.display = "block";
});

  //==============================================================================//

// === OPEN FILE ===
document.getElementById("openFile").addEventListener("click", async () => {
  try {
    // 1. pilih file
    const filePath = await window.inventoryAPI.openFileDialog();
    if (!filePath) {
      showToast("Tidak ada file dipilih", "info");
      return;
    }

    // 2. baca excel
    const res = await window.inventoryAPI.readExcel(filePath);
    if (!res || !res.ok || !Array.isArray(res.data)) {
      showToast("File Excel tidak valid", "error");
      return;
    }

    // 3. MAP data excel → format internal
    excelRows = res.data.map(row => {
      const pick = (keys) => {
        for (const k of Object.keys(row)) {
          const low = k.toLowerCase().trim();
          if (keys.includes(low)) return row[k];
        }
        return "";
      };

      return {
        kode: pick(["kode"]),
        nama_material: pick(["nama material", "nama", "nama_material"]),
        satuan: pick(["sat", "satuan"]),
        lokasi: pick(["lokasi"]),
        Quantity: Number(pick(["sap", "qty", "quantity"]) || 0),
        last_update: row.last_update
      };
    });

    // 4. tampilkan preview
    showExcelPreview(excelRows);

  } catch (err) {
    console.error(err);
    showToast("Gagal membaca file Excel", "error");
  }
});


async function autoSync() {
  if (syncing) return; // ⛔ cegah overlap
  syncing = true;

  try {
    const online = await window.inventoryAPI.checkSupabase();

    if (online) {
      console.log("🌐 Online → Incremental Sync...");
      await window.inventoryAPI.incrementalSync();
      failCount = 0; // reset jika sukses
    } else {
      failCount++;
      console.log(`🔌 Offline (${failCount}) → skip sync`);
    }

  } catch (err) {
    failCount++;
    console.warn("⚠️ Sync error:", err.message);
  } finally {
    syncing = false;

    // ⏱️ adaptive delay
    const delay = failCount >= 3 ? 30000 : 15000;
    setTimeout(autoSync, delay);
  }
}

autoSync();



// === RENDER EXCEL PREVIEW TO MODAL ===
// ===== Fungsi tampilkan preview Excel =====
function showExcelPreview(rows) {
  if (!rows || !rows.length) {
    excelPreview.innerHTML = "<p>Tidak ada data</p>";
    return;
  }

  let html = `
    <table>
      <thead>
        <tr>
          <th>No</th>
          <th>Kode</th>
          <th>Nama Material</th>
          <th>Satuan</th>
          <th>Lokasi</th>
          <th>Qty</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((r, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${r.kode}</td>
            <td>${r.nama_material}</td>
            <td>${r.satuan}</td>
            <td>${r.lokasi}</td>
            <td>${r.Quantity}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  excelPreview.innerHTML = html;
  excelModal.classList.add("show");
    const exportBtn = document.getElementById("exportModalAllBtn");
  if (exportBtn && !exportBtn.dataset.listener) {
    exportBtn.addEventListener("click", async () => {
      await exportAllWithLoading("modal");
    });
    exportBtn.dataset.listener = "true"; // tanda listener sudah dipasang
  }
}


// ===== Tutup modal =====
closeExcelModalBtn.addEventListener("click", () => {
  excelModal.classList.remove("show");
});

// ===== Klik di luar modal untuk tutup =====
excelModal.addEventListener("click", (e) => {
  if (e.target === excelModal) excelModal.classList.remove("show");
});

function disableSyncBar() {
  syncListenerActive = false;
  const syncArea = document.getElementById("syncArea");
  if (syncArea) syncArea.classList.add("hidden");
}

function enableSyncBar() {
  syncListenerActive = true;
}

// ===============================
// LOADING MODAL CONTROLLER
// ===============================
function showLoadingModal() {
  const loadingScreen = document.getElementById("loadingScreen");
  const loadingBar = document.getElementById("loadingBar");
  const loadingText = document.getElementById("loadingText");

  if (!loadingScreen) return;

  loadingBar.style.width = "0%";
  loadingText.textContent = "0%";
  loadingScreen.classList.remove("hidden");
}

function hideLoadingModal() {
  const loadingScreen = document.getElementById("loadingScreen");
  if (loadingScreen) loadingScreen.classList.add("hidden");
}

function updateLoading(percent) {
  const loadingBar = document.getElementById("loadingBar");
  const loadingText = document.getElementById("loadingText");

  if (!loadingBar || !loadingText) return;

  loadingBar.style.width = percent + "%";
  loadingText.textContent = percent + "%";
}


async function exportAllWithLoading(source = "modal") {
  const data = inventoryRows.length ? inventoryRows : excelRows;
  if (!data.length) {
    showToast("Tidak ada data", "info");
    return;
  }

  exportActive = true;
  disableSyncBar()

  if (source === "modal") excelModal?.classList.remove("show");

  // matikan sync bar atas
  q("syncArea")?.classList.add("hidden");

  // reset loading
  q("loadingScreen").classList.remove("hidden");
  q("loadingBar").style.width = "0%";
  q("loadingText").textContent = "0%";

  await window.inventoryAPI.exportAll(
    data.map(r => ({
      kode: r.kode,
      nama_material: r.nama_material,
      satuan: r.satuan,
      lokasi: r.lokasi,
      Quantity: Number(r.Quantity) || 0,
      last_update: new Date().toISOString()
    }))
  );
}




// ===== Event tombol Export Semua =====
q("exportAllBtn")?.addEventListener("click", () => exportAllWithLoading("main"));
q("exportModalAllBtn")?.addEventListener("click",() => exportAllWithLoading("modal"));


// ------------------------------------------------------
// SUPABASE
//------------------------------------------------------
async function checkSupabaseStatus() {
  const isOnline = await window.inventoryAPI.getSupabaseStatus();

  const badge = document.getElementById("statusBadge");
  const notice = document.getElementById("offlineNotice");
  if (!badge || !notice) return;

  // jika status tidak berubah, hentikan
  if (lastStatus === isOnline) return;
  lastStatus = isOnline;

  // clear timer lama
  clearTimeout(hideNoticeTimer);
  clearTimeout(hideBadgeTimer);

  if (isOnline) {
    /* ===== ONLINE ===== */
    badge.classList.remove("offline");
    badge.classList.add("online");
    badge.textContent = "Online";
    badge.style.display = "inline-flex"; // tampil dulu

    // ⏱️ hilangkan badge & notifikasi setelah 3 detik
    hideBadgeTimer = setTimeout(() => {
      badge.style.display = "none";
    }, 3000);

    hideNoticeTimer = setTimeout(() => {
      notice.classList.remove("show");
      notice.classList.add("hidden");
      setTimeout(() => {
        notice.style.display = "none";
      }, 400);
    }, 3000);

  } else {
    /* ===== OFFLINE ===== */
    badge.style.display = "inline-flex";
    badge.classList.remove("online");
    badge.classList.add("offline");
    badge.textContent = "Offline";

    notice.style.display = "block";
    notice.classList.remove("hidden");
    void notice.offsetWidth;
    notice.classList.add("show");
  }
}

// cek setiap 10 detik
setInterval(checkSupabaseStatus, 10000);
checkSupabaseStatus();

// ------------------------------------------------------
// TOAST
//------------------------------------------------------
function showToast(message, type = "info", duration = 3000) {
    const container = document.getElementById("toastContainer");

    const toast = document.createElement("div");
    toast.className = "toast " + type;
    toast.innerText = message;

    container.appendChild(toast);

    // Hilang otomatis
    setTimeout(() => {
        toast.style.animation = "fadeOut 0.4s forwards";
        setTimeout(() => toast.remove(), 400);
    }, duration);
}


// -----------------------------
// Helpers
// -----------------------------
function q(id) { return document.getElementById(id); }

function formatCell(v) { return (v === null || v === undefined) ? "" : String(v); }

function highlightHTML(text, keyword) {
  if (!keyword) return escapeHtml(text);
  const re = new RegExp(`(${escapeRegExp(keyword)})`, "gi");
  return escapeHtml(text).replace(re, '<span class="highlight">$1</span>');
}
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function confirmDialog(message, title = "Konfirmasi") {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirmModal");
    const msg = document.getElementById("confirmMessage");
    const ttl = document.getElementById("confirmTitle");
    const btnOk = document.getElementById("confirmOk");
    const btnCancel = document.getElementById("confirmCancel");

    ttl.textContent = title;
    msg.textContent = message;

    modal.classList.add("active");

    const close = (result) => {
      modal.classList.remove("active");
      btnOk.onclick = null;
      btnCancel.onclick = null;
      resolve(result);
    };

    btnOk.onclick = () => close(true);
    btnCancel.onclick = () => close(false);

    // klik luar modal = batal
    modal.onclick = (e) => {
      if (e.target === modal) close(false);
    };
  });
}



// -----------------------------
// Render inventory table (single source of truth)
// -----------------------------
function renderTable() {
  const tbody = q("tableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  filteredRows = filteredRows || [];

  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * itemsPerPage;
  const pageItems = filteredRows.slice(start, start + itemsPerPage);

  pageItems.forEach((row, idx) => {
    const tr = document.createElement("tr");

    const no = start + idx + 1;
    const kode = formatCell(row.kode);
    const nama = formatCell(row.nama_material);
    const satuan = formatCell(row.satuan);
    const lokasi = formatCell(row.lokasi);
    const qty = formatCell(row.Quantity);

    tr.innerHTML = `
      <td>${no}</td>
      <td class="col-kode">${highlightHTML(kode, lastSearchKeyword)}</td>
      <td>${highlightHTML(nama, lastSearchKeyword)}</td>
      <td>${highlightHTML(satuan, lastSearchKeyword)}</td>
      <td>${highlightHTML(lokasi, lastSearchKeyword)}</td>
      <td>${highlightHTML(qty, lastSearchKeyword)}</td>
      <td class="actions-cell"></td>
      <td class="edit-cell"></td>
    `;

    /* ================= EXPORT COLUMN ================= */
    const actionsTd = tr.querySelector(".actions-cell");

    if (Number(row.exported) === 1) {
      const span = document.createElement("span");
      span.className = "exported-label";
      span.textContent = "✔ Data Sudah di Export";
      actionsTd.appendChild(span);
    } else {
      const btnExport = document.createElement("button");
      btnExport.className = "action-btn";
      btnExport.textContent = "Export";

      btnExport.addEventListener("click", async () => {
        btnExport.disabled = true;
        btnExport.textContent = "Exporting...";

        const payload = {
          kode: row.kode ?? null,
          nama_material: row.nama_material ?? "",
          satuan: row.satuan ?? "",
          lokasi: row.lokasi ?? "",
          Quantity: Number(row.Quantity) || 0
        };

        const res = await window.inventoryAPI.exportOne(payload);

        if (res && res.ok) {
          const i = inventoryRows.findIndex(r => r.kode === row.kode);
          if (i !== -1) inventoryRows[i].exported = 1;

          filteredRows = [...inventoryRows];
          renderTable();
          showToast(`Data ${row.kode} berhasil di-export`, "success");
        } else {
          btnExport.disabled = false;
          btnExport.textContent = "Export";
          showToast("Gagal export: " + (res?.error || "unknown"), "error");
        }
      });

      actionsTd.appendChild(btnExport);
    }

    /* ================= EDIT & DELETE ================= */
    const editTd = tr.querySelector(".edit-cell");

    // ===== EDIT =====
    const btnEdit = document.createElement("button");
    btnEdit.className = "edit-btn";
    btnEdit.textContent = "Edit";

    btnEdit.addEventListener("click", () => {
      document.getElementById("kode_barang").value = row.kode;
      document.getElementById("nama_material").value = row.nama_material;
      document.getElementById("satuan").value = row.satuan;
      document.getElementById("lokasi").value = row.lokasi;
      document.getElementById("sap_lokasi").value = row.Quantity;

      // kode tidak boleh diubah saat edit
      document.getElementById("kode_barang").readOnly = true;

      modal.classList.add("active");
    });

    // ===== DELETE =====
    const btnDelete = document.createElement("button");
    btnDelete.className = "delete-btn";
    btnDelete.textContent = "Delete";

  btnDelete.addEventListener("click", async () => {
  const ok = await confirmDialog(
    `Hapus item dengan kode ${row.kode}?`,
    "Hapus Data"
  );
  if (!ok) return;

  btnDelete.disabled = true;
  btnDelete.textContent = "Deleting...";

  const res = await window.inventoryAPI.deleteInventory(row.kode);

  if (res && res.ok) {
    inventoryRows = inventoryRows.filter(r => r.kode !== row.kode);
    filteredRows = filteredRows.filter(r => r.kode !== row.kode);

    renderTable();
    showToast(`Item ${row.kode} berhasil dihapus`, "success");
  } else {
    btnDelete.disabled = false;
    btnDelete.textContent = "Delete";
    showToast("Gagal hapus: " + (res?.error || "unknown"), "error");
  }
});


    editTd.appendChild(btnEdit);
    editTd.appendChild(btnDelete);

    tbody.appendChild(tr);
  });

  /* ================= PAGINATION ================= */
  q("pageInfo").textContent = `Page ${currentPage} of ${totalPages}`;
  q("prevPage").disabled = currentPage <= 1;
  q("nextPage").disabled = currentPage >= totalPages;
}

// -----------------------------
// Search / Filter
// -----------------------------
function applySearch() {
  const qv = q("searchInput") ? q("searchInput").value.trim().toLowerCase() : "";
  lastSearchKeyword = qv;

  if (!qv) {
    filteredRows = [...inventoryRows];
  } else {
    filteredRows = inventoryRows.filter(r => {
      return (
        (r.kode && String(r.kode).toLowerCase().includes(qv)) ||
        (r.nama_material && String(r.nama_material).toLowerCase().includes(qv)) ||
        (r.satuan && String(r.satuan).toLowerCase().includes(qv)) ||
        (r.lokasi && String(r.lokasi).toLowerCase().includes(qv)) ||
        (String(r.Quantity || "").toLowerCase().includes(qv))
      );
    });
  }
  currentPage = 1;
  renderTable();
}

// -----------------------------
// Load & reload helpers
// -----------------------------
async function reloadFromDBAndRender({ silent = false } = {}) {
  try {
    const rows = await window.inventoryAPI.loadInventory();

    inventoryRows = Array.isArray(rows) ? rows : [];
    filteredRows = [...inventoryRows];
    currentPage = 1;

    renderTable();

    if (!silent) {
      showToast("Data diperbarui", "success");
    }
  } catch (err) {
    console.error("Reload DB error:", err);
    showToast("Gagal memuat DB");
  }
}


// -----------------------------
// Initial load
// -----------------------------
document.addEventListener("DOMContentLoaded", () => {
  // wire events (safe with optional chaining)
  q("searchInput")?.addEventListener("input", applySearch);
  q("clearSearchBtn")?.addEventListener("click", () => {
    if (q("searchInput")) q("searchInput").value = "";
    lastSearchKeyword = "";
    filteredRows = [...inventoryRows];
    currentPage = 1;
    renderTable();
  });

  q("prevPage")?.addEventListener("click", () => {
    if (currentPage > 1) { currentPage--; renderTable(); }
  });
  q("nextPage")?.addEventListener("click", () => {
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / itemsPerPage));
    if (currentPage < totalPages) { currentPage++; renderTable(); }
  });

  // load initial DB
  reloadFromDBAndRender();
});

// -----------------------------
// Excel load, compare, save, export all
// -----------------------------



q("saveFile")?.addEventListener("click", async () => {
  if (!excelRows.length) return showToast("Load Excel dulu!");

  const res = await window.inventoryAPI.saveToDB(excelRows);

  if (res?.ok) {
    showToast("Data Excel disimpan ke DB", "success");

    excelRows = []; // bersihkan excel state
    excelModal.classList.remove("show");

    await reloadFromDBAndRender(); // ⬅️ REFRESH TABEL
  } else {
    showToast("Gagal menyimpan data", "error");
  }
});



// -----------------------------
// Compare Excel vs DB & diff modal
// -----------------------------
q("checkDiffBtn")?.addEventListener("click", async () => {
  try {
    if (!excelRows || !excelRows.length) {
      // allow loading first if not loaded
      const filePath = await window.inventoryAPI.openFileDialog();
      if (!filePath) return showToast("Tidak ada file dipilih!");
      const res = await window.inventoryAPI.readExcel(filePath);
      if (!res || !res.ok || !Array.isArray(res.data)) return showToast("File Excel tidak valid!", "warn");
      excelRows = res.data.map(r => ({
        kode: r.KODE ?? r.Kode ?? r.kode ?? "",
        nama_material: r["NAMA MATERIAL"] ?? r.Nama ?? r.nama_material ?? "",
        satuan: r.SAT ?? r.satuan ?? "",
        lokasi: r.LOKASI ?? r.lokasi ?? "",
        Quantity: Number(r.SAP ?? r.QTY ?? r.Quantity ?? 0),
       last_update: new Date().toISOString()

      }));
    }

    const db = inventoryRows || [];
    const ex = excelRows || [];

    const dbMap = new Map(db.map(r => [String(r.kode).trim(), r]));
    const exMap = new Map(ex.map(r => [String(r.kode).trim(), r]));

    const inExcelNotDB = ex.filter(r => {
      const k = String(r.kode).trim();
      return k && !dbMap.has(k);
    });
    const inDBNotExcel = db.filter(r => {
      const k = String(r.kode).trim();
      return k && !exMap.has(k);
    });

    // show modal compare (reuse compareModal elements if present)
    // We'll build a simple HTML list inside compareModal (compareModal from your HTML)
    const compareModalEl = q("compareModal");
    if (!compareModalEl) {
      // fallback alert
      showToast(`Excel→DB missing: ${inExcelNotDB.length}\nDB→Excel missing: ${inDBNotExcel.length}`);
      return;
    }

    // build HTML
    const buildTable = (rows, columns) => {
      if (!rows || rows.length === 0) return "<p>(Tidak ada)</p>";
      const head = `<tr>${columns.map(c=>`<th>${escapeHtml(c)}</th>`).join("")}</tr>`;
      const body = rows.slice(0, 200).map((r, i) =>
        `<tr>${columns.map(c=>`<td>${escapeHtml(String(r[c] ?? ""))}</td>`).join("")}</tr>`
      ).join("");
      return `<table style="width:100%;border-collapse:collapse"><thead>${head}</thead><tbody>${body}</tbody></table>`;
    };

    const html = `
      <div style="max-height:60vh;overflow:auto">
        <h3>Data di EXCEL tapi tidak ada di DATABASE (${inExcelNotDB.length})</h3>
        ${buildTable(inExcelNotDB, ["kode","nama_material","satuan","lokasi","Quantity"])}

        <h3 style="margin-top:12px">Data di DATABASE tapi tidak ada di EXCEL (${inDBNotExcel.length})</h3>
        ${buildTable(inDBNotExcel, ["kode","nama_material","satuan","lokasi","Quantity"])}
      </div>
    `;

    // put into modal body (use modalTableBody if exists, otherwise use compareModal's children)
    const modalTableBody = q("modalTableBody");
    if (modalTableBody) {
      modalTableBody.innerHTML = html;
      compareModal.classList.add("show");
      compareModal.style.display = "flex";
    } else {
      // fallback: show in compareModal innerHTML
      compareModalEl.innerHTML = `<div style="background:#fff;padding:16px;border-radius:8px;max-width:90%;max-height:80vh;overflow:auto">${html}<div style="text-align:right;margin-top:10px"><button id="closeCompareModalBtn">Tutup</button></div></div>`;
      compareModalEl.style.display = "flex";
      const closeBtn = q("closeCompareModalBtn");
      if (closeBtn) closeBtn.addEventListener("click", () => compareModalEl.style.display = "none");
    }

  } catch (e) {
    console.error(e);
    showToast("Error saat membandingkan data." , "error");
  }
});

// close compare modal (if using compareModal with closeModalBtn)
q("closeModalBtn")?.addEventListener("click", () => {
  const el = q("compareModal");
  if (el) { el.classList.remove("show"); el.style.display = "none"; }
});

// -----------------------------
// Duplicate modal helpers (DB & Excel) - if you added those modals
// -----------------------------
function showDuplicateModal(modalId, rows, bodyId, paginationId) {
  const modal = q(modalId);
  const body = q(bodyId);
  const pagination = q(paginationId);
  if (!modal || !body) return;

  let page = 1;
  const size = 20;

  function render() {
    const start = (page - 1) * size;
    const segment = rows.slice(start, start + size);
    body.innerHTML = "";
    segment.forEach((r, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${start + i + 1}</td>
        <td>${escapeHtml(String(r.kode ?? ""))}</td>
        <td>${escapeHtml(String(r.nama_material ?? ""))}</td>
        <td>${escapeHtml(String(r.satuan ?? ""))}</td>
        <td>${escapeHtml(String(r.lokasi ?? ""))}</td>
        <td>${escapeHtml(String(r.Quantity ?? ""))}</td>
      `;
      body.appendChild(tr);
    });

    if (pagination) {
      pagination.innerHTML = "";
      const total = Math.ceil(rows.length / size) || 1;
      for (let i = 1; i <= total; i++) {
        const btn = document.createElement("button");
        btn.textContent = i;
        btn.className = (i === page ? "active" : "");
        btn.addEventListener("click", () => { page = i; render(); });
        pagination.appendChild(btn);
      }
    }
  }

  render();
  modal.classList.add("show");
  modal.style.display = "flex";
}

// wire show db/excel dup modal if you used previous functions
function showDbDuplicateModal(rows) {
  showDuplicateModal("dbDuplicateModal", rows, "dbDupBody", "dbDupPagination");
}
function showExcelDuplicateModal(rows) {
  showDuplicateModal("excelDuplicateModal", rows, "excelDupBody", "excelDupPagination");
}

// close handlers for those modals
q("closeDbDup")?.addEventListener("click", () => {
  const m = q("dbDuplicateModal"); if (m) { m.classList.remove("show"); m.style.display = "none"; }
});
q("closeExcelDup")?.addEventListener("click", () => {
  const m = q("excelDuplicateModal"); if (m) { m.classList.remove("show"); m.style.display = "none"; }
});

// -----------------------------
// Utility: reload DB when main tells us (optional API)
// If your main sends "inventory:setData" you can listen like this:
if (window.inventoryAPI && typeof window.inventoryAPI.onSetData === "function") {
  window.inventoryAPI.onSetData((data) => {
    inventoryRows = Array.isArray(data) ? data : [];
    filteredRows = [...inventoryRows];
    currentPage = 1;
    renderTable();
  });
}



//=================================================AI=============================================//
function buildLogSummaryPayload(rows) {
  return rows.map(r => ({
    waktu: r.created_at,
    aksi: r.action,
    kode: r.kode,
    sumber: r.source
  }));
}




async function generateLogAISummary() {
  const rows = getCurrentLogPageItems();

  if (!rows.length) {
    showToast("Tidak ada data untuk dianalisa", "info");
    return;
  }

  const res = await window.inventoryAPI.aiSummary({
    logs: rows,
    page: logPage
  });

  if (!res.ok) {
    showToast(res.error, "error");
    return;
  }

  document.getElementById("aiSummaryBox").textContent = res.summary;
}



document
  .getElementById("btnAISummary")
  .addEventListener("click", generateLogAISummary);









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

window.inventoryAPI.onSaveResult((result) => {
  loading.classList.remove("active");

  if (result.success) {
    // 🔥 TAMBAHKAN KE ARRAY
    const idx = inventoryRows.findIndex(r => r.kode === result.data.kode);

    if (idx !== -1) {
      inventoryRows[idx] = result.data; // update
    } else {
      inventoryRows.unshift(result.data); // insert baru
    }

    filteredRows = [...inventoryRows];
    renderTable(); // ⬅️ INI YANG MEMBUAT LANGSUNG MUNCUL

    modal.classList.remove("active");
    document.querySelectorAll("#modalFormManual input").forEach(i => i.value = "");

    showToast("Data berhasil disimpan", "success");
  } else {
    showToast("Gagal menyimpan data: " + result.message);
  }
});

