import Link from "next/link";

const instructors = [
  {
    title: "A lesson plan you can actually teach",
    body: "Describe the topic, the level, and how long you have. Thinkstack writes a sequence of sections with explanations, worked examples, and a check at the end of each one. You can add notes the planner has to follow, such as what the class already knows.",
  },
  {
    title: "A course with a roster",
    body: "Publish a course and it shows up in Explore. Students request a seat. You approve who joins, see who is waiting, and add or remove lessons without rebuilding the course. A student’s own course can be opened by anyone, but only an instructor course takes a class.",
  },
  {
    title: "A tutor that edits the page",
    body: "The side panel talks back in sentences and can change the document. Ask it to add a subsection after a highlighted paragraph, or ask where something went. If a step is taking too long, pause it or skip the interaction and leave a note for when it resumes.",
  },
];

const students = [
  {
    title: "Read it, then try it",
    body: "A lesson is a page, not a video. Each section is long enough to teach the idea, with headings only when the topic actually changes. Equations sit in the sentence when they are short, and a hard formula gets its own line.",
  },
  {
    title: "The answer stays hidden",
    body: "A wrong choice turns red and you can keep going. The explanation appears only after the right one. That is the point of a check: you find out by doing it, not by peeking.",
  },
  {
    title: "Start from something already written",
    body: "Explore is full of public lessons and courses from other instructors and students. Open one, remix it into your own copy, or request a seat in an instructor’s course. Your saved work lives on Your lessons.",
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
        <p className="mt-6 max-w-3xl text-xl leading-8 text-muted">
          Design lesson plans, manage students, and grade student work all in one place. Students get the same lessons as something they can read, try, and ask about.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/signup" className="rounded-full bg-accent px-8 py-3 text-lg text-paper shadow-md">
            Create an account
          </Link>
          <Link href="/explore" className="rounded-full border border-line bg-paper px-8 py-3 text-lg">
            Explore lessons
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-8">
        <div className="rounded-3xl border border-line bg-paper p-8 shadow-sm sm:p-12">
          <p className="text-sm uppercase tracking-[0.16em] text-accent">For instructors</p>
          <h2 className="mt-3 max-w-3xl font-display text-4xl tracking-tight sm:text-5xl">Plan the class, then see who is in it.</h2>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-muted">
            Thinkstack is built for a department that wants one place to write lessons and run a course. You stay in charge of who joins and what they study.
          </p>
          <div className="mt-8 grid gap-8">
            {instructors.map((item) => (
              <article key={item.title} className="border-t border-line pt-6">
                <h3 className="font-display text-2xl">{item.title}</h3>
                <p className="mt-2 max-w-3xl leading-7 text-muted">{item.body}</p>
              </article>
            ))}
          </div>
          <Link href="/create" className="mt-8 inline-block rounded-full bg-foreground px-6 py-3 text-paper">
            Create a lesson
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-8">
        <div className="rounded-3xl border border-line bg-paper p-8 shadow-sm sm:p-12">
          <p className="text-sm uppercase tracking-[0.16em] text-accent">For students</p>
          <h2 className="mt-3 max-w-3xl font-display text-4xl tracking-tight sm:text-5xl">A better class period, and a better night of studying.</h2>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-muted">
            The same lesson your instructor publishes is the one you work through. It should feel like practice, not a recording.
          </p>
          <div className="mt-8 grid gap-8">
            {students.map((item) => (
              <article key={item.title} className="border-t border-line pt-6">
                <h3 className="font-display text-2xl">{item.title}</h3>
                <p className="mt-2 max-w-3xl leading-7 text-muted">{item.body}</p>
              </article>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/explore" className="rounded-full bg-accent px-6 py-3 text-paper">
              Browse Explore
            </Link>
            <Link href="/signup" className="rounded-full border border-line px-6 py-3">
              Sign up as a student
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
