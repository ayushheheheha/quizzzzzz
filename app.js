import { supabase } from './supabase-config.js';

// State
let allSubjects = [];
let currentSubjectIndex = -1;
let currentQuestionIndex = 0;
let score = 0;
let userAnswers = [];
let visitedQuestions = new Set();

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
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const paletteToggleBtn = document.getElementById('palette-toggle-btn');
const paletteModal = document.getElementById('question-palette-modal');
const paletteGrid = document.getElementById('question-palette-grid');
const closePaletteBtn = document.getElementById('close-palette-btn');

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
window.addEventListener('DOMContentLoaded', () => {
    fetchSubjects();

    // Subscribe to realtime changes
    const channel = supabase
        .channel('public:subjects')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'subjects' }, payload => {
            console.log('Change received!', payload);
            fetchSubjects();
        })
        .subscribe();
});

async function fetchSubjects() {
    const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching data:', error);
        subjectList.innerHTML = '<p class="text-muted" style="grid-column: 1/-1; text-align: center; color: var(--error);">Error connecting to Database. Please check your <code>supabase-config.js</code> API keys.</p>';
        return;
    }

    allSubjects = data || [];
    renderHome();
}


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
            <div class="add-questions-btn" title="Add More Questions">+</div>
            <div class="delete-subject-btn" title="Delete Subject">&times;</div>
        `;

        // Click on card to start
        card.addEventListener('click', (e) => {
            // Check if delete button was clicked
            if (e.target.classList.contains('delete-subject-btn')) {
                e.stopPropagation();
                initDeleteSubject(subject.id);
            } else if (e.target.classList.contains('add-questions-btn')) {
                e.stopPropagation();
                openAddModal(subject.name);
            } else {
                startQuiz(index);
            }
        });

        subjectList.appendChild(card);
    });
}

// Modal Logic
function openAddModal(existingName = '') {
    addModal.classList.remove('hidden');
    subjectNameInput.value = existingName;
    jsonInput.value = '';
    modalError.textContent = '';

    const titleEl = addModal.querySelector('h2');
    if (existingName) {
        titleEl.textContent = `Add Questions to "${existingName}"`;
    } else {
        titleEl.textContent = 'Add New Subject';
    }
}

addSubjectBtn.addEventListener('click', () => {
    openAddModal();
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
            // Generate unique ID if missing
            if (!q.id) {
                q.id = crypto.randomUUID();
            }
        });

        // Check if exists in DB (to avoid creating duplicates if name matches explicitly, though logic handles updates)
        saveSubjectBtn.innerText = "Saving...";
        saveSubjectBtn.disabled = true;

        // Check if subject exists (case insensitive?) - Supabase strict match for now
        // Let's rely on finding by name in our local list first to get ID if possible, 
        // OR query Supabase. Querying is safer for multi-user.

        const { data: existingSubjects, error: searchError } = await supabase
            .from('subjects')
            .select('*')
            .eq('name', name);

        if (searchError) throw searchError;

        if (existingSubjects && existingSubjects.length > 0) {
            // Update existing
            const subjectToUpdate = existingSubjects[0];
            const updatedQuestions = (subjectToUpdate.questions || []).concat(questions);

            const { error: updateError } = await supabase
                .from('subjects')
                .update({ questions: updatedQuestions })
                .eq('id', subjectToUpdate.id);

            if (updateError) throw updateError;

            alert(`Subject "${name}" updated! Added ${questions.length} new questions.`);
        } else {
            // Create new
            const { error: insertError } = await supabase
                .from('subjects')
                .insert([{ name: name, questions: questions }]);

            if (insertError) throw insertError;
        }

        addModal.classList.add('hidden');
        fetchSubjects();

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
            const { error } = await supabase
                .from('subjects')
                .delete()
                .eq('id', subjectIdToDelete);

            if (error) throw error;

            confirmModal.classList.add('hidden');
            subjectIdToDelete = null;
            fetchSubjects();
        } catch (e) {
            alert("Error deleting: " + e.message);
        }
    }
});

cancelDeleteBtn.addEventListener('click', () => {
    confirmModal.classList.add('hidden');
    subjectIdToDelete = null;
});


// Quiz Logic 
function startQuiz(index) {
    currentSubjectIndex = index;
    const subject = allSubjects[index];

    if (!subject.questions || subject.questions.length === 0) {
        alert("This subject has no questions.");
        return;
    }

    currentQuestionIndex = 0;
    score = 0;
    userAnswers = new Array(subject.questions.length).fill(null);
    visitedQuestions = new Set(); // Track visited questions
    console.log("Starting quiz. Questions:", subject.questions.length);

    homeSection.classList.add('hidden');
    resultSection.classList.add('hidden');
    quizSection.classList.remove('hidden');

    renderQuestion();
    updateHeader();
    renderPalette(); // Render palette BEFORE updating buttons/state potentially
    updateNavButtons();
}

function updateHeader() {
    const subject = allSubjects[currentSubjectIndex];
    const total = subject.questions.length;

    questionCounter.textContent = `Question ${currentQuestionIndex + 1}/${total}`;

    const progress = ((currentQuestionIndex) / total) * 100;
    progressFill.style.width = `${progress}%`;

    // Calculate score based on userAnswers
    const currentScore = calculateScore();
    currentScoreEl.textContent = currentScore;

    updatePaletteActiveState();
}

function renderQuestion() {
    const subject = allSubjects[currentSubjectIndex];
    const questionData = subject.questions[currentQuestionIndex];

    questionText.textContent = questionData.question;
    optionsContainer.innerHTML = '';

    // Mark as visited
    if (visitedQuestions) visitedQuestions.add(currentQuestionIndex);
    updatePaletteActiveState(); // Update palette immediately to reflect visited status

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

    // Auto-advance removed as per request
    // setTimeout(() => {
    //     nextQuestion();
    // }, 1200);
}

// Navigation Listeners
prevBtn.addEventListener('click', () => {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderQuestion();
        updateHeader();
        updateNavButtons();
    }
});

nextBtn.addEventListener('click', () => {
    const subject = allSubjects[currentSubjectIndex];
    if (currentQuestionIndex < subject.questions.length - 1) {
        currentQuestionIndex++;
        renderQuestion();
        updateHeader();
        updateNavButtons();
    } else {
        showResult();
    }
});

function updateNavButtons() {
    const subject = allSubjects[currentSubjectIndex];
    if (!subject) return;

    prevBtn.disabled = currentQuestionIndex === 0;

    if (currentQuestionIndex === subject.questions.length - 1) {
        nextBtn.textContent = 'Finish Quiz';
    } else {
        nextBtn.textContent = 'Next ❯';
    }

    // Also update palette active state here to be safe
    updatePaletteActiveState();
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




function renderPalette() {
    try {
        console.log("Rendering Palette...");
        const paletteGrid = document.getElementById('question-palette-grid');

        if (!paletteGrid) {
            console.error("Palette Grid Element not found!");
            alert("Error: Palette Grid element missing!");
            return;
        }
        paletteGrid.innerHTML = '';

        if (currentSubjectIndex === -1 || !allSubjects[currentSubjectIndex]) {
            console.error("No current subject selected");
            return;
        }

        const subject = allSubjects[currentSubjectIndex];

        if (!Array.isArray(subject.questions)) {
            console.error("subject.questions is NOT an array:", subject.questions);
            alert("Error: Questions data is malformed (not an array).");
            return;
        }

        console.log(`Rendering palette for ${subject.questions.length} questions`);

        subject.questions.forEach((_, i) => {
            const btn = document.createElement('div');
            btn.className = 'palette-btn';
            btn.textContent = i + 1;

            // Initial state
            // Inline null check for safety
            const isAnswered = typeof userAnswers !== 'undefined' && userAnswers[i] !== null && userAnswers[i] !== undefined;
            const isVisited = visitedQuestions.has(i);
            const isCurrent = i === currentQuestionIndex;

            if (isAnswered) {
                btn.classList.add('answered');
            } else if (isVisited && !isCurrent) {
                btn.classList.add('skipped');
            }

            if (isCurrent) {
                btn.classList.add('current');
            }

            btn.onclick = () => {
                console.log("Palette clicked:", i);
                currentQuestionIndex = i;
                renderQuestion();
                updateHeader();
                updateNavButtons();
            };

            paletteGrid.appendChild(btn);
        });

    } catch (e) {
        console.error("Error in renderPalette:", e);
        alert("System Error in renderPalette: " + e.message);
    }
}

function updatePaletteActiveState() {
    const paletteGrid = document.getElementById('question-palette-grid');
    if (!paletteGrid) return;

    const btns = paletteGrid.querySelectorAll('.palette-btn');
    btns.forEach((btn, i) => {
        // Reset classes
        btn.classList.remove('current', 'answered', 'skipped');

        const isAnswered = userAnswers && userAnswers[i] !== null;
        const isVisited = visitedQuestions.has(i);
        const isCurrent = i === currentQuestionIndex;

        if (isAnswered) {
            btn.classList.add('answered');
        } else if (isVisited && !isCurrent) {
            btn.classList.add('skipped');
        }

        if (isCurrent) {
            btn.classList.add('current');
        }
    });
}

// Palette Toggles - Removed as now persistent sidebar
// paletteToggleBtn.addEventListener('click', () => { ... });
// closePaletteBtn.addEventListener('click', () => { ... });

// Window click for palette modal - Removed


// ... existing code ...

