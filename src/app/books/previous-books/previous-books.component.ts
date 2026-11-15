import {ChangeDetectionStrategy, Component, computed, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterLink} from '@angular/router';
import {MatCardModule} from '@angular/material/card';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {TranslatePipe} from '@ngx-translate/core';
import {BookFacade} from '../../_database/book/book.facade';
import {BookStatsDashboardCardComponent} from '../shared/book-stats-dashboard-card/book-stats-dashboard-card.component';
import {SkeletonComponent} from '../../_shared-components/skeleton/skeleton.component';
import {RedirectionEnum} from '../../../utils/redirection.enum';

@Component({
  selector: 'app-previous-books',
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
  templateUrl: './previous-books.component.html',
  styleUrls: ['./previous-books.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PreviousBooksComponent {
  protected readonly bookFacade = inject(BookFacade);
  protected readonly rp = RedirectionEnum;

  protected readonly aggregateSummary = computed(() => {
    const completedStats = this.bookFacade.completedBooksStats() ?? [];
    const totalBooks = completedStats.length;
    const totalTranslatedPages = completedStats.reduce(
      (sum, item) => sum + item.currentTranslatedPages,
      0
    );
    const avgPagesPerActiveDay =
      totalBooks > 0
        ? Math.round(
            (completedStats.reduce(
              (sum, item) =>
                sum + item.variants.noWeekendsNoExcluded.averageTranslatedPerActiveVariantDay,
              0
            ) /
              totalBooks) *
              10
          ) / 10
        : 0;

    return {
      totalBooks,
      totalTranslatedPages,
      avgPagesPerActiveDay
    };
  });
}
