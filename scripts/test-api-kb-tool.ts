/**
 * Test KB search tool via the API endpoint
 */
const COMPANY_ID = '0193e8c6-c08b-71ba-a1a7-26b6f1f9f19c';
const CHATBOT_ID = 'c00473b0-541f-4429-b47f-10d74013278c';

async function test() {
  const response = await fetch(`http://localhost:3000/api/master-admin/companies/${COMPANY_ID}/chatbots/${CHATBOT_ID}/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'list all apple products' })
  });

  const reader = response.body?.getReader();
  if (!reader) {
    console.error('No response body');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let seenSearchTool = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const event = JSON.parse(data);
          if (event.type === 'tool_call') {
            console.log(`[tool_call] ${event.data.toolName} - ${event.data.status}`);
            if (event.data.toolName === 'search_knowledge_base') {
              seenSearchTool = true;
              console.log('  ✅ Worker called search_knowledge_base tool!');
            }
          } else if (event.type === 'notification') {
            console.log(`[notification] ${event.data.message}`);
          }
        } catch (e) {}
      }
    }
  }

  console.log('\n=== Summary ===');
  console.log(`search_knowledge_base tool was called: ${seenSearchTool ? 'YES ✅' : 'NO ❌'}`);
}

test().catch(console.error);
