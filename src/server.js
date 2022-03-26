const path = require('path');
const expess = require('express');
const app = expess();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const { validate, version } = require('uuid');

const ACTIONS = require('./socket/actions');


const PORT = process.env.PORT || 3001;

function getClientRooms() {
    const {rooms} = io.sockets.adapter;

    return Array.from(rooms.keys()).filter(roomID => validate(roomID) && version(roomID) === 4)
}

function shareRoomsInfo() {
    io.emit(ACTIONS.SHARE_ROOMS, {
        rooms: getClientRooms()
    })
}

io.on('connection', socket => {
    shareRoomsInfo();


socket.on(ACTIONS.JOIN, config => {
    const {room: roomID} = config;
    const {rooms: joinedRooms} = socket;

    if (Array.from(joinedRooms).includes(roomID)) {
        return console.warm(`Already joined ti ${roomID}`);
    }

    const clients  = Array.from(io.sockets.adapter.rooms.get(roomID) || []);

    clients.forEach(clientID => {
        io.to(clientID).emit(ACTIONS.ADD_PEER, {
            peerID: socket.id,
            createOffer: false
        });

        socket.emit(ACTIONS.ADD_PEER, {
            peerID: clientID,
            createOffer: true,
        });
    });

    socket.join(roomID);
    shareRoomsInfo()
});

    function leaveRoom() {
        const {rooms} = socket;

        Array.from(rooms)
        .forEach(roomID => {
            const clients = Array.from(io.sockets.adapter.rooms.get(roomID) || []);

            clients.forEach(clientID => {
                io.to(clientID).emit(ACTIONS.REMOVE_PEER, {
                    peerID: socket.id,
                });

                socket.emit(ACTIONS.REMOVE_PEER, {
                    peerID: clientID,
                });
            });

            socket.leave(roomID);
        });
        shareRoomsInfo();
    }

    socket.on(ACTIONS.LEAVE, leaveRoom)
    socket.on('disconnecting', leaveRoom)
});
server.listen(PORT, () => {
    console.log('server started!');
})