"""
inventory_out_bp.py
=====================================================
Modul Barang Keluar (Inventory Out) untuk Aplikasi Flask
=====================================================

Deskripsi Umum
-----------------------------------------------------
Modul ini mengatur proses barang keluar, termasuk:
Penjualan, Distribusi antar toko, Pemakaian internal, Barang rusak
Barang kadaluarsa

Setiap transaksi barang keluar akan:
- Mencatat transaksi ke `master_supplier_out`.
- Mengurangi stok produk di `master_product`.

=====================================================
Keamanan
-----------------------------------------------------
- Setiap endpoint wajib login (`check_login`).
- Aksi tambah, ubah, dan hapus hanya boleh dilakukan oleh admin (`check_admin`).
- Semua input disanitasi untuk menghindari karakter berbahaya.

=====================================================
Validasi
-----------------------------------------------------
- Field wajib (`product_sku`/`name`, `jumlah`, `type`).
- `jumlah` harus berupa angka > 0.
- Sistem memastikan stok produk tidak menjadi negatif.
- Nama toko otomatis diambil dari `master_store` jika tersedia.

=====================================================
Koleksi MongoDB yang Digunakan
-----------------------------------------------------
- master_product        : Data master produk & stok
- master_supplier_out   : Transaksi barang keluar
- master_store          : Data toko
=====================================================
"""

from flask import Blueprint, request, jsonify, session, current_app, render_template
from datetime import datetime
from bson import ObjectId
import re
from app.routes.auth_routes import check_admin, check_login
from app.utils.validators import sanitize, to_int, parse_float, response


# =====================================================
# Inisialisasi Blueprint
# =====================================================

inventory_out_bp = Blueprint("inventory_out_bp", __name__)


# =====================================================
# ROUTE: Halaman UTAMA
# =====================================================

@inventory_out_bp.route("/inventory_out")
def inventory_page_out():
    """
    Tampilkan halaman utama Inventory Out.

    Returns:
        HTML template inventory_out.html
    """
    auth = check_login()
    if auth:
        return auth

    return render_template(
        "inventory_out.html",
        username=session["username"],
        role=session.get("role")
    )


# =====================================================
# ROUTE: DATA PRODUK UNTUK DROPDOWN BERDASARKAN STORE
# =====================================================

@inventory_out_bp.route("/api/products_keluar/dropdown", methods=["GET"])
def get_all_products_out_dropdown():
    """
    Mengambil daftar produk dari koleksi `master_product` berdasarkan toko.

    Endpoint ini digunakan untuk menampilkan produk yang tersedia untuk modul barang keluar,
    stock adjustment, atau laporan.  
    Jika `store_id` diberikan, data akan difilter sesuai toko.

    Args:
        store_id (str, optional): ID toko untuk filter produk.

    Returns:
        Response: JSON daftar produk:
    """
    auth = check_login(api=True)
    if auth:
        return auth

    db = current_app.db
    store_id = request.args.get("store_id")
    query = {"store_id": store_id} if store_id else {}

    try:
        products = list(db["master_product"].find(
            query, {"_id": 1, "name": 1, "stock": 1, "purchase_price": 1, "store_id": 1, "store_name": 1}
        ))

        result = [
            {
                "sku": p["_id"],
                "name": p.get("name"),
                "stock": p.get("stock", 0),
                "purchase_price": p.get("purchase_price", 0),
                "store_id": p.get("store_id", ""),
                "store_name": p.get("store_name", "")
            }
            for p in products
        ]
        return response(True, "Data produk berhasil diambil.", result, 200)

    except Exception as e:
        return response(False, "Gagal mengambil produk", {"error":str(e)}, code=500)


# =====================================================
# ROUTE: Ambil Data Transaksi Barang Keluar
# =====================================================

@inventory_out_bp.route("/api/products_keluar", methods=["GET"])
def get_inventory_out():
    """
    Mengambil seluruh data transaksi barang keluar dari koleksi `master_supplier_out`.

    Endpoint ini digunakan untuk menampilkan daftar transaksi barang keluar,  
    seperti nama produk, jumlah, tanggal, dan toko terkai

    Returns:
        "status": true,
                "message": "Data berhasil diambil",
    """
    auth = check_login(api=True)
    if auth:
        return auth

    try:
        data = list(current_app.db["master_supplier_out"].find(
            {"type": {"$ne": "restock"}}
        ).sort("_id", -1))

        for d in data:
            d["_id"] = str(d["_id"])
            if isinstance(d.get("tanggal"), datetime):
                d["tanggal"] = d["tanggal"].strftime("%Y-%m-%d %H:%M:%S")

        return response(True, "Data berhasil diambil", data, 200)

    except Exception as e:
        return response(False, "Gagal mengambil data", {"error":str(e)}, code=500)


