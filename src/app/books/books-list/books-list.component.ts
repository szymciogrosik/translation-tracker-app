import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {Router, RouterLink} from '@angular/router';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatCardModule} from '@angular/material/card';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatCalendarCellClassFunction, MatDatepickerModule} from '@angular/material/datepicker';
import {MatMenuModule} from '@angular/material/menu';
import {TranslatePipe} from '@ngx-translate/core';
import {DateTime} from 'luxon';
import {BookFacade} from '../../_database/book/book.facade';
import {BookCalculationService} from '../../_services/book/book-calculation.service';
import {SnackbarService} from '../../_services/util/snackbar.service';
import {CustomTranslateService} from '../../_services/translate/custom-translate.service';
import {SkeletonComponent} from '../../_shared-components/skeleton/skeleton.component';
import {Book} from '../../_models/book/book';

@Component({
  selector: 'app-books-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatMenuModule,
    TranslatePipe,
    SkeletonComponent
  ],
  templateUrl: './books-list.component.html',
  styleUrls: ['./books-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BooksListComponent {
  protected readonly bookFacade = inject(BookFacade);
  protected readonly calcService = inject(BookCalculationService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly snackbar = inject(SnackbarService);
  private readonly translateService = inject(CustomTranslateService);

  protected readonly showCreateForm = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly excludedDaysDraft = signal<string[]>([]);
  protected readonly dateRangeError = signal<string | null>(null);

  protected readonly createBookForm: FormGroup = this.fb.group({
    BookName: ['', [Validators.required, Validators.maxLength(160)]],
    NumberOfPages: [200, [Validators.required, Validators.min(1), Validators.max(20000)]],
    StartDate: [DateTime.now(), [Validators.required]],
    EndDate: [DateTime.now().plus({days: 30}), [Validators.required]],
    BufforDayNumber: [3, [Validators.required, Validators.min(0), Validators.max(365)]],
    ExcludedDateCandidate: [null]
  });

  protected toggleCreateForm(): void {
    this.showCreateForm.update(v => !v);
    this.dateRangeError.set(null);
  }

  protected readonly showVacationCalendar = signal(false);
  protected readonly vacationCalendarActiveDate = signal<DateTime>(DateTime.now());

  protected readonly dateClass = computed<MatCalendarCellClassFunction<DateTime>>(() => {
    const excludedSet = new Set(this.excludedDaysDraft());
    return (cellDate, view) => {
      if (view !== 'month') {
        return '';
      }
      const iso =
        cellDate instanceof DateTime
          ? cellDate.toFormat('yyyy-MM-dd')
          : DateTime.fromJSDate(new Date(cellDate as unknown as Date)).toFormat('yyyy-MM-dd');
      return excludedSet.has(iso) ? 'is-excluded-calendar-date' : '';
    };
  });

  protected prepareVacationCalendarOpen(): void {
    const startVal = this.createBookForm.get('StartDate')?.value;
    if (startVal instanceof DateTime && startVal.isValid) {
      this.vacationCalendarActiveDate.set(startVal);
    }
  }

  protected onExcludedDateChange(selected: DateTime | Date | null): void {
    if (!selected) {
      return;
    }
    const dt = selected instanceof DateTime ? selected : DateTime.fromJSDate(new Date(selected));
    if (!dt.isValid) {
      return;
    }
    this.vacationCalendarActiveDate.set(dt);
    const iso = dt.toFormat('yyyy-MM-dd');
    const current = this.excludedDaysDraft();
    if (current.includes(iso)) {
      this.excludedDaysDraft.set(current.filter(d => d !== iso));
    } else {
      this.excludedDaysDraft.set([...current, iso].sort());
    }
  }

  protected removeExcludedDay(iso: string): void {
    this.excludedDaysDraft.update(list => list.filter(d => d !== iso));
  }

  protected async submitNewBook(): Promise<void> {
    if (this.createBookForm.invalid) {
      this.createBookForm.markAllAsTouched();
      return;
    }

    const raw = this.createBookForm.value;
    const startDt: DateTime = raw.StartDate instanceof DateTime ? raw.StartDate : DateTime.fromJSDate(new Date(raw.StartDate));
    const endDt: DateTime = raw.EndDate instanceof DateTime ? raw.EndDate : DateTime.fromJSDate(new Date(raw.EndDate));

    if (!startDt.isValid || !endDt.isValid || endDt.startOf('day') < startDt.startOf('day')) {
      this.dateRangeError.set(this.translateService.get('books.form.error.endBeforeStart'));
      return;
    }

    this.dateRangeError.set(null);
    this.isSubmitting.set(true);

    const startIso = startDt.toFormat('yyyy-MM-dd');
    const endIso = endDt.toFormat('yyyy-MM-dd');
    const validExcluded = this.excludedDaysDraft().filter(d => d >= startIso && d <= endIso);

    try {
      const createdId = await this.bookFacade.createBook({
        BookName: raw.BookName,
        NumberOfPages: Number(raw.NumberOfPages),
        StartDate: startIso,
        EndDate: endIso,
        BufforDayNumber: Number(raw.BufforDayNumber),
        ExcludedDays: validExcluded
      });
      this.snackbar.openSnackBar(this.translateService.get('books.list.createdSuccess'));
      this.showCreateForm.set(false);
      this.excludedDaysDraft.set([]);
      await this.router.navigate(['/books', createdId]);
    } catch (err) {
      console.error(err);
      this.snackbar.openLongSnackBar(this.translateService.get('books.list.createdError'));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  protected formatDisplayDate(iso: string): string {
    return this.calcService.formatDisplayDate(iso);
  }

  protected getBookProgressPercent(book: Book): number {
    const current = this.calcService.getCurrentTranslatedPages(book);
    if (!book.NumberOfPages || book.NumberOfPages <= 0) return 0;
    return Math.min(100, Math.round((current / book.NumberOfPages) * 1000) / 10);
  }

  protected getRemainingDaysToBuffer(book: Book): number {
    const stats = this.calcService.computeBookStatistics(book);
    return stats.variants.noWeekendsNoExcluded.remainingDaysToBuffer;
  }
}
