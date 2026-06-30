const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const DB_PATH = path.join(__dirname, 'database_mock.json');

// Helper to read DB
function readDb() {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading mock database:', err);
    return {};
  }
}

// Helper to write DB
function writeDb(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing mock database:', err);
    return false;
  }
}

// Template Includer for GAS style <?!= include('filename') ?>
function compileGasTemplates() {
  const indexPath = path.join(__dirname, '../gas/Index.html');
  if (!fs.existsSync(indexPath)) {
    return `<h3>Error: gas/Index.html not found. Please create files first.</h3>`;
  }
  let content = fs.readFileSync(indexPath, 'utf8');
  
  const includeRegex = /<\?!=\s*include\(['"]([^'"]+)['"]\);\s*\?>/g;
  let match;
  let iterations = 0;
  const maxIterations = 50;
  
  while ((match = includeRegex.exec(content)) !== null && iterations < maxIterations) {
    const filename = match[1];
    const filePath = path.join(__dirname, `../gas/${filename}.html`);
    let fileContent = '';
    if (fs.existsSync(filePath)) {
      fileContent = fs.readFileSync(filePath, 'utf8');
    } else {
      fileContent = `<!-- Include Error: ${filename}.html not found -->`;
      console.warn(`Include file not found: ${filePath}`);
    }
    content = content.replace(match[0], fileContent);
    includeRegex.lastIndex = 0;
    iterations++;
  }
  
  const scriptInject = `
    <script>
      window.IS_SIMULATOR = true;
      console.log("Running in Google Apps Script Local Simulator mode.");
    </script>
  `;
  content = content.replace('</head>', scriptInject + '</head>');
  
  return content;
}

// Route to serve compiled frontend
app.get('/', (req, res) => {
  res.send(compileGasTemplates());
});

