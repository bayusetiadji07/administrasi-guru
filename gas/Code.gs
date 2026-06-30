/**
 * WebApp Administrasi Guru Berbasis Google Apps Script
 * Backend Script (Code.gs)
 */

// ============================================
// PENGATURAN: Ganti dengan ID Spreadsheet Anda
// Buka spreadsheet Anda -> Copy URL -> ID ada di antara /d/ dan /edit
// Contoh: https://docs.google.com/spreadsheets/d/ABC123XYZ/edit -> ID: ABC123XYZ
// ============================================
const SPREADSHEET_ID = 'MASUKKAN_ID_SPREADSHEET_ANDA_DISINI';

function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Administrasi Guru')
    .setSandboxMode(HtmlService.SandboxMode.IFRAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Mendapatkan Spreadsheet Database.
 */
function getDb() {
  // Jika menggunakan spreadsheet eksternal
  if (SPREADSHEET_ID !== 'MASUKKAN_ID_SPREADSHEET_ANDA_DISINI') {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  // Jika menggunakan spreadsheet yang sama dengan Apps Script
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Inisialisasi Database Sheet dan Data Awal - BERSIHKAN SEMUA DATA.
 * Jalankan fungsi ini untuk mereset database ke kondisi kosong.
 */
function initDatabase() {
  var ss = getDb();
  var allSheets = ss.getSheets();

  // Hapus semua sheet yang ada
  for (var i = 0; i < allSheets.length; i++) {
    try {
      ss.deleteSheet(allSheets[i]);
    } catch(e) {
      console.log('Tidak dapat menghapus sheet: ' + allSheets[i].getName());
    }
  }

  // Buat ulang semua sheet dengan header kosong
  var sheets = {
    'Kelas': ['id', 'nama_kelas', 'wali_kelas', 'keterangan'],
    'Siswa': ['id', 'nis', 'nisn', 'nama_siswa', 'kelas_id', 'jenis_kelamin'],
    'Mapel': ['id', 'nama_mapel', 'kkm', 'jp_mingguan'],
    'Kaldik': ['tanggal', 'keterangan', 'kategori'],
    'Prota': ['id', 'mapel_id', 'kelas_id', 'semester', 'tujuan_pembelajaran', 'alokasi_jp'],
    'Promes': ['id', 'prota_id', 'bulan_minggu', 'jp_alokasi'],
    'Rpe': ['id', 'mapel_id', 'kelas_id', 'semester', 'data_json'],
    'Jurnal': ['id', 'tanggal', 'kelas_id', 'mapel_id', 'materi', 'kegiatan_pembelajaran', 'hambatan', 'solusi'],
    'Presensi': ['id', 'jurnal_id', 'siswa_id', 'status'],
    'Nilai': ['id', 'siswa_id', 'mapel_id', 'jenis_asesmen', 'nilai'],
    'Jadwal': ['id', 'hari', 'jam_ke', 'kelas_id', 'mapel_id'],
    'Settings': ['key', 'value']
  };

  for (var name in sheets) {
    var sheet = ss.insertSheet(name);
    sheet.appendRow(sheets[name]);

    // Styling header
    var range = sheet.getRange(1, 1, 1, sheets[name].length);
    range.setFontWeight('bold');
    range.setBackground('#4F46E5');
    range.setFontColor('#FFFFFF');
  }

  return "Database berhasil di-reset ke kondisi kosong!";
}

/**
 * Membaca semua data dari sheet tertentu sebagai array object.
 */
function readData(sheetName) {
  var cache = CacheService.getScriptCache();
  if (['Kelas', 'Siswa', 'Mapel'].indexOf(sheetName) !== -1) {
    var cached = cache.get('db_' + sheetName);
    if (cached) {
      return JSON.parse(cached);
    }
  }

  var ss = getDb();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();
  if (lastRow < 2) return [];

  var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  var values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  
  var list = [];
  for (var i = 0; i < values.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var val = values[i][j];
      // Format Date to YYYY-MM-DD
      if (val instanceof Date) {
        obj[headers[j]] = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      } else {
        obj[headers[j]] = val;
      }
    }
    list.push(obj);
  }

  // Cache data yang jarang berubah selama 10 menit
  if (['Kelas', 'Siswa', 'Mapel'].indexOf(sheetName) !== -1) {
    cache.put('db_' + sheetName, JSON.stringify(list), 600);
  }

  return list;
}

/**
 * Menghapus Cache data.
 */
function clearCache(sheetName) {
  var cache = CacheService.getScriptCache();
  cache.remove('db_' + sheetName);
  cache.remove('dashboard_summary');
}

/**
 * Membuat data baru di sheet tertentu.
 */
function createData(sheetName, item) {
  var ss = getDb();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("Sheet " + sheetName + " tidak ditemukan.");

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Auto ID generator if not provided and headers has 'id'
  if (headers.indexOf('id') !== -1 && !item.id) {
    var lastRow = sheet.getLastRow();
    var nextNum = 1;
    if (lastRow >= 2) {
      var ids = sheet.getRange(2, headers.indexOf('id') + 1, lastRow - 1, 1).getValues();
      var max = 0;
      for (var i = 0; i < ids.length; i++) {
        var cleanId = String(ids[i][0]).replace(/^\D+/g, '');
        var num = parseInt(cleanId, 10);
        if (!isNaN(num) && num > max) max = num;
      }
      nextNum = max + 1;
    }
    var prefix = sheetName.substring(0, 2).toUpperCase();
    item.id = prefix + String(nextNum).padStart(3, '0');
  }

  var row = [];
  for (var i = 0; i < headers.length; i++) {
    row.push(item[headers[i]] !== undefined ? item[headers[i]] : '');
  }

  sheet.appendRow(row);
  clearCache(sheetName);
  return item;
}

/**
 * Mengupdate data di sheet tertentu berdasarkan ID.
 */
function updateData(sheetName, id, updatedItem) {
  var ss = getDb();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("Sheet " + sheetName + " tidak ditemukan.");

  var lastRow = sheet.getLastRow();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idColIdx = headers.indexOf('id') + 1;
  
  if (idColIdx === 0) {
    if (sheetName === 'Settings') {
      var keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var k = 0; k < keys.length; k++) {
        if (keys[k][0] === id) {
          sheet.getRange(k + 2, 2).setValue(updatedItem.value);
          break;
        }
      }
      clearCache(sheetName);
      return updatedItem;
    }
    throw new Error("Kolom ID tidak ditemukan di sheet " + sheetName);
  }

  var ids = sheet.getRange(2, idColIdx, lastRow - 1, 1).getValues();
  var rowToUpdate = -1;
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) {
      rowToUpdate = i + 2;
      break;
    }
  }

  if (rowToUpdate === -1) throw new Error("Data dengan ID " + id + " tidak ditemukan.");

  for (var j = 0; j < headers.length; j++) {
    var key = headers[j];
    if (updatedItem[key] !== undefined && key !== 'id') {
      sheet.getRange(rowToUpdate, j + 1).setValue(updatedItem[key]);
    }
  }

  clearCache(sheetName);
  return updatedItem;
}

