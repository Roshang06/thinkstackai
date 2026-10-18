import Link from "next/link";

const steps = [
  {
    number: "01",
    title: "Describe the lesson",
    body: "Give Thinkstack the topic, the grade or course level, and how much class time you have. Add notes the planner must respect, such as what students already know or which method you want used.",
  },
  {
    number: "02",
    title: "Review and refine",
    body: "Thinkstack drafts a sequence of sections, each with an explanation and a check for understanding. You read it like a document and change anything with the tutor panel or by editing directly.",
  },
  {
    number: "03",
    title: "Publish to your course",
    body: "Add the lesson to a course, approve the students who request a seat, and let them work through it. Every student learns from the same lesson you approved.",
  },
];

const lessonParts = [
  {
    title: "Explanations written to be read",
    body: "Each section is long enough to teach an idea properly. Headings appear only when the topic changes, short equations sit inside the sentence, and a difficult formula gets its own line.",
  },
  {
    title: "Worked examples",
    body: "The writing walks through the reasoning in the paragraph, and includes an example when that is the clearest way to show the step.",
  },
  {
    title: "Simulations and graphs",
    body: "When a section includes one, students change a value and watch what happens. Simulations and graphs are added for ideas that are easier to see than to only read about.",
  },
  {
    title: "Code that runs in the lesson",
    body: "Programming lessons can include an example the student runs on the page, without installing anything or leaving the lesson.",
  },
  {
    title: "Checks at the end of every section",
    body: "Each section closes with a question. A wrong choice turns red, and the explanation stays hidden until the student picks the right one.",
  },
];

const instructors = [
  {
    title: "A lesson plan you can actually teach",
    body: "Describe the topic, the level, and how long you have. Thinkstack writes a sequence of sections with an explanation and a check at the end of each one. Add planner notes to keep the lesson aligned with where your class actually is, then revise any section without starting over.",
  },
  {
    title: "A course with a roster you control",
    body: "Publish a course and it appears in Explore. Students request a seat, and you decide who joins. See who is waiting, admit or remove students, and add or remove lessons at any time without rebuilding the course. Only an instructor’s course takes a class, so your roster stays your own.",
  },
  {
    title: "A planning assistant that edits the document",
    body: "The side panel answers in plain sentences and can change the lesson itself. Highlight a paragraph and ask it to add a subsection after it, rewrite an explanation for a different level, or tell you where something went. If a step is taking too long, pause it, or skip the interaction and leave a note for when it resumes.",
  },
  {
    title: "Interactive material without building it yourself",
    body: "When a section needs one, Thinkstack can add a simulation, a graph, or runnable code where it belongs. You describe the idea, and the interaction is built into that section.",
  },
];

const students = [
  {
    title: "Read it, then try it",
    body: "A lesson is a page, not a video. Read the explanation, try the check, and use a simulation or code example when the section has one.",
  },
  {
    title: "A tutor that helps without giving it away",
    body: "Ask the tutor while you read, with or without an account. It can explain a step and mark the passage on the page. It does not hand over the answer to a quiz question.",
  },
  {
    title: "Mistakes are part of the process",
    body: "A wrong choice turns red and you can keep trying. The full explanation appears only after you choose the right answer, so every check is a real attempt rather than a peek.",
  },
  {
    title: "Start from something already written",
    body: "Explore is full of public lessons and courses from instructors and other students. Open one, remix it into your own copy, or request a seat in an instructor’s course. Everything you save lives on Your lessons.",
  },
];

const institutions = [
  {
    title: "One place for lessons and courses",
    body: "Lesson planning, course management, and student enrollment live in the same system, so teachers are not stitching together documents, slide decks, and separate tools.",
  },
  {
    title: "Consistent, shareable material",
    body: "Instructors can publish lessons for their own class, and public lessons can be opened and remixed. A strong lesson written once can be adapted by the next teacher instead of rewritten from scratch.",
  },
  {
    title: "Support for every student at every hour",
    body: "Students get a tutor available during class and at home, designed to guide understanding instead of supplying answers. That means more students get unstuck without waiting for office hours.",
  },
];

