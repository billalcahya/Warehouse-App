"""
product_routes.py
=====================================================
Modul Manajemen Data Produk (Master Product)
=====================================================

Deskripsi Umum
-----------------------------------------------------
Modul ini mengelola proses CRUD (Create, Read, Update, Delete)
untuk data master produk dalam aplikasi inventaris gudang.

Fitur Utama:
- Mengambil daftar seluruh produk.
- Mengambil detail produk berdasarkan SKU.
- Memperbarui data produk (khusus admin).
- Menghapus produk (khusus admin).
- Membuat SKU produk baru secara otomatis.
- Validasi format SKU dan sanitasi input.

=====================================================
Keamanan:
-----------------------------------------------------
- Semua endpoint API memakai middleware autentikasi.
- Hanya pengguna login yang boleh mengakses data.
- Operasi sensitif (update & delete) hanya bisa dilakukan admin.

=====================================================
Validasi:
-----------------------------------------------------
- Semua data yang masuk divalidasi dan disanitasi.
- Mencegah XSS dengan sanitasi input.
- Memastikan stok dan harga adalah angka valid.
- SKU harus mengikuti format 'SKU-XXX'.

=====================================================
Koleksi MongoDB yang Digunakan
-----------------------------------------------------
- master_product : Menyimpan data produk (SKU, nama, kategori, stok,
                   harga beli, harga jual, stok minimum, timestamp)

=====================================================
"""

from flask import Blueprint, request, jsonify, session, current_app, render_template
from pymongo import ASCENDING
from datetime import datetime
from app.utils import SessionManager
import re
from app.routes.auth_routes import check_admin, check_login
from app.utils.validators import sanitize, to_int, parse_float,response


# =====================================================
# Inisialisasi Blueprint
# =====================================================

product_bp = Blueprint("product_bp", __name__)
sm = SessionManager()


def validate_sku(product_id):
    """
    Validasi format SKU harus 'SKU-XXX'.
    """
    if not re.match(r"^SKU-\d{3}$", product_id):
        return response(False, "Format Kode SKU tidak valid", code=400)
    return None


# =====================================================
# ROUTES: HALAMAN UTAMA
# =====================================================

@product_bp.route("/dashboard")
def index():
    """
    Render halaman dashboard produk.

    Returns:
        Response: Halaman HTML dashboard atau redirect login.
    """
    auth = check_login()
    if auth:
        return auth
    return render_template(
        "dashboard_product.html",
        username=session["username"],
        role=session["role"]
    )


# =====================================================
# ROUTES: AMBIL SEMUA DATA
# =====================================================

@product_bp.route("/api/products", methods=["GET"])
def get_all_products():
    """
    Ambil seluruh data produk dari koleksi `master_product`.

    Endpoint ini digunakan untuk menampilkan daftar semua produk,
    termasuk SKU, nama, kategori, stok, harga beli, dan harga jual.
    Data dapat difilter berdasarkan store_id jika diperlukan.

    Args:
        store_id (str, optional) : ID toko untuk memfilter produk tertentu.

    Returns:
       "status": true,
            "message": "Data produk berhasil diambil."
    """
    auth = check_login(api=True)
    if auth:
        return auth

    db = current_app.db
    store_id = request.args.get("store_id")
    query = {}
    if store_id:
        query["store_id"] = store_id

    products = list(db["master_product"].find(query).sort("_id", ASCENDING)) or []
    for p in products:
        p["_id"] = str(p["_id"])

    return response(True, "Data produk berhasil diambil.", products)


# =====================================================
# ROUTES: AMBIL SEMUA DATA SESUAI ID
# =====================================================

@product_bp.route("/api/products/<product_id>", methods=["GET"])
def get_product(product_id):
    """
    Ambil detail produk dari koleksi `master_product` berdasarkan SKU.
    Endpoint ini digunakan untuk menampilkan informasi lengkap satu produk,
    termasuk nama, kategori, stok, harga beli, dan harga jual.

    Args:
        product_id (str) : SKU produk yang ingin diambil.

    Returns:
        "status": true,
            "message": "Data produk ditemukan.",
    """
    auth = check_login(api=True)
    if auth:
        return auth

    error = validate_sku(product_id)
    if error:
        return error

    product = current_app.db["master_product"].find_one({"_id": product_id})
    if not product:
        return response(False, "Produk tidak ditemukan.", code=404)

    product["_id"] = str(product["_id"])
    return response(True, "Data produk ditemukan.", product)


