import { GEMINI_API_KEY, GEMINI_API_URL } from './config.js';

// We'll add JavaScript functionality in later steps
console.log('AI Quiz Generator initialized'); 

// Store quiz data
let currentQuiz = {
    questions: [],
    answers: {} // Change to object to store answers by question number
};

// DOM Elements
const quizForm = document.getElementById('quizForm');
const textInput = document.getElementById('textInput');
const fileInput = document.getElementById('fileInput');
const questionCount = document.getElementById('questionCount');
const quizSection = document.getElementById('quizSection');
const quizQuestions = document.getElementById('quizQuestions');
const submitQuizBtn = document.getElementById('submitQuiz');
const resultsSection = document.getElementById('resultsSection');
const resultsContainer = document.getElementById('resultsContainer');
const newQuizBtn = document.getElementById('newQuiz');
const difficultyLevel = document.getElementById('difficultyLevel');
const loadingScreen = document.getElementById('loadingScreen');
const themeToggle = document.getElementById('themeToggle');
const questionType = document.getElementById('questionType');
const timerToggle = document.getElementById('timerToggle');
const timerSettings = document.getElementById('timerSettings');
const timerMinutes = document.getElementById('timerMinutes');
const viewMode = document.getElementById('viewMode');
const aboutBtn = document.getElementById('aboutBtn');
const aboutModal = document.getElementById('aboutModal');
const closeBtn = aboutModal.querySelector('.close-btn');
let timerInterval;
let timeLeft;
let currentQuestionIndex = 0;

// Handle file input
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const formGroup = fileInput.closest('.form-group');
        formGroup.classList.add('loading');

        let text;
        if (file.type === 'application/pdf') {
            text = await extractTextFromPDF(file);
        } else {
            text = await file.text();
        }
        textInput.value = text;

        const fileName = file.name || 'No file chosen';
        e.target.parentElement.querySelector('.file-name').textContent = fileName;

        formGroup.classList.remove('loading');
    } catch (error) {
        console.error('Error reading file:', error);
        alert('Error reading file: ' + error.message);
        fileInput.value = ''; // Clear the file input
        formGroup.classList.remove('loading');
    }
});

// Add function to extract text from PDF
async function extractTextFromPDF(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        
        // Use the global pdfjsLib variable
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        let fullText = '';
        
        // Extract text from each page
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n';
        }
        
        return fullText.trim();
    } catch (error) {
        console.error('Error extracting PDF text:', error);
        throw new Error('Could not read PDF file. Please make sure it\'s a valid PDF document.');
    }
}

// Update the form submission handler
quizForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const text = textInput.value.trim();
    const numQuestions = parseInt(questionCount.value);
    
    if (!text) {
        alert('Please enter some text or upload a file');
        return;
    }
    
    if (isNaN(numQuestions) || numQuestions < 1 || numQuestions > 30) {
        alert('Please enter a valid number of questions (1-30)');
        return;
    }
    
    try {
        // Show loading screen
        loadingScreen.classList.remove('hidden');
        const generateBtn = document.getElementById('generateBtn');
        if (generateBtn) {
            generateBtn.disabled = true;
        }
        
        // Generate the quiz
        await generateQuiz(text, numQuestions);
        
        // Hide form and show quiz
        quizForm.classList.add('hidden');
        quizSection.classList.remove('hidden');
        
        // Start timer if enabled
        if (timerToggle.checked) {
            const duration = parseInt(timerMinutes.value);
            if (duration > 0) {
                startTimer(duration);
            }
        }
    } catch (error) {
        console.error('Quiz generation error:', error);
        alert('Error generating quiz: ' + error.message);
    } finally {
        // Hide loading screen and re-enable button
        loadingScreen.classList.add('hidden');
        const generateBtn = document.getElementById('generateBtn');
        if (generateBtn) {
            generateBtn.disabled = false;
        }
    }
});

