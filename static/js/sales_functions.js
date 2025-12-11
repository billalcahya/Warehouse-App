// DOM Elements
const elements = {
  // Filters
  storeFilter: document.getElementById("storeFilter"),
  stockFilter: document.getElementById("stockFilter"),
  searchBox: document.getElementById("searchBox"),

  // Product Grid
  productGrid: document.getElementById("productGrid"),
  productCount: document.getElementById("productCount"),

  // Cart
  cartItems: document.getElementById("cartItems"),
  cartCount: document.getElementById("cartCount"),
  customerName: document.getElementById("customerName"),
  subtotal: document.getElementById("subtotal"),
  itemCount: document.getElementById("itemCount"),
  totalAmount: document.getElementById("totalAmount"),

  // Buttons
  btnClearCart: document.getElementById("btnClearCart"),
  btnCheckout: document.getElementById("btnCheckout"),
  logoutBtn: document.getElementById("logoutBtn"),

  // Modals
  transactionsModal: document.getElementById("transactionsModal"),
  closeTransactionsModal: document.getElementById("closeTransactionsModal"),
  closeTransactionsModalBtn: document.getElementById(
    "closeTransactionsModalBtn"
  ),
  transactionsBody: document.getElementById("transactionsBody"),

  deleteModal: document.getElementById("deleteModal"),
  confirmDeleteBtn: document.getElementById("confirmDeleteBtn"),
  cancelDeleteBtn: document.getElementById("cancelDeleteBtn"),
  deleteModalMessage: document.getElementById("deleteModalMessage"),

  successModal: document.getElementById("successModal"),
  closeSuccessModalBtn: document.getElementById("closeSuccessModalBtn"),
  successModalMessage: document.getElementById("successModalMessage"),
};

// User role from template
const userRole = "{{ role }}".toUpperCase() || "ADMIN";

// Global variables
let cart = [];
let allProducts = [];
let deleteTransactionId = null;

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

    loadProducts("all");
  } catch (error) {
    showNotification("Gagal memuat daftar toko.", "error");
  }
}

// Load products
async function loadProducts(storeId = "all") {
  try {
    let url = "/api/products";
    if (storeId !== "all") url += `?store_id=${storeId}`;

    const response = await fetch(url);
    const result = await response.json();

    if (!result || !result.status) {
      showNotification(result?.message || "Gagal memuat produk.", "error");
      return;
    }

    allProducts = (result.data || [])
      .filter((p) => parseFloat(p.sale_price) > 0)
      .map((p) => ({
        _id: p._id,
        name: p.name,
        sale_price: Number(p.sale_price) || 0,
        stock: Number(p.stock) || 0,
        category: p.category || "-",
        store_id: p.store_id || null,
        store_name: p.store_name || "-",
      }));

    filterProducts();
  } catch (error) {
    showNotification("Gagal memuat produk.", "error");
  }
}

// Filter products
function filterProducts() {
  const searchTerm = elements.searchBox.value.toLowerCase().trim();
  const stockFilter = elements.stockFilter.value;

  let filteredProducts = allProducts;

  // Apply stock filter
  if (stockFilter === "empty") {
    filteredProducts = filteredProducts.filter((p) => p.stock === 0);
  } else if (stockFilter === "low") {
    filteredProducts = filteredProducts.filter(
      (p) => p.stock > 0 && p.stock <= 5
    );
  }

  // Apply search filter
  if (searchTerm) {
    filteredProducts = filteredProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(searchTerm) ||
        p._id.toLowerCase().includes(searchTerm) ||
        p.category.toLowerCase().includes(searchTerm)
    );
  }

  // Update product count
  elements.productCount.textContent = `${filteredProducts.length} produk ditemukan`;

  // Render products
  renderProducts(filteredProducts);
}

