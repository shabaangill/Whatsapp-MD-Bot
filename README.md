# Whatsapp-MD-Bot# 👑 SHABAAN MD-BOT 👑

> An ultra-powerful, modular, and fully loaded WhatsApp Automation Engine built using Node.js and Baileys. Designed for flawless execution across Termux, Linux, and Cloud Panel hosting environments.

---

## 👨‍💻 Developer Profile
* **Lead Developer:** Shabaan Tariq
* **Official Contact:** +92 314 3007893
* **Primary Framework:** Node.js / Baileys Multi-Device (MD)

---

## 🌟 Overview
**SHABAAN MD-BOT** is an advanced, high-performance WhatsApp utility boasting **222+ automated commands**. It features comprehensive group moderation tools, robust media processing pipelines, dynamic AI integration, interactive games, and automated background handlers (Anti-Delete, Anti-Edit, and Auto-React) to give you absolute control over your chats.

### 🚀 Key Features
* **Multi-Environment Compatible:** Optimized for Termux (Android), Linux (Ubuntu/Kali), and Cloud Runtime Panel environments.
* **Proactive Security Interceptors:** Integrated with strict Anti-Link, Anti-LinkKick, and Anti-Bug crash protection.
* **Advanced Background Automation:** Built-in auto-status viewing, auto-typing simulations, and custom text/media logging.
* **Modular Command Layer:** Easily scale or add custom utilities via standalone command routing scripts.

---

## 📦 Directory Architecture & Media Layout
All structural banner assets, dynamic layouts, and menu text registries are handled cleanly inside the asset directories:
* Main UI strings and panel views are loaded from `./media/menu.js`.
* Project background graphics and custom banner modules can be customized inside the `./media/` directory.

### 📝 Integrated Command Menus
With over 222+ commands fully mapped and routed, the engine provides access to:
`Allmenu` • `Owner Menu` • `Group Menu` • `Download Menu` • `Auto Menu` • `AI Menu` • `GitHub Menu` • `Logo Menu` • `Tools Menu` • `Text Menu` • `Utility Menu` • `Exploits Menu` • `Photo Menu` • `React Menu` • `Game Menu` • `Fun Menu` • `Anime Menu`

---

## ⚡ Deployment & Installation Guide

### 🔹 Step 1: Initialize System Dependencies (Termux)
Update your system environment and install the required binary runtimes:
```bash
pkg update && pkg upgrade -y
pkg install nodejs -y
pkg install git -y
pkg install ffmpeg -y
pkg install libwebp -y
pkg install imagemagick -y
