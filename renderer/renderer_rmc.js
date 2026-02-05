document.addEventListener("DOMContentLoaded", async () => {
  const year = new Date().getFullYear();
  document.getElementById("rmcYear").textContent = year;
  const valueSpan = document.getElementById("rmcValue");
  const formContainer = document.getElementById("rmcFormContainer");
  const form = document.getElementById("rmcForm");
  const searchInput = document.getElementById("searchInput");
  const searchLoading = document.getElementById("searchLoading");
  const chartModal = document.getElementById("chartModal");
  const closeChartBtn = document.getElementById("closeChartBtn");
  const chartCanvas = document.getElementById("rmcChart");
  const saveChartBtn = document.getElementById("saveChartBtn");

  const aiCharts = { vendor: null, item: null, lokasi: null };

  let allRows = [];
  let currentChart = null;
  let _lastRmcRows = [];

  window.ipcRenderer.send("screen-changed", "rmc");
  window.rmcEvents.onRefresh(() => {
  console.log("🔄 Auto-refresh RMC after PR update");
  updateMenuActiveState();

window.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("visible");
});

  // Panggil fungsi yang biasa dipakai untuk load data RMC
 loadAllRMCData();
 loadRMCSummary();
});


// === HELPERS ===
function formatRupiah(val) {
  return `Rp ${Math.round(val).toLocaleString()}`;
}

function safeNumber(val) {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

// === SUMMARY AI ===
function naturalSummary(rows) {
  const total = rows.length;
  const totalHarga = rows.reduce((sum, r) => sum + safeNumber(r.total_harga), 0);

  const isEmpty = (val) => !val || val.toString().trim() === '-' || val.toString().trim() === '';

  // Hitung jumlah PR/PO
  const noData = rows.filter(r => isEmpty(r.nomor_pr)).length;                 // PR kosong atau '-'
  const noPR   = rows.filter(r => !isEmpty(r.nomor_pr)).length;               // PR valid
  const noPO   = rows.filter(r => !isEmpty(r.nomor_pr) && isEmpty(r.nomor_po)).length; // PR valid tapi PO kosong

  // Hitung top vendor & lokasi
  const countByKey = (key) => {
    const map = {};
    rows.forEach(r => map[r[key] || "Unknown"] = (map[r[key] || "Unknown"] || 0) + 1);
    return map;
  };

  const vendorCount = countByKey('vendor');
  const topVendor = Object.entries(vendorCount).sort((a,b)=>b[1]-a[1])[0] || null;

  const locCount = countByKey('lokasi');
  const topLok = Object.entries(locCount).sort((a,b)=>b[1]-a[1])[0] || null;

  // Item bernilai tinggi
  const avgHarga = total > 0 ? totalHarga / total : 0;
  const highItems = rows
    .filter(r => safeNumber(r.total_harga) > avgHarga * 2)
    .sort((a,b) => safeNumber(b.total_harga) - safeNumber(a.total_harga))
    .slice(0,5);

  // Ringkasan teks
  let text = `Ringkasan singkat: Terdapat ${total} transaksi dengan total nilai sekitar ${formatRupiah(totalHarga)}. `;
  text += `${noData} item tanpa PR, ${noPO} item tanpa PO. `;
  if(topVendor) text += `Vendor terbanyak: ${topVendor[0]} (${topVendor[1]} item). `;
  if(topLok) text += `Lokasi terbanyak: ${topLok[0]} (${topLok[1]} item). `;
  if(highItems.length) text += `Perhatian: item bernilai tinggi termasuk ${highItems.map(i => i.nama_sparepart + " (" + formatRupiah(i.total_harga) + ")").slice(0,3).join(", ")}.`;

  return { text, total, totalHarga, noData, noPR, noPO, topVendor, topLok, highItems };
}

// === BUILD CHART ===
function buildChart(ctx, labels, values, type='bar', options={}) {
  if(!ctx) return null;
  return new Chart(ctx, {
    type,
    data: { labels, datasets:[{ label:'', data: values, backgroundColor:'rgba(54,162,235,0.7)' }] },
    options: Object.assign({
      responsive:true,
      maintainAspectRatio:false,
      plugins:{ legend:{ display:false } },
      scales:{ x:{ display:false }, y:{ display:false } }
    }, options)
  });
}

// === RENDER FUNCTIONS ===
function renderAiSummary(rows) {
  const res = naturalSummary(rows);

  document.getElementById("aiSummaryCard").classList.remove("hidden");
  document.getElementById("aiSummaryText").textContent = res.text;
  document.getElementById("mTotal").textContent = res.total;
  document.getElementById("mValue").textContent = formatRupiah(res.totalHarga);
  document.getElementById("mNoPR").textContent = res.noPR;
  document.getElementById("mNoPO").textContent = res.noPO;
  document.getElementById("mNoDat").textContent = res.noData;

  renderCharts(rows);
  renderDetailTable(rows);
  renderRecommendations(res);
}

function renderCharts(rows) {
  const countByKey = (key) => {
    const map = {};
    rows.forEach(r => map[r[key]||'Unknown'] = (map[r[key]||'Unknown']||0)+1);
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,6);
  }

  const vendors = countByKey('vendor');
  const items = countByKey('nama_sparepart');
  const locs = countByKey('function_location');

  if(aiCharts.vendor) aiCharts.vendor.destroy();
  if(aiCharts.item) aiCharts.item.destroy();
  if(aiCharts.lokasi) aiCharts.lokasi.destroy();

  aiCharts.vendor = buildChart(document.getElementById("aiChartVendor"), vendors.map(v=>v[0]), vendors.map(v=>v[1]));
  aiCharts.item = buildChart(document.getElementById("aiChartItem"), items.map(v=>v[0]), items.map(v=>v[1]));
  aiCharts.lokasi = buildChart(document.getElementById("aiChartLokasi"), locs.map(v=>v[0]), locs.map(v=>v[1]));
}

