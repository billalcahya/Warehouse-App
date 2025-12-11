"""
auth_routes.py
=====================================================
Modul Autentikasi & Otorisasi untuk Aplikasi Flask
=====================================================

Modul ini mengelola seluruh proses autentikasi dan otorisasi dalam aplikasi,
meliputi login, logout, validasi token JWT, pembatasan percobaan login, serta
fitur reset password berbasis email.

=====================================================
Fitur Utama
-----------------------------------------------------
- Login pengguna dengan verifikasi password terenkripsi
- Pembatasan percobaan login (anti brute-force)
- Penguncian akun otomatis (lockout protection)
- Manajemen sesi menggunakan JWT
- Logout & pembersihan session/token
- Validasi token untuk endpoint API
- Fitur lupa password + reset password via email  

=====================================================
Koleksi MongoDB Digunakan
-----------------------------------------------------
- master_karyawan  
  Menyimpan data akun pengguna (username, email, role, password hash)

- login_attempts  
  Mencatat percobaan login gagal & status penguncian akun sementara

- password_resets  
  Token reset password yang memiliki TTL (berlaku 10 menit)

- sessions (TTL)  
  Token sesi aktif (JWT) yang kedaluwarsa otomatis

=====================================================
Dependensi Utama
-----------------------------------------------------
Flask:
    - request, session, redirect, render_template, flash, jsonify
Werkzeug:
    - check_password_hash, generate_password_hash
Datetime:
    - datetime.utcnow(), datetime.now(), timedelta
Regex:
    - Validasi format username
Secrets:
    - Generate token aman untuk reset password
smtplib & MIMEText:
    - Pengiriman email SMTP untuk reset password
SessionManager (app.utils):
    - Membuat, memverifikasi, dan mengelola token JWT

=====================================================
Konvensi Keamanan
-----------------------------------------------------
- Seluruh password disimpan dalam bentuk hash (PBKDF2/SCRYPT)
- Token JWT disimpan aman di session + koleksi sessions
- Anti user enumeration pada fitur lupa password
- Lockout otomatis setelah sejumlah percobaan gagal
- Reset password menggunakan token acak (32 chars) dengan expiry 10 menit

=====================================================
"""


from flask import Blueprint, render_template, request, session, redirect, current_app, flash, jsonify,url_for
from werkzeug.security import check_password_hash, generate_password_hash
from datetime import datetime, timedelta
from email.mime.text import MIMEText
import re
import secrets
import smtplib
from app.utils import SessionManager
from config import MONGODB_COLLECTION_SESSIONS


# ======================================================
# Konfigurasi & Konstanta Keamanan
# ======================================================
auth_bp = Blueprint("auth_bp", __name__)

MAX_ATTEMPTS = 5        # Maksimal percobaan login gagal
LOCKOUT_MINUTES = 5     # Durasi penguncian akun dalam menit


# ======================================================
# Fungsi Internal - Pencatatan Login Gagal & Lockout
# ======================================================
def _increment_attempt(collection, username):
    """
    Mencatat percobaan login gagal & mengunci akun sementara  
    jika gagal berturut-turut melebihi batas yang ditentukan.
    """
    now = datetime.utcnow()
    attempt = collection.find_one({"username": username})

    if not attempt:
        collection.insert_one({
            "username": username,
            "attempts": 1,
            "last_attempt": now,
            "locked_until": None
        })
        return

    attempts = attempt.get("attempts", 0) + 1
    update_data = {"attempts": attempts, "last_attempt": now}

    if attempts >= MAX_ATTEMPTS:
        update_data["locked_until"] = now + timedelta(minutes=LOCKOUT_MINUTES)
        flash(f"Terlalu banyak percobaan gagal. Akun dikunci {LOCKOUT_MINUTES} menit.", "error")

    collection.update_one({"_id": attempt["_id"]}, {"$set": update_data})


