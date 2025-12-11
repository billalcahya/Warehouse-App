// DOM Elements
const elements = {
  searchBox: document.getElementById("searchBox"),
  employeeTableBody: document.getElementById("employeeTableBody"),
  deleteModal: document.getElementById("deleteModal"),
  confirmDeleteBtn: document.getElementById("confirmDeleteBtn"),
  cancelDeleteBtn: document.getElementById("cancelDeleteBtn"),
  deleteModalMessage: document.getElementById("deleteModalMessage"),
  logoutBtn: document.getElementById("logoutBtn"),
  formMessage: document.getElementById("formMessage"),

  // Form fields
  employeeId: document.getElementById("employeeId"),
  fieldNama: document.getElementById("fieldNama"),
  fieldUsername: document.getElementById("fieldUsername"),
  fieldEmail: document.getElementById("fieldEmail"),
  fieldPassword: document.getElementById("fieldPassword"),
  fieldRole: document.getElementById("fieldRole"),
  passwordHint: document.getElementById("passwordHint"),

  // Buttons
  btnSaveEmployee: document.getElementById("btnSaveEmployee"),
  btnUpdateEmployee: document.getElementById("btnUpdateEmployee"),
  btnClearForm: document.getElementById("btnClearForm"),

  // Indicators
  editModeIndicator: document.getElementById("editModeIndicator"),

  // Count
  tableCount: document.getElementById("tableCount"),
};

// User role from template
const userRole = "{{ role }}".toUpperCase() || "ADMIN";
let deleteEmployeeId = null;
let allEmployees = [];

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

// Toggle password visibility
function togglePasswordVisibility() {
  const passwordField = elements.fieldPassword;
  const toggleIcon = document.querySelector(".password-toggle");

  if (passwordField.type === "password") {
    passwordField.type = "text";
    toggleIcon.classList.remove("fa-eye");
    toggleIcon.classList.add("fa-eye-slash");
  } else {
    passwordField.type = "password";
    toggleIcon.classList.remove("fa-eye-slash");
    toggleIcon.classList.add("fa-eye");
  }
}

// Get role badge HTML
function getRoleBadge(role) {
  if (role === "ADMIN") {
    return '<span class="role-badge badge-admin">ADMIN</span>';
  } else {
    return '<span class="role-badge badge-staff">STAFF</span>';
  }
}

