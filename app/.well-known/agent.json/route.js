import { GET as getAgentCard } from "../agent-card.json/route.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  return getAgentCard(request);
}
