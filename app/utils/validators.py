from flask import jsonify
import re

# =====================================================
# Utility Functions
# =====================================================

def sanitize(text, default=""):
    """
    Membersihkan input teks dari karakter berbahaya.

    Args:
        text (str): Input teks dari user.
        default (str): Nilai default jika teks kosong.

    Returns:
        str: Teks aman yang sudah disanitasi.
    """
    return re.sub(r"[^a-zA-Z0-9@\s\-\._\+]", "", str(text or default)).strip()


def to_int(value, field):
    """
    Konversi nilai ke integer dengan validasi error yang jelas.

    Args:
        value (any): Nilai input.
        field (str): Nama field untuk pesan error.

    Returns:
        int: Nilai integer yang valid.

    Raises:
        ValueError: Jika nilai bukan angka.
    """
    try:
        return int(value)
    except (ValueError, TypeError):
        raise ValueError(f"{field} harus berupa angka")


def parse_float(value, field="nilai"):
    """
    Konversi nilai ke float dengan validasi error.

    Args:
        value (any): Nilai input.
        field (str): Nama field untuk pesan error.

    Returns:
        float: Nilai float yang valid.

    Raises:
        ValueError: Jika nilai bukan angka.
    """
    try:
        return float(value)
    except (ValueError, TypeError):
        raise ValueError(f"{field} harus berupa angka")
    
def response(success=True, message=None, data=None, code=200):
    """
    Format standar response API.

    Args:
        success (bool): Status berhasil/gagal.
        message (str): Pesan untuk user.
        data (dict | list | None): Payload data.
        code (int): HTTP status code.

    Returns:
        tuple: (JSON response, HTTP status code)
    """
    body = {"status": success}
    if message:
        body["message"] = message
    if data is not None:
        body["data"] = data
    return jsonify(body), code