export const sampleQuestions = [
  // 1. Frontend - MCQ
  {
    title: 'JavaScript Event Loop Microtask Execution Order',
    prompt: 'Given setTimeout(() => console.log("A"), 0) and Promise.resolve().then(() => console.log("B")), what is logged first and why?',
    track: 'frontend',
    roundType: 'mcq',
    difficultyLevel: 'medium',
    irtParams: { a: 1.4, b: 0.1, c: 0.25 },
    skillSlug: 'javascript-core',
    options: [
      { text: '"B" is logged before "A" because microtasks run before the next macrotask', isCorrect: true, explanation: 'Promise handlers queue microtasks which drain completely at the end of current tick before setTimeout macrotasks.' },
      { text: '"A" is logged before "B" because setTimeout was registered earlier in script order', isCorrect: false, explanation: 'Microtask queue takes priority over timer macrotask queue.' },
      { text: 'Execution order is indeterminate across browsers', isCorrect: false, explanation: 'The HTML5 event loop specification defines strict priority.' },
      { text: 'Both log simultaneously via multi-threading', isCorrect: false, explanation: 'JavaScript is single-threaded.' }
    ],
    idealAnswer: 'Promise callbacks are microtasks, whereas setTimeout callbacks are macrotasks. The JavaScript event loop always exhausts the entire microtask queue before fetching the next macrotask from the timer queue.',
    rubricWeights: { technicalAccuracy: 0.4, conceptualDepth: 0.3, communication: 0.3, codeEfficiency: 0.0, problemSolving: 0.0 }
  },

  // 2. Frontend - Coding
  {
    title: 'Implement Custom Debounce Function',
    prompt: 'Implement a debounce function in JavaScript that delays invoking func until after wait milliseconds have elapsed since the last time the debounced function was invoked.',
    track: 'frontend',
    roundType: 'coding',
    difficultyLevel: 'medium',
    irtParams: { a: 1.6, b: 0.4, c: 0.0 },
    skillSlug: 'javascript-core',
    codeStub: {
      language: 'javascript',
      starterCode: 'function debounce(fn, delay) {\n  // Your implementation here\n}\n\nmodule.exports = debounce;',
      solutionTemplate: 'function debounce(fn, delay) {\n  let timerId;\n  return function(...args) {\n    clearTimeout(timerId);\n    timerId = setTimeout(() => fn.apply(this, args), delay);\n  };\n}'
    },
    testCases: [
      { input: 'debounce(fn, 100) called 3 times in 50ms', expectedOutput: 'fn called once after 100ms from last call', isHidden: false }
    ],
    idealAnswer: 'Store timerId in closure. On each invocation, call clearTimeout(timerId) and reassign timerId to setTimeout passing arguments using rest parameters and arrow function or apply to maintain this binding.',
    rubricWeights: { technicalAccuracy: 0.35, conceptualDepth: 0.15, communication: 0.10, codeEfficiency: 0.20, problemSolving: 0.20 }
  },

  // 3. Backend - Technical
  {
    title: 'MongoDB Compound Index Prefixing and Query Optimization',
    prompt: 'You have a collection with 20 million orders and a compound index on { status: 1, createdAt: -1, customerId: 1 }. Will a query filtering only on { customerId: "123" } use this index? Explain the index prefix rule.',
    track: 'backend',
    roundType: 'technical',
    difficultyLevel: 'hard',
    irtParams: { a: 1.8, b: 0.9, c: 0.0 },
    skillSlug: 'mongodb-modeling',
    idealAnswer: 'No, MongoDB cannot utilize this compound index for a query filtering only on customerId because customerId is not a prefix of the compound index. A compound index can only support queries on index prefixes starting from the first field (e.g., status, or status + createdAt). To optimize customerId lookups, an index starting with customerId is required.',
    rubricWeights: { technicalAccuracy: 0.40, conceptualDepth: 0.30, communication: 0.15, codeEfficiency: 0.15, problemSolving: 0.0 }
  },

  // 4. Fullstack - System Design
  {
    title: 'Design Idempotent Payment API Architecture',
    prompt: 'How would you architect an idempotent payment processing endpoint in Express.js and MongoDB to guarantee that network timeouts and retries never double-charge a user?',
    track: 'fullstack',
    roundType: 'system_design',
    difficultyLevel: 'hard',
    irtParams: { a: 1.7, b: 1.1, c: 0.0 },
    skillSlug: 'distributed-caching',
    idealAnswer: 'Require client to provide an Idempotency-Key header (UUIDv4). In Express middleware: 1) Query Redis or MongoDB with a unique index on idempotencyKey. 2) If found with status SUCCESS, return cached response immediately. 3) If found with status PROCESSING, return 409 Conflict. 4) If not found, insert record with status PROCESSING and short TTL lock. 5) Execute payment gateway call with distributed transaction / atomic commit. 6) Update idempotency record to SUCCESS with gateway transaction ID and response payload.',
    rubricWeights: { technicalAccuracy: 0.35, conceptualDepth: 0.25, communication: 0.15, codeEfficiency: 0.10, problemSolving: 0.15 }
  },

  // 5. DevOps - Technical
  {
    title: 'Kubernetes Pod CrashLoopBackOff Troubleshooting',
    prompt: 'A microservice deployment in Kubernetes is stuck in CrashLoopBackOff. Detail your step-by-step diagnostic workflow using kubectl to identify the root cause.',
    track: 'devops',
    roundType: 'technical',
    difficultyLevel: 'medium',
    irtParams: { a: 1.3, b: 0.2, c: 0.0 },
    skillSlug: 'kubernetes',
    idealAnswer: '1) Run kubectl get pods -n <ns> to check pod status and restart count. 2) Run kubectl describe pod <pod-name> to inspect Exit Code, termination reason (e.g. OOMKilled code 137), and liveness/readiness probe failures. 3) Run kubectl logs <pod-name> --previous to examine stdout/stderr logs from the crashed container instance before restart. 4) If config error, verify ConfigMap and Secrets mounts. 5) If resource related, inspect memory limits vs usage.',
    rubricWeights: { technicalAccuracy: 0.35, conceptualDepth: 0.25, communication: 0.20, codeEfficiency: 0.10, problemSolving: 0.10 }
  },

  // 6. AI / Data Science - Technical
  {
    title: 'Cosine Similarity vs Euclidean Distance for Text Embeddings',
    prompt: 'Why is Cosine Similarity preferred over Euclidean Distance when computing semantic similarity between text embeddings generated by language models?',
    track: 'datascience',
    roundType: 'technical',
    difficultyLevel: 'medium',
    irtParams: { a: 1.5, b: 0.3, c: 0.0 },
    skillSlug: 'embeddings-vector-search',
    idealAnswer: 'Cosine similarity measures the cosine of the angle between two vectors, making it invariant to vector magnitude (length). In text embeddings, longer texts or word frequency variations can increase vector magnitude without changing semantic topic. Cosine similarity isolates directional orientation in high-dimensional latent space. Note that when vectors are L2-normalized, Euclidean distance and Cosine similarity are monotonically related.',
    rubricWeights: { technicalAccuracy: 0.40, conceptualDepth: 0.30, communication: 0.20, codeEfficiency: 0.05, problemSolving: 0.05 }
  }
];

export default sampleQuestions;
