/*
============================================================
KOTOBA DYNAMIC LOADER (WITH AUTOCAPITALIZE, SORT, & NO-RT IN QUIZ)
============================================================
*/

let kotobaData = []; 
let flashIndex = 0;
let latihanData = [];
let currentQuestion = 0;
let benar = 0;
let salah = 0;
let sesi = 1;

const kotobaText = document.getElementById("kotobaText");
const artiText = document.getElementById("artiText");
const penjelasanText = document.getElementById("penjelasanText");

// Helper untuk kapitalisasi huruf pertama
function capitalizeFirstLetter(string) {
    if (!string) return "";
    string = string.trim();
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// ============================================================
// INISIALISASI DATA DARI BIDANG AKTIF
// ============================================================
async function initKotoba() {
    const kategoriAktif = getActiveCategory(); 

    if (!kategoriAktif) {
        alert("Silakan pilih bidang ujian terlebih dahulu.");
        window.location.href = "dashboard.html";
        return;
    }

    try {
        const config = await loadConfig(kategoriAktif);
        if (config && config.displayName) {
            const titleEl = document.getElementById("kotobaTitle");
            if (titleEl) {
                titleEl.innerText = config.displayName;
            }
            document.title = config.displayName;
        }

        const response = await fetch(`data/${kategoriAktif}/kotoba.json`);
        if (!response.ok) {
            throw new Error(`Gagal memuat data kotoba untuk bidang: ${kategoriAktif}`);
        }
        
        const rawData = await response.json();
        
        // Pengaman: Otomatis pastikan semua arti (i) & penjelasan (d) diawali huruf kapital
        kotobaData = rawData.map(item => ({
            t: item.t,
            i: capitalizeFirstLetter(item.i),
            d: capitalizeFirstLetter(item.d)
        }));
        
        showFlashcard();
    } catch (error) {
        console.error("Error loading Kotoba:", error);
        alert("Terjadi kesalahan saat memuat daftar kotoba.");
    }
}

document.addEventListener("DOMContentLoaded", initKotoba);

// ============================================================
// FUNGSI FLASHCARD & NAVIGASI (HAFALAN)
// ============================================================
function showFlashcard() {
  if (kotobaData.length === 0) return;

  kotobaText.innerHTML = kotobaData[flashIndex].t;
  artiText.innerHTML = kotobaData[flashIndex].i;
  penjelasanText.innerHTML = kotobaData[flashIndex].d || "";

  artiText.style.display = "none";
  penjelasanText.style.display = "none";

  if (getActiveCategory() === "kaigo") {
    const rtElements = kotobaText.querySelectorAll("rt");
    rtElements.forEach(rt => {
      rt.style.visibility = "hidden";
    });
  }

  document.getElementById("flashBtn").innerText = "Lihat Arti";
}

function showArti() {
  artiText.style.display = "block";
  penjelasanText.style.display = "block";

  if (getActiveCategory() === "kaigo") {
    const rtElements = kotobaText.querySelectorAll("rt");
    rtElements.forEach(rt => {
      rt.style.visibility = "visible";
    });
  }

  document.getElementById("flashBtn").innerText = "Next";
}

function flashAction() {
  if (artiText.style.display === "none") {
    showArti();
  } else {
    nextFlashcard();
  }
}

function nextFlashcard() {
  flashIndex++;
  if (flashIndex >= kotobaData.length) {
    flashIndex = 0;
  }
  showFlashcard();
}

function showHafalan() {
  const hafalanBox = document.getElementById("hafalanBox");
  
  // Periksa apakah sebelumnya tab Hafalan sedang tersembunyi (berpindah dari tab lain)
  const dariTabLain = hafalanBox.classList.contains("hidden");

  // Sembunyikan tab lain dan tampilkan tab Hafalan
  document.getElementById("kotobaListBox").classList.add("hidden");
  hafalanBox.classList.remove("hidden");
  document.getElementById("latihanBox").classList.add("hidden");
  document.getElementById("resultBox").classList.add("hidden");

  // Jika diakses dari tab lain, langsung buat set acakan kartu baru dari awal
  if (dariTabLain && kotobaData.length > 0) {
    shuffleArray(kotobaData);
    flashIndex = 0;
    showFlashcard(); // Perbarui visual di layar
  }
}

// ====================
// ACAK DATA (HAFALAN & LATIHAN)
// ====================
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// ====================
// ACAK DATA (HAFALAN & LATIHAN BERSAMAAN)
// ====================
function acakData() {
  if (kotobaData.length === 0) return;

  // 1. Acak data untuk mode Hafalan
  shuffleArray(kotobaData);
  flashIndex = 0;
  showFlashcard(); // Langsung perbarui tampilan Hafalan di layar

  // 2. Acak data untuk mode Latihan secara bersamaan
  currentQuestion = 0;
  benar = 0;
  salah = 0;
  latihanData = [...kotobaData];
  shuffleArray(latihanData);
  latihanData = latihanData.slice(0, 20); // Ambil 20 soal baru hasil acakan

  // Jika layar Latihan sedang aktif/terbuka, langsung perbarui pertanyaan di layar secara instan
  const isLatihanActive = !document.getElementById("latihanBox").classList.contains("hidden");
  if (isLatihanActive) {
    loadQuestion();
  }
}

// ====================
// MODE LATIHAN
// ====================
function startLatihan(forceNew = true) {
  if (kotobaData.length === 0) return;

  document.getElementById("kotobaListBox").classList.add("hidden");
  document.getElementById("hafalanBox").classList.add("hidden");
  document.getElementById("latihanBox").classList.remove("hidden");
  document.getElementById("resultBox").classList.add("hidden");
  
  // Buat sesi latihan baru jika dipaksa baru (klik tab Latihan) atau jika data latihan masih kosong
  if (forceNew || latihanData.length === 0) {
    currentQuestion = 0;
    benar = 0;
    salah = 0;

    latihanData = [...kotobaData];
    shuffleArray(latihanData);
    latihanData = latihanData.slice(0, 20);
  }

  loadQuestion();
}

function loadQuestion() {
  document.getElementById("questionNumber").innerText = currentQuestion + 1;
  document.getElementById("sessionText").innerText = sesi;

  const soal = latihanData[currentQuestion];

  // KHUSUS LATIHAN: Bersihkan tag furigana (<rt>) secara fisik dari pertanyaan agar benar-benar nonaktif
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = soal.t;
  const rtElements = tempDiv.querySelectorAll("rt");
  rtElements.forEach(rt => rt.remove()); 
  
  document.getElementById("questionText").innerHTML = tempDiv.innerHTML;

  const optionsBox = document.getElementById("optionsBox");
  optionsBox.innerHTML = "";

  let pilihan = [soal.i];

  while (pilihan.length < 3) {
    let random = kotobaData[Math.floor(Math.random() * kotobaData.length)].i;
    if (!pilihan.includes(random)) {
      pilihan.push(random);
    }
  }

  shuffleArray(pilihan);

  pilihan.forEach(p => {
    const btn = document.createElement("button");
    btn.className = "option";
    btn.innerHTML = p;
    btn.onclick = () => checkAnswer(btn, p, soal.i);
    optionsBox.appendChild(btn);
  });
}

function checkAnswer(button, selected, correct) {
  const allOptions = document.querySelectorAll(".option");

  allOptions.forEach(btn => {
    btn.disabled = true;
    if (btn.innerHTML === correct) {
      btn.classList.add("correct");
    }
  });

  if (selected === correct) {
    benar++;
    button.classList.add("correct");
  } else {
    salah++;
    button.classList.add("wrong");
  }

  setTimeout(() => {
    currentQuestion++;
    if (currentQuestion >= latihanData.length) {
      showResult();
    } else {
      loadQuestion();
    }
  }, 1200);
}

function showResult() {
  document.getElementById("latihanBox").classList.add("hidden");
  document.getElementById("resultBox").classList.remove("hidden");

  let nilai = Math.round((benar / latihanData.length) * 100);
  document.getElementById("nilaiText").innerText = nilai;
  document.getElementById("benarText").innerText = benar;
  document.getElementById("salahText").innerText = salah;
}

function nextSession() {
  if (sesi >= 5) {
    sesi = 1;
  } else {
    sesi++;
  }
  startLatihan();
}

// ====================
// LIST VIEW (Urut Abjad Arti ID)
// ====================
function showKotobaList() {
    document.getElementById('hafalanBox').classList.add('hidden');
    document.getElementById('latihanBox').classList.add('hidden');
    document.getElementById('resultBox').classList.add('hidden');
    
    const listBox = document.getElementById('kotobaListBox');
    listBox.classList.remove('hidden');

    const container = document.getElementById('listContainer');
    container.innerHTML = ""; 

    // Urutkan daftar berdasarkan abjad Arti Bahasa Indonesia (i) secara aman tanpa merusak urutan asli
    const sortedData = [...kotobaData].sort((a, b) => {
        return a.i.localeCompare(b.i, 'id', { sensitivity: 'base' });
    });

    sortedData.forEach((data) => {
        const item = document.createElement('div');
        item.className = 'kotoba-item';
        item.innerHTML = `
            <ruby>${data.t}</ruby>
            <div class="item-arti">${data.i}</div>
            <div class="item-desc">${data.d}</div>
        `;
        container.appendChild(item);
    });
}

function filterKotoba() {
    let input = document.getElementById('searchInput').value.toLowerCase();
    let items = document.getElementsByClassName('kotoba-item');
    
    for (let i = 0; i < items.length; i++) {
        if (items[i].innerText.toLowerCase().includes(input)) {
            items[i].style.display = "";
        } else {
            items[i].style.display = "none";
        }
    }
}

// ============================================================
// NAVIGASI KEMBALI (BACK)
// ============================================================
function goBack() {
    location.href = "dashboard.html";
}

// Izinkan tombol BACKSPACE di keyboard untuk memicu tombol "Back" (goBack)
// Dikecualikan saat fokus di input pencarian agar tidak mengganggu pengetikan teks
document.addEventListener("keydown", (e) => {
    if (e.key === "Backspace") {
        const tag = (document.activeElement && document.activeElement.tagName) || "";
        if (tag === "INPUT" || tag === "TEXTAREA") return;

        e.preventDefault();
        goBack();
    }
});