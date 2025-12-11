// DOM Elements
const elements = {
  storeFilter: document.getElementById("storeFilter"),
  searchBox: document.getElementById("searchBox"),
  comboStore: document.getElementById("comboStore"),
  comboProduk: document.getElementById("comboProduk"),
  productInfo: document.getElementById("productInfo"),
  fieldNamaProduk: document.getElementById("fieldNamaProduk"),
  jumlah: document.getElementById("jumlah"),
  typeField: document.getElementById("typeField"),
  productId: document.getElementById("productId"),
  btnSaveProduct: document.getElementById("btnSaveProduct"),
  btnUpdateProduct: document.getElementById("btnUpdateProduct"),
  btnClearForm: document.getElementById("btnClearForm"),
  editModeIndicator: document.getElementById("editModeIndicator"),
  dynamicFields: document.getElementById("dynamicFields"),
  productTableBody: document.getElementById("productTableBody"),
  detailModal: document.getElementById("detailModal"),
  closeDetailModal: document.getElementById("closeDetailModal"),
  detailContent: document.getElementById("detailContent"),
  deleteModal: document.getElementById("deleteModal"),
  confirmDeleteBtn: document.getElementById("confirmDeleteBtn"),
  cancelDeleteBtn: document.getElementById("cancelDeleteBtn"),
  deleteModalMessage: document.getElementById("deleteModalMessage"),
  logoutBtn: document.getElementById("logoutBtn"),
  formMessage: document.getElementById("formMessage"),
  selectedProductName: document.getElementById("selectedProductName"),
  selectedProductStock: document.getElementById("selectedProductStock"),
};

// User role from template
const userRole = "{{ role }}".toUpperCase() || "ADMIN";
let deleteItemId = null;

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

// Format transaction type badge
function getTypeBadge(type) {
  const badges = {
    Penjualan: "badge-sale",
    Distribusi: "badge-distribution",
    Internal: "badge-internal",
    Rusak: "badge-damaged",
    Expired: "badge-expired",
  };
  return badges[type] || "badge-internal";
}

// Load store options
async function loadStoreOptions() {
  try {
    const response = await fetch("/api/stores");
    const result = await response.json();
    const stores = Array.isArray(result) ? result : result.data || [];

    // Clear existing options
    elements.storeFilter.innerHTML = '<option value="all">Semua Toko</option>';
    elements.comboStore.innerHTML = '<option value="">Pilih toko</option>';

    stores.forEach((store) => {
      const label = store.name + (store.city ? ` (${store.city})` : "");
      elements.storeFilter.innerHTML += `<option value="${store.store_id}">${label}</option>`;
      elements.comboStore.innerHTML += `<option value="${store.store_id}">${label}</option>`;
    });
  } catch (error) {
    showNotification("Gagal memuat daftar toko.", "error");
  }
}

// Load products (outgoing transactions)
async function loadProducts(selectedStore = "all") {
  try {
    elements.productTableBody.innerHTML = `
                    <tr>
                        <td colspan="8" class="px-6 py-8 text-center text-gray-500">
                            <i class="fas fa-spinner fa-spin text-blue-500 text-lg mb-2"></i>
                            <p>Memuat data barang keluar...</p>
                        </td>
                    </tr>
                `;

    const response = await fetch("/api/products_keluar");
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
                            <td colspan="8" class="px-6 py-8 text-center text-gray-500">
                                <i class="fas fa-box-open text-gray-400 text-lg mb-2"></i>
                                <p>Tidak ada data barang keluar</p>
                            </td>
                        </tr>
                    `;
      return;
    }

    let tableHTML = "";
    filtered.forEach((item) => {
      const canEdit = userRole !== "STAFF";
      const typeBadge = getTypeBadge(item.type);

      tableHTML += `
                        <tr class="datatable-row hover:bg-gray-50">
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${
                              item.product_sku || "-"
                            }</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${(
                              item.name || ""
                            ).toUpperCase()}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${
                              item.store_name || "-"
                            }</td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="badge ${typeBadge}">${
        item.type || "-"
      }</span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                                <i class="fas fa-arrow-down mr-1"></i>${(
                                  item.jumlah || 0
                                ).toLocaleString("id-ID")}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                                ${(item.stock_after || 0).toLocaleString(
                                  "id-ID"
                                )}
                            </td>
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
                                    <button onclick="confirmDelete('${item._id}', '${item.name}')" class="action-btn px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs">
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
    showNotification("Gagal memuat data barang keluar.", "error");
  }
}

