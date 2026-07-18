// ============================================================
// loader.js
// SSW CBT Dynamic Data Loader
// ============================================================


/*
===============================================================
MENGAMBIL CONFIG BIDANG
===============================================================
*/

async function loadConfig(category) {

    try {

        const response = await fetch(
            `data/${category}/config.json`
        );


        if (!response.ok) {

            throw new Error(
                "Config tidak ditemukan"
            );

        }


        return await response.json();


    } catch(error) {

        console.error(
            "Load config error:",
            error
        );


        return null;

    }

}






/*
===============================================================
MENGAMBIL BANK SOAL
===============================================================
*/

async function loadQuestions(category) {


    try {


        const response =
            await fetch(
                `data/${category}/questions.json`
            );



        if(!response.ok){

            throw new Error(
                "Questions tidak ditemukan"
            );

        }



        const rawData =
            await response.json();



        return normalizeQuestions(rawData);



    } catch(error){


        console.error(
            "Load questions error:",
            error
        );


        return [];

    }


}









/*
===============================================================
NORMALIZE QUESTION FORMAT

Mengubah:

{
 options:{
   A:"xxx",
   B:"yyy",
   C:"zzz"
 },

 correct_answer:"B"

}


menjadi:


{
 options:[
   "xxx",
   "yyy",
   "zzz"
 ],

 answer:1

}

===============================================================
*/


function normalizeQuestions(data){


    let result=[];



    /*
    -----------------------------------------------------------
    Jika JSON berbentuk kategori:
    
    {
       "haccp":[
          {...}
       ],
       "sanitasi":[
          {...}
       ]
    }

    -----------------------------------------------------------
    */


    if(
        !Array.isArray(data)
    ){


        Object.keys(data)
        .forEach(category=>{


            data[category]
            .forEach(question=>{


                result.push(
                    convertQuestion(
                        question,
                        category
                    )
                );


            });


        });



    }



    /*
    -----------------------------------------------------------
    Jika JSON langsung array

    [
      {...}
    ]

    -----------------------------------------------------------
    */


    else{


        data.forEach(question=>{


            result.push(
                convertQuestion(
                    question,
                    question.category || ""
                )
            );


        });


    }



    return result;

}









/*
===============================================================
CONVERT SINGLE QUESTION
===============================================================
*/


function convertQuestion(
    question,
    category
){



    let options=[];


    let answerIndex=0;



    /*
    -----------------------------------------------------------
    FORMAT LAMA ANDA

    options:{
        A:"",
        B:"",
        C:""
    }

    -----------------------------------------------------------
    */


    if(
        !Array.isArray(
            question.options
        )
    ){



        const keys =
            Object.keys(
                question.options
            );



        options =
            keys.map(
                key =>
                question.options[key]
            );



        answerIndex =
            keys.indexOf(
                question.correct_answer
            );



    }



    /*
    -----------------------------------------------------------
    FORMAT ARRAY
    -----------------------------------------------------------
    */


    else{


        options =
            question.options;



        if(
            typeof question.answer === "number"
        ){

            answerIndex =
                question.answer;

        }


        else if(
            question.correct_answer
        ){


            answerIndex =
            question.correct_answer
            .charCodeAt(0)
            -
            65;


        }


    }






    return {


        id:
        question.id
        ||
        crypto.randomUUID(),



        category:
        category,



        question:
        question.question,



        options:
        options,



        answer:
        answerIndex,



        explanation:
        question.explanation
        ||
        ""

    };


}










/*
===============================================================
SHUFFLE
===============================================================
*/


function shuffleArray(array){


    const arr =
        [...array];



    for(
        let i=arr.length-1;
        i>0;
        i--
    ){


        const j =
        Math.floor(
            Math.random()
            *
            (i+1)
        );



        [
            arr[i],
            arr[j]
        ]
        =
        [
            arr[j],
            arr[i]
        ];


    }


    return arr;

}


/*
===============================================================
LOCAL STORAGE CATEGORY
===============================================================
*/


function getActiveCategory(){


    return localStorage.getItem(
        "examCategory"
    );


}