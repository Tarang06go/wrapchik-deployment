const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // Existing users remain authorized through legacy phoneVerified records;
    // newly registered accounts must prove email ownership before sign-in.
    emailVerified: {
      type: Boolean,
      default: false,
    },

    // Optional verified Google identity used only for account linking.
    googleSubject: {
      type: String,
      select: false,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    passwordHash: {
      type: String,
      required: true,
      select: false,
    },

    phoneVerified: {
      type: Boolean,
      default: false,
    },

    role: {
      type: String,
      enum: ['student', 'admin'],
      default: 'student',
    },
    isActive: { type: Boolean, default: true },
    loyaltyPointsBalance: { type: Number, default: 0, min: 0, max: 1000000000 },
    loyaltyLifetimePoints: { type: Number, default: 0, min: 0, max: 1000000000 },

    favourites: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],

    pushToken: {
      type: String,
      default: null,
    },

    defaultHostel: {
      type: String,
      default: null,
      trim: true,
    },

    defaultRoom: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ googleSubject: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('User', userSchema);