// Load employees
async function loadEmployees() {
  try {
    elements.employeeTableBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="px-6 py-8 text-center text-gray-500">
                            <i class="fas fa-spinner fa-spin text-blue-500 text-lg mb-2"></i>
                            <p>Memuat data karyawan...</p>
                        </td>
                    </tr>
                `;

    const response = await fetch("/api/karyawan");
    const result = await response.json();
    const data = Array.isArray(result) ? result : result.data || [];

    if (!Array.isArray(result) && result.status === false) {
      showNotification(
        result.message || "Gagal memuat data karyawan.",
        "error"
      );
      return;
    }

    // Store all employees for filtering
    allEmployees = data;

    if (data.length === 0) {
      elements.employeeTableBody.innerHTML = `
                        <tr>
                            <td colspan="6" class="px-6 py-8 text-center text-gray-500">
                                <i class="fas fa-users text-gray-400 text-lg mb-2"></i>
                                <p>Tidak ada data karyawan</p>
                            </td>
                        </tr>
                    `;
      elements.tableCount.textContent = "0";
      return;
    }

    // Update count
    elements.tableCount.textContent = data.length;

    // Build table rows
    let tableHTML = "";
    data.forEach((item, index) => {
      const canEdit = userRole !== "STAFF";

      tableHTML += `
                        <tr class="datatable-row hover:bg-gray-50">
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                ${index + 1}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                ${(item.name || "").toUpperCase()}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                ${item.username || "-"}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                ${getRoleBadge(item.role)}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                ${
                                  item.created_by
                                    ? item.created_by.toUpperCase()
                                    : "-"
                                }
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div class="flex space-x-2">
                                    ${
                                      canEdit
                                        ? `
                                    <button onclick="editEmployee('${item._id}')" class="action-btn px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-xs">
                                        <i class="fas fa-edit mr-1"></i>Edit
                                    </button>
                                    <button onclick="confirmDelete('${item._id}', '${item.name}')" class="action-btn px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs">
                                        <i class="fas fa-trash mr-1"></i>Hapus
                                    </button>
                                    `
                                        : `<span class="text-gray-400 text-xs">Tidak Ada Aksi</span>`
                                    }
                                </div>
                            </td>
                        </tr>
                    `;
    });

    elements.employeeTableBody.innerHTML = tableHTML;
  } catch (error) {
    showNotification("Gagal memuat data karyawan.", "error");
  }
}

// Save employee
async function saveEmployee() {
  if (!validateForm(true)) return;

  const formData = {
    name: elements.fieldNama.value.trim(),
    username: elements.fieldUsername.value.trim(),
    password: elements.fieldPassword.value,
    role: elements.fieldRole.value,
    email: elements.fieldEmail.value.trim(),
  };

  try {
    const response = await fetch("/api/karyawan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    const result = await response.json();

    if (result.status) {
      showNotification("Karyawan baru berhasil disimpan.", "success");
      clearForm();
      await loadEmployees();
    } else {
      showNotification(result.error || "Gagal menyimpan data.", "error");
    }
  } catch (error) {
    showNotification("Gagal menyimpan data.", "error");
  }
}

// Update employee
async function updateEmployee() {
  if (!validateForm(false)) return;

  const employeeId = elements.employeeId.value;
  if (!employeeId) {
    showNotification("Pilih karyawan yang akan diperbarui.", "error");
    return;
  }

  const formData = {
    name: elements.fieldNama.value.trim(),
    username: elements.fieldUsername.value.trim(),
    role: elements.fieldRole.value,
    email: elements.fieldEmail.value.trim(),
  };

  // Include password only if it's changed
  if (elements.fieldPassword.value.trim() !== "") {
    formData.password = elements.fieldPassword.value;
  }

  try {
    const response = await fetch(`/api/karyawan/${employeeId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    const result = await response.json();

    if (result.status) {
      showNotification("Data karyawan berhasil diperbarui.", "success");
      clearForm();
      await loadEmployees();
    } else {
      showNotification(result.error || "Gagal memperbarui data.", "error");
    }
  } catch (error) {
    showNotification("Gagal memperbarui data.", "error");
  }
}

// Delete employee
async function deleteEmployee(id) {
  try {
    const response = await fetch(`/api/karyawan/${id}`, {
      method: "DELETE",
    });

    const result = await response.json();

    if (result.status) {
      showNotification("Data karyawan berhasil dihapus.", "success");

      // Remove from allEmployees array
      allEmployees = allEmployees.filter((emp) => emp._id !== id);

      // Reload employees
      await loadEmployees();
    } else {
      showNotification(result.error || "Gagal menghapus data.", "error");
    }
  } catch (error) {
    showNotification("Gagal menghapus data.", "error");
  }
}

// Edit employee
function editEmployee(id) {
  if (userRole === "STAFF") {
    showNotification(
      "Staff tidak memiliki akses untuk mengedit data.",
      "error"
    );
    return;
  }

  const employee = allEmployees.find((emp) => emp._id === id);
  if (!employee) {
    showNotification("Data karyawan tidak ditemukan.", "error");
    return;
  }

  // Populate form fields
  elements.employeeId.value = employee._id;
  elements.fieldNama.value = employee.name || "";
  elements.fieldUsername.value = employee.username || "";
  elements.fieldEmail.value = employee.email || "";
  elements.fieldRole.value = employee.role || "";

  // Update password field for edit mode
  elements.fieldPassword.value = "";
  elements.fieldPassword.placeholder =
    "Kosongkan jika tidak ingin mengubah password";
  elements.passwordHint.textContent =
    "Kosongkan jika tidak ingin mengubah password";

  // Switch to update mode
  elements.btnSaveEmployee.classList.add("hidden");
  elements.btnUpdateEmployee.classList.remove("hidden");
  elements.editModeIndicator.classList.remove("hidden");

  // Scroll to form
  document.querySelector("#btnUpdateEmployee").scrollIntoView({
    behavior: "smooth",
    block: "nearest",
  });

  showNotification(`Mode edit aktif untuk karyawan: ${employee.name}`, "info");
}

// Confirm delete
function confirmDelete(id, employeeName) {
  if (userRole === "STAFF") {
    showNotification(
      "Staff tidak memiliki akses untuk menghapus data.",
      "error"
    );
    return;
  }

  deleteEmployeeId = id;
  elements.deleteModalMessage.textContent = `Apakah Anda yakin ingin menghapus karyawan "${employeeName}"?`;
  elements.deleteModal.classList.remove("hidden");
}

// Validate form
function validateForm(isNew = true) {
  let isValid = true;

  // Clear previous errors
  document.querySelectorAll('[id$="Error"]').forEach((el) => {
    el.classList.add("hidden");
  });

  // Validate name
  if (!elements.fieldNama.value.trim()) {
    document.getElementById("nameError").classList.remove("hidden");
    isValid = false;
  }

  // Validate username
  if (!elements.fieldUsername.value.trim()) {
    document.getElementById("usernameError").classList.remove("hidden");
    isValid = false;
  }

  // Validate email
  if (!elements.fieldEmail.value.trim()) {
    document.getElementById("emailError").classList.remove("hidden");
    isValid = false;
  }

  // Validate password (only for new employees)
  if (isNew && !elements.fieldPassword.value.trim()) {
    document.getElementById("passwordError").classList.remove("hidden");
    isValid = false;
  }

  // Validate role
  if (!elements.fieldRole.value) {
    document.getElementById("roleError").classList.remove("hidden");
    isValid = false;
  }

  return isValid;
}

// Clear form
function clearForm() {
  // Clear form values
  elements.employeeId.value = "";
  elements.fieldNama.value = "";
  elements.fieldUsername.value = "";
  elements.fieldEmail.value = "";
  elements.fieldPassword.value = "";
  elements.fieldRole.value = "";

  // Reset password field
  elements.fieldPassword.placeholder = "Masukkan password baru";
  elements.passwordHint.textContent = "Masukkan password baru";

  // Switch to save mode
  elements.btnSaveEmployee.classList.remove("hidden");
  elements.btnUpdateEmployee.classList.add("hidden");
  elements.editModeIndicator.classList.add("hidden");

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
  loadEmployees();

  // Setup search
  elements.searchBox.addEventListener("input", function () {
    const searchTerm = this.value.toLowerCase().trim();
    const rows = elements.employeeTableBody.querySelectorAll("tr");
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

  // Setup form buttons
  elements.btnSaveEmployee.addEventListener("click", saveEmployee);
  elements.btnUpdateEmployee.addEventListener("click", updateEmployee);
  elements.btnClearForm.addEventListener("click", clearForm);

  // Setup delete modal
  elements.confirmDeleteBtn.addEventListener("click", function () {
    if (deleteEmployeeId) {
      deleteEmployee(deleteEmployeeId);
      elements.deleteModal.classList.add("hidden");
      deleteEmployeeId = null;
    }
  });

  elements.cancelDeleteBtn.addEventListener("click", function () {
    elements.deleteModal.classList.add("hidden");
    deleteEmployeeId = null;
  });

  // Close delete modal on background click
  elements.deleteModal.addEventListener("click", function (e) {
    if (e.target === this) {
      this.classList.add("hidden");
      deleteEmployeeId = null;
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
    elements.fieldNama.disabled = true;
    elements.fieldUsername.disabled = true;
    elements.fieldEmail.disabled = true;
    elements.fieldPassword.disabled = true;
    elements.fieldRole.disabled = true;
    elements.btnSaveEmployee.disabled = true;
    elements.btnClearForm.disabled = true;
    document.querySelector(".password-toggle").style.display = "none";

    showNotification(
      "Mode Staff Aktif — hanya dapat melihat data karyawan.",
      "info"
    );
  }
});
