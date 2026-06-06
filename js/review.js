/**
 * js/review.js
 * Logika Pengisian Data Evaluasi Hasil Simulasi CBT SSW
 */
document.addEventListener("DOMContentLoaded", () => {

    const nav = performance.getEntriesByType("navigation")[0];

if (nav && nav.type === "reload") {
    window.location.replace("index.html");
    return;
}

    muatHasilEvaluasi();
});

// Penampung data lokal untuk filter tabel
let kumpulanSoalReview = [];
let jawabanUserReview = {};

function muatHasilEvaluasi() {
    // Ambil data ujian yang barusan diselesaikan dari LocalStorage
    // Jika tidak ada, gunakan cetakan data cadangan mock agar halaman tidak kosong melongpong
    const sesiSelesai = JSON.parse(localStorage.getItem('ssw_current_exam'));
    const riwayatUjian = JSON.parse(localStorage.getItem('ssw_exam_history') || '[]');
    
    // Gunakan entri terakhir dari riwayat jika sesi langsung sudah dibersihkan
    const dataHasil = riwayatUjian[riwayatUjian.length - 1] || { skor: 0, benar: 0, salah: 0, analisis: {} };
    
    // 1. Suntik Angka Ringkasan Atas
    const skorAkhir = dataHasil.skor;
    document.getElementById('final-score-val').innerText = skorAkhir;
    document.getElementById('benar-val').innerText = dataHasil.benar;
    document.getElementById('salah-val').innerText = dataHasil.salah;
    
    // Status Kelulusan (Kriteria Kelulusan Prometric Asli adalah minimal 70%)
    const badgeStatus = document.getElementById('pass-status-badge');
    if (skorAkhir >= 70) {
        badgeStatus.innerText = "合格 (PASSED)";
        badgeStatus.className = "status-badge pass";
    } else {
        badgeStatus.innerText = "不合格 (FAILED)";
        badgeStatus.className = "status-badge fail";
    }

    // 2. Render Grafik Batang Kompetensi Kategori Kerja
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
                    <span>${data.benar}/${data.total} Benar (${persenKat}%)</span>
                </div>
                <div class="bar-track">
                    <div class="bar-fill" style="width: ${persenKat}%; background-color: ${persenKat >= 70 ? '#10b981' : '#f59e0b'}"></div>
                </div>
            `;
            containerBatang.appendChild(barRow);
        });
    }

    // 3. Simpan Referensi untuk Pengisian Tabel Detil Soal di Bawah
    if (sesiSelesai && Array.isArray(sesiSelesai.daftarSoal)) {

    kumpulanSoalReview = sesiSelesai.daftarSoal || [];
    jawabanUserReview = sesiSelesai.jawabanUser || {};

    const totalEl = document.getElementById('total-soal-val');
    if (totalEl) {
        totalEl.textContent = kumpulanSoalReview.length;
    }

    renderTabelUlasan('all');

} else {

    const tbody = document.getElementById('review-table-body');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center" style="color: #64748b; padding: 30px;">
                    Riwayat lembar pengerjaan penuh sudah dibersihkan. Sila lakukan simulasi ujian ulang untuk melihat lembar koreksi interaktif.
                </td>
            </tr>
        `;
    }

    const totalEl = document.getElementById('total-soal-val');
    if (totalEl) {
        totalEl.textContent = '0';
    }
}
}

/**
 * Render Baris Tabel Berdasarkan Filter (Semua / Benar / Salah)
 */
function renderTabelUlasan(filter) {
    const tbody = document.getElementById('review-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    kumpulanSoalReview.forEach((soal, index) => {
        const jawabanUser = (jawabanUserReview[soal.id] || '-').toUpperCase().trim();
        const kunciBenar = soal.correct_answer.toUpperCase().trim();
        const isCorrect = jawabanUser === kunciBenar;

        // Logika Penyaringan Filter Tombol Atas
        if (filter === 'correct' && !isCorrect) return;
        if (filter === 'incorrect' && isCorrect) return;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-center font-bold" style="color: #64748b;">${index + 1}</td>
            <td class="font-bold" style="font-size: 0.8rem; color: #475569;">${formatKategoriSingkat(soal.id)}</td>
            <td>
                <div style="font-weight: 600; color: #1e293b; margin-bottom: 4px;">${soal.question}</div>
                <div style="font-size: 0.8rem; color: #059669; background-color: #f0fdf4; padding: 8px 12px; border-radius: 6px; margin-top: 6px; border: 1px dashed #bbf7d0;">
                    💡 <strong>Penjelasan:</strong> ${soal.explanation || 'Tidak ada penjelasan khusus.'}
                </div>
            </td>
            <td class="text-center font-bold ${isCorrect ? 'text-success' : 'text-danger'}" style="color: ${isCorrect ? '#10b981' : '#ef4444'}">${jawabanUser}</td>
            <td class="text-center font-bold" style="color: #10b981;">${kunciBenar}</td>
            <td class="text-center">
                <span class="status-row-badge ${isCorrect ? 'correct-tag' : 'incorrect-tag'}">
                    ${isCorrect ? 'BENAR' : 'SALAH'}
                </span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterReviewTable(tipeFilter, event) {
    document.querySelectorAll('.badge-filter').forEach(btn => btn.classList.remove('active'));

    if (event && event.target) {
        event.target.classList.add('active');
    }

    renderTabelUlasan(tipeFilter);
}

function dapatkanNamaKategoriCantik(key) {
    const kamus = {
        "keamanan_pangan_haccp": "HACCP & Keamanan Pangan (A)",
        "sanitasi_umum": "Sanitasi Umum & Manajemen Pekerja (B)",
        "pengendalian_mutu": "Pengendalian Mutu Proses Produksi (C)",
        "k3": "Keselamatan & Kesehatan Kerja / K3 (D)",
        "hitungan": "Hitungan (E)"
    };
    return kamus[key] || "Kompetensi Umum Pengolahan Makanan";
}

function formatKategoriSingkat(idSoal) {
    if (idSoal.startsWith('KP-')) return 'HACCP & Keamanan';
    if (idSoal.startsWith('SU-')) return 'Sanitasi Umum';
    if (idSoal.startsWith('PM-')) return 'Pengendalian Mutu';
    if (idSoal.startsWith('K3-')) return 'K3';
    if (idSoal.startsWith('HT-')) return 'Hitungan';
    return 'Umum';
}

function Beranda() {
    if (confirm("Back to dashboard?")) {
        window.location.href = 'index.html';
    }
}

function restartSimulation() {
    // Hapus semua data ujian
    localStorage.removeItem('ssw_current_exam');

    // OPTIONAL: kalau mau full reset history
    // localStorage.removeItem('ssw_exam_history');

    // Pindah ke halaman ujian
    window.location.href = 'exam.html';
}

