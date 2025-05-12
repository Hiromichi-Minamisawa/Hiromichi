const fastify = require('fastify')({ logger: true });
const path = require('path');
const fastifyStatic = require('@fastify/static');
const websocket = require('fastify-websocket');

fastify.register(fastifyStatic, {
  root: path.join(__dirname, 'public'),
  prefix: '/',
});

fastify.register(websocket);

let currentQuestion = null;
let answers = {}; // { clientId: { answer: 'A', correct: true, timestamp: 1234567890 } }
let correctAnswer = null;

fastify.get('/ws', { websocket: true }, (connection, req) => {
  const clientId = req.headers['sec-websocket-key']; // クライアント識別子として使用

  connection.socket.on('message', message => {
    try {
      const data = JSON.parse(message.toString());

      // 解答の受信
      if (data.type === 'answer' && data.answer) {
        const now = Date.now();
        const isCorrect = data.answer === correctAnswer;
        answers[clientId] = {
          answer: data.answer,
          correct: isCorrect,
          timestamp: now
        };
        console.log(`受信: ${clientId} → ${data.answer} (${isCorrect ? '正解' : '不正解'})`);
      }
    } catch (err) {
      console.error('受信エラー:', err);
    }
  });
});

// 問題を送信
fastify.post('/send-question', async (req, reply) => {
  const body = await req.body;
  const { question, answer } = body;
  currentQuestion = question;
  correctAnswer = answer;
  answers = {}; // 新しい問題に切り替わったら初期化

  // 全クライアントに問題を送信
  fastify.websocketServer.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ type: 'question', question }));
    }
  });

  return { success: true };
});

// 集計データを提供（results.html用）
fastify.get('/results', async (req, reply) => {
  const results = Object.entries(answers).map(([clientId, entry]) => ({
    clientId,
    answer: entry.answer,
    correct: entry.correct,
    timestamp: entry.timestamp
  }));
  return results;
});

fastify.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' }, err => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log('🚀 サーバーが起動しました');
});