function renderDetailTable(rows) {
  const tbody = document.querySelector("#aiDetailTable tbody");
  const topRows = rows.slice(0,50);

  tbody.innerHTML = topRows.map(r => `
    <tr class="${safeNumber(r.total_harga) > (rows.reduce((s,r)=>s+safeNumber(r.total_harga),0)/Math.max(rows.length,1))*2 ? 'high-item':''}">
      <td>${r.tanggal||''}</td>
      <td>${r.nomor_material||''}</td>
      <td>${r.nama_sparepart||''}</td>
      <td>${r.quantity||''}</td>
      <td>${formatRupiah(r.total_harga)}</td>
      <td>${r.nomor_pr||''}</td>
      <td>${r.vendor||''}</td>
      <td>${r.lokasi||''}</td>
    </tr>
  `).join('');
}

function renderRecommendations(res) {
  const recEl = document.getElementById("aiRecommendations");
  recEl.innerHTML = '';
  if(res.highItems && res.highItems.length) {
    recEl.innerHTML += `<p><b>Rekomendasi:</b> Periksa PR/PO untuk item bernilai tinggi: ${res.highItems.map(i=>i.nama_sparepart).join(", ")}</p>`;
  }
  if(res.noPR>0) recEl.innerHTML += `<p>Prioritas: lengkapi nomor PR untuk ${res.noPR} item.</p>`;
  if(res.noPO>0) recEl.innerHTML += `<p>Prioritas: lengkapi nomor PO untuk ${res.noPO} item.</p>`;
}

// === EXPORT FUNCTIONS ===
async function exportSummaryCSV(rows) {
  const now = new Date();
  const headerLines = [
    "=".repeat(63),
    `RMC SUMMARY EXPORT`,
    `Tanggal Export : ${now.toLocaleString()}`,
    `Jumlah Data    : ${rows.length}`,
    "=".repeat(63),
    ""
  ].map(l=>`"${l}"`).join("\n");

  const colHeader = ["tanggal","nomor_material","nama_sparepart","quantity","total_harga","nomor_pr","vendor","lokasi"].join(",");

  const csvRows = rows.map(r=>[
    r.tanggal||'',
    r.nomor_material||'',
    (r.nama_sparepart||'').replace(/,/g,';'),
    r.quantity||'',
    r.total_harga||'',
    r.nomor_pr||'',
    (r.vendor||'').replace(/,/g,';'),
    (r.lokasi||'').replace(/,/g,';')
  ].join(",")).join("\n");

  const final = `${headerLines}\n${colHeader}\n${csvRows}`;

  const saved = await window.api.saveFile({
    defaultName:`RMC_SUMMARY_${now.toISOString().slice(0,10)}.csv`,
    content:final,
    filters:[{name:'CSV', extensions:['csv']}]
  });

  if(saved) showToast("Export CSV selesai","success");
}

