const fastify = require('fastify')({ logger: true });
const path = require('path');
const fastifyStatic = require('@fastify/static');
const websocket = require('fastify-websocket');

// 静的ファイル提供
fastify.register(fastifyStatic, {
  root: path.join(__dirname, 'public'),
  prefix: '/',
});

fastify.register(websocket);

// 状態管理変数
let currentQuestion = null;
let currentOptions = [];
let correctAnswer = null; // 正解インデックス（例：1）
let answers = {}; // { clientId: { answer: 1, correct: true, timestamp: 123456, username: '名前' } }

fastify.get('/ws', { websocket: true }, (connection, req) => {
  const clientId = req.headers['sec-websocket-key']; // クライアント識別用キー
  console.log(`🟢 クライアント接続: ${clientId}`);

  // 接続直後の確認メッセージ送信
  connection.socket.send(JSON.stringify({
    type: 'connected',
    message: '接続成功'
  }));

