// DOM Elements
const elements = {
  storeFilter: document.getElementById("storeFilter"),
  searchBox: document.getElementById("searchBox"),
  productTableBody: document.getElementById("productTableBody"),
  deleteModal: document.getElementById("deleteModal"),
  confirmDeleteBtn: document.getElementById("confirmDeleteBtn"),
  cancelDeleteBtn: document.getElementById("cancelDeleteBtn"),
  deleteModalMessage: document.getElementById("deleteModalMessage"),
  logoutBtn: document.getElementById("logoutBtn"),
  formMessage: document.getElementById("formMessage"),

  // Form fields
  productId: document.getElementById("productId"),
  skuField: document.getElementById("skuField"),
  categoryField: document.getElementById("categoryField"),
  nameField: document.getElementById("nameField"),
  storeField: document.getElementById("storeField"),
  stockField: document.getElementById("stockField"),
  minStockField: document.getElementById("minStockField"),
  purchasePriceField: document.getElementById("purchasePriceField"),
  salePriceField: document.getElementById("salePriceField"),
  supplierField: document.getElementById("supplierField"),
  updatedAtField: document.getElementById("updatedAtField"),

  // Buttons
  btnUpdateProduct: document.getElementById("btnUpdateProduct"),
  btnClearForm: document.getElementById("btnClearForm"),

  // Summary cards
  totalProducts: document.getElementById("totalProducts"),
  availableStock: document.getElementById("availableStock"),
  lowStock: document.getElementById("lowStock"),
  outOfStock: document.getElementById("outOfStock"),
  tableCount: document.getElementById("tableCount"),
};

// User role from template
const userRole = "{{ role }}".toUpperCase() || "ADMIN";
let deleteProductId = null;
let allProducts = [];

// Show notification
function showNotification(message, type = "success") {
  const colors = {
    success: "bg-green-50 text-green-800 border-green-200",
    error: "bg-red-50 text-red-800 border-red-200",
    info: "bg-blue-50 text-blue-800 border-blue-200",
    warning: "bg-yellow-50 text-yellow-800 border-yellow-200",
  };

  elements.formMessage.className = colors[type] + " p-3 rounded-lg mb-4";
  elements.formMessage.innerHTML = `<div class="flex items-center"><i class="fas fa-${
    type === "success"
      ? "check-circle"
      : type === "error"
      ? "exclamation-circle"
      : "info-circle"
  } mr-2"></i>${message}</div>`;
  elements.formMessage.classList.remove("hidden");

  setTimeout(() => {
    elements.formMessage.classList.add("hidden");
  }, 5000);
}

// Format Rupiah
function formatRupiah(value) {
  if (!value && value !== 0) return "Rp 0";
  const num = parseFloat(value);
  return isNaN(num) ? "Rp 0" : "Rp " + num.toLocaleString("id-ID");
}

// Get status badge
function getStatusBadge(stock, minStock) {
  if (stock === 0) {
    return '<span class="status-badge status-habis">HABIS</span>';
  } else if (stock <= minStock + 5) {
    return '<span class="status-badge status-menipis">MENIPIS</span>';
  } else {
    return '<span class="status-badge status-tersedia">TERSEDIA</span>';
  }
}

// Get row class based on stock
function getRowClass(stock, minStock) {
  if (stock === 0) {
    return "stock-danger";
  } else if (stock <= minStock + 5) {
    return "stock-warning";
  }
  return "";
}

// Update summary statistics
function updateSummaryStats(products) {
  const total = products.length;
  const available = products.filter(
    (p) => p.stock > (p.min_stock || 0) + 5
  ).length;
  const low = products.filter(
    (p) => p.stock > 0 && p.stock <= (p.min_stock || 0) + 5
  ).length;
  const out = products.filter((p) => p.stock === 0).length;

  elements.totalProducts.textContent = total;
  elements.availableStock.textContent = available;
  elements.lowStock.textContent = low;
  elements.outOfStock.textContent = out;
  elements.tableCount.textContent = total;
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
  } catch (error) {
    showNotification("Gagal memuat daftar toko.", "error");
  }
}

