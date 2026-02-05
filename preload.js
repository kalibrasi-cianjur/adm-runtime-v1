const { contextBridge, ipcRenderer, shell } = require("electron");



// ========== API UTAMA ==========
contextBridge.exposeInMainWorld("api", {
  saveSparepart: (data) => ipcRenderer.invoke("save-sparepart", data),
  getHistory: () => ipcRenderer.invoke("get-history"),
  loadHistoryByWeek: (offset) => ipcRenderer.invoke("load-history-by-week", offset),
  loadHistoryByMonth: (offset) => ipcRenderer.invoke("load-history-by-month", offset),
  loadHistoryWeek: () => ipcRenderer.invoke("load-history-week"),
  loadHistoryMonth: () => ipcRenderer.invoke("load-history-month"),
  loginUser: (data) => ipcRenderer.invoke("login-user", data),
  openVisitorView: () => ipcRenderer.invoke("open-visitor-view"),
  onVisitorMode: (callback) => ipcRenderer.on("visitor-mode", callback),
  onShowAppInfo: (callback) => ipcRenderer.on("show-app-info", (_, data) => callback(data)),
  closeWindow: () => ipcRenderer.send("close-info-window"),
  getAllLocations: () => ipcRenderer.invoke("get-all-locations"),
   getAllMasterLocation: () => ipcRenderer.invoke("getAllMasterLocation"),
    syncMasterLocation: () => ipcRenderer.invoke("syncMasterLocation"),
  addLocation: (data) => ipcRenderer.invoke("add-location", data),
  // addLocation: (funcLoc, subLoc) =>
   // ipcRenderer.invoke("add-location", { funcLoc, subLoc }),
  checkExcelAgainstDB: (filePath) => ipcRenderer.invoke("check-excel-db", filePath),
  updatePRForRecord: (data) => ipcRenderer.invoke("update-pr-excel", data),
  saveFile: (options) => ipcRenderer.invoke("save-file", options),
  loginSuccess: (role) => ipcRenderer.invoke("login-success", role),
  onLoadingShow: (callback) => ipcRenderer.on("loading-show", callback),
  onLoadingHide: (callback) => ipcRenderer.on("loading-hide", callback),
  getCurrentUser: () => ipcRenderer.invoke("get-current-user"),
  setCurrentUser: (user) => ipcRenderer.invoke("set-current-user", user),
   sendSparepartRequest: (data) => ipcRenderer.invoke("send-sparepart-request", data),
  //checkMaterial: (nomor_material) =>ipcRenderer.invoke("cek-nomor-material", nomor_material),
  checkMaterial: (payload) => ipcRenderer.invoke("checkMaterial", payload),
  importMasterKode: () => ipcRenderer.invoke("importMasterKode"),
  getMasterKode: () => ipcRenderer.invoke("getMasterKode"),
  saveMasterKode: (data) => ipcRenderer.invoke("saveMasterKode", data),
  deleteMasterKode: (kode) => ipcRenderer.invoke("deleteMasterKode", kode),
  clearMasterKode: () => ipcRenderer.invoke("clearMasterKode"),
  syncMasterKodeToSupabase: () =>ipcRenderer.invoke("syncMasterKodeToSupabase"),
  getCurrentWeek: () =>ipcRenderer.invoke("spareparts:get-current-week"),


  getLocalSparepartRequests: () =>ipcRenderer.invoke("getLocalSparepartRequests"),
  updateSparepartStatus: (id, status) =>ipcRenderer.invoke("updateSparepartStatus", id, status),
  updateSparepartProgress: (payload) =>ipcRenderer.invoke("updateSparepartProgress", payload),

  syncSparepartRequests: () =>ipcRenderer.invoke("syncSparepartRequests"),
  openExternal: (url) => shell.openExternal(url),


   mtbf: {
    load: () => ipcRenderer.invoke("mtbf:load"),
    add: (p) => ipcRenderer.invoke("mtbf:add", p),
    update: (id, p) => ipcRenderer.invoke("mtbf:update", id, p),
    delete: (id) => ipcRenderer.invoke("mtbf:delete", id),
    import: (list) => ipcRenderer.invoke("mtbf:import", list),
    export: () => ipcRenderer.invoke("mtbf:export")
  },
  history: {
    load: () => ipcRenderer.invoke("history:load")
  },

  // queue / cloud helpers
  loadLocalQueue: () => ipcRenderer.invoke("mtbf:load-local-queue"),
  loadCloudPending: () => ipcRenderer.invoke("mtbf:load-cloud-pending"),
  processCloudScan: (payload) => ipcRenderer.invoke("mtbf:process-cloud-scan", payload),
  debugLocalQueue: () => ipcRenderer.invoke("mtbf:debug-local-queue"),

  // event listeners from main
  onCloudScan: (cb) => ipcRenderer.on("mtbf:cloud-scan", (_, data) => cb(data)),
  onSyncStart: (cb) => ipcRenderer.on("mtbf:sync-start", cb),
  onSyncDone: (cb) => ipcRenderer.on("mtbf:sync-done", cb),

  // network notifications
  onOnline: (cb) => ipcRenderer.on("net:online", cb),
  onOffline: (cb) => ipcRenderer.on("net:offline", cb)
});

