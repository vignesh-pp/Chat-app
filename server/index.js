const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const User = require('./models/User');
const Message = require('./models/Message');
const Unread = require('./models/Unread');

const rooms = ['general', 'random', 'tech'];

// Load config.json
let config = { isLocal: true, mongoURI: 'mongodb://localhost:27017/aetherchat' };
try {
  const configPath = path.join(__dirname, 'config.json');
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } else {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  }
} catch (err) {
  console.error('Failed to load config.json, using defaults.', err);
}

// Connect to MongoDB if not local mode
if (!config.isLocal) {
  mongoose.connect(config.mongoURI)
    .then(async () => {
      console.log('MongoDB connected successfully.');
      try {
        const dbRooms = await Message.distinct('room', { room: { $not: /^private_/ } });
        dbRooms.forEach(r => {
          if (r && !rooms.includes(r)) {
            rooms.push(r);
          }
        });
        console.log('Loaded rooms from DB:', rooms);
      } catch (err) {
        console.error('Error fetching distinct rooms from DB:', err);
      }
    })
    .catch(err => console.error('MongoDB connection error:', err));
}

const nodemailer = require('nodemailer');

const { addUser, removeUser, getUser, getUsersInRoom, getAllUsers } = require('./users');

const router = require('./router');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.use(cors());
app.use(express.json());
app.use(router);

const messagesByRoom = {};

const getPrivateRoomId = (userA, userB) => {
  const sorted = [userA.trim().toLowerCase(), userB.trim().toLowerCase()].sort();
  return `private_${sorted[0]}_${sorted[1]}`;
};

