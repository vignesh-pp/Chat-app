const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const cors = require('cors');

const { addUser, removeUser, getUser, getUsersInRoom, getAllUsers } = require('./users');

const router = require('./router');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.use(cors());
app.use(router);

const rooms = ['general', 'random', 'tech'];
const messagesByRoom = {};

const getPrivateRoomId = (userA, userB) => {
  const sorted = [userA.trim().toLowerCase(), userB.trim().toLowerCase()].sort();
  return `private_${sorted[0]}_${sorted[1]}`;
};

io.on('connect', (socket) => {
  socket.on('join', ({ name, room }, callback) => {
    // If no room is specified, join 'general'
    const targetRoom = (room || 'general').trim().toLowerCase();
    const { error, user } = addUser({ id: socket.id, name, room: targetRoom });

    if(error) return callback(error);

    socket.join(user.room);

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    socket.emit('message', { user: 'admin', text: `${user.name}, welcome to room ${user.room}.`, room: user.room, time });
    socket.broadcast.to(user.room).emit('message', { user: 'admin', text: `${user.name} has joined!`, room: user.room, time });

    io.to(user.room).emit('roomData', { room: user.room, users: getUsersInRoom(user.room) });
    
    // Broadcast updated directories
    io.emit('allUsers', { users: getAllUsers() });
    socket.emit('allRooms', { rooms });

    const myNameLower = user.name.trim().toLowerCase();
    const userPrivateRooms = Object.keys(messagesByRoom).filter(rk => {
      if (rk.startsWith('private_')) {
        const parts = rk.replace('private_', '').split('_');
        return parts.includes(myNameLower);
      }
      return false;
    });

    const initMessages = {};
    initMessages['general'] = messagesByRoom['general'] || [];
    rooms.forEach(r => {
      initMessages[r] = messagesByRoom[r] || [];
    });
    userPrivateRooms.forEach(rk => {
      initMessages[rk] = messagesByRoom[rk] || [];
    });

    socket.emit('initMessages', initMessages);

    callback();
  });

  socket.on('switchRoom', ({ newRoom }, callback) => {
    const user = getUser(socket.id);
    if (!user) return callback({ error: 'User not found' });

    const oldRoom = user.room;
    socket.leave(oldRoom);
    socket.join(newRoom);
    user.room = newRoom;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Notify old room
    socket.broadcast.to(oldRoom).emit('message', { user: 'admin', text: `${user.name} has left.`, room: oldRoom, time });
    io.to(oldRoom).emit('roomData', { room: oldRoom, users: getUsersInRoom(oldRoom) });

    // Notify new room
    socket.emit('message', { user: 'admin', text: `Welcome to ${newRoom}, ${user.name}.`, room: newRoom, time });
    socket.broadcast.to(newRoom).emit('message', { user: 'admin', text: `${user.name} has joined!`, room: newRoom, time });
    io.to(newRoom).emit('roomData', { room: newRoom, users: getUsersInRoom(newRoom) });

    callback();
  });

  socket.on('createRoom', ({ roomName }, callback) => {
    const formattedRoom = roomName.trim().toLowerCase();
    if (formattedRoom && !rooms.includes(formattedRoom)) {
      rooms.push(formattedRoom);
      io.emit('allRooms', { rooms });
    }
    callback();
  });

  socket.on('sendMessage', (messageData, callback) => {
    const user = getUser(socket.id);
    if (!user) return callback({ error: 'User not found' });
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // If it's a structured object message
    if (typeof messageData === 'object' && messageData.type === 'dm') {
      const recipientName = messageData.recipient.trim().toLowerCase();
      const recipientUser = getAllUsers().find(u => u.name === recipientName);
      const roomKey = getPrivateRoomId(user.name, recipientName);

      const payload = {
        id: messageData.id,
        user: user.name,
        text: messageData.text,
        isImage: messageData.isImage,
        room: roomKey,
        time
      };

      // Save to server history
      if (!messagesByRoom[roomKey]) messagesByRoom[roomKey] = [];
      messagesByRoom[roomKey].push(payload);

      // Send to sender
      socket.emit('message', payload);

      // Send to recipient
      if (recipientUser) {
        io.to(recipientUser.id).emit('message', payload);
      }
    } else {
      const textVal = typeof messageData === 'object' ? messageData.text : messageData;
      const isImageVal = typeof messageData === 'object' ? messageData.isImage : false;
      const idVal = typeof messageData === 'object' ? messageData.id : (Date.now() + Math.random().toString(36).substr(2, 9));

      const payload = {
        id: idVal,
        user: user.name,
        text: textVal,
        isImage: isImageVal,
        room: user.room,
        time
      };

      // Save to server history
      if (!messagesByRoom[user.room]) messagesByRoom[user.room] = [];
      messagesByRoom[user.room].push(payload);

      io.to(user.room).emit('message', payload);
    }

    callback();
  });

  socket.on('editMessage', ({ messageId, newText, recipient, type, room }, callback) => {
    const user = getUser(socket.id);
    if (!user) return callback({ error: 'User not found' });

    const payload = { messageId, newText };
    let roomKey;

    if (type === 'dm' && recipient) {
      const recipientName = recipient.trim().toLowerCase();
      const recipientUser = getAllUsers().find(u => u.name === recipientName);
      roomKey = getPrivateRoomId(user.name, recipientName);

      payload.room = roomKey;

      socket.emit('editMessage', payload);
      if (recipientUser) {
        io.to(recipientUser.id).emit('editMessage', payload);
      }
    } else {
      const targetRoom = room || user.room;
      roomKey = targetRoom;
      payload.room = targetRoom;
      io.to(targetRoom).emit('editMessage', payload);
    }

    // Save edit in server history
    if (roomKey && messagesByRoom[roomKey]) {
      const msg = messagesByRoom[roomKey].find(m => m.id === messageId);
      if (msg) {
        msg.text = newText;
        msg.isEdited = true;
      }
    }

    callback();
  });

  socket.on('deleteMessage', ({ messageId, recipient, type, room }, callback) => {
    const user = getUser(socket.id);
    if (!user) return callback({ error: 'User not found' });

    const payload = { messageId };
    let roomKey;

    if (type === 'dm' && recipient) {
      const recipientName = recipient.trim().toLowerCase();
      const recipientUser = getAllUsers().find(u => u.name === recipientName);
      roomKey = getPrivateRoomId(user.name, recipientName);

      payload.room = roomKey;

      socket.emit('deleteMessage', payload);
      if (recipientUser) {
        io.to(recipientUser.id).emit('deleteMessage', payload);
      }
    } else {
      const targetRoom = room || user.room;
      roomKey = targetRoom;
      payload.room = targetRoom;
      io.to(targetRoom).emit('deleteMessage', payload);
    }

    // Save delete in server history
    if (roomKey && messagesByRoom[roomKey]) {
      const msg = messagesByRoom[roomKey].find(m => m.id === messageId);
      if (msg) {
        msg.text = 'This message was deleted';
        msg.isDeleted = true;
      }
    }

    callback();
  });

  socket.on('typing', ({ recipient, type }) => {
    const user = getUser(socket.id);
    if (!user) return;

    if (type === 'dm' && recipient) {
      const recipientName = recipient.trim().toLowerCase();
      const recipientUser = getAllUsers().find(u => u.name === recipientName);
      if (recipientUser) {
        const roomKey = getPrivateRoomId(user.name, recipientName);
        io.to(recipientUser.id).emit('typing', { user: user.name, room: roomKey });
      }
    } else {
      socket.broadcast.to(user.room).emit('typing', { user: user.name, room: user.room });
    }
  });

  socket.on('stopTyping', ({ recipient, type }) => {
    const user = getUser(socket.id);
    if (!user) return;

    if (type === 'dm' && recipient) {
      const recipientName = recipient.trim().toLowerCase();
      const recipientUser = getAllUsers().find(u => u.name === recipientName);
      if (recipientUser) {
        const roomKey = getPrivateRoomId(user.name, recipientName);
        io.to(recipientUser.id).emit('stopTyping', { room: roomKey });
      }
    } else {
      socket.broadcast.to(user.room).emit('stopTyping', { room: user.room });
    }
  });

  socket.on('disconnect', () => {
    const user = removeUser(socket.id);
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if(user) {
      io.to(user.room).emit('message', { user: 'admin', text: `${user.name} has left.`, room: user.room, time });
      io.to(user.room).emit('roomData', { room: user.room, users: getUsersInRoom(user.room)});
      io.emit('allUsers', { users: getAllUsers() });
    }
  })
});

server.listen(process.env.PORT || 5000, () => console.log(`Server has started.`));