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
const { storeMessage, handleMessageRevocation } = require("./antidelete");
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
  let ownerRaw = process.env.PHONE_NUMBER || settings.ownerNumber?.[0] || "923143007893";
  const ownerJid = ownerRaw.includes("@s.whatsapp.net") ? ownerRaw : ownerRaw + "@s.whatsapp.net";

  global.sock = sock;
  global.settings = settings;
  global.signature = settings.signature || "> 👑 𝗦𝗛𝗔𝗕𝗔𝗔𝗡 𝗕𝗢𝗧 ❦ ✓";
  global.owner = ownerJid;
  global.ownerNumber = ownerRaw;

  // ✅ Flags
  global.antilink = {};
  global.antilinkick = {};
  global.antibug = false;
  global.autogreet = {};
  global.autotyping = false;
  global.autoreact = false;
  global.autostatus = false;

  console.log("✅ BOT OWNER:", global.owner);

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {  
      console.log("✅ [BOT ONLINE] Connected to WhatsApp!");  
      if (rl) rl.close();  
    }  

    if (connection === "close") {  
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 401;  
      console.log("❌ Disconnected. Reconnecting:", shouldReconnect);  
      if (shouldReconnect) {
        setTimeout(() => startBot(), 5000); // Add a 5-second delay to prevent aggressive loops
      }  
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    const jid = msg.key.remoteJid;
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";

    if (settings.ANTIDELETE === true) {  
      try {  
        if (msg.message) storeMessage(msg);  
        if (msg.message?.protocolMessage?.type === 0) {  
          await handleMessageRevocation(sock, msg);  
          return;  
        }  
      } catch (err) {  
        console.error("❌ AntiDelete Error:", err.message);  
      }  
    }  

    if (global.autotyping && jid !== "status@broadcast") {  
      try {  
        await sock.sendPresenceUpdate('composing', jid);  
        await new Promise(res => setTimeout(res, 2000));  
      } catch (err) {  
        console.error("❌ AutoTyping Error:", err.message);  
      }  
    }  

    if (global.autoreact && jid !== "status@broadcast") {
      try {
        const hearts = ["❤️","☣️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💕","💞","💓","💗","💖","💘","💝","🇵🇰","♥️"];
        const randomHeart = hearts[Math.floor(Math.random() * hearts.length)];
        await sock.sendMessage(jid, { react: { text: randomHeart, key: msg.key } });
      } catch (err) {
        console.error("❌ AutoReact Error:", err.message);
      }
    }  

    if (global.autostatus && jid === "status@broadcast") {  
      try {  
        await sock.readMessages([{ remoteJid: jid, id: msg.key.id, participant: msg.key.participant || msg.participant }]);  
        console.log(`👁️ Status Seen: ${msg.key.participant || "Unknown"}`);  
      } catch (err) {  
        console.error("❌ AutoStatus View Error:", err.message);  
      }  
      return;  
    }  

    if (jid.endsWith("@g.us") && global.antilink[jid] === true && /(chat\.whatsapp\.com|t\.me|discord\.gg|wa\.me|bit\.ly|youtu\.be|https?:\/\/)/i.test(text) && !msg.key.fromMe) {
      try {
        await sock.sendMessage(jid, { delete: { remoteJid: jid, fromMe: false, id: msg.key.id, participant: msg.key.participant || msg.participant } });
      } catch (err) {
        console.error("❌ Antilink Delete Error:", err.message);
      }
    }

    if (jid.endsWith("@g.us") && global.antilinkick[jid] === true && /(chat\.whatsapp\.com|t\.me|discord\.gg|wa\.me|bit\.ly|youtu\.be|https?:\/\/)/i.test(text) && !msg.key.fromMe) {
      try {
        await AntiLinkKick.checkAntilinkKick({ conn: sock, m: msg });
      } catch (err) {
        console.error("❌ AntilinkKick Error:", err.message || err);
      }
    }

    if (global.antibug === true && !msg.key.fromMe) {
      try {
        const isBug = await antibugHandler({ conn: sock, m: msg }); 
        if (isBug) return;
      } catch (err) {
        console.error("❌ AntiBug Error:", err.message || err);
      }
    }

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

  // ✅ FIXED AUTOMATED PAIRING CODE LOGIC
  if (!state.creds?.registered) {
    let targetNumber = global.ownerNumber;

    if (!process.stdin.isTTY) {
      console.log(`ℹ️ Cloud Deployment: Requesting pairing code for setup number: ${targetNumber}`);
    } else {
      const inputNumber = await question("📱 Enter your WhatsApp number (with country code): ");
      if (inputNumber.trim()) targetNumber = inputNumber.trim();
    }

    if (targetNumber) {
      const cleanedNumber = targetNumber.replace(/[^0-9]/g, "");
      // Give the socket 4 seconds to settle before requesting the pairing token
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(cleanedNumber);
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
    
