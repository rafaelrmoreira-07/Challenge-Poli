"use client";

import { HistoryTabs } from "@/components/HistoryTabs";
import { TimelineList } from "@/components/TimelineList";
import { Skeleton } from "@/components/ui";
import { computeAlerts } from "@/lib/health";
import { useDb } from "@/lib/store";
import { buildTimeline } from "@/lib/timeline";

export default function HistoricoPage() {
  const db = useDb();
  return (
    <div>
      <h1 className="mb-3 text-2xl font-bold tracking-tight">Histórico</h1>
      <HistoryTabs active="timeline" />
      {db ? <TimelineList events={buildTimeline(db, computeAlerts(db), (id) => `/exames/?doc=${id}`)} /> : <Skeleton lines={6} />}
    </div>
  );
}
