// Clean & Readable Command Handler
const fs = require("fs");
const path = require("path");
const { generateWAMessageFromContent } = require("@whiskeysockets/baileys");
const { toggleAntidelete } = require("../antidelete");

// Default mode
if (!global.mode) global.mode = "public"; // 🔥 Changed default to public so it instantly works everywhere

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
  // ✅ FIX 1: Flawless Message Type Extractor (Reads deep structures from other chats)
  const M = msg.message;
  if (!M) return;

  const text = (
    M.conversation ||
    M.extendedTextMessage?.text ||
    M.imageMessage?.caption ||
    M.videoMessage?.caption ||
    M.viewOnceMessage?.message?.conversation ||
    M.viewOnceMessage?.message?.imageMessage?.caption ||
    M.viewOnceMessage?.message?.videoMessage?.caption ||
    M.viewOnceMessageV2?.message?.conversation ||
    M.viewOnceMessageV2?.message?.imageMessage?.caption ||
    M.viewOnceMessageV2?.message?.videoMessage?.caption ||
    M.editedMessage?.conversation ||
    M.editedMessage?.extendedTextMessage?.text ||
    M.protocolMessage?.editedMessage?.conversation ||
    M.protocolMessage?.editedMessage?.extendedTextMessage?.text ||
    ""
  ).trim();

  // If message doesn't start with your command prefix, skip it entirely
  if (!text.startsWith(".")) return;

  const parts = text.split(/ +/);
  const command = parts[0].slice(1).toLowerCase();
  const args = parts.slice(1);

  const chatId = msg.key.remoteJid;
  if (!chatId) return;
  
  const isGroup = chatId.endsWith("@g.us");
  
  // ✅ FIX 2: Correctly isolate the sender whether it is a private chat or a group
  const senderId = msg.key.fromMe
    ? (conn.user.id.split(":")[0] + "@s.whatsapp.net")
    : (msg.key.participant || msg.key.remoteJid);

  const senderNum = senderId.replace(/\D/g, "");
  
  // ✅ FIX 3: Strict Owner Matching
  const cleanOwnerConfig = "923143007893"; 
  const isOwner = (senderNum === cleanOwnerConfig) || msg.key.fromMe;

  const reply = (replyText) => conn.sendMessage(chatId, { text: replyText }, { quoted: msg });

  // 🔸 Mode switching control
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

  // 🔸 Mode restriction policies
  if (global.mode === "self" && !isOwner) {
    // Only let the owner run commands if self-mode is active
    if (!["menu", "repo", "idcheck"].includes(command)) return;
  }

  if (global.mode === "public" && ownerOnlyCommands.includes(command) && !isOwner) {
    return reply("💀 *OWNER ONLY COMMAND!* You ain't my master londey!");
  }

  // 🔸 Run Validated Request
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

    // 🔸 menu array dictionary matching
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

    // 🔸 antidelete hook
    if (command === "antidelete") {
      return toggleAntidelete({ conn, m: msg, args, reply, jid: chatId });
    }

    // 🔸 core routing files matching
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

    // 🔸 root folder external individual files layout loader
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
    
