const fastify = require("fastify")({
  logger: false,
});
const path = require("path");
const fs = require("fs");
const websocketPlugin = require("fastify-websocket");
const fastifyStatic = require("fastify-static");

fastify.register(websocketPlugin);
fastify.register(fastifyStatic, {
  root: path.join(__dirname, "public"),
});

const clients = new Set(); // 解答者
const resultsClients = new Set(); // 管理者（集計画面）

let currentResults = []; // 現在の問題の選択肢ごとの票数

fastify.get("/", async (request, reply) => {
  const filePath = path.join(__dirname, "index.html");
  const html = fs.readFileSync(filePath, "utf8");
  reply.type("text/html").send(html);
});

fastify.get("/admin", async (request, reply) => {
  const filePath = path.join(__dirname, "admin.html");
  const html = fs.readFileSync(filePath, "utf8");
  reply.type("text/html").send(html);
});

fastify.get("/results", async (request, reply) => {
  const filePath = path.join(__dirname, "results.html");
  const html = fs.readFileSync(filePath, "utf8");
  reply.type("text/html").send(html);
});

// 解答者用WebSocket
fastify.get("/ws", { websocket: true }, (connection, req) => {
  clients.add(connection.socket);
  connection.socket.on("message", (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === "question") {
        // 新しい問題：集計リセット
        currentResults = new Array(data.options.length).fill(0);
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
      }

      if (data.type === "answer") {
        const answerIndex = data.answer;
        if (typeof currentResults[answerIndex] === "number") {
          currentResults[answerIndex] += 1;

          // 管理者に最新結果を送信
          const resultsPayload = JSON.stringify({
            type: "results",
            results: currentResults,
          });
          resultsClients.forEach((client) => {
            if (client.readyState === 1) {
              client.send(resultsPayload);
            }
          });
        }
      }

    } catch (err) {
      console.error("❌ メッセージ解析失敗:", err);
    }
  });

  connection.socket.on("close", () => {
    clients.delete(connection.socket);
  });
});

// 管理者向け集計表示
fastify.get("/ws/results", { websocket: true }, (connection, req) => {
  resultsClients.add(connection.socket);

  // 初回接続時に現在の集計状況を送る
  const initPayload = JSON.stringify({
    type: "results",
    results: currentResults,
  });
  connection.socket.send(initPayload);

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
  console.log(`🚀 サーバー起動中: ${address}`);
});