# =====================================================
# ROUTES: UPDATE PRODUK SESUAI ID
# =====================================================

@product_bp.route("/api/products/<product_id>", methods=["PUT"])
def update_product(product_id):
    """
    Update data produk di koleksi `master_product` berdasarkan SKU.
    Endpoint ini digunakan untuk memperbarui informasi produk, termasuk nama,
    kategori, stok, harga beli, dan harga jual.

    Validasi yang dilakukan:
    - `stock` dan `min_stock` tidak boleh negatif.
    - Produk harus ada di database.
    - Hanya admin yang dapat mengubah data.

    Args:
        product_id (str) : SKU produk yang ingin diperbarui.
        name (str)       : Nama produk baru.
        category (str)   : Kategori produk baru.
        stock (int)      : Jumlah stok saat ini.
        min_stock (int)  : Batas minimum stok.
        purchase_price (float) : Harga beli per unit.
        sale_price (float)     : Harga jual per unit.

    Returns:
        "status": true,
            "message": "Produk berhasil diperbarui.",
    """
    try:
        auth = check_admin()
        if auth:
            return auth

        error = validate_sku(product_id)
        if error:
            return error
        data = request.get_json()

        try:
            name = sanitize(data.get("name", ""))
            category = sanitize(data.get("category", ""))
            stock = to_int(data.get("stock", 0), "stok")
            min_stock = to_int(data.get("min_stock", 0), "stok minimum")
            purchase_price = parse_float(data.get("purchase_price", 0), "harga beli")
            sale_price = to_int(data.get("sale_price", 0), "harga jual")
        except ValueError as e:
            return response(False, str(e), 400)

        if stock < 0:
            return response(False, "Stok tidak boleh negatif.", 400)
        if min_stock < 0:
            return response(False, "Stok minimum tidak boleh negatif.", 400)

        update_data = {
            "name": name,
            "category": category,
            "stock": stock,
            "min_stock": min_stock,
            "purchase_price": purchase_price,
            "sale_price": sale_price,
            "updated_at": datetime.now()
        }

        db = current_app.db
        result = db["master_product"].update_one({"_id": product_id}, {"$set": update_data})

        if result.matched_count == 0:
            return response(False, "Produk tidak ditemukan.", 404)

        return response(True, "Produk berhasil diperbarui.", update_data, 200)

    except Exception as e:
        current_app.logger.error(f"[ERROR] update_product: {e}")
        return response(False, f"Terjadi kesalahan pada server: {str(e)}", 500)


# =====================================================
# ROUTES: HAPUS DATA SESUAI ID
# =====================================================

@product_bp.route("/api/products/<product_id>", methods=["DELETE"])
def delete_product(product_id):
    """
    Hapus produk dari koleksi `master_product` berdasarkan SKU.
    Endpoint ini digunakan untuk menghapus satu produk.  
    Hanya admin yang dapat melakukan penghapusan.

    Validasi yang dilakukan:
    - Produk harus ada di database.
    - SKU harus valid.

    Args:
        product_id (str) : SKU produk yang akan dihapus.

    Returns:
        "status": true,
            "message": "Produk dengan ID <SKU> berhasil dihapus."
    """
    try:
        auth = check_admin()
        if auth:
            return auth
        
        error = validate_sku(product_id)
        if error:
            return error

        db = current_app.db
        result = db["master_product"].delete_one({"_id": product_id})

        if result.deleted_count == 0:
            return response(False, "Produk tidak ditemukan.", 404)

        ## db["inventory_in"].delete_many({"product_sku": product_id})
        
        return response(True, f"Produk dengan ID {product_id} berhasil dihapus.", 200)

    except Exception as e:
        current_app.logger.error(f"[ERROR] delete_product: {e}")
        return response(False, f"Terjadi kesalahan pada server: {str(e)}", 500)


