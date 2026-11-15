import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {signal} from '@angular/core';
import {StarterShowcaseComponent} from './starter-showcase.component';
import {AuthService} from '../../_services/auth/auth.service';
import {CustomTranslateService} from '../../_services/translate/custom-translate.service';
import {SnackbarService} from '../../_services/util/snackbar.service';
import {DialogService} from '../../_services/util/dialog.service';
import {LanguageEnum} from '../../_services/translate/language-enum';
import {APP_CONFIG} from '../../app.config.token';

describe('StarterShowcaseComponent', () => {
  let component: StarterShowcaseComponent;
  let fixture: ComponentFixture<StarterShowcaseComponent>;
  let mockAuthService: {
    currentUser: ReturnType<typeof signal<null>>;
    isLoggedIn: ReturnType<typeof signal<boolean>>;
  };
  let selectedLanguageSignal: ReturnType<typeof signal<LanguageEnum>>;
  let mockSnackbarService: jasmine.SpyObj<SnackbarService>;
  let mockDialogService: jasmine.SpyObj<DialogService>;

  beforeEach(async () => {
    mockAuthService = {
      currentUser: signal(null),
      isLoggedIn: signal(false)
    };
    selectedLanguageSignal = signal<LanguageEnum>(LanguageEnum.POLISH);
    mockSnackbarService = jasmine.createSpyObj<SnackbarService>('SnackbarService', [
      'openCustomSnackBar',
      'openSnackBar'
    ]);
    mockDialogService = jasmine.createSpyObj<DialogService>('DialogService', [
      'openConfirmDialogWithData'
    ]);

    await TestBed.configureTestingModule({
      imports: [StarterShowcaseComponent],
      providers: [
        provideRouter([]),
        {provide: AuthService, useValue: mockAuthService},
        {
          provide: CustomTranslateService,
          useValue: {
            selectedLanguage: selectedLanguageSignal
          }
        },
        {provide: SnackbarService, useValue: mockSnackbarService},
        {provide: DialogService, useValue: mockDialogService},
        {provide: APP_CONFIG, useValue: {default_language: LanguageEnum.POLISH}}
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StarterShowcaseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and display guest mode copy in Polish by default', () => {
    expect(component).toBeTruthy();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Translation Tracker');
    expect(compiled.textContent).toContain('Tryb podglądu (Gość)');
  });

  it('should switch language reactively when selectedLanguage changes to English', () => {
    selectedLanguageSignal.set(LanguageEnum.ENGLISH);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Preview mode (Guest)');
    expect(compiled.textContent).toContain('Stay ahead of your buffer and deadline');
  });

  it('should switch workflow steps when clicking pipeline nodes', () => {
    component['selectStep']('daily');
    fixture.detectChanges();
    expect(component['activeStep']()).toBe('daily');
    expect(component['currentStepDetails']().step).toBe('KROK 02');

    component['selectStep']('analytics');
    fixture.detectChanges();
    expect(component['activeStep']()).toBe('analytics');
    expect(component['currentStepDetails']().step).toBe('KROK 03');
  });

  it('should adjust simulated pages with decimal support and recalculate BookCalculationService stats', () => {
    const initialPages = component['sandboxTodayPages']();
    expect(initialPages).toBe(185.5);

    component['adjustSandboxPages'](0.5);
    expect(component['sandboxTodayPages']()).toBe(186);
    expect(component['demoStats']().currentTranslatedPages).toBe(186);

    component['adjustSandboxPages'](5);
    expect(component['sandboxTodayPages']()).toBe(191);

    component['resetSandbox']();
    expect(component['sandboxTodayPages']()).toBe(185.5);
  });

  it('should switch day counting variants in the live simulator', () => {
    const noWeekendsDays = component['activeSandboxVariantStats']().remainingDaysToDeadline;

    component['selectSandboxVariant']('allDaysWithExcluded');
    const allDays = component['activeSandboxVariantStats']().remainingDaysToDeadline;

    expect(allDays).toBeGreaterThan(noWeekendsDays);
  });

  it('should trigger snackbar and date warning dialog in sandbox actions', () => {
    component['simulateSaveEntry']();
    expect(mockSnackbarService.openCustomSnackBar).toHaveBeenCalled();

    component['triggerDateShiftWarningModal']();
    expect(mockDialogService.openConfirmDialogWithData).toHaveBeenCalled();
  });
});
