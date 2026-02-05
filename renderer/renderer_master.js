document.addEventListener("DOMContentLoaded", () => {

  const tbody = document.querySelector("#masterTable tbody");
  const loadingEl = document.getElementById("loading");
  const paginationEl = document.getElementById("pagination");
  const perPageSelect = document.getElementById("perPage");

  const modal = document.getElementById("masterModal");
  const modalTitle = document.getElementById("modalTitle");

  const addBtn = document.getElementById("addMasterBtn");
  const saveBtn = document.getElementById("saveMaster");
  const cancelBtn = document.getElementById("cancelMaster");


// ================= DELETE MODAL =================
const confirmModal = document.getElementById("confirmModal");
const confirmText  = document.getElementById("confirmText");
const btnCancel    = document.getElementById("cancelDelete");
const btnConfirm   = document.getElementById("confirmDelete");

const infoEl = document.getElementById("pageInfo");


const syncBox = document.getElementById("syncBox");
const syncText = document.getElementById("syncText");
const syncProgress = document.getElementById("syncProgress");


  const PAGE_WINDOW = 10;

  let master_kode = [];
  let filteredData = [];
  let searchKeyword = "";
  let currentPage = 1;
  let perPage = 25;
  let editKode = null;
  let deleteKodeTarget = null;
  let hideTimer = null;
  let lastShowAt = 0;


// IPC listener
window.syncAPI.onSyncStatus((data) => {
  showSync(
    data.status,
    data.message,
    data.progress ?? 0
  );
});


function showSync(status, message, progress = 0) {
  const now = Date.now();

  clearTimeout(hideTimer);
  syncBox.classList.remove("syncing", "done", "error", "idle");

  if (status === "idle") {
    syncBox.classList.remove("show");
    return;
  }

  if (!syncBox.classList.contains("show")) {
    lastShowAt = now;
  }

  syncBox.classList.add("show", status);
  syncText.textContent = message || status;
  syncProgress.style.width = `${progress}%`;

  if (status === "done") {
    const elapsed = now - lastShowAt;
    const delay = Math.max(1200 - elapsed, 300);

    hideTimer = setTimeout(() => {
      syncBox.classList.remove("show");
    }, delay);
  }
}


function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function applySearch(keyword) {
  searchKeyword = keyword.toLowerCase();

  filteredData = master_kode.filter(r =>
    r.kode.toLowerCase().includes(searchKeyword) ||
    r.material.toLowerCase().includes(searchKeyword) ||
    r.currency.toLowerCase().includes(searchKeyword)
  );

  currentPage = 1;
  render();
}


function highlight(text, keyword) {
  if (!keyword) return text;

  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");

  return text.replace(regex, `<mark>$1</mark>`);
}


const handleSearch = debounce(() => {
  const q = searchInput.value.toLowerCase();

  filteredData = master_kode.filter(r =>
    r.kode.toLowerCase().includes(q) ||
    r.material.toLowerCase().includes(q)
  );

  currentPage = 1;
  render();
}, 300);

searchInput.addEventListener("input", handleSearch);

  // ================= INIT =================
  modal.classList.remove("show"); // 🔥 FIX: modal dipastikan HIDE

  // ================= LOAD =================
async function loadMaster() {
  loadingEl.style.display = "block";

  master_kode = await window.api.getMasterKode();
  filteredData = [...master_kode]; // 🔥 penting

  loadingEl.style.display = "none";
  currentPage = 1;
  render();
}



  loadMaster();

function updatePageInfo() {
  const infoEl = document.getElementById("pageInfo");
  if (!infoEl) return;

  const total = filteredData.length;

  if (!total) {
    infoEl.textContent = "Tidak ada data";
    return;
  }

  const start = (currentPage - 1) * perPage + 1;
  const end = Math.min(start + perPage - 1, total);

  infoEl.textContent =
    `Menampilkan ${start}–${end} dari ${total} data`;
}



  // ================= RENDER =================
  function render() {
    renderTable();
    renderPagination();
    updatePageInfo();
  }

  function renderTable() {
    const keyword = searchInput.value.trim();
    tbody.innerHTML = "";

    const start = (currentPage - 1) * perPage;
    const end = start + perPage;
    const pageData = filteredData.slice(start, end);

if (!filteredData.length && searchKeyword) {
  tbody.innerHTML = `
    <tr>
      <td colspan="7" style="text-align:center; padding:20px;">
        Tidak ada hasil untuk
        <strong>"${searchKeyword}"</strong>
      </td>
    </tr>`;
  return;
}



    pageData.forEach(r => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
  <td>${highlight(r.kode, keyword)}</td>
  <td>${highlight(r.material, keyword)}</td>
  <td>${r.stock_value}</td>
  <td>${r.currency}</td>
  <td>${r.qty}</td>
  <td>${r.satuan}</td>
  <td>
    <button class="edit">✏</button>
    <button class="delete">🗑</button>
  </td>
`;


      tr.querySelector(".edit").onclick = () => openEdit(r);
      tr.querySelector(".delete").onclick = () => remove(r.kode);

      tbody.appendChild(tr);
    });
  }





  // ================= PAGINATION =================
 function renderPagination() {
  paginationEl.innerHTML = "";

  const totalPages = Math.ceil(filteredData.length / perPage);
  if (totalPages <= 1) return;

  const startPage =
    Math.floor((currentPage - 1) / PAGE_WINDOW) * PAGE_WINDOW + 1;
  const endPage = Math.min(startPage + PAGE_WINDOW - 1, totalPages);

  // ===== FIRST PAGE =====
  if (currentPage > 1) {
    const first = document.createElement("button");
    first.textContent = "⏮";
    first.title = "Halaman pertama";
    first.onclick = () => {
      currentPage = 1;
      render();
    };
    paginationEl.appendChild(first);
  }

  // ===== PREV WINDOW =====
  if (startPage > 1) {
    const prev = document.createElement("button");
    prev.textContent = "«";
    prev.title = "Sebelumnya";
    prev.onclick = () => {
      currentPage = startPage - 1;
      render();
    };
    paginationEl.appendChild(prev);
  }

  // ===== PAGE NUMBERS =====
  for (let i = startPage; i <= endPage; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    btn.className = i === currentPage ? "active" : "";
    btn.onclick = () => {
      currentPage = i;
      render();
    };
    paginationEl.appendChild(btn);
  }

  // ===== NEXT WINDOW =====
  if (endPage < totalPages) {
    const next = document.createElement("button");
    next.textContent = "»";
    next.title = "Selanjutnya";
    next.onclick = () => {
      currentPage = endPage + 1;
      render();
    };
    paginationEl.appendChild(next);
  }

  // ===== LAST PAGE =====
  if (currentPage < totalPages) {
    const last = document.createElement("button");
    last.textContent = "⏭";
    last.title = "Halaman terakhir";
    last.onclick = () => {
      currentPage = totalPages;
      render();
    };
    paginationEl.appendChild(last);
  }
}

  // ================= MODAL =================
  function openEdit(data) {
    editKode = data.kode;
    modalTitle.textContent = "Edit Master Kode";
    modal.classList.add("show");

    m_kode.value = data.kode;
    m_kode.disabled = false;
    m_material.value = data.material;
    m_stock.value = data.stock_value;
    m_currency.value = data.currency;
    m_qty.value = data.qty;
    m_satuan.value = data.satuan;
  }

  addBtn.onclick = () => {
    editKode = null;
    modalTitle.textContent = "Tambah Master Kode";
    modal.classList.add("show");

    [m_kode, m_material, m_stock, m_currency, m_qty, m_satuan].forEach(i => {
      i.value = "";
      i.disabled = false;
    });
  };

  cancelBtn.onclick = () => modal.classList.remove("show");

  // ================= SAVE =================
  saveBtn.onclick = async () => {
    await window.api.saveMasterKode({
      kode: m_kode.value,
      material: m_material.value,
      stock_value: Number(m_stock.value),
      currency: m_currency.value,
      qty: Number(m_qty.value),
      satuan: m_satuan.value
    });

    modal.classList.remove("show");
    loadMaster();
  };

function remove(kode) {
  deleteKodeTarget = kode;

  confirmText.textContent =
    `Apakah Anda yakin ingin menghapus data dengan kode "${kode}"?`;
console.log("DELETE TARGET:", kode);

  confirmModal.classList.add("show");
}
// batal
btnCancel.onclick = () => {
  closeDeleteModal();
};

// konfirmasi hapus
btnConfirm.onclick = async () => {
  if (!deleteKodeTarget) return;

  try {
    await window.api.deleteMasterKode(deleteKodeTarget);

    showToast("Data berhasil dihapus", "success");

    closeDeleteModal();
    loadMaster();

  } catch (err) {
    console.error(err);
    showToast("Gagal menghapus data", "error");
  }
};
// tutup modal
function closeDeleteModal() {
  confirmModal.classList.remove("show");
  deleteKodeTarget = null;
}

// klik background untuk close
confirmModal.addEventListener("click", e => {
  if (e.target === confirmModal) {
    closeDeleteModal();
  }
});

localStorage.setItem("tableState", JSON.stringify({
  page: currentPage,
  perPage,
  search: searchInput.value
}));



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
});
