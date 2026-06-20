const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, lowercase: true, trim: true },
  creator: { type: String, required: true, lowercase: true, trim: true },
  members: [{ type: String, lowercase: true, trim: true }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Room', RoomSchema);
