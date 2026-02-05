window.charts = {}; // simpan instance Chart.js agar tidak duplikat

async function loadCharts(mode = "week", offset = 0) {
  try {
    const data = await window.chartApi.getChartData({ mode, offset });

    // helper untuk render chart dinamis
    function renderChart(ctxId, typeId, dataConfig) {
      const typeEl = document.getElementById(typeId);
      const type = typeEl ? typeEl.value : "bar"; // default 'bar' bila belum dipilih
      const ctx = document.getElementById(ctxId)?.getContext("2d");
      if (!ctx) return; // cegah error bila canvas belum ada

      // kalau chart sudah ada → update saja
      if (window.charts[ctxId]) {
        const chart = window.charts[ctxId];
        chart.config.type = type;
        chart.data = dataConfig;
        chart.update();
        return;
      }

      // jika belum ada → buat baru
      window.charts[ctxId] = new Chart(ctx, {
        type,
        data: dataConfig,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "bottom" },
            title: { display: false }
          }
        }
      });
    }

    // === Chart 1: Vendor ===
    renderChart("chartVendor", "vendorChartType", {
      labels: data.vendorData.map(d => d.vendor),
      datasets: [{
        label: "Total Pembelian",
        data: data.vendorData.map(d => d.total),
        backgroundColor: ["#36a2eb", "#ff6384", "#ffcd56", "#4bc0c0", "#9966ff"]
      }]
    });

    // === Chart 2: Item ===
    renderChart("chartItem", "itemChartType", {
      labels: data.itemData.map(d => d.nama_sparepart),
      datasets: [{
        label: "Jumlah Item",
        data: data.itemData.map(d => d.jumlah),
        backgroundColor: ["#ffcd56", "#4bc0c0", "#36a2eb", "#ff9f40"]
      }]
    });

    // === Chart 3: Function Location ===
    renderChart("chartFunction", "flChartType", {
      labels: data.flData.map(d => d.function_location),
      datasets: [{
        label: "Distribusi Lokasi",
        data: data.flData.map(d => d.total),
        backgroundColor: ["#ff6384", "#36a2eb", "#ffcd56", "#4bc0c0"]
      }]
    });

    // === Chart 4: Total Harga ===
    renderChart("chartHarga", "hargaChartType", {
      labels: data.hargaData.map(d => d.label),
      datasets: [{
        label: "Total Harga",
        data: data.hargaData.map(d => d.total),
        backgroundColor: "#36a2eb"
      }]
    });

  } catch (err) {
    console.error("❌ CHART LOAD ERROR:", err);
  }
}

// 🎯 Jalankan setelah halaman siap
document.addEventListener("DOMContentLoaded", () => {
  // Set semua select chart type ke default 'bar'
  document.querySelectorAll(".chart-select").forEach(sel => {
    sel.value = "bar";
    sel.addEventListener("change", () => loadCharts("week", 0));
  });

  // Tampilkan chart minggu ini secara default
  loadCharts("week", 0);
});

// Ekspos ke window agar bisa dipanggil dari renderer.js
window.loadCharts = loadCharts;
