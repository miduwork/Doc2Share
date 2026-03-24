"use server";

import type { ActionResult } from "@/lib/action-result";
import { runMaintenanceNow as runMaintenanceNowImpl } from "./maintenance-actions";
import { createSignedDiagnosticsLink as createSignedDiagnosticsLinkImpl } from "./diagnostics-actions";
import type { ObservabilityActionDeps, SignedLinkInput } from "./action-shared";

export async function runMaintenanceNow(deps?: Partial<ObservabilityActionDeps>): Promise<ActionResult<{ message: string }>> {
  return runMaintenanceNowImpl(deps);
}

export async function createSignedDiagnosticsLink(input: SignedLinkInput): Promise<ActionResult<{ message: string; link: string }>> {
  return createSignedDiagnosticsLinkImpl(input);
}

export type { SignedLinkInput } from "./action-shared";
