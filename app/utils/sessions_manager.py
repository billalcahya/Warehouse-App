"""
session_manager.py
=====================================================
Manajemen Sesi & Token JWT
=====================================================

Modul ini bertanggung jawab untuk:
- Membuat token JWT saat pengguna login
- Menyimpan token ke MongoDB dengan TTL (auto-expire)
- Memvalidasi token dalam setiap request
- Menghapus token saat logout

=====================================================
MongoDB Collections yang Digunakan
-----------------------------------------------------
MONGODB_COLLECTION_SESSIONS
    - Menyimpan token JWT aktif
    - Memiliki field `expires_at` yang digunakan TTL index untuk auto-delete

=====================================================
Dependensi
-----------------------------------------------------
jwt (PyJWT)              : Encode & decode token JWT
MongoConnection (custom) : Wrapper akses MongoDB
datetime, timedelta      : Pengaturan waktu token
=====================================================
"""

import jwt
from datetime import datetime, timedelta
from pymongo import ASCENDING

from .mongo_connection import MongoConnection
from config import (
    MONGODB_CONNECTION_STRING,
    MONGO_AUTH_DATABASE,
    MONGODB_COLLECTION_SESSIONS,
    SECRET_KEY
)


class SessionManager:
    """
    Kelas untuk mengelola token sesi (JWT) termasuk pembuatan, validasi, dan penghapusan token.
    """

    def __init__(self):
        self.auth_mongo = MongoConnection(
            connection_string=MONGODB_CONNECTION_STRING,
            db_name=MONGO_AUTH_DATABASE
        )
        self.secret_key = SECRET_KEY

        # Buat TTL index untuk menghapus token yang sudah kedaluwarsa
        self.auth_mongo.db[MONGODB_COLLECTION_SESSIONS].create_index(
            [("expires_at", ASCENDING)],
            expireAfterSeconds=0
        )

    # --------------------------------------------------
    # GENERATE TOKEN
    # --------------------------------------------------
    def generate_token(self, username, role):
        """
        Membuat token JWT baru dan menyimpannya ke MongoDB.

        Args:
            username (str): Nama pengguna
            role (str): Hak akses pengguna (admin/staff/...)

        Returns:
            str: token JWT
        """
        now = datetime.utcnow()

        # Hapus sesi yang sudah kadaluarsa
        self.auth_mongo.delete(
            MONGODB_COLLECTION_SESSIONS,
            {"expires_at": {"$lt": now}},
            multi=True
        )

        payload = {
            "username": username,
            "role": role,
            "iat": now,                     # issued at
            "exp": now + timedelta(hours=24)  # masa berlaku token
        }

        token = jwt.encode(payload, self.secret_key, algorithm="HS256")
        token = token.decode("utf-8") if isinstance(token, bytes) else token

        session_data = {
            "username": username,
            "role": role,
            "token": token,
            "created_at": now,
            "expires_at": payload["exp"]
        }

        # Simpan token ke database
        self.auth_mongo.insert(MONGODB_COLLECTION_SESSIONS, session_data)

        return token

    # --------------------------------------------------
    # VERIFY TOKEN
    # --------------------------------------------------
    def verify_token(self, token):
        """
        Memverifikasi token JWT & mengecek apakah token masih tercatat di database.

        Args:
            token (str): Token JWT

        Returns:
            dict | None: Payload token jika valid, None jika invalid / expired.
        """
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=["HS256"], leeway=10)

            # Pastikan token masih tercatat di MongoDB
            session = self.auth_mongo.db[MONGODB_COLLECTION_SESSIONS].find_one({"token": token})
            if not session:
                print("Token tidak ditemukan di MongoDB (sudah logout / expired / dihapus).")
                return None

            return payload

        except jwt.ExpiredSignatureError:
            self.auth_mongo.db[MONGODB_COLLECTION_SESSIONS].delete_one({"token": token})
            print(f"[SessionManager] Token expired → otomatis dihapus")
            return None

        except jwt.InvalidTokenError as invalidError:
            print(f"[SessionManager] Token tidak valid: {invalidError}")
            return None

        except Exception as e:
            print(f"[SessionManager] Error verifikasi token: {e}")
            return None

    # --------------------------------------------------
    # REMOVE TOKEN (LOGOUT)
    # --------------------------------------------------
    def remove_token(self, token):
        """
        Logout user dengan menghapus token dari database.

        Args:
            token (str): Token JWT yang akan dihapus.
        """
        self.auth_mongo.delete(MONGODB_COLLECTION_SESSIONS, {"token": token})
