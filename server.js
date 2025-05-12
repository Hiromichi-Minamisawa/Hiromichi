const fastify = require("fastify")();
const path = require("path");
const fastifyStatic = require("@fastify/static");
const fastifyWebsocket = require("@fastify/websocket");

fastify.register(fastifyWebsocket);

// クライアント管理用セット
const clients = new Set();

let currentQuestion = null;
let answers = [];

// WebSocket 接続
fastify.get("/ws", { websocket: true }, (connection, req) => {
  clients.add(connection);

  connection.socket.on("message", (message) => {
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

  connection.socket.on("close", () => {
    clients.delete(connection);
  });

  // 接続確認メッセージ送信
  connection.socket.send(JSON.stringify({ type: "connected", message: "WebSocket接続OK" }));
});

// 静的ファイル（publicディレクトリを公開）
fastify.register(fastifyStatic, {
  root: path.join(__dirname, "public"),
});

// 管理者が問題を送信するルート
fastify.post("/send-question", async (request, reply) => {
  const { question, options, correctAnswer } = request.body;

  currentQuestion = {
    question,
    options,
    correctAnswer
  };

  answers = [];

  const payload = {
    type: "question",
    question,
    options
  };

  // クライアント全員に問題を送信
  clients.forEach(client => {
    if (client.socket.readyState === 1) {
      client.socket.send(JSON.stringify(payload));
    }
  });

  reply.send({ status: "sent" });
});

// 結果集計
fastify.get("/results", async (request, reply) => {
  if (!currentQuestion) {
    return reply.send({ error: "問題が送信されていません。" });
  }

  const result = {};

  for (const entry of answers) {
    const { user, answer, time } = entry;

    if (!result[user]) {
      result[user] = {
        correctCount: 0,
        totalTime: 0
      };
    }

    if (answer === currentQuestion.correctAnswer) {
      result[user].correctCount += 1;
      result[user].totalTime += time;
    }
  }

  // ソート（正解数 → 合計時間）
  const sorted = Object.entries(result).sort((a, b) => {
    if (b[1].correctCount !== a[1].correctCount) {
      return b[1].correctCount - a[1].correctCount;
    }
    return a[1].totalTime - b[1].totalTime;
  });

  reply.send({
    question: currentQuestion.question,
    correctAnswer: currentQuestion.options[currentQuestion.correctAnswer],
    answers,
    ranking: sorted
  });
});

// JSONボディのパース
fastify.addContentTypeParser('application/json', { parseAs: 'string' }, function (req, body, done) {
  try {
    const json = JSON.parse(body);
    done(null, json);
  } catch (err) {
    err.statusCode = 400;
    done(err, undefined);
  }
});

// サーバー起動
const port = process.env.PORT || 3000;
fastify.listen({ port, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`🚀 サーバー起動中: ${address}`);
});

