"""
dashboard_routes.py
=====================================================
Dashboard Analytics Gabungan dengan Filter per Toko
=====================================================

Modul ini menangani penyajian data analitik untuk dashboard,
baik secara keseluruhan maupun per-toko (store filter).

Data yang ditampilkan mencakup:
- Ringkasan total produk, penjualan, stok & pendapatan
- Grafik pie kategori produk
- Grafik status stok (habis, menipis, tersedia)  
- Riwayat penjualan terbaru
- Supplier summary & data barang masuk
- Alert stok menipis / habis

Keamanan:
- Hanya pengguna login yang dapat mengakses dashboard.

=====================================================
MongoDB Collections:
-----------------------------------------------------
- sales
- master_product
- master_supplier
- master_karyawan (untuk total karyawan)
=====================================================
"""

from flask import Blueprint, jsonify, render_template, session, current_app, request
from app.routes.auth_routes import check_login
from bson.son import SON


dashboard_bp = Blueprint("dashboard_bp", __name__)


# ======================================================
# Utility
# ======================================================
def store_filter():
    """
    Membuat filter query MongoDB berdasarkan parameter store_id.

    Returns:
        dict: Query filter untuk MongoDB.
    """
    store_id = request.args.get("store_id", "all")
    query = {}
    if store_id and store_id.lower() != "all":
        query["store_id"] = store_id
    return query


# ======================================================
# Halaman Dashboard (HTML)
# ======================================================
@dashboard_bp.route("/dashboard_analytics")
def dashboard_page():
    """
    Render halaman dashboard analytics.
    Hanya dapat diakses jika pengguna telah login.
    """
    auth = check_login()
    if auth:
        return auth

    return render_template(
        "dashboard.html",
        username=session.get("username"),
        role=session.get("role"),
    )


# =====================================================
# ROUTES: DATA TOKO
# =====================================================

@dashboard_bp.route("/api/stores", methods=["GET"])
def get_all_stores():
    """
    Ambil daftar toko aktif untuk dropdown tujuan pengiriman.

    Returns:
        Response: JSON daftar toko aktif.
    """
    auth = check_login(api=True)
    if auth:
        return auth

    db = current_app.db
    try:
        stores = list(
            db["master_store"].find({"is_active": True}, {"_id": 1, "name": 1, "city": 1})
        )
        result = [
            {"store_id": s["_id"], "name": s["name"], "city": s.get("city", "")}
            for s in stores
        ]
        return jsonify(result), 200

    except Exception as e:
        return jsonify({
            "status": False,
            "error": "Gagal mengambil data toko",
            "detail": str(e),
        }), 500


# ======================================================
# API: Ringkasan Dashboard
# ======================================================
@dashboard_bp.route("/api/analytics/summary", methods=["GET"])
def analytics_summary():
    """
    Mengambil ringkasan analitik (summary) untuk dashboard.

    Returns:
        JSON:
        - total_products
        - total_stock
        - total_sales
        - total_revenue
        - total_purchase_value
        - total_sale_value
        - total_supplier
        - total_karyawan
    """
    db = current_app.db
    query = store_filter()

    total_products = db["master_product"].count_documents(query)
    total_karyawan = db["master_karyawan"].count_documents({})

    products = db["master_product"].find(
        query, {"stock": 1, "purchase_price": 1, "sale_price": 1}
    )

    total_stock = total_purchase = total_sale = 0
    for p in products:
        stock = int(p.get("stock", 0))
        total_stock += stock
        total_purchase += stock * int(p.get("purchase_price", 0))
        total_sale += stock * int(p.get("sale_price", 0))

    total_sale_stock = 0
    for p in products:
        stock = int(p.get("stock", 0))
        purchase_price = int(p.get("purchase_price", 0))
        sale_price = int(p.get("sale_price", 0))

        total_stock += stock
        total_purchase += stock * purchase_price
        total_sale += stock * sale_price  

    total_sale_stock = total_sale   
    
    total_sales = db["sales"].count_documents(query)
    total_revenue = sum(
        s.get("total_price", 0) for s in db["sales"].find(query, {"total_price": 1})
    )

    supplier_names = db["master_supplier"].distinct("supplier", query)
    total_supplier = len(supplier_names)

    supplier_docs = db["master_supplier"].find(
        query, {"jumlah": 1, "purchase_price": 1}
    )

    total_supplier_value = 0
    for d in supplier_docs:
        try:
            qty = int(d.get("jumlah", 0) or 0)
            price = int(d.get("purchase_price", 0) or 0)
            total_supplier_value += qty * price
        except (TypeError, ValueError):
            continue

    out_query = {**query, "type": "penjualan"}
    distribusi_docs = db["master_supplier_out"].find(
        out_query, {"total_harga": 1}
    )

    total_distribusi_value = 0
    for d in distribusi_docs:
        try:
            total_distribusi_value += int(d.get("total_harga", 0) or 0)
        except (TypeError, ValueError):
            continue

    return jsonify({
        "total_products": total_products,
        "total_karyawan": total_karyawan,
        "total_stock": total_stock,
        "total_sales": total_sales,
        "total_revenue": total_revenue,
        "total_purchase_value": total_purchase,
        "total_sale_value": total_sale,
        "total_supplier": total_supplier,               
        "total_supplier_value": total_supplier_value,   
        "total_distribusi_value": total_distribusi_value,
        "total_sale_stock": total_sale_stock
    })


