export const backendQuestions = [
  {
    title: 'Node.js Event Loop Phases & Execution Sequence',
    prompt: 'In what exact order do the phases of the libuv event loop execute in Node.js?',
    track: 'backend',
    roundType: 'mcq',
    difficultyLevel: 'hard',
    irtParams: { a: 1.7, b: 0.8, c: 0.25 },
    skillSlug: 'nodejs-runtime',
    options: [
      { text: 'Timers -> Pending Callbacks -> Idle/Prepare -> Poll -> Check -> Close Callbacks', isCorrect: true, explanation: 'This is the exact sequence defined by libuv for each event loop iteration.' },
      { text: 'Poll -> Timers -> Check -> Close -> Pending Callbacks', isCorrect: false, explanation: 'Timers phase always runs first in each iteration.' },
      { text: 'Check -> Timers -> Poll -> Pending Callbacks -> Close', isCorrect: false, explanation: 'Check phase (setImmediate) runs after the Poll phase.' },
      { text: 'Microtasks -> Macrotasks -> Garbage Collection', isCorrect: false, explanation: 'Not the libuv phase names.' }
    ],
    idealAnswer: 'The libuv event loop runs in 6 distinct phases: 1) Timers (setTimeout/setInterval), 2) Pending Callbacks (I/O deferred), 3) Idle/Prepare (internal), 4) Poll (retrieves new I/O events), 5) Check (setImmediate), 6) Close Callbacks (socket.on("close")). Between each phase, nextTick and microtask queues drain.',
    keyConcepts: ['libuv', 'Event Loop Phases', 'Timers', 'Poll Phase', 'Check Phase', 'process.nextTick'],
    rubricWeights: { technicalAccuracy: 0.45, conceptualDepth: 0.35, communication: 0.2, codeEfficiency: 0.0, problemSolving: 0.0 }
  },
  {
    title: 'MongoDB Compound Index Prefix Rule',
    prompt: 'Given an index on { status: 1, createdAt: -1, customerId: 1 }, which query CANNOT take advantage of this index?',
    track: 'backend',
    roundType: 'mcq',
    difficultyLevel: 'medium',
    irtParams: { a: 1.4, b: 0.2, c: 0.25 },
    skillSlug: 'mongodb-modeling',
    options: [
      { text: 'db.orders.find({ customerId: "abc" })', isCorrect: true, explanation: 'customerId is the third field and cannot be used alone without the index prefixes status or status+createdAt.' },
      { text: 'db.orders.find({ status: "active" })', isCorrect: false, explanation: 'status is a prefix of length 1, so the index is used.' },
      { text: 'db.orders.find({ status: "active", createdAt: { $gte: ISODate() } })', isCorrect: false, explanation: 'status+createdAt is a prefix of length 2.' },
      { text: 'db.orders.find({ status: "active", createdAt: { $gte: ISODate() }, customerId: "abc" })', isCorrect: false, explanation: 'Covers all 3 fields.' }
    ],
    idealAnswer: 'MongoDB compound indexes can only support queries that filter on an index prefix starting from the first indexed field.',
    keyConcepts: ['Compound Index', 'Index Prefix Rule', 'B-Tree Indexing', 'Query Optimization'],
    rubricWeights: { technicalAccuracy: 0.5, conceptualDepth: 0.3, communication: 0.2, codeEfficiency: 0.0, problemSolving: 0.0 }
  },
  {
    title: 'PostgreSQL ACID Isolation Levels and Phantom Reads',
    prompt: 'Which transaction isolation level prevents dirty reads and non-repeatable reads, but may still permit phantom reads in standard SQL?',
    track: 'backend',
    roundType: 'mcq',
    difficultyLevel: 'medium',
    irtParams: { a: 1.5, b: 0.4, c: 0.25 },
    skillSlug: 'postgresql-data',
    options: [
      { text: 'Repeatable Read', isCorrect: true, explanation: 'Under standard ANSI SQL, Repeatable Read prevents non-repeatable reads but allows phantom reads (though Postgres implementation uses snapshot isolation preventing them).' },
      { text: 'Read Uncommitted', isCorrect: false, explanation: 'Read Uncommitted allows dirty reads.' },
      { text: 'Read Committed', isCorrect: false, explanation: 'Read Committed allows non-repeatable reads.' },
      { text: 'Serializable', isCorrect: false, explanation: 'Serializable prevents phantom reads completely.' }
    ],
    idealAnswer: 'Repeatable Read guarantees that any data read cannot change throughout the transaction, preventing dirty reads and non-repeatable reads. In standard SQL-92, phantom rows inserted by concurrent transactions were still possible.',
    keyConcepts: ['ACID', 'Isolation Levels', 'Repeatable Read', 'Phantom Reads', 'Snapshot Isolation'],
    rubricWeights: { technicalAccuracy: 0.45, conceptualDepth: 0.35, communication: 0.2, codeEfficiency: 0.0, problemSolving: 0.0 }
  },
  {
    title: 'JWT Refresh Token Rotation & Replay Attack Defense',
    prompt: 'How does refresh token rotation protect against stolen token replay attacks?',
    track: 'backend',
    roundType: 'technical',
    difficultyLevel: 'hard',
    irtParams: { a: 1.8, b: 1.1, c: 0.0 },
    skillSlug: 'api-design',
    idealAnswer: 'Every time a refresh token is used, the server immediately revokes it and issues a new refresh token and access token. If an attacker and a legitimate user both attempt to use the same previously consumed token (replay attack), the server recognizes the reuse, invalidates the entire token family, and forces all sessions for that user to log in again with fresh credentials.',
    keyConcepts: ['Refresh Token Rotation', 'Replay Attack Detection', 'Token Family Invalidation', 'Revocation List'],
    rubricWeights: { technicalAccuracy: 0.4, conceptualDepth: 0.3, communication: 0.2, codeEfficiency: 0.0, problemSolving: 0.1 }
  },
  {
    title: 'Redis Cache Stampede (Thundering Herd) Solutions',
    prompt: 'Explain the cache stampede problem and detail three architectural strategies to mitigate it in high-traffic Node.js services.',
    track: 'backend',
    roundType: 'technical',
    difficultyLevel: 'hard',
    irtParams: { a: 1.9, b: 1.4, c: 0.0 },
    skillSlug: 'distributed-caching',
    idealAnswer: 'A cache stampede occurs when a hot cache key expires, causing thousands of concurrent requests to simultaneously miss the cache and overwhelm the database. Three solutions: 1) Mutex / Distributed Locking (Redlock): Only one worker acquires lock to recompute key while others wait or return stale. 2) Probabilistic Early Expiration (XFetch algorithm): Recompute value before expiration with probability proportional to computation time and TTL. 3) Background cron / worker refresh: Hot keys never expire passively; background workers update cache asynchronously.',
    keyConcepts: ['Cache Stampede', 'Thundering Herd', 'Distributed Lock (Redlock)', 'Probabilistic Expiration (XFetch)', 'Background Warmup'],
    rubricWeights: { technicalAccuracy: 0.35, conceptualDepth: 0.3, communication: 0.15, codeEfficiency: 0.1, problemSolving: 0.1 }
  },
  {
    title: 'Write a Sliding Window Rate Limiter in Redis',
    prompt: 'Implement a sliding window log rate limiter function using Redis sorted sets (ZADD, ZREMRANGEBYSCORE, ZCARD) in Node.js.',
    track: 'backend',
    roundType: 'coding',
    difficultyLevel: 'hard',
    irtParams: { a: 1.8, b: 1.2, c: 0.0 },
    skillSlug: 'distributed-caching',
    codeStub: {
      language: 'javascript',
      starterCode: 'async function isRateLimited(redis, key, limit = 100, windowSec = 60) {\n  // Implement sliding window rate limit\n}',
      solutionTemplate: 'async function isRateLimited(redis, key, limit = 100, windowSec = 60) {\n  const now = Date.now();\n  const windowStart = now - windowSec * 1000;\n  const pipeline = redis.pipeline();\n  pipeline.zremrangebyscore(key, 0, windowStart);\n  pipeline.zadd(key, now, `${now}-${Math.random()}`);\n  pipeline.zcard(key);\n  pipeline.expire(key, windowSec);\n  const results = await pipeline.exec();\n  const count = results[2][1];\n  return count > limit;\n}'
    },
    testCases: [
      { input: '10 requests in 1 second with limit 5', expectedOutput: 'Requests 6-10 return true (rate limited)', isHidden: false }
    ],
    idealAnswer: 'Use Redis Sorted Set. ZREMRANGEBYSCORE removes timestamps older than now - window. ZADD adds current timestamp. ZCARD counts remaining items. If count > limit, reject request. Use MULTI/pipeline for atomic execution.',
    keyConcepts: ['Sliding Window Rate Limiter', 'Redis Sorted Sets (ZSET)', 'Pipeline Atomicity', 'TTL Expiration'],
    rubricWeights: { technicalAccuracy: 0.35, conceptualDepth: 0.2, communication: 0.1, codeEfficiency: 0.15, problemSolving: 0.2 }
  }
];

