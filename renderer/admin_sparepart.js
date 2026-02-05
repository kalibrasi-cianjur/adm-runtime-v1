const tbody = document.getElementById("tableBody");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const btnSync = document.getElementById("btnSync");

const overlay = document.getElementById("photoOverlay");
const preview = document.getElementById("photoPreview");
const notifBadge = document.getElementById("notifBadge");
const toast = document.getElementById("toast");


const overlayFeed = document.getElementById("feedbackOverlay");
const input   = document.getElementById("feedbackInput");
const title   = document.getElementById("feedbackTitle");

const btnCancel = document.getElementById("btnFeedbackCancel");
const btnSubmit = document.getElementById("btnFeedbackSubmit");


const progressOverlay = document.getElementById("progressOverlay");
const progressTitle   = document.getElementById("progressTitle");
const progressInput   = document.getElementById("progressInput");
const progressCancel  = document.getElementById("progressCancel");
const progressSubmit  = document.getElementById("progressSubmit");

let pendingProgress = null;
let pendingId = null;

let lastDataHash = "";
let selectedAction = null;
let selectedId = null;
let selectedProgress = null;

let allData = [];
let previousIds = new Set();


function normalizeProgress(progress) {
  if (!progress) return {};

  if (typeof progress === "string") {
    try {
      return JSON.parse(progress);
    } catch {
      return {};
    }
  }

  return progress;
}

function progressKey(label) {
  return {
    "SERAH TERIMA": "serah_terima",
    "PR": "pr",
    "PO": "po",
    "ONSITE": "onsite"
  }[label];
}



