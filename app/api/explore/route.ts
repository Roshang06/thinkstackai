import { searchPublic } from "@/lib/store";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const lessons = await searchPublic(query);
  return Response.json({ lessons });
}
