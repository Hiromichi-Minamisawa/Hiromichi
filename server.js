const path = require('path');
const fs = require('fs');
const Fastify = require('fastify');
const fastifyWebsocket = require('fastify-websocket');
const fastifyStatic = require('@fastify/static');

const fastify = Fastify();
fastify.register(fastifyWebsocket);
fastify.register(fastifyStatic, {
  root: path.join(__dirname, 'public'),
  prefix: '/',
});

let currentQuestion = null;
let correctAnswer = null;
const answers = [];

fastify.get('/question', { websocket: true }, (connection) => {
  if (currentQuestion) {
    connection.socket.send(JSON.stringify({ question: currentQuestion }));
  }
});

fastify.get('/admin', async (request, reply) => {
  return reply.sendFile('admin.html');
});

fastify.get('/results', async (request, reply) => {
  return reply.sendFile('results.html');
});

fastify.post('/send-question', async (request, reply) => {
  const body = await request.body;
  currentQuestion = body.question;
  correctAnswer = body.answer;
  answers.length = 0;
  fastify.websocketServer.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ question: currentQuestion }));
    }
  });
  reply.send({ status: 'Question sent' });
});

fastify.post('/submit-answer', async (request, reply) => {
  const body = await request.body;
  const { name, answer, time } = body;
  const isCorrect = answer === correctAnswer;
  answers.push({ name, answer, time, isCorrect });
  reply.send({ status: 'Answer received' });
});

fastify.get('/get-results', async (request, reply) => {
  return reply.send(answers);
});

fastify.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log('🚀 サーバーが起動しました');
});


