import { copy } from "../../lib/copy";

export default async function GatePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-container flex-col justify-center px-4 md:px-8">
      <h1 className="text-[28px] font-bold leading-tight text-ink">
        {copy.gate.title}
      </h1>
      <p className="mt-2 text-[15px] text-ink-700">{copy.gate.body}</p>
      <form
        method="post"
        action="/api/gate"
        className="mt-6 flex max-w-sm flex-col gap-3"
      >
        <label htmlFor="password" className="text-[13px] text-ink-700">
          {copy.gate.password}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoFocus
          autoComplete="current-password"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "gate-error" : undefined}
          className="h-12 rounded-md border border-line bg-canvas px-4 text-[16px] text-ink outline-none focus:border-accent"
        />
        {error ? (
          <p id="gate-error" role="alert" className="text-[13px] text-danger">
            {copy.gate.wrong}
          </p>
        ) : null}
        <button
          type="submit"
          className="h-12 rounded-md bg-accent px-6 text-[16px] font-semibold text-canvas transition-colors duration-150 ease-brand hover:bg-accent-dark"
        >
          {copy.gate.open}
        </button>
      </form>
    </main>
  );
}
