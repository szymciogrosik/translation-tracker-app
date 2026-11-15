import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {TranslatePipe} from '@ngx-translate/core';
import {Book, NextPendingDayInfo} from '../../../_models/book/book';
import {BookFacade} from '../../../_database/book/book.facade';
import {SnackbarService} from '../../../_services/util/snackbar.service';
import {CustomTranslateService} from '../../../_services/translate/custom-translate.service';

export interface ConfettiSpark {
  id: number;
  tx: string;
  ty: string;
  rot: string;
  size: string;
  delay: string;
  isPrimary: boolean;
}

@Component({
  selector: 'app-daily-entry-box',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    TranslatePipe
  ],
  templateUrl: './daily-entry-box.component.html',
  styleUrls: ['./daily-entry-box.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DailyEntryBoxComponent {
  public readonly book = input.required<Book>();
  public readonly pendingInfo = input.required<NextPendingDayInfo>();
  public readonly pagesAddedCelebration = output<number>();

  private readonly bookFacade = inject(BookFacade);
  private readonly snackbarService = inject(SnackbarService);
  private readonly translateService = inject(CustomTranslateService);

  protected readonly customPagesValue = signal<number>(0);
  protected readonly customPagesInput = signal<string>('0');
  protected readonly isTransitioning = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly validationError = signal<string | null>(null);

  protected readonly isDeltaBumping = signal(false);
  protected readonly celebrationBurstDelta = signal<number | null>(null);
  protected readonly confettiSparks = signal<ConfettiSpark[]>([]);
  private bumpTimer: ReturnType<typeof setTimeout> | null = null;
  private burstTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly dailyDeltaPreview = computed(() => {
    const info = this.pendingInfo();
    return Math.max(
      0,
      Math.round((Number(this.customPagesValue()) - info.minAllowedPages) * 10) / 10
    );
  });

  constructor() {
    effect(() => {
      const info = this.pendingInfo();
      this.customPagesValue.set(info.suggestedCumulativePages);
      this.customPagesInput.set(String(info.suggestedCumulativePages));
      this.validationError.set(null);
    });
  }

  protected adjustPages(delta: number): void {
    const info = this.pendingInfo();
    const current = Number(this.customPagesValue() ?? info.suggestedCumulativePages);
    const next = Math.min(
      info.maxAllowedPages,
      Math.max(info.minAllowedPages, Math.round((current + delta) * 10) / 10)
    );
    this.customPagesValue.set(next);
    this.customPagesInput.set(String(next));
    this.validationError.set(null);
    this.triggerDeltaBump();
  }

  protected onManualInputChange(rawValue: string | number): void {
    const rawStr = rawValue === null || rawValue === undefined ? '' : String(rawValue);
    this.customPagesInput.set(rawStr);
    const normalized = rawStr.trim().replace(',', '.');
    const parsed = normalized === '' ? Number.NaN : Number(normalized);
    this.customPagesValue.set(Number.isNaN(parsed) ? Number.NaN : parsed);
    this.validateCurrentValue();
    this.triggerDeltaBump();
  }

  private triggerDeltaBump(): void {
    if (this.bumpTimer) {
      clearTimeout(this.bumpTimer);
    }
    this.isDeltaBumping.set(false);
    setTimeout(() => {
      this.isDeltaBumping.set(true);
      this.bumpTimer = setTimeout(() => {
        this.isDeltaBumping.set(false);
      }, 280);
    }, 10);
  }

  private launchConfettiBurst(deltaAdded: number): void {
    if (this.burstTimer) {
      clearTimeout(this.burstTimer);
    }
    this.celebrationBurstDelta.set(deltaAdded);

    const count = deltaAdded > 0 ? 18 : 10;
    const sparks: ConfettiSpark[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.35;
      const dist = 36 + Math.random() * 54;
      const tx = `${Math.round(Math.cos(angle) * dist)}px`;
      const ty = `${Math.round(Math.sin(angle) * dist - 18)}px`;
      const rot = `${Math.round((Math.random() - 0.5) * 260)}deg`;
      const size = `${Math.round(5 + Math.random() * 5)}px`;
      const delay = `${Math.round(Math.random() * 70)}ms`;
      sparks.push({
        id: i,
        tx,
        ty,
        rot,
        size,
        delay,
        isPrimary: i % 3 === 0
      });
    }
    this.confettiSparks.set(sparks);

    this.burstTimer = setTimeout(() => {
      this.celebrationBurstDelta.set(null);
      this.confettiSparks.set([]);
    }, 950);
  }

  private hasMaxOneDecimal(val: number): boolean {
    return Number.isFinite(val) && Math.abs(Math.round(val * 10) - val * 10) < 1e-6;
  }

  private validateCurrentValue(): boolean {
    const info = this.pendingInfo();
    const rawTrimmed = this.customPagesInput().trim().replace(',', '.');
    const val = Number(this.customPagesValue());
    if (
      rawTrimmed === '' ||
      Number.isNaN(val) ||
      !/^\d+(\.\d)?$/.test(rawTrimmed) ||
      !this.hasMaxOneDecimal(val)
    ) {
      this.validationError.set(this.translateService.get('books.dailyEntry.error.integer'));
      return false;
    }
    if (val < info.minAllowedPages) {
      this.validationError.set(
        `${this.translateService.get('books.dailyEntry.error.minPages')} (${info.minAllowedPages})`
      );
      return false;
    }
    if (val > info.maxAllowedPages) {
      this.validationError.set(
        `${this.translateService.get('books.dailyEntry.error.maxPages')} (${info.maxAllowedPages})`
      );
      return false;
    }
    this.validationError.set(null);
    return true;
  }

  protected async saveCurrentValue(): Promise<void> {
    if (!this.validateCurrentValue()) {
      return;
    }
    const info = this.pendingInfo();
    if (info.entryIndex < 0 || this.isSaving()) {
      return;
    }
    const pagesToSave = Math.round(Number(this.customPagesValue()) * 10) / 10;
    const addedDelta = Math.max(0, Math.round((pagesToSave - info.minAllowedPages) * 10) / 10);
    this.isSaving.set(true);
    this.launchConfettiBurst(addedDelta);
    this.pagesAddedCelebration.emit(addedDelta);

    try {
      await new Promise(resolve => setTimeout(resolve, 420));
      this.isTransitioning.set(true);
      await this.bookFacade.updateDayEntry(this.book(), info.entryIndex, pagesToSave);
      this.snackbarService.openCustomSnackBar(
        this.translateService.get('books.dailyEntry.savedSuccess'),
        '',
        2200
      );
    } catch (err) {
      console.error(err);
      this.snackbarService.openLongSnackBar(
        this.translateService.get('books.dailyEntry.savedError')
      );
    } finally {
      setTimeout(() => {
        this.isTransitioning.set(false);
        this.isSaving.set(false);
      }, 220);
    }
  }
}
