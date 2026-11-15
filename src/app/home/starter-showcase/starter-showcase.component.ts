import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterLink} from '@angular/router';
import {MatCardModule} from '@angular/material/card';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {AuthService} from '../../_services/auth/auth.service';
import {CustomTranslateService} from '../../_services/translate/custom-translate.service';
import {BookCalculationService} from '../../_services/book/book-calculation.service';
import {SnackbarService} from '../../_services/util/snackbar.service';
import {DialogService} from '../../_services/util/dialog.service';
import {DialogType} from '../../_models/dialog/dialog-type';
import {Book, BookComputedStatistics, DayCountingVariantId} from '../../_models/book/book';
import {RedirectionEnum} from '../../../utils/redirection.enum';
import {LanguageEnum} from '../../_services/translate/language-enum';
import {APP_CONFIG} from '../../app.config.token';

export type WorkflowStepId = 'plan' | 'daily' | 'analytics';

interface ShowcaseCopy {
  readonly badge: string;
  readonly heroTitlePrefix: string;
  readonly heroTitleAccent: string;
  readonly heroSubtitle: string;
  readonly ctaLogin: string;
  readonly ctaWorkspace: string;
  readonly ctaProfile: string;
  readonly ctaExplore: string;
  readonly welcomeBack: string;
  readonly guestMode: string;
  readonly pillar1Label: string;
  readonly pillar1Value: string;
  readonly pillar2Label: string;
  readonly pillar2Value: string;
  readonly pillar3Label: string;
  readonly pillar3Value: string;

  readonly compareTag: string;
  readonly compareTitle: string;
  readonly compareSubtitle: string;
  readonly guestBoxTag: string;
  readonly guestBoxTitle: string;
  readonly guestBoxItems: ReadonlyArray<string>;
  readonly memberBoxTag: string;
  readonly memberBoxTitle: string;
  readonly memberBoxItems: ReadonlyArray<string>;
  readonly memberCtaBtn: string;

  readonly workflowTag: string;
  readonly workflowTitle: string;
  readonly workflowSubtitle: string;
  readonly workflowSteps: Record<
    WorkflowStepId,
    {
      readonly step: string;
      readonly navTitle: string;
      readonly navSub: string;
      readonly icon: string;
      readonly title: string;
      readonly subtitle: string;
      readonly description: string;
      readonly specs: ReadonlyArray<{readonly label: string; readonly value: string}>;
    }
  >;

  readonly sandboxTag: string;
  readonly sandboxTitle: string;
  readonly sandboxSubtitle: string;
  readonly sandboxBookTitle: string;
  readonly sandboxBookMeta: string;
  readonly sandboxProgressLabel: string;
  readonly sandboxTodayInputLabel: string;
  readonly sandboxDeltaPrefix: string;
  readonly sandboxVariantLabel: string;
  readonly sandboxVariantNames: Record<DayCountingVariantId, string>;
  readonly sandboxPaceBufferLabel: string;
  readonly sandboxPaceDeadlineLabel: string;
  readonly sandboxAvgPaceLabel: string;
  readonly sandboxRemainingBufferPrefix: string;
  readonly sandboxRemainingDeadlinePrefix: string;
  readonly sandboxDaysUnit: string;
  readonly sandboxPagesUnit: string;
  readonly sandboxPagesPerDayUnit: string;
  readonly sandboxSaveBtn: string;
  readonly sandboxResetBtn: string;
  readonly sandboxShiftTestBtn: string;
  readonly sandboxSavedToast: string;
  readonly sandboxShiftModalTitle: string;
  readonly sandboxShiftModalMsg: string;
  readonly sandboxModalConfirm: string;
  readonly sandboxModalCancel: string;

  readonly workspaceTag: string;
  readonly workspaceTitle: string;
  readonly workspaceSubtitle: string;
  readonly workspaceLedgerHeaderBook: string;
  readonly workspaceLedgerHeaderBuffer: string;
  readonly workspaceLedgerHeaderProgress: string;
  readonly workspaceStatusActive: string;
  readonly workspaceStatusDone: string;
  readonly workspaceSampleBooks: ReadonlyArray<{
    readonly title: string;
    readonly startDate: string;
    readonly endDate: string;
    readonly daysToBuffer: number;
    readonly currentPages: number;
    readonly totalPages: number;
    readonly percent: number;
    readonly completed: boolean;
  }>;

