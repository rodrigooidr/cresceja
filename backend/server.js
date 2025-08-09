require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const pool = require('./db');

const app = express();
app.use(express.json({ type: '*/*' }));
app.use(express.urlencoded({ extended: false }));

// Routes
app.use('/api', require('./routes'));
app.use('/api/agenda', require('./routes/agenda_whatsapp'));
app.use('/api/crm', require('./routes/crm'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/conversations', require('./routes/conversations'));
app.use('/api/webhooks', require('./routes/webhooks_whatsapp'));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Socket auth with JWT
io.use((socket, next) => {
  const auth = socket.handshake.auth || {};
  const token = auth.token || (socket.handshake.headers['authorization'] || '').replace(/^Bearer\s+/i,'');
  if (!token) return next(new Error('Token ausente'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'segredo');
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error('Token inválido'));
  }
});

io.on('connection', (socket) => {
  console.log('🔌 WebSocket conectado:', socket.user?.email || socket.id);

  socket.on('join_conversation', (conversation_id) => {
    if (conversation_id) socket.join(`conv:${conversation_id}`);
  });

  socket.on('enviar_mensagem', async ({ conversation_id, texto, canal }) => {
    if (!conversation_id || !texto) return;
    try {
      const q = `INSERT INTO public.messages (
        id, conversation_id, content, sender_type, sender_id, ai_generated, media_url, media_type, created_at
      ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, now())
      RETURNING *;`;
      const params = [
        conversation_id,
        texto,
        'agent',
        socket.user?.id || null,
        false,
        null,
        null
      ];
      const { rows } = await pool.query(q, params);
      const msg = rows[0];
      io.to(`conv:${conversation_id}`).emit('nova_mensagem', msg);
    } catch (err) {
      console.error('Erro ao gravar mensagem:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('❌ WebSocket desconectado:', socket.user?.email || socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Backend rodando em http://localhost:${PORT}`);
});