// Update the displayQuestions function
function displayQuestions(questions) {
    currentQuiz.questions = questions;
    currentQuestionIndex = 0;
    
    if (viewMode.value === 'single') {
        displaySingleQuestion();
    } else {
        displayAllQuestions();
    }
}

// Update displaySingleQuestion to preserve answers
function displaySingleQuestion() {
    const question = currentQuiz.questions[currentQuestionIndex];
    const totalQuestions = currentQuiz.questions.length;
    const questionNumber = currentQuestionIndex + 1;
    
    quizQuestions.innerHTML = `
        <div class="progress-container">
            <div class="progress-text">
                <span>Question ${questionNumber} of ${totalQuestions}</span>
                <span>${Math.round((questionNumber / totalQuestions) * 100)}%</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${(questionNumber / totalQuestions) * 100}%"></div>
            </div>
        </div>
        ${generateQuestionHTML(question, currentQuestionIndex)}
        <div class="question-navigation">
            <button type="button" class="nav-btn" id="prevQuestion" ${currentQuestionIndex === 0 ? 'disabled' : ''}>
                Previous Question
            </button>
            <button type="button" class="nav-btn" id="nextQuestion">
                ${currentQuestionIndex === totalQuestions - 1 ? 'Finish Quiz' : 'Next Question'}
            </button>
        </div>
    `;
    
    // Restore previous answer if it exists
    const savedAnswer = currentQuiz.answers[questionNumber];
    if (savedAnswer !== undefined) {
        if (question.type === 'multiple-choice') {
            const radioBtn = document.querySelector(`input[name="question${questionNumber}"][value="${savedAnswer}"]`);
            if (radioBtn) radioBtn.checked = true;
        } else {
            const textarea = document.querySelector(`#q${questionNumber}response`);
            if (textarea) textarea.value = savedAnswer;
        }
    }
    
    // Add navigation event listeners
    const prevBtn = document.getElementById('prevQuestion');
    const nextBtn = document.getElementById('nextQuestion');
    
    prevBtn?.addEventListener('click', () => {
        saveCurrentAnswer();
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            displaySingleQuestion();
        }
    });
    
    nextBtn?.addEventListener('click', () => {
        saveCurrentAnswer();
        if (currentQuestionIndex < totalQuestions - 1) {
            currentQuestionIndex++;
            displaySingleQuestion();
        } else {
            submitQuizBtn.click();
        }
    });
}

// Add function to save current answer
function saveCurrentAnswer() {
    const questionNumber = currentQuestionIndex + 1;
    const question = currentQuiz.questions[currentQuestionIndex];
    
    if (question.type === 'multiple-choice') {
        const selectedOption = document.querySelector(`input[name="question${questionNumber}"]:checked`);
        if (selectedOption) {
            currentQuiz.answers[questionNumber] = selectedOption.value;
        }
    } else {
        const textarea = document.querySelector(`#q${questionNumber}response`);
        if (textarea) {
            currentQuiz.answers[questionNumber] = textarea.value;
        }
    }
}

// Add function to display all questions
function displayAllQuestions() {
    quizQuestions.innerHTML = currentQuiz.questions
        .map((question, index) => generateQuestionHTML(question, index))
        .join('');
}

