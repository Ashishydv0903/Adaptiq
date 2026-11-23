export const devopsQuestions = [
  {
    title: 'Docker Multi-Stage Build Optimization',
    prompt: 'Write an optimized multi-stage Dockerfile for a Node.js production application that minimizes final image size and excludes development dependencies and build tools.',
    track: 'devops',
    roundType: 'coding',
    difficultyLevel: 'medium',
    irtParams: { a: 1.5, b: 0.2, c: 0.0 },
    skillSlug: 'docker-containers',
    codeStub: {
      language: 'dockerfile',
      starterCode: '# Stage 1: Build\n# Stage 2: Production runtime',
      solutionTemplate: 'FROM node:20-alpine AS builder\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci\nCOPY . .\nRUN npm run build\n\nFROM node:20-alpine AS runner\nWORKDIR /app\nENV NODE_ENV=production\nCOPY package*.json ./\nRUN npm ci --only=production\nCOPY --from=builder /app/dist ./dist\nUSER node\nEXPOSE 5000\nCMD ["node", "dist/server.js"]'
    },
    testCases: [
      { input: 'Build image from multi-stage Dockerfile', expectedOutput: 'Alpine-based image < 150MB without devDependencies', isHidden: false }
    ],
    idealAnswer: 'Use a builder stage with full devDependencies to compile code. Use a clean node:alpine runner stage that installs only production dependencies, copies compiled dist from builder, runs as non-root user (node), and sets NODE_ENV=production.',
    keyConcepts: ['Multi-Stage Builds', 'Alpine Linux', 'Non-Root User', 'Layer Caching', 'Image Minimization'],
    rubricWeights: { technicalAccuracy: 0.4, conceptualDepth: 0.2, communication: 0.1, codeEfficiency: 0.15, problemSolving: 0.15 }
  },
  {
    title: 'Kubernetes RollingUpdate vs Recreate Deployment',
    prompt: 'What happens during a Kubernetes Deployment RollingUpdate with maxSurge: 25% and maxUnavailable: 25%?',
    track: 'devops',
    roundType: 'mcq',
    difficultyLevel: 'medium',
    irtParams: { a: 1.4, b: 0.1, c: 0.25 },
    skillSlug: 'kubernetes',
    options: [
      { text: 'Kubernetes ensures at least 75% of desired pods remain available while creating up to 125% total pods during gradual replacement', isCorrect: true, explanation: 'maxSurge controls excess pods created, maxUnavailable controls maximum pods taken down during rollout.' },
      { text: 'All existing pods are terminated immediately before new pods start', isCorrect: false, explanation: 'That is the Recreate strategy, which causes downtime.' },
      { text: 'Traffic is split 50/50 between v1 and v2 for 24 hours', isCorrect: false, explanation: 'Canary deployments require ingress controller weights, not default RollingUpdate.' },
      { text: 'Only 1 pod is updated per day', isCorrect: false, explanation: 'Rollouts complete in minutes based on readiness probes.' }
    ],
    idealAnswer: 'RollingUpdate gradually replaces older pods with new pods. maxSurge specifies the maximum number of pods that can be created above desired count. maxUnavailable specifies the maximum pods unavailable during the update.',
    keyConcepts: ['RollingUpdate', 'maxSurge', 'maxUnavailable', 'Zero Downtime', 'Readiness Probes'],
    rubricWeights: { technicalAccuracy: 0.45, conceptualDepth: 0.35, communication: 0.2, codeEfficiency: 0.0, problemSolving: 0.0 }
  },
  {
    title: 'Kubernetes Pod CrashLoopBackOff Troubleshooting Workflow',
    prompt: 'Detail your diagnostic workflow using kubectl when an application pod is stuck in CrashLoopBackOff.',
    track: 'devops',
    roundType: 'technical',
    difficultyLevel: 'medium',
    irtParams: { a: 1.6, b: 0.3, c: 0.0 },
    skillSlug: 'kubernetes',
    idealAnswer: '1) kubectl describe pod <name>: Inspect Exit Code, Last State termination reason (e.g. OOMKilled code 137, Command not found code 127), and liveness probe failures. 2) kubectl logs <name> --previous: View output from the crashed container before restart. 3) Check resource limits (CPU/Memory). 4) Check environment variables and ConfigMap/Secret mounts. 5) Run ephemeral debug container or override entrypoint to inspect filesystem.',
    keyConcepts: ['kubectl describe', 'kubectl logs --previous', 'Exit Codes', 'OOMKilled (137)', 'Liveness Probes'],
    rubricWeights: { technicalAccuracy: 0.4, conceptualDepth: 0.3, communication: 0.2, codeEfficiency: 0.0, problemSolving: 0.1 }
  }
];

