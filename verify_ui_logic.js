// verify_ui_logic.js
// Tests the exact API error logic + UI mapping.
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

function getKapruErrorMessage(type, lastUserContent) {
  const messages = KAPRU_ERROR_MESSAGES[type] || KAPRU_ERROR_MESSAGES.generic;
  if (/[\u0D80-\u0DFF]/.test(lastUserContent)) return messages.si;
  if (/[\u0B80-\u0BFF]/.test(lastUserContent)) return messages.ta;
  return messages.en;
}

const tests = [
  { desc: "a. RATE_LIMIT + Tamil", msg: "SIM_RATE_LIMIT வணக்கம்", type: "rate_limit" },
  { desc: "b. RATE_LIMIT + Sinhala", msg: "SIM_RATE_LIMIT ආයුබෝවන්", type: "rate_limit" },
  { desc: "c. NETWORK_ERROR + Tamil", msg: "SIM_NETWORK_ERROR வணக்கம்", type: "network" },
  { desc: "c2. NETWORK_ERROR + Sinhala", msg: "SIM_NETWORK_ERROR ආයුබෝවන්", type: "network" },
  { desc: "generic + English", msg: "SIM_UNKNOWN hello", type: "generic" },
];

async function run() {
  console.log("--- UI Logic Verification ---");
  for (const t of tests) {
    let apiRes;
    try {
      const res = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: t.msg }] })
      });
      const data = await res.json();
      
      if (!res.ok) {
        const errType = (data?.error || "UNKNOWN").toLowerCase();
        const typeKey = errType === "rate_limit" ? "rate_limit" : errType === "network_error" ? "network" : "generic";
        apiRes = getKapruErrorMessage(typeKey, t.msg);
      } else {
        apiRes = "SUCCESS: " + data.reply;
      }
    } catch (err) {
      let message = err.message || getKapruErrorMessage('generic', t.msg);
      if (message.includes("fetch failed") || message.includes("Load failed")) {
        message = getKapruErrorMessage('network', t.msg);
      }
      apiRes = message;
    }
    console.log(`${t.desc} -> ${apiRes}`);
  }
}
run();
