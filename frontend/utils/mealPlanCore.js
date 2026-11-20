export const createMealPlanSnapshot = (name, cartItems) => {
  const cleanName = String(name || '').trim().slice(0, 50);
  if (!cleanName) throw new Error('Give this meal plan a name.');
  if (!Array.isArray(cartItems) || !cartItems.length) throw new Error('Add food to your cart before saving a meal plan.');
  return {
    id: `meal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: cleanName,
    createdAt: new Date().toISOString(),
    items: cartItems.map(item => ({
      productId: String(item.productId),
      productName: String(item.name || 'Menu item').slice(0, 120),
      quantity: Math.max(1, Math.min(50, Math.trunc(Number(item.quantity) || 1))),
      customizationNames: (item.customizations || []).map(option => String(option.name)).filter(Boolean),
    })),
    notificationId: null,
  };
};

export const getMealReminderDate = (kind, now = new Date()) => {
  if (kind !== 'TOMORROW' && kind !== 'NEXT_WEEK') throw new Error('Choose a supported reminder time.');
  const reminder = new Date(now);
  reminder.setDate(reminder.getDate() + (kind === 'TOMORROW' ? 1 : 7));
  reminder.setHours(9, 0, 0, 0);
  return reminder;
};
