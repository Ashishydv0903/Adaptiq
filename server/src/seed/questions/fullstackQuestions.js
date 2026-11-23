export const fullstackQuestions = [
  {
    title: 'Idempotent Payment Endpoint Design',
    prompt: 'How would you architect an idempotent payment processing endpoint in Express.js and MongoDB to guarantee network retries never double-charge?',
    track: 'fullstack',
    roundType: 'system_design',
    difficultyLevel: 'hard',
    irtParams: { a: 1.8, b: 1.2, c: 0.0 },
    skillSlug: 'api-design',
    idealAnswer: '1) Require client Idempotency-Key header (UUIDv4). 2) In Express middleware, check Redis or Mongo with unique index on idempotencyKey. 3) If status=SUCCESS, return cached response immediately. 4) If status=PROCESSING, return 409 Conflict with Retry-After. 5) If key is new, atomically insert status=PROCESSING with TTL lock. 6) Execute payment transaction. 7) Update record to SUCCESS with gateway response payload.',
    keyConcepts: ['Idempotency-Key', 'Distributed Locking', 'Double Charge Prevention', 'Atomic Transactions'],
    rubricWeights: { technicalAccuracy: 0.35, conceptualDepth: 0.25, communication: 0.15, codeEfficiency: 0.1, problemSolving: 0.15 }
  },
  {
    title: 'Server-Side Rendering (SSR) Hydration Mismatch',
    prompt: 'What causes a React hydration mismatch error when using SSR, and how do you resolve it?',
    track: 'fullstack',
    roundType: 'mcq',
    difficultyLevel: 'medium',
    irtParams: { a: 1.4, b: 0.3, c: 0.25 },
    skillSlug: 'react-fundamentals',
    options: [
      { text: 'Server-rendered HTML markup differing from the client initial render output (e.g. browser dates, window references, or user locale)', isCorrect: true, explanation: 'React requires server HTML and client initial render to match identical DOM structure.' },
      { text: 'Database query timeouts on the server', isCorrect: false, explanation: 'Server timeouts result in 500 status codes, not hydration errors.' },
      { text: 'Using CSS modules instead of Tailwind CSS', isCorrect: false, explanation: 'CSS framework choice does not cause DOM tree mismatches.' },
      { text: 'Exceeding the maximum HTTP header buffer size', isCorrect: false, explanation: 'Header size errors are network layer issues.' }
    ],
    idealAnswer: 'Hydration mismatches happen when the initial client render tree differs from the HTML produced by server rendering (e.g., rendering Date.now(), checking window.innerWidth, or reading localStorage during render). Resolved by deferring browser-only values to useEffect or suppression flags.',
    keyConcepts: ['SSR Hydration', 'DOM Mismatch', 'Isomorphic Code', 'useEffect Deferral'],
    rubricWeights: { technicalAccuracy: 0.45, conceptualDepth: 0.35, communication: 0.2, codeEfficiency: 0.0, problemSolving: 0.0 }
  },
  {
    title: 'Streaming Large File Uploads with Multer and S3',
    prompt: 'Implement an Express.js route using multer and streaming to upload 500MB videos directly to AWS S3 without loading the whole file into server memory.',
    track: 'fullstack',
    roundType: 'coding',
    difficultyLevel: 'hard',
    irtParams: { a: 1.7, b: 1.0, c: 0.0 },
    skillSlug: 'api-design',
    codeStub: {
      language: 'javascript',
      starterCode: 'import express from "express";\nimport multer from "multer";\n// Configure streaming upload route\nexport const setupUploadRoute = (app, s3Client) => {\n  // Implement streaming upload\n};',
      solutionTemplate: 'import express from "express";\nimport multer from "multer";\nimport multerS3 from "multer-s3";\nexport const setupUploadRoute = (app, s3Client) => {\n  const upload = multer({\n    storage: multerS3({\n      s3: s3Client,\n      bucket: "user-videos",\n      key: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)\n    }),\n    limits: { fileSize: 500 * 1024 * 1024 }\n  });\n  app.post("/upload", upload.single("video"), (req, res) => {\n    res.status(200).json({ success: true, url: req.file.location });\n  });\n};'
    },
    testCases: [
      { input: '500MB multipart stream', expectedOutput: 'Streams directly to storage without memory buffer overflow', isHidden: false }
    ],
    idealAnswer: 'Do not use multer.memoryStorage() or diskStorage() for huge files. Use streaming pipe or multer-s3 / @aws-sdk/lib-storage Upload class which chunks the incoming request stream into multipart 5MB-10MB buffers and uploads concurrently without ballooning server RAM.',
    keyConcepts: ['Multipart Upload', 'Streaming I/O', 'Memory Overflow Prevention', 'AWS S3'],
    rubricWeights: { technicalAccuracy: 0.35, conceptualDepth: 0.2, communication: 0.1, codeEfficiency: 0.2, problemSolving: 0.15 }
  }
];

