import {ChangeDetectionStrategy, Component, computed, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {toSignal} from '@angular/core/rxjs-interop';
import {map} from 'rxjs';
import {MatCardModule} from '@angular/material/card';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {TranslatePipe} from '@ngx-translate/core';
import {BookFacade} from '../../_database/book/book.facade';
import {BookCalculationService} from '../../_services/book/book-calculation.service';
import {SnackbarService} from '../../_services/util/snackbar.service';
import {DialogService} from '../../_services/util/dialog.service';
import {DialogType} from '../../_models/dialog/dialog-type';
import {CustomTranslateService} from '../../_services/translate/custom-translate.service';
import {BookStatsDashboardCardComponent} from '../shared/book-stats-dashboard-card/book-stats-dashboard-card.component';
import {SkeletonComponent} from '../../_shared-components/skeleton/skeleton.component';
import {RedirectionEnum} from '../../../utils/redirection.enum';
import {Book} from '../../_models/book/book';

@Component({
  selector: 'app-book-details',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    TranslatePipe,
    BookStatsDashboardCardComponent,
    SkeletonComponent
  ],
  templateUrl: './book-details.component.html',
  styleUrls: ['./book-details.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BookDetailsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly bookFacade = inject(BookFacade);
  protected readonly calcService = inject(BookCalculationService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialogService = inject(DialogService);
  private readonly translateService = inject(CustomTranslateService);
  protected readonly rp = RedirectionEnum;

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

  protected formatDisplayDate(iso: string): string {
    return this.calcService.formatDisplayDate(iso);
  }

  protected confirmDeleteBook(book: Book): void {
    if (!book.id) return;

    const dialogRef = this.dialogService.openConfirmDialogWithData({
      title: this.translateService.get('books.list.deleteConfirmTitle'),
      message: `${this.translateService.get('books.list.deleteConfirmMessage')} "${book.BookName}"?`,
      popupType: DialogType.WARNING,
      cancelButtonText: this.translateService.get('registeredUsers.details.cancel'),
      confirmButtonText: this.translateService.get('books.common.delete'),
      icon: 'delete_forever',
      iconColor: 'warn'
    });

    dialogRef.afterClosed().subscribe(async confirmed => {
      if (confirmed && book.id) {
        try {
          await this.bookFacade.deleteBook(book.id);
          this.snackbar.openSnackBar(this.translateService.get('books.list.deletedSuccess'));
          await this.router.navigate(['/' + this.rp.BOOKS]);
        } catch (e) {
          console.error(e);
          this.snackbar.openLongSnackBar(this.translateService.get('books.list.deletedError'));
        }
      }
    });
  }
}
