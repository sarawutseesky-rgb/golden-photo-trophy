import { toast } from "sonner";

/** Format score as "4.20" (two decimals, tabular-friendly). */
export function formatAvg(avg: number | null | undefined): string {
  return Number(avg ?? 0).toFixed(2);
}

/** Format vote count as "N โหวต". */
export function formatVoteCount(count: number | null | undefined): string {
  return `${count ?? 0} โหวต`;
}

/** Unified description line: "คะแนนเฉลี่ย X.XX จาก N โหวต". */
export function formatVoteSummary(avg: number | null | undefined, count: number | null | undefined): string {
  return `คะแนนเฉลี่ย ${formatAvg(avg)} จาก ${formatVoteCount(count)}`;
}

/** Detect "already voted" duplicate-vote error from castVote. */
export function isDuplicateVoteMessage(msg: unknown): boolean {
  return /already voted/i.test(String(msg ?? ""));
}

export function toastVoteSuccess(score: number, avg: number, count: number) {
  toast.success(`ให้ ${score}★ แล้ว`, {
    description: formatVoteSummary(avg, count),
  });
}

export function toastDuplicateVote(existingScore: number | null, avg: number, count: number) {
  const title =
    existingScore != null
      ? `คุณโหวตรูปนี้ไปแล้ว ${existingScore}★`
      : "คุณโหวตรูปนี้ไปแล้ว";
  toast.info(title, {
    description: formatVoteSummary(avg, count),
  });
}