// Load product options for dropdown
async function loadProductOptions(selectedStore = null) {
  try {
    let url = "/api/products_keluar/dropdown";
    if (selectedStore && selectedStore !== "all") {
      url += `?store_id=${selectedStore}`;
    }

    const response = await fetch(url);
    const result = await response.json();
    const data = Array.isArray(result) ? result : result.data || [];

    elements.comboProduk.innerHTML = '<option value="">Pilih produk</option>';
    data.forEach((p) => {
      const storeLabel =
        p.store_name && p.store_name.trim() !== ""
          ? p.store_name
          : p.store_id || "Tanpa Toko";
      elements.comboProduk.innerHTML += `
                        <option value="${p.sku}" 
                                data-name="${p.name}" 
                                data-stock="${p.stock}" 
                                data-store-id="${p.store_id}">
                            ${p.name} — ${storeLabel} (Stok: ${p.stock || 0})
                        </option>
                    `;
    });
  } catch (error) {
    showNotification("Gagal memuat daftar produk.", "error");
  }
}

// Build dynamic fields based on transaction type
function buildExtraFields(type) {
  elements.dynamicFields.innerHTML = "";

  switch (type) {
    case "Penjualan":
      elements.dynamicFields.innerHTML = `
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1 required-field">Nama Pelanggan</label>
                                <input type="text" id="nama_pelanggan" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required>
                                <p class="text-red-500 text-sm mt-1 hidden" id="customerError">Nama pelanggan wajib diisi</p>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1 required-field">Harga Jual</label>
                                <div class="relative">
                                    <span class="absolute left-3 top-2 text-gray-500">Rp</span>
                                    <input type="text" id="harga_jual" class="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="0" required>
                                </div>
                                <p class="text-red-500 text-sm mt-1 hidden" id="priceError">Harga jual wajib diisi</p>
                            </div>
                        </div>
                    `;
      break;

    case "Distribusi":
      elements.dynamicFields.innerHTML = `
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1 required-field">Tujuan Pengiriman</label>
                                <input type="text" id="tujuan_pengiriman" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required>
                                <p class="text-red-500 text-sm mt-1 hidden" id="destinationError">Tujuan pengiriman wajib diisi</p>
                            </div>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Nama Penerima</label>
                                    <input type="text" id="nama_penerima" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">No Surat Jalan</label>
                                    <input type="text" id="no_surat_jalan" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                                </div>
                            </div>
                        </div>
                    `;
      break;

    case "Internal":
    case "Rusak":
    case "Expired":
      elements.dynamicFields.innerHTML = `
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1 required-field">Keterangan</label>
                            <textarea id="keterangan" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" rows="2" required></textarea>
                            <p class="text-red-500 text-sm mt-1 hidden" id="noteError">Keterangan wajib diisi</p>
                        </div>
                    `;
      break;
  }
}

