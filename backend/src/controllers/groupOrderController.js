const GroupOrder = require('../models/GroupOrder');
const crypto = require('crypto');
const mongoose = require('mongoose');
const socketManager = require('../config/socketManager');
const { ACTIVE_MEMBER_COUNT, countActiveMembers, chooseNextLeader, isGroupExpired } = require('../utils/groupOrderRules');
const { calculateVerifiedItems } = require('../utils/orderPricing');
const { allocatePaise, equalAllocations, acceptancesComplete, userKey } = require('../utils/groupItemAllocation');

const GROUP_LIFETIME_MS = 2 * 60 * 60 * 1000;
const membershipActiveFilter = (userId) => ({ members: { $elemMatch: { userId, status: 'JOINED' } } });
const notExpiredFilter = (now) => ({
  $or: [
    { expiresAt: null },
    { expiresAt: { $exists: false } },
    { expiresAt: { $gt: now } },
  ],
});

const emitUpdate = (group) => socketManager.emitGroupUpdate(group);
const isObjectId = (value) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
const isActiveMember = (group, userId) => group.members.some((member) => member.status === 'JOINED' && userKey(member.userId) === userKey(userId));
const serializeGroupForMember = (group, viewerId) => {
  const result = typeof group?.toObject === 'function' ? group.toObject() : { ...group };
  result.contributions = (result.contributions || []).map((contribution) => {
    const isOwn = userKey(contribution.userId) === userKey(viewerId);
    return {
      _id: contribution._id,
      userId: contribution.userId,
      amountPaise: contribution.amountPaise,
      method: contribution.method,
      status: contribution.status,
      ...(isOwn ? {
        upiTransactionReference: contribution.upiTransactionReference || null,
        verificationReason: contribution.verificationReason || null,
      } : {}),
    };
  });
  return result;
};
const invalidateItemAcceptances = (item) => {
  item.revision += 1;
  item.allocations.forEach((allocation) => {
    allocation.acceptedAt = null;
    allocation.acceptedRevision = null;
  });
};
const removeMemberFromCart = (group, userId) => {
  const key = userKey(userId);
  group.items = (group.items || []).filter((item) => userKey(item.selectedBy) !== key);
  group.items.forEach((item) => {
    if (item.shareMode !== 'SHARED' || !item.allocations.some((allocation) => userKey(allocation.userId) === key)) return;
    const remainingIds = item.allocations.map((allocation) => userKey(allocation.userId)).filter((id) => id !== key);
    if (remainingIds.length <= 1) {
      item.shareMode = 'SOLO';
      item.allocations = remainingIds.map((id) => ({ userId: id, percentageBps: 10_000, amountPaise: item.itemTotalPaise, acceptedRevision: item.revision + 1, acceptedAt: new Date() }));
      item.revision += 1;
    } else {
      item.allocations = allocatePaise(item.itemTotalPaise, equalAllocations(remainingIds)).map((allocation) => ({ ...allocation, acceptedRevision: null, acceptedAt: null }));
      invalidateItemAcceptances(item);
    }
  });
};
const findEditableGroup = async (groupId, userId) => {
  if (!mongoose.isValidObjectId(groupId)) return { error: { status: 400, message: 'A valid group is required.' } };
  let group = await GroupOrder.findById(groupId);
  if (!group) return { error: { status: 404, message: 'Group not found.' } };
  group = await closeExpiredGroup(group);
  if (group.status !== 'OPEN') return { error: { status: 409, message: 'This group is locked or closed.' } };
  if (isGroupExpired(group)) return { error: { status: 410, message: 'This group invite has expired.' } };
  if (!isActiveMember(group, userId)) return { error: { status: 403, message: 'Only current group members can change the shared cart.' } };
  return { group };
};
const recalculateGroupItem = async ({ productId, quantity, customizations }) => {
  if (!isObjectId(productId) || !Number.isInteger(Number(quantity)) || Number(quantity) < 1 || Number(quantity) > 50) {
    throw Object.assign(new Error('Choose a product and a whole-number quantity from 1 to 50.'), { statusCode: 400 });
  }
  const { verifiedItems } = await calculateVerifiedItems([{ productId, quantity: Number(quantity), customizations }]);
  const verified = verifiedItems[0];
  const itemTotalPaise = Math.round(verified.itemTotal * 100);
  if (!Number.isSafeInteger(itemTotalPaise) || itemTotalPaise < 0) throw Object.assign(new Error('The item price is outside the supported range.'), { statusCode: 400 });
  return { ...verified, itemTotalPaise };
};

