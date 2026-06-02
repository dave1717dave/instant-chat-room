const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 1e7 // Increases file upload limit to 10MB
});
const users = {};

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Instant Media Chat</title>
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
        .msg img { max-width: 100%; max-height: 250px; border-radius: 8px; display: block; margin-top: 5px; }
        .sys { align-self: center; font-size: 12px; color: #94a3b8; background: #0f172a; padding: 4px 10px; border-radius: 10px; }
        .footer { padding: 15px; background: #0f172a; }
        .footer form { display: flex; gap: 8px; align-items: center; }
        .footer input { margin: 0; }
        .file-label { background: #334155; color: white; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 18px; user-select: none; }
        .footer button { margin: 0; width: auto; padding: 0 20px; height: 46px; }
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
          <h3>💬 Media Lounge</h3>
          <span id="counter">Online: 0</span>
        </div>
        <div id="msg-box" class="messages"></div>
        <div class="footer">
          <form id="chat-form">
            <!-- Hidden native file input element -->
            <input type="file" id="file-input" accept="image/*" class="hidden">
            <label for="file-input" class="file-label">🖼️</label>
            
            <input type="text" id="msg-input" placeholder="Type a message..." autocomplete="off">
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

        // Form submission handles both text and loaded file payloads
        document.getElementById('chat-form').addEventListener('submit', (e) => {
          e.preventDefault();
          const textInput = document.getElementById('msg-input');
          const fileInput = document.getElementById('file-input');
          const textValue = textInput.value.trim();
          const file = fileInput.files[0];

          if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
              socket.emit('msg', { text: textValue, image: event.target.result });
            };
            reader.readAsDataURL(file);
            fileInput.value = ''; // Reset file input selector
            textInput.value = '';
          } else if (textValue) {
            socket.emit('msg', { text: textValue, image: null });
            textInput.value = '';
          }
        });

        // Visual feedback when an image file is attached/staged
        document.getElementById('file-input').addEventListener('change', (e) => {
          const label = document.querySelector('.file-label');
          if (e.target.files.length > 0) {
            label.textContent = '✅';
            label.style.background = '#10b981';
          } else {
            label.textContent = '🖼️';
            label.style.background = '#334155';
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
          
          // Construct message display string
          let namePrefix = data.id === socket.id ? '' : '<b>' + data.user + ':</b> ';
          d.innerHTML = namePrefix + (data.text ? '<span>' + data.text + '</span>' : '');
          
          // Append image markup if data chunk payload exists
          if (data.image) {
            const img = document.createElement('img');
            img.src = data.image;
            d.appendChild(img);
          }
          
          document.getElementById('msg-box').appendChild(d);
          
          // Wait briefly for the image to load visual assets into memory before scrolling
          setTimeout(drop, 100);
        });

        function drop() { const b = document.getElementById('msg-box'); b.scrollTop = b.scrollHeight; }
      </script>
    </body>
    </html>
  `);
});

io.on('connection', (socket) => {
  socket.on('join', (name) => {
    users[socket.id] = name || 'Anonymous';
    io.emit('count', Object.keys(users).length);
    socket.broadcast.emit('sys', `${users[socket.id]} entered the room`);
  });

  socket.on('msg', (data) => {
    io.emit('srv-msg', { 
      id: socket.id, 
      user: users[socket.id] || 'Guest', 
      text: data.text, 
      image: data.image 
    });
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

