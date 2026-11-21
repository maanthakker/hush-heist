import mongoose from 'mongoose';

// One finished round (solo or party).
const runSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    mode: { type: String, enum: ['heist', 'race', 'hideseek'], default: 'heist' },
    level: { type: String, required: true, enum: ['jungle-room', 'kitchen', 'garage', 'attic', 'custom'] },
    result: { type: String, required: true, enum: ['escaped', 'caught', 'finished', 'guard', 'hiders'] },
    won: { type: Boolean, default: false },
    snacks: { type: Number, required: true, min: 0, max: 50 },
    totalSnacks: { type: Number, required: true, min: 0, max: 50 },
    timeMs: { type: Number, required: true, min: 0, max: 60 * 60 * 1000 },
    stars: { type: Number, default: 0, min: 0, max: 3 },
    peakWake: { type: Number, default: 0, min: 0, max: 100 },
    party: { type: Boolean, default: false },
    customLevel: { type: mongoose.Schema.Types.ObjectId, ref: 'Level', default: null },
  },
  { timestamps: true },
);

runSchema.index({ level: 1, result: 1, timeMs: 1 });

export const Run = mongoose.model('Run', runSchema);
