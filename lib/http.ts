import { readSessionUser, type SessionUser } from "./auth";
import { liveModelEnabled } from "./gemini";
import { activeStorage, storageNotice } from "./store";

export async function readUser(request: Request): Promise<SessionUser | null> {
  return readSessionUser(request);
}

export async function appStatus() {
  const storage = await activeStorage();
  return {
    liveModel: liveModelEnabled(),
    storage,
    storageNote: storageNotice(),
  };
}

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}
