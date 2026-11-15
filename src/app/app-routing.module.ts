import {RouterModule, Routes} from '@angular/router';
import {HomeComponent} from './home/home.component';
import {RedirectionEnum} from '../utils/redirection.enum';
import {StatusComponent} from "./status/status.component";
import {LoginComponent} from "./login/login.component";
import {AdminComponent} from "./admin/admin.component";
import {authenticatedGuard} from "./_services/guard/authenticatedGuard";
import {adminPageGuard} from "./_services/guard/adminPageGuard";
import {ProfileComponent} from "./profile/profile.component";
import {PrivacyPolicyComponent} from "./legal/privacy-policy/privacy-policy.component";
import {TermsOfServiceComponent} from "./legal/terms-of-service/terms-of-service.component";
import {CookiePolicyComponent} from "./legal/cookie-policy/cookie-policy.component";
import {BooksListComponent} from "./books/books-list/books-list.component";
import {PreviousBooksComponent} from "./books/previous-books/previous-books.component";
import {BookDetailsComponent} from "./books/book-details/book-details.component";
import {BookDaysEditComponent} from "./books/book-days-edit/book-days-edit.component";
import {BookSettingsEditComponent} from "./books/book-settings-edit/book-settings-edit.component";

const appRoutes: Routes = [
  {
    path: RedirectionEnum.HOME,
    component: HomeComponent
  },
  {
    path: RedirectionEnum.BOOKS,
    component: BooksListComponent,
    canActivate: [authenticatedGuard]
  },
  {
    path: RedirectionEnum.BOOKS_HISTORY,
    component: PreviousBooksComponent,
    canActivate: [authenticatedGuard]
  },
  {
    path: RedirectionEnum.BOOK_DETAILS,
    component: BookDetailsComponent,
    canActivate: [authenticatedGuard]
  },
  {
    path: RedirectionEnum.BOOK_DAYS_EDIT,
    component: BookDaysEditComponent,
    canActivate: [authenticatedGuard]
  },
  {
    path: RedirectionEnum.BOOK_SETTINGS_EDIT,
    component: BookSettingsEditComponent,
    canActivate: [authenticatedGuard]
  },
  {
    path: RedirectionEnum.STATUS,
    component: StatusComponent
  },
  {
    path: RedirectionEnum.LOGIN,
    component: LoginComponent
  },
  {
    path: RedirectionEnum.ADMIN,
    component: AdminComponent,
    canActivate: [authenticatedGuard, adminPageGuard]
  },
  {
    path: RedirectionEnum.PROFILE,
    component: ProfileComponent,
    canActivate: [authenticatedGuard]
  },
  {
    path: RedirectionEnum.PRIVACY_POLICY,
    component: PrivacyPolicyComponent
  },
  {
    path: RedirectionEnum.TERMS,
    component: TermsOfServiceComponent
  },
  {
    path: RedirectionEnum.COOKIES,
    component: CookiePolicyComponent
  },
  // otherwise redirect to home
  {path: '**', redirectTo: ''}
];

export const routing = RouterModule.forRoot(appRoutes, {
  scrollPositionRestoration: 'top',
  anchorScrolling: 'enabled'
});
