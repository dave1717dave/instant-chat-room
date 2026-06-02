const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const users = {};

// Single routing endpoint serving the entire frontend layout directly
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Instant Chat</title>
      <style>
        :root { --bg: #0f172a; --card: #1e293b; --txt: #f8fafc; --accent: #6366f1; }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: sans-serif; }
        body { background: var(--bg); color: var(--txt); height: 100vh; display: flex; justify-content: center; align-items: center; }
        .hidden { display: none !important; }
        .box { background: var(--card); padding: 25px; border-radius: 12px; width: 100%; max-width: 400px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.4); }
        input, button { width: 100%; padding: 12px; margin-top: 10px; border-radius: 8px; border: none; font-size: 16px; outline: none; }
        input { background: #0f172a; color: white; border: 1px solid #334155; }
        button { background: var(--accent); color: white; cursor: pointer; font-weight: bold; }
        #chat-room { width: 100%; height: 100vh; max-width: 600px; display: flex; flex-direction: column; background: var(--card); }
        .header { padding: 15px; background: #0f172a; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #2d3748; }
        .messages { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
        .msg { max-width: 80%; padding: 10px; border-radius: 12px; font-size: 15px; word-break: break-word; }
        .msg.me { align-self: flex-end; background: var(--accent); color: white; }
        .msg.other { align-self: flex-start; background: #334155; }
        .sys { align-self: center; font-size: 12px; color: #94a3b8; background: #0f172a; padding: 4px 10px; border-radius: 10px; }
        .footer { padding: 15px; background: #0f172a; }
        .footer form { display: flex; gap: 8px; }
        .footer input { margin: 0; }
        .footer button { margin: 0; width: auto; padding: 0 20px; }
        @media(min-width: 600px) { #chat-room { height: 80vh; border-radius: 12px; } }
      </style>
    </head>
    <body>
      <!-- Login View -->
      <div id="login-screen" class="box">
        <h2>Enter Chatroom</h2>
        <form id="login-form">
          <input type="text" id="username" placeholder="Username" maxlength="15" required autocomplete="off">
          <button type="submit">Join Chat</button>
        </form>
      </div>

      <!-- Main Chat Canvas -->
      <div id="chat-room" class="hidden">
        <div class="header">
          <h3>💬 Public Lounge</h3>
          <span id="counter">Online: 0</span>
        </div>
        <div id="msg-box" class="messages"></div>
        <div class="footer">
          <form id="chat-form">
            <input type="text" id="msg-input" placeholder="Type a message..." required autocomplete="off">
            <button type="submit">Send</button>
          </form>
        </div>
      </div>

      <script src="/socket.io/socket.io.js"></script>
      <script>
        const socket = io();
        let myName = '';

        document.getElementById('login-form').addEventListener('submit', (e) => {
          e.preventDefault();
          myName = document.getElementById('username').value.trim();
          if(myName) {
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('chat-room').classList.remove('hidden');
            socket.emit('join', myName);
            document.getElementById('msg-input').focus();
          }
        });

        document.getElementById('chat-form').addEventListener('submit', (e) => {
          e.preventDefault();
          const input = document.getElementById('msg-input');
          if(input.value.trim()) {
            socket.emit('msg', input.value.trim());
            input.value = '';
          }
        });

        socket.on('count', c => document.getElementById('counter').textContent = 'Online: ' + c);
        
        socket.on('sys', txt => {
          const d = document.createElement('div'); d.className = 'sys'; d.textContent = txt;
          document.getElementById('msg-box').appendChild(d); drop();
        });

        socket.on('srv-msg', data => {
          const d = document.createElement('div');
          d.className = 'msg ' + (data.id === socket.id ? 'me' : 'other');
          d.textContent = (data.id === socket.id ? '' : data.user + ': ') + data.text;
          document.getElementById('msg-box').appendChild(d); drop();
        });

        function drop() { const b = document.getElementById('msg-box'); b.scrollTop = b.scrollHeight; }
      </script>
    </body>
    </html>
  `);
});

// Socket Connections Orchestration Engine
io.on('connection', (socket) => {
  socket.on('join', (name) => {
    users[socket.id] = name || 'Anonymous';
    io.emit('count', Object.keys(users).length);
    socket.broadcast.emit('sys', `${users[socket.id]} entered the room`);
  });

  socket.on('msg', (text) => {
    io.emit('srv-msg', { id: socket.id, user: users[socket.id] || 'Guest', text });
  });

  socket.on('disconnect', () => {
    if (users[socket.id]) {
      const left = users[socket.id];
      delete users[socket.id];
      io.emit('count', Object.keys(users).length);
      io.emit('sys', `${left} left the room`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Active on port ${PORT}`));
