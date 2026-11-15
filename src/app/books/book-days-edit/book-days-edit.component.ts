import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, RouterLink} from '@angular/router';
import {toSignal} from '@angular/core/rxjs-interop';
import {map} from 'rxjs';
import {MatCardModule} from '@angular/material/card';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {TranslatePipe} from '@ngx-translate/core';
import {DateTime} from 'luxon';
import {BookFacade} from '../../_database/book/book.facade';
import {BookCalculationService} from '../../_services/book/book-calculation.service';
import {BookDayEntry} from '../../_models/book/book';
import {SnackbarService} from '../../_services/util/snackbar.service';
import {CustomTranslateService} from '../../_services/translate/custom-translate.service';
import {SkeletonComponent} from '../../_shared-components/skeleton/skeleton.component';
import {DateService} from '../../_services/util/date.service';

export interface EditableDayRow {
  index: number;
  date: string;
  displayDate: string;
  weekdayKey: string;
  isWeekend: boolean;
  isExcluded: boolean;
  isToday: boolean;
  pagesInput: string;
  dailyDelta: number | null;
  error: string | null;
}

@Component({
  selector: 'app-book-days-edit',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    TranslatePipe,
    SkeletonComponent
  ],
  templateUrl: './book-days-edit.component.html',
  styleUrls: ['./book-days-edit.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BookDaysEditComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  protected readonly bookFacade = inject(BookFacade);
  protected readonly calcService = inject(BookCalculationService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translateService = inject(CustomTranslateService);

  protected readonly bookId = toSignal(
    this.route.paramMap.pipe(map(params => params.get('id') ?? '')),
    {initialValue: ''}
  );

  protected readonly book = computed(() => {
    const id = this.bookId();
    const list = this.bookFacade.allBooks();
    if (list === undefined) return undefined;
    return list.find(b => b.id === id) ?? null;
  });

  protected readonly draftEntries = signal<BookDayEntry[]>([]);
  protected readonly rawInputs = signal<string[]>([]);
  protected readonly isSaving = signal(false);
  protected readonly showSavedIndicator = signal(false);
  private loadedBookId: string | null = null;
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const currentBook = this.book();
      if (currentBook && currentBook.id && this.loadedBookId !== currentBook.id) {
        this.loadedBookId = currentBook.id;
        this.draftEntries.set(
          currentBook.TranslatedPages.map(e => ({date: e.date, pages: e.pages}))
        );
        this.rawInputs.set(
          currentBook.TranslatedPages.map(e =>
            e.pages === null || e.pages === undefined ? '' : String(e.pages)
          )
        );
      }
    });
  }

  public ngOnDestroy(): void {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  private hasMaxOneDecimal(val: number): boolean {
    return Number.isFinite(val) && Math.abs(Math.round(val * 10) - val * 10) < 1e-6;
  }

  protected readonly rows = computed<EditableDayRow[]>(() => {
    const b = this.book();
    const entries = this.draftEntries();
    const rawList = this.rawInputs();
    if (!b) return [];

    const excludedSet = new Set(b.ExcludedDays ?? []);
    const todayIso = this.calcService.getTodayIso();
    const result: EditableDayRow[] = [];
    let lastValidPages = 0;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const rawInput =
        rawList[i] !== undefined
          ? rawList[i]
          : entry.pages === null || entry.pages === undefined
            ? ''
            : String(entry.pages);
      const normalizedRaw = rawInput.trim().replace(',', '.');
      const dt = DateTime.fromISO(entry.date, {zone: DateService.timeZone});
      const weekday = dt.isValid ? dt.weekday : 1;
      const isWeekend = weekday === 6 || weekday === 7;
      const isExcluded = excludedSet.has(entry.date);
      const isToday = entry.date === todayIso;

      let error: string | null = null;
      let dailyDelta: number | null = null;

      if (normalizedRaw !== '' || (entry.pages !== null && entry.pages !== undefined)) {
        const num = Number(entry.pages);
        if (
          normalizedRaw === '' ||
          Number.isNaN(num) ||
          !/^\d+(\.\d)?$/.test(normalizedRaw) ||
          !this.hasMaxOneDecimal(num)
        ) {
          error = this.translateService.get('books.dailyEntry.error.integer');
        } else if (num < lastValidPages) {
          error = `${this.translateService.get('books.dailyEntry.error.minPages')} (${lastValidPages})`;
        } else if (num > b.NumberOfPages) {
          error = `${this.translateService.get('books.dailyEntry.error.maxPages')} (${b.NumberOfPages})`;
        } else {
          dailyDelta = Math.round((num - lastValidPages) * 10) / 10;
          lastValidPages = Math.round(num * 10) / 10;
        }
      }

      result.push({
        index: i,
        date: entry.date,
        displayDate: this.calcService.formatDisplayDate(entry.date),
        weekdayKey: `books.weekday.${weekday}`,
        isWeekend,
        isExcluded,
        isToday,
        pagesInput: rawInput,
        dailyDelta,
        error
      });
    }

    return result;
  });

  protected readonly hasValidationErrors = computed(() =>
    this.rows().some(r => r.error !== null)
  );

  protected onRowInputChange(index: number, rawValue: string | number | null): void {
    const rawStr = rawValue === null || rawValue === undefined ? '' : String(rawValue);
    this.rawInputs.update(list => list.map((item, idx) => (idx === index ? rawStr : item)));

    const normalized = rawStr.trim().replace(',', '.');
    const parsedValue =
      normalized === ''
        ? null
        : /^\d+(\.\d)?$/.test(normalized)
          ? Math.round(Number(normalized) * 10) / 10
          : Number.NaN;

    this.draftEntries.update(list =>
      list.map((item, idx) => (idx === index ? {...item, pages: parsedValue} : item))
    );
    this.scheduleAutoSave();
  }

  protected clearRow(index: number): void {
    this.onRowInputChange(index, '');
  }

  private scheduleAutoSave(): void {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }
    this.showSavedIndicator.set(false);
    this.autoSaveTimer = setTimeout(() => {
      void this.persistAutoSave();
    }, 500);
  }

  private async persistAutoSave(): Promise<void> {
    const currentBook = this.book();
    if (!currentBook?.id || this.hasValidationErrors()) {
      return;
    }

    this.isSaving.set(true);
    try {
      await this.bookFacade.updateAllDayEntries(currentBook.id, this.draftEntries());
      this.showSavedIndicator.set(true);
      this.snackbar.openCustomSnackBar(
        this.translateService.get('books.dailyEntry.savedSuccess'),
        '',
        2000
      );
    } catch (err) {
      console.error(err);
      this.snackbar.openLongSnackBar(this.translateService.get('books.daysEdit.savedError'));
    } finally {
      this.isSaving.set(false);
    }
  }

  protected scrollToToday(): void {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }
    const todayIso = this.calcService.getTodayIso();
    const todayEl = document.getElementById(`day-row-${todayIso}`);
    if (todayEl) {
      todayEl.scrollIntoView({behavior: 'smooth', block: 'center'});
      return;
    }

    const bottomEl = document.getElementById('days-edit-bottom-actions');
    if (bottomEl) {
      bottomEl.scrollIntoView({behavior: 'smooth', block: 'end'});
    } else {
      window.scrollTo({top: document.body.scrollHeight, behavior: 'smooth'});
    }
  }
}
