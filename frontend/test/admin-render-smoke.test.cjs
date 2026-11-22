const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const babel = require('@babel/core');
const actualReact = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const frontendRoot = path.resolve(__dirname, '..');
global.__DEV__ = false;

function createHarness() {
  const stateByPath = new Map();
  const classStateByPath = new Map();
  let active = null;
  const fragment = Symbol.for('wrapchik.test.fragment');

  const React = {
    __esModule: true,
    Fragment: fragment,
    createElement(type, props, ...children) {
      const nextProps = { ...(props || {}) };
      if (children.length === 1) nextProps.children = children[0];
      else if (children.length > 1) nextProps.children = children;
      return { __wrapchikElement: true, type, props: nextProps };
    },
    cloneElement(element, props, ...children) {
      return React.createElement(element.type, { ...element.props, ...props }, ...(children.length ? children : [element.props.children]));
    },
    createContext(value) {
      const context = { _currentValue: value };
      context.Provider = ({ value: next, children }) => { context._currentValue = next; return children; };
      context.Consumer = ({ children }) => children(context._currentValue);
      return context;
    },
    useContext(context) { return context?._currentValue; },
    useState(initial) {
      assert.ok(active, 'useState must run inside a rendered component');
      const index = active.index++;
      if (!(index in active.hooks)) {
        const value = typeof initial === 'function' ? initial() : initial;
        // The render harness settles boolean loading flags and never runs network effects.
        active.hooks[index] = value === true ? false : value;
      }
      const hooks = active.hooks;
      return [hooks[index], value => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value; }];
    },
    useReducer(reducer, initial) {
      const [state, setState] = React.useState(initial);
      return [state, action => setState(current => reducer(current, action))];
    },
    useRef(initial) {
      const [ref] = React.useState(() => ({ current: initial }));
      return ref;
    },
    useMemo(factory) { return factory(); },
    useCallback(callback) { return callback; },
    useEffect() {},
    useLayoutEffect() {},
    useImperativeHandle() {},
    useId() { return ':wrapchik-test:'; },
    memo(component) { return component; },
    forwardRef(render) { return props => render(props, props.ref || null); },
    Component: class Component {
      constructor(props) { this.props = props; this.state = {}; }
      setState(update) { this.state = { ...this.state, ...(typeof update === 'function' ? update(this.state, this.props) : update) }; }
    },
  };
  React.default = React;

  const nativeHost = name => props => React.createElement(name, props, props?.children);
  const native = {
    View: nativeHost('View'), Text: nativeHost('Text'), TextInput: nativeHost('TextInput'),
    TouchableOpacity: nativeHost('TouchableOpacity'), Pressable: nativeHost('Pressable'),
    ScrollView: nativeHost('ScrollView'), SafeAreaView: nativeHost('SafeAreaView'),
    Image: nativeHost('Image'), Switch: nativeHost('Switch'), ActivityIndicator: nativeHost('ActivityIndicator'),
    RefreshControl: () => null, KeyboardAvoidingView: nativeHost('KeyboardAvoidingView'),
    Modal: ({ visible, children, ...props }) => visible ? React.createElement('Modal', { visible, ...props }, children) : null,
    FlatList: ({ data = [], renderItem, ListEmptyComponent, ...props }) => {
      const children = data.length && renderItem
        ? data.map((item, index) => renderItem({ item, index }))
        : ListEmptyComponent ? React.createElement(ListEmptyComponent) : null;
      return React.createElement('FlatList', props, children);
    },
    Alert: { alert() {} },
    Platform: { OS: 'android', select: values => values?.android ?? values?.default },
    StyleSheet: { create: value => value, flatten: value => value, hairlineWidth: 1, absoluteFillObject: {} },
    Dimensions: { get: () => ({ width: 390, height: 844 }) },
    useWindowDimensions: () => ({ width: 390, height: 844, scale: 1, fontScale: 1 }),
    Keyboard: { dismiss() {}, addListener: () => ({ remove() {} }) },
    DeviceEventEmitter: { addListener: () => ({ remove() {} }), emit() {} },
    BackHandler: { addEventListener: () => ({ remove() {} }) },
    AccessibilityInfo: { isReduceMotionEnabled: async () => false, addEventListener: () => ({ remove() {} }) },
    Animated: {
      View: nativeHost('AnimatedView'), Text: nativeHost('AnimatedText'),
      Value: class Value { constructor(value) { this.value = value; } setValue(value) { this.value = value; } interpolate() { return 0; } },
      spring: () => ({ start() {}, stop() {} }), timing: () => ({ start() {}, stop() {} }),
      parallel: () => ({ start() {}, stop() {} }), sequence: () => ({ start() {}, stop() {} }),
    },
  };

  function render(element, pathKey = 'root') {
    if (element == null || typeof element === 'string' || typeof element === 'number' || typeof element === 'boolean') return element;
    if (Array.isArray(element)) return element.map((child, index) => render(child, `${pathKey}.${index}`));
    if (!element.__wrapchikElement) return element;
    const { type, props } = element;
    if (type === fragment) return render(props.children, `${pathKey}.fragment`);
    if (typeof type === 'function') {
      if (type.prototype?.render) {
        const instance = new type(props);
        if (classStateByPath.has(pathKey)) instance.state = classStateByPath.get(pathKey);
        instance.props = props;
        instance.setState = update => {
          instance.state = { ...instance.state, ...(typeof update === 'function' ? update(instance.state, props) : update) };
          classStateByPath.set(pathKey, instance.state);
        };
        const renderClass = () => render(instance.render(), `${pathKey}.${type.displayName || type.name || 'class'}`);
        try { return renderClass(); }
        catch (error) {
          if (typeof type.getDerivedStateFromError !== 'function') throw error;
          instance.state = { ...instance.state, ...type.getDerivedStateFromError(error) };
          classStateByPath.set(pathKey, instance.state);
          instance.componentDidCatch?.(error, { componentStack: 'test harness' });
          return renderClass();
        }
      }
      const hooks = stateByPath.get(pathKey) || [];
      stateByPath.set(pathKey, hooks);
      const previous = active;
      active = { hooks, index: 0 };
      let output;
      let rendered;
      try {
        output = type(props);
        rendered = render(output, `${pathKey}.${type.displayName || type.name || 'component'}`);
      }
      finally { active = previous; }
      return rendered;
    }
    return {
      type: String(type),
      props: { ...props, children: render(props.children, `${pathKey}.children`) },
    };
  }

  return { React, native, render, navigation: [], reset: () => { stateByPath.clear(); classStateByPath.clear(); } };
}

