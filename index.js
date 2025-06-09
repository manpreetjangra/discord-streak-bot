require("dotenv").config(); // make sure you have dotenv installed!
const { Client, GatewayIntentBits, Events } = require("discord.js");
const schedule = require("node-schedule");
const fs = require("fs");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const TARGET_CHANNEL_ID = process.env.TARGET_CHANNEL_ID;
const trackedUsers = new Set(process.env.USER_IDS.split(","));
const meowedToday = new Set();
let firstMeowerId = null;

// STREAKS

const STREAK_FILE = "streaks.json";
let meowStreaks = {};

if (fs.existsSync(STREAK_FILE)) {
  meowStreaks = JSON.parse(fs.readFileSync(STREAK_FILE));
}

function saveStreaks() {
  fs.writeFileSync(STREAK_FILE, JSON.stringify(meowStreaks, null, 2));
}

const COUNTER_FILE = "leaderboard.json";
let meowCounts = {};

if (fs.existsSync(COUNTER_FILE)) {
  meowCounts = JSON.parse(fs.readFileSync(COUNTER_FILE));
}

function saveCounts() {
  fs.writeFileSync(COUNTER_FILE, JSON.stringify(meowCounts, null, 2));
}

// ON BOT READY

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on(Events.MessageCreate, async (msg) => {
  if (msg.author.bot) return;

  if (msg.content === "!streaks" && msg.channel.id === TARGET_CHANNEL_ID) {
    const streakSummary = [...trackedUsers]
      .map((id) => {
        const streak = meowStreaks[id] || 0;
        const emoji = streak === 0 ? "😿" : "🔥";
        return `- <@${id}>: ${streak} day${streak !== 1 ? "s" : ""} ${emoji}`;
      })
      .join("\n");

    msg.channel.send(`📈 Current Meow Streaks:\n${streakSummary}`);
    return;
  }

  if (msg.content === "!leaderboard" && msg.channel.id === TARGET_CHANNEL_ID) {
    const sorted = Object.entries(meowCounts)
      .sort(([, a], [, b]) => b - a) // sort descending
      .slice(0, 10); // top 10 only

    const medals = ["🥇", "🥈", "🥉"];

    const leaderboard = sorted
      .map(([id, count], i) => {
        const medal = medals[i] || `**${i + 1}.**`;
        return `${medal} <@${id}> — ${count} meow${count !== 1 ? "s" : ""}`;
      })
      .join("\n");

    msg.channel.send(`🏆 **Top Meowers Leaderboard** 🏆\n${leaderboard}`);
    return;
  }

  const saidMeow = msg.content.toLowerCase().includes("meow");
  if (!saidMeow) return;

  msg.react("🐱");

  const userId = msg.author.id;
  meowCounts[userId] = (meowCounts[userId] || 0) + 1;
  if (!firstMeowerId && msg.channel.id === TARGET_CHANNEL_ID) {
    firstMeowerId = userId;
  }
  saveCounts();

  const rewards = [
    "Here's your meow reward! 🐾",
    "Another meow? You're unstoppable 😼",
    "Meowster of the universe incoming!",
    "Cats approve this message 🐱",
  ];
  const message = rewards[Math.floor(Math.random() * rewards.length)];

  // Fetch cat image
  try {
    const res = await fetch("https://api.thecatapi.com/v1/images/search", {
      headers: {
        "x-api-key": process.env.CAT_API_KEY, // optional but recommended
      },
    });
    const data = await res.json();
    const catUrl = data[0].url;

    await msg.channel.send({
      content: msg.channel.id === TARGET_CHANNEL_ID ? message : "",
      files: [catUrl],
    });
  } catch (err) {
    console.error("Failed to fetch cat 😿", err);
    await msg.channel.send(
      "Couldn't fetch a cat right now... blame the internet 😿"
    );
  }

  // Only track streaks if in target channel
  if (msg.channel.id === TARGET_CHANNEL_ID) {
    const userId = msg.author.id;
    if (!meowedToday.has(userId)) {
      meowStreaks[userId] = (meowStreaks[userId] || 0) + 1;
      saveStreaks();
    }
    meowedToday.add(userId);
  }
});

// Reset at midnight
schedule.scheduleJob("0 0 * * *", () => {
  const channel = client.channels.cache.get(TARGET_CHANNEL_ID);

  const missing = [...trackedUsers].filter((id) => !meowedToday.has(id));

  if (missing.length != 0) {
    const mentions = missing.map((id) => `<@${id}>`).join(" ");
    channel.send(
      `🌅 New day, new meows! But yesterday these slackers didn't meow: ${mentions} 😾`
    );

    missing.forEach((id) => {
      meowStreaks[id] = 0;
    });
    saveStreaks();
  } else {
    channel.send("🎉 Purrfection achieved! Every cat has meowed today! 🐾😸");
  }

  const streakSummary = [...trackedUsers]
    .map((id) => {
      const streak = meowStreaks[id] || 0;
      const emoji = streak === 0 ? "😿" : "🔥";
      return `- <@${id}>: ${streak} day${streak !== 1 ? "s" : ""} ${emoji}`;
    })
    .join("\n");

  channel.send(`📈 Current Meow Streaks:\n${streakSummary}`);

  if (firstMeowerId) {
    channel.send(
      `🥇 **First to Meow Today:** <@${firstMeowerId}> — speedy paws! 🐾💨`
    );
  } else {
    channel.send(`😿 No one claimed *First to Meow* today... sleepy cats.`);
  }
  firstMeowerId = null;

  meowedToday.clear();
});

client.login(process.env.TOKEN);
