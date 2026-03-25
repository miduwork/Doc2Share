export const SECURITY_WORKSPACES = ["overview", "logs", "geo", "benchmark", "forensic"] as const;

export type SecurityWorkspace = (typeof SECURITY_WORKSPACES)[number];

export function parseSecurityWorkspace(value: string | null | undefined): SecurityWorkspace {
  if (value === "logs" || value === "geo" || value === "benchmark" || value === "forensic") return value;
  return "overview";
}
