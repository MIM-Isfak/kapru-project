const runTest = async () => {
  // Stagger slightly to let server warm up
  await new Promise(r => setTimeout(r, 2000));

  const messages = [];
  const testCases = [
    { phrase: "hi", expect: "English reply, no Sinhala" },
    { phrase: "show chocolates", expect: "English + product cards" },
    { phrase: "chocolate ekak ona", expect: "Sinhala script reply + product cards" },
    { phrase: "hi", expect: "English again (no carryover)" },
    { phrase: "show kids toys", expect: "product cards or friendly no-results" },
  ];

  for (const { phrase, expect } of testCases) {
    messages.push({ role: 'user', content: phrase, id: Date.now().toString(), timestamp: Date.now() });

    console.log(`\n=== STEP: "${phrase}" ===`);
    console.log(`  Expected: ${expect}`);

    let res;
    try {
      res = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages })
      });
    } catch (e) {
      console.log(`  FETCH ERROR: ${e.message}`);
      continue;
    }

    const text = await res.text();
    console.log(`  STATUS: ${res.status}`);
    if (res.ok) {
      const data = JSON.parse(text);
      console.log(`  REPLY: ${data.reply?.substring(0, 120)}`);
      console.log(`  PRODUCTS: ${data.products?.length || 0}`);
      messages.push({
        role: 'assistant',
        content: data.reply || "",
        products: data.products,
        id: Date.now().toString(),
        timestamp: Date.now()
      });
    } else {
      console.log(`  ERROR: ${text}`);
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n=== TEST COMPLETE ===');
};

runTest().catch(console.error);
