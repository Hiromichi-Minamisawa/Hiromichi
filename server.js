const fastify = require('fastify')({ logger: true });
const path = require('path');
const fastifyStatic = require('@fastify/static');
const websocket = require('@fastify/websocket');

fastify.register(fastifyStatic, {
  root: path.join(__dirname, 'public'),
  prefix: '/',
});

fastify.register(websocket);

// 状態変数
let currentQuestion = null;
let currentOptions = [];
let correctAnswer = null;
let answers = {}; // { clientId: { answer, correct, timestamp, username } }

fastify.get('/ws', { websocket: true }, (connection, req) => {
  const clientId = req.headers['sec-websocket-key'];

  console.log(`🟢 クライアント接続: ${clientId}`);

  connection.socket.send(JSON.stringify({
    type: 'connected',
    message: '接続成功',
  }));

  connection.socket.on('message', message => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === 'answer' && data.answer !== undefined) {
        const now = Date.now();
        const isCorrect = Number(data.answer) === Number(correctAnswer);

        answers[clientId] = {
          answer: data.answer,
          correct: isCorrect,
          timestamp: now,
          username: data.user || '匿名'
        };

        console.log(`✅ 回答受信: ${clientId} - ${data.answer} (${isCorrect ? '正解' : '不正解'})`);
      }

      if (data.type === 'question' && data.question && Array.isArray(data.options)) {
        currentQuestion = data.question;
        currentOptions = data.options;
        correctAnswer = data.answer;
        answers = {};

        console.log('📣 問題配信:', currentQuestion);

        fastify.websocketServer.clients.forEach(client => {
          if (client.readyState === 1) {
            client.send(JSON.stringify({
              type: 'question',
              question: currentQuestion,
              options: currentOptions
            }));
          }
        });
      }
    } catch (err) {
      console.error('❌ メッセージ処理エラー:', err);
    }
  });
});

fastify.post('/send-question', async (req, reply) => {
  const body = await req.body;
  const { question, options, answer } = body;

  if (!question || !Array.isArray(options) || answer === undefined) {
    return reply.status(400).send({ error: '不正なデータ' });
  }

  currentQuestion = question;
  currentOptions = options;
  correctAnswer = Number(answer);
  answers = {};

  console.log('📨 問題送信:', question);

  fastify.websocketServer.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({
        type: 'question',
        question: currentQuestion,
        options: currentOptions
      }));
    }
  });

  return { success: true };
});

fastify.get('/results', async (req, reply) => {
  const results = Object.entries(answers).map(([clientId, data]) => ({
    clientId,
    username: data.username,
    answer: data.answer,
    correct: data.correct,
    timestamp: data.timestamp
  }));

  return results;
});

fastify.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' }, err => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log('🚀 サーバー起動完了');
});