// Add this function before displayQuestions
function generateQuestionHTML(question, index) {
    const questionNumber = index + 1;
    
    if (question.type === 'multiple-choice') {
        return `
            <div class="question ${question.difficulty}">
                <div class="question-text">
                    <span class="question-number">${questionNumber}</span>
                    <div>
                        <span class="difficulty-badge ${question.difficulty}">${question.difficulty}</span>
                        ${question.question}
                    </div>
                </div>
                <div class="options">
                    ${question.options.map((option, optionIndex) => `
                        <label class="option" for="q${questionNumber}o${optionIndex}">
                            <input type="radio" 
                                   name="question${questionNumber}" 
                                   value="${optionIndex}"
                                   id="q${questionNumber}o${optionIndex}">
                            <span>${option}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        `;
    } else {
        return `
            <div class="question ${question.difficulty}">
                <div class="question-text">
                    <span class="question-number">${questionNumber}</span>
                    <div>
                        <span class="difficulty-badge ${question.difficulty}">${question.difficulty}</span>
                        <span class="question-type-badge">Free Response</span>
                        ${question.question}
                    </div>
                </div>
                <div class="free-response">
                    <textarea 
                        class="response-input" 
                        rows="4" 
                        placeholder="Type your answer here..."
                        id="q${questionNumber}response"
                    ></textarea>
                </div>
            </div>
        `;
    }
}

// Update the generateQuiz function
async function generateQuiz(text, numQuestions) {
    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `As an expert educator, create ${numQuestions} sophisticated ${questionType.value} questions from this text. 
                        Difficulty level: ${difficultyLevel.value}

                        Requirements:
                        1. Questions should test deep understanding, critical thinking, and application of concepts
                        2. Include analysis, evaluation, and synthesis-level questions (Bloom's higher levels)
                        3. For multiple-choice questions:
                           - Create plausible distractors that test common misconceptions
                           - Ensure options are mutually exclusive and similar in length
                           - Include "all of the above" or "none of the above" sparingly
                        4. For free-response questions:
                           - Include scenario-based or case study questions
                           - Ask for comparisons, analyses, or evaluations
                           - Require specific examples or evidence from the text

                        Return a JSON array where each question object has this exact format:
                        For multiple-choice:
                        {
                            "question": "detailed question text",
                            "type": "multiple-choice",
                            "difficulty": "${difficultyLevel.value}",
                            "options": ["option1", "option2", "option3", "option4"],
                            "correctAnswer": 0,
                            "explanation": "detailed explanation of the answer"
                        }

                        For free-response:
                        {
                            "question": "detailed question text",
                            "type": "free-response",
                            "difficulty": "${difficultyLevel.value}",
                            "sampleAnswer": "comprehensive model answer",
                            "keyPoints": ["key point 1", "key point 2", "key point 3"],
                            "explanation": "detailed explanation"
                        }

                        Text to generate questions from:
                        ${text}

                        Make questions progressively more challenging. Ensure questions are clear, unambiguous, and test different cognitive levels.
                        Return only the JSON array with no additional text or formatting.`
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2000,
                }
            })
        });

        const data = await response.json();
        
        // Clean and parse the response
        const responseText = data.candidates[0].content.parts[0].text;
        const cleanedResponse = responseText
            .trim()
            .replace(/```json\s*|\s*```/g, '') // Remove code blocks if present
            .replace(/[\n\r]+/g, ' ') // Remove newlines
            .replace(/\s+/g, ' '); // Normalize spaces

        let questions;
        try {
            questions = JSON.parse(cleanedResponse);
            
            // Validate the questions format
            if (!Array.isArray(questions)) {
                throw new Error('Response is not an array');
            }

            questions.forEach((q, i) => {
                if (!q.question || !q.type || !q.difficulty) {
                    throw new Error(`Invalid question format at index ${i}`);
                }
            });

            // Display the questions
            displayQuestions(questions);
            return questions;

        } catch (parseError) {
            console.error('Failed to parse response:', cleanedResponse);
            throw new Error('Invalid question format from AI');
        }

    } catch (error) {
        console.error('Error in generateQuiz:', error);
        throw new Error('Failed to generate quiz: ' + error.message);
    }
}

// Display a single question
function displayQuestion(question) {
    const questionDiv = document.createElement('div');
    questionDiv.className = `question ${question.difficulty}`;
    
    if (question.type === 'multiple-choice') {
        questionDiv.innerHTML = `
            <div class="question-text">
                <span class="question-number">${question.id}</span>
                <div>
                    <span class="difficulty-badge ${question.difficulty}">${question.difficulty}</span>
                    ${question.question}
                </div>
            </div>
            <div class="options">
                ${question.options.map((option, index) => `
                    <label class="option" for="q${question.id}o${index}">
                        <input type="radio" 
                               name="question${question.id}" 
                               value="${index}"
                               id="q${question.id}o${index}">
                        <span>${option}</span>
                    </label>
                `).join('')}
            </div>
        `;
    } else {
        questionDiv.innerHTML = `
            <div class="question-text">
                <span class="question-number">${question.id}</span>
                <div>
                    <span class="difficulty-badge ${question.difficulty}">${question.difficulty}</span>
                    <span class="question-type-badge">Free Response</span>
                    ${question.question}
                </div>
            </div>
            <div class="free-response">
                <textarea 
                    class="response-input" 
                    rows="4" 
                    placeholder="Type your answer here..."
                    id="q${question.id}response"
                ></textarea>
            </div>
        `;
    }
    
    quizQuestions.appendChild(questionDiv);
}

// Update the quiz submission handler
submitQuizBtn.addEventListener('click', async () => {
    // Save the current answer before submitting
    if (viewMode.value === 'single') {
        saveCurrentAnswer();
    } else {
        // Save all answers from the all-questions view
        currentQuiz.questions.forEach((question, index) => {
            const questionNumber = index + 1;
            if (question.type === 'multiple-choice') {
                const selectedOption = document.querySelector(`input[name="question${questionNumber}"]:checked`);
                if (selectedOption) {
                    currentQuiz.answers[questionNumber] = selectedOption.value;
                }
            } else {
                const textarea = document.querySelector(`#q${questionNumber}response`);
                if (textarea) {
                    currentQuiz.answers[questionNumber] = textarea.value;
                }
            }
        });
    }

    try {
        loadingScreen.classList.remove('hidden');
        const results = await gradeQuiz();
        displayResults(results);
        quizSection.classList.add('hidden');
        resultsSection.classList.remove('hidden');
    } catch (error) {
        console.error('Grading error:', error);
        alert('Error grading quiz: ' + error.message);
    } finally {
        loadingScreen.classList.add('hidden');
    }
});

