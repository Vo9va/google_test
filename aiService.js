const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GEMINI_KEY } = require('./config');

const genAI = new GoogleGenerativeAI(GEMINI_KEY);

/**
 * Генерирует массив тест-кейсов на основе данных из Jira
 * @param {string} mainTaskContext - Описание основной задачи
 * @param {string} linkedTasksContext - Контекст прилинкованных задач
 * @returns {Promise<Array>} - Массив объектов с тест-кейсами
 */
async function generateAIContent(mainTaskContext, linkedTasksContext) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash', // Используем актуальную модель 2026 года
    generationConfig: { responseMimeType: 'application/json' },
  });

  const prompt = `
    Act as a Senior QA Engineer. Your goal is to write a Test Suite ONLY for the Main Task.

    ---
    SOURCE OF TRUTH (Create test cases ONLY for this task):
    Main Task: ${mainTaskContext}

    ---
    BACKGROUND CONTEXT (Use this strictly for understanding dependencies, do NOT create test cases for these):
    Related Tasks: ${linkedTasksContext || 'No related tasks provided.'}
    ---

    CRITICAL INSTRUCTIONS:
    1. TARGET: Generate test cases specifically for the requirements mentioned in the "Main Task".
    2. CONTEXT: Use "Related Tasks" only to understand business logic or data flow.
    3. SCENARIOS: Identify every unique scenario for the Main Task (Acceptance Criteria).
    4. FIELDS:
       - "title": 
           "Concise, professional title in English. 
            CRITICAL: Do NOT include any IDs, prefixes, or numbering 
            like 'TC001', 'Test Case 1:', or 'Scenario:'. 
            Just the descriptive name of the test.".
       - "preconditions":
           "A single string containing all context and 'Given' statements. 
            CRITICAL: Use '\n' for new lines between requirements. 
            Start each line with a dash (-)."
       - "steps": Array of objects { "content": "Action", "expected": "Result" }.
    5. CLEANING: Remove keywords like 'Given', 'When', 'Then'.
    6. READABILITY: Split 'preconditions' into logical points. Do not merge into one paragraph.

    OUTPUT FORMAT:
    Return ONLY a valid JSON array of objects.
  `;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Парсим результат и проверяем, что это массив
    const aiCases = JSON.parse(text);

    if (!Array.isArray(aiCases)) {
      throw new Error('AI returned an object instead of an array.');
    }

    return aiCases;
  } catch (error) {
    console.error('❌ AI Generation Error:', error.message);
    throw error;
  }
}

module.exports = { generateAIContent };
