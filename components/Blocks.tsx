"use client";

import katex from "katex";
import { useEffect, useRef, useState } from "react";
import { CODE_FRAME } from "./code-frame";
import { useMarkVisible } from "./useMarkVisible";
import type {
  Block,
  CodeBlock,
  EquationBlock,
  FlashcardsBlock,
  GraphBlock,
  ProseBlock,
  QuizBlock,
  ShortAnswerBlock,
  SimulationBlock,
} from "@/lib/types";

type BlockProps = {
  block: Block;
  index: number;
  selected: boolean;
  canEdit: boolean;
  onSelect: () => void;
  onComplete: () => void;
  onChange: (block: Block) => void;
  onRemove: () => void;
};

const LABELS: Record<Block["type"], string> = {
  prose: "Explanation",
  equation: "Equation",
  graph: "Graph",
  quiz: "Check",
  short_answer: "Short answer",
  flashcards: "Cards",
  code: "Code",
  simulation: "Simulation",
};

export function BlockView(props: BlockProps) {
  const { block } = props;
  return (
    <article
      data-block-id={block.id}
      onClick={props.onSelect}
      className={`scroll-mt-24 border-b border-line py-8 ${props.selected ? "bg-accent-soft/40" : ""}`}
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="text-xs tracking-wide text-muted uppercase">
          {String(props.index + 1).padStart(2, "0")} {LABELS[block.type]}
        </p>
        {props.canEdit ? (
          <button type="button" onClick={props.onRemove} className="text-xs text-muted hover:text-danger">
            Remove
          </button>
        ) : null}
      </div>
      {block.type === "prose" ? <ProseView {...props} block={block} /> : null}
      {block.type === "equation" ? <EquationView {...props} block={block} /> : null}
      {block.type === "graph" ? <GraphView {...props} block={block} /> : null}
      {block.type === "quiz" ? <QuizView {...props} block={block} /> : null}
      {block.type === "short_answer" ? <ShortAnswerView {...props} block={block} /> : null}
      {block.type === "flashcards" ? <FlashcardsView {...props} block={block} /> : null}
      {block.type === "code" ? <CodeView {...props} block={block} /> : null}
      {block.type === "simulation" ? <SimulationView {...props} block={block} /> : null}
    </article>
  );
}

