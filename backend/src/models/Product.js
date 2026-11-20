const mongoose = require('mongoose');

const customizationOptionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  price: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
  },
});

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a product name'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    price: {
      type: Number,
      required: [true, 'Please add a product price'],
      min: [0, 'Price must be non-negative'],
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Please associate a category'],
    },
    imageUrl: {
      type: String,
      default: '',
    },
    isVeg: {
      type: Boolean,
      default: null,
    },
    available: {
      type: Boolean,
      default: true,
    },
    // null means unlimited stock; adding this field does not alter existing catalogue records.
    stock: {
      type: Number,
      default: null,
      min: 0,
      validate: { validator: (value) => value === null || Number.isInteger(value), message: 'Stock must be a whole number or unlimited.' },
    },
    // Opt-in spotlight flag. Never set automatically, so a product only becomes
    // featured when an administrator turns it on.
    isFeatured: {
      type: Boolean,
      default: false,
    },
    customizations: [customizationOptionSchema],
  },
  {
    timestamps: true,
  }
);

productSchema.index({ categoryId: 1, available: 1 }, { name: 'product_category_availability' });
productSchema.index({ name: 'text' }, { name: 'product_name_text' });

module.exports = mongoose.model('Product', productSchema);
