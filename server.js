const fastify = require("fastify")({ logger: true });
const path = require("path");
const fastifyStatic = require("@fastify/static");
const fastifyWebsocket = require("@fastify/websocket");

const clients = new Set();
const answers = [];

fastify.register(fastifyStatic, {
  root: path.join(__dirname, "public"),
  prefix: "/",
});

fastify.register(fastifyWebsocket);

fastify.get("/ws", { websocket: true }, (connection, req) => {
  clients.add(connection);

  console.log("🟢 クライアント接続");

  connection.socket.on("message", (message) => {
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

  connection.socket.on("close", () => {
    clients.delete(connection);
  });
});

fastify.post("/send-question", async (request, reply) => {
  const { question } = request.body;
  console.log("📨 問題送信:", question);

  try {
    clients.forEach((client) => {
      client.socket.send(JSON.stringify({ type: "question", question }));
    });
  } catch (err) {
    console.error("送信エラー:", err);
  }

  reply.send({ status: "ok" });
});

fastify.get("/answers", async (request, reply) => {
  reply.send(answers);
});

const PORT = process.env.PORT || 10000;

fastify.listen({ port: PORT, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`🚀 サーバー起動: ${address}`);
});
