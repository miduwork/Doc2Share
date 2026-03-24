import { createObservabilityAdminRepository, type ObservabilityAdminRepository } from "@/lib/domain/observability";

export type SignedLinkInput = {
  preset?: string;
  window?: string;
  severity?: string;
  source?: string;
  event_type?: string;
  alerts_cursor?: string;
  alerts_dir?: string;
  alerts_page?: string;
  runs_page?: string;
  alerts_page_size?: string;
  runs_page_size?: string;
  export_limit?: string;
};

export type ObservabilityActionDeps = {
  repository: ObservabilityAdminRepository;
};

export function resolveObservabilityDeps(overrides?: Partial<ObservabilityActionDeps>): ObservabilityActionDeps {
  return {
    repository: overrides?.repository ?? createObservabilityAdminRepository(),
  };
}