const closeExpiredGroup = async (group) => {
  if (!isGroupExpired(group)) return group;
  const now = new Date();
  const closed = await GroupOrder.findOneAndUpdate(
    { _id: group._id, status: 'OPEN', expiresAt: { $lte: now } },
    { $set: { status: 'CANCELLED', cancelledAt: now }, $inc: { __v: 1 } },
    { new: true }
  );
  if (closed) emitUpdate(closed);
  return closed || await GroupOrder.findById(group._id) || group;
};

const createGroup = async (req, res, next) => {
  try {
    const { orderType = 'TAKEAWAY', hostel, roomNumber, tableId, maxMembers = 8 } = req.body || {};
    const memberLimit = Number(maxMembers);
    if (!['TAKEAWAY', 'DELIVERY', 'DINE_IN'].includes(orderType)) return res.status(400).json({ success: false, message: 'Invalid group order type.' });
    if (!Number.isInteger(memberLimit) || memberLimit < 2 || memberLimit > 8) return res.status(400).json({ success: false, message: 'Group size must be from 2 to 8 members.' });
    if (orderType === 'DELIVERY' && (typeof hostel !== 'string' || !hostel.trim() || hostel.trim().length > 120 || typeof roomNumber !== 'string' || !roomNumber.trim() || roomNumber.trim().length > 32)) {
      return res.status(400).json({ success: false, message: 'A valid hostel and room are required for a delivery group.' });
    }
    if (orderType === 'DINE_IN' && !mongoose.isValidObjectId(tableId)) return res.status(400).json({ success: false, message: 'A valid table is required for a dine-in group.' });

    let group;
    for (let attempt = 0; attempt < 3 && !group; attempt += 1) {
      const groupCode = crypto.randomBytes(3).toString('hex').toUpperCase();
      try {
        group = await GroupOrder.create({
          groupCode,
          leaderId: req.user._id,
          members: [{ userId: req.user._id, name: req.user.name, status: 'JOINED', joinedAt: new Date() }],
          orderType,
          hostel: orderType === 'DELIVERY' ? hostel.trim() : null,
          roomNumber: orderType === 'DELIVERY' ? roomNumber.trim() : null,
          tableId: orderType === 'DINE_IN' ? tableId : null,
          maxMembers: memberLimit,
          expiresAt: new Date(Date.now() + GROUP_LIFETIME_MS),
        });
      } catch (error) {
        if (error.code !== 11000 || attempt === 2) throw error;
      }
    }
    if (!group) return res.status(503).json({ success: false, message: 'Could not create an invite code. Try again.' });
    res.status(201).json({ success: true, group });
  } catch (error) { next(error); }
};

