const path = require("path");
const fastify = require("fastify")();
const fastifyStatic = require("@fastify/static");
const fastifyWebsocket = require("@fastify/websocket");

const questions = [];
const answers = [];
const clients = new Set();

fastify.register(fastifyStatic, {
  root: path.join(__dirname, "public"),
  prefix: "/",
});

fastify.register(fastifyWebsocket);

// WebSocket接続処理
fastify.get("/ws", { websocket: true }, (connection, req) => {
  clients.add(connection);
  console.log("🟢 クライアント接続");

  // 接続確認メッセージ送信
  connection.send(JSON.stringify({ type: "connected", message: "接続完了" }));

  connection.on("message", (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === "answer") {
        answers.push({
          user: data.user,
          answer: data.answer,
          time: data.time,
        });
      }
    } catch (e) {
      console.error("❌ メッセージ解析エラー:", e);
    }
  });

  connection.on("close", () => {
    clients.delete(connection);
    console.log("🔌 クライアント切断");
  });
});

// 問題送信エンドポイント
fastify.post("/send-question", async (request, reply) => {
  const { question, options } = request.body;

  const payload = {
    type: "question",
    question,
    options,
  };

  console.log("📨 問題送信:", question);

  clients.forEach((client) => {
    try {
      client.send(JSON.stringify(payload));
    } catch (err) {
      console.error("送信エラー:", err);
    }
  });

  return { status: "ok" };
});

// 集計結果取得エンドポイント
fastify.get("/results", async (request, reply) => {
  const summary = {};

  answers.forEach((entry) => {
    if (!summary[entry.user]) {
      summary[entry.user] = { correct: 0, time: 0 };
    }
    summary[entry.user].correct += 1;
    summary[entry.user].time += entry.time;
  });

  const sorted = Object.entries(summary)
    .map(([user, data]) => ({ user, ...data }))
    .sort((a, b) => {
      if (b.correct !== a.correct) return b.correct - a.correct;
      return a.time - b.time;
    });

  return sorted;
});

// サーバー起動
const port = process.env.PORT || 10000;
fastify.listen({ port, host: "0.0.0.0" }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`🚀 サーバー起動: http://0.0.0.0:${port}`);
});