function loadAdminScreen(routePath, harness, routeParams = {}) {
  const originalLoad = Module._load;
  const originalJs = Module._extensions['.js'];
  const originalJsx = Module._extensions['.jsx'];
  const serviceProxy = new Proxy({}, { get: (_, name) => name === '__esModule' ? true : async () => ({ data: [] }) });
  const context = harness.React.createContext({ user: { _id: 'admin-test', role: 'admin' }, isLoading: false });
  const socketContext = harness.React.createContext({ socket: null });
  const exportsForContext = {
    AuthContext: context, CartContext: context, NotificationContext: context, SocketContext: socketContext,
    CartProvider: ({ children }) => children, NotificationProvider: ({ children }) => children,
  };
  const iconModule = new Proxy({ __esModule: true }, { get: (target, name) => name in target ? target[name] : props => harness.React.createElement(`Icon-${String(name)}`, props) });
  harness.navigation = [];
  const router = { push: route => harness.navigation.push(route), replace: route => harness.navigation.push(route), back() {}, canGoBack: () => true, setParams() {} };
  const expoRouter = {
    __esModule: true,
    Stack: props => harness.React.createElement('Stack', props, props.children),
    Slot: props => harness.React.createElement('Slot', props, props.children),
    Link: props => harness.React.createElement('Link', props, props.children),
    Redirect: props => harness.React.createElement('Redirect', props),
    useRouter: () => router, usePathname: () => '/admin/test', useSegments: () => ['admin'],
    useLocalSearchParams: () => routeParams, useFocusEffect() {},
  };

  Module._extensions['.js'] = function transformJs(module, filename) {
    if (!filename.startsWith(frontendRoot + path.sep) || filename.split(path.sep).includes('node_modules')) return originalJs(module, filename);
    const output = babel.transformFileSync(filename, {
      babelrc: false, configFile: false,
      presets: [require.resolve('babel-preset-expo')],
      plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
    });
    module._compile(output.code, filename);
  };
  Module._extensions['.jsx'] = function transformJsx(module, filename) {
    const output = babel.transformFileSync(filename, {
      babelrc: false, configFile: false,
      presets: [require.resolve('babel-preset-expo')],
      plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
    });
    module._compile(output.code, filename);
  };
  Module._load = function wrapLoad(request, parent, isMain) {
    if (request === 'react') return harness.React;
    if (request === 'react/jsx-runtime' || request === 'react/jsx-dev-runtime') return {
      jsx: (type, props, key) => harness.React.createElement(type, { ...props, key }),
      jsxs: (type, props, key) => harness.React.createElement(type, { ...props, key }),
      Fragment: harness.React.Fragment,
    };
    if (request === 'react-native') return harness.native;
    if (request === 'react-native-safe-area-context') return { SafeAreaView: harness.native.SafeAreaView, SafeAreaProvider: harness.native.View, useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) };
    if (request === 'expo-router') return expoRouter;
    if (request === 'lucide-react-native') return iconModule;
    if (request.startsWith('expo-') || request === 'react-native-qrcode-svg' || request === 'react-native-reanimated') return new Proxy({ __esModule: true, default: harness.native.View }, { get: (target, name) => name in target ? target[name] : harness.native.View });
    let resolved;
    try { resolved = Module._resolveFilename(request, parent, isMain); } catch {}
    if (resolved?.startsWith(frontendRoot + path.sep)) {
      const normalized = resolved.split(path.sep).join('/');
      if (normalized.includes('/services/')) return { __esModule: true, default: serviceProxy, ...serviceProxy };
      if (normalized.includes('/context/')) return exportsForContext;
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    delete require.cache[routePath];
    return require(routePath).default;
  } finally {
    Module._load = originalLoad;
    Module._extensions['.js'] = originalJs;
    Module._extensions['.jsx'] = originalJsx;
  }
}