/**
 * Menghapus data di sheet tertentu berdasarkan ID.
 */
function deleteData(sheetName, id) {
  var ss = getDb();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("Sheet " + sheetName + " tidak ditemukan.");

  var lastRow = sheet.getLastRow();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idColIdx = headers.indexOf('id') + 1;

  if (idColIdx === 0) {
    // Kaldik deletion fallback by date if id is missing
    if (sheetName === 'Kaldik') {
      var dates = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var d = 0; d < dates.length; d++) {
        var fmtD = Utilities.formatDate(dates[d][0], Session.getScriptTimeZone(), 'yyyy-MM-dd');
        if (fmtD === id) {
          sheet.deleteRow(d + 2);
          clearCache(sheetName);
          return true;
        }
      }
    }
    throw new Error("Kolom ID tidak ditemukan.");
  }

  var ids = sheet.getRange(2, idColIdx, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) {
      sheet.deleteRow(i + 2);
      clearCache(sheetName);
      return true;
    }
  }
  return false;
}

/**
 * Mendapatkan konfigurasi settings global.
 */
function getSettings() {
  var settings = readData('Settings');
  var obj = {};
  settings.forEach(function(item) {
    obj[item.key] = item.value;
  });
  return obj;
}

/**
 * Menyimpan konfigurasi settings global.
 */
function saveSettings(settingsObj) {
  for (var key in settingsObj) {
    updateData('Settings', key, { value: settingsObj[key] });
  }
  return { success: true };
}

/**
 * Impor Massal Data Siswa.
 */
function importSiswa(siswaList) {
  siswaList.forEach(function(siswa) {
    createData('Siswa', siswa);
  });
  return { success: true, count: siswaList.length };
}

/**
 * Ringkasan data untuk Dashboard.
 */
function getDashboardSummary() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('dashboard_summary');
  if (cached) {
    return JSON.parse(cached);
  }

  var kelas = readData('Kelas');
  var siswa = readData('Siswa');
  var mapel = readData('Mapel');
  var jadwal = readData('Jadwal');
  var presensi = readData('Presensi');
  var settings = getSettings();

  var today = new Date();
  var days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  var currentDayName = days[today.getDay()];
  
  var scheduleToday = jadwal.filter(function(j) { return j.hari === currentDayName; }).length;
  
  var totalPresensi = presensi.length;
  var totalHadir = presensi.filter(function(p) { return p.status === 'H'; }).length;
  var attendanceRate = totalPresensi > 0 ? Math.round((totalHadir / totalPresensi) * 100) : 100;

  var summary = {
    totalKelas: kelas.length,
    totalSiswa: siswa.length,
    totalMapel: mapel.length,
    scheduleToday: scheduleToday,
    attendanceRate: attendanceRate,
    teacherName: settings.nama_guru || 'Guru',
    nip: settings.nip || '-',
    tahunAjaran: settings.tahun_ajaran || '-',
    semester: settings.semester || '-'
  };

  cache.put('dashboard_summary', JSON.stringify(summary), 300);
  return summary;
}

/**
 * Simpan Jurnal Mengajar dan Presensi secara bersamaan.
 */
function saveJurnalDanPresensi(jurnalData, presensiList) {
  var newJurnal = createData('Jurnal', jurnalData);
  var jurnalId = newJurnal.id;

  presensiList.forEach(function(item) {
    createData('Presensi', {
      jurnal_id: jurnalId,
      siswa_id: item.siswa_id,
      status: item.status
    });
  });

  return { success: true, jurnalId: jurnalId };
}

/**
 * Hitung Pekan Efektif (RPE) berdasarkan Kalender Pendidikan (Kaldik)
 */
