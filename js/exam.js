/**
 * js/exam.js
 * Logika Utama Ruang Ujian CBT SSW Pengolahan Makanan
 * Versi Optimasi: Waktu Ujian 70 Menit & Otomatis Kembali ke Halaman Depan Saat Reload
 */

// Deteksi awal sebelum konten dimuat: Jika halaman dimuat karena RELOAD, langsung lempar ke depan
(function () {
    const tipeNavigasi = window.performance && window.performance.getEntriesByType && window.performance.getEntriesByType('navigation')[0];
    if (tipeNavigasi && tipeNavigasi.type === 'reload') {
        window.location.href = 'index.html';
    } else if (window.performance && window.performance.navigation && window.performance.navigation.type === 1) {
        // Fallback untuk browser lama
        window.location.href = 'index.html';
    }
})();

// State default sistem ujian
let sesi = {
    daftarSoal: [],
    indexAktif: 0,
    jawabanUser: {}, // Format: { "KP-001": "A", "SU-002": "B" }
    raguRagu: [],    // Format: ["KP-001", "K3-005"]
    sisaWaktu: 4200  // 70 menit (70 * 60 = 4200 detik)
};

let isPaused = false;
let timerInterval = null;
let ujianSelesaiMurni = false; // Flag untuk membedakan selesai normal vs exit sengaja

// =====================================================
// VALIDASI DATA SESSION AGAR TIDAK CRASH
// =====================================================
function perbaikiStrukturSesi() {
    if (!Array.isArray(sesi.daftarSoal)) {
        sesi.daftarSoal = [];
    }

    if (typeof sesi.jawabanUser !== "object" || sesi.jawabanUser === null) {
        sesi.jawabanUser = {};
    }

    if (!Array.isArray(sesi.raguRagu)) {
        // jika object lama
        if (typeof sesi.raguRagu === "object" && sesi.raguRagu !== null) {
            sesi.raguRagu = Object.keys(sesi.raguRagu);
        }
        // jika string
        else if (typeof sesi.raguRagu === "string") {
            sesi.raguRagu = [sesi.raguRagu];
        }
        // selain itu
        else {
            sesi.raguRagu = [];
        }
    }

    if (!Number.isInteger(sesi.indexAktif)) {
        sesi.indexAktif = 0;
    }

    if (!Number.isInteger(sesi.sisaWaktu)) {
        sesi.sisaWaktu = 4200; // Default 70 menit jika data rusak
    }
}

// Jalankan inisialisasi saat halaman selesai dimuat
document.addEventListener("DOMContentLoaded", () => {
    initUjian();
    
    // AKTIFKAN PROTEKSI REFRESH / CLOSE TAB BROWSER (Peringatan sebelum reload eksekusi)
    window.addEventListener('beforeunload', proteksiReloadBrowser);
});

/**
 * FUNGSI INTERCEPT RELOAD / REFRESH
 * Menampilkan dialog peringatan sistem saat user mencoba melakukan tindakan reload
 */
function proteksiReloadBrowser(e) {
    if (ujianSelesaiMurni) return;

    e.preventDefault();
    e.returnValue = 'Peringatan: Jika Anda mereload halaman ini, Anda akan dikeluarkan dari ruang ujian dan kembali ke halaman utama!';
    return e.returnValue;
}

/**
 * 1. FUNGSI INISIALISASI & LOAD DATA
 */
