"""
mongo_connection.py
=====================================================
Kelas Wrapper Koneksi MongoDB untuk Aplikasi Flask
=====================================================

Deskripsi Umum
-----------------------------------------------------
Kelas ini menyediakan interface sederhana untuk berinteraksi
dengan MongoDB, meliputi operasi dasar:

- insert      : Menambahkan satu atau banyak dokumen
- find        : Mengambil satu atau banyak dokumen
- update      : Memperbarui satu atau banyak dokumen
- delete      : Menghapus satu atau banyak dokumen

Fokus penggunaan:
- Konsisten pada format response (status, message, data)
- Menghindari duplikasi kode MongoDB pada route / service
- Konversi otomatis `ObjectId` ke string agar aman untuk JSON

=====================================================
Dependency
-----------------------------------------------------
PyMongo:
    - MongoClient : Koneksi database
    - insert_one(), find(), update_one(), delete_one(), dll

=====================================================
"""

from pymongo import MongoClient


class MongoConnection:
    """
    Kelas pembungkus koneksi MongoDB dan operasi CRUD dasar.

    Attributes:
        connection_string (str): URI koneksi MongoDB.
        db_name (str): Nama database yang akan digunakan.
        client (MongoClient): Objek koneksi ke MongoDB.
        db (Database): Objek database aktif.

    """

    def __init__(self, connection_string, db_name):
        self.connection_string = connection_string
        self.db_name = db_name
        self.client = None
        self.db = None
        self.__getConnection()

    # --------------------------------------------------
    # Koneksi Database
    # --------------------------------------------------
    def __getConnection(self):
        """Membuat koneksi ke MongoDB dan melakukan ping test."""
        try:
            self.client = MongoClient(self.connection_string)
            self.db = self.client[self.db_name]
            self.client.admin.command("ping")  # memastikan koneksi aktif
        except Exception as error:
            print(f"[MongoConnection] Error: {error}")

    # --------------------------------------------------
    # INSERT
    # --------------------------------------------------
    def insert(self, collection, data, multi=False):
        """
        Menambahkan dokumen ke MongoDB.

        Args:
            collection (str): Nama koleksi.
            data (dict | list): Dokumen yang akan disimpan.
            multi (bool): True jika insert banyak dokumen.

        Returns:
            dict: status, data(inserted_id), message
        """
        result = {'status': False, 'data': None, 'message': 'Terjadi kesalahan saat menambahkan data'}
        try:
            if multi:
                result_insert = self.db[collection].insert_many(data)
            else:
                result_insert = self.db[collection].insert_one(data)

            if result_insert.acknowledged:
                result['status'] = True
                result['data'] = {"inserted_id": str(getattr(result_insert, "inserted_id", None))}
                result['message'] = "Berhasil menambahkan data"
        except Exception as e:
            print(f"[MongoConnection] Error insert: {e}")
        return result

    # --------------------------------------------------
    # FIND
    # --------------------------------------------------
    def find(self, collection, query, project=None, limit=0, sort=None, multi=False):
        """
        Mengambil dokumen dari MongoDB.

        Args:
            collection (str) : Nama koleksi.
            query (dict)     : Filter query MongoDB.
            project (dict)   : Projection field.
            limit (int)      : Batas jumlah hasil (untuk multi=True).
            sort (list)      : Urutan hasil [('field', 1/-1)].
            multi (bool)     : True untuk find banyak data.

        Returns:
            dict: status, data, message
        """
        result = {'status': False, 'data': None, 'message': 'Terjadi kesalahan saat mengambil data'}
        try:
            if multi:
                cursor = self.db[collection].find(query, projection=project, limit=limit, sort=sort)
                records = list(cursor)
                for item in records:
                    if '_id' in item:
                        item['_id'] = str(item['_id'])
                result_find = records
            else:
                record = self.db[collection].find_one(query, projection=project, sort=sort)
                if record and '_id' in record:
                    record['_id'] = str(record['_id'])
                result_find = record

            if result_find:
                result['status'] = True
                result['data'] = result_find
                result['message'] = "Berhasil mengambil data"
        except Exception as e:
            print(f"[MongoConnection] Error find: {e}")
        return result

    # --------------------------------------------------
    # UPDATE
    # --------------------------------------------------
    def update(self, collection, query, data, multi=False):
        """
        Memperbarui dokumen.

        Args:
            collection (str): Nama koleksi.
            query (dict): Filter dokumen yang akan diperbarui.
            data (dict): Data update {"$set": {...}}
            multi (bool): True jika update banyak dokumen.

        Returns:
            dict: status, message
        """
        result = {'status': False, 'message': 'Terjadi kesalahan saat memperbarui data'}
        try:
            update_result = (
                self.db[collection].update_many(query, data)
                if multi else
                self.db[collection].update_one(query, data)
            )

            if update_result.matched_count > 0:
                result['status'] = True
                result['message'] = f"Berhasil memperbarui {update_result.modified_count} data."
        except Exception as e:
            print(f"[MongoConnection] Error update: {e}")
        return result

    # --------------------------------------------------
    # DELETE
    # --------------------------------------------------
    def delete(self, collection, query, multi=False):
        """
        Menghapus dokumen.

        Args:
            collection (str): Nama koleksi.
            query (dict): Filter dokumen yang akan dihapus.
            multi (bool): True jika hapus banyak dokumen.

        Returns:
            dict: status, message
        """
        result = {'status': False, 'message': 'Gagal menghapus data atau data tidak ditemukan.'}
        try:
            delete_result = (
                self.db[collection].delete_many(query)
                if multi else
                self.db[collection].delete_one(query)
            )

            if delete_result.deleted_count > 0:
                result['status'] = True
                result['message'] = f"Berhasil menghapus {delete_result.deleted_count} data."
        except Exception as e:
            print(f"[MongoConnection] Error delete: {e}")
        return result