function calculateRPE(bulan) {
  var settings = getSettings();
  var targetTahun = settings.tahun_ajaran ? parseInt(settings.tahun_ajaran.split('/')[0]) : 2026;
  
  var monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  var idMonthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  var monthIdx = monthNames.indexOf(bulan);
  if (monthIdx === -1) monthIdx = idMonthNames.indexOf(bulan);
  if (monthIdx === -1) monthIdx = 6;
  
  if (monthIdx < 6 && settings.tahun_ajaran) {
    targetTahun = parseInt(settings.tahun_ajaran.split('/')[1]);
  }

  var firstDay = new Date(targetTahun, monthIdx, 1);
  var lastDay = new Date(targetTahun, monthIdx + 1, 0);
  var totalDays = lastDay.getDate();
  var totalWeeks = Math.ceil(totalDays / 7);

  var kaldik = readData('Kaldik');
  var monthlyKaldik = kaldik.filter(function(k) {
    var d = new Date(k.tanggal);
    return d.getMonth() === monthIdx && d.getFullYear() === targetTahun;
  });

  var processedWeeks = [];
  var weeksLibur = 0;
  
  monthlyKaldik.forEach(function(k) {
    if (k.kategori === 'Libur' || k.kategori === 'Ujian') {
      var d = new Date(k.tanggal);
      var weekNo = Math.ceil(d.getDate() / 7);
      if (processedWeeks.indexOf(weekNo) === -1) {
        processedWeeks.push(weekNo);
        weeksLibur++;
      }
    }
  });

  var mingguEfektif = Math.max(0, totalWeeks - weeksLibur);

  return {
    bulan: bulan,
    totalMinggu: totalWeeks,
    mingguLibur: weeksLibur,
    mingguEfektif: mingguEfektif
  };
}

/**
 * Menyimpan data nilai massal dari spreadsheet-like input.
 */
function saveNilaiBatch(nilaiList) {
  var ss = getDb();
  var sheet = ss.getSheetByName('Nilai');
  if (!sheet) throw new Error("Sheet Nilai tidak ditemukan.");
  
  var currentNilai = readData('Nilai');

  nilaiList.forEach(function(item) {
    var matchIdx = -1;
    for (var i = 0; i < currentNilai.length; i++) {
      if (currentNilai[i].siswa_id === item.siswa_id && 
          currentNilai[i].mapel_id === item.mapel_id && 
          currentNilai[i].jenis_asesmen === item.jenis_asesmen) {
        matchIdx = i;
        break;
      }
    }

    if (matchIdx !== -1) {
      var id = currentNilai[matchIdx].id;
      updateData('Nilai', id, { nilai: Number(item.nilai) });
    } else {
      createData('Nilai', {
        siswa_id: item.siswa_id,
        mapel_id: item.mapel_id,
        jenis_asesmen: item.jenis_asesmen,
        nilai: Number(item.nilai)
      });
    }
  });

  clearCache('Nilai');
  return { success: true };
}

/**
 * Menyimpan data Jadwal massal.
 */
function saveJadwalBatch(jadwalList) {
  var currentJadwal = readData('Jadwal');

  jadwalList.forEach(function(item) {
    var matchIdx = -1;
    for (var i = 0; i < currentJadwal.length; i++) {
      if (currentJadwal[i].hari === item.hari && Number(currentJadwal[i].jam_ke) === Number(item.jam_ke)) {
        matchIdx = i;
        break;
      }
    }

    if (matchIdx !== -1) {
      if (item.kelas_id && item.mapel_id) {
        updateData('Jadwal', currentJadwal[matchIdx].id, {
          kelas_id: item.kelas_id,
          mapel_id: item.mapel_id
        });
      } else {
        deleteData('Jadwal', currentJadwal[matchIdx].id);
      }
    } else if (item.kelas_id && item.mapel_id) {
      createData('Jadwal', {
        hari: item.hari,
        jam_ke: Number(item.jam_ke),
        kelas_id: item.kelas_id,
        mapel_id: item.mapel_id
      });
    }
  });

  clearCache('Jadwal');
  return { success: true };
}

/**
 * Menyimpan alokasi Program Semester massal.
 */
function savePromesBatch(promesList) {
  var currentPromes = readData('Promes');

  promesList.forEach(function(item) {
    var matchIdx = -1;
    for (var i = 0; i < currentPromes.length; i++) {
      if (currentPromes[i].prota_id === item.prota_id && currentPromes[i].bulan_minggu === item.bulan_minggu) {
        matchIdx = i;
        break;
      }
    }

    if (matchIdx !== -1) {
      updateData('Promes', currentPromes[matchIdx].id, { jp_alokasi: Number(item.jp_alokasi) });
    } else {
      createData('Promes', {
        prota_id: item.prota_id,
        bulan_minggu: item.bulan_minggu,
        jp_alokasi: Number(item.jp_alokasi)
      });
    }
  });

  clearCache('Promes');
  return { success: true };
}

/**
 * Menyimpan data RPE.
 */
function saveRpeBatch(mapelId, kelasId, semester, dataJsonStr) {
  var currentRpe = readData('Rpe');
  var matchIdx = -1;
  for (var i = 0; i < currentRpe.length; i++) {
    if (currentRpe[i].mapel_id === mapelId && 
        currentRpe[i].kelas_id === kelasId && 
        currentRpe[i].semester === semester) {
      matchIdx = i;
      break;
    }
  }
  
  if (matchIdx !== -1) {
    updateData('Rpe', currentRpe[matchIdx].id, { data_json: dataJsonStr });
  } else {
    createData('Rpe', {
      mapel_id: mapelId,
      kelas_id: kelasId,
      semester: semester,
      data_json: dataJsonStr
    });
  }
  
  clearCache('Rpe');
  return { success: true };
}

/**
 * Membaca data RPE.
 */
function readRpe(mapelId, kelasId, semester) {
  var rpeList = readData('Rpe');
  for (var i = 0; i < rpeList.length; i++) {
    if (rpeList[i].mapel_id === mapelId && 
        rpeList[i].kelas_id === kelasId && 
        rpeList[i].semester === semester) {
      return rpeList[i];
    }
  }
  return null;
}

/**
 * Mengambil data Analitik gabungan.
 */
