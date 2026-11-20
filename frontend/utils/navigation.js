const routeFallback = (pathname = '') => {
  if (pathname.startsWith('/admin/')) return pathname === '/admin/dashboard' ? '/(tabs)/home' : '/admin/dashboard';
  if (pathname.startsWith('/order-tracking/')) return '/(tabs)/orders';
  if (pathname.startsWith('/product/')) return '/(tabs)/home';
  if (pathname === '/checkout') return '/(tabs)/cart';
  if (pathname === '/payment') return '/checkout';
  if (pathname === '/order-confirmation') return '/(tabs)/orders';
  if (pathname === '/report-issue') return '/(tabs)/orders';
  if (pathname === '/favourites' || pathname === '/notifications') return '/(tabs)/home';
  if (pathname === '/support' || pathname === '/group-order') return '/(tabs)/home';
  if (pathname === '/settings') return '/(tabs)/profile';
  return null;
};

export const safeBack = (router, pathname) => {
  if (router.canGoBack?.()) {
    router.back();
    return true;
  }
  const fallback = routeFallback(pathname);
  if (fallback && fallback !== pathname) {
    router.replace(fallback);
    return true;
  }
  return false;
};

export const backFallback = routeFallback;
