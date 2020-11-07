const express = require("express");
const path = require("path");
const http = require("http");
const socketio = require("socket.io");
const Filter = require("bad-words");
const {
    generateMessage,
    generateLocationMessage,
} = require("./utils/messages");
const {
    addUser,
    removeUser,
    getUser,
    getUsersInRoom,
} = require("./utils/users");

const app = express();
const server = http.createServer(app);

/** 
socket.io requires raw http server thats why we need to create it manually
*/
const io = socketio(server);

const PORT = process.env.PORT || 3000;

const publicDirectoryPath = path.join(__dirname, "../public");
app.use(express.static(publicDirectoryPath));

io.on("connection", (socket) => {
    console.log("New Web Socket Connection");

    /** Join -> New Connection */
    socket.on("join", (options, cb) => {
        const { error, user } = addUser({ id: socket.id, ...options });

        if (error) {
            return cb(error);
        }
        socket.join(user.room);

        socket.emit("message", generateMessage('Admin', "Welcome"));
        socket.broadcast
            .to(user.room)
            .emit("message", generateMessage('Admin', `${user.username} has joined`));
        
        //Updating the room members 
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })    
        cb();
    });

    socket.on("sendMessage", (message, cb) => {
        const filter = new Filter();

        if (filter.isProfane(message)) {
            return cb("Profanity is not allowed");
        }

        const user = getUser(socket.id);

        io.to(user.room).emit("message", generateMessage(user.username, message));
        cb();
    });

    socket.on("sendLocation", (coords, cb) => {
        const user = getUser(socket.id);

        io.to(user.room).emit(
            "locationMessage",
            generateLocationMessage(
                user.username,
                `https://google.com/maps?q=${coords.latitude},${coords.longitude}`
            )
        );

        cb();
    });

    socket.on("disconnect", () => {
        const user = removeUser(socket.id);
        if (user) {
            io.to(user.room).emit(
                "message",
                generateMessage('Admin', `${user.username} has left`)
            );

            //Updating the room members
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
    });
});

server.listen(PORT, console.log(`Server is up at ${PORT}`));

/**
 * socket.emit, io.emit, socket.broadcast.emit
 * io.to.emit, socket.broadcast.to.emit
 */
