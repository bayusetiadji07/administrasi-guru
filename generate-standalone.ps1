# Standalone Converter
# Run this script to generate standalone version

$ErrorActionPreference = "SilentlyContinue"
$distDir = "dist"

# Create dist folder
if (!(Test-Path $distDir)) { New-Item -ItemType Directory -Path $distDir }

# Read all source files
$index = Get-Content "gas/Index.html" -Raw
$js = Get-Content "gas/JavaScript.html" -Raw
$css = Get-Content "gas/Stylesheet.html" -Raw
$dashboard = Get-Content "gas/Dashboard.html" -Raw
$kelas = Get-Content "gas/Kelas.html" -Raw
$siswa = Get-Content "gas/Siswa.html" -Raw
$mapel = Get-Content "gas/Mapel.html" -Raw
$jurnal = Get-Content "gas/Jurnal.html" -Raw
$jadwal = Get-Content "gas/Jadwal.html" -Raw
$nilai = Get-Content "gas/Nilai.html" -Raw
$perencanaan = Get-Content "gas/Perencanaan.html" -Raw
$analitik = Get-Content "gas/Analitik.html" -Raw
$cetak = Get-Content "gas/Cetak.html" -Raw
$settings = Get-Content "gas/Settings.html" -Raw

# Start building standalone HTML
$html = @"
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Administrasi Guru</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
"@

# Add CSS
$html += $css

$html += @"
  </style>
</head>
<body>
"@

# Extract sidebar from index
if ($index -match '<aside class="app-sidebar">(.*?)</aside>') {
  $html += '<aside class="app-sidebar">' + $matches[1] + '</aside>'
}

# Add main content
$html += '<main class="main-content">'

# Add all pages
$html += $dashboard
$html += $kelas
$html += $siswa
$html += $mapel
$html += $jurnal
$html += $jadwal
$html += $nilai
$html += $perencanaan
$html += $analitik
$html += $cetak
$html += $settings

$html += @"
  </main>
"@

# Add JavaScript
$html += '<script>'
$html += $js

# Add localStorage wrapper functions
$html += @"
// localStorage wrapper for standalone version
function apiCall(func, ...args) {
  return new Promise((resolve, reject) => {
    try {
      if (func === 'readData') {
        const data = JSON.parse(localStorage.getItem('db_' + args[0]) || '[]');
        resolve(data);
      } else if (func === 'createData') {
        const key = 'db_' + args[0];
        const data = JSON.parse(localStorage.getItem(key) || '[]');
        const newItem = { ...args[1], id: Date.now() };
        data.push(newItem);
        localStorage.setItem(key, JSON.stringify(data));
        resolve(newItem);
      } else if (func === 'updateData') {
        const key = 'db_' + args[0];
        const data = JSON.parse(localStorage.getItem(key) || '[]');
        const idx = data.findIndex(d => d.id == args[1]);
        if (idx >= 0) {
          data[idx] = { ...data[idx], ...args[2] };
          localStorage.setItem(key, JSON.stringify(data));
        }
        resolve(data[idx]);
      } else if (func === 'deleteData') {
        const key = 'db_' + args[0];
        let data = JSON.parse(localStorage.getItem(key) || '[]');
        data = data.filter(d => d.id != args[1]);
        localStorage.setItem(key, JSON.stringify(data));
        resolve(true);
      } else if (func === 'getSettings') {
        const settings = JSON.parse(localStorage.getItem('settings') || '{}');
        resolve(settings);
      } else if (func === 'saveSettings') {
        const settings = { ...JSON.parse(localStorage.getItem('settings') || '{}'), ...args[0] };
        localStorage.setItem('settings', JSON.stringify(settings));
        resolve({ success: true });
      } else if (func === 'getAnalitikData') {
        const kelas = JSON.parse(localStorage.getItem('db_Kelas') || '[]');
        const siswa = JSON.parse(localStorage.getItem('db_Siswa') || '[]');
        const nilai = JSON.parse(localStorage.getItem('db_Nilai') || '[]');
        const presensi = JSON.parse(localStorage.getItem('db_Presensi') || '[]');

        // Calculate averages
        const kelasAverages = kelas.map(k => {
          const siswaKelas = siswa.filter(s => s.kelas_id === k.id);
          const nilaiKelas = nilai.filter(n => siswaKelas.some(s => s.id === n.siswa_id));
          const avg = nilaiKelas.length ? Math.round(nilaiKelas.reduce((a, b) => a + b.nilai, 0) / nilaiKelas.length) : 0;
          return { kelas: k.nama_kelas, rataRata: avg };
        });

        // Attendance stats
        const attStats = { Hadir: 0, Sakit: 0, Izin: 0, Alfa: 0 };
        presensi.forEach(p => {
          if (p.status === 'H') attStats.Hadir++;
          else if (p.status === 'S') attStats.Sakit++;
          else if (p.status === 'I') attStats.Izin++;
          else if (p.status === 'A') attStats.Alfa++;
        });

        // Gender stats
        const genderStats = { 'Laki-laki': 0, 'Perempuan': 0 };
        siswa.forEach(s => {
          if (s.jenis_kelamin === 'Laki-laki' || s.jenis_kelamin === 'L') genderStats['Laki-laki']++;
          else if (s.jenis_kelamin === 'Perempuan' || s.jenis_kelamin === 'P') genderStats['Perempuan']++;
        });

        resolve({
          kelasAverages,
          attendanceStats: attStats,
          genderStats,
          nilaiAnalysis: { hasData: nilai.length > 0 }
        });
      } else if (func === 'saveNilaiBatch') {
        const key = 'db_Nilai';
        let data = JSON.parse(localStorage.getItem(key) || '[]');
        args[0].forEach(item => {
          const idx = data.findIndex(d => d.siswa_id === item.siswa_id && d.mapel_id === item.mapel_id && d.jenis_asesmen === item.jenis_asesmen);
          if (idx >= 0) data[idx] = item;
          else data.push(item);
        });
        localStorage.setItem(key, JSON.stringify(data));
        resolve({ success: true });
      } else if (func === 'generateExcelExport') {
        resolve(generateExcelLocal(args[0], args[1]));
      } else if (func === 'generateDocxOrPdfExport') {
        resolve(generatePDFLocal(args[0], args[1], args[2]));
      } else {
        resolve({ success: true });
      }
    } catch (e) {
      reject(e);
    }
  });
}