async function exportSummaryPDF(rows) {
  const now = new Date();
  const html = `
    <html><head><meta charset="utf-8"><title>RMC Summary</title></head><body>
      <h2>RMC Summary - ${now.toLocaleString()}</h2>
      <div>${document.getElementById("aiSummaryText").innerHTML}</div>
      <hr/>
      <table border="1" cellpadding="6" cellspacing="0">
        <thead>
          <tr><th>Tanggal</th><th>No.Material</th><th>Item</th><th>Qty</th><th>Total</th><th>PR</th></tr>
        </thead>
        <tbody>
          ${rows.slice(0,200).map(r=>`
            <tr>
              <td>${r.tanggal||''}</td>
              <td>${r.nomor_material||''}</td>
              <td>${r.nama_sparepart||''}</td>
              <td>${r.quantity||''}</td>
              <td>${formatRupiah(r.total_harga)}</td>
              <td>${r.nomor_pr||''}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </body></html>
  `;

  const saved = await window.api.saveFile({
    defaultName:`RMC_SUMMARY_${now.toISOString().slice(0,10)}.html`,
    content:html,
    filters:[{name:'HTML', extensions:['html','htm']}]
  });

  if(saved) showToast("Export PDF/HTML selesai","success");
}

// === EVENT LISTENERS ===
document.getElementById("btnToggleDetails").addEventListener("click", ()=>{
  document.getElementById("aiDetail").classList.toggle("hidden");
});

document.getElementById("btnExportCsv").addEventListener("click", async ()=>{
  if(!_lastRmcRows.length) return showToast("Tidak ada data untuk diexport","error");
  await exportSummaryCSV(_lastRmcRows);
});

document.getElementById("btnExportPdf").addEventListener("click", async ()=>{
  if(!_lastRmcRows.length) return showToast("Tidak ada data untuk diexport","error");
  await exportSummaryPDF(_lastRmcRows);
});

// === RECEIVE DATA FROM MAIN ===
window.ipcRenderer.on("rmc-data-loaded", (event, rows)=>{
  _lastRmcRows = rows.map(r=>({
    tanggal: r.tanggal,
    nomor_material: r.nomor_material||r.KODE||r.kode||r["No Material"]||r["B"],
    nama_sparepart: r.nama_sparepart||r.ITEM||r["Nama Sparepart"]||r["C"],
    quantity: safeNumber(r.quantity||r.QTY||r.F||r["F"]),
    total_harga: safeNumber(r.total_harga||r.TOTAL||r.I||r.total||0),
    nomor_pr: r.nomor_pr||r.NOMOR_PR||r.PR||r["NO PR"]||r["D"]||'',
    vendor: r.vendor||r.VENDOR||r["Vendor"]||r["D"]||'',
    lokasi: r.lokasi||r.LOKASI||r["LOKASI"]||r["K"]||''
  }));

  renderAiSummary(_lastRmcRows);
});



  // ===== Fungsi Toast =====
window.showToast = function(msg, type = "info", duration = 3000) {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${msg}</span>
    <div class="bar"><div class="fill"></div></div>
  `;

  container.appendChild(toast);

  // Fade-in
  toast.style.opacity = "0";
  toast.style.transition = "opacity 0.3s ease";
  requestAnimationFrame(() => toast.style.opacity = "1");

  // Progress bar animation
  const bar = toast.querySelector(".fill");
  setTimeout(() => {
    bar.style.width = "0%";
    bar.style.transition = `width ${duration}ms linear`;
  }, 50);

  // Auto hide
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, duration);
};


