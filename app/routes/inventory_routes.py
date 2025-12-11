"""
inventory_routes.py
=====================================================
Modul Manajemen Stok & Barang Masuk untuk Aplikasi Flask
=====================================================

Deskripsi Umum
-----------------------------------------------------
Modul ini menangani seluruh proses pengelolaan stok dan
barang masuk dalam sistem inventaris gudang multi-toko.

Fitur Utama:
- Pengambilan data produk, toko, dan transaksi barang masuk.
- Penambahan transaksi barang masuk baru.
- Pembaruan dan penghapusan transaksi barang masuk.
- Sinkronisasi otomatis stok produk di setiap transaksi.

=====================================================
Keamanan
-----------------------------------------------------
- Setiap endpoint wajib login (`check_login`).
- Aksi tambah, ubah, dan hapus hanya boleh dilakukan oleh admin (`check_admin`).
- Seluruh data disanitasi dari karakter berbahaya untuk mencegah XSS.

=====================================================
Validasi
-----------------------------------------------------
- Field wajib (`store_id`, `name`, `supplier`, dll) harus terisi.
- Angka (`jumlah`, `harga`, `stok`) harus bertipe numerik dan logis (tidak negatif).
- SKU produk dibuat otomatis dan unik.
- Sistem melakukan validasi stok logis (tidak bisa negatif).

=====================================================
Koleksi MongoDB yang Digunakan
-----------------------------------------------------
- master_product   : Data produk (SKU, nama, stok, harga, lokasi)
- master_supplier  : Transaksi barang masuk (riwayat supplier)
- master_store     : Data toko tujuan

=====================================================
"""

from flask import Blueprint, request, jsonify, session, current_app, render_template
from datetime import datetime
import re
from bson import ObjectId
from bson.errors import InvalidId
from pymongo import DESCENDING
from app.routes.auth_routes import check_admin, check_login
from app.utils.validators import sanitize, to_int, parse_float, response


# =====================================================
# Inisialisasi Blueprint
# =====================================================

inventory_bp = Blueprint("inventory_bp", __name__)


def generate_sku(db):
    """
    Generate SKU baru unik dalam format SKU-001, SKU-0100, SKU-10000, dst.
    Mendukung jumlah produk di atas 999 tanpa masalah.
    """
    last_product = db["master_product"].find_one(
        {"_id": {"$regex": r"^SKU-\d+$"}},
        sort=[("_id", DESCENDING)]
    )

    if last_product:
        num_part = last_product["_id"].split("-")[1]

        try:
            last_num = int(num_part)
        except:
            last_num = 0
    else:
        last_num = 0

    new_num = last_num + 1
    new_sku = f"SKU-{new_num:03d}"

    while db["master_product"].find_one({"_id": new_sku}):
        new_num += 1
        new_sku = f"SKU-{new_num:03d}"

    return new_sku


# =====================================================
# ROUTES: HALAMAN UTAMA
# =====================================================

@inventory_bp.route("/inventory")
def inventory_page():
    """
    Render halaman utama Inventory Management.

    Returns:
        Response: Halaman HTML Inventory atau redirect ke login.
    """
    auth = check_login()
    if auth:
        return auth
    return render_template(
        "inventory.html",
        username=session["username"],
        role=session.get("role")
    )


# =====================================================
# ROUTES: DATA TRANSAKSI BARANG MASUK
# =====================================================

@inventory_bp.route("/api/product_masuk", methods=["GET"])
def get_product_masuk():
    """
    Mengambil seluruh data transaksi barang masuk dari koleksi `master_supplier`.

    Endpoint ini digunakan untuk menampilkan daftar transaksi barang masuk,
    seperti nama produk, pemasok, jumlah, dan tanggal transaksi.  
    Data dapat difilter berdasarkan store_id, nama produk, atau nama supplier.

    Args:
        store_id (str) : ID toko 
        name (str) : Nama produk. 
        supplier (str) : Nama pemasok.
    
    Returns:
        Response: JSON daftar transaksi produk masuk.
    """
    auth = check_login(api=True)
    if auth:
        return auth

    db = current_app.db
    try:
        store_id = request.args.get("store_id")
        name = request.args.get("name")
        supplier = request.args.get("supplier")

        query = {}
        if store_id:
            query["store_id"] = store_id
        if name:
            query["name"] = {"$regex": name, "$options": "i"}
        if supplier:
            query["supplier"] = {"$regex": supplier, "$options": "i"}

        data = list(db["master_supplier"].find(query).sort("tanggal", -1))

        for d in data:
            d["_id"] = str(d["_id"])
            if isinstance(d.get("tanggal"), datetime):
                d["tanggal"] = d["tanggal"].strftime("%Y-%m-%d %H:%M:%S")

        return response(True, "Data berhasil diambil.", data)

    except Exception as e:
        return response(False, "Gagal mengambil data transaksi.", {"error": str(e)}, 500)


