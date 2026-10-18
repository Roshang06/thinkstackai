"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { BlockView } from "./Blocks";
import { readSse } from "./read-sse";
import { ProgressBar } from "./ProgressBar";
import { jsonHeaders, useUser } from "./user";
import type { Block, ChatMessage, Lesson, LessonStage } from "@/lib/types";

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
  const [sectionIndex, setSectionIndex] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [activity, setActivity] = useState("");
  const [retrying, setRetrying] = useState(0);
  const saveTimer = useRef<number | null>(null);
  const pumping = useRef(false);

  const load = useCallback(async () => {
    if (!params.id) return;
    const response = await fetch(`/api/lessons/${params.id}`);
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
    setTarget((current) => current ?? body.lesson.sections?.[0]?.blocks[0]?.id ?? body.lesson.blocks[0]?.id ?? null);
    setError("");
  }, [params.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!lesson || lesson.stage !== "drafting" || !canEdit || pumping.current) return;
    pumping.current = true;
    let cancelled = false;
    const lessonId = lesson.id;

    async function pump() {
      try {
        while (!cancelled) {
          const response = await fetch(`/api/lessons/${lessonId}/continue`, { method: "POST", headers: jsonHeaders() });
          if (!response.ok) {
            const body = (await response.json().catch(() => ({}))) as { error?: string };
            if (!cancelled) setError(body.error ?? "Generation stopped.");
            break;
          }
          const step: { stage: LessonStage; retry: boolean; failed: boolean } = { stage: "drafting", retry: false, failed: false };
          await readSse(response, (event, data) => {
            if (!data || typeof data !== "object") return;
            if (event === "status" && "activity" in data) setActivity(String(data.activity));
            if (event === "lesson" && "id" in data) setLesson(data as Lesson);
            if (event === "error" && "error" in data) {
              step.failed = true;
              setError(String(data.error));
            }
            if (event === "done") {
              const done = data as { stage?: LessonStage; retry?: boolean };
              step.stage = done.stage === "ready" ? "ready" : "drafting";
              step.retry = Boolean(done.retry);
            }
          });
          if (cancelled || step.failed || step.stage === "ready") {
            if (step.stage === "ready") setActivity("");
            break;
          }
          if (step.retry) await new Promise((resolve) => window.setTimeout(resolve, 1500));
        }
      } finally {
        pumping.current = false;
      }
    }

    void pump();
    return () => {
      cancelled = true;
      pumping.current = false;
    };
  }, [canEdit, lesson?.id, lesson?.stage, retrying]);

  function queueSave(lessonId: string, sectionId: string, blocks: Block[]) {
    if (!canEdit || lesson?.stage === "drafting") return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void fetch(`/api/lessons/${lessonId}`, {
        method: "PATCH",
        headers: jsonHeaders(),
        body: JSON.stringify({ sectionId, blocks }),
      });
    }, 400);
  }

  function updateBlock(next: Block) {
    if (!lesson) return;
    const section = lesson.sections[sectionIndex];
    if (!section) return;
    const blocks = section.blocks.map((block) => (block.id === next.id ? next : block));
    const sections = lesson.sections.map((item) => (item.id === section.id ? { ...item, blocks } : item));
    setLesson({ ...lesson, sections, blocks: sections.flatMap((item) => item.blocks) });
    queueSave(lesson.id, section.id, blocks);
  }

  function removeBlock(blockId: string) {
    if (!lesson) return;
    const section = lesson.sections[sectionIndex];
    if (!section) return;
    const blocks = section.blocks.filter((block) => block.id !== blockId);
    const sections = lesson.sections.map((item) => (item.id === section.id ? { ...item, blocks } : item));
    setLesson({ ...lesson, sections, blocks: sections.flatMap((item) => item.blocks) });
    if (target === blockId) setTarget(blocks[0]?.id ?? null);
    queueSave(lesson.id, section.id, blocks);
  }

  async function markComplete(blockId: string) {
    if (!lesson || completed.includes(blockId)) return;
    setCompleted((current) => [...current, blockId]);
    const response = await fetch(`/api/lessons/${lesson.id}/progress`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ blockId, completed: true }),
    });
    if (!response.ok) setCompleted((current) => current.filter((id) => id !== blockId));
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
    if (!lesson || instruction.trim().length < 2 || lesson.stage === "drafting") return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    setBusy(true);
    setError("");
    const response = await fetch(`/api/lessons/${lesson.id}/command`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        instruction,
        blockId: target,
        sectionId: lesson.sections[sectionIndex]?.id,
        selection,
      }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string; lesson?: Lesson; message?: ChatMessage };
    setBusy(false);
    if (!response.ok || !body.lesson || !body.message) {
      setError(body.error ?? "The edit did not apply.");
      return;
    }
    const message = body.message;
    const updated = body.lesson;
    setLesson(updated);
    setSectionIndex((index) => Math.min(index, Math.max(0, updated.sections.length - 1)));
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), lessonId: lesson.id, role: "user", text: instruction, createdAt: new Date().toISOString() },
      message,
    ]);
    setInstruction("");
    setSelection("");
  }

  async function setVisibility(visibility: "public" | "private") {
    if (!lesson) return;
    const response = await fetch(`/api/lessons/${lesson.id}`, {
      method: "PATCH",
      headers: jsonHeaders(),
      body: JSON.stringify({ visibility }),
    });
    if (!response.ok) return;
    const body = (await response.json()) as { lesson: Lesson };
    setLesson(body.lesson);
  }

  async function remix() {
    if (!lesson) return;
    if (!user) {
      router.push(`/login?next=/lessons/${lesson.id}`);
      return;
    }
    const response = await fetch(`/api/lessons/${lesson.id}/remix`, { method: "POST", headers: jsonHeaders() });
    if (response.status === 401) {
      router.push(`/login?next=/lessons/${lesson.id}`);
      return;
    }
    if (!response.ok) return;
    const body = (await response.json()) as { lesson: Lesson };
    router.push(`/lessons/${body.lesson.id}`);
  }

  async function removeLesson() {
    if (!lesson) return;
    if (!window.confirm("Delete this lesson?")) return;
    await fetch(`/api/lessons/${lesson.id}`, { method: "DELETE" });
    router.push("/");
  }

  if (error && !lesson) return <p className="mx-auto max-w-3xl px-5 py-16 text-muted">{error}</p>;
  if (!lesson) return <p className="mx-auto max-w-3xl px-5 py-16 text-muted">Opening lesson…</p>;

  const sections = lesson.sections?.length
    ? lesson.sections
    : [{ id: "section-1", title: lesson.title, objective: lesson.summary, interaction: "", blocks: lesson.blocks ?? [] }];
  const section = sections[sectionIndex] ?? sections[0];
  const nextSection = sections[sectionIndex + 1];
  const canContinue = Boolean(nextSection && nextSection.blocks.length > 0);
  const drafting = lesson.stage === "drafting";

  return (
    <div className="w-full">
      <div className="sticky top-0 z-10 border-b border-line bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-5 py-3">
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
            {sections.map((item, index) => {
              const ready = item.blocks.length > 0;
              const current = index === sectionIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!ready}
                  onClick={() => setSectionIndex(index)}
                  className={`shrink-0 rounded-full px-3 py-1 text-sm ${current ? "bg-foreground text-paper" : ready ? "border border-line" : "border border-dashed border-line text-muted"}`}
                >
                  {index + 1}. {item.title}
                </button>
              );
            })}
          </div>
          {canEdit ? (
            <button type="button" onClick={() => setEditorOpen((open) => !open)} className="shrink-0 rounded-full border border-line px-3 py-1 text-sm">
              {editorOpen ? "Close editor" : "Edit with AI"}
            </button>
          ) : null}
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl px-5 py-8">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <ProgressBar completed={completed.length} total={lesson.blocks.length} />
          <span className="text-sm text-muted">{lesson.level}</span>
          <span className="text-sm text-muted">{lesson.minutes} min</span>
          <span className="text-sm text-muted">
            Section {sectionIndex + 1} of {sections.length}
          </span>
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

        {drafting ? (
          <div className="mb-8 border border-line bg-paper px-4 py-3" aria-live="polite">
            <div className="flex items-center gap-3">
              <span className="relative h-2 w-24 overflow-hidden rounded-full bg-line">
                <span className="absolute inset-y-0 w-8 animate-thinkstack bg-accent" />
              </span>
              <p className="text-sm">{activity || lesson.activity.replace(/^Working:\s*/, "") || "Starting the lesson"}</p>
            </div>
          </div>
        ) : null}

        <p className="text-sm text-muted">{lesson.summary}</p>
        <h1 className="mt-2 font-display text-5xl tracking-tight">{lesson.title}</h1>
        {section ? (
          <section className="mt-8">
            {section.title === lesson.title ? null : (
              <>
                <p className="text-sm tracking-wide text-muted uppercase">Section {sectionIndex + 1}</p>
                <h2 className="mt-1 font-display text-4xl">{section.title}</h2>
              </>
            )}
            {section.blocks.length === 0 ? (
              <p className="mt-6 max-w-2xl text-lg text-muted">{section.objective || "This section is next."}</p>
            ) : (
              section.blocks.map((block, index) => (
                <BlockView
                  key={block.id}
                  block={block}
                  index={index}
                  selected={target === block.id}
                  canEdit={canEdit && !drafting}
                  onSelect={() => setTarget(block.id)}
                  onComplete={() => {
                    void markComplete(block.id);
                  }}
                  onChange={updateBlock}
                  onRemove={() => removeBlock(block.id)}
                />
              ))
            )}
            <div className="flex items-center justify-between gap-4 py-8">
              <button
                type="button"
                disabled={sectionIndex === 0}
                onClick={() => setSectionIndex((index) => Math.max(0, index - 1))}
                className="rounded-full border border-line px-4 py-2 text-sm disabled:opacity-40"
              >
                Back
              </button>
              {nextSection ? (
                <button
                  type="button"
                  disabled={!canContinue}
                  onClick={() => setSectionIndex((index) => index + 1)}
                  className="rounded-full bg-accent px-5 py-3 text-paper disabled:opacity-50"
                >
                  {canContinue ? `Continue to ${nextSection.title}` : "Writing the next section"}
                </button>
              ) : (
                <p className="text-sm text-muted">{drafting ? "Finishing the lesson" : "End of the lesson"}</p>
              )}
            </div>
          </section>
        ) : null}
        {error ? (
          <div className="mb-8 flex items-center gap-3">
            <p className="text-sm text-danger">{error}</p>
            {drafting && canEdit ? (
              <button type="button" onClick={() => { setError(""); setRetrying((count) => count + 1); }} className="rounded-full border border-line px-3 py-1 text-sm">
                Try again
              </button>
            ) : null}
          </div>
        ) : null}
      </main>

      {editorOpen && canEdit ? (
        <aside className="fixed inset-y-0 right-0 z-20 flex w-full max-w-md flex-col border-l border-line bg-paper shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <h2 className="font-display text-2xl">Tutor</h2>
              <p className="text-sm text-muted">Talk about the whole lesson. You are on {section?.title ?? "this page"}.</p>
            </div>
            <button type="button" onClick={() => setEditorOpen(false)} className="text-sm text-muted">
              Close
            </button>
          </div>
          <ol className="min-h-0 flex-1 space-y-3 overflow-auto px-4 py-4">
            {messages.length === 0 ? <li className="text-sm text-muted">Ask for a change, or ask where something went.</li> : null}
            {messages.map((message) => (
              <li key={message.id} className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-6 ${message.role === "user" ? "ml-auto bg-accent text-paper" : "bg-background"}`}>
                {message.text}
              </li>
            ))}
          </ol>
          {drafting ? (
            <p className="mt-4 text-sm text-muted">You can edit when the sections finish.</p>
          ) : (
            <form
              className="grid gap-2 border-t border-line px-4 py-3"
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
                placeholder="Add a part about the critical path after the highlighted text"
                rows={4}
                className="w-full resize-none border border-line bg-background px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <div className="flex gap-2">
                <button type="button" onClick={attachSelection} className="rounded-full border border-line px-3 py-2 text-sm">
                  Use selection
                </button>
                <button type="submit" disabled={busy} className="rounded-full bg-accent px-3 py-2 text-sm text-paper disabled:opacity-60">
                  {busy ? "Thinking…" : "Send"}
                </button>
              </div>
            </form>
          )}
        </aside>
      ) : null}
    </div>
  );
}
