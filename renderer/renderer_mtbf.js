// renderer_mtbf.js
document.addEventListener("DOMContentLoaded", () => {
  const mtbfTable = document.getElementById('mtbfTable');
  const machineList = document.getElementById('machineList');
  const btnExport = document.getElementById('btnExport');
  const btnImport = document.getElementById('btnImport');
  const importFile = document.getElementById('importFile');
  const form = document.getElementById('mtbfForm');

  let rows = [];
  let editId = null;

  async function loadFromLocal() {
    try {
      rows = await window.api.mtbf.load();
      if (!Array.isArray(rows)) rows = [];
      render();
    } catch (err) {
      console.error("Gagal load MTBF:", err);
      alert("Gagal load data MTBF");
    }
  }

  function render() {
    mtbfTable.innerHTML = "";
    machineList.innerHTML = "";

    for (const r of rows) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.mesin || '-'}</td>
        <td>${r.nama_part || '-'}</td>
        <td>${r.area || '-'}</td>
        <td>${r.pic || '-'}</td>
        <td>${r.namaDept || '-'}</td>
        <td>${r.foto_url ? `<img src="${r.foto_url}" width="50" />` : '-'}</td>
        <td>${r.created_at || '-'}</td>
        <td>
          <button class="ghost" data-edit="${r.id}">Edit</button>
          <button class="ghost" data-del="${r.id}">Hapus</button>
        </td>
      `;
      mtbfTable.appendChild(tr);
    }

    // attach handlers
    mtbfTable.querySelectorAll('[data-edit]').forEach(btn => btn.onclick = () => editRow(btn.dataset.edit));
    mtbfTable.querySelectorAll('[data-del]').forEach(btn => btn.onclick = () => deleteRow(btn.dataset.del));

    // sidebar quick list
    const max = 10;
    rows.slice(0, max).forEach(r => {
      const div = document.createElement('div');
      div.className = 'machine-item';
      div.innerHTML = `<strong>${r.mesin || '-'}</strong>
                       <div class="qv-sub">${r.nama_part || '-'}</div>
                       <div class="qv-sub">${r.area || '-'}</div>`;
      div.onclick = () => editRow(r.id);
      machineList.appendChild(div);
    });
  }

  async function saveNew(payload) {
    await window.api.mtbf.add(payload);
    await loadFromLocal();
  }

  async function updateRowDB(id, payload) {
    await window.api.mtbf.update(id, payload);
    await loadFromLocal();
  }

  async function deleteRowDB(id) {
    await window.api.mtbf.delete(id);
    await loadFromLocal();
  }

  function editRow(id) {
    const r = rows.find(x => x.id === id);
    if (!r) return;
    editId = id;
    document.getElementById('mesin').value = r.mesin || '';
    document.getElementById('part').value = r.nama_part || '';
    document.getElementById('area').value = r.area || '';
    document.getElementById('pic').value = r.pic || '';
    document.getElementById('namaDept').value = r.namaDept || '';
    document.getElementById('foto_url').value = r.foto_url || '';
  }

  async function deleteRow(id) {
    if (!confirm("Hapus data ini?")) return;
    await deleteRowDB(id);
    await loadFromLocal();
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        id: editId || cryptoRandomId(),
        mesin: document.getElementById('mesin').value.trim(),
        nama_part: document.getElementById('part').value.trim(),
        area: document.getElementById('area').value.trim(),
        pic: document.getElementById('pic').value.trim(),
        namaDept: document.getElementById('namaDept').value.trim(),
        foto_url: document.getElementById('foto_url').value.trim(),
        created_at: new Date().toISOString()
      };

      try {
        if (editId) {
          await updateRowDB(editId, payload);
          editId = null;
        } else {
          await saveNew(payload);
        }
        form.reset();
      } catch (err) {
        console.error(err);
        alert("Gagal simpan data");
      }
    });
  }

  btnExport.onclick = async () => {
    const data = await window.api.mtbf.export();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'mtbf.json'; a.click();
    URL.revokeObjectURL(url);
  };

  btnImport.onclick = () => importFile.click();
  importFile.onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const txt = await f.text();
      const json = JSON.parse(txt);
      if (!Array.isArray(json)) throw new Error('format invalid');
      await window.api.mtbf.import(json);
      await loadFromLocal();
    } catch (err) {
      alert('Gagal import: ' + err.message);
    }
  };

  // helper id
  function cryptoRandomId() { return 'id_' + Math.random().toString(36).slice(2,9); }

  // init
  loadFromLocal();

  // listen for cloud add (renderer_mtbf_cloud dispatches mtbf:add)
  window.addEventListener('mtbf:add', (e) => {
    // e.detail contains payload
    // we re-load local db to reflect changes
    loadFromLocal();
  });

  // allow renderer to request reload
  window.addEventListener('mtbf:reload', () => loadFromLocal());
});
