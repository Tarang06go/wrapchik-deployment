const express = require('express');
const router = express.Router();
const {
  createGroup, joinGroup, getMyGroups, getGroupSummary, getGroupActivity, getGroupDetails, lockGroup, leaveGroup, removeGroupMember,
  addGroupItem, updateGroupItem, configureGroupItemSharing, acceptGroupItemShare, removeGroupItem,
} = require('../controllers/groupOrderController');
const {
  previewGroupCheckout, checkoutGroup, getContributionInstructions, submitContributionReference,
  getPendingGroupContributions, reviewGroupContribution, reconcileGroupPayment,
} = require('../controllers/groupCheckoutController');
const { sendGroupPaymentReminder } = require('../controllers/groupReminderController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.post('/', protect, createGroup);
router.post('/join', protect, joinGroup);
router.get('/mine', protect, getMyGroups);
router.get('/admin/contributions/pending', protect, adminOnly, getPendingGroupContributions);
router.post('/admin/:id/reconcile-payment', protect, adminOnly, reconcileGroupPayment);
router.get('/:id/summary', protect, getGroupSummary);
router.get('/:id/activity', protect, getGroupActivity);
router.post('/:id/payment-reminders', protect, sendGroupPaymentReminder);
router.get('/:id', protect, getGroupDetails);
router.post('/:id/lock', protect, lockGroup);
router.post('/:id/quote', protect, previewGroupCheckout);
router.post('/:id/checkout', protect, checkoutGroup);
router.get('/:id/contributions/:contributionId/upi', protect, getContributionInstructions);
router.post('/:id/contributions/:contributionId/upi-reference', protect, submitContributionReference);
router.post('/:id/contributions/:contributionId/review', protect, adminOnly, reviewGroupContribution);
router.post('/:id/leave', protect, leaveGroup);
router.delete('/:id/members/:userId', protect, removeGroupMember);
router.post('/:id/items', protect, addGroupItem);
router.patch('/:id/items/:itemId', protect, updateGroupItem);
router.put('/:id/items/:itemId/shares', protect, configureGroupItemSharing);
router.post('/:id/items/:itemId/accept', protect, acceptGroupItemShare);
router.delete('/:id/items/:itemId', protect, removeGroupItem);

module.exports = router;
