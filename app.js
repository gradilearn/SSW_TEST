// =========================
// CONFIG
// =========================


const EXAM_CONFIG = {
    haccp: 18,
    sanitasi: 10,
    mutu: 5,
    k3: 5,
    hitungan: 2,
    duration: 70 * 60
};

const STORAGE_KEY = "ssw_cbt_state";

// =========================
// STATE
// =========================

let examQuestions = [];
let answers = [];
let currentQuestion = 0;
let remainingTime = EXAM_CONFIG.duration;
let timerInterval = null;
let isPaused = false;
let examFinished = false;

// =========================
// ELEMENT
// =========================

const startToast = document.getElementById("startToast");
const homePage = document.getElementById("homePage");
const examPage = document.getElementById("examPage");
const resultPage = document.getElementById("resultPage");

document.addEventListener("DOMContentLoaded", () => {
    const btnMulai = document.getElementById("btn-mulai");
    const startModal = document.getElementById("startModal");
    const btnConfirmStart = document.getElementById("btn-confirm-start");
    const btnCancelModal = document.getElementById("btn-cancel-modal");

    // 1. Klik tombol utama -> Munculkan Modal
    if (btnMulai) {
        btnMulai.addEventListener("click", () => {
            startModal.style.display = "flex";
        });
    }

    // 2. Klik Batal -> Sembunyikan Modal
    if (btnCancelModal) {
        btnCancelModal.addEventListener("click", () => {
            startModal.style.display = "none";
        });
    }

    // 3. Klik Confirm -> Jalankan startExam()
    if (btnConfirmStart) {
        btnConfirmStart.addEventListener("click", () => {
            startModal.style.display = "none";
            startExam(); // Fungsi yang sudah Anda miliki
        });
    }
});

const restartBtn = document.getElementById("restartBtn");

const timerEl = document.getElementById("timer");
const questionText = document.getElementById("questionText");
const questionMeaning = document.getElementById("questionMeaning");
const questionNumber = document.getElementById("questionNumber");
const optionsContainer = document.getElementById("optionsContainer");

const questionNav = document.getElementById("questionNav");

const progressFill = document.getElementById("progressFill");
const answeredCount = document.getElementById("answeredCount");

const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const finishBtn = document.getElementById("finishBtn");

const toggleNavBtn = document.getElementById("toggleNavBtn");
const sidebar = document.getElementById("sidebar");

const pauseBtn = document.getElementById("pauseBtn");
const pauseOverlay = document.getElementById("pauseOverlay");
const resumeBtn = document.getElementById("resumeBtn");

// =========================
// UTIL
// =========================

function shuffle(array) {
    const arr = [...array];

    for (let i = arr.length - 1; i > 0; i--) {

        const j = Math.floor(Math.random() * (i + 1));

        [arr[i], arr[j]] = [arr[j], arr[i]];
    }

    return arr;
}

function formatTime(seconds) {

    const m = Math.floor(seconds / 60);
    const s = seconds % 60;

    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// =========================
// PAGE
// =========================

function showPage(page) {

    homePage.classList.remove("active");
    examPage.classList.remove("active");
    resultPage.classList.remove("active");

    page.classList.add("active");
}

// =========================
// GENERATE EXAM
// =========================

function pickQuestions(category, amount) {

    const source = questionBank[category];

    if (!source || source.length < amount) {

        alert(
            `Soal kategori ${category} kurang dari ${amount}`
        );

        return [];
    }

    return shuffle(source).slice(0, amount);
}

function shuffleQuestionOptions(question){

    const options = question.p.map((text,index)=>({

        text:text,

        original:index

    }));

    const shuffled = shuffle(options);

    const newAnswer = shuffled.findIndex(
        item => item.original === question.b
    );

    return {

        ...question,

        p: shuffled.map(item=>item.text),

        b: newAnswer

    };

}

function createExam() {

    examQuestions = [

        ...pickQuestions("haccp", 18).map(q => ({...q, category:"haccp"})),

        ...pickQuestions("sanitasi", 10).map(q => ({...q, category:"sanitasi"})),

        ...pickQuestions("mutu", 5).map(q => ({...q, category:"mutu"})),

        ...pickQuestions("k3", 5).map(q => ({...q, category:"k3"})),

        ...pickQuestions("hitungan", 2).map(q => ({...q, category:"hitungan"}))

    ];

    examQuestions = shuffle(examQuestions)
    .map(q => shuffleQuestionOptions(q));

    answers = Array(examQuestions.length).fill(null);

    currentQuestion = 0;

    remainingTime = EXAM_CONFIG.duration;
}

// =========================
// RENDER NAVIGATION
// =========================

function renderNavigation() {

    questionNav.innerHTML = "";

    examQuestions.forEach((q, index) => {

        const btn = document.createElement("button");

        btn.className = "question-nav-btn";

        btn.textContent = index + 1;

        if (index === currentQuestion) {
            btn.classList.add("current");
        }

        if (answers[index] !== null) {
            btn.classList.add("answered");
        }
        else{
            btn.classList.add("unanswered");
        }

        btn.addEventListener("click", () => {

            currentQuestion = index;

            renderQuestion();
        });

        questionNav.appendChild(btn);
    });
}

// =========================
// RENDER QUESTION
// =========================

function renderQuestion() {

    const q = examQuestions[currentQuestion];

    questionNumber.textContent =
        `Question ${currentQuestion + 1}`;

    questionText.innerHTML = q.t;

    questionMeaning.textContent = q.m;

    optionsContainer.innerHTML = "";

    q.p.forEach((option, index) => {

        const btn =
            document.createElement("button");

        btn.className = "option-btn";

        btn.innerHTML =
            `${String.fromCharCode(65 + index)}. ${option}`;

        if (answers[currentQuestion] === index) {
            btn.classList.add("selected");
        }

        btn.addEventListener("click", () => {

            answers[currentQuestion] = index;

            saveState();

            renderQuestion();
        });

        optionsContainer.appendChild(btn);
    });

    renderNavigation();

    updateProgress();
}

// =========================
// PROGRESS
// =========================

function updateProgress() {

    const answered =
        answers.filter(a => a !== null).length;

    answeredCount.textContent =
        `${answered} / ${examQuestions.length}`;

    progressFill.style.width =
        `${(answered / examQuestions.length) * 100}%`;
}

// =========================
// TIMER
// =========================

function startTimer() {

    clearInterval(timerInterval);

    timerInterval = setInterval(() => {

        if (isPaused) return;

        remainingTime--;

        timerEl.textContent =
            formatTime(remainingTime);

        saveState();

        if (remainingTime <= 0) {

            finishExam();
        }

    }, 1000);
}

// =========================
// SAVE
// =========================

function saveState() {

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
            examQuestions,
            answers,
            currentQuestion,
            remainingTime,
            isPaused
        })
    );
}