# ==========================================
# SEND EMAIL
# ==========================================
def send_reset_email(to_email, reset_link):
    """
    =====================================================
    SEND EMAIL: Reset Password
    =====================================================

    Fungsi ini digunakan untuk mengirimkan email reset password berbasis link
    yang hanya berlaku 10 menit.

    Alur:
    1. Buat isi email menggunakan MIMEText
    2. Tambahkan subject, from, dan recipient
    3. Koneksi ke SMTP Gmail (SSL port 465)
    4. Login menggunakan App Password
    5. Kirim pesan ke penerima
    6. Tutup koneksi SMTP

    Catatan:
    - WAJIB memakai App Password Gmail (bukan password asli)
    - Email pengirim harus mengaktifkan Two Factor Authenticatio
    """

    msg = MIMEText(f"""
    Halo,  
    Klik link di bawah ini untuk reset password Anda:

    {reset_link}

    Link ini hanya berlaku 10 menit.
    """)

    msg["Subject"] = "Reset Password"
    msg["From"] = "billalcahya@gmail.com"
    msg["To"] = to_email

    # SMTP Gmail (Pastikan pakai App Password)
    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login("billalcahya@gmail.com", "ahtr ykhw usxv pwrn")
        server.send_message(msg)


# ======================================================
# LOGIN
# ======================================================
@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    """
    Mengautentikasi pengguna menggunakan username & password.

    Alur:
    1. Validasi input & format username
    2. Cek apakah akun sedang dikunci (anti brute-force)
    3. Ambil user dari database
    4. Verifikasi password terenkripsi
    5. Jika benar → simpan session + buat token JWT
    6. Jika salah → tambah percobaan gagal
    """
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "").strip()

        if not username or not password:
            flash("Username & password wajib diisi", "error")
            return redirect("/login")

        if not re.match(r"^[a-zA-Z0-9_.-]{3,20}$", username):
            flash("Format username tidak valid", "error")
            return redirect("/login")

        attempt_coll = current_app.auth_db["login_attempts"]
        attempt = attempt_coll.find_one({"username": username})
        now = datetime.utcnow()

        if attempt and attempt.get("locked_until") and now < attempt["locked_until"]:
            remaining = int((attempt["locked_until"] - now).total_seconds() / 60)
            flash(f"Akun dikunci. Coba lagi dalam {remaining} menit.", "error")
            return redirect("/login")

        user = current_app.db["master_karyawan"].find_one({"username": username})

        if not user:
            _increment_attempt(attempt_coll, username)
            flash("User tidak ditemukan", "error")
            return redirect("/login")

        password_hash = user.get("password", "")
        if not password_hash.startswith(("pbkdf2:", "scrypt:")):
            flash("Password belum terenkripsi. Hubungi admin.", "error")
            return redirect("/login")

        if not check_password_hash(password_hash, password):
            _increment_attempt(attempt_coll, username)
            flash("Username atau password salah", "error")
            return redirect("/login")

        attempt_coll.delete_many({"username": username})

        session["username"] = user["username"]
        session["role"] = user.get("role", "staff")

        sm = SessionManager()
        token = sm.generate_token(session["username"], session["role"])
        session["token"] = token

        flash("Login berhasil", "success")
        return redirect("/dashboard_analytics")

    return render_template("login.html")


# ==========================================
# REQUEST FORGOT PASSWORD
# ==========================================
@auth_bp.route("/forgot_password", methods=["GET", "POST"])
def forgot_password():
    """
    Endpoint ini digunakan untuk memulai proses reset password pengguna.
    Sistem tidak akan memberi tahu apakah username benar atau salah sebagai
    langkah keamanan (anti user enumeration).
    
    1. Ambil username dari form dan trim spasi berlebih.
    2. Tampilkan pesan generik agar tidak membocorkan apakah username valid.
    3. Cari user dari database berdasarkan username.
       - Jika user tidak ditemukan, redirect kembali tanpa memberi detail.
    4. Jika user ditemukan:
        a. Generate token unik menggunakan `secrets.token_urlsafe()`
        b. Generate masa berlaku token: 10 menit
        c. Simpan token + username + expiry di koleksi `password_resets`
        d. Buat link reset password lengkap
        e. Kirim email menggunakan `send_reset_email()
        
    - username (str) : Username dari akun yang lupa password.
    """
    
    if request.method == "POST":
        username = request.form.get("username", "").strip()

        flash("Jika akun ditemukan, link reset telah dikirim ke email.", "info")

        user = current_app.db["master_karyawan"].find_one({"username": username})
        if not user:
            return redirect("/forgot_password")

        token = secrets.token_urlsafe(32)
        expires = datetime.now() + timedelta(minutes=10)

        reset_coll = current_app.auth_db["password_resets"]
        reset_coll.insert_one({
            "username": username,
            "token": token,
            "expires_at": expires
        })

        reset_link = request.url_root.rstrip("/") + url_for(
            "auth_bp.reset_password",  
            token=token
        )

        send_reset_email(user["email"], reset_link)

        return redirect("/forgot_password")

    return render_template("forgot_password.html")


