import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
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
  selector: 'app-books-dashboard',
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
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent {
  protected readonly bookFacade = inject(BookFacade);
  protected readonly rp = RedirectionEnum;
}