# ======================================================
# API: Penjualan Terbaru
# ======================================================
@dashboard_bp.route("/api/analytics/recent_sales", methods=["GET"])
def recent_sales():
    """
    Mengambil 10 penjualan terakhir (terfilter toko jika ada).
    """
    db = current_app.db
    query = store_filter()

    result = (
        db["sales"]
        .find(query, {"_id": 0, "product_name": 1, "quantity": 1, "total_price": 1, "customer_name": 1, "created_at": 1})
        .sort("created_at", -1)
        .limit(10)
    )

    data = [{
        "product_name": r.get("product_name", "-"),
        "quantity": r.get("quantity", 0),
        "total_price": r.get("total_price", 0),
        "customer_name": r.get("customer_name", "-"),
        "created_at": r.get("created_at").strftime("%Y-%m-%d") if r.get("created_at") else "-"
    } for r in result]

    return jsonify(data)


# ======================================================
# API: Pie Chart - Kategori Produk
# ======================================================
@dashboard_bp.route("/api/analytics/category_pie", methods=["GET"])
def category_pie():
    """
    Menghasilkan data pie chart kategori produk berdasarkan stok.
    """
    db = current_app.db
    query = store_filter()

    pipeline = [
        {"$match": query},
        {"$group": {"_id": "$category", "total_stock": {"$sum": "$stock"}}},
        {"$sort": SON([("total_stock", -1)])}
    ]

    return jsonify(list(db["master_product"].aggregate(pipeline)))


# ======================================================
# API: Pie Chart - Status Stok
# ======================================================
@dashboard_bp.route("/api/analytics/stock_status", methods=["GET"])
def stock_status():
    """
    Mengembalikan jumlah produk:
    - habis (stock = 0)
    - menipis (stock - min_stock <= 5)
    - tersedia (sisanya)
    """
    db = current_app.db
    query = store_filter()

    total = db["master_product"].count_documents(query)

    habis = db["master_product"].count_documents({**query, "stock": 0})

    menipis = db["master_product"].count_documents({
        **query,
        "$expr": {"$lte": [{"$subtract": ["$stock", "$min_stock"]}, 5]}
    })

    tersedia = total - habis - menipis

    return jsonify({
        "habis": habis,
        "menipis": menipis,
        "tersedia": tersedia,
        "total": total
    })


# ======================================================
# API: Supplier Summary
# ======================================================
@dashboard_bp.route("/api/analytics/supplier_summary", methods=["GET"])
def supplier_summary():
    """
    Menampilkan total barang dan nilai pembelian per supplier.
    """
    db = current_app.db
    query = store_filter()

    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": {"supplier": "$supplier", "store": "$store_name"},
            "total_produk": {"$sum": "$jumlah"},
            "total_value": {"$sum": {"$multiply": ["$jumlah", "$purchase_price"]}}
        }},
        {"$sort": SON([("total_produk", -1)])}
    ]

    result = list(db["master_supplier"].aggregate(pipeline))

    return jsonify([
        {
            "supplier_name": r["_id"]["supplier"],
            "store_name": r["_id"]["store"],
            "total_items": r["total_produk"],
            "total_value": r["total_value"]
        }
        for r in result
    ])


# ======================================================
# API: Total Supplier & Barang Masuk
# ======================================================
# @dashboard_bp.route("/api/analytics/supplier_total", methods=["GET"])
def supplier_total():
    """
    Mengembalikan jumlah supplier unik & total barang masuk.
    """
    db = current_app.db
    query = store_filter()

    suppliers = db["master_supplier"].distinct("supplier", query)
    total_produk = db["master_supplier"].count_documents(query)

    return jsonify({
        "total_supplier": len(suppliers),
        "total_produk_dikirim": total_produk,
        "daftar_supplier": suppliers
    })


# ======================================================
# API: Alert Produk Menipis / Habis
# ======================================================
@dashboard_bp.route("/api/products/alert", methods=["GET"])
def products_alert():
    """
    Mengembalikan daftar produk dengan stok menipis atau habis.
    Ditampilkan di popup alert dashboard.
    """
    db = current_app.db
    query = store_filter()

    pipeline = [
        {"$match": {
            **query,
            "$or": [
                {"$expr": {"$lte": [{"$subtract": ["$stock", "$min_stock"]}, 5]}},
                {"stock": 0}
            ]
        }},
        {"$project": {"_id": 1, "name": 1, "stock": 1, "min_stock": 1, "store_id": 1, "store_name" : 1}}
    ]

    result = list(db["master_product"].aggregate(pipeline))
    for r in result:
        r["_id"] = str(r["_id"])

    return jsonify(result)
