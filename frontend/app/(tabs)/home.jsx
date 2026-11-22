import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, BackHandler, FlatList, Keyboard, View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowDownUp, ChevronRight, Clock3, MapPin, SlidersHorizontal, Tag, Users } from 'lucide-react-native';
import { AuthContext } from '../../context/AuthContext';
import Header from '../../components/common/Header';
import ProductImage from '../../components/common/ProductImage';
import SearchBar from '../../components/common/SearchBar';
import CategoryCard from '../../components/category/CategoryCard';
import ProductCard from '../../components/product/ProductCard';
import ErrorState from '../../components/common/ErrorState';
import ProductListSkeleton from '../../components/common/ProductListSkeleton';
import AppDrawer from '../../components/navigation/AppDrawer';
import productService from '../../services/productService';
import categoryService from '../../services/categoryService';
import settingsService from '../../services/settingsService';
import COLORS from '../../constants/colors';
import THEME from '../../constants/theme';
import safeStorage from '../../services/safeStorage';
import orderService from '../../services/orderService';
import { SocketContext } from '../../context/SocketContext';
import { filterCatalogueProducts } from '../../utils/catalogFilter';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../../utils/reducedMotion';

const DIET_FILTERS = [
  { id: 'ALL', label: 'Everything' },
  { id: 'VEG', label: 'Veg' },
  { id: 'NON_VEG', label: 'Non-veg' },
];
const SORTS = [
  { field: 'createdAt', order: 'desc', label: 'Latest' },
  { field: 'price', order: 'asc', label: 'Price: low to high' },
  { field: 'price', order: 'desc', label: 'Price: high to low' },
  { field: 'name', order: 'asc', label: 'Name: A–Z' },
];
const PRICE_RANGES = [
  { id: 'ALL', label: 'Any price' },
  { id: 'UNDER_100', label: 'Under ₹100', maxPrice: 99 },
  { id: '100_200', label: '₹100–₹200', minPrice: 100, maxPrice: 200 },
  { id: 'OVER_200', label: '₹200+', minPrice: 200 },
];
const PROMO_BANNER_ROUTES = new Set(['/(tabs)/home', '/(tabs)/menu', '/group-order']);

