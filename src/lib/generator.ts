import type {
  Archetype,
  Entry,
  ModuleData,
  Profile,
  Row,
  RowKind,
} from "./types";
import { MODULE_ORDER } from "./types";

/* ------------------------------------------------------------------ */
/*  deterministic randomness                                           */
/* ------------------------------------------------------------------ */

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function parseSlug(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const m = raw.match(/linkedin\.com\/in\/([A-Za-z0-9\-_%]+)\/?/i);
  if (m) return m[1].toLowerCase();
  if (/^[A-Za-z0-9\-_%]{3,100}$/.test(raw)) return raw.toLowerCase();
  return null;
}

/* ------------------------------------------------------------------ */
/*  content pools                                                      */
/* ------------------------------------------------------------------ */

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const NAMES = [
  "Priya Sharma","Marcus Chen","Sofia Reyes","Arjun Mehta","Hannah Okafor",
  "Daniel Kim","Ananya Iyer","Tomás Silva","Zara Ahmed","Viktor Novak",
  "Meera Krishnan","Aisha Khan","Lucas Meyer","Nia Thompson","Rohan Gupta","Elena Petrova",
];

const LOCATIONS = [
  { city: "Bengaluru", country: "India", full: "Bengaluru, Karnataka, India" },
  { city: "Mumbai", country: "India", full: "Mumbai, Maharashtra, India" },
  { city: "Austin", country: "United States", full: "Austin, Texas, United States" },
  { city: "Seattle", country: "United States", full: "Seattle, Washington, United States" },
  { city: "Berlin", country: "Germany", full: "Berlin, Germany" },
  { city: "Singapore", country: "Singapore", full: "Singapore, Singapore" },
  { city: "London", country: "United Kingdom", full: "London, England, United Kingdom" },
  { city: "Toronto", country: "Canada", full: "Toronto, Ontario, Canada" },
  { city: "Hyderabad", country: "India", full: "Hyderabad, Telangana, India" },
];

const SCHOOLS = [
  "Indian Institute of Technology, Delhi","BITS Pilani","Georgia Institute of Technology",
  "National University of Singapore","TU Munich","UC San Diego",
  "IIT Bombay","Purdue University","University of Toronto","VIT Vellore",
];

type Arch = {
  industry: string;
  headlines: string[];
  ladder: string[];
  early: string[];
  mid: string[];
  top: string[];
  degrees: string[];
  fields: string[];
  skills: Record<string, string[]>;
  certs: { name: string; org: string; skills: string[] }[];
  projects: {
    name: string; desc: string; problem: string; features: string[];
    impact: string; tech: string[]; repo: string; live?: string;
  }[];
  orgs: string[];
  communities: string[];
  topics: string[];
  posts: string[];
  about: string[];
};