  readonly footerBarTitle: string;
  readonly footerBarSubtitle: string;
  readonly linkPrivacy: string;
  readonly linkTerms: string;
  readonly linkCookies: string;
}

const SHOWCASE_DICTIONARY: Record<'pl' | 'en', ShowcaseCopy> = {
  pl: {
    badge: 'Translation Tracker • Planowanie i kontrola tempa tłumaczeń',
    heroTitlePrefix: 'Kontroluj dzienne tempo i bufor bezpieczeństwa',
    heroTitleAccent: 'w każdym tłumaczeniu książki.',
    heroSubtitle:
      'Translation Tracker pomaga tłumaczom literatury planować harmonogram pracy nad książką, rejestrować ostatnią przetłumaczoną stronę każdego dnia (także z dokładnością do 0,5 strony) i na bieżąco obliczać wymagane tempo do bezpiecznego buforu oraz ostatecznego deadline’u.',
    ctaLogin: 'Zaloguj się lub załóż konto',
    ctaWorkspace: 'Przejdź do swoich książek',
    ctaProfile: 'Twój profil',
    ctaExplore: 'Zobacz jak to działa',
    welcomeBack: 'Zalogowano jako:',
    guestMode: 'Tryb podglądu (Gość)',
    pillar1Label: 'Kalkulator 4 wariantów dni',
    pillar1Value: 'Bez weekendów, z sobotami lub pełny kalendarz',
    pillar2Label: 'Bezpieczny bufor przed oddaniem',
    pillar2Value: 'Osobne wyliczanie tempa do buforu i deadline’u',
    pillar3Label: 'Szybki zapis z ułamkami stron',
    pillar3Value: 'Wpisy dzienne np. 142,5 str. i wykres kroczący',

    compareTag: '01 / DOSTĘP GOŚCIA VS KONTO TŁUMACZA',
    compareTitle: 'Co przetestujesz teraz, a co odblokujesz po zalogowaniu',
    compareSubtitle:
      'Sprawdź działanie kalkulatora tempa i dziennego wpisu bezpośrednio na tej stronie, a po zalogowaniu zapisuj własne projekty w chmurze.',
    guestBoxTag: 'BEZ LOGOWANIA (TRYB GOŚCIA)',
    guestBoxTitle: 'Interaktywne demo na żywo',
    guestBoxItems: [
      'Przetestowanie kalkulatora dziennego tempa na przykładowej książce (320 stron)',
      'Przełączanie 4 wariantów dni roboczych (bez weekendów, z sobotami, z weekendami)',
      'Symulacja dopisywania stron (+0,5 / +1 str.) z przeliczeniem buforu i postępu',
      'Podgląd ostrzeżenia o skróceniu terminu oddania książki'
    ],
    memberBoxTag: 'PO ZALOGOWANIU (KONTO UŻYTKOWNIKA)',
    memberBoxTitle: 'Pełny warsztat tłumacza w chmurze',
    memberBoxItems: [
      'Tworzenie nielimitowanej liczby książek z własnym kalendarzem dni wolnych (wakacji)',
      'Główny Dashboard z szybkim wpisywaniem dzisiejszej strony i wykresem kroczącym',
      'Tabela wszystkich dni z automatycznym zapisem i przyciskiem „Przewiń do dzisiaj”',
      'Archiwum ukończonych książek ze statystykami średniego tempa i synchronizacją na żywo'
    ],
    memberCtaBtn: 'Załóż konto lub zaloguj się',

    workflowTag: '02 / JAK DZIAŁA TRANSLATION TRACKER',
    workflowTitle: 'Trzy kroki od umowy wydawniczej do oddania przekładu',
    workflowSubtitle:
      'Kliknij poszczególne etapy, aby zobaczyć, jak aplikacja prowadzi Cię przez cały proces pracy nad książką.',
    workflowSteps: {
      plan: {
        step: 'ETAP 01',
        navTitle: 'Konfiguracja książki i buforu',
        navSub: 'Strony • Termin • Wakacje',
        icon: 'menu_book',
        title: '1. Parametry kontraktu, bufor i dni wolne',
        subtitle: 'StartDate • EndDate • BufforDayNumber • ExcludedDays',
        description:
          'Podajesz tytuł książki, łączną liczbę stron, datę rozpoczęcia oraz termin oddania przekładu. Określasz liczbę dni buforu bezpieczeństwa (np. 4 dni na spokojną korektę przed deadline’em) i zaznaczasz w kalendarzu zaplanowane dni urlopu, których kalkulator nie wliczy do dni pracy.',
        specs: [
          {label: 'Przykład książki', value: '„Cień Wiatru” • 320 stron'},
          {label: 'Bufor bezpieczeństwa', value: '4 dni przed terminem wydawniczym'},
          {label: 'Priorytet wakacji', value: 'Odliczane również gdy wypadają w weekend'}
        ]
      },
      daily: {
        step: 'ETAP 02',
        navTitle: 'Codzienny zapis postępu',
        navSub: 'Numer ostatniej strony',
        icon: 'edit_note',
        title: '2. Wpisujesz numer strony, na której skończyłeś dzień',
        subtitle: 'Obsługa połówek stron (np. 128,5) • Auto-zapis w tabeli dni',
        description:
          'Zamiast ręcznie liczyć różnice, wpisujesz po prostu numer ostatniej przetłumaczonej strony na koniec dnia. Aplikacja sama wylicza dzienny przyrost (+X str.), aktualizuje pasek postępu i przelicza, ile stron dziennie musisz tłumaczyć przez pozostałe dni robocze.',
        specs: [
          {label: 'Format wpisu', value: 'Liczby całkowite i dziesiętne (np. 11,5)'},
          {label: 'Walidacja ciągłości', value: 'Blokada wartości mniejszej niż poprzedni dzień'},
          {label: 'Edycja historii', value: 'Widok wszystkich dni z natychmiastowym zapisem'}
        ]
      },
      analytics: {
        step: 'ETAP 03',
        navTitle: 'Wykres kroczący i 4 warianty',
        navSub: 'Plan vs Wykonanie',
        icon: 'insights',
        title: '3. Porównanie planu z rzeczywistym tempem na wykresie',
        subtitle: 'Wykres kumulatywny • 4 warianty liczenia dni roboczych',
        description:
          'Wykres zestawia linię planu (z płaskimi odcinkami w weekendy, dni wakacji oraz w okresie buforu) z Twoim rzeczywistym postępem. Jednym kliknięciem sprawdzisz, jak zmieni się wymagane tempo, jeśli włączysz do pracy soboty lub pełne weekendy.',
        specs: [
          {label: 'Domyślny wariant', value: 'Bez weekendów i bez wakacji'},
          {label: 'Warianty awaryjne', value: 'Z sobotami / Z weekendami / Wszystkie dni'},
          {label: 'Historia projektów', value: 'Automatyczne przeniesienie po osiągnięciu 100%'}
        ]
      }
    },

    sandboxTag: '03 / INTERAKTYWNY SYMULATOR NA ŻYWO',
    sandboxTitle: 'Sprawdź kalkulator dziennego tempa i buforu',
    sandboxSubtitle:
      'Zmień dzisiejszą stronę przyciskami - / + lub przełącz wariant dni roboczych — obliczenia korzystają z prawdziwego silnika BookCalculationService.',
    sandboxBookTitle: 'Przykładowy projekt: „Archipelag Czasu”',
    sandboxBookMeta: '320 stron • Bufor: 3 dni • 2 dni urlopu w harmonogramie',
    sandboxProgressLabel: 'Przetłumaczone strony',
    sandboxTodayInputLabel: 'Ostatnia przetłumaczona strona dzisiaj:',
    sandboxDeltaPrefix: 'Dzisiejszy przyrost:',
    sandboxVariantLabel: 'Wariant liczenia pozostałych dni:',
    sandboxVariantNames: {
      noWeekendsNoExcluded: 'Bez weekendów (bez wakacji)',
      withSaturdaysNoSundaysNoExcluded: 'Z sobotami (bez niedziel i wakacji)',
      withWeekendsNoExcluded: 'Z weekendami (bez wakacji)',
      allDaysWithExcluded: 'Wszystkie dni kalendarzowe'
    },
    sandboxPaceBufferLabel: 'Wymagane tempo do buforu',
    sandboxPaceDeadlineLabel: 'Wymagane tempo do deadline’u',
    sandboxAvgPaceLabel: 'Średnie tempo z aktywnych dni',
    sandboxRemainingBufferPrefix: 'Pozostało do buforu:',
    sandboxRemainingDeadlinePrefix: 'Pozostało do deadline’u:',
    sandboxDaysUnit: 'dni',
    sandboxPagesUnit: 'str.',
    sandboxPagesPerDayUnit: 'str./dzień',
    sandboxSaveBtn: 'Zasymuluj zapis dnia',
    sandboxResetBtn: 'Resetuj symulację',
    sandboxShiftTestBtn: 'Podgląd ostrzeżenia o dacie',
    sandboxSavedToast: 'Zapisano dzienny postęp w symulatorze! Wymagane tempo zostało przeliczone.',
    sandboxShiftModalTitle: 'Zmiana dat spowoduje usunięcie wpisów',
    sandboxShiftModalMsg:
      'Tak wygląda w aplikacji okno ostrzegawcze, gdy skracasz termin książki, a poza nowym zakresem dat znajdują się już zapisane strony.',
    sandboxModalConfirm: 'Rozumiem',
    sandboxModalCancel: 'Zamknij',

    workspaceTag: '04 / PODGLĄD PANELU PO ZALOGOWANIU',
    workspaceTitle: 'Twoja lista wszystkich książek i archiwum',
    workspaceSubtitle:
      'Po zalogowaniu masz dostęp do uporządkowanej listy projektów — najpierw książki w trakcie tłumaczenia, a poniżej ukończone pozycje posortowane od najnowszych.',
    workspaceLedgerHeaderBook: 'Tytuł książki',
    workspaceLedgerHeaderBuffer: 'Dni do buforu',
    workspaceLedgerHeaderProgress: 'Postęp stron',
    workspaceStatusActive: 'W trakcie',
    workspaceStatusDone: 'Ukończona',
    workspaceSampleBooks: [
      {
        title: 'Archipelag Czasu (Tom II)',
        startDate: '01.11.2026',
        endDate: '28.11.2026',
        daysToBuffer: 7,
        currentPages: 185.5,
        totalPages: 320,
        percent: 58,
        completed: false
      },
      {
        title: 'Listy z Północy',
        startDate: '15.10.2026',
        endDate: '10.12.2026',
        daysToBuffer: 16,
        currentPages: 94,
        totalPages: 260,
        percent: 36.2,
        completed: false
      },
      {
        title: 'Szkice o Architekturze Światła',
        startDate: '01.09.2026',
        endDate: '20.10.2026',
        daysToBuffer: 0,
        currentPages: 240,
        totalPages: 240,
        percent: 100,
        completed: true
      }
    ],

    footerBarTitle: 'Prywatność danych i przejrzyste zasady korzystania',
    footerBarSubtitle:
      'Każdy projekt tłumaczeniowy jest przypisany wyłącznie do Twojego konta. Zapoznaj się z dokumentami prawnymi serwisu.',
    linkPrivacy: 'Polityka prywatności',
    linkTerms: 'Regulamin serwisu',
    linkCookies: 'Polityka cookies'
  },
  en: {
    badge: 'Translation Tracker • Daily Pacing & Buffer Calculator for Translators',
    heroTitlePrefix: 'Stay ahead of your buffer and deadline',
    heroTitleAccent: 'on every book translation.',
    heroSubtitle:
      'Translation Tracker helps literary translators plan book schedules, log the last translated page each day (including half-pages like 142.5), and automatically calculate the daily pace required to hit both your safety buffer and final publisher deadline.',
    ctaLogin: 'Sign in or create account',
    ctaWorkspace: 'Open your books dashboard',
    ctaProfile: 'Your profile',
    ctaExplore: 'See how it works',
    welcomeBack: 'Signed in as:',
    guestMode: 'Preview mode (Guest)',
    pillar1Label: '4 Working-Day Variants',
    pillar1Value: 'Weekdays only, with Saturdays, or full calendar',
    pillar2Label: 'Safety Buffer Before Deadline',
    pillar2Value: 'Separate pace targets for buffer and final due date',
    pillar3Label: 'Decimal Page Logging & Charts',
    pillar3Value: 'Log e.g. 142.5 pages with live cumulative line chart',

    compareTag: '01 / GUEST PREVIEW VS TRANSLATOR ACCOUNT',
    compareTitle: 'What you can try right now vs. what unlocks after signing in',
    compareSubtitle:
      'Test the live pacing engine and daily page entry right on this page, then sign in to manage and save your own book projects in the cloud.',
    guestBoxTag: 'WITHOUT LOGIN (GUEST MODE)',
    guestBoxTitle: 'Interactive live demo',
    guestBoxItems: [
      'Test the live daily pacing calculator on a sample 320-page book project',
      'Switch between all 4 working-day counting variants in real time',
      'Simulate adding pages (+0.5 / +1 p.) and watch required pace update',
      'Preview the date-range data-loss protection dialog'
    ],
    memberBoxTag: 'WITH LOGIN (TRANSLATOR ACCOUNT)',
    memberBoxTitle: 'Full cloud translation workspace',
    memberBoxItems: [
      'Create unlimited book projects with custom vacation/excluded days calendars',
      'Main Dashboard with one-click daily page entry and cumulative Planned vs. Actual chart',
      'All Translated Pages table with instant auto-save and "Scroll to today"',
      'Completed books history archive with average daily pace statistics'
    ],
    memberCtaBtn: 'Sign in or create account',

    workflowTag: '02 / HOW TRANSLATION TRACKER WORKS',
    workflowTitle: 'Three steps from publishing contract to completed manuscript',
    workflowSubtitle:
      'Click any step below to see how the application supports your daily translation workflow.',
    workflowSteps: {
      plan: {
        step: 'STEP 01',
        navTitle: 'Set book schedule & buffer',
        navSub: 'Pages • Deadline • Vacations',
        icon: 'menu_book',
        title: '1. Define contract dates, safety buffer, and vacation days',
        subtitle: 'StartDate • EndDate • BufforDayNumber • ExcludedDays',
        description:
          'Enter the book title, total page count, start date, and publisher deadline. Set your safety buffer days (e.g. 4 days reserved for final proofreading before the deadline) and mark planned vacation days on the calendar so they are excluded from working-day calculations.',
        specs: [
          {label: 'Sample book', value: '"The Shadow of the Wind" • 320 pages'},
          {label: 'Safety buffer', value: '4 days before publisher deadline'},
          {label: 'Vacation priority', value: 'Excluded even when falling on a weekend'}
        ]
      },
      daily: {
        step: 'STEP 02',
        navTitle: 'Log daily last page',
        navSub: 'Cumulative page number',
        icon: 'edit_note',
        title: '2. Enter the page number where you stopped today',
        subtitle: 'Supports 1 decimal place (e.g. 128.5) • Instant auto-save table',
        description:
          'Instead of calculating daily differences yourself, simply enter the last translated page number at the end of the day. The app computes your daily delta (+X p.), animates your progress bar, and recalculates the exact pace needed for the remaining working days.',
        specs: [
          {label: 'Input precision', value: 'Whole or decimal pages (e.g. 11.5)'},
          {label: 'Continuity guard', value: 'Prevents entering less than previous day'},
          {label: 'Full history editor', value: 'All-days view with instant auto-save'}
        ]
      },
      analytics: {
        step: 'STEP 03',
        navTitle: 'Cumulative chart & 4 variants',
        navSub: 'Planned vs Actual line',
        icon: 'insights',
        title: '3. Track Planned vs. Actual cumulative progress',
        subtitle: 'Cumulative chart • 4 working-day counting variants',
        description:
          'Compare the planned trajectory (which stays flat on weekends, vacations, and buffer days) against your actual translated pages. Switch between 4 day-counting variants at any time to see how working Saturdays or weekends affects your required daily pace.',
        specs: [
          {label: 'Default variant', value: 'No weekends & no vacations'},
          {label: 'Alternative variants', value: 'With Saturdays / With weekends / All days'},
          {label: 'Completed archive', value: 'Automatically archived upon reaching 100%'}
        ]
      }
    },

    sandboxTag: '03 / LIVE INTERACTIVE SIMULATOR',
    sandboxTitle: 'Try the daily pacing & buffer calculator live',
    sandboxSubtitle:
      'Adjust today’s page number with - / + or switch working-day variants — powered live by the real BookCalculationService.',
    sandboxBookTitle: 'Sample project: "Archipelago of Time"',
    sandboxBookMeta: '320 pages • Buffer: 3 days • 2 vacation days scheduled',
    sandboxProgressLabel: 'Translated pages',
    sandboxTodayInputLabel: 'Last translated page today:',
    sandboxDeltaPrefix: 'Today’s increment:',
    sandboxVariantLabel: 'Remaining days counting variant:',
    sandboxVariantNames: {
      noWeekendsNoExcluded: 'No weekends (no vacations)',
      withSaturdaysNoSundaysNoExcluded: 'With Saturdays (no Sundays/vacations)',
      withWeekendsNoExcluded: 'With weekends (no vacations)',
      allDaysWithExcluded: 'All calendar days'
    },
    sandboxPaceBufferLabel: 'Required pace to buffer',
    sandboxPaceDeadlineLabel: 'Required pace to deadline',
    sandboxAvgPaceLabel: 'Average pace on active days',
    sandboxRemainingBufferPrefix: 'Remaining to buffer:',
    sandboxRemainingDeadlinePrefix: 'Remaining to deadline:',
    sandboxDaysUnit: 'days',
    sandboxPagesUnit: 'p.',
    sandboxPagesPerDayUnit: 'p./day',
    sandboxSaveBtn: 'Simulate saving today',
    sandboxResetBtn: 'Reset simulation',
    sandboxShiftTestBtn: 'Preview date warning modal',
    sandboxSavedToast: 'Simulated daily entry saved! Required pace has been recalculated.',
    sandboxShiftModalTitle: 'Date change will remove entered pages',
    sandboxShiftModalMsg:
      'This warning dialog appears when you shorten a book’s date range and existing translated page entries would fall outside the new dates.',
    sandboxModalConfirm: 'Got it',
    sandboxModalCancel: 'Close',

    workspaceTag: '04 / POST-LOGIN WORKSPACE PREVIEW',
    workspaceTitle: 'Your books ledger and completed archive',
    workspaceSubtitle:
      'After signing in, all your translation projects are organized in a clean ledger — active books first, followed by completed translations sorted from newest to oldest.',
    workspaceLedgerHeaderBook: 'Book title',
    workspaceLedgerHeaderBuffer: 'Days to buffer',
    workspaceLedgerHeaderProgress: 'Page progress',
    workspaceStatusActive: 'In progress',
    workspaceStatusDone: 'Completed',
    workspaceSampleBooks: [
      {
        title: 'Archipelago of Time (Vol. II)',
        startDate: '01.11.2026',
        endDate: '28.11.2026',
        daysToBuffer: 7,
        currentPages: 185.5,
        totalPages: 320,
        percent: 58,
        completed: false
      },
      {
        title: 'Letters from the North',
        startDate: '15.10.2026',
        endDate: '10.12.2026',
        daysToBuffer: 16,
        currentPages: 94,
        totalPages: 260,
        percent: 36.2,
        completed: false
      },
      {
        title: 'Essays on Architecture of Light',
        startDate: '01.09.2026',
        endDate: '20.10.2026',
        daysToBuffer: 0,
        currentPages: 240,
        totalPages: 240,
        percent: 100,
        completed: true
      }
    ],

    footerBarTitle: 'Data privacy and transparent terms of use',
    footerBarSubtitle:
      'Every book translation project is private to your account. Review our legal documents below.',
    linkPrivacy: 'Privacy Policy',
    linkTerms: 'Terms of Service',
    linkCookies: 'Cookie Policy'
  }
};

