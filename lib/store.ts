import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { MongoClient, type Db } from "mongodb";
import { reassignIds } from "./blocks";
import { isBlock } from "./document";
import { seedLessons } from "./offline";
import type { Block, ChatMessage, Lesson, LessonSummary, Progress } from "./types";

type DatabaseShape = {
  lessons: Lesson[];
  progress: Progress[];
  messages: ChatMessage[];
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
  return { lessons: seedLessons(), progress: [], messages: [] };
}

async function readDb(): Promise<DatabaseShape> {
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as DatabaseShape;
    if (!Array.isArray(parsed.lessons)) return emptyDb();
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
  return copy;
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
    title: lesson.title,
    topic: lesson.topic,
    level: lesson.level,
    minutes: lesson.minutes,
    tags: lesson.tags,
    visibility: lesson.visibility,
    summary: lesson.summary,
    blockCount: lesson.blocks.length,
    createdAt: lesson.createdAt,
    updatedAt: lesson.updatedAt,
  };
}

function canRead(lesson: Lesson, userId: string): boolean {
  return lesson.visibility === "public" || lesson.ownerId === userId;
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

export async function searchPublic(query: string): Promise<LessonSummary[]> {
  const needle = query.trim().toLowerCase();
  const matches = (lesson: Lesson) => {
    if (lesson.visibility !== "public") return false;
    if (!needle) return true;
    const haystack = [lesson.title, lesson.topic, lesson.summary, lesson.ownerName, ...lesson.tags].join(" ").toLowerCase();
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
    text: text.slice(0, 500),
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
  if (!lesson.blocks.every(isBlock)) throw new Error("Invalid lesson blocks");
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
  patch: { blocks?: Block[]; title?: string; visibility?: "private" | "public" },
): Promise<Lesson | null> {
  const apply = (lesson: Lesson): Lesson | null => {
    if (lesson.ownerId !== userId) return null;
    if (patch.blocks) {
      if (!patch.blocks.every(isBlock)) throw new Error("Invalid blocks");
      lesson.blocks = patch.blocks;
    }
    if (typeof patch.title === "string" && patch.title.trim()) lesson.title = patch.title.trim().slice(0, 140);
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
    blocks: reassignIds(source.blocks),
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

export function lessonReadable(lesson: Lesson, userId: string): boolean {
  return canRead(lesson, userId);
}