/* ================= LOAD DATA ================= */
async function loadData(auto = false) {
  try {
    const newData = await window.api.getLocalSparepartRequests();

    const newIds = new Set(newData.map(d => d.id));
    const hasNew = [...newIds].some(id => !previousIds.has(id));

    allData = newData;
    renderTable();

    if (auto && hasNew) {
      showToast("🔔 Request sparepart baru masuk");
    }

    previousIds = newIds;
    updateBadge();

  } catch (err) {
    console.error(err);
  }
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


function highlightText(text, keyword) {
  if (!keyword) return text;

  const regex = new RegExp(`(${keyword})`, "gi");
  return text.replace(regex, `<span class="highlight">$1</span>`);
}

function highlight(text, keyword) {
  if (!keyword) return text;
  const regex = new RegExp(`(${keyword})`, "gi");
  return text.replace(regex, `<span class="highlight">$1</span>`);
}


function updateBadge() {
  const pendingCount = allData.filter(r => r.status === "PENDING").length;

  if (pendingCount > 0) {
    notifBadge.style.display = "inline-block";
    notifBadge.textContent = pendingCount;
  } else {
    notifBadge.style.display = "none";
  }
}

function generateHash(data) {
  return JSON.stringify(
    data.map(r => ({
      id: r.id,
      status: r.status,
      created_at: r.created_at
    }))
  );
}

// ================= PROGRESS FLOW =================
function nextProgressOptions(current) {
  const order = ["APPROVED", "SERAH TERIMA", "PR", "PO", "ONSITE"];
  const idx = order.indexOf(current);
  return idx === -1 ? [] : order.slice(idx + 1);
}



function getCurrentProgress(r) {
  if (r.status === "REJECTED") return "REJECTED";
  if (r.status === "CLOSED") return "ONSITE";
  return r.progress || "APPROVED";
}




function buildTooltip(progress) {
  const p = normalizeProgress(progress);

  const lines = [];

  if (p.approved)      lines.push(`Approve : ${p.approved}`);
  if (p.serah_terima)  lines.push(`Serah Terima : ${p.serah_terima}`);
  if (p.pr)            lines.push(`PR : ${p.pr}`);
  if (p.po)            lines.push(`PO : ${p.po}`);
  if (p.onsite)        lines.push(`Onsite : ${p.onsite}`);

  return lines.join("\n");
}



/* ================= RENDER TABLE ================= */
function renderTable() {
  const keyword = searchInput.value.toLowerCase();
  const statusFilterVal = statusFilter.value;

  tbody.innerHTML = "";

  allData
    .filter(r =>
      (!statusFilterVal || r.status === statusFilterVal) &&
      (
        r.mesin.toLowerCase().includes(keyword) ||
        r.nama_part.toLowerCase().includes(keyword) ||
        r.area.toLowerCase().includes(keyword)
      )
    )
    .forEach(r => {
      const tr = document.createElement("tr");

      // ✅ CLOSED → hijau
      if (r.status === "CLOSED") {
        tr.classList.add("row-closed");
      }

      // ================= PROGRESS =================
      const progressObj = normalizeProgress(r.progress);
      const current = getCurrentProgress(r);

      // ================= BADGE =================
      let badgeHTML = "";

      if (
        (r.status === "APPROVED" || r.status === "CLOSED") &&
        r.progress
      ) {
        badgeHTML = `
          <div
            class="badge badge-${current.replace(" ", "-")}"
            title="${buildTooltip(progressObj)}"
          >
            <div class="badge-title">${current}</div>

            ${
              r.pr_number || r.po_number
                ? `
                  <div class="badge-meta">
                    ${r.pr_number ? `<span>PR: ${r.pr_number}</span>` : ""}
                    ${r.po_number ? `<span>PO: ${r.po_number}</span>` : ""}
                  </div>
                `
                : ""
            }
          </div>
        `;
      }

      tr.innerHTML = `
        <td>${r.created_at}</td>
        <td>${highlight(r.request_by, keyword)}</td>
        <td>${highlight(r.mesin, keyword)}</td>
        <td>${highlight(r.nama_part, keyword)}</td>
        <td>${highlight(r.area, keyword)}</td>
        <td>${r.qty}</td>
        <td>${highlight(r.alasan, keyword)}</td>

        <td>
          <span class="status ${r.status}">${r.status}</span>
          ${badgeHTML}
        </td>

        <td>
          ${
            r.foto_url
              ? `<img src="${r.foto_url}" class="foto-thumb" data-full="${r.foto_url}">`
              : "-"
          }
        </td>

        <td>
          ${
            r.status === "PENDING"
              ? `
                <button class="btn-approve" data-id="${r.id}" data-status="APPROVED">✔</button>
                <button class="btn-reject" data-id="${r.id}" data-status="REJECTED">✖</button>
              `
              : r.status === "APPROVED"
              ? `
                <select class="progress-select" data-id="${r.id}">
                  <option value="">Update Progress</option>
                  ${nextProgressOptions(current)
                    .map(p => `<option value="${p}">${p}</option>`)
                    .join("")}
                </select>
                <button class="btn-progress" data-id="${r.id}">Update</button>
              `
              : "-"
          }
        </td>
      `;

      tbody.appendChild(tr);
    });
}


tbody.addEventListener("click", async (e) => {

  // 📷 FOTO PREVIEW
  const img = e.target.closest(".foto-thumb");
  if (img) {
    preview.src = img.dataset.full;
    overlay.style.display = "flex";
    return;
  }

  // ✔ / ✖ APPROVE / REJECT
  const actionBtn = e.target.closest(".btn-approve, .btn-reject");
  if (actionBtn) {
    selectedId = actionBtn.dataset.id;
    selectedAction = actionBtn.dataset.status;

    title.textContent =
      selectedAction === "APPROVED" ? "Approve Request" : "Reject Request";

    input.value = "";
    overlayFeed.classList.remove("hidden");
    return;
  }

  // 🔄 UPDATE PROGRESS
  const btn = e.target.closest(".btn-progress");
  if (!btn) return;

  const id = btn.dataset.id;
  const select = tbody.querySelector(`.progress-select[data-id="${id}"]`);
  const progress = select.value;

  if (!progress) {
    showToast("Pilih progress terlebih dahulu", "warning");
    return;
  }

  // PR / PO → minta nomor
  if (progress === "PR" || progress === "PO") {
    selectedProgressId = id;
    selectedProgress   = progress;

    progressTitle.textContent =
      progress === "PR" ? "Masukkan Nomor PR" : "Masukkan Nomor PO";

    progressInput.placeholder =
      progress === "PR" ? "Contoh: PR-2026-001" : "Contoh: PO-2026-015";

    progressInput.value = "";
    progressOverlay.classList.remove("hidden");
    return;
  }

  // selain PR / PO
  window.api.updateSparepartProgress({ id, progress });
  showToast("Progress diperbarui");
  await loadData(true);
});


btnSubmit.addEventListener("click", async () => {
  const note = input.value.trim();

  if (!note) {
    showToast("Catatan admin wajib diisi", "warning");
    return;
  }

  await window.api.updateSparepartStatus({
    id: selectedId,
    status: selectedAction,
    admin_feedback: note
  });

  overlayFeed.classList.add("hidden");

  showToast(
    selectedAction === "APPROVED"
      ? "✔ Request disetujui"
      : "✖ Request ditolak"
  );

  await loadData(true);
});
progressSubmit.addEventListener("click", async () => {
  const number = progressInput.value.trim();

  if (!number) {
    showToast("Nomor wajib diisi", "warning");
    return;
  }

  await window.api.updateSparepartProgress({
    id: selectedProgressId,
    progress: selectedProgress,
    number
  });

  progressOverlay.classList.add("hidden");
  showToast("Progress berhasil diperbarui");

  await loadData(true);
});

progressCancel.addEventListener("click", () => {
  progressOverlay.classList.add("hidden");
});




btnCancel.addEventListener("click", () => {
  overlayFeed.classList.add("hidden");
});

/* ================= OVERLAY CLOSE ================= */
overlay.addEventListener("click", () => {
  overlay.style.display = "none";
  preview.src = "";
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    overlay.style.display = "none";
    overlayFeed.classList.add("hidden");
    preview.src = "";
  }
});

/* ================= FILTER ================= */
searchInput.addEventListener("input", renderTable);
statusFilter.addEventListener("change", renderTable);

/* ================= SYNC ================= */
btnSync.addEventListener("click", async () => {
  await window.api.syncSparepartRequests();
  await loadData();
});

/* ================= INIT ================= */
loadData();

// 🔄 auto refresh
setInterval(() => {
  loadData(true);
}, 15000);
