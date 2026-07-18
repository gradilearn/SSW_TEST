/**
 * js/result.js
 * Logika Pengisian Data Evaluasi Hasil Simulasi CBT SSW
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

function muatHasilEvaluasi() {

    // ===============================
    // TAMPILKAN NAMA UJIAN
    // ===============================
    const testNameEl = document.getElementById('test-name');

if (testNameEl && typeof loadConfig === 'function') {

    const kategoriAktif = getActiveCategory();

    loadConfig(kategoriAktif)
        .then(configBidang => {

            testNameEl.innerHTML =
                configBidang.examHeader ||
                configBidang.displayName ||
                '';

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
            <td class="font-bold" style="font-size:0.8rem;color:#475569;">${formatKategoriSingkat(soal.id)}</td>
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

function dapatkanNamaKategoriCantik(key) {
    const kamus = {
        "keamanan_pangan_haccp": "HACCP & Keamanan Pangan",
        "sanitasi_umum":         "Sanitasi Umum & Manajemen Pekerja",
        "pengendalian_mutu":     "Pengendalian Mutu Proses Produksi",
        "hitungan":              "Hitungan",
        "k3":                    "Keselamatan & Kesehatan Kerja / K3"
    };
    return kamus[key] || "Kompetensi Umum Pengolahan Makanan";
}

function formatKategoriSingkat(idSoal) {
    if (idSoal.startsWith('KP-')) return 'HACCP & Keamanan';
    if (idSoal.startsWith('SU-')) return 'Sanitasi Umum';
    if (idSoal.startsWith('PM-')) return 'Pengendalian Mutu';
    if (idSoal.startsWith('HT-')) return 'Hitungan';
    if (idSoal.startsWith('K3-')) return 'K3';
    return 'Umum';
}

function goHome() {
    if (confirm("Back to dashboard?")) {
        window.location.href = 'dashboard.html';
    }
}

function goDashboard() {
    window.location.href = 'dashboard.html';
}

function restartSimulation() {
    localStorage.removeItem('ssw_current_exam');
    window.location.href = 'exam.html';
}