const additionalFullstackTopics = [
  { title: 'End-to-End Type Safety: tRPC vs GraphQL vs OpenAPI', prompt: 'Compare fullstack type sharing approaches between tRPC (monorepo TypeScript) and GraphQL schema codegen.', b: 0.7, a: 1.5, slug: 'api-design' },
  { title: 'CSRF Token Defense in SPA with SameSite Cookies', prompt: 'How do SameSite=Strict cookies combined with anti-CSRF double-submit tokens defend against cross-site request forgery?', b: 0.4, a: 1.4, slug: 'api-design' },
  { title: 'Optimizing Next.js / Remix Data Loading', prompt: 'Compare getServerSideProps / loaders with client-side SWR/TanStack Query caching strategies.', b: 0.2, a: 1.3, slug: 'react-fundamentals' },
  { title: 'WebSocket Heartbeats & Reconnection with Exponential Backoff', prompt: 'How do you design a reliable fullstack WebSocket client-server connection that survives temporary network dropouts?', b: 0.6, a: 1.5, slug: 'state-management' },
  { title: 'Fullstack Monorepo Tooling: Turborepo and Nx', prompt: 'Explain task caching, graph dependency pipelines, and remote caching in modern TypeScript monorepos.', b: 0.5, a: 1.4, slug: 'nodejs-runtime' },
  { title: 'Server-Driven UI (SDUI) Architecture', prompt: 'How does Server-Driven UI allow backend teams to reconfigure mobile/web page layouts dynamically without app redeployments?', b: 1.4, a: 1.8, slug: 'api-design' },
  { title: 'Search Engine Optimization (SEO) for Client-Heavy Apps', prompt: 'Compare dynamic pre-rendering (Puppeteer / Prerender.io) with Edge SSR for indexing dynamic single page applications.', b: 0.3, a: 1.3, slug: 'web-performance' },
  { title: 'BFF (Backend for Frontend) Pattern', prompt: 'When is a dedicated BFF service layer beneficial for unifying microservice responses for specific web and mobile clients?', b: 0.8, a: 1.5, slug: 'api-design' },
  { title: 'Live Collab Presence System using Redis Pub/Sub', prompt: 'Architect user presence detection ("User X is typing / active") with Redis TTL keys and Socket.io broadcasts.', b: 1.0, a: 1.6, slug: 'distributed-caching' },
  { title: 'Database Full-Text Search vs Elasticsearch', prompt: 'When should an application transition from MongoDB / Postgres full-text search ($text / tsvector) to a dedicated Elasticsearch or Meilisearch cluster?', b: 0.9, a: 1.6, slug: 'mongodb-modeling' },
  { title: 'End-to-End Testing with Playwright / Cypress', prompt: 'How do you structure resilient E2E test suites with test database seeding, network mocking, and flakiness mitigation?', b: 0.1, a: 1.3, slug: 'nodejs-runtime' },
  { title: 'Webhooks Ingestion Queue & Deduplication', prompt: 'How do you handle high-velocity Stripe or GitHub webhooks with asynchronous BullMQ Redis workers?', b: 0.8, a: 1.5, slug: 'message-queues' },
  { title: 'Multi-Tenant Database Architectures: Shared vs Schema vs Isolated', prompt: 'Compare pooled multi-tenancy (tenant_id column) with schema-per-tenant and database-per-tenant for SaaS isolation.', b: 1.5, a: 1.9, slug: 'postgresql-data' },
  { title: 'Serverless Cold Starts and DB Connection Pooling', prompt: 'Why do serverless AWS Lambda / Vercel functions exhaust database connection limits and how does Prisma Accelerate or PgBouncer solve it?', b: 1.1, a: 1.7, slug: 'postgresql-data' },
  { title: 'Real-Time Notification Bell System with Polling vs WebSockets', prompt: 'Evaluate cost, server resource overhead, and battery life between long-polling and persistent WebSockets for low-frequency notification badges.', b: 0.0, a: 1.2, slug: 'api-design' },
  { title: 'Edge Middleware Authentication Verification', prompt: 'How do Cloudflare Workers or Vercel Edge Middleware verify JWTs without hitting origin database backends?', b: 0.9, a: 1.6, slug: 'api-design' },
  { title: 'Database Read Replica Routing in Express.js', prompt: 'How do you configure database connection pools to route write queries to primary and read queries to read-replicas transparently?', b: 1.2, a: 1.7, slug: 'postgresql-data' },
  { title: 'Security: Preventing NoSQL Injection in Mongoose', prompt: 'How can an attacker exploit req.body objects like { username: "admin", password: { $gt: "" } } and how do you sanitize input?', b: -0.2, a: 1.3, slug: 'mongodb-modeling' },
  { title: 'Progressive Image Loading with Blurhash and CDN', prompt: 'Describe the pipeline for generating LQIP (Low Quality Image Placeholders) and Blurhash on upload and rendering on the client.', b: 0.2, a: 1.3, slug: 'web-performance' },
  { title: 'Micro-Frontend Auth Single Sign-On (SSO)', prompt: 'How do independent micro-frontends share a validated session without forcing multiple re-authentications?', b: 1.2, a: 1.6, slug: 'api-design' },
  { title: 'Feature Flagging Architecture with LaunchDarkly / Unleash', prompt: 'How do you design a real-time feature flag evaluation system that operates client-side and server-side with zero latency penalty?', b: 0.6, a: 1.4, slug: 'api-design' },
  { title: 'Internationalization (i18n) and Right-to-Left (RTL) Layouts', prompt: 'Architect a scalable translation and localized formatting engine (currencies, dates) across client and server.', b: -0.1, a: 1.2, slug: 'react-fundamentals' },
  { title: 'Handling Race Conditions in User Account Balance Updates', prompt: 'Write an atomic balance subtraction query using MongoDB $inc and condition checking { balance: { $gte: amount } } to prevent overdrafts.', b: 0.7, a: 1.6, slug: 'mongodb-modeling' },
  { title: 'PDF Report Generation with Headless Chromium in Node', prompt: 'How do you optimize Puppeteer HTML-to-PDF rendering pipelines for memory re-use and concurrent generation queues?', b: 0.8, a: 1.5, slug: 'nodejs-runtime' },
  { title: 'GraphQL Subscriptions over WebSockets vs Server-Sent Events', prompt: 'Explain the protocol differences between graphql-ws and SSE for pushing live entity mutations to frontend clients.', b: 1.0, a: 1.6, slug: 'api-design' },
  { title: 'Graceful Degradation in Low-Connectivity Web Apps', prompt: 'How do service workers, background sync API, and local storage buffers provide seamless offline-first experience?', b: 0.5, a: 1.4, slug: 'web-performance' },
  { title: 'Session Replay Telemetry (LogRocket / Sentry Replay)', prompt: 'How do session replay tools capture DOM mutation observer deltas without recording sensitive PII inputs?', b: 0.6, a: 1.4, slug: 'web-performance' },
  { title: 'Fullstack Micro-Benchmark Performance Profiling', prompt: 'How do you measure Time To First Byte (TTFB), First Contentful Paint (FCP), and database execution latency in unified telemetry?', b: 0.4, a: 1.3, slug: 'web-performance' },
  { title: 'Single-Page Application Memory Leak Cleanup on Route Change', prompt: 'What teardown logic must run when unmounting complex visualization views with event listeners and setIntervals?', b: -0.3, a: 1.2, slug: 'react-fundamentals' }
];

for (const extra of additionalFullstackTopics) {
  fullstackQuestions.push({
    title: extra.title,
    prompt: extra.prompt,
    track: 'fullstack',
    roundType: 'technical',
    difficultyLevel: extra.b >= 1.5 ? 'expert' : extra.b >= 0.5 ? 'hard' : extra.b >= -0.3 ? 'medium' : 'easy',
    irtParams: { a: extra.a, b: extra.b, c: 0.0 },
    skillSlug: extra.slug,
    idealAnswer: `Comprehensive fullstack technical solution for ${extra.title}: Details cross-cutting concerns between client state, network contracts, and backend data integrity.`,
    keyConcepts: [extra.title.split(' ')[0], 'Fullstack', 'Integration', 'Reliability'],
    rubricWeights: { technicalAccuracy: 0.35, conceptualDepth: 0.3, communication: 0.2, codeEfficiency: 0.05, problemSolving: 0.1 }
  });
}

export default fullstackQuestions;