function LessonPreview() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-md lg:mx-0">
      <div className="rounded-3xl border border-line bg-paper p-6 shadow-xl sm:p-7">
        <p className="text-xs uppercase tracking-[0.16em] text-accent">Section 2 · Projectile motion</p>
        <p className="mt-3 font-display text-xl leading-snug">
          A ball is launched upward and rises, slows, then falls back down.
        </p>
        <div className="mt-5 rounded-2xl border border-line p-4">
          <p className="text-sm font-medium">At the highest point of its flight, the vertical velocity is…</p>
          <div className="mt-3 grid gap-2 text-sm">
            <div className="rounded-xl border border-red-400 bg-red-50 px-4 py-2 text-red-700">At its maximum</div>
            <div className="rounded-xl border border-line px-4 py-2">Equal to the launch speed</div>
            <div className="rounded-xl border border-line px-4 py-2">Zero</div>
          </div>
        </div>
      </div>
      <div className="relative -mt-4 ml-6 rounded-2xl bg-foreground px-5 py-4 text-sm leading-6 text-paper shadow-lg sm:ml-12">
        <p className="text-xs uppercase tracking-[0.16em] opacity-70">Tutor</p>
        <p className="mt-1">Not quite. Think about what happens to the direction of the ball’s motion at the peak.</p>
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-16">
        <div className="grid items-center gap-12 lg:grid-cols-[1.25fr_1fr]">
          <div>
            <p className="text-sm uppercase tracking-[0.16em] text-accent">Thinkstack for schools</p>
            <h1 className="mt-4 font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              Interactive lessons, planned with AI and taught on your terms.
            </h1>
            <p className="mt-6 max-w-2xl text-xl leading-8 text-muted">
              Thinkstack gives schools one place to design lessons, run courses, and manage students. A lesson is a sequence of sections with an explanation and a check. A simulation, graph, or runnable example is added when it teaches the idea, and anyone reading can ask a tutor that guides them without giving away the answer.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/signup" className="rounded-full bg-accent px-8 py-3 text-lg text-paper shadow-md">
                Create an account
              </Link>
              <Link href="/explore" className="rounded-full border border-line bg-paper px-8 py-3 text-lg">
                Explore lessons
              </Link>
            </div>
          </div>
          <LessonPreview />
        </div>
      </section>

      {/* How it works: open layout, no box */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <p className="text-sm uppercase tracking-[0.16em] text-accent">How it works</p>
        <h2 className="mt-3 max-w-3xl font-display text-4xl tracking-tight sm:text-5xl">From an idea to a lesson your class can open.</h2>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-muted">
          Thinkstack handles the first draft so instructors can spend their time on the part that matters: teaching.
        </p>
        <div className="mt-12 grid gap-10 md:grid-cols-3">
          {steps.map((step) => (
            <article key={step.number}>
              <p className="font-display text-7xl leading-none text-accent">{step.number}</p>
              <h3 className="mt-4 font-display text-2xl">{step.title}</h3>
              <p className="mt-2 leading-7 text-muted">{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Inside a lesson: full-bleed dark band */}
      <section className="bg-foreground text-paper">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <p className="text-sm uppercase tracking-[0.16em] opacity-70">Inside a lesson</p>
          <h2 className="mt-3 max-w-3xl font-display text-4xl tracking-tight sm:text-5xl">Built for learning by doing.</h2>
          <p className="mt-4 max-w-3xl text-lg leading-8 opacity-80">
            A Thinkstack lesson is more than text on a screen. Every section combines instruction with something the student can act on.
          </p>
          <div className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-2">
            {lessonParts.map((item) => (
              <article key={item.title}>
                <div className="mb-5 h-px bg-paper opacity-25" />
                <h3 className="font-display text-2xl">{item.title}</h3>
                <p className="mt-2 leading-7 opacity-75">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Instructors: split layout, sticky intro, no box */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr]">
          <div className="self-start lg:sticky lg:top-24">
            <p className="text-sm uppercase tracking-[0.16em] text-accent">For instructors</p>
            <h2 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">Plan the class, then see who is in it.</h2>
            <p className="mt-4 text-lg leading-8 text-muted">
              Thinkstack is built for teachers and departments who want one place to write lessons and run a course. You stay in charge of what students study and who joins.
            </p>
            <Link href="/create" className="mt-8 inline-block rounded-full bg-foreground px-6 py-3 text-paper">
              Create a lesson
            </Link>
          </div>
          <div className="divide-y divide-line border-y border-line">
            {instructors.map((item) => (
              <article key={item.title} className="py-8">
                <h3 className="font-display text-2xl">{item.title}</h3>
                <p className="mt-2 leading-7 text-muted">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Students: full-bleed accent band with light tiles */}
      <section className="bg-accent text-paper">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <p className="text-sm uppercase tracking-[0.16em] opacity-80">For students</p>
          <h2 className="mt-3 max-w-3xl font-display text-4xl tracking-tight sm:text-5xl">A better class period, and a better night of studying.</h2>
          <p className="mt-4 max-w-3xl text-lg leading-8 opacity-90">
            The lesson your instructor publishes is the one you work through. It should feel like practice with support, not a recording to sit through.
          </p>
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {students.map((item) => (
              <article key={item.title} className="rounded-2xl bg-paper p-7 text-foreground shadow-md">
                <h3 className="font-display text-2xl">{item.title}</h3>
                <p className="mt-2 leading-7 text-muted">{item.body}</p>
              </article>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/explore" className="rounded-full bg-paper px-6 py-3 text-foreground">
              Browse Explore
            </Link>
            <Link href="/signup" className="rounded-full border border-paper px-6 py-3">
              Sign up as a student
            </Link>
          </div>
        </div>
      </section>

      {/* Institutions: open layout with accent rules */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <p className="text-sm uppercase tracking-[0.16em] text-accent">For schools and departments</p>
        <h2 className="mt-3 max-w-3xl font-display text-4xl tracking-tight sm:text-5xl">Less time preparing, more time teaching.</h2>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-muted">
          Thinkstack replaces scattered documents and one-off tools with a single system that your teachers and students can share.
        </p>
        <div className="mt-12 grid gap-10 md:grid-cols-3">
          {institutions.map((item) => (
            <article key={item.title} className="border-l-2 border-accent pl-6">
              <h3 className="font-display text-2xl">{item.title}</h3>
              <p className="mt-2 leading-7 text-muted">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="rounded-3xl bg-foreground px-8 py-16 text-center text-paper sm:px-12">
          <h2 className="mx-auto max-w-3xl font-display text-4xl tracking-tight sm:text-5xl">Bring your next lesson to life.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 opacity-80">
            Create an account to build your first lesson, or explore what other instructors and students have already published.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="rounded-full bg-accent px-8 py-3 text-lg text-paper shadow-md">
              Create an account
            </Link>
            <Link href="/explore" className="rounded-full border border-paper px-8 py-3 text-lg">
              Explore lessons
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}