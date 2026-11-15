import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
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

  private readonly bookFacade = inject(BookFacade);
  private readonly snackbarService = inject(SnackbarService);
  private readonly translateService = inject(CustomTranslateService);

  protected readonly customPagesValue = signal<number>(0);
  protected readonly isTransitioning = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly validationError = signal<string | null>(null);

  protected readonly dailyDeltaPreview = computed(() => {
    const info = this.pendingInfo();
    return Math.max(0, Number(this.customPagesValue()) - info.minAllowedPages);
  });

  constructor() {
    effect(() => {
      const info = this.pendingInfo();
      this.customPagesValue.set(info.suggestedCumulativePages);
      this.validationError.set(null);
    });
  }

  protected adjustPages(delta: number): void {
    const info = this.pendingInfo();
    const current = Number(this.customPagesValue() ?? info.suggestedCumulativePages);
    const next = Math.min(
      info.maxAllowedPages,
      Math.max(info.minAllowedPages, current + delta)
    );
    this.customPagesValue.set(next);
    this.validationError.set(null);
  }

  protected onManualInputChange(rawValue: string | number): void {
    const parsed = Number(rawValue);
    this.customPagesValue.set(Number.isNaN(parsed) ? 0 : parsed);
    this.validateCurrentValue();
  }

  private validateCurrentValue(): boolean {
    const info = this.pendingInfo();
    const val = Number(this.customPagesValue());
    if (Number.isNaN(val) || !Number.isInteger(val)) {
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
    const pagesToSave = Number(this.customPagesValue());
    this.isSaving.set(true);
    this.isTransitioning.set(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 200));
      await this.bookFacade.updateDayEntry(this.book(), info.entryIndex, pagesToSave);
      this.snackbarService.openSnackBar(
        this.translateService.get('books.dailyEntry.savedSuccess')
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
      }, 160);
    }
  }
}
