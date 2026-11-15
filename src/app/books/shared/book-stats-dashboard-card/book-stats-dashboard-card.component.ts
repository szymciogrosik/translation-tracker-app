import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  WritableSignal,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterLink} from '@angular/router';
import {MatCardModule} from '@angular/material/card';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {TranslatePipe} from '@ngx-translate/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {Chart, registerables} from 'chart.js';
import {
  Book,
  BookComputedStatistics,
  CumulativeChartSeries,
  DayCountingVariantId
} from '../../../_models/book/book';
import {BookCalculationService} from '../../../_services/book/book-calculation.service';
import {ThemeService} from '../../../_services/util/theme.service';
import {CustomTranslateService} from '../../../_services/translate/custom-translate.service';
import {DailyEntryBoxComponent} from '../daily-entry-box/daily-entry-box.component';

Chart.register(...registerables);

@Component({
  selector: 'app-book-stats-dashboard-card',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    TranslatePipe,
    DailyEntryBoxComponent
  ],
  templateUrl: './book-stats-dashboard-card.component.html',
  styleUrls: ['./book-stats-dashboard-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BookStatsDashboardCardComponent implements OnDestroy {
  public readonly book = input.required<Book>();
  public readonly showDailyEntryBox = input<boolean>(true);
  public readonly isClickableHeader = input<boolean>(true);
  public readonly showChartAndMatrix = input<boolean>(true);

  private readonly calcService = inject(BookCalculationService);
  private readonly themeService = inject(ThemeService);
  private readonly translateService = inject(CustomTranslateService);

  protected readonly isDarkTheme = toSignal(this.themeService.isDarkTheme$, {initialValue: false});

  protected readonly stats = computed<BookComputedStatistics>(() =>
    this.calcService.computeBookStatistics(this.book())
  );

  protected readonly selectedVariant = signal<DayCountingVariantId>('noWeekendsNoExcluded');
  protected readonly showFullVariantsMatrix = signal<boolean>(false);

  protected readonly activeCumulativeSeries = computed<CumulativeChartSeries>(() => {
    const s = this.stats();
    return s.cumulativeSeriesByVariant[this.selectedVariant()];
  });

  protected readonly activeVariantStat = computed(() => {
    const s = this.stats();
    return s.variants[this.selectedVariant()];
  });

  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('dailyPagesCanvas');
  private chartInstance: Chart | null = null;

  protected readonly isCelebratingProgress = signal(false);
  protected readonly animatedCurrentPages = signal<number>(0);
  protected readonly animatedRemainingPages = signal<number>(0);
  protected readonly animatedProgressPercent = signal<number>(0);
  protected readonly animatedTodayPages = signal<number>(0);
  protected readonly animatedPaceToBuffer = signal<number | null>(null);
  protected readonly animatedPaceToDeadline = signal<number | null>(null);
  protected readonly animatedAvgPace = signal<number>(0);

  private animFrameIds: number[] = [];
  private celebrationTimer: ReturnType<typeof setTimeout> | null = null;
  private initializedCounters = false;

  constructor() {
    effect(() => {
      const s = this.stats();
      const v = this.activeVariantStat();
      if (!this.initializedCounters) {
        this.initializedCounters = true;
        this.animatedCurrentPages.set(s.currentTranslatedPages);
        this.animatedRemainingPages.set(s.remainingPages);
        this.animatedProgressPercent.set(s.progressPercent);
        this.animatedTodayPages.set(s.todayTranslatedPages);
        this.animatedPaceToBuffer.set(v.requiredPagesPerDayToBuffer);
        this.animatedPaceToDeadline.set(v.requiredPagesPerDayToDeadline);
        this.animatedAvgPace.set(v.averageTranslatedPerActiveVariantDay);
        return;
      }

      this.cancelActiveAnimations();
      this.animateNumberSignal(this.animatedCurrentPages, s.currentTranslatedPages, 520);
      this.animateNumberSignal(this.animatedRemainingPages, s.remainingPages, 520);
      this.animateNumberSignal(this.animatedProgressPercent, s.progressPercent, 520);
      this.animateNumberSignal(this.animatedTodayPages, s.todayTranslatedPages, 520);
      this.animateNullableNumberSignal(this.animatedPaceToBuffer, v.requiredPagesPerDayToBuffer, 520);
      this.animateNullableNumberSignal(this.animatedPaceToDeadline, v.requiredPagesPerDayToDeadline, 520);
      this.animateNumberSignal(this.animatedAvgPace, v.averageTranslatedPerActiveVariantDay, 520);
    });

    effect(() => {
      const showChart = this.showChartAndMatrix();
      const canvasEl = this.canvasRef()?.nativeElement;
      const series = this.activeCumulativeSeries();
      const dark = this.isDarkTheme();
      if (showChart && canvasEl) {
        this.renderOrUpdateChart(canvasEl, series, dark);
      } else if (this.chartInstance) {
        this.chartInstance.destroy();
        this.chartInstance = null;
      }
    });
  }

  public ngOnDestroy(): void {
    this.cancelActiveAnimations();
    if (this.celebrationTimer) {
      clearTimeout(this.celebrationTimer);
    }
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
  }

  protected onPagesAddedCelebration(): void {
    if (this.celebrationTimer) {
      clearTimeout(this.celebrationTimer);
    }
    this.isCelebratingProgress.set(false);
    setTimeout(() => {
      this.isCelebratingProgress.set(true);
      this.celebrationTimer = setTimeout(() => {
        this.isCelebratingProgress.set(false);
      }, 1100);
    }, 15);
  }

  private cancelActiveAnimations(): void {
    if (typeof cancelAnimationFrame !== 'undefined') {
      for (const id of this.animFrameIds) {
        cancelAnimationFrame(id);
      }
    }
    this.animFrameIds = [];
  }

  private animateNullableNumberSignal(
    targetSignal: WritableSignal<number | null>,
    toValue: number | null,
    durationMs: number
  ): void {
    if (toValue === null) {
      targetSignal.set(null);
      return;
    }
    const fromValue = targetSignal() ?? toValue;
    if (
      typeof requestAnimationFrame === 'undefined' ||
      typeof performance === 'undefined' ||
      Math.abs(toValue - fromValue) < 0.05
    ) {
      targetSignal.set(toValue);
      return;
    }
    const startTime = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round((fromValue + (toValue - fromValue) * eased) * 10) / 10;
      targetSignal.set(current);
      if (t < 1) {
        this.animFrameIds.push(requestAnimationFrame(step));
      } else {
        targetSignal.set(toValue);
      }
    };
    this.animFrameIds.push(requestAnimationFrame(step));
  }

  private animateNumberSignal(
    targetSignal: WritableSignal<number>,
    toValue: number,
    durationMs: number
  ): void {
    const fromValue = targetSignal();
    if (
      typeof requestAnimationFrame === 'undefined' ||
      typeof performance === 'undefined' ||
      Math.abs(toValue - fromValue) < 0.05
    ) {
      targetSignal.set(toValue);
      return;
    }
    const startTime = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round((fromValue + (toValue - fromValue) * eased) * 10) / 10;
      targetSignal.set(current);
      if (t < 1) {
        this.animFrameIds.push(requestAnimationFrame(step));
      } else {
        targetSignal.set(toValue);
      }
    };
    this.animFrameIds.push(requestAnimationFrame(step));
  }

  protected selectVariant(variant: DayCountingVariantId): void {
    this.selectedVariant.set(variant);
  }

  protected toggleFullMatrix(): void {
    this.showFullVariantsMatrix.update(v => !v);
  }

  protected formatDisplayDate(iso: string): string {
    return this.calcService.formatDisplayDate(iso);
  }

  private renderOrUpdateChart(
    canvas: HTMLCanvasElement,
    series: CumulativeChartSeries,
    isDark: boolean
  ): void {
    if (series.labels.length === 0) {
      if (this.chartInstance) {
        this.chartInstance.destroy();
        this.chartInstance = null;
      }
      return;
    }

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

    const textColor = isDark ? '#94a3b8' : '#526580';
    const gridColor = isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(11, 37, 69, 0.08)';
    const actualColor = isDark ? '#38bdf8' : '#0071e3';
    const actualFill = isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(0, 113, 227, 0.09)';
    const plannedColor = isDark ? '#94a3b8' : '#0b2545';

    const actualLabel = this.translateService.get('books.stats.chart.actualCumulative');
    const plannedLabel = this.translateService.get('books.stats.chart.plannedCumulative');

    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }

    this.chartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels: series.labels,
        datasets: [
          {
            type: 'line',
            label: actualLabel,
            data: series.actualCumulative,
            borderColor: actualColor,
            backgroundColor: actualFill,
            borderWidth: isMobile ? 2 : 2.5,
            pointRadius: isMobile ? 1.5 : 3,
            pointHoverRadius: 5,
            pointBackgroundColor: actualColor,
            tension: 0.2,
            fill: true,
            spanGaps: true,
            order: 1
          },
          {
            type: 'line',
            label: plannedLabel,
            data: series.plannedCumulative,
            borderColor: plannedColor,
            borderWidth: isMobile ? 1.8 : 2,
            borderDash: [5, 4],
            pointRadius: isMobile ? 0 : 2,
            pointHoverRadius: 4,
            tension: 0,
            fill: false,
            order: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            border: {display: false},
            ticks: {
              color: textColor,
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: isMobile ? 5 : 10,
              font: {family: 'Inter, sans-serif', size: isMobile ? 10 : 12}
            },
            grid: {
              display: false
            }
          },
          y: {
            beginAtZero: true,
            border: {display: false},
            ticks: {
              color: textColor,
              precision: 0,
              maxTicksLimit: isMobile ? 5 : 6,
              font: {family: 'Inter, sans-serif', size: isMobile ? 10 : 12}
            },
            grid: {
              color: gridColor
            }
          }
        }
      }
    });

    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        this.chartInstance?.resize();
      });
    }
  }
}
