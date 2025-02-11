import { GEMINI_API_KEY, GEMINI_API_URL } from './config.js';

// We'll add JavaScript functionality in later steps
console.log('AI Quiz Generator initialized'); 

// Store quiz data
let currentQuiz = {
    questions: [],
    answers: {}, // Change to object to store answers by question number
    originalText: '' // Store the original text for generating similar quizzes
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
                <span class="question-number">${questionNumber} of ${totalQuestions}</span>
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

// Update this function to ensure proper rendering of question types
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
    } else if (question.type === 'free-response') {
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
    } else {
        return ''; // Return empty if the question type is not recognized
    }
}

// Update the generateQuiz function
async function generateQuiz(text, numQuestions, isVariation = false) {
    try {
        // Store the original text for generating variations later
        if (!isVariation) {
            currentQuiz.originalText = text;
        }

        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `As an expert educator, create ${numQuestions} sophisticated ${questionType.value} questions from this text. 
                        ${isVariation ? 'Important: Generate completely different questions than before, but on the same topics and concepts.' : ''}
                        Difficulty level: ${difficultyLevel.value}

                        Requirements:
                        ${questionType.value === 'multiple-choice' ? `
                        1. Questions should test deep understanding, critical thinking, and application of concepts
                        2. Include analysis, evaluation, and synthesis-level questions (Bloom's higher levels)
                        3. For multiple-choice questions:
                           - Create plausible distractors that test common misconceptions
                           - Ensure options are mutually exclusive and similar in length
                           - Include "all of the above" or "none of the above" sparingly
                           - Each question MUST have exactly 4 options
                        
                        Return a JSON array where each question object has this exact format:
                        {
                            "question": "detailed question text",
                            "type": "multiple-choice",
                            "difficulty": "${difficultyLevel.value}",
                            "options": ["option1", "option2", "option3", "option4"],
                            "correctAnswer": 0,
                            "explanation": "detailed explanation of the answer"
                        }` : questionType.value === 'free-response' ? `
                        1. Questions should test deep understanding, critical thinking, and application of concepts
                        2. Include analysis, evaluation, and synthesis-level questions (Bloom's higher levels)
                        3. For free-response questions:
                           - Include scenario-based or case study questions
                           - Ask for comparisons, analyses, or evaluations
                           - Require specific examples or evidence from the text
                        
                        Return a JSON array where each question object has this exact format:
                        {
                            "question": "detailed question text",
                            "type": "free-response",
                            "difficulty": "${difficultyLevel.value}",
                            "sampleAnswer": "comprehensive model answer",
                            "keyPoints": ["key point 1", "key point 2", "key point 3"],
                            "explanation": "detailed explanation"
                        }` : `
                        1. Questions should test deep understanding, critical thinking, and application of concepts
                        2. Include analysis, evaluation, and synthesis-level questions (Bloom's higher levels)
                        3. Create an equal mix of multiple-choice and free-response questions
                        4. For multiple-choice questions:
                           - Create plausible distractors that test common misconceptions
                           - Ensure options are mutually exclusive and similar in length
                           - Include "all of the above" or "none of the above" sparingly
                           - Each question MUST have exactly 4 options
                        5. For free-response questions:
                           - Include scenario-based or case study questions
                           - Ask for comparisons, analyses, or evaluations
                           - Require specific examples or evidence from the text

                        Return a JSON array where each question object has one of these two exact formats:
                        For multiple-choice questions:
                        {
                            "question": "detailed question text",
                            "type": "multiple-choice",
                            "difficulty": "${difficultyLevel.value}",
                            "options": ["option1", "option2", "option3", "option4"],
                            "correctAnswer": 0,
                            "explanation": "detailed explanation of the answer"
                        }

                        For free-response questions:
                        {
                            "question": "detailed question text",
                            "type": "free-response",
                            "difficulty": "${difficultyLevel.value}",
                            "sampleAnswer": "comprehensive model answer",
                            "keyPoints": ["key point 1", "key point 2", "key point 3"],
                            "explanation": "detailed explanation"
                        }

                        Important: Return an approximately equal number of multiple-choice and free-response questions.`}

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
    resultsSection.classList.remove('hidden');
    quizSection.classList.add('hidden');
    
    let resultsHTML = '<div class="results-content">';
    
    // Add score if it exists
    if (results.score !== undefined) {
        resultsHTML += `<div class="score">Score: ${results.score}%</div>`;
    }
    
    // Add individual question results
    results.forEach((result, index) => {
        resultsHTML += `
            <div class="question-result ${result.isCorrect ? 'correct' : 'incorrect'}">
                <h3>Question ${index + 1}</h3>
                <p class="question-text">${result.question}</p>
                ${result.userAnswer ? `<p class="user-answer">Your answer: ${result.userAnswer}</p>` : ''}
                <p class="correct-answer">Correct answer: ${result.correctAnswer}</p>
                <p class="explanation">${result.explanation}</p>
            </div>
        `;
    });
    
    resultsHTML += '</div>';
    
    // Add buttons container with more spacing
    resultsHTML += `
        <div class="results-buttons" style="display: flex; justify-content: space-between; margin: 20px 0;">
            <button id="generateSimilar" class="btn">Generate Similar Quiz</button>
        </div>
    `;
    
    resultsContainer.innerHTML = resultsHTML;

    // Create settings dialog for similar quiz
    const settingsDialog = document.createElement('div');
    settingsDialog.className = 'settings-dialog hidden';
    settingsDialog.innerHTML = `
        <div class="settings-content" style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 500px; margin: 40px auto;">
            <h3>Quiz Settings</h3>
            <div class="settings-choice" style="margin: 20px 0;">
                <button id="keepSettings" class="btn">Keep Current Settings</button>
                <button id="changeSettings" class="btn">Change Settings</button>
            </div>
            <div id="newSettings" class="hidden" style="margin-top: 20px;">
                <div class="form-group">
                    <label for="newQuestionCount">Number of Questions:</label>
                    <input type="number" id="newQuestionCount" min="1" max="30" value="${currentQuiz.questions.length}">
                </div>
                <div class="form-group">
                    <label for="newQuestionType">Question Type:</label>
                    <select id="newQuestionType">
                        <option value="multiple-choice">Multiple Choice</option>
                        <option value="free-response">Free Response</option>
                        <option value="mixed">Mixed</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="newDifficultyLevel">Difficulty Level:</label>
                    <select id="newDifficultyLevel">
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="newTimerToggle">
                        Enable Timer
                    </label>
                </div>
                <div id="newTimerSettings" class="hidden">
                    <label for="newTimerMinutes">Time Limit (minutes):</label>
                    <input type="number" id="newTimerMinutes" min="1" max="180" value="30">
                </div>
                <button id="generateWithNewSettings" class="btn">Generate Quiz</button>
                <button id="cancelSettings" class="btn">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(settingsDialog);

    // Add styles for the dialog
    const style = document.createElement('style');
    style.textContent = `
        .settings-dialog {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }
        .settings-dialog.hidden {
            display: none;
        }
        .settings-content .form-group {
            margin: 15px 0;
        }
        .settings-choice {
            display: flex;
            justify-content: space-around;
            margin: 20px 0;
        }
        .btn {
            margin: 5px;
            padding: 8px 16px;
        }
    `;
    document.head.appendChild(style);
    
    // Add event listener for Generate Similar Quiz button
    document.getElementById('generateSimilar').addEventListener('click', () => {
        settingsDialog.classList.remove('hidden');
        
        // Set current values in the new settings form
        document.getElementById('newQuestionType').value = questionType.value;
        document.getElementById('newDifficultyLevel').value = difficultyLevel.value;
        document.getElementById('newTimerToggle').checked = timerToggle.checked;
        document.getElementById('newTimerMinutes').value = timerMinutes.value;
    });

    // Event listeners for settings dialog
    document.getElementById('keepSettings').addEventListener('click', async () => {
        settingsDialog.classList.add('hidden');
        resultsSection.classList.add('hidden');
        loadingScreen.classList.remove('hidden');

        try {
            // Get current settings
            const currentQuestionCount = currentQuiz.questions.length;
            const currentTimerEnabled = timerToggle.checked;
            const currentTimerDuration = parseInt(timerMinutes.value);

            // Generate new quiz with current settings
            await generateQuiz(currentQuiz.originalText, currentQuestionCount, true);
            
            // Show quiz section and hide loading
            quizSection.classList.remove('hidden');
            loadingScreen.classList.add('hidden');
            
            // Start timer if enabled
            if (currentTimerEnabled && currentTimerDuration > 0) {
                startTimer(currentTimerDuration);
            }
        } catch (error) {
            console.error('Error generating similar quiz:', error);
            alert('Failed to generate similar quiz: ' + error.message);
            loadingScreen.classList.add('hidden');
            resultsSection.classList.remove('hidden');
        }
    });

    document.getElementById('changeSettings').addEventListener('click', () => {
        document.getElementById('newSettings').classList.remove('hidden');
    });

    // Timer toggle for new settings
    document.getElementById('newTimerToggle').addEventListener('change', (e) => {
        const newTimerSettings = document.getElementById('newTimerSettings');
        newTimerSettings.classList.toggle('hidden', !e.target.checked);
    });

    document.getElementById('generateWithNewSettings').addEventListener('click', async () => {
        const newQuestionCount = parseInt(document.getElementById('newQuestionCount').value);
        const newQuestionType = document.getElementById('newQuestionType').value;
        const newDifficultyLevel = document.getElementById('newDifficultyLevel').value;
        const newTimerEnabled = document.getElementById('newTimerToggle').checked;
        const newTimerMinutes = parseInt(document.getElementById('newTimerMinutes').value);

        // Update the form settings
        questionType.value = newQuestionType;
        difficultyLevel.value = newDifficultyLevel;
        timerToggle.checked = newTimerEnabled;
        timerMinutes.value = newTimerMinutes;

        settingsDialog.classList.add('hidden');
        
        try {
            resultsSection.classList.add('hidden');
            loadingScreen.classList.remove('hidden');
            
            await generateQuiz(currentQuiz.originalText, newQuestionCount, true);
            
            quizSection.classList.remove('hidden');
            loadingScreen.classList.add('hidden');
            
            if (newTimerEnabled) {
                if (newTimerMinutes > 0) {
                    startTimer(newTimerMinutes);
                }
            }
        } catch (error) {
            console.error('Error generating similar quiz:', error);
            alert('Failed to generate similar quiz: ' + error.message);
            loadingScreen.classList.add('hidden');
            resultsSection.classList.remove('hidden');
        }
    });

    document.getElementById('cancelSettings').addEventListener('click', () => {
        document.getElementById('newSettings').classList.add('hidden');
        settingsDialog.classList.add('hidden');
    });
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
        answers: {},
        originalText: ''
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