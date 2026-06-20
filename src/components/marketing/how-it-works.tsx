const steps = [
  {
    number: "01",
    title: "Hit record",
    description: "Screen, webcam, or both. One click, no setup.",
  },
  {
    number: "02",
    title: "We handle the rest",
    description:
      "Upload happens automatically. Transcript and summary generate in the background.",
  },
  {
    number: "03",
    title: "Share the link",
    description:
      "Send it anywhere — Slack, email, a ticket. They watch whenever works for them.",
  },
];

export function HowItWorks() {
  return (
    <section className="border-y border-border bg-card/30">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="text-center text-3xl font-semibold tracking-tight md:text-4xl">
          From idea to shared in under a minute
        </h2>

        <div className="mt-16 grid gap-12 md:grid-cols-3 md:gap-8">
          {steps.map((step, i) => (
            <div key={step.number} className="relative">
              <span className="text-5xl font-bold text-muted-foreground/20">
                {step.number}
              </span>
              <h3 className="mt-4 text-lg font-medium">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {step.description}
              </p>
              {i < steps.length - 1 && (
                <div className="absolute right-[-1rem] top-6 hidden h-px w-8 bg-border md:block" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}