const btnChart = document.getElementById("btnChart");
  if (btnChart) {
    btnChart.addEventListener("click", () => {
      chartModal.classList.remove("hidden");
    });
  }

  // === Tombol Tutup Chart Modal ===
  if (closeChartBtn) {
    closeChartBtn.addEventListener("click", () => {
      chartModal.classList.add("hidden");
      if(currentChart) {
        currentChart.destroy();
        currentChart = null;
      }
    });
  }

  // === Tombol Pilih Chart ===
  const chartButtons = document.querySelectorAll("#chartButtons .modal-btn");
  chartButtons.forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const type = e.target.dataset.type;
      chartModal.classList.remove("hidden");
      document.getElementById("chartTitle").textContent = `Chart ${type}`;

      // Ambil data RMC (contoh dari function AI / ipcRenderer)
      const data = await window.electronAPI.showChart(type);

      if(currentChart) currentChart.destroy();
      const ctx = chartCanvas.getContext("2d");

      const colors = ["#1f77b4","#ff7f0e","#2ca02c","#d62728","#9467bd"];
      const bgColors = data.labels.map((_, i) => colors[i % colors.length]);

      currentChart = new Chart(ctx, {
        type: "bar",
        data: { labels: data.labels, datasets:[{ label: type, data: data.values, backgroundColor:bgColors, borderColor:'#fff', borderWidth:1 }] },
        options: {
          responsive:true,
          plugins: {
            legend:{ labels:{ color:'#fff' } },
            tooltip:{ callbacks:{ label: ctx => `Rp ${ctx.parsed.y.toLocaleString('id-ID')}` } }
          },
          scales: { x:{ ticks:{ color:'#fff' } }, y:{ ticks:{ color:'#fff', callback: val => val.toLocaleString('id-ID') } } }
        }
      });
    });
  });


// Tombol chart
document.querySelectorAll("#chartButtons .modal-btn").forEach(btn => {
  btn.addEventListener("click", async (e) => {
    const type = e.target.dataset.type;
    chartModal.style.display = "flex";
    document.getElementById("chartTitle").textContent = `Chart ${type}`;

    const data = await window.electronAPI.showChart(type);

    if (currentChart) currentChart.destroy();
    const ctx = chartCanvas.getContext("2d");

    // Warna berbeda tiap bar
    const colors = [
      "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
      "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"
    ];
    const bgColors = data.labels.map((_, i) => colors[i % colors.length]);

    currentChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: data.labels,
        datasets: [{
          label: type,
          data: data.values,
          backgroundColor: bgColors,
          borderColor: '#fff',
          borderWidth: 1,
          barThickness: 25,
          maxBarThickness: 35,
          minBarLength: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: '#fff',
              font: { size: 14 },
              generateLabels: chart => {
                const ds = chart.data.datasets[0];
                const total = ds.data.reduce((a,b)=>a+b,0);
                return [{
                  text: `${ds.label} (Total:Rp.${total.toLocaleString('id-ID')})`,
                  fillStyle: ds.backgroundColor[100] || ds.backgroundColor,
                  strokeStyle: '#fff',
                  hidden: false,
                  fontColor: '#fff'
                }];
              }
            }
          },
          tooltip: {
            titleColor: '#fff',
            bodyColor: '#fff',
            backgroundColor: 'rgba(0,0,0,0.7)',
            borderColor: '#fff',
            borderWidth: 1,
            callbacks: {
              label: ctx => `Rp ${ctx.parsed.y.toLocaleString('id-ID')}`
            }
          }
        },
        scales: {
          x: { ticks: { color: '#fff', font: { size: 12 } }, grid: { color: 'rgba(255,255,255,0.1)' } },
          y: { ticks: { color: '#fff', font: { size: 12 }, callback: val => val.toLocaleString('id-ID') }, grid: { color: 'rgba(255,255,255,0.1)' } }
        },
        layout: { padding: 10 }
      }
    });
  });
});

document.addEventListener("DOMContentLoaded", () => {

  window.ipcRenderer.on("rmc-excel-loaded", (event, data) => {
    const modal = document.getElementById("importModal");
    const preview = document.getElementById("excelHeaderPreview");

    modal.classList.remove("hidden");

    preview.innerHTML = `
      <div style="margin-bottom:10px;font-weight:bold;">Header dari File (Baris 2 Kol A–J)</div>
      <table class="styled-table">
        <tr>${data.headers.map(h => `<td>${h}</td>`).join("")}</tr>
      </table>
    `;

    window.loadedExcel = data;
  });

  document.getElementById("btnProcessPR").addEventListener("click", async () => {
    if (!window.loadedExcel) {
      showToast("File belum diload!");
      return;
    }

    const { filePath } = window.loadedExcel;
    const result = await window.api.checkExcelAgainstDB(filePath);

    showResultModal(result);
  });

});

document.getElementById("closeImportModal").addEventListener("click", () => {
  document.getElementById("importModal").classList.add("hidden");
});


