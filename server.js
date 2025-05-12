const fastify = require("fastify")({ logger: false });
const path = require("path");
const fs = require("fs");
const websocketPlugin = require("fastify-websocket");
const fastifyStatic = require("fastify-static");

fastify.register(websocketPlugin);
fastify.register(fastifyStatic, {
  root: path.join(__dirname, "public"),
});

const clients = new Set();
const resultsClients = new Set();
let currentOptions = [];
let answers = [];

fastify.get("/", async (request, reply) => {
  const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  reply.type("text/html").send(html);
});

fastify.get("/admin", async (request, reply) => {
  const html = fs.readFileSync(path.join(__dirname, "admin.html"), "utf8");
  reply.type("text/html").send(html);
});

fastify.get("/results", async (request, reply) => {
  const html = fs.readFileSync(path.join(__dirname, "results.html"), "utf8");
  reply.type("text/html").send(html);
});

fastify.get("/ws", { websocket: true }, (connection, req) => {
  clients.add(connection.socket);

  connection.socket.on("message", (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === "question") {
        currentOptions = data.options || [];
        answers = []; // 前の問題の解答をリセット
        const payload = JSON.stringify({
          type: "question",
          question: data.question,
          options: data.options,
        });
        clients.forEach((client) => {
          if (client.readyState === 1) {
            client.send(payload);
          }
        });
      } else if (data.type === "answer") {
        const answerIndex = parseInt(data.answer);
        if (!isNaN(answerIndex) && answerIndex >= 0 && answerIndex < currentOptions.length) {
          answers.push(answerIndex);
        }
      }
    } catch (err) {
      console.error("❌ メッセージ解析エラー:", err);
    }
  });

  connection.socket.on("close", () => {
    clients.delete(connection.socket);
  });
});

fastify.get("/ws/results", { websocket: true }, (connection, req) => {
  resultsClients.add(connection.socket);

  connection.socket.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === "results") {
        // 集計処理
        const counts = Array(currentOptions.length).fill(0);
        answers.forEach((index) => {
          if (typeof counts[index] !== "undefined") {
            counts[index]++;
          }
        });

        const payload = JSON.stringify({
          type: "results",
          results: counts,
        });

        resultsClients.forEach((client) => {
          if (client.readyState === 1) {
            client.send(payload);
          }
        });
      }
    } catch (err) {
      console.error("❌ 結果送信エラー:", err);
    }
  });

  connection.socket.on("close", () => {
    resultsClients.delete(connection.socket);
  });
});

const PORT = process.env.PORT || 3000;
fastify.listen({ port: PORT, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`🚀 サーバーが起動しました: ${address}`);
});
