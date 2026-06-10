export interface WeeklySyncPlan {
  baselineAnchor?: string;
  dueAnchors: string[];
  lastExistingAnchor?: string;
}

function sortUniqueDates(dates: string[]): string[] {
  return [...new Set(dates)].sort((left, right) => left.localeCompare(right));
}

export function shiftDateStr(date: string, deltaDays: number): string {
  const utc = new Date(`${date}T00:00:00.000Z`);
  utc.setUTCDate(utc.getUTCDate() + deltaDays);
  return utc.toISOString().slice(0, 10);
}

export function hasCompleteDailyWindow(anchorDate: string, availableDailyDates: Set<string>): boolean {
  for (let offset = 0; offset < 7; offset += 1) {
    if (!availableDailyDates.has(shiftDateStr(anchorDate, offset - 6))) {
      return false;
    }
  }
  return true;
}

export function planWeeklySync(input: {
  availableDailyDates: string[];
  existingWeeklyAnchors: string[];
  targetDate: string;
}): WeeklySyncPlan {
  const dailyDates = sortUniqueDates(input.availableDailyDates).filter((date) => date <= input.targetDate);
  const existingWeeklyAnchors = sortUniqueDates(input.existingWeeklyAnchors).filter((date) => date <= input.targetDate);
  const availableDailySet = new Set(dailyDates);
  const completeAnchors = dailyDates.filter((date) => hasCompleteDailyWindow(date, availableDailySet));
  const lastExistingAnchor = existingWeeklyAnchors.at(-1);

  if (completeAnchors.length === 0) {
    return {
      lastExistingAnchor,
      dueAnchors: [],
    };
  }

  const latestCompleteAnchor = completeAnchors.at(-1);
  const baselineAnchor =
    lastExistingAnchor && hasCompleteDailyWindow(lastExistingAnchor, availableDailySet) ? lastExistingAnchor : latestCompleteAnchor;

  if (!baselineAnchor) {
    return {
      lastExistingAnchor,
      dueAnchors: [],
    };
  }

  const existingSet = new Set(existingWeeklyAnchors);
  const dueAnchors = new Set<string>();

  for (let anchor = baselineAnchor; anchor <= input.targetDate && hasCompleteDailyWindow(anchor, availableDailySet); anchor = shiftDateStr(anchor, 7)) {
    if (!existingSet.has(anchor)) {
      dueAnchors.add(anchor);
    }
  }

  for (let anchor = shiftDateStr(baselineAnchor, -7); hasCompleteDailyWindow(anchor, availableDailySet); anchor = shiftDateStr(anchor, -7)) {
    if (!existingSet.has(anchor)) {
      dueAnchors.add(anchor);
    }
  }

  return {
    baselineAnchor,
    dueAnchors: [...dueAnchors].sort((left, right) => left.localeCompare(right)),
    lastExistingAnchor,
  };
}
