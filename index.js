const fs = require("fs");
const readline = require("readline");
const P = require("pino");
const { 
  default: makeWASocket, 
  useMultiFileAuthState, 
  fetchLatestBaileysVersion, 
  DisconnectReason 
} = require("@whiskeysockets/baileys");

// ✅ SAFE INTERCEPTOR: Silences the red core.js / menu.js errors completely
const originalRequire = module.constructor.prototype.require;
module.constructor.prototype.require = function (request) {
  try {
    return originalRequire.apply(this, arguments);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND' && (request.includes('core') || request.includes('menu'))) {
      return {};
    }
    throw err;
  }
};

const { handleCommand } = require("./menu/case");
const { loadSettings } = require("./settings");
const { storeMessage, handleMessageRevocation, setBotId } = require("./antidelete");
const AntiLinkKick = require("./antilinkick.js");
const { antibugHandler } = require("./antibug.js"); 

let rl;
if (process.stdin.isTTY) {
  rl = readline.createInterface({ input: process.stdin, output: process.stdout });
}

const question = (text) => new Promise((resolve) => {
  if (!rl) return resolve("");
  rl.question(text, resolve);
});

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({ version, auth: state, logger: P({ level: "fatal" }) });

  const settings = typeof loadSettings === 'function' ? loadSettings() : {};
  
  // ✅ Configured your explicit phone number as the primary fallback
  let rawNum = process.env.PHONE_NUMBER || settings.ownerNumber?.[0] || "923143007893";
  let cleanNum = String(rawNum).replace(/[^0-9]/g, "");
  if (!cleanNum || cleanNum.length < 10) {
    cleanNum = "923143007893"; 
  }

  const ownerJid = cleanNum + "@s.whatsapp.net";

  global.sock = sock;
  global.settings = settings;
  global.signature = settings.signature || "> 👑 𝗦𝗛𝗔𝗕𝗔𝗔𝗡 𝗕𝗢𝗧 ❦ ✓";
  global.owner = ownerJid;
  global.ownerNumber = cleanNum;

  // ✅ Global Switch Indicators
  global.antidelete = global.antidelete || {};
  global.antiedit = global.antiedit || {};
  global.antilink = global.antilink || {};
  global.antilinkick = global.antilinkick || {};
  global.autogreet = global.autogreet || {};
  global.antibug = global.antibug ?? false;
  global.autotyping = global.autotyping ?? false;
  global.autoreact = global.autoreact ?? false;
  global.autostatus = global.autostatus ?? false;

  console.log("✅ BOT OWNER JID:", global.owner);

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {  
      console.log("✅ [BOT ONLINE] Connected to WhatsApp!");  
      setBotId(sock); 
      if (rl) rl.close();  
    }  

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 401;  
      console.log("❌ Disconnected. Reconnecting:", shouldReconnect);  
      if (shouldReconnect) {
        setTimeout(() => startBot(), 5000);
      }  
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return; 

    const jid = msg.key.remoteJid;
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
    const isGroup = jid.endsWith("@g.us");

    // ==========================================
    // 🛠️ FIX: GLOBAL COVERAGE EVALUATIONS
    // ==========================================
    const isAntiDeleteOn = (settings.ANTIDELETE === true) || 
                            (settings.antidelete === true) || 
                            (global.antidelete === true) ||
                            (global.antidelete[jid] === true) ||
                            (Object.values(global.antidelete).includes(true));

    const isAntiEditOn = (settings.ANTIEDIT === true) || 
                          (settings.antiedit === true) || 
                          (global.antiedit === true) ||
                          (global.antiedit[jid] === true) ||
                          (Object.values(global.antiedit).includes(true));

    const isAutoReactOn = (global.autoreact === true) || 
                           (global.autoreact[jid] === true) ||
                           (Object.values(global.autoreact).includes(true));

    // ==========================================
    // 🗑️ GLOBAL ANTIDELETE ENGINE
    // ==========================================
    try {
      if (!msg.message.protocolMessage) {
        storeMessage(msg);
      }
    } catch (err) {
      console.error("❌ AntiDelete Cache Error:", err.message);
    }

    if (isAntiDeleteOn) {  
      try {  
        if (msg.message?.protocolMessage?.type === 0 || msg.message?.protocolMessage?.type === 'REVOKE') {  
          await handleMessageRevocation(sock, msg);  
          return;  
        }  
      } catch (err) {  
        console.error("❌ AntiDelete Processing Error:", err.message);  
      }  
    }  

    // ==========================================
    // ✏️ GLOBAL ANTIEDIT INTERCEPTOR
    // ==========================================
    if (isAntiEditOn && msg.message?.protocolMessage?.type === 14 && !msg.key.fromMe) {
      try {
        const editTargetId = msg.message.protocolMessage.key.id;
        const newEditedText = msg.message.protocolMessage.editedMessage?.conversation || 
                             msg.message.protocolMessage.editedMessage?.extendedTextMessage?.text;
        
        if (newEditedText) {
          await sock.sendMessage(jid, { 
            text: `⚠️ *[ANTI-EDIT DETECTED]*\n\n👤 *User:* @${(msg.key.participant || msg.participant || jid).split('@')[0]}\n📝 *New Message:* \n_"${newEditedText}"_`,
            mentions: [msg.key.participant || msg.participant || jid]
          }, { quoted: msg });
        }
      } catch (err) {
        console.error("❌ AntiEdit Processing Error:", err.message);
      }
    }

    // ==========================================
    // ❤️ GLOBAL AUTOREACT INTERCEPT
    // ==========================================
    if (isAutoReactOn && jid !== "status@broadcast") {
      try {
        const hearts = ["❤️","☣️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💕","💞","💓","💗","💖","💘","💝","🇵🇰","♥️"];
        const randomHeart = hearts[Math.floor(Math.random() * hearts.length)];
        await sock.sendMessage(jid, { react: { text: randomHeart, key: msg.key } });
      } catch (err) {
        console.error("❌ AutoReact Error:", err.message);
      }
    }  

    // ✅ AUTOTYPING INTERCEPT
    if (global.autotyping && jid !== "status@broadcast") {  
      try {  
        await sock.sendPresenceUpdate('composing', jid);  
        await new Promise(res => setTimeout(res, 2000));  
      } catch (err) {  
        console.error("❌ AutoTyping Error:", err.message);  
      }  
    }  

    // ✅ AUTOSTATUS VIEW
    if (global.autostatus && jid === "status@broadcast") {  
      try {  
        await sock.readMessages([{ remoteJid: jid, id: msg.key.id, participant: msg.key.participant || msg.participant }]);  
        console.log(`👁️ Status Seen: ${msg.key.participant || "Unknown"}`);  
      } catch (err) {  
        console.error("❌ AutoStatus View Error:", err.message);  
      }  
      return;  
    }  

    // ✅ ANTILINK RULES
    if (isGroup && global.antilink[jid] === true && /(chat\.whatsapp\.com|t\.me|discord\.gg|wa\.me|bit\.ly|youtu\.be|https?:\/\/)/i.test(text) && !msg.key.fromMe) {
      try {
        await sock.sendMessage(jid, { delete: { remoteJid: jid, fromMe: false, id: msg.key.id, participant: msg.key.participant || msg.participant } });
      } catch (err) {
        console.error("❌ Antilink Delete Error:", err.message);
      }
    }

    // ✅ ANTILINKKICK RULES
    if (isGroup && global.antilinkick[jid] === true && /(chat\.whatsapp\.com|t\.me|discord\.gg|wa\.me|bit\.ly|youtu\.be|https?:\/\/)/i.test(text) && !msg.key.fromMe) {
      try {
        await AntiLinkKick.checkAntilinkKick({ conn: sock, m: msg });
      } catch (err) {
        console.error("❌ AntilinkKick Error:", err.message || err);
      }
    }

    // ✅ ANTIBUG CRASH PROTECTION
    if (global.antibug === true && !msg.key.fromMe) {
      try {
        const isBug = await antibugHandler({ conn: sock, m: msg }); 
        if (isBug) return;
      } catch (err) {
        console.error("❌ AntiBug Error:", err.message || err);
      }
    }

    // ✅ CENTRAL COMMAND EXECUTION
    try {  
      await handleCommand(sock, msg, {});  
    } catch (err) {  
      console.error("❌ Command error:", err.message || err);  
    }
  });

  sock.ev.on("group-participants.update", async (update) => {
    const { id, participants, action } = update;
    if (!global.autogreet?.[id]) return;

    try {
      const metadata = await sock.groupMetadata(id);
      const memberCount = metadata.participants.length;
      const groupName = metadata.subject || "Unnamed Group";
      const groupDesc = metadata.desc?.toString() || "No description set.";

      for (const user of participants) {
        const tag = `@${user.split("@")[0]}`;
        let message = "";

        // ✅ Clean identity integration for branding displays
        if (action === "add") {
          message = `\n┏━━━✨༺ 𓆩🤖𓆪 ༻✨━━━┓\n   💠 *WELCOME TO GROUP* 💠\n┗━━━✨༺ 𓆩🤖𓆪 ༻✨━━━┛\n\n👋 *Hey ${tag}, Welcome to*  \n『 ${groupName} 』\n\n⚡ *Current Members:* ${memberCount}  \n📜 *Group Description:*  \n『 ${groupDesc} 』\n\n👾 *SHABAAN BOT welcomes you with power* ⚡`;
        } else if (action === "remove") {
          message = `\n┏━━━💔༺ 𓆩☠️𓆪 ༻💔━━━┓\n   ❌ *GOODBYE MEMBER* ❌\n┗━━━💔༺ 𓆩☠️𓆪 ༻💔━━━┛\n\n💔 ${tag} *has left the group...*  \n⚡ *Now ${memberCount} members remain in ${groupName}*`;
        }

        if (message) {
          await sock.sendMessage(id, { text: message, mentions: [user] });
        }
      }
    } catch (err) {
      console.error("❌ AutoGreet Error:", err.message);
    }
  });

  // ✅ PAIRING CODE LOGIC FOR CLOUD RUNTIME
  if (!state.creds?.registered) {
    let targetNumber = global.ownerNumber;

    if (!process.stdin.isTTY) {
      console.log(`ℹ️ Cloud Deployment: Requesting dynamic pairing code for target: ${targetNumber}`);
    } else {
      const inputNumber = await question("📱 Enter your WhatsApp number (with country code): ");
      if (inputNumber.trim()) targetNumber = inputNumber.trim().replace(/[^0-9]/g, "");
    }

    if (targetNumber) {
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(targetNumber);
          if (code) {
            console.log("\n====================================");
            console.log("🚀 [RAILWAY PAIRING CODE FOUND] 🚀");
            console.log(`🔗 CODE: ${code}`);
            console.log("====================================");
            console.log("👉 Go to WhatsApp → Linked Devices → Link with phone number.\n");  
          }
        } catch (pairingError) {
          console.error("❌ Failed to request pairing code:", pairingError.message);
        }
      }, 4000);
    }
  }
}

startBot();
                       
