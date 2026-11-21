import mongoose from 'mongoose';
import { FREE_ITEMS } from '../../shared/catalog.js';

// Accounts store only a username and a hashed password: no email, no real names.
const progressSchema = new mongoose.Schema({ stars: { type: Number, default: 0 }, bestMs: { type: Number, default: null } }, { _id: false });

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true },
    usernameLower: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    coins: { type: Number, default: 0, min: 0 },
    unlocked: { type: [String], default: () => [...FREE_ITEMS] },
    equipped: {
      outfit: { type: String, default: 'classic' },
      hair: { type: String, default: 'black' },
    },
    progress: { type: Map, of: progressSchema, default: () => new Map() },
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    friendRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    stats: {
      runs: { type: Number, default: 0 },
      wins: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

export function progressObject(progress) {
  const out = {};
  if (!progress) return out;
  const entries = progress instanceof Map ? [...progress.entries()] : Object.entries(progress);
  for (const [k, v] of entries) out[k] = { stars: v?.stars || 0, bestMs: v?.bestMs ?? null };
  return out;
}

userSchema.methods.toPublic = function toPublic() {
  return {
    id: String(this._id),
    username: this.username,
    coins: this.coins,
    unlocked: this.unlocked,
    equipped: { outfit: this.equipped?.outfit || 'classic', hair: this.equipped?.hair || 'black' },
    progress: progressObject(this.progress),
    friendsCount: this.friends.length,
    stats: { runs: this.stats?.runs || 0, wins: this.stats?.wins || 0 },
  };
};

export const User = mongoose.model('User', userSchema);
