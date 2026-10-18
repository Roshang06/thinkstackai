import { searchCourses, searchPublic } from "@/lib/store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const filters = {
    instructor: url.searchParams.get("instructor") ?? "",
    institution: url.searchParams.get("institution") ?? "",
  };
  const query = url.searchParams.get("q") ?? "";
  const [lessons, courses] = await Promise.all([searchPublic(query, filters), searchCourses(query, filters)]);
  return Response.json({ lessons, courses });
}