// Update the grading prompt for better feedback
async function gradeQuiz() {
    const results = [];
    
    for (let i = 0; i < currentQuiz.questions.length; i++) {
        const question = currentQuiz.questions[i];
        const questionNumber = i + 1;
        
        if (question.type === 'multiple-choice') {
            const selectedAnswer = currentQuiz.answers[questionNumber];
            const isCorrect = selectedAnswer !== undefined ? 
                parseInt(selectedAnswer) === question.correctAnswer : 
                false;
            
            results.push({
                question: question.question,
                type: 'multiple-choice',
                isCorrect,
                correctAnswer: question.options[question.correctAnswer],
                userAnswer: selectedAnswer !== undefined ? 
                    question.options[parseInt(selectedAnswer)] : 
                    'No answer selected',
                explanation: question.explanation
            });
        } else {
            const userResponse = currentQuiz.answers[questionNumber] || '';
            
            if (!userResponse.trim()) {
                results.push({
                    question: question.question,
                    type: 'free-response',
                    score: 0,
                    feedback: 'No answer provided',
                    userAnswer: 'No answer provided',
                    sampleAnswer: question.sampleAnswer,
                    explanation: 'Please provide an answer to receive feedback.'
                });
                continue;
            }

            try {
                // Enhanced grading prompt for better feedback
                const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: `You are grading a free response answer. Return only a valid JSON object with exactly this format:
                                {
                                    "score": <number 0-5>,
                                    "feedback": "<your feedback here>",
                                    "explanation": "<your explanation here>"
                                }

                                Question: ${question.question}
                                Student Answer: ${userResponse}
                                Sample Answer: ${question.sampleAnswer}
                                Key Points: ${question.keyPoints.join(', ')}

                                Score criteria:
                                5: Excellent - Complete and accurate
                                4: Good - Mostly complete with minor gaps
                                3: Fair - Partial understanding shown
                                2: Limited - Significant gaps
                                1: Poor - Major misunderstandings
                                0: No relevant content

                                Evaluate based on:
                                - Accuracy
                                - Completeness
                                - Understanding
                                - Use of details
                                - Clarity

                                Return only the JSON object, nothing else.`
                            }]
                        }],
                        generationConfig: {
                            temperature: 0.3, // Lower temperature for more consistent output
                            maxOutputTokens: 1000,
                        }
                    })
                });

                const grading = await response.json();
                const responseText = grading.candidates[0].content.parts[0].text;
                
                // Clean the response text
                const cleanedResponse = responseText
                    .trim()
                    .replace(/```json\s*|\s*```/g, '') // Remove code blocks
                    .replace(/[\n\r]/g, ' ') // Remove newlines
                    .replace(/\s+/g, ' '); // Normalize spaces

                let gradingResult;
                try {
                    gradingResult = JSON.parse(cleanedResponse);
                } catch (parseError) {
                    console.error('Failed to parse grading response:', cleanedResponse);
                    throw new Error('Invalid grading format');
                }

                // Validate the required fields
                if (typeof gradingResult.score !== 'number' || 
                    !gradingResult.feedback || 
                    !gradingResult.explanation) {
                    throw new Error('Missing required grading fields');
                }

                results.push({
                    question: question.question,
                    type: 'free-response',
                    score: gradingResult.score,
                    feedback: gradingResult.feedback,
                    explanation: gradingResult.explanation,
                    userAnswer: userResponse,
                    sampleAnswer: question.sampleAnswer
                });
            } catch (error) {
                console.error('Grading error:', error);
                results.push({
                    question: question.question,
                    type: 'free-response',
                    score: 0,
                    feedback: 'Error during grading. Please try again.',
                    explanation: 'System was unable to grade this response.',
                    userAnswer: userResponse,
                    sampleAnswer: question.sampleAnswer
                });
            }
        }
    }
    
    return results;
}