const additionalBackendTopics = [
  { title: 'Node.js Streams Backpressure Handling', prompt: 'What is backpressure in Node.js streams and how does readable.pipe(writable) manage high-watermark buffers?', b: 0.8, a: 1.6, slug: 'nodejs-runtime' },
  { title: 'Database Connection Pooling Optimization', prompt: 'How do connection pools optimize latency and prevent thread starvation under concurrent loads?', b: 0.1, a: 1.3, slug: 'postgresql-data' },
  { title: 'Distributed Tracing with OpenTelemetry', prompt: 'Explain the role of TraceId, SpanId, and baggage headers in tracking requests across microservices.', b: 1.3, a: 1.7, slug: 'message-queues' },
  { title: 'Kafka Partitioning and Consumer Group Rebalancing', prompt: 'What triggers a consumer group rebalance in Apache Kafka, and how does consumer lag accumulate?', b: 1.5, a: 1.8, slug: 'message-queues' },
  { title: 'Optimistic vs Pessimistic Concurrency Control', prompt: 'When should optimistic locking (version column) be preferred over pessimistic locking (SELECT FOR UPDATE)?', b: 0.6, a: 1.4, slug: 'postgresql-data' },
  { title: 'RESTful API Versioning Strategies', prompt: 'Compare URI path versioning, query parameter versioning, and Accept header content negotiation versioning.', b: -0.3, a: 1.2, slug: 'api-design' },
  { title: 'Node.js Cluster Module vs PM2', prompt: 'How does the Node.js cluster module share server ports among child worker processes using SO_REUSEPORT or master round-robin?', b: 0.7, a: 1.5, slug: 'nodejs-runtime' },
  { title: 'MongoDB Sharding and Chunk Splitting', prompt: 'Explain how the MongoDB balancer redistributes chunk ranges across shard replica sets.', b: 1.4, a: 1.8, slug: 'mongodb-modeling' },
  { title: 'gRPC Protocol Buffers vs JSON over HTTP/2', prompt: 'Why is binary serialization with Protobuf significantly faster and less bandwidth-intensive than JSON?', b: 0.9, a: 1.6, slug: 'api-design' },
  { title: 'Database Normalization: 1NF through BCNF', prompt: 'Detail the functional dependency violations addressed by Third Normal Form (3NF) and Boyce-Codd Normal Form (BCNF).', b: 0.5, a: 1.4, slug: 'postgresql-data' },
  { title: 'Saga Pattern for Distributed Transactions', prompt: 'Compare Choreography-based Sagas with Orchestration-based Sagas when coordinating multi-service transactions with compensating actions.', b: 1.8, a: 2.1, slug: 'message-queues' },
  { title: 'Deadlock Detection and Graph Cycles', prompt: 'How do database engines detect deadlocks using wait-for graphs and resolve them via victim selection?', b: 1.0, a: 1.6, slug: 'postgresql-data' },
  { title: 'Content Delivery Network (CDN) Cache Invalidation', prompt: 'Compare TTL expiration with surrogate-key / cache-tag purging in modern edge networks like Fastly and Cloudflare.', b: 0.6, a: 1.4, slug: 'distributed-caching' },
  { title: 'Node.js Memory Leak Profiling with Heap Snapshots', prompt: 'How do you analyze detached DOM nodes or uncollected closures using V8 heap snapshot comparison in Node.js?', b: 1.1, a: 1.7, slug: 'nodejs-runtime' },
  { title: 'B-Tree vs LSM-Tree Storage Engines', prompt: 'Why do LSM-Trees (RocksDB, Cassandra) optimize for write-heavy workloads while B-Trees optimize for read-heavy workloads?', b: 1.7, a: 2.0, slug: 'postgresql-data' },
  { title: 'OAuth2 Authorization Code Flow with PKCE', prompt: 'Why is Proof Key for Code Exchange (PKCE) necessary to protect public mobile and SPA clients against authorization code interception?', b: 0.9, a: 1.6, slug: 'api-design' },
  { title: 'Circuit Breaker Pattern in Microservices', prompt: 'Explain the Closed, Open, and Half-Open states of a circuit breaker pattern (e.g. Opossum or Resilience4j).', b: 0.7, a: 1.5, slug: 'message-queues' },
  { title: 'Zero Downtime Database Migrations', prompt: 'Describe the expand-and-contract (parallel run) pattern for renaming a column without downtime in production.', b: 1.2, a: 1.7, slug: 'postgresql-data' },
  { title: 'SQL Injection Remediation with Prepared Statements', prompt: 'Why do parameterized queries eliminate SQL injection risk regardless of input string escaping?', b: -0.7, a: 1.2, slug: 'postgresql-data' },
  { title: 'Webhook Delivery Reliability and Exponential Backoff', prompt: 'How do you design a resilient webhook dispatch engine with retry queues, dead-letter exchanges, and HMAC SHA256 signatures?', b: 1.0, a: 1.6, slug: 'api-design' },
  { title: 'Node.js Worker Threads vs Child Processes', prompt: 'When should worker_threads be chosen over child_process for executing CPU-heavy tasks in Node.js?', b: 0.5, a: 1.4, slug: 'nodejs-runtime' },
  { title: 'CORS Preflight (OPTIONS) Request Triggering', prompt: 'What request headers or HTTP methods trigger a browser CORS preflight check?', b: -0.4, a: 1.2, slug: 'api-design' },
  { title: 'Message Deduplication with Kafka Exactly-Once Semantics', prompt: 'Explain the role of transactional IDs and idempotent producers in achieving exactly-once processing.', b: 1.9, a: 2.2, slug: 'message-queues' },
  { title: 'GraphQL N+1 Query Problem & DataLoader Batching', prompt: 'How does DataLoader coalesce multiple database roundtrips across GraphQL resolvers into a single batched query?', b: 0.8, a: 1.6, slug: 'api-design' },
  { title: 'Server-Sent Events (SSE) vs WebSockets for Live Feeds', prompt: 'When is HTTP/2 Server-Sent Events more appropriate than bidirectional WebSockets?', b: 0.3, a: 1.3, slug: 'api-design' },
  { title: 'Handling Node.js UnhandledRejection and UncaughtException', prompt: 'Why is it standard practice to gracefully exit the Node.js process after an uncaughtException rather than attempting to recover?', b: 0.4, a: 1.4, slug: 'nodejs-runtime' }
];

for (const extra of additionalBackendTopics) {
  backendQuestions.push({
    title: extra.title,
    prompt: extra.prompt,
    track: 'backend',
    roundType: 'technical',
    difficultyLevel: extra.b >= 1.5 ? 'expert' : extra.b >= 0.5 ? 'hard' : extra.b >= -0.3 ? 'medium' : 'easy',
    irtParams: { a: extra.a, b: extra.b, c: 0.0 },
    skillSlug: extra.slug,
    idealAnswer: `Comprehensive backend architectural analysis for ${extra.title}: Explains low-level runtime behavior, network efficiency, data safety, and failure recovery with industry-standard patterns.`,
    keyConcepts: [extra.title.split(' ')[0], 'Backend Architecture', 'Reliability', 'Performance'],
    rubricWeights: { technicalAccuracy: 0.4, conceptualDepth: 0.3, communication: 0.2, codeEfficiency: 0.05, problemSolving: 0.05 }
  });
}

export default backendQuestions;