// Tombol simpan JPEG
document.getElementById("saveChartBtn").addEventListener("click", async () => {
  if (!currentChart) return;

  // ✅ Ini di dalam async function
  const dataURL = chartCanvas.toDataURL("image/jpeg", 1.0);
  const title = document.getElementById("chartTitle").textContent;
  const category = currentChart.data.datasets[0].label; // misal category dari dataset

  const result = await window.electronAPI.saveChartJPEG(dataURL, title, category);

  if (result.success) {
    showToast(`Chart berhasil disimpan: ${result.path}`, 4000);
  } else {
    showToast("❌ Gagal menyimpan chart", 4000);
  }
});


// === Modal Export ===
 const exportModal = document.getElementById("exportModal");
  const btnExport = document.getElementById("btnExport");
  const closeExportModal = document.getElementById("closeExportModal");

  // Buka modal
  btnExport.addEventListener("click", () => {
    exportModal.classList.remove("hidden");
  });

  // Tutup modal via tombol
  closeExportModal.addEventListener("click", () => {
    exportModal.classList.add("hidden");
  });

  // Tutup modal jika klik area luar konten
  exportModal.addEventListener("click", (e) => {
    if (e.target === exportModal) {
      exportModal.classList.add("hidden");
    }
  });


// Tombol konfirmasi export
document.getElementById("confirmExport").addEventListener("click", async () => {
  const month = document.getElementById("exportMonth").value;
  const category = document.getElementById("exportCategory").value;

  if (!month || !category) {
    showToast("⚠️ Pilih bulan dan kategori sebelum export!", "warning");
    return;
  }

  showToast("⏳ Memproses export...", "info");
  window.electronAPI.exportRMC({ month, category });
});

// Hasil export dari main.js
window.electronAPI.onExportResult((result) => {
//  showToast(result.message, result.success ? "success" : "error");
});

  // ==================== FITUR PENCARIAN DENGAN HIGHLIGHT ====================

  async function loadAllRMCData() {
    searchLoading.style.display = "inline-block";
    allRows = await window.electronAPI.getHistoryRMC();
    searchLoading.style.display = "none";
    renderTable(allRows);
  }
function updateCounters(rows) {
  const totalPR = rows.filter(r => r.nomor_pr && r.nomor_pr.trim() !== "" && r.nomor_pr !== "-").length;
  const totalPO = rows.filter(r => r.nomor_po && r.nomor_po.trim() !== "" && r.nomor_po !== "-").length;
  const totalSertim = rows.filter(r =>
    (!r.nomor_pr || r.nomor_pr.trim() === "" || r.nomor_pr === "-") &&
    (!r.nomor_po || r.nomor_po.trim() === "" || r.nomor_po === "-")
  ).length;

  document.getElementById("countPR").textContent = totalPR;
  document.getElementById("countPO").textContent = totalPO;
  document.getElementById("countSertim").textContent = totalSertim;
}

