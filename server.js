const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e7 });

const users = {};
const chatHistory = [];
const DEL_LIMIT = 10 * 60 * 1000;

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>My Family</title>
      <style>
        :root { --bg: #0f172a; --card: #1e293b; --txt: #f8fafc; --accent: #6366f1; }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: sans-serif; }
        body { background: var(--bg); color: var(--txt); height: 100vh; display: flex; justify-content: center; align-items: center; }
        .hidden { display: none !important; }
        .box { background: var(--card); padding: 25px; border-radius: 12px; width: 90%; max-width: 400px; text-align: center; }
        input, button { width: 100%; padding: 12px; margin-top: 10px; border-radius: 8px; border: none; font-size: 16px; outline: none; }
        input { background: #0f172a; color: white; border: 1px solid #334155; }
        button { background: var(--accent); color: white; cursor: pointer; font-weight: bold; }
        #chat-room { width: 100%; height: 100vh; max-width: 600px; display: flex; flex-direction: column; background: var(--card); }
        .header { padding: 15px; background: #0f172a; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #2d3748; }
        .messages { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
        .msg-wrap { display: flex; flex-direction: column; width: 100%; }
        .msg-wrap.me { align-items: flex-end; }
        .msg-wrap.other { align-items: flex-start; }
        .msg { max-width: 80%; padding: 10px; border-radius: 12px; font-size: 15px; word-break: break-word; position: relative; }
        .msg.me { background: var(--accent); color: white; border-bottom-right-radius: 2px; }
        .msg.other { background: #334155; border-bottom-left-radius: 2px; }
        .msg img { max-width: 100%; max-height: 200px; border-radius: 8px; display: block; margin-top: 5px; }
        .meta { font-size: 11px; margin-top: 4px; opacity: 0.7; display: flex; gap: 8px; }
        .btn-link { background: none; border: none; color: #f87171; cursor: pointer; font-size: 11px; padding: 0; width: auto; margin: 0; display: inline; }
        .btn-link.self-del { color: #94a3b8; }
        .sys { align-self: center; font-size: 12px; color: #94a3b8; background: #0f172a; padding: 4px 10px; border-radius: 10px; }
        .footer { padding: 15px; background: #0f172a; }
        .footer form { display: flex; gap: 8px; align-items: center; }
        .footer input { margin: 0; }
        .file-lbl { background: #334155; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 18px; }
        .footer button { margin: 0; width: auto; padding: 0 20px; height: 46px; }
        @media(min-width: 600px) { #chat-room { height: 85vh; border-radius: 12px; } }
      </style>
    </head>
    <body>
      <div id="login-screen" class="box">
        <h2>Welcome to My Family</h2>
        <form id="login-form">
          <input type="text" id="username" placeholder="Your Name" maxlength="15" required autocomplete="off">
          <button type="submit">Join Room</button>
        </form>
      </div>

      <div id="chat-room" class="hidden">
        <div class="header">
          <h3>👨‍👩‍👧‍👦 My Family</h3>
          <span id="counter">Online: 0</span>
        </div>
        <div id="msg-box" class="messages"></div>
        <div class="footer">
          <form id="chat-form">
            <input type="file" id="file-input" accept="image/*" class="hidden">
            <label for="file-input" class="file-lbl">🖼️</label>
            <input type="text" id="msg-input" placeholder="Type a message..." autocomplete="off">
            <button type="submit">Send</button>
          </form>
        </div>
      </div>

      <script src="/socket.io/socket.io.js"></script>
      <script>
        const socket = io();
        let myName = '', myToken = '', hiddenMsgs = JSON.parse(localStorage.getItem('hiddenMsgs') || '[]');

        document.getElementById('login-form').addEventListener('submit', (e) => {
          e.preventDefault();
          myName = document.getElementById('username').value.trim();
          if(myName) {
            myToken = Math.random().toString(36).substring(2, 15);
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('chat-room').classList.remove('hidden');
            socket.emit('join', { name: myName, token: myToken });
            document.getElementById('msg-input').focus();
          }
        });

        document.getElementById('chat-form').addEventListener('submit', (e) => {
          e.preventDefault();
          const txtIn = document.getElementById('msg-input');
          const fileIn = document.getElementById('file-input');
          const txtVal = txtIn.value.trim();
          
          if (fileIn.files.length > 0) {
            const r = new FileReader();
            r.onload = (ev) => socket.emit('msg', { text: txtVal, image: ev.target.result, token: myToken });
            r.readAsDataURL(fileIn.files[0]);
            fileIn.value = '';
            document.querySelector('.file-lbl').textContent = '🖼️';
            txtIn.value = '';
          } else if (txtVal) {
            socket.emit('msg', { text: txtVal, image: null, token: myToken });
            txtIn.value = '';
          }
        });

        document.getElementById('file-input').addEventListener('change', (e) => {
          if (e.target.files.length > 0) document.querySelector('.file-lbl').textContent = '✅';
        });

        function delEveryone(id) { socket.emit('del-everyone', { id, token: myToken }); }
        
        function delForSelf(id) {
          hiddenMsgs.push(id);
          localStorage.setItem('hiddenMsgs', JSON.stringify(hiddenMsgs));
          document.getElementById('wrap-' + id)?.remove();
        }

        socket.on('count', c => document.getElementById('counter').textContent = 'Online: ' + c);
        socket.on('sys', t => {
          const d = document.createElement('div'); d.className = 'sys'; d.textContent = t;
          document.getElementById('msg-box').appendChild(d); drop();
        });

        socket.on('history', h => {
          document.getElementById('msg-box').innerHTML = '';
          h.forEach(m => { if(!hiddenMsgs.includes(m.id)) render(m); });
          drop();
        });

        socket.on('srv-msg', m => { if(!hiddenMsgs.includes(m.id)) { render(m); drop(); } });
        
        socket.on('msg-deleted', id => {
          const w = document.getElementById('wrap-' + id);
          if (w) w.innerHTML = '<div class="sys">This message was deleted</div>';
        });

        function render(m) {
          const isMe = m.token === myToken;
          const w = document.createElement('div');
          w.id = 'wrap-' + m.id; w.className = 'msg-wrap ' + (isMe ? 'me' : 'other');
          
          const d = document.createElement('div'); d.className = 'msg ' + (isMe ? 'me' : 'other');
          d.innerHTML = (isMe ? '' : '<b>' + m.user + ':</b> ') + (m.text ? '<span>' + m.text + '</span>' : '');
          
          if (m.image) { const i = document.createElement('img'); i.src = m.image; d.appendChild(i); }
          
          const mt = document.createElement('div'); mt.className = 'meta';
          mt.innerHTML = '<span>' + m.time + '</span>';
          
          const sd = document.createElement('button'); sd.className = 'btn-link self-del';
          sd.textContent = 'Hide'; sd.onclick = () => delForSelf(m.id);
          mt.appendChild(sd);

          if (isMe && (Date.now() - m.timestamp) < 10 * 60 * 1000) {
            const de = document.createElement('button'); de.className = 'btn-link';
            de.textContent = 'Delete for all'; de.onclick = () => delEveryone(m.id);
            mt.appendChild(de);
            setTimeout(() => de.remove(), (10 * 60 * 1000) - (Date.now() - m.timestamp));
          }
          
          d.appendChild(mt); w.appendChild(d);
          document.getElementById('msg-box').appendChild(w);
        }
        function drop() { const b = document.getElementById('msg-box'); b.scrollTop = b.scrollHeight; }
      </script>
    </body>
    </html>
  `);
});

io.on('connection', (socket) => {
  socket.emit('history', chatHistory);

  socket.on('join', (d) => {
    users[socket.id] = { name: d.name || 'Anonymous', token: d.token };
    io.emit('count', Object.keys(users).length);
    socket.broadcast.emit('sys', `${users[socket.id].name} joined`);
  });

  socket.on('msg', (d) => {
    const m = {
      id: Math.random().toString(36).substring(2, 11),
      user: users[socket.id]?.name || 'Guest',
      token: d.token,
      text: d.text,
      image: d.image,
      timestamp: Date.now(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    chatHistory.push(m);
    io.emit('srv-msg', m);
  });

  socket.on('del-everyone', (d) => {
    const idx = chatHistory.findIndex(m => m.id === d.id);
    if (idx !== -1 && chatHistory[idx].token === d.token && (Date.now() - chatHistory[idx].timestamp) < DEL_LIMIT) {
      chatHistory.splice(idx, 1);
      io.emit('msg-deleted', d.id);
    }
  });

  socket.on('disconnect', () => {
    if (users[socket.id]) {
      const n = users[socket.id].name; delete users[socket.id];
      io.emit('count', Object.keys(users).length);
      io.emit('sys', `${n} left`);
    }
  });
});

server.listen(process.env.PORT || 3000, () => console.log('Live'));