// Update the results display to show the explanation
function displayResults(results) {
    const multipleChoiceResults = results.filter(r => r.type === 'multiple-choice');
    const freeResponseResults = results.filter(r => r.type === 'free-response');
    
    const correctCount = multipleChoiceResults.filter(r => r.isCorrect).length;
    const totalScore = freeResponseResults.reduce((sum, r) => sum + r.score, 0);
    const maxPossibleScore = multipleChoiceResults.length + (freeResponseResults.length * 5);
    
    resultsContainer.innerHTML = `
        <div class="score">
            <h3>Your Score: ${correctCount + totalScore}/${maxPossibleScore}</h3>
        </div>
        <div class="results-details">
            ${results.map((result, index) => {
                if (result.type === 'multiple-choice') {
                    return `
                        <div class="result-item ${result.isCorrect ? 'correct' : 'incorrect'}">
                            <p><strong>Question ${index + 1}:</strong> ${result.question}</p>
                            <p>Your answer: ${result.userAnswer}</p>
                            ${!result.isCorrect ? `
                                <p>Correct answer: ${result.correctAnswer}</p>
                                <p class="explanation"><strong>Explanation:</strong> ${result.explanation}</p>
                            ` : ''}
                        </div>
                    `;
                } else {
                    return `
                        <div class="result-item">
                            <p><strong>Question ${index + 1} (Free Response):</strong> ${result.question}</p>
                            <p>Your answer: ${result.userAnswer}</p>
                            <p class="score-badge">Score: ${result.score}/5</p>
                            <div class="feedback">
                                <strong>Feedback:</strong> ${result.feedback}
                            </div>
                            <div class="explanation">
                                <strong>Detailed Explanation:</strong> ${result.explanation}
                            </div>
                            <div class="sample-answer">
                                <strong>Sample Answer:</strong> ${result.sampleAnswer}
                            </div>
                        </div>
                    `;
                }
            }).join('')}
        </div>
    `;
}

