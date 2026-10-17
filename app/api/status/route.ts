import { appStatus } from "@/lib/http";

export async function GET() {
  return Response.json(await appStatus());
}
