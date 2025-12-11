// DOM Elements
const elements = {
  storeFilter: document.getElementById("storeFilter"),
  logoutBtn: document.getElementById("logoutBtn"),
  stockAlertModal: document.getElementById("stockAlertModal"),
  closeStockModal: document.getElementById("closeStockModal"),
  closeStockModalBtn: document.getElementById("closeStockModalBtn"),
  stockAlertBody: document.getElementById("stockAlertBody"),

  // Cards
  totalProducts: document.getElementById("totalProducts"),
  totalStock: document.getElementById("totalStock"),
  totalSupplier: document.getElementById("totalSupplier"),
  totalSales: document.getElementById("totalSales"),
  distribusiRevenue: document.getElementById("distribusiRevenue"),
  salesRevenue: document.getElementById("salesRevenue"),
  purchaseValue: document.getElementById("purchaseValue"),
  supplierPurchaseValue: document.getElementById("supplierPurchaseValue"),
  saleValue: document.getElementById("saleValue"),
  stockAvailable: document.getElementById("stockAvailable"),
  stockLow: document.getElementById("stockLow"),
  stockOut: document.getElementById("stockOut"),
  availableStockPercent: document.getElementById("availableStockPercent"),
  stockProgress: document.getElementById("stockProgress"),
  storeLabel: document.getElementById("storeLabel"),
  salesGrowth: document.getElementById("salesGrowth"),

  // Tables
  recentSalesBody: document.getElementById("recentSalesBody"),
  supplierTableBody: document.getElementById("supplierTableBody"),

  // Chart
  categoryChart: document.getElementById("categoryChart"),
};

let categoryChartInstance = null;

// Format Rupiah
function formatRupiah(value) {
  if (!value && value !== 0) return "Rp 0";
  const num = parseFloat(value);
  return isNaN(num) ? "Rp 0" : "Rp " + num.toLocaleString("id-ID");
}

// Format number with dots
function formatNumber(value) {
  if (!value && value !== 0) return "0";
  const num = parseFloat(value);
  return isNaN(num) ? "0" : num.toLocaleString("id-ID");
}

// Show notification
function showNotification(message, type = "success") {
  // Create notification element
  const notification = document.createElement("div");
  const colors = {
    success: "bg-green-50 text-green-800 border-green-200",
    error: "bg-red-50 text-red-800 border-red-200",
    info: "bg-blue-50 text-blue-800 border-blue-200",
    warning: "bg-yellow-50 text-yellow-800 border-yellow-200",
  };

  notification.className =
    colors[type] +
    " p-4 rounded-lg shadow-md fixed top-4 right-4 z-50 max-w-sm";
  notification.innerHTML = `
                <div class="flex items-center">
                    <i class="fas fa-${
                      type === "success"
                        ? "check-circle"
                        : type === "error"
                        ? "exclamation-circle"
                        : "info-circle"
                    } mr-3"></i>
                    <span>${message}</span>
                </div>
            `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 5000);
}

// Load store options
async function loadStoreOptions() {
  try {
    const response = await fetch("/api/stores");
    const result = await response.json();
    const stores = Array.isArray(result) ? result : result.data || [];

    elements.storeFilter.innerHTML = '<option value="all">Semua Toko</option>';
    stores.forEach((store) => {
      const label = store.name + (store.city ? ` (${store.city})` : "");
      elements.storeFilter.innerHTML += `<option value="${store.store_id}">${label}</option>`;
    });

    loadDashboardAll("all");
  } catch (error) {
    showNotification("Gagal memuat daftar toko.", "error");
  }
}

// Load dashboard data
async function loadDashboardAll(storeId = "all") {
  try {
    // Update store label
    const selectedOption =
      elements.storeFilter.options[elements.storeFilter.selectedIndex];
    elements.storeLabel.textContent = selectedOption.text;

    // Load summary data
    const summaryResponse = await fetch(
      `/api/analytics/summary?store_id=${storeId}`
    );
    const summaryData = await summaryResponse.json();

    // Update cards
    elements.totalProducts.textContent = formatNumber(
      summaryData.total_products || 0
    );
    elements.totalStock.textContent = formatNumber(
      summaryData.total_stock || 0
    );
    elements.totalSupplier.textContent = formatNumber(
      summaryData.total_supplier || 0
    );
    elements.totalSales.textContent = formatNumber(
      summaryData.total_sales || 0
    );
    elements.distribusiRevenue.textContent = formatRupiah(
      summaryData.total_distribusi_value || 0
    );
    elements.salesRevenue.textContent = formatRupiah(
      summaryData.total_revenue || 0
    );
    elements.purchaseValue.textContent = formatRupiah(
      summaryData.total_purchase_value || 0
    );
    elements.supplierPurchaseValue.textContent = formatRupiah(
      summaryData.total_supplier_value || 0
    );
    elements.saleValue.textContent = formatRupiah(
      summaryData.total_sale_stock || 0
    );

    // Calculate and update stock progress
    const stockData = await loadStockCards(storeId);
    updateStockProgress(stockData);

    // Load other components
    await loadCategoryPie(storeId);
    await loadSupplierTable(storeId);
    await loadRecentSales(storeId);
  } catch (error) {
    showNotification("Gagal memuat data dashboard.", "error");
  }
}

