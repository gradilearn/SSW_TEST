// js/storage.js

// 1. Ambil riwayat ujian dari Local Storage
function getRiwayatUjian() {
    const riwayat = localStorage.getItem('ssw_exam_history');
    return riwayat ? JSON.parse(riwayat) : [];
}

// 2. Simpan hasil ujian baru ke dalam riwayat
function simpanHasilUjian(skor, totalBenar, totalSalah, analisisKategori) {
    const riwayat = getRiwayatUjian();
    
    // Data hasil ujian saat ini
    const hasilBaru = {
        id: 'EXAM-' + Date.now(),
        tanggal: new Date().toLocaleDateString('id-ID', { 
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        }),
        skor: skor,                    // Nilai akhir (0 - 100)
        benar: totalBenar,              // Jumlah jawaban benar (dari 40 soal)
        salah: totalSalah,              // Jumlah jawaban salah
        status: skor >= 65 ? 'LULUS' : 'TIDAK LULUS', // Standar kelulusan SSW ~65%
        detailKategori: analisisKategori // Persentase kebenaran per kategori
    };

    // Tambahkan ke urutan paling atas (terbaru)
    riwayat.unshift(hasilBaru);
    localStorage.setItem('ssw_exam_history', JSON.stringify(riwayat));

    // Perbarui akumulasi statistik global
    perbaruiStatistikGlobal(riwayat);
}

// 3. Hitung dan perbarui statistik akumulatif untuk dashboard
function perbaruiStatistikGlobal(riwayat) {
    if (riwayat.length === 0) return;

    let totalSkor = 0;
    let totalLulus = 0;

    riwayat.forEach(item => {
        totalSkor += item.skor;
        if (item.status === 'LULUS') totalLulus++;
    });

    const statistikGlobal = {
        totalUjian: riwayat.length,
        rataRataNilai: Math.round(totalSkor / riwayat.length),
        persentaseKelulusan: Math.round((totalLulus / riwayat.length) * 100)
    };

    localStorage.setItem('ssw_user_stats', JSON.stringify(statistikGlobal));
}

// 4. Ambil statistik global untuk ditampilkan di dashboard
function getStatistikGlobal() {
    const stats = localStorage.getItem('ssw_user_stats');
    return stats ? JSON.parse(stats) : { totalUjian: 0, rataRataNilai: 0, persentaseKelulusan: 0 };
}

// 5. Hapus sesi ujian aktif (digunakan setelah selesai ujian atau reset)
function hapusSesiUjianAktif() {
    localStorage.removeItem('ssw_current_exam');
}