 require("dotenv").config();
  const { app, BrowserWindow, ipcMain, dialog , Tray, Notification} = require("electron");
  const { createClient } = require("@supabase/supabase-js");
  const { sendRejectEmail, sendApproveEmail, sendProgressUpdateEmail } = require("./mailer");
  const { autoUpdater } = require("electron-updater");
  const log = require("electron-log");
  const { Menu } = require("electron");
  const path = require("path");
  const fs = require("fs");
  const Database = require("better-sqlite3");
  const dns = require("dns");
  const bcrypt = require("bcryptjs");
  const XLSX = require("xlsx");
  const now = new Date();
  const os = require("os");
  const { pathToFileURL } = require('url');
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const timeStr = `${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}-${String(now.getSeconds()).padStart(2, "0")}`;
  const { PDFDocument, rgb, degrees, StandardFonts } = require('pdf-lib');
  app.setAppUserModelId("ERP SYSTEM");
  // Pastikan folder database ada

/* LOCAL DB
  const dbFolder = path.join(__dirname, "database");
  if (!fs.existsSync(dbFolder)) {
  fs.mkdirSync(dbFolder, { recursive: true });
  }
  const dbPath = path.join(dbFolder, "spareparts.db");
  const logDir = path.join(__dirname, "logs");
  // Buka/buat database
  const db = new Database(dbPath);

let currentUser = null;
console.log("DEBUG db in handler:", typeof db, db?.constructor?.name);
*/

//installer db

  const dataDir = app.getPath("userData");

const dbFolder = path.join(dataDir, "database");
const logDir = path.join(dataDir, "logs");

if (!fs.existsSync(dbFolder)) {
  fs.mkdirSync(dbFolder, { recursive: true });
}

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const dbPath = path.join(dbFolder, "spareparts.db");
const db = new Database(dbPath);

console.log("DB PATH:", dbPath);

// ------------------- SUPABASE SETUP -------------------
const SUPABASE_URL = "https://hlleyvltrlopiagyrvbr.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsbGV5dmx0cmxvcGlhZ3lydmJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NjE3NTksImV4cCI6MjA4MDQzNzc1OX0.L_8J118cgDWAgxe4B7t6RxU3gjEXzKWDvj53cIMFX7k"; // gunakan service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);


  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
  const activityLog = path.join(logDir, "activity_log.txt");
  const errorLog = path.join(logDir, "error_log.txt");
console.log("MAIL USER:", process.env.MAIL_USER);

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "info";
autoUpdater.autoDownload = false; // biar user konfirmasi dulu



// auto update
function initAutoUpdater(win) {
  autoUpdater.on("checking-for-update", () => {
    win.webContents.send("update-status", "checking");
  });

  autoUpdater.on("update-available", (info) => {
    win.webContents.send("update-status", "available", info);
  });

  autoUpdater.on("update-not-available", () => {
    win.webContents.send("update-status", "not-available");
  });

  autoUpdater.on("error", (err) => {
    win.webContents.send("update-status", "error", err.message);
  });

  autoUpdater.on("download-progress", (progress) => {
    win.webContents.send("update-status", "progress", progress);
  });

  autoUpdater.on("update-downloaded", () => {
    win.webContents.send("update-status", "downloaded");
  });

  autoUpdater.checkForUpdates();
}







  // Buat tabel kalau belum ada
  db.exec(`

  CREATE TABLE IF NOT EXISTS spareparts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tanggal TEXT,
    week TEXT,
    nomor_material TEXT,
    nama_sparepart TEXT,
    quantity INTEGER,
    function_location TEXT,
    sub_location TEXT,
    vendor TEXT,
    harga_satuan INTEGER,
    total_harga INTEGER,
    nomor_pr TEXT,
    nomor_po TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

    CREATE INDEX IF NOT EXISTS idx_spareparts_nomor_material
  ON spareparts(nomor_material);

  CREATE INDEX IF NOT EXISTS idx_spareparts_nama_sparepart
  ON spareparts(nama_sparepart);
  `);

  db.prepare(`
  CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kode TEXT NOT NULL,
    nama TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`).run();

db.exec(`
-- ===============================
-- CREATE TABLE
-- ===============================
CREATE TABLE IF NOT EXISTS master_kode (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  kode TEXT NOT NULL,
  material TEXT NOT NULL,

  stock_value REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'IDR',

  qty REAL NOT NULL,
  satuan TEXT NOT NULL,
  updated_at TEXT,
  synced_at TEXT,
  deleted_at TEXT,

  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- ===============================
-- UNIQUE INDEX (WAJIB)
-- ===============================
CREATE UNIQUE INDEX IF NOT EXISTS uk_master_kode_kode
ON master_kode(kode);

-- ===============================
-- INDEX UNTUK SEARCH
-- ===============================
CREATE INDEX IF NOT EXISTS idx_master_kode_material
ON master_kode(material);



-- ===============================
-- INDEX SYNC (SETELAH KOLOM ADA)
-- ===============================
CREATE INDEX IF NOT EXISTS idx_master_sync
ON master_kode(updated_at, synced_at);

  CREATE TABLE IF NOT EXISTS sync_state (
  key TEXT PRIMARY KEY,
  value TEXT
);

INSERT OR IGNORE INTO sync_state
VALUES ('master_kode_last_pull', '1970-01-01T00:00:00Z');

`);



  //try {
  // db.prepare("ALTER TABLE spareparts ADD COLUMN nomor_pr TEXT").run();
  //} catch {}
  //try {
  // db.prepare("ALTER TABLE spareparts ADD COLUMN nomor_po TEXT").run();
  //} catch {}


  // Buat tabel user jika belum ada
  db.exec(`
  CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password_hash TEXT,
  role TEXT DEFAULT 'user'
  );
  `);

  // Buat tabel area dan lokasi
 db.exec(`
  CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  function_location TEXT,
  sub_location TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
  );
  `);


  ////RMC

  // Tabel RMC untuk menyimpan nominal tahunan
  db.exec(`
  CREATE TABLE IF NOT EXISTS RMC (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER UNIQUE,
  nominal INTEGER
  );
  `);

  ////////////


  // Tabel Karyawan
  db.exec(`
  CREATE TABLE IF NOT EXISTS karyawan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama TEXT NOT NULL,
    nik INTEGER,
    jabatan TEXT,
    durasi_kontrak INTEGER,
    status TEXT,
    tanggal_join TEXT DEFAULT (date('now')),
    masa_kerja TEXT,
    habis_kontrak TEXT,
    durasi_label TEXT,
    attitude INTEGER DEFAULT 0,
  absensi INTEGER DEFAULT 0,
  operasional INTEGER DEFAULT 0,
    data BLOB,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );
  `);


db.exec(`
CREATE TABLE IF NOT EXISTS karyawan_performance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nik INTEGER NOT NULL,
  nama TEXT,
  attitude INTEGER,
  absensi INTEGER,
  operasional INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS perpanjangan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nik INTEGER NOT NULL,
  durasi_bulan INTEGER NOT NULL,
  tanggal_mulai TEXT NOT NULL,
  tanggal_selesai TEXT,
  kontrak_ke INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS mtbf (
    id TEXT PRIMARY KEY,
    nama_part TEXT,
    mesin TEXT,
    area TEXT,
    pic TEXT,
    namaDept TEXT,
    foto_url TEXT,
    created_at TEXT
  );
`);

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_mesin_part_area
  ON mtbf(mesin, nama_part, namaDept);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS mtbf_scan_queue_local (
    id TEXT PRIMARY KEY,
    cloud_id TEXT UNIQUE,
    nama_part TEXT,
    mesin TEXT,
    area TEXT,
    pic TEXT,
    namaDept TEXT,
    foto_url TEXT,
    processed_at TEXT,
    status TEXT,
    created_at TEXT
  );
`);

db.exec(`
   CREATE TABLE IF NOT EXISTS local_sparepart_requests (
  id TEXT PRIMARY KEY,

  mesin TEXT,
  nama_part TEXT,
  area TEXT,
  sub_area TEXT,

  qty INTEGER,

  alasan TEXT,
  foto_url TEXT,

  request_by TEXT,
  request_by_email TEXT,

  admin_feedback TEXT,
  synced INTEGER DEFAULT 0,
  updated_at TEXT,
  progress TEXT,


  pr_number TEXT,
  po_number TEXT,
  status TEXT DEFAULT 'PENDING',
  last_notified_progress TEXT,
  progress_json TEXT,

  created_at TEXT
);
`);

  console.log("✅ Local table: local_sparepart_requests siap");



db.exec(`
CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kode INTEGER UNIQUE,
  nama_material TEXT,
  satuan TEXT,
  lokasi TEXT,
  Quantity INTEGER,
  exported INTEGER DEFAULT 0,
  last_update TEXT
);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS inventory_logs(
   id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,            -- DELETE / INSERT / UPDATE
  kode TEXT NOT NULL,
  detail TEXT,
  source TEXT DEFAULT 'ui',         -- ui / sync / api
  created_at TEXT NOT NULL
  );
`);


db.exec(`
CREATE TABLE IF NOT EXISTS overtime (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nik INTEGER NOT NULL,
  nama TEXT NOT NULL,
  status TEXT,
  kategori TEXT,          -- STAFF / NON_STAFF
  tanggal TEXT NOT NULL,
  jenis_hari TEXT,
  jam REAL,
  gapok REAL,
  mh REAL,
  tarif REAL,
  total REAL,
  keterangan TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS config_lembur (
  nik INTEGER PRIMARY KEY,
  nama TEXT NOT NULL,
  status TEXT NOT NULL,
  kategori TEXT NOT NULL,   -- STAFF / NON_STAFF
  nilai REAL NOT NULL,      -- STAFF = gapok, NON_STAFF = tarif per MH
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);
`);

// ===================== WEEK CONFIG DB =====================
db.exec(`
CREATE TABLE IF NOT EXISTS week_config (
  id INTEGER PRIMARY KEY,
  start_day INTEGER NOT NULL,       -- 0=Minggu, 1=Senin, ...
  first_week_rule TEXT NOT NULL     -- CONTAIN_JAN1 | FIRST_FULL_WEEK
);
`);

// ===================== COMPANY WEEK CALENDAR =====================
db.exec(`
CREATE TABLE IF NOT EXISTS company_week_calendar (
  year INTEGER PRIMARY KEY,
  week1_start TEXT NOT NULL,
  week1_end TEXT NOT NULL
);
`);



function hasProgressChanged(oldProgress = {}, newProgress = {}) {
  const keys = ["approved", "serah_terima", "onsite", "pr", "po"];

  return keys.some(key => {
    return (oldProgress[key] || null) !== (newProgress[key] || null);
  });
}

function saveLastNotifiedProgress(id, progress) {
  console.log("DEBUG db type:", typeof db, db?.constructor?.name);

  return db
    .prepare(`
      UPDATE local_sparepart_requests
      SET last_notified_progress = ?
      WHERE id = ?
    `)
    .run(JSON.stringify(progress), id);
}

const weekRow = db.prepare(`SELECT COUNT(*) as cnt FROM week_config`).get();
if (weekRow.cnt === 0) {
  db.prepare(`
    INSERT INTO week_config (id, start_day, first_week_rule)
    VALUES (1, 1, 'CONTAIN_JAN1')
  `).run();
}

const weekDB = {
  getWeekConfig() {
    return db.prepare(`
      SELECT start_day, first_week_rule
      FROM week_config
      WHERE id = 1
    `).get();
  },

  saveWeekConfig({ start_day, first_week_rule }) {
    return db.prepare(`
      UPDATE week_config
      SET start_day = ?, first_week_rule = ?
      WHERE id = 1
    `).run(start_day, first_week_rule);
  }
};

const companyWeekDB = {
  getCompanyWeekRule(year) {
    return db.prepare(`
      SELECT year, week1_start, week1_end
      FROM company_week_calendar
      WHERE year = ?
    `).get(year);
  },

  saveCompanyWeekRule({ year, week1_start, week1_end }) {
    return db.prepare(`
      INSERT INTO company_week_calendar (year, week1_start, week1_end)
      VALUES (?, ?, ?)
      ON CONFLICT(year) DO UPDATE SET
        week1_start = excluded.week1_start,
        week1_end   = excluded.week1_end
    `).run(year, week1_start, week1_end);
  }
};

db.exec(`
CREATE TABLE IF NOT EXISTS sales_monthly (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bulan TEXT NOT NULL,           -- nama bulan, misal 'Januari', 'Februari'
    tahun INTEGER NOT NULL,
    sales_target INTEGER DEFAULT 0,
    sales_target_week INTEGER DEFAULT 0,
    aktual_gr INTEGER DEFAULT 0,
    week_by_month INTEGER DEFAULT 4,
    budget_bulan INTEGER DEFAULT 0,
    budget_week INTEGER DEFAULT 0,
    final_budget INTEGER DEFAULT 0,
    rasio INTEGER DEFAULT 0,
    realisasi_overtime INTEGER DEFAULT 0,
    persentase INTEGER DEFAULT 0,
    budget_by_ci INTEGER DEFAULT 0,
    selisih_budget_fa INTEGER DEFAULT 0,
    selisih_budget_ci INTEGER DEFAULT 0,
    man_hour REAL DEFAULT 0,
    nominal INTEGER DEFAULT 0,
    rasio_weekly INTEGER DEFAULT 0,
    rasio_average INTEGER DEFAULT 0,
    bobot REAL DEFAULT 0,
    week_now INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

/*
//======================admin dashboard for requests========================//
async function syncSparepartRequestsFromSupabase() {
  const lastSync = db.prepare(`
    SELECT value FROM sync_state WHERE key='sparepart_last_sync'
  `).get().value;

  const { data, error } = await supabase
    .from("sparepart_requests")
    .select("*")
    .gt("created_at", lastSync)
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!data || data.length === 0) {
    console.log("ℹ️ Tidak ada data baru dari Supabase");
    return;
  }

  const stmt = db.prepare(`
    INSERT INTO local_sparepart_requests
    (id, mesin, nama_part, area, qty, alasan, foto_url,
     request_by, request_by_email,admin_feedback, status, created_at)
    VALUES
    (@id, @mesin, @nama_part, @area, @qty, @alasan, @foto_url,
     @request_by, @request_by_email,@admin_feedback, @status, @created_at)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status
  `);

  const tx = db.transaction(rows => {
    rows.forEach(r => stmt.run(r));
  });

  tx(data);

  const newest = data[data.length - 1].created_at;
  db.prepare(`
    UPDATE sync_state SET value=? WHERE key='sparepart_last_sync'
  `).run(newest);

  console.log(`✅ Sync ${data.length} request dari Supabase`);
}


//===============================end this shit=======================================//
*/



const checkUser = db.prepare("SELECT COUNT(*) AS count FROM users WHERE username='admin'").get();
if (checkUser.count === 0) {
    const hash = bcrypt.hashSync("kiel", 10);
    db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)").run("admin", hash, "admin");
    console.log("✅ Admin created: admin / kiel");
}


  let mainWindow;
  let isQuiting = false;
  let tray;
  let loginWindow;
  let isVisitorMode = false;
  let currentScreen = "purchase";
  let isLoggedIn = false;


  let syncing = false;

ipcMain.on("screen-changed", (event, screen) => {
  console.log("📌 screen-changed diterima:", screen);
  currentScreen = screen.toLowerCase();
  console.log("📌 currentScreen di-set menjadi:", currentScreen);
});



function activity_log({ action, file, range, user, mac, time }) {
  const logEntry = `[${time}] ${action} | file: ${file} | range: ${range} | user: ${user} | mac: ${mac}\n`;
  fs.appendFileSync(activityLog, logEntry, "utf-8");
}

function error_log(error) {
  const logEntry = `[${new Date().toLocaleString()}] ${error.stack || error}\n`;
  fs.appendFileSync(errorLog, logEntry, "utf-8");
}


function getMacPdf() {
  const nets = os.networkInterfaces();
  for (let name of Object.keys(nets)) {
    for (let net of nets[name]) {
      if (net.mac && net.mac !== "00:00:00:00:00:00") {
        return net.mac;
      }
    }
  }
  return "UNKNOWN-MAC";
}

function getUserPdf() {
  try {
    return os.userInfo().username || "UNKNOWN-USER";
  } catch {
    return "UNKNOWN-USER";
  }
}

function getWIBDateTime() {
  const now = new Date();

  // ambil waktu lokal WIB dari sistem
  const wib = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" })
  );

  const pad = (n) => n.toString().padStart(2, "0");

  return `${wib.getFullYear()}-${pad(wib.getMonth() + 1)}-${pad(wib.getDate())} ` +
         `${pad(wib.getHours())}:${pad(wib.getMinutes())}:${pad(wib.getSeconds())}`;
}


function broadcast(event, payload) {
  if (mainWindow && mainWindow.webContents) mainWindow.webContents.send(event, payload);
}

function broadcastOnline() { broadcast("net:online"); }
function broadcastOffline() { broadcast("net:offline"); }
function broadcastSyncStart() { broadcast("mtbf:sync-start"); }
function broadcastSyncDone() { broadcast("mtbf:sync-done"); }