io.on('connect', (socket) => {
  socket.on('join', async ({ name, room }, callback) => {
    // If no room is specified, join 'general'
    const targetRoom = (room || 'general').trim().toLowerCase();
    const { error, user } = addUser({ id: socket.id, name, room: targetRoom });

    if (error) return callback(error);

    const myNameLower = user.name.trim().toLowerCase();

    // Join user's active room
    socket.join(user.room);

    // Join all public rooms to get real-time messages/edits/deletions and unread notifications
    rooms.forEach(r => {
      socket.join(r);
    });

    // Also join any private rooms they belong to
    if (!config.isLocal) {
      try {
        const dmRooms = await Message.distinct('room', {
          room: { $regex: new RegExp(`^private_.*${myNameLower}.*`, 'i') }
        });
        dmRooms.forEach(dmRoom => {
          socket.join(dmRoom);
        });
      } catch (err) {
        console.error('Error fetching/joining DM rooms on startup:', err);
      }
    } else {
      const userPrivateRooms = Object.keys(messagesByRoom).filter(rk => {
        if (rk.startsWith('private_')) {
          const parts = rk.replace('private_', '').split('_');
          return parts.includes(myNameLower);
        }
        return false;
      });
      userPrivateRooms.forEach(rk => {
        socket.join(rk);
      });
    }

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (user.room && !user.room.startsWith('private_')) {
      socket.emit('message', { user: 'admin', text: `${user.name}, welcome to room ${user.room}.`, room: user.room, time });
      socket.broadcast.to(user.room).emit('message', { user: 'admin', text: `${user.name} has joined!`, room: user.room, time });
    }

    io.to(user.room).emit('roomData', { room: user.room, users: getUsersInRoom(user.room) });

    // Broadcast updated directories
    io.emit('allUsers', { users: getAllUsers() });
    socket.emit('allRooms', { rooms });

    if (!config.isLocal) {
      try {
        const dbMessages = await Message.find({
          $or: [
            { room: { $in: rooms } },
            { room: { $regex: new RegExp(`^private_.*${myNameLower}.*`, 'i') } }
          ]
        }).sort({ createdAt: 1 }).lean();

        const initMessages = {};
        rooms.forEach(r => {
          initMessages[r] = [];
        });

        dbMessages.forEach(msg => {
          const formattedMsg = {
            id: msg.id,
            user: msg.user,
            text: msg.text,
            isImage: msg.isImage,
            isFile: msg.isFile,
            fileName: msg.fileName,
            fileType: msg.fileType,
            room: msg.room,
            time: msg.time,
            isEdited: msg.isEdited,
            isDeleted: msg.isDeleted,
            reactions: msg.reactions || []
          };
          if (!initMessages[msg.room]) {
            initMessages[msg.room] = [];
          }
          initMessages[msg.room].push(formattedMsg);
        });

        socket.emit('initMessages', initMessages);

        const unreads = await Unread.find({ username: myNameLower });
        const initUnread = {};
        unreads.forEach(u => {
          initUnread[u.room] = u.count;
        });
        socket.emit('initUnread', initUnread);
      } catch (err) {
        console.error('Error fetching chat history / unread counts from DB:', err);
      }
    } else {
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
    }

    callback();
  });

  socket.on('switchRoom', ({ newRoom }, callback) => {
    const user = getUser(socket.id);
    if (!user) return callback({ error: 'User not found' });

    const oldRoom = user.room;
    // Note: Do not call socket.leave(oldRoom) so the client remains joined to all rooms 
    // to receive real-time notifications, messages, edits, and deletions.
    socket.join(newRoom);
    user.room = newRoom;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Notify old room
    if (oldRoom && !oldRoom.startsWith('private_')) {
      socket.broadcast.to(oldRoom).emit('message', { user: 'admin', text: `${user.name} has left.`, room: oldRoom, time });
    }
    io.to(oldRoom).emit('roomData', { room: oldRoom, users: getUsersInRoom(oldRoom) });

    // Notify new room
    if (newRoom && !newRoom.startsWith('private_')) {
      socket.emit('message', { user: 'admin', text: `Welcome to ${newRoom}, ${user.name}.`, room: newRoom, time });
      socket.broadcast.to(newRoom).emit('message', { user: 'admin', text: `${user.name} has joined!`, room: newRoom, time });
    }
    io.to(newRoom).emit('roomData', { room: newRoom, users: getUsersInRoom(newRoom) });

    if (!config.isLocal) {
      const myNameLower = user.name.trim().toLowerCase();
      Unread.findOneAndUpdate(
        { username: myNameLower, room: newRoom },
        { count: 0 },
        { upsert: true }
      ).catch(err => console.error('Error clearing unread count in DB:', err));
    }

    callback();
  });

  socket.on('createRoom', ({ roomName }, callback) => {
    const formattedRoom = roomName.trim().toLowerCase();
    if (formattedRoom && !rooms.includes(formattedRoom)) {
      rooms.push(formattedRoom);
      io.emit('allRooms', { rooms });

      // Make all currently connected sockets join the new room in real-time
      const connectedSockets = io.sockets.sockets;
      if (connectedSockets) {
        Object.keys(connectedSockets).forEach(id => {
          connectedSockets[id].join(formattedRoom);
        });
      }
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
        isFile: messageData.isFile || false,
        fileName: messageData.fileName || null,
        fileType: messageData.fileType || null,
        room: roomKey,
        time,
        reactions: []
      };

      // Save to server history
      if (!messagesByRoom[roomKey]) messagesByRoom[roomKey] = [];
      messagesByRoom[roomKey].push(payload);

      // Make both sender and recipient sockets join the DM room
      socket.join(roomKey);
      if (recipientUser) {
        const recipientSocket = io.sockets.sockets[recipientUser.id];
        if (recipientSocket) {
          recipientSocket.join(roomKey);
        }
      }

      // Send to sender
      socket.emit('message', payload);

      // Send to recipient
      if (recipientUser) {
        io.to(recipientUser.id).emit('message', payload);
      }

      if (!config.isLocal) {
        const dbMsg = new Message({
          id: payload.id,
          user: payload.user,
          text: payload.text,
          isImage: payload.isImage,
          isFile: payload.isFile,
          fileName: payload.fileName,
          fileType: payload.fileType,
          room: payload.room,
          time: payload.time
        });
        dbMsg.save().catch(err => console.error('Error saving DM message to DB:', err));

        // Increment unread count for recipient in DB if they are not active in this private room
        const recipientActiveInRoom = getUsersInRoom(roomKey).some(u => u.name === recipientName);
        if (!recipientActiveInRoom) {
          Unread.findOneAndUpdate(
            { username: recipientName, room: roomKey },
            { $inc: { count: 1 } },
            { upsert: true }
          ).catch(err => console.error('Error incrementing unread in DB:', err));
        }
      }
    } else {
      const textVal = typeof messageData === 'object' ? messageData.text : messageData;
      const isImageVal = typeof messageData === 'object' ? messageData.isImage : false;
      const isFileVal = typeof messageData === 'object' ? messageData.isFile : false;
      const fileNameVal = typeof messageData === 'object' ? messageData.fileName : null;
      const fileTypeVal = typeof messageData === 'object' ? messageData.fileType : null;
      const idVal = typeof messageData === 'object' ? messageData.id : (Date.now() + Math.random().toString(36).substr(2, 9));

      const payload = {
        id: idVal,
        user: user.name,
        text: textVal,
        isImage: isImageVal,
        isFile: isFileVal,
        fileName: fileNameVal,
        fileType: fileTypeVal,
        room: user.room,
        time,
        reactions: []
      };

      // Save to server history
      if (!messagesByRoom[user.room]) messagesByRoom[user.room] = [];
      messagesByRoom[user.room].push(payload);

      io.to(user.room).emit('message', payload);

      if (!config.isLocal) {
        const dbMsg = new Message({
          id: payload.id,
          user: payload.user,
          text: payload.text,
          isImage: payload.isImage,
          isFile: payload.isFile,
          fileName: payload.fileName,
          fileType: payload.fileType,
          room: payload.room,
          time: payload.time
        });
        dbMsg.save().catch(err => console.error('Error saving message to DB:', err));

        // Increment unread count for other users in this room
        User.find({}, 'username').then(dbUsers => {
          const activeUsersInRoom = getUsersInRoom(user.room).map(u => u.name.trim().toLowerCase());
          const targetUsers = dbUsers
            .map(u => u.username.trim().toLowerCase())
            .filter(username => username !== user.name.trim().toLowerCase() && !activeUsersInRoom.includes(username));

          if (targetUsers.length > 0) {
            Promise.all(targetUsers.map(uName =>
              Unread.findOneAndUpdate(
                { username: uName, room: user.room },
                { $inc: { count: 1 } },
                { upsert: true }
              )
            )).catch(err => console.error('Error updating unreads in DB:', err));
          }
        }).catch(err => console.error('Error querying users for unreads:', err));
      }
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

    if (!config.isLocal) {
      Message.findOneAndUpdate(
        { id: messageId },
        { text: newText, isEdited: true }
      ).catch(err => console.error('Error editing message in DB:', err));
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

    if (!config.isLocal) {
      Message.findOneAndUpdate(
        { id: messageId },
        { text: 'This message was deleted', isDeleted: true }
      ).catch(err => console.error('Error deleting message in DB:', err));
    }

    callback();
  });

  socket.on('reactMessage', ({ messageId, emoji, recipient, type, room }, callback) => {
    const user = getUser(socket.id);
    if (!user) return callback ? callback({ error: 'User not found' }) : null;

    const username = user.name;
    let roomKey;

    if (type === 'dm' && recipient) {
      const recipientName = recipient.trim().toLowerCase();
      roomKey = getPrivateRoomId(user.name, recipientName);
    } else {
      roomKey = room || user.room;
    }

    const toggleReactionArray = (reactionsArray) => {
      const existingIdx = reactionsArray.findIndex(r => r.username.toLowerCase() === username.toLowerCase() && r.emoji === emoji);
      if (existingIdx > -1) {
        reactionsArray.splice(existingIdx, 1);
      } else {
        reactionsArray.push({ username, emoji });
      }
      return reactionsArray;
    };

    let updatedReactions = [];

    if (roomKey && messagesByRoom[roomKey]) {
      const msg = messagesByRoom[roomKey].find(m => m.id === messageId);
      if (msg) {
        if (!msg.reactions) {
          msg.reactions = [];
        }
        updatedReactions = toggleReactionArray(msg.reactions);
      }
    }

    if (!config.isLocal) {
      Message.findOne({ id: messageId }).then(msg => {
        if (msg) {
          if (!msg.reactions) {
            msg.reactions = [];
          }
          const dbReactions = toggleReactionArray(msg.reactions);
          msg.reactions = dbReactions;
          msg.save()
            .then(savedMsg => {
              broadcastReactions(savedMsg.reactions);
            })
            .catch(err => console.error('Error saving reaction in DB:', err));
        }
      }).catch(err => console.error('Error finding message for reaction in DB:', err));
    } else {
      broadcastReactions(updatedReactions);
    }

    function broadcastReactions(reactions) {
      const payload = { messageId, reactions, room: roomKey };
      if (type === 'dm' && recipient) {
        const recipientName = recipient.trim().toLowerCase();
        const recipientUser = getAllUsers().find(u => u.name === recipientName);
        socket.emit('messageReacted', payload);
        if (recipientUser) {
          io.to(recipientUser.id).emit('messageReacted', payload);
        }
      } else {
        io.to(roomKey).emit('messageReacted', payload);
      }
    }

    if (callback) callback();
  });

  socket.on('deleteChat', async ({ id, type }, callback) => {
    const user = getUser(socket.id);
    if (!user) return callback({ error: 'User not found' });

    let roomKey;
    if (type === 'dm') {
      roomKey = getPrivateRoomId(user.name, id);
    } else {
      roomKey = id.trim().toLowerCase();
    }

    // 1. Clear local memory cache if present
    if (messagesByRoom[roomKey]) {
      messagesByRoom[roomKey] = [];
    }

    // 2. Clear MongoDB if not local mode
    if (!config.isLocal) {
      try {
        await Message.deleteMany({ room: roomKey });
        // Reset unread count for this room/chat for all users in DB
        await Unread.updateMany({ room: roomKey }, { count: 0 });
      } catch (err) {
        console.error('Error deleting chat from DB:', err);
        return callback({ error: 'Failed to delete chat history from DB.' });
      }
    }

    // 3. Broadcast chatDeleted event to everyone in that room
    io.to(roomKey).emit('chatDeleted', { room: roomKey });

    callback({ success: true });
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

  socket.on('callUser', ({ userToCall, signalData, from, type }) => {
    const recipientUser = getAllUsers().find(u => u.name === userToCall.trim().toLowerCase());
    if (recipientUser) {
      io.to(recipientUser.id).emit('callUser', { signal: signalData, from, type });
    }
  });

  socket.on('answerCall', ({ to, signal }) => {
    const callerUser = getAllUsers().find(u => u.name === to.trim().toLowerCase());
    if (callerUser) {
      io.to(callerUser.id).emit('callAccepted', { signal });
    }
  });

  socket.on('iceCandidate', ({ to, candidate }) => {
    const targetUser = getAllUsers().find(u => u.name === to.trim().toLowerCase());
    if (targetUser) {
      io.to(targetUser.id).emit('iceCandidate', { candidate });
    }
  });

  socket.on('declineCall', ({ to }) => {
    const callerUser = getAllUsers().find(u => u.name === to.trim().toLowerCase());
    if (callerUser) {
      io.to(callerUser.id).emit('callDeclined');
    }
  });

  socket.on('endCall', ({ to }) => {
    const partnerUser = getAllUsers().find(u => u.name === to.trim().toLowerCase());
    if (partnerUser) {
      io.to(partnerUser.id).emit('endCall');
    }
  });

  socket.on('disconnect', () => {
    const user = removeUser(socket.id);
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (user) {
      if (user.room && !user.room.startsWith('private_')) {
        io.to(user.room).emit('message', { user: 'admin', text: `${user.name} has left.`, room: user.room, time });
      }
      io.to(user.room).emit('roomData', { room: user.room, users: getUsersInRoom(user.room) });
      io.emit('allUsers', { users: getAllUsers() });
    }
  })
});

const otps = {};
let transporter;

const getTransporter = async () => {
  if (transporter) return transporter;

  try {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    console.log('Ethereal SMTP transport created successfully.');
  } catch (err) {
    console.error('Failed to create Ethereal SMTP account, using mock transport.', err);
    transporter = {
      sendMail: async (mailOptions) => {
        console.log(`[MOCK EMAIL] To: ${mailOptions.to}, Subject: ${mailOptions.subject}`);
        console.log(`[MOCK EMAIL] Body:\n${mailOptions.text}`);
        return { messageId: 'mock-id' };
      }
    };
  }
  return transporter;
};

app.post('/api/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  const formattedEmail = email.trim().toLowerCase();
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  otps[formattedEmail] = {
    otp,
    expires: Date.now() + 5 * 60 * 1000
  };

  try {
    const tx = await getTransporter();
    const info = await tx.sendMail({
      from: '"AetherChat Verification" <verify@aetherchat.com>',
      to: formattedEmail,
      subject: 'AetherChat Registration OTP',
      text: `Your verification OTP is: ${otp}. It is valid for 5 minutes.`,
      html: `<div style="font-family: Arial, sans-serif; padding: 20px; border-radius: 12px; background-color: #f8fafc; border: 1px solid #e2e8f0; max-width: 500px;">
        <h2 style="color: #6366f1; margin-top: 0;">AetherChat Verification Code</h2>
        <p style="color: #334155; font-size: 1rem;">Thank you for registering. Please use the following One-Time Password (OTP) to complete your signup process:</p>
        <div style="font-size: 2rem; font-weight: 700; color: #1e1b4b; background-color: #e0e7ff; padding: 12px 24px; border-radius: 8px; text-align: center; margin: 20px 0; letter-spacing: 4px;">
          ${otp}
        </div>
        <p style="color: #64748b; font-size: 0.85rem; margin-bottom: 0;">This OTP will expire in 5 minutes. If you did not request this code, please ignore this email.</p>
      </div>`
    });

    console.log(`[OTP SENT] Email: ${formattedEmail}, OTP: ${otp}`);

    let previewUrl = '';
    if (typeof nodemailer.getTestMessageUrl === 'function') {
      previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log(`[Ethereal Preview URL] ${previewUrl}`);
      }
    }

    res.json({ success: true, previewUrl });
  } catch (err) {
    console.error('Error sending OTP email:', err);
    res.status(500).json({ error: 'Failed to send verification email. Please check the server console.' });
  }
});

app.post('/api/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required.' });

  const formattedEmail = email.trim().toLowerCase();
  const record = otps[formattedEmail];

  if (!record) {
    return res.status(400).json({ error: 'No OTP requested for this email.' });
  }

  if (Date.now() > record.expires) {
    delete otps[formattedEmail];
    return res.status(400).json({ error: 'OTP has expired.' });
  }

  if (record.otp !== otp.trim()) {
    return res.status(400).json({ error: 'Invalid verification code.' });
  }

  delete otps[formattedEmail];
  res.json({ success: true });
});

