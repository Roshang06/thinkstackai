import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { MongoClient, type Db } from "mongodb";
import { newId, reassignIds } from "./blocks";
import { flattenSections, normalizeLesson } from "./sections";
import { isBlock } from "./document";
import { seedLessons } from "./offline";
import type { Account, Block, ChatMessage, Lesson, LessonSummary, Progress } from "./types";

type DatabaseShape = {
  lessons: Lesson[];
  progress: Progress[];
  messages: ChatMessage[];
  users: Account[];
};

const FILE = path.join(process.cwd(), ".data", "store.json");

let queue: Promise<unknown> = Promise.resolve();
let mongoClient: Promise<MongoClient> | null = null;
let mongoSeeded = false;
let storageChoice: Promise<"mongo" | "file"> | null = null;
let storageNote: string | null = null;

export function mongoUri(): string | null {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) return null;
  if (/placeholder|your-cluster|example|changeme/i.test(uri)) return null;
  if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) return null;
  return uri;
}

export async function activeStorage(): Promise<"mongo" | "file"> {
  if (!storageChoice) {
    storageChoice = (async () => {
      if (!mongoUri()) return "file";
      try {
        await mongoDb();
        storageNote = null;
        return "mongo";
      } catch (error) {
        mongoClient = null;
        mongoSeeded = false;
        storageNote =
          "MongoDB is configured, but this network cannot reach Atlas on port 27017. Lessons stay on this computer until that port is open. In Atlas, allow this machine under Network Access.";
        console.error("MongoDB unavailable", error instanceof Error ? error.message : error);
        return "file";
      }
    })();
  }
  return storageChoice;
}

export function storageNotice(): string | null {
  return storageNote;
}

function emptyDb(): DatabaseShape {
  return { lessons: seedLessons(), progress: [], messages: [], users: [] };
}

async function readDb(): Promise<DatabaseShape> {
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as DatabaseShape;
    if (!Array.isArray(parsed.lessons)) return emptyDb();
    if (!Array.isArray(parsed.users)) parsed.users = [];
    return parsed;
  } catch {
    return emptyDb();
  }
}