// Render products to grid
function renderProducts(products) {
  if (products.length === 0) {
    elements.productGrid.innerHTML = `
                    <div class="col-span-4 py-12 text-center text-gray-500">
                        <i class="fas fa-box-open text-gray-400 text-2xl mb-3"></i>
                        <p class="text-lg">Tidak ada produk ditemukan</p>
                        <p class="text-sm mt-1">Coba ubah filter atau kata kunci pencarian</p>
                    </div>
                `;
    return;
  }

  let productHTML = "";
  products.forEach((product) => {
    const stockClass =
      product.stock === 0
        ? "out-of-stock"
        : product.stock <= 5
        ? "low-stock"
        : "";
    const isOutOfStock = product.stock === 0;

    productHTML += `
                    <div class="product-card bg-white border border-gray-200 rounded-lg cursor-pointer ${stockClass}"
                         onclick="${
                           !isOutOfStock ? `addToCart('${product._id}')` : ""
                         }">
                        <div class="p-4">
                            <div class="text-sm font-medium text-gray-900 truncate mb-1">
                                ${(product.name || "").toUpperCase()}
                            </div>
                            <div class="text-lg font-bold text-blue-600 mb-2">
                                ${formatRupiah(product.sale_price)}
                            </div>
                            <div class="flex justify-between items-center text-sm">
                                <span class="text-gray-600">
                                    <i class="fas fa-box mr-1"></i>${formatNumber(
                                      product.stock
                                    )}
                                </span>
                                ${
                                  !isOutOfStock
                                    ? `
                                <span class="text-green-600 font-medium">
                                    <i class="fas fa-cart-plus"></i>
                                </span>
                                `
                                    : ""
                                }
                            </div>
                        </div>
                    </div>
                `;
  });

  elements.productGrid.innerHTML = productHTML;
}

// Add to cart
function addToCart(productId) {
  const product = allProducts.find((p) => p._id === productId);
  if (!product) return;

  if (product.stock === 0) {
    showNotification("Produk ini sudah habis.", "warning");
    return;
  }

  const existingItem = cart.find((item) => item.product_id === productId);

  if (existingItem) {
    if (existingItem.quantity >= product.stock) {
      showNotification(
        `Stok tidak cukup. Hanya tersedia ${product.stock} unit.`,
        "warning"
      );
      return;
    }
    existingItem.quantity += 1;
    existingItem.total_price = existingItem.quantity * existingItem.sale_price;
  } else {
    cart.push({
      product_id: product._id,
      product_name: product.name,
      sale_price: product.sale_price,
      quantity: 1,
      total_price: product.sale_price,
      store_id: product.store_id,
      store_name: product.store_name,
    });
  }

  updateCartDisplay();
  showNotification(`"${product.name}" ditambahkan ke keranjang.`, "success");
}

// Remove from cart
function removeFromCart(productId) {
  cart = cart.filter((item) => item.product_id !== productId);
  updateCartDisplay();
}

// Update quantity in cart
function updateQuantity(productId, newQuantity) {
  const item = cart.find((item) => item.product_id === productId);
  if (!item) return;

  const product = allProducts.find((p) => p._id === productId);
  if (!product) return;

  if (newQuantity < 1) {
    removeFromCart(productId);
    return;
  }

  if (newQuantity > product.stock) {
    showNotification(
      `Stok tidak cukup. Hanya tersedia ${product.stock} unit.`,
      "warning"
    );
    newQuantity = product.stock;
  }

  item.quantity = newQuantity;
  item.total_price = item.quantity * item.sale_price;
  updateCartDisplay();
}

// Update cart display
function updateCartDisplay() {
  // Update cart items
  if (cart.length === 0) {
    elements.cartItems.innerHTML = `
                    <div class="text-center py-8 text-gray-500">
                        <i class="fas fa-shopping-cart text-gray-400 text-2xl mb-2"></i>
                        <p>Keranjang belanja kosong</p>
                        <p class="text-sm mt-1">Pilih produk dari daftar di sebelah kiri</p>
                    </div>
                `;
  } else {
    let cartHTML = "";
    cart.forEach((item) => {
      cartHTML += `
                        <div class="cart-item bg-gray-50 p-3 rounded-lg">
                            <div class="flex justify-between items-start mb-2">
                                <div class="flex-1">
                                    <div class="font-medium text-gray-900 text-sm">
                                        ${(
                                          item.product_name || ""
                                        ).toUpperCase()}
                                    </div>
                                    <div class="text-gray-600 text-xs mt-1">
                                        ${item.store_name || "-"}
                                    </div>
                                </div>
                                <button onclick="removeFromCart('${
                                  item.product_id
                                }')" class="text-red-500 hover:text-red-700 ml-2">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                            <div class="flex items-center justify-between">
                                <div class="flex items-center space-x-2">
                                    <button onclick="updateQuantity('${
                                      item.product_id
                                    }', ${item.quantity - 1})" 
                                            class="w-8 h-8 flex items-center justify-center bg-gray-200 rounded hover:bg-gray-300">
                                        <i class="fas fa-minus text-xs"></i>
                                    </button>
                                    <input type="number" 
                                           value="${item.quantity}" 
                                           min="1" 
                                           onchange="updateQuantity('${
                                             item.product_id
                                           }', parseInt(this.value))"
                                           class="w-16 text-center px-2 py-1 border border-gray-300 rounded text-sm">
                                    <button onclick="updateQuantity('${
                                      item.product_id
                                    }', ${item.quantity + 1})" 
                                            class="w-8 h-8 flex items-center justify-center bg-gray-200 rounded hover:bg-gray-300">
                                        <i class="fas fa-plus text-xs"></i>
                                    </button>
                                </div>
                                <div class="font-medium text-blue-600">
                                    ${formatRupiah(item.total_price)}
                                </div>
                            </div>
                        </div>
                    `;
    });
    elements.cartItems.innerHTML = cartHTML;
  }

  // Update summary
  const subtotal = cart.reduce((sum, item) => sum + item.total_price, 0);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  elements.cartCount.textContent = `${itemCount} item`;
  elements.subtotal.textContent = formatRupiah(subtotal);
  elements.itemCount.textContent = itemCount;
  elements.totalAmount.textContent = formatRupiah(subtotal);
}