async function initUjian() {
    try {
        const sesiLokal = localStorage.getItem('ssw_current_exam');
        
        if (sesiLokal) {
            sesi = JSON.parse(sesiLokal);
            
            // Validasi dan amankan data sebelum rendering dijalankan
            perbaikiStrukturSesi();
            simpanSesiLokal();
            
            mulaiTimer();
            renderGridNomor();
            renderSoal();
            updateProgressInfo();
        } else {
            // Ambil data soal baru langsung dari questions.json secara aman
            const response = await fetch('data/questions.json');
            if (!response.ok) throw new Error("Failed to load the question database file.");
            
            const dataSoalSemua = await response.json(); 
            
            // Racik 40 soal acak sesuai proporsi cetak biru (blueprint) resmi
            sesi.daftarSoal = racikSoalSesuaiKuota(dataSoalSemua);
            sesi.indexAktif = 0;
            sesi.jawabanUser = {};
            sesi.raguRagu = [];
            sesi.sisaWaktu = 4200; // Set awal ujian baru: 70 Menit
            
            // Simpan sesi baru ke storage lokal
            simpanSesiLokal();
            
            mulaiTimer();
            renderGridNomor();
            renderSoal();
            updateProgressInfo();
        }
    } catch (error) {
        console.error("Error Init:", error);
        alert("Terjadi kesalahan saat memuat sistem ujian. Pastikan Anda menggunakan Live Server di VS Code.");
    }
}

/**
 * 2. PROPORSI CETAK BIRU SOAL (DISTRIBUTION BACKEND)
 * Mengambil soal acak dari bank data dengan komposisi pas 40 nomor
 */
function racikSoalSesuaiKuota(semuaKategori) {
    // 1. Definisikan target kuota (Total 40 soal)
    const kuotaKategori = {
        "keamanan_pangan_haccp": 18,
        "sanitasi_umum": 10,
        "pengendalian_mutu": 5,
        "hitungan": 2,
        "k3": 5
    };

    let kumpulanSoalTerpilih = [];

    // 2. Ambil soal per kategori sesuai urutan kuotaKategori
    for (const [kategori, jumlahKuota] of Object.entries(kuotaKategori)) {
        const listSoalKategori = semuaKategori[kategori] || [];

        // Acak soal dalam kategori
        const soalDiacak = [...listSoalKategori]
            .sort(() => Math.random() - 0.5);

        // Ambil sesuai kuota
        const diambil = soalDiacak.slice(0, jumlahKuota);

        // Tambahkan ke daftar akhir
        kumpulanSoalTerpilih.push(...diambil);
    }

    console.log(
        "Jumlah soal yang terkumpul: " +
        kumpulanSoalTerpilih.length
    );

    // JANGAN DIACAK LAGI
    return kumpulanSoalTerpilih;
}

/**
 * 3. RENDER KONTEN PERTANYAAN & JAWABAN (Dinamis)
 */
function renderSoal() {
    if (sesi.daftarSoal.length === 0) return;
    
    const soalAktif = sesi.daftarSoal[sesi.indexAktif];
    
    document.getElementById('question-number-title').innerText = `Question ${sesi.indexAktif + 1}`;
    document.getElementById('question-category').innerText = formatNamaKategori(soalAktif.id);
    
    // UBAH DARI .innerText KE .innerHTML AGAR TAG <ruby> DIRENDER SEBAGAI FURIGANA
    const questionElement =
    document.getElementById('question-text');

let isiSoal = soalAktif.question;

if (soalAktif.img) {
    isiSoal += `
        <div style="margin-top:15px;text-align:center;">
            <img
                src="${soalAktif.img}"
                alt="Gambar Soal"
                style="
                    max-width:100%;
                    max-height:400px;
                    border-radius:8px;
                "
                onerror="this.style.display='none'"
            >
        </div>
    `;
}

questionElement.innerHTML = isiSoal;
    
    const containerOpsi = document.querySelector('.options-container');
    containerOpsi.innerHTML = '';
    
    Object.entries(soalAktif.options).forEach(([kunciOpsi, teksOpsi]) => {
        const isSelected = sesi.jawabanUser[soalAktif.id] === kunciOpsi;
        
        const buttonOpsi = document.createElement('button');
        buttonOpsi.className = `option-row ${isSelected ? 'selected' : ''}`;
        buttonOpsi.onclick = () => pilihJawaban(kunciOpsi);
        
        // innerHTML di bawah ini otomatis mendukung tag <ruby> yang ditulis pada teksOpsi
        buttonOpsi.innerHTML = `
            <span class="option-badge">${kunciOpsi}</span>
            <span class="option-text">${teksOpsi}</span>
        `;
        
        containerOpsi.appendChild(buttonOpsi);
    });
    
    const btnFlag = document.getElementById('btn-flag');
    if (btnFlag) {
        if (sesi.raguRagu.includes(soalAktif.id)) {
            btnFlag.classList.add('flagged');
            btnFlag.innerHTML = `<span class="flag-icon">⭐</span> UNSURE`;
        } else {
            btnFlag.classList.remove('flagged');
            btnFlag.innerHTML = `<span class="flag-icon">⭐</span> UNSURE`;
        }
    }
    
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const btnSubmit = document.getElementById('btn-submit');

    if (btnPrev) btnPrev.style.visibility = (sesi.indexAktif === 0) ? 'hidden' : 'visible';
    
    if (sesi.indexAktif === sesi.daftarSoal.length - 1) {
        if (btnNext) btnNext.style.display = 'none';
        if (btnSubmit) btnSubmit.style.display = 'block';
    } else {
        if (btnNext) btnNext.style.display = 'block';
        if (btnSubmit) btnSubmit.style.display = 'none';
    }
    
    updateHighlightGrid();
}

