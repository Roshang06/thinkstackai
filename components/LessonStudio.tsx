"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { BlockView } from "./Blocks";
import { ProgressBar } from "./ProgressBar";
import { useUser, userHeaders } from "./user";
import type { Block, ChatMessage, Lesson } from "@/lib/types";

export function LessonStudio() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useUser();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [completed, setCompleted] = useState<string[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [selection, setSelection] = useState("");
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const saveTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!user || !params.id) return;
    const response = await fetch(`/api/lessons/${params.id}`, { headers: userHeaders(user) });
    if (!response.ok) {
      setError("This lesson is not available.");
      return;
    }
    const body = (await response.json()) as {
      lesson: Lesson;
      messages: ChatMessage[];
      completedBlockIds: string[];
      canEdit: boolean;
    };
    setLesson(body.lesson);
    setMessages(body.messages);
    setCompleted(body.completedBlockIds);
    setCanEdit(body.canEdit);
    setTarget((current) => current ?? body.lesson.blocks[0]?.id ?? null);
    setError("");
  }, [params.id, user]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function queueSave(lessonId: string, blocks: Block[]) {
    if (!user) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    const headers = userHeaders(user);
    saveTimer.current = window.setTimeout(() => {
      void fetch(`/api/lessons/${lessonId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ blocks }),
      });
    }, 400);
  }

  function updateBlock(next: Block) {
    if (!lesson) return;
    const blocks = lesson.blocks.map((block) => (block.id === next.id ? next : block));
    setLesson({ ...lesson, blocks });
    queueSave(lesson.id, blocks);
  }

  function removeBlock(blockId: string) {
    if (!lesson) return;
    const blocks = lesson.blocks.filter((block) => block.id !== blockId);
    setLesson({ ...lesson, blocks });
    if (target === blockId) setTarget(blocks[0]?.id ?? null);
    queueSave(lesson.id, blocks);
  }

  async function markComplete(blockId: string) {
    if (!user || !lesson || completed.includes(blockId)) return;
    setCompleted((current) => [...current, blockId]);
    await fetch(`/api/lessons/${lesson.id}/progress`, {
      method: "POST",
      headers: userHeaders(user),
      body: JSON.stringify({ blockId, completed: true }),
    });
  }

  function attachSelection() {
    const current = window.getSelection();
    if (!current || current.isCollapsed) return;
    const node = current.anchorNode;
    const element = node instanceof Element ? node : node?.parentElement;
    const blockId = element?.closest("[data-block-id]")?.getAttribute("data-block-id");
    if (!blockId) return;
    setTarget(blockId);
    setSelection(current.toString().slice(0, 500));
  }

  async function sendInstruction() {
    if (!user || !lesson || instruction.trim().length < 2) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    setBusy(true);
    setError("");
    const response = await fetch(`/api/lessons/${lesson.id}/command`, {
      method: "POST",
      headers: userHeaders(user),
      body: JSON.stringify({ instruction, blockId: target, selection }),
    });
    setBusy(false);
    if (!response.ok) {
      setError("The edit did not apply.");
      return;
    }
    const body = (await response.json()) as { lesson: Lesson; message: ChatMessage };
    setLesson(body.lesson);
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), lessonId: lesson.id, role: "user", text: instruction, createdAt: new Date().toISOString() },
      body.message,
    ]);
    setInstruction("");
    setSelection("");
  }

  async function setVisibility(visibility: "public" | "private") {
    if (!user || !lesson) return;
    const response = await fetch(`/api/lessons/${lesson.id}`, {
      method: "PATCH",
      headers: userHeaders(user),
      body: JSON.stringify({ visibility }),
    });
    if (!response.ok) return;
    const body = (await response.json()) as { lesson: Lesson };
    setLesson(body.lesson);
  }

  async function remix() {
    if (!user || !lesson) return;
    const response = await fetch(`/api/lessons/${lesson.id}/remix`, { method: "POST", headers: userHeaders(user) });
    if (!response.ok) return;
    const body = (await response.json()) as { lesson: Lesson };
    router.push(`/lessons/${body.lesson.id}`);
  }

  async function removeLesson() {
    if (!user || !lesson) return;
    if (!window.confirm("Delete this lesson?")) return;
    await fetch(`/api/lessons/${lesson.id}`, { method: "DELETE", headers: userHeaders(user) });
    router.push("/");
  }

  if (error && !lesson) return <p className="mx-auto max-w-3xl px-5 py-16 text-muted">{error}</p>;
  if (!lesson) return <p className="mx-auto max-w-3xl px-5 py-16 text-muted">Opening lesson…</p>;

  return (
    <div className="mx-auto grid max-w-6xl items-start gap-8 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <main>
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <ProgressBar completed={completed.length} total={lesson.blocks.length} />
          <span className="text-sm text-muted">{lesson.level}</span>
          <span className="text-sm text-muted">{lesson.minutes} min</span>
          {canEdit ? (
            <button
              type="button"
              onClick={() => setVisibility(lesson.visibility === "public" ? "private" : "public")}
              className="rounded-full border border-line px-3 py-1 text-sm"
            >
              {lesson.visibility === "public" ? "Public" : "Publish"}
            </button>
          ) : (
            <button type="button" onClick={remix} className="rounded-full bg-foreground px-3 py-1 text-sm text-paper">
              Remix
            </button>
          )}
          {canEdit ? (
            <button type="button" onClick={removeLesson} className="text-sm text-muted hover:text-danger">
              Delete
            </button>
          ) : null}
        </div>
        <p className="text-sm text-muted">{lesson.summary}</p>
        <h1 className="mt-2 font-display text-5xl tracking-tight">{lesson.title}</h1>
        <div className="mt-4">
          {lesson.blocks.map((block, index) => (
            <BlockView
              key={block.id}
              block={block}
              index={index}
              selected={target === block.id}
              canEdit={canEdit}
              onSelect={() => setTarget(block.id)}
              onComplete={() => {
                void markComplete(block.id);
              }}
              onChange={updateBlock}
              onRemove={() => removeBlock(block.id)}
            />
          ))}
        </div>
      </main>
      <aside className="border border-line bg-paper p-4 lg:sticky lg:top-4">
        <h2 className="font-display text-2xl">Edits</h2>
        <p className="mt-1 text-sm text-muted">Ask for a change. The lesson updates in the document.</p>
        <ol className="mt-4 max-h-80 space-y-3 overflow-auto text-sm">
          {messages.length === 0 ? <li className="text-muted">No edits yet.</li> : null}
          {messages.map((message) => (
            <li key={message.id}>
              <span className="text-muted">{message.role === "user" ? "You" : "Thinkstack"} · </span>
              {message.text}
            </li>
          ))}
        </ol>
        {canEdit ? (
          <form
            className="mt-4 grid gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void sendInstruction();
            }}
          >
            {selection ? (
              <p className="flex items-start justify-between gap-2 border border-line px-2 py-1 text-xs text-muted">
                <span className="line-clamp-3">{selection}</span>
                <button type="button" onClick={() => setSelection("")} className="shrink-0">
                  Clear
                </button>
              </p>
            ) : null}
            <textarea
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              placeholder="Add a simulation after this part"
              rows={3}
              className="w-full resize-none border border-line bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <div className="flex gap-2">
              <button type="button" onClick={attachSelection} className="rounded-full border border-line px-3 py-2 text-sm">
                Use selection
              </button>
              <button type="submit" disabled={busy} className="rounded-full bg-accent px-3 py-2 text-sm text-paper disabled:opacity-60">
                {busy ? "Editing…" : "Apply"}
              </button>
            </div>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
          </form>
        ) : (
          <p className="mt-4 text-sm text-muted">Remix this lesson to edit your own copy.</p>
        )}
      </aside>
    </div>
  );
}
