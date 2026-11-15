import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {StarterShowcaseComponent} from './starter-showcase/starter-showcase.component';
import {DashboardComponent} from '../books/dashboard/dashboard.component';
import {AuthService} from '../_services/auth/auth.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  standalone: true,
  imports: [StarterShowcaseComponent, DashboardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent {
  protected readonly authService = inject(AuthService);
  protected readonly isAuthenticated = this.authService.isLoggedIn;
}