function getAnalitikData() {
  try {
    var kelas = readData('Kelas') || [];
    var siswa = readData('Siswa') || [];
    var nilai = readData('Nilai') || [];
    var presensi = readData('Presensi') || [];
    var mapel = readData('Mapel') || [];
    var settings = getSettings() || {};

    var kelasAverages = [];
    kelas.forEach(function(k) {
      var siswaIdsInKelas = siswa.filter(function(s) { return s.kelas_id === k.id; }).map(function(s) { return s.id; });
      var nilaisInKelas = nilai.filter(function(n) { return siswaIdsInKelas.indexOf(n.siswa_id) !== -1; });
      var totalScore = nilaisInKelas.reduce(function(sum, curr) { return sum + curr.nilai; }, 0);
      var avg = nilaisInKelas.length > 0 ? Math.round((totalScore / nilaisInKelas.length) * 10) / 10 : 0;

      kelasAverages.push({
        kelas: k.nama_kelas || 'Kelas',
        rataRata: avg
      });
    });

    var attendanceStats = { Hadir: 0, Sakit: 0, Izin: 0, Alfa: 0 };
    if (presensi && presensi.length > 0) {
      presensi.forEach(function(p) {
        if (p.status === 'H') attendanceStats.Hadir++;
        else if (p.status === 'S') attendanceStats.Sakit++;
        else if (p.status === 'I') attendanceStats.Izin++;
        else if (p.status === 'A') attendanceStats.Alfa++;
      });
    }

    // Gender Stats
    var genderStats = { 'Laki-laki': 0, 'Perempuan': 0 };
    if (siswa && siswa.length > 0) {
      siswa.forEach(function(s) {
        if (s.jenis_kelamin === 'Laki-laki' || s.jenis_kelamin === 'L') {
          genderStats['Laki-laki']++;
        } else if (s.jenis_kelamin === 'Perempuan' || s.jenis_kelamin === 'P') {
          genderStats['Perempuan']++;
        }
      });
    }

    // Nilai Analysis
    var nilaiAnalysis = analyzeNilaiData(nilai, siswa, mapel, settings);

    return {
      kelasAverages: kelasAverages,
      attendanceStats: attendanceStats,
      genderStats: genderStats,
      nilaiAnalysis: nilaiAnalysis
    };
  } catch(e) {
    console.log('Error in getAnalitikData: ' + e.toString());
    return {
      kelasAverages: [],
      attendanceStats: { Hadir: 0, Sakit: 0, Izin: 0, Alfa: 0 },
      genderStats: { 'Laki-laki': 0, 'Perempuan': 0 },
      nilaiAnalysis: { hasData: false }
    };
  }
}

/**
 * Analisis detail data nilai.
 */
function analyzeNilaiData(nilai, siswa, mapel, settings) {
  try {
    if (!nilai || nilai.length === 0 || !siswa || siswa.length === 0) {
      return { hasData: false };
    }

    var siswaMap = {};
    siswa.forEach(function(s) { siswaMap[s.id] = s; });

    var mapelMap = {};
    if (mapel && mapel.length > 0) {
      mapel.forEach(function(m) { mapelMap[m.id] = m; });
    }

    var defaultKkm = 75;

    // Calculate average per student per mapel
    var studentAverages = {};

    nilai.forEach(function(n) {
      if (!n.siswa_id || !n.mapel_id) return;
      if (!studentAverages[n.siswa_id]) {
        studentAverages[n.siswa_id] = {};
      }
      if (!studentAverages[n.siswa_id][n.mapel_id]) {
        studentAverages[n.siswa_id][n.mapel_id] = [];
      }
      if (typeof n.nilai === 'number') {
        studentAverages[n.siswa_id][n.mapel_id].push(n.nilai);
      }
    });

    // Calculate final averages
    var allAverages = [];
    var allScores = [];

    for (var sid in studentAverages) {
      var s = siswaMap[sid];
      if (!s) continue;

      for (var mid in studentAverages[sid]) {
        var scores = studentAverages[sid][mid];
        if (!scores || scores.length === 0) continue;

        var avg = scores.reduce(function(a, b) { return a + b; }, 0) / scores.length;
        var mapelObj = mapelMap[mid];
        var kkm = mapelObj ? (parseInt(mapelObj.kkm) || defaultKkm) : defaultKkm;

        allAverages.push({
          siswaId: sid,
          siswaNama: s.nama_siswa || 'Siswa',
          mapelId: mid,
          mapelNama: mapelObj ? mapelObj.nama_mapel : '-',
          nilai: Math.round(avg),
          kkm: kkm
        });
        allScores.push(Math.round(avg));
      }
    }

    if (allAverages.length === 0) {
      return { hasData: false };
    }

    // Find highest and lowest
    var sorted = allAverages.sort(function(a, b) { return b.nilai - a.nilai; });
    var highest = sorted[0] || { nilai: '-', nama: '-', mapel: '-' };
    var lowest = sorted[sorted.length - 1] || { nilai: '-', nama: '-', mapel: '-' };

    // Calculate KKM pass rate
    var siswaUnique = {};
    var siswaLulus = {};

    allAverages.forEach(function(a) {
      var sid = a.siswaId;
      if (!siswaUnique[sid]) {
        siswaUnique[sid] = true;
        siswaLulus[sid] = true;
      }
      if (a.nilai < a.kkm) {
        siswaLulus[sid] = false;
      }
    });

    var totalSiswa = Object.keys(siswaUnique).length;
    var lulusCount = 0;
    var tidakLulusCount = 0;

    for (var sid in siswaUnique) {
      if (siswaLulus[sid]) {
        lulusCount++;
      } else {
        tidakLulusCount++;
      }
    }

    var persentaseLulus = totalSiswa > 0 ? Math.round((lulusCount / totalSiswa) * 100) : 0;
    var persentaseTidakLulus = 100 - persentaseLulus;

    // Distribusi Nilai
    var distribusiNilai = {
      sangatKurang: 0,
      kurang: 0,
      cukup: 0,
      baik: 0,
      sangatBaik: 0
    };

    allScores.forEach(function(score) {
      if (score < 50) distribusiNilai.sangatKurang++;
      else if (score >= 50 && score < 70) distribusiNilai.kurang++;
      else if (score >= 70 && score < 80) distribusiNilai.cukup++;
      else if (score >= 80 && score < 90) distribusiNilai.baik++;
      else distribusiNilai.sangatBaik++;
    });

    return {
      hasData: true,
      totalSiswa: totalSiswa,
      nilaiTertinggi: {
        nilai: highest.nilai,
        nama: highest.siswaNama,
        mapel: highest.mapelNama
      },
      nilaiTerendah: {
        nilai: lowest.nilai,
        nama: lowest.siswaNama,
        mapel: lowest.mapelNama
      },
      siswaLulusKkm: lulusCount,
      siswaTidakLulus: tidakLulusCount,
      persentaseLulus: persentaseLulus,
      persentaseTidakLulus: persentaseTidakLulus,
      distribusiNilai: distribusiNilai
    };
  } catch(e) {
    console.log('Error in analyzeNilaiData: ' + e.toString());
    return { hasData: false };
  }
}