@auth_bp.route("/reset_password", methods=["GET", "POST"])
def reset_password():
    """
    Endpoint reset password menggunakan token.

    Alur:
    1. Ambil token dari query/form.
    - Jika tidak ada, redirect ke /login.
    2. Cek token di koleksi `password_resets`.
    - Jika tidak valid atau expired, redirect dengan pesan error.
    3. GET → tampilkan form reset password.
    4. POST:
    - Validasi password dan konfirmasi.
    - Hash password baru dan update ke `master_karyawan`.
    - Hapus token agar tidak bisa dipakai lagi.
    - Redirect ke /login dengan pesan sukses.
    """
    token = request.args.get("token") or request.form.get("token")

    if not token:
        flash("Token tidak ditemukan", "error")
        return redirect("/login")

    reset_coll = current_app.auth_db["password_resets"]
    token_data = reset_coll.find_one({"token": token})

    if not token_data:
        flash("Token tidak valid atau sudah terpakai.", "error")
        return redirect("/login")

    if datetime.utcnow() > token_data["expires_at"]:
        flash("Token expired, silakan request ulang.", "error")
        return redirect("/forgot_password")


    if request.method == "POST":
        new_password = request.form.get("password")
        if new_password != request.form.get("confirm_password"):
            flash("Password tidak sama", "error")
            return redirect(request.url)

        if len(new_password) < 6:
            flash("Password minimal 6 karakter", "error")
            return redirect(request.url)

        hashed_pw = generate_password_hash(new_password)

        current_app.db["master_karyawan"].update_one(
            {"username": token_data["username"]},
            {"$set": {"password": hashed_pw}}
        )

        reset_coll.delete_one({"token": token})

        flash("Password berhasil direset. Silakan login kembali.", "success")
        return redirect("/login")

    return render_template("reset_password.html", token=token)


# ======================================================
# LOGOUT
# ======================================================
@auth_bp.route("/logout")
def logout():
    """
    Logout pengguna:
    - Hapus token dari database
    - Bersihkan session
    - Redirect ke /login
    """
    username = session.get("username")
    sm = SessionManager()

    if username:
        sm.auth_mongo.delete(MONGODB_COLLECTION_SESSIONS, {"username": username}, multi=True)

    session.clear()
    flash("Logout berhasil", "success")
    return redirect("/login")


# ======================================================
# VALIDASI TOKEN API
# ======================================================
@auth_bp.route("/check_token", methods=["GET"])
def check_token():
    """
    Memvalidasi token JWT melalui query parameter atau header.
    """
    sm = SessionManager()
    token = request.args.get("token")

    if not token:
        return jsonify({"error": "Token tidak ditemukan"}), 400

    payload = sm.verify_token(token)
    if not payload:
        return jsonify({"status": "invalid", "message": "Token tidak valid atau kedaluwarsa"}), 401

    return jsonify({"status": "valid", **payload}), 200


# ======================================================
# Middleware: Wajib Login
# ======================================================
def check_login(api=False):
    """
    Memverifikasi bahwa pengguna memiliki session dan token yang valid.
    Jika tidak, redirect ke login atau kembalikan error JSON.
    """
    token = session.get("token")
    username = session.get("username")

    if not token or not username:
        return jsonify({"status": False, "error": "Unauthorized"}), 401 if api else redirect("/login")

    sm = SessionManager()
    if not sm.verify_token(token):
        session.clear()
        return jsonify({"status": False, "error": "Session expired"}), 401 if api else redirect("/login")

    return None


# ======================================================
# Middleware: Wajib Admin
# ======================================================
def check_admin(api=True):
    """
    Memastikan pengguna login & memiliki role admin.
    Jika bukan admin → kembalikan 403 atau redirect unauthorized.
    """
    token = session.get("token")
    role = session.get("role")

    if not token or not role:
        return jsonify({"status": False, "error": "Unauthorized"}), 401 if api else redirect("/login")

    sm = SessionManager()
    if not sm.verify_token(token):
        session.clear()
        return jsonify({"status": False, "error": "Session expired"}), 401 if api else redirect("/login")

    if role != "ADMIN":
        return jsonify({"status": False, "error": "Forbidden: Admin only"}), 403 if api else redirect("/unauthorized")

    return None

