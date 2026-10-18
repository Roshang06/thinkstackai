import { buildWidget, writeSection } from "@/lib/course";
import { generationErrorMessage } from "@/lib/gemini";
import { jsonError, readUser } from "@/lib/http";
import { eventStream } from "@/lib/sse";
import { getLesson, saveLesson } from "@/lib/store";
import type { Lesson, LessonSection, WidgetBlock } from "@/lib/types";

export const maxDuration = 60;

const CLAIM_MS = 50_000;

type Context = { params: Promise<{ id: string }> };

function pendingWidget(section: LessonSection): WidgetBlock | undefined {
  return section.blocks.find((block): block is WidgetBlock => block.type === "widget" && !block.html.trim());
}

export async function POST(request: Request, context: Context) {
  const user = await readUser(request);
  if (!user) return jsonError("Sign in to create a lesson.", 401);
  const { id } = await context.params;
  const lesson = await getLesson(id);
  if (!lesson || lesson.ownerId !== user.id) return jsonError("Lesson not found", 404);

  return eventStream(async (send) => {
    if (lesson.stage !== "drafting") {
      send("lesson", lesson);
      send("done", { stage: "ready", retry: false });
      return;
    }
    const age = Date.now() - Date.parse(lesson.updatedAt);
    if (lesson.activity.startsWith("Working:") && age < CLAIM_MS) {
      send("status", { activity: lesson.activity.replace(/^Working:\s*/, "") });
      send("lesson", lesson);
      send("done", { stage: "drafting", retry: true });
      return;
    }

    const sectionIndex = lesson.sections.findIndex((section) => section.blocks.length === 0 || pendingWidget(section));
    if (sectionIndex < 0) {
      const saved = await saveLesson(id, user.id, { stage: "ready", activity: "" });
      send("lesson", saved);
      send("done", { stage: "ready", retry: false });
      return;
    }

    const section = lesson.sections[sectionIndex];
    const widget = pendingWidget(section);
    const coach = /^(?:Paused|Note):\s*([\s\S]*)$/.exec(lesson.activity)?.[1]?.trim() ?? "";
    const activity = widget
      ? `Building an interaction for ${section.title}`
      : `Writing section ${sectionIndex + 1} of ${lesson.sections.length}: ${section.title}`;
    const claimed = await saveLesson(id, user.id, { activity: `Working: ${activity}` });
    const claimStamp = claimed?.updatedAt;
    send("status", { activity });

    try {
      const sections = lesson.sections.map((item) => ({ ...item, blocks: [...item.blocks] }));
      if (widget) {
        const built = await buildWidget({ topic: lesson.topic, level: lesson.level, title: section.title, brief: widget.brief });
        sections[sectionIndex].blocks = section.blocks.map((block) => (block.id === widget.id ? { ...built, id: widget.id } : block));
      } else {
        const blocks = await writeSection({
          topic: lesson.topic,
          level: lesson.level,
          minutes: lesson.minutes,
          section,
          earlierTitles: lesson.sections.slice(0, sectionIndex).map((item) => item.title),
          note: coach,
        });
        sections[sectionIndex] = { ...section, blocks };
      }
      const latest = await getLesson(id);
      if (!latest || latest.updatedAt !== claimStamp) {
        send("lesson", latest ?? lesson);
        send("done", { stage: latest?.stage ?? "drafting", retry: false, paused: true });
        return;
      }
      const finished = sectionIndex === lesson.sections.length - 1 && !sections.some((item) => item.blocks.length === 0 || pendingWidget(item));
      const saved = await saveLesson(id, user.id, {
        sections,
        activity: "",
        stage: finished ? "ready" : "drafting",
      });
      send("lesson", saved);
      send("done", { stage: saved?.stage ?? "drafting", retry: false });
    } catch (error) {
      const latest = await getLesson(id);
      if (latest?.updatedAt === claimStamp) await saveLesson(id, user.id, { activity: "" });
      send("error", { error: generationErrorMessage(error, "This section failed. Try again.") });
      send("done", { stage: "drafting", retry: false });
    }
  });
}
