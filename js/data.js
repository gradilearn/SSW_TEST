// js/data.js

// Fungsi acak array (Fisher-Yates Shuffle)
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Fungsi utama untuk membuat paket soal ujian baru
async function buatSimulasiUjian() {
    try {
        // 1. Ambil bank soal dari file JSON
        const response = await fetch('data/questions.json');
        const bankSoal = await response.json();

        // 2. Tentukan komposisi soal per kategori
        const komposisi = {
    keamanan_pangan_haccp: 18,
    sanitasi_umum: 10,
    pengendalian_mutu: 5,
    hitungan: 2,
    k3: 5
};

        let soalTerpilih = [];

        // 3. Ambil soal secara acak berdasarkan kuota masing-masing kategori
        for (const kategori in komposisi) {
            if (bankSoal[kategori]) {
                // Salin dan acak soal pada kategori saat ini
                const soalDiacak = shuffle([...bankSoal[kategori]]);
                // Ambil sebanyak kuota yang dibutuhkan
                const kuota = komposisi[kategori];
                const diambil = soalDiacak.slice(0, kuota);
                // Gabungkan ke array utama
                soalTerpilih = soalTerpilih.concat(diambil);
            }
        }

        // 5. Buat struktur data (state) untuk sesi ujian saat ini
        const sesiUjian = {
            waktuSisa: 70 * 60,   // 70 menit dikonversi ke detik (4200 detik)
            daftarSoal: soalTerpilih,
            jawabanUser: {},      // Menyimpan jawaban (contoh: {"HC-001": "A"})
            raguRagu: {},         // Menyimpan status ragu-ragu (contoh: {"HC-001": true})
            indexSekarang: 0      // Menunjuk soal nomor berapa yang sedang dibuka (0-39)
        };

        // 6. Simpan sesi ke Local Storage agar bisa dibaca oleh halaman exam.html
        localStorage.setItem('ssw_current_exam', JSON.stringify(sesiUjian));
        
        return true; // Berhasil
    } catch (error) {
        console.error('Gagal membuat simulasi ujian:', error);
        return false; // Gagal
    }
}