// ------------- SYNC: Supabase -> local queue -------------
let _syncRunning = false;
async function syncCloudToLocal(limit = 20) {
  if (_syncRunning) return;
  _syncRunning = true;
  broadcastSyncStart();
  try {
    // ambil record terbaru dari Supabase (limit)
    const { data: rows, error } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Supabase fetch error:", error);
      return;
    }
    if (!rows || rows.length === 0) return;

    const now = new Date().toISOString();

    for (const row of rows) {
      const localId = row.id; // gunakan id cloud sebagai id lokal agar konsisten

      // masukkan atau replace ke queue lokal sebagai pending jika belum ada
      try {
        db.prepare(`
          INSERT OR REPLACE INTO mtbf_scan_queue_local
          (id, cloud_id, nama_part, mesin, area, pic, namaDept, foto_url, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          localId,
          row.id,
          row.nama_part || '',
          row.mesin || '',
          row.area || '',
          row.pic || '',
          row.namaDept || '',
          row.foto_url || '',
          'PENDING',
          row.created_at || now
        );

        // kirim notifikasi ke renderer supaya tampil di cloud queue
        broadcast("mtbf:cloud-scan", {
          id: localId,
          cloud_id: row.id,
          nama_part: row.nama_part,
          mesin: row.mesin,
          area: row.area,
          pic: row.pic,
          namaDept: row.namaDept,
          foto_url: row.foto_url,
          created_at: row.created_at || now,
          status: 'PENDING'
        });
      } catch (err) {
        console.warn("insert queue error", err?.message || err);
      }
    }
  } catch (err) {
    console.error("Sync error:", err);
  } finally {
    broadcastSyncDone();
    _syncRunning = false;
  }
}

// ------------- PERIODIC SYNC -------------
let syncIntervalId = null;
function startPeriodicSync() {
  // sync now once
  syncCloudToLocal(20).catch(() => {});
  // kemudian interval (misal tiap 60 detik)
  if (syncIntervalId) clearInterval(syncIntervalId);
  syncIntervalId = setInterval(() => {
    syncCloudToLocal(20).catch(() => {});
  }, 60_000);
}

function getNow() {
  return new Date().toISOString();
}


// ------------- IPC HANDLERS (MTBF & Queue) -------------
ipcMain.handle("mtbf:load-local-queue", () => {
  return db.prepare(`
    SELECT *
    FROM mtbf_scan_queue_local
    WHERE status = 'PENDING'
    ORDER BY created_at DESC
    LIMIT 50
  `).all();
});

ipcMain.handle("mtbf:load-cloud-pending", async () => {
  // fallback: juga bisa panggil supabase langsung
  const { data, error } = await supabase.from("mtbf").select("*").order("created_at", { ascending: false }).limit(20);
  if (error) {
    return { error };
  }
  return data;
});

ipcMain.handle("mtbf:process-cloud-scan", async (event, { localId, action }) => {
  if (!localId) return { ok: false, message: "Invalid id" };
  const now = new Date().toISOString();
  const row = db.prepare("SELECT * FROM mtbf_scan_queue_local WHERE id = ?").get(localId);
  if (!row) return { ok: false, message: "Not found" };

  if (action === "REJECT") {
    db.prepare("UPDATE mtbf_scan_queue_local SET status = ?, processed_at = ? WHERE id = ?").run("REJECTED", now, localId);
    try {
      await supabase.from("mtbf").update({ status: "REJECTED" }).eq("id", row.cloud_id);
    } catch (e) { /* ignore */ }
    return { ok: true };
  }

  // CONFIRM: insert to local mtbf table (if not exists) and mark queue confirmed, then update supabase status
  try {
    db.prepare(`
      INSERT INTO mtbf (id, nama_part, mesin, area, pic, namaDept, foto_url, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        nama_part = excluded.nama_part,
        mesin = excluded.mesin,
        area = excluded.area,
        pic = excluded.pic,
        namaDept = excluded.namaDept,
        foto_url = excluded.foto_url,
        created_at = excluded.created_at
    `).run(
      row.cloud_id,
      row.nama_part || '',
      row.mesin || '',
      row.area || '',
      row.pic || '',
      row.namaDept || '',
      row.foto_url || '',
      row.created_at || now
    );

    db.prepare("UPDATE mtbf_scan_queue_local SET status = ?, processed_at = ? WHERE id = ?").run("CONFIRMED", now, localId);

    try {
      await supabase.from("reports").update({ status: "CONFIRMED" }).eq("id", row.cloud_id);
    } catch (e) { /* ignore */ }

    return { ok: true };
  } catch (err) {
    console.error("processCloudScan error:", err);
    return { ok: false, message: err.message || "error" };
  }
});

// MTBF CRUD (local sqlite + upsert to supabase)
ipcMain.handle("mtbf:add", async (event, payload) => {
  const id = payload.id || (payload.mesin ? String(payload.mesin).replace(/\s+/g, "_").toUpperCase() + "_" + Date.now() : cryptoRandomId());
  const now = payload.created_at || new Date().toISOString();

  db.prepare(`
    INSERT OR REPLACE INTO mtbf
    (id, nama_part, mesin, area, pic, namaDept, foto_url, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    payload.nama_part || '',
    payload.mesin || '',
    payload.area || '',
    payload.pic || '',
    payload.namaDept || '',
    payload.foto_url || '',
    now
  );

  // upsert to supabase as single source of truth (we assume supabase table exists)
  try {
    await supabase.from("mtbf").upsert([{
      id,
      nama_part: payload.nama_part || '',
      mesin: payload.mesin || '',
      area: payload.area || '',
      pic: payload.pic || '',
      namaDept: payload.namaDept || '',
      foto_url: payload.foto_url || '',
      created_at: now
    }]);
  } catch (err) {
    console.warn("Supabase upsert failed:", err?.message || err);
  }

  return { ok: true, id };
});

ipcMain.handle("mtbf:load", () => {
  return db.prepare("SELECT * FROM mtbf ORDER BY created_at DESC").all();
});

ipcMain.handle("mtbf:update", async (event, id, payload) => {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE mtbf SET
      nama_part = ?, mesin = ?, area = ?, pic = ?, namaDept = ?, foto_url = ?, created_at = ?
    WHERE id = ?
  `);
  const res = stmt.run(
    payload.nama_part || '',
    payload.mesin || '',
    payload.area || '',
    payload.pic || '',
    payload.namaDept || '',
    payload.foto_url || '',
    payload.created_at || now,
    id
  );

  try {
    await supabase.from("reports").update({
      nama_part: payload.nama_part || '',
      mesin: payload.mesin || '',
      area: payload.area || '',
      pic: payload.pic || '',
      namaDept: payload.namaDept || '',
      foto_url: payload.foto_url || '',
      created_at: payload.created_at || now
    }).eq("id", id);
  } catch (e) { /* ignore */ }

  return { ok: true, changes: res.changes };
});

ipcMain.handle("mtbf:delete", async (event, id) => {
  const del = db.prepare("DELETE FROM mtbf WHERE id = ?").run(id);
  try {
    await supabase.from("mtbf").delete().eq("id", id);
  } catch (e) {}
  return { ok: true, changes: del.changes };
});

ipcMain.handle("mtbf:import", (event, list) => {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO mtbf
    (id, nama_part, mesin, area, pic, namaDept, foto_url, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const now = new Date().toISOString();
  const trx = db.transaction(rows => {
    for (const r of rows) {
      insert.run(
        r.id || cryptoRandomId(),
        r.nama_part || '',
        r.mesin || '',
        r.area || '',
        r.pic || '',
        r.namaDept || '',
        r.foto_url || '',
        r.created_at || now
      );
    }
  });
  trx(list || []);
  // optionally push to supabase in batch (omitted for brevity)
  return { imported: (list || []).length };
});

ipcMain.handle("mtbf:export", () => {
  return db.prepare("SELECT * FROM mtbf ORDER BY created_at DESC").all();
});

ipcMain.handle("mtbf:debug-local-queue", () => {
  return db.prepare("SELECT * FROM mtbf_scan_queue_local ORDER BY created_at DESC LIMIT 200").all();
});

// helper random id
function cryptoRandomId() {
  return 'id_' + Math.random().toString(36).slice(2, 9);
}

// optional manual trigger for testing from renderer
ipcMain.handle("mtbf:trigger-sync", async () => {
  await syncCloudToLocal(50);
  return { ok: true };
});

// network broadcast (app-level)
setInterval(() => {
  // broadcast online/offline based on whether supabase is reachable
  supabase
    .from("mtbf")
    .select("id")
    .limit(1)
    .then(res => {
      if (res?.error) broadcastOffline();
      else broadcastOnline();
    }).catch(() => broadcastOffline());
}, 30_000);


//=====================================================
// History.html
//=====================================================
ipcMain.handle("history:load", () => {
  return db.prepare(`
    SELECT *
    FROM mtbf_scan_queue_local
    ORDER BY created_at DESC
  `).all();
});
//=============================END=================================//


function mapSafe(row) {
  return {
    id: String(row.id),
    mesin: String(row.mesin ?? ""),
    nama_part: String(row.nama_part ?? ""),
    area: String(row.area ?? ""),
    qty: Number(row.qty ?? 0),
    alasan: String(row.alasan ?? ""),
    foto_url: String(row.foto_url ?? ""),
    request_by: String(row.request_by ?? ""),
    request_by_email: String(row.request_by_email ?? ""),
    status: String(row.status ?? "PENDING"),
    created_at: String(row.created_at ?? "")
  };
}


async function syncSparepartRequestsFromSupabase() {
  const { data, error } = await supabase
    .from("sparepart_requests")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("❌ SUPABASE FETCH ERROR:", error);
    return;
  }

  if (!data || data.length === 0) {
    console.log("ℹ️ Supabase ada tapi kosong");
    return;
  }

  console.log(`⬇️ Dapat ${data.length} data dari Supabase`);

  const stmt = db.prepare(`
    INSERT INTO local_sparepart_requests
    (id, mesin, nama_part, area, qty, alasan, foto_url,
     request_by, request_by_email, status, created_at)
    VALUES
    (@id, @mesin, @nama_part, @area, @qty, @alasan, @foto_url,
     @request_by, @request_by_email, @status, @created_at)
    ON CONFLICT(id) DO NOTHING
  `);

  const tx = db.transaction(rows => {
    rows.forEach(r => stmt.run(r));
  });

  tx(data);

  console.log("✅ Data masuk ke local");
}

async function syncAllFromSupabase() {
  const { data, error } = await supabase
    .from("sparepart_requests")
    .select("*")
    .order("id", { ascending: true });

  if (!error) {
    data.forEach(row => syncToLocalSparepart(row));
    console.log("🔄 Semua data sinkron dari Supabase ke Local");
  }
}


ipcMain.handle("send-sparepart-request", async (event, payload) => {
  try {

    let foto_url = "";

    // ===== 1. Upload Foto ke Supabase Storage =====
    if (payload.file) {
      const fileName = `sparepart_request/${Date.now()}_${payload.file.name}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("Photos")
        .upload(fileName, Buffer.from(payload.file.buffer), {
          contentType: payload.file.type
        });

      if (uploadError) {
        console.log("Upload error:", uploadError);
        throw uploadError;
      }

      foto_url = supabase.storage
        .from("Photos")
        .getPublicUrl(fileName).data.publicUrl;
    }

    // ===== 2. Insert KE SUPABASE =====
    const { error: insertError } = await supabase
      .from("sparepart_requests")
      .insert([
        {
          id,
          mesin: payload.mesin,
          nama_part: payload.nama_part,
          area: payload.area,
          qty: payload.qty,
          alasan: payload.alasan,
          foto_url: foto_url,
          request_by: payload.request_by,
          request_by_email: payload.request_by_email,
          status: "PENDING",
          created_at: new Date().toISOString()
        }
      ]);

    if (insertError) {
      console.log("Supabase insert error:", insertError);
      throw insertError;
    }

    // ===== 3. Insert KE DATABASE LOKAL =====
   db.prepare(`
  INSERT INTO local_sparepart_requests
  (id, mesin, nama_part, area, qty, alasan, foto_url,
   request_by, request_by_email, status, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', datetime('now'))
`).run(
  id,
  payload.mesin,
  payload.nama_part,
  payload.area,
  payload.qty,
  payload.alasan,
  foto_url,
  payload.request_by,
  payload.request_by_email
);


    return { success: true };

  } catch (err) {
    console.log("Error:", err);
    return { error: err.message };
  }
});

function registerIpcHandlers() {

  ipcMain.handle("getLocalSparepartRequests", () => {
    return db.prepare(`
      SELECT *
      FROM local_sparepart_requests
      ORDER BY created_at DESC
    `).all();
  });

  ipcMain.handle("syncSparepartRequests", async () => {
    await syncSparepartRequestsFromSupabase();
    return { success: true };
  });

}


/*
ipcMain.handle("update-sparepart-status", async (_, id, status) => {
  db.prepare(`
    UPDATE local_sparepart_requests
    SET status = ?
    WHERE id = ?
  `).run(status, id);

  // sync balik ke supabase
  await supabase
    .from("sparepart_requests")
    .update({ status })
    .eq("id", id);

  return true;
});
*/
ipcMain.handle("updateSparepartStatus", async (_, payload) => {
  const { id, status, admin_feedback } = payload;

  if (!["APPROVED", "REJECTED"].includes(status)) {
    throw new Error("Status tidak valid");
  }

  const now = new Date().toISOString();

  // ===== AMBIL DATA =====
  const row = db.prepare(`
    SELECT * FROM local_sparepart_requests WHERE id = ?
  `).get(id);

  if (!row) throw new Error("Data tidak ditemukan");

  // 🔒 cegah double klik
  if (row.status !== "PENDING") {
    return { ignored: true };
  }

  // ✅ PROGRESS STRING (BUKAN JSON)
  const progressValue = status === "APPROVED" ? "APPROVED" : null;

  // ===== UPDATE LOCAL =====
  db.prepare(`
    UPDATE local_sparepart_requests
    SET
      status         = ?,
      progress       = ?,
      updated_at     = ?,
      admin_feedback = ?,
      synced         = 0
    WHERE id = ?
  `).run(
    status,
    progressValue,
    now,
    admin_feedback || null,
    id
  );

  // ===== UPDATE SUPABASE =====
  const { error } = await supabase
    .from("sparepart_requests")
    .update({
      status,
      progress: progressValue,
      updated_at: now,
      admin_feedback: admin_feedback || null
    })
    .eq("id", id);

  if (error) {
    console.error("❌ Supabase update error:", error);
    throw error;
  }

  // ===== EMAIL =====
  if (status === "REJECTED" && row.request_by_email) {
    await sendRejectEmail(row.request_by_email, {
      request_by: row.request_by,
      mesin: row.mesin,
      nama_part: row.nama_part,
      qty: row.qty,
      admin_feedback
    });
  }

  if (status === "APPROVED" && row.request_by_email) {
    await sendApproveEmail(row.request_by_email, {
      request_by: row.request_by,
      mesin: row.mesin,
      nama_part: row.nama_part,
      qty: row.qty,
      foto_url: row.foto_url,
      progress: "APPROVED"
    });
  }

  // ===== MARK SYNCED =====
  db.prepare(`
    UPDATE local_sparepart_requests
    SET synced = 1
    WHERE id = ?
  `).run(id);

  return { success: true };
});


function buildProgress(progressLabel) {
  const now = new Date().toISOString().slice(0, 10);

  return {
    approved:       null,
    serah_terima:  null,
    pr:             null,
    po:             null,
    onsite:         null,
    [progressKey(progressLabel)]: now
  };
}

function progressKey(label) {
  return {
    "APPROVED": "approved",
    "SERAH TERIMA": "serah_terima",
    "PR": "pr",
    "PO": "po",
    "ONSITE": "onsite"
  }[label];
}


ipcMain.handle("updateSparepartProgress", async (_, payload) => {
  const { id, progress, number } = payload;
  const now = new Date().toISOString().split("T")[0];

  const valid = ["SERAH TERIMA", "PR", "PO", "ONSITE"];
  if (!valid.includes(progress)) {
    throw new Error("Progress tidak valid");
  }

  const row = db.prepare(`
    SELECT *
    FROM local_sparepart_requests
    WHERE id = ?
  `).get(id);

  if (!row) throw new Error("Data tidak ditemukan");

  // =========================
  // DECLARE ALL VARIABLES UPFRONT (FIX ERROR)
  // =========================
  let pr_number = row.pr_number ?? null;
  let po_number = row.po_number ?? null;
  let status    = row.status ?? "PENDING";

  // =========================
  // OLD NOTIFIED
  // =========================
  const oldNotifiedProgress = row.last_notified_progress
    ? JSON.parse(row.last_notified_progress)
    : {};

  // =========================
  // BUILD FULL PROGRESS STATE (SOURCE OF TRUTH)
  // =========================
  const newProgress = {
    approved: row.approved ?? null,
    serah_terima: oldNotifiedProgress.serah_terima ?? null,
    pr: pr_number,
    po: po_number,
    onsite: oldNotifiedProgress.onsite ?? null
  };

  // =========================
  // APPLY UPDATE
  // =========================
  if (progress === "SERAH TERIMA") {
    newProgress.serah_terima = now;
  }

  if (progress === "PR") {
    pr_number = number;
    newProgress.pr = number;
  }

  if (progress === "PO") {
    po_number = number;
    newProgress.po = number;
  }

  if (progress === "ONSITE") {
    newProgress.onsite = now;
    status = "CLOSED";
  }

  // =========================
  // DEBUG (WAJIB SEMENTARA)
  // =========================
  console.log("OLD NOTIFIED:", oldNotifiedProgress);
  console.log("NEW PROGRESS :", newProgress);

  // =========================
  // ANTI SPAM EMAIL
  // =========================
  if (hasProgressChanged(oldNotifiedProgress, newProgress)) {
    await sendProgressUpdateEmail(row.request_by_email, {
      request_by: row.request_by,
      mesin: row.mesin,
      nama_part: row.nama_part,
      qty: row.qty,
      progress: newProgress
    });

    saveLastNotifiedProgress(id, newProgress);
  } else {
    console.log("📭 Progress tidak berubah → skip email");
  }

  // =========================
  // UPDATE LOCAL DB
  // =========================
  db.prepare(`
    UPDATE local_sparepart_requests
    SET
      progress    = @progress,
      pr_number   = @pr_number,
      po_number   = @po_number,
      status      = @status,
      updated_at  = @updated_at,
      synced      = 0,
      last_notified_progress = @last_notified_progress,
      progress_json = @progress_json
    WHERE id = @id
  `).run({
    id,
    progress,
    pr_number,
    po_number,
    status,
    updated_at: now,
    last_notified_progress: JSON.stringify(newProgress),
    progress_json: JSON.stringify(newProgress)
  });

  // =========================
  // UPDATE SUPABASE
  // =========================
  const { error } = await supabase
    .from("sparepart_requests")
    .update({
      progress,
      pr_number,
      po_number,
      status,
      updated_at: now,
      last_notified_progress: JSON.stringify(newProgress),
      progress_json: JSON.stringify(newProgress)
    })
    .eq("id", id);

  if (error) throw error;

  // =========================
  // SYNCED
  // =========================
  db.prepare(`
    UPDATE local_sparepart_requests SET synced = 1 WHERE id = ?
  `).run(id);

  return { success: true };
});



ipcMain.handle("get-current-user", async () => {
  return currentUser; // sekarang aman
});


//====================END=======================================//







  function createLoginWindow() {
  loginWindow = new BrowserWindow({
    width: 400,
    height: 500,
    resizable: false,
    autoHideMenuBar: true,
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  loginWindow.loadFile(path.join(__dirname, "renderer", "login.html"));

  // Opsional: buka DevTools hanya saat debugging
 //loginWindow.webContents.openDevTools();
  }




function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    show: false, // tampil setelah siap
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  setAppMenu();

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    startPeriodicSync();
    syncLocations();
    setInterval(async () => {
      autoSyncLoop(mainWindow);
      initAutoUpdater(mainWindow);

}, 15000);

  });

  // ✅ CLOSE → MASUK TRAY, BUKAN MATI
  mainWindow.on("close", (e) => {
    if (!isQuiting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  // ✅ AUTO NOTIF SAAT WINDOW SIAP
  mainWindow.webContents.on("did-finish-load", () => {
   broadcastKontrakExpire();
    mainWindow.webContents.send("screen-changed", currentScreen);

    if (currentScreen === "rmc") {
      sendRmcData();
    }
  });
}

ipcMain.on('inventory-reload-app', () => {
  if (mainWindow) mainWindow.reload();
});


// ===================== STARTUP =====================
app.whenReady().then(async () => {
  createLoginWindow();
  registerIpcHandlers();
    await syncSparepartRequestsFromSupabase();

  tray = new Tray(path.join(__dirname, 'assets/favicon.png'));
  tray.setToolTip('ERP SYSTEM');

  // macOS: buka window jika belum ada
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createLoginWindow();
  });


// Quit ketika semua window ditutup
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Buka Aplikasi",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.restore();
          mainWindow.focus();
        } else {
          createMainWindow();
        }
      }
    },
    {
      label: "Keluar",
      click: () => {
        isQuiting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on("double-click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.restore();
      mainWindow.focus();
    }
  });

});

