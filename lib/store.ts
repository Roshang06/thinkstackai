import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { MongoClient, type Db } from "mongodb";
import { newId, reassignIds } from "./blocks";
import { flattenSections, normalizeLesson } from "./sections";
import { isBlock } from "./document";
import { seedLessons } from "./offline";
import { profileFromAccount } from "./profile";
import { toSummary } from "./summary";
import type { Account, Block, ChatMessage, Course, Enrollment, Lesson, LessonSummary, Profile, Progress, Role } from "./types";

type DatabaseShape = {
  lessons: Lesson[];
  progress: Progress[];
  messages: ChatMessage[];
  users: Account[];
  courses: Course[];
  enrollments: Enrollment[];
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
  return { lessons: seedLessons(), progress: [], messages: [], users: [], courses: [], enrollments: [] };
}

async function readDb(): Promise<DatabaseShape> {
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as DatabaseShape;
    if (!Array.isArray(parsed.lessons)) return emptyDb();
    if (!Array.isArray(parsed.users)) parsed.users = [];
    if (!Array.isArray(parsed.courses)) parsed.courses = [];
    if (!Array.isArray(parsed.enrollments)) parsed.enrollments = [];
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
  const profile = profileFromAccount(copy);
  return { ...copy, ...profile, passwordHash: copy.passwordHash ?? null, googleSub: copy.googleSub ?? null, createdAt: copy.createdAt };
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
  return withFile((db) => {
    const account = db.users.find((item) => item.email === normalized);
    return account ? cleanAccount(account) : null;
  });
}

export async function findAccountByGoogleSub(googleSub: string): Promise<Account | null> {
  if ((await activeStorage()) === "mongo") {
    const account = await (await usersCollection()).findOne({ googleSub });
    return account ? cleanAccount(account) : null;
  }
  return withFile((db) => {
    const account = db.users.find((item) => item.googleSub === googleSub);
    return account ? cleanAccount(account) : null;
  });
}

export async function findAccountById(id: string): Promise<Account | null> {
  if ((await activeStorage()) === "mongo") {
    const account = await (await usersCollection()).findOne({ id });
    return account ? cleanAccount(account) : null;
  }
  return withFile((db) => {
    const account = db.users.find((item) => item.id === id);
    return account ? cleanAccount(account) : null;
  });
}

