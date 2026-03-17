const {
 Client,
 GatewayIntentBits,
 EmbedBuilder,
 SlashCommandBuilder,
 REST,
 Routes
} = require("discord.js");

const express = require("express");

// ===== KEEP ALIVE =====
const app = express();
app.get("/", (req, res) => res.send("OK"));
app.listen(3000, () => console.log("KeepAlive running"));

const TOKEN = process.env.TOKEN;

const client = new Client({
 intents: [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.MessageContent // FIX
 ]
});

// ===== DATA =====
const fishList = require("./fishList.js");

let players = {};
let taixiu = {
 bets: { tai: {}, xiu: {} },
 history: []
};

let tableMessage = null;

// ===== COOLDOWN =====
const fishCooldown = new Map();
const txCooldown = new Map();

// ===== FORMAT VND =====
function formatVND(num) {
 return num.toLocaleString("vi-VN") + " VND";
}

// ===== PLAYER =====
function getPlayer(id) {
 if (!players[id]) {
  players[id] = {
   coin: 1000,
   taixiu: { win: 0, lose: 0 },
   pet: { name: "None" }
  };
 }
 return players[id];
}

// ===== FISH =====
function rollRarity() {
 const r = Math.random() * 100;
 if (r < 60) return "common";
 if (r < 80) return "uncommon";
 if (r < 90) return "rare";
 if (r < 97) return "epic";
 if (r < 99.5) return "legendary";
 return "mythic";
}

// ===== HISTORY =====
function historyIcons() {
 return taixiu.history.map(x => x === "tai" ? "⚪" : "⚫").join("");
}

// ===== EMBED =====
function createEmbed(result = "Đang chờ...", time = 60) {

 const tai = Object.values(taixiu.bets.tai).reduce((a, b) => a + b, 0);
 const xiu = Object.values(taixiu.bets.xiu).reduce((a, b) => a + b, 0);

 return new EmbedBuilder()
  .setTitle("======= TaiXiu For Fun =======")
  .setDescription(
`⚪Tài⚪   (${time}s)           ⚫Xỉu⚫
${formatVND(tai)}      (${result})      ${formatVND(xiu)}

-----------------------------
${historyIcons()}
===================`
  );
}

// ===== ROUND =====
async function startRound(channel) {

 if (!tableMessage) {
  tableMessage = await channel.send({ embeds: [createEmbed()] });
 }

 let time = 60;

 const interval = setInterval(async () => {

  time--;

  await tableMessage.edit({
   embeds: [createEmbed("Đang chờ...", time)]
  });

  if (time <= 0) {
   clearInterval(interval);
   rollResult(channel);
  }

 }, 1000);
}

// ===== ROLL =====
async function rollResult(channel) {

 for (let i = 0; i < 3; i++) {
  await tableMessage.edit({
   embeds: [createEmbed("🎲 Đang lắc...", 0)]
  });
  await new Promise(r => setTimeout(r, 500));
 }

 const result = Math.random() < 0.5 ? "tai" : "xiu";

 const winners = taixiu.bets[result];
 const losers = result === "tai" ? taixiu.bets.xiu : taixiu.bets.tai;

 for (let id in winners) {
  const p = getPlayer(id);
  p.coin += winners[id] * 2;
  p.taixiu.win++;
 }

 for (let id in losers) {
  const p = getPlayer(id);
  p.taixiu.lose++;
 }

 taixiu.history.unshift(result);
 taixiu.history = taixiu.history.slice(0, 12);

 taixiu.bets = { tai: {}, xiu: {} };

 await tableMessage.edit({
  embeds: [createEmbed(result === "tai" ? "⚪ TÀI" : "⚫ XỈU", 0)]
 });

 setTimeout(() => startRound(channel), 10000);
}

