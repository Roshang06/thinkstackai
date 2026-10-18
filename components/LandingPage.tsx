import Link from "next/link";

const features = [
  {
    title: "A lesson for any topic",
    body: "Describe any topic or concept you want to study, and get a structured, personalized, interactive lesson.",
  },
  {
    title: "Share with the community",
    body: "Share your creations with others and view what the community has created.",
  },
  {
    title: "A tutor when you are stuck",
    body: "Use AI as a personal tutor to check your answers and provide guidance when you are stuck.",
  },
];

export function LandingPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-16">
      <p className="text-sm uppercase tracking-[0.16em] text-accent">Thinkstack</p>
      <h1 className="mt-3 max-w-3xl font-display text-5xl tracking-tight sm:text-6xl">
        Study using interactive problems, structured lessons, and personalized help for any subject.
      </h1>
      <ul className="mt-12 grid gap-4 sm:grid-cols-3">
        {features.map((feature) => (
          <li key={feature.title} className="rounded-2xl border border-line bg-paper p-5">
            <h2 className="font-display text-2xl tracking-tight">{feature.title}</h2>
            <p className="mt-2 text-muted">{feature.body}</p>
          </li>
        ))}
      </ul>
      <div className="mt-14 flex justify-center">
        <Link href="/create" className="rounded-full bg-accent px-10 py-4 text-xl text-paper shadow-md">
          Create a lesson
        </Link>
      </div>
    </div>
  );
}
