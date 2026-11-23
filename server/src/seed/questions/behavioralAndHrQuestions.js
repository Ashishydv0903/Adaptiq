/**
 * Behavioral (STAR) and HR Alignment questions across all 5 career tracks
 */

export const behavioralAndHrQuestions = [
  // Full-Stack Track
  {
    title: 'Production Outage Under High Traffic (STAR)',
    prompt:
      'Describe a time when a critical bug or performance regression hit production during high traffic. What was your specific role, what actions did you take to triage and mitigate it, and what was the outcome?',
    track: 'fullstack',
    roundType: 'behavioral',
    difficultyLevel: 'hard',
    irtParams: { a: 1.6, b: 0.8, c: 0.0 },
    skillSlug: 'api-design',
    idealAnswer:
      'Situation: Database connection exhaustion caused 500 errors during Black Friday traffic spike. Task: As lead engineer, I owned immediate service restoration and root-cause analysis. Action: 1) Implemented connection pooling with pgbouncer. 2) Enabled circuit breakers in Express to shed non-critical telemetry writes. 3) Scaled read-replicas. Result: Restored 99.99% availability within 12 minutes, zero data loss, and added automated synthetic latency monitors.',
    keyConcepts: ['Incident Triage', 'Circuit Breakers', 'Root Cause Analysis', 'Post-Mortem Improvements'],
    rubricWeights: { technicalAccuracy: 0.25, conceptualDepth: 0.25, communication: 0.25, codeEfficiency: 0.1, problemSolving: 0.15 }
  },
  {
    title: 'Engineering Culture & Cross-Functional Alignment (HR)',
    prompt:
      'How do you manage disagreements with Product Managers or Designers regarding technical debt versus shipping new features under tight deadlines?',
    track: 'fullstack',
    roundType: 'hr',
    difficultyLevel: 'medium',
    irtParams: { a: 1.2, b: -0.2, c: 0.0 },
    skillSlug: 'api-design',
    idealAnswer:
      'I translate technical debt into measurable business risk (e.g. latency impact on conversion, outage risk). I advocate for allocating a consistent 20% sprint capacity for stability and tech debt, creating shared engineering-product roadmaps rather than antagonistic trade-offs.',
    keyConcepts: ['Technical Debt Translation', 'Stakeholder Negotiation', 'Sprint Allocation', 'Business Empathy'],
    rubricWeights: { technicalAccuracy: 0.15, conceptualDepth: 0.2, communication: 0.35, codeEfficiency: 0.0, problemSolving: 0.3 }
  },

  // Frontend Track
  {
    title: 'Migrating Legacy Codebase to Modern React (STAR)',
    prompt:
      'Tell me about a time when you led or contributed to a major frontend architecture migration (e.g. legacy class components/jQuery to modern React). How did you prevent regressions and maintain developer velocity?',
    track: 'frontend',
    roundType: 'behavioral',
    difficultyLevel: 'medium',
    irtParams: { a: 1.4, b: 0.3, c: 0.0 },
    skillSlug: 'react-fundamentals',
    idealAnswer:
      'Situation: Legacy SPA had 6s bundle load times and severe prop drilling. Task: Lead migration to React 18 with minimal disruption to ongoing feature work. Action: Built a strangler-fig migration path with Microfrontends, introduced automated visual regression testing with Playwright, and trained 8 engineers. Result: Cut load times by 65%, eliminated DOM memory leaks, and improved team sprint velocity by 25%.',
    keyConcepts: ['Strangler Fig Migration', 'Visual Regression', 'Developer Velocity', 'Mentorship'],
    rubricWeights: { technicalAccuracy: 0.3, conceptualDepth: 0.2, communication: 0.25, codeEfficiency: 0.1, problemSolving: 0.15 }
  },
  {
    title: 'Frontend Accessibility & Inclusive Design (HR)',
    prompt:
      'What is your philosophy on Web Accessibility (a11y) and how do you ensure inclusive engineering is prioritized in fast-paced product cycles?',
    track: 'frontend',
    roundType: 'hr',
    difficultyLevel: 'medium',
    irtParams: { a: 1.1, b: -0.1, c: 0.0 },
    skillSlug: 'react-fundamentals',
    idealAnswer:
      'Accessibility is an engineering baseline, not a post-launch audit. I integrate axe-core and eslint-plugin-jsx-a11y into CI pipelines, enforce semantic HTML standards, and test keyboard navigation alongside screen readers to ensure WCAG 2.1 AA compliance from day one.',
    keyConcepts: ['WCAG 2.1 Compliance', 'CI Accessibility Gates', 'Semantic HTML', 'Inclusive Engineering'],
    rubricWeights: { technicalAccuracy: 0.2, conceptualDepth: 0.2, communication: 0.3, codeEfficiency: 0.1, problemSolving: 0.2 }
  },

  // Backend Track
  {
    title: 'Resolving Distributed Race Condition (STAR)',
    prompt:
      'Walk me through a complex data consistency or race condition bug you encountered in a distributed system. How did you reproduce, diagnose, and permanently solve it?',
    track: 'backend',
    roundType: 'behavioral',
    difficultyLevel: 'hard',
    irtParams: { a: 1.7, b: 1.0, c: 0.0 },
    skillSlug: 'api-design',
    idealAnswer:
      'Situation: Inventory service showed double-allocation under concurrent checkout spikes. Task: Identify race window and implement zero-downtime fix. Action: Replicated issue using distributed load generator k6, added Redis Redlock distributed mutex with strict TTLs, and migrated Mongo updates to atomic findOneAndUpdate with optimistic concurrency versions. Result: 100% elimination of inventory overselling across 2M daily checkouts.',
    keyConcepts: ['Distributed Mutex', 'Optimistic Concurrency', 'Reproduction via Load Testing', 'Data Consistency'],
    rubricWeights: { technicalAccuracy: 0.35, conceptualDepth: 0.25, communication: 0.2, codeEfficiency: 0.1, problemSolving: 0.1 }
  },
  {
    title: 'Backend Mentorship & Code Review Standards (HR)',
    prompt:
      'How do you approach code reviews when an engineer submits code that works but violates team architectural patterns or performance guidelines?',
    track: 'backend',
    roundType: 'hr',
    difficultyLevel: 'medium',
    irtParams: { a: 1.3, b: 0.0, c: 0.0 },
    skillSlug: 'api-design',
    idealAnswer:
      'I frame feedback around principles and operational metrics rather than subjective preferences. I praise positive elements first, explain the architectural reason (e.g. N+1 queries, unindexed scans), provide code snippets or pairing sessions, and document agreed patterns in the engineering handbook.',
    keyConcepts: ['Empathetic Code Reviews', 'Architectural Guidance', 'Pairing Sessions', 'Engineering Culture'],
    rubricWeights: { technicalAccuracy: 0.2, conceptualDepth: 0.2, communication: 0.35, codeEfficiency: 0.0, problemSolving: 0.25 }
  },

  // DevOps Track
  {
    title: 'Major Cloud Outage & Recovery (STAR)',
    prompt:
      'Describe a situation where a cloud infrastructure failure or pipeline outage halted deployments. What was your triage plan, how did you coordinate communication, and what preventative measures were adopted?',
    track: 'devops',
    roundType: 'behavioral',
    difficultyLevel: 'hard',
    irtParams: { a: 1.5, b: 0.7, c: 0.0 },
    skillSlug: 'api-design',
    idealAnswer:
      'Situation: A corrupted Terraform state file locked down multi-region Kubernetes deployments during a critical release. Task: Regain state integrity without deleting live production resources. Action: Established an incident response bridge, imported live AWS resource IDs into a recovered backup state file, and deployed immutable GitOps state locking in S3 with DynamoDB. Result: Restored deployment pipeline in 40 minutes and instituted branch-protection automated terraform plan checks.',
    keyConcepts: ['Incident Command', 'State Locking', 'Infrastructure as Code', 'Preventative Governance'],
    rubricWeights: { technicalAccuracy: 0.3, conceptualDepth: 0.25, communication: 0.25, codeEfficiency: 0.0, problemSolving: 0.2 }
  },
  {
    title: 'SRE Blameless Post-Mortem Culture (HR)',
    prompt:
      'How do you foster a blameless post-mortem culture after an engineer accidentally causes a severe production outage?',
    track: 'devops',
    roundType: 'hr',
    difficultyLevel: 'medium',
    irtParams: { a: 1.2, b: -0.2, c: 0.0 },
    skillSlug: 'api-design',
    idealAnswer:
      'Human error is a symptom of systemic failure, not the root cause. I lead post-mortems focused on guardrails: why did the system allow a single command to cause damage? We identify missing canary verification, IAM permission boundaries, and automated rollback triggers to protect all engineers.',
    keyConcepts: ['Blameless Culture', 'Systemic Guardrails', 'Automated Rollback', 'Psychological Safety'],
    rubricWeights: { technicalAccuracy: 0.2, conceptualDepth: 0.2, communication: 0.35, codeEfficiency: 0.0, problemSolving: 0.25 }
  },

  // Data Science Track
  {
    title: 'Model Degradation & Feature Drift Triage (STAR)',
    prompt:
      'Describe a time when a machine learning model deployed to production began degrading in accuracy or experiencing data drift. How did you identify, diagnose, and remediate the issue?',
    track: 'datascience',
    roundType: 'behavioral',
    difficultyLevel: 'hard',
    irtParams: { a: 1.6, b: 0.9, c: 0.0 },
    skillSlug: 'api-design',
    idealAnswer:
      'Situation: A recommendation model saw a 15% drop in click-through rate post-holiday season. Task: Pinpoint feature distribution shifts and retrain. Action: Analyzed Kolmogorov-Smirnov statistics across input features, identified covariate shift in seasonal user purchasing categories, and established automated retrain pipelines with Evidently AI and MLflow. Result: Restored model accuracy to 94% and established automated alert thresholds for drift.',
    keyConcepts: ['Covariate Drift', 'KS Test', 'Continuous Training', 'MLflow Monitoring'],
    rubricWeights: { technicalAccuracy: 0.35, conceptualDepth: 0.25, communication: 0.2, codeEfficiency: 0.1, problemSolving: 0.1 }
  },
  {
    title: 'AI Ethics & Algorithmic Bias (HR)',
    prompt:
      'How do you handle situations where a machine learning model exhibits disparate impact or demographic bias against a protected user subgroup?',
    track: 'datascience',
    roundType: 'hr',
    difficultyLevel: 'medium',
    irtParams: { a: 1.3, b: 0.0, c: 0.0 },
    skillSlug: 'api-design',
    idealAnswer:
      'I consider fairness an essential acceptance criterion prior to deployment. I calculate disparate impact ratios according to the EEOC 80% rule, equalize false positive/negative rates across groups, and balance training datasets using re-weighting or adversarial debiasing. I advocate transparent model cards for stakeholders.',
    keyConcepts: ['EEOC 80% Rule', 'Equalized Odds', 'Model Cards', 'Ethical AI Governance'],
    rubricWeights: { technicalAccuracy: 0.25, conceptualDepth: 0.25, communication: 0.3, codeEfficiency: 0.0, problemSolving: 0.2 }
  }
];

export default behavioralAndHrQuestions;
