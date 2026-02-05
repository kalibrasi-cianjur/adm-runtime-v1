// renderer_mtbf_cloud.js
if (!window.__mtbfCloudLoaded) {
  window.__mtbfCloudLoaded = true;

  const $ = id => document.getElementById(id);
  const scanNetInfo = $("scanNetInfo");
  const cloudScanList = $("cloudScanList");
  const scanLoader = $("scanLoader");

 async function updateNetworkStatus() {
  if (!scanNetInfo) return;

  // fallback navigator.onLine
  let online = navigator.onLine;

  // kalau ada bridge main → pakai yang real
  if (window.net?.status) {
    try {
      const res = await window.net.status();
      online = res.online;
    } catch {}
  }

  scanNetInfo.textContent = online ? "ONLINE" : "OFFLINE";
  scanNetInfo.className   = online ? "badge good" : "badge bad";
}


  window.addEventListener("online", updateNetworkStatus);
  window.addEventListener("offline", updateNetworkStatus);
  updateNetworkStatus();

  async function loadPendingCloud() {
    if (!cloudScanList) return;
    try {
      if (scanLoader) scanLoader.classList.remove("hidden");
      const queue = await window.api.loadLocalQueue();
      if (!queue || !queue.length) {
        cloudScanList.innerHTML = `<div style="opacity:.6;font-size:13px">Tidak ada antrian pending</div>`;
        return;
      }
      const normalized = queue.map(item => ({ ...item, _time: new Date(item.created_at).getTime() }));
      normalized.sort((a,b) => b._time - a._time);
      cloudScanList.innerHTML = "";
      normalized.slice(0, 50).forEach(renderCloudScanItem);

      // optionally try syncing local queue items to supabase (if you want)
      // we won't push here because main process's mtbf:add already upserts to supabase when user saves
    } catch (err) {
      console.error(err);
    } finally {
      if (scanLoader) scanLoader.classList.add("hidden");
    }
  }

  function renderCloudScanItem(data) {
    const createdTime = new Date(data.created_at).getTime();
    const div = document.createElement("div");
    div.className = "card cloud-item";
    div.dataset.id = data.id;
    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center">
        <div>
          <div><strong>${data.nama_part || "-"}</strong></div>
          <div style="font-size:12px;color:#9fb0c2">Mesin: ${data.mesin || '-'} | Area: ${data.area || '-'} | Dept: ${data.namaDept || '-'}</div>
          <div style="font-size:11px;color:#9fb0c2">${new Date(createdTime).toLocaleString()}</div>
        </div>
        <div style="display:flex; gap:8px">
          <button class="btn-confirm" type="button">✅</button>
          <button class="btn-reject ghost" type="button">❌</button>
        </div>
      </div>
    `;
    const [confirmBtn, rejectBtn] = div.querySelectorAll("button");
    confirmBtn.onclick = async () => {
      await processScan(data.id, "CONFIRM");
    };
    rejectBtn.onclick = async () => {
      await processScan(data.id, "REJECT");
    };
    cloudScanList.appendChild(div);
  }

  async function processScan(localId, action) {
    if (!localId) return alert("ID tidak ditemukan");
    try {
      if (scanLoader) scanLoader.classList.remove("hidden");
      const res = await window.api.processCloudScan({ localId, action });
      if (!res?.ok) {
        alert(res?.message || "Gagal");
        return;
      }
      if (action === "CONFIRM") {
        // reload local mtbf list
        window.dispatchEvent(new Event("mtbf:reload"));
      }
      // remove from UI
      const el = document.querySelector(`.cloud-item[data-id="${localId}"]`);
      if (el) el.remove();
    } catch (err) {
      console.error(err);
      alert("Error saat proses");
    } finally {
      if (scanLoader) scanLoader.classList.add("hidden");
    }
  }

  // listen for main broadcast of new cloud scans
  window.api.onCloudScan(() => {
    // small delay to allow DB inserts
    setTimeout(loadPendingCloud, 200);
  });

  window.api.onSyncStart(() => {
    if (scanLoader) scanLoader.classList.remove("hidden");
  });
  window.api.onSyncDone(() => {
    if (scanLoader) scanLoader.classList.add("hidden");
  });

  // init
  loadPendingCloud();
}
