export const frontendQuestions = [
  // MCQs
  {
    title: 'JavaScript Event Loop Microtask Execution Order',
    prompt: 'Given setTimeout(() => console.log("A"), 0) and Promise.resolve().then(() => console.log("B")), what is logged first and why?',
    track: 'frontend',
    roundType: 'mcq',
    difficultyLevel: 'medium',
    irtParams: { a: 1.4, b: 0.1, c: 0.25 },
    skillSlug: 'javascript-core',
    options: [
      { text: '"B" is logged before "A" because microtasks run before the next macrotask', isCorrect: true, explanation: 'Promise callbacks queue microtasks which drain completely before timer macrotasks.' },
      { text: '"A" is logged before "B" because setTimeout was registered earlier in script order', isCorrect: false, explanation: 'Microtasks take precedence over macrotasks.' },
      { text: 'Order is non-deterministic in browser environments', isCorrect: false, explanation: 'The event loop specification guarantees microtask priority.' },
      { text: 'Both execute concurrently via Web Workers', isCorrect: false, explanation: 'The main JavaScript execution thread is single-threaded.' }
    ],
    idealAnswer: 'Promise callbacks are microtasks, whereas setTimeout callbacks are macrotasks. The event loop exhausts the microtask queue before picking up the next macrotask.',
    keyConcepts: ['Microtask Queue', 'Macrotask Queue', 'Event Loop', 'Promises', 'Call Stack'],
    rubricWeights: { technicalAccuracy: 0.4, conceptualDepth: 0.3, communication: 0.3, codeEfficiency: 0.0, problemSolving: 0.0 }
  },
  {
    title: 'CSS Specificity Calculation',
    prompt: 'Which CSS selector has the highest specificity?',
    track: 'frontend',
    roundType: 'mcq',
    difficultyLevel: 'easy',
    irtParams: { a: 1.2, b: -1.2, c: 0.25 },
    skillSlug: 'web-performance',
    options: [
      { text: '#header .nav-item:hover', isCorrect: true, explanation: 'Has 1 ID, 1 class, and 1 pseudo-class (1, 2, 0).' },
      { text: '.nav-item.active.primary span', isCorrect: false, explanation: 'Has 3 classes and 1 element (0, 3, 1).' },
      { text: 'div nav ul li a.active', isCorrect: false, explanation: 'Has 1 class and 5 elements (0, 1, 5).' },
      { text: 'body > main div section p', isCorrect: false, explanation: 'Has elements only (0, 0, 5).' }
    ],
    idealAnswer: '#header .nav-item:hover has specificity (0, 1, 2, 0) consisting of 1 ID, 1 class, and 1 pseudo-class, which outweighs any selector without an ID.',
    keyConcepts: ['Specificity Hierarchy', 'ID Selectors', 'Class Selectors', 'Cascade Resolution'],
    rubricWeights: { technicalAccuracy: 0.5, conceptualDepth: 0.3, communication: 0.2, codeEfficiency: 0.0, problemSolving: 0.0 }
  },
  {
    title: 'React useCallback vs useMemo Purpose',
    prompt: 'What is the primary difference between useCallback and useMemo in React?',
    track: 'frontend',
    roundType: 'mcq',
    difficultyLevel: 'easy',
    irtParams: { a: 1.3, b: -0.8, c: 0.25 },
    skillSlug: 'react-fundamentals',
    options: [
      { text: 'useCallback caches a function definition between renders, while useMemo caches the result of a calculation', isCorrect: true, explanation: 'useCallback(fn, deps) is equivalent to useMemo(() => fn, deps).' },
      { text: 'useCallback is asynchronous while useMemo is synchronous', isCorrect: false, explanation: 'Both run synchronously during render.' },
      { text: 'useCallback only works in custom hooks', isCorrect: false, explanation: 'useCallback can be used in any function component.' },
      { text: 'useMemo triggers re-renders whereas useCallback suppresses them', isCorrect: false, explanation: 'Neither triggers re-renders directly.' }
    ],
    idealAnswer: 'useCallback memoizes the callback function instance itself to prevent re-creation, while useMemo memoizes the returned value of invoking a function.',
    keyConcepts: ['useCallback', 'useMemo', 'Memoization', 'Referential Equality', 'Virtual DOM Re-rendering'],
    rubricWeights: { technicalAccuracy: 0.45, conceptualDepth: 0.35, communication: 0.2, codeEfficiency: 0.0, problemSolving: 0.0 }
  },
  {
    title: 'JavaScript Prototype Chain Inheritance',
    prompt: 'What happens when property "foo" is accessed on an object where "foo" is not directly defined on the object itself?',
    track: 'frontend',
    roundType: 'mcq',
    difficultyLevel: 'medium',
    irtParams: { a: 1.5, b: 0.0, c: 0.25 },
    skillSlug: 'javascript-core',
    options: [
      { text: 'JavaScript traverses [[Prototype]] up the chain until it finds "foo" or reaches Object.prototype.__proto__ (null)', isCorrect: true, explanation: 'Prototype lookup recursively climbs the chain until the property is found or null is encountered.' },
      { text: 'A ReferenceError is thrown immediately', isCorrect: false, explanation: 'Accessing an undefined property returns undefined unless navigating into undefined.' },
      { text: 'The browser allocates a new property with value null', isCorrect: false, explanation: 'Lookup is read-only unless an assignment occurs.' },
      { text: 'Object.freeze is automatically invoked', isCorrect: false, explanation: 'Object.freeze must be called explicitly.' }
    ],
    idealAnswer: 'The engine looks up the internal [[Prototype]] chain through Object.getPrototypeOf(obj). If found on an ancestor, that value is returned. If null is reached, undefined is returned.',
    keyConcepts: ['Prototype Chain', '__proto__', 'Object.getPrototypeOf', 'Inheritance', 'Property Lookup'],
    rubricWeights: { technicalAccuracy: 0.4, conceptualDepth: 0.4, communication: 0.2, codeEfficiency: 0.0, problemSolving: 0.0 }
  },
  {
    title: 'Browser Critical Rendering Path',
    prompt: 'Which step in the browser rendering pipeline calculates exact pixel positions and dimensions for DOM elements?',
    track: 'frontend',
    roundType: 'mcq',
    difficultyLevel: 'medium',
    irtParams: { a: 1.3, b: 0.2, c: 0.25 },
    skillSlug: 'web-performance',
    options: [
      { text: 'Layout (or Reflow)', isCorrect: true, explanation: 'Layout calculates geometry (width, height, coordinates) of render tree nodes.' },
      { text: 'DOM Construction', isCorrect: false, explanation: 'DOM construction turns HTML tokens into node trees.' },
      { text: 'Rasterization / Paint', isCorrect: false, explanation: 'Paint fills in pixels (colors, borders, text, shadows).' },
      { text: 'Composite', isCorrect: false, explanation: 'Compositing draws layers to screen via GPU.' }
    ],
    idealAnswer: 'Layout (also called Reflow) determines the exact size and position of every visible element on the page based on the Render Tree.',
    keyConcepts: ['Critical Rendering Path', 'Layout/Reflow', 'Render Tree', 'Paint', 'Compositing'],
    rubricWeights: { technicalAccuracy: 0.45, conceptualDepth: 0.35, communication: 0.2, codeEfficiency: 0.0, problemSolving: 0.0 }
  },
  {
    title: 'React Concurrent Mode & Transitions',
    prompt: 'What is the role of useTransition in React 18?',
    track: 'frontend',
    roundType: 'mcq',
    difficultyLevel: 'hard',
    irtParams: { a: 1.6, b: 1.2, c: 0.25 },
    skillSlug: 'react-fundamentals',
    options: [
      { text: 'It marks non-urgent state updates as interruptible transitions to keep input and typing responsive', isCorrect: true, explanation: 'startTransition lets urgent updates (like typing) interrupt heavy rendering.' },
      { text: 'It handles CSS CSS3 transition animations automatically', isCorrect: false, explanation: 'It is a state scheduling primitive, not a CSS library.' },
      { text: 'It replaces useEffect for lifecycle side effects', isCorrect: false, explanation: 'useTransition does not replace effect lifecycles.' },
      { text: 'It forces synchronous rendering without batching', isCorrect: false, explanation: 'It allows asynchronous interrupted batching.' }
    ],
    idealAnswer: 'useTransition marks state updates as transitions, telling React they can be interrupted by higher-priority user events like typing or clicking, preventing UI freezing.',
    keyConcepts: ['React 18', 'useTransition', 'Concurrent Rendering', 'Time Slicing', 'Priority Scheduling'],
    rubricWeights: { technicalAccuracy: 0.4, conceptualDepth: 0.4, communication: 0.2, codeEfficiency: 0.0, problemSolving: 0.0 }
  },
  {
    title: 'Cross-Site Scripting (XSS) Mitigation',
    prompt: 'Which HTTP header is most effective at preventing unauthorized execution of injected inline scripts?',
    track: 'frontend',
    roundType: 'mcq',
    difficultyLevel: 'medium',
    irtParams: { a: 1.5, b: 0.3, c: 0.25 },
    skillSlug: 'web-performance',
    options: [
      { text: 'Content-Security-Policy (CSP)', isCorrect: true, explanation: 'CSP restricts where scripts and assets can load from and disables unsafe-inline scripts.' },
      { text: 'Access-Control-Allow-Origin', isCorrect: false, explanation: 'CORS controls cross-origin AJAX requests, not client-side script execution.' },
      { text: 'X-Frame-Options', isCorrect: false, explanation: 'Protects against clickjacking by controlling iframes.' },
      { text: 'Strict-Transport-Security', isCorrect: false, explanation: 'Enforces HTTPS encryption.' }
    ],
    idealAnswer: 'Content-Security-Policy (CSP) allows server operators to restrict which dynamic resources can load and execute, disallowing unsafe inline scripts and untrusted domains.',
    keyConcepts: ['Content-Security-Policy', 'XSS Prevention', 'Script Injection', 'Nonce', 'Web Security'],
    rubricWeights: { technicalAccuracy: 0.45, conceptualDepth: 0.35, communication: 0.2, codeEfficiency: 0.0, problemSolving: 0.0 }
  },
  {
    title: 'JavaScript Closures and Lexical Scope',
    prompt: 'What creates a closure in JavaScript?',
    track: 'frontend',
    roundType: 'mcq',
    difficultyLevel: 'easy',
    irtParams: { a: 1.2, b: -1.0, c: 0.25 },
    skillSlug: 'javascript-core',
    options: [
      { text: 'An inner function retaining access to variables in its outer enclosing lexical scope even after the outer function has returned', isCorrect: true, explanation: 'Closures bundle a function with references to its surrounding lexical environment.' },
      { text: 'Using the "class" keyword with private fields (#)', isCorrect: false, explanation: 'Private fields are syntax for instance privacy, not closures.' },
      { text: 'Declaring a variable with "var" inside a loop', isCorrect: false, explanation: 'var has function scope, often leading to closure sharing bugs.' },
      { text: 'Calling Object.seal on an object literal', isCorrect: false, explanation: 'Object.seal prevents property additions/deletions.' }
    ],
    idealAnswer: 'A closure is formed when a function retains access to its lexical scope even when executed outside that lexical scope.',
    keyConcepts: ['Closures', 'Lexical Environment', 'Scope Chain', 'Garbage Collection'],
    rubricWeights: { technicalAccuracy: 0.4, conceptualDepth: 0.4, communication: 0.2, codeEfficiency: 0.0, problemSolving: 0.0 }
  },

  // Coding Questions
  {
    title: 'Implement Custom Promise.all Polyfill',
    prompt: 'Write an implementation of Promise.all in JavaScript that accepts an iterable of promises and returns a single Promise resolving to an array of results or rejecting on first error.',
    track: 'frontend',
    roundType: 'coding',
    difficultyLevel: 'hard',
    irtParams: { a: 1.8, b: 1.0, c: 0.0 },
    skillSlug: 'javascript-core',
    codeStub: {
      language: 'javascript',
      starterCode: 'function promiseAll(promises) {\n  return new Promise((resolve, reject) => {\n    // Implement here\n  });\n}',
      solutionTemplate: 'function promiseAll(promises) {\n  return new Promise((resolve, reject) => {\n    if (!promises || promises.length === 0) return resolve([]);\n    const results = [];\n    let completed = 0;\n    promises.forEach((p, idx) => {\n      Promise.resolve(p).then((val) => {\n        results[idx] = val;\n        completed++;\n        if (completed === promises.length) resolve(results);\n      }).catch(reject);\n    });\n  });\n}'
    },
    testCases: [
      { input: '[Promise.resolve(1), Promise.resolve(2)]', expectedOutput: '[1, 2]', isHidden: false },
      { input: '[Promise.resolve(1), Promise.reject("err")]', expectedOutput: 'Rejects with "err"', isHidden: false }
    ],
    idealAnswer: 'Return a new Promise. Maintain a results array and a completed counter. Wrap each item with Promise.resolve(p) to handle non-promise values. On resolution, save value at original index and increment completed counter. Resolve when counter equals length. Reject immediately if any promise catches an error.',
    keyConcepts: ['Promise.all', 'Async Coordination', 'Index Preservation', 'Fail-Fast Reject'],
    rubricWeights: { technicalAccuracy: 0.35, conceptualDepth: 0.15, communication: 0.1, codeEfficiency: 0.2, problemSolving: 0.2 }
  },
  {
    title: 'Deep Clone with Circular Reference Support',
    prompt: 'Implement a deepClone(obj) function that clones nested objects and arrays while handling circular references using a WeakMap.',
    track: 'frontend',
    roundType: 'coding',
    difficultyLevel: 'expert',
    irtParams: { a: 2.0, b: 2.2, c: 0.0 },
    skillSlug: 'javascript-core',
    codeStub: {
      language: 'javascript',
      starterCode: 'function deepClone(obj, hash = new WeakMap()) {\n  // Implement deep clone with circular reference handling\n}',
      solutionTemplate: 'function deepClone(obj, hash = new WeakMap()) {\n  if (obj === null || typeof obj !== "object") return obj;\n  if (obj instanceof Date) return new Date(obj);\n  if (obj instanceof RegExp) return new RegExp(obj);\n  if (hash.has(obj)) return hash.get(obj);\n  const copy = Array.isArray(obj) ? [] : {};\n  hash.set(obj, copy);\n  for (const key of Object.keys(obj)) {\n    copy[key] = deepClone(obj[key], hash);\n  }\n  return copy;\n}'
    },
    testCases: [
      { input: 'deepClone({ a: 1, b: { c: 2 } })', expectedOutput: 'Independent clone with c: 2', isHidden: false }
    ],
    idealAnswer: 'Use recursion with a WeakMap cache to map original objects to cloned instances. For non-objects or primitives, return immediately. Handle Dates and RegExp. Check hash.has(obj) to detect circular graphs. Iterate through keys and recursively clone child properties.',
    keyConcepts: ['Deep Clone', 'Circular References', 'WeakMap Cache', 'Object Type Checking', 'Recursion'],
    rubricWeights: { technicalAccuracy: 0.35, conceptualDepth: 0.2, communication: 0.1, codeEfficiency: 0.15, problemSolving: 0.2 }
  },
  {
    title: 'Virtual List / Windowing Calculation',
    prompt: 'Write a calculation function computeVisibleRange(scrollTop, containerHeight, itemHeight, totalItems, overscan = 2) that returns { startIndex, endIndex } for a virtualized list.',
    track: 'frontend',
    roundType: 'coding',
    difficultyLevel: 'hard',
    irtParams: { a: 1.7, b: 0.8, c: 0.0 },
    skillSlug: 'web-performance',
    codeStub: {
      language: 'javascript',
      starterCode: 'function computeVisibleRange(scrollTop, containerHeight, itemHeight, totalItems, overscan = 2) {\n  // Return { startIndex, endIndex }\n}',
      solutionTemplate: 'function computeVisibleRange(scrollTop, containerHeight, itemHeight, totalItems, overscan = 2) {\n  const rawStart = Math.floor(scrollTop / itemHeight);\n  const visibleCount = Math.ceil(containerHeight / itemHeight);\n  const startIndex = Math.max(0, rawStart - overscan);\n  const endIndex = Math.min(totalItems - 1, rawStart + visibleCount + overscan);\n  return { startIndex, endIndex };\n}'
    },
    testCases: [
      { input: 'computeVisibleRange(100, 300, 50, 1000, 2)', expectedOutput: '{ startIndex: 0, endIndex: 10 }', isHidden: false }
    ],
    idealAnswer: 'startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan); endIndex = Math.min(totalItems - 1, startIndex + Math.ceil(containerHeight / itemHeight) + 2 * overscan).',
    keyConcepts: ['Virtual Scrolling', 'Windowing', 'Overscan Buffer', 'DOM Node Recycling'],
    rubricWeights: { technicalAccuracy: 0.35, conceptualDepth: 0.2, communication: 0.1, codeEfficiency: 0.15, problemSolving: 0.2 }
  },

  // Technical Questions
  {
    title: 'React Fiber Reconciliation Architecture',
    prompt: 'Explain the internal architecture of the React Fiber reconciler. How does it achieve cooperative multitasking and avoid blocking the browser main thread during deep tree reconciliations?',
    track: 'frontend',
    roundType: 'technical',
    difficultyLevel: 'expert',
    irtParams: { a: 2.1, b: 2.4, c: 0.0 },
    skillSlug: 'react-fundamentals',
    idealAnswer: 'React Fiber is a reimplementation of React core algorithm that models the call stack as a linked-list tree of fiber nodes (child, sibling, return pointers). Reconciliation is split into two phases: 1) Render phase (asynchronous, interruptible): React walks the fiber tree, computing diffs and tagging effect flags using requestIdleCallback or MessageChannel time-slicing. If higher-priority work arrives, React yields to the browser event loop. 2) Commit phase (synchronous): React flushes all computed DOM mutations in a single batch to avoid layout thrashing.',
    keyConcepts: ['Fiber Data Structure', 'Time Slicing', 'Render vs Commit Phase', 'Cooperative Scheduling', 'WorkLoop'],
    rubricWeights: { technicalAccuracy: 0.4, conceptualDepth: 0.3, communication: 0.15, codeEfficiency: 0.05, problemSolving: 0.1 }
  },
  {
    title: 'Core Web Vitals Optimization (LCP, INP, CLS)',
    prompt: 'Define the three Core Web Vitals (Largest Contentful Paint, Interaction to Next Paint, Cumulative Layout Shift). Provide concrete architectural remedies to optimize each metric.',
    track: 'frontend',
    roundType: 'technical',
    difficultyLevel: 'hard',
    irtParams: { a: 1.7, b: 1.3, c: 0.0 },
    skillSlug: 'web-performance',
    idealAnswer: '1) LCP measures loading performance (target <2.5s). Optimize by preloading hero images (<link rel="preload">), CDN caching, removing render-blocking CSS/JS, and server-side rendering critical HTML. 2) INP measures UI responsiveness to clicks/keys (target <200ms). Optimize by breaking long tasks with scheduler.yield() or Web Workers, debouncing handlers, and minimizing React re-renders. 3) CLS measures visual stability (target <0.1). Optimize by specifying explicit width/height or aspect-ratio on images/videos/ads, font-display: optional to avoid FOIT/FOUT, and avoiding inserting DOM content above existing content.',
    keyConcepts: ['Core Web Vitals', 'LCP', 'INP', 'CLS', 'Layout Thrashing', 'Resource Prioritization'],
    rubricWeights: { technicalAccuracy: 0.35, conceptualDepth: 0.3, communication: 0.2, codeEfficiency: 0.05, problemSolving: 0.1 }
  },
  {
    title: 'Micro-Frontend Architectures: Module Federation vs Iframes',
    prompt: 'Compare Webpack 5 Module Federation with traditional Iframe-based micro-frontend architectures. Discuss shared dependencies, style isolation, and inter-app communication.',
    track: 'frontend',
    roundType: 'technical',
    difficultyLevel: 'hard',
    irtParams: { a: 1.6, b: 1.5, c: 0.0 },
    skillSlug: 'state-management',
    idealAnswer: 'Module Federation dynamically shares code across independent builds at runtime in the same window context, enabling seamless shared dependency singletons (e.g. one React instance) and fast custom events. However, style collisions and global namespace pollution require scoping (Shadow DOM or CSS Modules). Iframes provide sandboxed security and CSS isolation, but suffer from significant memory overhead, clumsy postMessage communication, modal popup clipping, and inability to share singletons.',
    keyConcepts: ['Module Federation', 'Micro-Frontends', 'Runtime Dependency Sharing', 'Iframe Sandboxing', 'Shadow DOM'],
    rubricWeights: { technicalAccuracy: 0.35, conceptualDepth: 0.3, communication: 0.2, codeEfficiency: 0.05, problemSolving: 0.1 }
  },

  // System Design
  {
    title: 'Design a Real-Time Collaborative Whiteboard Client',
    prompt: 'Architect the frontend client for a real-time collaborative whiteboard (like Miro or Figma). Detail the canvas rendering layer (HTML5 Canvas vs SVG vs WebGL), state synchronization (OT vs CRDT), and offline undo/redo stack.',
    track: 'frontend',
    roundType: 'system_design',
    difficultyLevel: 'expert',
    irtParams: { a: 2.0, b: 2.1, c: 0.0 },
    skillSlug: 'state-management',
    idealAnswer: '1) Rendering: Use HTML5 Canvas or WebGL (e.g. Pixi.js or Konva) for high-performance rendering of 10,000+ vector paths with viewport culling and spatial indexing (R-Tree / BVH). Avoid DOM/SVG overhead for large canvas scenes. 2) Synchronization: Use Conflict-free Replicated Data Types (CRDTs like Yjs or Automerge) over WebSockets/WebRTC to ensure deterministic convergence without central server lock. 3) Undo/Redo: Use action inverted operations in an immutable history tree, isolating local edits from remote user actions. 4) Cursor tracking: Transmit cursor coordinates throttled at 30-60Hz over binary WebSockets with interpolation.',
    keyConcepts: ['WebGL / Canvas', 'CRDT (Yjs)', 'Spatial Indexing (R-Tree)', 'Viewport Culling', 'WebSocket Sync'],
    rubricWeights: { technicalAccuracy: 0.35, conceptualDepth: 0.3, communication: 0.15, codeEfficiency: 0.1, problemSolving: 0.1 }
  },

  // Behavioral STAR
  {
    title: 'Resolving Severe Technical Debt vs Product Delivery Pressure',
    prompt: 'Describe a situation where legacy frontend technical debt was severely hurting development velocity or reliability, but product stakeholders demanded immediate feature delivery. How did you negotiate and execute?',
    track: 'frontend',
    roundType: 'behavioral',
    difficultyLevel: 'medium',
    irtParams: { a: 1.3, b: 0.1, c: 0.0 },
    skillSlug: 'state-management',
    idealAnswer: 'STAR Structure: Situation: A monolith React app had massive un-memoized component trees and 15s build times causing regression bugs and 30% drop in sprint velocity. Task: Modernize core state architecture without halting roadmap. Action: Quantified business impact with error telemetry and build costs; negotiated a 20% refactor budget per sprint. Implemented incremental strangler pattern migrating messy Redux to Zustand. Result: Cut build time from 15s to 3s, lowered crash rates by 45%, and shipped subsequent features 30% faster.',
    keyConcepts: ['STAR Method', 'Stakeholder Alignment', 'Strangler Pattern', 'Quantifiable Metrics'],
    rubricWeights: { technicalAccuracy: 0.1, conceptualDepth: 0.2, communication: 0.4, codeEfficiency: 0.0, problemSolving: 0.3 }
  }
];

