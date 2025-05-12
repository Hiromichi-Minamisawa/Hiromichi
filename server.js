const path = require("path");
const fastify = require("fastify")({ logger: true });
const fastifyStatic = require("@fastify/static");
const fastifyWebsocket = require("@fastify/websocket");

const PORT = process.env.PORT || 10000;

let clients = new Set();
let answers = [];

// 静的ファイル提供
fastify.register(fastifyStatic, {
  root: path.join(__dirname, "public"),
  prefix: "/",
});

fastify.register(fastifyWebsocket);

// WebSocket エンドポイント
fastify.get("/ws", { websocket: true }, (connection /* WebSocket */, req) => {
  clients.add(connection);
  console.log("🟢 クライアント接続");

  connection.socket.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === "answer") {
        answers.push({
          user: data.user,
          answer: data.answer,
          time: data.time
        });
        console.log(`📥 回答受信: ${data.user} → ${data.answer} (${data.time}ms)`);
      }
    } catch (err) {
      console.error("❌ メッセージ解析エラー:", err);
    }
  });

  connection.socket.on("close", () => {
    clients.delete(connection);
    console.log("🔌 クライアント切断");
  });
});

// 問題送信エンドポイント
fastify.post("/send-question", async (req, reply) => {
  const { question } = req.body;
  console.log("📨 問題送信:", question);

  clients.forEach(client => {
    try {
      client.socket.send(JSON.stringify({ type: "question", question }));
    } catch (e) {
      console.error("送信エラー:", e);
    }
  });

  reply.send({ status: "ok" });
});

// 回答集計取得（管理者用）
fastify.get("/answers", async (req, reply) => {
  reply.send(answers);
});

// サーバ起動
fastify.listen({ port: PORT, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`🚀 サーバー起動: ${address}`);
});

