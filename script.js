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
    
    // Only show loading screen if we have valid input
    loadingScreen.classList.remove('hidden');
    document.getElementById('generateBtn').disabled = true;
    
    try {
        await generateQuiz(text, numQuestions);
        quizForm.classList.add('hidden');
        quizSection.classList.remove('hidden');
    } catch (error) {
        alert('Error generating quiz: ' + error.message);
    } finally {
        loadingScreen.classList.add('hidden');
        document.getElementById('generateBtn').disabled = false;
    }
});

// Generate quiz questions
async function generateQuiz(text, numQuestions) {
    try {
        const difficulty = difficultyLevel.value;
        const difficultyPrompts = {
            beginner: "Use simple vocabulary and straightforward questions. Focus on basic recall and understanding.",
            easy: "Use basic concepts and clear language. Include some simple analysis questions.",
            medium: "Balance recall and analysis questions. Use moderate complexity in language and concepts.",
            hard: "Include complex analysis and application questions. Use advanced vocabulary and concepts.",
            expert: "Focus on deep analysis, evaluation, and synthesis. Use expert-level terminology and complex scenarios."
        };

        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Generate ${numQuestions} multiple choice questions based on this text: "${text}".
                        Difficulty level: ${difficulty}
                        ${difficultyPrompts[difficulty]}
                        
                        For ${difficulty} difficulty:
                        - Beginner: Very basic recall questions
                        - Easy: Simple understanding and basic application
                        - Medium: Mix of recall, understanding, and application
                        - Hard: Complex analysis and application
                        - Expert: Advanced analysis, evaluation, and synthesis
                        
                        Return a JSON array of question objects. Each object should have this exact format, and nothing else:
                        {
                            "question": "the question text",
                            "options": ["option A", "option B", "option C", "option D"],
                            "correctAnswer": 0,
                            "explanation": "explanation of why this answer is correct",
                            "difficulty": "${difficulty}"
                        }
                        
                        For the options:
                        - Beginner: Very clear distinctions between options
                        - Easy: Mostly clear distinctions
                        - Medium: Some similar options but clear correct answer
                        - Hard: More nuanced differences between options
                        - Expert: Highly nuanced differences requiring deep understanding
                        
                        Ensure the response is valid JSON that can be parsed with JSON.parse().`
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
                if (!q.question || !Array.isArray(q.options) || 
                    q.options.length !== 4 || typeof q.correctAnswer !== 'number' ||
                    !q.explanation) {
                    throw new Error(`Invalid question format at index ${i}`);
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
        console.error('Error generating quiz:', error);
        throw new Error('Failed to generate quiz questions: ' + error.message);
    }
}

// Display a single question
function displayQuestion(question) {
    const questionDiv = document.createElement('div');
    questionDiv.className = `question ${question.difficulty}`;
    
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
    
    // Add click handler for the entire option box
    const options = questionDiv.querySelectorAll('.option');
    options.forEach(option => {
        option.addEventListener('click', () => {
            // Remove selected class from all options in this question
            options.forEach(opt => opt.classList.remove('selected'));
            
            // Add selected class to clicked option
            option.classList.add('selected');
            
            // Check the radio button
            const radio = option.querySelector('input[type="radio"]');
            radio.checked = true;
            
            // Add pulse animation
            option.style.animation = 'none';
            option.offsetHeight; // Trigger reflow
            option.style.animation = 'selectPulse 0.3s ease';
        });
    });
    
    quizQuestions.appendChild(questionDiv);
}

// Handle quiz submission
submitQuizBtn.addEventListener('click', () => {
    const results = evaluateQuiz();
    displayResults(results);
    quizSection.classList.add('hidden');
    resultsSection.classList.remove('hidden');
});

// Evaluate quiz answers
function evaluateQuiz() {
    const results = [];
    currentQuiz.questions.forEach((question, index) => {
        const selectedAnswer = document.querySelector(`input[name="question${question.id}"]:checked`);
        const isCorrect = selectedAnswer ? 
            parseInt(selectedAnswer.value) === question.correctAnswer : 
            false;
        
        results.push({
            question: question.question,
            isCorrect,
            correctAnswer: question.options[question.correctAnswer],
            userAnswer: selectedAnswer ? 
                question.options[parseInt(selectedAnswer.value)] : 
                'No answer selected'
        });
    });
    return results;
}

// Display quiz results
function displayResults(results) {
    const correctCount = results.filter(r => r.isCorrect).length;
    
    resultsContainer.innerHTML = `
        <div class="score">
            <h3>Your Score: ${correctCount}/${results.length}</h3>
        </div>
        <div class="results-details">
            ${results.map((result, index) => `
                <div class="result-item ${result.isCorrect ? 'correct' : 'incorrect'}">
                    <p><strong>Question ${index + 1}:</strong> ${result.question}</p>
                    <p>Your answer: ${result.userAnswer}</p>
                    ${!result.isCorrect ? `
                        <p>Correct answer: ${result.correctAnswer}</p>
                        <p class="explanation"><strong>Explanation:</strong> ${currentQuiz.questions[index].explanation}</p>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    `;
}

// Handle "Generate New Quiz" button
newQuizBtn.addEventListener('click', () => {
    quizQuestions.innerHTML = '';
    resultsContainer.innerHTML = '';
    textInput.value = '';
    fileInput.value = '';
    resultsSection.classList.add('hidden');
    quizForm.classList.remove('hidden');
});

// Theme toggle functionality
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}

// Initialize theme
const savedTheme = localStorage.getItem('theme') || 'light';
setTheme(savedTheme);

themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
});