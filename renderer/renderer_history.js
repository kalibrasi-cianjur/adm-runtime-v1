document.addEventListener("DOMContentLoaded", () => {

  const table = document.getElementById("historyTable");
  const filterMesin = document.getElementById("filterMesin");
  const pageInfo = document.getElementById("pageInfo");

  const searchInput = document.getElementById("searchInput");
  const dateStart = document.getElementById("dateStart");
  const dateEnd = document.getElementById("dateEnd");

  const netBanner = document.getElementById("netBanner"); // banner offline

  let rows = [];
  let page = 1;
  const limit = 15;

  // ==========================================
  // LOAD DATA DARI SQLITE
  // ==========================================
  async function loadHistory() {
    try {
      const data = await window.api.history.load();
      rows = data || [];
      applyFilters();
      renderAreaList();

    } catch (err) {
      console.error("LOAD ERROR:", err);
      alert("Gagal load history");
    }
  }

  // ==========================================
  // NETWORK STATUS HANDLER
  // ==========================================
  function updateNetworkBanner() {
    if (!navigator.onLine) {
      netBanner.classList.remove("hidden");
    } else {
      netBanner.classList.add("hidden");
    }
  }

  window.addEventListener("online", updateNetworkBanner);
  window.addEventListener("offline", updateNetworkBanner);
  updateNetworkBanner();

  // ==========================================
  // FILTERING
  // ==========================================
  function applyFilters() {
    let filtered = [...rows];
    const search = searchInput.value.toLowerCase();

    if (search) {
      filtered = filtered.filter(r =>
        (r.mesin || "").toLowerCase().includes(search) ||
        (r.nama_part || "").toLowerCase().includes(search) ||
        (r.area || "").toLowerCase().includes(search) ||
        (r.pic || "").toLowerCase().includes(search)
      );
    }

    if (dateStart.value) {
      filtered = filtered.filter(r =>
        new Date(r.created_at) >= new Date(dateStart.value)
      );
    }

    if (dateEnd.value) {
      filtered = filtered.filter(r =>
        new Date(r.created_at) <= new Date(dateEnd.value + " 23:59:59")
      );
    }

    if (filterArea.value) {
      filtered = filtered.filter(r => r.area === filterArea.value);
    }

    renderTable(filtered, search);
  }

  // ==========================================
  // HIGHLIGHT FUNCTION
  // ==========================================
  function highlight(text, keyword) {
    if (!keyword) return text;
    const regex = new RegExp(`(${keyword})`, "gi");
    return text.replace(regex, `<mark>$1</mark>`);
  }

  // ==========================================
  // RENDER TABLE
  // ==========================================
  function renderTable(list, keyword = "") {
  table.innerHTML = "";

  const start = (page - 1) * limit;
  const end = start + limit;
  const pageRows = list.slice(start, end);

  pageInfo.textContent = `Page ${page} / ${Math.ceil(list.length / limit)}`;

  pageRows.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${highlight(r.mesin || "-", keyword)}</td>
      <td>${highlight(r.nama_part || "-", keyword)}</td>
      <td>${highlight(r.area || "-", keyword)}</td>
      <td>${r.pic || "-"}</td>
      <td>${r.namaDept || "-"}</td>

      <td>
        ${r.foto_url ? `<img
          src="${r.foto_url}"
          class="thumb"
          data-id="${r.id}"
        >` : "-"}
      </td>

      <td>${new Date(r.created_at).toLocaleString()}</td>
    `;
    table.appendChild(tr);
  });

  attachThumbnailEvents(); // FIXED
}

function attachThumbnailEvents() {
  document.querySelectorAll(".thumb").forEach(img => {
    img.addEventListener("click", () => {
      const id = img.dataset.id;
      const record = rows.find(r => r.id === id);

      if (record) {
        showPhotoViewer(record.foto_url, record);
      }
    });
  });
}


  // ==========================================
  // FOTO CLICK → POPUP
  // ==========================================
function bindPhotoEvents() {
  document.querySelectorAll(".photo").forEach(img => {
    img.onclick = () => {
      openPhotoViewer(img.dataset.full);
    };
  });
}

function openPhotoViewer(url) {
  const viewer = document.getElementById("photoViewer");
  const viewerImg = document.getElementById("viewerImg");

  viewerImg.src = url;

  // Reset ukuran agar tidak ikut ukuran kecil
  viewerImg.style.width = "auto";
  viewerImg.style.height = "auto";

  viewer.classList.remove("hidden");
}

  document.getElementById("closeViewer").onclick = () => {
    document.getElementById("photoViewer").classList.add("hidden");
  };

  // klik area gelap -> close viewer
document.getElementById("photoViewer").addEventListener("click", (e) => {
  const viewerImg = document.getElementById("viewerImg");

  // jika yang diklik *bukan* gambarnya, maka close
  if (e.target !== viewerImg) {
    closePhotoViewer();
  }
});

function showPhotoViewer(src, record) {
  const viewer = document.getElementById("photoViewer");
  const img = document.getElementById("viewerImg");
  const desc = document.getElementById("viewerDesc");

  img.classList.remove("thumb");
  img.src = src;

  desc.innerHTML = `
    <strong>${record.nama_part}</strong><br>
    Mesin: ${record.mesin}<br>
    Area: ${record.area}<br>
    PIC: ${record.pic}<br>
    Dept: ${record.namaDept}<br>
    Waktu: ${new Date(record.created_at).toLocaleString()}
  `;

  viewer.classList.remove("hidden");
}


function closePhotoViewer() {
  document.getElementById("photoViewer").classList.add("hidden");
}

document.getElementById("closeViewer").addEventListener("click", closePhotoViewer);

document.getElementById("photoViewer").addEventListener("click", (e) => {
  const img = document.getElementById("viewerImg");
  if (!img.contains(e.target)) {
    closePhotoViewer();
  }
});

//===============================
// BUTTON FILTER & DELETE FILTER
//==============================
document.getElementById("btnApplyFilter").addEventListener("click", () => {
  page = 1;
  applyFilters();
});

document.getElementById("btnDelFilter").addEventListener("click", () => {

  // Reset input pencarian
  document.getElementById("searchInput").value = "";

  // Reset tanggal
  document.getElementById("dateStart").value = "";
  document.getElementById("dateEnd").value = "";

  // Reset mesin
  document.getElementById("filterArea").value = "";

  // Kembalikan ke page 1
  page = 1;

  // Render ulang
  applyFilters();
});

//===================================================================//


  // ==========================================
  // MESIN DROPDOWN
  // ==========================================
  function renderAreaList() {
    const unique = [...new Set(rows.map(r => r.area).filter(Boolean))];
    filterArea.innerHTML = `<option value="">Semua Area</option>`;
    unique.forEach(m => {
      const opt = document.createElement("option");
      opt.value = opt.textContent = m;
      filterArea.appendChild(opt);
    });
  }

  // ==========================================
  // Pagination
  // ==========================================
  document.getElementById("prevPage").onclick = () => {
    if (page > 1) {
      page--;
      applyFilters();
    }
  };

  document.getElementById("nextPage").onclick = () => {
    page++;
    applyFilters();
  };

  // ==========================================
  // Event Listeners
  // ==========================================
  searchInput.oninput = applyFilters;
  dateStart.onchange = applyFilters;
  dateEnd.onchange = applyFilters;
  filterArea.onchange = applyFilters;

  // ==========================================
  // INIT
  // ==========================================
  loadHistory();
});




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
