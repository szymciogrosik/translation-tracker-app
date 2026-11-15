export interface BookDayEntry {
  date: string; // Format: yyyy-MM-dd
  pages: number | null; // Cumulative last translated page number at the end of the day, or null if not entered yet
}

export interface Book {
  id?: string;
  OwnerUid: string;
  SharedWithUids: string[];
  BookName: string;
  StartDate: string; // Format: yyyy-MM-dd
  EndDate: string; // Format: yyyy-MM-dd
  BufforDayNumber: number;
  NumberOfPages: number;
  TranslatedPages: BookDayEntry[];
  ExcludedDays: string[]; // Array of dates (yyyy-MM-dd)
  IsArchived?: boolean;
  CreatedAt?: string;
  UpdatedAt?: string;
}

export type DayCountingVariantId =
  | 'noWeekendsNoExcluded'
  | 'withWeekendsNoExcluded'
  | 'withSaturdaysNoSundaysNoExcluded'
  | 'allDaysWithExcluded';

export interface VariantDayStats {
  variantId: DayCountingVariantId;
  totalDays: number;
  remainingDaysToBuffer: number;
  remainingDaysToDeadline: number;
  requiredPagesPerDayToBuffer: number | null;
  requiredPagesPerDayToDeadline: number | null;
  averageTranslatedPerActiveVariantDay: number;
  translatedDaysInVariantCount: number;
}

export interface DailyChartPoint {
  date: string;
  displayDate: string;
  dailyPages: number;
  cumulativePages: number;
  isWeekend: boolean;
  isSaturday: boolean;
  isSunday: boolean;
  isExcluded: boolean;
}

export interface NextPendingDayInfo {
  entryIndex: number;
  date: string;
  displayDate: string;
  suggestedCumulativePages: number;
  minAllowedPages: number;
  maxAllowedPages: number;
  isAllUpToTodayEntered: boolean;
  isBookFinished: boolean;
}

export interface CumulativeChartSeries {
  labels: string[]; // dd.MM
  fullDates: string[]; // dd.MM.yyyy
  plannedCumulative: number[]; // Step-by-step planned pages (e.g., 3, 6, 9...)
  actualCumulative: (number | null)[]; // Actual cumulative translated pages up to last entered day
}

export interface BookComputedStatistics {
  bookId: string;
  bookName: string;
  startDate: string;
  endDate: string;
  bufferDate: string;
  bufferDayNumber: number;
  totalPages: number;
  currentTranslatedPages: number;
  remainingPages: number;
  todayTranslatedPages: number;
  isTodayEntered: boolean;
  progressPercent: number;
  isCompleted: boolean;
  variants: Record<DayCountingVariantId, VariantDayStats>;
  variantsList: VariantDayStats[];
  chartPoints: DailyChartPoint[];
  cumulativeSeriesByVariant: Record<DayCountingVariantId, CumulativeChartSeries>;
  nextPendingDay: NextPendingDayInfo;
}