// ========== THEME BRIDGE (untuk dark/light/softblue) ==========
contextBridge.exposeInMainWorld("theme", {
  onChange: (callback) => ipcRenderer.on("apply-theme", (_, theme) => callback(theme)),
});

// ========== DASHBOARD STYLE BRIDGE (classic, compact, 3D, dll.) ==========
contextBridge.exposeInMainWorld("dashboard", {
  onChange: (callback) => ipcRenderer.on("apply-dashboard", (_, style) => callback(style)),
});

// ========== DIALOG BRIDGE ==========
contextBridge.exposeInMainWorld("dialogApi", {
  promptLocation: () => ipcRenderer.invoke("show-prompt-location"),
});

// ========== CHART BRIDGE ==========
contextBridge.exposeInMainWorld("chartApi", {
  getChartData: (params) => ipcRenderer.invoke("get-chart-data", params),
});

contextBridge.exposeInMainWorld('karyawanAPI', {
  addPerformance: (nik, nama, params) => ipcRenderer.invoke("add-karyawan-performance", nik, nama, params),
 uploadFotoKaryawan: (id) => ipcRenderer.invoke("upload-foto-karyawan", id),
 saveFotoBuffer: (id, buffer) => ipcRenderer.invoke("save-foto-buffer", id, buffer),
  updateKaryawanParams: (id, params) => ipcRenderer.invoke("update-karyawan-params", id, params),
  getKaryawanFoto: (id) => ipcRenderer.invoke("get-karyawan-foto", id),
  getKaryawanByNik: (nik) => ipcRenderer.invoke("get-karyawan-by-nik", nik),
  getPerformanceHistory: (nik) => ipcRenderer.invoke("get-performance-history", nik),
   hapusKaryawan: (id) => ipcRenderer.invoke("hapus-karyawan", id),
    checkNik: (nik) => ipcRenderer.invoke("check-nik", nik),
   savePerpanjangan: (data) => ipcRenderer.invoke("save-perpanjangan", data),
   getLatestPerpanjangan: (nik) => ipcRenderer.invoke("get-latest-perpanjangan", nik)

});