app.on("window-all-closed", (e) => {
  // BIARKAN KOSONG (AGAR BACKGROUND TETAP HIDUP)
});

function setAppMenu() {
  const template = [
    // ============================
    // VIEW
    // ============================
    {
      label: "View",
      submenu: [
        { label: "Reload Window", role: "reload" },
        { label: "Force Reload", role: "forcereload" }
      ]
    },

    // ============================
    // STYLE
    // ============================
    {
      label: "Style",
      submenu: [
        { label: "Classic", click: () => mainWindow.webContents.send("apply-dashboard", "classic") },
        { label: "Compact", click: () => mainWindow.webContents.send("apply-dashboard", "compact") },
        { label: "3D Card", click: () => mainWindow.webContents.send("apply-dashboard", "3d") },
        { label: "Minimalist", click: () => mainWindow.webContents.send("apply-dashboard", "minimal") },
        { label: "Neon Grid", click: () => mainWindow.webContents.send("apply-dashboard", "neon") },
        { label: "Tech Dashboard", click: () => mainWindow.webContents.send("apply-dashboard", "tech") },
        { label: "Business Dashboard", click: () => mainWindow.webContents.send("apply-dashboard", "business") },
        { label: "Dark Dashboard", click: () => mainWindow.webContents.send("apply-dashboard", "dark") }
      ]
    },

    // ============================
    // ABOUT
    // ============================
    {
      label: "About",
      click: () => {
        try {
          const pkg = require(path.join(__dirname, "package.json"));
          const info = {
            appName: pkg.name || "Unknown App",
            version: pkg.version || "1.0.0",
            author: (pkg.author && (pkg.author.name || pkg.author)) || "Unknown Creator",
            electronVersion: process.versions.electron,
            nodeVersion: process.versions.node
          };

          const infoWindow = new BrowserWindow({
            width: 440,
            height: 340,
            resizable: false,
            title: "About This App",
            backgroundColor: "#0f0f0f",
            opacity: 0.97,
            autoHideMenuBar: true,
            frame: true,
            show: false,
            icon: path.join(__dirname, "assets", "icon.png"),
            webPreferences: {
              preload: path.join(__dirname, "preload.js"),
              contextIsolation: true,
              nodeIntegration: false
            }
          });

          infoWindow.loadFile(path.join(__dirname, "renderer", "appinfo.html"));

          infoWindow.once("ready-to-show", () => infoWindow.show());
          infoWindow.webContents.on("did-finish-load", () => infoWindow.webContents.send("show-app-info", info));

        } catch (err) {
          console.error("ABOUT POPUP ERROR:", err);
        }
      }
    },

    // ============================
    // DEBUG
    // ============================
    {
      label: "Debug",
      click: () => {
        if (mainWindow) mainWindow.webContents.openDevTools();
      }
    },

    // ============================
    // LOAD FILE
    // ============================
    {
      label: "Load",
      submenu: [
        {
          label: "Load File Excel",
          click: async () => {
            const { canceled, filePaths } = await dialog.showOpenDialog({
              filters: [{ name: "Excel Files", extensions: ["xls", "xlsx"] }],
              properties: ["openFile"]
            });
            if (canceled) return;

            const filePath = filePaths[0];
            const wb = XLSX.readFile(filePath);
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
            const header = rows[1]?.slice(0, 12) || [];
            const data = rows.slice(2).map(r => r.slice(0, 12));

            if (currentScreen.toLowerCase() !== "rmc") {
              mainWindow.webContents.send("show-toast", {
                type: "error",
                message: "⚠ Fitur Import hanya bisa digunakan di halaman RMC!"
              });
              return;
            }

            mainWindow.webContents.send("rmc-excel-loaded", { filePath, header, data });
          }
        },
        {
          label: "Load File Purchase",
          click: async () => {
            const { canceled, filePaths } = await dialog.showOpenDialog({
              filters: [{ name: "Purchase Files", extensions: ["xls", "xlsx", "csv"] }],
              properties: ["openFile"]
            });
            if (!canceled && filePaths.length > 0) {
              const filePath = filePaths[0];
              const wb = XLSX.readFile(filePath);
              const sheetName = wb.SheetNames[0];
              const data = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" });
              const headers = Object.keys(data[0] || {});
              mainWindow.webContents.send("purchase-file-loaded", { headers, filePath });
            }
          }
        }
      ]
    },

    // ============================
    // SCREEN
    // ============================
    {
      label: "Screen",
      submenu: [
        {
          label: "Purchase",
          type: "checkbox",
          checked: currentScreen === "purchase",
          click: () => {
            mainWindow.webContents.send("loading-show");
            setTimeout(() => {
              currentScreen = "purchase";
              updateMenuActiveState();
              mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
              mainWindow.webContents.once("did-finish-load", () => {
                setTimeout(() => mainWindow.webContents.send("loading-hide"), 250);
                mainWindow.webContents.send("screen-changed", "purchase");
              });
            }, 150);
          }
        },
        {
          label: "RMC",
          type: "checkbox",
          checked: currentScreen === "rmc",
          click: () => {
            if (isVisitorMode) {
              mainWindow.webContents.send("show-toast", { type: "error", message: "🔒 Anda dalam Visitor Mode — tidak dapat membuka menu RMC." });
              return;
            }
            mainWindow.webContents.send("loading-show");
            setTimeout(() => {
              currentScreen = "rmc";
              updateMenuActiveState();
              mainWindow.loadFile(path.join(__dirname, "renderer", "rmc.html"));
              mainWindow.webContents.once("did-finish-load", () => {
                setTimeout(() => sendRmcData(), 250);
                mainWindow.webContents.send("screen-changed", "rmc");
              });
            }, 150);
          }
        },
        {
  label: "Karyawan",
  submenu: [
    {
      label: "Data Karyawan",
      type: "checkbox",
      checked: currentScreen === "karyawan",
      click: () => {
        if (isVisitorMode) {
          mainWindow.webContents.send("show-toast", {
            type: "error",
            message: "🔒 Anda dalam Visitor Mode — tidak dapat membuka menu Karyawan."
          });
          return;
        }

        mainWindow.webContents.send("loading-show");

        setTimeout(() => {
          currentScreen = "karyawan";
          updateMenuActiveState();

          mainWindow.loadFile(
            path.join(__dirname, "renderer", "karyawan.html")
          );

          mainWindow.webContents.once("did-finish-load", () => {
            setTimeout(() => mainWindow.webContents.send("loading-hide"), 250);
            mainWindow.webContents.send("screen-changed", "karyawan");
          });
        }, 150);
      }
    },

    {
      label: "Overtime",
      type: "checkbox",
      checked: currentScreen === "overtime",
      click: () => {
        if (isVisitorMode) {
          mainWindow.webContents.send("show-toast", {
            type: "error",
            message: "🔒 Anda dalam Visitor Mode — tidak dapat membuka menu Overtime."
          });
          return;
        }

        mainWindow.webContents.send("loading-show");

        setTimeout(() => {
          currentScreen = "overtime";
          updateMenuActiveState();

          mainWindow.loadFile(
            path.join(__dirname, "renderer", "overtime.html")
          );

          mainWindow.webContents.once("did-finish-load", () => {
            setTimeout(() => mainWindow.webContents.send("loading-hide"), 250);
            mainWindow.webContents.send("screen-changed", "overtime");
          });
        }, 150);
      }
    }
  ]
},
{
    label: "Inventory",
    submenu: [
        {
        label: "GDSP",
          type: "checkbox",
          checked: currentScreen === "GDSP",
          click: () => {
            if (isVisitorMode) {
              mainWindow.webContents.send("show-toast", { type: "error", message: "🔒 Anda dalam Visitor Mode — tidak dapat membuka menu GDSP." });
              return;
            }
            mainWindow.webContents.send("loading-show");
            setTimeout(() => {
              currentScreen = "GDSP";
              updateMenuActiveState();
              mainWindow.loadFile(path.join(__dirname, "renderer", "inventory.html"));
              mainWindow.webContents.once("did-finish-load", () => {
                setTimeout(() => mainWindow.webContents.send("loading-hide"), 250);
                mainWindow.webContents.send("screen-changed", "GDSP");
              });
            }, 150);
          }
        },

    {
      label: "Master Data",
      type: "checkbox",
      checked: currentScreen === "Master Data",
      click: () => {
        if (isVisitorMode) {
          mainWindow.webContents.send("show-toast", {
            type: "error",
            message: "🔒 Anda dalam Visitor Mode — tidak dapat membuka menu Master Data."
          });
          return;
        }

        mainWindow.webContents.send("loading-show");

        setTimeout(() => {
          currentScreen = "Master Data";
          updateMenuActiveState();

          mainWindow.loadFile(
            path.join(__dirname, "renderer", "master_data.html")
          );

          mainWindow.webContents.once("did-finish-load", () => {
            setTimeout(() => mainWindow.webContents.send("loading-hide"), 250);
            mainWindow.webContents.send("screen-changed", "Master Data");
          });
        }, 150);
      }
    }
  ]
},



        {
          label: "MTBF",
          submenu: [
            {
              label: "Request",
              click: () => {
                if (isVisitorMode) {
                  mainWindow.webContents.send("show-toast", { type: "error", message: "🔒 Anda dalam Visitor Mode — tidak dapat membuka menu MTBF." });
                  return;
                }
                mainWindow.webContents.send("loading-show");
                setTimeout(() => {
                  currentScreen = "MTBF_REQUEST";
                  updateMenuActiveState();
                  mainWindow.loadFile(path.join(__dirname, "renderer", "request-sparepart.html"));
                  mainWindow.webContents.once("did-finish-load", () => {
                    setTimeout(() => mainWindow.webContents.send("loading-hide"), 250);
                    mainWindow.webContents.send("screen-changed", "MTBF_REQUEST");
                  });
                }, 150);
              }
            },
             {
              label: "Dashboard-MTBF",
              click: () => {
                if (isVisitorMode) {
                  mainWindow.webContents.send("show-toast", { type: "error", message: "🔒 Anda dalam Visitor Mode — tidak dapat membuka menu MTBF." });
                  return;
                }
                mainWindow.webContents.send("loading-show");
                setTimeout(() => {
                  currentScreen = "Dashboard-MTBF";
                  updateMenuActiveState();
                  mainWindow.loadFile(path.join(__dirname, "renderer", "MTBF.html"));
                  mainWindow.webContents.once("did-finish-load", () => {
                    setTimeout(() => mainWindow.webContents.send("loading-hide"), 250);
                    mainWindow.webContents.send("screen-changed", "Dashboard-MTBF");
                  });
                }, 150);
              }
            },
             {
              label: "History-Permintaan",
              click: () => {
                if (isVisitorMode) {
                  mainWindow.webContents.send("show-toast", { type: "error", message: "🔒 Anda dalam Visitor Mode — tidak dapat membuka menu MTBF." });
                  return;
                }
                mainWindow.webContents.send("loading-show");
                setTimeout(() => {
                  currentScreen = "History Permintaan";
                  updateMenuActiveState();
                  mainWindow.loadFile(path.join(__dirname, "renderer", "admin_sparepart.html"));
                  mainWindow.webContents.once("did-finish-load", () => {
                    setTimeout(() => mainWindow.webContents.send("loading-hide"), 250);
                    mainWindow.webContents.send("screen-changed", "Report");
                  });
                }, 150);
              }
            },
            {
              label: "History-Penggantian",
              click: () => {
                if (isVisitorMode) {
                  mainWindow.webContents.send("show-toast", { type: "error", message: "🔒 Anda dalam Visitor Mode — tidak dapat membuka menu MTBF." });
                  return;
                }
                mainWindow.webContents.send("loading-show");
                setTimeout(() => {
                  currentScreen = "MTBF_HISTORY";
                  updateMenuActiveState();
                  mainWindow.loadFile(path.join(__dirname, "renderer", "history.html"));
                  mainWindow.webContents.once("did-finish-load", () => {
                    setTimeout(() => mainWindow.webContents.send("loading-hide"), 250);
                    mainWindow.webContents.send("screen-changed", "MTBF_HISTORY");
                  });
                }, 150);
              }
            }
          ]
        }
      ]
    },

    // ============================
    // LOGOUT (di luar Screen)
    // ============================
    {
      label: "Logout",
      click: () => {
        try {
          if (mainWindow) {
            mainWindow.close();
            mainWindow = null;
          }
          createLoginWindow();
        } catch (err) {
          console.error("LOGOUT ERROR:", err);
        }
      }
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}



function updateMenuActiveState() {
  const menu = Menu.getApplicationMenu();
  if (!menu) return;

  menu.items.forEach(menuItem => {
    if (menuItem.label === "Screen") {
      menuItem.submenu.items.forEach(subItem => {
        const screenName = subItem.label.toLowerCase();
        subItem.checked = (screenName === currentScreen);
      });
    }
  });
}

ipcMain.on("request-screen-transition", (event, screenState) => {
  mainWindow.webContents.send("screen-transition", screenState);
});


function broadcastKontrakExpire() {
  try {
    const rows = db.prepare(`
      SELECT nama, nik,
      ROUND(julianday(habis_kontrak) - julianday('now')) AS sisa_hari
      FROM karyawan
      WHERE status IN ('HT','OS','PKWT')
        AND habis_kontrak NOT LIKE '9999%'
        AND DATE(habis_kontrak) >= DATE('now')
        AND DATE(habis_kontrak) <= DATE('now','+30 day')
    `).all();

    if (rows.length === 0) return;

    // ✅ SELALU KIRIM KE RENDERER JIKA WINDOW ADA
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("kontrak-expire-notif", rows);
    }

    // ✅ SELALU TAMPILKAN NOTIF WINDOWS (BACKGROUND)
    rows.forEach(r => {
      const notif = new Notification({
        title: "Peringatan Kontrak!",
        body: `${r.nama} (${r.nik}) akan habis kontrak dalam ${r.sisa_hari} hari.`,
        silent: false
      });

      notif.on("click", () => {
        if (!mainWindow || mainWindow.isDestroyed()) {
          if (!loginWindow) createLoginWindow();
          loginWindow.show();
          loginWindow.focus();
        } else {
          if (!mainWindow.isVisible()) mainWindow.show();
          mainWindow.focus();
        }
      });

      notif.show();
    });

  } catch (err) {
    console.error("ERROR broadcast:", err);
  }
}




  app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });

  ipcMain.on("header-selection", (event, { selected, filePath, type }) => {
  console.log(`Header dipilih dari ${type}:`, selected);
  // TODO: proses lanjut, ambil data PR/PO sesuai header terpilih
  });

  // panggil sendRmcData() setelah load RMC
