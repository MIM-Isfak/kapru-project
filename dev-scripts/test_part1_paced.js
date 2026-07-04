// test_part1_paced.js — Part 1: Human-paced test (waits for full response before next)
// Simulates a real user browsing naturally — 3–5s between messages.

const BASE_URL = 'http://localhost:3000/api/chat';

const TESTS = [
  { id: 1,  lang: 'English',       msg: 'hello there' },
  { id: 2,  lang: 'English',       msg: 'show me some chocolates' },
  { id: 3,  lang: 'Tamil script',  msg: 'எனக்கு பரிசு வேண்டும்' },
  { id: 4,  lang: 'English',       msg: 'show me perfumes' },
  { id: 5,  lang: 'Singlish',      msg: 'mata sellam bandu ekak ona' },
  { id: 6,  lang: 'Tamil script',  msg: 'வீட்டு உபகரணங்கள் காட்டு' },
  { id: 7,  lang: 'English',       msg: 'show books' },
  { id: 8,  lang: 'Sinhala',       msg: 'එළවලු ඕන' },
  { id: 9,  lang: 'Tanglish',      msg: 'kitchen items venum' },
  { id: 10, lang: 'English',       msg: 'show me toys' },
];

function detectLang(reply) {
  if (!reply) return '(empty)';
  if (/[\u0D80-\u0DFF]/.test(reply)) return 'Sinhala';
  if (/[\u0B80-\u0BFF]/.test(reply)) return 'Tamil';
  return 'English';
}

async function runTest(test, pause) {
  const start = Date.now();
  const body = JSON.stringify({ messages: [{ role: 'user', content: test.msg }] });
  try {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const data = await res.json();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    let reply = data.reply || '(empty)';
    
    // Mimic ChatWindow error logic
    if (!res.ok) {
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
      if (/[\u0D80-\u0DFF]/.test(test.msg)) reply = messages.si;
      else if (/[\u0B80-\u0BFF]/.test(test.msg)) reply = messages.ta;
      else reply = messages.en;
    }

    const products = Array.isArray(data.products) ? data.products.length : 0;
    const ok = res.ok && !data.error;
    return { ...test, ok, status: res.status, reply: reply.slice(0, 100), replyLang: detectLang(reply), products, elapsed };
  } catch (err) {
    let reply = err.message;
    if (reply.includes("fetch failed")) reply = "It looks like my connection dropped — could you check your internet and try again?";
    return { ...test, ok: false, status: 0, reply, replyLang: 'N/A', products: 0, elapsed: '?' };
  }
}

async function main() {
  console.log('=== PART 1: HUMAN-PACED TEST (3s natural pause between messages) ===\n');
  const results = [];

  for (const test of TESTS) {
    process.stdout.write(`[${test.id}/10] "${test.msg}" (${test.lang})... `);
    const result = await runTest(test);
    results.push(result);

    const icon = result.ok ? '✅' : (result.status === 429 ? '⚠️ 429' : '❌');
    console.log(`${icon}  ${result.products} products | lang: ${result.replyLang} | ${result.elapsed}s`);
    console.log(`        REPLY: ${result.reply}\n`);

    // Natural human pause (3s) before the next message
    if (test.id < TESTS.length) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  // Summary
  const passed = results.filter(r => r.ok).length;
  const hit429 = results.filter(r => r.status === 429).length;
  const failed = results.filter(r => !r.ok && r.status !== 429).length;

  console.log('=== PART 1 SUMMARY ===');
  console.log(`✅ PASS: ${passed}/10`);
  if (hit429) console.log(`⚠️  RATE LIMITED (429): ${hit429}/10 — unexpected at human pace!`);
  if (failed) console.log(`❌ OTHER FAILURE: ${failed}/10`);
  if (passed === 10) console.log('\n✅ ALL 10 HUMAN-PACED MESSAGES PASSED — rate limiting does NOT affect normal usage.\n');
  else console.log('\n⚠️  Some messages failed — review above.\n');
}

main().catch(console.error);