// Clear cart
function clearCart() {
  if (cart.length === 0) {
    showNotification("Keranjang sudah kosong.", "info");
    return;
  }

  if (confirm("Yakin ingin mengosongkan keranjang?")) {
    cart = [];
    updateCartDisplay();
    elements.customerName.value = "";
    showNotification("Keranjang berhasil dikosongkan.", "success");
  }
}

// Checkout
async function checkout() {
  if (cart.length === 0) {
    showNotification(
      "Keranjang kosong. Tambahkan produk terlebih dahulu.",
      "error"
    );
    return;
  }

  const customerName = elements.customerName.value.trim() || "Umum";

  const payload = {
    items: cart.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      store_id: item.store_id,
      store_name: item.store_name,
    })),
    customer_name: customerName,
  };

  try {
    const response = await fetch("/api/sales_batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (result.status) {
      // Show success modal
      elements.successModalMessage.textContent = "Transaksi berhasil disimpan.";
      elements.successModal.classList.remove("hidden");

      // Reset cart
      cart = [];
      updateCartDisplay();
      elements.customerName.value = "";

      // Reload products to update stock
      const storeId = elements.storeFilter.value;
      loadProducts(storeId);
    } else {
      showNotification(result.message || "Gagal menyimpan transaksi.", "error");
    }
  } catch (error) {
    showNotification("Gagal menyimpan transaksi.", "error");
  }
}

// Load recent transactions
async function loadRecentTransactions() {
  try {
    const response = await fetch("/api/sales");
    const result = await response.json();

    if (!result || !result.status) {
      elements.transactionsBody.innerHTML = `
                        <tr>
                            <td colspan="9" class="px-4 py-8 text-center text-gray-500">
                                <i class="fas fa-exclamation-circle text-gray-400 mr-2"></i>
                                Gagal memuat data transaksi
                            </td>
                        </tr>
                    `;
      return;
    }

    const transactions = result.data || [];

    if (transactions.length === 0) {
      elements.transactionsBody.innerHTML = `
                        <tr>
                            <td colspan="9" class="px-4 py-8 text-center text-gray-500">
                                <i class="fas fa-shopping-cart text-gray-400 mr-2"></i>
                                Belum ada transaksi
                            </td>
                        </tr>
                    `;
      return;
    }

    let tableHTML = "";
    transactions.forEach((transaction, index) => {
      const canDelete = userRole === "ADMIN";

      tableHTML += `
                        <tr class="hover:bg-gray-50">
                            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">${
                              index + 1
                            }</td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-mono">${
                              transaction.product_id || "-"
                            }</td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                ${(
                                  transaction.product_name || ""
                                ).toUpperCase()}
                            </td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${
                              transaction.store_name || "-"
                            }</td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">${formatNumber(
                              transaction.quantity || 0
                            )}</td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-blue-600">${formatRupiah(
                              transaction.total_price || 0
                            )}</td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">${(
                              transaction.customer_name || "Umum"
                            ).toUpperCase()}</td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${(
                              transaction.created_by || "unknown"
                            ).toUpperCase()}</td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium">
                                ${
                                  canDelete
                                    ? `
                                <button onclick="confirmDeleteTransaction('${transaction._id}', '${transaction.product_name}')" 
                                        class="text-red-500 hover:text-red-700">
                                    <i class="fas fa-trash"></i>
                                </button>
                                `
                                    : '<span class="text-gray-400">-</span>'
                                }
                            </td>
                        </tr>
                    `;
    });

    elements.transactionsBody.innerHTML = tableHTML;
  } catch (error) {
    elements.transactionsBody.innerHTML = `
                    <tr>
                        <td colspan="9" class="px-4 py-8 text-center text-gray-500">
                            <i class="fas fa-exclamation-triangle text-red-400 mr-2"></i>
                            Gagal memuat data transaksi
                        </td>
                    </tr>
                `;
  }
}

