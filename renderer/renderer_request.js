document.addEventListener("DOMContentLoaded", loadAdmin);

async function loadAdmin() {
  const table = document.getElementById("adminList");

  const { data } = await window.api.supabase
    .from("sparepart_requests")
    .select("*")
    .order("created_at", { ascending: false });

  table.innerHTML = "";

  data.forEach(r => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${r.mesin}</td>
      <td>${r.nama_part}</td>
      <td>${r.qty}</td>
      <td>${r.request_by} <br> <small>${r.request_by_email}</small></td>
      <td>${r.status}</td>
      <td>
        <button class="approveBtn" data-id="${r.id}">Approve</button>
        <button class="rejectBtn" data-id="${r.id}">Reject</button>
      </td>
    `;

    table.appendChild(tr);
  });
tbody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-id]");
  if (!btn) return;

  const id = btn.dataset.id;
  const status = btn.dataset.status;

  if (!confirmAction(status)) return;

  // 🔒 disable semua tombol di row
  const tr = btn.closest("tr");
  tr.querySelectorAll("button").forEach(b => b.disabled = true);

  btn.textContent = "⏳";

  try {
    await window.api.updateSparepartStatus(id, status);

    // ⚡ update UI langsung (tanpa reload)
    const statusCell = tr.querySelector(".status");
    statusCell.textContent = status;
    statusCell.className = `status ${status}`;

    tr.classList.remove("new-row");

    showToast(`Request ${status}`, "success");
  } catch (err) {
    console.error(err);
    showToast("Gagal update status", "error");

    tr.querySelectorAll("button").forEach(b => b.disabled = false);
    btn.textContent = status === "APPROVED" ? "✔" : "✖";
  }
});


function confirmAction(status) {
  return confirm(
    status === "APPROVED"
      ? "Approve permintaan sparepart ini?"
      : "Reject permintaan sparepart ini?"
  );
}


// ======================= APPROVE =======================
async function approveRequest(id) {
  await window.api.supabase
    .from("sparepart_requests")
    .update({ status: "APPROVED" })
    .eq("id", id);

  await sendEmailApprove(id);
  loadAdmin();
}

// ======================= REJECT =======================
let rejectID = null;

function openRejectModal(id) {
  rejectID = id;
  document.getElementById("rejectModal").classList.remove("hidden");
}

document.getElementById("btnSendReject").addEventListener("click", async () => {
  const reason = document.getElementById("rejectReason").value;
  const fileInput = document.getElementById("rejectPhotoInput");

  let photoRejectUrl = "";

  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    const fp = `reject/${Date.now()}_${file.name}`;

    const { data } = await window.api.supabase.storage
      .from("Photos")
      .upload(fp, file);

    photoRejectUrl = window.api.supabase.storage
      .from("Photos")
      .getPublicUrl(fp).data.publicUrl;
  }

  await window.api.supabase
    .from("sparepart_requests")
    .update({
      status: "REJECTED",
      admin_feedback: reason,
      admin_reject_photo_url: photoRejectUrl
    })
    .eq("id", rejectID);

  await sendEmailReject(rejectID);

  document.getElementById("rejectModal").classList.add("hidden");
  loadAdmin();
});
