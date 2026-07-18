// ==========================================================================
// 1. config.js
// ==========================================================================
// Menyediakan pemetaan folder dan konfigurasi dasar untuk setiap kategori ujian.
const EXAM_CATEGORIES = {
    "pm": {
        folder: "pm",
        title: "Food Manufacturing",
        jpTitle: "飲食料品製造業技能測定試験"
    },
    "kaigo": {
        folder: "kaigo",
        title: "Caregiver",
        jpTitle: "介護技能評価試験"
    }
};

function getActiveCategory() {
    const category = localStorage.getItem("examCategory");
    return EXAM_CATEGORIES[category] ? category : null;
}

// =========================
// LOAD CONFIG
// =========================

async function loadConfig(category){

    if(!EXAM_CATEGORIES[category]){
        return null;
    }

    try{

        const response = await fetch(
            `data/${EXAM_CATEGORIES[category].folder}/config.json`
        );

        if(!response.ok){
            throw new Error("Config not found");
        }

        return await response.json();

    }catch(error){

        console.error(error);

        return null;
    }
}