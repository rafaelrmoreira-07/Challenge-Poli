import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { ExameView } from "@/components/views/ExameView";

export default function ExamePage() {
  return (
    <Suspense fallback={<Skeleton lines={4} />}>
      <ExameView />
    </Suspense>
  );
}
