/**
 * js/result.js
 * Logika Pengisian Data Evaluasi Hasil Simulasi CBT SSW
 * Generic untuk semua bidang (PM, Kaigo, dst) — kategori & label diambil dari config.json bidang aktif
 */
document.addEventListener("DOMContentLoaded", () => {

    const nav = performance.getEntriesByType("navigation")[0];

    if (nav && nav.type === "reload") {
        window.location.replace("dashboard.html");
        return;
    }

    muatHasilEvaluasi();
});

// Penampung data lokal untuk filter tabel
let kumpulanSoalReview = [];
let jawabanUserReview = {};

/**
 * Terapkan background halaman result sesuai bidang aktif — persis logic yang
 * dipakai di dashboard.html, supaya background result.html konsisten dengan dashboard
 * (bukan lagi hardcode backgroundpb.png seperti sebelumnya).
 */
function applyResultBackground(config, kategoriFolder) {
    if (!config || !config.theme || !config.theme.background || !kategoriFolder) return;

    document.body.style.background = `
        linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.45)),
        url('data/${kategoriFolder}/${config.theme.background}')
        center/cover fixed`;
}

// Config bidang aktif (di-load async lewat loadConfig) — dipakai oleh
// dapatkanNamaKategoriCantik() untuk menerjemahkan key kategori -> label tampilan
// Catatan: sengaja diberi nama unik (bukan configBidangAktif) karena result.js dan
// exam.js sama-sama di-load di exam.html — nama yang sama akan bentrok (SyntaxError redeclare)
let configBidangAktifResult = null;