// Save product (outgoing)
async function saveProduct() {
  if (!validateForm()) return;

  const formData = {
    store_id: elements.comboStore.value,
    product_sku: elements.comboProduk.value,
    name: elements.fieldNamaProduk.value,
    jumlah: parseInt(elements.jumlah.value),
    type: elements.typeField.value,
  };

  // Add dynamic fields based on type
  const type = elements.typeField.value;
  switch (type) {
    case "Penjualan":
      const hargaJual = document
        .getElementById("harga_jual")
        ?.value.replace(/[^0-9]/g, "");
      formData.nama_pelanggan =
        document.getElementById("nama_pelanggan")?.value;
      formData.harga_jual = hargaJual ? parseFloat(hargaJual) : 0;
      break;
    case "Distribusi":
      formData.tujuan_pengiriman =
        document.getElementById("tujuan_pengiriman")?.value;
      formData.nama_penerima = document.getElementById("nama_penerima")?.value;
      formData.no_surat_jalan =
        document.getElementById("no_surat_jalan")?.value;
      break;
    case "Internal":
    case "Rusak":
    case "Expired":
      formData.keterangan = document.getElementById("keterangan")?.value;
      break;
  }

  if (elements.productId.value) {
    formData._id = elements.productId.value;
  }

  const isEdit = !!elements.productId.value;
  const url = isEdit
    ? `/api/products_keluar/${elements.productId.value}`
    : "/api/products_keluar";
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
          ? "Data barang keluar berhasil diperbarui."
          : "Barang keluar berhasil disimpan.",
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

// Show detail
async function showDetail(id) {
  try {
    const response = await fetch(`/api/products_keluar/${id}`);
    const item = await response.json();

    let catatan = "-";
    switch ((item.type || "").toLowerCase()) {
      case "penjualan":
        catatan = `
                            <div class="space-y-2">
                                <div><span class="font-medium">Nama Pelanggan:</span> ${
                                  item.nama_pelanggan || "-"
                                }</div>
                                <div><span class="font-medium">Harga Jual:</span> Rp ${
                                  item.total_harga?.toLocaleString("id-ID") ||
                                  "-"
                                }</div>
                            </div>`;
        break;
      case "distribusi":
        catatan = `
                            <div class="space-y-2">
                                <div><span class="font-medium">Tujuan Pengiriman:</span> ${
                                  item.tujuan_pengiriman || "-"
                                }</div>
                                <div><span class="font-medium">Nama Penerima:</span> ${
                                  item.nama_penerima || "-"
                                }</div>
                                <div><span class="font-medium">No Surat Jalan:</span> ${
                                  item.no_surat_jalan || "-"
                                }</div>
                            </div>`;
        break;
      case "internal":
      case "rusak":
      case "expired":
        catatan = item.keterangan || "-";
        break;
    }

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
                            <label class="block text-sm font-medium text-gray-500">Toko Asal</label>
                            <p class="mt-1 text-sm text-gray-900">${
                              item.store_name || "-"
                            }</p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-500">Tipe Transaksi</label>
                            <p class="mt-1"><span class="badge ${getTypeBadge(
                              item.type
                            )}">${item.type || "-"}</span></p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-500">Jumlah Keluar</label>
                            <p class="mt-1 text-sm font-medium text-red-600">
                                <i class="fas fa-arrow-down mr-1"></i>${(
                                  item.jumlah || 0
                                ).toLocaleString("id-ID")} unit
                            </p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-500">Stok Setelah</label>
                            <p class="mt-1 text-sm font-medium text-blue-600">${
                              item.stock_after || "-"
                            }</p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-500">Tanggal Transaksi</label>
                            <p class="mt-1 text-sm text-gray-900">${
                              item.tanggal
                                ? new Date(item.tanggal).toLocaleDateString(
                                    "id-ID"
                                  )
                                : "-"
                            }</p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-500">Stok Sebelum</label>
                            <p class="mt-1 text-sm text-gray-900">${
                              item.stock_before || "-"
                            }</p>
                        </div>
                        <div class="col-span-2">
                            <label class="block text-sm font-medium text-gray-500">Catatan / Keterangan</label>
                            <div class="mt-1 text-sm text-gray-900 p-3 bg-gray-50 rounded">${catatan}</div>
                        </div>
                    </div>
                `;

    elements.detailModal.classList.remove("hidden");
  } catch (error) {
    showNotification("Gagal memuat detail transaksi.", "error");
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
    const response = await fetch(`/api/products_keluar/${id}`);
    const item = await response.json();

    // Populate form
    elements.productId.value = item._id;
    elements.comboStore.value = item.store_id;
    elements.comboProduk.value = item.product_sku || "";
    elements.fieldNamaProduk.value = item.name || "";
    elements.jumlah.value = item.jumlah || "";
    elements.typeField.value = item.type || "";

    // Build dynamic fields
    buildExtraFields(item.type);

    // Populate dynamic fields
    setTimeout(() => {
      switch (item.type) {
        case "Penjualan":
          if (document.getElementById("nama_pelanggan"))
            document.getElementById("nama_pelanggan").value =
              item.nama_pelanggan || "";
          if (document.getElementById("harga_jual") && item.harga_jual)
            document.getElementById("harga_jual").value = formatRupiah(
              item.harga_jual
            );
          break;
        case "Distribusi":
          if (document.getElementById("tujuan_pengiriman"))
            document.getElementById("tujuan_pengiriman").value =
              item.tujuan_pengiriman || "";
          if (document.getElementById("nama_penerima"))
            document.getElementById("nama_penerima").value =
              item.nama_penerima || "";
          if (document.getElementById("no_surat_jalan"))
            document.getElementById("no_surat_jalan").value =
              item.no_surat_jalan || "";
          break;
        case "Internal":
        case "Rusak":
        case "Expired":
          if (document.getElementById("keterangan"))
            document.getElementById("keterangan").value = item.keterangan || "";
          break;
      }
    }, 100);

    // Disable fields
    elements.comboStore.disabled = true;
    elements.comboProduk.disabled = true;
    elements.fieldNamaProduk.disabled = true;

    // Show edit mode
    elements.btnSaveProduct.classList.add("hidden");
    elements.btnUpdateProduct.classList.remove("hidden");
    elements.editModeIndicator.classList.remove("hidden");

    // Load product options for the selected store
    await loadProductOptions(item.store_id);

    showNotification(
      "Mode edit aktif. Silahkan perbarui data yang diperlukan.",
      "info"
    );
  } catch (error) {
    showNotification("Gagal memuat data untuk diedit.", "error");
  }
}

// Delete product
async function deleteProduct(id) {
  try {
    const response = await fetch(`/api/products_keluar/${id}`, {
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

// Confirm delete
function confirmDelete(id, productName) {
  if (userRole === "STAFF") {
    showNotification(
      "Staff tidak memiliki akses untuk menghapus data.",
      "error"
    );
    return;
  }

  deleteItemId = id;
  elements.deleteModalMessage.textContent = `Apakah Anda yakin ingin menghapus transaksi untuk produk "${productName}"?`;
  elements.deleteModal.classList.remove("hidden");
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

  if (!elements.comboProduk.value) {
    document.getElementById("productError").classList.remove("hidden");
    isValid = false;
  }

  if (!elements.fieldNamaProduk.value.trim()) {
    document.getElementById("nameError").classList.remove("hidden");
    isValid = false;
  }

  if (!elements.jumlah.value || parseInt(elements.jumlah.value) <= 0) {
    document.getElementById("jumlahError").classList.remove("hidden");
    isValid = false;
  }

  if (!elements.typeField.value) {
    document.getElementById("typeError").classList.remove("hidden");
    isValid = false;
  }

  // Validate dynamic fields
  const type = elements.typeField.value;
  switch (type) {
    case "Penjualan":
      if (!document.getElementById("nama_pelanggan")?.value.trim()) {
        document.getElementById("customerError").classList.remove("hidden");
        isValid = false;
      }
      const hargaJual = document
        .getElementById("harga_jual")
        ?.value.replace(/[^0-9]/g, "");
      if (!hargaJual || parseFloat(hargaJual) <= 0) {
        document.getElementById("priceError").classList.remove("hidden");
        isValid = false;
      }
      break;
    case "Distribusi":
      if (!document.getElementById("tujuan_pengiriman")?.value.trim()) {
        document.getElementById("destinationError").classList.remove("hidden");
        isValid = false;
      }
      break;
    case "Internal":
    case "Rusak":
    case "Expired":
      if (!document.getElementById("keterangan")?.value.trim()) {
        document.getElementById("noteError").classList.remove("hidden");
        isValid = false;
      }
      break;
  }

  return isValid;
}

// Format Rupiah
function formatRupiah(value) {
  if (!value) return "Rp 0";
  const num = parseFloat(value);
  return "Rp " + num.toLocaleString("id-ID");
}

// Clear form
function clearForm() {
  // Clear form values
  elements.productId.value = "";
  elements.comboStore.value = "";
  elements.comboProduk.value = "";
  elements.fieldNamaProduk.value = "";
  elements.jumlah.value = "";
  elements.typeField.value = "";
  elements.dynamicFields.innerHTML = "";

  // Enable fields
  elements.comboStore.disabled = false;
  elements.comboProduk.disabled = false;
  elements.fieldNamaProduk.disabled = false;

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

// Initialize
document.addEventListener("DOMContentLoaded", function () {
  // Load initial data
  loadStoreOptions();
  loadProducts();
  loadProductOptions();

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

  // Setup store selection in form
  elements.comboStore.addEventListener("change", function () {
    loadProductOptions(this.value);
    elements.comboProduk.value = "";
    elements.fieldNamaProduk.value = "";
    elements.productInfo.classList.add("hidden");
  });

  // Setup product selection
  elements.comboProduk.addEventListener("change", function () {
    const selectedOption = this.options[this.selectedIndex];

    if (this.value) {
      elements.fieldNamaProduk.value = selectedOption.dataset.name || "";
      elements.fieldNamaProduk.disabled = true;

      // Show product info
      elements.selectedProductName.textContent =
        selectedOption.dataset.name || "";
      elements.selectedProductStock.textContent =
        selectedOption.dataset.stock || 0;
      elements.productInfo.classList.remove("hidden");

      // Auto-set store if not set
      if (!elements.comboStore.value && selectedOption.dataset.storeId) {
        elements.comboStore.value = selectedOption.dataset.storeId;
      }
    } else {
      elements.fieldNamaProduk.disabled = false;
      elements.productInfo.classList.add("hidden");
    }
  });

  // Setup transaction type change
  elements.typeField.addEventListener("change", function () {
    buildExtraFields(this.value);
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

  // Setup delete modal
  elements.confirmDeleteBtn.addEventListener("click", function () {
    if (deleteItemId) {
      deleteProduct(deleteItemId);
      elements.deleteModal.classList.add("hidden");
      deleteItemId = null;
    }
  });

  elements.cancelDeleteBtn.addEventListener("click", function () {
    elements.deleteModal.classList.add("hidden");
    deleteItemId = null;
  });

  // Close delete modal on background click
  elements.deleteModal.addEventListener("click", function (e) {
    if (e.target === this) {
      this.classList.add("hidden");
      deleteItemId = null;
    }
  });

  // Setup logout
  elements.logoutBtn.addEventListener("click", function () {
    if (confirm("Yakin ingin keluar dari sistem?")) {
      window.location.href = "/logout";
    }
  });

  // Format price inputs
  document.addEventListener("input", function (e) {
    if (e.target.id === "harga_jual") {
      let value = e.target.value.replace(/[^0-9]/g, "");
      if (value) {
        e.target.value = formatRupiah(value);
      }
    }
  });

  // Staff mode setup
  if (userRole === "STAFF") {
    // Disable form elements
    elements.comboStore.disabled = true;
    elements.comboProduk.disabled = true;
    elements.fieldNamaProduk.disabled = true;
    elements.jumlah.disabled = true;
    elements.typeField.disabled = true;
    elements.btnSaveProduct.disabled = true;
    elements.btnClearForm.disabled = true;

    showNotification(
      "Mode Staff Aktif — hanya dapat melihat data barang keluar.",
      "info"
    );
  }
});