/**
 * Ekspor Data ke Excel (.xlsx).
 */
function generateExcelExport(menuName, targetKelas) {
  var ss = getDb();
  var tempSs = SpreadsheetApp.create("Ekspor_Temp_" + menuName);
  var tempSheet = tempSs.getActiveSheet();
  tempSheet.setName(menuName);

  var dataRows = [];
  var headers = [];

  if (menuName === 'Siswa') {
    headers = ['NIS', 'NISN', 'Nama Siswa', 'Jenis Kelamin', 'Kelas'];
    var siswa = readData('Siswa');
    var kelas = readData('Kelas');
    
    siswa.filter(function(s) { return !targetKelas || s.kelas_id === targetKelas; })
      .forEach(function(s) {
        var kName = kelas.find(function(k) { return k.id === s.kelas_id; });
        dataRows.push([
          s.nis,
          s.nisn,
          s.nama_siswa,
          s.jenis_kelamin,
          kName ? kName.nama_kelas : ''
        ]);
      });
  } else if (menuName === 'Nilai') {
    var siswa = readData('Siswa').filter(function(s) { return !targetKelas || s.kelas_id === targetKelas; });
    var mapel = readData('Mapel');
    var nilai = readData('Nilai');

    // Get dynamic columns from settings
    var defaultTypes = ['Tugas', 'Formatif', 'Sumatif', 'PAS'];
    var kelasAsesmenMap = {};
    try {
      if (settings.asesmen_columns) {
        kelasAsesmenMap = JSON.parse(settings.asesmen_columns);
      }
    } catch(e) {}

    headers = ['Nama Siswa'];
    mapel.forEach(function(m) {
      var types = kelasAsesmenMap[m.id] || defaultTypes;
      types.forEach(function(t) {
        headers.push(m.nama_mapel + ' (' + t + ')');
      });
      headers.push('Rata-rata ' + m.nama_mapel);
    });

    siswa.forEach(function(s) {
      var row = [s.nama_siswa];
      mapel.forEach(function(m) {
        var types = kelasAsesmenMap[m.id] || defaultTypes;
        var sum = 0, count = 0;
        types.forEach(function(t) {
          var valItem = nilai.find(function(n) {
            return n.siswa_id === s.id && n.mapel_id === m.id && n.jenis_asesmen === t;
          });
          var score = valItem ? valItem.nilai : '';
          row.push(score);
          if (score !== '') {
            sum += score;
            count++;
          }
        });
        row.push(count > 0 ? Math.round(sum / count) : '');
      });
      dataRows.push(row);
    });
  } else if (menuName === 'Prota') {
    var mapel = readData('Mapel');
    var kelas = readData('Kelas');
    var prota = readData('Prota').filter(function(p) { return !targetKelas || p.kelas_id === targetKelas; });
    var mapelObj = mapel.find(function(m) { return m.id === mapelId; });
    var kelasObj = kelas.find(function(k) { return k.id === targetKelas; });

    headers = ['Semester', 'Tujuan Pembelajaran', 'Alokasi JP'];

    // Ganjil
    var ganjilProta = prota.filter(function(p) { return p.semester === 'Ganjil'; });
    var genapProta = prota.filter(function(p) { return p.semester === 'Genap'; });

    // Total counters
    var totalGanjil = 0;
    var totalGenap = 0;

    // Ganjil Section
    if (ganjilProta.length > 0) {
      tempSheet.appendRow(['GANJIL', '', '']);
      ganjilProta.forEach(function(p) {
        totalGanjil += Number(p.alokasi_jp);
        dataRows.push(['-', p.tujuan_pembelajaran, p.alokasi_jp + ' JP']);
      });
    }
    tempSheet.appendRow(['-', 'JUMLAH ALOKASI JP GANJIL', String(totalGanjil) + ' JP']);
    tempSheet.appendRow(['']);

    // Genap Section
    if (genapProta.length > 0) {
      tempSheet.appendRow(['GENAP', '', '']);
      genapProta.forEach(function(p) {
        totalGenap += Number(p.alokasi_jp);
        dataRows.push(['-', p.tujuan_pembelajaran, p.alokasi_jp + ' JP']);
      });
    }
    tempSheet.appendRow(['-', 'JUMLAH ALOKASI JP GENAP', String(totalGenap) + ' JP']);
    tempSheet.appendRow(['-', 'TOTAL ALOKASI JP SELURUHNYA', String(totalGanjil + totalGenap) + ' JP']);

    // Append all data rows
    dataRows.forEach(function(r) {
      tempSheet.appendRow(r);
    });
  }

  tempSheet.appendRow(headers);
  dataRows.forEach(function(r) {
    tempSheet.appendRow(r);
  });

  var range = tempSheet.getRange(1, 1, 1, headers.length);
  range.setFontWeight('bold');
  range.setBackground('#E5E7EB');
  range.setBorder(true, true, true, true, true, true);
  
  if (dataRows.length > 0) {
    var dataRange = tempSheet.getRange(2, 1, dataRows.length, headers.length);
    dataRange.setBorder(true, true, true, true, true, true);
  }

  SpreadsheetApp.flush();

  var url = tempSs.getUrl().replace(/edit$/, '') + 'export?format=xlsx';
  var token = ScriptApp.getOAuthToken();
  var response = UrlFetchApp.fetch(url, {
    headers: {
      'Authorization': 'Bearer ' + token
    },
    muteHttpExceptions: true
  });

  var blob = response.getBlob();
  var base64 = Utilities.base64Encode(blob.getBytes());
  DriveApp.getFileById(tempSs.getId()).setTrashed(true);

  return {
    fileName: "Ekspor_" + menuName + "_" + (targetKelas ? targetKelas : "Semua") + ".xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    base64: base64
  };
}

