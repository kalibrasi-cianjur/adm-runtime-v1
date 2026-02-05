const tanggalEl = document.getElementById("tanggal");
const weekEl = document.getElementById("week");
const materialInput = document.getElementById("nomor_material");
const namaInput     = document.getElementById("nama_sparepart");
const materialTooltip = document.getElementById("materialTooltip");
let isVisitorMode = false;
let weekOffset = 0;
let monthOffset = 0;
let isRenderingChart = false;

let isSavingLocation = false;

let materialTimer = null;
let timer = null;

window.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("visible");
});

window.ipcRenderer.send("screen-changed", "purchase");

if (window.electronAPI) {
  window.electronAPI.onToast(({ type, message }) => {
    if (window.showToast) {
      window.showToast(message, type);
    } else {
      console.warn("⚠ showToast tidak ditemukan di halaman Purchase");
    }
  });
}


document.addEventListener("DOMContentLoaded", () => {

  const deptCard = document.querySelector(".department-card");
  const deptFormContainer = document.getElementById("deptFormContainer");

  async function loadDepartmentState() {
    const list = await window.departmentAPI.getAll();

    // Jika sudah ada department → hide seluruh card
    if (list.length > 0) {
      deptCard.classList.add("hidden");
    } else {
      deptCard.classList.remove("hidden");
    }
  }

  // Simpan department
  document.getElementById("btnDeptSave").onclick = async () => {
    const kode = document.getElementById("factKode").value.trim();
    const nama = document.getElementById("deptNama").value.trim();

    if (!kode || !nama) {
      showToast("⚠ Kode dan Nama wajib diisi!", "error");
      return;
    }

    await window.departmentAPI.add({ kode, nama });

    showToast("✓ Department berhasil disimpan!", "success");

    // setelah save → hide card
    deptCard.classList.add("hidden");
  };

  loadDepartmentState();
});

document.getElementById("loadMasterBtn").addEventListener("click", async () => {
  const result = await window.api.importMasterKode();

  if (result?.success) {
   // showToast(`✅ Master berhasil diimport (${result.total} data)`);
    loadMasterTable();
  } else {
    showToast("❌ Import dibatalkan atau gagal");
  }
});

function fillForm(d) {
  if (d.kode) setValue("nomor_material", d.kode);
  if (d.material) setValue("nama_sparepart", d.material);
  if (d.vendor) setValue("vendor", d.vendor);
  if (d.harga_satuan) setValue("harga_satuan", d.harga_satuan);
  if (d.function_location) setValue("function_location", d.function_location);
  if (d.sub_location) setValue("sub_location", d.sub_location);
}

function showOptions(list) {
  const box = document.getElementById("resultOptions");
  box.innerHTML = "";
  box.classList.add("show");

  list.forEach(d => {
    const div = document.createElement("div");
    div.className = "option-item";
    div.textContent = `${d.kode} — ${d.material} (${d.source})`;

    div.onclick = () => {
      fillForm(d);
      box.classList.remove("show");
    };

    box.appendChild(div);
  });
}


function clearSparepartFields() {
  setValue("nama_sparepart", "");
  setValue("vendor", "");
  setValue("harga_satuan", "");
  setValue("function_location", "");
  setValue("sub_location", "");

  hideTooltip();

  const box = document.getElementById("resultOptions");
  if (box) box.classList.remove("show");
}


function autoCheck(payload) {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const results = await window.api.checkMaterial(payload);

    if (!results) {
      showTooltip("⚠ Tidak ditemukan", "not-found");
      return;
    }

    // ================== 1 DATA ==================
    if (results.length === 1) {
      fillForm(results[0]);
      showTooltip("✅ Data ditemukan", "found");
      return;
    }

    // ================== BANYAK DATA ==================
    showOptions(results);
    showTooltip(`🔍 ${results.length} data ditemukan`, "found");
  }, 400);
}


materialInput.addEventListener("input", () => {
  const v = materialInput.value.trim();

  if (!v) {
    clearSparepartFields();
    return;
  }

  autoCheck({ nomor_material: v });
});

namaInput.addEventListener("input", () => {
  const v = namaInput.value.trim();

  if (!v) {
    clearSparepartFields();
    setValue("nomor_material", "");
    return;
  }

  autoCheck({ nama_sparepart: v });
});


async function loadMasterTable() {
  const data = await window.api.loadMasterKode();
  console.table(data); // ganti render ke table HTML
}