async function renderTable(rows, keyword = "") {
  const tbody = document.querySelector("#historyRMC tbody");
  if (!rows || rows.length === 0) {
    tbody.innerHTML = "<tr><td colspan='9'>Tidak ada data ditemukan.</td></tr>";
    return;
  }

  const highlightMatch = (text, kw) => {
    if (!kw || !text) return text || "-";
    const safeKw = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${safeKw})`, "gi");
    return text.replace(regex, `<mark class='highlight'>$1</mark>`);
  };

  tbody.innerHTML = rows.map(row => `
    <tr data-id="${row.id}">
      <td>${highlightMatch(row.tanggal || "-", keyword)}</td>
      <td contenteditable="true" data-field="nomor_material">${highlightMatch(row.nomor_material|| "-", keyword)}</td>
      <td>${highlightMatch(row.nama_sparepart || "-", keyword)}</td>
      <td>${highlightMatch(row.vendor || "-", keyword)}</td>
      <td style="text-align:right;">${row.qty || 0}</td>
      <td style="text-align:right;">Rp ${Number(row.harga || 0).toLocaleString("id-ID")}</td>
      <td style="text-align:right;">Rp ${Number(row.total || 0).toLocaleString("id-ID")}</td>
      <td contenteditable="true" data-field="nomor_pr">${highlightMatch(row.nomor_pr || "-", keyword)}</td>
      <td contenteditable="true" data-field="nomor_po">${highlightMatch(row.nomor_po || "-", keyword)}</td>

    </tr>
  `).join("");

  // === Event PR/PO ===
  tbody.querySelectorAll("td[contenteditable]").forEach(cell => {
    cell.addEventListener("blur", async () => {
      const row = cell.closest("tr");
      const id = row.getAttribute("data-id");
      const field = cell.getAttribute("data-field");
      const value = cell.textContent.trim() || "-";

      if (id && field) {
        try {
          await window.electronAPI.updatePRPO({ id, field, value });

          // Sinkronkan data di array utama
          const updatedRow = allRows.find(r => r.id == id);
          if (updatedRow) updatedRow[field] = value;

          // Update tampilan visual
          cell.style.backgroundColor = "#d4edda";
          setTimeout(() => (cell.style.backgroundColor = ""), 600);

          // 🔹 Update counter dan summary tanpa error await
          updateCounters(allRows);
          loadRMCSummary(); // ⚠️ tanpa await — dipanggil async di background

        } catch (err) {
          console.error("❌ Gagal update PR/PO:", err);
          cell.style.backgroundColor = "#f8d7da";
          setTimeout(() => (cell.style.backgroundColor = ""), 800);
        }
      }
    });
  });

  updateCounters(rows);
}

  function filterRMC(keyword) {
    keyword = keyword.trim().toLowerCase();
    if (keyword === "") {
      renderTable(allRows);
      return;
    }

    const filtered = allRows.filter(row =>
      (row.nama_sparepart || "").toLowerCase().includes(keyword) ||
      (row.nomor_material || "").toLowerCase().includes(keyword) ||
      (row.vendor || "").toLowerCase().includes(keyword) ||
      (row.nomor_pr || "").toLowerCase().includes(keyword) ||
      (row.nomor_po || "").toLowerCase().includes(keyword)
    );

    renderTable(filtered, keyword);
  }

  // 🔹 Event pencarian realtime
  let searchTimer = null;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchLoading.style.display = "inline-block";
    searchTimer = setTimeout(() => {
      filterRMC(searchInput.value);
      searchLoading.style.display = "none";
    }, 400);
  });

  // ==================== DASHBOARD STYLE ====================

  const savedStyle = localStorage.getItem("dashboardStyle");
  if (savedStyle) applyDashboardStyle(savedStyle);

  if (window.electronAPI?.onApplyDashboard) {
    window.electronAPI.onApplyDashboard((style) => {
      applyDashboardStyle(style);
      localStorage.setItem("dashboardStyle", style);
    });
  }

  if (window.electronAPI?.onRequestDashboardStyle) {
    window.electronAPI.onRequestDashboardStyle(() => {
      const saved = localStorage.getItem("dashboardStyle");
      if (saved) applyDashboardStyle(saved);
    });
  }

  // ==================== LOAD DATA UTAMA ====================

  async function loadRMC() {
    const rmc = await window.electronAPI.getRMC(year);
    if (rmc && rmc.nominal) {
      valueSpan.textContent = rmc.nominal.toLocaleString("id-ID");
      formContainer.style.display = "none";
    } else {
      valueSpan.textContent = "0";
      formContainer.style.display = "block";
    }
  }
async function loadRMCSummary() {
  try {
    const summary = await window.electronAPI.getRMCSummary();
    if (!summary) return;

    // tampilkan semua nilai
    document.getElementById("prFactoryValue").textContent = summary.totalPRFactory.toLocaleString("id-ID");
    document.getElementById("prPusatValue").textContent = summary.totalPRPusat.toLocaleString("id-ID");
    document.getElementById("outstandingValue").textContent = summary.totalOutstanding.toLocaleString("id-ID");
    document.getElementById("poFactoryValue").textContent = summary.totalPOFactory.toLocaleString("id-ID");
    document.getElementById("poPusatValue").textContent = summary.totalPOPusat.toLocaleString("id-ID");
    document.getElementById("sisaValue").textContent = summary.sisa.toLocaleString("id-ID");

    // progress bar
    const progressBar = document.getElementById("progressBar");
    const progressLabel = document.getElementById("progressLabel");

    if (progressBar && progressLabel) {
      const rmcNominal = summary.rmcNominal || 0;
      const totalPO = summary.totalPOFactory + summary.totalPOPusat;
      const percent = rmcNominal > 0 ? Math.min((totalPO / rmcNominal) * 100, 100) : 0;

      progressBar.style.width = `${percent.toFixed(1)}%`;
      progressLabel.textContent = `${percent.toFixed(1)}%`;

      if (percent < 50)
        progressBar.style.background = "linear-gradient(90deg, #00b09b, #96c93d)";
      else if (percent < 80)
        progressBar.style.background = "linear-gradient(90deg, #f9d423, #ff4e50)";
      else
        progressBar.style.background = "linear-gradient(90deg, #ff4e50, #c31432)";
    }
  } catch (err) {
    console.error("loadRMCSummary error:", err);
  }
}


  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nominal = document.getElementById("rmc_nominal").value;
    if (!nominal) return alert("Nominal Harus diisi");
    await window.electronAPI.saveRMC({ year, nominal });
    showToast("✅ Nominal RMC berhasil disimpan!");
    await loadRMC();
    await loadRMCSummary();
  });

  await loadRMC();
  await loadAllRMCData();
  await loadRMCSummary();
});

// 🔹 Terapkan style dashboard
function applyDashboardStyle(style) {
  const body = document.body;
  body.className = body.className
    .split(" ")
    .filter(c => !c.startsWith("dashboard-"))
    .join(" ")
    .trim();
  body.classList.add(`dashboard-${style}`);
  console.log(`🎨 Style applied: dashboard-${style}`);
}

// === Terima hasil export dari main process ===
window.ipcRenderer.on("export-result", (_, result) => {
  if (result.success) {
    showToast(result.message, "success");
  } else {
    showToast(result.message, "error");
  }
});

function showResultModal(rows) {
  window.currentResultRows = rows;
  const oldModal = document.getElementById("importModal");
  if (oldModal) oldModal.classList.add("hidden");

  const existing = document.getElementById("resultModal");
  if (existing) existing.remove();

  window.currentResultRows = rows;

  const uniqueLokasi = [...new Set(rows.map(r => r.excel.lokasi).filter(Boolean))];

  const html = `
    <div class="modal" id="resultModal">
      <div class="modal-wrapper large">

        <div class="modal-header">
          <span class="modal-title">📊 Hasil Pencocokan PR</span>
          <button class="modal-close-btn close-result-modal">✕</button>
        </div>

        <div class="filter-bar">
          <label>Filter Lokasi:</label>
          <select id="filterLokasi">
            <option value="">Semua Lokasi</option>
            ${uniqueLokasi.map(l => `<option value="${l}">${l}</option>`).join("")}
          </select>

          <button id="btnUpdateAll" class="btn-primary" style="margin-left:auto;">
            🚀 Update Semua Yang Cocok
          </button>
        </div>

        <div class="table-container">
          <table class="styled-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Kode</th>
                <th>Item</th>
                <th>Qty</th>
                <th>PR Excel</th>
                <th>PR DB</th>
                <th>Status</th>
                <th>Lokasi</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody id="resultBody">
              ${buildRows(rows)}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", html);

  // aktifkan tombol
  attachUpdateButtons();
}
// FILTER LOKASI
document.addEventListener("change", (e) => {
  if (e.target.id === "filterLokasi") {

    if (!window.currentResultRows) {
      console.warn("⚠ currentResultRows belum di-set");
      showToast("⚠ currentResultRows belum di-set");
      return;
    }

    const lokasi = e.target.value;
    const filtered = lokasi
      ? window.currentResultRows.filter(r => r.excel.lokasi === lokasi)
      : window.currentResultRows;

    document.getElementById("resultBody").innerHTML = buildRows(filtered);
    attachUpdateButtons();
  }
});