// mis. di menu Screen -> RMC click handler, setelah mainWindow.loadFile(...):

  // ✅ Simpan Data Sparepart
  ipcMain.handle("save-sparepart", (event, data) => {
  try {

    // Hitung minggu otomatis jika belum ada
    const stmtWeek = db.prepare(`SELECT strftime('%W', ?) +1 AS week`);
    const weekResult = stmtWeek.get(data.tanggal);
    const weekValue = weekResult.week;

    const stmt = db.prepare(`
      INSERT INTO spareparts (
        tanggal, week, nomor_material, nama_sparepart,
        quantity, function_location, sub_location, vendor,
        harga_satuan, total_harga, nomor_pr, nomor_po
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `);

    const info = stmt.run(
      data.tanggal,
      weekValue,
      data.nomor_material,
      data.nama_sparepart,
      data.quantity,
      data.function_location,
      data.sub_location,
      data.vendor,
      data.harga_satuan,
      data.total_harga,
      data.nomor_pr,
      data.nomor_po
    );

    return { success: true, lastInsertRowid: info.lastInsertRowid };
  } catch (err) {
    console.error("DB SAVE ERROR:", err);
    return { success: false, error: String(err) };
  }
  });



ipcMain.handle("save-file", async (event, { defaultName, content, filters }) => {
  try {
    const { filePath } = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters
    });

    if (!filePath) return false;

    fs.writeFileSync(filePath, content, "utf8");
    return true;
  } catch (err) {
    console.error("SAVE FILE ERROR:", err);
    return false;
  }
});


// contoh: saat main membuka screen RMC, kirim data RMC
function sendRmcData() {
  try {
    const rows = db.prepare("SELECT * FROM spareparts ORDER BY tanggal DESC").all();
    if (mainWindow && rows) {
      mainWindow.webContents.send("rmc-data-loaded", rows);
    }
  } catch (err) {
    console.error("rmc data send error:", err);
  }
}

function formatLocalDate(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) {
    console.warn("formatLocalDateSafe: invalid date:", d);
    return null;   // jangan teruskan
  }

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

  // helper: ISO week number
  function getISOWeekNumber(d) {
  // copy date dan gunakan waktu lokal
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // Thursday in current week decides the year.
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const firstThursday = new Date(date.getFullYear(), 0, 4);
  const diff = date - firstThursday;
  // days difference / 86400000 then divide by 7
  return 1 + Math.round(((diff / 86400000) - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
  }

  ipcMain.handle("load-history-by-week", (event, offset = 0) => {
  try {
    const now = new Date();

    const target = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + (offset * 7)
    );

    const day = target.getDay(); // 0 = minggu
    const diffToMonday = (day === 0 ? -6 : 1) - day;

    const monday = new Date(target);
    monday.setDate(target.getDate() + diffToMonday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const startStr = formatLocalDate(monday);
    const endStr   = formatLocalDate(sunday);

    console.log("✅ WEEK RANGE FIX:", startStr, "→", endStr, "offset:", offset);

    const rows = db.prepare(`
      SELECT * FROM spareparts
      WHERE tanggal >= ? AND tanggal <= ?
      ORDER BY tanggal DESC
    `).all(startStr, endStr);

    return {
      rows,
      week: String(getISOWeekNumber(target)),
      year: String(target.getFullYear()),
      range: `${startStr} - ${endStr}`
    };

  } catch (err) {
    console.error("LOAD HISTORY WEEK ERROR:", err);
    return { rows: [], week: "?", year: "?", range: "?" };
  }
});



  // 🔹 History by Month Index (offset relatif terhadap bulan sekarang)
  ipcMain.handle("load-history-by-month", (event, offset = 0) => {
  try {
    const offsetStr = `${offset} month`;

    const target = db.prepare(`
      SELECT strftime('%Y-%m', date('now', ?)) AS bulan
    `).get(offsetStr);

    const targetMonth = target?.bulan ?? "0000-00";

    const rows = db.prepare(`
      SELECT * FROM spareparts
      WHERE strftime('%Y-%m', tanggal) = ?
      ORDER BY created_at DESC
    `).all(targetMonth);

    return { rows, bulan: targetMonth };
  } catch (err) {
    console.error("LOAD HISTORY MONTH ERROR:", err);
    return { rows: [], bulan: "?" };
  }
  });



  // ✅ History Bulan Ini
  ipcMain.handle("load-history-month", () => {
  try {
    const rows = db.prepare(`
      SELECT * FROM spareparts
      WHERE strftime('%m', tanggal) = strftime('%m', 'now')
      ORDER BY created_at DESC
    `).all();
    return rows;
  } catch (err) {
    console.error("DB MONTH HISTORY ERROR:", err);
    return [];
  }
  });


  // ✅ History Full (jika diperlukan)
  ipcMain.handle("get-history", () => {
  try {
    const rows = db.prepare("SELECT * FROM spareparts ORDER BY created_at DESC").all();
    return { success: true, rows };
  } catch (err) {
    console.error("DB READ ERROR:", err);
    return { success: false, error: String(err) };
  }
  });



//=================location function=======================//
async function syncLocalToSupabase() {
  const localLocations = db
    .prepare("SELECT function_location, sub_location FROM locations")
    .all();

  for (const loc of localLocations) {
    const { data: existing, error: selectError } = await supabase
      .from("locations")
      .select("id")
      .eq("function_location", loc.function_location)
      .eq("sub_location", loc.sub_location)
      .maybeSingle(); // ✅ PAKAI maybeSingle

    if (selectError) {
      console.error("❌ Supabase select error:", selectError);
      continue;
    }

    if (!existing) {
      const { error: insertError } = await supabase
        .from("locations")
        .insert([{
          function_location: loc.function_location,
          sub_location: loc.sub_location
        }]);

      if (insertError) {
        console.error("❌ Supabase insert error:", insertError, loc);
      } else {
        console.log("☁️ Inserted to Supabase:", loc);
      }
    }
  }
}


async function syncSupabaseToLocal() {
  const { data: cloudLocations, error } = await supabase
    .from("locations")
    .select("function_location, sub_location");

  if (error) {
    console.error("Supabase fetch error:", error);
    return;
  }

  for (const loc of cloudLocations) {
    const exists = db.prepare(
      "SELECT 1 FROM locations WHERE function_location = ? AND sub_location = ?"
    ).get(loc.function_location, loc.sub_location);

    if (!exists) {
      db.prepare("INSERT INTO locations (function_location, sub_location) VALUES (?, ?)")
        .run(loc.function_location, loc.sub_location);
    }
  }
}

async function syncLocations() {
  await syncLocalToSupabase();
  await syncSupabaseToLocal();
  console.log("✅ Locations sync completed");
}

// Bisa dipanggil saat app start atau manual
syncLocations();




ipcMain.handle("add-location", async (event, args) => {
  console.log("🔥 IPC add-location CALLED:", args);

  try {
    let { funcLoc, subLoc } = args;

    const safeFunc = funcLoc ? String(funcLoc).trim().toUpperCase() : "";
    const safeSub  = subLoc  ? String(subLoc).trim().toUpperCase()  : "";

    if (!safeFunc) {
      return { success: false, message: "Function Location tidak boleh kosong" };
    }

    // Insert ke LOCAL
    const result = db.prepare(
      "INSERT INTO locations (function_location, sub_location) VALUES (?, ?)"
    ).run(safeFunc, safeSub);

    console.log("✅ Local insert:", safeFunc, safeSub);

    // 🔁 AUTO SYNC KE SUPABASE
    try {
      await syncLocalToSupabase();   // ⬅️ langsung push ke cloud
      console.log("☁️ Auto sync to Supabase OK");
    } catch (syncErr) {
      console.error("⚠️ Auto sync failed:", syncErr);
    }

    return { success: true };
  } catch (err) {
    console.error("💥 ADD LOCATION ERROR:", err);
    return { success: false, message: err.message };
  }
});




// =================== GET ALL LOCATIONS ===================
ipcMain.handle("get-all-locations", () => {
  try {
    return db.prepare(`
      SELECT function_location, sub_location
      FROM locations
      ORDER BY function_location, sub_location
    `).all();
  } catch (err) {
    console.error("GET ALL LOCATIONS ERROR:", err);
    return [];
  }
});





//========================end this shit====================//







  // ✅ Handler login
ipcMain.handle("login-user", (event, { username, password }) => {
  try {
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);

    if (!user) {
      console.warn("⚠️ Login gagal: user tidak ditemukan:", username);
      return { success: false, message: "User tidak ditemukan" };
    }

    if (!user.password_hash) {
      console.error("❌ User tidak memiliki password_hash, database perlu diperbaiki!");
      return { success: false, message: "Database tidak valid. Reset password admin." };
    }

    const valid = bcrypt.compareSync(password, user.password_hash);

    if (!valid) {
      console.warn("⚠️ Password salah untuk:", username);
      return { success: false, message: "Password salah" };
    }
     isLoggedIn = true;

    loginWindow.close();
    createMainWindow();

    return { success: true, role: user.role };

  } catch (err) {
    console.error("🚨 LOGIN ERROR:", err);
    return { success: false, message: "Terjadi kesalahan server" };
  }
});

ipcMain.handle("login-success", (event, role) => {
  console.log("✅ LOGIN NORMAL, set isVisitorMode = false");
  isVisitorMode = false;
});


  // ✅ Buka index.html sebagai Visitor (read-only)
  ipcMain.handle("open-visitor-view", () => {
  try {
    isLoggedIn = false;
    loginWindow.close();
    isVisitorMode = true;   // ⬅ WAJIB

    createMainWindow();

    mainWindow.webContents.on("did-finish-load", () => {
      mainWindow.webContents.send("visitor-mode");
    });

    return { success: true };
  } catch (err) {
    console.error("VISITOR VIEW ERROR:", err);
    return { success: false };
  }
});

  ipcMain.on("request-navigate", (event, screen) => {
  if (isVisitorMode) {
    event.sender.send("blocked-visitor");
    return;
  }

  mainWindow.webContents.send("navigate-screen", screen);
});



  // ✅ Tutup popup About saat tombol "Tutup" diklik
  ipcMain.on("close-info-window", (event) => {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  if (senderWindow && senderWindow.getTitle() === "About This App") {
    senderWindow.close();
  } else {
    // fallback kalau title berubah
    const allWindows = BrowserWindow.getAllWindows();
    const infoWin = allWindows.find(win => win.getTitle().includes("About"));
    if (infoWin) infoWin.close();
  }
  });

  // ✅ Ambil data untuk chart (berdasarkan minggu/bulan)
 ipcMain.handle("get-chart-data", (event, { mode = "week", offset = 0 } = {}) => {
  try {
    let rows = [];
    let prevRows = [];

    if (mode === "week") {
      // ========== DATA MINGGU INI ==========
      rows = db.prepare(`
        SELECT * FROM spareparts
        WHERE tanggal BETWEEN
          date('now', ? * 7 || ' day', 'weekday 1') AND
          date('now', ? * 7 || ' day', 'weekday 0', '+7 day')
      `).all(offset, offset);

      // ========== DATA MINGGU LALU ==========
      prevRows = db.prepare(`
        SELECT * FROM spareparts
        WHERE tanggal BETWEEN
          date('now', (? - 1) * 7 || ' day', 'weekday 1') AND
          date('now', (? - 1) * 7 || ' day', 'weekday 0', '+7 day')
      `).all(offset, offset);

    }
    else if (mode === "month") {
      // ========== DATA BULAN INI ==========
      rows = db.prepare(`
        SELECT * FROM spareparts
        WHERE strftime('%Y-%m', tanggal) = strftime('%Y-%m', date('now', ? || ' month'))
      `).all(offset);

      // ========== DATA BULAN LALU ==========
      prevRows = db.prepare(`
        SELECT * FROM spareparts
        WHERE strftime('%Y-%m', tanggal) = strftime('%Y-%m', date('now', (? - 1) || ' month'))
      `).all(offset);
    }

    // ================== GROUPING ==================
    const vendorData = groupBy(rows, "vendor", "total_harga");
    const itemData   = groupBy(rows, "nama_sparepart", "quantity");
    const flData     = groupBy(rows, "function_location", "total_harga");

    // ================== TOTAL HARGA ==================
    const totalNow = rows.reduce((a, b) => a + (b.total_harga || 0), 0);
    const totalPrev = prevRows.reduce((a, b) => a + (b.total_harga || 0), 0);

    const hargaData = [
      {
        label: mode === "week" ? "Minggu Ini" : "Bulan Ini",
        total: totalNow
      },
      {
        label: mode === "week" ? "Minggu Lalu" : "Bulan Lalu",
        total: totalPrev
      }
    ];

    return { vendorData, itemData, flData, hargaData };

  } catch (err) {
    console.error("CHART DATA ERROR:", err);
    return {
      vendorData: [],
      itemData: [],
      flData: [],
      hargaData: []
    };
  }
});


  function groupBy(rows, key, sumKey) {
  const result = {};
  for (const row of rows) {
    const group = row[key] || "Tidak Ada";
    result[group] = (result[group] || 0) + (row[sumKey] || 0);
  }
  return Object.entries(result).map(([label, total]) => ({
    [key]: label,
    total,
    jumlah: total
  }));
  }


  // Ambil nilai RMC untuk tahun sekarang
  ipcMain.handle("get-rmc", () => {
  const currentYear = new Date().getFullYear();
  const row = db.prepare("SELECT * FROM RMC WHERE year = ?").get(currentYear);
  return row || { nominal: null };
  });

  ipcMain.handle("get-rmc-summary", () => {
  const currentYear = new Date().getFullYear();

  // Ambil nominal RMC tahun ini
  const rmcRow = db.prepare("SELECT nominal FROM RMC WHERE year = ?").get(currentYear);
  const rmcNominal = rmcRow ? rmcRow.nominal : 0;

  //===========================sertim==========================//
  const sertim = db.prepare(`
  SELECT SUM(total_harga) AS total
  FROM spareparts
  WHERE tanggal LIKE ?
    AND (nomor_pr IS NULL OR TRIM(nomor_pr) = '' OR nomor_pr = '-')
    AND (nomor_po IS NULL OR TRIM(nomor_po) = '' OR nomor_po = '-')
  `).get(`${currentYear}%`);

  const totalSertim = sertim?.total || 0;
  //============================================================//

  // --- Purchase Requisition Factory (<= 5 juta) ---
  const prFactory = db.prepare(`
    SELECT SUM(total_harga) AS total
    FROM spareparts
    WHERE tanggal LIKE ?
      AND nomor_pr IS NOT NULL AND TRIM(nomor_pr) <> '' AND nomor_pr <> '-'
      AND total_harga <= 5000000
  `).get(`${currentYear}%`);
  const totalPRFactory = prFactory?.total || 0;

  // --- Purchase Requisition Pusat (> 5 juta) ---
  const prPusat = db.prepare(`
    SELECT SUM(total_harga) AS total
    FROM spareparts
    WHERE tanggal LIKE ?
      AND nomor_pr IS NOT NULL AND TRIM(nomor_pr) <> '' AND nomor_pr <> '-'
      AND total_harga > 5000000
  `).get(`${currentYear}%`);
  const totalPRPusat = prPusat?.total || 0;

  // --- Outstanding (PR belum jadi PO) ---
  const outstanding = db.prepare(`
    SELECT SUM(total_harga) AS total
    FROM spareparts
    WHERE tanggal LIKE ?
      AND nomor_pr IS NOT NULL AND TRIM(nomor_pr) <> '' AND nomor_pr <> '-'
      AND (nomor_po IS NULL OR TRIM(nomor_po) = '' OR nomor_po = '-')
  `).get(`${currentYear}%`);
  const totalOutstanding = outstanding?.total || 0;

  // --- Purchase Order Factory (<= 5 juta) ---
  const poFactory = db.prepare(`
    SELECT SUM(total_harga) AS total
    FROM spareparts
    WHERE tanggal LIKE ?
      AND nomor_po IS NOT NULL AND TRIM(nomor_po) <> '' AND nomor_po <> '-'
      AND total_harga <= 5000000
  `).get(`${currentYear}%`);
  const totalPOFactory = poFactory?.total || 0;

  // --- Purchase Order Pusat (> 5 juta) ---
  const poPusat = db.prepare(`
    SELECT SUM(total_harga) AS total
    FROM spareparts
    WHERE tanggal LIKE ?
      AND nomor_po IS NOT NULL AND TRIM(nomor_po) <> '' AND nomor_po <> '-'
      AND total_harga > 5000000
  `).get(`${currentYear}%`);
  const totalPOPusat = poPusat?.total || 0;

  // --- Sisa RMC ---
  const totalPO = totalPOFactory + totalPOPusat;
  const sisa = rmcNominal - totalPO;

  return {
    rmcNominal,
    totalPRFactory,
    totalPRPusat,
    totalOutstanding,
    totalPOFactory,
    totalPOPusat,
    sertim,
    sisa
  };
  });


// ===== DEPARTMENT TABLE HANDLER =====
ipcMain.handle("departments-get-all", () => {
  return db.prepare("SELECT * FROM departments ORDER BY id ASC").all();
});

ipcMain.handle("departments-add", (event, data) => {
  const stmt = db.prepare("INSERT INTO departments (kode, nama) VALUES (?, ?)");
  stmt.run(data.kode, data.nama);
  return true;
});

  // Simpan RMC
  ipcMain.handle("save-rmc", (event, data) => {
  const stmt = db.prepare("INSERT OR REPLACE INTO RMC (year, nominal) VALUES (?, ?)");
  stmt.run(data.year, data.nominal);
  return true;
  });


  // Ambil semua purchase item
  ipcMain.handle("get-purchase-items", () => {
    return db.prepare("SELECT * FROM spareparts ORDER BY tanggal DESC").all();
  });


  ipcMain.handle("get-history-rmc", () => {
  try {
    const rows = db.prepare(`
      SELECT
        id,
        tanggal,
        nomor_material,
        nama_sparepart,
        vendor,
        quantity AS qty,
        harga_satuan AS harga,
        total_harga AS total,
        nomor_pr,
        nomor_po
      FROM spareparts
      ORDER BY tanggal DESC
    `).all();
    return rows;
  } catch (err) {
    console.error("SQL get-history-rmc error:", err);
    return [];
  }
  });

  ipcMain.handle("update-prpo", (event, data) => {
  console.log("📩 Update PRPO diterima:", data);
  const { id, field, value } = data;
  if (!["nomor_pr", "nomor_po","nomor_material"].includes(field)) return { success: false };
  db.prepare(`UPDATE spareparts SET ${field} = ? WHERE id = ?`).run(value, id);
  console.log(`✅ Updated ${field} for ID ${id} => ${value}`);
  return { success: true };
  });

  ipcMain.handle("show-chart", async (event, type) => {
  console.log("📊 Show chart:", type);

  let query = "";

  switch(type) {
    case "SERTIM":
      query = `
        SELECT nama_sparepart AS label, total_harga AS value
        FROM spareparts
        WHERE (nomor_pr IS NULL OR TRIM(nomor_pr) = '' OR nomor_pr = '-')
          AND (nomor_po IS NULL OR TRIM(nomor_po) = '' OR nomor_po = '-')
      `;
      break;

    case "PR_FACTORY":
      query = `
        SELECT nama_sparepart AS label, total_harga AS value
        FROM spareparts
        WHERE total_harga <= 5000000
          AND nomor_pr IS NOT NULL AND TRIM(nomor_pr) <> '' AND nomor_pr <> '-'
      `;
      break;

    case "PR_PUSAT":
      query = `
        SELECT nama_sparepart AS label, total_harga AS value
        FROM spareparts
        WHERE total_harga > 5000000
          AND nomor_pr IS NOT NULL AND TRIM(nomor_pr) <> '' AND nomor_pr <> '-'
      `;
      break;

    case "PO_FACTORY":
      query = `
        SELECT nama_sparepart AS label, total_harga AS value
        FROM spareparts
        WHERE total_harga <= 5000000
          AND nomor_po IS NOT NULL AND TRIM(nomor_po) <> '' AND nomor_po <> '-'
      `;
      break;

    case "PO_PUSAT":
      query = `
        SELECT nama_sparepart AS label, total_harga AS value
        FROM spareparts
        WHERE total_harga > 5000000
          AND nomor_po IS NOT NULL AND TRIM(nomor_po) <> '' AND nomor_po <> '-'
      `;
      break;

    case "OUTSTANDING":
      query = `
        SELECT nama_sparepart AS label, total_harga AS value
        FROM spareparts
        WHERE nomor_pr IS NOT NULL AND TRIM(nomor_pr) <> '' AND nomor_pr <> '-'
          AND (nomor_po IS NULL OR TRIM(nomor_po) = '' OR nomor_po = '-')
      `;
      break;

    default:
      console.warn("Kategori chart tidak dikenal:", type);
      return { labels: [], values: [] }; // kembalikan array kosong agar chart tidak error
  }

  const rows = db.prepare(query).all();
  const labels = rows.map(r => r.label);
  const values = rows.map(r => r.value);

  return { labels, values };
  });


  ipcMain.handle("save-chart-jpeg", async (event, dataURL, title, category) => {
  try {
    const now = new Date();
    const todayStr = now.toISOString().slice(0,10);
    const timeStr = now.toTimeString().slice(0,8).replace(/:/g, "-");

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "Simpan Chart",
      defaultPath: `${title.replace(/\s+/g,"_")}_${category}_${todayStr}_${timeStr}.jpeg`,
      filters: [{ name: "JPEG Image", extensions: ["jpeg","jpg"] }]
    });

    if (canceled) return { success: false };

    const base64Data = dataURL.replace(/^data:image\/jpeg;base64,/, "");
    fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));

    return { success: true, path: filePath };
  } catch (err) {
    console.error("Gagal menyimpan chart JPEG:", err);
    return { success: false };
  }
  });


  // === 🔹 Handler Export CSV ===
 ipcMain.handle("export-rmc", async (event, { month, category }) => {
  try {
    console.log("📤 [MAIN] Export RMC:", { month, category });

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const timeStr = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;

    // =========================================
    // GET MAC + USERNAME
    // =========================================
    const os = require("os");

    function getMac() {
      const nets = os.networkInterfaces();
      for (let name of Object.keys(nets)) {
        for (let net of nets[name]) {
          if (net.mac && net.mac !== "00:00:00:00:00:00") return net.mac;
        }
      }
      return "UNKNOWN-MAC";
    }

    function getUser() {
      try {
        return os.userInfo().username || "UNKNOWN-USER";
      } catch {
        return "UNKNOWN-USER";
      }
    }
    function padLabel(label, width = 15) {
  return (label + " ".repeat(width)).slice(0, width);
}

function centerText(text, width = 63) {
  const left = Math.floor((width - text.length) / 2);
  const right = width - text.length - left;
  return " ".repeat(left) + text + " ".repeat(right);
}

    // =========================================
    // QUERY
    // =========================================
    let query = "";
    const params = [`${month}%`];

    switch (category) {
      case "PR_FACTORY":
        query = `
          SELECT * FROM spareparts
          WHERE tanggal LIKE ?
            AND total_harga <= 5000000
            AND nomor_pr IS NOT NULL
            AND TRIM(nomor_pr) <> ''
            AND nomor_pr <> '-'
          ORDER BY tanggal ASC, total_harga DESC
        `;
        break;

      case "PR_PUSAT":
        query = `
          SELECT * FROM spareparts
          WHERE tanggal LIKE ?
            AND total_harga > 5000000
            AND nomor_pr IS NOT NULL
            AND TRIM(nomor_pr) <> ''
            AND nomor_pr <> '-'
          ORDER BY tanggal ASC, total_harga DESC
        `;
        break;

      case "PO_FACTORY":
        query = `
          SELECT * FROM spareparts
          WHERE tanggal LIKE ?
            AND total_harga <= 5000000
            AND nomor_po IS NOT NULL
            AND TRIM(nomor_po) <> ''
            AND nomor_po <> '-'
          ORDER BY tanggal ASC, total_harga DESC
        `;
        break;

      case "PO_PUSAT":
        query = `
          SELECT * FROM spareparts
          WHERE tanggal LIKE ?
            AND total_harga > 5000000
            AND nomor_po IS NOT NULL
            AND TRIM(nomor_po) <> ''
            AND nomor_po <> '-'
          ORDER BY tanggal ASC, total_harga DESC
        `;
        break;

      case "SERTIM":
        query = `
          SELECT * FROM spareparts
          WHERE tanggal LIKE ?
          AND (nomor_pr IS NULL OR TRIM(nomor_pr) = '' OR nomor_pr = '-')
          AND (nomor_po IS NULL OR TRIM(nomor_po) = '' OR nomor_po = '-')
          ORDER BY tanggal ASC, total_harga DESC
        `;
        break;

      case "OUTSTANDING":
        query = `
          SELECT * FROM spareparts
          WHERE tanggal LIKE ?
            AND nomor_pr IS NOT NULL
            AND TRIM(nomor_pr) <> ''
            AND nomor_pr <> '-'
            AND (nomor_po IS NULL OR TRIM(nomor_po) = '' OR nomor_po = '-')
          ORDER BY tanggal ASC, total_harga DESC
        `;
        break;

      default:
        event.sender.send("export-result", { success: false, message: "❌ Kategori tidak dikenal." });
        return;
    }

    const rows = db.prepare(query).all(...params);

    if (!rows.length) {
      event.sender.send("export-result", {
        success: false,
        message: `⚠ Tidak ada data untuk kategori "${category}" pada bulan ${month}`
      });
      return;
    }


// ===== TEMPLATE HEADER — ANTI PECAH KOLOM =====
const LINE = "=".repeat(63);

const headerLines = [
  LINE,
  `Data Export        : ${category}`,
  `Tanggal Export   : ${now.toLocaleString()}`,
  `Exported By        : ${getMac()} | ${getUser()}`,
  `Jumlah Data       : ${rows.length}`,
  LINE
];

// setiap baris header disimpan ke 1 cell.
const headerCSV = headerLines
  .map(line => `"${line}"`)     // Excel tidak bisa memecah teks dalam tanda kutip
  .join("\n");

    //].join("\n");

    // =========================================
    // HEADER KOLOM CSV
    // =========================================
    const colHeader = Object.keys(rows[0]).join(",");
    const csvRows = rows.map(r => Object.values(r).join(",")).join("\n");
    const finalCSV = `${headerCSV}\n${colHeader}\n${csvRows}`;


    // =========================================
    // SIMPAN FILE
    // =========================================
    const { filePath } = await dialog.showSaveDialog({
      title: "Simpan Data RMC",
      defaultPath: `RMC_${category}_${todayStr}_${timeStr}.csv`,
      filters: [{ name: "CSV File", extensions: ["csv"] }]
    });

    if (!filePath) {
      event.sender.send("export-result", {
        success: false,
        message: "❌ Export dibatalkan pengguna."
      });
      return;
    }

    fs.writeFileSync(filePath, finalCSV, "utf8");

    event.sender.send("export-result", {
      success: true,
      message: `✔ File berhasil disimpan!\n${filePath}`
    });

  } catch (err) {
    console.error("❌ Error export RMC:", err);
    event.sender.send("export-result", {
      success: false,
      message: `❌ Gagal export: ${err.message}`
    });
  }
});



