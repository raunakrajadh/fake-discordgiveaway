const mongoose = require('mongoose');

const GiveawaySchema = new mongoose.Schema({
  messageId: { type: String, required: true, unique: true },
  channelId: { type: String, required: true },
  description: String,
  endTime: Number,
  winnerUserId: String,
  participants: [String],
});

module.exports = mongoose.model('Giveaway', GiveawaySchema);