// UPDATE SEMUA
document.addEventListener("click", async (e) => {
  if (e.target.id === "btnUpdateAll") {
    const list = window.currentResultRows.filter(r => r.db && !r.alreadyUpdated);

    for (const r of list) {
      await window.api.updatePRForRecord({
        id: r.db.id,
        pr: r.excel.nomor_pr_excel
      });
    }

    showToast("✓ Semua data yang cocok sudah diupdate!");
    document.getElementById("resultBody").innerHTML = buildRows(window.currentResultRows);
    attachUpdateButtons();
  }
});

// CLOSE MODAL
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("close-result-modal")) {
    const modal = document.getElementById("resultModal");
    if (modal) modal.remove();
  }
});

function attachModalClose() {
  const modal = document.getElementById("resultModal");
  if (!modal) return;

  const closeBtn = modal.querySelector(".close-result-modal");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      modal.remove();
    });
  }
}

// ======================================================
// Fungsi pembuat baris (dengan highlight perbedaan)
// ======================================================
function buildRows(rows) {
  return rows.map((r, i) => {

    const highlightKode   = r.db && r.db.nomor_material !== r.excel.nomor_material;
    const highlightItem   = r.db && r.db.nama_sparepart !== r.excel.nama_sparepart;
    const highlightQty    = r.db && r.db.quantity != r.excel.quantity;
    const highlightPR     = r.db && r.db.nomor_pr !== r.excel.nomor_pr_excel;

    return `
      <tr>
        <td>${i + 1}</td>

        <td class="${highlightKode ? "diff-cell" : ""}">${r.excel.nomor_material}</td>
        <td class="${highlightItem ? "diff-cell" : ""}">${r.excel.nama_sparepart}</td>
        <td class="${highlightQty ? "diff-cell" : ""}">${r.excel.quantity}</td>

        <td>${r.excel.nomor_pr_excel}</td>
        <td class="${highlightPR ? "diff-cell" : ""}">
          ${r.db ? (r.db.nomor_pr || "-") : "-"}
        </td>

        <td>
          ${
            !r.db
            ? `<span style="color:#ff4d4d">✘ Tidak Ketemu</span>`
            : r.alreadyUpdated
              ? `<span style="color:#00ffaa">✔ Sudah Update</span>`
              : `<span style="color:#4dff7a">✔ Cocok</span>`
          }
        </td>
        <td>${r.excel.lokasi || "-"}</td>
        <td>

          ${
            r.db && !r.alreadyUpdated
            ? `<button class="btn-primary btnUpdate" data-id="${r.db.id}" data-pr="${r.excel.nomor_pr_excel}">Update</button>`
            : "-"
          }
        </td>
      </tr>
    `;
  }).join("");
}