/**
 * Ekspor Data ke Word (.docx) atau PDF Resmi berbasis Google Docs Template.
 * Disesuaikan dengan layout PDF RPE dan Promes yang dilampirkan.
 */
function generateDocxOrPdfExport(menuName, targetKelas, formatType, mapelId, tanggal) {
  var settings = getSettings();
  var doc = DocumentApp.create("Laporan_" + menuName + "_Temp");
  var body = doc.getBody();

  // Margin 1.5 cm
  body.setMarginTop(42.5);
  body.setMarginBottom(42.5);
  body.setMarginLeft(42.5);
  body.setMarginRight(42.5);

  var kelasObj = readData('Kelas').find(function(k) { return k.id === targetKelas; });
  var mapelObj = readData('Mapel').find(function(m) { return m.id === mapelId; });

  // Dynamic school info from settings
  var namaSekolah = settings.nama_sekolah || 'SMP Negeri 3 Besuki';
  var alamat = settings.alamat || '';
  var telepon = settings.telepon || '';
  var email = settings.email || '';
  var kepalaSekolah = settings.kepala_sekolah || 'Drs. Agus Sugianto';
  var nipKs = settings.nip_kepala_sekolah || '196808171994121005';

  // Format contact info
  var contactParts = [];
  if (alamat) contactParts.push(alamat);
  if (telepon) contactParts.push('Telp: ' + telepon);
  if (email) contactParts.push('Email: ' + email);
  var contactInfo = contactParts.join(' | ');

  // 1. Kop Surat Resmi Dinamis
  var headerPara = body.appendParagraph("PEMERINTAH PROVINSI JAWA TIMUR\nDINAS PENDIDIKAN\n" + namaSekolah.toUpperCase() + "\n" + contactInfo);
  headerPara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  headerPara.setFontFamily("Arial");
  headerPara.setFontSize(10);
  headerPara.setBold(true);

  var linePara = body.appendParagraph("=========================================================================");
  linePara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  linePara.setBold(true);

  body.appendParagraph("\n");

  // Title Laporan
  var docTitle = 'LAPORAN RESMI';
  if (menuName === 'Rpe') {
    docTitle = 'RINCIAN PEKAN EFEKTIF';
  } else if (menuName === 'Promes') {
    docTitle = 'PROGRAM SEMESTER';
  } else if (menuName === 'Prota') {
    docTitle = 'PROGRAM TAHUNAN';
  }
  var titlePara = body.appendParagraph(docTitle);
  titlePara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  titlePara.setFontSize(14);
  titlePara.setBold(true);

  // Metadata Meta Info
  var metaText = "";
  if (menuName === 'Rpe' || menuName === 'Promes' || menuName === 'Prota') {
    metaText = "MATA PELAJARAN : " + (mapelObj ? mapelObj.nama_mapel : '-') + "\n" +
               "SEKOLAH : SMP Negeri 3 Besuki\n" +
               "KELAS : " + (kelasObj ? kelasObj.nama_kelas : '-') + "\n" +
               "SEMESTER : " + (settings.semester || '-') + "\n" +
               "TAHUN PELAJARAN : " + (settings.tahun_ajaran || '-');
  } else {
    metaText = "Tahun Ajaran: " + (settings.tahun_ajaran || '-') + " | Semester: " + (settings.semester || '-') + "\n" +
               "Kelas: " + (kelasObj ? kelasObj.nama_kelas : 'Semua Kelas');
  }
  
  var metaPara = body.appendParagraph(metaText);
  metaPara.setFontSize(10);
  metaPara.setFontFamily("Arial");
  metaPara.setLineSpacing(1.15);

  body.appendParagraph("\n");

  // 2. Isi Laporan Berdasarkan Menu
  if (menuName === 'Rpe') {
    // Ambil data Rpe dari DB
    var rpeDataObj = null;
    var rpeRec = readRpe(mapelId, targetKelas, settings.semester);
    if (rpeRec && rpeRec.data_json) {
      rpeDataObj = JSON.parse(rpeRec.data_json);
    }

    if (rpeDataObj) {
      body.appendParagraph("A. PERHITUNGAN PEKAN EFEKTIF SEKOLAH").setBold(true);
      
      // I. Jumlah Pekan Dalam Satu Semester
      body.appendParagraph("I. Jumlah Pekan Dalam Satu Semester:");
      var tableWeeks = [['No', 'Bulan', 'Jumlah Pekan']];
      var listMonths = settings.semester === 'Ganjil' ? 
        ['Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'] : 
        ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni'];
      
      var sumWeeks = 0;
      listMonths.forEach(function(m, idx) {
        var numWeeks = rpeDataObj.pekanBulanan[m] || 4;
        sumWeeks += numWeeks;
        tableWeeks.push([String(idx + 1), m, String(numWeeks)]);
      });
      tableWeeks.push(['', 'Jumlah Pekan', String(sumWeeks) + ' ( A )']);
      
      var tw = body.appendTable(tableWeeks);
      tw.setBorderColor('#9CA3AF');
      tw.setBorderWidth(1);
      
      body.appendParagraph("\nII. Jumlah Pekan Tidak Efektif:");
      var tableHolidays = [['No', 'Bulan', 'Kegiatan', 'Jumlah Pekan']];
      var sumHolidays = 0;
      (rpeDataObj.kegiatanLibur || []).forEach(function(item, idx) {
        sumHolidays += Number(item.pekan);
        tableHolidays.push([String(idx + 1), item.bulan, item.kegiatan, String(item.pekan)]);
      });
      tableHolidays.push(['', 'Jumlah', '', String(sumHolidays) + ' ( B )']);
      
      var th = body.appendTable(tableHolidays);
      th.setBorderColor('#9CA3AF');
      th.setBorderWidth(1);

      body.appendParagraph("\nIII. Jumlah Pekan Efektif dalam Satu Semester:");
      var rpeResultVal = sumWeeks - sumHolidays;
      body.appendParagraph("Jumlah Pekan Efektif = " + sumWeeks + " - " + sumHolidays + " = " + rpeResultVal + " Pekan ( C )").setBold(true);

      body.appendParagraph("\nB. PERHITUNGAN JAM EFEKTIF").setBold(true);
      body.appendParagraph("I. Rincian Penggunaan Pekan Efektif:");
      var tableUsage = [['No', 'Rincian', 'Jumlah Pekan']];
      (rpeDataObj.rincianPenggunaan || []).forEach(function(item, idx) {
        tableUsage.push([String(idx + 1), item.rincian, String(item.pekan)]);
      });
      
      var tu = body.appendTable(tableUsage);
      tu.setBorderColor('#9CA3AF');
      tu.setBorderWidth(1);

      var jpPerWeek = mapelObj ? mapelObj.jp_mingguan : 5;
      body.appendParagraph("\nKalkulasi Jam Pelajaran (JP):");
      body.appendParagraph("Jumlah Jam Efektif = " + rpeResultVal + " x " + jpPerWeek + " = " + (rpeResultVal * jpPerWeek) + " JP ( D )");
      
      var pbmRow = (rpeDataObj.rincianPenggunaan || []).find(function(item) { return item.rincian.toUpperCase().indexOf('PBM') !== -1; });
      var pbmWeeks = pbmRow ? Number(pbmRow.pekan) : rpeResultVal;
      body.appendParagraph("Jumlah Jam PBM = " + pbmWeeks + " x " + jpPerWeek + " = " + (pbmWeeks * jpPerWeek) + " JP");
    } else {
      body.appendParagraph("Data perhitungan Rencana Pekan Efektif belum disimpan di sistem.");
    }
  } else if (menuName === 'Promes') {
    // Generate Promes Table
    var listProta = readData('Prota').filter(function(p) { return p.kelas_id === targetKelas && p.mapel_id === mapelId && p.semester === settings.semester; });
    var listPromes = readData('Promes');
    var listJurnal = readData('Jurnal').filter(function(j) { return j.kelas_id === targetKelas && j.mapel_id === mapelId; });

    var months = settings.semester === 'Ganjil' ? 
      ['Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'] : 
      ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun'];

    // Header 1
    var promesHeaders = ['No', 'Tujuan Pembelajaran', 'Alokasi Waktu'];
    months.forEach(function(m) {
      promesHeaders.push(m + ' (W1)', m + ' (W2)', m + ' (W3)', m + ' (W4)', m + ' (W5)');
    });
    promesHeaders.push('Rencana', 'Real');

    var tablePromesData = [promesHeaders];
    
    listProta.forEach(function(p, idx) {
      var row = [String(idx + 1), p.tujuan_pembelajaran, String(p.alokasi_jp) + ' JP'];
      
      var sumPlanned = 0;
      months.forEach(function(m) {
        for (var w = 1; w <= 5; w++) {
          const colKey = m + '-W' + w;
          var item = listPromes.find(function(pr) { return pr.prota_id === p.id && pr.bulan_minggu === colKey; });
          var jpVal = item ? item.jp_alokasi : 0;
          sumPlanned += jpVal;
          row.push(jpVal > 0 ? String(jpVal) : '-');
        }
      });

      // Count Realization from Jurnal (filter matching TP)
      // E.g. search if jurnal materi contains keyword or match count
      var sumReal = 0;
      listJurnal.forEach(function(j) {
        if (j.materi && p.tujuan_pembelajaran && 
            (j.materi.toLowerCase().indexOf(p.tujuan_pembelajaran.toLowerCase()) !== -1 || 
             p.tujuan_pembelajaran.toLowerCase().indexOf(j.materi.toLowerCase()) !== -1)) {
          sumReal += 2; // Estimate 2 JP per logged journal
        }
      });
      sumReal = Math.min(sumReal, p.alokasi_jp); // Cap at max allocation

      row.push(String(sumPlanned), String(sumReal));
      tablePromesData.push(row);
    });

    var tp = body.appendTable(tablePromesData);
    tp.setBorderColor('#9CA3AF');
    tp.setBorderWidth(1);
    tp.setFontSize(8);
  } else if (menuName === 'Prota') {
    // Generate Prota Table (Clean version without standard rows)
    var listProta = readData('Prota').filter(function(p) { return p.kelas_id === targetKelas && p.mapel_id === mapelId; });

    // Header Table
    var protaHeaders = [['Semester', 'Tujuan Pembelajaran', 'Alokasi JP']];
    var protaTableData = [protaHeaders[0]];

    var ganjilProta = listProta.filter(function(p) { return p.semester === 'Ganjil'; });
    var genapProta = listProta.filter(function(p) { return p.semester === 'Genap'; });

    var totalGanjil = 0;
    var totalGenap = 0;

    // Ganjil Section
    protaTableData.push(['GANJIL', '', '']);
    if (ganjilProta.length > 0) {
      ganjilProta.forEach(function(p) {
        totalGanjil += Number(p.alokasi_jp);
        protaTableData.push(['-', p.tujuan_pembelajaran, p.alokasi_jp + ' JP']);
      });
    } else {
      protaTableData.push(['-', '(Belum ada Tujuan Pembelajaran)', '-']);
    }
    protaTableData.push(['-', 'JUMLAH ALOKASI JP GANJIL', totalGanjil + ' JP']);
    protaTableData.push(['', '', '']);

    // Genap Section
    protaTableData.push(['GENAP', '', '']);
    if (genapProta.length > 0) {
      genapProta.forEach(function(p) {
        totalGenap += Number(p.alokasi_jp);
        protaTableData.push(['-', p.tujuan_pembelajaran, p.alokasi_jp + ' JP']);
      });
    } else {
      protaTableData.push(['-', '(Belum ada Tujuan Pembelajaran)', '-']);
    }
    protaTableData.push(['-', 'JUMLAH ALOKASI JP GENAP', totalGenap + ' JP']);
    protaTableData.push(['-', 'TOTAL ALOKASI JP SELURUHNYA', (totalGanjil + totalGenap) + ' JP']);

    var protaTable = body.appendTable(protaTableData);
    protaTable.setBorderColor('#9CA3AF');
    protaTable.setBorderWidth(1);
    protaTable.setFontSize(10);
  } else if (menuName === 'Jurnal') {
    var jurnal = readData('Jurnal').filter(function(j) { return !targetKelas || j.kelas_id === targetKelas; });
    var mapel = readData('Mapel');
    var kelas = readData('Kelas');
    
    var tableData = [['No', 'Tanggal', 'Kelas', 'Mata Pelajaran', 'Materi & Pembelajaran']];
    jurnal.forEach(function(j, idx) {
      var k = kelas.find(function(kls) { return kls.id === j.kelas_id; });
      var m = mapel.find(function(map) { return map.id === j.mapel_id; });
      tableData.push([
        String(idx + 1),
        j.tanggal,
        k ? k.nama_kelas : '',
        m ? m.nama_mapel : '',
        "Tujuan Pembelajaran: " + j.materi + "\nKegiatan: " + j.kegiatan_pembelajaran + "\nHambatan: " + (j.hambatan || '-') + "\nSolusi: " + (j.solusi || '-')
      ]);
    });

    var table = body.appendTable(tableData);
    table.setBorderColor('#9CA3AF');
    table.setBorderWidth(1);
  }

  body.appendParagraph("\n\n");

  // 3. Blok Tanda Tangan Resmi Dinamis
  // Format tanggal
  var formattedDate = tanggal || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'd MMMM yyyy');
  var parts = formattedDate.split(' ');
  if (parts.length >= 3) {
    var day = parts[0];
    var month = parts[1];
    var year = parts[2];
    var indonesianMonths = {
      'January': 'Januari', 'February': 'Februari', 'March': 'Maret', 'April': 'April',
      'May': 'Mei', 'June': 'Juni', 'July': 'Juli', 'August': 'Agustus',
      'September': 'September', 'October': 'Oktober', 'November': 'November', 'December': 'Desember',
      'Jan': 'Januari', 'Feb': 'Februari', 'Mar': 'Maret', 'Apr': 'April',
      'May': 'Mei', 'Jun': 'Juni', 'Jul': 'Juli', 'Agu': 'Agustus',
      'Sep': 'September', 'Oct': 'Oktober', 'Nov': 'November', 'Dec': 'Desember'
    };
    month = indonesianMonths[month] || month;
    formattedDate = day + ' ' + month + ' ' + year;
  }

  var ttdTableData = [
    ["Mengetahui,\nKepala " + namaSekolah, "\n" + formattedDate + "\nGuru Mata Pelajaran"],
    ["\n\n\n\n" + kepalaSekolah + "\nNIP. " + nipKs, "\n\n\n\n" + (settings.nama_guru || 'Nama Guru') + "\nNIP. " + (settings.nip || '-')]
  ];
  
  var ttdTable = body.appendTable(ttdTableData);
  ttdTable.setBorderColor('#FFFFFF'); // Border transparan untuk tanda tangan
  
  ttdTable.getRow(0).getCell(0).getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  ttdTable.getRow(0).getCell(1).getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  ttdTable.getRow(1).getCell(0).getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  ttdTable.getRow(1).getCell(1).getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  doc.saveAndClose();

  var fileId = doc.getId();
  var file = DriveApp.getFileById(fileId);
  var blob;
  var mimeType;
  var ext;

  if (formatType === 'pdf') {
    blob = file.getAs('application/pdf');
    mimeType = 'application/pdf';
    ext = 'pdf';
  } else {
    var url = "https://docs.google.com/feeds/download/documents/export/Export?id=" + fileId + "&exportFormat=docx";
    var response = UrlFetchApp.fetch(url, {
      headers: { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    });
    blob = response.getBlob();
    mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    ext = 'docx';
  }

  var base64 = Utilities.base64Encode(blob.getBytes());
  file.setTrashed(true);

  return {
    fileName: "Laporan_" + menuName + "_" + (kelasObj ? kelasObj.nama_kelas : "Semua") + "." + ext,
    mimeType: mimeType,
    base64: base64
  };
}
