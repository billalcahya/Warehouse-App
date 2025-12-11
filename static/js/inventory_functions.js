// DOM Elements
const elements = {
  storeFilter: document.getElementById("storeFilter"),
  searchBox: document.getElementById("searchBox"),
  comboStore: document.getElementById("comboStore"),
  comboProduk: document.getElementById("comboProduk"),
  productInfo: document.getElementById("productInfo"),
  fieldNamaProduk: document.getElementById("fieldNamaProduk"),
  fieldHargaBeli: document.getElementById("fieldHargaBeli"),
  jumlah: document.getElementById("jumlah"),
  supplier: document.getElementById("supplier"),
  notes: document.getElementById("notes"),
  productId: document.getElementById("productId"),
  btnSaveProduct: document.getElementById("btnSaveProduct"),
  btnUpdateProduct: document.getElementById("btnUpdateProduct"),
  btnClearForm: document.getElementById("btnClearForm"),
  editModeIndicator: document.getElementById("editModeIndicator"),
  productTableBody: document.getElementById("productTableBody"),
  detailModal: document.getElementById("detailModal"),
  closeDetailModal: document.getElementById("closeDetailModal"),
  detailContent: document.getElementById("detailContent"),
  logoutBtn: document.getElementById("logoutBtn"),
  formMessage: document.getElementById("formMessage"),
};

// User role simulation (replace with actual role from backend)
const userRole = "{{ role }}".toUpperCase() || "ADMIN";

// Format Rupiah
function formatRupiah(value) {
  if (!value) return "Rp 0";
  const num = parseFloat(value);
  return "Rp " + num.toLocaleString("id-ID");
}

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

