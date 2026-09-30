// Permalink page — server-rendered from the immutable observation store.
// Write was acknowledged before this id was ever returned.

import { notFound } from "next/navigation";
import { getObservation } from "@/server/store";
import { ObservationView } from "@/components/observation-view";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ObservationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await getObservation(id);
  if (!o) notFound();
  return (
    <main className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6">
      <header className="mb-6 flex items-center justify-between border-b border-line pb-4">
        <Link href="/" className="deco text-xl">Maker<span className="text-accent">Heat</span></Link>
        <span className="chip">{o.mode} observation</span>
      </header>
      <ObservationView o={o} permalink={`/r/${o.id}`} />
    </main>
  );
}
