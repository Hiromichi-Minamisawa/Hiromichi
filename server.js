const path = require("path");
const fastify = require("fastify")();
const websocketPlugin = require("fastify-websocket");
const fastifyStatic = require("@fastify/static");

fastify.register(websocketPlugin);
fastify.register(fastifyStatic, {
  root: path.join(__dirname, "public"),
  prefix: "/",
});

let clients = new Set();
let resultsClients = new Set();
let answerCounts = [];

// WebSocketエンドポイント
fastify.get("/ws", { websocket: true }, (connection, req) => {
  clients.add(connection.socket);

  connection.socket.on("message", (message) => {
    try {
      const data = JSON.parse(message);

      // 管理者からの問題送信
      if (data.type === "question") {
        answerCounts = new Array(data.options.length).fill(0); // 回答集計の初期化

        const payload = JSON.stringify({
          type: "question",
          question: data.question,
          options: data.options,
        }

