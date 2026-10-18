import { searchPublic } from "@/lib/store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lessons = await searchPublic(url.searchParams.get("q") ?? "", {
    instructor: url.searchParams.get("instructor") ?? "",
    institution: url.searchParams.get("institution") ?? "",
  });
  return Response.json({ lessons });
}
