import { STATUS_LABEL, STATUS_PILL, useMeta } from "./api";

/** Course status on Home cards; owned courses only, private hidden. */
export function StatusPill({ courseId }: { courseId: string }) {
  const m = useMeta(courseId);
  if (!m?.mine || m.status === "private") return null;
  return <span className={STATUS_PILL[m.status]}>{STATUS_LABEL[m.status]}</span>;
}