app.get('/api/config', (req, res) => {
  res.json({ isLocal: config.isLocal });
});

app.post('/api/check-username', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username is required.' });
  const formattedUsername = username.trim().toLowerCase();

  if (config.isLocal) {
    return res.json({ success: true, available: true });
  } else {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database is not connected. Please make sure MongoDB is running.' });
    }
    try {
      const user = await User.findOne({ username: formattedUsername });
      if (user) {
        return res.json({ success: true, available: false });
      }
      return res.json({ success: true, available: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database check failed.' });
    }
  }
});

app.post('/api/signup', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required.' });
  }
  const formattedUsername = username.trim().toLowerCase();
  const formattedEmail = email.trim().toLowerCase();

  if (config.isLocal) {
    return res.status(400).json({ error: 'DB operations are disabled in local mode.' });
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database is not connected. Please make sure MongoDB is running.' });
  }

  try {
    const existingUser = await User.findOne({ username: formattedUsername });
    if (existingUser) {
      return res.status(400).json({ error: 'Username is already taken.' });
    }
    const newUser = new User({ username: formattedUsername, email: formattedEmail, password });
    await newUser.save();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create user account.' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  const formattedUsername = username.trim().toLowerCase();

  if (config.isLocal) {
    return res.status(400).json({ error: 'DB operations are disabled in local mode.' });
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database is not connected. Please make sure MongoDB is running.' });
  }

  try {
    const user = await User.findOne({ username: formattedUsername, password });
    if (!user) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }
    res.json({ success: true, username: user.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login authentication failed.' });
  }
});

server.listen(process.env.PORT || 5000, () => console.log(`Server has started.`));