function ProseView({ block, canEdit, onChange, onComplete }: BlockProps & { block: ProseBlock }) {
  const ref = useMarkVisible(onComplete, true);
  return (
    <div ref={ref}>
      {canEdit ? (
        <input
          value={block.heading}
          onChange={(event) => onChange({ ...block, heading: event.target.value })}
          className="mb-3 w-full bg-transparent font-display text-3xl text-foreground outline-none"
        />
      ) : (
        <h2 className="mb-3 font-display text-3xl">{block.heading}</h2>
      )}
      {canEdit ? (
        <textarea
          value={block.body}
          onChange={(event) => onChange({ ...block, body: event.target.value })}
          rows={Math.max(4, block.body.split("\n").length + 1)}
          className="w-full resize-y bg-transparent text-lg leading-8 outline-none"
        />
      ) : (
        <div className="space-y-4 text-lg leading-8">
          {block.body.split(/\n\n+/).map((paragraph, index) => (
            <p key={`${block.id}-${index}`}>{paragraph}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function EquationView({ block, onComplete }: BlockProps & { block: EquationBlock }) {
  const ref = useMarkVisible(onComplete, true);
  const html = katex.renderToString(block.latex, { throwOnError: false, displayMode: true });
  return (
    <div ref={ref}>
      <div className="overflow-x-auto py-2" dangerouslySetInnerHTML={{ __html: html }} />
      {block.caption ? <p className="mt-3 text-muted">{block.caption}</p> : null}
    </div>
  );
}

function GraphView({ block, canEdit, onChange, onComplete }: BlockProps & { block: GraphBlock }) {
  const ref = useMarkVisible(onComplete, true);
  const plotRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancel = false;
    const target = plotRef.current;
    if (!target) return;
    (async () => {
      const functionPlot = (await import("function-plot")).default;
      if (cancel || !plotRef.current) return;
      plotRef.current.innerHTML = "";
      try {
        functionPlot({
          target: plotRef.current,
          width: Math.max(plotRef.current.clientWidth, 320),
          height: 280,
          xAxis: { domain: [block.xMin, block.xMax] },
          yAxis: { domain: [block.yMin, block.yMax] },
          grid: true,
          disableZoom: true,
          data: [{ fn: block.expression, color: "#0f6b62" }],
        });
        setError("");
      } catch {
        if (!cancel) setError("This expression could not be plotted.");
      }
    })();
    return () => {
      cancel = true;
      if (target) target.innerHTML = "";
    };
  }, [block.expression, block.xMin, block.xMax, block.yMin, block.yMax]);

  return (
    <div ref={ref}>
      <h2 className="mb-3 font-display text-3xl">{block.title}</h2>
      {canEdit ? (
        <input
          value={block.expression}
          aria-label="Graph expression"
          onChange={(event) => onChange({ ...block, expression: event.target.value })}
          className="mb-3 w-full border-b border-line bg-transparent font-mono text-sm outline-none focus:border-accent"
        />
      ) : (
        <p className="mb-3 font-mono text-sm text-muted">{block.expression}</p>
      )}
      <div ref={plotRef} className="overflow-hidden rounded-md border border-line bg-paper" />
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}

function QuizView({ block, onComplete }: BlockProps & { block: QuizBlock }) {
  const [choice, setChoice] = useState<number | null>(null);
  const answered = choice !== null;
  return (
    <div>
      <h2 className="mb-4 font-display text-3xl">{block.prompt}</h2>
      <div className="grid gap-2">
        {block.choices.map((option, index) => {
          const correct = index === block.answerIndex;
          const picked = index === choice;
          return (
            <button
              key={`${block.id}-${index}`}
              type="button"
              disabled={answered}
              onClick={() => {
                setChoice(index);
                if (correct) onComplete();
              }}
              className={`rounded-md border px-4 py-3 text-left ${
                answered && correct
                  ? "border-accent bg-accent-soft"
                  : picked
                    ? "border-danger"
                    : "border-line hover:border-foreground"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
      {answered ? <p className="mt-4 text-muted">{block.explanation}</p> : null}
    </div>
  );
}

function ShortAnswerView({ block, onComplete }: BlockProps & { block: ShortAnswerBlock }) {
  const [value, setValue] = useState("");
  const [result, setResult] = useState<"idle" | "correct" | "wrong">("idle");
  const accepted = block.accepted.map((answer) => answer.toLowerCase().replace(/\s+/g, ""));

  function check() {
    const guess = value.toLowerCase().replace(/\s+/g, "");
    const correct = accepted.some((answer) => answer === guess);
    setResult(correct ? "correct" : "wrong");
    if (correct) onComplete();
  }

  return (
    <div>
      <h2 className="mb-4 font-display text-3xl">{block.prompt}</h2>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          check();
        }}
      >
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="flex-1 border-b border-line bg-transparent py-2 outline-none focus:border-accent"
        />
        <button type="submit" className="rounded-full bg-foreground px-4 py-2 text-sm text-paper">
          Check
        </button>
      </form>
      {result === "correct" ? <p className="mt-4 text-accent">{block.explanation}</p> : null}
      {result === "wrong" ? <p className="mt-4 text-danger">Not quite. Check the wording and try again.</p> : null}
    </div>
  );
}

function FlashcardsView({ block, onComplete }: BlockProps & { block: FlashcardsBlock }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = block.cards[index];
  if (!card) return null;

  function next() {
    const following = index + 1;
    if (following >= block.cards.length) {
      onComplete();
      setIndex(0);
      setFlipped(false);
      return;
    }
    setIndex(following);
    setFlipped(false);
  }

  return (
    <div>
      <h2 className="mb-4 font-display text-3xl">{block.title}</h2>
      <button
        type="button"
        onClick={() => setFlipped((value) => !value)}
        className="flex min-h-40 w-full items-center justify-center rounded-md border border-line bg-paper px-6 py-8 text-center text-xl"
      >
        {flipped ? card.back : card.front}
      </button>
      <div className="mt-3 flex items-center justify-between text-sm text-muted">
        <span>
          {index + 1} / {block.cards.length}
        </span>
        <button type="button" onClick={next} className="text-foreground">
          {index + 1 === block.cards.length ? "Finish deck" : "Next card"}
        </button>
      </div>
    </div>
  );
}

function CodeView({ block, canEdit, onChange, onComplete }: BlockProps & { block: CodeBlock }) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [output, setOutput] = useState("Output appears here.");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== frame.current?.contentWindow) return;
      if (!event.data || event.data.type !== "result") return;
      setOutput(String(event.data.text ?? ""));
      if (event.data.ok) onComplete();
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onComplete]);

  function run() {
    if (!ready) return;
    setOutput(block.language === "python" ? "Loading Python…" : "Running…");
    frame.current?.contentWindow?.postMessage({ type: "run", code: block.starter, language: block.language }, "*");
  }

  return (
    <div className="relative">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-3xl">{block.title}</h2>
        <span className="text-xs tracking-wide text-muted uppercase">{block.language}</span>
      </div>
      <textarea
        value={block.starter}
        readOnly={!canEdit}
        onChange={(event) => onChange({ ...block, starter: event.target.value })}
        rows={Math.max(5, block.starter.split("\n").length)}
        spellCheck={false}
        className="w-full resize-y rounded-md border border-line bg-paper p-3 font-mono text-sm outline-none"
      />
      <button type="button" onClick={run} className="mt-3 rounded-full bg-accent px-4 py-2 text-sm text-paper">
        Run
      </button>
      <iframe title="Code runner" sandbox="allow-scripts" srcDoc={CODE_FRAME} ref={frame} onLoad={() => setReady(true)} className="absolute h-0 w-0 border-0" />
      <pre aria-live="polite" className="mt-3 min-h-16 whitespace-pre-wrap rounded-md border border-line bg-paper p-3 font-mono text-sm">{output}</pre>
    </div>
  );
}

function SimulationView({ block, onComplete }: BlockProps & { block: SimulationBlock }) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [frequency, setFrequency] = useState(2);
  const [amplitude, setAmplitude] = useState(40);
  const [angle, setAngle] = useState(45);
  const [speed, setSpeed] = useState(20);
  const phase = useRef(0);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const context = element.getContext("2d");
    if (!context) return;
    let frame = 0;

    const draw = () => {
      const width = element.width;
      const height = element.height;
      context.clearRect(0, 0, width, height);
      context.fillStyle = "#faf7f2";
      context.fillRect(0, 0, width, height);
      context.strokeStyle = "#0f6b62";
      context.lineWidth = 2;
      context.beginPath();
      if (block.kind === "wave") {
        phase.current += 0.03;
        for (let x = 0; x < width; x += 1) {
          const y = height / 2 + amplitude * Math.sin((x / width) * frequency * Math.PI * 2 + phase.current);
          if (x === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
      } else {
        const gravity = 9.8;
        const radians = (angle * Math.PI) / 180;
        const vx = speed * Math.cos(radians);
        const vy = speed * Math.sin(radians);
        const total = Math.max((2 * vy) / gravity, 0.1);
        const points: { x: number; y: number }[] = [];
        let maxX = 1;
        let maxY = 1;
        for (let step = 0; step <= 80; step += 1) {
          const time = (total * step) / 80;
          const x = vx * time;
          const y = vy * time - 0.5 * gravity * time * time;
          if (y < 0 && step > 0) break;
          points.push({ x, y });
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
        points.forEach((point, index) => {
          const px = 36 + (point.x / maxX) * (width - 64);
          const py = height - 28 - (point.y / maxY) * (height - 56);
          if (index === 0) context.moveTo(px, py);
          else context.lineTo(px, py);
        });
        context.stroke();
        context.strokeStyle = "#e0d5c6";
        context.beginPath();
        context.moveTo(24, height - 28);
        context.lineTo(width - 16, height - 28);
      }
      context.stroke();
      if (block.kind === "wave") frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [amplitude, angle, block.kind, frequency, speed]);

  return (
    <div>
      <h2 className="mb-2 font-display text-3xl">{block.title}</h2>
      {block.note ? <p className="mb-4 text-muted">{block.note}</p> : null}
      <canvas ref={canvas} width={720} height={240} className="w-full rounded-md border border-line" />
      {block.kind === "wave" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-muted">
            Frequency {frequency}
            <input type="range" min={1} max={8} value={frequency} onChange={(event) => { setFrequency(Number(event.target.value)); onComplete(); }} className="w-full" />
          </label>
          <label className="text-sm text-muted">
            Amplitude {amplitude}
            <input type="range" min={10} max={80} value={amplitude} onChange={(event) => { setAmplitude(Number(event.target.value)); onComplete(); }} className="w-full" />
          </label>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-muted">
            Angle {angle}°
            <input type="range" min={10} max={80} value={angle} onChange={(event) => { setAngle(Number(event.target.value)); onComplete(); }} className="w-full" />
          </label>
          <label className="text-sm text-muted">
            Speed {speed}
            <input type="range" min={8} max={40} value={speed} onChange={(event) => { setSpeed(Number(event.target.value)); onComplete(); }} className="w-full" />
          </label>
        </div>
      )}
    </div>
  );
}
