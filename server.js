const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 1e7 // File upload limit (10MB)
});

const users = {};
// Server-side permanent chat history cache array
const chatHistory = []; 
const DELETE_TIME_LIMIT = 10 * 60 * 1000; // 10 minutes in milliseconds

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Permanent Media Chat</title>
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
        
        /* Message wrapper styles with dynamic relative alignment */
        .msg-container { display: flex; flex-direction: column; width: 100%; position: relative; }
        .msg-container.me { align-items: flex-end; }
        .msg-container.other { align-items: flex-start; }
        
        .msg { max-width: 80%; padding: 10px; border-radius: 12px; font-size: 15px; word-break: break-word; position: relative; display: flex; flex-direction: column; }
        .msg.me { background: var(--accent); color: white; border-bottom-right-radius: 2px; }
        .msg.other { background: #334155; color: var(--txt); border-bottom-left-radius: 2px; }
        .msg img { max-width: 100%; max-height: 250px; border-radius: 8px; display: block; margin-top: 5px; }
        
        /* Inline Message Action Tools configuration */
        .msg-meta { font-size: 11px; margin-top: 4px; opacity: 0.7; display: flex; align-items: center; gap: 8px; }
        .del-btn { background: none; border: none; color: #f87171; cursor: pointer; font-size: 12px; padding: 0; margin: 0; width: auto; font-weight: normal; display: inline; }
        .del-btn:hover { text-decoration: underline; }
        
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
      <div id="login-screen" class="box">
        <h2>Enter Chatroom</h2>
        <form id="login-form">
          <input type="text" id="username" placeholder="Username" maxlength="15" required autocomplete="off">
          <button type="submit">Join Chat</button>
        </form>
      </div>

      <div id="chat-room" class="hidden">
        <div class="header">
          <h3>💬 Public Lounge</h3>
          <span id="counter">Online: 0</span>
        </div>
        <div id="msg-box" class="messages"></div>
        <div class="footer">
          <form id="chat-form">
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
        let myToken = ''; // Session signature to verify message deletion rights

        document.getElementById('login-form').addEventListener('submit', (e) => {
          e.preventDefault();
          myName = document.getElementById('username').value.trim();
          if(myName) {
            // Generate temporary unique token identity client signature 
            myToken = Math.random().toString(36).substring(2, 15);
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('chat-room').classList.remove('hidden');
            
            // Notify server of registration profile credentials map handshake
            socket.emit('join', { name: myName, token: myToken });
            document.getElementById('msg-input').focus();
          }
        });

        document.getElementById('chat-form').addEventListener('submit', (e) => {
          e.preventDefault();
          const textInput = document.getElementById('msg-input');
          const fileInput = document.getElementById('file-input');
          const textValue = textInput.value.trim();
          const file = fileInput.files[0];

          if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
              socket.emit('msg', { text: textValue, image: event.target.result, token: myToken });
            };
            reader.readAsDataURL(file);
            fileInput.value = '';
            document.querySelector('.file-label').textContent = '🖼️';
            document.querySelector('.file-label').style.background = '#334155';
            textInput.value = '';
          } else if (textValue) {
            socket.emit('msg', { text: textValue, image: null, token: myToken });
            textInput.value = '';
          }
        });

        document.getElementById('file-input').addEventListener('change', (e) => {
          const label = document.querySelector('.file-label');
          if (e.target.files.length > 0) {
            label.textContent = '✅';
            label.style.background = '#10b981';
          }
        });

        // Delete action pipeline request dispatch triggers
        function requestDelete(msgId) {
          socket.emit('delete-msg', { id: msgId, token: myToken });
        }

        socket.on('count', c => document.getElementById('counter').textContent = 'Online: ' + c);
        
        socket.on('sys', txt => {
          const d = document.createElement('div'); d.className = 'sys'; d.textContent = txt;
          document.getElementById('msg-box').appendChild(d); drop();
        });

        // Trigger historical backlog rendering loadout routines upon initialization 
        socket.on('chat-history', history => {
          document.getElementById('msg-box').innerHTML = ''; // Wipe and rebuild cleanly
          history.forEach(msg => renderMessage(msg));
          drop();
        });

        socket.on('srv-msg', msg => {
          renderMessage(msg);
          drop();
        });

        // Receive real-time reactive structural modification mutations
        socket.on('msg-deleted', msgId => {
          const container = document.getElementById('container-' + msgId);
          if (container) {
            container.innerHTML = '<div class="sys">This message was deleted by the sender</div>';
          }
        });

        function renderMessage(data) {
          const isMe = data.token === myToken;
          
          const container = document.createElement('div');
          container.id = 'container-' + data.id;
          container.className = 'msg-container ' + (isMe ? 'me' : 'other');
          
          const d = document.createElement('div');
          d.className = 'msg ' + (isMe ? 'me' : 'other');
          
          let namePrefix = isMe ? '' : '<b>' + data.user + ':</b> ';
          d.innerHTML = namePrefix + (data.text ? '<span>' + data.text + '</span>' : '');
          
          if (data.image) {
            const img = document.createElement('img');
            img.src = data.image;
            d.appendChild(img);
          }

          // Build dynamic metadata action bar options context block layout framework
          const meta = document.createElement('div');
          meta.className = 'msg-meta';
          meta.innerHTML = '<span>' + data.time + '</span>';

          // Inject delete button only if sender has time remaining
          const timeElapsed = Date.now() - data.timestamp;
          if (isMe && timeElapsed < 10 * 60 * 1000) {
            const delBtn = document.createElement('button');
            delBtn.className = 'del-btn';
            delBtn.textContent = '🗑️ Delete';
            delBtn.onclick = () => requestDelete(data.id);
            meta.appendChild(delBtn);

            // Automatically self-destruct delete button on structural DOM interface after timeout 
            setTimeout(() => { delBtn.remove(); }, (10 * 60 * 1000) - timeElapsed);
          }

          d.appendChild(meta);
          container.appendChild(d);
          document.getElementById('msg-box').appendChild(container);
          setTimeout(drop, 50);
        }

