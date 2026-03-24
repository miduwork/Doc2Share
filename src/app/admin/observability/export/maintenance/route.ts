import { createClient } from "@/lib/supabase/server";
import { handleMaintenanceExportRequest } from "./route-handler";

export async function GET(req: Request) {
  const supabase = await createClient();
  return handleMaintenanceExportRequest(req, supabase);
}

