# 📚 WebApp Administrasi Guru — Panduan Lengkap

> **SMP Negeri 3 Besuki, Situbondo**
> Sistem Administrasi Digital Guru Berbasis Google Apps Script (GAS)

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
| 🔢 Daftar Nilai | Spreadsheet-like: Tugas, Formatif, Sumatif, PAS + rata-rata otomatis |
| 📈 Analitik | Grafik nilai per kelas & distribusi kehadiran (Chart.js) |
| 🖨️ Cetak & Ekspor | Export ke Excel (.xlsx), Word (.docx), PDF resmi berkop surat |
| ⚙️ Pengaturan | Profil guru, NIP, tahun ajaran, semester aktif |

---

## 🖥️ Menjalankan Simulator Lokal

```powershell
# 1. Masuk ke direktori proyek
cd C:\Users\Hp\.gemini\antigravity\scratch\administrasi-guru

# 2. Install dependensi (hanya pertama kali)
npm install

# 3. Jalankan simulator
node simulator/server.js

# 4. Buka browser: http://localhost:3000
```

---

## 🚀 Deployment ke Google Apps Script

### Langkah 1: Buat Proyek GAS Baru
1. Buka https://script.google.com
2. Klik "Proyek Baru", beri nama: `Administrasi Guru SMPN3`

### Langkah 2: Upload Code.gs
Salin isi `gas/Code.gs` ke editor GAS.

### Langkah 3: Buat File HTML
Untuk setiap `gas/*.html`, buat file HTML baru di GAS dengan nama persis sama:
- Index, Stylesheet, JavaScript, Dashboard, Kelas, Siswa, Mapel
- Jurnal, Perencanaan, Nilai, Jadwal, Analitik, Settings, Cetak

### Langkah 4: Hubungkan Google Spreadsheet
Edit baris di Code.gs:
```javascript
const SPREADSHEET_ID = 'GANTI_DENGAN_ID_SPREADSHEET_ANDA';
```

### Langkah 5: Inisialisasi Database
Pilih fungsi `initDatabase` dan klik Run di editor GAS.

### Langkah 6: Deploy sebagai Web App
1. Deploy → New Deployment → Web App
2. Execute as: Me | Who has access: Anyone
3. Salin URL Web App yang dihasilkan

---

## 📖 Panduan RPE & Promes

### Rincian Pekan Efektif (RPE)
1. Pilih Kelas, Mapel, Semester
2. Isi jumlah pekan per bulan (Bagian A)
3. Tambah kegiatan tidak efektif libur/ujian (Bagian A.II)
4. Isi rincian penggunaan pekan (Bagian B): PBM, Sumatif, dll.
5. Sistem menghitung: C = A - B dan JP Efektif = C x JP/Minggu
6. Klik "Simpan Perhitungan RPE"

> Catatan: Jumlah Rincian (D) HARUS = Pekan Efektif (C) agar bisa disimpan.

### Prota & Matriks Promes
1. Pilih Kelas, Mapel, Semester
2. Klik "Tambah TP Baru" untuk menambah Tujuan Pembelajaran
3. Di matriks Promes, isi JP per minggu tiap TP
4. Kolom Rencana: dijumlah otomatis
5. Kolom Real: dikalkulasi dari Jurnal Mengajar
6. Klik "Simpan Matriks Promes"

---

## ⚙️ Pengaturan Pertama Kali
1. Pergi ke menu Pengaturan
2. Isi: Nama Guru, NIP, Tahun Ajaran, Semester
3. Klik "Simpan Pengaturan"

---

*Dibuat untuk SMP Negeri 3 Besuki, Situbondo — Tahun Pelajaran 2025/2026*
