// Final verification test matrix
const runTest = async () => {
  await new Promise(r => setTimeout(r, 3000));

  const tests = [
    { convo: [], input: "hi", label: "1. hi → English" },
    { convo: [], input: "show chocolates", label: "2. show chocolates → products" },
    { convo: [], input: "chocolate ekak ona", label: "4. Singlish → Sinhala + products" },
    { convo: [], input: "எனக்கு சாக்லேட் வேணும்", label: "5. Tamil script → Tamil + products" },
    { convo: [], input: "show kids toys", label: "7. show kids toys" },
    { convo: [], input: "show gifts under Rs.5000", label: "8. show gifts under Rs.5000" },
    { convo: [], input: "🎁🎂🍫", label: "10. emoji-only message" },
  ];

  for (const { convo, input, label } of tests) {
    const messages = [
      ...convo,
      { role: 'user', content: input, id: Date.now().toString(), timestamp: Date.now() }
    ];

    console.log(`\n=== ${label} ===`);
    let res;
    try {
      res = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages })
      });
    } catch(e) {
      console.log(`  FETCH ERROR: ${e.message}`);
      continue;
    }

    const text = await res.text();
    console.log(`  STATUS: ${res.status}`);
    if (res.ok) {
      const data = JSON.parse(text);
      console.log(`  REPLY: ${(data.reply || '').substring(0, 100)}`);
      console.log(`  PRODUCTS: ${data.products?.length || 0}`);
    } else {
      console.log(`  ERROR: ${text}`);
    }
    await new Promise(r => setTimeout(r, 2500));
  }

  // Test 6: "hi" after a Singlish turn in the same conversation
  console.log('\n=== 6. hi after Singlish turn (same convo) ===');
  const singlishConvo = [
    { role: 'user', content: 'chocolate ekak ona', id: '1', timestamp: 1 },
    { role: 'assistant', content: 'මෙන්න', id: '2', timestamp: 2 },
    { role: 'user', content: 'hi', id: '3', timestamp: 3 },
  ];
  const r6 = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: singlishConvo })
  });
  const d6 = await r6.json();
  console.log(`  STATUS: ${r6.status}`);
  console.log(`  REPLY: ${(d6.reply || '').substring(0, 100)}`);

  console.log('\n=== TEST COMPLETE ===');
};

runTest().catch(console.error);