export default function HomeScreen({ menuOnly = false }) {
  const router = useRouter();
  const routeParams = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { user } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);
  const { width } = useWindowDimensions();
  const productCardWidth = width >= 880 ? '48.7%' : '100%';
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [diet, setDiet] = useState('ALL');
  const [priceRange, setPriceRange] = useState('ALL');
  const [recentSearches, setRecentSearches] = useState([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [sortIndex, setSortIndex] = useState(0);
  const [categories, setCategories] = useState([]);
  const [catalogueProducts, setCatalogueProducts] = useState([]);
  const [popularProducts, setPopularProducts] = useState([]);
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [previouslyOrderedProducts, setPreviouslyOrderedProducts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [visibleProductCount, setVisibleProductCount] = useState(24);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const requestId = useRef(0);
  const menuRequestInFlight = useRef(false);
  const lastMenuLoadedAt = useRef(0);
  const promoCarouselRef = useRef(null);
  const categoryTransition = useRef(new Animated.Value(1)).current;
  const reduceMotion = useReducedMotion();
  const reduceMotionRef = useRef(reduceMotion);
  reduceMotionRef.current = reduceMotion;
  const [activePromoIndex, setActivePromoIndex] = useState(0);
  const [readyPickupOrder, setReadyPickupOrder] = useState(null);
  const [pendingPaymentOrder, setPendingPaymentOrder] = useState(null);
  const [activeGroupId, setActiveGroupId] = useState('');
  const readyOrderRefreshAt = useRef(0);
  const readyOrderRequestInFlight = useRef(false);
  const readyOrderAccountRef = useRef(user?._id);
  readyOrderAccountRef.current = user?._id;
  const requestedCategoryId = Array.isArray(routeParams.categoryId) ? routeParams.categoryId[0] : routeParams.categoryId;

  useEffect(() => {
    if (reduceMotion) categoryTransition.setValue(1);
  }, [categoryTransition, reduceMotion]);

  useEffect(() => {
    if (reduceMotionRef.current) { categoryTransition.setValue(1); return undefined; }
    categoryTransition.setValue(0.86);
    const animation = Animated.timing(categoryTransition, { toValue: 1, duration: 210, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  // Filter state already captures every visual change that should animate here.
  // Referencing `products` before its declaration caused a render-time TDZ crash.
  // Avoid animating on every keystroke; search remains immediate on slower phones.
  }, [categoryTransition, selectedCategory, diet, priceRange, sortIndex, loading, reduceMotion]);

  useEffect(() => {
    let active = true;
    safeStorage.getItem('wrapchik_recent_searches').then((value) => {
      if (!active || !value) return;
      try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) setRecentSearches(parsed.filter((term) => typeof term === 'string').slice(0, 6)); }
      catch { void safeStorage.removeItem('wrapchik_recent_searches'); }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (menuOnly) setSelectedCategory(requestedCategoryId ? String(requestedCategoryId) : null);
  }, [menuOnly, requestedCategoryId]);

  const fetchMenu = useCallback(async ({ refresh = false } = {}) => {
    if (menuRequestInFlight.current) return;
    menuRequestInFlight.current = true;
    if (refresh) productService.invalidateCatalogueCache();
    const thisRequest = ++requestId.current;
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [productResult, categoryResult, settingsResult, popularResult, recommendationResult] = await Promise.allSettled([
        productService.getProducts(),
        categoryService.getCategories(),
        menuOnly ? Promise.resolve(null) : settingsService.getSettings(),
        menuOnly ? Promise.resolve({ products: [] }) : productService.getPopularProducts(),
        !menuOnly && user?._id ? productService.getRecommendations(user._id) : Promise.resolve({ products: [] }),
      ]);
      if (thisRequest !== requestId.current) return;
      if (productResult.status !== 'fulfilled' || !Array.isArray(productResult.value?.products)) throw productResult.reason || new Error('The menu response was invalid.');
      setCatalogueProducts(productResult.value.products);
      setCategories(categoryResult.status === 'fulfilled' && Array.isArray(categoryResult.value?.categories) ? categoryResult.value.categories : []);
      setSettings(settingsResult.status === 'fulfilled' ? settingsResult.value?.settings || null : null);
      setPopularProducts(popularResult.status === 'fulfilled' && Array.isArray(popularResult.value?.products) ? popularResult.value.products : []);
      setRecommendedProducts(recommendationResult.status === 'fulfilled' && Array.isArray(recommendationResult.value?.products) ? recommendationResult.value.products : []);
      setPreviouslyOrderedProducts(recommendationResult.status === 'fulfilled' && Array.isArray(recommendationResult.value?.previouslyOrderedProducts) ? recommendationResult.value.previouslyOrderedProducts : []);
      setError(false);
    } catch (e) {
      if (thisRequest !== requestId.current) return;
      // A retryable inline state is shown to the customer; keep expected offline/API failures out of the red dev LogBox.
      console.warn('[HomeScreen Load Error]:', e);
      setCatalogueProducts([]);
      setPopularProducts([]);
      setRecommendedProducts([]);
      setPreviouslyOrderedProducts([]);
      setError(true);
    } finally {
      if (thisRequest === requestId.current) {
        lastMenuLoadedAt.current = Date.now();
        setLoading(false);
        setRefreshing(false);
      }
      menuRequestInFlight.current = false;
    }
  }, [menuOnly, user?._id]);

  const refreshReadyPickupOrder = useCallback(async ({ force = false } = {}) => {
    if (menuOnly || !user?._id) { setReadyPickupOrder(null); return; }
    if (readyOrderRequestInFlight.current || (!force && Date.now() - readyOrderRefreshAt.current < 60_000)) return;
    const accountId = user._id;
    readyOrderRefreshAt.current = Date.now();
    readyOrderRequestInFlight.current = true;
    try {
      const result = await orderService.getHomeOrderSummary();
      if (readyOrderAccountRef.current !== accountId) return;
      const readyOrder = result?.readyPickupOrder || null;
      const paymentOrders = Array.isArray(result?.pendingPaymentOrders) ? result.pendingPaymentOrders : [];
      const paymentRecoveryOrder = paymentOrders.find(order => !order.groupOrderId
        && order.orderStatus === 'PLACED'
        && ['RAZORPAY', 'CASHFREE', 'UPI_QR'].includes(order.paymentMethod)
        && order.paymentStatus !== 'SUCCESS'
        && order.paymentStatus !== 'CANCELLED'
        && !(order.paymentMethod === 'UPI_QR' && order.paymentId?.status === 'PENDING' && order.paymentId?.upiTransactionReference));
      setReadyPickupOrder(readyOrder || null);
      setPendingPaymentOrder(paymentRecoveryOrder || null);
    } catch (error) {
      console.warn('[Home pickup status] Keeping the last known server state after refresh failure:', error.message);
    } finally { readyOrderRequestInFlight.current = false; }
  }, [menuOnly, user?._id]);

  useEffect(() => {
    readyOrderRefreshAt.current = 0;
    setReadyPickupOrder(null);
    setPendingPaymentOrder(null);
  }, [user?._id]);

  useFocusEffect(useCallback(() => {
    if (menuOnly || !user?._id) { setActiveGroupId(''); return undefined; }
    let active = true;
    safeStorage.getItem(`wrapchik_active_group_${user._id}`).then(value => {
      if (active) setActiveGroupId(/^[a-f\d]{24}$/i.test(String(value || '')) ? String(value) : '');
    }).catch(() => { if (active) setActiveGroupId(''); });
    return () => { active = false; };
  }, [menuOnly, user?._id]));

  useFocusEffect(useCallback(() => {
    if (!lastMenuLoadedAt.current || Date.now() - lastMenuLoadedAt.current > 30_000) void fetchMenu({ refresh: Boolean(lastMenuLoadedAt.current) });
    void refreshReadyPickupOrder();
  }, [fetchMenu, refreshReadyPickupOrder]));

  useFocusEffect(useCallback(() => {
    if (menuOnly || !user?._id) return undefined;
    const refresh = () => { readyOrderRefreshAt.current = 0; void refreshReadyPickupOrder({ force: true }); };
    socket?.on('order_updated', refresh);
    const appStateSubscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { socket?.off('order_updated', refresh); appStateSubscription.remove(); };
  }, [menuOnly, refreshReadyPickupOrder, socket, user?._id]));

  useEffect(() => {
    if (!searchFocused) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setSearchFocused(false);
      setSearchQuery('');
      Keyboard.dismiss();
      return true;
    });
    return () => subscription.remove();
  }, [searchFocused]);

  const handleRefresh = () => fetchMenu({ refresh: true });
  const filteredCatalogueProducts = useMemo(() => filterCatalogueProducts(catalogueProducts, {
    search: '',
    category: selectedCategory,
    diet,
    priceRange,
    sort: SORTS[sortIndex],
  }), [catalogueProducts, selectedCategory, diet, priceRange, sortIndex]);
  const products = useMemo(() => searchQuery.trim()
    ? filterCatalogueProducts(filteredCatalogueProducts, { search: searchQuery, sort: null })
    : filteredCatalogueProducts, [filteredCatalogueProducts, searchQuery]);
  const visibleProducts = useMemo(() => products.slice(0, visibleProductCount), [products, visibleProductCount]);
  useEffect(() => { setVisibleProductCount(24); }, [searchQuery, selectedCategory, diet, priceRange, sortIndex]);
  const sortLabel = SORTS[sortIndex].label;
  const closed = settings?.acceptingOrders === false;
  const promoBanners = useMemo(() => {
    const configured = Array.isArray(settings?.promoBanners) && settings.promoBanners.length
      ? settings.promoBanners
      : settings?.promoBanner?.enabled ? [settings.promoBanner] : [];
    const now = Date.now();
    return configured.filter(banner => {
      if (banner?.enabled !== true || !banner.title || !banner.message) return false;
      const startsAt = banner.activeFrom ? new Date(banner.activeFrom).getTime() : -Infinity;
      const endsAt = banner.activeUntil ? new Date(banner.activeUntil).getTime() : Infinity;
      return Number.isFinite(startsAt) || startsAt === -Infinity
        ? (Number.isFinite(endsAt) || endsAt === Infinity) && startsAt <= now && now < endsAt
        : false;
    }).sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
  }, [settings]);
  const promoCardWidth = Math.min(Math.max(width - 40, 280), 650);
  const promoStep = promoCardWidth + 12;
  useEffect(() => setActivePromoIndex(0), [promoBanners.length]);
  const prepMinutes = settings?.estimatedPrepMinutes;
  const greeting = user?.name?.trim()?.split(/\s+/)[0] || 'there';
  const recordRecentSearch = () => {
    const term = searchQuery.trim();
    if (!term) return;
    const next = [term, ...recentSearches.filter(recent => recent.toLowerCase() !== term.toLowerCase())].slice(0, 6);
    setRecentSearches(next);
    void safeStorage.setItem('wrapchik_recent_searches', JSON.stringify(next));
  };
  const cancelSearch = () => {
    setSearchQuery('');
    setSearchFocused(false);
    Keyboard.dismiss();
  };
  const selectCategory = categoryId => {
    if (menuOnly) setSelectedCategory(categoryId || null);
    else router.push({ pathname: '/(tabs)/menu', params: categoryId ? { categoryId: String(categoryId) } : {} });
  };
  const searchListHeader = searchQuery.trim()
    ? <Text style={styles.searchResultCount}>{products.length} {products.length === 1 ? 'item' : 'items'} found</Text>
    : null;
  const searchEmptyState = loading && !catalogueProducts.length
    ? <View style={styles.searchSkeleton} accessibilityLabel="Loading search results" accessibilityRole="progressbar">{[0, 1, 2].map(index => <View key={index} style={styles.searchSkeletonRow}><View style={styles.searchSkeletonImage} /><View style={styles.searchSkeletonCopy}><View style={styles.searchSkeletonLine} /><View style={[styles.searchSkeletonLine, styles.searchSkeletonShort]} /></View></View>)}</View>
    : error && !catalogueProducts.length
      ? <View style={styles.searchEmpty}><Text style={styles.searchEmptyTitle}>Menu unavailable</Text><Text style={styles.searchEmptyCopy}>Check your connection and retry. Search will use the current catalogue when it is available.</Text><TouchableOpacity onPress={handleRefresh} accessibilityRole="button" style={styles.searchEmptyAction}><Text style={styles.searchEmptyActionText}>Retry menu</Text></TouchableOpacity></View>
      : !searchQuery.trim()
        ? <View style={styles.searchEmpty}><Text style={styles.searchEmptyTitle}>What are you craving?</Text><Text style={styles.searchEmptyCopy}>Search wraps, burgers, drinks and more.</Text>{recentSearches.length ? <View style={styles.recentSearches}><Text style={styles.recentTitle}>Recent searches</Text>{recentSearches.map(term => <TouchableOpacity key={term} onPress={() => setSearchQuery(term)} style={styles.recentChip} accessibilityRole="button" accessibilityLabel={`Search again for ${term}`}><Text style={styles.recentText}>{term}</Text></TouchableOpacity>)}</View> : null}</View>
        : <View style={styles.searchEmpty}><Text style={styles.searchEmptyTitle}>No matching items</Text><Text style={styles.searchEmptyCopy}>Try another name or clear a category, dietary or price filter.</Text><TouchableOpacity onPress={() => { setSelectedCategory(null); setDiet('ALL'); setPriceRange('ALL'); }} accessibilityRole="button" style={styles.searchEmptyAction}><Text style={styles.searchEmptyActionText}>Clear filters</Text></TouchableOpacity></View>;

  return (
    <View style={styles.container}>
      <Header title={searchFocused ? 'Search' : menuOnly ? 'Menu' : undefined} showMenu={!searchFocused} showCart={!searchFocused} showNotifications={!searchFocused} onMenuPress={() => setDrawerOpen(true)} />
      <View style={styles.searchToolbar}>
        <SearchBar value={searchQuery} onChangeText={setSearchQuery} onFocus={() => setSearchFocused(true)} onKeyPress={event => { if (event?.nativeEvent?.key === 'Escape') cancelSearch(); }} onSubmitEditing={recordRecentSearch} onClear={() => setSearchQuery('')} style={styles.searchWrap} />
        {searchFocused ? <TouchableOpacity onPress={cancelSearch} style={styles.searchCancel} accessibilityRole="button" accessibilityLabel="Cancel search"><Text style={styles.searchCancelText}>Cancel</Text></TouchableOpacity> : null}
      </View>

      {searchFocused ? <>
        <View style={styles.searchFilterPanel}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={styles.searchFilterRow} accessibilityLabel="Filter by category">
            <TouchableOpacity onPress={() => setSelectedCategory(null)} style={[styles.filterChip, !selectedCategory && styles.filterChipActive]} accessibilityRole="button" accessibilityState={{ selected: !selectedCategory }}><Text style={[styles.filterText, !selectedCategory && styles.filterTextActive]}>All categories</Text></TouchableOpacity>
            {categories.map(category => <TouchableOpacity key={category._id} onPress={() => setSelectedCategory(String(category._id))} style={[styles.filterChip, selectedCategory === String(category._id) && styles.filterChipActive]} accessibilityRole="button" accessibilityState={{ selected: selectedCategory === String(category._id) }}><Text style={[styles.filterText, selectedCategory === String(category._id) && styles.filterTextActive]} numberOfLines={1}>{category.name}</Text></TouchableOpacity>)}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={styles.searchFilterRow} accessibilityLabel="Filter by diet and price">
            {DIET_FILTERS.map(filter => <TouchableOpacity key={filter.id} onPress={() => setDiet(filter.id)} style={[styles.filterChip, diet === filter.id && styles.filterChipActive]} accessibilityRole="button" accessibilityState={{ selected: diet === filter.id }}><Text style={[styles.filterText, diet === filter.id && styles.filterTextActive]}>{filter.label}</Text></TouchableOpacity>)}
            <View style={styles.filterDivider} />
            {PRICE_RANGES.map(range => <TouchableOpacity key={range.id} onPress={() => setPriceRange(range.id)} style={[styles.filterChip, priceRange === range.id && styles.filterChipActive]} accessibilityRole="button" accessibilityState={{ selected: priceRange === range.id }}><Text style={[styles.filterText, priceRange === range.id && styles.filterTextActive]}>{range.label}</Text></TouchableOpacity>)}
          </ScrollView>
        </View>
        <FlatList
          data={searchQuery.trim() ? products : []}
          keyExtractor={item => String(item._id)}
          renderItem={({ item }) => <ProductCard compact product={item} onPress={() => router.push(`/product/${item._id}`)} />}
          ListHeaderComponent={searchListHeader}
          ListEmptyComponent={searchEmptyState}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          initialNumToRender={7}
          maxToRenderPerBatch={8}
          windowSize={7}
          updateCellsBatchingPeriod={40}
          contentContainerStyle={[styles.searchResultsContent, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}
        />
      </> : <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[COLORS.primary]} />}
      >
        {menuOnly ? <>
          <View style={styles.menuIntro}><Text style={styles.menuIntroTitle}>Explore the menu</Text><Text style={styles.menuIntroCopy}>Fresh campus favourites, ready to order.</Text></View>
          <View style={styles.section}>
            <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Categories</Text></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
              <CategoryCard category={{ _id: null, name: 'All items' }} isSelected={!selectedCategory} onPress={() => selectCategory(null)} />
              {categories.map(category => <CategoryCard key={category._id} category={category} isSelected={selectedCategory === String(category._id)} onPress={() => selectCategory(category._id)} />)}
            </ScrollView>
          </View>
        </> : <>
          <View style={styles.hero}>
            <View style={styles.heroTopline}>
              <View style={styles.locationPill}><MapPin size={14} color={COLORS.primary} /><Text style={styles.locationText}>TIET · SAC COUNTER</Text></View>
              {prepMinutes ? <View style={styles.timePill}><Clock3 size={14} color={COLORS.textSecondary} /><Text style={styles.timeText}>~{prepMinutes} min</Text></View> : null}
              {settings?.acceptingOrders === true ? <View style={styles.openBanner}><View style={styles.openDot} /><Text style={styles.openBannerText}>Accepting orders</Text></View> : settings?.acceptingOrders === false ? <View style={styles.closedPill}><Text style={styles.closedPillText}>Closed</Text></View> : null}
            </View>
            <Text style={styles.heroTitle}>Hey {greeting}, <Text style={styles.heroAccent}>what sounds good?</Text></Text>
          </View>

          {readyPickupOrder ? <TouchableOpacity onPress={() => router.push(`/order-tracking/${readyPickupOrder._id}`)} style={styles.priorityCard} activeOpacity={0.78} accessibilityRole="button" accessibilityLabel={`Order ${readyPickupOrder.orderNumber} is ready. Show pickup QR`}>
            <View style={styles.priorityIcon}><MapPin size={19} color="#28764A" /></View><View style={styles.priorityCopy}><Text style={styles.priorityEyebrow}>READY FOR PICKUP</Text><Text style={styles.priorityTitle}>Order #{readyPickupOrder.orderNumber}</Text><Text style={styles.prioritySub}>Your pickup QR is ready</Text></View><ChevronRight size={19} color="#28764A" />
          </TouchableOpacity> : pendingPaymentOrder ? <TouchableOpacity onPress={() => router.push({ pathname: '/payment', params: { orderId: pendingPaymentOrder._id, orderNumber: pendingPaymentOrder.orderNumber } })} style={styles.priorityCard} activeOpacity={0.78} accessibilityRole="button" accessibilityLabel={`Complete payment for order ${pendingPaymentOrder.orderNumber}`}>
            <View style={[styles.priorityIcon, styles.paymentPriorityIcon]}><Clock3 size={19} color={COLORS.primary} /></View><View style={styles.priorityCopy}><Text style={styles.priorityEyebrow}>PAYMENT NEEDED</Text><Text style={styles.priorityTitle}>Order #{pendingPaymentOrder.orderNumber}</Text><Text style={styles.prioritySub}>Continue payment securely</Text></View><ChevronRight size={19} color={COLORS.primary} />
          </TouchableOpacity> : null}

          {activeGroupId ? <TouchableOpacity onPress={() => router.push({ pathname: '/group-order', params: { groupId: activeGroupId } })} style={styles.groupResumeCard} activeOpacity={0.78} accessibilityRole="button" accessibilityLabel="Resume your active Share a Meal group">
            <View style={styles.priorityIcon}><Users size={19} color={COLORS.primary} /></View><View style={styles.priorityCopy}><Text style={styles.priorityTitle}>Your Share a Meal group</Text><Text style={styles.prioritySub}>Resume the group saved to your account</Text></View><Text style={styles.resumeLabel}>Resume</Text>
          </TouchableOpacity> : null}

          {promoBanners.length > 0 ? <>
            <ScrollView ref={promoCarouselRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.promoCarousel} snapToInterval={promoStep} decelerationRate="fast" onMomentumScrollEnd={event => setActivePromoIndex(Math.max(0, Math.min(promoBanners.length - 1, Math.round(event.nativeEvent.contentOffset.x / promoStep))))}>
              {promoBanners.map((banner, index) => {
                const destination = PROMO_BANNER_ROUTES.has(banner.ctaRoute) ? banner.ctaRoute : '/(tabs)/menu';
                return <View key={banner._id || `promo-${index}`} style={[styles.promoCard, { width: promoCardWidth }]}>
                  {banner.imageUrl ? <ProductImage uri={banner.imageUrl} style={styles.promoImage} fallbackIconSize={22} accessibilityLabel={`${banner.title} promotional image`} /> : null}
                  <View style={styles.promoBody}><View style={styles.promoCopy}><Text style={styles.promoTitle} numberOfLines={1}>{banner.title}</Text><Text style={styles.promoMessage} numberOfLines={2}>{banner.message}</Text></View><TouchableOpacity onPress={() => router.push(destination)} style={styles.promoButton} activeOpacity={0.76} accessibilityRole="button" accessibilityLabel={banner.ctaLabel || `Explore ${banner.title}`}><Text style={styles.promoButtonText}>{banner.ctaLabel || 'Explore'}</Text></TouchableOpacity></View>
                </View>;
              })}
            </ScrollView>
            {promoBanners.length > 1 ? <View style={styles.promoIndicators} accessibilityLabel={`Promotion ${activePromoIndex + 1} of ${promoBanners.length}`}>{promoBanners.map((banner, index) => <TouchableOpacity key={banner._id || `promo-dot-${index}`} onPress={() => { setActivePromoIndex(index); promoCarouselRef.current?.scrollTo({ x: index * promoStep, animated: !reduceMotionRef.current }); }} style={styles.promoIndicatorButton} accessibilityRole="button" accessibilityLabel={`Show promotion ${index + 1}`} accessibilityState={{ selected: activePromoIndex === index }}><View style={[styles.promoIndicator, activePromoIndex === index && styles.promoIndicatorActive]} /></TouchableOpacity>)}</View> : null}
          </> : null}

          <View style={styles.quickLinks}>
            <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/offers')} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="See current deals and offers"><Tag size={16} color={COLORS.primary} /><Text style={styles.quickLinkText}>Deals & offers</Text><ChevronRight size={16} color={COLORS.primary} /></TouchableOpacity>
            <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/meal-plans')} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Open saved meal plans and reminders"><Clock3 size={16} color={COLORS.primary} /><Text style={styles.quickLinkText}>Meal plans</Text><ChevronRight size={16} color={COLORS.primary} /></TouchableOpacity>
          </View>
        </>}

        {!menuOnly ? <View style={styles.section}>
          <View style={styles.sectionHeading}><View><Text style={styles.sectionEyebrow}>PICK A CRAVING</Text><Text style={styles.sectionTitle}>Categories</Text></View><TouchableOpacity style={styles.textLink} onPress={() => router.push('/(tabs)/menu')} accessibilityRole="button" accessibilityLabel="View the full menu"><Text style={styles.textLinkLabel}>Full menu</Text></TouchableOpacity></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
            <CategoryCard category={{ _id: null, name: 'All items' }} isSelected={false} onPress={() => selectCategory(null)} />
            {categories.map(category => <CategoryCard key={category._id} category={category} isSelected={false} onPress={() => selectCategory(category._id)} />)}
          </ScrollView>
        </View> : null}

        {!menuOnly && popularProducts.length ? <View style={styles.section}>
          <View style={styles.sectionHeading}><View><Text style={styles.sectionEyebrow}>PAID ORDERS · LAST 30 DAYS</Text><Text style={styles.sectionTitle}>Popular on campus</Text></View></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recommendationRow}>{popularProducts.slice(0, 8).map(product => <TouchableOpacity key={product._id} onPress={() => router.push(`/product/${product._id}`)} style={styles.recommendationCard} accessibilityRole="button" accessibilityLabel={`Popular item ${product.name}, ${product.totalQuantity} sold in the last 30 days`}><ProductImage uri={product.imageUrl} style={styles.featuredImage} fallbackIconSize={22} accessibilityLabel={product.name} /><View style={styles.featuredOverlay}><View style={styles.featuredCopy}><Text style={styles.featuredName} numberOfLines={2}>{product.name}</Text><Text style={styles.popularCount}>{product.totalQuantity} sold</Text></View><Text style={styles.featuredPrice}>₹{product.price}</Text></View></TouchableOpacity>)}</ScrollView>
        </View> : null}

        {!menuOnly && user?._id && previouslyOrderedProducts.length ? <View style={styles.section}>
          <View style={styles.sectionHeading}><View><Text style={styles.sectionEyebrow}>FROM YOUR ORDER HISTORY</Text><Text style={styles.sectionTitle}>Order again</Text></View></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.orderAgainRow}>{previouslyOrderedProducts.slice(0, 8).map(product => <View key={product._id} style={[styles.orderAgainCard, { width: Math.min(Math.max(width * 0.72, 240), 300) }]}><ProductCard compact product={product} onPress={() => router.push(`/product/${product._id}`)} /></View>)}</ScrollView>
        </View> : null}

        {!menuOnly ? <TouchableOpacity style={styles.shareMealCta} onPress={() => router.push('/group-order')} activeOpacity={0.78} accessibilityRole="button" accessibilityLabel="Share a Meal with friends">
          <View style={styles.shareMealIcon}><Users size={18} color={COLORS.primary} /></View><View style={styles.shareMealCopy}><Text style={styles.shareMealTitle}>Share a Meal</Text><Text style={styles.shareMealSubtitle}>Build one group cart and order together</Text></View><ChevronRight size={19} color="#FFFFFF" />
        </TouchableOpacity> : null}

        {!menuOnly && recommendedProducts.length ? <View style={styles.section}>
          <View style={styles.sectionHeading}><View><Text style={styles.sectionEyebrow}>BASED ON COMPLETED ORDERS</Text><Text style={styles.sectionTitle}>Picked for you</Text></View></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recommendationRow}>{recommendedProducts.slice(0, 8).map(product => <TouchableOpacity key={product._id} onPress={() => router.push(`/product/${product._id}`)} style={styles.recommendationCard} accessibilityRole="button" accessibilityLabel={`Recommended: ${product.name}`}><ProductImage uri={product.imageUrl} style={styles.featuredImage} fallbackIconSize={22} accessibilityLabel={product.name} /><View style={styles.featuredOverlay}><Text style={styles.featuredName} numberOfLines={2}>{product.name}</Text><Text style={styles.featuredPrice}>₹{product.price}</Text></View></TouchableOpacity>)}</ScrollView>
        </View> : null}

        {menuOnly ? <View style={styles.menuSection}>
          <View style={styles.menuHeading}><View><Text style={styles.sectionEyebrow}>THE WRAPCHIK MENU</Text><Text style={styles.sectionTitle}>{selectedCategory ? (categories.find(category => String(category._id) === String(selectedCategory))?.name || 'Your selection') : 'All items'}</Text></View><TouchableOpacity style={styles.sortButton} onPress={() => setSortIndex((sortIndex + 1) % SORTS.length)} accessibilityRole="button" accessibilityLabel={`Sort menu. Current: ${sortLabel}`}><ArrowDownUp size={15} color={COLORS.textPrimary} /><Text style={styles.sortText}>{sortLabel}</Text></TouchableOpacity></View>
          <View style={styles.filtersRow}><SlidersHorizontal size={15} color={COLORS.textSecondary} />{DIET_FILTERS.map(filter => <TouchableOpacity key={filter.id} onPress={() => setDiet(filter.id)} style={[styles.filterChip, diet === filter.id && styles.filterChipActive]} accessibilityRole="button" accessibilityState={{ selected: diet === filter.id }}><Text style={[styles.filterText, diet === filter.id && styles.filterTextActive]}>{filter.label}</Text></TouchableOpacity>)}</View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.priceFilters}>{PRICE_RANGES.map(range => <TouchableOpacity key={range.id} onPress={() => setPriceRange(range.id)} style={[styles.filterChip, priceRange === range.id && styles.filterChipActive]} accessibilityRole="button" accessibilityState={{ selected: priceRange === range.id }}><Text style={[styles.filterText, priceRange === range.id && styles.filterTextActive]}>{range.label}</Text></TouchableOpacity>)}</ScrollView>
          <Animated.View style={{ opacity: categoryTransition, transform: [{ translateY: categoryTransition.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }] }}>
            {error && !catalogueProducts.length ? <ErrorState title="Menu unavailable" message="Your cart is safe. Check your connection and retry." onRetry={handleRefresh} retrying={refreshing} /> : loading && !refreshing ? <ProductListSkeleton count={2} /> : products.length === 0 ? <View style={styles.menuEmpty}><Text style={styles.menuEmptyTitle}>No dishes match these filters</Text><Text style={styles.menuEmptyCopy}>Try another category, dietary option or price range.</Text><TouchableOpacity onPress={() => { setSelectedCategory(null); setDiet('ALL'); setPriceRange('ALL'); }} style={styles.clearFiltersButton} accessibilityRole="button"><Text style={styles.clearFiltersText}>Clear filters</Text></TouchableOpacity></View> : <View style={styles.productList}>{visibleProducts.map(item => <View key={item._id} style={[styles.productCell, { width: productCardWidth }]}><ProductCard compact product={item} onPress={() => router.push(`/product/${item._id}`)} /></View>)}</View>}
            {!error && !loading && products.length > visibleProducts.length ? <TouchableOpacity onPress={() => setVisibleProductCount(count => Math.min(count + 24, products.length))} style={styles.moreProductsButton} accessibilityRole="button" accessibilityLabel={`Show more products, ${products.length - visibleProducts.length} remaining`}><Text style={styles.moreProductsText}>Show more · {products.length - visibleProducts.length} remaining</Text></TouchableOpacity> : null}
          </Animated.View>
        </View> : null}
        {!menuOnly ? <TouchableOpacity style={styles.fullMenuLink} onPress={() => router.push('/(tabs)/menu')} accessibilityRole="button"><Text style={styles.fullMenuLinkText}>Browse the full menu</Text><ChevronRight size={17} color={COLORS.primary} /></TouchableOpacity> : null}
      </ScrollView>}
      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  searchToolbar: { minHeight: 54, paddingHorizontal: 14, paddingTop: 3, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.background },
  searchWrap: { flex: 1, minWidth: 0, marginHorizontal: 0, marginVertical: 0, height: 46, borderRadius: 14, paddingHorizontal: 12, shadowOpacity: 0, elevation: 0 },
  searchCancel: { minWidth: 52, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  searchCancelText: { color: COLORS.primary, fontSize: 13, fontWeight: '800' },
  searchFilterPanel: { paddingTop: 2, paddingBottom: 3, backgroundColor: COLORS.background },
  searchFilterRow: { paddingHorizontal: 14, paddingVertical: 3, alignItems: 'center', gap: 7 },
  filterDivider: { width: 1, height: 22, backgroundColor: COLORS.border, marginHorizontal: 2 },
  searchResultsContent: { paddingHorizontal: 14, paddingTop: 5, maxWidth: 760, width: '100%', alignSelf: 'center' },
  searchResultCount: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 7, marginLeft: 2 },
  searchEmpty: { flex: 1, minHeight: 180, alignItems: 'center', justifyContent: 'center', padding: 18, marginTop: 7, borderRadius: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border },
  searchEmptyTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '900', textAlign: 'center' },
  searchEmptyCopy: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 5 },
  searchEmptyAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10, marginTop: 8 },
  searchEmptyActionText: { color: COLORS.primary, fontSize: 13, fontWeight: '900' },
  recentSearches: { width: '100%', marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 },
  recentTitle: { width: '100%', color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },
  recentChip: { paddingHorizontal: 11, paddingVertical: 6, minHeight: 40, justifyContent: 'center', borderRadius: THEME.radius.pill, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border },
  recentText: { color: COLORS.textPrimary, fontSize: 11, fontWeight: '700' },
  searchSkeleton: { gap: 8 },
  searchSkeletonRow: { minHeight: 86, padding: 8, borderRadius: 13, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border, gap: 10 },
  searchSkeletonImage: { width: 68, height: 68, borderRadius: 11, backgroundColor: '#EEEAE6' },
  searchSkeletonCopy: { flex: 1, gap: 10 },
  searchSkeletonLine: { height: 11, width: '72%', borderRadius: 6, backgroundColor: '#EEEAE6' },
  searchSkeletonShort: { width: '38%' },
  scrollContent: { paddingBottom: 24, maxWidth: THEME.layout.pageMaxWidth, width: '100%', alignSelf: 'center' },
  hero: { paddingHorizontal: THEME.layout.pageGutter, paddingTop: 8, paddingBottom: 8 },
  heroTopline: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  locationPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border, borderRadius: THEME.radius.pill, paddingHorizontal: 9, minHeight: 30 },
  locationText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.35, color: COLORS.textPrimary },
  timePill: { flexDirection: 'row', gap: 4, alignItems: 'center', paddingHorizontal: 8, minHeight: 30, borderRadius: THEME.radius.pill, backgroundColor: COLORS.surfaceMuted },
  timeText: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary },
  heroTitle: { color: COLORS.textPrimary, fontSize: 24, lineHeight: 29, fontWeight: '900' },
  heroAccent: { color: COLORS.primary },
  menuIntro: { paddingHorizontal: THEME.layout.pageGutter, paddingTop: 8 },
  menuIntroTitle: { color: COLORS.textPrimary, fontSize: 22, lineHeight: 27, fontWeight: '900' },
  menuIntroCopy: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
  closedPill: { minHeight: 30, paddingHorizontal: 9, justifyContent: 'center', borderRadius: THEME.radius.pill, backgroundColor: COLORS.warningLight },
  closedPillText: { color: '#84500A', fontSize: 10, fontWeight: '800' },
  openBanner: { alignSelf: 'flex-start', minHeight: 30, borderRadius: 16, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E8F7EE' },
  openDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#21874A' },
  openBannerText: { color: '#22663D', fontSize: 10, fontWeight: '800' },
  priorityCard: { marginHorizontal: THEME.layout.pageGutter, marginTop: 7, minHeight: 70, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 14, backgroundColor: '#ECF8EF', borderWidth: 1, borderColor: '#B8E0C2', flexDirection: 'row', alignItems: 'center', gap: 10 },
  paymentPriorityIcon: { backgroundColor: '#FFF1E9' },
  priorityIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  priorityCopy: { flex: 1, minWidth: 0, gap: 2 },
  priorityEyebrow: { color: '#267142', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  priorityTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '900' },
  prioritySub: { color: COLORS.textSecondary, fontSize: 11 },
  groupResumeCard: { marginHorizontal: THEME.layout.pageGutter, marginTop: 7, minHeight: 64, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 14, backgroundColor: '#FFF2EA', borderWidth: 1, borderColor: '#F4D6C8', flexDirection: 'row', alignItems: 'center', gap: 9 },
  resumeLabel: { color: COLORS.primary, fontSize: 12, fontWeight: '900' },
  promoCarousel: { paddingHorizontal: THEME.layout.pageGutter, paddingTop: 9, paddingBottom: 2, gap: 10 },
  promoCard: { minHeight: 70, borderRadius: 14, overflow: 'hidden', backgroundColor: '#302F2D', borderWidth: 1, borderColor: COLORS.border },
  promoImage: { width: '100%', height: 100, backgroundColor: COLORS.surfaceMuted },
  promoBody: { paddingHorizontal: 10, paddingVertical: 8, minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 9 },
  promoIndicators: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', justifyContent: 'center', minHeight: 26, gap: 2 },
  promoIndicatorButton: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  promoIndicator: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#D7C9C1' },
  promoIndicatorActive: { width: 20, backgroundColor: COLORS.primary },
  promoCopy: { flex: 1, minWidth: 0 }, promoTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' }, promoMessage: { color: '#E8E2DE', fontSize: 11, lineHeight: 15, marginTop: 2 },
  promoButton: { minHeight: 40, minWidth: 64, paddingHorizontal: 10, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' }, promoButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  quickLinks: { flexDirection: 'row', paddingHorizontal: THEME.layout.pageGutter, gap: 8, marginTop: 8 },
  quickLink: { flex: 1, minWidth: 0, minHeight: 46, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 7 },
  quickLinkText: { flex: 1, color: COLORS.textPrimary, fontSize: 12, fontWeight: '800' },
  shareMealCta: { marginHorizontal: THEME.layout.pageGutter, marginTop: 13, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 14, backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', minHeight: 60, gap: 10 },
  shareMealIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  shareMealCopy: { flex: 1, minWidth: 0 },
  shareMealTitle: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  shareMealSubtitle: { color: '#FFF4EF', fontSize: 11, marginTop: 2 },
  section: { marginTop: 17 },
  sectionHeading: { paddingHorizontal: THEME.layout.pageGutter, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 },
  sectionEyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1.4, color: COLORS.primary, marginBottom: 4 },
  sectionTitle: { fontSize: 18, lineHeight: 22, fontWeight: '900', color: COLORS.textPrimary },
  textLink: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 6 }, textLinkLabel: { color: COLORS.primary, fontSize: 12, fontWeight: '800' },
  categoryList: { paddingHorizontal: THEME.layout.pageGutter, paddingBottom: 2 },
  recommendationRow: { paddingHorizontal: THEME.layout.pageGutter, gap: 9 }, recommendationCard: { width: 176, height: 132, borderRadius: 14, overflow: 'hidden', backgroundColor: COLORS.surfaceMuted },
  orderAgainRow: { paddingHorizontal: THEME.layout.pageGutter, gap: 8 },
  orderAgainCard: { minWidth: 240 },
  featuredImage: { width: '100%', height: '100%' }, imageFallback: { alignItems: 'center', justifyContent: 'center' },
  featuredOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 50, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: 'rgba(25, 28, 32, 0.82)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  featuredCopy: { flex: 1, minWidth: 0 },
  featuredName: { flex: 1, color: '#FFFFFF', fontSize: 12, lineHeight: 15, fontWeight: '800' }, featuredPrice: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  popularCount: { color: '#F6D5C8', fontSize: 10, fontWeight: '700', marginTop: 1 },
  menuSection: { marginTop: 14 },
  menuHeading: { paddingHorizontal: THEME.layout.pageGutter, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  sortButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, minHeight: 38, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, backgroundColor: '#FFFFFF' },
  sortText: { fontSize: 10, fontWeight: '700', color: COLORS.textPrimary },
  filtersRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: THEME.layout.pageGutter, marginBottom: 7 },
  priceFilters: { paddingHorizontal: THEME.layout.pageGutter, gap: 6, marginBottom: 8 },
  filterChip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 10, borderRadius: THEME.radius.pill, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#FFFFFF' },
  filterChipActive: { backgroundColor: COLORS.textPrimary, borderColor: COLORS.textPrimary },
  filterText: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary }, filterTextActive: { color: '#FFFFFF' },
  productList: { paddingHorizontal: THEME.layout.pageGutter, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  menuEmpty: { marginHorizontal: THEME.layout.pageGutter, padding: 16, alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border, borderRadius: 14 },
  menuEmptyTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '900', textAlign: 'center' },
  menuEmptyCopy: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 4 },
  clearFiltersButton: { minHeight: 44, paddingHorizontal: 10, justifyContent: 'center' },
  clearFiltersText: { color: COLORS.primary, fontSize: 12, fontWeight: '900' },
  moreProductsButton: { marginHorizontal: THEME.layout.pageGutter, marginTop: 7, minHeight: 44, borderRadius: 11, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  moreProductsText: { color: COLORS.primaryDark, fontSize: 12, fontWeight: '800' },
  productCell: { minWidth: 0 },
  fullMenuLink: { minHeight: 46, marginHorizontal: THEME.layout.pageGutter, marginTop: 13, marginBottom: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fullMenuLinkText: { color: COLORS.primary, fontSize: 13, fontWeight: '900' },
});
