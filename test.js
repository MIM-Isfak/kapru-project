const http = require('http');

const runTest = async () => {
  const messages = [];
  const testPhrases = ["hi", "chocolate ekak ona", "show electronic items"];

  for (const phrase of testPhrases) {
    messages.push({ role: 'user', content: phrase, id: Date.now().toString(), timestamp: Date.now() });

    console.log(`\n\n--- SENDING: "${phrase}" ---`);
    const res = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages })
    });
    
    const text = await res.text();
    console.log(`STATUS: ${res.status}`);
    console.log(`RESPONSE:`, text);

    if (res.ok) {
      const data = JSON.parse(text);
      messages.push({
        role: 'assistant',
        content: data.reply || "",
        id: Date.now().toString(),
        timestamp: Date.now()
      });
    }
  }
};

runTest().catch(console.error);