async function deleteRow(id) {
  if (!confirm("Hapus data ini?")) return;
  await window.api.deleteMasterKode(id);
  loadMasterTable();
}


function fillField(id, value) {
  const el = document.getElementById(id);
  if (!el.value) el.value = value || "";
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? "";
}

/*
//=============================auto check kode barang====================================//
materialInput.addEventListener("input", () => {
  clearTimeout(materialTimer);

  materialTimer = setTimeout(async () => {
    const nomor = materialInput.value.trim();
    if (!nomor) {
      hideTooltip();
      materialInput.classList.remove("found", "not-found");
      return;
    }

    showTooltip("Mengecek material...", "checking");

    const data = await window.api.checkMaterial(nomor);

    if (data) {
      console.log("✅ Material ditemukan:", data);

      // ✅ AUTO ISI FIELD DARI DATABASE
      document.getElementById("nama_sparepart").value     = data.nama_sparepart || "";
      document.getElementById("vendor").value             = data.vendor || "";
      document.getElementById("harga_satuan").value       = data.harga_satuan || "";
      document.getElementById("function_location").value = data.function_location || "";
      document.getElementById("sub_location").value       = data.sub_location || "";

      materialInput.classList.add("found");
      materialInput.classList.remove("not-found");

      showTooltip("✅ Material terdaftar", "found");

    } else {
      console.warn("❌ Material tidak ditemukan");

      materialInput.classList.add("not-found");
      materialInput.classList.remove("found");

      showTooltip("⚠ Material belum terdaftar", "not-found");
    }

  }, 400); // debounce 400ms
});
*/


function showTooltip(text, type) {
  materialTooltip.textContent = text;
  materialTooltip.className = `material-tooltip show ${type}`;
}

function hideTooltip() {
  materialTooltip.className = "material-tooltip";
}

/* STATUS SAAT MENGETIK */
  materialInput.addEventListener("input", () => {
  materialInput.classList.remove("found", "not-found");
  showTooltip("Mengecek material...", "checking");
});


//==================================================================================================//

function getWeekNumber(date) {
  // Buat salinan tanggal untuk menghindari mutasi
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

  // Geser ke hari Senin: (getUTCDay() + 6) % 7 akan hasilkan 0 untuk Senin
  const dayNum = (d.getUTCDay() + 6) % 7;

  // Geser ke Kamis di minggu yang sama agar selalu di minggu yang benar menurut ISO
  d.setUTCDate(d.getUTCDate() - dayNum + 3);

  // Ambil minggu pertama tahun (yang berisi Kamis pertama)
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));

  // Hitung minggu ke-berapa (ISO)
  const weekNumber = 1 + Math.round(
    ((d - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7
  );

  return weekNumber;
}

// Set tanggal otomatis ke hari ini saat load
window.addEventListener("DOMContentLoaded", async () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0"); // bulan 01-12
  const dd = String(today.getDate()).padStart(2, "0");      // tanggal 01-31

  tanggalEl.value = `${yyyy}-${mm}-${dd}`;
  weekEl.value = getWeekNumber(today);
   await refreshHistoryMonth();

  // ✅ Langsung tampilkan data minggu sekarang
 // if (typeof refreshHistoryWeek === "function") {
   // await refreshHistoryWeek();
  //}

  // ✅ Tampilkan juga chart untuk minggu ini
 // if (typeof window.loadCharts === "function") {
   // await window.loadCharts("week", 0);
  //}
});



// Listener saat tanggal diubah
tanggalEl.addEventListener("change", () => {
  if (tanggalEl.value) {
    const date = new Date(tanggalEl.value);
    weekEl.value = getWeekNumber(date);
  } else {
    weekEl.value = "";
  }
});

