const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getOrderReview, createOrderReview } = require('../controllers/reviewController');

router.get('/:orderId', protect, getOrderReview);
router.post('/:orderId', protect, createOrderReview);

module.exports = router;
