/**
 * @file AdaptIQ Comprehensive Skill Taxonomy & Prerequisite Graph (80+ Skills)
 * Spans Frontend, Backend, Database, DevOps, System Design, Data & AI, and Security.
 */

export const comprehensiveSkills = [
  // ==========================================
  // 1. FRONTEND CORE & ARCHITECTURE (15 Skills)
  // ==========================================
  {
    name: 'HTML5 Semantics & Accessibility',
    slug: 'html-semantics-a11y',
    category: 'Frontend',
    description: 'Semantic elements, ARIA attributes, keyboard navigation, screen reader accessibility',
    weight: 1.0,
    prerequisites: []
  },
  {
    name: 'CSS Modern Flexbox & Grid',
    slug: 'css-flexbox-grid',
    category: 'Frontend',
    description: 'Modern 2D layout systems, flexbox alignment, grid tracks, template areas',
    weight: 1.0,
    prerequisites: []
  },
  {
    name: 'Responsive Web Design & Tailwind',
    slug: 'responsive-design-tailwind',
    category: 'Frontend',
    description: 'Mobile-first breakpoints, utility-first CSS, fluid typography, dark mode',
    weight: 1.0,
    prerequisites: ['css-flexbox-grid']
  },
  {
    name: 'JavaScript Core Fundamentals',
    slug: 'javascript-core',
    category: 'Frontend',
    description: 'Scope, closures, prototypes, type coercion, hoisting, ES6+ syntax',
    weight: 1.2,
    prerequisites: []
  },
  {
    name: 'JavaScript Asynchronous Programming',
    slug: 'javascript-async',
    category: 'Frontend',
    description: 'Promises, async/await, microtasks vs macrotasks, event loop, Fetch API',
    weight: 1.2,
    prerequisites: ['javascript-core']
  },
  {
    name: 'TypeScript Fundamentals',
    slug: 'typescript-fundamentals',
    category: 'Frontend',
    description: 'Static typing, interfaces, generics, utility types, unions, type narrowing',
    weight: 1.2,
    prerequisites: ['javascript-core']
  },
  {
    name: 'React Fundamentals',
    slug: 'react-fundamentals',
    category: 'Frontend',
    description: 'JSX, functional components, props, state, lifecycles, synthetic events',
    weight: 1.2,
    prerequisites: ['javascript-core', 'html-semantics-a11y']
  },
  {
    name: 'React Hooks & Custom Hooks',
    slug: 'react-hooks',
    category: 'Frontend',
    description: 'useState, useEffect, useMemo, useCallback, useRef, custom hook encapsulation',
    weight: 1.2,
    prerequisites: ['react-fundamentals', 'javascript-async']
  },
  {
    name: 'React Virtual DOM & Reconciliation',
    slug: 'react-virtual-dom',
    category: 'Frontend',
    description: 'Fiber architecture, diffing algorithm, key prop optimization, concurrent rendering',
    weight: 1.1,
    prerequisites: ['react-hooks']
  },
  {
    name: 'State Management with Redux Toolkit',
    slug: 'state-management-redux',
    category: 'Frontend',
    description: 'Unidirectional data flow, slices, thunks, selectors, RTK Query',
    weight: 1.1,
    prerequisites: ['react-hooks', 'javascript-async']
  },
  {
    name: 'State Management with Zustand',
    slug: 'state-management-zustand',
    category: 'Frontend',
    description: 'Lightweight reactive stores, atomic selectors, transient updates, middleware',
    weight: 1.0,
    prerequisites: ['react-hooks']
  },
  {
    name: 'Core Web Vitals & Web Performance',
    slug: 'web-performance-vitals',
    category: 'Frontend',
    description: 'LCP, FID, INP, CLS optimization, code splitting, lazy loading, tree shaking',
    weight: 1.2,
    prerequisites: ['javascript-async', 'react-virtual-dom']
  },
  {
    name: 'Browser Storage & Service Workers',
    slug: 'browser-storage-service-workers',
    category: 'Frontend',
    description: 'IndexedDB, LocalStorage, Cache API, background sync, progressive web apps',
    weight: 1.0,
    prerequisites: ['javascript-async']
  },
  {
    name: 'Frontend Build Tools & Vite',
    slug: 'frontend-build-tools-vite',
    category: 'Frontend',
    description: 'Vite, Rollup, ESBuild, HMR, bundling, assets processing, environment flags',
    weight: 1.0,
    prerequisites: ['javascript-core']
  },
  {
    name: 'Micro-Frontends Architecture',
    slug: 'micro-frontends',
    category: 'Frontend',
    description: 'Module federation, single-spa, isolated routing, cross-app communication',
    weight: 1.3,
    prerequisites: ['react-virtual-dom', 'frontend-build-tools-vite']
  },

  // ==========================================
  // 2. BACKEND & DISTRIBUTED SYSTEMS (15 Skills)
  // ==========================================
  {
    name: 'Node.js Runtime & Architecture',
    slug: 'nodejs-runtime',
    category: 'Backend',
    description: 'V8 engine integration, Libuv, C++ bindings, thread pool, memory management',
    weight: 1.2,
    prerequisites: ['javascript-core']
  },
  {
    name: 'Node.js Event Loop & Non-Blocking I/O',
    slug: 'nodejs-event-loop',
    category: 'Backend',
    description: 'Timers, pending callbacks, poll, check, close phases, setImmediate vs nextTick',
    weight: 1.3,
    prerequisites: ['nodejs-runtime', 'javascript-async']
  },
  {
    name: 'Node.js Streams & Buffers',
    slug: 'nodejs-streams-buffers',
    category: 'Backend',
    description: 'Readable, Writable, Transform streams, backpressure management, raw buffer allocation',
    weight: 1.2,
    prerequisites: ['nodejs-runtime']
  },
  {
    name: 'RESTful API Architecture & Design',
    slug: 'rest-api-design',
    category: 'Backend',
    description: 'HTTP verbs, idempotency, status codes, OpenAPI/Swagger, URI hierarchies, pagination',
    weight: 1.1,
    prerequisites: ['nodejs-runtime']
  },
  {
    name: 'Express.js Framework & Middleware',
    slug: 'express-framework',
    category: 'Backend',
    description: 'Routing, middleware chains, error handling, route validation, request sanitization',
    weight: 1.1,
    prerequisites: ['nodejs-runtime', 'rest-api-design']
  },
  {
    name: 'GraphQL API Design & Resolvers',
    slug: 'graphql-api-design',
    category: 'Backend',
    description: 'Schemas, types, queries, mutations, subscriptions, N+1 DataLoader batching',
    weight: 1.2,
    prerequisites: ['rest-api-design']
  },
  {
    name: 'gRPC & Protocol Buffers',
    slug: 'grpc-protocol-buffers',
    category: 'Backend',
    description: 'Proto3 definitions, HTTP/2 multiplexing, bidirectional streaming, serialization',
    weight: 1.3,
    prerequisites: ['nodejs-streams-buffers']
  },
  {
    name: 'WebSockets & Real-Time Events',
    slug: 'websocket-realtime',
    category: 'Backend',
    description: 'Full-duplex TCP communication, Socket.io, connection pooling, heartbeats, rooms',
    weight: 1.2,
    prerequisites: ['nodejs-event-loop']
  },
  {
    name: 'Microservices Architecture',
    slug: 'microservices-architecture',
    category: 'Backend',
    description: 'Domain-driven design, service boundaries, loose coupling, inter-service calls',
    weight: 1.3,
    prerequisites: ['rest-api-design', 'express-framework']
  },
  {
    name: 'API Gateway & Reverse Proxy',
    slug: 'api-gateway-pattern',
    category: 'Backend',
    description: 'BFF pattern, routing, SSL termination, request aggregation, authentication offloading',
    weight: 1.2,
    prerequisites: ['microservices-architecture']
  },
  {
    name: 'Event-Driven Architecture',
    slug: 'event-driven-architecture',
    category: 'Backend',
    description: 'Pub/sub patterns, event buses, event storming, consumer idempotency, dead-letter queues',
    weight: 1.3,
    prerequisites: ['microservices-architecture']
  },
  {
    name: 'Distributed Caching with Redis',
    slug: 'distributed-caching-redis',
    category: 'Backend',
    description: 'In-memory data structures, cache-aside, write-through, TTL eviction, Redis clusters',
    weight: 1.3,
    prerequisites: ['nodejs-runtime']
  },
  {
    name: 'Message Queues with RabbitMQ',
    slug: 'message-queues-rabbitmq',
    category: 'Backend',
    description: 'Exchanges (direct, fanout, topic), queues, consumer acknowledgments, prefetch count',
    weight: 1.2,
    prerequisites: ['event-driven-architecture']
  },
  {
    name: 'Distributed Streaming with Apache Kafka',
    slug: 'message-streaming-kafka',
    category: 'Backend',
    description: 'Append-only commit log, partitions, consumer groups, offset commits, exactly-once',
    weight: 1.4,
    prerequisites: ['event-driven-architecture']
  },
  {
    name: 'Resilience Patterns & Circuit Breakers',
    slug: 'circuit-breaker-resilience',
    category: 'Backend',
    description: 'Hystrix pattern, open/half-open/closed states, exponential backoff, bulkheads',
    weight: 1.2,
    prerequisites: ['microservices-architecture']
  },

  // ==========================================
  // 3. DATABASE & DATA MODELING (12 Skills)
  // ==========================================
  {
    name: 'Relational Database Modeling',
    slug: 'relational-db-modeling',
    category: 'Database',
    description: 'Entity-relationship diagrams, 1st/2nd/3rd normal forms, foreign keys, constraints',
    weight: 1.1,
    prerequisites: []
  },
  {
    name: 'SQL Querying, Joins & Indexing',
    slug: 'sql-joins-indexing',
    category: 'Database',
    description: 'INNER/LEFT/OUTER joins, subqueries, B-tree indexes, composite indexes, EXPLAIN ANALYZE',
    weight: 1.2,
    prerequisites: ['relational-db-modeling']
  },
  {
    name: 'ACID Transactions & Isolation Levels',
    slug: 'acid-transactions',
    category: 'Database',
    description: 'Atomicity, Consistency, Isolation (Read Committed, Repeatable Read, Serializable), Durability',
    weight: 1.3,
    prerequisites: ['sql-joins-indexing']
  },
  {
    name: 'PostgreSQL Advanced Features',
    slug: 'postgresql-advanced',
    category: 'Database',
    description: 'JSONB columns, GIN indexes, CTEs, window functions, table partitioning',
    weight: 1.2,
    prerequisites: ['sql-joins-indexing']
  },
  {
    name: 'NoSQL Database Paradigms',
    slug: 'nosql-concepts',
    category: 'Database',
    description: 'Document, Key-Value, Wide-Column, Graph models; schema-on-read vs schema-on-write',
    weight: 1.1,
    prerequisites: []
  },
  {
    name: 'MongoDB Document Modeling & Schema Design',
    slug: 'mongodb-modeling',
    category: 'Database',
    description: 'Embedding vs referencing, one-to-many, polymorphic schemas, schema validation',
    weight: 1.2,
    prerequisites: ['nosql-concepts']
  },
  {
    name: 'MongoDB Aggregation Pipeline',
    slug: 'mongodb-aggregation-pipeline',
    category: 'Database',
    description: '$match, $group, $lookup, $unwind, $facet, analytical computations, pipeline performance',
    weight: 1.3,
    prerequisites: ['mongodb-modeling']
  },
  {
    name: 'Database Replication & High Availability',
    slug: 'database-replication-failover',
    category: 'Database',
    description: 'Primary-replica architecture, write ahead log (WAL), replication lag, automatic failover',
    weight: 1.3,
    prerequisites: ['acid-transactions']
  },
  {
    name: 'Database Sharding & Horizontal Partitioning',
    slug: 'database-sharding-partitioning',
    category: 'Database',
    description: 'Shard keys, hash vs range partitioning, scatter-gather queries, cross-shard joins',
    weight: 1.4,
    prerequisites: ['database-replication-failover']
  },
  {
    name: 'Distributed Transactions & Saga Pattern',
    slug: 'distributed-transactions-saga',
    category: 'Database',
    description: 'Two-phase commit (2PC), orchestrator vs choreography sagas, compensating transactions',
    weight: 1.4,
    prerequisites: ['acid-transactions', 'event-driven-architecture']
  },
  {
    name: 'Vector Databases & Similarity Search',
    slug: 'vector-databases-indexing',
    category: 'Database',
    description: 'HNSW, IVF indexes, high-dimensional vector embeddings, Pinecone, Chroma, pgvector',
    weight: 1.3,
    prerequisites: ['sql-joins-indexing']
  },
  {
    name: 'Full-Text Search & Elasticsearch',
    slug: 'elasticsearch-search',
    category: 'Database',
    description: 'Inverted indexes, tokenization, stemming, TF-IDF / BM25 relevance scoring',
    weight: 1.2,
    prerequisites: ['nosql-concepts']
  },

  // ==========================================
  // 4. DEVOPS, CLOUD & INFRASTRUCTURE (12 Skills)
  // ==========================================
  {
    name: 'Linux System Administration & Shell',
    slug: 'linux-command-line',
    category: 'DevOps',
    description: 'Processes, file permissions, pipes, systemd, bash scripting, memory/disk monitoring',
    weight: 1.1,
    prerequisites: []
  },
  {
    name: 'Computer Networking & HTTP/HTTPS',
    slug: 'networking-dns-tcp-http',
    category: 'DevOps',
    description: 'OSI layers, TCP 3-way handshake, DNS resolution, TLS certificates, HTTP/2 and HTTP/3',
    weight: 1.2,
    prerequisites: ['linux-command-line']
  },
  {
    name: 'Git Version Control & Branching Workflows',
    slug: 'git-version-control',
    category: 'DevOps',
    description: 'Rebase, cherry-pick, conflict resolution, GitFlow, trunk-based development',
    weight: 1.0,
    prerequisites: []
  },
  {
    name: 'Docker & Containerization Fundamentals',
    slug: 'docker-containers',
    category: 'DevOps',
    description: 'Namespaces, cgroups, Dockerfile syntax, images, containers, networks, volumes',
    weight: 1.2,
    prerequisites: ['linux-command-line']
  },
  {
    name: 'Docker Multi-Stage Builds & Compose',
    slug: 'docker-multi-stage-compose',
    category: 'DevOps',
    description: 'Image footprint minimization, security hardening, multi-container compose stacks',
    weight: 1.1,
    prerequisites: ['docker-containers']
  },
  {
    name: 'Kubernetes Cluster Architecture & Pods',
    slug: 'kubernetes-architecture',
    category: 'DevOps',
    description: 'Control plane (etcd, kube-apiserver, scheduler), worker nodes, pods, replicaSets',
    weight: 1.3,
    prerequisites: ['docker-containers', 'networking-dns-tcp-http']
  },
  {
    name: 'Kubernetes Deployments, Ingress & Helm',
    slug: 'kubernetes-ingress-helm',
    category: 'DevOps',
    description: 'Rolling updates, services (ClusterIP, NodePort), NGINX ingress, Helm chart templating',
    weight: 1.3,
    prerequisites: ['kubernetes-architecture']
  },
  {
    name: 'CI/CD Pipelines with GitHub Actions',
    slug: 'cicd-github-actions',
    category: 'DevOps',
    description: 'Workflows, triggers, matrix testing, secret management, artifact caching, deploy steps',
    weight: 1.2,
    prerequisites: ['git-version-control', 'docker-containers']
  },
  {
    name: 'Infrastructure as Code with Terraform',
    slug: 'infrastructure-as-code-terraform',
    category: 'DevOps',
    description: 'Declarative HCL, state management, remote backends, providers, modules, drift detection',
    weight: 1.3,
    prerequisites: ['linux-command-line', 'cloud-aws-essentials']
  },
  {
    name: 'Cloud Computing Fundamentals (AWS/GCP)',
    slug: 'cloud-aws-essentials',
    category: 'DevOps',
    description: 'IAM roles, VPC, EC2/Compute Engine, S3/Cloud Storage, security groups, regions/AZs',
    weight: 1.2,
    prerequisites: ['networking-dns-tcp-http']
  },
  {
    name: 'Monitoring & Metrics with Prometheus & Grafana',
    slug: 'observability-prometheus-grafana',
    category: 'DevOps',
    description: 'Time-series metrics, counters, gauges, histograms, PromQL queries, dashboard alerts',
    weight: 1.2,
    prerequisites: ['linux-command-line', 'docker-containers']
  },
  {
    name: 'Distributed Tracing & OpenTelemetry',
    slug: 'distributed-tracing-opentelemetry',
    category: 'DevOps',
    description: 'Spans, trace context propagation, Jaeger, sampling strategies, latency debugging',
    weight: 1.3,
    prerequisites: ['microservices-architecture', 'observability-prometheus-grafana']
  },

  // ==========================================
  // 5. SYSTEM DESIGN & HIGH AVAILABILITY (10 Skills)
  // ==========================================
  {
    name: 'Load Balancing & Reverse Proxies',
    slug: 'load-balancing-reverse-proxy',
    category: 'System Design',
    description: 'L4 vs L7 load balancing, round robin, least connections, consistent hashing, NGINX',
    weight: 1.3,
    prerequisites: ['networking-dns-tcp-http']
  },
  {
    name: 'Content Delivery Networks (CDN) & Edge Caching',
    slug: 'cdn-edge-caching',
    category: 'System Design',
    description: 'Edge points of presence (PoPs), cache invalidation, surrogate keys, static asset caching',
    weight: 1.2,
    prerequisites: ['load-balancing-reverse-proxy']
  },
  {
    name: 'CAP Theorem & PACELC Trade-Offs',
    slug: 'cap-theorem-consistency',
    category: 'System Design',
    description: 'Consistency, Availability, Partition tolerance; eventual consistency, read-your-writes',
    weight: 1.3,
    prerequisites: ['database-replication-failover']
  },
  {
    name: 'Consensus Algorithms (Raft & Paxos)',
    slug: 'consensus-algorithms-raft-paxos',
    category: 'System Design',
    description: 'Leader election, log replication, split brain prevention, quorum-based state machines',
    weight: 1.4,
    prerequisites: ['cap-theorem-consistency']
  },
  {
    name: 'Horizontal Scaling & Stateless Architecture',
    slug: 'horizontal-scaling-statelessness',
    category: 'System Design',
    description: 'Stateless application tiers, session externalization to Redis, autoscaling groups',
    weight: 1.2,
    prerequisites: ['load-balancing-reverse-proxy', 'distributed-caching-redis']
  },
  {
    name: 'Disaster Recovery, RPO & RTO',
    slug: 'disaster-recovery-rpo-rto',
    category: 'System Design',
    description: 'Recovery Point Objective, Recovery Time Objective, active-active multi-region, backups',
    weight: 1.2,
    prerequisites: ['database-replication-failover']
  },
  {
    name: 'Database Connection Pooling',
    slug: 'database-connection-pooling',
    category: 'System Design',
    description: 'PgBouncer, max client connections, connection lifecycles, statement-level pooling',
    weight: 1.2,
    prerequisites: ['sql-joins-indexing', 'nodejs-runtime']
  },
  {
    name: 'CQRS & Event Sourcing',
    slug: 'cqrs-event-sourcing',
    category: 'System Design',
    description: 'Command-Query Responsibility Segregation, immutable event streams, projection stores',
    weight: 1.4,
    prerequisites: ['event-driven-architecture', 'mongodb-modeling']
  },
  {
    name: 'Idempotency & Deduplication',
    slug: 'idempotent-api-design',
    category: 'System Design',
    description: 'Idempotency keys, atomic check-and-set, token buckets, replay attack mitigation',
    weight: 1.3,
    prerequisites: ['distributed-caching-redis', 'rest-api-design']
  },
  {
    name: 'Distributed Locking (Redlock & Etcd)',
    slug: 'distributed-locking-redlock',
    category: 'System Design',
    description: 'Mutex across nodes, Redis TTL lease renewal, fence tokens, race condition prevention',
    weight: 1.4,
    prerequisites: ['distributed-caching-redis', 'cap-theorem-consistency']
  },

  // ==========================================
  // 6. DATA & AI SYSTEMS (10 Skills)
  // ==========================================
  {
    name: 'Linear Algebra & Statistics for Machine Learning',
    slug: 'linear-algebra-statistics',
    category: 'Data & AI',
    description: 'Matrix multiplication, dot products, eigenvalues, mean, variance, Gaussian distributions',
    weight: 1.2,
    prerequisites: []
  },
  {
    name: 'Supervised Learning & Regression Modeling',
    slug: 'supervised-learning-regression',
    category: 'Data & AI',
    description: 'Linear/Ridge regression, L1/L2 regularization, mean squared error, gradient descent',
    weight: 1.3,
    prerequisites: ['linear-algebra-statistics']
  },
  {
    name: 'Feature Engineering & Data Preprocessing',
    slug: 'feature-engineering-normalization',
    category: 'Data & AI',
    description: 'Min-max scaling, Z-score standardization, one-hot encoding, missing value imputation',
    weight: 1.1,
    prerequisites: ['linear-algebra-statistics']
  },
  {
    name: 'Dense Vector Embeddings',
    slug: 'word-embeddings-dense-vectors',
    category: 'Data & AI',
    description: 'Semantic vector representations, token embeddings, dimensional projection, normalization',
    weight: 1.2,
    prerequisites: ['linear-algebra-statistics']
  },
  {
    name: 'Cosine Similarity & Distance Metrics',
    slug: 'vector-similarity-cosine',
    category: 'Data & AI',
    description: 'Cosine similarity, Euclidean distance, Dot product distance, Manhattan metric',
    weight: 1.1,
    prerequisites: ['word-embeddings-dense-vectors']
  },
  {
    name: 'Retrieval-Augmented Generation (RAG)',
    slug: 'rag-retrieval-augmented-generation',
    category: 'Data & AI',
    description: 'Chunking strategies, embedding retrieval, re-ranking, context injection, hallucination reduction',
    weight: 1.4,
    prerequisites: ['vector-databases-indexing', 'vector-similarity-cosine']
  },
  {
    name: 'LLM Prompt Engineering & System Design',
    slug: 'llm-prompt-engineering',
    category: 'Data & AI',
    description: 'Few-shot prompting, Chain-of-Thought, structured JSON schemas, system instructions',
    weight: 1.2,
    prerequisites: []
  },
  {
    name: 'LLM Evaluation & Guardrails',
    slug: 'llm-evaluation-guardrails',
    category: 'Data & AI',
    description: 'Model-as-a-judge, rubric evaluation, citation verification, prompt injection defense',
    weight: 1.3,
    prerequisites: ['llm-prompt-engineering']
  },
  {
    name: 'Autonomous AI Agentic Workflows',
    slug: 'ai-agentic-workflows',
    category: 'Data & AI',
    description: 'ReAct pattern, function/tool calling, plan-and-solve loops, self-correction, memory',
    weight: 1.4,
    prerequisites: ['llm-prompt-engineering', 'rag-retrieval-augmented-generation']
  },
  {
    name: 'Item Response Theory & Psychometrics in Code',
    slug: 'irt-psychometrics-code',
    category: 'Data & AI',
    description: '1PL/2PL/3PL models, Fisher information, EAP theta estimation, CAT stopping rules',
    weight: 1.3,
    prerequisites: ['linear-algebra-statistics']
  },

  // ==========================================
  // 7. SECURITY & COMPLIANCE (6 Skills)
  // ==========================================
  {
    name: 'JWT & OAuth2 Authentication Architecture',
    slug: 'authentication-jwt-oauth2',
    category: 'Security',
    description: 'Access vs refresh tokens, signing algorithms (RS256/HS256), PKCE flow, token revocation',
    weight: 1.3,
    prerequisites: ['nodejs-runtime', 'rest-api-design']
  },
  {
    name: 'Role-Based Access Control (RBAC)',
    slug: 'role-based-access-control',
    category: 'Security',
    description: 'Permissions, roles, claims inspection, hierarchical access, principle of least privilege',
    weight: 1.2,
    prerequisites: ['authentication-jwt-oauth2']
  },
  {
    name: 'OWASP Top 10 Vulnerability Mitigation',
    slug: 'owasp-top-10-mitigation',
    category: 'Security',
    description: 'Broken access control, cryptographic failures, injection, SSRF, security misconfigurations',
    weight: 1.3,
    prerequisites: ['rest-api-design', 'networking-dns-tcp-http']
  },
  {
    name: 'Data Encryption (TLS & AES-256)',
    slug: 'data-encryption-tls-aes',
    category: 'Security',
    description: 'Symmetric vs asymmetric encryption, hashing (bcrypt/argon2), salting, data in transit & at rest',
    weight: 1.2,
    prerequisites: ['networking-dns-tcp-http']
  },
  {
    name: 'SQL Injection & XSS Prevention',
    slug: 'sqli-xss-prevention',
    category: 'Security',
    description: 'Parameterized queries, ORM safety, Content Security Policy (CSP), HTML escaping, sanitized cookies',
    weight: 1.2,
    prerequisites: ['sql-joins-indexing', 'html-semantics-a11y']
  },
  {
    name: 'Zero-Trust Architecture & Micro-segmentation',
    slug: 'zero-trust-architecture',
    category: 'Security',
    description: 'Never trust always verify, mTLS inter-service authentication, service mesh security policies',
    weight: 1.4,
    prerequisites: ['microservices-architecture', 'authentication-jwt-oauth2']
  }
];

export default comprehensiveSkills;
