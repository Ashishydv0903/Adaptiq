export const sampleSkills = [
  // Frontend
  { name: 'JavaScript Core', slug: 'javascript-core', category: 'Frontend', description: 'Closures, prototypes, async event loop, ES6+', weight: 1.2 },
  { name: 'React Fundamentals', slug: 'react-fundamentals', category: 'Frontend', description: 'Components, hooks, virtual DOM, reconciliation', weight: 1.1 },
  { name: 'Frontend State Management', slug: 'state-management', category: 'Frontend', description: 'Redux, Zustand, Context API, state machines', weight: 1.0 },
  { name: 'Web Performance & CSS', slug: 'web-performance', category: 'Frontend', description: 'Critical rendering path, core web vitals, Tailwind', weight: 0.9 },

  // Backend
  { name: 'Node.js Runtime', slug: 'nodejs-runtime', category: 'Backend', description: 'Event loop, streams, buffers, cluster module', weight: 1.2 },
  { name: 'REST & GraphQL API Design', slug: 'api-design', category: 'Backend', description: 'HTTP verbs, status codes, OpenAPI, GraphQL schemas', weight: 1.1 },
  { name: 'MongoDB & Database Modeling', slug: 'mongodb-modeling', category: 'Database', description: 'Aggregation pipeline, indexing, sharding, Mongoose', weight: 1.1 },
  { name: 'PostgreSQL & Relational Data', slug: 'postgresql-data', category: 'Database', description: 'ACID transactions, joins, foreign keys, normalization', weight: 1.0 },

  // System Design
  { name: 'Distributed Systems & Caching', slug: 'distributed-caching', category: 'System Design', description: 'Redis, Memcached, cache-aside, write-through, CAP theorem', weight: 1.3 },
  { name: 'Microservices & Message Queues', slug: 'message-queues', category: 'System Design', description: 'Kafka, RabbitMQ, event sourcing, circuit breakers', weight: 1.2 },

  // DevOps & Cloud
  { name: 'Docker & Containerization', slug: 'docker-containers', category: 'DevOps', description: 'Multi-stage builds, networking, volumes, compose', weight: 1.1 },
  { name: 'Kubernetes Orchestration', slug: 'kubernetes', category: 'DevOps', description: 'Pods, services, deployments, ingress, Helm charts', weight: 1.2 },
  { name: 'CI/CD Automation', slug: 'cicd-automation', category: 'DevOps', description: 'GitHub Actions, automated testing, continuous deployment', weight: 1.0 },

  // AI & Data
  { name: 'Machine Learning Foundations', slug: 'ml-foundations', category: 'Data & AI', description: 'Supervised learning, regularization, loss functions', weight: 1.2 },
  { name: 'Embeddings & Vector Search', slug: 'embeddings-vector-search', category: 'Data & AI', description: 'Cosine similarity, vector DBs, RAG architectures', weight: 1.2 }
];

export default sampleSkills;
