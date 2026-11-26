// The companies a workshop attendee can pick. Each one's data is loaded only when it is selected,
// and kept apart: its own findings, use cases, actions and report downloads.
import list from "./companies/index.json";
import vardhan from "./seed.json";

export const COMPANIES = list;
export const DEFAULT_COMPANY = "vardhan";

const loaders = {
  vardhan: async () => vardhan,
  kaveri: () => import("./companies/kaveri.json").then((m) => m.default),
  aanya: () => import("./companies/aanya.json").then((m) => m.default),
  aravali: () => import("./companies/aravali.json").then((m) => m.default),
};

export const companyMeta = (key) => list.find((c) => c.key === key) || list[0];

export async function loadCompany(key) {
  const k = loaders[key] ? key : DEFAULT_COMPANY;
  return { key: k, data: await loaders[k]() };
}

// Report files built by the FlowIQ Automation pipeline (report_center.py): served from /public/reports/<company>/.
export const reportUrl = (key, filename) => `/reports/${key}/${encodeURIComponent(filename)}`;
