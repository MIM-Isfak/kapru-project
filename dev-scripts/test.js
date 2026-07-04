const runTest = async () => {
  await new Promise(r => setTimeout(r, 2000));

  const tests = [
    { convo: [], input: "எனக்கு சாக்லேட் வேணும்", label: "1. Tamil script → Tamil + real chocolates" },
    { convo: [], input: "electrincs item venum", label: "2. Tanglish → Tamil/Tanglish + real electronics" },
    { convo: [], input: "mata gifts for birthday denna", label: "3. Sinhala/Singlish → Sinhala + real gifts" },
    { convo: [], input: "hi", label: "4. hi → English" },
    { convo: [], input: "show chocolates", label: "5. show chocolates → English + products" },
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
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n=== TEST COMPLETE ===');
};

runTest().catch(console.error);
