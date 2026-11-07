import { Suspense } from "react";
import { HistoryTabs } from "@/components/HistoryTabs";
import { TimelineList } from "@/components/TimelineList";
import { Skeleton } from "@/components/ui";
import { getDb } from "@/lib/db";
import { computeAlerts } from "@/lib/health";
import { buildTimeline } from "@/lib/timeline";

export default function HistoricoPage() {
  return (
    <div>
      <h1 className="mb-3 text-2xl font-bold tracking-tight">Histórico</h1>
      <HistoryTabs active="timeline" />
      <Suspense fallback={<Skeleton lines={6} />}>
        <Timeline />
      </Suspense>
    </div>
  );
}

async function Timeline() {
  const db = await getDb();
  const events = buildTimeline(db, computeAlerts(db), (id) => `/exames?doc=${id}`);
  return <TimelineList events={events} />;
}