const joinGroup = async (req, res, next) => {
  try {
    const groupCode = req.body?.groupCode;
    if (typeof groupCode !== 'string' || !/^[A-F0-9]{6}$/.test(groupCode.trim().toUpperCase())) return res.status(400).json({ success: false, message: 'Enter a valid six-character group code.' });
    const normalizedCode = groupCode.trim().toUpperCase();
    const now = new Date();
    const group = await GroupOrder.findOneAndUpdate(
      {
        groupCode: normalizedCode,
        status: 'OPEN',
        ...notExpiredFilter(now),
        members: { $not: { $elemMatch: { userId: req.user._id, status: 'JOINED' } } },
        $expr: { $lt: [ACTIVE_MEMBER_COUNT, '$maxMembers'] },
      },
      { $push: { members: { userId: req.user._id, name: req.user.name, status: 'JOINED', joinedAt: now, leftAt: null } }, $inc: { __v: 1 } },
      { new: true, runValidators: true }
    );
    if (group) {
      emitUpdate(group);
      return res.json({ success: true, group });
    }

    const current = await GroupOrder.findOne({ groupCode: normalizedCode });
    if (!current) return res.status(404).json({ success: false, message: 'Group not found.' });
    const refreshed = await closeExpiredGroup(current);
    if (refreshed.status !== 'OPEN') return res.status(409).json({ success: false, message: 'This group is closed.' });
    if (isGroupExpired(refreshed)) return res.status(410).json({ success: false, message: 'This group invite has expired.' });
    if (refreshed.members.some((member) => member.status === 'JOINED' && String(member.userId) === String(req.user._id))) {
      return res.status(409).json({ success: false, message: 'You are already in this group.' });
    }
    if (countActiveMembers(refreshed.members) >= refreshed.maxMembers) return res.status(409).json({ success: false, message: 'This group is full.' });
    return res.status(409).json({ success: false, message: 'The group changed while you were joining. Refresh and try again.' });
  } catch (error) { next(error); }
};

const getGroupDetails = async (req, res, next) => {
  try {
    let group = await GroupOrder.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found.' });
    group = await closeExpiredGroup(group);
    const isJoinedMember = group.members.some((member) => member.status === 'JOINED' && String(member.userId?._id || member.userId) === String(req.user._id));
    if (!isJoinedMember) return res.status(403).json({ success: false, message: 'Only current group members can view group details.' });
    await group.populate('members.userId', 'name');
    await group.populate('items.selectedBy', 'name');
    await group.populate('items.allocations.userId', 'name');
    if (group.orderId) await group.populate('orderId', 'orderNumber totalAmount paymentStatus orderStatus');
    res.json({ success: true, group: serializeGroupForMember(group, req.user._id) });
  } catch (error) { next(error); }
};

const lockGroup = async (req, res, next) => {
  try {
    let current = await GroupOrder.findById(req.params.id);
    if (!current) return res.status(404).json({ success: false, message: 'Group not found.' });
    current = await closeExpiredGroup(current);
    if (String(current.leaderId) !== String(req.user._id)) return res.status(403).json({ success: false, message: 'Only the group leader can lock this group.' });
    if (current.status !== 'OPEN') return res.status(409).json({ success: false, message: 'Only an open group can be locked.' });
    if (!current.members.some((member) => member.status === 'JOINED' && String(member.userId) === String(req.user._id))) {
      return res.status(403).json({ success: false, message: 'Only a current group member can lock this group.' });
    }
    if (countActiveMembers(current.members) < 2) return res.status(409).json({ success: false, message: 'At least two students must join before the group can be locked.' });
    const unacceptedShare = current.items.find((item) => item.shareMode === 'SHARED' && !acceptancesComplete(item));
    if (unacceptedShare) return res.status(409).json({ success: false, message: `Every participant must accept their share of ${unacceptedShare.name} before the group can be locked.` });

    const now = new Date();
    const group = await GroupOrder.findOneAndUpdate(
      {
        _id: current._id,
        status: 'OPEN',
        leaderId: req.user._id,
        ...membershipActiveFilter(req.user._id),
        ...notExpiredFilter(now),
        $expr: { $gte: [ACTIVE_MEMBER_COUNT, 2] },
      },
      { $set: { status: 'LOCKED', lockedAt: now }, $inc: { __v: 1 } },
      { new: true, runValidators: true }
    );
    if (!group) return res.status(409).json({ success: false, message: 'The group changed before it could be locked. Refresh and try again.' });
    emitUpdate(group);
    return res.json({ success: true, group, message: 'Group locked. New members can no longer join.' });
  } catch (error) { next(error); }
};

