const aggregateQuantities = (items) => {
  const quantities = new Map();
  for (const item of items || []) {
    const id = String(item.productId);
    quantities.set(id, (quantities.get(id) || 0) + Number(item.quantity));
  }
  return quantities;
};

const restoreStock = async (reservations, Product) => {
  for (const reservation of reservations || []) {
    await Product.findOneAndUpdate(
      { _id: reservation.productId, stock: { $type: 'number' } },
      { $inc: { stock: reservation.quantity } },
      { new: true }
    );
  }
};

const reserveStock = async (items, Product) => {
  const reservations = [];
  try {
    for (const [productId, quantity] of aggregateQuantities(items)) {
      const product = await Product.findById(productId).select('name available stock');
      if (!product || !product.available) {
        throw Object.assign(new Error(`Item "${product?.name || 'Menu item'}" is currently unavailable.`), { statusCode: 409 });
      }
      if (product.stock === null || product.stock === undefined) continue;
      if (!Number.isInteger(quantity) || quantity < 1) throw Object.assign(new Error('Inventory quantity is invalid.'), { statusCode: 400 });
      const reserved = await Product.findOneAndUpdate(
        { _id: productId, available: true, stock: { $type: 'number', $gte: quantity } },
        { $inc: { stock: -quantity } },
        { new: true }
      );
      if (!reserved) {
        throw Object.assign(new Error(`Not enough stock remains for "${product.name}". Refresh the menu and adjust your cart.`), { statusCode: 409 });
      }
      reservations.push({ productId, quantity });
    }
    return reservations;
  } catch (error) {
    await restoreStock(reservations, Product);
    throw error;
  }
};

module.exports = { aggregateQuantities, reserveStock, restoreStock };
