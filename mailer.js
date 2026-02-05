const nodemailer = require("nodemailer");

/* =====================================================
   MAIL TRANSPORT
===================================================== */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

/* =====================================================
   HELPERS
===================================================== */
const nowISO = () => new Date().toISOString();

const formatDate = (date) =>
  new Date(date).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });

function formatProgressValue(key, value) {
  if (!value) return "Menunggu proses";

  // PR dan PO bukan tanggal, tampilkan langsung
  if (key === "pr" || key === "po") return value;

  // Step lain diasumsikan tanggal
  return formatDate(value);
}

/* =====================================================
   PROGRESS FLOW (SINGLE SOURCE OF TRUTH)
===================================================== */
const PROGRESS_FLOW = [
  { key: "serah_terima", label: "Serah Terima Doc ke Planner" },
  { key: "pr", label: "PR Number" },
  { key: "po", label: "PO Number" },
  { key: "onsite", label: "Onsite" }
];

/* =====================================================
   CHANGE DETECTOR (ANTI SPAM)
===================================================== */
function getProgressChanges(oldP = {}, newP = {}) {
  return PROGRESS_FLOW.filter(
    ({ key }) =>
      !oldP[key] &&
      newP[key] !== null &&
      newP[key] !== undefined &&
      newP[key] !== ""
  );
}

