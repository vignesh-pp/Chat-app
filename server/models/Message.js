const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  user: { type: String, required: true },
  text: { type: String, required: true },
  isImage: { type: Boolean, default: false },
  isFile: { type: Boolean, default: false },
  fileName: { type: String },
  fileType: { type: String },
  room: { type: String, required: true },
  time: { type: String, required: true },
  isEdited: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  reactions: [{
    username: { type: String, required: true },
    emoji: { type: String, required: true }
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', MessageSchema);