# =====================================================
# ROUTES: DATA PRODUK UNTUK DROPDOWN
# =====================================================

@inventory_bp.route("/api/products/dropdown", methods=["GET"])
def get_products_dropdown():
    """
    Mengambil daftar produk dari koleksi `master_product` untuk kebutuhan dropdown.

    Endpoint ini digunakan saat memilih produk di form transaksi barang masuk,
    stock adjustment, atau modul lain yang membutuhkan daftar produk ringkas.
    Data yang dikembalikan hanya field penting seperti SKU, nama, stok, dan harga beli.

    Returns:
        Response: JSON daftar produk masuk dengan isi sku,name,stock,purchase_price.
    """
    auth = check_login(api=True)
    if auth:
        return auth

    db = current_app.db
    try:
        products = list(
            db["master_product"].find(
                {}, {"_id": 1, "name": 1, "stock": 1, "purchase_price": 1, "store_id": 1, "store_name": 1, "city": 1, }
            )
        )
        result = [
            {
                "sku": str(p["_id"]),
                "name": p.get("name", ""),
                "stock": p.get("stock", 0),
                "purchase_price": p.get("purchase_price", 0),
                "store_id": p.get("store_id", ""),
                "store_name": p.get("store_name", ""),
                "city": p.get("city", ""),
            }
            for p in products
        ]
        return response(True, "Data produk untuk dropdown berhasil diambil.", result)

    except Exception as e:
        return response(False, "Gagal mengambil data dropdown.", {"error": str(e)}, 500)


# =====================================================
# ROUTES: TAMBAH TRANSAKSI BARANG MASUK
# =====================================================