/**
 * 4. RENDER GRID NAVIGASI NOMOR (SIDEBAR KIRI)
 */
function renderGridNomor() {
    const gridContainer = document.getElementById('number-grid');
    if (!gridContainer) return;
    gridContainer.innerHTML = '';
    
    sesi.daftarSoal.forEach((soal, index) => {
        const itemGrid = document.createElement('div');
        itemGrid.className = 'grid-item';
        itemGrid.id = `grid-no-${index}`;
        itemGrid.innerText = index + 1;
        itemGrid.onclick = () => lompatKeSoal(index);
        
        if (sesi.raguRagu.includes(soal.id)) {
            itemGrid.classList.add('ragu');
        } else if (sesi.jawabanUser[soal.id]) {
            itemGrid.classList.add('sudah');
        }
        
        gridContainer.appendChild(itemGrid);
    });
}

function updateHighlightGrid() {
    document.querySelectorAll('.grid-item').forEach(el => el.classList.remove('aktif'));
    
    const itemAktif = document.getElementById(`grid-no-${sesi.indexAktif}`);
    if (itemAktif) itemAktif.classList.add('aktif');
}

function updateStatusWarnaGrid(index, idSoal) {
    const itemGrid = document.getElementById(`grid-no-${index}`);
    if (!itemGrid) return;
    
    itemGrid.classList.remove('sudah', 'ragu');
    
    if (sesi.raguRagu.includes(idSoal)) {
        itemGrid.classList.add('ragu');
    } else if (sesi.jawabanUser[idSoal]) {
        itemGrid.classList.add('sudah');
    }
}

/**
 * 5. FUNGSI KONTROL NAVIGASI & AKSI
 */
function pilihJawaban(hurufOpsi) {
    if (isPaused) return;
    
    const soalAktif = sesi.daftarSoal[sesi.indexAktif];
    sesi.jawabanUser[soalAktif.id] = hurufOpsi;
    
    document.querySelectorAll('.option-row').forEach((row) => {
        if (row.querySelector('.option-badge').innerText === hurufOpsi) {
            row.classList.add('selected');
        } else {
            row.classList.remove('selected');
        }
    });
    
    updateStatusWarnaGrid(sesi.indexAktif, soalAktif.id);
    updateProgressInfo();
    simpanSesiLokal();
}

function toggleRaguRagu() {
    if (isPaused) return;
    
    const soalAktif = sesi.daftarSoal[sesi.indexAktif];
    
    if (sesi.raguRagu.includes(soalAktif.id)) {
        sesi.raguRagu = sesi.raguRagu.filter(id => id !== soalAktif.id);
    } else {
        sesi.raguRagu.push(soalAktif.id);
    }
    
    renderSoal();
    updateStatusWarnaGrid(sesi.indexAktif, soalAktif.id);
    simpanSesiLokal();
}

function soalBerikutnya() {
    if (sesi.indexAktif < sesi.daftarSoal.length - 1) {
        sesi.indexAktif++;
        renderSoal();
        simpanSesiLokal();
    }
}