async function writeDb(db: DatabaseShape): Promise<void> {
  await mkdir(path.dirname(FILE), { recursive: true });
  const temp = `${FILE}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(db));
  await rename(temp, FILE);
}

function withFile<T>(fn: (db: DatabaseShape) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const db = await readDb();
    const result = await fn(db);
    await writeDb(db);
    return result;
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function mongoDb(): Promise<Db> {
  const uri = mongoUri();
  if (!uri) throw new Error("MongoDB is not configured");
  if (!mongoClient) {
    mongoClient = new MongoClient(uri, {
      serverSelectionTimeoutMS: 8_000,
      connectTimeoutMS: 8_000,
      family: 4,
    }).connect();
  }
  const client = await mongoClient;
  const database = client.db(process.env.MONGODB_DB?.trim() || "thinkstack");
  if (!mongoSeeded) {
    const lessons = database.collection<Lesson>("lessons");
    const existing = await lessons.countDocuments({ ownerId: "community" });
    if (existing === 0) await lessons.insertMany(seedLessons());
    mongoSeeded = true;
  }
  return database;
}

function cleanLesson(lesson: Lesson): Lesson {
  const copy = { ...lesson } as Lesson & { _id?: unknown };
  delete copy._id;
  return normalizeLesson(copy);
}

function cleanMessage(message: ChatMessage): ChatMessage {
  const copy = { ...message } as ChatMessage & { _id?: unknown };
  delete copy._id;
  return copy;
}

function toSummary(lesson: Lesson): LessonSummary {
  return {
    id: lesson.id,
    ownerId: lesson.ownerId,
    ownerName: lesson.ownerName,
    institution: lesson.institution,
    title: lesson.title,
    topic: lesson.topic,
    level: lesson.level,
    minutes: lesson.minutes,
    tags: lesson.tags,
    visibility: lesson.visibility,
    summary: lesson.summary,
    blockCount: lesson.blocks.length,
    sectionCount: lesson.sections.length,
    stage: lesson.stage,
    createdAt: lesson.createdAt,
    updatedAt: lesson.updatedAt,
  };
}

function canRead(lesson: Lesson, userId: string | null): boolean {
  return lesson.visibility === "public" || (userId !== null && lesson.ownerId === userId);
}

export async function listForOwner(ownerId: string): Promise<LessonSummary[]> {
  if ((await activeStorage()) === "mongo") {
    const database = await mongoDb();
    const lessons = await database.collection<Lesson>("lessons").find({ ownerId }).sort({ updatedAt: -1 }).toArray();
    return lessons.map((lesson) => toSummary(cleanLesson(lesson)));
  }
  return withFile((db) =>
    db.lessons
      .filter((lesson) => lesson.ownerId === ownerId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(toSummary),
  );
}

export async function searchPublic(query: string, filters: { instructor?: string; institution?: string } = {}): Promise<LessonSummary[]> {
  const needle = query.trim().toLowerCase();
  const instructor = filters.instructor?.trim().toLowerCase() ?? "";
  const institution = filters.institution?.trim().toLowerCase() ?? "";
  const matches = (lesson: Lesson) => {
    if (lesson.visibility !== "public") return false;
    if (instructor && !lesson.ownerName.toLowerCase().includes(instructor)) return false;
    if (institution && !(lesson.institution ?? "").toLowerCase().includes(institution)) return false;
    if (!needle) return true;
    const haystack = [lesson.title, lesson.topic, lesson.summary, lesson.ownerName, lesson.institution ?? "", ...lesson.tags].join(" ").toLowerCase();
    return haystack.includes(needle);
  };
  if ((await activeStorage()) === "mongo") {
    const database = await mongoDb();
    const lessons = await database.collection<Lesson>("lessons").find({ visibility: "public" }).sort({ updatedAt: -1 }).limit(40).toArray();
    return lessons.filter(matches).map((lesson) => toSummary(cleanLesson(lesson)));
  }
  return withFile((db) => db.lessons.filter(matches).slice(0, 40).map(toSummary));
}

export async function progressFor(userId: string, lessonIds: string[]): Promise<Record<string, string[]>> {
  if (lessonIds.length === 0) return {};
  if ((await activeStorage()) === "mongo") {
    const database = await mongoDb();
    const rows = await database.collection<Progress>("progress").find({ userId, lessonId: { $in: lessonIds } }).toArray();
    return Object.fromEntries(rows.map((row) => [row.lessonId, row.completedBlockIds]));
  }
  return withFile((db) => {
    const rows = db.progress.filter((row) => row.userId === userId && lessonIds.includes(row.lessonId));
    return Object.fromEntries(rows.map((row) => [row.lessonId, row.completedBlockIds]));
  });
}

export async function getLesson(id: string): Promise<Lesson | null> {
  if ((await activeStorage()) === "mongo") {
    const database = await mongoDb();
    const lesson = await database.collection<Lesson>("lessons").findOne({ id });
    return lesson ? cleanLesson(lesson) : null;
  }
  return withFile((db) => structuredClone(db.lessons.find((lesson) => lesson.id === id) ?? null));
}

export async function listMessages(lessonId: string): Promise<ChatMessage[]> {
  if ((await activeStorage()) === "mongo") {
    const database = await mongoDb();
    const messages = await database.collection<ChatMessage>("messages").find({ lessonId }).sort({ createdAt: 1 }).toArray();
    return messages.map(cleanMessage);
  }
  return withFile((db) => db.messages.filter((message) => message.lessonId === lessonId));
}

export async function addMessage(lessonId: string, role: "user" | "model", text: string): Promise<ChatMessage> {
  const message: ChatMessage = {
    id: crypto.randomUUID(),
    lessonId,
    role,
    text: text.slice(0, 2000),
    createdAt: new Date().toISOString(),
  };
  if ((await activeStorage()) === "mongo") {
    const database = await mongoDb();
    await database.collection<ChatMessage>("messages").insertOne({ ...message });
    return message;
  }
  return withFile((db) => {
    db.messages.push(message);
    return message;
  });
}

export async function createLesson(lesson: Lesson): Promise<Lesson> {
  const normalized = normalizeLesson(lesson);
  if (!normalized.blocks.every(isBlock)) throw new Error("Invalid lesson blocks");
  lesson = normalized;
  if ((await activeStorage()) === "mongo") {
    const database = await mongoDb();
    await database.collection<Lesson>("lessons").insertOne({ ...lesson });
    return lesson;
  }
  return withFile((db) => {
    db.lessons.push(lesson);
    return lesson;
  });
}

export async function saveLesson(
  id: string,
  userId: string,
  patch: {
    blocks?: Block[];
    sectionId?: string;
    sections?: Lesson["sections"];
    stage?: Lesson["stage"];
    activity?: string;
    minutes?: number;
    title?: string;
    summary?: string;
    tags?: string[];
    visibility?: "private" | "public";
  },
): Promise<Lesson | null> {
  const apply = (lesson: Lesson): Lesson | null => {
    if (lesson.ownerId !== userId) return null;
    const normalized = normalizeLesson(lesson);
    lesson.sections = normalized.sections;
    lesson.blocks = normalized.blocks;
    lesson.stage = normalized.stage;
    lesson.activity = normalized.activity;
    if (patch.sections) {
      if (!patch.sections.every((section) => section.blocks.every(isBlock))) throw new Error("Invalid blocks");
      lesson.sections = patch.sections;
      lesson.blocks = flattenSections(patch.sections);
    } else if (patch.blocks) {
      if (!patch.blocks.every(isBlock)) throw new Error("Invalid blocks");
      const sectionId = patch.sectionId;
      if (sectionId) {
        const index = lesson.sections.findIndex((section) => section.id === sectionId);
        if (index < 0) return null;
        lesson.sections[index] = { ...lesson.sections[index], blocks: patch.blocks };
      } else if (lesson.sections.length === 1) {
        lesson.sections[0] = { ...lesson.sections[0], blocks: patch.blocks };
      }
      lesson.blocks = flattenSections(lesson.sections);
    }
    if (patch.minutes === 5 || patch.minutes === 10 || patch.minutes === 20 || (typeof patch.minutes === "number" && patch.minutes >= 5 && patch.minutes <= 30)) {
      lesson.minutes = Math.round(patch.minutes);
    }
    if (patch.stage === "drafting" || patch.stage === "ready") lesson.stage = patch.stage;
    if (typeof patch.activity === "string") lesson.activity = patch.activity.slice(0, 180);
    if (typeof patch.title === "string" && patch.title.trim()) lesson.title = patch.title.trim().slice(0, 140);
    if (typeof patch.summary === "string" && patch.summary.trim()) lesson.summary = patch.summary.trim().slice(0, 280);
    if (Array.isArray(patch.tags)) {
      lesson.tags = patch.tags.map((tag) => tag.trim().slice(0, 32)).filter(Boolean).slice(0, 6);
    }
    if (patch.visibility === "private" || patch.visibility === "public") lesson.visibility = patch.visibility;
    lesson.updatedAt = new Date().toISOString();
    return lesson;
  };

  if ((await activeStorage()) === "mongo") {
    const database = await mongoDb();
    const lessons = database.collection<Lesson>("lessons");
    const existing = await lessons.findOne({ id });
    if (!existing) return null;
    const next = apply(existing);
    if (!next) return null;
    await lessons.replaceOne({ id }, next);
    return cleanLesson(next);
  }

  return withFile((db) => {
    const lesson = db.lessons.find((item) => item.id === id);
    if (!lesson) return null;
    return apply(lesson) ? structuredClone(lesson) : null;
  });
}

export async function deleteLesson(id: string, userId: string): Promise<boolean> {
  if ((await activeStorage()) === "mongo") {
    const database = await mongoDb();
    const result = await database.collection<Lesson>("lessons").deleteOne({ id, ownerId: userId });
    await database.collection<ChatMessage>("messages").deleteMany({ lessonId: id });
    return result.deletedCount === 1;
  }
  return withFile((db) => {
    const lesson = db.lessons.find((item) => item.id === id);
    if (!lesson || lesson.ownerId !== userId) return false;
    db.lessons = db.lessons.filter((item) => item.id !== id);
    db.messages = db.messages.filter((message) => message.lessonId !== id);
    return true;
  });
}

export async function remixLesson(id: string, userId: string, userName: string): Promise<Lesson | null> {
  const source = await getLesson(id);
  if (!source || !canRead(source, userId)) return null;
  const timestamp = new Date().toISOString();
  const copy: Lesson = {
    ...structuredClone(source),
    id: crypto.randomUUID(),
    ownerId: userId,
    ownerName: userName,
    title: `${source.title} remix`,
    visibility: "private",
    blocks: [],
    sections: source.sections.map((section) => ({ ...section, id: newId(), blocks: reassignIds(section.blocks) })),
    stage: "ready",
    activity: "",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return createLesson(copy);
}

export async function setBlockComplete(userId: string, lessonId: string, blockId: string, completed: boolean): Promise<string[]> {
  const update = (row: Progress) => {
    const ids = new Set(row.completedBlockIds);
    if (completed) ids.add(blockId);
    else ids.delete(blockId);
    row.completedBlockIds = [...ids];
    row.updatedAt = new Date().toISOString();
    return row.completedBlockIds;
  };

  if ((await activeStorage()) === "mongo") {
    const database = await mongoDb();
    const progress = database.collection<Progress>("progress");
    const existing = await progress.findOne({ userId, lessonId });
    const row: Progress = existing ?? { userId, lessonId, completedBlockIds: [], updatedAt: new Date().toISOString() };
    const completedBlockIds = update(row);
    await progress.replaceOne({ userId, lessonId }, row, { upsert: true });
    return completedBlockIds;
  }

  return withFile((db) => {
    let row = db.progress.find((item) => item.userId === userId && item.lessonId === lessonId);
    if (!row) {
      row = { userId, lessonId, completedBlockIds: [], updatedAt: new Date().toISOString() };
      db.progress.push(row);
    }
    return update(row);
  });
}

export function lessonReadable(lesson: Lesson, userId: string | null): boolean {
  return canRead(lesson, userId);
}

function cleanAccount(account: Account): Account {
  const copy = { ...account } as Account & { _id?: unknown };
  delete copy._id;
  return copy;
}

let userIndexesReady = false;

async function usersCollection() {
  const database = await mongoDb();
  const users = database.collection<Account>("users");
  if (!userIndexesReady) {
    await users.createIndex({ email: 1 }, { unique: true });
    userIndexesReady = true;
  }
  return users;
}

export async function findAccountByEmail(email: string): Promise<Account | null> {
  const normalized = email.trim().toLowerCase();
  if ((await activeStorage()) === "mongo") {
    const account = await (await usersCollection()).findOne({ email: normalized });
    return account ? cleanAccount(account) : null;
  }
  return withFile((db) => structuredClone(db.users.find((account) => account.email === normalized) ?? null));
}

export async function findAccountByGoogleSub(googleSub: string): Promise<Account | null> {
  if ((await activeStorage()) === "mongo") {
    const account = await (await usersCollection()).findOne({ googleSub });
    return account ? cleanAccount(account) : null;
  }
  return withFile((db) => structuredClone(db.users.find((account) => account.googleSub === googleSub) ?? null));
}

export async function createAccount(input: {
  email: string;
  name: string;
  passwordHash: string | null;
  googleSub: string | null;
}): Promise<Account> {
  const account: Account = {
    id: crypto.randomUUID(),
    email: input.email.trim().toLowerCase(),
    name: input.name,
    passwordHash: input.passwordHash,
    googleSub: input.googleSub,
    createdAt: new Date().toISOString(),
  };
  if ((await activeStorage()) === "mongo") {
    await (await usersCollection()).insertOne({ ...account });
    return account;
  }
  return withFile((db) => {
    db.users.push(account);
    return account;
  });
}

export async function attachGoogleSub(id: string, googleSub: string): Promise<void> {
  if ((await activeStorage()) === "mongo") {
    await (await usersCollection()).updateOne({ id }, { $set: { googleSub } });
    return;
  }
  await withFile((db) => {
    const account = db.users.find((item) => item.id === id);
    if (account) account.googleSub = googleSub;
  });
}