// Mocking backend functions called by google.script.run
app.post('/api/run', (req, res) => {
  const { functionName, args } = req.body;
  const db = readDb();
  
  console.log(`[google.script.run] Calling: ${functionName}`, args);
  
  try {
    let result = null;
    
    switch (functionName) {
      case 'initDatabase': {
        result = "Database berhasil diinisialisasi di simulator!";
        break;
      }
      case 'getSettings': {
        const settings = {};
        (db.Settings || []).forEach(item => {
          settings[item.key] = item.value;
        });
        result = settings;
        break;
      }
      case 'saveSettings': {
        const settingsObj = args[0];
        db.Settings = Object.keys(settingsObj).map(key => ({
          key: key,
          value: settingsObj[key]
        }));
        writeDb(db);
        result = { success: true };
        break;
      }
      case 'readData': {
        const sheetName = args[0];
        result = db[sheetName] || [];
        break;
      }
      case 'createData': {
        const sheetName = args[0];
        const newItem = args[1];
        if (!db[sheetName]) db[sheetName] = [];
        
        let prefix = 'ID';
        if (sheetName === 'Kelas') prefix = 'K';
        else if (sheetName === 'Siswa') prefix = 'S';
        else if (sheetName === 'Mapel') prefix = 'M';
        else if (sheetName === 'Kaldik') prefix = 'KD';
        else if (sheetName === 'Prota') prefix = 'PT';
        else if (sheetName === 'Promes') prefix = 'PR';
        else if (sheetName === 'Rpe') prefix = 'RPE';
        else if (sheetName === 'Jurnal') prefix = 'J';
        else if (sheetName === 'Presensi') prefix = 'P';
        else if (sheetName === 'Nilai') prefix = 'N';
        else if (sheetName === 'Jadwal') prefix = 'JW';
        
        newItem.id = prefix + String(db[sheetName].length + 1).padStart(3, '0');
        db[sheetName].push(newItem);
        writeDb(db);
        result = newItem;
        break;
      }
      case 'updateData': {
        const sheetName = args[0];
        const id = args[1];
        const updatedItem = args[2];
        if (!db[sheetName]) db[sheetName] = [];
        
        const idx = db[sheetName].findIndex(item => item.id === id);
        if (idx !== -1) {
          db[sheetName][idx] = { ...db[sheetName][idx], ...updatedItem, id: id };
          writeDb(db);
          result = db[sheetName][idx];
        } else {
          // Setting update fallback by key
          if (sheetName === 'Settings') {
            const sIdx = db.Settings.findIndex(item => item.key === id);
            if (sIdx !== -1) {
              db.Settings[sIdx].value = updatedItem.value;
              writeDb(db);
              result = db.Settings[sIdx];
              break;
            }
          }
          throw new Error(`Record with ID ${id} not found in ${sheetName}`);
        }
        break;
      }
      case 'deleteData': {
        const sheetName = args[0];
        const id = args[1];
        if (!db[sheetName]) db[sheetName] = [];
        
        const initialLen = db[sheetName].length;
        db[sheetName] = db[sheetName].filter(item => item.id !== id);
        
        // Kaldik deletion fallback by tanggal
        if (sheetName === 'Kaldik' && db.Kaldik.length === initialLen) {
          db.Kaldik = db.Kaldik.filter(item => item.tanggal !== id);
        }

        writeDb(db);
        result = db[sheetName].length < initialLen;
        break;
      }
      case 'importSiswa': {
        const siswaList = args[0];
        if (!db.Siswa) db.Siswa = [];
        
        siswaList.forEach((siswa, index) => {
          siswa.id = 'S' + String(db.Siswa.length + 1).padStart(3, '0');
          db.Siswa.push(siswa);
        });
        writeDb(db);
        result = { success: true, count: siswaList.length };
        break;
      }
      case 'getDashboardSummary': {
        const totalKelas = (db.Kelas || []).length;
        const totalSiswa = (db.Siswa || []).length;
        const totalMapel = (db.Mapel || []).length;
        
        const today = new Date();
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const currentDayName = days[today.getDay()];
        const scheduleToday = (db.Jadwal || []).filter(j => j.hari === currentDayName).length;
        
        const totalPresensi = (db.Presensi || []).length;
        const totalHadir = (db.Presensi || []).filter(p => p.status === 'H').length;
        const attendanceRate = totalPresensi > 0 ? Math.round((totalHadir / totalPresensi) * 100) : 100;
        
        result = {
          totalKelas,
          totalSiswa,
          totalMapel,
          scheduleToday,
          attendanceRate,
          teacherName: (db.Settings || []).find(s => s.key === 'nama_guru')?.value || 'Guru',
          nip: (db.Settings || []).find(s => s.key === 'nip')?.value || '-',
          tahunAjaran: (db.Settings || []).find(s => s.key === 'tahun_ajaran')?.value || '-',
          semester: (db.Settings || []).find(s => s.key === 'semester')?.value || '-'
        };
        break;
      }
      case 'saveJurnalDanPresensi': {
        const jurnalData = args[0];
        const presensiList = args[1];
        
        if (!db.Jurnal) db.Jurnal = [];
        if (!db.Presensi) db.Presensi = [];
        
        const jurnalId = 'J' + String(db.Jurnal.length + 1).padStart(3, '0');
        jurnalData.id = jurnalId;
        db.Jurnal.push(jurnalData);
        
        presensiList.forEach(p => {
          const presensiId = 'P' + String(db.Presensi.length + 1).padStart(3, '0');
          db.Presensi.push({
            id: presensiId,
            jurnal_id: jurnalId,
            siswa_id: p.siswa_id,
            status: p.status
          });
        });
        
        writeDb(db);
        result = { success: true, jurnalId };
        break;
      }
      case 'calculateRPE': {
        const bulan = args[0];
        const year = 2026;
        let monthIdx = 6;
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
        const idMonthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
        
        let idx = monthNames.indexOf(bulan);
        if (idx === -1) idx = idMonthNames.indexOf(bulan);
        if (idx !== -1) monthIdx = idx;
        
        const firstDay = new Date(year, monthIdx, 1);
        const lastDay = new Date(year, monthIdx + 1, 0);
        const totalDays = lastDay.getDate();
        
        const totalWeeks = Math.ceil(totalDays / 7);
        
        const monthlyKaldik = (db.Kaldik || []).filter(k => {
          const d = new Date(k.tanggal);
          return d.getMonth() === monthIdx && d.getFullYear() === year;
        });
        
        let weeksLibur = 0;
        const processedWeeks = new Set();
        
        monthlyKaldik.forEach(k => {
          if (k.kategori === 'Libur' || k.kategori === 'Ujian') {
            const d = new Date(k.tanggal);
            const weekNo = Math.ceil(d.getDate() / 7);
            if (!processedWeeks.has(weekNo)) {
              processedWeeks.add(weekNo);
              weeksLibur++;
            }
          }
        });
        
        const mingguEfektif = Math.max(0, totalWeeks - weeksLibur);
        
        result = {
          bulan: bulan,
          totalMinggu: totalWeeks,
          mingguLibur: weeksLibur,
          mingguEfektif: mingguEfektif
        };
        break;
      }
      case 'saveNilaiBatch': {
        const nilaiList = args[0];
        if (!db.Nilai) db.Nilai = [];
        
        nilaiList.forEach(item => {
          const idx = db.Nilai.findIndex(n => 
            n.siswa_id === item.siswa_id && 
            n.mapel_id === item.mapel_id && 
            n.jenis_asesmen === item.jenis_asesmen
          );
          if (idx !== -1) {
            db.Nilai[idx].nilai = Number(item.nilai);
          } else {
            const id = 'N' + String(db.Nilai.length + 1).padStart(3, '0');
            db.Nilai.push({
              id,
              siswa_id: item.siswa_id,
              mapel_id: item.mapel_id,
              jenis_asesmen: item.jenis_asesmen,
              nilai: Number(item.nilai)
            });
          }
        });
        
        writeDb(db);
        result = { success: true };
        break;
      }
      case 'saveJadwalBatch': {
        const jadwalList = args[0];
        if (!db.Jadwal) db.Jadwal = [];
        
        jadwalList.forEach(item => {
          const idx = db.Jadwal.findIndex(jw => jw.hari === item.hari && jw.jam_ke === Number(item.jam_ke));
          if (idx !== -1) {
            if (item.kelas_id && item.mapel_id) {
              db.Jadwal[idx] = { ...db.Jadwal[idx], kelas_id: item.kelas_id, mapel_id: item.mapel_id };
            } else {
              db.Jadwal.splice(idx, 1);
            }
          } else if (item.kelas_id && item.mapel_id) {
            const id = 'JW' + String(db.Jadwal.length + 1).padStart(3, '0');
            db.Jadwal.push({
              id,
              hari: item.hari,
              jam_ke: Number(item.jam_ke),
              kelas_id: item.kelas_id,
              mapel_id: item.mapel_id
            });
          }
        });
        
        writeDb(db);
        result = { success: true };
        break;
      }
      case 'savePromesBatch': {
        const promesList = args[0];
        if (!db.Promes) db.Promes = [];
        
        promesList.forEach(item => {
          const idx = db.Promes.findIndex(pr => pr.prota_id === item.prota_id && pr.bulan_minggu === item.bulan_minggu);
          if (idx !== -1) {
            db.Promes[idx].jp_alokasi = Number(item.jp_alokasi);
          } else {
            const id = 'PR' + String(db.Promes.length + 1).padStart(3, '0');
            db.Promes.push({
              id,
              prota_id: item.prota_id,
              bulan_minggu: item.bulan_minggu,
              jp_alokasi: Number(item.jp_alokasi)
            });
          }
        });
        
        writeDb(db);
        result = { success: true };
        break;
      }
      
      case 'saveRpeBatch': {
        const [mapelId, kelasId, semester, dataJsonStr] = args;
        if (!db.Rpe) db.Rpe = [];
        
        const idx = db.Rpe.findIndex(r => r.mapel_id === mapelId && r.kelas_id === kelasId && r.semester === semester);
        if (idx !== -1) {
          db.Rpe[idx].data_json = dataJsonStr;
        } else {
          const id = 'RPE' + String(db.Rpe.length + 1).padStart(3, '0');
          db.Rpe.push({ id, mapel_id: mapelId, kelas_id: kelasId, semester, data_json: dataJsonStr });
        }
        
        writeDb(db);
        result = { success: true };
        break;
      }
      case 'readRpe': {
        const [mapelId, kelasId, semester] = args;
        if (!db.Rpe) db.Rpe = [];
        
        const found = db.Rpe.find(r => r.mapel_id === mapelId && r.kelas_id === kelasId && r.semester === semester);
        result = found || null;
        break;
      }

      case 'getAnalitikData': {
        const kelasGrades = [];
        const kelases = db.Kelas || [];
        const siswas = db.Siswa || [];
        const nilais = db.Nilai || [];
        
        kelases.forEach(k => {
          const siswaIdsInKelas = siswas.filter(s => s.kelas_id === k.id).map(s => s.id);
          const nilaisInKelas = nilais.filter(n => siswaIdsInKelas.includes(n.siswa_id));
          const totalScore = nilaisInKelas.reduce((sum, curr) => sum + curr.nilai, 0);
          const avg = nilaisInKelas.length > 0 ? Math.round((totalScore / nilaisInKelas.length) * 10) / 10 : 0;
          kelasGrades.push({
            kelas: k.nama_kelas,
            rataRata: avg
          });
        });
        
        const attendanceStats = { Hadir: 0, Sakit: 0, Izin: 0, Alfa: 0 };
        (db.Presensi || []).forEach(p => {
          if (p.status === 'H') attendanceStats.Hadir++;
          else if (p.status === 'S') attendanceStats.Sakit++;
          else if (p.status === 'I') attendanceStats.Izin++;
          else if (p.status === 'A') attendanceStats.Alfa++;
        });
        
        result = {
          kelasAverages: kelasGrades,
          attendanceStats
        };
        break;
      }
      
      // Export functions
      case 'generateExcelExport': {
        const [menuName, targetKelas] = args;
        const wb = xlsx.utils.book_new();
        let dataRows = [];
        
        if (menuName === 'Siswa') {
          dataRows = db.Siswa.filter(s => !targetKelas || s.kelas_id === targetKelas).map(s => ({
            'NIS': s.nis,
            'NISN': s.nisn,
            'Nama Siswa': s.nama_siswa,
            'Jenis Kelamin': s.jenis_kelamin,
            'Kelas': db.Kelas.find(k => k.id === s.kelas_id)?.nama_kelas || ''
          }));
        } else if (menuName === 'Nilai') {
          dataRows = db.Siswa.filter(s => !targetKelas || s.kelas_id === targetKelas).map(s => {
            const row = { 'Nama Siswa': s.nama_siswa };
            const mList = db.Mapel || [];
            mList.forEach(m => {
              const types = ['Tugas', 'Formatif', 'Sumatif', 'PAS'];
              let total = 0, count = 0;
              types.forEach(t => {
                const item = db.Nilai.find(n => n.siswa_id === s.id && n.mapel_id === m.id && n.jenis_asesmen === t);
                row[`${m.nama_mapel} (${t})`] = item ? item.nilai : '';
                if (item) {
                  total += item.nilai;
                  count++;
                }
              });
              row[`Rata-rata ${m.nama_mapel}`] = count > 0 ? Math.round(total / count) : '';
            });
            return row;
          });
        } else {
          dataRows = [{ 'Status': `Data ${menuName} berhasil disimulasikan untuk ekspor.` }];
        }
        
        const ws = xlsx.utils.json_to_sheet(dataRows);
        xlsx.utils.book_append_sheet(wb, ws, menuName);
        
        const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        result = {
          fileName: `Ekspor_${menuName}_${targetKelas || 'Semua'}.xlsx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          base64: buf.toString('base64')
        };
        break;
      }
      case 'generateDocxOrPdfExport': {
        const [menuName, targetKelas, formatType, mapelId] = args;
        const targetKlsObj = db.Kelas.find(k => k.id === targetKelas);
        const targetMapelObj = db.Mapel.find(m => m.id === mapelId);
        
        const text = `
          DINAS PENDIDIKAN DAN KEBUDAYAAN
          SMP NEGERI 3 BESUKI
          Jalan Raya Besuki No. 12, Besuki, Situbondo
          ==================================================
          
          DOKUMEN RESMI: ${menuName === 'Rpe' ? 'RINCIAN PEKAN EFEKTIF' : menuName.toUpperCase()}
          Mata Pelajaran: ${targetMapelObj ? targetMapelObj.nama_mapel : '-'}
          Kelas: ${targetKlsObj ? targetKlsObj.nama_kelas : 'Semua Kelas'}
          Semester: ${db.Settings.find(s => s.key === 'semester')?.value || '-'}
          Tahun Pelajaran: ${db.Settings.find(s => s.key === 'tahun_ajaran')?.value || '-'}
          
          Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}
          
          [ Dokumen disimulasikan dalam format ${formatType.toUpperCase()} ]
          
          ---
          Mengetahui,
          Kepala Sekolah,                   Besuki, ${new Date().toLocaleDateString('id-ID')}
                                            Guru Mata Pelajaran,
          
          Drs. Agus Sugianto                ${db.Settings.find(s => s.key === 'nama_guru')?.value || 'Nama Guru'}
          NIP. 196808171994121005           NIP. ${db.Settings.find(s => s.key === 'nip')?.value || '-'}
        `;
        
        const base64 = Buffer.from(text).toString('base64');
        result = {
          fileName: `Laporan_${menuName}_${targetKelas || 'Semua'}.${formatType === 'pdf' ? 'pdf' : 'docx'}`,
          mimeType: formatType === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          base64: base64
        };
        break;
      }
      
      default:
        throw new Error(`Function ${functionName} not implemented in Simulator.`);
    }
    
    res.json({ success: true, data: result });
  } catch (err) {
    console.error(`Error executing ${functionName}:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Run server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  WebApp Administrasi Guru Simulator is running!`);
  console.log(`  Local URL: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