export async function createAccount(input: {
  email: string;
  name: string;
  passwordHash: string | null;
  googleSub: string | null;
  role: Role;
  institution: string;
  interests: string[];
  birthday: string;
}): Promise<Account> {
  const account: Account = {
    id: crypto.randomUUID(),
    email: input.email.trim().toLowerCase(),
    name: input.name,
    passwordHash: input.passwordHash,
    googleSub: input.googleSub,
    role: input.role,
    institution: input.institution,
    interests: input.interests,
    birthday: input.birthday,
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

export async function updateProfile(
  id: string,
  patch: Pick<Profile, "name" | "role" | "institution" | "interests" | "birthday">,
): Promise<Account | null> {
  const apply = (account: Account) => {
    account.name = patch.name;
    account.role = patch.role;
    account.institution = patch.institution;
    account.interests = patch.interests;
    account.birthday = patch.birthday;
    return account;
  };
  if ((await activeStorage()) === "mongo") {
    const users = await usersCollection();
    const existing = await users.findOne({ id });
    if (!existing) return null;
    const next = apply(cleanAccount(existing));
    await users.replaceOne({ id }, next);
    const database = await mongoDb();
    await database.collection<Lesson>("lessons").updateMany({ ownerId: id }, { $set: { institution: patch.institution, ownerName: patch.name } });
    await database.collection<Course>("courses").updateMany({ ownerId: id }, { $set: { institution: patch.institution, ownerName: patch.name, joinable: patch.role === "instructor" } });
    return next;
  }
  return withFile((db) => {
    const account = db.users.find((item) => item.id === id);
    if (!account) return null;
    apply(account);
    for (const lesson of db.lessons) {
      if (lesson.ownerId === id) {
        lesson.ownerName = patch.name;
        lesson.institution = patch.institution;
      }
    }
    for (const course of db.courses) {
      if (course.ownerId === id) {
        course.ownerName = patch.name;
        course.institution = patch.institution;
        course.joinable = patch.role === "instructor";
      }
    }
    return structuredClone(account);
  });
}

function cleanCourse(course: Course): Course {
  const copy = { ...course } as Course & { _id?: unknown };
  delete copy._id;
  return {
    ...copy,
    topics: Array.isArray(copy.topics) ? copy.topics : [],
    lessonIds: Array.isArray(copy.lessonIds) ? copy.lessonIds : [],
    joinable: copy.joinable === true,
    visibility: copy.visibility === "private" ? "private" : "public",
  };
}

export async function createCourse(input: {
  ownerId: string;
  ownerName: string;
  institution: string;
  joinable: boolean;
  title: string;
  summary: string;
  topics: string[];
}): Promise<Course> {
  const timestamp = new Date().toISOString();
  const course: Course = {
    id: crypto.randomUUID(),
    ownerId: input.ownerId,
    ownerName: input.ownerName,
    institution: input.institution,
    title: input.title,
    summary: input.summary,
    topics: input.topics,
    visibility: "public",
    joinable: input.joinable,
    lessonIds: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  if ((await activeStorage()) === "mongo") {
    await (await mongoDb()).collection<Course>("courses").insertOne({ ...course });
    return course;
  }
  return withFile((db) => {
    db.courses.push(course);
    return course;
  });
}

export async function listOwnerCourses(ownerId: string): Promise<Course[]> {
  if ((await activeStorage()) === "mongo") {
    const courses = await (await mongoDb()).collection<Course>("courses").find({ ownerId }).sort({ updatedAt: -1 }).toArray();
    return courses.map(cleanCourse);
  }
  return withFile((db) => db.courses.filter((course) => course.ownerId === ownerId).map(cleanCourse));
}

export async function searchCourses(query: string, filters: { instructor?: string; institution?: string } = {}): Promise<Course[]> {
  const needle = query.trim().toLowerCase();
  const instructor = filters.instructor?.trim().toLowerCase() ?? "";
  const institution = filters.institution?.trim().toLowerCase() ?? "";
  const matches = (course: Course) => {
    if (course.visibility !== "public") return false;
    if (instructor && !course.ownerName.toLowerCase().includes(instructor)) return false;
    if (institution && !course.institution.toLowerCase().includes(institution)) return false;
    if (!needle) return true;
    return [course.title, course.summary, course.ownerName, course.institution, ...course.topics].join(" ").toLowerCase().includes(needle);
  };
  if ((await activeStorage()) === "mongo") {
    const courses = await (await mongoDb()).collection<Course>("courses").find({ visibility: "public" }).sort({ updatedAt: -1 }).limit(40).toArray();
    return courses.filter(matches).map(cleanCourse);
  }
  return withFile((db) => db.courses.filter(matches).slice(0, 40).map(cleanCourse));
}

export async function getCourse(id: string): Promise<Course | null> {
  if ((await activeStorage()) === "mongo") {
    const course = await (await mongoDb()).collection<Course>("courses").findOne({ id });
    return course ? cleanCourse(course) : null;
  }
  return withFile((db) => {
    const course = db.courses.find((item) => item.id === id);
    return course ? cleanCourse(course) : null;
  });
}

export async function getLessonsByIds(ids: string[]): Promise<Lesson[]> {
  if (ids.length === 0) return [];
  if ((await activeStorage()) === "mongo") {
    const lessons = await (await mongoDb()).collection<Lesson>("lessons").find({ id: { $in: ids } }).toArray();
    const byId = new Map(lessons.map((lesson) => [lesson.id, cleanLesson(lesson)]));
    return ids.flatMap((id) => {
      const lesson = byId.get(id);
      return lesson ? [lesson] : [];
    });
  }
  return withFile((db) => ids.flatMap((id) => {
    const lesson = db.lessons.find((item) => item.id === id);
    return lesson ? [cleanLesson(lesson)] : [];
  }));
}

export async function updateCourse(
  id: string,
  ownerId: string,
  patch: { title?: string; summary?: string; topics?: string[]; addLessonId?: string; removeLessonId?: string },
): Promise<Course | null> {
  const apply = (course: Course) => {
    if (course.ownerId !== ownerId) return null;
    if (patch.title) course.title = patch.title;
    if (typeof patch.summary === "string") course.summary = patch.summary;
    if (patch.topics) course.topics = patch.topics;
    if (patch.addLessonId && !course.lessonIds.includes(patch.addLessonId)) course.lessonIds.push(patch.addLessonId);
    if (patch.removeLessonId) course.lessonIds = course.lessonIds.filter((lessonId) => lessonId !== patch.removeLessonId);
    course.updatedAt = new Date().toISOString();
    return course;
  };
  if ((await activeStorage()) === "mongo") {
    const courses = (await mongoDb()).collection<Course>("courses");
    const existing = await courses.findOne({ id });
    if (!existing) return null;
    const next = apply(cleanCourse(existing));
    if (!next) return null;
    await courses.replaceOne({ id }, next);
    return next;
  }
  return withFile((db) => {
    const course = db.courses.find((item) => item.id === id);
    if (!course) return null;
    return apply(course) ? cleanCourse(course) : null;
  });
}

export async function enrollmentFor(courseId: string, userId: string): Promise<Enrollment | null> {
  if ((await activeStorage()) === "mongo") {
    const row = await (await mongoDb()).collection<Enrollment>("enrollments").findOne({ courseId, userId });
    if (!row) return null;
    const copy = { ...row } as Enrollment & { _id?: unknown };
    delete copy._id;
    return copy;
  }
  return withFile((db) => db.enrollments.find((row) => row.courseId === courseId && row.userId === userId) ?? null);
}

export async function requestJoin(course: Course, user: { id: string; name: string }): Promise<Enrollment | null> {
  if (!course.joinable || course.ownerId === user.id) return null;
  const existing = await enrollmentFor(course.id, user.id);
  if (existing) return existing;
  const row: Enrollment = { courseId: course.id, userId: user.id, userName: user.name, status: "requested", createdAt: new Date().toISOString() };
  if ((await activeStorage()) === "mongo") {
    await (await mongoDb()).collection<Enrollment>("enrollments").insertOne({ ...row });
    return row;
  }
  return withFile((db) => {
    db.enrollments.push(row);
    return row;
  });
}

export async function listEnrollments(courseId: string): Promise<Enrollment[]> {
  if ((await activeStorage()) === "mongo") {
    const rows = await (await mongoDb()).collection<Enrollment>("enrollments").find({ courseId }).toArray();
    return rows.map((row) => {
      const copy = { ...row } as Enrollment & { _id?: unknown };
      delete copy._id;
      return copy;
    });
  }
  return withFile((db) => db.enrollments.filter((row) => row.courseId === courseId));
}

export async function setEnrollment(courseId: string, ownerId: string, userId: string, action: "member" | "remove"): Promise<boolean> {
  const course = await getCourse(courseId);
  if (!course || course.ownerId !== ownerId) return false;
  if ((await activeStorage()) === "mongo") {
    const rows = (await mongoDb()).collection<Enrollment>("enrollments");
    if (action === "remove") {
      await rows.deleteOne({ courseId, userId });
      return true;
    }
    await rows.updateOne({ courseId, userId }, { $set: { status: "member" } });
    return true;
  }
  return withFile((db) => {
    if (action === "remove") {
      db.enrollments = db.enrollments.filter((row) => !(row.courseId === courseId && row.userId === userId));
      return true;
    }
    const row = db.enrollments.find((item) => item.courseId === courseId && item.userId === userId);
    if (row) row.status = "member";
    return true;
  });
}

export async function lessonSharedThroughCourse(lessonId: string, userId: string | null): Promise<boolean> {
  const courses = (await activeStorage()) === "mongo"
    ? (await (await mongoDb()).collection<Course>("courses").find({ lessonIds: lessonId }).toArray()).map(cleanCourse)
    : await withFile((db) => db.courses.filter((course) => course.lessonIds.includes(lessonId)).map(cleanCourse));
  for (const course of courses) {
    if (course.visibility === "public") return true;
    if (userId && (await enrollmentFor(course.id, userId))?.status === "member") return true;
  }
  return false;
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
