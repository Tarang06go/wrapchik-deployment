const express = require('express');
const router = express.Router();
const {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  reorderFromPast,
} = require('../controllers/orderController');
const { issuePickupQr } = require('../controllers/pickupController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createOrder);
router.get('/my', protect, getMyOrders);
router.post('/:id/pickup-qr', protect, issuePickupQr);
router.get('/:id', protect, getOrderById);
router.post('/:id/cancel', protect, cancelOrder);
router.post('/:id/reorder', protect, reorderFromPast);

module.exports = router;
