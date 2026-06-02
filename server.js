const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e7 });

const users = {};
const chatHistory = [];
const TIME_LIMIT = 10 * 60 * 1000;

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  socket.emit('chat-history', chatHistory);

  socket.on('join', (data) => {
    users[socket.id] = { name: data.name || 'Anonymous', token: data.token };
    io.emit('count', Object.keys(users).length);
    socket.broadcast.emit('sys', `${users[socket.id].name} joined`);
  });

  socket.on('msg', (data) => {
    const msgObj = {
      id: Math.random().toString(36).substring(2, 11),
      user: users[socket.id]?.name || 'Guest',
      token: data.token,
      text: data.text,
      image: data.image,
      timestamp: Date.now(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    chatHistory.push(msgObj);
    io.emit('srv-msg', msgObj);
  });

  socket.on('delete-msg', (data) => {
    const index = chatHistory.findIndex(m => m.id === data.id);
    if (index !== -1) {
      const target = chatHistory[index];
      if (target.token === data.token && (Date.now() - target.timestamp) < TIME_LIMIT) {
        chatHistory.splice(index, 1);
        io.emit('msg-deleted', data.id);
      }
    }
  });

  socket.on('disconnect', () => {
    if (users[socket.id]) {
      const left = users[socket.id].name;
      delete users[socket.id];
      io.emit('count', Object.keys(users).length);
      io.emit('sys', `${left} left`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Live on ${PORT}`));
    