// ========== RMC BRIDGE ==========
contextBridge.exposeInMainWorld("electronAPI", {
  exportRMC: (params) => ipcRenderer.invoke("export-rmc", params),
  showChart: (type) => ipcRenderer.invoke("show-chart", type),
  saveChartJPEG: (dataURL, title, category) => ipcRenderer.invoke("save-chart-jpeg", dataURL, title, category),
  onLoadChart: (callback) => ipcRenderer.on("load-chart", (_, type) => callback(type)),
  onExportResult: (callback) => ipcRenderer.on("export-result", (_, result) => callback(result)),
  getRMC: () => ipcRenderer.invoke("get-rmc"),
  getRMCSummary: () => ipcRenderer.invoke("get-rmc-summary"),
  addRMC: (rmcData) => ipcRenderer.invoke("add-rmc", rmcData),
  saveRMC: (year, nominal) => ipcRenderer.invoke("save-rmc", year, nominal),
  getPurchaseItems: () => ipcRenderer.invoke("get-purchase-items"),
  updatePRPO: (data) => ipcRenderer.invoke("update-prpo", data),
  getHistoryRMC: () => ipcRenderer.invoke("get-history-rmc"),
  onApplyDashboard: (callback) => ipcRenderer.on("apply-dashboard", (event, style) => callback(style)),
  onRequestDashboardStyle: (callback) => ipcRenderer.on("request-dashboard-style", callback),
  onNavigateScreen: (callback) => ipcRenderer.on("navigate-screen", callback),
  onThemeChange: (callback) => ipcRenderer.on("apply-theme", (_, theme) => callback(theme)),
  onToast: (callback) => ipcRenderer.on("show-toast", (event, data) => callback(data)),
   exportSummaryCSV: (data) => ipcRenderer.invoke("export-summary-csv", data),
  exportSummaryPDF: (data) => ipcRenderer.invoke("export-summary-pdf", data),
  saveKaryawan: (data) => ipcRenderer.invoke("save-karyawan", data),
  toBuffer: (arrayBuffer) => Buffer.from(arrayBuffer),
  getKaryawan: () => ipcRenderer.invoke("get-karyawan"),
  //getKaryawanFoto: (id) => ipcRenderer.invoke("get-karyawan-foto", id),
  //uploadFotoKaryawan: () => ipcRenderer.invoke("upload-foto-karyawan"),
  assetPath: (file) => path.join(process.cwd(), "assets", file),
  getMaskotPath: () => ipcRenderer.invoke('get-maskot-path'),
  cekNik: (nik) => ipcRenderer.invoke("cek-nik", nik),
  cekKontrakExpire: () => ipcRenderer.invoke("cek-kontrak-expire"),
  onKontrakExpire: (callback) =>
    ipcRenderer.on("kontrak-expire-notif", (event, data) => callback(data)),
     getLatestKontrakKe: (nik) => ipcRenderer.invoke("get-latest-kontrak-ke", nik),
        requestNavigate: (screen) => ipcRenderer.send("request-navigate", screen),
  onBlockedVisitor: (callback) => {
  ipcRenderer.on("blocked-visitor", callback);

},
});



contextBridge.exposeInMainWorld("purchaseAPI", {
  onShowModal: (callback) => ipcRenderer.on("show-import-modal", (_, data) => callback(data)),
  showLoader: (callback) => ipcRenderer.on("show-loader", (_, show) => callback(show)),
  importData: (filePath) => ipcRenderer.invoke("import-purchase-data", filePath)
});

contextBridge.exposeInMainWorld("departmentAPI", {
  add: (data) => ipcRenderer.invoke("departments-add", data),
  getAll: () => ipcRenderer.invoke("departments-get-all"),
});


contextBridge.exposeInMainWorld("rmcEvents", {
  onRefresh: (callback) => ipcRenderer.on("rmc-should-refresh", callback)
});

// ========== GENERIC IPC (opsional untuk debugging) ==========
contextBridge.exposeInMainWorld("ipcRenderer", {
  on: (channel, listener) => ipcRenderer.on(channel, listener),
  send: (channel, data) => ipcRenderer.send(channel, data),
    invoke: (channel, args) => ipcRenderer.invoke(channel, args)
});

contextBridge.exposeInMainWorld("netAPI", {
  onOnline: (cb) => ipcRenderer.on("net:online", cb),
  onOffline: (cb) => ipcRenderer.on("net:offline", cb),
  onSyncStart: (cb) => ipcRenderer.on("cloud:sync-start", cb),
  onSyncDone: (cb) => ipcRenderer.on("cloud:sync-done", cb),


});


