import type { DunningTrigger } from "@prisma/client";

export function computeFireDate(
  trigger: DunningTrigger,
  offsetDays: number,
  dueDate: Date
): Date {
  const result = new Date(
    Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate())
  );

  if (trigger === "ON_DUE" || offsetDays === 0) {
    return result;
  }

  const direction = trigger === "BEFORE_DUE" ? -1 : 1;
  let remaining = offsetDays;

  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + direction);
    const day = result.getUTCDay();
    if (day !== 0 && day !== 6) {
      remaining--;
    }
  }

  return result;
}