/* =====================================================
   JOURNEY TIMELINE BUILDER (EMAIL SAFE)
===================================================== */
function buildJourneyTimeline(progress = {}) {
  const lastDoneIndex = PROGRESS_FLOW
    .map(s => Boolean(progress[s.key]))
    .lastIndexOf(true);

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px">
      ${PROGRESS_FLOW.map((step, index) => {
        const done = Boolean(progress[step.key]);
        const isActive = index === lastDoneIndex;

        return `
          <tr>
            <td width="30" valign="top" style="text-align:center">
              <div style="
                width:14px;
                height:14px;
                border-radius:50%;
                background:${done ? "#16a34a" : "#d1d5db"};
                margin:0 auto;
              "></div>

              ${
                index !== PROGRESS_FLOW.length - 1
                  ? `<div style="
                      width:2px;
                      height:28px;
                      background:${done ? "#16a34a" : "#e5e7eb"};
                      margin:0 auto;
                    "></div>`
                  : ""
              }
            </td>

            <td style="padding-bottom:18px">
              <div style="
                font-size:14px;
                font-weight:600;
                color:${isActive ? "#16a34a" : done ? "#065f46" : "#6b7280"};
              ">
                ${step.label}
              </div>

              <div style="font-size:12px;color:#9ca3af">
                ${formatProgressValue(step.key, progress[step.key])}
              </div>
            </td>
          </tr>
        `;
      }).join("")}
    </table>
  `;
}

/* =====================================================
   APPROVE CONTROLLER
===================================================== */
async function approveRequest(req, res) {
  const request = await getRequestById(req.params.id);

  // ⛔ tidak boleh approve dua kali
  if (request.progress?.approved) {
    return res.status(400).json({ message: "Request already approved" });
  }

  const progress = {
    ...(request.progress || {}),
    approved: nowISO()
  };

  await updateRequest(req.params.id, {
    status: "Approved",
    progress
  });

  await sendApproveEmail(request.requester_email, {
    request_by: request.request_by,
    mesin: request.mesin,
    nama_part: request.nama_part,
    qty: request.qty,
    foto_url: request.foto_url,
    progress
  });

  res.json({ message: "Request approved" });
}

/* =====================================================
   EMAIL: APPROVE
===================================================== */
async function sendApproveEmail(to, data) {
  if (!to) return;

  const { request_by, mesin, nama_part, qty, foto_url, progress } = data;

  await transporter.sendMail({
    from: `"Sparepart System" <${process.env.MAIL_USER}>`,
    to,
    subject: "✅ Permintaan Sparepart Disetujui",
    html: `
      <div style="font-family:Inter,Arial;background:#f3f4f6;padding:20px">
        <div style="max-width:620px;margin:auto;background:white;border-radius:14px;padding:24px">

          <h2 style="color:#16a34a">Permintaan Disetujui</h2>

          <p>Halo <b>${request_by}</b>,</p>
          <p>Permintaan sparepart Anda telah <b>DISETUJUI</b>.</p>

          <table style="width:100%;font-size:14px;margin-top:12px">
            <tr><td><b>Mesin</b></td><td>${mesin}</td></tr>
            <tr><td><b>Part</b></td><td>${nama_part}</td></tr>
            <tr><td><b>Qty</b></td><td>${qty}</td></tr>
          </table>

          ${foto_url ? `
            <img src="${foto_url}" style="
              width:100%;
              max-height:280px;
              object-fit:contain;
              margin-top:16px;
              border-radius:10px;
              border:1px solid #e5e7eb
            ">
          ` : ""}

          <h3 style="margin-top:28px">Perjalanan Status</h3>
          ${buildJourneyTimeline(progress)}

          <p style="margin-top:20px;font-size:12px;color:#9ca3af">
            Email otomatis — mohon tidak membalas.
          </p>

        </div>
      </div>
    `
  });
}

/* =====================================================
   EMAIL: PROGRESS UPDATE (AFTER APPROVE ONLY)
===================================================== */
async function sendProgressUpdateEmail(to, data, oldProgress) {
  if (!to) return;

  // ⛔ WAJIB sudah approve
 // if (!oldProgress?.approved) {
  //  console.log("⛔ Belum approve, skip progress email");
   // return;
  //}

  const { request_by, nama_part, mesin, qty, area , progress: newProgress } = data;

  const changes = getProgressChanges(oldProgress, newProgress);
  if (!changes.length) return;

  const changedStepsHTML = changes.map(s => `
    <li>
      <b>${s.label}</b> →
      <span style="color:#16a34a">
        ${formatProgressValue(s.key, newProgress[s.key])}
      </span>
    </li>
  `).join("");

  await transporter.sendMail({
    from: `"Sparepart System" <${process.env.MAIL_USER}>`,
    to,
    subject: `🔄 Update Progress Sparepart: ${nama_part}`,
    html: `
      <div style="font-family:Inter,Arial;background:#f3f4f6;padding:20px">
        <div style="max-width:620px;margin:auto;background:white;border-radius:14px;padding:24px">

          <h2>🔄 Update Progress Sparepart</h2>

          <p>Halo <b>${request_by}</b>,</p>

          <div style="
            background:#f0fdf4;
            border:1px solid #bbf7d0;
            border-radius:10px;
            padding:12px;
          ">
          <table style="width:100%;font-size:14px;margin-top:12px">
            <tr><td><b>Mesin</b></td><td>${mesin}</td></tr>
            <tr><td><b>Part</b></td><td>${nama_part}</td></tr>
            <tr><td><b>Qty</b></td><td>${qty}</td></tr>
          </table>

            <b>Perubahan Status:</b>
            <ul>${changedStepsHTML}</ul>
          </div>

          <h3 style="margin-top:24px">Perjalanan Status</h3>
          ${buildJourneyTimeline(newProgress)}

          <p style="margin-top:20px;font-size:12px;color:#9ca3af">
            Email otomatis — dikirim hanya jika ada perubahan status.
          </p>

        </div>
      </div>
    `
  });
}

/* =====================================================
   EMAIL: REJECT
===================================================== */
async function sendRejectEmail(to, data) {
  if (!to) return;

  await transporter.sendMail({
    from: `"Sparepart System" <${process.env.MAIL_USER}>`,
    to,
    subject: "❌ Permintaan Sparepart Ditolak",
    html: `
      <div style="font-family:Arial;background:#f9fafb;padding:20px">
        <div style="max-width:600px;margin:auto;background:white;border-radius:12px;padding:20px">

          <h2 style="color:#dc2626;">Permintaan Ditolak</h2>

          <p>Halo <b>${data.request_by}</b>,</p>

          <table style="width:100%">
            <tr><td><b>Mesin</b></td><td>${data.mesin}</td></tr>
            <tr><td><b>Part</b></td><td>${data.nama_part}</td></tr>
            <tr><td><b>Qty</b></td><td>${data.qty}</td></tr>
          </table>

          <div style="margin-top:15px;padding:12px;background:#fee2e2;border-radius:8px">
            <b>Catatan Admin:</b><br>
            ${data.admin_feedback}
          </div>

        </div>
      </div>
    `
  });
}

/* =====================================================
   EXPORT
===================================================== */
module.exports = {
  approveRequest,
  sendApproveEmail,
  sendProgressUpdateEmail,
  sendRejectEmail,
  nowISO
};