// Load stock status
async function loadStockCards(storeId = "all") {
  try {
    const response = await fetch(
      `/api/analytics/stock_status?store_id=${storeId}`
    );
    const data = await response.json();

    elements.stockAvailable.textContent = formatNumber(data.tersedia || 0);
    elements.stockLow.textContent = formatNumber(data.menipis || 0);
    elements.stockOut.textContent = formatNumber(data.habis || 0);

    return data;
  } catch (error) {
    showNotification("Gagal memuat status stok.", "error");
    return { tersedia: 0, menipis: 0, habis: 0 };
  }
}

// Update stock progress bar
function updateStockProgress(stockData) {
  const total =
    (stockData.tersedia || 0) +
    (stockData.menipis || 0) +
    (stockData.habis || 0);
  if (total > 0) {
    const availablePercent = (
      ((stockData.tersedia || 0) / total) *
      100
    ).toFixed(1);
    elements.availableStockPercent.textContent = availablePercent + "%";
    elements.stockProgress.style.width = availablePercent + "%";
  } else {
    elements.availableStockPercent.textContent = "0%";
    elements.stockProgress.style.width = "0%";
  }
}

// Load supplier table
async function loadSupplierTable(storeId = "all") {
  try {
    const response = await fetch(
      `/api/analytics/supplier_summary?store_id=${storeId}`
    );
    const data = await response.json();

    let tableHTML = "";
    if (data.length === 0) {
      tableHTML = `
                        <tr>
                            <td colspan="5" class="px-4 py-8 text-center text-gray-500">
                                <i class="fas fa-box-open text-gray-400 mr-2"></i>
                                Tidak ada data supplier
                            </td>
                        </tr>
                    `;
    } else {
      data.forEach((item, index) => {
        tableHTML += `
                            <tr class="hover:bg-gray-50">
                                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">${
                                  index + 1
                                }</td>
                                <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                    ${(item.supplier_name || "").toUpperCase()}
                                </td>
                                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                    ${formatNumber(item.total_items || 0)}
                                </td>
                                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                    ${item.store_name || "-"}
                                </td>
                                <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-green-600">
                                    ${formatRupiah(item.total_value || 0)}
                                </td>
                            </tr>
                        `;
      });
    }

    elements.supplierTableBody.innerHTML = tableHTML;
  } catch (error) {
    showNotification("Gagal memuat data supplier.", "error");
  }
}

// Load recent sales
async function loadRecentSales(storeId = "all") {
  try {
    const response = await fetch(
      `/api/analytics/recent_sales?store_id=${storeId}`
    );
    const data = await response.json();

    let tableHTML = "";
    if (data.length === 0) {
      tableHTML = `
                        <tr>
                            <td colspan="6" class="px-4 py-8 text-center text-gray-500">
                                <i class="fas fa-shopping-cart text-gray-400 mr-2"></i>
                                Tidak ada data penjualan
                            </td>
                        </tr>
                    `;
    } else {
      data.forEach((item, index) => {
        tableHTML += `
                            <tr class="hover:bg-gray-50">
                                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">${
                                  index + 1
                                }</td>
                                <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                    ${(item.customer_name || "").toUpperCase()}
                                </td>
                                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                    ${(item.product_name || "").toUpperCase()}
                                </td>
                                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                    ${formatNumber(item.quantity || 0)}
                                </td>
                                <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-blue-600">
                                    ${formatRupiah(item.total_price || 0)}
                                </td>
                                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                    ${
                                      item.created_at
                                        ? new Date(
                                            item.created_at
                                          ).toLocaleDateString("id-ID")
                                        : "-"
                                    }
                                </td>
                            </tr>
                        `;
      });
    }

    elements.recentSalesBody.innerHTML = tableHTML;
  } catch (error) {
    showNotification("Gagal memuat data penjualan terbaru.", "error");
  }
}

