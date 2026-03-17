const {
 Client,
 GatewayIntentBits,
 EmbedBuilder,
 SlashCommandBuilder,
 REST,
 Routes
} = require("discord.js");

const fs = require("fs");

const TOKEN = process.env.TOKEN;

const client = new Client({
 intents: [GatewayIntentBits.Guilds]
  
const express = require("express");

const app = express();

app.get("/", (req, res) => {
  res.send("Bot is alive!");
});

app.listen(3000, () => {
  console.log("Keep alive server running");
});

let players = {};
let fishList = [
 {name:"Cá chép",rarity:"common",coin:100},
 {name:"Cá rô",rarity:"common",coin:120},
 {name:"Cá hồi",rarity:"rare",coin:300},
 {name:"Cá mập",rarity:"epic",coin:800},
 {name:"Cá vàng",rarity:"legendary",coin:2000},
 {name:"Cá thần",rarity:"mythic",coin:5000}
];

let taixiu = {
 bets:{tai:{},xiu:{}},
 history:[],
 status:"open"
};

let tableMessage = null;
let roundTime = 60;

const fishCooldown = new Map();

function getPlayer(id){
 if(!players[id]){
  players[id] = {
   coin:1000,
   taixiu:{win:0,lose:0},
   pet:{name:"None",atk:0,hp:0}
  };
 }
 return players[id];
}

function historyIcons(){
 return taixiu.history
 .map(x => x === "tai" ? "⚪" : "⚫")
 .join("");
}

function createEmbed(result="Đang chờ...", cooldown=roundTime){

 const taiTotal = Object.values(taixiu.bets.tai)
 .reduce((a,b)=>a+b,0);

 const xiuTotal = Object.values(taixiu.bets.xiu)
 .reduce((a,b)=>a+b,0);

 return new EmbedBuilder()
 .setTitle("======= TaiXiu For Fun =======")
 .setDescription(
`⚪Tài⚪   (${cooldown}s)           ⚫Xỉu⚫
${taiTotal} coin      (${result})      ${xiuTotal} coin

-----------------------------
${historyIcons()}
===================`)
 .setColor("White");
}

async function updateTable(){

 if(!tableMessage) return;

 const embed = createEmbed();

 tableMessage.edit({embeds:[embed]});

}

function rollResult(){

 return Math.random() < 0.5 ? "tai" : "xiu";

}

async function runRound(channel){

 if(!tableMessage){

 const embed = createEmbed();

 tableMessage = await channel.send({
  embeds:[embed]
 });

 }

 let timer = 60;

 const interval = setInterval(()=>{

  timer--;

  tableMessage.edit({
   embeds:[createEmbed("Đang chờ...",timer)]
  });

  if(timer<=0){

   clearInterval(interval);

   animateDice(channel);

  }

 },1000);

}

async function animateDice(channel){

 const frames = [
 "🎲   🎲   🎲",
 "🎲🎲 🎲",
 "🎲 🎲🎲",
 "🎲🎲🎲"
 ];

 for(const f of frames){

  await tableMessage.edit({
   embeds:[createEmbed("🎲 Đang lắc xúc xắc...",0)]
  });

  await new Promise(r=>setTimeout(r,500));

 }

 const result = rollResult();

 taixiu.history.unshift(result);
 taixiu.history = taixiu.history.slice(0,12);

 const winners = taixiu.bets[result];

 for(const id in winners){

  const bet = winners[id];
  const p = getPlayer(id);

  p.coin += bet * 2;
  p.taixiu.win++;

 }

 const losers = result === "tai" ? taixiu.bets.xiu : taixiu.bets.tai;

 for(const id in losers){

  const p = getPlayer(id);
  p.taixiu.lose++;

 }

 taixiu.bets = {tai:{},xiu:{}};

 await tableMessage.edit({
  embeds:[createEmbed(result === "tai" ? "⚪ TÀI" : "⚫ XỈU",0)]
 });

 setTimeout(()=>{
  runRound(channel);
 },10000);

}

function rollFish(){

 const r = Math.random()*100;

 if(r<60) return "common";
 if(r<80) return "uncommon";
 if(r<90) return "rare";
 if(r<97) return "epic";
 if(r<99.5) return "legendary";
 return "mythic";

}

client.once("ready", async ()=>{

 console.log("Bot Ready");

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
 .addStringOption(o=>
  o.setName("chon")
  .setRequired(true)
  .addChoices(
   {name:"tai",value:"tai"},
   {name:"xiu",value:"xiu"}
  )
 )
 .addIntegerOption(o=>
  o.setName("tien")
  .setRequired(true)
 )

 ].map(c=>c.toJSON());

 const rest = new REST({version:"10"}).setToken(TOKEN);

 await rest.put(
  Routes.applicationCommands(client.user.id),
  {body:commands}
 );

 console.log("Commands loaded");

});

client.on("interactionCreate", async interaction=>{

 if(!interaction.isChatInputCommand()) return;

 const id = interaction.user.id;
 const player = getPlayer(id);

 if(interaction.commandName === "profile"){

 const embed = new EmbedBuilder()
 .setTitle(`${interaction.user.username}`)
 .setThumbnail(interaction.user.displayAvatarURL())
 .addFields(
 {name:"💰 Bịp Coin",value:String(player.coin)},
 {name:"🎲 TaiXiu Win",value:String(player.taixiu.win)},
 {name:"🎲 TaiXiu Lose",value:String(player.taixiu.lose)},
 {name:"🐔 Pet",value:player.pet.name}
 );

 return interaction.reply({embeds:[embed]});

 }

 if(interaction.commandName === "cauca"){

 if(fishCooldown.has(id)){

  const cd = (fishCooldown.get(id)+60000-Date.now())/1000;

  if(cd>0){
   return interaction.reply({
    content:`Cooldown ${Math.ceil(cd)}s`,
    ephemeral:true
   });
  }

 }

 fishCooldown.set(id,Date.now());

 const rarity = rollFish();

 const fish = fishList
 .filter(f => f.rarity === rarity);

 const caught = fish[
 Math.floor(Math.random()*fish.length)
 ];

 player.coin += caught.coin;

 const embed = new EmbedBuilder()
 .setTitle("🎣 Câu Cá")
 .setDescription(
`${interaction.user.username} câu được **${caught.name}**
Rarity: ${rarity}

💰 +${caught.coin} Bịp Coin`
 );

 await interaction.reply({embeds:[embed]});

 if(rarity === "mythic"){

  interaction.channel.send(
`🌊 Sóng biển tuôn trào!
${interaction.user.username} vừa câu được **${caught.name}**`
  );

 }

 }

 if(interaction.commandName === "taixiu"){

 const side = interaction.options.getString("chon");
 const money = interaction.options.getInteger("tien");

 if(player.coin < money){

  return interaction.reply({
   content:"Không đủ coin",
   ephemeral:true
  });

 }

 if(taixiu.bets.tai[id] || taixiu.bets.xiu[id]){

  return interaction.reply({
   content:"Bạn đã cược round này",
   ephemeral:true
  });

 }

 player.coin -= money;

 taixiu.bets[side][id] = money;

 await updateTable();

 interaction.reply(`Đặt ${money} coin vào ${side}`);

 }

});

client.on("messageCreate", msg=>{

 if(msg.content === "!startTx"){

  runRound(msg.channel);

 }

});

client.login(TOKEN);
