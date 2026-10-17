import { compare, hash } from "bcryptjs";

export function hashPassword(password: string): Promise<string> {
  return hash(password, 10);
}

export function checkPassword(password: string, passwordHash: string): Promise<boolean> {
  return compare(password, passwordHash);
}
