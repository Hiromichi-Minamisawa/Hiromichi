const fastify = require('fastify')({ logger: true });
const path = require('path');
const fastifyStatic = require('@fastify/static');
const fastifyWebsocket = require('@fastify/websocket');

const answers = []; // 全ユーザーの解答情報をここに保存
const clients = new Set(); // 接続中のクライアント WebSocket

// 静的ファイル（HTML等）を提供
fastify.register(fastifyStatic, {
  root: path.join(__dirname, 'public'),
  prefix: '/',
});

// WebSocket を登録
fastify.register(fastifyWebsocket);

// WebSocket 接続受付
fastify.get('/ws', { websocket: true }, (connection, req) => {
  clients.add(connection.socket);
  fastify.log.info('🟢 クライアント接続');

  connection.socket.on('message', (message) => {
    const data = JSON.parse(message.toString());
    if (data.type === 'answer') {
      const answerData = {
        name: data.name,
        answer: data.answer,
        correct: data.correct,
        time: data.time,
        timestamp: Date.now(),
      };
      answers.push(answerData);
      fastify.log.info(`📝 解答受信: ${data.name} - ${data.answer} (${data.correct ? '正解' : '不正解'})`);
    }
  });

  connection.socket.on('close', () => {
    clients.delete(connection.socket);
    fastify.log.info('🔴 クライアント切断');
  });
});

// 問題送信エンドポイント
fastify.post('/send-question', async (request, reply) => {
  const { question } = request.body;
  fastify.log.info(`📨 問題送信: ${question}`);

  // 各 WebSocket クライアントへ問題を送信
  clients.forEach((ws) => {
    try {
      ws.send(JSON.stringify({ type: 'question', question }));
    } catch (err) {
      fastify.log.error('送信エラー:', err);
    }
  });

  return { status: 'ok' };
});

// 解答集計データ取得（results.html用）
fastify.get('/answers', async (request, reply) => {
  return answers;
});

// サーバー起動
const start = async () => {
  try {
    await fastify.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' });
    fastify.log.info(`🚀 サーバー起動中`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