contextBridge.exposeInMainWorld("inventoryAPI", {
  openFileDialog: () => ipcRenderer.invoke("inventory:openFileDialog"),
  readExcel: (filePath) => ipcRenderer.invoke("inventory:readExcel", filePath),
  loadInventory: () => ipcRenderer.invoke("inventory:load"),
  saveToDB: (data) => ipcRenderer.invoke("inventory:saveToDB", data),
  exportAll: (rows) => ipcRenderer.invoke("inventory:exportAll", rows),
  exportOne: (row) => ipcRenderer.invoke("inventory:exportOne", row),
  onExportProgress: (cb) =>ipcRenderer.on("export-progress", (_, data) => cb(data)),
  getSupabaseStatus: () => ipcRenderer.invoke("supabase-status"),
 twoWaySync: () => ipcRenderer.invoke("two-way-sync"),
  checkSupabase: () => ipcRenderer.invoke("supabase-status"),
  exportLogPdf: (payload) =>ipcRenderer.invoke("export-log-pdf", payload),
  getPdfFilename: () =>ipcRenderer.invoke("get-pdf-filename"),
  aiSummary: (payload) =>ipcRenderer.invoke("ai-summary", payload),
  exportPDF: (payload) =>ipcRenderer.send("inventory-export-pdf", payload),
  printData: () =>ipcRenderer.send("inventory-print"),
  getPdfMeta: () =>ipcRenderer.invoke("inventory-get-pdf-meta"),
  exportPDF_READY: (payload) =>ipcRenderer.invoke("inventory-export-pdf-ready", payload),
  reloadApp: () => ipcRenderer.send('inventory-reload-app'),
  printNative: () => ipcRenderer.invoke("inventory-print-native"),
  incrementalSync: () => {
  console.log("📤 PRELOAD: invoke incremental-sync");
  return ipcRenderer.invoke("incremental-sync");
},

  saveInventoryManual: (data) =>ipcRenderer.send("save-inventory-manual", data),
  onSaveResult: (callback) =>ipcRenderer.on("save-inventory-result", (_, result) => callback(result)),
  deleteInventory: (kode) =>ipcRenderer.invoke("delete-inventory", kode),
  onSyncProgress: (callback) => ipcRenderer.on("sync-progress", (e, percent) => callback(percent)),
  receive: (channel, callback) =>ipcRenderer.on(channel, (event, data) => callback(data)),
  getInventoryMaster: () =>ipcRenderer.invoke("get-inventory-master"),
  getInventoryLogs: (limit = 100) =>ipcRenderer.invoke("get-inventory-logs", limit),
   exportInventoryLogsPage: (rows) =>ipcRenderer.invoke("export-inventory-logs-page", rows),
  onSetData: (callback) => ipcRenderer.on("inventory:setData", (event, data) => callback(data))

});



contextBridge.exposeInMainWorld("overtime", {
  saveConfig: (data) => ipcRenderer.invoke("save-config-lembur", data),
  getConfig: (nik) => ipcRenderer.invoke("get-config-lembur", nik),
  insert: (data) => ipcRenderer.invoke("insert-overtime", data),
  getAll: () => ipcRenderer.invoke("get-karyawan"),
  getTotal: (payload) =>ipcRenderer.invoke("report-weekly-total", payload),
  getByDay: (payload) =>ipcRenderer.invoke("report-weekly-by-day", payload),
  getDetail: (payload) =>ipcRenderer.invoke("report-weekly-detail", payload),
  getFiltered: (payload) =>ipcRenderer.invoke("report-weekly-filtered", payload),
  getWeekConfig: () => ipcRenderer.invoke("week:getConfig"),
  saveWeekConfig: (data) => ipcRenderer.invoke("week:saveConfig", data),
  getCompanyWeekRule: (year) =>ipcRenderer.invoke("get-company-week-rule", year),
  saveCompanyWeekRule: (payload) =>ipcRenderer.invoke("save-company-week-rule", payload),
getByNameDate: (p) =>
  ipcRenderer.invoke("overtime-get-name-date", p),

updateByNameDate: (p) =>
  ipcRenderer.invoke("overtime-update-name-date", p),

deleteByNameDate: (p) =>ipcRenderer.invoke("overtime-delete-name-date", p),
// insert: (payload) => ipcRenderer.invoke("insert-overtime", payload)
getWeeklySummary: (data) =>
    ipcRenderer.invoke("overtime:getWeeklySummary", data)
});


contextBridge.exposeInMainWorld("sales", {
  saveMonthly: (payload) => ipcRenderer.invoke("save-sales-monthly", payload),
  getAll: () => ipcRenderer.invoke("get-sales-all"),
  deleteSale: (key) => ipcRenderer.invoke("delete-sales", key),
  getByWeek: (week) => ipcRenderer.invoke("sales:get-by-week", week),
  getWeeklyBudget: (params) =>
    ipcRenderer.invoke("sales:getWeeklyBudget", params)
});


contextBridge.exposeInMainWorld("syncAPI", {
  onSyncStatus: (callback) => {
    ipcRenderer.on("sync-status", (_, data) => callback(data));
  }
});

contextBridge.exposeInMainWorld("updater", {
  onStatus: (cb) => ipcRenderer.on("update-status", (_, ...args) => cb(...args)),
  download: () => ipcRenderer.send("update-download"),
  install: () => ipcRenderer.send("update-install")
});