function downloadFile(result) {
  if (result.base64) {
    const link = document.createElement('a');
    link.href = 'data:application/octet-stream;base64,' + result.base64;
    link.download = result.fileName;
    link.click();
  } else if (result.url) {
    window.open(result.url, '_blank');
  }
}

function generateExcelLocal(menuName, kelasId) {
  const wb = XLSX.utils.book_new();
  let data = [];

  if (menuName === 'Siswa') {
    const siswa = JSON.parse(localStorage.getItem('db_Siswa') || '[]');
    const kelas = JSON.parse(localStorage.getItem('db_Kelas') || '[]');
    data = [['NIS', 'Nama', 'JK', 'Kelas']];
    siswa.forEach(s => {
      const k = kelas.find(k => k.id === s.kelas_id);
      data.push([s.nis || '', s.nama_siswa, s.jenis_kelamin, k ? k.nama_kelas : '']);
    });
  } else if (menuName === 'Nilai') {
    const siswa = JSON.parse(localStorage.getItem('db_Siswa') || '[]');
    const mapel = JSON.parse(localStorage.getItem('db_Mapel') || '[]');
    const nilai = JSON.parse(localStorage.getItem('db_Nilai') || '[]');
    data = [['Nama Siswa', ...mapel.map(m => m.nama_mapel)]];
    siswa.forEach(s => {
      const row = [s.nama_siswa];
      mapel.forEach(m => {
        const n = nilai.filter(nl => nl.siswa_id === s.id && nl.mapel_id === m.id);
        row.push(n.length ? Math.round(n.reduce((a, b) => a + b.nilai, 0) / n.length) : '');
      });
      data.push(row);
    });
  }

  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, menuName);
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  return { fileName: 'Export_' + menuName + '.xlsx', base64: wbout };
}

function generatePDFLocal(menuName, kelasId, format) {
  alert('Fitur PDF export dalam pengembangan untuk versi standalone.');
  return { fileName: 'dummy.pdf', base64: '' };
}
"@

$html += '</script>'

$html += @"
</body>
</html>
"@

# Save to file
$html | Out-File -FilePath $distDir/index.html -Encoding UTF8

Write-Host "Standalone version generated in dist/index.html"
Write-Host "Total size: " + ([math]::Round($html.Length / 1KB, 2)) + " KB"