ipcMain.handle("check-excel-db", (event, filePath) => {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  const data = rows.slice(2);

  const result = data.map(r => {
    const kode = String(r[1] || "").trim();
    const item = String(r[2] || "").trim();
    const qty  = Number(r[5] || 0);
    const prExcel = String(r[3] || "").trim();

    const found = db.prepare(`
      SELECT *
      FROM spareparts
      WHERE nomor_material = ?
        AND nama_sparepart = ?
        AND quantity = ?
    `).get(kode, item, qty);

    const alreadyUpdated = found && found.nomor_pr && found.nomor_pr === prExcel;

    return {
      excel: {
        nomor_material: kode,
        nama_sparepart: item,
        quantity: qty,
        nomor_pr_excel: prExcel,
        lokasi: r[10]
      },
      db: found || null,
      alreadyUpdated
    };
  });

  return result;
});


ipcMain.handle("update-pr-excel", (event, { id, pr }) => {
  db.prepare(
    "UPDATE spareparts SET nomor_pr = ? WHERE id = ?"
  ).run(pr, id);

 if (mainWindow) {
    mainWindow.webContents.send("rmc-should-refresh");
  }
  return true;
});


ipcMain.handle("get-maskot-path", () => {
  return `file://${path.resolve(__dirname, "assets", "ai-maskot.png")}`;
});




///////////////////////////////////////////////////// KARYAWAN /////////////////////////////////////////////////////////////////////////////////
// GET ALL KARYAWAN
ipcMain.handle("get-karyawan", () => {
  const rows = db.prepare("SELECT * FROM karyawan ORDER BY created_at DESC").all();
  return rows.map(r => ({
    id: r.id,
    nama: r.nama,
    jabatan: r.jabatan,
    status: r.status,
    nik: r.nik,
    tanggal_join: r.tanggal_join,
    habis_kontrak: r.habis_kontrak,
    durasi_kontrak: r.durasi_kontrak,
    attitude: r.attitude,
    absensi: r.absensi,
    operasional: r.operasional,
    image: r.data ? `data:image/jpeg;base64,${Buffer.from(r.data).toString("base64")}` : null
  }));
});

// GET KARYAWAN BY NIK
ipcMain.handle("get-karyawan-by-nik", (event, nik) => {
  const r = db.prepare("SELECT * FROM karyawan WHERE nik = ?").get(nik);

  if (r && r.data) {
    r.image = `data:image/jpeg;base64,${r.data.toString('base64')}`;
  } else {
    r.image = null;
  }

  return r;
});



