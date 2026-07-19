// Clean & Readable Command Handler
const fs = require("fs");
const path = require("path");
const { generateWAMessageFromContent } = require("@whiskeysockets/baileys");
const { toggleAntidelete } = require("../antidelete");

// Default mode
if (!global.mode) global.mode = "self";

// Owner-only commands list
const ownerOnlyCommands = [
  "video2", "song2", "kick", "add", "nice", "tagall",
  "antilink", "antilinkick", "autostatus", "autoreact",
  "autogreet", "autotyping", "autoread", "block", "unblock",
  "shutdown", "restart", "setbio", "setname", "setpp", "save",
  "join", "delaymsg", "del", "reactch", "kickall", "antibug",
  "leave", "open", "close", "tagadmin", "hidetag", "listactive",
  "changename", "closetime", "warn", "promote", "demote",
  "promoteall", "demoteall", "say", "cpp", "harami", "ghostping",
  "adminkill", "delaymsg", "autorecording", "antidelete", "public", "self"
];

// Load menu.js
const menuData = {};
try {
  const menuPath = path.join(__dirname, "..", "media", "menu.js");
  if (fs.existsSync(menuPath)) {
    Object.assign(menuData, require(menuPath));
  }
} catch (err) {
  console.error("❌ Error loading menu.js:", err);
}

// Load core.js if exists
let core;
try {
  const corePath = path.join(__dirname, "./core.js");
  if (fs.existsSync(corePath)) {
    core = require(corePath);
  }
} catch (err) {
  console.error("❌ Error loading core.js:", err);
}

// ===============================
// 🔹 MAIN COMMAND HANDLER
// ===============================
async function handleCommand(conn, msg) {
  const text =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    "";

  if (!text.startsWith(".")) return;

  const parts = text.trim().split(/ +/);
  const command = parts[0].slice(1).toLowerCase();
  const args = parts.slice(1);

  const chatId = msg.key.remoteJid;
  if (!chatId) return;
  
  const isGroup = chatId.endsWith("@g.us");
  const senderId = msg.key.fromMe
    ? conn.user.id.split(":")[0] + "@s.whatsapp.net"
    : msg.key.participant || msg.key.remoteJid;

  const senderNum = senderId.replace(/\D/g, "");
  
  // ✅ FIX: Robust absolute owner matching for your number
  const cleanOwnerConfig = "923143007893"; 
  const isOwner = (senderNum === cleanOwnerConfig) || msg.key.fromMe;
  const isDev = senderNum.includes("9234") || isOwner; 

  const reply = (text) => conn.sendMessage(chatId, { text }, { quoted: msg });

  // 🔸 Mode control
  if (command === "self") {
    if (!isOwner) return reply("🚫 *Only Owner Can Switch Modes*");
    global.mode = "self";
    return reply("🔒 BOT IS NOW IN *SELF MODE* — Only Owner can use me!");
  }

  if (command === "public") {
    if (!isOwner) return reply("🚫 *Only Owner Can Switch Modes*");
    global.mode = "public";
    return reply("🌍 BOT IS NOW IN *PUBLIC MODE* — Everyone can use me!");
  }

  // 🔸 Mode restrictions enforcement
  if (global.mode === "self" && !isOwner && !["menu", "repo", "idcheck"].includes(command)) {
    // Silently ignore execution requests from other users while locked down in self mode
    return;
  }

  if (global.mode === "public" && ownerOnlyCommands.includes(command) && !isOwner) {
    return reply("💀 *OWNER ONLY COMMAND!* You ain't my master londey!");
  }

  // 🔸 Validated Routing Execution
  return runCommand({
    conn,
    msg,
    args,
    command,
    chatId,
    isGroup,
    senderNum,
    reply
  });
}

// ===============================
// 🔹 COMMAND EXECUTOR
// ===============================
async function runCommand({
  conn,
  msg,
  args,
  command,
  chatId,
  isGroup,
  senderNum,
  reply
}) {
  try {
    // 🔸 idcheck
    if (command === "idcheck") {
      const botId = conn.user.id || "";
      return reply(
        `🤖 *Bot ID:* ${botId}\n📤 *Sender JID:* ${
          msg.key.participant || msg.key.remoteJid
        }\n🔢 *Sender Clean:* ${senderNum}`
      );
    }

    // 🔸 menu message panels routing
    if (menuData && menuData[command]) {
      const menuMessage = generateWAMessageFromContent(
        chatId,
        { extendedTextMessage: { text: menuData[command] } },
        { userJid: chatId }
      );
      return await conn.relayMessage(chatId, menuMessage.message, {
        messageId: menuMessage.key.id
      });
    }

    // 🔸 antidelete handler coupling
    if (command === "antidelete") {
      return toggleAntidelete({ conn, m: msg, args, reply, jid: chatId });
    }

    // 🔸 core engine module functional mapping
    if (core && core[command] && typeof core[command] === "function") {
      return await core[command]({
        conn,
        m: msg,
        args,
        command,
        jid: chatId,
        isGroup,
        sender: senderNum,
        reply
      });
    }

    // 🔸 check individual file commands outside main routers
    const filePath = path.join(__dirname, "..", `${command}.js`);
    if (fs.existsSync(filePath)) {
      const commandFile = require(filePath);
      if (typeof commandFile === "function") {
        return await commandFile({ conn, m: msg, args, command, jid: chatId, isGroup, sender: senderNum, reply });
      }
      if (commandFile && typeof commandFile.run === "function") {
        return await commandFile.run({ conn, m: msg, args, command, jid: chatId, isGroup, sender: senderNum, reply });
      }
    }

    // 🔸 fallback alert response for unhandled requests
    return reply("*ᴜɴᴋɴᴏᴡɴ ᴄᴏᴍᴍᴀɴᴅ! ᴛʀʏ `.ᴍᴇɴᴜ` ʙᴇꜰᴏʀᴇ sʜᴏᴡɪɴɢ ᴏꜰꜰ 𓄀*");

  } catch (err) {
    console.error("⚠️ Error in command execution:", err);
    return reply("⚠️ Error executing this command layout!");
  }
}

// ===============================
// 🔹 Export
// ===============================
module.exports = {
  handleCommand
};
    
