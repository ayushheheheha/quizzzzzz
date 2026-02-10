// State
let allSubjects = [];
let currentSubjectIndex = -1;
let currentQuestionIndex = 0;
let score = 0;
let userAnswers = []; // To track history if needed later

// DOM Elements
const homeSection = document.getElementById('home-section');
const quizSection = document.getElementById('quiz-section');
const resultSection = document.getElementById('result-section');
const subjectList = document.getElementById('subject-list');

const addModal = document.getElementById('add-modal');
const addSubjectBtn = document.getElementById('add-subject-btn');
const closeModalBtn = document.getElementById('close-modal');
const saveSubjectBtn = document.getElementById('save-subject-btn');
const modalError = document.getElementById('modal-error');
const subjectNameInput = document.getElementById('subject-name');
const jsonInput = document.getElementById('json-input');

// Quiz Elements
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const questionCounter = document.getElementById('question-counter');
const progressFill = document.getElementById('progress-fill');
const currentScoreEl = document.getElementById('current-score');
const exitQuizBtn = document.getElementById('exit-quiz-btn');

// Result Elements
const finalScoreEl = document.getElementById('final-score');
const totalQuestionsEl = document.getElementById('total-questions');
const resultMessage = document.getElementById('result-message');
const retryBtn = document.getElementById('retry-btn');
const homeBtn = document.getElementById('home-btn');

const confirmModal = document.getElementById('confirm-modal');
const confirmDeleteBtn = document.getElementById('confirm-delete');
const cancelDeleteBtn = document.getElementById('cancel-delete');
let subjectToDeleteIndex = -1;


// Initialization
window.addEventListener('DOMContentLoaded', () => {
    loadData();
    renderHome();
});

// Logic
function loadData() {
    const storedSubjects = localStorage.getItem('quizSubjects');
    if (storedSubjects) {
        allSubjects = JSON.parse(storedSubjects);
    } else {
        // Load default data from data.js if exists
        if (typeof defaultSubjects !== 'undefined') {
            allSubjects = defaultSubjects;
            saveData();
        }
    }
}

function saveData() {
    localStorage.setItem('quizSubjects', JSON.stringify(allSubjects));
    renderHome();
}

function renderHome() {
    subjectList.innerHTML = '';

    // Add "New" Card ?? No, button in header is enough.

    if (allSubjects.length === 0) {
        subjectList.innerHTML = '<p class="text-muted" style="grid-column: 1/-1; text-align: center;">No subjects found. Click "Add Subject" to begin!</p>';
        return;
    }

    allSubjects.forEach((subject, index) => {
        const card = document.createElement('div');
        card.className = 'subject-card';
        card.innerHTML = `
            <h3>${subject.name}</h3>
            <p>${subject.questions.length} Questions</p>
            <div class="delete-subject-btn" title="Delete Subject">&times;</div>
        `;

        // Click on card to start
        card.addEventListener('click', (e) => {
            // Check if delete button was clicked
            if (e.target.classList.contains('delete-subject-btn')) {
                e.stopPropagation();
                initDeleteSubject(index);
            } else {
                startQuiz(index);
            }
        });

        subjectList.appendChild(card);
    });
}

// Modal Logic
addSubjectBtn.addEventListener('click', () => {
    addModal.classList.remove('hidden');
    subjectNameInput.value = '';
    jsonInput.value = '';
    modalError.textContent = '';
});

closeModalBtn.addEventListener('click', () => {
    addModal.classList.add('hidden');
});

// Close modal if clicking outside
window.addEventListener('click', (e) => {
    if (e.target === addModal) {
        addModal.classList.add('hidden');
    }
    if (e.target === confirmModal) {
        confirmModal.classList.add('hidden');
    }
});

saveSubjectBtn.addEventListener('click', () => {
    let name = subjectNameInput.value.trim();
    const jsonStr = jsonInput.value.trim();

    if (!jsonStr) {
        modalError.textContent = 'Please provide the questions JSON.';
        return;
    }

    try {
        const parsedData = JSON.parse(jsonStr);
        let questions = [];

        // Handle different formats
        if (Array.isArray(parsedData)) {
            // Old format: just an array of questions
            questions = parsedData;
        } else if (typeof parsedData === 'object' && parsedData !== null) {
            // New format: Object with quiz_title and questions
            if (parsedData.questions && Array.isArray(parsedData.questions)) {
                questions = parsedData.questions;
            }
            // Use quiz_title if name input is empty
            if (!name && parsedData.quiz_title) {
                name = parsedData.quiz_title;
            }
        }

        if (!name) {
            modalError.textContent = 'Please enter a subject name or ensure the JSON has a "quiz_title".';
            return;
        }

        // Simple validation
        if (!Array.isArray(questions) || questions.length === 0) {
            throw new Error('Could not find a valid list of questions in the JSON.');
        }

        questions.forEach((q, i) => {
            if (!q.question || !q.options || !q.answer || !Array.isArray(q.options)) {
                throw new Error(`Question #${i + 1} is missing required fields (question, options, answer).`);
            }
        });

        allSubjects.push({ name, questions });
        saveData();
        addModal.classList.add('hidden');
        renderHome();

    } catch (err) {
        modalError.textContent = 'Invalid JSON: ' + err.message;
    }
});