const additionalDevopsTopics = [
  { title: 'Kubernetes Ingress Controllers: NGINX vs Traefik vs Envoy', prompt: 'Compare path-based routing, TLS termination, and WebSocket support between NGINX and Envoy ingress.', b: 0.8, a: 1.5, slug: 'kubernetes' },
  { title: 'Infrastructure as Code (IaC): Terraform State Management', prompt: 'Why is remote state locking with S3 and DynamoDB critical in team Terraform environments?', b: 0.5, a: 1.4, slug: 'cicd-automation' },
  { title: 'GitOps Workflow with ArgoCD / Flux', prompt: 'How does pull-based GitOps deployment with ArgoCD reconcile cluster drift compared to push-based CI/CD?', b: 1.1, a: 1.7, slug: 'cicd-automation' },
  { title: 'Prometheus Pull vs Push Metric Scraping', prompt: 'Why does Prometheus use HTTP pull scraping, and when is the Pushgateway required for ephemeral batch jobs?', b: 0.7, a: 1.5, slug: 'kubernetes' },
  { title: 'Blue-Green vs Canary Deployment Routing', prompt: 'Compare traffic shift risks, database rollback complexities, and infrastructure costs between Blue-Green and Canary rollouts.', b: 0.9, a: 1.6, slug: 'kubernetes' },
  { title: 'Docker Layer Caching & BuildKit Cache Mounts', prompt: 'How do RUN --mount=type=cache,target=/root/.npm speed up repeated CI container builds?', b: 0.4, a: 1.3, slug: 'docker-containers' },
  { title: 'Kubernetes Horizontal Pod Autoscaler (HPA) Algorithms', prompt: 'How does HPA calculate target replica count based on custom metrics like queue depth or requests per second?', b: 1.2, a: 1.7, slug: 'kubernetes' },
  { title: 'Secrets Management: HashiCorp Vault vs Kubernetes Secrets', prompt: 'Why are base64-encoded Kubernetes secrets insufficient for enterprise security and how does Vault inject ephemeral secrets?', b: 0.6, a: 1.5, slug: 'kubernetes' },
  { title: 'Linux Cgroups and Namespaces in Container Isolation', prompt: 'Explain how PID, Mount, Network namespaces and cgroups v2 enforce process and memory limits in container runtimes.', b: 1.6, a: 2.0, slug: 'docker-containers' },
  { title: 'CI/CD Pipeline Security & Software Supply Chain (SLSA)', prompt: 'How do container signing (Cosign), SBOM generation (Syft), and vulnerability scanning (Trivy) secure CI/CD pipelines?', b: 1.0, a: 1.6, slug: 'cicd-automation' },
  { title: 'Kubernetes Persistent Volumes (PV) and CSI Storage Classes', prompt: 'Explain the dynamic provisioning lifecycle between PersistentVolumeClaims (PVC), StorageClasses, and CSI drivers.', b: 0.8, a: 1.5, slug: 'kubernetes' },
  { title: 'Service Mesh Architecture: Istio and Linkerd', prompt: 'What are the benefits and performance latency costs of sidecar Envoy proxies for mutual TLS (mTLS) and traffic splitting?', b: 1.5, a: 1.9, slug: 'kubernetes' },
  { title: 'Log Aggregation: Fluentbit, Elasticsearch, and Grafana Loki', prompt: 'Compare full-text indexed logs (Elasticsearch) with label-indexed chunk storage (Grafana Loki) for cloud cost efficiency.', b: 0.7, a: 1.5, slug: 'kubernetes' },
  { title: 'Zero Trust Network Architecture in Cloud Deployments', prompt: 'How do network security groups, identity-based microsegmentation, and egress firewalls implement Zero Trust?', b: 1.2, a: 1.7, slug: 'cicd-automation' },
  { title: 'Disaster Recovery: RTO vs RPO Metrics', prompt: 'Define Recovery Time Objective (RTO) and Recovery Point Objective (RPO) and detail backup replication topologies to satisfy them.', b: 0.3, a: 1.3, slug: 'cicd-automation' },
  { title: 'Kubernetes RBAC: Roles, ClusterRoles, and ServiceAccounts', prompt: 'How do you formulate least-privilege RBAC policies binding pods and developers to namespace-scoped resources?', b: 0.5, a: 1.4, slug: 'kubernetes' },
  { title: 'Nginx Reverse Proxy Configuration and KeepAlive Tuning', prompt: 'Write an upstream proxy_pass configuration optimizing keepalive connections and proxy buffering for backend Node services.', b: 0.2, a: 1.3, slug: 'docker-containers' },
  { title: 'Chaos Engineering: Chaos Mesh and Gremlin', prompt: 'How do you design controlled chaos experiments simulating packet loss and pod crashes to validate high-availability SLOs?', b: 1.3, a: 1.7, slug: 'kubernetes' },
  { title: 'Docker Compose vs Kubernetes for Local Development', prompt: 'When is docker-compose suitable and what lightweight k8s alternatives (k3s, Minikube, Kind) bridge the dev-to-prod gap?', b: -0.3, a: 1.2, slug: 'docker-containers' },
  { title: 'AWS IAM Roles for Service Accounts (IRSA)', prompt: 'How does OIDC federation allow Kubernetes pods in EKS to assume IAM roles without hardcoded AWS access keys?', b: 1.1, a: 1.6, slug: 'kubernetes' },
  { title: 'Managing High Connection Volatility with TCP TIME_WAIT', prompt: 'How do you tune sysctl settings (net.ipv4.tcp_tw_reuse) to prevent socket port exhaustion under heavy microservice traffic?', b: 1.5, a: 1.9, slug: 'docker-containers' },
  { title: 'Helm Charts Templating and Value Overrides', prompt: 'How do Helm templates, helper partials (_helpers.tpl), and environment values.yaml files manage multi-cluster deployments?', b: 0.4, a: 1.3, slug: 'kubernetes' },
  { title: 'Database Backup Automation & Point-in-Time Recovery (PITR)', prompt: 'Explain Write-Ahead Log (WAL) archiving and base backup restoration for point-in-time recovery in PostgreSQL.', b: 1.0, a: 1.6, slug: 'cicd-automation' },
  { title: 'Container Image Security: Distroless vs Alpine Images', prompt: 'Why do Google Distroless images reduce attack surface by eliminating package managers and shell binaries?', b: 0.6, a: 1.4, slug: 'docker-containers' },
  { title: 'FinOps: Cloud Cost Optimization for Compute & Storage', prompt: 'How do spot instances, auto-scaling cooldowns, and S3 lifecycle tiering reduce cloud infrastructure spend by 40%+?', b: 0.1, a: 1.3, slug: 'cicd-automation' },
  { title: 'GitHub Actions Matrix Builds and Reusable Workflows', prompt: 'How do you configure workflow matrices to test multiple Node.js versions concurrently with shared composite actions?', b: 0.0, a: 1.2, slug: 'cicd-automation' },
  { title: 'Kubernetes NetworkPolicies for Pod-to-Pod Traffic Control', prompt: 'Write a NetworkPolicy manifest restricting ingress to a database pod exclusively from an API gateway pod on port 5432.', b: 0.9, a: 1.6, slug: 'kubernetes' },
  { title: 'Site Reliability Engineering: SLI, SLO, and SLA Error Budgets', prompt: 'How does error budget burn rate trigger engineering freeze vs feature shipping decisions in modern SRE teams?', b: 0.8, a: 1.5, slug: 'cicd-automation' },
  { title: 'Container Registry Garbage Collection and Image Pruning', prompt: 'How do OCI registries clean unreferenced layer blobs without causing race conditions during active push operations?', b: 1.2, a: 1.6, slug: 'docker-containers' }
];

for (const extra of additionalDevopsTopics) {
  devopsQuestions.push({
    title: extra.title,
    prompt: extra.prompt,
    track: 'devops',
    roundType: 'technical',
    difficultyLevel: extra.b >= 1.5 ? 'expert' : extra.b >= 0.5 ? 'hard' : extra.b >= -0.3 ? 'medium' : 'easy',
    irtParams: { a: extra.a, b: extra.b, c: 0.0 },
    skillSlug: extra.slug,
    idealAnswer: `Comprehensive DevOps solution for ${extra.title}: Covers infrastructure reliability, container security, zero-downtime automation, and observability best practices.`,
    keyConcepts: [extra.title.split(' ')[0], 'DevOps', 'Cloud', 'Infrastructure'],
    rubricWeights: { technicalAccuracy: 0.4, conceptualDepth: 0.3, communication: 0.15, codeEfficiency: 0.05, problemSolving: 0.1 }
  });
}

export default devopsQuestions;
