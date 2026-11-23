/**
 * @file Admin-Maintained Learning Resources Collection
 * High-quality curated learning materials linked to skills for roadmap generation.
 */

export const sampleResources = [
  // Frontend
  {
    title: 'MDN Web Docs: JavaScript Event Loop & Concurrency',
    skillSlug: 'javascript-async',
    type: 'doc',
    url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Event_loop',
    provider: 'Mozilla Developer Network',
    difficulty: 'Intermediate',
    estimatedHours: 4,
    rating: 4.9,
    isOfficial: true
  },
  {
    title: 'React Official Documentation: Thinking in React & Hooks',
    skillSlug: 'react-hooks',
    type: 'doc',
    url: 'https://react.dev/learn/reusing-logic-with-custom-hooks',
    provider: 'React Core Team',
    difficulty: 'Beginner',
    estimatedHours: 6,
    rating: 4.9,
    isOfficial: true
  },
  {
    title: 'Web.dev: Optimizing Core Web Vitals (LCP, INP, CLS)',
    skillSlug: 'web-performance-vitals',
    type: 'article',
    url: 'https://web.dev/explore/fast',
    provider: 'Google Chrome Team',
    difficulty: 'Intermediate',
    estimatedHours: 5,
    rating: 4.8,
    isOfficial: true
  },
  {
    title: 'TypeScript Deep Dive Handbook',
    skillSlug: 'typescript-fundamentals',
    type: 'course',
    url: 'https://basarat.gitbook.io/typescript/',
    provider: 'TypeScript Community',
    difficulty: 'Intermediate',
    estimatedHours: 10,
    rating: 4.9,
    isOfficial: false
  },

  // Backend
  {
    title: 'Node.js Official Docs: Event Loop, Timers and nextTick',
    skillSlug: 'nodejs-event-loop',
    type: 'doc',
    url: 'https://nodejs.org/en/docs/guides/event-loop-timers-and-nexttick/',
    provider: 'Node.js Foundation',
    difficulty: 'Advanced',
    estimatedHours: 6,
    rating: 4.9,
    isOfficial: true
  },
  {
    title: 'Designing Data-Intensive Applications: Distributed Caching',
    skillSlug: 'distributed-caching-redis',
    type: 'article',
    url: 'https://redis.io/docs/manual/client-side-caching/',
    provider: 'Redis Labs',
    difficulty: 'Intermediate',
    estimatedHours: 8,
    rating: 5.0,
    isOfficial: true
  },
  {
    title: 'Kafka: The Definitive Guide - Event Streaming Architecture',
    skillSlug: 'message-streaming-kafka',
    type: 'book',
    url: 'https://kafka.apache.org/documentation/',
    provider: 'Apache Software Foundation',
    difficulty: 'Advanced',
    estimatedHours: 12,
    rating: 4.8,
    isOfficial: true
  },
  {
    title: 'Martin Fowler: Microservices Guide & Boundary Patterns',
    skillSlug: 'microservices-architecture',
    type: 'article',
    url: 'https://martinfowler.com/articles/microservices.html',
    provider: 'martinfowler.com',
    difficulty: 'Advanced',
    estimatedHours: 6,
    rating: 4.9,
    isOfficial: false
  },

  // Database
  {
    title: 'Use The Index, Luke! - A Guide to Database Performance',
    skillSlug: 'sql-joins-indexing',
    type: 'interactive',
    url: 'https://use-the-index-luke.com/',
    provider: 'Markus Winand',
    difficulty: 'Intermediate',
    estimatedHours: 8,
    rating: 4.9,
    isOfficial: false
  },
  {
    title: 'MongoDB University: Advanced Aggregation Framework',
    skillSlug: 'mongodb-aggregation-pipeline',
    type: 'course',
    url: 'https://learn.mongodb.com/learning-paths/mongodb-aggregation-framework',
    provider: 'MongoDB University',
    difficulty: 'Intermediate',
    estimatedHours: 10,
    rating: 4.8,
    isOfficial: true
  },
  {
    title: 'PostgreSQL Manual: Concurrency Control & Isolation Levels',
    skillSlug: 'acid-transactions',
    type: 'doc',
    url: 'https://www.postgresql.org/docs/current/mvcc.html',
    provider: 'PostgreSQL Global Development Group',
    difficulty: 'Advanced',
    estimatedHours: 6,
    rating: 4.8,
    isOfficial: true
  },
  {
    title: 'Pinecone: Mastering Vector Embeddings for Semantic Search',
    skillSlug: 'vector-databases-indexing',
    type: 'article',
    url: 'https://www.pinecone.io/learn/vector-database/',
    provider: 'Pinecone Labs',
    difficulty: 'Intermediate',
    estimatedHours: 5,
    rating: 4.7,
    isOfficial: true
  },

  // DevOps & Cloud
  {
    title: 'Docker Deep Dive: Multi-Stage Builds & Container Security',
    skillSlug: 'docker-containers',
    type: 'video',
    url: 'https://docs.docker.com/develop/develop-images/multistage-build/',
    provider: 'Docker Official',
    difficulty: 'Intermediate',
    estimatedHours: 5,
    rating: 4.8,
    isOfficial: true
  },
  {
    title: 'Kubernetes Up & Running: Pods, Services, and Ingress',
    skillSlug: 'kubernetes-architecture',
    type: 'course',
    url: 'https://kubernetes.io/docs/tutorials/kubernetes-basics/',
    provider: 'Cloud Native Computing Foundation (CNCF)',
    difficulty: 'Advanced',
    estimatedHours: 14,
    rating: 4.9,
    isOfficial: true
  },
  {
    title: 'Terraform Official Tutorial: HashiCorp Cloud Infrastructure',
    skillSlug: 'infrastructure-as-code-terraform',
    type: 'interactive',
    url: 'https://developer.hashicorp.com/terraform/tutorials',
    provider: 'HashiCorp',
    difficulty: 'Intermediate',
    estimatedHours: 8,
    rating: 4.8,
    isOfficial: true
  },
  {
    title: 'Prometheus & Grafana: Complete Observability Stack',
    skillSlug: 'observability-prometheus-grafana',
    type: 'project',
    url: 'https://prometheus.io/docs/introduction/overview/',
    provider: 'Prometheus IO',
    difficulty: 'Intermediate',
    estimatedHours: 6,
    rating: 4.7,
    isOfficial: true
  },

  // System Design
  {
    title: 'The System Design Primer by Donne Martin',
    skillSlug: 'load-balancing-reverse-proxy',
    type: 'article',
    url: 'https://github.com/donnemartin/system-design-primer',
    provider: 'Open Source Community',
    difficulty: 'Intermediate',
    estimatedHours: 15,
    rating: 5.0,
    isOfficial: false
  },
  {
    title: 'Raft Consensus Algorithm Interactive Visualization',
    skillSlug: 'consensus-algorithms-raft-paxos',
    type: 'interactive',
    url: 'https://raft.github.io/',
    provider: 'Stanford University',
    difficulty: 'Advanced',
    estimatedHours: 6,
    rating: 4.9,
    isOfficial: true
  },
  {
    title: 'Stripe Engineering: Designing Idempotent APIs with Replay Safety',
    skillSlug: 'idempotent-api-design',
    type: 'article',
    url: 'https://stripe.com/blog/idempotency',
    provider: 'Stripe Engineering',
    difficulty: 'Advanced',
    estimatedHours: 4,
    rating: 4.9,
    isOfficial: true
  },
  {
    title: 'Distributed Transactions: The Saga Pattern in Production',
    skillSlug: 'distributed-transactions-saga',
    type: 'article',
    url: 'https://microservices.io/patterns/data/saga.html',
    provider: 'Chris Richardson',
    difficulty: 'Advanced',
    estimatedHours: 7,
    rating: 4.8,
    isOfficial: false
  },

  // Data & AI
  {
    title: 'DeepLearning.AI: Building RAG Systems with Vector Databases',
    skillSlug: 'rag-retrieval-augmented-generation',
    type: 'course',
    url: 'https://www.deeplearning.ai/short-courses/building-rag-systems/',
    provider: 'DeepLearning.AI',
    difficulty: 'Advanced',
    estimatedHours: 8,
    rating: 4.9,
    isOfficial: true
  },
  {
    title: 'Google Cloud: Gemini Prompt Engineering & Structured JSON Mode',
    skillSlug: 'llm-prompt-engineering',
    type: 'doc',
    url: 'https://ai.google.dev/gemini-api/docs/prompting-strategies',
    provider: 'Google DeepMind',
    difficulty: 'Beginner',
    estimatedHours: 4,
    rating: 4.9,
    isOfficial: true
  },

  // Security
  {
    title: 'OAuth 2.0 and OpenID Connect (OIDC) in Plain English',
    skillSlug: 'authentication-jwt-oauth2',
    type: 'video',
    url: 'https://oauth.net/2/',
    provider: 'OAuth Community',
    difficulty: 'Intermediate',
    estimatedHours: 5,
    rating: 4.8,
    isOfficial: true
  },
  {
    title: 'OWASP Top 10 Web Application Security Risks Reference',
    skillSlug: 'owasp-top-10-mitigation',
    type: 'doc',
    url: 'https://owasp.org/www-project-top-ten/',
    provider: 'OWASP Foundation',
    difficulty: 'Intermediate',
    estimatedHours: 6,
    rating: 4.9,
    isOfficial: true
  }
];

export default sampleResources;
