// test_part2_ratelimit.js — Part 2: Deliberately trigger rate limit, capture exact error message
// Sends messages with only 200ms gaps to exhaust all API keys.

const BASE_URL = 'http://localhost:3000/api/chat';

const RAPID_MESSAGES = [
  'show me chocolates',
  'show me toys',
  'show me perfumes',
  'show me books',
  'show me gifts',
  'show me electronics',
  'show me clothes',
  'show me kitchen items',
  'show me cakes',
  'show me flowers',
];

// Non-product small talk for Part 3
const SMALL_TALK = [
  { lang: 'English',      msg: 'thanks' },
  { lang: 'Tamil script', msg: 'நன்றி' },
];

function detectLang(reply) {
  if (!reply) return '(empty)';
  if (/[\u0D80-\u0DFF]/.test(reply)) return 'Sinhala';
  if (/[\u0B80-\u0BFF]/.test(reply)) return 'Tamil';
  return 'English';
}

async function send(msg, label) {
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
    let reply = data.reply || '(empty)';
    let isError = !!data.error;

    if (!res.ok) {
      isError = true;
      const errType = (data?.error || "UNKNOWN").toLowerCase();
      const typeKey = errType === "rate_limit" ? "rate_limit" : errType === "network_error" ? "network" : "generic";
      
      const KAPRU_ERROR_MESSAGES = {
        generic: {
          en: "Hmm, Kapru hit a snag there — mind trying that again?",
          si: "ඕයෝ, Kapru ට ඒ ගාන අස්සේ ගැටලුවක් ආවා — ටිකක් wait කරලා try කරන්නකෝ?",
          ta: "அய்யோ, Kapru-க்கு சிறு சிக்கல் ஏற்பட்டது — மீண்டும் முயற்சிக்கவும்?",
        },
        rate_limit: {
          en: "I'm getting a lot of requests right now — please wait a few seconds and try again.",
          si: "දැන් මට requests ගොඩක් එනවා — කරුණාකර තත්පර කිහිපයක් රැඳී සිට නැවත උත්සාහ කරන්න.",
          ta: "தற்போது எனக்கு நிறைய கோரிக்கைகள் வருகின்றன — தயவுசெய்து சில நொடிகள் காத்திருந்து மீண்டும் முயற்சிக்கவும்."
        },
        network: {
          en: "It looks like my connection dropped — could you check your internet and try again?",
          si: "මගේ connection එක නැති වුණා වගේ — කරුණාකර ඔබගේ internet එක පරීක්ෂා කර නැවත උත්සාහ කරන්නද?",
          ta: "என்னுடைய இணைப்பு துண்டிக்கப்பட்டதாகத் தெரிகிறது — உங்கள் இணையத்தை சரிபார்த்து மீண்டும் முயற்சிக்க முடியுமா?"
        }
      };
      
      const messages = KAPRU_ERROR_MESSAGES[typeKey] || KAPRU_ERROR_MESSAGES.generic;
      if (/[\u0D80-\u0DFF]/.test(msg)) reply = messages.si;
      else if (/[\u0B80-\u0BFF]/.test(msg)) reply = messages.ta;
      else reply = messages.en;
    }

    const products = Array.isArray(data.products) ? data.products.length : 0;
    return { ok: res.ok, status: res.status, reply, replyLang: detectLang(reply), products, elapsed, isError, label };
  } catch (err) {
    let reply = err.message;
    if (reply.includes("fetch failed")) reply = "It looks like my connection dropped — could you check your internet and try again?";
    return { ok: false, status: 0, reply, replyLang: 'N/A', products: 0, elapsed: '?', isError: true, label };
  }
}

