# 📚 WebApp Administrasi Guru

> **Sistem Administrasi Digital Guru Berbasis Google Apps Script**
> Dibuat oleh: **pakbay07**

---

## ✅ Fitur Aplikasi

| Modul | Deskripsi |
|---|---|
| 🏠 Dashboard | Ringkasan statistik: total kelas, siswa, mapel, jadwal hari ini, % kehadiran |
| 👥 Data Kelas | CRUD kelas (nama kelas, wali kelas, tingkat) |
| 🧑 Data Siswa | CRUD & import siswa massal dari CSV/tabel |
| 📖 Mata Pelajaran | Pengaturan mapel, JP/minggu, KKM |
| 📓 Jurnal Mengajar | Input agenda KBM + presensi siswa setiap pertemuan |
| 📅 Jadwal Mengajar | Roster mingguan interaktif |
| 📊 Perencanaan | Kalender Pendidikan, Kalkulator RPE, Prota, dan Matriks Promes |
| 🔢 Daftar Nilai | Spreadsheet-like: customizable columns + rata-rata otomatis |
| 📈 Analitik | Grafik nilai, distribusi gender, analisis KKM |
| 🖨️ Cetak & Ekspor | Export ke Excel (.xlsx), Word (.docx), PDF resmi berkop surat |
| ⚙️ Pengaturan | Profil guru, sekolah, kepala sekolah, logo, tahun ajaran |

---

## 🚀 Deployment ke Google Apps Script

### Langkah 1: Buat Google Spreadsheet Database
1. Buka https://sheets.google.com
2. Buat spreadsheet baru → **Copy URL-nya**
3. Contoh URL: `https://docs.google.com/spreadsheets/d/1ABC123XYZ/edit`
4. **ID Spreadsheet** = `1ABC123XYZ` (bagian antara `/d/` dan `/edit`)

### Langkah 2: Buat Project Google Apps Script
1. Buka https://script.google.com
2. Klik **+ New Project**
3. Beri nama: `Administrasi Guru`

### Langkah 3: Setup Code.gs
1. **Hapus semua kode default** di editor
2. **Copy-paste** isi file `gas/Code.gs`
3. **WAJIB EDIT** baris ini di paling atas Code.gs:
```javascript
const SPREADSHEET_ID = 'GANTI_DENGAN_ID_SPREADSHEET_ANDA';
// Ganti dengan ID spreadsheet Anda
// Contoh: const SPREADSHEET_ID = '1ABC123XYZ';
```

### Langkah 4: Buat File HTML
Buat file HTML baru di GAS untuk setiap file di folder `gas/`:
1. `Index.html`
2. `Dashboard.html`
3. `Kelas.html`
4. `Siswa.html`
5. `Mapel.html`
6. `Jadwal.html`
7. `Jurnal.html`
8. `Nilai.html`
9. `Perencanaan.html`
10. `Analitik.html`
11. `Cetak.html`
12. `Settings.html`
13. `JavaScript.html`
14. `Stylesheet.html`

**Isi setiap file HTML** dengan copy-paste dari folder `gas/` (sesuaikan nama file)

### Langkah 5: Inisialisasi Database
1. Di editor GAS, pilih fungsi **`initDatabase`** dari dropdown
2. Klik tombol **Run** (▶️)
3. Berikan izin yang diminta Google
4. Pesan "Database berhasil di-reset ke kondisi kosong!" muncul

### Langkah 6: Deploy Web App
1. Klik **Deploy** → **New deployment**
2. Pilih type: **Web app**
3. Konfigurasi:
   - Description: `Administrasi Guru v1.0`
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Klik **Deploy**
5. Copy URL web app yang diberikan

---

## 📖 Panduan Penggunaan

### Pengaturan Pertama Kali
1. Buka aplikasi → menu **Pengaturan**
2. Isi: Nama Guru, NIP, Nama Sekolah, Alamat, Kepala Sekolah, NIP KS
3. Upload logo sekolah & logo dinas (optional)
4. Klik **Simpan Pengaturan**

### Input Data
1. **Kelas**: Tambah kelas (VII, VIII, IX)
2. **Siswa**: Tambah/edit siswa per kelas
3. **Mapel**: Tambah mata pelajaran + KKM + JP/minggu
4. **Jadwal**: Atur jadwal mengajar

### Penilaian
1. Menu **Nilai** → Pilih Kelas & Mapel
2. Kolom default: Tugas, Formatif, Sumatif, PAS
3. Tambah kolom kustom: Klik "+" di panel kiri
4. Edit nama kolom: Klik langsung pada nama kolom
5. Isi nilai → Klik **Simpan**

### Prota & Promes
1. Menu **Perencanaan** → Pilih Kelas & Mapel
2. Tambah Tujuan Pembelajaran (TP)
3. Isi alokasi JP per TP
4. Matriks Promes terisi otomatis

### Cetak Dokumen
1. Menu **Cetak** → Pilih dokumen
2. Pilih format: Excel / Word / PDF
3. PDF menghasilkan dokumen resmi berkop surat

---

## 🔧 Troubleshooting

### Error "Spreadsheet not found"
- Pastikan `SPREADSHEET_ID` sudah diganti dengan ID yang benar
- Pastikan spreadsheet sudah di-share dengan akun Apps Script

### Error "Function not found"
- Pastikan semua file HTML sudah dibuat dengan nama yang tepat
- Pastikan nama fungsi di Code.gs sesuai

### Database kosong setelah reset
- Normal! Jalankan fungsi `initDatabase` untuk membuat struktur database

---

## 📝 Lisensi

Dibuat oleh: **pakbay07**

*Administrasi Guru v1.0 - Ready for Distribution*
