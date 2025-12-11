"""
sales_routes.py
=====================================================
Modul Transaksi Penjualan Produk untuk Aplikasi Flask
=====================================================

Deskripsi Umum
-----------------------------------------------------
Modul ini menangani seluruh proses transaksi penjualan produk
pada sistem manajemen gudang. Setiap transaksi akan otomatis:

- Mengurangi stok produk dari koleksi master_product.
- Menyimpan data transaksi ke koleksi sales.
- Menyertakan informasi pembeli, produk, jumlah, harga, dan total transaksi.

=====================================================
Keamanan:
-----------------------------------------------------
- Hanya pengguna login yang dapat mengakses data.
- Hanya admin yang dapat menghapus transaksi.
- Semua input divalidasi dan disanitasi.

=====================================================
Validasi
-----------------------------------------------------
- Field wajib (`product_id`, `quantity`, `customer_name`, dll) harus terisi.
- Angka (`quantity`, `sale_price`, `stock`) harus numerik dan logis (tidak negatif).
- Sistem melakukan validasi stok sebelum transaksi dilakukan.
- Transaksi ditolak jika stok tidak mencukupi.
- Semua ID transaksi dan produk harus berupa ObjectId yang valid.
- Sanitasi dilakukan pada seluruh input string (`customer_name`, `notes`).

=====================================================
Koleksi MongoDB yang Digunakan
-----------------------------------------------------
- sales            : Menyimpan data transaksi penjualan.
- master_product   : Menyimpan data produk dan stok barang.

=====================================================
Fitur Utama
-----------------------------------------------------
1. Menambahkan transaksi penjualan baru (stok otomatis berkurang).
2. Menambahkan batch transaksi (POS).
3. Melihat daftar transaksi penjualan.
4. Melihat detail transaksi.
5. Menghapus transaksi (admin-only).
6. Validasi stok agar tidak negatif.
7. Input disanitasi & aman dari XSS.

=====================================================
"""

from flask import Blueprint, request, current_app, session, render_template
from datetime import datetime
from bson import ObjectId
from pymongo import DESCENDING
from app.routes.auth_routes import check_admin, check_login
from app.utils import SessionManager
from app.utils.validators import sanitize, to_int, response

# =====================================================
# Inisialisasi Blueprint
# =====================================================
sales_bp = Blueprint("sales_bp", __name__)
sm = SessionManager()


# =====================================================
# ROUTE: HALAMAN UTAMA
# =====================================================

@sales_bp.route("/dashboard_sales")
def sales_dashboard():
    """
    Render halaman dashboard penjualan (HTML).
    
    Returns:
        Response: Template HTML 'sales.html' atau redirect login.
    """
    auth = check_login()
    if auth:
        return auth
    return render_template(
        "sales.html",
        username=session["username"],
        role=session["role"]
    )




# =====================================================
# ROUTE: DATA SALES
# =====================================================
@sales_bp.route("/api/sales", methods=["GET"])
def get_all_sales():
    """
    Mengambil seluruh data transaksi penjualan dari koleksi `sales`.

    Endpoint ini digunakan untuk menampilkan daftar transaksi penjualan,
    termasuk informasi produk, jumlah, harga, pembeli, serta tanggal transaksi.
    Data dikembalikan dalam urutan terbaru (descending berdasarkan `created_at`).

    Response:
        "status": true,
            "message": "Data transaksi berhasil diambil.",
    """
    auth = check_login(api=True)
    if auth:
        return auth

    db = current_app.db
    sales = list(db["sales"].find().sort("created_at", DESCENDING))
    for s in sales:
        s["_id"] = str(s["_id"])

    return response(True, "Data transaksi berhasil diambil.", sales)


# =====================================================
# ROUTE: DATA SALES DETAIL
# =====================================================

