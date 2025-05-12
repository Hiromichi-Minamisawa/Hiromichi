const fastify = require("fastify")();
const path = require("path");
const fastifyStatic = require("@fastify/static");
const fastifyWebsocket = require("@fastify/websocket");

fastify.register(fastifyStatic, {
  root: path.join(__dirname, "public"),
});

fastify.register(fastifyWebsocket);

const clients = new Set();
const answers = [];

// WebSocket接続
fastify.get("/ws", { websocket: true }, (connection, req) => {
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
          time: data.time
        });
      }
    } catch (e) {
      console.error("❌ メッセージ解析エラー:", e);
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    console.log("⚠️ クライアント切断");
  });
});

// クイズ送信
fastify.post("/send-question", async (req, reply) => {
  const { question } = req.body;
  console.log("📨 問題送信:", question);

  clients.forEach((ws) => {
    if (ws.readyState === 1) {
      try {
        ws.send(JSON.stringify({ type: "question", question }));
      } catch (err) {
        console.error("送信エラー:", err);
      }
    }
  });

  reply.send({ status: "ok" });
});

// 解答一覧取得
fastify.get("/answers", async (req, reply) => {
  reply.send(answers);
});

// サーバー起動
const start = async () => {
  try {
    await fastify.listen({ port: process.env.PORT || 10000, host: "0.0.0.0" });
    console.log(`🚀 サーバー起動: http://0.0.0.0:${fastify.server.address().port}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();

