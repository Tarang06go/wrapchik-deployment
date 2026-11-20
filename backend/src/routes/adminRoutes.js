const express = require('express');
const router = express.Router();
const {
  getAllOrders,
  updateOrderStatus,
  getAnalytics,
} = require('../controllers/adminController');
const { getAllIssues, resolveIssue } = require('../controllers/issueController');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { listCustomers, setCustomerActive } = require('../controllers/adminCustomerController');
const { verifyPickupQr } = require('../controllers/pickupController');

router.use(protect);
router.use(adminOnly);

router.get('/orders', getAllOrders);
router.put('/orders/:id/status', updateOrderStatus);
router.post('/orders/:id/pickup/verify', verifyPickupQr);
router.get('/analytics', getAnalytics);
router.get('/customers', listCustomers);
router.patch('/customers/:id/status', setCustomerActive);

router.get('/issues', getAllIssues);
router.put('/issues/:id/resolve', resolveIssue);

module.exports = router;
