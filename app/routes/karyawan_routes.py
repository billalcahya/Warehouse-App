"""
karyawan_bp.py
=====================================================
Modul Manajemen Karyawan untuk Aplikasi Flask
=====================================================

Deskripsi Umum
-----------------------------------------------------
Mengatur proses CRUD (Create, Read, Update, Delete)
untuk data karyawan dalam sistem.

Fitur Utama:
- Pengambilan data karyawan.
- Penambahan data karyawan baru.
- Pembaruan dan penghapusan karyawan.

=====================================================
Keamanan:
-----------------------------------------------------
- Hanya pengguna login yang dapat mengakses data.
- Hanya admin yang dapat menambah, mengubah, dan menghapus karyawan.

=====================================================
Validasi & Sanitasi:
-----------------------------------------------------
- Setiap input disanitasi untuk menghindari injeksi kode / XSS.
- Password disimpan menggunakan hashing (secure).

=====================================================
Koleksi MongoDB:
-----------------------------------------------------
- master_karyawan
  Berisi: name, username, role, password_hash, timestamps

=====================================================
"""  

from flask import Blueprint, request, session, current_app, render_template
from datetime import datetime
from bson import ObjectId
from werkzeug.security import generate_password_hash
from app.routes.auth_routes import check_login, check_admin
from app.utils.validators import sanitize, response


# =====================================================
# Inisialisasi Blueprint
# =====================================================

karyawan_bp = Blueprint("karyawan_bp", __name__)


# =====================================================
# ROUTES: HALAMAN UTAMA
# =====================================================

@karyawan_bp.route("/karyawan")
def karyawan_page():
    """
    Tampilkan halaman utama Karyawan.

    Returns:
        HTML template karyawan.html
    """
    auth = check_login()
    if auth:
        return auth

    return render_template(
        "karyawan.html",
        username=session.get("username"),
        role=session.get("role"),
    )


# =====================================================
# ROUTES: DATA KARYAWAN
# =====================================================

@karyawan_bp.route("/api/karyawan", methods=["GET"])
def get_all_karyawan():
    """
    Mengambil seluruh data karyawan dari koleksi `master_karyawan`.

    Endpoint ini digunakan untuk menampilkan daftar karyawan,  
    termasuk nama, email, jabatan, dan metadata lain,  
    tetapi **tidak menampilkan password hash**.

    Returns:
    Response: 
        "status": true,
            "message": "Data berhasil diambil",
    """
    auth = check_login(api=True)
    if auth:
        return auth

    db = current_app.db
    try:
        result = list(db["master_karyawan"].find({}, {"password": 0}))  
        for item in result:
            item["_id"] = str(item["_id"])
            if isinstance(item.get("created_at"), datetime):
                item["created_at"] = item["created_at"].strftime("%Y-%m-%d %H:%M:%S")
        return response(True, "Data berhasil diambil", result, 200)

    except Exception as e:
        return response(False, "Gagal mengambil data karyawan", {"detail": str(e)}, 500)


# =====================================================
# ROUTES: TAMBAH DATA KARYAWAN 
# =====================================================

@karyawan_bp.route("/api/karyawan", methods=["POST"])
def save_karyawan():
    """
    Tambahkan atau perbarui data karyawan di sistem.

    Endpoint ini menangani dua kondisi:

    1. **Update karyawan**  
    - Jika `_id` ada pada payload → data karyawan akan diperbarui.
    - Mengubah nama, username, role, dan password (jika diberikan).
    - Menyimpan timestamp `updated_at` dan `created_by`.

    2. **Tambah karyawan baru**  
    - Jika `_id` tidak ada → membuat data karyawan baru.
    - Username harus unik.
    - Menyimpan timestamp `created_at`, `updated_at`, dan `created_by`.
    - Password akan di-hash sebelum disimpan.

    Validasi yang dilakukan:
    - `name`, `username`, dan `role` wajib diisi.
    - Username harus unik saat membuat data baru.
    - Payload JSON wajib ada.

    Args:
        _id (str, optional)       : ID karyawan (untuk update).
        name (str)                 : Nama karyawan.
        username (str)             : Username login karyawan.
        role (str)                 : Role karyawan (ADMIN / USER / dll).
        password (str, optional)   : Password karyawan (jika ingin diubah atau baru).

    Returns:
        Response: 
        "status": true,
            "message": "Karyawan baru ditambahkan." / "Data karyawan diperbarui."
        "status": false,
            "message": "Nama, username, dan role wajib diisi." / "Username sudah digunakan." / "Gagal menyimpan data"
    """
    auth = check_admin(api=True)
    if auth:
        return auth

    db = current_app.db
    data = request.get_json(force=True, silent=True)

    if not data:
        return response(False, "Payload JSON diperlukan", code=400)

    name = sanitize(data.get("name"))
    username = sanitize(data.get("username"))
    role = sanitize(data.get("role"))
    email = sanitize(data.get("email"))
    password = data.get("password")

    if not all([name, username, role, email]):
        return response(False, "Nama, username, dan role wajib diisi", code=400)

    if not data.get("_id") and db["master_karyawan"].find_one({"username": username}):
        return response(False, "Username sudah digunakan", code=400)

    payload = {
        "name": name,
        "username": username,
        "role": role.upper(),
        "email" : email,
        "updated_at": datetime.now(),
        "created_by": session.get("username", "system"),
    }

    if password:
        payload["password"] = generate_password_hash(password)

    try:
        if data.get("_id"):
            _id = ObjectId(data["_id"])
            db["master_karyawan"].update_one({"_id": _id}, {"$set": payload})
            return response(True, "Data karyawan diperbarui", code=200)

        else:
            payload["created_at"] = datetime.now()
            db["master_karyawan"].insert_one(payload)
            return response(True, "Karyawan baru ditambahkan", code=201)

    except Exception as e:
        return response(False, "Gagal menyimpan data", {"detail": str(e)}, 500)