// SAVE KARYAWAN BARU
// Helper: format tanggal "YYYY-MM-DD"
function formatDateSafe(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

ipcMain.handle("save-karyawan", (event, data) => {
  try {
    // ============================================================
    // 1. VALIDASI DASAR
    // ============================================================
    if (!data.nama) throw new Error("Nama wajib diisi");
    if (!data.nik) throw new Error("NIK wajib diisi");
    if (!data.tanggal_join) throw new Error("Tanggal join wajib diisi");

    const status = (data.status || "").toUpperCase();
    const statusKontrak = ["HT", "PKWT", "OS"];
    const statusPermanent = ["DH", "SH", "UH"];

    let durasiAngka = 0;
    let durasiLabel = "";
    let tanggalHabis = "";

    const tglJoin = new Date(data.tanggal_join);


    // ============================================================
    // 2. STATUS PERMANENT (DH, SH, UH)
    // ============================================================
    if (statusPermanent.includes(status)) {
      durasiAngka = 0;
      durasiLabel = "PERMANENT";
      tanggalHabis = "9999-09-09";
    }


    // ============================================================
    // 3. STATUS KONTRAK (HT, PKWT, OS)
    // ============================================================
    else if (statusKontrak.includes(status)) {

      if (!data.durasi_kontrak) {
        throw new Error("Durasi kontrak wajib diisi untuk karyawan kontrak");
      }

      const raw = String(data.durasi_kontrak).trim().replace(/[^\d]/g, "");
      const durasi = Number(raw);

      if (!raw || isNaN(durasi) || durasi <= 0) {
        throw new Error("Durasi kontrak tidak valid — minimal 1 bulan");
      }

      durasiAngka = durasi;
      durasiLabel = durasi + " Bulan";

      // hitung habis kontrak
      const tglHabis = new Date(tglJoin);
      tglHabis.setMonth(tglHabis.getMonth() + durasi);
      tanggalHabis = tglHabis.toISOString().split("T")[0];
    }


    // ============================================================
    // 4. STATUS LAINNYA
    // ============================================================
    else {
      durasiAngka = 0;
      durasiLabel = data.masa_kerja || "-";
      tanggalHabis = "-";
    }


    // ============================================================
    // 5. FOTO
    // ============================================================
    const fotoBuffer = data.fotoBase64
      ? Buffer.from(data.fotoBase64.split(",")[1], "base64")
      : null;


    // ============================================================
    // 6. SIMPAN KE TABEL KARYAWAN
    // ============================================================
    const insertKar = db.prepare(`
      INSERT INTO karyawan
      (nama, nik, jabatan, status, tanggal_join, habis_kontrak,
       durasi_kontrak, durasi_label, masa_kerja, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertKar.run(
      data.nama,
      data.nik,
      data.jabatan || "",
      status,
      data.tanggal_join,
      tanggalHabis,
      durasiAngka,
      durasiLabel,
      data.masa_kerja || "",
      fotoBuffer
    );


    // ============================================================
    // 7. INSERT JUGA KE PERPANJANGAN (HANYA UNTUK KONTRAK)
    // ============================================================
    if (statusKontrak.includes(status)) {

      const insertPerp = db.prepare(`
        INSERT INTO perpanjangan
        (nik, durasi_bulan, tanggal_mulai, tanggal_selesai, kontrak_ke)
        VALUES (?, ?, ?, ?, ?)
      `);

      insertPerp.run(
        data.nik,
        durasiAngka,
        data.tanggal_join,     // kontrak pertama = tanggal join
        tanggalHabis,          // habis kontrak pertama
        1                      // kontrak pertama
      );
    }


    return { success: true };

  } catch (err) {
    console.error("save-karyawan ERROR:", err);
    return { success: false, error: err.message };
  }
});
// ============================================================
// CEK KONTRAK YANG AKAN HABIS (30 hari sebelum)
// ============================================================
function checkKontrakExpire() {
  try {
    const rows = db.prepare(`
      SELECT
        id,
        nama,
        nik,
        status,
        tanggal_join,
        habis_kontrak,
        durasi_kontrak,
        durasi_label,
        ROUND(julianday(habis_kontrak) - julianday('now')) AS sisa_hari
      FROM karyawan
      WHERE
        status IN ('HT', 'OS', 'PKWT')
        AND habis_kontrak NOT LIKE '9999%'
        AND DATE(habis_kontrak) >= DATE('now')
        AND DATE(habis_kontrak) <= DATE('now', '+30 days')
    `).all();

    if (rows.length > 0) {
      mainWindow.webContents.send("kontrak-expire-notif", rows);
    }

  } catch (err) {
    console.error("Notif kontrak error:", err);
  }
}

// cek setiap 60 detik
setInterval(checkKontrakExpire, 60000);



ipcMain.handle("upload-foto-karyawan", async (event, id) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Pilih Foto Karyawan",
    filters: [{ name: "Images", extensions: ["jpg","jpeg","png","webp"] }],
    properties: ["openFile"]
  });

  if (canceled || !filePaths.length) return null;

  const buffer = fs.readFileSync(filePaths[0]);
  db.prepare("UPDATE karyawan SET data = ? WHERE id = ?").run(buffer, id);
  return filePaths[0]; // kembalikan path untuk preview
});


// UPDATE ATTITUDE / ABSENSI / OPERASIONAL
ipcMain.handle("update-karyawan-params", (event, id, params) => {
  const stmt = db.prepare(`
    UPDATE karyawan
    SET attitude = ?, absensi = ?, operasional = ?
    WHERE id = ?
  `);

  stmt.run(params.attitude, params.absensi, params.operasional, id);
  return true;
});


ipcMain.handle("add-karyawan-performance", (event, nik, nama, params) => {
  const stmt = db.prepare(`
    INSERT INTO karyawan_performance (nik, nama, attitude, absensi, operasional)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(nik, nama, params.attitude, params.absensi, params.operasional);

  return true;
});


ipcMain.handle("get-latest-performance", (event, karyawanId) => {
  return db.prepare(`
    SELECT * FROM karyawan_performance
    WHERE nik = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(karyawanId);
});


// CEK NIK
ipcMain.handle("cek-nik", (event, nik) => {
  const row = db.prepare("SELECT COUNT(*) AS total FROM karyawan WHERE nik = ?").get(nik);
  return { exists: row.total > 0 };
});

// GET FOTO
ipcMain.handle("get-karyawan-foto", (event, id) => {
  const row = db.prepare("SELECT data FROM karyawan WHERE id = ?").get(id);
  return row ? row.data : null;
});

ipcMain.handle("save-foto-buffer", (event, id, buffer) => {
  db.prepare("UPDATE karyawan SET data = ? WHERE id = ?")
    .run(Buffer.from(buffer), id);

  return true;
});

ipcMain.handle("get-performance-history", (event, nik) => {
  const rows = db.prepare(`
    SELECT attitude, absensi, operasional, created_at
    FROM karyawan_performance
    WHERE nik = ?
    ORDER BY created_at ASC
  `).all(nik);

  return rows;
});

ipcMain.handle("hapus-karyawan", async (event, karyawanId) => {
  try {
    if (!karyawanId) {
      return { success: false, error: "ID tidak diberikan" };
    }

    // 1. Ambil nik berdasarkan id
    const row = db.prepare("SELECT nik FROM karyawan WHERE id = ?").get(karyawanId);
    if (!row) {
      return { success: false, error: "Karyawan tidak ditemukan" };
    }

    const nik = row.nik;

    // 2. Hapus riwayat performance berdasarkan NIK
    db.prepare("DELETE FROM karyawan_performance WHERE nik = ?").run(nik);

    // 3. Hapus data karyawan berdasarkan ID
    db.prepare("DELETE FROM karyawan WHERE id = ?").run(karyawanId);

    return { success: true };
  } catch (err) {
    console.error("Gagal hapus karyawan:", err);
    return { success: false, error: err.message };
  }
});

//=======================perpanjangan kontrak===============//
ipcMain.handle("check-nik", (event, nik) => {
  const stmt = db.prepare("SELECT nama, nama FROM karyawan WHERE nik = ?");
  const row = stmt.get(nik);
  return row || null; // jika tidak ada, kirim null
});

//=======================save perpanjangan==========================================//
// main.js
ipcMain.handle("save-perpanjangan", (event, data) => {
  try {
    // LOG DEBUG (bisa dihapus setelah beres)
    console.log("save-perpanjangan called with:", data);

    const nik = data && (String(data.nik).trim());
    let dur = data && data.durasi_bulan;

    if (!nik) throw new Error("Parameter 'nik' kosong atau tidak valid.");

    // normalisasi durasi: terima number atau string like "3" or " 3 "
    if (typeof dur === "string") dur = dur.trim().replace(",", "."); // ganti koma jadi titik jika ada
    const durNum = Number(dur);

    // cek apakah integer positif
    if (!Number.isFinite(durNum) || durNum <= 0 || Math.floor(durNum) !== durNum) {
      throw new Error("Durasi perpanjangan tidak valid. Harus bilangan bulat positif (mis. 1, 2, 3).");
    }

    const durasi_bulan = durNum; // aman sekarang

    const last = db.prepare(`
      SELECT * FROM perpanjangan
      WHERE nik = ?
      ORDER BY kontrak_ke DESC
      LIMIT 1
    `).get(nik);

    // helper parseDate / addMonths / formatDate (pastikan sudah ada di file main.js)
    function parseDate(str) {
      if (!str || typeof str !== "string") return null;
      const m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return null;
      const dt = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
      return isNaN(dt.getTime()) ? null : dt;
    }
    function addMonthsSafe(date, months) {
      const y = date.getFullYear();
      const m = date.getMonth();
      const day = date.getDate();
      let targetMonthIndex = m + months;
      let targetYear = y + Math.floor(targetMonthIndex / 12);
      targetMonthIndex = targetMonthIndex % 12;
      if (targetMonthIndex < 0) { targetMonthIndex += 12; targetYear -= 1; }
      let candidate = new Date(targetYear, targetMonthIndex, day);
      if (candidate.getMonth() !== targetMonthIndex) {
        candidate = new Date(targetYear, targetMonthIndex + 1, 0);
      }
      return candidate;
    }
    function formatDate(d) {
      if (!(d instanceof Date) || isNaN(d.getTime())) return null;
      const y = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${y}-${mm}-${dd}`;
    }

    // tentukan tanggal mulai (ambil tanggal_selesai terakhir jika ada)
    let tglMulaiDate = null;
    if (last && last.tanggal_selesai) {
      tglMulaiDate = parseDate(last.tanggal_selesai);
      if (!tglMulaiDate) {
        const fallback = new Date(last.tanggal_selesai);
        if (!isNaN(fallback.getTime())) tglMulaiDate = fallback;
      }
    }

    // fallback ke karyawan.habis_kontrak atau tanggal_join
    if (!tglMulaiDate) {
      const k = db.prepare(`SELECT tanggal_join, habis_kontrak, durasi_kontrak FROM karyawan WHERE nik = ?`).get(nik);
      if (!k) throw new Error("Karyawan tidak ditemukan untuk NIK: " + nik);

      if (k.habis_kontrak) {
        tglMulaiDate = parseDate(k.habis_kontrak) || new Date(k.habis_kontrak);
      } else if (k.tanggal_join) {
        const parsed = parseDate(k.tanggal_join);
        tglMulaiDate = parsed || new Date(k.tanggal_join);
      }
    }

    if (!tglMulaiDate || isNaN(tglMulaiDate.getTime())) {
      throw new Error("Tanggal mulai kontrak tidak valid atau tidak tersedia.");
    }

    // hitung tanggal selesai baru
    const tglSelesaiDate = addMonthsSafe(tglMulaiDate, durasi_bulan);
    if (!tglSelesaiDate || isNaN(tglSelesaiDate.getTime())) {
      throw new Error("Perhitungan tanggal selesai menghasilkan nilai tidak valid.");
    }

    const mulaiStr = formatDate(tglMulaiDate);
    const selesaiStr = formatDate(tglSelesaiDate);
    if (!mulaiStr || !selesaiStr) throw new Error("Gagal memformat tanggal.");

    const kontrakKe = last ? last.kontrak_ke + 1 : 1;

    // simpan perpanjangan
    db.prepare(`
      INSERT INTO perpanjangan (nik, durasi_bulan, tanggal_mulai, tanggal_selesai, kontrak_ke)
      VALUES (?, ?, ?, ?, ?)
    `).run(nik, durasi_bulan, mulaiStr, selesaiStr, kontrakKe);

    // sinkron ke tabel karyawan
    db.prepare(`
      UPDATE karyawan
      SET durasi_kontrak = ?, habis_kontrak = ?
      WHERE nik = ?
    `).run(durasi_bulan, selesaiStr, nik);

    return { success: true, kontrak_ke: kontrakKe, tanggal_mulai: mulaiStr, tanggal_selesai: selesaiStr };

  } catch (err) {
    console.error("save-perpanjangan error:", err);
    return { success: false, error: err.message };
  }
});



ipcMain.handle("get-latest-perpanjangan", (event, nik) => {
  const stmt = db.prepare(`
    SELECT durasi_bulan, tanggal_mulai
    FROM perpanjangan
    WHERE nik = ?
    ORDER BY kontrak_ke DESC
    LIMIT 1
  `);
  return stmt.get(nik) || null;
});


ipcMain.handle("get-latest-kontrak-ke", (event, nik) => {
  const stmt = db.prepare(`
    SELECT kontrak_ke
    FROM perpanjangan
    WHERE nik = ?
    ORDER BY kontrak_ke DESC
    LIMIT 1
  `);
  const row = stmt.get(nik);
  return row ? row.kontrak_ke : 0; // 0 jika belum ada kontrak
});

///=============================notif============================//
ipcMain.handle("cek-kontrak-expire", () => {
  const rows = db.prepare(`
    SELECT
      id,
      nama,
      nik,
      status,
      habis_kontrak,
      ROUND(julianday(habis_kontrak) - julianday('now')) AS sisa_hari
    FROM karyawan
    WHERE
      status IN ('HT', 'OS', 'PKWT')
      AND habis_kontrak NOT LIKE '9999%'
      AND DATE(habis_kontrak) >= DATE('now')
      AND DATE(habis_kontrak) <= DATE('now', '+30 day')
    ORDER BY sisa_hari ASC
  `).all();

  return rows;
});

//========================================auto check kode barang===========================//
/*ipcMain.handle("cek-nomor-material", (event, params) => {
  try {
    const nomor = params?.nomor_material?.trim() || null;
    const nama  = params?.nama_sparepart?.trim() || null;

    const row = db.prepare(`
      SELECT *
      FROM spareparts
      WHERE
        (? IS NOT NULL AND nomor_material = ?)
        OR
        (? IS NOT NULL AND nama_sparepart LIKE '%' || ? || '%')
      ORDER BY created_at DESC
      LIMIT 1
    `).get(
      nomor, nomor,
      nama, nama
    );

    return row || null;
  } catch (err) {
    console.error("CEK MATERIAL ERROR:", err);
    return null;
  }
});
*/


function safeISO(val) {
  if (typeof val === "string" && val.trim()) return val;
  return new Date().toISOString();
}



async function autoSyncLoop(win) {
  if (syncing) return;
  syncing = true;

  try {
    await pullMasterKodeFromCloud(win);
    await pushMasterKodeToCloud(win);
  } catch (err) {
    console.error("AUTO SYNC ERROR:", err);
    sendSyncStatus(win, {
      status: "error",
      message: err.message
    });
  } finally {
    syncing = false;
  }
}


async function pushMasterKodeToCloud(win) {
  if (!win || win.isDestroyed()) return;

  const total = db.prepare(`
    SELECT COUNT(*) AS total
    FROM master_kode
    WHERE
      synced_at IS NULL
      OR updated_at > synced_at
  `).get().total;

  if (total === 0) {
    sendSyncStatus(win, {
      status: "idle",
      message: "Data sudah sinkron",
      progress: 100
    });
    return;
  }

  sendSyncStatus(win, {
    status: "syncing",
    message: "Mengirim data ke cloud...",
    progress: 0
  });

  let processed = 0;
  const LIMIT = 500;

  while (true) {
    const rows = getUnsyncedMasterKode(LIMIT);
    if (!rows.length) break;

const payload = rows.map(r => {
  const updatedAt = safeISO(r.updated_at);

  return {
    kode: r.kode,
    material: r.material,
    stock_value: Number(r.stock_value || 0),
    currency: r.currency || "IDR",
    qty: Number(r.qty || 0),
    satuan: r.satuan,
    deleted_at: r.deleted_at ?? null,
    updated_at: updatedAt,
    synced_at: updatedAt
  };
});


    const { error } = await supabase
      .from("master_kode")
      .upsert(payload, { onConflict: "kode" });

    if (error) throw error;

    markAsSynced(rows.map(r => r.id), now);

    processed += rows.length;

    sendSyncStatus(win, {
      status: "syncing",
      progress: Math.min(100, Math.round((processed / total) * 100)),
      message: `${processed} / ${total} data`
    });
  }

  sendSyncStatus(win, {
    status: "done",
    progress: 100,
    message: "Sinkronisasi selesai"
  });
}


async function syncMasterKodeWithUI(win) {
  if (!win || win.isDestroyed()) return;

  sendSyncStatus(win, {
    status: "syncing",
    message: "Menyiapkan data...",
    progress: 0
  });

  const total = db.prepare(`
    SELECT COUNT(*) AS total
    FROM master_kode
    WHERE synced_at IS NULL OR updated_at > synced_at
    OR deleted_at IS NOT NULL
  `).get().total;

  if (total === 0) {
    sendSyncStatus(win, {
      status: "idle",
      message: "Tidak ada data untuk disinkron",
      progress: 0
    });
    return;
  }

  let synced = 0;
  const LIMIT = 500;

  while (true) {
    const rows = getUnsyncedMasterKode(LIMIT);
    if (!rows.length) break;

    const payload = rows.map(r => ({
      kode: r.kode,
      material: r.material,
      stock_value: r.stock_value,
      currency: r.currency || "IDR",
      qty: r.qty,
      satuan: r.satuan,
      synced_at:now,
      updated_at: r.updated_at || new Date().toISOString()
    }));

    const { error } = await supabase
      .from("master_kode")
      .upsert(payload, { onConflict: "kode" });

    if (error) throw error;

    markAsSynced(rows.map(r => r.id));
    synced += rows.length;

    sendSyncStatus(win, {
      status: "syncing",
      progress: Math.min(100, Math.round((synced / total) * 100)),
      message: `${synced} / ${total} data`
    });
  }

  sendSyncStatus(win, {
    status: "done",
    progress: 100,
    message: "Sinkronisasi dengan cloud selesai..."
  });
}


function getUnsyncedMasterKode(limit = 500) {
  return db.prepare(`
    SELECT
      id,
      kode,
      material,
      stock_value,
      currency,
      qty,
      satuan,
      updated_at,
      deleted_at
    FROM master_kode
    WHERE
      synced_at IS NULL
      OR updated_at > synced_at
    ORDER BY updated_at
    LIMIT ?
  `).all(limit);
}



async function syncMasterKodeBatch() {
  const rows = getUnsyncedMasterKode(500);

  if (!rows.length) return { done: true };

const payload = rows.map(r => ({
  kode: r.kode,
  material: r.material,
  stock_value: Number(r.stock_value || 0),
  currency: r.currency || "IDR",
  qty: Number(r.qty || 0),
  satuan: r.satuan,
  deleted_at: r.deleted_at,
synced_at:now,
  updated_at: r.updated_at || new Date().toISOString()
}));


  const { error } = await supabase
    .from("master_kode")
    .upsert(payload, {
      onConflict: "kode"
    });

  if (error) throw error;

  // Tandai sudah sync
  const stmt = db.prepare(`
    UPDATE master_kode
    SET synced_at = datetime('now')
    WHERE kode = ?
  `);

  const tx = db.transaction(() => {
    rows.forEach(r => stmt.run(r.kode));
  });

  tx();

  return { done: false, count: rows.length };
}

function sendSyncStatus(win, payload) {
  console.log("📡 SEND SYNC STATUS:", payload);
  win.webContents.send("sync-status", payload);
}



ipcMain.handle("importMasterKode", async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "Data Files", extensions: ["csv", "xlsx", "xls"] }]
    });

 if (result.canceled) {
     return { success: false };
    }

    const filePath = result.filePaths[0];
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const raw = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
      raw: false
    });

   if (!raw.length) {
  mainWindow.webContents.send("show-toast", {
    type: "warning",
    message: "📭 File kosong — tidak ada data yang bisa diimport"
  });

 return { success: false };
}


    // ================= NORMALISASI HEADER =================
    const normalize = s =>
      String(s)
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[^a-z]/g, "");

    const headers = Object.keys(raw[0]);
    const map = {};

    headers.forEach(h => {
      const key = normalize(h);
      map[key] = h;
    });

    console.log("HEADER MAP:", map);

    const parseID = val => {
      if (!val) return 0;
      return Number(
        String(val)
          .replace(/\./g, "")
          .replace(",", ".")
      ) || 0;
    };

    const rows = raw.map(r => ({
      kode: String(r[map["kode"]] || "").trim(),
      material: String(r[map["material"]] || "").trim(),
      stock_value: parseID(r[map["stockvalue"]]),
      currency: String(r[map["currency"]] || "").trim(),
      qty: parseID(r[map["qty"]]),
      satuan: String(r[map["satuan"]] || "").trim()
    }));

 const insert = db.prepare(`
  INSERT INTO master_kode
  (kode, material, stock_value, currency, qty, satuan)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(kode) DO UPDATE SET
    material = excluded.material,
    stock_value = excluded.stock_value,
    currency = excluded.currency,
    qty = excluded.qty,
    satuan = excluded.satuan
`);


    let inserted = 0;
    let skipped = 0;

    const trx = db.transaction(data => {
      for (const r of data) {
        if (!r.kode || !r.material) {
          skipped++;
          continue;
        }
        insert.run(
          r.kode,
          r.material,
          r.stock_value,
          r.currency,
          r.qty,
          r.satuan
        );
        inserted++;
      }
    });

    trx(rows);

    console.log(`IMPORT DONE → INSERTED: ${inserted}, SKIPPED: ${skipped}`);

   mainWindow.webContents.send("show-toast", {
  type: "success",
  message: `✅ Import selesai — ${inserted} data masuk, ${skipped} dilewati`
});

return { success: true, inserted, skipped };


} catch (err) {

    return { success: false, error: err.message };
  }
});

async function pullMasterKodeFromCloud(win) {
  const lastPull = db.prepare(`
    SELECT value FROM sync_state WHERE key='master_kode_last_pull'
  `).get().value;

  sendSyncStatus(win, {
    status: "syncing",
    message: "Mengambil data dari cloud...",
    progress: 0
  });

  const { data, error } = await supabase
    .from("master_kode")
    .select("*")
    .gt("updated_at", lastPull)
    .order("updated_at", { ascending: true })
    .limit(500);

  if (error) throw error;
  if (!data.length) return;

  const upsert = db.prepare(`
    INSERT INTO master_kode
    (kode, material, stock_value, currency, qty, satuan, updated_at, deleted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(kode) DO UPDATE SET
      material=excluded.material,
      stock_value=excluded.stock_value,
      currency=excluded.currency,
      qty=excluded.qty,
      satuan=excluded.satuan,
      updated_at=excluded.updated_at,
      deleted_at=excluded.deleted_at
  `);

  const trx = db.transaction(rows => {
    for (const r of rows) {
      const updatedAt =
        typeof r.updated_at === "string" && r.updated_at.trim()
          ? r.updated_at
          : new Date().toISOString();

      upsert.run(
        r.kode,
        r.material,
        Number(r.stock_value || 0),
        r.currency || "IDR",
        Number(r.qty || 0),
        r.satuan,
        updatedAt,
        r.deleted_at ?? null
      );
    }
  });

  trx(data);

  const newest = data[data.length - 1].updated_at;
  db.prepare(`
    UPDATE sync_state SET value=? WHERE key='master_kode_last_pull'
  `).run(newest);
}


