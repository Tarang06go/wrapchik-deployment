import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Switch, TouchableOpacity, Alert, ScrollView, TextInput, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Edit2, Trash2 } from 'lucide-react-native';
import Header from '../../components/common/Header';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import ProductImage from '../../components/common/ProductImage';
import productService from '../../services/productService';
import categoryService from '../../services/categoryService';
import COLORS from '../../constants/colors';
import { AdminFormModal, AdminLoadingState } from '../../components/admin/AdminPrimitives';
import { confirmPlatformAction, showPlatformAlert } from '../../utils/platformDialogs';
import { validateNumericText } from '../../utils/adminNumericForm.cjs';

export default function AdminProductsScreen() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [categoryId, setCategoryId] = useState('');
  const [isVeg, setIsVeg] = useState(null);
  const [available, setAvailable] = useState(true);
  const [addons, setAddons] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  // Form modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [stock, setStock] = useState('');
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const [res, catRes] = await Promise.all([productService.getProducts(), categoryService.getCategories()]);
      if (!Array.isArray(res?.products) || !Array.isArray(catRes?.categories)) throw new Error('Menu data response was incomplete.');
      setProducts(res.products);
      setCategories(catRes.categories);
      setLoadError('');
    } catch (e) {
      console.error('[Admin Products Fetch Error]:', e);
      setLoadError(e.message || 'Could not load the menu. Refresh and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAvailability = async (id, currentVal) => {
    setBusyId(id);
    try {
      const result = await productService.toggleAvailability(id, !currentVal);
      const next = typeof result?.available === 'boolean' ? result.available : !currentVal;
      setProducts(prev => prev.map(p => p._id === id ? { ...p, available: next } : p));
    } catch (e) {
      showMessage('Availability not changed', e.message || 'Could not update availability.');
    } finally { setBusyId(null); }
  };

  const showMessage = (title, message) => showPlatformAlert(Platform.OS, title, message, { nativeAlert: (...args) => Alert.alert(...args) });

  const deleteProduct = async id => {
    setBusyId(id);
    try {
      await productService.deleteProduct(id);
      setProducts(prev => prev.filter(p => p._id !== id));
    } catch (e) { showMessage('Product not deleted', e.message || 'Could not delete this product.'); }
    finally { setBusyId(null); }
  };

  const handleDeleteProduct = async (id) => {
    const confirmed = await confirmPlatformAction({ platform: Platform.OS, title: 'Delete Product', message: 'Are you sure you want to delete this product from menu?', confirmLabel: 'Delete', confirmStyle: 'destructive', browserWindow: Platform.OS === 'web' && typeof window !== 'undefined' ? window : undefined, nativeAlert: (...args) => Alert.alert(...args) });
    if (confirmed) await deleteProduct(id);
  };

  const openAddModal = () => {
    setEditingId(null);
    setName('');
    setPrice('');
    setDescription('');
    setImageUrl('');
    setStock('');
    setCategoryId(categories[0]?._id || ''); setIsVeg(null); setAvailable(true); setAddons('');
    setFormErrors({});
    setModalVisible(true);
  };

  const openEditModal = (product) => {
    setEditingId(product._id);
    setName(product.name);
    setPrice(product.price.toString());
    setDescription(product.description);
    setImageUrl(product.imageUrl);
    setStock(product.stock === null || product.stock === undefined ? '' : String(product.stock));
    setCategoryId(typeof product.categoryId === 'object' ? product.categoryId?._id : product.categoryId || '');
    setIsVeg(typeof product.isVeg === 'boolean' ? product.isVeg : null); setAvailable(product.available !== false);
    setAddons((product.customizations || []).map(option => `${option.name}:${option.price}`).join('\n'));
    setFormErrors({});
    setModalVisible(true);
  };

  const handleSaveProduct = async () => {
    const errors = {};
    const parsedPrice = validateNumericText(price, { label: 'Price', min: 0, max: 90071992547409 });
    if (parsedPrice.error) errors.price = parsedPrice.error;
    const parsedStock = validateNumericText(stock, { label: 'Stock quantity', min: 0, max: Number.MAX_SAFE_INTEGER, integer: true, required: false });
    if (parsedStock.error) errors.stock = parsedStock.error;
    if (!name.trim()) errors.name = 'Product name is required.';
    if (!categoryId) errors.categoryId = 'Choose a category.';

    let customizations;
    try {
      customizations = addons.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
        const separator = line.lastIndexOf(':');
        const optionName = separator < 0 ? '' : line.slice(0, separator);
        const optionPriceText = separator < 0 ? '' : line.slice(separator + 1);
        const parsedOptionPrice = validateNumericText(optionPriceText, { label: `Add-on ${optionName.trim() || 'price'}`, min: 0, max: 90071992547409 });
        if (!optionName.trim() || parsedOptionPrice.error) throw new Error(parsedOptionPrice.error || `Add-on ${optionName.trim() || 'name'} must use Name:price format.`);
        return { name: optionName.trim(), price: parsedOptionPrice.value };
      });
    } catch (e) { errors.addons = e.message; }
    setFormErrors(errors);
    if (Object.keys(errors).length) return;

    const payload = {
      name: name.trim(),
      price: parsedPrice.value,
      description: description.trim(),
      imageUrl: imageUrl.trim(),
      categoryId, isVeg, available, customizations, stock: stock.trim() === '' ? null : parsedStock.value,
    };

    try {
      setSaving(true);
      if (editingId) await productService.updateProduct(editingId, payload);
      else await productService.createProduct(payload);
      await fetchProducts();
      setModalVisible(false);
    } catch (e) {
      showMessage('Product not saved', e.message || 'Could not save product.');
    } finally { setSaving(false); }
  };

  const visibleProducts = products.filter(p => `${p.name} ${p.description}`.toLowerCase().includes(search.toLowerCase()) && (categoryFilter === 'ALL' || (typeof p.categoryId === 'object' ? p.categoryId?._id : p.categoryId) === categoryFilter));

  return (
    <View style={styles.container}>
      <Header title="Product Inventory" showBack showCart={false} />

      <View style={styles.topBar}>
        <Text style={styles.countText}>{products.length} menu items</Text>
        <Button title="+ Add Product" onPress={openAddModal} style={styles.addBtn} />
      </View>
      <View style={styles.comboHint}>
        <View style={{ flex: 1 }}><Text style={styles.comboTitle}>Admin-defined combos</Text><Text style={styles.comboCopy}>Add a “Combos” category, then manage each approved bundle as a normal menu product. Menu budget filters and server-side pricing continue to apply.</Text></View>
        <TouchableOpacity onPress={() => router.push('/admin/categories')} style={styles.comboAction} accessibilityRole="button" accessibilityLabel="Manage categories for combo products"><Text style={styles.comboActionText}>Categories</Text></TouchableOpacity>
      </View>

      <View style={styles.filters}><TextInput value={search} onChangeText={setSearch} placeholder="Search menu" style={styles.searchInput} /><ScrollView horizontal showsHorizontalScrollIndicator={false}>{[['ALL', 'All'], ...categories.map(c => [c._id, c.name])].map(([id, label]) => <TouchableOpacity key={id} onPress={() => setCategoryFilter(id)} style={[styles.chip, categoryFilter === id && styles.chipActive]}><Text style={[styles.chipText, categoryFilter === id && styles.chipTextActive]}>{label}</Text></TouchableOpacity>)}</ScrollView></View>

      {!!loadError && <TouchableOpacity style={styles.errorBanner} onPress={fetchProducts}><Text style={styles.errorText}>{loadError} · Tap to retry</Text></TouchableOpacity>}

      {loading ? (
        <AdminLoadingState message="Loading menu inventory…" />
      ) : (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={visibleProducts}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.productCard}>
              <View style={styles.productMain}>
                <ProductImage uri={item.imageUrl} style={styles.productImage} fallbackIconSize={20} accessibilityLabel={item.name} />
                <View style={styles.cardInfo}>
                  <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.price} numberOfLines={2}>₹{item.price} · {typeof item.categoryId === 'object' ? item.categoryId?.name : 'Menu item'} · {item.isVeg === true ? 'Veg' : item.isVeg === false ? 'Non-veg' : 'Unclassified'} · {item.stock == null ? 'Unlimited stock' : `${item.stock} left`}</Text>
                  {!!item.description?.trim() && <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>}
                </View>
              </View>

              <View style={styles.productControls}>
                <View style={styles.switchRow}>
                  <Text style={[styles.switchLabel, item.available && styles.switchLabelActive]}>
                    {item.available ? 'AVAILABLE' : 'OFF'}
                  </Text>
                  <Switch
                    value={item.available === true}
                    disabled={busyId === item._id}
                    onValueChange={() => handleToggleAvailability(item._id, item.available)}
                    trackColor={{ false: '#767577', true: COLORS.primaryLight }}
                    thumbColor={item.available ? COLORS.primary : '#f4f3f4'}
                  />
                </View>

                <View style={styles.productActions}>
                  <TouchableOpacity
                    onPress={() => openEditModal(item)}
                    style={styles.deleteBtn}
                  >
                    <Edit2 size={18} color={COLORS.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteProduct(item._id)}
                    style={styles.deleteBtn}
                  >
                    <Trash2 size={18} color={COLORS.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />
      )}

      {/* Add / Edit Product Modal */}
      <AdminFormModal visible={modalVisible} onClose={() => setModalVisible(false)} onSave={handleSaveProduct} saving={saving} title={editingId ? 'Edit product' : 'Add new menu item'} saveTitle={editingId ? 'Save changes' : 'Save product'}>
        <Input label="Product Name" value={name} onChangeText={value => { setName(value); setFormErrors(previous => ({ ...previous, name: undefined })); }} placeholder="e.g. Paneer Wrap" error={formErrors.name} />
        <Input label="Price (₹)" value={price} onChangeText={value => { setPrice(value); setFormErrors(previous => ({ ...previous, price: undefined })); }} placeholder="e.g. 120" keyboardType="decimal-pad" error={formErrors.price} />
        <Input label="Stock quantity (blank = unlimited)" value={stock} onChangeText={value => { setStock(value); setFormErrors(previous => ({ ...previous, stock: undefined })); }} placeholder="e.g. 20" keyboardType="number-pad" error={formErrors.stock} />
        <Input label="Description (optional)" value={description} onChangeText={setDescription} placeholder="Add verified ingredients when available" />
        <Input label="Image URL (optional)" value={imageUrl} onChangeText={setImageUrl} placeholder="Add a product photo later" />
        <Text style={styles.formLabel}>Category (required)</Text>
        <View style={styles.categoryChoices}>{categories.map(category => <TouchableOpacity key={category._id} onPress={() => { setCategoryId(category._id); setFormErrors(previous => ({ ...previous, categoryId: undefined })); }} style={[styles.chip, categoryId === category._id && styles.chipActive]}><Text style={[styles.chipText, categoryId === category._id && styles.chipTextActive]}>{category.name}</Text></TouchableOpacity>)}</View>
        {formErrors.categoryId ? <Text accessibilityRole="alert" style={styles.formError}>{formErrors.categoryId}</Text> : null}
        <Text style={styles.formLabel}>Food type</Text>
        <View style={styles.categoryChoices}>
          {[[true, 'Veg'], [false, 'Non-veg'], [null, 'Unknown']].map(([value, label]) => <TouchableOpacity key={label} accessibilityRole="button" accessibilityState={{ selected: isVeg === value }} onPress={() => setIsVeg(value)} style={[styles.chip, isVeg === value && styles.chipActive]}><Text style={[styles.chipText, isVeg === value && styles.chipTextActive]}>{label}</Text></TouchableOpacity>)}
        </View>
        <View style={styles.formSwitch}><Text style={styles.formLabel}>Available to order</Text><Switch value={available} onValueChange={setAvailable} /></View>
        <Text style={styles.formLabel}>Add-ons · one per line as Name:price</Text>
        <TextInput value={addons} onChangeText={value => { setAddons(value); setFormErrors(previous => ({ ...previous, addons: undefined })); }} multiline placeholder={'Extra cheese:20\nJalapeños:15'} style={[styles.addonsInput, formErrors.addons && styles.formInputInvalid]} />
        {formErrors.addons ? <Text accessibilityRole="alert" style={styles.formError}>{formErrors.addons}</Text> : null}
      </AdminFormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filters: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  searchInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.textPrimary },
  chip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff', marginRight: 6 },
  chipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary }, chipText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '700' }, chipTextActive: { color: '#fff' },
  errorBanner: { marginHorizontal: 16, marginBottom: 10, backgroundColor: '#FCEBE8', borderRadius: 8, padding: 11 }, errorText: { color: '#9B3328', fontSize: 12 }, formError: { color: COLORS.danger, fontSize: 12, lineHeight: 16, marginTop: -6, marginBottom: 10, fontWeight: '700' }, formInputInvalid: { borderColor: COLORS.danger },
  countText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  comboHint: { marginHorizontal: 16, marginBottom: 10, padding: 12, gap: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF5EF', borderWidth: 1, borderColor: '#F3D9CB', borderRadius: 11 },
  comboTitle: { color: '#302F2D', fontSize: 14, fontWeight: '900' },
  comboCopy: { color: '#6F6A65', fontSize: 12, lineHeight: 17, marginTop: 3 },
  comboAction: { minHeight: 48, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E9D4C8' },
  comboActionText: { color: COLORS.primary, fontSize: 12, fontWeight: '900' },
  addBtn: {
    minHeight: 48,
    paddingHorizontal: 14,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  productCard: {
    flexDirection: 'column',
    alignItems: 'stretch',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  productMain: { flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  productImage: { width: 56, height: 56, borderRadius: 8, marginRight: 11, backgroundColor: '#EEE' },
  cardInfo: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  price: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    color: COLORS.primary,
    marginTop: 2,
  },
  desc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  productControls: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 10, paddingTop: 8 },
  productActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  switchLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSecondary,
  },
  switchLabelActive: {
    color: COLORS.primary,
  },
  deleteBtn: {
    width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#FFF8F4',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  formScroll: {
    marginBottom: 16,
  },
  formLabel: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 8, marginBottom: 6 },
  categoryChoices: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
  formSwitch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  addonsInput: { minHeight: 74, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 10, color: COLORS.textPrimary, textAlignVertical: 'top' },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalBtn: {
    flex: 1,
  },
});
