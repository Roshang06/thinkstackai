import { readUser } from "@/lib/http";
import { profileFromAccount } from "@/lib/profile";
import { findAccountById } from "@/lib/store";

export async function GET(request: Request) {
  const session = await readUser(request);
  if (!session) return Response.json({ user: null });
  const account = await findAccountById(session.id);
  const user = account
    ? profileFromAccount(account)
    : { id: session.id, name: session.name, email: session.email, role: "student" as const, institution: "", interests: [] as string[], birthday: "" };
  return Response.json({ user });
}
