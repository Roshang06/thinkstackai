import Link from "next/link";

const features = [
  {
    title: "A lesson, not a chat",
    body: "The model writes a document you can read and edit. Replies stay short, and the changes land in the lesson.",
  },
  {
    title: "Parts you can use",
    body: "Prose, equations, graphs, quizzes, flashcards, runnable code, and small simulations sit in the same page.",
  },
  {
    title: "Edit the passage you mean",
    body: "Select a block for a small change, or ask for a broader rewrite when the whole lesson needs to change.",
  },
  {
    title: "Keep what you learn",
    body: "Mark progress as you go. Publish a lesson, browse public ones, and remix a copy into your own account.",
  },
];

export function LandingPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-16">
      <p className="text-sm uppercase tracking-[0.16em] text-accent">Thinkstack</p>
      <h1 className="mt-3 max-w-3xl font-display text-5xl tracking-tight sm:text-6xl">Study from a document you and the model write together.</h1>
      <p className="mt-5 max-w-2xl text-lg text-muted">
        Name a topic, a level, and how long you have. Thinkstack turns that into a lesson you can check, edit, and come back to.
      </p>
      <ul className="mt-12 grid gap-4 sm:grid-cols-2">
        {features.map((feature) => (
          <li key={feature.title} className="rounded-2xl border border-line bg-paper p-5">
            <h2 className="font-display text-2xl tracking-tight">{feature.title}</h2>
            <p className="mt-2 text-muted">{feature.body}</p>
          </li>
        ))}
      </ul>
      <div className="mt-12">
        <Link href="/create" className="inline-block rounded-full bg-accent px-5 py-2 text-paper">
          Create a lesson
        </Link>
      </div>
    </div>
  );
}