function markAsSynced(ids) {
  if (!ids?.length) return;

  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE master_kode
    SET synced_at = ?
    WHERE id = ?
  `);

  const trx = db.transaction((list) => {
    for (const id of list) {
      stmt.run(now, Number(id));
    }
  });

  trx(ids);
}





ipcMain.handle("checkMaterial", (event, payload) => {
  const keyword =
    payload.nomor_material ||
    payload.nama_sparepart ||
    payload.kode ||
    payload.material;

  if (!keyword) return null;

  // ================== SPAREPARTS ==================
  const spareparts = db.prepare(`
    SELECT
      nomor_material AS kode,
      nama_sparepart AS material,
      vendor,
      harga_satuan,
      function_location,
      sub_location,
      'spareparts' AS source
    FROM spareparts
    WHERE nomor_material LIKE ?
       OR nama_sparepart LIKE ?
    ORDER BY created_at DESC
  `).all(`%${keyword}%`, `%${keyword}%`);

  // ================== MASTER KODE ==================
  const master = db.prepare(`
    SELECT
      kode,
      material,
      NULL AS vendor,
      stock_value AS harga_satuan,
      NULL AS function_location,
      NULL AS sub_location,
      'master_kode' AS source
    FROM master_kode
    WHERE kode LIKE ?
       OR material LIKE ?
  `).all(`%${keyword}%`, `%${keyword}%`);

  const result = [...spareparts, ...master];

  if (!result.length) return null;

  return result;
});

ipcMain.handle("getMasterKode", () => {
  return db.prepare(`
    SELECT * FROM master_kode
    ORDER BY material
  `).all();
});

ipcMain.handle("saveMasterKode", (e, data) => {
  db.prepare(`
    INSERT INTO master_kode
    (kode, material, stock_value, currency, qty, satuan, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(kode) DO UPDATE SET
      material=excluded.material,
      stock_value=excluded.stock_value,
      currency=excluded.currency,
      qty=excluded.qty,
      satuan=excluded.satuan,
      updated_at=datetime('now')
  `).run(
    data.kode,
    data.material,
    data.stock_value,
    data.currency,
    data.qty,
    data.satuan
  );

  return { success: true };
});



ipcMain.handle("loadMasterKode", () => {
  try {
    return db.prepare(`
      SELECT
        id,
        kode,
        material,
        stock_value,
        currency,
        qty,
        satuan
      FROM master_kode
      ORDER BY material ASC
    `).all();
  } catch (err) {
    console.error("LOAD MASTER ERROR:", err);
    return [];
  }
});


ipcMain.handle("deleteMasterKode", (e, kode) => {
  db.prepare(`
    DELETE FROM master_kode WHERE kode=?
  `).run(kode);

  return { success: true };
});


ipcMain.handle("clearMasterKode", () => {
  try {
    return db.prepare(`DELETE FROM master_kode`).run();
  } catch (err) {
    console.error("CLEAR MASTER ERROR:", err);
    return null;
  }
});


//sinkron ke supabase
ipcMain.handle("syncMasterKodeToSupabase", async () => {
  try {
    const data = db.prepare(`
      SELECT
        kode,
        material,
        stock_value,
        currency,
        qty,
        satuan,
        created_at
      FROM master_kode
    `).all();

    if (!data.length) {
      return { success: true, message: "Tidak ada data untuk sync" };
    }

    const payload = data.map(r => ({
      kode: r.kode,
      material: r.material,
      stock_value: Number(r.stock_value || 0),
      currency: r.currency || "IDR",
      qty: Number(r.qty || 0),
      satuan: r.satuan,
      created_at: r.created_at ?? new Date().toISOString()
    }));

    const { error } = await supabase
      .from("master_kode")
      .upsert(payload, {
        onConflict: "kode"
      });

    if (error) throw error;

    return {
      success: true,
      total: payload.length
    };

  } catch (err) {
    console.error("SYNC MASTER_KODE ERROR:", err);
    return { success: false, error: err.message };
  }
});

//==============================================================================================//





//================================Inventory Screen==============================================//

async function exportAll(data, win) {
  const total = data.length;
  let sent = 0;

  for (const row of data) {
    await upsertToSupabase(row);
    sent++;

    const percent = Math.round((sent / total) * 100);
    win.webContents.send("sync-progress", percent, "Export data");
  }

  win.webContents.send("sync-progress", 100, "Export selesai");
}


// Open file dialog for Excel
ipcMain.handle("inventory:openFileDialog", async () => {
  const result = await dialog.showOpenDialog({
    filters: [{ name: "Excel Files", extensions: ["xls", "xlsx"] }],
    properties: ["openFile"]
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// Read Excel and return json
ipcMain.handle("inventory:readExcel", async (event, filePath) => {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    // === Tambahkan last_update otomatis ===
    const now = new Date().toISOString();
    const withTimestamp = json.map(row => ({
      ...row,
      last_update: now
    }));

    return { ok: true, data: withTimestamp };

  } catch (e) {
    return { ok: false, error: e.message };
  }
});


// Load inventory rows
ipcMain.handle("inventory:load", (event) => {
  const rows = db.prepare("SELECT * FROM inventory ORDER BY kode IS NULL, kode ASC, id ASC").all();

  event.sender.send("inventory:setData", rows);
  return rows;
});


ipcMain.handle("inventory:saveToDB", (event, data) => {
  try {
    const stmt = db.prepare(`
      INSERT INTO inventory (
        kode, nama_material, satuan, lokasi, Quantity, last_update, exported
      )
      VALUES (?, ?, ?, ?, ?, ?, 0)
      ON CONFLICT(kode) DO UPDATE SET
        nama_material = excluded.nama_material,
        satuan        = excluded.satuan,
        lokasi        = excluded.lokasi,
        Quantity      = excluded.Quantity,
        last_update   = excluded.last_update,
        exported      = 0
    `);

    const tx = db.transaction((rows) => {
      rows.forEach(row => {
        stmt.run([
          row.kode ?? null,
          row.nama_material ?? "",
          row.satuan ?? "",
          row.lokasi ?? "",
          Number(row.Quantity) || 0,
          getWIBDateTime()
        ]);
      });
    });

    tx(data || []);

    const updated = db
      .prepare("SELECT * FROM inventory ORDER BY kode IS NULL, kode ASC, id ASC")
      .all();

    event.sender.send("inventory:setData", updated);

    // 🔥 AUTO SYNC KE SUPABASE
    syncUp();

    return { ok: true };

  } catch (e) {
    console.error("inventory:saveToDB error:", e);
    return { ok: false, error: e.message };
  }
});


ipcMain.handle("inventory:exportAll", async (event, rows) => {
  const win = BrowserWindow.fromWebContents(event.sender);

  try {
    // ===============================
    // PREPARE STATEMENT (DI ATAS)
    // ===============================
    const insert = db.prepare(`
      INSERT INTO inventory (
        kode, nama_material, satuan, lokasi, Quantity, exported, last_update
      ) VALUES (?, ?, ?, ?, ?, 0, ?)
      ON CONFLICT(kode) DO UPDATE SET
        nama_material = excluded.nama_material,
        satuan = excluded.satuan,
        lokasi = excluded.lokasi,
        Quantity = excluded.Quantity,
        exported = 0,
        last_update = excluded.last_update
    `);

    const totalLocal = rows.length;
    let localDone = 0;

    // ===============================
    // TRANSACTION
    // ===============================
    const tx = db.transaction((rows) => {
      for (const r of rows) {
        insert.run(
          r.kode,
          r.nama_material,
          r.satuan,
          r.lokasi,
          Number(r.Quantity) || 0,
          r.last_update
        );

        localDone++;
        const percent = Math.round((localDone / totalLocal) * 50);
        sendExportProgress(win, percent, "Menyimpan lokal");
      }
    });

    // EKSEKUSI TRANSACTION
    tx(rows);

    // ===============================
    // SYNC REAL (50–100%)
    // ===============================
    await syncUpReal(win, (done, total) => {
      const percent = 50 + Math.round((done / total) * 50);
      sendExportProgress(win, percent, "Sinkronisasi");
    });

    sendExportProgress(win, 100, "Selesai");
    return { ok: true };

  } catch (err) {
    console.error("EXPORT ERROR:", err);
    return { ok: false, error: err.message };
  }
});


ipcMain.handle("inventory:exportOne", (event, row) => {
  try {
    const stmt = db.prepare(`
      INSERT INTO inventory(kode, nama_material, satuan, lokasi, Quantity, exported, last_update)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(kode) DO UPDATE SET
        nama_material=excluded.nama_material,
        satuan=excluded.satuan,
        lokasi=excluded.lokasi,
        Quantity=excluded.Quantity,
        exported=excluded.exported,
        last_update=excluded.last_update
    `);
    stmt.run([
      row.kode ?? null,
      row.nama_material ?? "",
      row.satuan ?? "",
      row.lokasi ?? "",
      Number(row.Quantity) || 0,
      0,
      getWIBDateTime()
    ]);

    // >>> SEND UPDATED DATA
    const updated = db.prepare("SELECT * FROM inventory ORDER BY kode IS NULL, kode ASC, id ASC").all();
    event.sender.send("inventory:setData", updated);

    return { ok: true };

  } catch (e) {
    return { ok: false, error: e.message };
  }
});


ipcMain.handle("supabase-status", async () => {
  try {
    const { data, error } = await supabase
      .from("inventory_kode")
      .select("*")
      .limit(1);

    if (error) {
      console.log("Supabase error:", error.message);
      return false;
    }

    return true; // online
  } catch (err) {
    console.log("Supabase unreachable:", err);
    return false; // offline
  }
});

async function saveLocalAndSync(win) {
  const online = await checkSupabaseOnline();
  if (!online) return;

  await syncUp(); // kirim yang exported=0
}


async function syncDown() {
return;
}



async function syncUp(win) {
  const items = db.prepare(`
    SELECT * FROM inventory WHERE exported = 0
  `).all();

  const total = items.length;
  let done = 0;

  for (const item of items) {
    await supabase.from("inventory_kode").upsert({
      kode_material: item.kode,
      nama_material: item.nama_material,
      satuan: item.satuan,
      lokasi: item.lokasi,
      jumlah: item.Quantity,
      updated_at: item.last_update
    }, { onConflict: "kode_material" });

    db.prepare(
      "UPDATE inventory SET exported = 1 WHERE kode = ?"
    ).run(item.kode);

    done++;
    const percent = 50 + Math.round((done / total) * 40);
    sendProgress(win, percent, `Export ${done}/${total}`);
  }
}






async function twoWaySync(win) {
  console.log("🔄 Mulai Two-Way Sync...");

  // =======================
  // 1. Ambil data Supabase
  // =======================
  const { data: supaData, error } = await supabase
    .from("inventory_kode")
    .select("*");

  if (error) return { success: false, error };

  const lokalData = db.prepare("SELECT * FROM inventory").all();

  const totalDown = supaData.length;
  const totalUp = lokalData.length;

  const totalItems = totalDown + totalUp;
  let current = 0;

  const updateProgress = () => {
    const pct = Math.min(100, Math.floor((current / totalItems) * 100));
    sendProgress(win, pct);
  };

  // =======================
  // 2. Supabase → Lokal
  // =======================
  for (const row of supaData) {
    const lokal = db.prepare("SELECT * FROM inventory WHERE kode = ?")
      .get(row.kode_material);

    if (!lokal) {
      db.prepare(`
        INSERT INTO inventory (kode, nama_material, satuan, lokasi, Quantity, last_update, exported)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `).run(
        row.kode_material,
        row.nama_material,
        row.satuan,
        row.lokasi,
        row.jumlah,
        row.terakhir_update
      );
    } else {
      const beda =
        lokal.nama_material !== row.nama_material ||
        lokal.satuan !== row.satuan ||
        lokal.lokasi !== row.lokasi ||
        lokal.Quantity !== row.jumlah;

      if (beda) {
        db.prepare(`
          UPDATE inventory
          SET nama_material = ?, satuan = ?, lokasi = ?, Quantity = ?, last_update = ?, exported = 1
          WHERE kode = ?
        `).run(
          row.nama_material,
          row.satuan,
          row.lokasi,
          row.jumlah,
          row.terakhir_update,
          row.kode_material
        );
      }
    }

    current++;
    updateProgress();
  }

  // =======================
  // 3. Lokal → Supabase
  // =======================
  for (const item of lokalData) {
    const { data: sb, error } = await supabase
      .from("inventory_kode")
      .select("*")
      .eq("kode_material", item.kode)
      .single();

    if (error && error.code !== "PGRST116") {
      console.log("Supabase error:", error);
      current++;
      updateProgress();
      continue;
    }

    if (!sb) {
      await supabase.from("inventory_kode").insert({
        kode_material: item.kode,
        nama_material: item.nama_material,
        satuan: item.satuan,
        lokasi: item.lokasi,
        jumlah: item.Quantity,
        terakhir_update: item.last_update
      });
    } else {
      const beda =
        sb.nama_material !== item.nama_material ||
        sb.satuan !== item.satuan ||
        sb.lokasi !== item.lokasi ||
        sb.jumlah !== item.Quantity;

      if (beda) {
        await supabase
          .from("inventory_kode")
          .update({
            nama_material: item.nama_material,
            satuan: item.satuan,
            lokasi: item.lokasi,
            jumlah: item.Quantity,
            terakhir_update: item.last_update
          })
          .eq("kode_material", item.kode);
      }
    }

    current++;
    updateProgress();
  }

  console.log("✅ Two-Way Sync selesai");
  sendProgress(win, 100);

  return { success: true };
}


ipcMain.handle("two-way-sync", async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return await twoWaySync(win);
});


function sendProgress(win, percent, text = "") {
  if (!win || win.isDestroyed()) return;
  win.webContents.send("sync-progress", percent, text);
}


async function incrementalSync(win) {
  sendProgress(win, 10, "Persiapan");

  await syncDown();
  sendProgress(win, 50, "Ambil data");


  sendProgress(win, 90, "Kirim data");
  await syncUp(win);

  sendProgress(win, 100, "Selesai");
}
ipcMain.handle("incremental-sync", async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);

  try {
    console.log("🚀 MAIN: incremental-sync dipanggil");
    await incrementalSync(win);
    return { ok: true };
  } catch (err) {
    console.error("Incremental sync error:", err);
    return { ok: false, error: err.message };
  }
});



ipcMain.on("save-inventory-manual", (event, data) => {
  try {
    const now = getWIBDateTime();

    /* =========================
       1️⃣ SAVE / UPDATE INVENTORY
       ========================= */
    const stmt = db.prepare(`
      INSERT INTO inventory
      (kode, nama_material, satuan, lokasi, Quantity, last_update)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(kode) DO UPDATE SET
        nama_material = excluded.nama_material,
        satuan = excluded.satuan,
        lokasi = excluded.lokasi,
        Quantity = excluded.Quantity,
        exported = 0,
        last_update = excluded.last_update
    `);

    stmt.run(
      data.kode,
      data.nama_material,
      data.satuan,
      data.lokasi,
      data.quantity,
      now
    );

    /* =========================
       2️⃣ LOG SETELAH SUKSES
       ========================= */
    db.prepare(`
      INSERT INTO inventory_logs
      (action, kode, detail, source, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      "SAVE",
      data.kode,
      "Save manual inventory dari UI",
      "ui",
      now
    );

    /* =========================
       3️⃣ REPLY KE RENDERER
       ========================= */
    event.reply("save-inventory-result", {
      success: true,
      data: {
        kode: data.kode,
        nama_material: data.nama_material,
        satuan: data.satuan,
        lokasi: data.lokasi,
        Quantity: Number(data.quantity),
        exported: 1,
        last_update: now
      }
    });

  } catch (err) {
    console.error("SAVE INVENTORY ERROR:", err);

    /* =========================
       4️⃣ LOG ERROR
       ========================= */
    db.prepare(`
      INSERT INTO inventory_logs
      (action, kode, detail, source, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      "SAVE_ERROR",
      data?.kode || "-",
      err.message,
      "ui",
      getWIBDateTime()
    );

    event.reply("save-inventory-result", {
      success: false,
      message: err.message,
    });
  }
});



ipcMain.handle("delete-inventory", async (_, kode) => {
  try {
    /* =========================
       1️⃣ DELETE SQLITE (LOKAL)
       ========================= */
    db.prepare(`
      DELETE FROM inventory
      WHERE kode = ?
    `).run(kode);


  db.prepare(`
      INSERT INTO inventory_logs
      (action, kode, detail, source, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      "DELETE",
      kode,
      "Delete manual dari UI inventory",
      "ui",
      getWIBDateTime()
    );

    /* =========================
       2️⃣ CEK SUPABASE DULU
       ========================= */
    const { data, error: checkError } = await supabase
      .from("inventory_kode")
      .select("kode_material")
      .eq("kode_material", kode)
      .maybeSingle();

    if (checkError) {
      console.warn("Supabase check error:", checkError.message);
    }

    /* =========================
       3️⃣ DELETE JIKA ADA
       ========================= */
    if (data) {
      const { error: deleteError } = await supabase
        .from("inventory_kode")
        .delete()
        .eq("kode_material", kode);

      if (deleteError) throw deleteError;
    }

    return { ok: true };
  } catch (err) {
    console.error("DELETE INVENTORY ERROR:", err);

     db.prepare(`
      INSERT INTO inventory_logs
      (action, kode, detail, source, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      "DELETE_ERROR",
      kode,
      err.message,
      "ui",
      getWIBDateTime()
    );

    return { ok: false, error: err.message };
  }
});


//===============auto correct===================//
ipcMain.handle("get-inventory-master", () => {
  return db.prepare(`
    SELECT DISTINCT
      nama_material,
      satuan,
      lokasi
    FROM inventory
    WHERE nama_material IS NOT NULL
  `).all();
});


//==================logs=================================//
ipcMain.handle("get-inventory-logs", async (_, limit = 5000) => {
  try {
    const rows = db.prepare(`
      SELECT
        id,
        action,
        kode,
        detail,
        source,
        created_at
      FROM inventory_logs
      ORDER BY id DESC
      LIMIT ?
    `).all(limit);

    return { ok: true, data: rows };
  } catch (err) {
    console.error("GET LOG ERROR:", err);
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("get-pdf-filename", () => {
  const mac = getMacPdf().replace(/:/g, "-");
  const user = getUserPdf();

  const now = new Date();
  const pad = n => String(n).padStart(2, "0");

  const tanggal =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const jam =
    `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

  return `${mac}-${user}-${tanggal}-${jam}`;
});


ipcMain.handle("export-log-pdf", async (_, { html, filename }) => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: true }
  });

  await win.loadURL(
    "data:text/html;charset=utf-8," + encodeURIComponent(html)
  );

  const pdfBuffer = await win.webContents.printToPDF({
    printBackground: true
  });

  // ✅ TANYA USER LOKASI SIMPAN
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "Simpan Inventory Log",
    defaultPath: `${filename}.pdf`,
    filters: [{ name: "PDF", extensions: ["pdf"] }]
  });

  if (canceled || !filePath) {
    win.destroy();
    return { ok: false, canceled: true };
  }

  fs.writeFileSync(filePath, pdfBuffer);

  win.destroy();

  return { ok: true, path: filePath };
});