# =====================================================
# ROUTES: PERBARUI DATA KARYAWAN (PUT)
# =====================================================

@karyawan_bp.route("/api/karyawan/<id>", methods=["PUT"])
def update_karyawan(id):
    """
    Perbarui data karyawan berdasarkan _id.

    Endpoint ini digunakan untuk mengubah informasi karyawan yang sudah ada.
    Password hanya akan diperbarui jika diisi pada payload.

    Validasi yang dilakukan:
    - ID karyawan harus valid.
    - Payload JSON wajib ada.
    - `name`, `username`, dan `role` wajib diisi.
    - Password hanya diupdate jika field diisi.

    Args:
        id (str)                : ID karyawan (_id di database).
        name (str)              : Nama karyawan.
        username (str)          : Username login karyawan.
        role (str)              : Role karyawan (ADMIN / USER / dll).
        password (str, optional): Password baru (opsional).

    Returns:
        Response:
        "status": true,
            "message": "Data karyawan berhasil diperbarui."
        "status": false,
            "message": "ID tidak valid." / "Payload JSON diperlukan." / 
                    "Nama, username, dan role wajib diisi." / 
                    "Karyawan tidak ditemukan." / "Gagal memperbarui data."
    """
    auth = check_admin(api=True)
    if auth:
        return auth

    db = current_app.db
    try:
        _id = ObjectId(id)
    except Exception:
        return response(False, "ID tidak valid", code=400)

    data = request.get_json(force=True, silent=True)
    if not data:
        return response(False, "Payload JSON diperlukan", code=400)

    name = sanitize(data.get("name"))
    username = sanitize(data.get("username"))
    role = sanitize(data.get("role"))
    email = sanitize(data.get("email"))
    password = data.get("password")

    if not all([name, username, role, email]):
        return response(False, "Nama, username, email, dan role wajib diisi", code=400)

    payload = {
        "name": name,
        "username": username,
        "role": role.upper(),
        "email": email,
        "updated_at": datetime.now(),
    }

    if password and password.strip():
        payload["password"] = generate_password_hash(password)

    try:
        result = db["master_karyawan"].update_one({"_id": _id}, {"$set": payload})
        if result.matched_count == 0:
            return response(False, "Karyawan tidak ditemukan", code=404)
        return response(True, "Data karyawan berhasil diperbarui", code=200)

    except Exception as e:
        return response(False, "Gagal memperbarui data", {"detail": str(e)}, 500)


# =====================================================
# ROUTES: HAPUS DATA KARYAWAN
# =====================================================

@karyawan_bp.route("/api/karyawan/<id>", methods=["DELETE"])
def delete_karyawan(id):
    """
    Hapus karyawan dari sistem.

    Aturan:
    1. Hanya admin yang dapat menghapus karyawan.
    2. ID karyawan harus valid.
    3. Karyawan harus ada di database agar dapat dihapus.

    Validasi yang dilakukan:
    - ID karyawan harus berupa ObjectId valid.
    - Karyawan harus ada di database.

    Args:
        id (str): ID karyawan.

    Returns:
        Response:
        "status": true,
            "message": "Data karyawan berhasil dihapus"
        "status": false,
            "message": "Data tidak ditemukan"
        "status": false,
            "message": "Gagal menghapus data"
    """
    auth = check_admin(api=True)
    if auth:
        return auth

    db = current_app.db

    try:
        _id = ObjectId(id)
    except Exception:
        return response(False, "ID tidak valid", code=400)

    try:
        result = db["master_karyawan"].delete_one({"_id": _id})
        if result.deleted_count == 0:
            return response(False, "Data tidak ditemukan", code=404)
        
        return response(True, "Data karyawan berhasil dihapus", code=200)
    
    except Exception as e:
        return response(False, "Gagal menghapus data", {"detail": str(e)}, 500)

