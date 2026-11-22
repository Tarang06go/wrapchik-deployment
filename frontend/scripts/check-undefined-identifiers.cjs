const fs = require('node:fs');
const path = require('node:path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const root = path.resolve(__dirname, '..');
const excludedDirectories = new Set([
  'node_modules', '.expo', 'android', 'ios', 'coverage', 'dist', 'web-build',
]);
const extensions = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx']);
const globals = new Set([
  'AbortController', 'AggregateError', 'alert', 'Array', 'ArrayBuffer', 'atob',
  'BigInt', 'Blob', 'Boolean', 'Buffer', 'cancelAnimationFrame', 'cancelIdleCallback',
  'clearImmediate', 'clearInterval', 'clearTimeout', 'confirm', 'console', 'crypto', 'Date',
  'decodeURI', 'decodeURIComponent', 'document', 'encodeURI', 'encodeURIComponent',
  'Error', 'Event', 'EventTarget', 'File', 'FileReader', 'Float32Array', 'FormData',
  'global', 'globalThis', 'Headers', 'Intl', 'isFinite', 'isNaN', 'JSON', 'Map',
  'Math', 'module', 'NaN', 'Number', 'Object', 'parseFloat', 'parseInt', 'performance',
  'process', 'Promise', 'queueMicrotask', 'RegExp', 'requestAnimationFrame',
  'requestIdleCallback', 'require', 'ResizeObserver', 'Set', 'setImmediate',
  'setInterval', 'setTimeout', 'String', 'Symbol', 'TextDecoder', 'TextEncoder',
  'URL', 'URLSearchParams', 'WeakMap', 'WeakSet', 'window', 'XMLHttpRequest',
  '__DEV__', '__dirname', '__filename', '__TEST__',
  // Node's test runner globals are intentionally available in frontend tests.
  'after', 'afterEach', 'before', 'beforeEach', 'describe', 'expect', 'it', 'test',
]);

function collectFiles(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) collectFiles(fullPath, files);
    else if (extensions.has(path.extname(entry.name))) files.push(fullPath);
  }
  return files;
}

function jsxRootIdentifier(name) {
  if (name?.type === 'JSXIdentifier') return name.name;
  if (name?.type === 'JSXMemberExpression') return jsxRootIdentifier(name.object);
  return null;
}

const findings = [];
for (const file of collectFiles(root)) {
  const source = fs.readFileSync(file, 'utf8');
  let ast;
  try {
    ast = parser.parse(source, {
      sourceType: 'unambiguous',
      sourceFilename: file,
      allowAwaitOutsideFunction: true,
      allowReturnOutsideFunction: true,
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
    });
  } catch (error) {
    findings.push({ file, line: error.loc?.line || 1, name: 'syntax', reason: error.message });
    continue;
  }

  traverse(ast, {
    JSXOpeningElement(nodePath) {
      const name = jsxRootIdentifier(nodePath.node.name);
      if (name && /^[A-Z]/.test(name) && !nodePath.scope.hasBinding(name)) {
        findings.push({ file, line: nodePath.node.loc?.start.line || 1, name, reason: 'unbound JSX component' });
      }
    },
    ReferencedIdentifier(nodePath) {
      const name = nodePath.node.name;
      if (globals.has(name) || nodePath.scope.hasBinding(name)) return;
      if (nodePath.findParent(parent => parent.isTSType?.() || parent.isTypeAlias?.() || parent.isInterfaceDeclaration?.())) return;
      findings.push({ file, line: nodePath.node.loc?.start.line || 1, name, reason: 'unbound identifier' });
    },
  });
}

if (findings.length) {
  for (const finding of findings) {
    const relative = path.relative(root, finding.file).split(path.sep).join('/');
    console.error(`${relative}:${finding.line} ${finding.reason}: ${finding.name}`);
  }
  console.error(`Undefined identifier check failed: ${findings.length} finding(s) across ${collectFiles(root).length} files.`);
  process.exitCode = 1;
} else {
  console.log(`Undefined identifier check passed across ${collectFiles(root).length} frontend source files.`);
}
