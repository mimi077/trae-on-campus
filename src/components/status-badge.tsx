import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, type ItemStatus } from "@/lib/constants";

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const label = STATUS_LABEL[status as ItemStatus] ?? status;
  if (status === "EXPIRED") {
    return (
      <Badge variant="muted" className={className}>
        {label}
      </Badge>
    );
  }
  if (status === "SOLD_OUT") {
    return (
      <Badge variant="sold" className={className}>
        {label}
      </Badge>
    );
  }
  return (
    <Badge variant="sale" className={className}>
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      {label}
    </Badge>
  );
}
