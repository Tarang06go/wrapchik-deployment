import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Image, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowDownUp, ChevronRight, Clock3, ShoppingBag, SlidersHorizontal, Sparkles, Tag } from 'lucide-react-native';
import { AuthContext } from '../../context/AuthContext';
import { CartContext } from '../../context/CartContext';
import Header from '../../components/common/Header';
import ProductImage from '../../components/common/ProductImage';
import SearchBar from '../../components/common/SearchBar';
import CategoryCard from '../../components/category/CategoryCard';
import ProductCard from '../../components/product/ProductCard';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import ProductListSkeleton from '../../components/common/ProductListSkeleton';
import AppDrawer from '../../components/navigation/AppDrawer';
import productService from '../../services/productService';
import categoryService from '../../services/categoryService';
import settingsService from '../../services/settingsService';
import COLORS from '../../constants/colors';
import THEME from '../../constants/theme';
import safeStorage from '../../services/safeStorage';

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
  const { user } = useContext(AuthContext);
  const { cartCount } = useContext(CartContext);
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
  const [products, setProducts] = useState([]);
  const [popularProducts, setPopularProducts] = useState([]);
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [previouslyOrderedProducts, setPreviouslyOrderedProducts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const requestId = useRef(0);
  const promoCarouselRef = useRef(null);
  const [activePromoIndex, setActivePromoIndex] = useState(0);

  useEffect(() => {
    let active = true;
    safeStorage.getItem('wrapchik_recent_searches').then((value) => {
      if (!active || !value) return;
      try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) setRecentSearches(parsed.filter((term) => typeof term === 'string').slice(0, 6)); }
      catch { void safeStorage.removeItem('wrapchik_recent_searches'); }
    });
    return () => { active = false; };
  }, []);

  const fetchMenu = useCallback(async ({ refresh = false } = {}) => {
    const thisRequest = ++requestId.current;
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const sort = SORTS[sortIndex];
      const params = {
        search: searchQuery.trim() || undefined,
        category: selectedCategory || undefined,
        veg: diet === 'ALL' ? undefined : String(diet === 'VEG'),
        sortBy: sort.field,
        sortOrder: sort.order,
        ...(PRICE_RANGES.find((range) => range.id === priceRange)?.minPrice !== undefined ? { minPrice: PRICE_RANGES.find((range) => range.id === priceRange).minPrice } : {}),
        ...(PRICE_RANGES.find((range) => range.id === priceRange)?.maxPrice !== undefined ? { maxPrice: PRICE_RANGES.find((range) => range.id === priceRange).maxPrice } : {}),
      };
      const productResult = await productService.getProducts(params);
      if (thisRequest !== requestId.current) return;
      if (!Array.isArray(productResult?.products)) throw new Error('The menu response was invalid.');
      const [categoryResult, settingsResult, popularResult, recommendationResult] = await Promise.allSettled([
        categoryService.getCategories(),
        menuOnly ? Promise.resolve(null) : settingsService.getSettings(),
        menuOnly ? Promise.resolve({ products: [] }) : productService.getPopularProducts(),
        !menuOnly && user?._id ? productService.getRecommendations() : Promise.resolve({ products: [] }),
      ]);
      if (thisRequest !== requestId.current) return;
      setProducts(productResult.products);
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
      setProducts([]);
      setPopularProducts([]);
      setRecommendedProducts([]);
      setPreviouslyOrderedProducts([]);
      setError(true);
    } finally {
      if (thisRequest === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [diet, menuOnly, priceRange, searchQuery, selectedCategory, sortIndex, user?._id]);

  useEffect(() => {
    const timer = setTimeout(() => fetchMenu(), searchQuery ? 250 : 0);
    return () => clearTimeout(timer);
  }, [fetchMenu]);

  const handleRefresh = () => fetchMenu({ refresh: true });
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
  const featuredProducts = useMemo(() => products.slice(0, 2), [products]);

  return (
    <View style={styles.container}>
      <Header title={menuOnly ? 'Menu' : undefined} showMenu onMenuPress={() => setDrawerOpen(true)} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[COLORS.primary]} />}
      >
        <View style={styles.hero}>
          {!menuOnly ? <View style={styles.heroTopline}>
            <View style={styles.locationPill}><ShoppingBag size={14} color={COLORS.primary} /><Text style={styles.locationText}>TIET · SAC COUNTER</Text></View>
            {prepMinutes ? <View style={styles.timePill}><Clock3 size={14} color={COLORS.textSecondary} /><Text style={styles.timeText}>~{prepMinutes} min</Text></View> : null}
          </View> : null}
          <Text style={styles.eyebrow}>{menuOnly ? 'MADE FRESH FOR TIET' : 'GOOD FOOD, RIGHT ON CAMPUS'}</Text>
          <Text style={styles.heroTitle}>{menuOnly ? 'Explore the menu' : <>Hey {greeting},<Text style={styles.heroAccent}> what sounds good?</Text></>}</Text>
          {!menuOnly ? <Text style={styles.heroSub}>Fresh picks from the Wrapchik counter, ready when you are.</Text> : null}
          <SearchBar value={searchQuery} onChangeText={setSearchQuery} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} onSubmitEditing={() => {
            const term = searchQuery.trim();
            if (!term) return;
            const next = [term, ...recentSearches.filter((recent) => recent.toLowerCase() !== term.toLowerCase())].slice(0, 6);
            setRecentSearches(next);
            void safeStorage.setItem('wrapchik_recent_searches', JSON.stringify(next));
            setSearchFocused(false);
          }} onClear={() => setSearchQuery('')} style={styles.searchWrap} />
          {searchFocused && !searchQuery && recentSearches.length ? <View style={styles.recentSearches}><Text style={styles.recentTitle}>Recent searches</Text>{recentSearches.map((term) => <TouchableOpacity key={term} onPress={() => { setSearchQuery(term); setSearchFocused(false); }} style={styles.recentChip} accessibilityRole="button" accessibilityLabel={`Search again for ${term}`}><Text style={styles.recentText}>{term}</Text></TouchableOpacity>)}</View> : null}
          {!menuOnly && closed ? <View style={styles.closedBanner}><Text style={styles.closedTitle}>Ordering is paused right now</Text><Text style={styles.closedCopy}>Check back soon. The live menu is still available to browse.</Text></View> : null}
        </View>

        {!menuOnly ? <View style={styles.pickupStrip}>
          <View style={styles.pickupIcon}><ShoppingBag size={18} color={COLORS.primary} /></View>
          <View style={styles.pickupCopy}><Text style={styles.pickupTitle}>Pickup at Wrapchik</Text><Text style={styles.pickupSub}>SAC counter · choose pickup at checkout</Text></View>
          <Sparkles size={17} color={COLORS.secondary} />
        </View> : null}
        {!menuOnly && promoBanners.length > 0 ? <>
          <ScrollView
            ref={promoCarouselRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.promoCarousel}
            snapToInterval={promoStep}
            decelerationRate="fast"
            onMomentumScrollEnd={(event) => setActivePromoIndex(Math.max(0, Math.min(promoBanners.length - 1, Math.round(event.nativeEvent.contentOffset.x / promoStep))))}
          >
          {promoBanners.map((banner, index) => {
            const destination = PROMO_BANNER_ROUTES.has(banner.ctaRoute) ? banner.ctaRoute : '/(tabs)/menu';
            return <View key={banner._id || `promo-${index}`} style={[styles.promoCard, { width: promoCardWidth }]}>
              {banner.imageUrl ? <Image source={{ uri: banner.imageUrl }} style={styles.promoImage} resizeMode="cover" accessibilityLabel={`${banner.title} promotional image`} /> : null}
              <View style={styles.promoBody}>
                <View style={styles.promoCopy}><Text style={styles.promoTitle}>{banner.title}</Text><Text style={styles.promoMessage}>{banner.message}</Text></View>
                <TouchableOpacity onPress={() => router.push(destination)} style={styles.promoButton} activeOpacity={0.76} accessibilityRole="button" accessibilityLabel={banner.ctaLabel || `Explore ${banner.title}`}>
                  <Text style={styles.promoButtonText}>{banner.ctaLabel || 'Explore'}</Text>
                </TouchableOpacity>
              </View>
            </View>;
          })}
          </ScrollView>
          {promoBanners.length > 1 ? <View style={styles.promoIndicators} accessibilityLabel={`Promotion ${activePromoIndex + 1} of ${promoBanners.length}`}>
            {promoBanners.map((banner, index) => <TouchableOpacity key={banner._id || `promo-dot-${index}`} onPress={() => { setActivePromoIndex(index); promoCarouselRef.current?.scrollTo({ x: index * promoStep, animated: true }); }} style={styles.promoIndicatorButton} accessibilityRole="button" accessibilityLabel={`Show promotion ${index + 1}`} accessibilityState={{ selected: activePromoIndex === index }}>
              <View style={[styles.promoIndicator, activePromoIndex === index && styles.promoIndicatorActive]} />
            </TouchableOpacity>)}
          </View> : null}
        </> : null}
        {!menuOnly ? <TouchableOpacity style={styles.offersCta} onPress={() => router.push('/offers')} activeOpacity={0.76} accessibilityRole="button" accessibilityLabel="See current Deals and Offers from Wrapchik">
          <View style={styles.offersIcon}><Tag size={18} color={COLORS.primary} /></View>
          <View style={styles.offersCopy}><Text style={styles.offersTitle}>Deals & offers</Text><Text style={styles.offersSubtitle}>See current offers from the outlet</Text></View>
          <ChevronRight size={20} color={COLORS.primary} />
        </TouchableOpacity> : null}
        {!menuOnly ? <TouchableOpacity style={styles.shareMealCta} onPress={() => router.push('/group-order')} accessibilityRole="button" accessibilityLabel="Share a Meal with friends">
          <View style={{ flex: 1 }}><Text style={styles.shareMealTitle}>Share a Meal</Text><Text style={styles.shareMealCopy}>Start a group cart and choose food together</Text></View>
          <Text style={styles.shareMealArrow}>›</Text>
        </TouchableOpacity> : null}
        {!menuOnly ? <TouchableOpacity style={styles.mealPlanLink} onPress={() => router.push('/meal-plans')} accessibilityRole="button" accessibilityLabel="Open saved meal plans and reminders">
          <Clock3 size={16} color={COLORS.primary} /><Text style={styles.mealPlanLinkText}>Saved meal plans & reminders</Text><Text style={styles.mealPlanArrow}>›</Text>
        </TouchableOpacity> : null}

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View><Text style={styles.sectionEyebrow}>FIND YOUR FAVOURITE</Text><Text style={styles.sectionTitle}>Browse categories</Text></View>
            <TouchableOpacity style={styles.textLink} onPress={() => { setSelectedCategory(null); setDiet('ALL'); }} accessibilityRole="button" accessibilityLabel="Show all menu items"><Text style={styles.textLinkLabel}>View all</Text></TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
            <CategoryCard category={{ _id: null, name: 'All items' }} isSelected={!selectedCategory} onPress={() => setSelectedCategory(null)} />
            {categories.map((category) => <CategoryCard key={category._id} category={category} isSelected={selectedCategory === category._id} onPress={() => setSelectedCategory(category._id)} />)}
          </ScrollView>
        </View>

        {!menuOnly ? <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View><Text style={styles.sectionEyebrow}>NEWEST ADDITIONS</Text><Text style={styles.sectionTitle}>Fresh on the menu</Text></View>
          </View>
          {error ? <ErrorState onRetry={handleRefresh} retrying={refreshing} /> : loading && !refreshing ? <ProductListSkeleton count={2} /> : featuredProducts.length ? (
            <View style={styles.featuredRow}>
              {featuredProducts.map((product) => (
                <TouchableOpacity key={product._id} onPress={() => router.push(`/product/${product._id}`)} style={styles.featuredCard} accessibilityRole="button" accessibilityLabel={`View ${product.name}`}>
                  <ProductImage uri={product.imageUrl} style={styles.featuredImage} fallbackIconSize={24} accessibilityLabel={product.name} />
                  <View style={styles.featuredOverlay}><Text style={styles.featuredName} numberOfLines={1}>{product.name}</Text><Text style={styles.featuredPrice}>₹{product.price}</Text></View>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View> : null}

        {!menuOnly && popularProducts.length ? <View style={styles.section}>
          <View style={styles.sectionHeading}><View><Text style={styles.sectionEyebrow}>BASED ON PAID ORDERS · LAST 30 DAYS</Text><Text style={styles.sectionTitle}>Popular on campus</Text></View></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recommendationRow}>{popularProducts.map(product => <TouchableOpacity key={product._id} onPress={() => router.push(`/product/${product._id}`)} style={styles.recommendationCard} accessibilityRole="button" accessibilityLabel={`Popular item ${product.name}, ${product.totalQuantity} sold in the last 30 days`}><ProductImage uri={product.imageUrl} style={styles.featuredImage} fallbackIconSize={24} accessibilityLabel={product.name} /><View style={styles.featuredOverlay}><View style={{ flex: 1 }}><Text style={styles.featuredName} numberOfLines={1}>{product.name}</Text><Text style={styles.popularCount}>{product.totalQuantity} sold</Text></View><Text style={styles.featuredPrice}>₹{product.price}</Text></View></TouchableOpacity>)}</ScrollView>
        </View> : null}

        {!menuOnly && user?._id ? <View style={styles.section}>
          <View style={styles.sectionHeading}><View><Text style={styles.sectionEyebrow}>FROM YOUR VERIFIED ORDER HISTORY</Text><Text style={styles.sectionTitle}>Order again</Text></View></View>
          {previouslyOrderedProducts.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recommendationRow}>
            {previouslyOrderedProducts.map(product => <View key={product._id} style={{ width: Math.min(Math.max(width * 0.78, 250), 330), marginRight: 12 }}>
              <ProductCard product={product} onPress={() => router.push(`/product/${product._id}`)} />
            </View>)}
          </ScrollView> : <TouchableOpacity style={styles.orderAgainEmpty} onPress={() => router.push('/(tabs)/menu')} activeOpacity={0.76} accessibilityRole="button" accessibilityLabel="Browse the menu; completed orders will appear here for quick reordering">
            <Text style={styles.orderAgainEmptyTitle}>Your past picks will show up here</Text><Text style={styles.orderAgainEmptyCopy}>Browse the menu and your completed orders will be ready to reorder next time.</Text>
          </TouchableOpacity>}
        </View> : null}

        {!menuOnly && recommendedProducts.length ? <View style={styles.section}>
          <View style={styles.sectionHeading}><View><Text style={styles.sectionEyebrow}>BASED ON YOUR VERIFIED COMPLETED ORDERS</Text><Text style={styles.sectionTitle}>Because you ordered</Text></View></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recommendationRow}>{recommendedProducts.map(product => <TouchableOpacity key={product._id} onPress={() => router.push(`/product/${product._id}`)} style={styles.recommendationCard} accessibilityRole="button" accessibilityLabel={`Recommended with your previous orders: ${product.name}`}>
            <ProductImage uri={product.imageUrl} style={styles.featuredImage} fallbackIconSize={24} accessibilityLabel={product.name} />
            <View style={styles.featuredOverlay}><Text style={styles.featuredName} numberOfLines={1}>{product.name}</Text><Text style={styles.featuredPrice}>₹{product.price}</Text></View>
          </TouchableOpacity>)}</ScrollView>
        </View> : null}

        <View style={styles.menuSection}>
          <View style={styles.menuHeading}>
            <View><Text style={styles.sectionEyebrow}>THE WRAPCHIK MENU</Text><Text style={styles.sectionTitle}>{searchQuery ? 'Search results' : selectedCategory ? 'Your selection' : 'Made for your cravings'}</Text></View>
            <TouchableOpacity style={styles.sortButton} onPress={() => setSortIndex((sortIndex + 1) % SORTS.length)} accessibilityRole="button" accessibilityLabel={`Sort menu. Current: ${sortLabel}`}>
              <ArrowDownUp size={15} color={COLORS.textPrimary} /><Text style={styles.sortText}>{sortLabel}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.filtersRow}>
            <SlidersHorizontal size={15} color={COLORS.textSecondary} />
            {DIET_FILTERS.map((filter) => <TouchableOpacity key={filter.id} onPress={() => setDiet(filter.id)} style={[styles.filterChip, diet === filter.id && styles.filterChipActive]} accessibilityRole="button" accessibilityState={{ selected: diet === filter.id }}><Text style={[styles.filterText, diet === filter.id && styles.filterTextActive]}>{filter.label}</Text></TouchableOpacity>)}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.priceFilters}>{PRICE_RANGES.map((range) => <TouchableOpacity key={range.id} onPress={() => setPriceRange(range.id)} style={[styles.filterChip, priceRange === range.id && styles.filterChipActive]} accessibilityRole="button" accessibilityState={{ selected: priceRange === range.id }}><Text style={[styles.filterText, priceRange === range.id && styles.filterTextActive]}>{range.label}</Text></TouchableOpacity>)}</ScrollView>

          {error ? null : loading && !refreshing ? <ProductListSkeleton /> : products.length === 0 ? (
            <EmptyState title={searchQuery ? 'No matches this time' : 'The menu is quiet right now'} message={searchQuery ? 'Try another dish name or clear your filters.' : 'There are no items in this menu yet. Please check back later.'} buttonTitle={searchQuery || selectedCategory || diet !== 'ALL' || priceRange !== 'ALL' ? 'Clear filters' : undefined} onButtonPress={() => { setSearchQuery(''); setSelectedCategory(null); setDiet('ALL'); setPriceRange('ALL'); }} />
          ) : (
            <View style={styles.productList}>{products.map((item) => <View key={item._id} style={[styles.productCell, { width: productCardWidth }]}><ProductCard product={item} onPress={() => router.push(`/product/${item._id}`)} /></View>)}</View>
          )}
        </View>
        {!menuOnly ? <View style={styles.footerNote}><Text style={styles.footerNoteText}>Made fresh for the TIET campus community</Text></View> : null}
      </ScrollView>
      {cartCount > 0 ? <TouchableOpacity style={styles.cartFloating} onPress={() => router.push('/(tabs)/cart')} accessibilityRole="button" accessibilityLabel={`Open cart with ${cartCount} items`}><ShoppingBag size={18} color="#FFFFFF" /><Text style={styles.cartFloatingText}>View cart</Text><View style={styles.cartCount}><Text style={styles.cartCountText}>{cartCount}</Text></View></TouchableOpacity> : null}
      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingBottom: 36, maxWidth: THEME.layout.pageMaxWidth, width: '100%', alignSelf: 'center' },
  hero: { paddingHorizontal: THEME.layout.pageGutter, paddingTop: 12, paddingBottom: 20 },
  heroTopline: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 22 },
  locationPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border, borderRadius: THEME.radius.pill, paddingHorizontal: 11, paddingVertical: 7 },
  locationText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, color: COLORS.textPrimary },
  timePill: { flexDirection: 'row', gap: 5, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderRadius: THEME.radius.pill, backgroundColor: COLORS.surfaceMuted },
  timeText: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  eyebrow: { color: COLORS.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 8 },
  heroTitle: { color: COLORS.textPrimary, fontSize: 30, lineHeight: 36, fontWeight: '900', maxWidth: 560 },
  heroAccent: { color: COLORS.primary },
  heroSub: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 6, maxWidth: 480 },
  searchWrap: { marginHorizontal: 0, marginVertical: 0, marginTop: 18, height: 54, borderRadius: 16, paddingHorizontal: 14, shadowOpacity: 0, elevation: 0 },
  recentSearches: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 },
  recentTitle: { width: '100%', color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },
  recentChip: { paddingHorizontal: 11, paddingVertical: 7, minHeight: 34, borderRadius: THEME.radius.pill, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border },
  recentText: { color: COLORS.textPrimary, fontSize: 11, fontWeight: '700' },
  closedBanner: { marginTop: 14, backgroundColor: COLORS.warningLight, padding: 13, borderRadius: 14 },
  closedTitle: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '800' },
  closedCopy: { color: COLORS.textSecondary, fontSize: 12, marginTop: 3 },
  pickupStrip: { marginHorizontal: THEME.layout.pageGutter, padding: 14, backgroundColor: '#FFF2EA', borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 11 },
  promoCarousel: { paddingHorizontal: THEME.layout.pageGutter, paddingTop: 12, paddingBottom: 5, gap: 12 },
  promoCard: { borderRadius: 18, overflow: 'hidden', backgroundColor: '#302F2D', borderWidth: 1, borderColor: COLORS.border },
  promoImage: { width: '100%', height: 150, backgroundColor: COLORS.surfaceMuted },
  promoBody: { padding: 14, minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 12 },
  promoIndicators: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', justifyContent: 'center', minHeight: 34, gap: 2 },
  promoIndicatorButton: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  promoIndicator: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#D7C9C1' },
  promoIndicatorActive: { width: 20, backgroundColor: COLORS.primary },
  offersCta: { marginHorizontal: THEME.layout.pageGutter, marginTop: 10, minHeight: 68, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 17, borderWidth: 1, borderColor: '#F4D6C8', backgroundColor: '#FFF2EA', flexDirection: 'row', alignItems: 'center', gap: 11 },
  offersIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#FFFFFF' },
  offersCopy: { flex: 1, minWidth: 0 },
  offersTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '900' },
  offersSubtitle: { color: COLORS.textSecondary, fontSize: 11, marginTop: 3 },
  orderAgainEmpty: { marginHorizontal: THEME.layout.pageGutter, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16 },
  orderAgainEmptyTitle: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '800' },
  orderAgainEmptyCopy: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 4 },
  promoBanner: { marginHorizontal: THEME.layout.pageGutter, marginTop: 12, padding: 16, borderRadius: 18, backgroundColor: '#302F2D', flexDirection: 'row', alignItems: 'center', gap: 12 },
  promoCopy: { flex: 1, minWidth: 0 }, promoTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' }, promoMessage: { color: '#E8E2DE', fontSize: 12, lineHeight: 17, marginTop: 4 },
  promoButton: { minHeight: 48, minWidth: 70, paddingHorizontal: 12, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' }, promoButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  pickupIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  shareMealCta: { marginHorizontal: THEME.layout.pageGutter, marginTop: 12, padding: 16, borderRadius: 18, backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', minHeight: 64 },
  shareMealTitle: { color: '#FFFFFF', fontWeight: '900', fontSize: 16 },
  shareMealCopy: { color: '#FFF4EF', fontSize: 12, marginTop: 3 },
  shareMealArrow: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', marginLeft: 12 },
  mealPlanLink: { marginHorizontal: THEME.layout.pageGutter, marginTop: 2, minHeight: 48, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 9 },
  mealPlanLinkText: { flex: 1, color: COLORS.textSecondary, fontSize: 12, fontWeight: '800' },
  mealPlanArrow: { color: COLORS.primary, fontSize: 20, fontWeight: '800' },
  pickupCopy: { flex: 1 }, pickupTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary }, pickupSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  section: { marginTop: 27 },
  sectionHeading: { paddingHorizontal: THEME.layout.pageGutter, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 13 },
  sectionEyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1.4, color: COLORS.primary, marginBottom: 4 },
  sectionTitle: { fontSize: 21, lineHeight: 27, fontWeight: '900', color: COLORS.textPrimary },
  textLink: { padding: 8 }, textLinkLabel: { color: COLORS.primary, fontSize: 13, fontWeight: '800' },
  categoryList: { paddingHorizontal: THEME.layout.pageGutter, paddingBottom: 3 },
  featuredRow: { flexDirection: 'row', paddingHorizontal: THEME.layout.pageGutter, gap: 12 },
  recommendationRow: { paddingHorizontal: THEME.layout.pageGutter, gap: 12 }, recommendationCard: { width: 220, height: 156, borderRadius: 19, overflow: 'hidden', backgroundColor: COLORS.surfaceMuted },
  featuredCard: { flex: 1, minWidth: 0, height: 156, borderRadius: 19, overflow: 'hidden', backgroundColor: COLORS.surfaceMuted },
  featuredImage: { width: '100%', height: '100%' }, imageFallback: { alignItems: 'center', justifyContent: 'center' },
  featuredOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 11, backgroundColor: 'rgba(25, 28, 32, 0.78)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  featuredName: { flex: 1, color: '#FFFFFF', fontSize: 13, fontWeight: '800' }, featuredPrice: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  popularCount: { color: '#F6D5C8', fontSize: 10, fontWeight: '700', marginTop: 2 },
  menuSection: { marginTop: 30 },
  menuHeading: { paddingHorizontal: THEME.layout.pageGutter, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  sortButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, minHeight: 38, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, backgroundColor: '#FFFFFF' },
  sortText: { fontSize: 11, fontWeight: '700', color: COLORS.textPrimary },
  filtersRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: THEME.layout.pageGutter, marginBottom: 13 },
  priceFilters: { paddingHorizontal: THEME.layout.pageGutter, gap: 7, marginTop: -5, marginBottom: 13 },
  filterChip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: THEME.radius.pill, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#FFFFFF' },
  filterChipActive: { backgroundColor: COLORS.textPrimary, borderColor: COLORS.textPrimary },
  filterText: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary }, filterTextActive: { color: '#FFFFFF' },
  productList: { paddingHorizontal: THEME.layout.pageGutter, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  productCell: { minWidth: 0 },
  footerNote: { paddingTop: 20, alignItems: 'center' }, footerNoteText: { fontSize: 11, color: COLORS.textSecondary },
  cartFloating: { position: 'absolute', bottom: 15, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 50, borderRadius: 16, paddingHorizontal: 17, backgroundColor: COLORS.primary, shadowColor: '#45251B', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.2, shadowRadius: 9, elevation: 5 },
  cartFloatingText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 }, cartCount: { minWidth: 23, height: 23, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#FFFFFF' }, cartCountText: { color: COLORS.primary, fontSize: 11, fontWeight: '900' },
});