// Confirm delete transaction
function confirmDeleteTransaction(id, productName) {
  if (userRole !== "ADMIN") {
    showNotification(
      "Akses ditolak — hanya admin yang boleh menghapus transaksi.",
      "error"
    );
    return;
  }

  deleteTransactionId = id;
  elements.deleteModalMessage.textContent = `Apakah Anda yakin ingin menghapus transaksi untuk produk "${productName}"?\nPenghapusan akan mempengaruhi stok dan laporan.`;
  elements.deleteModal.classList.remove("hidden");
}

// Delete transaction
async function deleteTransaction(id) {
  try {
    const response = await fetch(`/api/sales/${id}`, {
      method: "DELETE",
    });

    const result = await response.json();

    if (result.status) {
      showNotification("Transaksi berhasil dihapus.", "success");

      // Reload transactions
      await loadRecentTransactions();

      // Reload products to update stock
      const storeId = elements.storeFilter.value;
      loadProducts(storeId);
    } else {
      showNotification(result.message || "Gagal menghapus transaksi.", "error");
    }
  } catch (error) {
    showNotification("Gagal menghapus transaksi.", "error");
  }
}

// Show transactions modal
function showTransactions() {
  loadRecentTransactions();
  elements.transactionsModal.classList.remove("hidden");
}

// Initialize
document.addEventListener("DOMContentLoaded", function () {
  // Load initial data
  loadStoreOptions();

  // Setup filter events
  elements.storeFilter.addEventListener("change", function () {
    loadProducts(this.value);
  });

  elements.stockFilter.addEventListener("change", filterProducts);
  elements.searchBox.addEventListener("input", filterProducts);

  // Setup cart events
  elements.btnClearCart.addEventListener("click", clearCart);
  elements.btnCheckout.addEventListener("click", checkout);

  // Setup modal events
  elements.closeTransactionsModal.addEventListener("click", function () {
    elements.transactionsModal.classList.add("hidden");
  });

  elements.closeTransactionsModalBtn.addEventListener("click", function () {
    elements.transactionsModal.classList.add("hidden");
  });

  elements.transactionsModal.addEventListener("click", function (e) {
    if (e.target === this) {
      this.classList.add("hidden");
    }
  });

  // Delete modal events
  elements.confirmDeleteBtn.addEventListener("click", function () {
    if (deleteTransactionId) {
      deleteTransaction(deleteTransactionId);
      elements.deleteModal.classList.add("hidden");
      deleteTransactionId = null;
    }
  });

  elements.cancelDeleteBtn.addEventListener("click", function () {
    elements.deleteModal.classList.add("hidden");
    deleteTransactionId = null;
  });

  elements.deleteModal.addEventListener("click", function (e) {
    if (e.target === this) {
      this.classList.add("hidden");
      deleteTransactionId = null;
    }
  });

  // Success modal events
  elements.closeSuccessModalBtn.addEventListener("click", function () {
    elements.successModal.classList.add("hidden");
  });

  elements.successModal.addEventListener("click", function (e) {
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

  // Auto-focus customer name field when cart has items
  setInterval(() => {
    if (cart.length > 0 && !elements.customerName.value.trim()) {
      elements.customerName.focus();
    }
  }, 1000);

  // Add view transactions button to header
  const header = document.querySelector(".bg-white.shadow-sm");
  const viewTransactionsBtn = document.createElement("button");
  viewTransactionsBtn.className =
    "px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors ml-4";
  viewTransactionsBtn.innerHTML =
    '<i class="fas fa-history mr-2"></i>Riwayat Transaksi';
  viewTransactionsBtn.onclick = showTransactions;

  const userInfo = document.querySelector(".flex.items-center.space-x-4");
  userInfo.insertBefore(viewTransactionsBtn, elements.logoutBtn);
});
