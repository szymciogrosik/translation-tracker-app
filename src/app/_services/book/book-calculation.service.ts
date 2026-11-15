import {Injectable, inject} from '@angular/core';
import {DateTime} from 'luxon';
import {
  Book,
  BookComputedStatistics,
  BookDayEntry,
  CumulativeChartSeries,
  DailyChartPoint,
  DayCountingVariantId,
  NextPendingDayInfo,
  VariantDayStats
} from '../../_models/book/book';
import {DateService} from '../util/date.service';

export interface ShiftedDatesResult {
  translatedPages: BookDayEntry[];
  excludedDays: string[];
  hasDataLoss: boolean;
  lostEntriesCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class BookCalculationService {
  private readonly dateService = inject(DateService);

  public static readonly VARIANT_IDS: readonly DayCountingVariantId[] = [
    'noWeekendsNoExcluded',
    'withSaturdaysNoSundaysNoExcluded',
    'withWeekendsNoExcluded',
    'allDaysWithExcluded'
  ];

  public getTodayIso(overrideToday?: string): string {
    if (overrideToday) {
      return overrideToday;
    }
    return this.dateService.getCurrentDateTime().toFormat('yyyy-MM-dd');
  }

  public formatDisplayDate(isoDate: string): string {
    const dt = DateTime.fromISO(isoDate, {zone: DateService.timeZone});
    return dt.isValid ? dt.toFormat('dd.MM.yyyy') : isoDate;
  }

  public generateInitialTranslatedPages(startDate: string, endDate: string): BookDayEntry[] {
    const start = DateTime.fromISO(startDate, {zone: DateService.timeZone}).startOf('day');
    const end = DateTime.fromISO(endDate, {zone: DateService.timeZone}).startOf('day');
    if (!start.isValid || !end.isValid || end < start) {
      return [];
    }
    const totalDays = Math.round(end.diff(start, 'days').days) + 1;
    const entries: BookDayEntry[] = [];
    for (let i = 0; i < totalDays; i++) {
      entries.push({
        date: start.plus({days: i}).toFormat('yyyy-MM-dd'),
        pages: null
      });
    }
    return entries;
  }

  public getCurrentTranslatedPages(book: Book): number {
    const entries = book.TranslatedPages ?? [];
    for (let i = entries.length - 1; i >= 0; i--) {
      const val = entries[i]?.pages;
      if (val !== null && val !== undefined && !Number.isNaN(val)) {
        return Number(val);
      }
    }
    return 0;
  }

  public isBookCompleted(book: Book): boolean {
    if (book.IsArchived) {
      return true;
    }
    const current = this.getCurrentTranslatedPages(book);
    return book.NumberOfPages > 0 && current >= book.NumberOfPages;
  }

  public isDayIncludedInVariant(
    isoDate: string,
    variant: DayCountingVariantId,
    excludedSet: ReadonlySet<string>
  ): boolean {
    if (variant === 'allDaysWithExcluded') {
      return true;
    }
    // Excluded has higher priority in variants 1, 2, 3
    if (excludedSet.has(isoDate)) {
      return false;
    }
    if (variant === 'withWeekendsNoExcluded') {
      return true;
    }
    const dt = DateTime.fromISO(isoDate, {zone: DateService.timeZone});
    if (!dt.isValid) {
      return false;
    }
    const weekday = dt.weekday; // 1 = Monday ... 6 = Saturday, 7 = Sunday
    if (variant === 'noWeekendsNoExcluded') {
      return weekday >= 1 && weekday <= 5;
    }
    if (variant === 'withSaturdaysNoSundaysNoExcluded') {
      return weekday >= 1 && weekday <= 6;
    }
    return true;
  }

  public countDaysInRangeForVariant(
    startIso: string,
    endIso: string,
    variant: DayCountingVariantId,
    excludedSet: ReadonlySet<string>
  ): number {
    const start = DateTime.fromISO(startIso, {zone: DateService.timeZone}).startOf('day');
    const end = DateTime.fromISO(endIso, {zone: DateService.timeZone}).startOf('day');
    if (!start.isValid || !end.isValid || end < start) {
      return 0;
    }
    const totalDays = Math.round(end.diff(start, 'days').days) + 1;
    let count = 0;
    for (let i = 0; i < totalDays; i++) {
      const dIso = start.plus({days: i}).toFormat('yyyy-MM-dd');
      if (this.isDayIncludedInVariant(dIso, variant, excludedSet)) {
        count++;
      }
    }
    return count;
  }

  public computeNextPendingDay(book: Book, overrideToday?: string): NextPendingDayInfo {
    const todayIso = this.getTodayIso(overrideToday);
    const excludedSet = new Set(book.ExcludedDays ?? []);
    const entries = book.TranslatedPages ?? [];
    const currentTranslated = this.getCurrentTranslatedPages(book);
    const isBookFinished = this.isBookCompleted(book);

    let lastKnownPages = 0;
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (entry.pages !== null && entry.pages !== undefined) {
        lastKnownPages = Math.max(lastKnownPages, Number(entry.pages));
        continue;
      }
      // Skip dates marked as excluded so the user is not prompted to enter pages for them
      if (excludedSet.has(entry.date)) {
        continue;
      }

      const isAfterToday = entry.date > todayIso;
      return {
        entryIndex: i,
        date: entry.date,
        displayDate: this.formatDisplayDate(entry.date),
        suggestedCumulativePages: lastKnownPages,
        minAllowedPages: lastKnownPages,
        maxAllowedPages: book.NumberOfPages,
        isAllUpToTodayEntered: isAfterToday,
        isBookFinished
      };
    }

    return {
      entryIndex: -1,
      date: todayIso,
      displayDate: this.formatDisplayDate(todayIso),
      suggestedCumulativePages: currentTranslated,
      minAllowedPages: currentTranslated,
      maxAllowedPages: book.NumberOfPages,
      isAllUpToTodayEntered: true,
      isBookFinished
    };
  }