function initDeleteSubject(index) {
    subjectToDeleteIndex = index;
    confirmModal.classList.remove('hidden');
}

confirmDeleteBtn.addEventListener('click', () => {
    if (subjectToDeleteIndex > -1) {
        allSubjects.splice(subjectToDeleteIndex, 1);
        saveData();
        confirmModal.classList.add('hidden');
        subjectToDeleteIndex = -1;
    }
});

cancelDeleteBtn.addEventListener('click', () => {
    confirmModal.classList.add('hidden');
    subjectToDeleteIndex = -1;
});


// Quiz Logic
function startQuiz(index) {
    currentSubjectIndex = index;
    const subject = allSubjects[index];

    if (subject.questions.length === 0) {
        alert("This subject has no questions.");
        return;
    }

    currentQuestionIndex = 0;
    score = 0;

    // Switch Views
    homeSection.classList.add('hidden');
    resultSection.classList.add('hidden');
    quizSection.classList.remove('hidden');

    renderQuestion();
    updateHeader();
}

function updateHeader() {
    const subject = allSubjects[currentSubjectIndex];
    const total = subject.questions.length;

    questionCounter.textContent = `Question ${currentQuestionIndex + 1}/${total}`;

    const progress = ((currentQuestionIndex) / total) * 100;
    progressFill.style.width = `${progress}%`;

    currentScoreEl.textContent = score;
}

function renderQuestion() {
    const subject = allSubjects[currentSubjectIndex];
    const questionData = subject.questions[currentQuestionIndex];

    questionText.textContent = questionData.question;
    optionsContainer.innerHTML = '';

    // Randomize options? optional. For now, keep as is to preserve logic with 'answer'.
    // Or better, just render them.

    questionData.options.forEach(option => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = option;

        btn.onclick = () => handleAnswer(option, btn, questionData.answer);

        optionsContainer.appendChild(btn);
    });
}

function handleAnswer(selected, btnElement, correct) {
    // Disable all buttons to prevent double clicking
    const allBtns = optionsContainer.querySelectorAll('.option-btn');
    allBtns.forEach(b => b.disabled = true);

    if (selected === correct) {
        btnElement.classList.add('correct');
        score += 10;
        currentScoreEl.textContent = score;
    } else {
        btnElement.classList.add('wrong');
        // Highlight correct one
        allBtns.forEach(b => {
            if (b.textContent === correct) {
                b.classList.add('correct');
            }
        });
    }

    // Wait then next question
    setTimeout(() => {
        nextQuestion();
    }, 1200);
}

function nextQuestion() {
    const subject = allSubjects[currentSubjectIndex];
    currentQuestionIndex++;

    if (currentQuestionIndex < subject.questions.length) {
        renderQuestion();
        updateHeader();
    } else {
        showResult();
    }
}

function showResult() {
    quizSection.classList.add('hidden');
    resultSection.classList.remove('hidden');

    const total = allSubjects[currentSubjectIndex].questions.length;
    const maxScore = total * 10;

    finalScoreEl.textContent = score;
    totalQuestionsEl.textContent = maxScore;

    const percentage = (score / maxScore) * 100;

    if (percentage === 100) {
        resultMessage.textContent = "Perfect Score! You're a master! 🏆";
    } else if (percentage >= 80) {
        resultMessage.textContent = "Great job! Keep it up! 🌟";
    } else if (percentage >= 50) {
        resultMessage.textContent = "Good effort! Practice makes perfect. 👍";
    } else {
        resultMessage.textContent = "Keep studying, you'll get there! 📚";
    }
}

// Navigation Events
exitQuizBtn.addEventListener('click', () => {
    // Maybe confirm?
    homeSection.classList.remove('hidden');
    quizSection.classList.add('hidden');
    resultSection.classList.add('hidden');
    renderHome();
});

retryBtn.addEventListener('click', () => {
    startQuiz(currentSubjectIndex);
});

homeBtn.addEventListener('click', () => {
    homeSection.classList.remove('hidden');
    quizSection.classList.add('hidden');
    resultSection.classList.add('hidden');
    renderHome();
});
