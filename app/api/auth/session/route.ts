import { readUser } from "@/lib/http";

export async function GET(request: Request) {
  const user = await readUser(request);
  return Response.json({ user });
}
