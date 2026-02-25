const axios = require('axios');
const { JIRA, TESTRAIL } = require('./config');

async function getIssue(issueKey) {
  const url = `https://${JIRA.DOMAIN}/rest/api/3/issue/${issueKey}`;
  const response = await axios.get(url, { auth: JIRA.AUTH });
  return response.data;
}

// Метод для получения всех прилинкованных задач
async function getLinkedTasksContext(links) {
  const context = [];
  for (const link of links) {
    const key = link.outwardIssue?.key || link.inwardIssue?.key;
    if (key) {
      try {
        const res = await axios.get(`https://${JIRA.DOMAIN}/rest/api/3/issue/${key}`, { auth: JIRA.AUTH });
        context.push(`RELATED TASK (${key}): ${JSON.stringify(res.data.fields.description)}`);
      } catch (e) {
        console.log(`⚠️ Skip link ${key}`);
      }
    }
  }
  return context.join(', ');
}

/**
 * Отправляет детальный комментарий в Jira со ссылками на созданные кейсы
 */
async function postResultsToJira(issueKey, uploadedCases, targetSectionId) {
  if (!uploadedCases || uploadedCases.length === 0) return;

  const url = `https://${JIRA.DOMAIN}/rest/api/3/issue/${issueKey}/comment`;
  const folderUrl = `https://${TESTRAIL.DOMAIN}/index.php?/suites/view/1&group_id=${targetSectionId}`;

  // Формируем список ссылок для Jira ADF
  const caseNodes = uploadedCases.flatMap((c) => [
    {
      type: 'text',
      text: `📄 C${c.id}: ${c.title}`,
      marks: [
        {
          type: 'link',
          attrs: { href: `https://${TESTRAIL.DOMAIN}/index.php?/cases/view/${c.id}` },
        },
      ],
    },
    { type: 'text', text: '\n' },
  ]);

  const commentBody = {
    body: {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: '✅ AI Test Generation Complete!',
              marks: [{ type: 'strong' }],
            },
            {
              type: 'hardBreak', // Перенос на новую строку внутри параграфа
            },
            {
              type: 'text',
              text: 'New test cases created in TestRail:',
            },
          ],
        },
        {
          type: 'paragraph',
          content: caseNodes, // Убедись, что внутри caseNodes тоже нет \n
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: '📂 ',
            },
            {
              type: 'text',
              text: 'View Full Folder',
              marks: [{ type: 'link', attrs: { href: folderUrl } }, { type: 'strong' }],
            },
          ],
        },
      ],
    },
  };

  try {
    await axios.post(url, commentBody, { auth: JIRA.AUTH });
    console.log(`📢 Jira updated with ${uploadedCases.length} case links.`);
  } catch (err) {
    console.error(`❌ Failed to post comment to Jira:`, err.response?.data || err.message);
  }
}

module.exports = { getIssue, getLinkedTasksContext, postResultsToJira };
