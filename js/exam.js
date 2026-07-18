/**
 * js/exam.js
 * Logika Utama Ruang Ujian CBT SSW
 * Versi Optimasi: Waktu Ujian sesuai config bidang & Otomatis Kembali ke Halaman Depan Saat Reload
 * + Terapkan tema/branding per bidang dari config.json
 * + Generic multi-bidang: kategori & label soal dibaca dari config.json bidang aktif (questionConfig / categoryLabels)
 */

// Deteksi awal sebelum konten dimuat: Jika halaman dimuat karena RELOAD, langsung lempar ke depan
(function () {
    const tipeNavigasi = window.performance && window.performance.getEntriesByType && window.performance.getEntriesByType('navigation')[0];
    const isReload = (tipeNavigasi && tipeNavigasi.type === 'reload') ||
                      (window.performance && window.performance.navigation && window.performance.navigation.type === 1);

    if (isReload) {
        // Hapus sesi ujian yang sedang berjalan agar tidak bisa dilanjutkan lagi
        localStorage.removeItem('ssw_current_exam');
        window.location.href = 'dashboard.html';
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

// Config bidang aktif (di-load lewat loadConfig di initUjian) — disimpan global
// agar bisa dipakai juga oleh eksekusiHitungHasilAkhir() dan formatNamaKategori()
let configBidangAktif = null;

let isPaused = false;
let timerInterval = null;
let ujianSelesaiMurni = false; // Flag untuk membedakan selesai normal vs exit sengaja

// =====================================================
// HAPUS SESI JIKA USER KELUAR HALAMAN (tutup tab, tombol back, pindah URL)
// KECUALI ujian memang sudah selesai secara normal (submit / waktu habis)
// =====================================================
window.addEventListener('pagehide', () => {
    if (!ujianSelesaiMurni) {
        localStorage.removeItem('ssw_current_exam');
    }
});

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

// =====================================================
// TERAPKAN TEMA & BRANDING SESUAI BIDANG (config.json)
// =====================================================
function applyExamTheme(config, kategoriFolder) {
    if (!config) return;

    // Judul & subjudul header
    // Catatan: #exam-title sengaja TIDAK diisi dari config lagi,
    // karena sekarang teksnya statis "特定技能1号" untuk semua bidang (lihat exam.html)

    const testNameEl = document.getElementById('test-name');
    if (testNameEl) testNameEl.innerHTML = config.examHeader || config.displayName || '';

    // Warna tema (primary color) untuk tombol, grid aktif, badge kategori
    if (config.theme && config.theme.primary) {
        const color = config.theme.primary;
        const styleTag = document.createElement('style');
        styleTag.id = 'exam-theme-style';
        styleTag.innerHTML = `
            .btn-nav.btn-primary {
                background: ${color} !important;
                border-color: ${color} !important;
            }
            .grid-item.aktif {
                background: ${color} !important;
                color: #fff !important;
                border-color: ${color} !important;
            }

            .category-badge {
                background: ${color} !important;
            }
        `;
        document.head.appendChild(styleTag);
    }

    // Gambar background per bidang
    // Catatan: pakai `kategoriFolder` (key folder asli, mis. "kaigo"/"pm" dari getActiveCategory()),
    // BUKAN config.category — karena config.category kadang berisi label tampilan
    // (mis. "Care Worker" di data/kaigo/config.json), bukan nama folder, yang menyebabkan 404.
    if (config.theme && config.theme.background && kategoriFolder) {
        document.body.style.backgroundImage =
            `url('data/${kategoriFolder}/${config.theme.background}')`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundAttachment = 'fixed';
    }

    // Judul tab browser (statis untuk semua bidang, tidak mengikuti config.json)
    document.title = 'CBT Room';
}

// Jalankan inisialisasi saat halaman selesai dimuat
document.addEventListener("DOMContentLoaded", () => {
    initUjian();

    document.querySelectorAll(".option-row")
        .forEach(btn => {
            btn.addEventListener(
                "click",
                function () {
                    pilihJawaban(this.dataset.option);
                }
            );
        });

    // Sambungkan tombol kontrol ke fungsi yang sudah ada
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const btnFlag = document.getElementById('btn-flag');
    const btnPause = document.getElementById('btn-pause');
    const btnResume = document.getElementById('btn-resume');
    const btnFinish = document.getElementById('btn-finish');
    const btnSubmit = document.getElementById('btn-submit');

    if (btnPrev) btnPrev.addEventListener('click', soalSebelumnya);
    if (btnNext) btnNext.addEventListener('click', soalBerikutnya);
    if (btnFlag) btnFlag.addEventListener('click', toggleRaguRagu);
    if (btnPause) btnPause.addEventListener('click', togglePauseExam);
    if (btnResume) btnResume.addEventListener('click', togglePauseExam);
    if (btnFinish) btnFinish.addEventListener('click', prosesSelesaiUjian);
    if (btnSubmit) btnSubmit.addEventListener('click', prosesSelesaiUjian);

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
        const kategoriAktif = getActiveCategory();

        if (!kategoriAktif) {
            alert("Pilih bidang ujian terlebih dahulu.");
            window.location.href = 'dashboard.html';
            return;
        }

        // Ambil config bidang (kuota soal, durasi, label kategori) secara dinamis
        const configBidang = await loadConfig(kategoriAktif);

        // Simpan ke variabel global agar bisa dipakai fungsi lain (mis. saat hitung hasil akhir)
        configBidangAktif = configBidang;

        // Terapkan branding/tema (judul, warna, background) sesuai config bidang aktif
        // kategoriAktif dikirim terpisah karena config.category tidak selalu berisi nama folder yang benar
        applyExamTheme(configBidang, kategoriAktif);

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
            // Ambil data soal baru langsung dari questions.json sesuai kategori aktif
            const response = await fetch(
                `data/${kategoriAktif}/questions.json`
            );
            if (!response.ok) throw new Error("Failed to load the question database file.");

            const dataSoalSemua = await response.json();

            // Racik soal sesuai proporsi cetak biru (blueprint) dari config.json
            sesi.daftarSoal = racikSoalSesuaiKuota(
                dataSoalSemua,
                configBidang?.questionConfig
            );
            sesi.indexAktif = 0;
            sesi.jawabanUser = {};
            sesi.raguRagu = [];
            sesi.sisaWaktu = (configBidang?.durationMinutes || 70) * 60;
            sesi.kategori = kategoriAktif;

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
 * Mengambil soal acak dari bank data sesuai kuota di config.json,
 * dengan fallback ke kuota default PM kalau config tidak tersedia.
 * Setiap soal ditandai dengan field `kategori` supaya proses hitung hasil
 * & tampilan badge kategori tidak perlu menebak dari prefix ID soal lagi.
 */
function racikSoalSesuaiKuota(semuaKategori, kuotaDariConfig) {

    const kuotaKategori = kuotaDariConfig || {
        "keamanan_pangan_haccp": 18,
        "sanitasi_umum": 10,
        "pengendalian_mutu": 5,
        "hitungan": 2,
        "k3": 5
    };

    let kumpulanSoalTerpilih = [];

    // Ambil soal per kategori sesuai urutan kuotaKategori
    for (const [kategori, jumlahKuota] of Object.entries(kuotaKategori)) {
        if (!jumlahKuota || jumlahKuota <= 0) continue;

        const listSoalKategori = semuaKategori[kategori] || [];

        // Acak soal dalam kategori
        const soalDiacak = [...listSoalKategori]
            .sort(() => Math.random() - 0.5);

        // Ambil sesuai kuota
        const diambil = soalDiacak.slice(0, jumlahKuota);

        // Tandai tiap soal dengan key kategorinya (generic untuk semua bidang)
        diambil.forEach(soal => { soal.kategori = kategori; });

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
    document.getElementById('question-category').innerText = formatNamaKategori(soalAktif);

    // UBAH DARI .innerText KE .innerHTML AGAR TAG <ruby> DIRENDER SEBAGAI FURIGANA
    const questionElement = document.getElementById('question-text');

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
    if (!containerOpsi) {
        console.error("options-container tidak ditemukan");
        return;
    }
    containerOpsi.innerHTML = "";

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

    // Otomatis hapus tanda "UNSURE" begitu user memilih jawaban
    if (sesi.raguRagu.includes(soalAktif.id)) {
        sesi.raguRagu = sesi.raguRagu.filter(id => id !== soalAktif.id);

        const btnFlag = document.getElementById('btn-flag');
        if (btnFlag) {
            btnFlag.classList.remove('flagged');
        }
    }

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

        if (modal)
            modal.classList.add('active');

        document.body.classList.add('paused');

        if (btn)
            btn.innerHTML = "▶ Resume";
    }
    else {
        if (modal)
            modal.classList.remove('active');
        document.body.classList.remove('paused');

        if (btn)
            btn.innerHTML = "⏸ Pause";
    }
    simpanSesiLokal();
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
        clearInterval(timerInterval);
        eksekusiHitungHasilAkhir();
    }
}

function eksekusiHitungHasilAkhir() {
    clearInterval(timerInterval);

    let totalBenar = 0;
    let totalSalah = 0;

    // Bangun struktur analisis kategori secara dinamis dari config bidang aktif,
    // supaya tiap bidang (PM, kaigo, dst) punya key kategorinya sendiri — bukan hardcode PM.
    // Fallback ke set kategori PM kalau config belum ter-load (mis. karena error jaringan).
    const kuotaKategoriUntukAnalisis =
        (configBidangAktif && configBidangAktif.questionConfig) || {
            "keamanan_pangan_haccp": 0,
            "sanitasi_umum": 0,
            "pengendalian_mutu": 0,
            "hitungan": 0,
            "k3": 0
        };

    let analisisKategori = {};
    Object.keys(kuotaKategoriUntukAnalisis).forEach(kategori => {
        analisisKategori[kategori] = { benar: 0, total: 0 };
    });

    sesi.daftarSoal.forEach((soal) => {
        const kodeKategori = dapatkanKodeKategori(soal);
        const jawabanBenar = soal.correct_answer.toUpperCase().trim();
        const jawabanUser = (sesi.jawabanUser[soal.id] || '').toUpperCase().trim();

        // Jaga-jaga jika kategori soal tidak ada di daftar analisis (mis. data lama / config berubah)
        if (!analisisKategori[kodeKategori]) {
            analisisKategori[kodeKategori] = { benar: 0, total: 0 };
        }

        analisisKategori[kodeKategori].total++;

        if (jawabanUser === jawabanBenar) {
            totalBenar++;
            analisisKategori[kodeKategori].benar++;
        } else {
            totalSalah++;
        }
    });

    const skorAkhir = Math.round((totalBenar / sesi.daftarSoal.length) * 100);

    // Catatan: nama field di bawah ini (score, correct, wrong) disesuaikan
    // agar cocok dengan yang dibaca oleh dashboard.html (loadHistory) dan js/result.js
    const hasilUjian = {
        id: (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`),
        category: sesi.kategori || getActiveCategory(),
        score: skorAkhir,
        correct: totalBenar,
        wrong: totalSalah,
        timestamp: Date.now(),
        analisis: analisisKategori,
        daftarSoal: sesi.daftarSoal,
        jawabanUser: sesi.jawabanUser
    };

    if (typeof saveResultToHistory === "function") {
        saveResultToHistory(hasilUjian);
    } else {
        let riwayatSsw = JSON.parse(localStorage.getItem('ssw_exam_history') || '[]');
        riwayatSsw.unshift(hasilUjian);
        localStorage.setItem('ssw_exam_history', JSON.stringify(riwayatSsw));
    }

    // Tandai hasil mana yang harus ditampilkan di result.html
    localStorage.setItem('ssw_review_target_id', hasilUjian.id);

    localStorage.removeItem('ssw_current_exam');

    // Arahkan ke halaman hasil, bukan dashboard
    window.location.href = 'result.html';
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

/**
 * Terjemahkan soal -> key kategori.
 * Prioritas: field soal.kategori (ditandai saat racikSoalSesuaiKuota()).
 * Fallback: tebak dari prefix ID soal (untuk data lama, mendukung PM & kaigo).
 */
function dapatkanKodeKategori(soal) {
    if (soal && soal.kategori) return soal.kategori;

    const idSoal = (soal && soal.id) || '';

    // Fallback lama — prefix ID bidang PM
    if (idSoal.startsWith('KP-')) return 'keamanan_pangan_haccp';
    if (idSoal.startsWith('SU-')) return 'sanitasi_umum';
    if (idSoal.startsWith('PM-')) return 'pengendalian_mutu';
    if (idSoal.startsWith('HT-')) return 'hitungan';
    if (idSoal.startsWith('K3-')) return 'k3';

    // Fallback lama — prefix ID bidang Kaigo
    if (idSoal.startsWith('DPL-')) return 'dasar_perawatan_lansia';
    if (idSoal.startsWith('MMT-')) return 'mekanisme_mental_dan_tubuh';
    if (idSoal.startsWith('KK-'))  return 'keterampilan_komunikasi';
    if (idSoal.startsWith('KDK-')) return 'keterampilan_dukungan_kehidupan';

    return 'keamanan_pangan_haccp';
}

/**
 * Label kategori untuk badge di layar soal (#question-category).
 * Prioritas: categoryLabels di config.json bidang aktif.
 * Fallback: tebak dari prefix ID soal (untuk data lama, mendukung PM & kaigo).
 */
function formatNamaKategori(soal) {
    const kodeKategori = dapatkanKodeKategori(soal);

    if (configBidangAktif && configBidangAktif.categoryLabels && configBidangAktif.categoryLabels[kodeKategori]) {
        return configBidangAktif.categoryLabels[kodeKategori];
    }

    const idSoal = (soal && soal.id) || '';

    // Fallback lama — prefix ID bidang PM
    if (idSoal.startsWith('KP-')) return 'HACCP & Keamanan Pangan';
    if (idSoal.startsWith('SU-')) return 'Sanitasi Umum & Pekerja';
    if (idSoal.startsWith('PM-')) return 'Pengendalian Mutu Proses';
    if (idSoal.startsWith('HT-')) return 'Hitungan';
    if (idSoal.startsWith('K3-')) return 'Keselamatan & Kesehatan Kerja (K3)';

    // Fallback lama — prefix ID bidang Kaigo
    if (idSoal.startsWith('DPL-')) return 'Dasar Perawatan Lansia';
    if (idSoal.startsWith('MMT-')) return 'Mekanisme Mental & Tubuh';
    if (idSoal.startsWith('KK-'))  return 'Keterampilan Komunikasi';
    if (idSoal.startsWith('KDK-')) return 'Keterampilan Dukungan Kehidupan';

    return 'Kompetensi Umum';
}