function soalSebelumnya() {
    if (sesi.indexAktif > 0) {
        sesi.indexAktif--;
        renderSoal();
        simpanSesiLokal();
    }
}

function lompatKeSoal(indexTujuan) {
    if (isPaused) return;
    sesi.indexAktif = indexTujuan;
    renderSoal();
    simpanSesiLokal();
}

function updateProgressInfo() {
    const totalSoal = sesi.daftarSoal.length;
    const jumlahTerjawab = Object.keys(sesi.jawabanUser).length;
    const elProgress = document.getElementById('progress-text');
    if (elProgress) {
        elProgress.innerText = `Answered: ${jumlahTerjawab} / ${totalSoal} Questions`;
    }
}

/**
 * 6. MEKANISME COUNTDOWN TIMER & PAUSE OVERLAY
 */
function mulaiTimer() {
    clearInterval(timerInterval);
    
    // Fungsi pembantu untuk memperbarui visual timer ke layar secara instan
    function updateVisualTimer() {
        const menit = Math.floor(sesi.sisaWaktu / 60);
        const detik = sesi.sisaWaktu % 60;
        
        const elTimer = document.getElementById('countdown-timer');
        if (elTimer) {
            elTimer.innerText = `${menit.toString().padStart(2, '0')}:${detik.toString().padStart(2, '0')}`;
            
            // Jika waktu tersisa kurang dari atau sama dengan 5 menit (300 detik), ubah warna jadi merah
            if (sesi.sisaWaktu <= 300) { 
                elTimer.style.color = '#ef4444';
            } else {
                elTimer.style.color = ''; // Kembalikan ke warna default jika waktu di atas 5 menit (anti-bug resume)
            }
        }
    }

    // Jalankan sekali secara instan di awal agar angka 70:00 langsung berubah ke detik berikutnya tanpa jeda kaku
    updateVisualTimer();

    // Jalankan interval setiap 1000ms (1 detik)
    timerInterval = setInterval(() => {
        if (isPaused) return; 
        
        sesi.sisaWaktu--;
        
        // Perbarui visual teks di layar
        updateVisualTimer();
        
        // Cek kondisi jika waktu habis
        if (sesi.sisaWaktu <= 0) {
            clearInterval(timerInterval);
            ujianSelesaiMurni = true; 
            alert("Waktu pengerjaan simulasi telah habis! Sistem akan otomatis menghitung nilai Anda.");
            eksekusiHitungHasilAkhir();
            return; // Hentikan eksekusi kode di bawahnya
        }
        
        // Auto-save progress ke LocalStorage setiap 5 detik
        if (sesi.sisaWaktu % 5 === 0) {
            simpanSesiLokal();
        }
    }, 1000);
}

function togglePauseExam() {
    const modal = document.getElementById('pause-modal');
    const btn = document.getElementById('btn-pause');
    
    isPaused = !isPaused;
    
    if (isPaused) {
        // 1. Tampilkan modal
        if (modal) modal.classList.add('active');
        
        // 2. Tambahkan class 'paused' ke body untuk memicu efek blur CSS
        document.body.classList.add('paused');
        
        // 3. Ubah teks tombol
        if (btn) {
            btn.innerText = "▶ Resume";
            btn.style.backgroundColor = "#10b981";
        }
    } else {
        // 1. Hilangkan modal
        if (modal) modal.classList.remove('active');
        
        // 2. Hapus class 'paused' dari body agar blur hilang
        document.body.classList.remove('paused');
        
        // 3. Reset teks dan warna tombol
        if (btn) {
            btn.innerText = "⏸ Pause";
            btn.style.backgroundColor = ""; // Kembali ke warna default CSS
        }
    }
}
/**
 * 7. SELESAI UJIAN & PERHITUNGAN SKOR
 */
