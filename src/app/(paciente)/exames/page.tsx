import { Suspense } from "react";
import { HistoryTabs } from "@/components/HistoryTabs";
import { Skeleton } from "@/components/ui";
import { ExamesView } from "@/components/views/ExamesView";

export default function ExamesPage() {
  return (
    <div>
      <h1 className="mb-3 page-title">Histórico</h1>
      <HistoryTabs active="exames" />
      <Suspense fallback={<Skeleton lines={6} />}>
        <ExamesView />
      </Suspense>
    </div>
  );
}
