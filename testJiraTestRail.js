const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const {
  GEMINI_API_KEY = 'AIzaSyCEYSEmobEq54kcXx53lEJ4YCxflFDqEpw',
  JIRA_DOMAIN = 'tkacenkovladimir452.atlassian.net',
  JIRA_EMAIL = 'tkacenkovladimir452@gmail.com',
  JIRA_TOKEN = 'ATATT3xFfGF0nzoV2dHH6K0JomMSJNTr4GqclUkEpIiI7sgPrT6UiBi6ANLXMhUPEChEE7LnaBiA-9D9_OXZEvyNH8izto7DyFhsjEOMN7_C5bj1E_ZopptO2zv0GfvzfK1nKIyFPxh5NJUHRlHt-gkFydflhp9yWkr6hbmxbT3vgvPLdIcuNvg=06C0B6A5',
  TR_DOMAIN = 'blackrockng.testrail.io',
  TR_USER = 'qa@protonixltd.com',
  TR_KEY = 'Qwerty123@',
  TR_SECTION_ID = '127951',
  TR_PROJECT_ID = '1',
} = process.env;

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

async function generateTests() {
  const issueKey = 'SCRUM-1';
  const combinedContextLinkedTasks = [];
  let aiCases;
  let targetSectionId;

  // try {
    console.log(`🔍 Fetching Main Jira issue: ${issueKey}...`);

    const jiraUrl = `https://${JIRA_DOMAIN}/rest/api/3/issue/${issueKey}`;
    const jiraResponse = await axios.get(jiraUrl, { auth: { username: JIRA_EMAIL, password: JIRA_TOKEN } });

    const mainIssue = jiraResponse.data;
    const issueSummary = mainIssue.fields.summary;

    const combinedContextMainTask = `Main Task Description: ${JSON.stringify(mainIssue.fields.description)}`;
    const links = mainIssue.fields.issuelinks || [];

    if (links.length > 0) {
      console.log(`🔗Analyzing ${links.length} linked tasks...`);
      for (const link of links) {
        const linkedKey = link.outwardIssue?.key || link.inwardIssue?.key;
        if (linkedKey) {
          try {
            const linkedRes = await axios.get(`https://${JIRA_DOMAIN}/rest/api/3/issue/${linkedKey}`, {
              auth: { username: JIRA_EMAIL, password: JIRA_TOKEN },
            });

            combinedContextLinkedTasks.push(
              `RELATED TASK (${linkedKey}): Description: ${JSON.stringify(linkedRes.data.fields.description)}`
            );
          } catch (e) {
            console.log(`⚠️ Could not fetch linked task ${linkedKey}`);
          }
        }
      }
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json' },
    });

    const prompt = `
      Act as a Senior QA Engineer. Your goal is to write a Test Suite ONLY for the Main Task.
  
      ---
      SOURCE OF TRUTH (Create test cases ONLY for this task):
      Main Task: ${combinedContextMainTask}
  
     ---
     BACKGROUND CONTEXT (Use this strictly for understanding dependencies and logic, do NOT create test cases for these):
     Related Tasks: ${combinedContextLinkedTasks.length > 0 ? combinedContextLinkedTasks.join(', ') : 'No related tasks provided.'}
     ---

     CRITICAL INSTRUCTIONS:
     1. TARGET: Generate test cases specifically for the requirements mentioned in the "Main Task".
     2. CONTEXT: Use "Related Tasks" only to better understand the business logic, constraints, or data flow that might affect the Main Task.
     3. SCENARIOS: Identify every unique scenario for the Main Task (Acceptance Criteria).
     4. MAPPING: Create ONE object per scenario in the array.
     5. FIELDS:
     - "title": Concise, professional title in English.
     - "preconditions": |
             Combine context and "Given" statements. 
             CRITICAL: Each separate requirement or context detail MUST be on a new line. 
             Use a dash (-) at the start of each line for better readability.
     - "steps": Array of objects { "content": "Action", "expected": "Result" }.
     6. CLEANING: Remove keywords like 'Given', 'When', 'Then'.
     7. READABILITY: Split the 'preconditions' into logical points (e.g., User permissions, System state, Navigation context). Do not merge them into a single paragraph.

      OUTPUT FORMAT:
      Return ONLY a valid JSON array of objects.

      JSON STRUCTURE EXAMPLE:
      [
        {
          "title": "Example Scenario Name",
          "preconditions": "User is logged in...",
          "steps": [
            { "content": "Click button X", "expected": "System shows Y" }
          ]
        }
      ]
    `;

    const result = await model.generateContent(prompt);
    aiCases = JSON.parse(result.response.text());

    if (!Array.isArray(aiCases)) {
      throw new Error('Gemini returned an object instead of an array.');
    }

    // --- TESTRAIL: publish testcase ---
    console.log(`🚀Uploading ${aiCases.length} test cases to TestRail...`);

    // try {
      // Get all sections in the project to find the target section
      // const sectionsUrl = `https://${TR_DOMAIN}/index.php?/api/v2/get_sections/${TR_PROJECT_ID}&suite_id=1`;
      // const sectionsResponse = await axios.get(sectionsUrl, { auth: { username: TR_USER, password: TR_KEY } });
      // const sections = sectionsResponse.data.sections || sectionsResponse.data;
      //
      // // Find existing section that matches the issueKey in its name
      // const existingSection = sections.find((s) => s.parent_id === Number(TR_SECTION_ID) && s.name.includes(issueKey));

      // if (existingSection) {
      //   targetSectionId = existingSection.id;
      //   console.log(`♻️  Found folder: "${existingSection.name}" (ID: ${targetSectionId}). Cleaning old cases...`);

        // Get
    //     const getCasesUrl = `https://${TR_DOMAIN}/index.php?/api/v2/get_cases/${TR_PROJECT_ID}&section_id=${targetSectionId}`;
    //     const casesResponse = await axios.get(getCasesUrl, { auth: { username: TR_USER, password: TR_KEY } });
    //     const oldCases = casesResponse.data.cases || casesResponse.data;
    //
    //     if (oldCases.length > 0) {
    //       console.log(`🗑️  Deleting ${oldCases.length} old test cases...`);
    //       // Delete each old case
    //       for (const oldCase of oldCases) {
    //         await axios.post(
    //           `https://${TR_DOMAIN}/index.php?/api/v2/delete_case/${oldCase.id}`,
    //           {},
    //           { auth: { username: TR_USER, password: TR_KEY } }
    //         );
    //       }
    //       console.log(`✅ Folder cleaned.`);
    //     }
    //   } else {
    //     // Create new section in TESTRAIL
    //     const createSectionUrl = `https://${TR_DOMAIN}/index.php?/api/v2/add_section/${TR_PROJECT_ID}`;
    //     const newSectionName = `${issueKey}: ${issueSummary}`;
    //
    //     const sectionResponse = await axios.post(
    //       createSectionUrl,
    //       {
    //         name: newSectionName,
    //         parent_id: Number(TR_SECTION_ID),
    //       },
    //       { auth: { username: TR_USER, password: TR_KEY } }
    //     );
    //
    //     targetSectionId = sectionResponse.data.id;
    //     console.log(`✅ Folder created: "${newSectionName}" (ID: ${targetSectionId})`);
    //   }
    // } catch (err) {
    //   console.error(`❌ Error during TestRail sync:`, err.response?.data || err.message);
    //   throw err;
    // }
    //
    // for (const testCase of aiCases) {
    //   try {
    //     const trUrl = `https://${TR_DOMAIN}/index.php?/api/v2/add_case/${targetSectionId}`;
    //     const trPayload = {
    //       title: testCase.title,
    //       template_id: 2, // 2 = Test Case (Steps)
    //       type_id: 9, // 9 = Regression
    //       custom_preconds: testCase.preconditions,
    //       custom_steps_separated: testCase.steps.map((s) => ({
    //         content: s.content,
    //         expected: s.expected,
    //       })),
    //       custom_ui_automation_type: 4, // 4 = Pending
    //       custom_ui_mobile_automation_type: 4, // 4 = Pending
    //       custom_ui_application_automation_type: 4, // 4 = Pending
    //       custom_automation_type: 4, // 4 = Pending
    //       custom_status: 0, // 0 = In Progress
    //       custom_creator: 10, // 10 - Unknown
    //       refs: issueKey,
    //     };
    //
    //     const trResponse = await axios.post(trUrl, trPayload, {
    //       auth: { username: TR_USER, password: TR_KEY },
    //     });
    //
    //     console.log(`✅ Success: "${testCase.title}" | ID: C${trResponse.data.id}`);
    //   } catch (err) {
    //     const errorDetail = err.response?.data?.error || err.message;
    //     console.error(`❌ Failed to upload "${testCase.title}":`, errorDetail);
    //   }
  //   }
  //
  //   console.log('\n✨ All done! All scenarios processed.');
  // } catch (error) {
    console.error('💥 Critical Error:', error.response?.data || error.message);
  // }
}
generateTests();