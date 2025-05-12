const path = require("path");
const fastify = require("fastify")();
const fastifyStatic = require("fastify-static");
const fastifyWebsocket = require("fastify-websocket");

// WebSocket対応
fastify.register(fastifyWebsocket);

// 静的ファイル配信の設定
fastify.register(fastifyStatic, {
  root: path.join(__dirname, "public"),
  prefix: "/", // ルートで公開
});

// ルーティング: index.html（解答者画面）
fastify.get("/", (req, reply) => {
  reply.sendFile("index.html");
});

// ルーティング: admin.html（管理者画面）
fastify.get("/admin", (req, reply) => {
  reply.sendFile("admin.html");
});

// ルーティング: results.html（集計画面）
fastify.get("/results", (req, reply) => {
  reply.sendFile("results.html");
});

// WebSocket セッション管理用
let clients = [];
let currentQuestion = null;
let answerCounts = [];

// WebSocket通信処理
fastify.get("/ws", { websocket: true }, (connection) => {
  clients.push(connection);

  // 質問があれば接続時に送信
  if (currentQuestion) {
    connection.socket.send(JSON.stringify({
      type: "question",
      question: currentQuestion.question,
      options: currentQuestion.options
    }));
  }

  connection.socket.on("message", (message) => {
    const data = JSON.parse(message);

    if (data.type === "answer") {
      if (typeof data.answer === "number" && answerCounts[data.answer] !== undefined) {
        answerCounts[data.answer]++;
        broadcastResults();
      }
    } else if (data.type === "question") {
      currentQuestion = {
        question: data.question,
        options: data.options,
      };
      answerCounts = new Array(data.options.length).fill(0);
      broadcastToAll({
        type: "question",
        question: currentQuestion.question,
        options: currentQuestion.options,
      });
    }
  });

  connection.socket.on("close", () => {
    clients = clients.filter((c) => c !== connection);
  });
});

function broadcastToAll(message) {
  const str = JSON.stringify(message);
  clients.forEach((client) => {
    client.socket.send(str);
  });
}

function broadcastResults() {
  const resultsMessage = {
    type: "results",
    results: answerCounts,
  };
  broadcastToAll(resultsMessage);
}

// サーバー起動
const port = process.env.PORT || 3000;
fastify.listen({ port, host: "0.0.0.0" }, (err) => {
  if (err) throw err;
  console.log(`🚀 サーバーが起動しました: http://localhost:${port}`);
});


