const path = require("path");
const fastify = require("fastify")();
const websocketPlugin = require("@fastify/websocket");
const fastifyStatic = require("@fastify/static");

const answers = [];
let currentQuestion = null;
let currentOptions = [];
let correctAnswerIndex = null;
let clients = new Set();

fastify.register(websocketPlugin);

fastify.register(fastifyStatic, {
  root: path.join(__dirname, "public"),
  prefix: "/",
});

fastify.register(async function (fastify) {
  fastify.get("/ws", { websocket: true }, (connection /* WebSocket */, req) => {
    clients.add(connection);
    connection.send(JSON.stringify({ type: "connected", message: "接続完了" }));

    connection.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === "answer") {
          answers.push({
            user: data.user,
            answer: data.answer,
            time: data.time,
          });
        }
      } catch (err) {
        console.error("メッセージ処理エラー:", err);
      }
    });

    connection.on("close", () => {
      clients.delete(connection);
    });
  });
});

fastify.post("/send-question", async (req, reply) => {
  const { question, options, answer } = req.body;

  currentQuestion = question;
  currentOptions = options;
  correctAnswerIndex = answer;
  answers.length = 0; // reset

  const payload = JSON.stringify({
    type: "question",
    question,
    options,
  });

  clients.forEach((ws) => {
    try {
      ws.send(payload);
    } catch (e) {
      console.error("送信エラー:", e);
    }
  });

  reply.send({ status: "ok" });
});

fastify.get("/results", async (req, reply) => {
  const result = summarizeResults();
  reply.send(result);
});

function summarizeResults() {
  const userMap = new Map();

  for (const ans of answers) {
    if (!userMap.has(ans.user)) {
      userMap.set(ans.user, { correct: 0, totalTime: 0 });
    }

    if (ans.answer === correctAnswerIndex) {
      const startTime = answers[0]?.time || ans.time;
      const answerTime = ans.time - startTime;

      const userData = userMap.get(ans.user);
      userData.correct += 1;
      userData.totalTime += answerTime;
    }
  }

  const results = Array.from(userMap.entries()).map(([user, data]) => ({
    user,
    correct: data.correct,
    totalTime: data.totalTime,
  }));

  results.sort((a, b) => {
    if (b.correct !== a.correct) {
      return b.correct - a.correct;
    } else {
      return a.totalTime - b.totalTime;
    }
  });

  return results;
}

fastify.listen({ port: process.env.PORT || 3000, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`🚀 サーバー起動: ${address}`);
});

