import { createClient } from "@/lib/supabase/server";
import { handleAlertsExportRequest } from "./route-handler";

export async function GET(req: Request) {
  const supabase = await createClient();
  return handleAlertsExportRequest(req, supabase);
}

