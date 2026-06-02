require("dotenv").config();

const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

const User = require("./models/User");
const Message = require("./models/Message");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

app.set("view engine", "ejs");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err));

app.get("/", async (req, res) => {
    res.render("chat");
});

io.on("connection", async (socket) => {

    console.log("User Connected");

    const messages = await Message.find()
    .sort({ createdAt: 1 });

    socket.emit("load-messages", messages);

    socket.on("send-message", async (data) => {

        const saved = await Message.create({
            username: data.username,
            content: data.content,
            type: data.type || "text"
        });

        io.emit("receive-message", saved);
    });

    socket.on("delete-for-all", async (messageId) => {

        const message =
            await Message.findById(messageId);

        if (!message) return;

        const diff =
            (Date.now() -
             message.createdAt.getTime()) /
             1000 / 60;

        if (diff <= 10) {

            message.deletedForEveryone = true;

            await message.save();

            io.emit("message-deleted", {
                id: messageId
            });
        }
    });

    socket.on("disconnect", () => {
        console.log("Disconnected");
    });

});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Running on ${PORT}`);
});