  public computeBookStatistics(book: Book, overrideToday?: string): BookComputedStatistics {
    const todayIso = this.getTodayIso(overrideToday);
    const excludedSet = new Set(book.ExcludedDays ?? []);
    const entries = book.TranslatedPages ?? [];

    const totalPages = Math.max(0, Number(book.NumberOfPages ?? 0));
    const currentTranslatedPages = this.getCurrentTranslatedPages(book);
    const remainingPages = Math.max(0, totalPages - currentTranslatedPages);
    const progressPercent =
      totalPages > 0 ? Math.min(100, Math.round((currentTranslatedPages / totalPages) * 1000) / 10) : 0;
    const isCompleted = this.isBookCompleted(book);

    const endDt = DateTime.fromISO(book.EndDate, {zone: DateService.timeZone}).startOf('day');
    const bufferDays = Math.max(0, Number(book.BufforDayNumber ?? 0));
    const bufferDate = endDt.isValid
      ? endDt.minus({days: bufferDays}).toFormat('yyyy-MM-dd')
      : book.EndDate;

    // Determine starting date for remaining days calculation:
    // If today has already been entered in TranslatedPages, remaining days start tomorrow.
    // Otherwise remaining days start from max(todayIso, StartDate).
    const todayEntry = entries.find(e => e.date === todayIso);
    const isTodayEntered = todayEntry !== undefined && todayEntry.pages !== null;
    const todayDt = DateTime.fromISO(todayIso, {zone: DateService.timeZone}).startOf('day');
    const effectiveRemainingStartIso = isTodayEntered
      ? todayDt.plus({days: 1}).toFormat('yyyy-MM-dd')
      : todayIso > book.StartDate
        ? todayIso
        : book.StartDate;

    // Calculate daily increments, today's translated pages, and chart points
    const chartPoints: DailyChartPoint[] = [];
    const allPositiveDailyPoints: DailyChartPoint[] = [];
    let prevCumulative = 0;
    let todayTranslatedPages = 0;

    for (const entry of entries) {
      if (entry.pages === null || entry.pages === undefined) {
        if (entry.date === todayIso) {
          todayTranslatedPages = 0;
        }
        continue;
      }
      const currentVal = Number(entry.pages);
      const dailyDelta = Math.max(0, currentVal - prevCumulative);
      prevCumulative = Math.max(prevCumulative, currentVal);

      if (entry.date === todayIso) {
        todayTranslatedPages = dailyDelta;
      }

      if (dailyDelta > 0) {
        const dt = DateTime.fromISO(entry.date, {zone: DateService.timeZone});
        const weekday = dt.isValid ? dt.weekday : 1;
        const point: DailyChartPoint = {
          date: entry.date,
          displayDate: this.formatDisplayDate(entry.date),
          dailyPages: dailyDelta,
          cumulativePages: currentVal,
          isWeekend: weekday === 6 || weekday === 7,
          isSaturday: weekday === 6,
          isSunday: weekday === 7,
          isExcluded: excludedSet.has(entry.date)
        };
        chartPoints.push(point);
        allPositiveDailyPoints.push(point);
      }
    }

    const variantsMap = {} as Record<DayCountingVariantId, VariantDayStats>;
    const variantsList: VariantDayStats[] = [];
    const cumulativeSeriesByVariant = {} as Record<DayCountingVariantId, CumulativeChartSeries>;

    // Build date-to-entry lookup and find last entered index for cumulative chart
    let lastEnteredIndex = -1;
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i].pages !== null && entries[i].pages !== undefined) {
        lastEnteredIndex = i;
        break;
      }
    }

    const overallSumTranslated = allPositiveDailyPoints.reduce((acc, pt) => acc + pt.dailyPages, 0);
    const overallAverageTranslatedPerDay =
      allPositiveDailyPoints.length > 0
        ? Math.round((overallSumTranslated / allPositiveDailyPoints.length) * 10) / 10
        : 0;
    const overallTranslatedDaysCount = allPositiveDailyPoints.length;

    for (const variantId of BookCalculationService.VARIANT_IDS) {
      const totalDays = this.countDaysInRangeForVariant(
        book.StartDate,
        book.EndDate,
        variantId,
        excludedSet
      );
      const remainingDaysToBuffer = this.countDaysInRangeForVariant(
        effectiveRemainingStartIso,
        bufferDate,
        variantId,
        excludedSet
      );
      const remainingDaysToDeadline = this.countDaysInRangeForVariant(
        effectiveRemainingStartIso,
        book.EndDate,
        variantId,
        excludedSet
      );

      const requiredPagesPerDayToBuffer =
        remainingPages === 0
          ? 0
          : remainingDaysToBuffer > 0
            ? Math.round((remainingPages / remainingDaysToBuffer) * 10) / 10
            : null;

      const requiredPagesPerDayToDeadline =
        remainingPages === 0
          ? 0
          : remainingDaysToDeadline > 0
            ? Math.round((remainingPages / remainingDaysToDeadline) * 10) / 10
            : null;

      const stat: VariantDayStats = {
        variantId,
        totalDays,
        remainingDaysToBuffer,
        remainingDaysToDeadline,
        requiredPagesPerDayToBuffer,
        requiredPagesPerDayToDeadline,
        averageTranslatedPerActiveVariantDay: overallAverageTranslatedPerDay,
        translatedDaysInVariantCount: overallTranslatedDaysCount
      };
      variantsMap[variantId] = stat;
      variantsList.push(stat);

      // Build cumulative step-by-step series for this variant
      // Line 1 (Planned): day 1 -> 1 * pace, day 2 -> 2 * pace, ..., reaching totalPages at target end
      // Line 2 (Actual): cumulative pages translated up to each day (until lastEnteredIndex)
      const targetDaysCount = this.countDaysInRangeForVariant(
        book.StartDate,
        bufferDate >= book.StartDate ? bufferDate : book.EndDate,
        variantId,
        excludedSet
      ) || totalDays;

      const labels: string[] = [];
      const fullDates: string[] = [];
      const plannedCumulative: number[] = [];
      const actualCumulative: (number | null)[] = [];

      let workingDayCounter = 0;
      let runningActual = 0;

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const included = this.isDayIncludedInVariant(entry.date, variantId, excludedSet);

        if (entry.pages !== null && entry.pages !== undefined) {
          runningActual = Math.max(runningActual, Number(entry.pages));
        }

        // Only advance the planned target on active working days for the selected variant;
        // on weekends, vacations, and buffer days the planned line stays flat (horizontal plateau).
        if (included && entry.date <= bufferDate && workingDayCounter < targetDaysCount) {
          workingDayCounter++;
        }

        const plannedVal =
          targetDaysCount > 0
            ? Math.min(totalPages, Math.round(((workingDayCounter * totalPages) / targetDaysCount) * 10) / 10)
            : totalPages;

        const disp = this.formatDisplayDate(entry.date);
        labels.push(disp.slice(0, 5));
        fullDates.push(disp);
        plannedCumulative.push(plannedVal);
        actualCumulative.push(i <= lastEnteredIndex ? runningActual : null);
      }

      cumulativeSeriesByVariant[variantId] = {
        labels,
        fullDates,
        plannedCumulative,
        actualCumulative
      };
    }

    return {
      bookId: book.id ?? '',
      bookName: book.BookName,
      startDate: book.StartDate,
      endDate: book.EndDate,
      bufferDate,
      bufferDayNumber: bufferDays,
      totalPages,
      currentTranslatedPages,
      remainingPages,
      todayTranslatedPages,
      isTodayEntered,
      progressPercent,
      isCompleted,
      variants: variantsMap,
      variantsList,
      chartPoints,
      cumulativeSeriesByVariant,
      nextPendingDay: this.computeNextPendingDay(book, todayIso)
    };
  }

  /**
   * Shifts StartDate and EndDate according to Option A:
   * - If newStart < oldStart and any entry already had pages !== null, newly prepended days get 0 (otherwise null),
   *   and existing dates keep their values on their calendar dates.
   * - If newStart > oldStart or newEnd < oldEnd, entries outside [newStart, newEnd] are removed
   *   and `hasDataLoss` is true if any removed entry had pages !== null.
   */
  public shiftBookDates(
    book: Book,
    newStartIso: string,
    newEndIso: string
  ): ShiftedDatesResult {
    const oldEntries = book.TranslatedPages ?? [];
    const oldMap = new Map<string, number | null>();
    let hasAnyEnteredValue = false;

    for (const entry of oldEntries) {
      oldMap.set(entry.date, entry.pages);
      if (entry.pages !== null && entry.pages !== undefined) {
        hasAnyEnteredValue = true;
      }
    }

    let lostEntriesCount = 0;
    for (const entry of oldEntries) {
      if (entry.date < newStartIso || entry.date > newEndIso) {
        if (entry.pages !== null && entry.pages !== undefined) {
          lostEntriesCount++;
        }
      }
    }

    const start = DateTime.fromISO(newStartIso, {zone: DateService.timeZone}).startOf('day');
    const end = DateTime.fromISO(newEndIso, {zone: DateService.timeZone}).startOf('day');
    const totalDays =
      start.isValid && end.isValid && end >= start
        ? Math.round(end.diff(start, 'days').days) + 1
        : 0;

    const newTranslatedPages: BookDayEntry[] = [];
    for (let i = 0; i < totalDays; i++) {
      const dateStr = start.plus({days: i}).toFormat('yyyy-MM-dd');
      if (oldMap.has(dateStr)) {
        newTranslatedPages.push({
          date: dateStr,
          pages: oldMap.get(dateStr) ?? null
        });
      } else if (dateStr < book.StartDate) {
        // Option A: prepended days before oldStart get 0 when book already had entries, or null if untouched
        newTranslatedPages.push({
          date: dateStr,
          pages: hasAnyEnteredValue ? 0 : null
        });
      } else {
        newTranslatedPages.push({
          date: dateStr,
          pages: null
        });
      }
    }

    const filteredExcluded = (book.ExcludedDays ?? []).filter(
      d => d >= newStartIso && d <= newEndIso
    );

    return {
      translatedPages: newTranslatedPages,
      excludedDays: filteredExcluded,
      hasDataLoss: lostEntriesCount > 0,
      lostEntriesCount
    };
  }
}