// Handle "Generate New Quiz" button
newQuizBtn.addEventListener('click', () => {
    if (timerInterval) {
        clearInterval(timerInterval);
        const timerDisplay = document.querySelector('.timer-display');
        if (timerDisplay) {
            timerDisplay.remove();
        }
    }
    currentQuiz = {
        questions: [],
        answers: {}
    };
    quizQuestions.innerHTML = '';
    resultsContainer.innerHTML = '';
    textInput.value = '';
    fileInput.value = '';
    resultsSection.classList.add('hidden');
    quizForm.classList.remove('hidden');
});

// Update the theme toggle function
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}

// Update theme toggle event listener
themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
});

// Add timer toggle functionality
timerToggle.addEventListener('change', () => {
    timerSettings.classList.toggle('hidden', !timerToggle.checked);
});

// Function to format time
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Function to create timer display
function createTimerDisplay() {
    const timerDisplay = document.createElement('div');
    timerDisplay.className = 'timer-display';
    document.body.appendChild(timerDisplay);
    return timerDisplay;
}

// Function to start timer
function startTimer(duration) {
    const timerDisplay = createTimerDisplay();
    timeLeft = duration * 60; // Convert minutes to seconds
    const fiveMinutes = 5 * 60; // 5 minutes in seconds
    const oneMinute = 60; // 1 minute in seconds
    
    function updateTimer() {
        timerDisplay.textContent = formatTime(timeLeft);
        
        // Add warning classes based on time remaining
        if (timeLeft <= fiveMinutes) {
            timerDisplay.classList.remove('normal');
            timerDisplay.classList.add('warning');
            
            if (timeLeft === fiveMinutes) {
                // Flash 5-minute warning
                showTimerAlert('5 minutes remaining!');
            }
            
            if (timeLeft <= oneMinute) {
                timerDisplay.classList.remove('warning');
                timerDisplay.classList.add('urgent');
                
                if (timeLeft === oneMinute) {
                    // Flash 1-minute warning
                    showTimerAlert('1 minute remaining!');
                }
            }
        }
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            showTimerAlert('Time\'s up!');
            submitQuizBtn.click(); // Auto-submit when time is up
            timerDisplay.remove();
        }
        timeLeft--;
    }
    
    updateTimer(); // Initial display
    timerInterval = setInterval(updateTimer, 1000);
}

// Add function to show timer alerts
function showTimerAlert(message) {
    const alert = document.createElement('div');
    alert.className = 'timer-alert';
    alert.textContent = message;
    document.body.appendChild(alert);
    
    // Remove alert after animation
    setTimeout(() => {
        alert.classList.add('fade-out');
        setTimeout(() => alert.remove(), 500);
    }, 2000);
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Set initial theme
    setTheme(savedTheme);
    
    // Set initial tab
    const activeTab = document.querySelector('.tab-btn.active');
    if (activeTab) {
        const tabContent = document.getElementById(activeTab.dataset.tab + 'Tab');
        if (tabContent) {
            tabContent.classList.add('active');
        }
    }
    
    // Clear any existing form data
    quizForm.reset();
    if (essayInput) {
        essayInput.value = '';
    }
});

// Add view mode change handler
viewMode.addEventListener('change', () => {
    if (currentQuiz.questions.length > 0) {
        displayQuestions(currentQuiz.questions);
    }
});

// Add modal functionality
aboutBtn.addEventListener('click', () => {
    aboutModal.classList.remove('hidden');
    setTimeout(() => aboutModal.classList.add('show'), 10);
});

closeBtn.addEventListener('click', closeModal);

aboutModal.addEventListener('click', (e) => {
    if (e.target === aboutModal) {
        closeModal();
    }
});

function closeModal() {
    aboutModal.classList.remove('show');
    setTimeout(() => aboutModal.classList.add('hidden'), 300);
}

// Add escape key handler
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !aboutModal.classList.contains('hidden')) {
        closeModal();
    }
});