const leaveGroup = async (req, res, next) => {
  try {
    let current = await GroupOrder.findById(req.params.id);
    if (!current) return res.status(404).json({ success: false, message: 'Group not found.' });
    current = await closeExpiredGroup(current);
    if (current.status !== 'OPEN') return res.status(409).json({ success: false, message: 'You cannot leave a group after it has been locked or closed.' });
    const userId = req.user._id;
    const isLeader = String(current.leaderId) === String(userId);
    const nextLeader = isLeader ? chooseNextLeader(current.members, userId) : null;
    const now = new Date();
    const update = { $set: { 'members.$.status': 'LEFT', 'members.$.leftAt': now } };
    if (isLeader && nextLeader) update.$set.leaderId = nextLeader.userId?._id || nextLeader.userId;
    else if (isLeader) {
      update.$set.status = 'CANCELLED';
      update.$set.cancelledAt = now;
    }

    const membershipConditions = [
      { members: { $elemMatch: { userId, status: 'JOINED' } } },
    ];
    if (isLeader && nextLeader) {
      membershipConditions.push({
        members: { $elemMatch: { userId: nextLeader.userId?._id || nextLeader.userId, status: 'JOINED' } },
      });
    } else if (isLeader) {
      // Do not cancel if a concurrent join added another active member after
      // the leader snapshot was read.
      membershipConditions.push({ $expr: { $lte: [ACTIVE_MEMBER_COUNT, 1] } });
    }

    const group = await GroupOrder.findOneAndUpdate(
      {
        _id: current._id,
        status: 'OPEN',
        ...(isLeader ? { leaderId: userId } : {}),
        ...notExpiredFilter(now),
        $and: membershipConditions,
      },
      { ...update, $inc: { __v: 1 } },
      { new: true, runValidators: true }
    );
    if (!group) return res.status(409).json({ success: false, message: 'Group membership changed. Refresh and try again.' });
    removeMemberFromCart(group, userId);
    await group.save();
    emitUpdate(group);
    return res.json({ success: true, message: 'Left the group successfully.', group });
  } catch (error) { next(error); }
};

const removeGroupMember = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) return res.status(400).json({ success: false, message: 'A valid member is required.' });
    if (String(req.params.userId) === String(req.user._id)) return res.status(400).json({ success: false, message: 'Use Leave Group to remove yourself.' });
    let current = await GroupOrder.findById(req.params.id);
    if (!current) return res.status(404).json({ success: false, message: 'Group not found.' });
    current = await closeExpiredGroup(current);
    if (String(current.leaderId) !== String(req.user._id)) return res.status(403).json({ success: false, message: 'Only the group leader can remove a member.' });
    if (current.status !== 'OPEN') return res.status(409).json({ success: false, message: 'Members cannot be removed after the group is locked.' });

    const now = new Date();
    const group = await GroupOrder.findOneAndUpdate(
      {
        _id: current._id,
        leaderId: req.user._id,
        status: 'OPEN',
        ...notExpiredFilter(now),
        members: { $elemMatch: { userId: req.params.userId, status: 'JOINED' } },
      },
      { $set: { 'members.$.status': 'LEFT', 'members.$.leftAt': now }, $inc: { __v: 1 } },
      { new: true, runValidators: true }
    );
    if (!group) return res.status(409).json({ success: false, message: 'That member is no longer in this open group.' });
    removeMemberFromCart(group, req.params.userId);
    await group.save();
    emitUpdate(group);
    return res.json({ success: true, message: 'Member removed from the group.', group });
  } catch (error) { next(error); }
};

