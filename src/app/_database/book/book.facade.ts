import {computed, inject, Injectable} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {of, switchMap} from 'rxjs';
import {BookDbService} from './book-db.service';
import {AuthService} from '../../_services/auth/auth.service';
import {Book, BookComputedStatistics, BookDayEntry} from '../../_models/book/book';
import {BookCalculationService} from '../../_services/book/book-calculation.service';

@Injectable({
  providedIn: 'root'
})
export class BookFacade {
  private readonly bookDb = inject(BookDbService);
  private readonly authService = inject(AuthService);
  private readonly calcService = inject(BookCalculationService);

  public readonly allBooks = toSignal<Book[] | undefined>(
    this.authService.loggedUser().pipe(
      switchMap(user => {
        if (user?.uid) {
          return this.bookDb.getBooksForUser(user.uid);
        }
        return of([]);
      })
    ),
    {initialValue: undefined}
  );

  public readonly isLoading = computed(() => this.allBooks() === undefined);

  /**
   * Active books currently in translation (not archived and currentTranslatedPages < NumberOfPages)
   */
  public readonly activeBooks = computed(() => {
    const books = this.allBooks();
    if (!books) return undefined;
    return books
      .filter(b => !this.calcService.isBookCompleted(b))
      .sort((a, b) => a.EndDate.localeCompare(b.EndDate));
  });

  /**
   * Completed / previous books (currentTranslatedPages >= NumberOfPages or IsArchived)
   */
  public readonly completedBooks = computed(() => {
    const books = this.allBooks();
    if (!books) return undefined;
    return books
      .filter(b => this.calcService.isBookCompleted(b))
      .sort((a, b) => b.EndDate.localeCompare(a.EndDate));
  });

  public readonly activeBooksStats = computed<BookComputedStatistics[] | undefined>(() => {
    const active = this.activeBooks();
    if (!active) return undefined;
    return active.map(b => this.calcService.computeBookStatistics(b));
  });

  public readonly completedBooksStats = computed<BookComputedStatistics[] | undefined>(() => {
    const completed = this.completedBooks();
    if (!completed) return undefined;
    return completed.map(b => this.calcService.computeBookStatistics(b));
  });

  public getBookSignalById(bookId: string) {
    return computed(() => {
      const books = this.allBooks();
      if (!books) return undefined;
      return books.find(b => b.id === bookId) ?? null;
    });
  }

  public async createBook(input: {
    BookName: string;
    StartDate: string;
    EndDate: string;
    BufforDayNumber: number;
    NumberOfPages: number;
    ExcludedDays: string[];
  }): Promise<string> {
    const uid = this.authService.currentUser()?.uid;
    if (!uid) {
      throw new Error('User not authenticated');
    }
    const translatedPages = this.calcService.generateInitialTranslatedPages(
      input.StartDate,
      input.EndDate
    );
    const newBook: Book = {
      OwnerUid: uid,
      SharedWithUids: [],
      BookName: input.BookName.trim(),
      StartDate: input.StartDate,
      EndDate: input.EndDate,
      BufforDayNumber: Number(input.BufforDayNumber),
      NumberOfPages: Number(input.NumberOfPages),
      TranslatedPages: translatedPages,
      ExcludedDays: [...input.ExcludedDays].sort(),
      IsArchived: false,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString()
    };
    return this.bookDb.create(newBook);
  }

  public async updateDayEntry(
    book: Book,
    entryIndex: number,
    cumulativePages: number | null
  ): Promise<void> {
    if (!book.id) return;
    const updatedEntries: BookDayEntry[] = book.TranslatedPages.map((entry, idx) =>
      idx === entryIndex ? {...entry, pages: cumulativePages} : {...entry}
    );
    await this.bookDb.update(book.id, {
      TranslatedPages: updatedEntries
    });
  }

  public async updateAllDayEntries(bookId: string, entries: BookDayEntry[]): Promise<void> {
    await this.bookDb.update(bookId, {
      TranslatedPages: entries
    });
  }

  public async updateBookSettings(
    bookId: string,
    updatedData: Partial<Book>
  ): Promise<void> {
    await this.bookDb.update(bookId, updatedData);
  }

  public async deleteBook(bookId: string): Promise<void> {
    await this.bookDb.delete(bookId);
  }
}
