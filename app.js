import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, updateDoc, doc, arrayUnion, onSnapshot, query, where, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// State
let allSubjects = [];
let currentSubjectIndex = -1;
let currentQuestionIndex = 0;
let score = 0;

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
let subjectIdToDelete = null;

// Initialization
// Listen for real-time updates
const subjectsRef = collection(db, "subjects");

onSnapshot(subjectsRef, (snapshot) => {
    allSubjects = [];
    snapshot.docs.forEach(doc => {
        allSubjects.push({ ...doc.data(), id: doc.id });
    });
    renderHome();
}, (error) => {
    console.error("Error getting documents: ", error);
    if (error.code === 'permission-denied' || error.code === 'api-key-not-valid') {
        subjectList.innerHTML = '<p class="text-muted" style="grid-column: 1/-1; text-align: center; color: var(--error);">Error connecting to Database. Please check your <code>firebase-config.js</code> API keys.</p>';
    }
});


function renderHome() {
    subjectList.innerHTML = '';

    if (allSubjects.length === 0) {
        subjectList.innerHTML = '<p class="text-muted" style="grid-column: 1/-1; text-align: center;">No subjects found in the database. Add one!</p>';
        return;
    }

    allSubjects.forEach((subject, index) => {
        const card = document.createElement('div');
        card.className = 'subject-card';
        card.innerHTML = `
            <h3>${subject.name}</h3>
            <p>${subject.questions ? subject.questions.length : 0} Questions</p>
            <div class="delete-subject-btn" title="Delete Subject">&times;</div>
        `;

        // Click on card to start
        card.addEventListener('click', (e) => {
            // Check if delete button was clicked
            if (e.target.classList.contains('delete-subject-btn')) {
                e.stopPropagation();
                initDeleteSubject(subject.id);
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

saveSubjectBtn.addEventListener('click', async () => {
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
            questions = parsedData;
        } else if (typeof parsedData === 'object' && parsedData !== null) {
            if (parsedData.questions && Array.isArray(parsedData.questions)) {
                questions = parsedData.questions;
            }
            if (!name && parsedData.quiz_title) {
                name = parsedData.quiz_title;
            }
        }

        if (!name) {
            modalError.textContent = 'Please enter a subject name or ensure the JSON has a "quiz_title".';
            return;
        }

        if (!Array.isArray(questions) || questions.length === 0) {
            throw new Error('Could not find a valid list of questions in the JSON.');
        }

        questions.forEach((q, i) => {
            if (!q.question || !q.options || !q.answer || !Array.isArray(q.options)) {
                throw new Error(`Question #${i + 1} is missing required fields.`);
            }
        });

        // Check if exists in DB
        saveSubjectBtn.innerText = "Saving...";
        saveSubjectBtn.disabled = true;

        const q = query(subjectsRef, where("name", "==", name));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            // Update existing
            const docRef = querySnapshot.docs[0].ref;
            const existingData = querySnapshot.docs[0].data();

            // We need to concat. Firestore arrayUnion only adds UNIQUE elements.
            // But questions are objects, so uniqueness is strict. 
            // It's safer to read, merge, and update.
            const updatedQuestions = (existingData.questions || []).concat(questions);

            await updateDoc(docRef, {
                questions: updatedQuestions
            });

            alert(`Subject "${name}" updated! Added ${questions.length} new questions.`);
        } else {
            // Create new
            await addDoc(subjectsRef, {
                name: name,
                questions: questions
            });
        }

        addModal.classList.add('hidden');
        renderHome(); // Snapshot will trigger re-render anyway, but this feels snappy

    } catch (err) {
        modalError.textContent = 'Error: ' + err.message;
        console.error(err);
    } finally {
        saveSubjectBtn.innerText = "Save Subject";
        saveSubjectBtn.disabled = false;
    }
});

function initDeleteSubject(id) {
    subjectIdToDelete = id;
    confirmModal.classList.remove('hidden');
}

confirmDeleteBtn.addEventListener('click', async () => {
    if (subjectIdToDelete) {
        try {
            await deleteDoc(doc(db, "subjects", subjectIdToDelete));
            confirmModal.classList.add('hidden');
            subjectIdToDelete = null;
        } catch (e) {
            alert("Error deleting: " + e.message);
        }
    }
});

cancelDeleteBtn.addEventListener('click', () => {
    confirmModal.classList.add('hidden');
    subjectIdToDelete = null;
});


// Quiz Logic (Mostly unchanged, just using new structure)
function startQuiz(index) {
    currentSubjectIndex = index;
    const subject = allSubjects[index];

    if (!subject.questions || subject.questions.length === 0) {
        alert("This subject has no questions.");
        return;
    }

    currentQuestionIndex = 0;
    score = 0;

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

    questionData.options.forEach(option => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = option;

        btn.onclick = () => handleAnswer(option, btn, questionData.answer);

        optionsContainer.appendChild(btn);
    });
}

function handleAnswer(selected, btnElement, correct) {
    const allBtns = optionsContainer.querySelectorAll('.option-btn');
    allBtns.forEach(b => b.disabled = true);

    if (selected === correct) {
        btnElement.classList.add('correct');
        score += 10;
        currentScoreEl.textContent = score;
    } else {
        btnElement.classList.add('wrong');
        allBtns.forEach(b => {
            if (b.textContent === correct) {
                b.classList.add('correct');
            }
        });
    }

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

exitQuizBtn.addEventListener('click', () => {
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

// Expose handleAnswer to window? No, event listeners used.
// Expose functions if needed for debugging
window.db = db;