// Load products
async function loadProducts(selectedStore = "all") {
  try {
    elements.productTableBody.innerHTML = `
                    <tr>
                        <td colspan="12" class="px-6 py-8 text-center text-gray-500">
                            <i class="fas fa-spinner fa-spin text-blue-500 text-lg mb-2"></i>
                            <p>Memuat data produk...</p>
                        </td>
                    </tr>
                `;

    const response = await fetch("/api/products");
    const result = await response.json();

    if (result.status) {
      let data = result.data || [];

      // Store all products for filtering
      allProducts = data;

      // Filter by store if selected
      if (selectedStore && selectedStore !== "all") {
        data = data.filter(
          (item) =>
            item.store_id === selectedStore ||
            (item.store_name &&
              item.store_name
                .toLowerCase()
                .includes(selectedStore.toLowerCase()))
        );
      }

      if (data.length === 0) {
        elements.productTableBody.innerHTML = `
                            <tr>
                                <td colspan="12" class="px-6 py-8 text-center text-gray-500">
                                    <i class="fas fa-box-open text-gray-400 text-lg mb-2"></i>
                                    <p>Tidak ada data produk</p>
                                </td>
                            </tr>
                        `;
        updateSummaryStats([]);
        return;
      }

      // Update summary statistics
      updateSummaryStats(data);

      // Build table rows
      let tableHTML = "";
      data.forEach((item) => {
        const stock = Number(item.stock ?? 0);
        const minStock = Number(item.min_stock ?? 0);
        const rowClass = getRowClass(stock, minStock);
        const canEdit = userRole !== "STAFF";

        tableHTML += `
                            <tr class="datatable-row hover:bg-gray-50 ${rowClass}">
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                                    ${item._id || "-"}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    ${(item.name || "").toUpperCase()}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <span class="badge-category">${
                                      item.category || "Lainnya"
                                    }</span>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    ${stock.toLocaleString("id-ID")}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    ${minStock.toLocaleString("id-ID")}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    ${formatRupiah(item.purchase_price)}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    ${formatRupiah(item.sale_price)}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    ${getStatusBadge(stock, minStock)}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    ${item.store_name || "-"}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    ${
                                      item.supplier
                                        ? item.supplier.toUpperCase()
                                        : "-"
                                    }
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    ${
                                      item.updated_at
                                        ? new Date(
                                            item.updated_at
                                          ).toLocaleDateString("id-ID")
                                        : "-"
                                    }
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <div class="flex space-x-2">
                                        ${
                                          canEdit
                                            ? `
                                        <button onclick="editProduct('${item._id}')" class="action-btn px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-xs">
                                            <i class="fas fa-edit mr-1"></i>Edit
                                        </button>
                                        <button onclick="confirmDelete('${item._id}', '${item.name}')" class="action-btn px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs">
                                            <i class="fas fa-trash mr-1"></i>Hapus
                                        </button>
                                        `
                                            : `<span class="text-gray-400 text-xs">Tidak Ada Aksi</span>`
                                        }
                                        ${
                                          canEdit &&
                                          (stock === 0 || stock <= minStock + 5)
                                            ? `
                                        <button onclick="goToRestock('${item._id}')" class="action-btn px-3 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded text-xs">
                                            <i class="fas fa-plus mr-1"></i>Restock
                                        </button>
                                        `
                                            : ""
                                        }
                                    </div>
                                </td>
                            </tr>
                        `;
      });

      elements.productTableBody.innerHTML = tableHTML;
    } else {
      showNotification(result.message || "Gagal memuat data produk.", "error");
    }
  } catch (error) {
    showNotification("Gagal memuat data produk.", "error");
  }
}

// Edit product
async function editProduct(id) {
  if (userRole === "STAFF") {
    showNotification(
      "Staff tidak memiliki akses untuk mengedit data.",
      "error"
    );
    return;
  }

  try {
    const response = await fetch(`/api/products/${id}`);
    const result = await response.json();

    if (result.status) {
      const item = result.data;

      // Populate form fields
      elements.productId.value = item._id;
      elements.skuField.value = item._id || "";
      elements.categoryField.value = item.category || "";
      elements.nameField.value = item.name || "";
      elements.storeField.value = item.store_name || "";
      elements.stockField.value = (item.stock || 0).toLocaleString("id-ID");
      elements.minStockField.value = item.min_stock || 0;
      elements.purchasePriceField.value = formatRupiah(item.purchase_price);
      elements.salePriceField.value = formatRupiah(item.sale_price);
      elements.supplierField.value = item.supplier || "";
      elements.updatedAtField.value = item.updated_at
        ? new Date(item.updated_at).toLocaleDateString("id-ID")
        : "-";

      // Scroll to form
      document.querySelector("#btnUpdateProduct").scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });

      showNotification("Data produk siap untuk diedit.", "info");
    } else {
      showNotification(result.message || "Gagal memuat data produk.", "error");
    }
  } catch (error) {
    showNotification("Gagal memuat data untuk diedit.", "error");
  }
}