const addGroupItem = async (req, res, next) => {
  try {
    const result = await findEditableGroup(req.params.id, req.user._id);
    if (result.error) return res.status(result.error.status).json({ success: false, message: result.error.message });
    if (result.group.items.length >= 50) return res.status(409).json({ success: false, message: 'A group cart can contain at most 50 item selections.' });
    const { productId, quantity = 1, customizations = [], sharedWith } = req.body || {};
    const verified = await recalculateGroupItem({ productId, quantity, customizations });
    let allocations;
    let shareMode = 'SOLO';
    if (sharedWith !== undefined) {
      if (!Array.isArray(sharedWith) || sharedWith.length < 2 || sharedWith.length > 8) return res.status(400).json({ success: false, message: 'A shared dish must have 2–8 participants.' });
      const participants = [...new Set(sharedWith.map(userKey))];
      if (participants.length !== sharedWith.length || !participants.includes(userKey(req.user._id)) || participants.some((id) => !isActiveMember(result.group, id))) {
        return res.status(400).json({ success: false, message: 'Shared-dish participants must be unique current group members, including you.' });
      }
      allocations = allocatePaise(verified.itemTotalPaise, equalAllocations(participants)).map((allocation) => ({ ...allocation, acceptedRevision: null, acceptedAt: null }));
      shareMode = 'SHARED';
    } else {
      allocations = [{ userId: req.user._id, percentageBps: 10_000, amountPaise: verified.itemTotalPaise, acceptedRevision: 1, acceptedAt: new Date() }];
    }
    result.group.items.push({
      productId: verified.productId,
      selectedBy: req.user._id,
      name: verified.name,
      priceAtPurchase: verified.priceAtPurchase,
      quantity: verified.quantity,
      customizations: verified.customizations,
      itemTotalPaise: verified.itemTotalPaise,
      shareMode,
      allocations,
      revision: 1,
    });
    await result.group.save();
    emitUpdate(result.group);
    return res.status(201).json({ success: true, group: result.group });
  } catch (error) {
    if (error.name === 'VersionError') return res.status(409).json({ success: false, message: 'The group cart changed at the same time. Refresh and try again.' });
    next(error);
  }
};

const updateGroupItem = async (req, res, next) => {
  try {
    const result = await findEditableGroup(req.params.id, req.user._id);
    if (result.error) return res.status(result.error.status).json({ success: false, message: result.error.message });
    const item = result.group.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Group cart item not found.' });
    if (userKey(item.selectedBy) !== userKey(req.user._id)) return res.status(403).json({ success: false, message: 'You can edit only the items you added.' });
    const verified = await recalculateGroupItem({ productId: String(item.productId), quantity: req.body?.quantity, customizations: req.body?.customizations ?? item.customizations });
    item.name = verified.name;
    item.priceAtPurchase = verified.priceAtPurchase;
    item.quantity = verified.quantity;
    item.customizations = verified.customizations;
    item.itemTotalPaise = verified.itemTotalPaise;
    invalidateItemAcceptances(item);
    item.allocations = allocatePaise(item.itemTotalPaise, item.allocations).map((allocation) => ({
      ...allocation,
      acceptedRevision: item.shareMode === 'SOLO' ? item.revision : null,
      acceptedAt: item.shareMode === 'SOLO' ? new Date() : null,
    }));
    await result.group.save();
    emitUpdate(result.group);
    return res.json({ success: true, group: result.group });
  } catch (error) {
    if (error.name === 'VersionError') return res.status(409).json({ success: false, message: 'The group cart changed at the same time. Refresh and try again.' });
    next(error);
  }
};

