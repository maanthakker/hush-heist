import mongoose from 'mongoose';
import { levelName } from '../../shared/custom.js';

// A player-made level shared in "Online levels". Names come from word lists,
// so there's no free text anywhere in a level.
const levelSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    authorName: { type: String, required: true },
    name: { type: [Number], default: [0, 0, 0] },
    theme: { type: String, default: 'jungle' },
    size: { type: String, default: 'm' },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    plays: { type: Number, default: 0 },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    likeCount: { type: Number, default: 0 },
    reports: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    hidden: { type: Boolean, default: false },
  },
  { timestamps: true },
);
levelSchema.index({ hidden: 1, createdAt: -1 });
levelSchema.index({ hidden: 1, likeCount: -1, plays: -1 });

levelSchema.methods.toCard = function toCard(meId) {
  return {
    id: String(this._id),
    name: levelName(this.name),
    nameIdx: this.name,
    authorName: this.authorName,
    theme: this.theme,
    size: this.size,
    plays: this.plays,
    likes: this.likeCount,
    liked: !!meId && this.likes.some((u) => String(u) === meId),
    mine: !!meId && String(this.author) === meId,
    updatedAt: this.updatedAt,
  };
};

export const Level = mongoose.model('Level', levelSchema);