function prosesSelesaiUjian() {
    const totalSoal = sesi.daftarSoal.length;
    const jumlahTerjawab = Object.keys(sesi.jawabanUser).length;
    const sisaSoal = totalSoal - jumlahTerjawab;
    
    let pesanKonfirmasi = `Are you sure, FINISH TEST?`;
    if (sisaSoal > 0) {
        pesanKonfirmasi = `WARNING: There are still ${sisaSoal} questions you have NOT answered.\n\n${pesanKonfirmasi}`;
    }
    if (sesi.raguRagu.length > 0) {
        pesanKonfirmasi = `INFO: There are ${sesi.raguRagu.length} questions you have marked as Uncertain.\n\n${pesanKonfirmasi}`;
    }
    
    if (confirm(pesanKonfirmasi)) {
        ujianSelesaiMurni = true; 
        eksekusiHitungHasilAkhir();
    }
}

function eksekusiHitungHasilAkhir() {
    clearInterval(timerInterval);
    
    let totalBenar = 0;
    let totalSalah = 0;
    
    let analisisKategori = {
        "keamanan_pangan_haccp": { benar: 0, total: 0 },
        "sanitasi_umum": { benar: 0, total: 0 },
        "pengendalian_mutu": { benar: 0, total: 0 },
        "hitungan": { benar: 0, total: 0 },
        "k3": { benar: 0, total: 0 }
    };
    
    sesi.daftarSoal.forEach((soal) => {
        const kodeKategori = dapatkanKodeKategoriDariId(soal.id);
        const jawabanBenar = soal.correct_answer.toUpperCase().trim();
        const jawabanUser = (sesi.jawabanUser[soal.id] || '').toUpperCase().trim();
        
        if (analisisKategori[kodeKategori]) {
            analisisKategori[kodeKategori].total++;
        }
        
        if (jawabanUser === jawabanBenar) {
            totalBenar++;
            if (analisisKategori[kodeKategori]) analisisKategori[kodeKategori].benar++;
        } else {
            totalSalah++;
        }
    });
    
    const skorAkhir = Math.round((totalBenar / sesi.daftarSoal.length) * 100);
    
    if (typeof simpanHasilUjian === "function") {
        simpanHasilUjian(skorAkhir, totalBenar, totalSalah, analisisKategori);
    } else {
        let riwayatSsw = JSON.parse(localStorage.getItem('ssw_exam_history') || '[]');
        riwayatSsw.push({
            tanggal: new Date().toLocaleDateString('id-ID'),
            skor: skorAkhir,
            benar: totalBenar,
            salah: totalSalah,
            analisis: analisisKategori,
            daftarSoal: sesi.daftarSoal,
            jawabanUser: sesi.jawabanUser
        });
        localStorage.setItem('ssw_exam_history', JSON.stringify(riwayatSsw));
    }
    
    window.location.href = 'review.html';
}

function finishUjian() {
    if (!confirm("Are you sure, FINISH TEST?")) return;

    ujianSelesaiMurni = true;

    clearInterval(timerInterval); // penting: stop timer

    eksekusiHitungHasilAkhir(); // hitung skor + pindah halaman
}

/**
 * 8. UTILITY HELPER FUNCTIONS (Pengolah String & Simpan Data)
 */
function simpanSesiLokal() {
    perbaikiStrukturSesi();
    localStorage.setItem('ssw_current_exam', JSON.stringify(sesi));
}

function dapatkanKodeKategoriDariId(idSoal) {
    if (idSoal.startsWith('KP-')) return 'keamanan_pangan_haccp';
    if (idSoal.startsWith('SU-')) return 'sanitasi_umum';
    if (idSoal.startsWith('PM-')) return 'pengendalian_mutu';
    if (idSoal.startsWith('HT-')) return 'hitungan';
    if (idSoal.startsWith('K3-')) return 'k3';
    return 'keamanan_pangan_haccp';
}

function formatNamaKategori(idSoal) {
    if (idSoal.startsWith('KP-')) return 'HACCP & Keamanan Pangan';
    if (idSoal.startsWith('SU-')) return 'Sanitasi Umum & Pekerja';
    if (idSoal.startsWith('PM-')) return 'Pengendalian Mutu Proses';
    if (idSoal.startsWith('HT-')) return 'Hitungan';
    if (idSoal.startsWith('K3-')) return 'Keselamatan & Kesehatan Kerja (K3)';
    return 'Pengolahan Makanan';
}