//=AI
ipcMain.handle("ai-summary", async (_, payload) => {
  try {
    const logs = Array.isArray(payload?.logs) ? payload.logs : [];

    if (!logs.length) {
      return { ok: false, error: "Tidak ada data log untuk dianalisa" };
    }

    // ===============================
    // BASIC STATISTICS
    // ===============================
    const total = logs.length;

    const actionCount = {};
    const kodeCount = {};
    const sourceCount = {};

    logs.forEach(l => {
      actionCount[l.action] = (actionCount[l.action] || 0) + 1;
      kodeCount[l.kode] = (kodeCount[l.kode] || 0) + 1;
      sourceCount[l.source] = (sourceCount[l.source] || 0) + 1;
    });

    const mostAction = Object.entries(actionCount)
      .sort((a, b) => b[1] - a[1])[0];

    const mostKode = Object.entries(kodeCount)
      .sort((a, b) => b[1] - a[1])[0];

    const deleteCount = actionCount.DELETE || 0;

    // ===============================
    // SIMPLE INSIGHT RULES
    // ===============================
    const warnings = [];

    if (deleteCount > 0) {
      warnings.push(`DELETE terdeteksi (${deleteCount} kali)`);
    }

    if (mostKode && mostKode[1] >= 5) {
      warnings.push(`Perubahan berulang pada item ${mostKode[0]}`);
    }

    // ===============================
    // DATE RANGE
    // ===============================
    const dates = logs.map(l => l.created_at.slice(0, 10));
    const from = dates[dates.length - 1];
    const to = dates[0];

    // ===============================
    // SUMMARY TEXT
    // ===============================
    const summary = `
📊 Ringkasan Aktivitas Inventory

• Total aktivitas: ${total}
• Aksi terbanyak: ${mostAction[0]} (${mostAction[1]}x)
• Item paling sering berubah: ${mostKode[0]} (${mostKode[1]}x)
• Sumber dominan: ${Object.entries(sourceCount).sort((a,b)=>b[1]-a[1])[0][0]}

${warnings.length ? "⚠️ Perhatian:\n• " + warnings.join("\n• ") : "✓ Tidak ada anomali signifikan"}

📅 Rentang data:
${from} s/d ${to}
`.trim();

    return {
      ok: true,
      summary,
      meta: {
        total,
        actionCount,
        mostAction,
        mostKode
      }
    };
  } catch (err) {
    console.error("AI SUMMARY ERROR:", err);
    return { ok: false, error: err.message };
  }
});


//=======================================export atau print data==========================//
function getWIBDateTimeFileSafe() {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" })
  );

  const pad = n => String(n).padStart(2, "0");

  return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_` +
         `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}


function buildPDFFileName() {
  const mac = getMacPdf();
  const user = getUserPdf();
  const date = getWIBDateTime();

  return `Inventory_${user}_${mac}_${date}.pdf`;
}
function sanitizeRange(range) {
  return String(range || "ALL")
    .toUpperCase()
    .replace(/[^A-Z0-9\-]/g, "");
}


function sanitizeFilePart(str) {
  return String(str || "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "") // karakter terlarang
    .replace(/\s+/g, "_")                  // spasi → _
    .trim();
}

function buildPDFFileNameWithRange(range) {
  const user = sanitizeFilePart(getUserPdf());
  const mac  = sanitizeFilePart(getMacPdf());
  const safeRange = sanitizeFilePart(range || "ALL");
  const time = getWIBDateTimeFileSafe();

  return `Inventory_${user}_${mac}_${safeRange}_${time}.pdf`;
}



ipcMain.handle("inventory-get-pdf-meta", async () => {
  return {
    user: getUserPdf(),
    mac: getMacPdf(),
    time: getWIBDateTimeFileSafe(),
    dateStyle: "short",
      timeStyle: "medium"
  };
});

ipcMain.handle("inventory-export-pdf-ready", async (event, payload) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { canceled: true, filePath: null };

  // Tunggu renderer stabil
  await new Promise(r => setTimeout(r, 200));

  const pdfBuffer = await win.webContents.printToPDF({
    printBackground: true,
    pageSize: "A4",
    landscape: false,
    marginsType: 1
  });

  const fileName = `Inventory_${payload.range}_${new Date().toISOString().replace(/[:.]/g,'')}.pdf`;

  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    defaultPath: path.join(app.getPath("downloads"), fileName),
    filters: [{ name: "PDF", extensions: ["pdf"] }]
  });

  if (!canceled && filePath) {
    fs.writeFileSync(filePath, pdfBuffer);

    // Catat log aktivitas
    activity_log({
      action: "EXPORT_PDF",
      file: path.basename(filePath),
      range: payload.range,
      user: getUserPdf(),
      mac: getMacPdf(),
      time: getWIBDateTimeFileSafe()
    });
  }

  // Harus mengembalikan filePath agar renderer tahu lokasi file
  return { canceled, filePath: canceled ? null : filePath };
});



ipcMain.handle("inventory-print-native", async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { success: false };

  return new Promise((resolve) => {
    win.webContents.print(
      {
        silent: false,          // dialog print native
        printBackground: true,
        margins: {
          marginType: "printableArea"
        }
      },
      (success, errorType) => {

        // ✅ HANYA LOG JIKA USER BENAR-BENAR PRINT
        if (success) {
          try {
            activity_log({
              action: "PRINT",
              target: "INVENTORY",
              user: getUserPdf(),
              mac: getMacPdf(),
              time: getWIBDateTimeFileSafe()
            });
          } catch (err) {
            console.error("Gagal menulis activity log PRINT:", err);
          }
        }

        // success = true  → print dijalankan
        // success = false → user cancel
        resolve({ success, errorType });
      }
    );
  });
});


//==========================exported persentase===========================//

function sendExportProgress(win, percent, label = "") {
  if (!win || win.isDestroyed()) return;
  win.webContents.send("export-progress", {
    percent,
    label
  });
}

ipcMain.handle("export-all-with-progress", async (event, rows) => {
  const total = rows.length;
  let done = 0;
  const batchSize = 50;

  for (let i = 0; i < total; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    insertBatchToLocalDB(batch); // sync / async OK

    done += batch.length;

    const percent = Math.round((done / total) * 50); // 0–50%
    event.sender.send("export-progress", percent);

    if(success)
    {
      try{
        activity_log({
          action: " export all",
          target: " INVENTORY",
          user: getMacPdf(),
          time: getWIBDateTimeFileSafe()
        });
      }catch(error)
      {
        console.error("Gagal menulis activity log export:", err);
      }
    }
        resolve({ success,errorType});
  }

  return true;
});



async function syncUpReal(win, onProgress) {
  const rows = db.prepare(`
    SELECT * FROM inventory WHERE exported = 0
  `).all();

  const total = rows.length;
  if (total === 0) return;

  let done = 0;

  for (const row of rows) {

    await supabase
      .from("inventory")
      .upsert({
        kode: row.kode,
        nama_material: row.nama_material,
        satuan: row.satuan,
        lokasi: row.lokasi,
        Quantity: row.Quantity,
        last_update: row.last_update
      });


    db.prepare(`
      UPDATE inventory SET exported = 1 WHERE kode = ?
    `).run(row.kode);

    done++;
    onProgress?.(done, total);
  }
}



//==================================================================================================//

//==============================================overtime screen function==========================//
ipcMain.handle("get-config-lembur", (_, nik) => {
  return db
    .prepare("SELECT * FROM config_lembur WHERE nik = ?")
    .get(nik);
});

ipcMain.handle("save-config-lembur", (_, payload) => {
  db.prepare(`
    INSERT INTO config_lembur (nik, nama, status, kategori, nilai)
    VALUES (@nik, @nama, @status, @kategori, @nilai)
    ON CONFLICT(nik) DO UPDATE SET
      nilai = excluded.nilai,
      status = excluded.status,
      kategori = excluded.kategori,
      updated_at = datetime('now','localtime')
  `).run(payload);
});



ipcMain.handle("get-all-karyawan", () => {
  return db.prepare(`
    SELECT nik, nama, status
    FROM karyawan
    ORDER BY nama
  `).all();
});


ipcMain.handle("insert-overtime", (_, p) => {
  const stmt = db.prepare(`
    INSERT INTO overtime (
      nik, nama, status, kategori, tanggal, jenis_hari,
      jam, gapok, mh, tarif, total, keterangan
    ) VALUES (
      @nik, @nama, @status, @kategori, @tanggal, @jenis_hari,
      @jam, @gapok, @mh, @tarif, @total, @keterangan
    )
  `);
   return stmt.run(p);
});





ipcMain.handle("report-weekly-total", (_, { startDate, endDate }) => {
  try {
    const stmt = db.prepare(`
      SELECT
        SUM(total) AS total_biaya,
        SUM(jam) AS total_jam
      FROM overtime
      WHERE tanggal BETWEEN ? AND ?
    `);

    return stmt.get(startDate, endDate);
  } catch (err) {
    console.error("Weekly total error:", err);
    return null;
  }
});

ipcMain.handle("report-weekly-by-day", (_, { startDate, endDate }) => {
  try {
    const stmt = db.prepare(`
      SELECT
        strftime('%w', tanggal) AS hari,
        COUNT(*) AS jumlah_orang,
        SUM(jam) AS total_jam,
        SUM(total) AS total_biaya
      FROM overtime
      WHERE tanggal BETWEEN ? AND ?
      GROUP BY hari
      ORDER BY hari
    `);

    return stmt.all(startDate, endDate);
  } catch (err) {
    console.error("Weekly by day error:", err);
    return [];
  }
});

ipcMain.handle("report-weekly-detail", (_, { startDate, endDate }) => {
  try {
    const stmt = db.prepare(`
      SELECT
        tanggal,
        nik,
        nama,
        status,
        kategori,
        jam,
        tarif,
        total,
        keterangan
      FROM overtime
      WHERE tanggal BETWEEN ? AND ?
      ORDER BY tanggal ASC, nama ASC
    `);

    return stmt.all(startDate, endDate);
  } catch (err) {
    console.error("Weekly detail error:", err);
    return [];
  }
});


ipcMain.handle("week:getConfig", () => {
  return weekDB.getWeekConfig();
});

ipcMain.handle("week:saveConfig", (_, data) => {
  return weekDB.saveWeekConfig(data);
});


ipcMain.handle("get-company-week-rule", (_, year) => {
  return companyWeekDB.getCompanyWeekRule(year);
});

ipcMain.handle("save-company-week-rule", (_, payload) => {
  return companyWeekDB.saveCompanyWeekRule(payload);
});


ipcMain.handle("overtime-get-name-date", (_, { nama, tanggal }) =>
  db.prepare(`
    SELECT * FROM overtime
    WHERE nama = ? AND tanggal = ?
  `).get(nama, tanggal)
);

ipcMain.handle("overtime-update-name-date", (_, p) => {
  return db.prepare(`
    UPDATE overtime
    SET
      nik = @nik,
      nama = @nama,
      status = @status,
      kategori = @kategori,
      mh = @mh,
      tarif = @tarif,
      total = @total,
      tanggal = @tanggal,
      jam = @jam,
      jenis_hari = @jenis_hari,
      gapok = @gapok,
      keterangan = @keterangan
    WHERE nama = @old_nama AND tanggal = @old_tanggal
  `).run(p);
});




ipcMain.handle("overtime-delete-name-date", (_, p) =>
  db.prepare(`
    DELETE FROM overtime
    WHERE nama = ? AND tanggal = ?
  `).run(p.nama, p.tanggal)
);





//=========================================Sales============================================================//
ipcMain.handle("save-sales-monthly", (_, payload) => {
  const exists = db.prepare(`
    SELECT id FROM sales_monthly WHERE bulan = ? AND tahun = ? AND week_now = ?
  `).get(payload.bulan, payload.tahun, payload.week_now);

  if (exists) {
    return db.prepare(`
      UPDATE sales_monthly SET
        sales_target=@sales_target,
        sales_target_week=@sales_target_week,
        aktual_gr=@aktual_gr,
        budget_bulan=@budget_bulan,
        week_by_month=@week_by_month,
        budget_week=@budget_week,
        final_budget=@final_budget,
        rasio=@rasio,
        realisasi_overtime=@realisasi_overtime,
        persentase=@persentase,
        budget_by_ci=@budget_by_ci,
        selisih_budget_fa=@selisih_budget_fa,
        selisih_budget_ci=@selisih_budget_ci,
        man_hour=@man_hour,
        bobot=@bobot,
        nominal=@nominal,
        rasio_weekly=@rasio_weekly,
        rasio_average=@rasio_average,
        week_now=@week_now,

        updated_at=CURRENT_TIMESTAMP
      WHERE id=@id
    `).run({...payload, id: exists.id});
  } else {
    return db.prepare(`
      INSERT INTO sales_monthly (
        bulan, tahun,week_now, sales_target, sales_target_week, aktual_gr, budget_bulan,budget_week,final_budget,week_by_month,rasio,persentase,
        realisasi_overtime,budget_by_ci, selisih_budget_fa, selisih_budget_ci, man_hour, bobot,nominal,rasio_weekly,rasio_average
      ) VALUES (
        @bulan,@tahun,@week_now,@sales_target,@sales_target_week,@aktual_gr,@budget_bulan,@budget_week,@final_budget,@week_by_month,@rasio,@persentase,
        @realisasi_overtime,@budget_by_ci,@selisih_budget_fa,@selisih_budget_ci,@man_hour,@bobot,@nominal,@rasio_weekly,@rasio_average
      )
    `).run(payload);
  }
});

ipcMain.handle("get-sales-all", () => {
  return db.prepare(`SELECT * FROM sales_monthly ORDER BY tahun, bulan`).all();
});

ipcMain.handle("delete-sales", (_, { bulan, tahun }) => {
  return db.prepare(`
    DELETE FROM sales_monthly
    WHERE bulan = ? AND tahun = ?
  `).run(bulan, tahun);
});


ipcMain.handle("spareparts:get-current-week", async () => {
  const row = db.prepare(`
    SELECT week
    FROM spareparts
    ORDER BY tanggal DESC
    LIMIT 1
  `).get();

  return row ? row.week : null;
});


ipcMain.handle("sales:get-by-week", (_, week) => {
  if (!week) return [];

  const rows = db.prepare(`
    SELECT *
    FROM sales_monthly
    WHERE week_now = ?
    ORDER BY tahun, bulan
  `).all(week);

  return rows;
});


ipcMain.handle("sales:getWeeklyBudget", async (_, { tahun, minggu }) => {
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(budget_week), 0) AS budget_week
    FROM sales_monthly
    WHERE tahun = ?
      AND week_now = ?
  `).get(tahun, minggu);

  return {
    budget_week: Number(row.budget_week)
  };
});


ipcMain.handle("overtime:getWeeklySummary", async (_, { tahun, minggu }) => {
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(jam), 0)   AS total_jam,
      COALESCE(SUM(total), 0) AS total_biaya
    FROM overtime
    WHERE strftime('%Y', tanggal) = ?
      AND strftime('%W', tanggal) = ?
  `).get(
    tahun.toString(),
    minggu.toString()
  );

  // ⛑️ RETURN OBJECT BARU (AMAN UNTUK IPC)
  return {
    total_jam: Number(row.total_jam),
    total_biaya: Number(row.total_biaya)
  };
});


//=================================updater==============================//

ipcMain.on("update-download", () => {
  autoUpdater.downloadUpdate();
});

ipcMain.on("update-install", () => {
  autoUpdater.quitAndInstall();
});


