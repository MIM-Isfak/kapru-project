const BASE_URL = 'http://localhost:3000/api/chat';

const RAPID_MESSAGES = [
  { msg: 'show me chocolates', lang: 'en', expected: 'English' },
  { msg: 'எனக்கு சாக்லேட் வேணும்', lang: 'ta', expected: 'Tamil' },
  { msg: 'mata cool drinks denna', lang: 'si', expected: 'Sinhala' },
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
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, err: err.message };
  }
}

// Mimic ChatWindow error logic
function getKapruErrorMessage(type, lastUserContent) {
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

  const messages = KAPRU_ERROR_MESSAGES[type] || KAPRU_ERROR_MESSAGES.generic;
  const lowerContent = lastUserContent.toLowerCase();

  if (/[\u0D80-\u0DFF]/.test(lastUserContent)) return messages.si;
  if (/[\u0B80-\u0BFF]/.test(lastUserContent)) return messages.ta;

  const singlishWords = ['ekak', 'ona', 'mata', 'oyage', 'kohomada', 'denna', 'puluwan', 'mage'];
  const singlishMatchCount = singlishWords.filter(w => new RegExp(`\\b${w}\\b`).test(lowerContent)).length;
  if (singlishMatchCount >= 2) return messages.si;

  const tanglishWords = ['venum', 'illai', 'theriyum', 'solla', 'enna', 'naan'];
  const tanglishMatchCount = tanglishWords.filter(w => new RegExp(`\\b${w}\\b`).test(lowerContent)).length;
  if (tanglishMatchCount >= 2) return messages.ta;

  return messages.en;
}

function detectLang(reply) {
  if (!reply) return '(empty)';
  if (/[\u0D80-\u0DFF]/.test(reply)) return 'Sinhala';
  if (/[\u0B80-\u0BFF]/.test(reply)) return 'Tamil';
  return 'English';
}

async function main() {
  console.log('=== PRIORITY 2: LOCALIZATION REGRESSION TEST ===');
  
  for (const test of RAPID_MESSAGES) {
    // Simulate getting RATE_LIMIT error from API
    const reply = getKapruErrorMessage('rate_limit', test.msg);
    const lang = detectLang(reply);
    const pass = lang === test.expected;
    console.log(`Msg: "${test.msg}"`);
    console.log(`Expected: ${test.expected} | Got: ${lang} | ${pass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Reply: ${reply}\n`);
  }
}

main().catch(console.error);
