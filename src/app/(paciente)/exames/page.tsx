import { Suspense } from "react";
import { HistoryHeader } from "@/components/HistoryTabs";
import { Skeleton } from "@/components/ui";
import { ExamesView } from "@/components/views/ExamesView";

export default function ExamesPage() {
  return (
    <div>
      <HistoryHeader active="exames" />
      <Suspense fallback={<Skeleton lines={6} />}>
        <ExamesView />
      </Suspense>
    </div>
  );
}