function muatHasilEvaluasi() {

    // Guard: result.js juga ikut ter-load di exam.html (lihat <script> di sana),
    // tapi elemen-elemen hasil ujian (final-score-val, dll) cuma ada di result.html.
    // Kalau elemen inti ini tidak ditemukan, berarti kita bukan di halaman result — hentikan di sini.
    if (!document.getElementById('final-score-val')) {
        return;
    }

    // 1. Ambil data hasil terlebih dahulu agar variabel skorAkhir tersedia
    const targetId = localStorage.getItem('ssw_review_target_id');
    let dataHasil = null;

    if (targetId && typeof getExamResultById === 'function') {
        dataHasil = getExamResultById(targetId);
    }

    // Fallback: ambil hasil paling baru dari riwayat kategori terakhir
    if (!dataHasil) {
        const kategoriTerakhir = localStorage.getItem('examCategory');
        if (kategoriTerakhir && typeof getExamHistory === 'function') {
            const riwayat = getExamHistory(kategoriTerakhir);
            dataHasil = riwayat[0] || null;
        }
    }

    // Fallback terakhir: data kosong
    if (!dataHasil) {
        dataHasil = { score: 0, correct: 0, wrong: 0 };
    }

    // Kompatibel format lama (detailKategori) dan baru (analisis)
    dataHasil.analisis = dataHasil.analisis || dataHasil.detailKategori || {};

    // Simpan referensi global agar bisa di-render ulang setelah config bidang aktif siap
    dataHasilGlobal = dataHasil;

    // Tampilkan ringkasan skor numerik awal
    const skorAkhir = dataHasil.score;
    document.getElementById('final-score-val').innerText = skorAkhir;
    document.getElementById('benar-val').innerText = dataHasil.correct;
    document.getElementById('salah-val').innerText = dataHasil.wrong;


    // ===============================
    // TAMPILKAN NAMA UJIAN & AMBIL CONFIG BIDANG AKTIF SECARA DINAMIS
    // ===============================
    const testNameEl = document.getElementById('test-name');

    if (testNameEl && typeof loadConfig === 'function') {

        const kategoriAktif = getActiveCategory();

        loadConfig(kategoriAktif)
            .then(configBidang => {

                configBidangAktifResult = configBidang;

                testNameEl.innerHTML =
                    configBidang.examHeader ||
                    configBidang.displayName ||
                    '';

                // Ambil nilai kelulusan dinamis dari config (dengan nilai fallback aman 65%) [1]
                const passScoreLimit = configBidang.passScore || 65;

                // Tuliskan Passing Mark ke UI secara dinamis [1]
                const passingMarkEl = document.getElementById('passing-mark');
                if (passingMarkEl) {
                    passingMarkEl.innerText = passScoreLimit + '%';
                }

                // Tentukan status kelulusan berdasarkan nilai dinamis dari config [1]
                const badgeStatus = document.getElementById('pass-status-badge');
                if (badgeStatus) {
                    if (skorAkhir >= passScoreLimit) {
                        badgeStatus.innerText = "合格 (PASSED)";
                        badgeStatus.className = "status-badge pass";
                    } else {
                        badgeStatus.innerText = "不合格 (FAILED)";
                        badgeStatus.className = "status-badge fail";
                    }
                }

                // Terapkan background sesuai bidang aktif
                applyResultBackground(configBidang, kategoriAktif);

                // Render ulang tabel & grafik kategori setelah config bidang tersedia
                if (dataHasilGlobal) {
                    renderGrafikKategori(dataHasilGlobal);
                    renderTabelUlasan('all');
                }
            })
            .catch(error => {
                console.error("Gagal load config:", error);
            });

    }

    // 3. Tabel Detail Soal — baca dari history entry
    if (dataHasil.daftarSoal && Array.isArray(dataHasil.daftarSoal) && dataHasil.daftarSoal.length > 0) {
        kumpulanSoalReview = dataHasil.daftarSoal;
        jawabanUserReview  = dataHasil.jawabanUser || {};

        const totalEl = document.getElementById('total-soal-val');
        if (totalEl) totalEl.textContent = kumpulanSoalReview.length;

        renderTabelUlasan('all');

    } else {
        const tbody = document.getElementById('review-table-body');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center" style="color:#64748b;padding:30px;">
                        Riwayat lembar pengerjaan penuh sudah dibersihkan.
                        Silakan lakukan simulasi ujian ulang untuk melihat lembar koreksi interaktif.
                    </td>
                </tr>
            `;
        }
        const totalEl = document.getElementById('total-soal-val');
        if (totalEl) totalEl.textContent = '0';
    }
}

// Referensi global data hasil, dipakai untuk re-render setelah config bidang siap
let dataHasilGlobal = null;

function renderGrafikKategori(dataHasil) {
    const containerBatang = document.getElementById('category-bars-container');
    if (containerBatang && dataHasil.analisis) {
        containerBatang.innerHTML = '';

        // Gunakan batas nilai dinamis dari config untuk menentukan warna grafik (hijau atau jingga)
        const passLimit = (configBidangAktifResult && configBidangAktifResult.passScore) || 65;

        Object.entries(dataHasil.analisis).forEach(([keyKat, data]) => {
            const persenKat = data.total > 0 ? Math.round((data.benar / data.total) * 100) : 0;
            const namaClean = dapatkanNamaKategoriCantik(keyKat);

            const barRow = document.createElement('div');
            barRow.className = 'bar-row';
            barRow.innerHTML = `
                <div class="bar-info-flex">
                    <span>${namaClean}</span>
                    <span>${data.benar}/${data.total} True (${persenKat}%)</span>
                </div>
                <div class="bar-track">
                    <div class="bar-fill" style="width: ${persenKat}%; background: ${persenKat >= passLimit ? '#10b981' : '#f59e0b'}"></div>
                </div>
            `;
            containerBatang.appendChild(barRow);
        });
    }
}

/**
 * Render baris tabel berdasarkan filter
 */
function renderTabelUlasan(filter) {
    const tbody = document.getElementById('review-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    let tampilCount = 0;

    kumpulanSoalReview.forEach((soal, index) => {
        // Normalisasi jawaban — trim spasi & uppercase
        const jawabanUser = String(jawabanUserReview[soal.id] || '-').toUpperCase().trim();
        const kunciBenar  = String(soal.correct_answer || '').toUpperCase().trim();
        const isCorrect   = jawabanUser !== '-' && jawabanUser === kunciBenar;

        if (filter === 'correct'   && !isCorrect) return;
        if (filter === 'incorrect' &&  isCorrect) return;

        tampilCount++;

        const tr = document.createElement('tr');
        tr.dataset.status = isCorrect ? 'correct' : 'incorrect';
        tr.innerHTML = `
            <td class="text-center font-bold" style="color:#64748b;">${index + 1}</td>
            <td class="font-bold" style="font-size:0.8rem;color:#475569;">${formatKategoriSingkat(soal)}</td>
            <td>
                <div style="font-weight:600;color:#1e293b;margin-bottom:4px;">${soal.question}</div>
                <div style="font-size:0.78rem;color:#059669;background:#f0fdf4;padding:7px 11px;border-radius:6px;margin-top:5px;border:1px dashed #bbf7d0;">
                    💡 <strong>Explanation:</strong> ${soal.explanation || 'Tidak ada penjelasan khusus.'}
                </div>
            </td>
            <td class="text-center font-bold" style="color:${isCorrect ? '#10b981' : '#ef4444'}">${jawabanUser}</td>
            <td class="text-center font-bold" style="color:#10b981;">${kunciBenar}</td>
            <td class="text-center">
                <span class="status-row-badge ${isCorrect ? 'correct-tag' : 'incorrect-tag'}">
                    ${isCorrect ? 'TRUE' : 'FALSE'}
                </span>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Tampilkan pesan jika tidak ada data sesuai filter
    if (tampilCount === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center" style="color:#64748b;padding:24px;">
                    No data available.
                </td>
            </tr>
        `;
    }
}

/**
 * Filter tabel — dipanggil dari onclick di HTML
 * Tidak butuh parameter event; gunakan querySelectorAll untuk update active
 */
function filterReviewTable(tipeFilter) {
    // Pindahkan class active ke tombol yang diklik berdasarkan tipeFilter
    document.querySelectorAll('.badge-filter').forEach(btn => {
        btn.classList.remove('active');
        // Cocokkan tombol via onclick attribute
        const onclickVal = btn.getAttribute('onclick') || '';
        if (onclickVal.includes(`'${tipeFilter}'`)) {
            btn.classList.add('active');
        }
    });

    renderTabelUlasan(tipeFilter);
}

/**
 * Terjemahkan key kategori -> label tampilan.
 * Sumber utama: categoryLabels di config.json bidang aktif.
 * Fallback: Kamus nama default lokal jika konfigurasi belum termuat secara asinkron.
 */
function dapatkanNamaKategoriCantik(key) {
    if (!key) return "Kompetensi Umum";

    const normalizedKey = key.toLowerCase().trim();

    // 1. Coba ambil dari konfigurasi dinamis yang di-load
    if (configBidangAktifResult && configBidangAktifResult.categoryLabels) {
        if (configBidangAktifResult.categoryLabels[key]) {
            return configBidangAktifResult.categoryLabels[key];
        }
        if (configBidangAktifResult.categoryLabels[normalizedKey]) {
            return configBidangAktifResult.categoryLabels[normalizedKey];
        }
    }

    // 2. Fallback daftar pemetaan lokal yang aman untuk PM & Kaigo
    const defaultLabels = {
        // Food Manufacturing (PM)
        "keamanan_pangan_haccp": "Keamanan Pangan & HACCP",
        "sanitasi_umum": "Sanitasi Umum",
        "pengendalian_mutu": "Pengendalian Mutu",
        "k3": "Kesehatan & Keselamatan Kerja (K3)",
        "hitungan": "Perhitungan",

        // Caregiver (Kaigo)
        "dasar_perawatan": "Dasar Perawatan Lansia",
        "dasar_perawatan_lansia": "Dasar Perawatan Lansia",
        "mekanisme_mental_tubuh": "Mekanisme Mental & Tubuh",
        "mekanisme_mental_dan_tubuh": "Mekanisme Mental & Tubuh",
        "keterampilan_komunikasi": "Keterampilan Komunikasi",
        "keterampilan_dukungan_kehidupan": "Keterampilan Dukungan Kehidupan",
        "soal_ilustrasi": "Soal Ilustrasi",

        // Singkatan / Kode Kunci Lainnya
        "kp": "HACCP & Keamanan",
        "su": "Sanitasi Umum",
        "pm": "Pengendalian Mutu",
        "ht": "Hitungan",
        "dpl": "Dasar Perawatan Lansia",
        "mmt": "Mekanisme Mental & Tubuh",
        "kk": "Keterampilan Komunikasi",
        "kdk": "Keterampilan Dukungan Kehidupan"
    };

    return defaultLabels[normalizedKey] || defaultLabels[key] || "Kompetensi Umum";
}

/**
 * Label kategori singkat untuk kolom tabel review.
 * Prioritas: field soal.kategori -> diterjemahkan via config.
 * Fallback: tebak dari prefix ID soal (untuk kompatibilitas data histori lama).
 */
function formatKategoriSingkat(soal) {
    if (soal && soal.kategori) {
        return dapatkanNamaKategoriCantik(soal.kategori);
    }

    const idSoal = (soal && soal.id) || '';

    // Fallback lama — prefix ID bidang PM
    if (idSoal.startsWith('KP-')) return 'Keamanan Pangan & HACCP';
    if (idSoal.startsWith('SU-')) return 'Sanitasi Umum';
    if (idSoal.startsWith('PM-')) return 'Pengendalian Mutu';
    if (idSoal.startsWith('HT-')) return 'Perhitungan';
    if (idSoal.startsWith('K3-')) return 'Kesehatan & Keselamatan Kerja (K3)';

    // Fallback lama — prefix ID bidang Kaigo
    if (idSoal.startsWith('DPL-')) return 'Dasar Perawatan Lansia';
    if (idSoal.startsWith('MMT-')) return 'Mekanisme Mental & Tubuh';
    if (idSoal.startsWith('KK-'))  return 'Keterampilan Komunikasi';
    if (idSoal.startsWith('KDK-')) return 'Keterampilan Dukungan Kehidupan';

    return 'Kompetensi Umum';
}

function goHome() {
    window.location.href = 'dashboard.html';
}

function goDashboard() {
    window.location.href = 'dashboard.html';
}

function restartSimulation() {
    localStorage.removeItem('ssw_current_exam');
    window.location.href = 'exam.html';
}