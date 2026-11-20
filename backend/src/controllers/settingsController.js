const RestaurantSettings = require('../models/RestaurantSettings');
const { isValidUpiId } = require('../utils/upiPayment');
const { validateLoyaltyPolicy } = require('../utils/loyaltyRules');

const getSettings = async (req, res, next) => {
  try {
    const settings = await RestaurantSettings.getSettings();
    res.json({ success: true, settings });
  } catch (error) { next(error); }
};

const updateSettings = async (req, res, next) => {
  try {
    const body = req.body || {};
    if (body.loyalty !== undefined) body.loyalty = validateLoyaltyPolicy(body.loyalty);
    if (body.promoBanner !== undefined) {
      const banner = body.promoBanner;
      const routes = ['/(tabs)/home', '/(tabs)/menu', '/group-order'];
      const stringLimits = { title: 80, message: 180, ctaLabel: 24 };
      if (!banner || typeof banner !== 'object' || Array.isArray(banner)
        || Object.keys(banner).some((key) => !['enabled', 'title', 'message', 'ctaLabel', 'ctaRoute'].includes(key))) {
        return res.status(400).json({ success: false, message: 'Promotional banner has unsupported fields.' });
      }
      if (banner.enabled !== undefined && typeof banner.enabled !== 'boolean') return res.status(400).json({ success: false, message: 'Banner enabled must be a boolean.' });
      for (const [key, maxLength] of Object.entries(stringLimits)) {
        if (banner[key] !== undefined && (typeof banner[key] !== 'string' || banner[key].trim().length > maxLength)) {
          return res.status(400).json({ success: false, message: `Banner ${key} must be a string within ${maxLength} characters.` });
        }
      }
      if (banner.ctaRoute !== undefined && !routes.includes(banner.ctaRoute)) return res.status(400).json({ success: false, message: 'Choose a supported in-app banner destination.' });
      if (banner.enabled === true && (!banner.title?.trim() || !banner.message?.trim() || !banner.ctaLabel?.trim())) {
        return res.status(400).json({ success: false, message: 'Add a title, message and button label before enabling the banner.' });
      }
    }
    if (body.promoBanners !== undefined) {
      const routes = ['/(tabs)/home', '/(tabs)/menu', '/group-order'];
      if (!Array.isArray(body.promoBanners) || body.promoBanners.length > 5) return res.status(400).json({ success: false, message: 'Configure up to five promotional banners.' });
      for (const [index, banner] of body.promoBanners.entries()) {
        const allowed = ['enabled', 'title', 'message', 'imageUrl', 'ctaLabel', 'ctaRoute', 'activeFrom', 'activeUntil', 'sortOrder', '_id'];
        if (!banner || typeof banner !== 'object' || Array.isArray(banner) || Object.keys(banner).some(key => !allowed.includes(key))) return res.status(400).json({ success: false, message: `Banner ${index + 1} contains unsupported fields.` });
        if (banner.enabled !== undefined && typeof banner.enabled !== 'boolean') return res.status(400).json({ success: false, message: `Banner ${index + 1} enabled must be a boolean.` });
        for (const [key, max] of Object.entries({ title: 80, message: 180, imageUrl: 1000, ctaLabel: 24 })) {
          if (banner[key] !== undefined && (typeof banner[key] !== 'string' || banner[key].trim().length > max)) return res.status(400).json({ success: false, message: `Banner ${index + 1} ${key} exceeds its allowed length.` });
        }
        if (banner.ctaRoute !== undefined && !routes.includes(banner.ctaRoute)) return res.status(400).json({ success: false, message: `Banner ${index + 1} must use an existing in-app destination.` });
        if (banner.imageUrl) {
          try {
            const image = new URL(banner.imageUrl);
            if (image.protocol !== 'https:' || image.hostname !== 'res.cloudinary.com' || image.username || image.password) throw new Error('Cloudinary HTTPS URL required');
          } catch { return res.status(400).json({ success: false, message: `Banner ${index + 1} image must be a public HTTPS Cloudinary URL.` }); }
        }
        const dates = {};
        for (const key of ['activeFrom', 'activeUntil']) {
          dates[key] = banner[key] == null || banner[key] === '' ? null : new Date(banner[key]);
          if (dates[key] && !Number.isFinite(dates[key].getTime())) return res.status(400).json({ success: false, message: `Banner ${index + 1} ${key} must be a valid ISO date.` });
        }
        if (dates.activeFrom && dates.activeUntil && dates.activeFrom >= dates.activeUntil) return res.status(400).json({ success: false, message: `Banner ${index + 1} must end after it starts.` });
        if (banner.sortOrder !== undefined && (!Number.isInteger(Number(banner.sortOrder)) || Number(banner.sortOrder) < 0 || Number(banner.sortOrder) > 4)) return res.status(400).json({ success: false, message: `Banner ${index + 1} sort order must be from 0 to 4.` });
        if (banner.enabled && (!banner.title?.trim() || !banner.message?.trim() || !banner.ctaLabel?.trim())) return res.status(400).json({ success: false, message: `Add a title, message, and button label before enabling banner ${index + 1}.` });
      }
    }
    for (const key of ['upiId', 'upiPayeeName', 'upiQrImageUrl']) {
      if (body[key] !== undefined && (typeof body[key] !== 'string' || body[key].length > (key === 'upiQrImageUrl' ? 1000 : 120))) return res.status(400).json({ success: false, message: `${key} must be a string within the allowed length` });
    }
    if (body.upiId !== undefined && body.upiId && !isValidUpiId(body.upiId)) return res.status(400).json({ success: false, message: 'Enter a valid UPI ID.' });
    if (body.upiQrImageUrl) {
      try {
        const url = new URL(body.upiQrImageUrl);
        if (url.protocol !== 'https:') throw new Error('https required');
      } catch { return res.status(400).json({ success: false, message: 'UPI QR image URL must be a valid HTTPS URL.' }); }
    }
    const { acceptingOrders, openTime, closeTime, busyStatus, deliveryEnabled, dineInEnabled, takeawayEnabled, estimatedPrepMinutes, deliveryFee } = body;
    for (const key of ['acceptingOrders', 'deliveryEnabled', 'dineInEnabled', 'takeawayEnabled', 'upiEnabled', 'cashEnabled']) {
      if (body[key] !== undefined && typeof body[key] !== 'boolean') return res.status(400).json({ success: false, message: `${key} must be a boolean` });
    }
    if (body.scheduledPickupEnabled !== undefined && typeof body.scheduledPickupEnabled !== 'boolean') return res.status(400).json({ success: false, message: 'scheduledPickupEnabled must be a boolean' });
    if (body.pickupSlotMinutes !== undefined && ![15, 30, 60].includes(Number(body.pickupSlotMinutes))) return res.status(400).json({ success: false, message: 'Pickup slot interval must be 15, 30, or 60 minutes' });
    if (body.pickupSlotCapacity !== undefined && (!Number.isInteger(Number(body.pickupSlotCapacity)) || Number(body.pickupSlotCapacity) < 1 || Number(body.pickupSlotCapacity) > 100)) return res.status(400).json({ success: false, message: 'Pickup slot capacity must be an integer from 1 to 100' });
    const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
    for (const key of ['openTime', 'closeTime']) {
      if (body[key] !== undefined && (typeof body[key] !== 'string' || !timePattern.test(body[key]))) return res.status(400).json({ success: false, message: `${key} must use 24-hour HH:mm format` });
    }
    if (busyStatus !== undefined && !['NORMAL', 'BUSY', 'VERY_BUSY'].includes(busyStatus)) return res.status(400).json({ success: false, message: 'Invalid busy status' });
    if (estimatedPrepMinutes !== undefined && (!Number.isInteger(Number(estimatedPrepMinutes)) || Number(estimatedPrepMinutes) < 5 || Number(estimatedPrepMinutes) > 240)) return res.status(400).json({ success: false, message: 'Preparation time must be between 5 and 240 minutes' });
    if (body.orderOverdueMinutes !== undefined && (!Number.isInteger(Number(body.orderOverdueMinutes)) || Number(body.orderOverdueMinutes) < 1 || Number(body.orderOverdueMinutes) > 240)) return res.status(400).json({ success: false, message: 'Order overdue threshold must be a whole number from 1 to 240 minutes.' });
    if (deliveryFee !== undefined && (!Number.isFinite(Number(deliveryFee)) || Number(deliveryFee) < 0)) return res.status(400).json({ success: false, message: 'Delivery fee must be a non-negative number' });
    if (body.groupMinimumOrderValue !== undefined && (!Number.isFinite(Number(body.groupMinimumOrderValue)) || Number(body.groupMinimumOrderValue) < 0 || Number(body.groupMinimumOrderValue) > 100000)) return res.status(400).json({ success: false, message: 'Group minimum order must be between ₹0 and ₹100,000.' });
    const settings = await RestaurantSettings.getSettings();
    const proposedUpiEnabled = body.upiEnabled ?? settings.upiEnabled;
    const proposedUpiId = body.upiId ?? settings.upiId;
    const proposedPayee = body.upiPayeeName ?? settings.upiPayeeName;
    if (proposedUpiEnabled && (!isValidUpiId(proposedUpiId) || !proposedPayee?.trim())) return res.status(400).json({ success: false, message: 'A valid outlet UPI ID and payee name are required before enabling UPI.' });
    const proposedOpen = body.openTime ?? settings.openTime;
    const proposedClose = body.closeTime ?? settings.closeTime;
    if (proposedOpen >= proposedClose) return res.status(400).json({ success: false, message: 'Closing time must be later than opening time' });
    const allowedFields = ['acceptingOrders', 'openTime', 'closeTime', 'busyStatus', 'deliveryEnabled', 'dineInEnabled', 'takeawayEnabled', 'estimatedPrepMinutes', 'orderOverdueMinutes', 'deliveryFee', 'groupMinimumOrderValue', 'scheduledPickupEnabled', 'pickupSlotMinutes', 'pickupSlotCapacity', 'upiId', 'upiPayeeName', 'upiQrImageUrl', 'upiEnabled', 'cashEnabled', 'promoBanner', 'promoBanners', 'loyalty'];
    for (const field of allowedFields) {
      if (body[field] !== undefined) settings[field] = body[field];
    }
    await settings.save();
    res.json({ success: true, message: 'Restaurant settings updated', settings });
  } catch (error) { next(error); }
};

module.exports = { getSettings, updateSettings };
