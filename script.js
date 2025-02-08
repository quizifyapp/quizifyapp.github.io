import { GEMINI_API_KEY, GEMINI_API_URL } from './config.js';

// We'll add JavaScript functionality in later steps
console.log('AI Quiz Generator initialized'); 

// Store quiz data
let currentQuiz = {
    questions: [],
    answers: []
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
let timerInterval;
let timeLeft;

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

// Generate quiz questions
async function generateQuiz(text, numQuestions) {
    try {
        const difficulty = difficultyLevel.value;
        const type = questionType.value;
        
        if (!difficulty || !type) {
            throw new Error('Missing difficulty level or question type');
        }

        const difficultyPrompts = {
            beginner: "Use simple vocabulary and straightforward questions. Focus on basic recall and understanding.",
            easy: "Use basic concepts and clear language. Include some simple analysis questions.",
            medium: "Balance recall and analysis questions. Use moderate complexity in language and concepts.",
            hard: "Include complex analysis and application questions. Use advanced vocabulary and concepts.",
            expert: "Focus on deep analysis, evaluation, and synthesis. Use expert-level terminology and complex scenarios."
        };

        const typePrompts = {
            'multiple-choice': 'Generate only multiple choice questions.',
            'free-response': 'Generate only free response questions that require written answers.',
            'mixed': 'Generate a mix of multiple choice and free response questions. About 70% multiple choice and 30% free response.'
        };

        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Generate ${numQuestions} questions based on this text: "${text}".
                        Difficulty level: ${difficulty}
                        Question type: ${type}
                        ${difficultyPrompts[difficulty]}
                        ${typePrompts[type]}
                        
                        You must return a valid JSON array. Each question object must exactly match one of these two formats:

                        For multiple choice questions:
                        {
                            "type": "multiple-choice",
                            "question": "What is...?",
                            "options": ["A", "B", "C", "D"],
                            "correctAnswer": 0,
                            "explanation": "This is correct because...",
                            "difficulty": "${difficulty}"
                        }
                        
                        IMPORTANT: For multiple choice questions:
                        - Each question must have exactly ONE correct answer
                        - Do NOT create "select all that apply" questions
                        - Do NOT create questions with multiple correct answers
                        - The options array must have exactly 4 choices
                        - The correctAnswer must be the index (0-3) of the single correct option
                        
                        For free response questions:
                        {
                            "type": "free-response",
                            "question": "Explain how...?",
                            "sampleAnswer": "A complete answer would include...",
                            "keyPoints": ["First key point", "Second key point", "Third key point"],
                            "difficulty": "${difficulty}"
                        }

                        The response must be a JSON array containing these objects, like this:
                        [
                            {question object 1},
                            {question object 2},
                            etc...
                        ]

                        Ensure all required fields are present and properly formatted.`
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2000,
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new Error(errorData?.error?.message || 'Failed to generate questions');
        }

        const data = await response.json();
        let questions;
        
        try {
            // Extract text from Gemini response
            const content = data.candidates[0].content.parts[0].text;
            // Clean the response to ensure it's valid JSON
            const cleanedContent = content.trim().replace(/```json\n?|\n?```/g, '');
            questions = JSON.parse(cleanedContent);
            
            // Validate the response format
            if (!Array.isArray(questions)) {
                throw new Error('Response is not an array');
            }
            
            questions.forEach((q, i) => {
                if (!q.question || !q.type || !q.difficulty) {
                    throw new Error(`Missing required fields at index ${i}`);
                }

                if (q.type === 'multiple-choice') {
                    if (!Array.isArray(q.options) || 
                        q.options.length !== 4 || 
                        typeof q.correctAnswer !== 'number' ||
                        !q.explanation) {
                        throw new Error(`Invalid multiple choice question format at index ${i}`);
                    }
                } else if (q.type === 'free-response') {
                    if (!q.sampleAnswer || !Array.isArray(q.keyPoints)) {
                        throw new Error(`Invalid free response question format at index ${i}`);
                    }
                } else {
                    throw new Error(`Invalid question type at index ${i}`);
                }
            });
        } catch (e) {
            console.error('Failed to parse AI response:', data.candidates[0].content.parts[0].text);
            throw new Error('Invalid response format from AI: ' + e.message);
        }
        
        currentQuiz.questions = questions.map((q, index) => ({
            ...q,
            id: index + 1
        }));

        // Clear previous questions
        quizQuestions.innerHTML = '';
        
        // Display new questions
        currentQuiz.questions.forEach(displayQuestion);

    } catch (error) {
        console.error('Error in generateQuiz:', error);
        throw new Error('Failed to generate quiz: ' + (error.message || 'Unknown error'));
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
    if (timerInterval) {
        clearInterval(timerInterval);
        const timerDisplay = document.querySelector('.timer-display');
        if (timerDisplay) {
            timerDisplay.remove();
        }
    }
    try {
        loadingScreen.classList.remove('hidden');
        loadingScreen.querySelector('p').textContent = 'Grading your answers...';
        
        const results = await evaluateQuiz();
        displayResults(results);
        quizSection.classList.add('hidden');
        resultsSection.classList.remove('hidden');
    } catch (error) {
        alert('Error grading quiz: ' + error.message);
    } finally {
        loadingScreen.classList.add('hidden');
        loadingScreen.querySelector('p').textContent = 'Generating your quiz...';
    }
});

// Update the grading prompt for better feedback
async function evaluateQuiz() {
    const results = [];
    
    for (const question of currentQuiz.questions) {
        if (question.type === 'multiple-choice') {
            const selectedAnswer = document.querySelector(`input[name="question${question.id}"]:checked`);
            const isCorrect = selectedAnswer ? 
                parseInt(selectedAnswer.value) === question.correctAnswer : 
                false;
            
            results.push({
                question: question.question,
                type: 'multiple-choice',
                isCorrect,
                correctAnswer: question.options[question.correctAnswer],
                userAnswer: selectedAnswer ? 
                    question.options[parseInt(selectedAnswer.value)] : 
                    'No answer selected',
                explanation: question.explanation
            });
        } else {
            const userResponse = document.querySelector(`#q${question.id}response`).value.trim();
            
            if (!userResponse) {
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