const axios = require('axios');
const { TESTRAIL } = require('./config');

const api = axios.create({
  baseURL: `https://${TESTRAIL.DOMAIN}/index.php?/api/v2`,
  auth: TESTRAIL.AUTH,
});

async function findOrCreateSection(issueKey, summary) {
  const response = await api.get(`/get_sections/${TESTRAIL.PROJECT_ID}&suite_id=1`);

  // 2. ИСПРАВЛЕНИЕ: Проверяем, где лежат данные (в корне или в ключе .sections)
  let sections = [];
  if (Array.isArray(response.data)) {
    sections = response.data;
  } else if (response.data && Array.isArray(response.data.sections)) {
    sections = response.data.sections;
  } else {
    // Если пришел какой-то странный ответ (например, ошибка), выведем его в консоль
    console.error('⚠️ Unexpected TestRail response format:', response.data);
    throw new Error('TestRail API returned invalid sections format');
  }

  const existing = sections.find(
    (s) => s.parent_id === Number(TESTRAIL.PARENT_SECTION_ID) && s.name.includes(issueKey)
  );

  if (existing) return existing.id;

  const { data: newSection } = await api.post(`/add_section/${TESTRAIL.PROJECT_ID}`, {
    name: `${issueKey}: ${summary}`,
    parent_id: Number(TESTRAIL.PARENT_SECTION_ID),
  });
  return newSection.id;
}

async function clearSection(sectionId) {
  try {
    // 1. Получаем кейсы
    const response = await api.get(`/get_cases/${TESTRAIL.PROJECT_ID}&section_id=${sectionId}`);

    // Подстраховка для формата данных (массив или объект)
    const cases = Array.isArray(response.data) ? response.data : response.data.cases || [];

    if (cases.length > 0) {
      console.log(`   🗑️ Deleting ${cases.length} old cases...`);
      for (const c of cases) {
        // В TestRail API для POST запросов лучше передавать пустой объект {},
        // так как некоторые клиенты (axios) могут менять заголовки без тела запроса
        await api.post(`/delete_case/${c.id}`, {});
      }
    }
  } catch (err) {
    // Выводим подробности ошибки 400
    const detail = err.response?.data?.error || err.message;
    console.error(`   ❌ Failed to clear case in section ${sectionId}: ${detail}`);
    throw new Error(`TestRail Clear Error: ${detail}`);
  }
}

async function uploadCase(sectionId, payload) {
  try {
    const response = await api.post(`/add_case/${sectionId}`, payload);
    // Возвращаем именно данные (в них лежит id кейса)
    return response.data;
  } catch (err) {
    const errorDetail = err.response?.data?.error || err.message;
    console.error(`   ❌ TestRail rejection: ${errorDetail}`);
    // Пробрасываем ошибку дальше, чтобы main.js поймал её в свой catch
    throw new Error(errorDetail);
  }
}

module.exports = { findOrCreateSection, clearSection, uploadCase };