// Load category pie chart
async function loadCategoryPie(storeId = "all") {
  try {
    const response = await fetch(
      `/api/analytics/category_pie?store_id=${storeId}`
    );
    const data = await response.json();

    // Destroy existing chart if it exists
    if (categoryChartInstance) {
      categoryChartInstance.destroy();
    }

    // Prepare data for chart
    const labels = data.map((item) => item._id || "Unknown");
    const values = data.map((item) => item.total_stock || 0);
    const backgroundColors = data.map(
      (item) =>
        item.color || `#${Math.floor(Math.random() * 16777215).toString(16)}`
    );

    // Create chart
    const ctx = elements.categoryChart.getContext("2d");
    categoryChartInstance = new Chart(ctx, {
      type: "pie",
      data: {
        labels: labels,
        datasets: [
          {
            data: values,
            backgroundColor: backgroundColors,
            borderWidth: 1,
            borderColor: "#fff",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "right",
            labels: {
              padding: 20,
              usePointStyle: true,
              pointStyle: "circle",
            },
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const label = context.label || "";
                const value = context.raw || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = Math.round((value / total) * 100);
                return `${label}: ${value} unit (${percentage}%)`;
              },
            },
          },
        },
      },
    });
  } catch (error) {
    showNotification("Gagal memuat data kategori.", "error");
  }
}

// Show stock alert
async function showStockAlert() {
  const storeId = elements.storeFilter.value;

  try {
    const response = await fetch(`/api/products/alert?store_id=${storeId}`);
    const data = await response.json();

    if (!data || data.length === 0) {
      elements.stockAlertBody.innerHTML = `
                        <tr>
                            <td colspan="6" class="px-4 py-8 text-center text-gray-500">
                                <i class="fas fa-check-circle text-green-500 mr-2"></i>
                                Tidak ada produk yang menipis atau habis
                            </td>
                        </tr>
                    `;
    } else {
      let tableHTML = "";
      data.forEach((item) => {
        const status = item.stock === 0 ? "HABIS" : "MENIPIS";
        const statusClass =
          item.stock === 0
            ? "bg-red-100 text-red-800"
            : "bg-yellow-100 text-yellow-800";

        tableHTML += `
                            <tr class="hover:bg-gray-50">
                                <td class="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-900">${
                                  item._id || "-"
                                }</td>
                                <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">${
                                  item.name || "-"
                                }</td>
                                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">${formatNumber(
                                  item.stock || 0
                                )}</td>
                                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">${formatNumber(
                                  item.min_stock || 0
                                )}</td>
                                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${
                                  item.store_name || "-"
                                }</td>
                                <td class="px-4 py-3 whitespace-nowrap">
                                    <span class="px-2 py-1 text-xs font-medium rounded-full ${statusClass}">
                                        ${status}
                                    </span>
                                </td>
                            </tr>
                        `;
      });
      elements.stockAlertBody.innerHTML = tableHTML;
    }

    elements.stockAlertModal.classList.remove("hidden");
  } catch (error) {
    showNotification("Gagal memuat alert stok.", "error");
  }
}

// Go to restock page
function goToRestock() {
  showNotification("Mengarahkan ke halaman restock...", "info");
  setTimeout(() => {
    window.location.href = "/inventory";
  }, 1000);
}

// Initialize
document.addEventListener("DOMContentLoaded", function () {
  // Load initial data
  loadStoreOptions();

  // Setup store filter
  elements.storeFilter.addEventListener("change", function () {
    loadDashboardAll(this.value);
  });

  // Setup stock alert modal
  elements.closeStockModal.addEventListener("click", function () {
    elements.stockAlertModal.classList.add("hidden");
  });

  elements.closeStockModalBtn.addEventListener("click", function () {
    elements.stockAlertModal.classList.add("hidden");
  });

  // Close modal on background click
  elements.stockAlertModal.addEventListener("click", function (e) {
    if (e.target === this) {
      this.classList.add("hidden");
    }
  });

  // Setup logout
  elements.logoutBtn.addEventListener("click", function () {
    if (confirm("Yakin ingin keluar dari sistem?")) {
      window.location.href = "/logout";
    }
  });

  // Auto-refresh dashboard every 5 minutes
  setInterval(() => {
    const storeId = elements.storeFilter.value;
    loadDashboardAll(storeId);
  }, 300000); // 5 minutes
});
