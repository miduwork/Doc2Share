import { runBenchmarkRoute } from "./benchmark-route-handler";

export async function GET(req: Request) {
  return runBenchmarkRoute(req);
}
