const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(express.static(path.join(__dirname, 'public')));

let waitingPlayer = null; 
let games = {};           

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    if (waitingPlayer) {
        const roomName = `room-${waitingPlayer.id}-${socket.id}`;
        
        socket.join(roomName);
        waitingPlayer.join(roomName);

        games[roomName] = {
            players: [waitingPlayer.id, socket.id], 
            board: Array(9).fill(null),            
            turn: waitingPlayer.id                 
        };

        io.to(waitingPlayer.id).emit('gameStart', { room: roomName, symbol: 'X', myTurn: true });
        
        io.to(socket.id).emit('gameStart', { room: roomName, symbol: 'O', myTurn: false });

        waitingPlayer = null;
    } else {
        waitingPlayer = socket;
        socket.emit('waiting', 'Περιμένω αντίπαλο για παιχνίδι...');
    }

    socket.on('makeMove', ({ room, index }) => {
        const game = games[room];
        
        if (game && game.turn === socket.id && game.board[index] === null) {
            const currentSymbol = game.players[0] === socket.id ? 'X' : 'O';
            game.board[index] = currentSymbol;
            
            game.turn = game.players.find(id => id !== socket.id);

            io.to(room).emit('moveMade', {
                board: game.board,
                turn: game.turn
            });
        }
    });

    socket.on('sendMessage', ({ room, message }) => {
        if (room && message.trim() !== "" && games[room]) {
            const senderSymbol = socket.id === games[room].players[0] ? 'X' : 'O';
            
            io.to(room).emit('receiveMessage', {
                sender: senderSymbol,
                text: message.trim()
            });
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        
        if (waitingPlayer && waitingPlayer.id === socket.id) {
            waitingPlayer = null;
        }
        
        for (const room in games) {
            if (games[room].players.includes(socket.id)) {
                socket.to(room).emit('opponentLeft');
                delete games[room];
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