function asReactElement(node) {
  if (node == null || typeof node === 'boolean') return null;
  if (typeof node === 'string' || typeof node === 'number') return node;
  if (Array.isArray(node)) return actualReact.createElement(actualReact.Fragment, null, ...node.map(asReactElement));
  const mapping = { View: 'div', FlatList: 'div', ScrollView: 'div', SafeAreaView: 'div', Modal: 'div', TouchableOpacity: 'button', Pressable: 'button', Text: 'span', TextInput: 'input', Switch: 'input', ActivityIndicator: 'span', Image: 'img' };
  const tag = mapping[node.type] || 'span';
  const safeProps = {};
  if (node.props?.accessibilityLabel) safeProps['aria-label'] = node.props.accessibilityLabel;
  if (node.props?.accessibilityRole === 'alert') safeProps.role = 'alert';
  if (node.props?.disabled) safeProps.disabled = true;
  if (node.props?.placeholder) safeProps.placeholder = node.props.placeholder;
  if (node.props?.value != null && typeof node.props.value !== 'object') safeProps.defaultValue = String(node.props.value);
  if (tag === 'img' && node.props?.source?.uri) safeProps.src = node.props.source.uri;
  return actualReact.createElement(tag, safeProps, asReactElement(node.props?.children));
}

function textContent(node) {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textContent).join(' ');
  return textContent(node.props?.children);
}

function findPressable(node, expression) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) { for (const child of node) { const match = findPressable(child, expression); if (match) return match; } return null; }
  if (['TouchableOpacity', 'Pressable'].includes(node.type) && expression.test(`${textContent(node)} ${node.props?.accessibilityLabel || ''}`)) return node;
  return findPressable(node.props?.children, expression);
}

function findModal(node) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) { for (const child of node) { const match = findModal(child); if (match) return match; } return null; }
  if (node.type === 'Modal') return node;
  return findModal(node.props?.children);
}

const adminFiles = fs.readdirSync(path.join(frontendRoot, 'app', 'admin'))
  .filter(name => name.endsWith('.jsx') && name !== '_layout.jsx');
const harness = createHarness();

for (const name of adminFiles) {
  test(`admin ${name} renders without throwing`, () => {
    harness.reset();
    const routePath = path.join(frontendRoot, 'app', 'admin', name);
    const Screen = loadAdminScreen(routePath, harness);
    const tree = harness.render(harness.React.createElement(Screen));
    const markup = renderToStaticMarkup(asReactElement(tree));
    assert.ok(markup.length > 0, 'screen produced a renderable UI tree');
  });
}

const modalCases = [
  ['categories.jsx', /add category/i],
  ['products.jsx', /add product/i],
  ['coupons.jsx', /create/i],
  ['tables.jsx', /add table/i],
];

for (const [name, actionText] of modalCases) {
  test(`admin ${name} opens its form modal`, () => {
    harness.reset();
    const routePath = path.join(frontendRoot, 'app', 'admin', name);
    const Screen = loadAdminScreen(routePath, harness);
    const makeTree = () => harness.render(harness.React.createElement(Screen));
    const tree = makeTree();
    const action = findPressable(tree, actionText);
    assert.ok(action?.props?.onPress, `found an actionable ${actionText} control`);
    action.props.onPress();
    const modal = findModal(makeTree());
    assert.equal(modal?.props?.visible, true, 'modal becomes visible after activating the form action');
  });
}

test('admin settings screen renders its inline settings form without a modal', () => {
  harness.reset();
  const routePath = path.join(frontendRoot, 'app', 'admin', 'settings.jsx');
  const Screen = loadAdminScreen(routePath, harness);
  const tree = harness.render(harness.React.createElement(Screen));
  assert.ok(renderToStaticMarkup(asReactElement(tree)).length > 0);
  assert.equal(findModal(tree), null, 'settings currently uses inline configuration controls');
});