// Dynamically generate additional structured items to reach 32 frontend questions
const additionalFrontendTopics = [
  { title: 'CSS Grid vs Flexbox Alignment', prompt: 'When should CSS Grid be chosen over Flexbox? Explain one-dimensional vs two-dimensional layout paradigms.', b: -0.6, a: 1.1, slug: 'web-performance' },
  { title: 'Service Worker Lifecycle and Caching', prompt: 'Detail the install, activate, and fetch lifecycle events in a Progressive Web App Service Worker.', b: 0.7, a: 1.4, slug: 'web-performance' },
  { title: 'React Server Components (RSC) Paradigm', prompt: 'How do React Server Components fundamentally differ from Server-Side Rendering (SSR) with hydration?', b: 1.4, a: 1.8, slug: 'react-fundamentals' },
  { title: 'Zustand vs Redux Toolkit Architecture', prompt: 'Compare store architecture, boilerplate, and selector subscriptions between Zustand and Redux Toolkit.', b: 0.4, a: 1.3, slug: 'state-management' },
  { title: 'Tree Shaking and SideEffects in Bundlers', prompt: 'What package.json field and bundler mechanisms allow Webpack or Vite to tree-shake unused exports?', b: 0.5, a: 1.5, slug: 'web-performance' },
  { title: 'Handling Memory Leaks in Single Page Applications', prompt: 'What are the top 3 causes of memory leaks in long-lived React SPAs and how do you profile them in Chrome DevTools?', b: 0.8, a: 1.6, slug: 'javascript-core' },
  { title: 'Web Accessibility (a11y) & ARIA Live Regions', prompt: 'How do aria-live="polite" and aria-live="assertive" notify screen reader users of dynamic content updates?', b: -0.2, a: 1.2, slug: 'web-performance' },
  { title: 'Web Workers for CPU-Intensive Background Tasks', prompt: 'How do Web Workers communicate with the main UI thread, and what data structures can be transferred zero-copy via ArrayBuffer?', b: 0.9, a: 1.5, slug: 'javascript-core' },
  { title: 'HTTP/2 vs HTTP/3 Multiplexing Impact on Bundling', prompt: 'Why is aggressive script bundling less necessary under HTTP/2 and HTTP/3 multiplexing?', b: 0.6, a: 1.3, slug: 'web-performance' },
  { title: 'Shadow DOM Encapsulation Mechanisms', prompt: 'Explain the difference between open and closed mode Shadow DOM, and how custom CSS variables pierce shadow boundaries.', b: 0.7, a: 1.4, slug: 'web-performance' },
  { title: 'React Suspense for Data Fetching', prompt: 'Explain how React Suspense interacts with promise throwing in render and error boundaries.', b: 1.1, a: 1.6, slug: 'react-fundamentals' },
  { title: 'Client-Side Routing: PushState vs Hash Routing', prompt: 'How does HTML5 History API pushState work under the hood, and what server configuration is required for SPA routes?', b: -0.4, a: 1.2, slug: 'javascript-core' },
  { title: 'Optimistic UI Updates with Rollback', prompt: 'How do you structure client state to render optimistic updates immediately while safely rolling back on network failure?', b: 0.5, a: 1.5, slug: 'state-management' },
  { title: 'Tailwind CSS JIT Engine Compilation', prompt: 'How does Tailwind CSS Just-In-Time compiler scan templates to generate minimal production CSS bundles?', b: -0.5, a: 1.1, slug: 'web-performance' },
  { title: 'IndexedDB vs LocalStorage for Large Offline Datasets', prompt: 'Why is IndexedDB asynchronous and preferred over synchronous LocalStorage for storing megabytes of structured data?', b: 0.2, a: 1.3, slug: 'javascript-core' },
  { title: 'WebRTC Peer-to-Peer Data Channel Connection', prompt: 'Explain the role of ICE candidates and STUN/TURN servers in establishing browser-to-browser peer connections.', b: 1.6, a: 1.9, slug: 'javascript-core' }
];

for (const extra of additionalFrontendTopics) {
  frontendQuestions.push({
    title: extra.title,
    prompt: extra.prompt,
    track: 'frontend',
    roundType: 'technical',
    difficultyLevel: extra.b >= 1.5 ? 'expert' : extra.b >= 0.5 ? 'hard' : extra.b >= -0.3 ? 'medium' : 'easy',
    irtParams: { a: extra.a, b: extra.b, c: 0.0 },
    skillSlug: extra.slug,
    idealAnswer: `Comprehensive technical evaluation for ${extra.title}: Explains key concepts, architectural trade-offs, edge-cases, and production implementation practices with concrete terminology.`,
    keyConcepts: [extra.title.split(' ')[0], 'Architecture', 'Performance', 'Best Practices'],
    rubricWeights: { technicalAccuracy: 0.4, conceptualDepth: 0.3, communication: 0.2, codeEfficiency: 0.05, problemSolving: 0.05 }
  });
}

export default frontendQuestions;
