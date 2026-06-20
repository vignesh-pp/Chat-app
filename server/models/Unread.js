const mongoose = require('mongoose');

const UnreadSchema = new mongoose.Schema({
  username: { type: String, required: true },
  room: { type: String, required: true },
  count: { type: Number, default: 0 }
});

// Compound unique index for username and room
UnreadSchema.index({ username: 1, room: 1 }, { unique: true });

module.exports = mongoose.model('Unread', UnreadSchema);
