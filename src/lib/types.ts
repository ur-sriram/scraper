export type RowKind = "text" | "link" | "chips" | "lines" | "flag";

export interface Row {
  label: string;
  kind: RowKind;
  value?: string;
  values?: string[];
  conf: number; // 0..1 extraction confidence
  src: string; // DOM selector the value was pulled from
}

export interface Entry {
  title: string;
  subtitle?: string;
  meta?: string;
  rows: Row[];
}

export interface ModuleData {
  id: ModuleId;
  name: string;
  icon: string;
  summary: string;
  srcRoot: string;
  rows: Row[];
  entries?: Entry[];
}

export type ModuleId =
  | "identity"
  | "experience"
  | "skills"
  | "education"
  | "projects"
  | "achievements"
  | "certifications"
  | "signals"
  | "network"
  | "content"
  | "external";

export interface ProfileMeta {
  payloadKB: number;
  scrapedAt: string;
  engine: string;
  selectorMap: string;
  proxy: string;
  fieldsTotal: number;
  avgConf: number;
  chunks: number;
}

export interface Profile {
  slug: string;
  url: string;
  name: string;
  headline: string;
  location: string;
  industry: string;
  archetype: Archetype;
  avatarHue: number;
  openToWork: boolean;
  modules: ModuleData[];
  meta: ProfileMeta;
}

export type Archetype = "ml" | "fullstack" | "devops" | "security";

export type ModuleStatus = "queued" | "running" | "done" | "skipped";

export interface LogLine {
  t: string; // elapsed timestamp string
  text: string;
  tone: "info" | "ok" | "warn" | "dim" | "err";
}

export type Phase = "idle" | "running" | "done" | "aborted";

export const MODULE_ORDER: { id: ModuleId; name: string; icon: string }[] = [
  { id: "identity", name: "Identity & Basics", icon: "fingerprint" },
  { id: "experience", name: "Experience", icon: "briefcase" },
  { id: "skills", name: "Skills", icon: "chip" },
  { id: "education", name: "Education", icon: "cap" },
  { id: "projects", name: "Projects", icon: "rocket" },
  { id: "achievements", name: "Achievements", icon: "trophy" },
  { id: "certifications", name: "Certifications", icon: "ribbon" },
  { id: "signals", name: "Professional Signals", icon: "radar" },
  { id: "network", name: "Network", icon: "nodes" },
  { id: "content", name: "Content & Activity", icon: "pen" },
  { id: "external", name: "External Profiles", icon: "orbit" },
];