const ARCHETYPES: Record<Archetype, Arch> = {
  ml: {
    industry: "Artificial Intelligence · ML Platforms",
    headlines: [
      "Senior ML Engineer @ {co} · LLM systems & retrieval · ex-{prev}",
      "Machine Learning Engineer @ {co} · RAG pipelines · MLOps · {n}+ yrs",
      "Applied Scientist @ {co} · NLP, embeddings & search quality",
    ],
    ladder: ["Machine Learning Intern","Machine Learning Engineer","Senior ML Engineer","Staff ML Engineer"],
    early: ["Cerebra Labs","Nyx Analytics","Kvantum AI"],
    mid: ["Fractal","Zeta AI","Haptik"],
    top: ["Google DeepMind","Amazon Science","Microsoft Research","Anthropic"],
    degrees: ["B.Tech","M.S."],
    fields: ["Computer Science","Machine Learning","Data Science"],
    skills: {
      "Programming Languages": ["Python","SQL","C++","Scala","Bash"],
      "Frameworks": ["PyTorch","TensorFlow","scikit-learn","XGBoost","LangChain","FastAPI"],
      "Libraries": ["NumPy","Pandas","Hugging Face","OpenCV","Ray","Sentence-Transformers"],
      "Databases": ["PostgreSQL","Qdrant","Pinecone","Redis","Snowflake"],
      "Cloud Technologies": ["AWS SageMaker","GCP Vertex AI","Azure OpenAI","Lambda","S3"],
      "DevOps Tools": ["Docker","Kubernetes","Airflow","MLflow","DVC","GitHub Actions"],
      "AI / ML Skills": ["RAG Pipelines","LLM Fine-tuning","Embeddings & Vector Search","MLOps","Prompt Evaluation","NLP","Recommendation Systems","Time-series Forecasting"],
      "Cybersecurity Skills": ["PII Masking","Model Hardening","Data Privacy (DP)"],
      "Soft Skills": ["Storytelling with Data","Mentoring","Cross-team Collaboration","Experiment Design"],
    },
    certs: [
      { name: "AWS Certified Machine Learning — Specialty", org: "Amazon Web Services", skills: ["SageMaker","MLOps","Model Deployment"] },
      { name: "Deep Learning Specialization", org: "DeepLearning.AI", skills: ["CNNs","Sequence Models","Optimization"] },
      { name: "TensorFlow Developer Certificate", org: "Google", skills: ["TF2","Model Training","Pipelines"] },
      { name: "Databricks Certified ML Practitioner", org: "Databricks", skills: ["Spark ML","Feature Store"] },
    ],
    projects: [
      {
        name: "raglan", desc: "Open-source RAG toolkit with hybrid retrieval, citation traces and a RAGAS-based eval harness.",
        problem: "Ground LLM answers on private documents with <2% hallucination on the internal eval set.",
        features: ["Hybrid BM25 + dense retrieval with re-ranking","Citation trace UI for every generated claim","Pluggable eval harness (RAGAS, custom judges)"],
        impact: "1.2k GitHub stars · adopted by 3 product teams in production",
        tech: ["Python","LangChain","Qdrant","FastAPI"], repo: "raglan", live: "raglan.dev",
      },
      {
        name: "timeseer", desc: "Probabilistic demand-forecasting service with conformal prediction intervals.",
        problem: "Replace brittle ARIMA pipeline; give planners calibrated uncertainty, not point guesses.",
        features: ["Conformal prediction intervals","Auto feature calendarization","Backtest dashboard"],
        impact: "−18% MAPE vs legacy pipeline · 40ms p99 inference",
        tech: ["PyTorch","Ray","PostgreSQL","Grafana"], repo: "timeseer",
      },
      {
        name: "embedkit", desc: "Batch embedding micro-service with GPU autoscaling and cost-aware queueing.",
        problem: "Cut embedding spend while keeping ingestion under 6h for 120M docs.",
        features: ["Cost-aware spot GPU queueing","Dedup via locality-sensitive hashing","OpenAI-compatible API"],
        impact: "−62% embedding cost · 120M docs in 5.2h",
        tech: ["Python","Kubernetes","SageMaker","Redis"], repo: "embedkit", live: "embedkit.sh",
      },
    ],
    orgs: ["ML Collective","Kaggle Masters Circle","Women in ML (mentor)"],
    communities: ["Hugging Face community","r/MachineLearning","MLOps.community","PyData Bengaluru"],
    topics: ["Retrieval-augmented generation","Vector search at scale","LLM evaluation","MLOps cost control"],
    posts: [
      "Hybrid retrieval is not optional — why BM25 still beats dense on 30% of our prod queries",
      "We cut embedding spend 62% with spot-GPU queueing. Full architecture breakdown 🧵",
      "Evals before prompts: the RAGAS checklist we run on every release",
      "Conformal prediction intervals finally made our forecasts trustworthy to planners",
    ],
    about: [
      "I build retrieval and LLM systems that survive production. {n} years across search, forecasting and gen-AI — currently focused on grounding, evals and cost-aware MLOps.",
      "Applied scientist turned systems builder. I care about the unglamorous 80%: eval harnesses, data contracts and latency budgets. Previously shipped forecasting and NLP systems used by millions.",
    ],
  },
  fullstack: {
    industry: "SaaS · Product Engineering",
    headlines: [
      "Senior Software Engineer @ {co} · React, TypeScript & design systems · ex-{prev}",
      "Full-stack Engineer @ {co} · Next.js · payments · {n}+ yrs shipping product",
      "Software Engineer @ {co} · building developer tools & web platforms",
    ],
    ladder: ["Frontend Engineering Intern","Software Engineer","Senior Software Engineer","Staff Engineer"],
    early: ["PixelForge Studio","Brightstack","Loopwire"],
    mid: ["Razorpay","Swiggy","Postman"],
    top: ["Stripe","Vercel","Spotify","Atlassian"],
    degrees: ["B.E.","B.S."],
    fields: ["Information Technology","Computer Science","Software Engineering"],
    skills: {
      "Programming Languages": ["TypeScript","JavaScript","Go","Python","SQL"],
      "Frameworks": ["React","Next.js","Node.js","Express","Tailwind CSS","GraphQL"],
      "Libraries": ["React Query","Zustand","Prisma","Zod","Jest","Playwright"],
      "Databases": ["PostgreSQL","MongoDB","Redis","DynamoDB"],
      "Cloud Technologies": ["AWS","Vercel","Cloudflare Workers","S3","CloudFront"],
      "DevOps Tools": ["Docker","GitHub Actions","Terraform","Nginx","Sentry"],
      "AI / ML Skills": ["OpenAI API integration","Vector search UX","Prompt engineering"],
      "Cybersecurity Skills": ["OWASP Top 10","OAuth2 / OIDC","Rate limiting","CSP hardening"],
      "Soft Skills": ["Product thinking","Design-system advocacy","Code-review culture","Mentoring juniors"],
    },
    certs: [
      { name: "AWS Certified Developer — Associate", org: "Amazon Web Services", skills: ["Lambda","DynamoDB","CI/CD"] },
      { name: "Meta Front-End Developer Professional Certificate", org: "Coursera · Meta", skills: ["React","Testing","UX"] },
      { name: "MongoDB Certified Developer", org: "MongoDB University", skills: ["Aggregation","Indexing"] },
    ],
    projects: [
      {
        name: "shipmate", desc: "Open-source CI visibility dashboard that turns flaky-test noise into an actionable feed.",
        problem: "Engineers ignored CI emails; flaky tests cost ~11 eng-hours/week untracked.",
        features: ["Flake detection with quarantine queue","PR-level reliability score","Slack digest with owner routing"],
        impact: "Used by 90+ repos · flake resolution time −54%",
        tech: ["TypeScript","Next.js","PostgreSQL","GitHub Actions"], repo: "shipmate", live: "shipmate.ci",
      },
      {
        name: "formql", desc: "Headless form engine with a typed query language and conditional logic graph.",
        problem: "Marketing rebuilt the same multi-step forms in code every quarter.",
        features: ["Typed DSL compiled to validation graph","Branching logic without code","Zero-JS embed option"],
        impact: "280+ GitHub stars · powers forms for 40k monthly submissions",
        tech: ["TypeScript","Node.js","Prisma","Redis"], repo: "formql", live: "formql.dev",
      },
      {
        name: "pixelpipe", desc: "Edge image pipeline: on-the-fly resize, AVIF transcode and cache warming.",
        problem: "CDN image bill scaling linearly with traffic; LCP stuck at 3.4s.",
        features: ["AVIF/HEIC negotiation at the edge","Warm cache pre-generation","Per-route budgets"],
        impact: "LCP 3.4s → 1.6s · image spend −41%",
        tech: ["Go","Cloudflare Workers","S3","Terraform"], repo: "pixelpipe",
      },
    ],
    orgs: ["React India (volunteer)","Open Source Weekend","ADPList mentor"],
    communities: ["Reactiflux","Next.js Discord","Local JS meetup organizer","dev.to"],
    topics: ["Design systems that engineers actually use","Web performance budgets","Typed APIs end-to-end","Side-project economics"],
    posts: [
      "Our design system failed twice. The third time worked — here's what changed",
      "LCP 3.4s → 1.6s with an edge image pipeline (architecture inside)",
      "Zod schemas as the single source of truth: API, forms, and docs",
      "Flaky tests are a culture problem wearing a CI costume",
    ],
    about: [
      "Product engineer who sweats the last 10%: empty states, error copy, p95s. {n} years building web platforms, payments UX and design systems.",
      "I like shipping end-to-end: schema → API → pixels. Currently deep on performance budgets and typed-everything tooling.",
    ],
  },
  devops: {
    industry: "Cloud Infrastructure · Platform Engineering",
    headlines: [
      "Senior DevOps Engineer @ {co} · Kubernetes, ArgoCD & platform UX · CKA",
      "Platform Engineer @ {co} · SRE practices · cost & reliability · ex-{prev}",
      "SRE @ {co} · observability, GitOps and chaos on purpose",
    ],
    ladder: ["Junior Systems Engineer","DevOps Engineer","Senior DevOps Engineer","Platform Engineering Lead"],
    early: ["Nimbus Host","OpsDeck","CloudNine"],
    mid: ["Zeta","Flipkart","Freshworks"],
    top: ["AWS","Cloudflare","Datadog","HashiCorp"],
    degrees: ["B.Tech","M.S."],
    fields: ["Electronics & Communication","Cloud Computing","Computer Science"],
    skills: {
      "Programming Languages": ["Bash","Python","Go","HCL","YAML"],
      "Frameworks": ["Terraform","Ansible","Helm","Crossplane","Pulumi"],
      "Libraries": ["Prometheus client","OpenTelemetry SDK","Helm charts","Terratest"],
      "Databases": ["PostgreSQL","InfluxDB","etcd","ClickHouse"],
      "Cloud Technologies": ["AWS (EKS, RDS, IAM)","GCP","Azure","Cloudflare","VPC design"],
      "DevOps Tools": ["Kubernetes","ArgoCD","Istio","Vault","Grafana","Jenkins","GitHub Actions","Kafka"],
      "AI / ML Skills": ["AIOps anomaly detection","Forecast-based autoscaling"],
      "Cybersecurity Skills": ["Zero-trust networking","mTLS","IAM least-privilege","SOC 2 evidence pipelines"],
      "Soft Skills": ["Incident command","Runbook culture","On-call leadership","Cost communication"],
    },
    certs: [
      { name: "CKA — Certified Kubernetes Administrator", org: "CNCF", skills: ["Cluster ops","Networking","RBAC"] },
      { name: "HashiCorp Certified: Terraform Associate", org: "HashiCorp", skills: ["IaC","State management","Modules"] },
      { name: "AWS Solutions Architect — Associate", org: "Amazon Web Services", skills: ["VPC","HA design","Cost"] },
      { name: "GCP Professional Cloud DevOps Engineer", org: "Google Cloud", skills: ["SRE","CI/CD","Monitoring"] },
    ],
    projects: [
      {
        name: "helmwave", desc: "Progressive GitOps delivery controller with canary gates driven by Prometheus SLOs.",
        problem: "Deploy-or-rollback was binary; teams shipped on Fridays and prayed.",
        features: ["SLO-driven canary promotion","Automatic rollback on error-budget burn","Slack-native approval flow"],
        impact: "Change-failure rate 14% → 3% · deploy frequency 4× weekly",
        tech: ["Go","Kubernetes","ArgoCD","Prometheus"], repo: "helmwave", live: "helmwave.io",
      },
      {
        name: "chaoskit", desc: "Lightweight chaos experiments as CRDs — kill pods, spike latency, burn CPU on schedule.",
        problem: "Resilience was assumed, never tested, until a region failover proved otherwise.",
        features: ["Experiments-as-CRDs","Blast-radius policies","Auto-jira on failed hypothesis"],
        impact: "Uncovered 6 latent failure modes pre-prod · MTTR −38%",
        tech: ["Go","Kubernetes","Grafana","Terraform"], repo: "chaoskit",
      },
      {
        name: "costlens", desc: "Kubernetes cost attribution dashboard mapping spend to teams, services and PRs.",
        problem: "Cloud bill grew 30% QoQ with zero attribution; finance meetings were guesswork.",
        features: ["Namespace + label attribution","PR-level cost previews","Anomaly alerts on spend drift"],
        impact: "−27% quarterly spend · adopted as default in 14 clusters",
        tech: ["Python","ClickHouse","Grafana","AWS CUR"], repo: "costlens", live: "costlens.app",
      },
    ],
    orgs: ["CNCF ambassador program","Kubernetes Community Days (organizer)","SREcon volunteers"],
    communities: ["Kubernetes Slack","r/devops","DevOps Institute","Local SRE meetup"],
    topics: ["GitOps beyond the hype","Platform engineering as product","FinOps for engineers","On-call that doesn't burn people out"],
    posts: [
      "Your platform team is a product team. Treat internal devs like users",
      "We cut the cloud bill 27% — not with spot instances, with attribution",
      "Change-failure rate 14% → 3%: the boring GitOps details that mattered",
      "Chaos engineering on a budget: CRDs, blast radius, and honest postmortems",
    ],
    about: [
      "Platform engineer who believes reliability is a feature and cost is a design constraint. {n} years running Kubernetes at scale, building GitOps paths developers don't hate.",
      "I automate myself out of jobs on purpose. SRE practices, FinOps, and internal platforms that feel like products.",
    ],
  },
  security: {
    industry: "Cybersecurity · Application Security",
    headlines: [
      "Senior Security Engineer @ {co} · AppSec, red teaming & DFIR · OSCP",
      "Penetration Tester @ {co} · cloud & API security · {n}+ yrs offensive + defensive",
      "AppSec Engineer @ {co} · threat modeling, SDL & secure defaults",
    ],
    ladder: ["Security Operations Analyst","Penetration Tester","Senior Security Engineer","Application Security Lead"],
    early: ["CipherGrid","BlueSentry","Trident SOC"],
    mid: ["CrowdStrike","Palo Alto Networks","Zscaler"],
    top: ["Mandiant","Trail of Bits","Microsoft MSRC","NCC Group"],
    degrees: ["B.S.","B.Tech"],
    fields: ["Cybersecurity","Computer Science","Information Security"],
    skills: {
      "Programming Languages": ["Python","Go","C","PowerShell","SQL","Rust (learning)"],
      "Frameworks": ["Metasploit","Burp Suite Pro","Nmap","BloodHound","MITRE ATT&CK"],
      "Libraries": ["Scapy","Volatility","Impacket","Semgrep rules"],
      "Databases": ["Splunk","Elasticsearch","PostgreSQL","Neo4j"],
      "Cloud Technologies": ["AWS Security Hub","Azure Sentinel","GCP SCC","Cloud IAM"],
      "DevOps Tools": ["Docker","SIEM/SOAR pipelines","GitHub Advanced Security","Terraform"],
      "AI / ML Skills": ["Threat-intel ML pipelines","Phishing detection models"],
      "Cybersecurity Skills": ["Penetration Testing","Red Teaming","Threat Modeling","DFIR","AppSec (SAST/DAST/SCA)","Zero Trust","Cloud Security","Secure Code Review"],
      "Soft Skills": ["Executive report writing","Developer empathy","Incident comms","Training delivery"],
    },
    certs: [
      { name: "OSCP — Offensive Security Certified Professional", org: "OffSec", skills: ["Pentesting","Exploitation","Reporting"] },
      { name: "CISSP Associate", org: "ISC2", skills: ["Security architecture","Governance"] },
      { name: "AWS Certified Security — Specialty", org: "Amazon Web Services", skills: ["IAM","Detection","Data protection"] },
      { name: "CompTIA Security+", org: "CompTIA", skills: ["Security fundamentals"] },
    ],
    projects: [
      {
        name: "phishnet", desc: "ML-assisted phishing triage that clusters lures by campaign and auto-extracts IOCs.",
        problem: "SOC analysts spent 4h/day manually triaging lookalike lures during campaigns.",
        features: ["Campaign clustering (fuzzy + embedding)","One-click IOC extraction","Abuse-report auto-filing"],
        impact: "Triage time 4h → 40min/day · caught 3 campaigns pre-blast",
        tech: ["Python","scikit-learn","Elasticsearch","FastAPI"], repo: "phishnet",
      },
      {
        name: "redrun", desc: "Deterministic red-team runbook runner with evidence capture and scope guardrails.",
        problem: "Engagement evidence lived in screenshots and tribal memory.",
        features: ["YAML runbooks with scope checks","Automatic evidence hashing","Report skeleton export"],
        impact: "Report turnaround −60% · zero scope violations across 40+ engagements",
        tech: ["Go","Python","PostgreSQL","Docker"], repo: "redrun", live: "redrun.sh",
      },
      {
        name: "vaultwatch", desc: "Secrets-sprawl scanner for CI: finds leaked tokens, rotates via Vault, opens fix PRs.",
        problem: "Leaked credentials kept appearing in repos faster than manual scans caught them.",
        features: ["Diff-aware scanning in CI","Vault-native rotation playbooks","Fix-PR generation"],
        impact: "Mean time to revoke 9 days → 4 hours",
        tech: ["Python","Vault","GitHub Actions","Semgrep"], repo: "vaultwatch",
      },
    ],
    orgs: ["OWASP (chapter lead)","DEF CON groups volunteer","InfoSec Mentor Circle"],
    communities: ["OWASP community","r/netsec","Blue Team Labs","Local BSides organizer"],
    topics: ["Threat modeling for busy teams","Secrets hygiene","Cloud IAM pitfalls","Social engineering defense"],
    posts: [
      "Threat modeling in 45 minutes: the template developers actually finish",
      "Your IAM policy is a novel. Here's how to make it a haiku",
      "From 9 days to 4 hours: automating credential revocation end-to-end",
      "Phishing campaigns got better. Your triage should too — ours did, 10×",
    ],
    about: [
      "Breaker by trade, builder by choice. {n} years across SOC, red team and AppSec — now focused on making secure paths the easy paths for developers.",
      "I turn attacker tradecraft into guardrails: threat models, detection, and tooling that treats engineers as users.",
    ],
  },
};

