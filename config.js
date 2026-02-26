// const path = require('path');
// require('dotenv').config({ path: path.join(__dirname, '..env') });

module.exports = {
  JIRA: {
    DOMAIN: 'tkacenkovladimir452.atlassian.net',
    AUTH: { username: process.env.JIRA_EMAIL, password: process.env.JIRA_TOKEN },
  },
  TESTRAIL: {
    DOMAIN: 'blackrockng.testrail.io',
    AUTH: { username: process.env.TR_USER, password: process.env.TR_KEY },
    PROJECT_ID: process.env.TR_PROJECT_ID || '1',
    PARENT_SECTION_ID: process.env.TR_SECTION_ID || '127951',
  },
  GEMINI_KEY: process.env.GEMINI_API_KEY,
};
