import Link from "next/link";

const audiences = [
  {
    title: "For the school",
    body: "Design lesson plans, manage students, and grade student work all in one place. A course stays public so a department can find it, and an instructor decides who joins.",
  },
  {
    title: "For the classroom",
    body: "One topic becomes a sequence of sections a class can move through together. Checks stay closed until a student works out the answer.",
  },
  {
    title: "For the student",
    body: "Learning should feel like doing the thing, not watching a recording of it. Read a clear explanation, try a small problem, and ask the tutor when a step does not land.",
  },
];

export function LandingPage() {
  return (
    <div>
      <section className="mx-auto max-w-6xl px-5 pb-8 pt-16">
        <p className="text-sm uppercase tracking-[0.16em] text-accent">Thinkstack for schools</p>
        <h1 className="mt-4 max-w-5xl font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
          Study using interactive problems, structured lessons, and personalized help for any subject.
        </h1>
        <p className="mt-6 max-w-3xl text-xl text-muted">
          Design lesson plans, manage students, and grade student work all in one place.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/create" className="rounded-full bg-accent px-8 py-3 text-lg text-paper shadow-md">
            Create a lesson
          </Link>
          <Link href="/explore" className="rounded-full border border-line bg-paper px-8 py-3 text-lg">
            Explore lessons
          </Link>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-5 py-12 sm:grid-cols-3">
        {audiences.map((item) => (
          <article key={item.title} className="rounded-3xl border border-line bg-paper p-6 shadow-sm">
            <h2 className="font-display text-3xl tracking-tight">{item.title}</h2>
            <p className="mt-3 text-muted">{item.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
