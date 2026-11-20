const buildCoPurchasePipeline = (seedProductIds, productCollectionName) => [
  { $match: { paymentStatus: 'SUCCESS', orderStatus: { $in: ['COMPLETED', 'DELIVERED', 'SERVED'] }, 'items.productId': { $in: seedProductIds } } },
  { $unwind: '$items' },
  { $match: { 'items.productId': { $nin: seedProductIds, $ne: null } } },
  { $group: { _id: '$items.productId', coPurchaseQuantity: { $sum: '$items.quantity' }, ordersTogether: { $sum: 1 } } },
  { $lookup: { from: productCollectionName, localField: '_id', foreignField: '_id', as: 'product' } },
  { $unwind: '$product' },
  { $match: { 'product.available': true, $or: [{ 'product.stock': null }, { 'product.stock': { $gt: 0 } }] } },
  { $sort: { coPurchaseQuantity: -1, _id: 1 } },
  { $limit: 4 },
  { $project: { _id: '$product._id', name: '$product.name', price: '$product.price', imageUrl: '$product.imageUrl', isVeg: '$product.isVeg', available: '$product.available', customizations: '$product.customizations', coPurchaseQuantity: 1, ordersTogether: 1 } },
];

module.exports = { buildCoPurchasePipeline };