# =====================================================
# ROUTE: Tambah Transaksi Barang Keluar
# =====================================================

@inventory_out_bp.route("/api/products_keluar", methods=["POST"])
def add_inventory_out():
    """
    Catat transaksi barang keluar baru dan kurangi stok produk.
    Endpoint ini menangani beberapa tipe transaksi barang keluar:

    1. **Penjualan**  
    - Mengurangi stok sesuai jumlah yang dijual.  
    - Mencatat harga jual dan nama pelanggan di `master_supplier_out`.

    2. **Distribusi**  
    - Mengurangi stok sesuai jumlah yang dikirim.  
    - Mencatat informasi tujuan, penerima, dan nomor surat jalan.

    3. **Lainnya**  
    - Mengurangi stok sesuai jumlah.  
    - Menyimpan keterangan tambahan (default: "Barang keluar").

    Validasi yang dilakukan:
    - SKU atau nama produk wajib diisi.
    - Jumlah harus lebih dari 0.
    - Produk harus ada di database.
    - Stok tidak boleh kurang dari jumlah yang dikeluarkan.

    Args:
        product_sku (str, optional)   : SKU produk.
        name (str, optional)          : Nama produk.
        type (str)                    : Jenis transaksi: "penjualan", "distribusi", atau lainnya.
        jumlah (int)                  : Jumlah barang keluar.
        store_id (str, optional)      : ID toko asal barang.
        nama_pelanggan (str, optional): Nama pelanggan (untuk penjualan).
        harga_jual (float, optional)  : Harga jual per unit (untuk penjualan).
        tujuan_pengiriman (str, optional): Alamat tujuan (untuk distribusi).
        nama_penerima (str, optional)    : Nama penerima (untuk distribusi).
        no_surat_jalan (str, optional)   : Nomor surat jalan (untuk distribusi).
        keterangan (str, optional)       : Keterangan tambahan (untuk jenis lainnya).

    Returns:
        Response:
            "status": true,
                "message": "Produk 'Pensil 2B' berhasil dicatat sebagai penjualan."
            "status": false,
                "message": "SKU atau nama produk wajib diisi"
            "status": false,
                "message": "Stok tidak cukup (tersisa 3)"
            "status": false,
                "message": "Produk 'Pensil 2B' tidak ditemukan"
            "status": false,
                "message": "Gagal mencatat barang keluar"
    """
    try:
        auth = check_admin(api=True)
        if auth:
            return auth

        db = current_app.db
        data = request.get_json(force=True)

        sku = sanitize(data.get("product_sku", ""))
        name = sanitize(data.get("name", ""))
        type_tx = sanitize(data.get("type", "")).lower()

        try:
            jumlah = to_int(data.get("jumlah"), "jumlah")
        except ValueError as e:
            return response(False, "Terjadi kesalahan", {"error": str(e)}, 400)

        if not sku and not name:
            return response(False, "SKU atau nama produk wajib diisi", code=400)

        product = (
            db["master_product"].find_one({"_id": sku})
            or db["master_product"].find_one({"product_sku": sku})
            or db["master_product"].find_one({"name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}})
        )

        if not product:
            return response(False, f"Produk '{name or sku}' tidak ditemukan", code=404)
        if product["stock"] < jumlah:
            return response(False, f"Stok tidak cukup (tersisa {product['stock']})", code=400)

        extra_data = {}

        if type_tx == "penjualan":
            harga_jual = parse_float(data.get("harga_jual", 0), "harga jual")

            if harga_jual <= 0:
                return response(False, "Harga jual harus lebih dari 0", code=400)

            total_harga = harga_jual * jumlah

            extra_data = {
                "nama_pelanggan": sanitize(data.get("nama_pelanggan", "")),
                "harga_jual": harga_jual,
                "total_harga": total_harga,
            }

        elif type_tx == "distribusi":
            extra_data = {
                "tujuan_pengiriman": sanitize(data.get("tujuan_pengiriman", "")),
                "nama_penerima": sanitize(data.get("nama_penerima", "")),
                "no_surat_jalan": sanitize(data.get("no_surat_jalan", "")),
            }
        else:
            extra_data = {"keterangan": sanitize(data.get("keterangan", "Barang keluar"))}

        new_stock = product["stock"] - jumlah
        db["master_product"].update_one({"_id": product["_id"]}, {"$set": {"stock": new_stock}})

        store_id = data.get("store_id")
        store_name = ""
        if store_id:
            store_doc = db["master_store"].find_one({"_id": store_id})
            store_name = store_doc.get("name", "") if store_doc else ""

        record = {
            "product_sku": product["_id"],
            "name": product["name"],
            "jumlah": jumlah,
            "type": type_tx,
            "tanggal": datetime.now(),
            "stock_before": product["stock"],
            "stock_after": new_stock,
            "store_id": store_id,
            "store_name": store_name,
            **extra_data,
        }

        db["master_supplier_out"].insert_one(record)

        return response(True, f"{product['name']} berhasil dicatat sebagai {type_tx}.", code=200)

    except Exception as e:
        return response(False, "Gagal mencatat barang keluar", {"detail": str(e)}, 500)


# =====================================================
# ROUTE: Update Transaksi Barang Keluar
# =====================================================

@inventory_out_bp.route("/api/products_keluar/<string:item_id>", methods=["PUT"])
def update_inventory_out(item_id):
    """
    Perbarui transaksi barang keluar dan sesuaikan stok produk terkait.

    Endpoint ini digunakan untuk mengubah transaksi barang keluar yang sudah tercatat.
    Aturan update:
    
    - Hanya admin yang dapat melakukan perubahan.
    - Jika jumlah barang diubah, stok produk di master_product akan otomatis disesuaikan.
    - Field lain seperti type, nama_pelanggan, harga_jual, tujuan_pengiriman, 
      nama_penerima, no_surat_jalan, atau keterangan dapat diperbarui jika disediakan.

    Validasi yang dilakukan:
    - ID transaksi harus valid.
    - Transaksi dan produk terkait harus ada.
    - Stock tidak boleh negatif setelah update.

    Args:
        item_id (str)                : ID transaksi barang keluar.
        jumlah (int, optional)       : Jumlah barang keluar baru.
        type (str, optional)         : Tipe transaksi (penjualan, distribusi, etc.).
        nama_pelanggan (str, optional)
        harga_jual (float, optional)
        tujuan_pengiriman (str, optional)
        nama_penerima (str, optional)
        no_surat_jalan (str, optional)
        keterangan (str, optional)
    
    Returns:
        Response:
        "status": true,
            "message": "Transaksi berhasil diperbarui."
        "status": false,
            "message": "Stok tidak cukup (tersisa 5)" / "Data tidak ditemukan" / dll
    """
    auth = check_admin(api=True)
    if auth:
        return auth

    try:
        db = current_app.db
        data = request.get_json(force=True)

        try:
            oid = ObjectId(item_id)
        except Exception:
            return response(False, "ID tidak valid", code=400)

        record = db["master_supplier_out"].find_one({"_id": oid})
        if not record:
            return response(False, "Data tidak ditemukan", code=404)

        product = db["master_product"].find_one({"_id": record["product_sku"]})
        if not product:
            return response(False, "Produk terkait tidak ditemukan", code=404)

        jumlah_lama = int(record["jumlah"])
        jumlah_baru = int(data.get("jumlah", jumlah_lama))
        selisih = jumlah_baru - jumlah_lama  

        if selisih != 0:
            stock_now = int(product["stock"])
            new_stock = stock_now - selisih
            if new_stock < 0:
                return response(False, f"Stok tidak cukup (tersisa {stock_now})", code=400)

            db["master_product"].update_one(
                {"_id": product["_id"]},
                {"$set": {"stock": new_stock}}
            )
            stock_after = new_stock
        else:
            stock_after = int(product.get("stock", 0))

        type_baru = data.get("type", record.get("type"))
        type_lower = (type_baru or "").lower()

        update_fields = {
            "jumlah": jumlah_baru,
            "type": type_baru,
            "stock_after": stock_after,
            "tanggal": datetime.now()
        }

        for f in [
            "nama_pelanggan",
            "tujuan_pengiriman",
            "nama_penerima",
            "no_surat_jalan",
            "keterangan",
        ]:
            if f in data:
                update_fields[f] = data[f]

        if type_lower == "penjualan":
            raw_harga = data.get("harga_jual", record.get("harga_jual", 0))
            harga_jual = parse_float(raw_harga, "harga jual")

            if harga_jual <= 0:
                return response(False, "Harga jual harus lebih dari 0", code=400)

            total_harga = harga_jual * jumlah_baru

            update_fields["harga_jual"] = harga_jual
            update_fields["total_harga"] = total_harga

        db["master_supplier_out"].update_one(
            {"_id": oid},
            {"$set": update_fields}
        )

        return response(True, "Transaksi berhasil diperbarui", update_fields, 200)

    except Exception as e:
        current_app.logger.error(f"[ERROR] update_inventory_out: {e}")
        return response(False, "Gagal memperbarui transaksi", {"detail": str(e)}, 500)
    

# =====================================================
# ROUTE: Hapus Transaksi Barang Keluar
# =====================================================

@inventory_out_bp.route("/api/products_keluar/<string:item_id>", methods=["DELETE"])
def delete_inventory_out(item_id):
    """
    Hapus transaksi barang keluar dari sistem inventaris.

    Aturan:
    1. Stok produk akan dikembalikan sesuai jumlah transaksi.
    2. Hanya admin yang dapat menghapus transaksi.

    Validasi yang dilakukan:
    - ID transaksi harus valid.
    - Transaksi harus ada di database.
    - Produk terkait harus ada di database.
    - Stok produk dikembalikan setelah transaksi dihapus.

    Args:
        item_id (str) : ID transaksi barang keluar.

    Returns:
        "status": true,
            "message": "Transaksi dihapus dan stok dikembalikan"
        "status": false,
            "message": "ID tidak valid / Data tidak ditemukan / Gagal menghapus transaksi"
    """
    auth = check_admin(api=True)
    if auth:
        return auth

    db = current_app.db

    try:
        try:
            oid = ObjectId(item_id)
        except Exception:
            return response(False, "ID tidak valid", code=400)

        record = db["master_supplier_out"].find_one({"_id": oid})
        if not record:
            return response(False, "Data tidak ditemukan", code=404)

        product_sku = record.get("product_sku")
        jumlah_keluar = int(record.get("jumlah", 0) or 0)

        if product_sku:
            db["master_product"].update_one(
                {"_id": product_sku},
                {"$inc": {"stock": jumlah_keluar}}
            )

        delete_result = db["master_supplier_out"].delete_one({"_id": oid})
        if delete_result.deleted_count == 0:
            return response(False, "Gagal menghapus transaksi", code=500)

        return response(True, "Transaksi dihapus dan stok dikembalikan", code=200)

    except Exception as e:
        return response(False, "Gagal menghapus transaksi", {"detail": str(e)}, 500)
    
# =====================================================
# ROUTE: DETAIL TRANSAKSI BARANG KELUAR (GET BY ID)
# =====================================================

@inventory_out_bp.route("/api/products_keluar/<string:item_id>", methods=["GET"])
def get_inventory_out_detail(item_id):
    """
    Mengambil detail satu transaksi barang keluar berdasarkan ID.
    Endpoint ini DIPERLUKAN oleh tombol Edit & Show di frontend.
    """
    auth = check_login(api=True)
    if auth:
        return auth

    db = current_app.db

    try:
        try:
            oid = ObjectId(item_id)
        except Exception:
            return response(False, "ID tidak valid", code=400)

        record = db["master_supplier_out"].find_one({"_id": oid})
        if not record:
            return response(False, "Data tidak ditemukan", code=404)

        # Convert ke format JSON-friendly
        record["_id"] = str(record["_id"])

        if isinstance(record.get("tanggal"), datetime):
            record["tanggal"] = record["tanggal"].strftime("%Y-%m-%d %H:%M:%S")

        return jsonify(record), 200

    except Exception as e:
        return response(False, "Gagal mengambil detail transaksi", {"detail": str(e)}, 500)