test('a failing admin route is caught without removing unrelated customer content', () => {
  harness.reset();
  const boundaryPath = path.join(frontendRoot, 'components', 'common', 'RouteErrorBoundary.jsx');
  const Boundary = loadAdminScreen(boundaryPath, harness);
  function CrashingAdminRoute() { throw new Error('isolated route failure'); }
  function ApplicationShell() {
    return harness.React.createElement(harness.native.View, null,
      harness.React.createElement(Boundary, null, harness.React.createElement(CrashingAdminRoute)),
      harness.React.createElement(harness.native.Text, null, 'Customer route still available'));
  }
  const tree = harness.render(harness.React.createElement(ApplicationShell));
  assert.match(textContent(tree), /This screen hit a problem/);
  assert.match(textContent(tree), /Customer route still available/);
});

test('admin dashboard QR pickup tile opens the real scan and manual-entry route', () => {
  harness.reset();
  const routePath = path.join(frontendRoot, 'app', 'admin', 'dashboard.jsx');
  const Screen = loadAdminScreen(routePath, harness);
  const tree = harness.render(harness.React.createElement(Screen));
  const action = findPressable(tree, /QR Pickup/i);
  assert.ok(action?.props?.onPress);
  action.props.onPress();
  assert.deepEqual(harness.navigation, ['/admin/pickup']);
  assert.match(fs.readFileSync(path.join(frontendRoot, 'app', 'admin', 'pickup.jsx'), 'utf8'), /Verify collection/);
});

test('admin dashboard status chips open the matching order filter', () => {
  harness.reset();
  const ordersPath = path.join(frontendRoot, 'app', 'admin', 'orders.jsx');
  const Orders = loadAdminScreen(ordersPath, harness, { status: 'PLACED' });
  const tree = harness.render(harness.React.createElement(Orders));
  const placed = findPressable(tree, /PLACED/);
  assert.ok(placed);
  assert.equal(placed.props.accessibilityState?.selected, true, 'route status parameter selects the matching queue chip');
});

test('admin drawer groups operations and navigates to the real QR pickup route', () => {
  harness.reset();
  const routePath = path.join(frontendRoot, 'app', 'admin', 'dashboard.jsx');
  const Screen = loadAdminScreen(routePath, harness);
  const makeTree = () => harness.render(harness.React.createElement(Screen));
  const tree = makeTree();
  findPressable(tree, /open navigation menu/i)?.props?.onPress();
  const opened = makeTree();
  assert.match(textContent(opened), /MENU & OFFERS/);
  assert.match(textContent(opened), /CUSTOMER CARE/);
  const pickup = findPressable(opened, /QR pickup/i);
  assert.ok(pickup?.props?.onPress, 'QR pickup drawer item is actionable');
  pickup.props.onPress();
  assert.deepEqual(harness.navigation, ['/admin/pickup']);
});

test('admin can open combo category management and customer menu has live price ranges', () => {
  harness.reset();
  const routePath = path.join(frontendRoot, 'app', 'admin', 'products.jsx');
  const Products = loadAdminScreen(routePath, harness);
  const tree = harness.render(harness.React.createElement(Products));
  assert.match(textContent(tree), /Admin-defined combos/);
  const categories = findPressable(tree, /manage categories for combo products/i);
  assert.ok(categories?.props?.onPress, 'combo guidance links to category CRUD');
  categories.props.onPress();
  assert.deepEqual(harness.navigation, ['/admin/categories']);
  const menu = fs.readFileSync(path.join(frontendRoot, 'app', '(tabs)', 'home.jsx'), 'utf8');
  assert.match(menu, /const PRICE_RANGES =/);
  assert.match(menu, /maxPrice|priceRange/);
});

test('student pickup QR supports paid, ready standalone and shared group takeaways', () => {
  const tracking = fs.readFileSync(path.join(frontendRoot, 'app', 'order-tracking', '[id].jsx'), 'utf8');
  const orders = fs.readFileSync(path.join(frontendRoot, 'services', 'orderService.js'), 'utf8');
  assert.match(tracking, /order\.orderType === 'TAKEAWAY' && order\.orderStatus === 'READY' && order\.paymentStatus === 'SUCCESS'/);
  assert.match(tracking, /order\.groupOrderId \? 'All current group members can show this same one-time code/);
  assert.match(tracking, /getPickupQr\(id, currentGroupId\?\._id \|\| currentGroupId \|\| null\)/);
  assert.match(orders, /getPickupQr: \(id, groupOrderId = null\) => api\.post\(`\/orders\/\$\{id\}\/pickup-qr`, groupOrderId \? \{ groupOrderId: String\(groupOrderId\?\._id \|\| groupOrderId\) \} : \{\}\)/);
  assert.match(tracking, /Show Pickup QR/);
  assert.match(tracking, /Show shared pickup QR/);
});
