import {TestBed} from '@angular/core/testing';
import {BookCalculationService} from './book-calculation.service';
import {DateService} from '../util/date.service';
import {Book} from '../../_models/book/book';

describe('BookCalculationService', () => {
  let service: BookCalculationService;

  const sampleBook: Book = {
    id: 'book-1',
    OwnerUid: 'user-1',
    SharedWithUids: [],
    BookName: 'Wiedźmin: Ostatnie Życzenie',
    StartDate: '2026-11-09', // Monday
    EndDate: '2026-11-16',   // Next Monday (8 calendar days total)
    BufforDayNumber: 2,      // Buffer date: 2026-11-14 (Saturday)
    NumberOfPages: 100,
    TranslatedPages: [
      {date: '2026-11-09', pages: 10}, // Mon: +10
      {date: '2026-11-10', pages: 25}, // Tue: +15
      {date: '2026-11-11', pages: null}, // Wed (Excluded holiday)
      {date: '2026-11-12', pages: 25}, // Thu: +0 (no translation done)
      {date: '2026-11-13', pages: null}, // Fri
      {date: '2026-11-14', pages: null}, // Sat
      {date: '2026-11-15', pages: null}, // Sun
      {date: '2026-11-16', pages: null}  // Mon
    ],
    ExcludedDays: ['2026-11-11'] // Wednesday is excluded
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [BookCalculationService, DateService]
    });
    service = TestBed.inject(BookCalculationService);
  });

  it('should compute 4 day counting variants accurately', () => {
    // Today is Friday 2026-11-13 (not entered yet, so remaining days start from 2026-11-13)
    const stats = service.computeBookStatistics(sampleBook, '2026-11-13');

    expect(stats.totalPages).toBe(100);
    expect(stats.currentTranslatedPages).toBe(25);
    expect(stats.remainingPages).toBe(75);
    expect(stats.bufferDate).toBe('2026-11-14');

    // Total days from 2026-11-09 (Mon) to 2026-11-16 (Mon):
    // Calendar days = 8 (Mon, Tue, Wed[excl], Thu, Fri, Sat, Sun, Mon)
    // Variant 1: noWeekendsNoExcluded -> Mon, Tue, Thu, Fri, Mon = 5
    expect(stats.variants.noWeekendsNoExcluded.totalDays).toBe(5);
    // Variant 2: withWeekendsNoExcluded -> 8 - 1 (Wed) = 7
    expect(stats.variants.withWeekendsNoExcluded.totalDays).toBe(7);
    // Variant 3: withSaturdaysNoSundaysNoExcluded -> 8 - 1 (Sun) - 1 (Wed) = 6
    expect(stats.variants.withSaturdaysNoSundaysNoExcluded.totalDays).toBe(6);
    // Variant 4: allDaysWithExcluded -> 8
    expect(stats.variants.allDaysWithExcluded.totalDays).toBe(8);

    // Remaining days to Deadline (2026-11-13 Fri .. 2026-11-16 Mon -> Fri, Sat, Sun, Mon):
    expect(stats.variants.noWeekendsNoExcluded.remainingDaysToDeadline).toBe(2); // Fri, Mon
    expect(stats.variants.withWeekendsNoExcluded.remainingDaysToDeadline).toBe(4); // Fri, Sat, Sun, Mon
    expect(stats.variants.withSaturdaysNoSundaysNoExcluded.remainingDaysToDeadline).toBe(3); // Fri, Sat, Mon
    expect(stats.variants.allDaysWithExcluded.remainingDaysToDeadline).toBe(4);
  });

  it('should skip excluded dates and zero-delta days correctly', () => {
    const stats = service.computeBookStatistics(sampleBook, '2026-11-13');

    // Only days with >0 pages translated are in chartPoints (Mon: 10, Tue: 15; Thu had 0 delta)
    expect(stats.chartPoints.length).toBe(2);
    expect(stats.chartPoints[0].dailyPages).toBe(10);
    expect(stats.chartPoints[1].dailyPages).toBe(15);

    // Next pending day skips 2026-11-11 (excluded) and finds 2026-11-13 (Fri)
    expect(stats.nextPendingDay.date).toBe('2026-11-13');
    expect(stats.nextPendingDay.suggestedCumulativePages).toBe(25);
    expect(stats.nextPendingDay.minAllowedPages).toBe(25);
    expect(stats.nextPendingDay.isAllUpToTodayEntered).toBeFalse();
  });

  it('should shift StartDate earlier using Option A (prepended days get 0, existing dates stay)', () => {
    const shifted = service.shiftBookDates(sampleBook, '2026-11-07', '2026-11-16');
    expect(shifted.hasDataLoss).toBeFalse();
    expect(shifted.translatedPages[0]).toEqual({date: '2026-11-07', pages: 0});
    expect(shifted.translatedPages[1]).toEqual({date: '2026-11-08', pages: 0});
    expect(shifted.translatedPages[2]).toEqual({date: '2026-11-09', pages: 10});
    expect(shifted.translatedPages[3]).toEqual({date: '2026-11-10', pages: 25});
  });

  it('should detect data loss when StartDate or EndDate is shortened across entered days', () => {
    const shifted = service.shiftBookDates(sampleBook, '2026-11-11', '2026-11-16');
    expect(shifted.hasDataLoss).toBeTrue();
    expect(shifted.lostEntriesCount).toBe(2); // 09 and 10 had values
  });
});