const RECOMMENDER_POOL = ["Rahul Verdan","Katya Molnar","Sam Osei","Ines Duarte","Devang Shah","Laura Beck","Nikhil Rao","Owen Fitzgerald"];

/* ------------------------------------------------------------------ */
/*  generator                                                          */
/* ------------------------------------------------------------------ */

export function countFields(m: ModuleData): number {
  return m.rows.length + (m.entries ?? []).reduce((a, e) => a + e.rows.length, 0);
}

export function moduleAvgConf(m: ModuleData): number {
  const all = [...m.rows, ...(m.entries ?? []).flatMap((e) => e.rows)];
  if (!all.length) return 0;
  return all.reduce((a, r) => a + r.conf, 0) / all.length;
}

export function generateProfile(slug: string): Profile {
  const seed = hashString(slug);
  const rng = mulberry32(seed);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const pickN = <T,>(arr: T[], n: number): T[] => {
    const copy = [...arr];
    const out: T[] = [];
    while (copy.length && out.length < n) out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
    return out;
  };
  const int = (a: number, b: number) => a + Math.floor(rng() * (b - a + 1));
  const chance = (p: number) => rng() < p;
  const conf = (base = 0.92, floor = 0.64) =>
    Math.min(0.99, Math.max(floor, base - rng() * 0.1 + rng() * 0.05));
  const row = (label: string, kind: RowKind, src: string, val: string | string[], base = 0.92): Row => ({
    label,
    kind,
    ...(Array.isArray(val) ? { values: val } : { value: val }),
    conf: conf(base),
    src,
  });

  const keys = Object.keys(ARCHETYPES) as Archetype[];
  const archetype = keys[seed % keys.length];
  const A = ARCHETYPES[archetype];

  const name = pick(NAMES);
  const loc = pick(LOCATIONS);
  const yearsExp = int(5, 12);
  const nRoles = chance(0.55) ? 4 : 3;
  const ladder = A.ladder.slice(A.ladder.length - nRoles);

  /* ---- career timeline (months, newest first) ---- */
  const totalMonths = yearsExp * 12 + int(0, 11);
  const weights = ladder.map((_, i) => 1 + i * 0.55); // newer roles longer
  const wSum = weights.reduce((a, b) => a + b, 0);
  let cursorMonths = 0; // 0 = present (Feb 2026)
  const NOW_Y = 2026, NOW_M = 1; // Feb 2026 index 1
  const fmt = (mIdx: number, y: number) => `${MONTHS[mIdx]} ${y}`;
  const back = (monthsAgo: number) => {
    const total = NOW_Y * 12 + NOW_M - monthsAgo;
    return { y: Math.floor(total / 12), m: ((total % 12) + 12) % 12 };
  };
  const fmtDur = (mo: number) => {
    const y = Math.floor(mo / 12), m = mo % 12;
    if (y === 0) return `${m} mos`;
    if (m === 0) return `${y} yr${y > 1 ? "s" : ""}`;
    return `${y} yr${y > 1 ? "s" : ""} ${m} mos`;
  };

  const companyPool = [pick(A.early), pick(A.mid), ...pickN(A.top, 2)];
  const respPool = [
    "Owned the core service end-to-end: design, rollout, SLOs and on-call",
    "Led migration of 40+ services with zero customer-facing downtime",
    "Built eval / test harnesses that became the team release gate",
    "Drove quarterly planning with product, translating metrics into roadmap",
    "Mentored 3 junior engineers through promotion cycles",
    "Cut p95 latency 58% by re-architecting the hot path",
    "Introduced RFC + design-review culture across the org",
    "Partnered with finance to instrument per-team cost attribution",
  ];
  const achPool = [
    "Shipped the flagship feature adopted by 1.2M monthly users",
    "Reduced infra spend 27% while traffic grew 3×",
    "Took change-failure rate from 14% down to 3%",
    "Won internal 'Ship of the Year' award (2024)",
    "Grew organic traffic 4.6× via performance + platform work",
    "Scaled the system from 40k to 9M requests/day",
  ];
  const seniorityLabels = ["Entry-level","Associate","Mid-level","Senior","Lead / Staff"];

  const expEntries: Entry[] = ladder.map((title, idx) => {
    const share = Math.round((weights[idx] / wSum) * totalMonths);
    const startAgo = cursorMonths + share;
    const s = back(startAgo);
    const e = idx === ladder.length - 1 ? null : back(cursorMonths);
    cursorMonths = startAgo;
    const company = idx < 2 ? companyPool[idx] : companyPool[2 + Math.min(idx - 2, 1)];
    const type = idx === 0 ? "Internship" : "Full-time";
    const tech = pickN(A.skills["Programming Languages"] ?? [], 2).concat(pickN(A.skills["Frameworks"] ?? [], 2));
    return {
      title,
      subtitle: `${company} · ${type}`,
      meta: `${fmt(s.m, s.y)} — ${e ? fmt(e.m, e.y) : "Present"} · ${fmtDur(share)}`,
      rows: [
        row("Employment Type", "text", "span.pv-entity__employment-type", type, 0.96),
        row("Start Date", "text", "span.pv-entity__date-range time:nth(0)", fmt(s.m, s.y), 0.97),
        row("End Date", "text", "span.pv-entity__date-range time:nth(1)", e ? fmt(e.m, e.y) : "Present", 0.97),
        row("Duration", "text", "span.pv-entity__date-range + span", fmtDur(share), 0.9),
        row(
          "Job Description",
          "text",
          "div.pv-entity__description span[aria-hidden]",
          `${title} on the ${pick(["platform","growth","core product","infrastructure","AI applications"])} team. ${pick(respPool)}. ${pick(respPool)}.`,
          0.88,
        ),
        row("Responsibilities", "lines", "div.pv-entity__description li", pickN(respPool, 3), 0.85),
        row("Achievements", "lines", "div.pv-entity__description li b", pickN(achPool, 2), 0.8),
        row("Technologies Used", "chips", "span.pv-entity__skill", tech, 0.87),
        row("Projects Worked On", "chips", "div.pv-entity__extra-details", pickN(A.projects.map((p) => p.name), Math.min(2, A.projects.length)), 0.74),
        row("Seniority Level", "text", "meta[itemprop=occupationalLevel]", seniorityLabels[Math.min(idx + 1, 4)], 0.78),
      ],
    };
  }).reverse();

  const currentRole = ladder[ladder.length - 1];
  const currentCompany = expEntries[0].subtitle?.split(" · ")[0] ?? pick(A.top);
  const prevCompany = expEntries[1]?.subtitle?.split(" · ")[0] ?? pick(A.mid);

  const headline = pick(A.headlines).replace("{co}", currentCompany).replace("{prev}", prevCompany).replace("{n}", String(yearsExp));
  const about = pick(A.about).replace("{n}", String(yearsExp));
  const progression = ladder.slice(1).join(" → ") + ` (${ladder.length - 1} promotion${ladder.length > 2 ? "s" : ""} in ${fmtDur(totalMonths)})`;

  /* ---- skills ---- */
  const skillRows: Row[] = Object.entries(A.skills).map(([cat, list]) =>
    row(cat, "chips", `section.pv-skill-categories [data-cat="${cat.toLowerCase().replace(/[^a-z]+/g, "-")}"]`, pickN(list, Math.min(list.length, int(Math.max(3, list.length - 2), list.length))), 0.9),
  );
  const flatSkills = Object.values(A.skills).flat();
  const topSkills = pickN(flatSkills.slice(0, 14), 6);
  skillRows.push(
    row("Endorsements", "lines", "span.vc-skill-entity__endorsement-count", topSkills.map((s) => `${s} — ${int(17, 99)} endorsements`), 0.82),
    row("Proficiency Evidence", "lines", "div.pv-profile-section__see-more", [
      `GitHub: ${int(18, 60)} repos · ${int(900, 3400)} contributions (last 12 mo)`,
      archetype === "ml" ? `Kaggle: ${int(3, 14)} competitions · ${pick(["Gold ×2","Silver ×5","Expert tier"])}` : `LeetCode: ${int(220, 900)} problems · ${pick(["Knight","Guardian","Warrior"])} badge`,
      `Talks & workshops: ${int(2, 7)} delivered at meetups / internal guilds`,
    ], 0.75),
  );

  /* ---- education ---- */
  const gradYear = NOW_Y - yearsExp - int(0, 1);
  const edu: Entry = {
    title: pick(SCHOOLS),
    subtitle: `${pick(A.degrees)} · ${pick(A.fields)}`,
    meta: `${gradYear - 4} — ${gradYear}`,
    rows: [
      row("Degree", "text", "span.pv-entity__degree-name", pick(A.degrees), 0.96),
      row("Field of Study", "text", "span.pv-entity__fos-name", pick(A.fields), 0.95),
      row("Start Year", "text", "span.pv-entity__dates time:nth(0)", String(gradYear - 4), 0.94),
      row("Graduation Year", "text", "span.pv-entity__dates time:nth(1)", String(gradYear), 0.95),
      ...(chance(0.5) ? [row("GPA / Grade", "text", "div.pv-entity__grade", `${(8.1 + rng() * 1.6).toFixed(2)} / 10`, 0.7)] : []),
      row("Coursework", "chips", "div.pv-entity__courses", pickN(["Distributed Systems","Operating Systems","Machine Learning","Database Internals","Computer Networks","Compilers","Cryptography","Algorithms","Software Architecture","Linear Algebra"], 5), 0.8),
      row("Academic Projects", "lines", "div.pv-entity__projects", [
        `${pick(["Distributed key-value store","Neural code summarizer","Campus mesh network simulator","Vulnerability fuzzer"])} — ${pick(["graded top-5 in cohort","open-sourced, 200+ stars","presented at dept. colloquium"])}`,
      ], 0.72),
      row("Activities", "chips", "div.pv-entity__activities", pickN(["Coding club lead","Teaching assistant","Hackathon organizer","Debate society","Open-source wing"], 3), 0.8),
      row("Achievements", "lines", "div.pv-entity__honors", pickN(["Dean's list ×4","Best undergraduate thesis award","National coding Olympiad finalist"], int(1, 2)), 0.76),
    ],
  };

  /* ---- projects ---- */
  const projEntries: Entry[] = pickN(A.projects, int(2, 3)).map((p) => ({
    title: p.name,
    subtitle: `${p.tech.slice(0, 2).join(" · ")}${p.live ? ` · ${p.live}` : ""}`,
    meta: `${int(2022, 2024)} — ${chance(0.5) ? "Present" : String(int(2024, 2025))}`,
    rows: [
      row("Description", "text", "div.pv-profile-section section p", p.desc, 0.9),
      row("Role", "text", "span.pv-entity__role", pick(["Creator & maintainer","Lead developer","Solo builder"]), 0.84),
      row("Technologies", "chips", "span.pv-entity__tech-stack", p.tech, 0.9),
      row("Problem Solved", "text", "div.pv-entity__description", p.problem, 0.82),
      row("Features", "lines", "div.pv-entity__description li", p.features, 0.85),
      row("Impact", "text", "div.pv-entity__outcome", p.impact, 0.79),
      row("GitHub URL", "link", "a[data-control-name=project_github]", `https://github.com/${slug.replace(/[^a-z0-9-]/g, "")}/${p.repo}`, 0.93),
      ...(p.live ? [row("Live URL", "link", "a[data-control-name=project_live]", `https://${p.live}`, 0.9)] : []),
      row("Project Duration", "text", "span.pv-entity__duration", `${int(3, 10)} months`, 0.7),
    ],
  }));

  /* ---- achievements ---- */
  const awardsPool = [
    `${currentCompany} 'Impact Award' — ${int(2022, 2025)}`,
    "Speaker of the Month — local tech meetup",
    `${pick(["Best in Show","Top 10"])}, ${pick(["Smart India Hackathon","HackWithIndia","AngelHack"])}`,
  ];
  const hackPool = [
    `${pick(["Smart India Hackathon","ETHGlobal","HackMIT","NASA Space Apps"])} — ${pick(["Winner","Finalist","Top 5"])}`,
    `24h internal hackathon @ ${currentCompany} — 1st place`,
  ];
  const compPool = archetype === "ml"
    ? ["Kaggle — 2× Gold medals (tabular + NLP tracks)","LeetCode Weekly — best rank #212"]
    : archetype === "security"
      ? ["CTF time — regional finals ×3","Bug bounty: 14 valid reports (HackerOne)"]
      : ["Google Code Jam — Round 3","LeetCode Weekly — best rank #489"];
  const pubs = archetype === "ml"
    ? [`"${pick(["Grounded Retrieval under Distribution Shift","Cost-aware LLM Serving","Calibrated Forecasts for Retail"])}" — ${pick(["NeurIPS workshop","ACL Findings","arXiv 2025"])}`]
    : [`${pick(["Threat-modeling at startup speed","Secrets hygiene in CI"])} — engineering blog series (${int(20, 90)}k reads)`];

  /* ---- certifications ---- */
  const certEntries: Entry[] = pickN(A.certs, int(2, A.certs.length)).map((c) => {
    const iy = int(2021, 2025), im = int(0, 11);
    return {
      title: c.name,
      subtitle: c.org,
      meta: `Issued ${fmt(im, iy)}`,
      rows: [
        row("Issuing Organization", "text", "span.pv-certification__issuer", c.org, 0.95),
        row("Issue Date", "text", "span.pv-certification__issue-date", fmt(im, iy), 0.93),
        row("Expiry Date", "text", "span.pv-certification__expiry", chance(0.4) ? fmt(im, iy + 3) : "No expiration", 0.88),
        row("Credential ID", "text", "span.pv-certification__credential-id", `${pick(["AWS","CKA","HC","GCP","OSCP"])}-${int(100000, 999999)}`, 0.9),
        row("Credential URL", "link", "a.pv-certification__credential-url", `https://credential.${pick(["aws","cncf","hashicorp","cloud","offsec"])}.example/verify/${int(10000, 99999)}`, 0.86),
        row("Skills Covered", "chips", "span.pv-certification__skill", c.skills, 0.88),
      ],
    };
  });

  /* ---- signals ---- */
  const openToWork = chance(0.62);
  const preferredTitles = [ladder[ladder.length - 1], ...(ladder.length < A.ladder.length ? [A.ladder[A.ladder.indexOf(currentRole) + 1]] : [pick(["Principal Engineer","Director of Engineering","Founding Engineer"])])];

  /* ---- network ---- */
  const recommenders = pickN(RECOMMENDER_POOL, 3);
  const recLines = [
    `"${pick(["The rare engineer who makes everyone around them better.","Calm in incidents, ruthless about quality.","Turned our vague roadmap into a shipping machine."])}" — ${recommenders[0]}, ${pick(["Engineering Manager","Staff Engineer","Product Lead"])} @ ${currentCompany}`,
    `"${pick(["Best technical communicator I've worked with.","Their RFCs are required reading on our team."])}" — ${recommenders[1]}, ${pick(["Senior Engineer","Design Lead","CTO"])} @ ${prevCompany}`,
  ];

  /* ---- content ---- */
  const freqTech = pickN(Object.values(A.skills).flat().slice(0, 16), 6).map((t) => `${t} ×${int(6, 34)}`);

  /* ---- external ---- */
  const ghUser = slug.replace(/[^a-z0-9-]/g, "") || slug;

  /* ---- assemble modules ---- */
  const modules: ModuleData[] = MODULE_ORDER.map((def) => {
    switch (def.id) {
      case "identity":
        return {
          ...def, srcRoot: "section.pv-profile-card",
          summary: "Core profile card + contact block",
          rows: [
            row("Full Name", "text", "h1.text-heading-xlarge", name, 0.99),
            row("Headline", "text", "div.text-body-medium", headline, 0.97),
            row("About / Bio", "text", "div.pv-shared-text-with-see-more", about, 0.9),
            row("Location", "text", "span.text-body-small.pb2", loc.full, 0.95),
            row("Country", "text", "meta[itemprop=addressCountry]", loc.country, 0.93),
            row("City", "text", "meta[itemprop=addressLocality]", loc.city, 0.93),
            row("Current Role", "text", "div.pv-text-details__left-panel h2", currentRole, 0.94),
            row("Current Company", "text", "span[aria-label*=Current]", currentCompany, 0.94),
            row("Industry", "text", "span.pv-member-badge__industry", A.industry, 0.88),
            row("Profile URL", "link", "link[rel=canonical]", `https://www.linkedin.com/in/${slug}/`, 0.99),
          ],
        };
      case "experience":
        return {
          ...def, srcRoot: "section#experience-section",
          summary: `${expEntries.length} roles · ${fmtDur(totalMonths)} total`,
          rows: [
            row("Career Progression", "text", "div.pv-profile-section (derived)", progression, 0.72),
            row("Total Experience", "text", "section#experience (derived)", fmtDur(totalMonths), 0.9),
          ],
          entries: expEntries,
        };
      case "skills":
        return {
          ...def, srcRoot: "section.pv-skill-categories",
          summary: `${flatSkills.length} skills across 9 taxonomies`,
          rows: skillRows,
        };
      case "education":
        return {
          ...def, srcRoot: "section#education-section",
          summary: `${edu.title.split(",")[0]} · class of ${gradYear}`,
          rows: [],
          entries: [edu],
        };
      case "projects":
        return {
          ...def, srcRoot: "section#projects-section",
          summary: `${projEntries.length} projects with repo + impact signals`,
          rows: [],
          entries: projEntries,
        };
      case "achievements":
        return {
          ...def, srcRoot: "section#accomplishments-section",
          summary: "Awards, competitions, publications & leadership",
          rows: [
            row("Awards", "lines", "div.pv-accomplishments-block li", pickN(awardsPool, 2), 0.8),
            row("Hackathons", "lines", "div.pv-accomplishments-block--hackathon li", pickN(hackPool, 2), 0.78),
            row("Competitions", "lines", "div.pv-accomplishments-block--competition li", compPool, 0.8),
            row("Publications", "lines", "div.pv-accomplishments-block--publication li", pubs, 0.74),
            row("Patents", "text", "div.pv-accomplishments-block--patent", chance(0.25) ? `${int(1, 2)} filed (${int(2023, 2025)})` : "None on public record", 0.66),
            row("Scholarships", "lines", "div.pv-accomplishments-block--honor li", chance(0.5) ? [pick(["Merit scholarship — full tuition ×2 yrs", "National STEM scholarship", "Corporate-sponsored research grant"])] : ["Not disclosed on profile"], 0.68),
            row("Leadership Achievements", "lines", "div.pv-accomplishments-block li b", ["Led a guild / chapter of 40+ members", pick(["University coding club president","Conference track co-chair","Mentored 15+ early-career engineers"])], 0.76),
            row("Academic Achievements", "lines", "div.pv-accomplishments-block--honor li", pickN(["Dean's list","Thesis award","Olympiad finalist","Research assistantship"], 2), 0.74),
          ],
        };
      case "certifications":
        return {
          ...def, srcRoot: "section#certifications-section",
          summary: `${certEntries.length} verified credentials`,
          rows: [],
          entries: certEntries,
        };
      case "signals":
        return {
          ...def, srcRoot: "div.pv-open-to-work",
          summary: openToWork ? "Open to work — actively signaling" : "Passive candidate — latent signals only",
          rows: [
            row("Open to Work", "flag", "div.pv-open-to-work__badge", openToWork ? "Yes — visible to recruiters" : "No public badge detected", 0.96),
            row("Preferred Job Titles", "chips", "div.pv-open-to-work__job-titles", preferredTitles, 0.82),
            row("Preferred Locations", "chips", "div.pv-open-to-work__locations", pickN(LOCATIONS.map((l) => l.full.split(",")[0]), 3), 0.8),
            row("Remote Preference", "text", "span[data-remote-pref]", pick(["Remote-first","Hybrid (2–3 days)","Remote OK, HQ monthly","On-site open for right role"]), 0.78),
            row("Relocation Preference", "text", "span[data-relocation]", pick(["Open to relocation","Open within country","Not seeking relocation"]), 0.74),
            row("Employment Type", "chips", "div.pv-open-to-work__types", pickN(["Full-time","Contract","Advisory / fractional"], 2), 0.8),
            row("Industries Interested In", "chips", "div.pv-open-to-work__industries", pickN([A.industry, "FinTech","Climate Tech","Developer Tools","HealthTech","Consumer AI"], 3), 0.72),
            row("Career Interests", "lines", "div.pv-career-interests", pickN(["Moving into architecture / staff scope","Building 0→1 products","Leading a small pod","Deep specialization track"], 2), 0.68),
            row("Seniority Preference", "text", "span[data-seniority]", pick(["Senior IC","Staff / Principal","Management track"]), 0.7),
          ],
        };
      case "network":
        return {
          ...def, srcRoot: "section#volunteering-section",
          summary: "Orgs, volunteering & recommendation graph",
          rows: [
            row("Organizations", "chips", "div.pv-accomplishments-block--organization li", A.orgs, 0.84),
            row("Volunteer Experience", "lines", "div.volunteering-section li", [`${pick(["Workshop mentor","Conference volunteer lead","Open-source triage maintainer"])} — ${pick(A.orgs)} (${int(2021, 2024)} — Present)`], 0.78),
            row("Leadership Roles", "lines", "div.volunteering-section li b", [pick(["Guild lead — 40 engineers","Chapter organizer","Tech lead, volunteer platform team"])], 0.76),
            row("Communities", "chips", "div.pv-profile-section__section-card li", A.communities, 0.82),
            row("Professional Associations", "chips", "div.pv-accomplishments-block li", pickN(["ACM","IEEE","CNCF community","OWASP"], 2), 0.78),
            row("Recommendations Received", "lines", "div.pv-recommendations-tab__received li", recLines, 0.85),
            row("Recommendations Given", "lines", "div.pv-recommendations-tab__given li", [`${recommenders[2]} — ${pick(["peer endorsement for systems design","wrote recommendation for mentorship"])}`], 0.8),
          ],
        };
      case "content":
        return {
          ...def, srcRoot: "div.pv-recent-activity-section",
          summary: `${int(40, 180)} followers-engaging posts · ${pick(["Top Voice","Rising creator","—"])} in ${pick(A.topics).split(" ")[0]}`,
          rows: [
            row("Posts", "lines", "div.profile-creator-shared-feed-update", pickN(A.posts, 3).map((p, i) => `${p} — ${int(40, 900)} reactions · ${int(2, 60)} comments`)),
            row("Articles", "lines", "article.entry-item", [`${pick(A.topics)} — long-form on ${pick(["LinkedIn newsletter","dev.to","personal blog"])} (${int(8, 60)}k reads)`]),
            row("Topics Discussed", "chips", "div.pv-browsemap-section span", A.topics, 0.82),
            row("Technical Interests", "chips", "div.pv-browsemap-section li", pickN(Object.values(A.skills).flat(), 6), 0.8),
            row("Recent Activity", "lines", "div.pv-recent-activity-section li", [
              `Commented on a ${pick(["Kubernetes","LLM evals","AppSec","web performance"])} deep-dive — 3 days ago`,
              `Reacted to ${int(5, 30)} posts this week · follows ${int(300, 1400)} accounts`,
              `Shared an article on ${pick(A.topics).toLowerCase()} — 2 weeks ago`,
            ], 0.76),
            row("Frequently Discussed Technologies", "lines", "derived: post corpus n-grams", freqTech, 0.7),
          ],
        };
      case "external":
        return {
          ...def, srcRoot: "section.pv-contact-info",
          summary: "Cross-platform footprint for GitHub / LeetCode ingestion",
          rows: [
            row("GitHub", "link", "a[data-contact-info=github]", `https://github.com/${ghUser}`, 0.97),
            row("LeetCode", "link", "a[data-contact-info=leetcode]", `https://leetcode.com/u/${ghUser}`, 0.9),
            row("Portfolio", "link", "a[data-contact-info=portfolio]", `https://${ghUser}.dev`, 0.88),
            row("Personal Website", "link", "a[data-contact-info=website]", chance(0.6) ? `https://www.${ghUser}.io` : `https://${ghUser}.dev/about`, 0.85),
            row("Kaggle", "link", "a[data-contact-info=kaggle]", archetype === "ml" ? `https://www.kaggle.com/${ghUser}` : "Not linked on profile", 0.7),
            row("Stack Overflow", "link", "a[data-contact-info=stackoverflow]", chance(0.7) ? `https://stackoverflow.com/users/${int(1000000, 9999999)}/${ghUser}` : "Not linked on profile", 0.72),
            row("Research Profiles", "link", "a[data-contact-info=scholar]", archetype === "ml" ? `https://scholar.google.com/citations?user=${ghUser.slice(0, 10)}` : "Not applicable", 0.64),
            row("Other Professional Links", "lines", "div.pv-contact-info__ci-container", pickN([`X/Twitter — @${ghUser}`, `Hashnode — ${ghUser}.hashnode.dev`, `YouTube — ${int(2, 40)} tech talks`, `Polywork — ${ghUser}`], 2), 0.7),
          ],
        };
      default:
        return { ...def, srcRoot: "body", summary: "", rows: [] };
    }
  });

  const fieldsTotal = modules.reduce((a, m) => a + countFields(m), 0);
  const allConf = modules.flatMap((m) => [...m.rows, ...(m.entries ?? []).flatMap((e) => e.rows)]);
  const avgConf = allConf.reduce((a, r) => a + r.conf, 0) / allConf.length;

  return {
    slug,
    url: `https://www.linkedin.com/in/${slug}/`,
    name,
    headline,
    location: loc.full,
    industry: A.industry,
    archetype,
    avatarHue: seed % 360,
    openToWork,
    modules,
    meta: {
      payloadKB: int(182, 436),
      scrapedAt: new Date().toISOString(),
      engine: "maxun-core v0.9.2",
      selectorMap: "linkedin-public@v11 · 247 nodes",
      proxy: "residential pool · geo IN/US/SG",
      fieldsTotal,
      avgConf,
      chunks: Math.round(fieldsTotal * 0.45),
    },
  };
}

/* ------------------------------------------------------------------ */
/*  export payload (what phase 04 embeds)                              */
/* ------------------------------------------------------------------ */

export function toExportPayload(p: Profile): Record<string, unknown> {
  const rowsToObj = (rows: Row[]) =>
    Object.fromEntries(rows.map((r) => [r.label, r.kind === "chips" || r.kind === "lines" ? r.values : r.value]));
  return {
    schema: "sieve.talent-profile/v1",
    source: p.url,
    scraped_at: p.meta.scrapedAt,
    engine: p.meta.engine,
    profile: {
      name: p.name,
      headline: p.headline,
      location: p.location,
      industry: p.industry,
      open_to_work: p.openToWork,
    },
    modules: Object.fromEntries(
      p.modules.map((m) => [
        m.id,
        {
          ...(rowsToObj(m.rows) as object),
          ...(m.entries ? { items: m.entries.map((e) => ({ title: e.title, subtitle: e.subtitle, meta: e.meta, ...rowsToObj(e.rows) })) } : {}),
        },
      ]),
    ),
    embedding_hint: { chunks: p.meta.chunks, strategy: "module-scoped · field-weighted", model: "text-embedding-3-large" },
  };
}