const DEMO_TODAY_ISO = '2026-11-15';
const DEMO_PREVIOUS_PAGES = 172;
const DEMO_DEFAULT_TODAY_PAGES = 185.5;

@Component({
  selector: 'app-starter-showcase',
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatButtonModule, MatIconModule],
  templateUrl: './starter-showcase.component.html',
  styleUrls: ['./starter-showcase.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StarterShowcaseComponent {
  private readonly authService = inject(AuthService);
  private readonly translateService = inject(CustomTranslateService);
  private readonly calcService = inject(BookCalculationService);
  private readonly snackbarService = inject(SnackbarService);
  private readonly dialogService = inject(DialogService);
  private readonly appConfig = inject(APP_CONFIG);

  protected readonly rp = RedirectionEnum;
  protected readonly variantIds = BookCalculationService.VARIANT_IDS;

  protected readonly user = this.authService.currentUser;
  protected readonly isLoggedIn = this.authService.isLoggedIn;

  protected readonly activeStep = signal<WorkflowStepId>('plan');
  protected readonly sandboxVariant = signal<DayCountingVariantId>('noWeekendsNoExcluded');
  protected readonly sandboxTodayPages = signal<number>(DEMO_DEFAULT_TODAY_PAGES);

  protected readonly currentLang = computed<'pl' | 'en'>(() => {
    const selected = this.translateService.selectedLanguage() || this.appConfig.default_language;
    return selected === LanguageEnum.ENGLISH ? 'en' : 'pl';
  });

  protected readonly copy = computed<ShowcaseCopy>(() => SHOWCASE_DICTIONARY[this.currentLang()]);

  protected readonly currentStepDetails = computed(() => {
    return this.copy().workflowSteps[this.activeStep()];
  });

  protected readonly demoBook = computed<Book>(() => {
    const todayVal = this.sandboxTodayPages();
    const baseEntries = this.calcService.generateInitialTranslatedPages('2026-11-02', '2026-11-28');
    const populated = baseEntries.map(entry => {
      if (entry.date === '2026-11-02') return {date: entry.date, pages: 18};
      if (entry.date === '2026-11-03') return {date: entry.date, pages: 36};
      if (entry.date === '2026-11-04') return {date: entry.date, pages: 55};
      if (entry.date === '2026-11-05') return {date: entry.date, pages: 74};
      if (entry.date === '2026-11-06') return {date: entry.date, pages: 92};
      if (entry.date === '2026-11-09') return {date: entry.date, pages: 112};
      if (entry.date === '2026-11-10') return {date: entry.date, pages: 132};
      if (entry.date === '2026-11-12') return {date: entry.date, pages: 152};
      if (entry.date === '2026-11-13') return {date: entry.date, pages: DEMO_PREVIOUS_PAGES};
      if (entry.date === DEMO_TODAY_ISO) return {date: entry.date, pages: todayVal};
      return entry;
    });

    return {
      id: 'demo-book-showcase',
      OwnerUid: 'guest-preview',
      SharedWithUids: [],
      BookName: 'Archipelag Czasu',
      StartDate: '2026-11-02',
      EndDate: '2026-11-28',
      BufforDayNumber: 3,
      NumberOfPages: 320,
      TranslatedPages: populated,
      ExcludedDays: ['2026-11-11', '2026-11-20'],
      IsArchived: false
    };
  });

  protected readonly demoStats = computed<BookComputedStatistics>(() =>
    this.calcService.computeBookStatistics(this.demoBook(), DEMO_TODAY_ISO)
  );

  protected readonly activeSandboxVariantStats = computed(() => {
    return this.demoStats().variants[this.sandboxVariant()];
  });

  protected readonly sandboxDailyDelta = computed<number>(() => {
    return Math.max(0, Math.round((this.sandboxTodayPages() - DEMO_PREVIOUS_PAGES) * 10) / 10);
  });

  protected selectStep(step: WorkflowStepId): void {
    this.activeStep.set(step);
  }

  protected selectSandboxVariant(variant: DayCountingVariantId): void {
    this.sandboxVariant.set(variant);
  }

  protected adjustSandboxPages(delta: number): void {
    const next = Math.round((this.sandboxTodayPages() + delta) * 10) / 10;
    const clamped = Math.max(DEMO_PREVIOUS_PAGES, Math.min(320, next));
    this.sandboxTodayPages.set(clamped);
  }

  protected resetSandbox(): void {
    this.sandboxTodayPages.set(DEMO_DEFAULT_TODAY_PAGES);
    this.sandboxVariant.set('noWeekendsNoExcluded');
  }

  protected simulateSaveEntry(): void {
    this.snackbarService.openCustomSnackBar(this.copy().sandboxSavedToast, '', 2200);
  }

  protected triggerDateShiftWarningModal(): void {
    const c = this.copy();
    this.dialogService.openConfirmDialogWithData({
      title: c.sandboxShiftModalTitle,
      popupType: DialogType.WARNING,
      message: c.sandboxShiftModalMsg,
      cancelButtonText: c.sandboxModalCancel,
      confirmButtonText: c.sandboxModalConfirm,
      icon: 'event_busy',
      iconColor: 'accent'
    });
  }

  protected scrollToPlayground(): void {
    const el = document.getElementById('bento-playground');
    el?.scrollIntoView({behavior: 'smooth', block: 'start'});
  }
}
