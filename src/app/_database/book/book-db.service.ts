import {inject, Injectable, Injector, runInInjectionContext} from '@angular/core';
import {
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  docData,
  Firestore,
  or,
  query,
  updateDoc,
  where
} from '@angular/fire/firestore';
import {Observable} from 'rxjs';
import {Book} from '../../_models/book/book';
import {bookConverter} from './book.converter';

@Injectable({
  providedIn: 'root'
})
export class BookDbService {
  private readonly dbPathBase = 'books';
  private readonly firestore = inject(Firestore);
  private readonly injector = inject(Injector);

  public getBooksForUser(uid: string): Observable<Book[]> {
    return runInInjectionContext(this.injector, () => {
      const booksRef = collection(this.firestore, this.dbPathBase).withConverter(bookConverter);
      const q = query(
        booksRef,
        or(
          where('OwnerUid', '==', uid),
          where('SharedWithUids', 'array-contains', uid)
        )
      );
      return collectionData(q);
    });
  }

  public getBookById(bookId: string): Observable<Book | undefined> {
    return runInInjectionContext(this.injector, () => {
      const docRef = doc(this.firestore, `${this.dbPathBase}/${bookId}`).withConverter(bookConverter);
      return docData(docRef);
    });
  }

  public async create(book: Book): Promise<string> {
    const booksRef = collection(this.firestore, this.dbPathBase).withConverter(bookConverter);
    const docRef = await addDoc(booksRef, book);
    return docRef.id;
  }

  public async update(bookId: string, updatedFields: Partial<Book>): Promise<void> {
    const {id, ...dataToSave} = updatedFields;
    const docRef = doc(this.firestore, `${this.dbPathBase}/${bookId}`);
    return updateDoc(docRef, {
      ...dataToSave,
      UpdatedAt: new Date().toISOString()
    });
  }

  public async delete(bookId: string): Promise<void> {
    const docRef = doc(this.firestore, `${this.dbPathBase}/${bookId}`);
    return deleteDoc(docRef);
  }
}