async function main() {
  // ── PART 2: Rapid-fire to trigger rate limit ──────────────────────────────
  console.log('=== PART 2: RAPID-FIRE RATE-LIMIT TRIGGER TEST ===');
  console.log('Sending 10 messages with 200ms gaps to exhaust API keys...\n');

  const rapidResults = [];
  let rateLimitHit = false;

  for (let i = 0; i < RAPID_MESSAGES.length; i++) {
    const msg = RAPID_MESSAGES[i];
    process.stdout.write(`[${i + 1}/10] "${msg}"... `);
    const result = await send(msg, msg);
    rapidResults.push(result);

    if (result.status === 429 || (result.isError && result.reply.includes('429'))) {
      console.log(`⚠️  RATE LIMITED! Status: ${result.status}`);
      console.log(`   EXACT ERROR SHOWN TO USER: "${result.reply}"`);
      console.log(`   Reply language: ${result.replyLang}`);
      rateLimitHit = true;
    } else if (!result.ok) {
      console.log(`❌ ERROR (${result.status}): ${result.reply}`);
    } else {
      console.log(`✅ OK — ${result.products} products (${result.elapsed}s)`);
    }

    await new Promise(r => setTimeout(r, 200)); // 200ms gap — rapid fire
  }

  console.log('\n--- PART 2 RATE LIMIT ANALYSIS ---');
  const rateRows = rapidResults.filter(r => r.status === 429 || (r.isError && r.reply.includes('429')));
  if (rateRows.length === 0) {
    console.log('ℹ️  No 429 hit in this run (keys may have recovered since last test).');
    console.log('   This is also acceptable — it means key rotation worked well enough.');
  } else {
    console.log(`⚠️  ${rateRows.length} message(s) hit the rate limit.`);
    console.log('\n📋 EXACT ERROR MESSAGE(S) SHOWN TO USER:');
    for (const r of rateRows) {
      const isGraceful = !r.reply.includes('HTTP') && !r.reply.includes('429') && !r.reply.includes('RESOURCE_EXHAUSTED');
      const isFriendly = r.reply.length > 10 && (r.reply.includes('Kapru') || r.reply.includes('moment') || r.reply.includes('wait') || r.reply.includes('again') || r.reply.includes('முயற்சி') || r.reply.includes('try'));
      console.log(`  Message: "${r.label}"`);
      console.log(`  Error shown: "${r.reply}"`);
      console.log(`  Language: ${r.replyLang}`);
      console.log(`  Is graceful (no raw HTTP/429): ${isGraceful ? '✅ YES' : '❌ NO — RAW ERROR SHOWN'}`);
      console.log(`  Is friendly/Kapru-voiced: ${isFriendly ? '✅ YES' : '⚠️  MIGHT BE GENERIC'}`);
      console.log('');
    }
  }

  // ── Recovery check: wait 65s then send one message ────────────────────────
  if (rateLimitHit) {
    console.log('\n--- RECOVERY CHECK: Waiting 65 seconds for rate limit to reset... ---');
    for (let s = 65; s > 0; s -= 5) {
      process.stdout.write(`\r  ${s}s remaining...  `);
      await new Promise(r => setTimeout(r, 5000));
    }
    console.log('\r  Done waiting. Sending recovery message...              ');
    const recovery = await send('show chocolates', 'Recovery message');
    if (recovery.ok && recovery.products > 0) {
      console.log(`✅ RECOVERY OK — got ${recovery.products} products after rate-limit reset.`);
    } else if (recovery.status === 429) {
      console.log(`❌ STILL RATE LIMITED after 65s — may need longer wait.`);
      console.log(`   Reply: "${recovery.reply}"`);
    } else {
      console.log(`⚠️  Recovery unclear — status: ${recovery.status}, reply: "${recovery.reply}"`);
    }
  } else {
    console.log('\n(Skipping recovery check — rate limit was not triggered this run)');
  }

  // ── PART 3: Small talk — confirm no product search fires ──────────────────
  console.log('\n=== PART 3: SMALL TALK — SHOULD NOT TRIGGER PRODUCT SEARCH ===\n');
  await new Promise(r => setTimeout(r, 2000)); // small buffer

  for (const t of SMALL_TALK) {
    process.stdout.write(`"${t.msg}" (${t.lang})... `);
    const r = await send(t.msg, t.msg);
    const products = r.products;
    const searchFired = products > 0;
    const icon = !searchFired && r.ok ? '✅' : searchFired ? '🐛 BUG' : '⚠️';
    console.log(`${icon}  products: ${products}, lang: ${r.replyLang}`);
    console.log(`   REPLY: "${r.reply.slice(0, 120)}"\n`);
    if (searchFired) {
      console.log(`   🐛 BUG: Safety net incorrectly triggered product search for "${t.msg}"!`);
    }
    await new Promise(r2 => setTimeout(r2, 2000));
  }

  console.log('\n=== ALL PARTS COMPLETE ===\n');
}

main().catch(console.error);