const configureGroupItemSharing = async (req, res, next) => {
  try {
    const result = await findEditableGroup(req.params.id, req.user._id);
    if (result.error) return res.status(result.error.status).json({ success: false, message: result.error.message });
    const item = result.group.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Group cart item not found.' });
    if (userKey(item.selectedBy) !== userKey(req.user._id)) return res.status(403).json({ success: false, message: 'Only the person who added this item can configure its shares.' });
    let proposed = req.body?.allocations;
    if (Array.isArray(req.body?.userIds)) {
      if (req.body.userIds.length < 2 || req.body.userIds.length > 8 || req.body.userIds.some((id) => !isObjectId(id)) || new Set(req.body.userIds.map(userKey)).size !== req.body.userIds.length) return res.status(400).json({ success: false, message: 'Provide 2–8 unique valid group participants.' });
      proposed = equalAllocations(req.body.userIds);
    }
    if (!Array.isArray(proposed) || proposed.length < 2 || proposed.length > 8 || proposed.some((row) => !isObjectId(row?.userId))) {
      return res.status(400).json({ success: false, message: 'Provide 2–8 valid group participants and their percentage shares.' });
    }
    const participants = proposed.map((row) => row.userId);
    if (!participants.some((id) => userKey(id) === userKey(req.user._id)) || participants.some((id) => !isActiveMember(result.group, id))) {
      return res.status(400).json({ success: false, message: 'A shared dish can only include current group members, including its owner.' });
    }
    const priced = allocatePaise(item.itemTotalPaise, proposed);
    item.shareMode = 'SHARED';
    item.allocations = priced.map((row) => ({ ...row, acceptedRevision: null, acceptedAt: null }));
    invalidateItemAcceptances(item);
    await result.group.save();
    emitUpdate(result.group);
    return res.json({ success: true, group: result.group });
  } catch (error) {
    if (error.name === 'VersionError') return res.status(409).json({ success: false, message: 'The group cart changed at the same time. Refresh and try again.' });
    if (error.message?.includes('share') || error.message?.includes('participant')) return res.status(400).json({ success: false, message: error.message });
    next(error);
  }
};

const acceptGroupItemShare = async (req, res, next) => {
  try {
    const result = await findEditableGroup(req.params.id, req.user._id);
    if (result.error) return res.status(result.error.status).json({ success: false, message: result.error.message });
    const item = result.group.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Group cart item not found.' });
    if (item.shareMode !== 'SHARED') return res.status(409).json({ success: false, message: 'This item is not shared.' });
    const allocation = item.allocations.find((row) => userKey(row.userId) === userKey(req.user._id));
    if (!allocation) return res.status(403).json({ success: false, message: 'You do not have a share assigned for this item.' });
    allocation.acceptedRevision = item.revision;
    allocation.acceptedAt = new Date();
    await result.group.save();
    emitUpdate(result.group);
    const amounts = allocatePaise(item.itemTotalPaise, item.allocations);
    return res.json({ success: true, group: result.group, yourSharePaise: amounts.find((row) => row.userId === userKey(req.user._id))?.amountPaise });
  } catch (error) {
    if (error.name === 'VersionError') return res.status(409).json({ success: false, message: 'This dish changed while you were accepting. Refresh and review the new amount.' });
    next(error);
  }
};

const removeGroupItem = async (req, res, next) => {
  try {
    const result = await findEditableGroup(req.params.id, req.user._id);
    if (result.error) return res.status(result.error.status).json({ success: false, message: result.error.message });
    const item = result.group.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Group cart item not found.' });
    if (userKey(item.selectedBy) !== userKey(req.user._id)) return res.status(403).json({ success: false, message: 'You can remove only the items you added.' });
    item.deleteOne();
    await result.group.save();
    emitUpdate(result.group);
    return res.json({ success: true, group: result.group });
  } catch (error) {
    if (error.name === 'VersionError') return res.status(409).json({ success: false, message: 'The group cart changed at the same time. Refresh and try again.' });
    next(error);
  }
};

module.exports = {
  createGroup, joinGroup, getGroupDetails, lockGroup, leaveGroup, removeGroupMember,
  addGroupItem, updateGroupItem, configureGroupItemSharing, acceptGroupItemShare, removeGroupItem,
  closeExpiredGroup, serializeGroupForMember,
};
