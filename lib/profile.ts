import type { Profile, Role } from "./types";

export function normalizeRole(value: unknown): Role | null {
  return value === "student" || value === "instructor" ? value : null;
}

export function normalizeInstitution(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const institution = value.replace(/\s+/g, " ").trim().slice(0, 120);
  if (institution.length < 2) return null;
  return institution;
}

export function normalizeBirthday(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  if (year < 1900 || date.getTime() > Date.now()) return null;
  return value;
}

export function normalizeInterests(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const interests: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const interest = item.replace(/\s+/g, " ").trim().slice(0, 32);
    if (interest.length < 2 || interests.some((existing) => existing.toLowerCase() === interest.toLowerCase())) continue;
    interests.push(interest);
    if (interests.length === 8) break;
  }
  return interests;
}

export function profileFromAccount(account: {
  id: string;
  name: string;
  email: string;
  role?: Role;
  institution?: string;
  interests?: string[];
  birthday?: string;
}): Profile {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role === "instructor" ? "instructor" : "student",
    institution: account.institution ?? "",
    interests: account.interests ?? [],
    birthday: account.birthday ?? "",
  };
}