@inventory_bp.route("/api/product_masuk", methods=["POST"])
def add_product_masuk():
    """
     Tambahkan transaksi barang masuk baru ke sistem inventaris.

    Endpoint ini menangani dua kondisi:
    
    1. **Produk sudah ada**  
       - Menambah stok sesuai jumlah yang dikirim.  
       - Mengupdate harga beli dan nama supplier.  
       - Mencatat riwayat transaksi ke koleksi `master_supplier`.

    2. **Produk belum ada**  
       - Membuat produk baru di koleksi `master_product`.  
       - Mengisi stok awal sesuai jumlah barang masuk.  
       - Menyimpan metadata toko dan lokasi.  
       - Menambah catatan transaksi ke `master_supplier`.

    Validasi yang dilakukan:
    - `store_id`, `name`, dan `supplier` wajib diisi.
    - Field jumlah harus lebih dari 0.
    - Store harus valid dan dalam kondisi aktif.
    - Nama produk dibandingkan menggunakan pencarian regex case-insensitive.

    Args:
        store_id (str)      : ID toko asal barang.
        name (str)          : Nama produk.
        supplier (str)      : Nama atau kode pemasok.
        jumlah (int)        : Jumlah barang masuk.
        purchase_price (float) : Harga beli per unit.
        notes (str)         : Catatan tambahan (opsional).

    Returns:
        Response: 
        "status": true,
            "message": "Produk baru 'Pensil 2B' berhasil ditambahkan.",
        "status": false,
            "message": "Field wajib tidak boleh kosong"
    """
    auth = check_admin(api=True)
    if auth:
        return auth

    db = current_app.db
    data = request.get_json(force=True, silent=True)
    if not data:
        return response(False, "Payload JSON diperlukan", code=400)

    store_id = sanitize(data.get("store_id", ""))
    name = sanitize(data.get("name", ""))
    supplier = sanitize(data.get("supplier", ""))
    jumlah = to_int(data.get("jumlah", 0), "jumlah")
    notes = sanitize(data.get("notes", ""))
    purchase_price = parse_float(data.get("purchase_price", 0.0))

    if not all([store_id, name, supplier]):
        return response(False, "Field wajib tidak boleh kosong", code=400)
    if jumlah <= 0:
        return response(False, "Jumlah harus lebih dari 0", code=400)

    store = db["master_store"].find_one({"_id": store_id, "is_active": True})
    if not store:
        return response(False, f"Toko '{store_id}' tidak ditemukan", code=400)

    try:
        existing = db["master_product"].find_one(
            {"name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}, "store_id": store_id}
        )
        
        if existing:
            sku = existing["_id"]
            stock_before = int(existing.get("stock", 0))
            stock_after = stock_before + jumlah

            db["master_product"].update_one(
                {"_id": sku},
                {
                    "$inc": {"stock": jumlah},
                    "$set": {"purchase_price": purchase_price, "supplier": supplier, "updated_at": datetime.now()},
                },
            )
            action_type = "restock"
            message = f"Stok produk '{name}' ditambah {jumlah} unit."
            
        else:
            sku = generate_sku(db)
            new_product = {
                "_id": sku,
                "name": name,
                "category": "Lainnya",
                "stock": jumlah,
                "min_stock": 5,
                "purchase_price": purchase_price,
                "sale_price": 0,
                "supplier": supplier,
                "store_id": store["_id"],
                "store_name": store["name"],
                "city": store.get("city", ""),
                "location": "Gudang Utama",
                "created_at": datetime.now(),
            }
            db["master_product"].insert_one(new_product)
            stock_before = 0
            stock_after = jumlah
            action_type = "new_product"
            message = f"Produk baru '{name}' berhasil ditambahkan."

        db["master_supplier"].insert_one({
            "_id": ObjectId(),
            "product_sku": sku,
            "name": name,
            "supplier": supplier,
            "jumlah": jumlah,
            "notes": notes,
            "tanggal": datetime.now(),
            "purchase_price": purchase_price,
            "store_id": store["_id"],
            "store_name": store["name"],
            "city": store.get("city", ""),
            "stock_before": stock_before,
            "stock_after": stock_after,
            "location": "Gudang Utama",
            "type": action_type,
        })
        
        return response(True, message, {"sku": sku,"stock_before": stock_before,"stock_after": stock_after,}, 201)
    
    except Exception as e:
       return response(False, "Gagal menambah data produk masuk", {"detail": str(e)}, 500 )


# =====================================================
# ROUTES: PERBARUI TRANSAKSI BARANG MASUK (PUT)
# =====================================================

@inventory_bp.route("/api/product_masuk/<id>", methods=["PUT"])
def update_product_masuk(id):
    """
    Memperbarui data transaksi barang masuk dan stok produk terkait.
    Endpoint ini digunakan untuk mengubah transaksi barang masuk yang sudah tercatat.  
    Aturan update:

    - Hanya admin yang dapat melakukan perubahan.
    - Jika jumlah barang diubah, stok produk di master_product akan otomatis disesuaikan.

    Validasi yang dilakukan:
    - `jumlah` harus lebih dari 0.
    - Stock produk tidak boleh menjadi negatif.
    - Transaksi dan produk harus ada di database.
    - ID transaksi harus valid.

    Args:
        id (str)                : ID transaksi barang masuk.
        jumlah (int, optional)  : Jumlah barang masuk baru.
        supplier (str, optional): Nama supplier baru.
        notes (str, optional)   : Catatan baru.
        purchase_price (float, optional) : Harga beli baru.
    
    Returns:
    "status": true,
            "message": "Transaksi barang masuk '<sku>' berhasil diperbarui.",
    "status": false,
            "message": "Gagal memperbarui transaksi",
    """
    auth = check_admin(api=True)
    if auth:
        return auth

    db = current_app.db
    data = request.get_json(force=True, silent=True)
    if not data:
        return response(False, "Payload JSON diperlukan", code=400)

    try:
        transaksi = db["master_supplier"].find_one({"_id": ObjectId(id)})
        if not transaksi:
            return response(False, "Transaksi tidak ditemukan", code=404)

        old_jumlah = int(transaksi["jumlah"])
        sku = transaksi["product_sku"]
        product = db["master_product"].find_one({"_id": sku})
        if not product:
            return response(success=False, message=f"Produk dengan SKU '{sku}' tidak ditemukan", code=404)
            
        jumlah_baru = to_int(data.get("jumlah", old_jumlah), "jumlah")
        supplier = sanitize(data.get("supplier", transaksi.get("supplier", "")))
        notes = sanitize(data.get("notes", transaksi.get("notes", "")))
        purchase_price = parse_float(data.get("purchase_price", transaksi.get("purchase_price", 0)))

        if jumlah_baru <= 0:
            return response(False, "Jumlah harus lebih dari 0", code=400)

        selisih = jumlah_baru - old_jumlah
        stok_baru = int(product["stock"]) + selisih
        if stok_baru < 0:
            return response(False, "Stock tidak boleh negatif", code=400)

        db["master_product"].update_one(
            {"_id": sku},
            {
                "$set": {
                    "stock": stok_baru,
                    "purchase_price": purchase_price,
                    "supplier": supplier,
                    "updated_at": datetime.now(),
                }
            },
        )

        db["master_supplier"].update_one(
            {"_id": ObjectId(id)},
            {
                "$set": {
                    "jumlah": jumlah_baru,
                    "supplier": supplier,
                    "purchase_price": purchase_price,
                    "notes": notes,
                    "updated_at": datetime.now(),
                    "stock_after": stok_baru,
                }
            },
        )

        return response(True, f"Transaksi barang masuk '{sku}' berhasil diperbarui.", {"sku": sku, "stock_now": stok_baru}, 200)

    except InvalidId:
        return response(False, "ID tidak valid", code=400)

    except Exception as e:
        return response(False, "Gagal memperbarui transaksi", {"detail": str(e)}, 500)


# =====================================================
# ROUTES: HAPUS TRANSAKSI BARANG MASUK
# =====================================================

@inventory_bp.route("/api/product_masuk/<id>", methods=["DELETE"])
def delete_product_masuk(id):
    """
    Hapus transaksi barang masuk dari sistem inventaris.

    Aturan:
    1. Jika stok produk menjadi 0 setelah transaksi dihapus → produk juga akan dihapus.
    2. Jika stok masih tersisa → hanya stok dikurangi sesuai jumlah transaksi.
    3. Hanya admin yang dapat menghapus transaksi.

    Validasi yang dilakukan:
    - ID transaksi harus valid.
    - Transaksi harus ada di database.
    - Produk terkait harus ada di database.
    - Stok produk tidak boleh negatif.

    Args:
        id (str) : ID transaksi barang masuk.

    Returns:
        "status": true,
            "message": "Transaksi dihapus. Stok produk 'Pensil 2B' kini 10."
        "status": false,
            "message": "Transaksi tidak ditemukan"
    """
    auth = check_admin(api=True)
    if auth:
        return auth

    db = current_app.db
    try:
        transaksi = db["master_supplier"].find_one({"_id": ObjectId(id)})
        if not transaksi:
            return response(False, "Transaksi tidak ditemukan", code=404)

        sku = transaksi["product_sku"]
        jumlah = int(transaksi["jumlah"])
        product = db["master_product"].find_one({"_id": sku})

        if not product:
            return response(False, f"Produk dengan SKU '{sku}' tidak ditemukan", code=404)

        stok_sekarang = int(product.get("stock", 0))
        stok_baru = stok_sekarang - jumlah
        if stok_baru < 0:
            stok_baru = 0 

        db["master_supplier"].delete_one({"_id": ObjectId(id)})

        if stok_baru == 0:
            db["master_product"].delete_one({"_id": sku})
            message = f"Transaksi dihapus dan produk '{product.get('name')}' juga dihapus karena stok habis."
            deleted_product = True
        else:
            db["master_product"].update_one({"_id": sku}, {"$set": {"stock": stok_baru}})
            message = f"Transaksi dihapus. Stok produk '{product.get('name')}' kini {stok_baru}."
            deleted_product = False

        return response(True, message, {"sku": sku, "stock_before": stok_sekarang, "stock_after": stok_baru, "deleted_product": deleted_product}, 200)

    except InvalidId:
        return response(False, "ID tidak valid", code=400)
    
    except Exception as e:
        return response(False, "Gagal menghapus transaksi", {"detail": str(e)}, 500)

@inventory_bp.route("/api/product_masuk/<id>", methods=["GET"])
def get_product_masuk_detail(id):
    """
    Mengambil detail satu transaksi barang masuk berdasarkan ID dokumen master_supplier.
    """
    auth = check_login(api=True)
    if auth:
        return auth

    db = current_app.db
    try:
        transaksi = db["master_supplier"].find_one({"_id": ObjectId(id)})
        if not transaksi:
            return response(False, "Transaksi tidak ditemukan", code=404)

        transaksi["_id"] = str(transaksi["_id"])
        if isinstance(transaksi.get("tanggal"), datetime):
            transaksi["tanggal"] = transaksi["tanggal"].strftime("%Y-%m-%d %H:%M:%S")

        # Biar cocok dengan frontend kamu sekarang (langsung pakai item.xxx)
        from flask import jsonify
        return jsonify(transaksi), 200

    except InvalidId:
        return response(False, "ID tidak valid", code=400)

    except Exception as e:
        return response(False, "Gagal mengambil detail transaksi", {"detail": str(e)}, 500)