@sales_bp.route("/api/sales/<sale_id>", methods=["GET"])
def get_sale_detail(sale_id):
    """
    Mengambil detail satu transaksi penjualan berdasarkan ID transaksi
    dari koleksi `sales`.

    Endpoint ini digunakan untuk menampilkan informasi lengkap sebuah transaksi,
    termasuk nama produk, jumlah, harga, pembeli, total transaksi, serta waktu
    transaksi dibuat.

    Args:
        sale_id (str) :

    Returns:
        "status": true,
             "message": "Data transaksi ditemukan.",
    """
    auth = check_login(api=True)
    if auth:
        return auth

    db = current_app.db
    try:
        sale = db["sales"].find_one({"_id": ObjectId(sale_id)})
    except Exception:
        return response(False, "ID transaksi tidak valid.", 400)

    if not sale:
        return response(False, "Transaksi tidak ditemukan.", 404)

    sale["_id"] = str(sale["_id"])
    return response(True, "Data transaksi ditemukan.", sale)


# =====================================================
# ROUTE: MENAMBAHKAN TRANSAKSI PENJUALAN
# =====================================================

@sales_bp.route("/api/sales", methods=["POST"])
def create_sale():
    """
    Tambahkan satu transaksi penjualan baru ke sistem.

    Endpoint ini menangani proses pengurangan stok produk dan pencatatan
    transaksi penjualan ke koleksi `sales`.
    Proses yang dilakukan:
    
    1. Validasi input
    2. Validasi stok produk
    3. Update stok
    4. Catat transaksi

    Validasi yang dilakukan
    - Field wajib: `product_id`, `quantity`
    - Field numerik seperti jumlah harus bernilai **lebih dari 0**
    - Stok produk tidak boleh negatif
    - Sistem memastikan produk harus ditemukan di database

     Args:
        product_id (str)      : ID / SKU produk.
        quantity (int)        : Jumlah produk yang dibeli.
        customer_name (str)   : Nama pembeli (opsional).
        notes (str)           : Catatan tambahan (opsional).
        
    Returns:
        "status": true,
            "message": "Transaksi penjualan berhasil dibuat.",
    """
    try:
        auth = check_login(api=True)
        if auth:
            return auth

        db = current_app.db
        data = request.get_json()

        product_id = sanitize(data.get("product_id"))
        quantity = to_int(data.get("quantity", 0), "jumlah")
        customer_name = sanitize(data.get("customer_name", "Umum"))
        notes = sanitize(data.get("notes", ""))

        if quantity <= 0:
            return response(False, "Jumlah pembelian harus lebih dari 0.", 400)

        product = db["master_product"].find_one({"_id": product_id})
        if not product:
            return response(False, "Produk tidak ditemukan.", 404)

        stock = int(product.get("stock", 0))
        sale_price = int(product.get("sale_price", 0))
        if stock < quantity:
            return response(False, f"Stok tidak mencukupi. Tersisa {stock}.", 400)

        total_price = sale_price * quantity
        new_stock = stock - quantity

        db["master_product"].update_one(
            {"_id": product_id},
            {"$set": {"stock": new_stock, "updated_at": datetime.now()}}
        )

        sale_doc = {
            "product_id": product_id,
            "product_name": product.get("name"),
            "category": product.get("category"),
            "quantity": quantity,
            "sale_price": sale_price,
            "total_price": total_price,
            "customer_name": customer_name,
            "notes": notes,
            "created_by": session.get("username", "unknown"),
            "created_at": datetime.now()
        }
        result = db["sales"].insert_one(sale_doc)

        sale_doc["_id"] = str(result.inserted_id)
        sale_doc["new_stock"] = new_stock

        return response(True, "Transaksi penjualan berhasil dibuat.", sale_doc, 201)

    except ValueError as e:
        return response(False, str(e), 400)
    
    except Exception as e:
        current_app.logger.error(f"[ERROR] create_sale: {e}")
        return response(False, f"Terjadi kesalahan pada server: {str(e)}", 500)


# =====================================================
# ROUTE: MENAMBAHKAN TRANSAKSI PENJUALAN BANYAK
# =====================================================

