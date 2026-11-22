const mongoose = require('mongoose');

const promoBannerSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  title: { type: String, trim: true, maxlength: 80, default: '' },
  message: { type: String, trim: true, maxlength: 180, default: '' },
  ctaLabel: { type: String, trim: true, maxlength: 24, default: '' },
  ctaRoute: { type: String, enum: ['/(tabs)/home', '/(tabs)/menu', '/group-order'], default: '/(tabs)/menu' },
}, { _id: false });

const promoBannerItemSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  title: { type: String, trim: true, maxlength: 80, default: '' },
  message: { type: String, trim: true, maxlength: 180, default: '' },
  imageUrl: { type: String, trim: true, maxlength: 1000, default: '' },
  ctaLabel: { type: String, trim: true, maxlength: 24, default: '' },
  ctaRoute: { type: String, enum: ['/(tabs)/home', '/(tabs)/menu', '/group-order'], default: '/(tabs)/menu' },
  activeFrom: { type: Date, default: null },
  activeUntil: { type: Date, default: null },
  sortOrder: { type: Number, default: 0, min: 0, max: 4 },
});

const loyaltyTierSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 24 },
  minimumLifetimePoints: { type: Number, required: true, min: 0, max: 100000000 },
}, { _id: false });

const loyaltyPolicySchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  earnEveryRupees: { type: Number, default: 0, min: 0, max: 100000 },
  pointsPerStep: { type: Number, default: 0, min: 0, max: 100000 },
  paisePerPoint: { type: Number, default: 0, min: 0, max: 100000 },
  minimumRedemptionPoints: { type: Number, default: 0, min: 0, max: 1000000 },
  maxRedemptionPercent: { type: Number, default: 0, min: 0, max: 50 },
  tiers: { type: [loyaltyTierSchema], default: [] },
}, { _id: false });

const restaurantSettingsSchema = new mongoose.Schema(
  {
    acceptingOrders: {
      type: Boolean,
      default: true,
    },
    openTime: {
      type: String,
      default: '09:00',
    },
    closeTime: {
      type: String,
      default: '23:00',
    },
    busyStatus: {
      type: String,
      enum: ['NORMAL', 'BUSY', 'VERY_BUSY'],
      default: 'NORMAL',
    },
    deliveryEnabled: {
      type: Boolean,
      default: true,
    },
    dineInEnabled: {
      type: Boolean,
      default: true,
    },
    takeawayEnabled: {
      type: Boolean,
      default: true,
    },
    estimatedPrepMinutes: {
      type: Number,
      default: 15,
      min: 5,
    },
    orderOverdueMinutes: { type: Number, default: 30, min: 1, max: 240 },
    scheduledPickupEnabled: { type: Boolean, default: false },
    pickupSlotMinutes: { type: Number, enum: [15, 30, 60], default: 15 },
    pickupSlotCapacity: { type: Number, min: 1, max: 100, default: 4 },
    // Optional admin-configured campus pickup point; blank keeps the documented TIET counter fallback.
    pickupLocation: { type: String, default: '', trim: true, maxlength: 200 },
    deliveryFee: {
      type: Number,
      default: 20,
      min: 0,
    },
    groupMinimumOrderValue: { type: Number, default: 0, min: 0, max: 100000 },
    upiId: { type: String, default: '', trim: true, maxlength: 120 },
    upiPayeeName: { type: String, default: '', trim: true, maxlength: 120 },
    upiQrImageUrl: { type: String, default: '', trim: true, maxlength: 1000 },
    upiEnabled: { type: Boolean, default: false },
    cashEnabled: { type: Boolean, default: true },
    promoBanner: { type: promoBannerSchema, default: () => ({}) },
    promoBanners: { type: [promoBannerItemSchema], default: [] },
    loyalty: { type: loyaltyPolicySchema, default: () => ({}) },
  },
  {
    timestamps: true,
  }
);

// Ensure only one settings document exists
restaurantSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

module.exports = mongoose.model('RestaurantSettings', restaurantSettingsSchema);