function loadState() {

    const saved =
        localStorage.getItem(STORAGE_KEY);

    if (!saved) return false;

    const data = JSON.parse(saved);

    examQuestions = data.examQuestions;
    answers = data.answers;
    currentQuestion = data.currentQuestion;
    remainingTime = data.remainingTime;
    isPaused = data.isPaused;

    return true;
}

// =========================
// START EXAM
// =========================

function startExam() {

    createExam();

    showPage(examPage);

    // 🔥 INI TEMPAT TOAST (BENAR)
    if (startToast) {
        startToast.classList.add("show");
        startToast.innerText = "Starting now...";

        setTimeout(() => {
            startToast.classList.remove("show");
        }, 1200);
    }

    renderQuestion();

    timerEl.textContent =
        formatTime(remainingTime);

    startTimer();

    saveState();
}

// =========================
// PAUSE
// =========================

function pauseExam() {

    isPaused = true;

    pauseOverlay.classList.remove("active");

    document.body.classList.add("paused"); // ✅ TAMBAHAN BLUR

    saveState();
}

function resumeExam() {

    isPaused = false;

    pauseOverlay.classList.add("active");

    document.body.classList.remove("paused"); // ✅ HAPUS BLUR

    saveState();
}

// =========================
// FINISH
// =========================

function finishExam() {

    if (examFinished) return;

    examFinished = true;

    clearInterval(timerInterval);

    showPage(resultPage);

    localStorage.removeItem(STORAGE_KEY);

    calculateResult();
}

// =========================
// RESULT
// =========================

function calculateResult() {

    let correct = 0;
    let wrong = 0;
    let empty = 0;

    examQuestions.forEach((q, i) => {

        if (answers[i] === null) {

            empty++;

        } else if (answers[i] === q.b) {

            correct++;

        } else {

            wrong++;
        }
    });

    document.getElementById("correctCount").textContent = correct;
    document.getElementById("wrongCount").textContent = wrong;
    document.getElementById("emptyCount").textContent = empty;
}

// =========================
// EVENT
// =========================

restartBtn.addEventListener("click", () => {
    location.reload();
});

prevBtn.addEventListener("click", () => {

    if (currentQuestion > 0) {

        currentQuestion--;

        renderQuestion();
    }
});

nextBtn.addEventListener("click", () => {

    if (currentQuestion < examQuestions.length - 1) {

        currentQuestion++;

        renderQuestion();
    }
});

finishBtn.addEventListener("click", () => {

    const unanswered =
        answers.filter(a => a === null).length;

    let message = "";

    if(unanswered > 0){

        message =
            `There are still ${unanswered} unanswered questions.\n\nEnd the exam?`;

    }
    else{

        message =
            "All questions have been answered.\n\nFinish the exam?"
    }

    if(confirm(message)){

        finishExam();
    }

});

pauseBtn.addEventListener("click", pauseExam);

resumeBtn.addEventListener("click", resumeExam);

toggleNavBtn.addEventListener("click", () => {

    sidebar.classList.toggle("hidden");
});

// =========================
// ANTI REFRESH
// =========================

window.addEventListener(
    "beforeunload",
    function (e) {

        if (
            examPage.classList.contains("active")
            && !examFinished
        ) {

            e.preventDefault();

            e.returnValue = "";
        }
    }
);

// =========================
// INIT
// =========================

if (loadState()) {

    examFinished = false;
    showPage(examPage);

    timerEl.textContent =
        formatTime(remainingTime);

    renderQuestion();

    startTimer();

} else {

    showPage(homePage);
}

