import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {toSignal} from '@angular/core/rxjs-interop';
import {firstValueFrom, map} from 'rxjs';
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
import {DialogService} from '../../_services/util/dialog.service';
import {DialogType} from '../../_models/dialog/dialog-type';
import {SnackbarService} from '../../_services/util/snackbar.service';
import {CustomTranslateService} from '../../_services/translate/custom-translate.service';
import {SkeletonComponent} from '../../_shared-components/skeleton/skeleton.component';
import {DateService} from '../../_services/util/date.service';

@Component({
  selector: 'app-book-settings-edit',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
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
  templateUrl: './book-settings-edit.component.html',
  styleUrls: ['./book-settings-edit.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BookSettingsEditComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  protected readonly bookFacade = inject(BookFacade);
  protected readonly calcService = inject(BookCalculationService);
  private readonly dialogService = inject(DialogService);
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

  protected readonly excludedDaysDraft = signal<string[]>([]);
  protected readonly isSaving = signal(false);
  protected readonly formError = signal<string | null>(null);
  private initializedForId: string | null = null;

  protected readonly settingsForm: FormGroup = this.fb.group({
    BookName: ['', [Validators.required, Validators.maxLength(160)]],
    NumberOfPages: [100, [Validators.required, Validators.min(1), Validators.max(20000)]],
    StartDate: [DateTime.now(), [Validators.required]],
    EndDate: [DateTime.now(), [Validators.required]],
    BufforDayNumber: [0, [Validators.required, Validators.min(0), Validators.max(365)]],
    ExcludedDateCandidate: [null]
  });

  constructor() {
    effect(() => {
      const currentBook = this.book();
      if (currentBook && currentBook.id !== this.initializedForId) {
        this.initializedForId = currentBook.id ?? null;
        this.settingsForm.patchValue({
          BookName: currentBook.BookName,
          NumberOfPages: currentBook.NumberOfPages,
          StartDate: DateTime.fromISO(currentBook.StartDate, {zone: DateService.timeZone}),
          EndDate: DateTime.fromISO(currentBook.EndDate, {zone: DateService.timeZone}),
          BufforDayNumber: currentBook.BufforDayNumber,
          ExcludedDateCandidate: null
        });
        this.excludedDaysDraft.set([...(currentBook.ExcludedDays ?? [])].sort());
      }
    });
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
    const current = this.excludedDaysDraft();
    if (current.length > 0) {
      const lastDt = DateTime.fromISO(current[current.length - 1], {zone: DateService.timeZone});
      if (lastDt.isValid) {
        this.vacationCalendarActiveDate.set(lastDt);
        return;
      }
    }
    const startVal = this.settingsForm.get('StartDate')?.value;
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

  protected formatDisplayDate(iso: string): string {
    return this.calcService.formatDisplayDate(iso);
  }

  protected async saveSettings(): Promise<void> {
    const currentBook = this.book();
    if (!currentBook?.id || this.settingsForm.invalid || this.isSaving()) {
      this.settingsForm.markAllAsTouched();
      return;
    }

    const raw = this.settingsForm.value;
    const startDt: DateTime =
      raw.StartDate instanceof DateTime
        ? raw.StartDate
        : DateTime.fromJSDate(new Date(raw.StartDate));
    const endDt: DateTime =
      raw.EndDate instanceof DateTime
        ? raw.EndDate
        : DateTime.fromJSDate(new Date(raw.EndDate));

    if (!startDt.isValid || !endDt.isValid || endDt.startOf('day') < startDt.startOf('day')) {
      this.formError.set(this.translateService.get('books.form.error.endBeforeStart'));
      return;
    }

    const newStartIso = startDt.toFormat('yyyy-MM-dd');
    const newEndIso = endDt.toFormat('yyyy-MM-dd');
    const newNumberOfPages = Number(raw.NumberOfPages);

    const shifted = this.calcService.shiftBookDates(
      {
        ...currentBook,
        ExcludedDays: this.excludedDaysDraft()
      },
      newStartIso,
      newEndIso
    );

    if (shifted.hasDataLoss) {
      const dialogRef = this.dialogService.openConfirmDialogWithData({
        title: this.translateService.get('books.settings.shortenWarningTitle'),
        message: `${this.translateService.get('books.settings.shortenWarningMessage')} (${shifted.lostEntriesCount})`,
        popupType: DialogType.WARNING,
        cancelButtonText: this.translateService.get('registeredUsers.details.cancel'),
        confirmButtonText: this.translateService.get('registeredUsers.details.confirm'),
        icon: 'warning_amber',
        iconColor: 'warn'
      });

      const confirmed = await firstValueFrom(dialogRef.afterClosed());
      if (!confirmed) {
        return;
      }
    }

    this.formError.set(null);
    this.isSaving.set(true);

    try {
      await this.bookFacade.updateBookSettings(currentBook.id, {
        BookName: String(raw.BookName).trim(),
        NumberOfPages: newNumberOfPages,
        StartDate: newStartIso,
        EndDate: newEndIso,
        BufforDayNumber: Number(raw.BufforDayNumber),
        TranslatedPages: shifted.translatedPages,
        ExcludedDays: shifted.excludedDays
      });
      this.snackbar.openSnackBar(this.translateService.get('books.settings.savedSuccess'));
      await this.router.navigate(['/books', currentBook.id]);
    } catch (err) {
      console.error(err);
      this.snackbar.openLongSnackBar(this.translateService.get('books.settings.savedError'));
    } finally {
      this.isSaving.set(false);
    }
  }
}
