// ============================================================
// storage.js
// SSW CBT Storage Manager
// ============================================================

const ACTIVE_EXAM_KEY = "ssw_active_exam_state";


// =========================
// ACTIVE EXAM
// =========================

function initiateExamState(category, questions, durationSeconds) {

    const state = {
        category: category,
        questions: questions,
        answers: Array(questions.length).fill(null),
        currentIndex: 0,
        remainingTime: durationSeconds
    };

    localStorage.setItem(
        ACTIVE_EXAM_KEY,
        JSON.stringify(state)
    );

    return state;
}


function getActiveExamState() {

    const data = localStorage.getItem(ACTIVE_EXAM_KEY);

    if (!data) return null;

    try {

        return JSON.parse(data);

    } catch (error) {

        console.error("Failed load exam state:", error);

        localStorage.removeItem(ACTIVE_EXAM_KEY);

        return null;
    }
}


function updateActiveExamState(state) {

    localStorage.setItem(
        ACTIVE_EXAM_KEY,
        JSON.stringify(state)
    );

}


function clearActiveExamState() {

    localStorage.removeItem(ACTIVE_EXAM_KEY);

}



// =========================
// HISTORY
// =========================

function getExamHistory(category) {

    const key = `ssw_history_${category}`;

    const data = localStorage.getItem(key);

    if (!data) return [];

    try {

        return JSON.parse(data);

    } catch (error) {

        console.error("Failed load history:", error);

        return [];

    }

}



function saveResultToHistory(result) {

    const category = result.category;

    if (!category) {

        console.error("Category missing");

        return;

    }


    const history = getExamHistory(category);

    history.unshift(result);


    localStorage.setItem(
        `ssw_history_${category}`,
        JSON.stringify(history.slice(0,50))
    );


    localStorage.setItem(
        `ssw_result_${result.id}`,
        JSON.stringify(result)
    );

}



function getExamResultById(examId) {

    const data = localStorage.getItem(
        `ssw_result_${examId}`
    );


    if (!data) return null;


    try {

        return JSON.parse(data);

    } catch(error) {

        console.error("Failed load result:", error);

        return null;

    }

}



// =========================
// CLEAR DATA
// =========================

function clearExamHistory(category) {

    localStorage.removeItem(
        `ssw_history_${category}`
    );

}



function clearAllCBTData() {

    Object.keys(localStorage).forEach(key => {

        if (key.startsWith("ssw_")) {

            localStorage.removeItem(key);

        }

    });

}