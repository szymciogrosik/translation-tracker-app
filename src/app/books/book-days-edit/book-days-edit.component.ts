import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
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
export class BookDaysEditComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
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
  protected readonly isSaving = signal(false);

  constructor() {
    effect(() => {
      const currentBook = this.book();
      if (currentBook) {
        this.draftEntries.set(
          currentBook.TranslatedPages.map(e => ({date: e.date, pages: e.pages}))
        );
      }
    });
  }

  protected readonly rows = computed<EditableDayRow[]>(() => {
    const b = this.book();
    const entries = this.draftEntries();
    if (!b) return [];

    const excludedSet = new Set(b.ExcludedDays ?? []);
    const result: EditableDayRow[] = [];
    let lastValidPages = 0;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const dt = DateTime.fromISO(entry.date, {zone: DateService.timeZone});
      const weekday = dt.isValid ? dt.weekday : 1;
      const isWeekend = weekday === 6 || weekday === 7;
      const isExcluded = excludedSet.has(entry.date);

      let error: string | null = null;
      let dailyDelta: number | null = null;

      if (entry.pages !== null && entry.pages !== undefined) {
        const num = Number(entry.pages);
        if (Number.isNaN(num) || !Number.isInteger(num)) {
          error = this.translateService.get('books.dailyEntry.error.integer');
        } else if (num < lastValidPages) {
          error = `${this.translateService.get('books.dailyEntry.error.minPages')} (${lastValidPages})`;
        } else if (num > b.NumberOfPages) {
          error = `${this.translateService.get('books.dailyEntry.error.maxPages')} (${b.NumberOfPages})`;
        } else {
          dailyDelta = num - lastValidPages;
          lastValidPages = num;
        }
      }

      result.push({
        index: i,
        date: entry.date,
        displayDate: this.calcService.formatDisplayDate(entry.date),
        weekdayKey: `books.weekday.${weekday}`,
        isWeekend,
        isExcluded,
        pagesInput: entry.pages === null || entry.pages === undefined ? '' : String(entry.pages),
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
    const trimmed = rawValue === null || rawValue === undefined ? '' : String(rawValue).trim();
    const parsedValue = trimmed === '' ? null : Number(trimmed);

    this.draftEntries.update(list =>
      list.map((item, idx) => (idx === index ? {...item, pages: parsedValue} : item))
    );
  }

  protected clearRow(index: number): void {
    this.onRowInputChange(index, '');
  }

  protected async saveAllDays(): Promise<void> {
    const currentBook = this.book();
    if (!currentBook?.id || this.hasValidationErrors() || this.isSaving()) {
      return;
    }

    this.isSaving.set(true);
    try {
      await this.bookFacade.updateAllDayEntries(currentBook.id, this.draftEntries());
      this.snackbar.openSnackBar(this.translateService.get('books.daysEdit.savedSuccess'));
      await this.router.navigate(['/books', currentBook.id]);
    } catch (err) {
      console.error(err);
      this.snackbar.openLongSnackBar(this.translateService.get('books.daysEdit.savedError'));
    } finally {
      this.isSaving.set(false);
    }
  }
}
