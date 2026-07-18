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

    // ===============================
    // TAMPILKAN NAMA UJIAN & SIMPAN CONFIG BIDANG AKTIF
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

                // Render ulang tabel & grafik kategori setelah config bidang tersedia,
                // supaya label kategori terjemahan sudah benar (tidak menunggu race condition)
                if (dataHasilGlobal) {
                    renderGrafikKategori(dataHasilGlobal);
                    renderTabelUlasan('all');
                }
            })
            .catch(error => {
                console.error("Gagal load config:", error);
            });

    }

    // 1. Coba ambil hasil spesifik yang baru saja selesai dikerjakan
    const targetId = localStorage.getItem('ssw_review_target_id');
    let dataHasil = null;

    if (targetId && typeof getExamResultById === 'function') {
        dataHasil = getExamResultById(targetId);
    }

    // 2. Fallback: ambil hasil paling baru dari riwayat kategori terakhir
    if (!dataHasil) {
        const kategoriTerakhir = localStorage.getItem('examCategory');
        if (kategoriTerakhir && typeof getExamHistory === 'function') {
            const riwayat = getExamHistory(kategoriTerakhir);
            dataHasil = riwayat[0] || null;
        }
    }

    // 3. Fallback terakhir: data kosong
    if (!dataHasil) {
        dataHasil = { score: 0, correct: 0, wrong: 0 };
    }

    // kompatibel format lama (detailKategori) dan baru (analisis)
    dataHasil.analisis = dataHasil.analisis || dataHasil.detailKategori || {};

    // simpan referensi global agar bisa di-render ulang setelah config bidang aktif siap
    dataHasilGlobal = dataHasil;

    // 1. Ringkasan Skor
    const skorAkhir = dataHasil.score;
    document.getElementById('final-score-val').innerText = skorAkhir;
    document.getElementById('benar-val').innerText = dataHasil.correct;
    document.getElementById('salah-val').innerText = dataHasil.wrong;

    const badgeStatus = document.getElementById('pass-status-badge');
    if (skorAkhir >= 70) {
        badgeStatus.innerText = "合格 (PASSED)";
        badgeStatus.className = "status-badge pass";
    } else {
        badgeStatus.innerText = "不合格 (FAILED)";
        badgeStatus.className = "status-badge fail";
    }

    // 2. Grafik Batang Kategori
    renderGrafikKategori(dataHasil);

    // 3. Tabel Detail Soal — baca dari history entry (lebih andal dari ssw_current_exam)
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
                    <div class="bar-fill" style="width: ${persenKat}%; background: ${persenKat >= 70 ? '#10b981' : '#f59e0b'}"></div>
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
 * Sumber utama: categoryLabels di config.json bidang aktif (generic untuk semua bidang).
 * Fallback: label default jika config bidang belum ter-load atau key tidak dikenal.
 */
function dapatkanNamaKategoriCantik(key) {
    if (configBidangAktifResult && configBidangAktifResult.categoryLabels && configBidangAktifResult.categoryLabels[key]) {
        return configBidangAktifResult.categoryLabels[key];
    }
    return "Kompetensi Umum";
}

/**
 * Label kategori singkat untuk kolom tabel review.
 * Prioritas: field soal.kategori (ditandai saat soal dipilih di data.js) -> diterjemahkan via config.
 * Fallback: tebak dari prefix ID soal (untuk data histori lama sebelum field kategori ditambahkan).
 */
function formatKategoriSingkat(soal) {
    if (soal && soal.kategori) {
        return dapatkanNamaKategoriCantik(soal.kategori);
    }

    const idSoal = (soal && soal.id) || '';

    // Fallback lama — prefix ID bidang PM
    if (idSoal.startsWith('KP-')) return 'HACCP & Keamanan';
    if (idSoal.startsWith('SU-')) return 'Sanitasi Umum';
    if (idSoal.startsWith('PM-')) return 'Pengendalian Mutu';
    if (idSoal.startsWith('HT-')) return 'Hitungan';
    if (idSoal.startsWith('K3-')) return 'K3';

    // Fallback lama — prefix ID bidang Kaigo
    if (idSoal.startsWith('DPL-')) return 'Dasar Perawatan Lansia';
    if (idSoal.startsWith('MMT-')) return 'Mekanisme Mental & Tubuh';
    if (idSoal.startsWith('KK-'))  return 'Keterampilan Komunikasi';
    if (idSoal.startsWith('KDK-')) return 'Keterampilan Dukungan Kehidupan';

    return 'Umum';
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