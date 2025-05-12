const path = require("path");
const fastify = require("fastify")({ logger: true });
const fastifyStatic = require("@fastify/static");
const websocketPlugin = require("@fastify/websocket");

fastify.register(fastifyStatic, {
  root: path.join(__dirname, "public"),
  prefix: "/",
});

fastify.register(websocketPlugin);

const clients = new Set();
const answers = [];

fastify.get("/ws", { websocket: true }, (connection) => {
  const ws = connection.socket;
  clients.add(ws);
  console.log("🟢 クライアント接続");

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === "answer") {
        answers.push({
          user: data.user,
          answer: data.answer,
          time: data.time,
        });
        console.log(`📥 回答受信: ${data.user} → ${data.answer} (${data.time}ms)`);
      }
    } catch (err) {
      console.error("❌ メッセージ解析エラー:", err);
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    console.log("🔌 クライアント切断");
  });
});

fastify.post("/send-question", async (req, reply) => {
  const { question } = req.body;
  console.log("📨 問題送信:", question);

  clients.forEach(ws => {
    try {
      ws.send(JSON.stringify({ type: "question", question }));
    } catch (e) {
      console.error("送信エラー:", e);
    }
  });

  reply.send({ status: "ok" });
});

fastify.get("/answers", async (req, reply) => {
  const summary = {};

  answers.forEach(({ user, time }) => {
    if (!summary[user]) {
      summary[user] = { correct: 0, totalTime: 0 };
    }
    summary[user].correct += 1;
    summary[user].totalTime += Number(time);
  });

  const results = Object.entries(summary)
    .map(([user, { correct, totalTime }]) => ({
      user,
      correct,
      totalTime
    }))
    .sort((a, b) => b.correct - a.correct || a.totalTime - b.totalTime);

  reply.send(results);
});

fastify.listen({ port: process.env.PORT || 3000, host: "0.0.0.0" }, err => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
});

