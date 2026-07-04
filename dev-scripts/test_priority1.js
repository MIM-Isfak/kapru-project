const BASE_URL = 'http://localhost:3000/api/chat';

const queries = [
  { group: "A", q: "show me toys for kids" },
  { group: "B", q: "show me toys" },
  { group: "B", q: "gift ideas" },
  { group: "B", q: "show me accessories" },
  { group: "C", q: "gift for my little brother" },
  { group: "C", q: "something for a baby shower" },
  { group: "C", q: "birthday present for my 8 year old" },
  { group: "D", q: "show me electronics" },
  { group: "D", q: "show me groceries" },
  { group: "D", q: "show me books" },
  { group: "D", q: "general gifts" },
];

async function send(msg) {
  const start = Date.now();
  const body = JSON.stringify({ messages: [{ role: 'user', content: msg }] });
  try {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const data = await res.json();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const products = Array.isArray(data.products) ? data.products : [];
    return { ok: res.ok, status: res.status, products, elapsed };
  } catch (err) {
    return { ok: false, status: 0, products: [], elapsed: '?' };
  }
}

async function main() {
  console.log('=== PRIORITY 1: INTENT UNDERSTANDING & FILTERING ===\n');
  let totalTime = 0;
  let successCount = 0;

  for (const { group, q } of queries) {
    process.stdout.write(`Group ${group} - "${q}"... `);
    const result = await send(q);
    if (!result.ok) {
      console.log(`❌ ERROR ${result.status}`);
      continue;
    }
    
    totalTime += parseFloat(result.elapsed);
    successCount++;

    const productNames = result.products.map(p => p.name);
    console.log(`✅ ${result.products.length} products (${result.elapsed}s)`);
    if (productNames.length > 0) {
      console.log(`   Sample products: ${productNames.slice(0, 3).join(', ')}`);
    } else {
      console.log(`   (No products found)`);
    }
    
    // Check for adult keywords in results
    const adultKeywords = ['sex', 'lubricant', 'vibrator', 'lingerie', 'adult toy', 'condom', 'dildo', 'masturbator', 'erotic'];
    let adultCount = 0;
    for (const p of result.products) {
      const searchStr = `${p.name} ${p.category} ${p.description}`.toLowerCase();
      if (adultKeywords.some(k => searchStr.includes(k))) adultCount++;
    }
    if (adultCount > 0) {
      console.log(`   ❌ ALERT: Found ${adultCount} potential adult products in result!`);
    }

    await new Promise(r => setTimeout(r, 2000)); // Rate limit buffer
  }

  const avgTime = successCount > 0 ? (totalTime / successCount).toFixed(1) : 0;
  console.log(`\n=== SUMMARY ===`);
  console.log(`Average response time: ${avgTime}s`);
}

main().catch(console.error);
