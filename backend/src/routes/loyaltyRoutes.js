const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getMyLoyalty, quoteLoyalty } = require('../controllers/loyaltyController');

router.get('/me', protect, getMyLoyalty);
router.post('/quote', protect, quoteLoyalty);

module.exports = router;
