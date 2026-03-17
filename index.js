const {
 Client,
 GatewayIntentBits,
 EmbedBuilder,
 SlashCommandBuilder,
 REST,
 Routes
} = require("discord.js");

const express = require("express");
const fs = require("fs");

// ===== KEEP ALIVE =====
const app = express();
app.get("/", (req, res) => res.send("OK"));
app.listen(3000, () => console.log("KeepAlive running"));

// ===== CONFIG =====
const TOKEN = process.env.TOKEN;

const client = new Client({
 intents: [GatewayIntentBits.Guilds]
});

// ===== DATA =====
const fishList = require("./fishList.js");

let players = {};
let taixiu = {
 bets: { tai: {}, xiu: {} },
 history: []
};

let tableMessage = null;

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
${tai} coin      (${result})      ${xiu} coin

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

 // animation
 for (let i = 0; i < 3; i++) {
  await tableMessage.edit({
   embeds: [createEmbed("🎲 Đang lắc...", 0)]
  });
  await new Promise(r => setTimeout(r, 500));
 }

 const result = Math.random() < 0.5 ? "tai" : "xiu";

 // xử lý win/lose
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

// ===== COMMAND REGISTER =====
client.once("ready", async () => {

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
     .setRequired(true)
     .addChoices(
      { name: "tai", value: "tai" },
      { name: "xiu", value: "xiu" }
     ))
   .addIntegerOption(o =>
    o.setName("tien")
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

 // PROFILE
 if (i.commandName === "profile") {

  const embed = new EmbedBuilder()
   .setTitle(i.user.username)
   .setThumbnail(i.user.displayAvatarURL())
   .addFields(
    { name: "💰 Bịp Coin", value: String(player.coin) },
    { name: "🎲 Win", value: String(player.taixiu.win) },
    { name: "🎲 Lose", value: String(player.taixiu.lose) },
    { name: "🐔 Pet", value: player.pet.name }
   );

  return i.reply({ embeds: [embed] });
 }

 // CAU CA
 if (i.commandName === "cauca") {

  const rarity = rollRarity();
  const pool = fishList[rarity];
  const fish = pool[Math.floor(Math.random() * pool.length)];

  player.coin += fish.value;

  const embed = new EmbedBuilder()
   .setTitle("🎣 Câu Cá")
   .setDescription(
`${i.user.username} câu được **${fish.name}**
⭐ ${rarity}

💰 +${fish.value} coin`
   );

  await i.reply({ embeds: [embed] });

  if (rarity === "mythic") {
   i.channel.send(`🌊 Sóng biển tuôn trào! ${i.user.username} vừa câu được **${fish.name}**`);
  }
 }

 // TAIXIU
 if (i.commandName === "taixiu") {

  const side = i.options.getString("chon");
  const money = i.options.getInteger("tien");

  if (player.coin < money) {
   return i.reply({ content: "Không đủ coin", ephemeral: true });
  }

  if (taixiu.bets.tai[id] || taixiu.bets.xiu[id]) {
   return i.reply({ content: "Bạn đã cược rồi", ephemeral: true });
  }

  player.coin -= money;
  taixiu.bets[side][id] = money;

  if (tableMessage) {
   tableMessage.edit({ embeds: [createEmbed()] });
  }

  i.reply(`Đã cược ${money} vào ${side}`);
 }

});

// ===== START TABLE =====
client.on("messageCreate", msg => {
 if (msg.content === "!startTx") {
  startRound(msg.channel);
 }
});

client.login(TOKEN);