// Load store options
async function loadStoreOptions() {
  try {
    const response = await fetch("/api/stores");
    const result = await response.json();
    const stores = Array.isArray(result) ? result : result.data || [];

    // Clear existing options
    elements.storeFilter.innerHTML = '<option value="all">Semua Toko</option>';
    elements.comboStore.innerHTML =
      '<option value="">Pilih toko tujuan</option>';

    stores.forEach((store) => {
      const label = store.name + (store.city ? ` (${store.city})` : "");
      elements.storeFilter.innerHTML += `<option value="${store.store_id}">${label}</option>`;
      elements.comboStore.innerHTML += `<option value="${store.store_id}">${label}</option>`;
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
                        <td colspan="9" class="px-6 py-8 text-center text-gray-500">
                            <i class="fas fa-spinner fa-spin text-blue-500 text-lg mb-2"></i>
                            <p>Memuat data produk...</p>
                        </td>
                    </tr>
                `;

    const response = await fetch("/api/product_masuk");
    const result = await response.json();
    const data = Array.isArray(result) ? result : result.data || [];

    let filtered = data;
    if (selectedStore && selectedStore !== "all") {
      filtered = data.filter(
        (item) =>
          item.store_id === selectedStore ||
          (item.store_name &&
            item.store_name.toLowerCase().includes(selectedStore.toLowerCase()))
      );
    }

    if (filtered.length === 0) {
      elements.productTableBody.innerHTML = `
                        <tr>
                            <td colspan="9" class="px-6 py-8 text-center text-gray-500">
                                <i class="fas fa-box-open text-gray-400 text-lg mb-2"></i>
                                <p>Tidak ada data barang masuk</p>
                            </td>
                        </tr>
                    `;
      return;
    }

    let tableHTML = "";
    filtered.forEach((item) => {
      const canEdit = userRole !== "STAFF";
      tableHTML += `
                        <tr class="datatable-row hover:bg-gray-50">
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">${
                              item.product_sku || "-"
                            }</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${(
                              item.name || ""
                            ).toUpperCase()}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${
                              item.store_name || "-"
                            }</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${(
                              item.supplier || ""
                            ).toUpperCase()}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">${(
                              item.jumlah || 0
                            ).toLocaleString("id-ID")}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${formatRupiah(
                              item.purchase_price
                            )}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${
                              item.location || "-"
                            }</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${
                              item.tanggal
                                ? new Date(item.tanggal).toLocaleDateString(
                                    "id-ID"
                                  )
                                : "-"
                            }</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div class="flex space-x-2">
                                    <button onclick="showDetail('${
                                      item._id
                                    }')" class="action-btn px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-xs">
                                        <i class="fas fa-eye mr-1"></i>Show
                                    </button>
                                    ${
                                      canEdit
                                        ? `
                                    <button onclick="editProduct('${item._id}')" class="action-btn px-3 py-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded text-xs">
                                        <i class="fas fa-edit mr-1"></i>Edit
                                    </button>
                                    <button onclick="confirmDelete('${item._id}')" class="action-btn px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs">
                                        <i class="fas fa-trash mr-1"></i>Hapus
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
  } catch (error) {
    showNotification("Gagal memuat data produk.", "error");
  }
}

// Load product options
async function loadProductOptions(selectedStore = "all") {
  try {
    const response = await fetch("/api/products/dropdown");
    const result = await response.json();
    const data = Array.isArray(result) ? result : result.data || [];

    let filtered = data;
    if (selectedStore !== "all") {
      filtered = data.filter(
        (p) =>
          p.store_id === selectedStore ||
          (p.store_name &&
            p.store_name.toLowerCase().includes(selectedStore.toLowerCase()))
      );
    }

    elements.comboProduk.innerHTML =
      '<option value="">Pilih produk lama atau kosongkan untuk baru</option>';
    filtered.forEach((p) => {
      const optionText = `${p.name} — ${
        p.store_name || "Toko Tidak Dikenal"
      } (Stok: ${p.stock || 0} | Harga: Rp ${p.purchase_price || 0})`;
      elements.comboProduk.innerHTML += `<option value="${p.sku}" data-name="${p.name}" data-price="${p.purchase_price}">${optionText}</option>`;
    });
  } catch (error) {
    showNotification("Gagal memuat daftar produk.", "error");
  }
}

// Save product
async function saveProduct() {
  if (!validateForm()) return;

  const formData = {
    store_id: elements.comboStore.value,
    product_sku: elements.comboProduk.value,
    name: elements.fieldNamaProduk.value,
    jumlah: parseInt(elements.jumlah.value),
    supplier: elements.supplier.value,
    purchase_price: parseFloat(
      elements.fieldHargaBeli.value.replace(/[^0-9]/g, "")
    ),
    notes: elements.notes.value,
  };

  if (elements.productId.value) {
    formData._id = elements.productId.value;
  }

  const isEdit = !!elements.productId.value;
  const url = isEdit
    ? `/api/product_masuk/${elements.productId.value}`
    : "/api/product_masuk";
  const method = isEdit ? "PUT" : "POST";

  try {
    const response = await fetch(url, {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    const result = await response.json();

    if (result.status) {
      showNotification(
        isEdit
          ? "Data barang masuk berhasil diperbarui."
          : "Barang masuk berhasil disimpan.",
        "success"
      );

      const selectedStore = elements.storeFilter.value;
      await loadProducts(selectedStore);
      await loadProductOptions(selectedStore);
      clearForm();
    } else {
      showNotification(result.message || "Gagal menyimpan data.", "error");
    }
  } catch (error) {
    showNotification("Gagal menyimpan data.", "error");
  }
}

// Update product
async function updateProduct() {
  await saveProduct(); // Using the same save function
}

// Delete product
async function deleteProduct(id) {
  if (!confirm("Yakin ingin menghapus data ini?")) return;

  try {
    const response = await fetch(`/api/product_masuk/${id}`, {
      method: "DELETE",
    });

    const result = await response.json();

    if (result.status) {
      showNotification("Data berhasil dihapus.", "success");
      const selectedStore = elements.storeFilter.value;
      await loadProducts(selectedStore);
      await loadProductOptions(selectedStore);
    } else {
      showNotification(result.message || "Gagal menghapus data.", "error");
    }
  } catch (error) {
    showNotification("Gagal menghapus data.", "error");
  }
}

// Show detail
async function showDetail(id) {
  try {
    const response = await fetch(`/api/product_masuk/${id}`);
    const item = await response.json();

    elements.detailContent.innerHTML = `
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-500">Kode SKU</label>
                            <p class="mt-1 text-sm text-gray-900">${
                              item.product_sku || "-"
                            }</p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-500">Nama Produk</label>
                            <p class="mt-1 text-sm text-gray-900">${
                              item.name || "-"
                            }</p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-500">Toko Tujuan</label>
                            <p class="mt-1 text-sm text-gray-900">${
                              item.store_name || "-"
                            }</p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-500">Supplier</label>
                            <p class="mt-1 text-sm text-gray-900">${
                              item.supplier || "-"
                            }</p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-500">Jumlah Masuk</label>
                            <p class="mt-1 text-sm font-medium text-green-600">${(
                              item.jumlah || 0
                            ).toLocaleString("id-ID")} unit</p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-500">Harga Beli</label>
                            <p class="mt-1 text-sm font-medium text-blue-600">${formatRupiah(
                              item.purchase_price
                            )}</p>
                        </div>
                        <div class="col-span-2">
                            <label class="block text-sm font-medium text-gray-500">Tanggal Masuk</label>
                            <p class="mt-1 text-sm text-gray-900">${
                              item.tanggal
                                ? new Date(item.tanggal).toLocaleDateString(
                                    "id-ID"
                                  )
                                : "-"
                            }</p>
                        </div>
                        <div class="col-span-2">
                            <label class="block text-sm font-medium text-gray-500">Catatan</label>
                            <p class="mt-1 text-sm text-gray-900 p-3 bg-gray-50 rounded">${
                              item.notes || "-"
                            }</p>
                        </div>
                    </div>
                `;

    elements.detailModal.classList.remove("hidden");
  } catch (error) {
    showNotification("Gagal memuat detail produk.", "error");
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
    const response = await fetch(`/api/product_masuk/${id}`);
    const item = await response.json();

    // Isi hidden id
    elements.productId.value = item._id;

    // Set store di form
    elements.comboStore.value = item.store_id || "";

    // Load opsi produk untuk store ini dulu
    await loadProductOptions(item.store_id || "all");

    // Baru set produk & field lain
    elements.comboProduk.value = item.product_sku || "";
    elements.fieldNamaProduk.value = item.name || "";
    elements.fieldHargaBeli.value = formatRupiah(item.purchase_price || 0);
    elements.jumlah.value = item.jumlah || "";
    elements.supplier.value = item.supplier || "";
    elements.notes.value = item.notes || "";

    // Disable field yang tidak boleh diubah di mode edit
    elements.comboStore.disabled = true;
    elements.comboProduk.disabled = true;
    elements.fieldNamaProduk.disabled = true;
    elements.fieldHargaBeli.disabled = true;

    // Tampilkan indikator mode edit
    elements.btnSaveProduct.classList.add("hidden");
    elements.btnUpdateProduct.classList.remove("hidden");
    elements.editModeIndicator.classList.remove("hidden");

    showNotification(
      "Mode edit aktif. Silahkan perbarui data yang diperlukan.",
      "info"
    );
  } catch (error) {
    console.error(error);
    showNotification("Gagal memuat data untuk diedit.", "error");
  }
}

// Validate form
function validateForm() {
  let isValid = true;

  // Clear previous errors
  document.querySelectorAll('[id$="Error"]').forEach((el) => {
    el.classList.add("hidden");
  });

  // Validate required fields
  if (!elements.comboStore.value) {
    document.getElementById("storeError").classList.remove("hidden");
    isValid = false;
  }

  if (!elements.fieldNamaProduk.value.trim()) {
    document.getElementById("nameError").classList.remove("hidden");
    isValid = false;
  }

  if (!elements.supplier.value.trim()) {
    document.getElementById("supplierError").classList.remove("hidden");
    isValid = false;
  }

  if (!elements.jumlah.value || parseInt(elements.jumlah.value) <= 0) {
    document.getElementById("jumlahError").classList.remove("hidden");
    isValid = false;
  }

  const price = parseFloat(
    elements.fieldHargaBeli.value.replace(/[^0-9]/g, "")
  );
  if (isNaN(price) || price < 0) {
    document.getElementById("priceError").classList.remove("hidden");
    isValid = false;
  }

  return isValid;
}

// Clear form
function clearForm() {
  // Clear form values
  elements.productId.value = "";
  elements.comboStore.value = "";
  elements.comboProduk.value = "";
  elements.fieldNamaProduk.value = "";
  elements.fieldHargaBeli.value = "";
  elements.jumlah.value = "";
  elements.supplier.value = "";
  elements.notes.value = "";

  // Enable fields
  elements.comboStore.disabled = false;
  elements.comboProduk.disabled = false;
  elements.fieldNamaProduk.disabled = false;
  elements.fieldHargaBeli.disabled = false;

  // Switch to save mode
  elements.btnSaveProduct.classList.remove("hidden");
  elements.btnUpdateProduct.classList.add("hidden");
  elements.editModeIndicator.classList.add("hidden");
  elements.productInfo.classList.add("hidden");

  // Clear errors
  document.querySelectorAll('[id$="Error"]').forEach((el) => {
    el.classList.add("hidden");
  });

  // Clear notification
  elements.formMessage.classList.add("hidden");
}

// Confirm delete
function confirmDelete(id) {
  if (userRole === "STAFF") {
    showNotification(
      "Staff tidak memiliki akses untuk menghapus data.",
      "error"
    );
    return;
  }

  deleteProduct(id);
}

// Initialize
document.addEventListener("DOMContentLoaded", function () {
  // Load initial data
  loadStoreOptions();
  loadProducts();
  loadProductOptions();



  // Setup sidebar navigation

  // Setup store filter
  elements.storeFilter.addEventListener("change", function () {
    loadProducts(this.value);
    loadProductOptions(this.value);
  });

  // Setup search
  elements.searchBox.addEventListener("input", function () {
    const searchTerm = this.value.toLowerCase();
    const rows = elements.productTableBody.querySelectorAll("tr");

    rows.forEach((row) => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(searchTerm) ? "" : "none";
    });
  });

  // Setup product selection
  elements.comboProduk.addEventListener("change", function () {
    const selectedOption = this.options[this.selectedIndex];

    if (this.value) {
      elements.fieldNamaProduk.value = selectedOption.dataset.name || "";
      elements.fieldHargaBeli.value = formatRupiah(
        selectedOption.dataset.price || "0"
      );

      elements.fieldNamaProduk.disabled = true;
      elements.fieldHargaBeli.disabled = true;
      elements.productInfo.classList.remove("hidden");
    } else {
      elements.fieldNamaProduk.disabled = false;
      elements.fieldHargaBeli.disabled = false;
      elements.productInfo.classList.add("hidden");
    }
  });

  // Setup store selection in form
  elements.comboStore.addEventListener("change", function () {
    loadProductOptions(this.value);
  });

  // Setup form buttons
  elements.btnSaveProduct.addEventListener("click", saveProduct);
  elements.btnUpdateProduct.addEventListener("click", updateProduct);
  elements.btnClearForm.addEventListener("click", clearForm);

  // Setup modal close
  elements.closeDetailModal.addEventListener("click", function () {
    elements.detailModal.classList.add("hidden");
  });

  // Close modal on background click
  elements.detailModal.addEventListener("click", function (e) {
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

  // Staff mode setup
  if (userRole === "STAFF") {
    // Disable form elements
    elements.comboStore.disabled = true;
    elements.comboProduk.disabled = true;
    elements.fieldNamaProduk.disabled = true;
    elements.jumlah.disabled = true;
    elements.supplier.disabled = true;
    elements.fieldHargaBeli.disabled = true;
    elements.notes.disabled = true;
    elements.btnSaveProduct.disabled = true;
    elements.btnClearForm.disabled = true;

    showNotification(
      "Mode Staff Aktif — hanya dapat melihat data barang masuk.",
      "info"
    );
  }

  // Format harga beli input
  elements.fieldHargaBeli.addEventListener("input", function () {
    let value = this.value.replace(/[^0-9]/g, "");
    if (value) {
      this.value = formatRupiah(value);
    }
  });
});
