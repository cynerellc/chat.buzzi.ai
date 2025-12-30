/**
 * Verbose test of KB search via the API endpoint
 */
const COMPANY_ID = 'cb573c62-09ce-4969-a4d3-9c74ea612af8';
const CHATBOT_ID = 'c00473b0-541f-4429-b47f-10d74013278c';

interface StreamEvent {
  type: string;
  data: Record<string, unknown>;
}

async function test() {
  console.log('Sending request to test endpoint...');

  const response = await fetch(`http://localhost:3000/api/master-admin/companies/${COMPANY_ID}/chatbots/${CHATBOT_ID}/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'list all apple products' })
  });

  console.log('Response status:', response.status);

  const reader = response.body?.getReader();
  if (!reader) {
    console.error('No response body');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  const events: StreamEvent[] = [];

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
          const event = JSON.parse(data) as StreamEvent;
          events.push(event);
          console.log(`[${event.type}]`, JSON.stringify(event.data).slice(0, 200));
        } catch (e) {}
      }
    }
  }

  console.log('\n=== All Events ===');
  console.log('Event types:', events.map(e => e.type));

  const toolCalls = events.filter(e => e.type === 'tool_call');
  console.log('\nTool calls:', toolCalls.map(t => t.data.toolName));

  const complete = events.find(e => e.type === 'complete');
  if (complete) {
    const content = complete.data.content as string | undefined;
    const metadata = complete.data.metadata as Record<string, unknown> | undefined;
    console.log('\nFinal response:', content?.slice(0, 500));
    console.log('Tools used:', metadata?.toolsUsed);
    console.log('Sources:', (metadata?.sources as unknown[])?.length || 0);
  }
}

test().catch(console.error);
