import type { Status } from "@/lib/schemas";
import { cn } from "@/lib/utils";
/** Status is encoded in shape as well as color: hollow = planned, half = in progress, solid = stable, struck = deprecated. */
const LABEL: Record<Status, string> = { planned: "Planned", "in-progress": "In progress", stable: "Stable", deprecated: "Deprecated" };
export function StatusMark({ status, withLabel = false }: { status: Status; withLabel?: boolean }) {
  const shape = {
    planned: "rounded-full border-2 border-[#a5ada6]",
    "in-progress": "rounded-full border-2 border-[#c17a3d] bg-[linear-gradient(90deg,#c17a3d_50%,transparent_50%)]",
    stable: "rounded-full bg-[#2b8a60]",
    deprecated: "rounded-[2px] border-2 border-[#8d9690] bg-[linear-gradient(135deg,transparent_45%,#8d9690_45%,#8d9690_55%,transparent_55%)]",
  }[status];
  return (
    <span className="inline-flex items-center gap-2" title={LABEL[status]}>
      <span className={cn("inline-block size-2.5 shrink-0", shape)} aria-hidden />
      {withLabel ? <span className="text-xs text-muted">{LABEL[status]}</span> : <span className="sr-only">{LABEL[status]}</span>}
    </span>
  );
}