window.addEventListener("DOMContentLoaded", async () => {
  const functionLocEl = document.getElementById("function_location");
  const subLocEl = document.getElementById("sub_location");

  const modal = document.getElementById("addModal");
  const funcInput = document.getElementById("newFuncLoc");
  const subInput = document.getElementById("newSubLoc");
  const funcSelect = document.getElementById("modalFuncSelect");

  const addBtn = document.getElementById("addLocationBtn");
  const saveBtn = document.getElementById("saveNewLoc");
  const cancelBtn = document.getElementById("cancelNewLoc");

  const locationLoadingEl = document.getElementById("locationLoading");

  // =================== Load semua lokasi ===================
  const locations = await window.api.getAllLocations(); // IPC call
  const locMap = {}; // Function Location => [Sub Location]
  locations.forEach(loc => {
    const func = String(loc.function_location || "").trim().toUpperCase();
    const sub  = String(loc.sub_location || "").trim().toUpperCase();
    if (!func) return;
    if (!locMap[func]) locMap[func] = [];
    if (sub) locMap[func].push(sub);
  });

  // Populate dropdown utama dan modal dropdown
  function populateFunctionDropdown(dropdown) {
    dropdown.innerHTML = "<option value=''>-- Pilih Function Location --</option>";
    Object.keys(locMap).forEach(func => {
      const opt = document.createElement("option");
      opt.value = func;
      opt.textContent = func;
      dropdown.appendChild(opt);
    });
  }

  function updateSubLocations() {
    const selectedFunc = functionLocEl.value;
    subLocEl.innerHTML = "";
    if (!locMap[selectedFunc]) return;
    locMap[selectedFunc].forEach(sub => {
      const opt = document.createElement("option");
      opt.value = sub;
      opt.textContent = sub;
      subLocEl.appendChild(opt);
    });
  }

  populateFunctionDropdown(functionLocEl);
  updateSubLocations();

  // =================== Modal ===================
  addBtn.addEventListener("click", () => {
    modal.classList.remove("hidden");
    funcInput.value = "";
    subInput.value = "";
    populateFunctionDropdown(funcSelect);
  });

  // Jika user mengetik Function baru → kosongkan select
funcInput.addEventListener("input", () => {
  if (funcInput.value.trim()) {
    funcSelect.value = "";
  }
});

// Jika user memilih dari select → kosongkan input Function baru
funcSelect.addEventListener("change", () => {
  if (funcSelect.value) {
    funcInput.value = "";
  }
});

functionLocEl.addEventListener("change", () => {
  console.log("🔄 Function changed:", functionLocEl.value);
  updateSubLocations();
});




function showLocationLoading() {
  locationLoadingEl?.classList.remove("hidden");
  saveBtn.disabled = true;
}

function hideLocationLoading() {
  locationLoadingEl?.classList.add("hidden");
  saveBtn.disabled = false;
}


cancelBtn.addEventListener("click", () => {
  if (isSavingLocation) return; // block saat loading
  modal.classList.add("hidden");
});


 saveBtn.addEventListener("click", async () => {
  if (isSavingLocation) return;
  isSavingLocation = true;
  showLocationLoading();

  try {
    const funcValue = String(funcInput?.value || "").trim().toUpperCase();
    const subValue = String(subInput?.value || "").trim().toUpperCase();
    const selectedFuncValue = String(funcSelect?.value || "").trim().toUpperCase();

    const isNewFunc = !!funcValue;
    const isExistingFunc = !!selectedFuncValue;

    console.log({ funcValue, selectedFuncValue, subValue });

    // ================= VALIDASI =================

    if (!isNewFunc && !isExistingFunc) {
      showToast("Harus pilih atau isi Function Location!", "error");
      return;
    }

    if (!subValue) {
      showToast("Sub Location wajib diisi!", "error");
      return;
    }

    if (isNewFunc && isExistingFunc) {
      showToast("Pilih Function Location ATAU isi Function Location baru, jangan dua-duanya!", "error");
      return;
    }

    // ================= PROSES =================

    let finalFunc = "";

    // === FUNCTION BARU ===
    if (isNewFunc) {
      finalFunc = funcValue;

      const result = await window.api.addLocation({
        funcLoc: funcValue,
        subLoc: subValue
      });

      if (!result?.success) {
        throw new Error(result?.message || "Gagal menambahkan Function Location");
      }

      if (!locMap[funcValue]) locMap[funcValue] = [];
      locMap[funcValue].push(subValue);
    }

    // === FUNCTION EXISTING ===
    if (isExistingFunc) {
      finalFunc = selectedFuncValue;

      if (!locMap[selectedFuncValue]) {
        locMap[selectedFuncValue] = [];
      }

      if (locMap[selectedFuncValue].includes(subValue)) {
        showToast("Sub Location sudah ada", "info");
        return;
      }

      const result = await window.api.addLocation({
        funcLoc: selectedFuncValue,
        subLoc: subValue
      });

      if (!result?.success) {
        throw new Error(result?.message || "Gagal menambahkan Sub Location");
      }

      locMap[selectedFuncValue].push(subValue);
    }

    // ================= UPDATE UI =================
    populateFunctionDropdown(functionLocEl);
    functionLocEl.value = finalFunc;
    updateSubLocations();
    subLocEl.value = subValue;

    // Reset modal form
    funcInput.value = "";
    subInput.value = "";
    funcSelect.value = "";

    modal.classList.add("hidden");
    showToast("✅ Lokasi berhasil ditambahkan", "success");

  } catch (err) {
    console.error("SAVE LOCATION ERROR:", err);
    showToast(err.message || "Terjadi kesalahan saat menyimpan lokasi", "error");

  } finally {
    hideLocationLoading();
    isSavingLocation = false;
  }
});



  // ================= TOAST =================
  function showToast(msg, type = "info") {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
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

  // ================= INFO & VISITOR MODE =================
  if (window.api && window.api.onShowAppInfo) {
    window.api.onShowAppInfo((info) => {
      alert(
        `📦 App Info:\n\n` +
        `App Path: ${info.appPath}\n` +
        `Electron Version: ${info.electronVersion}\n` +
        `Node Version: ${info.nodeVersion}`
      );
    });
  }

  if (window.api && window.api.onVisitorMode) {
    window.api.onVisitorMode(() => {
      document.querySelectorAll("input, select, textarea, button").forEach((el) => {
        const insideCard = el.closest(".trend-card, .history-box, .data-card");
        if (!insideCard) el.disabled = true;
      });

      const form = document.getElementById("spareForm");
      if (form) {
        form.querySelectorAll("input, select, textarea, button").forEach(el => el.disabled = true);
      }

      const badge = document.createElement("div");
      badge.textContent = "👁️ Visitor Mode (Read Only)";
      badge.style.position = "fixed";
      badge.style.top = "10px";
      badge.style.right = "15px";
      badge.style.background = "rgba(0,0,0,0.6)";
      badge.style.color = "white";
      badge.style.padding = "6px 12px";
      badge.style.borderRadius = "8px";
      badge.style.fontSize = "12px";
      badge.style.zIndex = "9999";
      document.body.appendChild(badge);
    });
  }

const form = document.getElementById("spareForm");
// Fungsi reset form
function resetForm() {
  form.reset(); // reset semua input
  document.getElementById("week").value = getWeekNumber(new Date()); // reset week
  document.getElementById("tanggal").valueAsDate = new Date(); // tanggal ke hari ini
  document.getElementById("function_location").value = "";
  document.getElementById("sub_location").value = "";
}

const loadingOverlay = document.getElementById("loadingOverlay");
form.addEventListener("submit", async (e) => {
  e.preventDefault(); // cegah reload halaman

  // Ambil semua value
  const data = {
    tanggal: document.getElementById("tanggal").value,
    week: document.getElementById("week").value,
    nomor_material: document.getElementById("nomor_material").value,
    nama_sparepart: document.getElementById("nama_sparepart").value,
    quantity: parseInt(document.getElementById("quantity").value) || 0,
    function_location: document.getElementById("function_location").value,
    sub_location: document.getElementById("sub_location").value,
    vendor: document.getElementById("vendor").value,
    harga_satuan: parseInt(document.getElementById("harga_satuan").value) || 0,
    total_harga: (parseInt(document.getElementById("quantity").value) || 0) *
                 (parseInt(document.getElementById("harga_satuan").value) || 0)
  };

 try {
    // tampilkan loading
    loadingOverlay.classList.remove("hidden");

  // Kirim ke main process
  const result = await window.api.saveSparepart(data); // pastikan ini di preload.js
 await new Promise(resolve => setTimeout(resolve, 2000));
  loadingOverlay.classList.add("hidden");

  if (loadingOverlay) loadingOverlay.classList.add("hidden");

  if (result.success) {
    showToast("✅ Data berhasil disimpan", "success");
    resetForm();
    hideTooltip();
    await refreshAll();
  } else {
     showToast("❌ Gagal menyimpan: " + (result.error || "Unknown error"), "error");
    }
   }
   catch (err) {
    loadingOverlay.classList.add("hidden");
    showToast("❌ Terjadi error saat menyimpan: " + err.message, "error");
  }
});



// document.addEventListener("DOMContentLoaded", async () => {
  //weekOffset = 0;          // ✅ pastikan selalu nol saat pertama load
  //await refreshHistoryWeek();

//});

  async function loadHistoryMonth() {
    const rows = await window.api.loadHistoryMonth();
    const tbody = document.querySelector("#historyMonth tbody");
    tbody.innerHTML = "";
    rows.forEach(r => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.tanggal}</td>
        <td>${r.nomor_material}</td>
        <td>${r.nama_sparepart}</td>
        <td>${r.vendor}</td>
        <td>${r.quantity}</td>
        <td>${r.function_location}</td>
        <td>${r.sub_location}</td>
        <td>${r.harga_satuan}</td>
        <td>${r.total_harga}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Load awal history
 // loadHistoryByWeek();
 // loadHistoryMonth();

});


// 🔹 HISTORY PER MINGGU
async function refreshHistoryWeek() {
  const { rows, week, range } = await window.api.loadHistoryByWeek(weekOffset);
  const tbody = document.querySelector("#historyWeek tbody");
  const weekLabel = document.getElementById("weekLabel");
  const totalWeekEl = document.getElementById("totalWeek");

  tbody.innerHTML = "";
  weekLabel.textContent = `Minggu ke-${week} (${range || "-"})`;

  if (!rows || rows.length === 0) {
    tbody.innerHTML = "<tr><td colspan='9'>Tidak ada data</td></tr>";
    totalWeekEl.textContent = "Total: Rp 0";
  //  await window.loadCharts?.("week", weekOffset);
    return;
  }

  // 💡 Urutkan data terbaru di atas
const sortedRows = rows.sort((a,b) => new Date(b.tanggal) - new Date(a.tanggal));

  let totalHarga = 0;
  sortedRows.forEach(r => {
    totalHarga += r.total_harga || 0;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.tanggal}</td>
      <td>${r.nomor_material}</td>
      <td>${r.nama_sparepart}</td>
      <td>${r.vendor}</td>
      <td>${r.quantity}</td>
      <td>${r.function_location}</td>
      <td>${r.sub_location}</td>
      <td>${r.harga_satuan}</td>
      <td>${r.total_harga}</td>
    `;
    tbody.appendChild(tr);
  });

  totalWeekEl.textContent = `Total: Rp ${totalHarga.toLocaleString("id-ID")}`;
  //await window.loadCharts?.("week", weekOffset);
}



// 🔹 HISTORY PER BULAN
async function refreshHistoryMonth() {
  const { rows, bulan } = await window.api.loadHistoryByMonth(monthOffset);
  const tbody = document.querySelector("#historyMonth tbody");
  const monthLabel = document.getElementById("monthLabel");
  const totalMonthEl = document.getElementById("totalMonth");

  tbody.innerHTML = "";
  monthLabel.textContent = `Bulan ${bulan || "-"}`;

  if (!rows || rows.length === 0) {
    tbody.innerHTML = "<tr><td colspan='9'>Tidak ada data</td></tr>";
    totalMonthEl.textContent = "Total: Rp 0";
   // await window.loadCharts?.("month", monthOffset);
    return;
  }

  let totalHarga = 0;
  rows.forEach(r => {
    totalHarga += r.total_harga || 0;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.tanggal}</td>
      <td>${r.nomor_material}</td>
      <td>${r.nama_sparepart}</td>
      <td>${r.vendor}</td>
      <td>${r.quantity}</td>
      <td>${r.function_location}</td>
      <td>${r.sub_location}</td>
      <td>${r.harga_satuan}</td>
      <td>${r.total_harga}</td>
    `;
    tbody.appendChild(tr);
  });

  totalMonthEl.textContent = `Total: Rp ${totalHarga.toLocaleString("id-ID")}`;
  await window.loadCharts?.("month", monthOffset);
}



// Tombol navigasi
document.getElementById("prevWeek").addEventListener("click", () => {
  weekOffset -= 1;
  refreshHistoryWeek();
});
document.getElementById("nextWeek").addEventListener("click", () => {
  weekOffset += 1;
  refreshHistoryWeek();
});
document.getElementById("prevMonth").addEventListener("click", () => {
  monthOffset -= 1;
  refreshHistoryMonth();
});
document.getElementById("nextMonth").addEventListener("click", () => {
  monthOffset += 1;
  refreshHistoryMonth();
});

// Load awal
//refreshHistoryWeek();
//refreshHistoryMonth();

// ----------------- HELPERS: tunggu sampai elemen terlihat -----------------
function ensureVisibleBeforeRender(el, timeout = 2000) {
  // jika sudah terlihat, resolve segera
  if (!el) return Promise.resolve();
  if (el.offsetWidth > 0 && el.offsetHeight > 0) return Promise.resolve();

  return new Promise((resolve) => {
    let resolved = false;
    // fallback polling (sederhana & reliabel)
    const start = Date.now();
    const poll = setInterval(() => {
      if (el.offsetWidth > 0 && el.offsetHeight > 0) {
        clearInterval(poll);
        if (!resolved) { resolved = true; resolve(); }
      } else if (Date.now() - start > timeout) {
        clearInterval(poll);
        if (!resolved) { resolved = true; resolve(); } // timeout -> tetap resolve
      }
    }, 50);

    // IntersectionObserver sebagai primary (lebih efisien)
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach(en => {
          if (en.isIntersecting) {
            io.disconnect();
            clearInterval(poll);
            if (!resolved) { resolved = true; resolve(); }
          }
        });
      }, { threshold: 0.01 });
      io.observe(el);
    }
  });
}