// Update product
async function updateProduct() {
  // Validate form
  if (!validateForm()) return;

  const formData = {
    category: elements.categoryField.value,
    min_stock: parseInt(elements.minStockField.value),
    sale_price: elements.salePriceField.value.replace(/[^0-9]/g, ""),
  };

  const productId = elements.productId.value;
  if (!productId) {
    showNotification("Pilih produk terlebih dahulu.", "error");
    return;
  }

  try {
    const response = await fetch(`/api/products/${productId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    const result = await response.json();

    if (result.status) {
      showNotification("Produk berhasil diperbarui.", "success");

      // Clear form
      clearForm();

      // Reload products
      const selectedStore = elements.storeFilter.value;
      await loadProducts(selectedStore);

      // Update the specific row in table
      const tableRows = elements.productTableBody.querySelectorAll("tr");
      tableRows.forEach((row) => {
        const skuCell = row.querySelector("td:first-child");
        if (skuCell && skuCell.textContent.trim() === productId) {
          // Update category cell
          const categoryCell = row.querySelector("td:nth-child(3)");
          if (categoryCell) {
            categoryCell.innerHTML = `<span class="badge-category">${formData.category}</span>`;
          }

          // Update min stock cell
          const minStockCell = row.querySelector("td:nth-child(5)");
          if (minStockCell) {
            minStockCell.textContent =
              formData.min_stock.toLocaleString("id-ID");
          }

          // Update sale price cell
          const salePriceCell = row.querySelector("td:nth-child(7)");
          if (salePriceCell) {
            salePriceCell.textContent = formatRupiah(formData.sale_price);
          }

          // Update status badge (recalculate)
          const stockCell = row.querySelector("td:nth-child(4)");
          const stock = parseInt(
            stockCell?.textContent.replace(/\./g, "") || 0
          );
          const minStock = formData.min_stock;
          const statusCell = row.querySelector("td:nth-child(8)");
          if (statusCell) {
            statusCell.innerHTML = getStatusBadge(stock, minStock);
          }

          // Update row class
          row.className = row.className
            .replace(/stock-warning|stock-danger/g, "")
            .trim();
          const newRowClass = getRowClass(stock, minStock);
          if (newRowClass) {
            row.classList.add(newRowClass);
          }
        }
      });
    } else {
      showNotification(result.message || "Gagal update produk.", "error");
    }
  } catch (error) {
    showNotification("Gagal terhubung ke server.", "error");
  }
}

// Delete product
async function deleteProduct(id) {
  try {
    const response = await fetch(`/api/products/${id}`, {
      method: "DELETE",
    });

    const result = await response.json();

    if (result.status) {
      showNotification("Produk berhasil dihapus.", "success");

      // Remove from allProducts array
      allProducts = allProducts.filter((p) => p._id !== id);

      // Reload products
      const selectedStore = elements.storeFilter.value;
      await loadProducts(selectedStore);
    } else {
      showNotification(
        result.message || result.error || "Gagal menghapus produk.",
        "error"
      );
    }
  } catch (error) {
    showNotification("Gagal menghapus produk.", "error");
  }
}

// Go to restock page
function goToRestock(productId) {
  if (userRole === "STAFF") {
    showNotification("Staff tidak memiliki akses untuk restock.", "error");
    return;
  }
  showNotification("Mengarahkan ke halaman restock...", "info");
  setTimeout(() => {
    window.location.href = "/inventory";
  }, 1000);
}

// Confirm delete
function confirmDelete(id, productName) {
  if (userRole === "STAFF") {
    showNotification(
      "Staff tidak memiliki akses untuk menghapus data.",
      "error"
    );
    return;
  }

  deleteProductId = id;
  elements.deleteModalMessage.textContent = `Apakah Anda yakin ingin menghapus produk "${productName}"?`;
  elements.deleteModal.classList.remove("hidden");
}

// Validate form
function validateForm() {
  let isValid = true;

  // Clear previous errors
  document.querySelectorAll('[id$="Error"]').forEach((el) => {
    el.classList.add("hidden");
  });

  // Validate category
  if (!elements.categoryField.value) {
    document.getElementById("categoryError").classList.remove("hidden");
    isValid = false;
  }

  // Validate min stock
  const minStock = parseInt(elements.minStockField.value);
  if (isNaN(minStock) || minStock < 0) {
    document.getElementById("minStockError").classList.remove("hidden");
    isValid = false;
  }

  // Validate sale price
  const salePrice = elements.salePriceField.value.replace(/[^0-9]/g, "");
  if (!salePrice || isNaN(parseFloat(salePrice)) || parseFloat(salePrice) < 0) {
    document.getElementById("salePriceError").classList.remove("hidden");
    isValid = false;
  }

  return isValid;
}

// Clear form
function clearForm() {
  // Clear form values
  elements.productId.value = "";
  elements.skuField.value = "";
  elements.categoryField.value = "";
  elements.nameField.value = "";
  elements.storeField.value = "";
  elements.stockField.value = "";
  elements.minStockField.value = "";
  elements.purchasePriceField.value = "";
  elements.salePriceField.value = "";
  elements.supplierField.value = "";
  elements.updatedAtField.value = "";

  // Clear errors
  document.querySelectorAll('[id$="Error"]').forEach((el) => {
    el.classList.add("hidden");
  });

  // Clear notification
  elements.formMessage.classList.add("hidden");
}

// Initialize
document.addEventListener("DOMContentLoaded", function () {
  // Load initial data
  loadStoreOptions();
  loadProducts();

  // Setup store filter
  elements.storeFilter.addEventListener("change", function () {
    loadProducts(this.value);
  });

  // Setup search
  elements.searchBox.addEventListener("input", function () {
    const searchTerm = this.value.toLowerCase().trim();
    const rows = elements.productTableBody.querySelectorAll("tr");
    let visibleCount = 0;

    rows.forEach((row) => {
      if (row.querySelector("td")) {
        // Skip loading row
        const text = row.textContent.toLowerCase();
        if (searchTerm === "" || text.includes(searchTerm)) {
          row.style.display = "";
          visibleCount++;
        } else {
          row.style.display = "none";
        }
      }
    });

    elements.tableCount.textContent = visibleCount;
  });

  // Setup form button
  elements.btnUpdateProduct.addEventListener("click", updateProduct);
  elements.btnClearForm.addEventListener("click", clearForm);

  // Setup delete modal
  elements.confirmDeleteBtn.addEventListener("click", function () {
    if (deleteProductId) {
      deleteProduct(deleteProductId);
      elements.deleteModal.classList.add("hidden");
      deleteProductId = null;
    }
  });

  elements.cancelDeleteBtn.addEventListener("click", function () {
    elements.deleteModal.classList.add("hidden");
    deleteProductId = null;
  });

  // Close delete modal on background click
  elements.deleteModal.addEventListener("click", function (e) {
    if (e.target === this) {
      this.classList.add("hidden");
      deleteProductId = null;
    }
  });

  // Setup logout
  elements.logoutBtn.addEventListener("click", function () {
    if (confirm("Yakin ingin keluar dari sistem?")) {
      window.location.href = "/logout";
    }
  });

  // Format price input
  elements.salePriceField.addEventListener("input", function () {
    let value = this.value.replace(/[^0-9]/g, "");
    if (value) {
      this.value = formatRupiah(value);
    }
  });

  // Staff mode setup
  if (userRole === "STAFF") {
    // Disable form elements
    elements.categoryField.disabled = true;
    elements.minStockField.disabled = true;
    elements.salePriceField.disabled = true;
    elements.btnUpdateProduct.disabled = true;
    elements.btnClearForm.disabled = true;

    showNotification("Mode Staff: hanya dapat melihat data produk.", "info");
  }
});
