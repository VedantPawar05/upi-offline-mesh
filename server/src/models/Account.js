// ─────────────────────────────────────────
// Account.js — Mongoose model
// vpa as primary key, balancePaise (integer),
// pinHash (select:false), versionKey for optimistic locking
// ─────────────────────────────────────────
const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      alias: 'vpa',
    },
    holderName: {
      type: String,
      required: [true, 'Holder name is required'],
      trim: true,
    },
    balancePaise: {
      type: Number,
      required: [true, 'Balance is required'],
      min: [0, 'Balance cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Balance must be an integer (paise)',
      },
    },
    pinHash: {
      type: String,
      required: [true, 'PIN hash is required'],
      select: false, // Never returned in API responses
    },
  },
  {
    timestamps: true,
    versionKey: '__v', // Optimistic locking — Mongoose default
  }
);

// Virtual getter for 'vpa' from '_id'
accountSchema.virtual('vpa').get(function () {
  return this._id;
});

// Ensure virtuals appear in JSON
accountSchema.set('toJSON', { virtuals: true });
accountSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Account', accountSchema);