// ----------------- SAFE refreshAll -----------------
async function refreshAll() {
  const chartContainer = document.querySelector(".trend-grid");
  if (!chartContainer) return;

  chartContainer.classList.add("loading");

  await refreshHistoryWeek();
  await refreshHistoryMonth();

  await new Promise(r => requestAnimationFrame(r));
  await new Promise(r => setTimeout(r, 120));

  // ❌ JANGAN destroy chart
  // ❌ JANGAN panggil window.loadCharts

  chartContainer.classList.remove("loading");
}




window.electronAPI.onNavigateScreen((event, screen) => {

  document.querySelectorAll(".screen").forEach(el => {
    el.style.display = "none";
  });

  const map = {
    purchase: "screenPurchase",
    RMC: "screenRMC",
    Karyawan: "screenKaryawan"
  };

  const target = document.getElementById(map[screen]);
  if (!target) return;

  target.style.display = "block";

  // ⛔ HANYA PURCHASE YANG BOLEH BIKIN CHART
  if (screen === "purchase") {
    renderChartSafely();
  }
});


async function renderChartSafely() {
  if (isRenderingChart) return;
  isRenderingChart = true;

  const chartContainer = document.querySelector(".trend-grid");
  if (!chartContainer) {
    isRenderingChart = false;
    return;
  }

  chartContainer.classList.add("loading");

  try {
    // hanya refresh data TAB, JANGAN SENTUH CHART
    await refreshHistoryWeek();
    await refreshHistoryMonth();

    await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => setTimeout(r, 120));

    console.log("✅ Data refreshed, chart UMD dibiarkan hidup");

  } catch (err) {
    console.error("renderChartSafely error:", err);
  } finally {
    chartContainer.classList.remove("loading");
    isRenderingChart = false;
  }
}