// ===== REGISTER =====
client.once("clientReady", async () => {

 console.log("Bot ready");

 const commands = [

  new SlashCommandBuilder()
   .setName("profile")
   .setDescription("Xem profile"),

  new SlashCommandBuilder()
   .setName("cauca")
   .setDescription("Câu cá"),

  new SlashCommandBuilder()
   .setName("taixiu")
   .setDescription("Đặt cược")
   .addStringOption(o =>
    o.setName("chon")
     .setDescription("Chọn tài hoặc xỉu") // FIX
     .setRequired(true)
     .addChoices(
      { name: "tai", value: "tai" },
      { name: "xiu", value: "xiu" }
     ))
   .addIntegerOption(o =>
    o.setName("tien")
     .setDescription("Số tiền cược") // FIX
     .setRequired(true))

 ].map(c => c.toJSON());

 const rest = new REST({ version: "10" }).setToken(TOKEN);

 await rest.put(
  Routes.applicationCommands(client.user.id),
  { body: commands }
 );

});

// ===== INTERACTION =====
client.on("interactionCreate", async i => {

 if (!i.isChatInputCommand()) return;

 const id = i.user.id;
 const player = getPlayer(id);

 if (i.commandName === "profile") {

  const embed = new EmbedBuilder()
   .setTitle(i.user.username)
   .setThumbnail(i.user.displayAvatarURL())
   .addFields(
    { name: "💰 Bịp Coin", value: formatVND(player.coin) },
    { name: "🎲 Win", value: String(player.taixiu.win) },
    { name: "🎲 Lose", value: String(player.taixiu.lose) },
    { name: "🐔 Pet", value: player.pet.name }
   );

  return i.reply({ embeds: [embed] });
 }

 if (i.commandName === "cauca") {

  const now = Date.now();

  if (fishCooldown.has(id)) {
   const timeLeft = (fishCooldown.get(id) + 60000 - now) / 1000;
   if (timeLeft > 0) {
    return i.reply({
     content: `⏳ Đợi ${Math.ceil(timeLeft)}s để câu tiếp`,
     ephemeral: true
    });
   }
  }

  fishCooldown.set(id, now);

  const rarity = rollRarity();
  const pool = fishList[rarity];
  const fish = pool[Math.floor(Math.random() * pool.length)];

  player.coin += fish.value;

  const embed = new EmbedBuilder()
   .setTitle("🎣 Câu Cá")
   .setDescription(
`${i.user.username} câu được **${fish.name}**
⭐ ${rarity}

💰 +${formatVND(fish.value)}`
   );

  await i.reply({ embeds: [embed] });

  if (rarity === "mythic") {
   i.channel.send(`🌊 Sóng biển tuôn trào! ${i.user.username} vừa câu được **${fish.name}**`);
  }
 }

 if (i.commandName === "taixiu") {

  const now = Date.now();

  if (txCooldown.has(id)) {
   const timeLeft = (txCooldown.get(id) + 10000 - now) / 1000;
   if (timeLeft > 0) {
    return i.reply({
     content: `⏳ Đợi ${Math.ceil(timeLeft)}s để cược tiếp`,
     ephemeral: true
    });
   }
  }

  const side = i.options.getString("chon");
  const money = i.options.getInteger("tien");

  if (player.coin < money) {
   return i.reply({ content: "Không đủ tiền", ephemeral: true });
  }

  if (taixiu.bets.tai[id] || taixiu.bets.xiu[id]) {
   return i.reply({ content: "Bạn đã cược round này", ephemeral: true });
  }

  player.coin -= money;
  taixiu.bets[side][id] = money;

  txCooldown.set(id, now);

  if (tableMessage) {
   tableMessage.edit({ embeds: [createEmbed()] });
  }

  i.reply(`Đã cược ${formatVND(money)} vào ${side}`);
 }

});

// ===== START =====
client.on("messageCreate", msg => {
 if (msg.content === "!startTx") {
  startRound(msg.channel);
 }
});

client.login(TOKEN);
