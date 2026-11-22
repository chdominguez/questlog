import { useEffect, useState } from "react";
import { useSession } from "../auth/session";
import { href } from "../ui/route";
import { getReview } from "./api";

/** Review queue link in Profile, admins only. */
export function AdminLink() {
  const admin = useSession().me?.admin ?? false;
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (admin) getReview().then((q) => setCount(q.pending.length + q.flags.length), () => {});
  }, [admin]);
  if (!admin) return null;
  return <a className="btn ghost" href={href.adminReview()}>{count ? `Review queue · ${count}` : "Review queue"}</a>;
}