// ======================================================
// Pasang ulang semua tombol update
// ======================================================
function attachUpdateButtons() {
  document.querySelectorAll(".btnUpdate").forEach(btn => {
    btn.onclick = async () => {
      await window.api.updatePRForRecord({
        id: btn.dataset.id,
        pr: btn.dataset.pr
      });

      btn.innerText = "✓ Updated";
      btn.disabled = true;

      const row = btn.closest("tr");
      row.querySelector("td:nth-child(7)").innerHTML = `<span style="color:#00ffaa">✔ Sudah Update</span>`;
      showToast("✓ Data Updated");
    };
  });
}

window.ipcRenderer.on("rmc-excel-loaded", (event, payload) => {
  const modal = document.getElementById("importModal");
  modal.classList.remove("hidden");


  // Header & body target
  const headerRow = document.getElementById("previewHeaderRow");
  const body = document.getElementById("previewBodyRows");

  // Safety: bersihkan isi
  headerRow.innerHTML = "";
  body.innerHTML = "";

  const header = payload.header || [];
  const data = payload.data || [];

  // Render header (pastikan jumlah th = jumlah kolom)
  header.forEach(h => {
    const th = document.createElement("th");
    th.textContent = String(h).toUpperCase();
    headerRow.appendChild(th);
  });

  // Kalau header kurang dari jumlah colgroup, tambahkan empty th agar kolom align
  // (opsional) — sesuaikan targetCols dengan jumlah <col> di colgroup.
  const targetCols = document.querySelectorAll("#excelPreviewTable colgroup col").length;
  if (header.length < targetCols) {
    for (let i = header.length; i < targetCols; i++) {
      const th = document.createElement("th");
      th.textContent = "";
      headerRow.appendChild(th);
    }
  }

  // Render data
  data.forEach(row => {
    const tr = document.createElement("tr");
    // pastikan menulis sel sebanyak targetCols untuk jaga alignment
    for (let i = 0; i < targetCols; i++) {
      const td = document.createElement("td");
      td.textContent = row[i] !== undefined && row[i] !== null ? String(row[i]) : "";
      tr.appendChild(td);
    }
    body.appendChild(tr);
  });

  window.loadedExcel = payload;
});



document.getElementById("btnProcessPR").addEventListener("click", async () => {
  const filePath = window.loadedExcel.filePath;
  const result = await window.api.checkExcelAgainstDB(filePath);

  showResultModal(result);
});


window.electronAPI.onToast(({ type, message }) => {
    if (window.showToast) {
        window.showToast(message, type);
    }
});



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
