import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { Scanner } from "@/components/scanner";

function replayGroups(): string[] {
  try {
    const man = JSON.parse(readFileSync(path.resolve(process.cwd(), "fixtures/manifest.json"), "utf8"));
    return [...new Set(man.fixtures.map((f: { group?: string }) => f.group).filter(Boolean))] as string[];
  } catch {
    return [];
  }
}

export default function Home() {
  const groups = replayGroups();
  return (
    <main className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6">
      <header className="flex items-center justify-between border-b border-line pb-4">
        <div>
          <span className="deco text-2xl">Maker<span className="text-accent">Heat</span></span>
          <span className="data ml-3 text-[10px] uppercase tracking-[0.18em] text-faint">observed tape, honest scope</span>
        </div>
      </header>

      <section className="border-b border-line py-8">
        <h1 className="deco text-[clamp(1.8rem,5vw,3rem)] leading-tight">
          Who supplied the volume —<br />and how deep does the sample go?
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-dim">
          Paste a DEX contract. MakerHeat fetches the recorded swap tape, shows which addresses
          carried the observed volume, whether their buys appear in the same sample, and how
          those numbers move as evidence deepens. Descriptive only — no verdicts.
        </p>
      </section>

      <section className="mt-6">
        <Scanner replayGroups={groups} />
      </section>

      <footer className="mt-10 border-t border-line pt-4 data text-[10px] text-faint">
        <p>
          Numbers describe provider-reported data inside a stated sample. An address is not a
          person. A hash is an integrity receipt, not proof of provider truth. Nothing here is
          a safety judgment or investment advice.
        </p>
      </footer>
    </main>
  );
}
