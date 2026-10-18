import { jsonError, readUser } from "@/lib/http";
import { getLesson, saveLesson } from "@/lib/store";
import { sandboxDocument } from "@/lib/widget";
import type { WidgetBlock } from "@/lib/types";

type Context = { params: Promise<{ id: string }> };

function pendingWidget(blocks: { type: string; html?: string }[]): WidgetBlock | undefined {
  return blocks.find((block): block is WidgetBlock => block.type === "widget" && !block.html?.trim());
}

export async function POST(request: Request, context: Context) {
  const user = await readUser(request);
  if (!user) return jsonError("Sign in required", 401);
  const { id } = await context.params;
  const lesson = await getLesson(id);
  if (!lesson || lesson.ownerId !== user.id) return jsonError("Lesson not found", 404);
  const body = (await request.json().catch(() => null)) as { action?: string; note?: string } | null;
  const note = body?.note?.trim().slice(0, 500) ?? "";
  if (body?.action === "pause") {
    const saved = await saveLesson(id, user.id, { activity: `Paused: ${note}` });
    return Response.json({ lesson: saved, paused: true });
  }
  if (body?.action === "resume") {
    const saved = await saveLesson(id, user.id, { activity: note ? `Note: ${note}` : "" });
    return Response.json({ lesson: saved, paused: false });
  }
  if (body?.action !== "skip") return jsonError("Choose pause, resume, or skip.", 400);

  const index = lesson.sections.findIndex((section) => section.blocks.length === 0 || pendingWidget(section.blocks));
  const section = index >= 0 ? lesson.sections[index] : undefined;
  const widget = section ? pendingWidget(section.blocks) : undefined;
  if (!section || !widget) {
    const saved = await saveLesson(id, user.id, { activity: `Paused: ${note}` });
    return Response.json({ lesson: saved, skipped: "wait", paused: true });
  }
  const html = sandboxDocument(
    `<main style="padding:24px"><h1>Skipped for now</h1><p>${note || "This interaction was skipped. Ask the tutor to add it later."}</p></main>`,
  );
  const sections = lesson.sections.map((item, itemIndex) =>
    itemIndex === index
      ? {
          ...item,
          blocks: item.blocks.map((block) => (block.id === widget.id ? { ...widget, html: html ?? widget.html } : block)),
        }
      : item,
  );
  const saved = await saveLesson(id, user.id, { sections, activity: "" });
  return Response.json({ lesson: saved, skipped: "widget", paused: false });
}