@sales_bp.route("/api/sales_batch", methods=["POST"])
def create_sales_batch():
    """
    Tambahkan beberapa transaksi penjualan sekaligus (mode POS).
    Endpoint ini digunakan untuk mencatat banyak transaksi penjualan
    dalam satu permintaan, biasanya digunakan pada sistem Point of Sale (POS).
    Setiap item akan divalidasi stoknya, kemudian stok produk dikurangi,
    dan seluruh transaksi disimpan ke koleksi `sales`
    
        Proses:
        1. Validasi login token (mode API).
        2. Validasi bahwa daftar item tidak kosong.
        3. Untuk tiap item:
            - Cek keberadaan produk.
            - Validasi kuantitas.
            - Validasi kecukupan stok.
            - Hitung stok baru dan lakukan update.
        4. Buat dokumen transaksi penjualan untuk setiap item.
        5. Simpan semua transaksi menggunakan insert_many().

    Returns:
        Response: Status transaksi POS.
    """
    try:
        auth = check_login(api=True)
        if auth:
            return auth

        db = current_app.db
        data = request.get_json()
        items = data.get("items", [])
        customer = data.get("customer_name", "Umum")

        if not items:
            return response(False, "Tidak ada item dalam transaksi.", 400)

        sales_docs = []
        for i in items:
            product = db["master_product"].find_one({"_id": i["product_id"]})
            if not product:
                return response(False, f"Produk {i['product_id']} tidak ditemukan.", 404)

            qty = int(i.get("quantity", 0))
            if qty <= 0:
                return response(False, "Jumlah tidak valid.", 400)

            stock = int(product.get("stock", 0)) 

            if stock < qty:
                return response(
                    False,
                    f"Stok {product['name']} hanya tersisa {stock}, tidak mencukupi.",
                    None,
                    400
                )
            new_stock = stock - qty           

            db["master_product"].update_one(
                {"_id": product["_id"]},
                {"$set": {"stock": new_stock, "updated_at": datetime.utcnow()}}
            )

            sales_docs.append({
                "product_id": product["_id"],
                "product_name": product["name"],
                "quantity": qty,
                "sale_price": product["sale_price"],
                "total_price": product["sale_price"] * qty,
                "customer_name": customer,
                "created_by": session.get("username", "unknown"),
                "created_at": datetime.utcnow(),
                "store_id": i.get("store_name"),  
                "store_name": i.get("store_name"),
            })


        if sales_docs:
            db["sales"].insert_many(sales_docs)

        return response(True, "Transaksi POS berhasil disimpan.", None, 201)

    except Exception as e:
        current_app.logger.error(f"[ERROR] create_sales_batch: {e}")
        return response(False, f"Terjadi kesalahan server: {str(e)}", 500)


# =====================================================
# ROUTE: HAPUS DATA TRANSAKSI
# =====================================================

@sales_bp.route("/api/sales/<sale_id>", methods=["DELETE"])
def delete_sale(sale_id):
    """
    Hapus transaksi penjualan dari sistem dan kembalikan stok produk terkait.

    Endpoint ini digunakan untuk menghapus satu transaksi penjualan.
    Saat transaksi berhasil dihapus, stok produk yang sebelumnya berkurang
    akan dikembalikan sesuai jumlah yang tercatat dalam transaksi.

    Proses:
        1. Validasi admin menggunakan `check_admin()`.
        2. Validasi format ObjectId.
        3. Ambil data transaksi dari koleksi `sales`.
        4. Jika transaksi ditemukan:
            - Ambil `product_id` dan `quantity`.
            - Tambahkan kembali stok ke `master_product`.
        5. Hapus transaksi dari koleksi `sales`.
        
    Args:
        sale_id (str):
            ID transaksi penjualan dalam format ObjectId.
             
    Returns:
        Response: Status penghapusan.
    """
    try:
        auth = check_admin()
        if auth:
            return auth
        db = current_app.db
        try:
            sale = db["sales"].find_one({"_id": ObjectId(sale_id)})
        except:
            return response(False, "ID transaksi tidak valid.", 400)

        if not sale:
            return response(False, "Transaksi tidak ditemukan.", 404)

        product_id = sale["product_id"]
        quantity = int(sale["quantity"])

        product = db["master_product"].find_one({"_id": product_id})
        if product:
            current_stock = int(product.get("stock", 0))
            new_stock = current_stock + quantity

            db["master_product"].update_one(
                {"_id": product_id},
                {"$set": {"stock": new_stock, "updated_at": datetime.utcnow()}}
                )

        db["sales"].delete_one({"_id": ObjectId(sale_id)})

        return response(True, "Transaksi dihapus & stok berhasil dikembalikan.", 200)

    except Exception as e:
        current_app.logger.error(f"[ERROR] delete_sale: {e}")
        return response(False, f"Terjadi kesalahan server: {str(e)}", 500)