// -------- Unified, safe navigate handler for ipcRenderer events --------
ipcRenderer.removeAllListeners?.('navigate-screen'); // jika ada listeners sebelumnya, hapus dulu (safety)
ipcRenderer.on('navigate-screen', (event, screen) => {
  // jangan izinkan berpindah screen kalau visitor mode
  if (isVisitorMode) {
    alert("🔒 Anda dalam Visitor Mode. Tidak dapat berpindah screen.");
    return;
  }

  // sembunyikan semua screen
  document.querySelectorAll('.screen').forEach(el => el.style.display = 'none');

  const map = {
    purchase: 'screenPurchase',
    RMC: 'screenRMC',
    Karyawan: 'screenKaryawan'
  };

  const targetId = map[screen] || screen; // fallback bila screen sudah terformat id
  const target = document.getElementById(targetId);
  if (!target) return;

  target.style.display = 'block';

  // Pastikan kita hanya render chart SAFELY saat purchase aktif
  if (screen === 'purchase') {
    // beri waktu singkat agar DOM update selesai, lalu render dengan keamanan ukuran
    setTimeout(() => {
      renderChartSafely().catch(err => console.error('renderChartSafely error:', err));
    }, 120);
  }
});


/// THEME CHANGE////
window.electronAPI.onThemeChange((theme) => {
  document.body.className = "";
  document.body.classList.add(`dashboard-${theme}`);
});

window.electronAPI.onBlockedVisitor(() => {
  showToast("🔒 Anda dalam Visitor Mode. Tidak dapat berpindah screen.");
  console.log("VISITOR BLOCKED:", data);
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

//=============================updater=================================//

window.updater.onStatus((status, data) => {
  if (status === "available") {
    if (confirm(`Versi baru tersedia: ${data.version}\nDownload sekarang?`)) {
      window.updater.download();
    }
  }

  if (status === "downloaded") {
    if (confirm("Update selesai. Restart sekarang?")) {
      window.updater.install();
    }
  }
});


//=======================end updater=========================//

window.addEventListener("load", () => {
  // Paksa masuk ke purchase dulu
  setTimeout(() => {
    renderChartSafely();
  }, 400);
});

