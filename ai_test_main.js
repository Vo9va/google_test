const { getIssue, getLinkedTasksContext, postResultsToJira } = require('./jiraService');
const { generateAIContent } = require('./aiService');
const TR = require('./testrailService');

/**
 * Основная функция автоматизации
 * @param {string} issueKey - Ключ задачи из Jira (например, 'TP-98')
 */
async function runAutoQA(issueKey) {
  try {
    console.log(`\n🚀 Starting Automation for: ${issueKey}`);
    console.log('-----------------------------------------');

    // 1. Собираем данные из Jira
    console.log(`🔍 Step 1/5: Fetching Jira data...`);
    const issue = await getIssue(issueKey);
    console.log('issue', issue);
    const issueSummary = issue.fields.summary;
    const mainContext = JSON.stringify(issue.fields.description);

    // Получаем контекст связанных задач
    const linkedContext = await getLinkedTasksContext(issue.fields.issuelinks);

    // 2. Генерируем тест-кейсы через Gemini
    console.log(`🤖 Step 2/5: Generating test cases via AI...`);
    const aiCases = await generateAIContent(mainContext, linkedContext);
    console.log(`✅ Generated ${aiCases.length} scenarios.`);

    // 3. Подготавливаем папку в TestRail
    console.log(`📂 Step 3/5: Syncing TestRail folder...`);
    const sectionId = await TR.findOrCreateSection(issueKey, issueSummary);

    // 4. Очищаем старые кейсы (реализация "Перезаписи")
    console.log(`🗑️  Step 4/5: Cleaning up existing cases in section ${sectionId}...`);
    await TR.clearSection(sectionId);

    // 5. Загружаем новые кейсы
    console.log(`🚀 Step 5/5: Uploading new cases to TestRail...`);
    const uploadedCases = [];

    for (const testCase of aiCases) {
      try {
        const payload = formatTestRailPayload(testCase, issueKey);
        const trResponse = await TR.uploadCase(sectionId, payload);

        uploadedCases.push({ id: trResponse.id, title: testCase.title });
        console.log(`Success: ${testCase.title} | ID: C${trResponse.id}`);
      } catch (err) {
        console.error(`Error uploading ${testCase.title}: ${err.message}`);
      }
    }

    // --- Отправка отчета в Jira ---
    if (uploadedCases.length > 0) {
      console.log(`💬 Posting results to Jira...`);
      await postResultsToJira(issueKey, uploadedCases, sectionId);
    }

    console.log('-----------------------------------------');
    console.log('✨ SUCCESS: All scenarios processed and synced!');
  } catch (error) {
    console.error('💥 CRITICAL ERROR:', error.message);
    process.exit(1);
  }
}

/**
 * Вспомогательная функция для маппинга данных ИИ в формат TestRail
 */
function formatTestRailPayload(testCase, issueKey) {
  return {
    title: testCase.title,
    template_id: 2, // 2 = Test Case (Steps)
    type_id: 9, // 9 = Regression
    custom_preconds: testCase.preconditions,
    custom_steps_separated: testCase.steps.map((s) => ({
      content: s.content,
      expected: s.expected,
    })),
    custom_ui_automation_type: 4, // 4 = Pending
    custom_ui_mobile_automation_type: 4, // 4 = Pending
    custom_ui_application_automation_type: 4, // 4 = Pending
    custom_automation_type: 4, // 4 = Pending
    custom_status: 0, // 0 = In Progress
    custom_creator: 10, // 10 - Unknown
    refs: issueKey,
  };
}

const targetKey = process.argv[2];

runAutoQA(targetKey);
