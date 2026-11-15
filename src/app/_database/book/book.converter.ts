import {FirestoreDataConverter, QueryDocumentSnapshot, SnapshotOptions} from '@angular/fire/firestore';
import {Book, BookDayEntry} from '../../_models/book/book';
import {DateTime} from 'luxon';

function normalizeTranslatedPages(
  rawPages: unknown,
  startDate: string,
  endDate: string
): BookDayEntry[] {
  if (Array.isArray(rawPages)) {
    const start = DateTime.fromISO(startDate);
    return rawPages.map((item, idx) => {
      if (item && typeof item === 'object' && 'date' in item) {
        const entry = item as {date?: unknown; pages?: unknown};
        const pagesVal =
          entry.pages === null || entry.pages === undefined || entry.pages === ''
            ? null
            : Number(entry.pages);
        return {
          date: String(entry.date || (start.isValid ? start.plus({days: idx}).toFormat('yyyy-MM-dd') : '')),
          pages: pagesVal !== null && !Number.isNaN(pagesVal) ? pagesVal : null
        };
      }
      // Fallback for legacy numeric array if ever encountered
      const pagesVal = item === null || item === undefined || item === '' ? null : Number(item);
      const fallbackDate = start.isValid ? start.plus({days: idx}).toFormat('yyyy-MM-dd') : '';
      return {
        date: fallbackDate,
        pages: pagesVal !== null && !Number.isNaN(pagesVal) ? pagesVal : null
      };
    });
  }
  // If empty or missing, generate entries from startDate to endDate
  const start = DateTime.fromISO(startDate);
  const end = DateTime.fromISO(endDate);
  if (!start.isValid || !end.isValid || end < start) {
    return [];
  }
  const diffDays = Math.floor(end.diff(start, 'days').days) + 1;
  const result: BookDayEntry[] = [];
  for (let i = 0; i < diffDays; i++) {
    result.push({
      date: start.plus({days: i}).toFormat('yyyy-MM-dd'),
      pages: null
    });
  }
  return result;
}

export const bookConverter: FirestoreDataConverter<Book> = {
  toFirestore(book: Book): Record<string, unknown> {
    const {id, ...dataToSave} = book;
    return {
      OwnerUid: dataToSave.OwnerUid,
      SharedWithUids: dataToSave.SharedWithUids ?? [],
      BookName: dataToSave.BookName,
      StartDate: dataToSave.StartDate,
      EndDate: dataToSave.EndDate,
      BufforDayNumber: Number(dataToSave.BufforDayNumber ?? 0),
      NumberOfPages: Number(dataToSave.NumberOfPages ?? 0),
      TranslatedPages: (dataToSave.TranslatedPages ?? []).map(entry => ({
        date: entry.date,
        pages: entry.pages === null || entry.pages === undefined ? null : Number(entry.pages)
      })),
      ExcludedDays: dataToSave.ExcludedDays ?? [],
      IsArchived: Boolean(dataToSave.IsArchived ?? false),
      CreatedAt: dataToSave.CreatedAt ?? new Date().toISOString(),
      UpdatedAt: new Date().toISOString()
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): Book {
    const data = snapshot.data(options);
    const startDate = String(data['StartDate'] ?? '');
    const endDate = String(data['EndDate'] ?? '');
    return {
      id: snapshot.id,
      OwnerUid: String(data['OwnerUid'] ?? ''),
      SharedWithUids: Array.isArray(data['SharedWithUids']) ? data['SharedWithUids'].map(String) : [],
      BookName: String(data['BookName'] ?? ''),
      StartDate: startDate,
      EndDate: endDate,
      BufforDayNumber: Number(data['BufforDayNumber'] ?? 0),
      NumberOfPages: Number(data['NumberOfPages'] ?? 0),
      TranslatedPages: normalizeTranslatedPages(data['TranslatedPages'], startDate, endDate),
      ExcludedDays: Array.isArray(data['ExcludedDays']) ? data['ExcludedDays'].map(String) : [],
      IsArchived: Boolean(data['IsArchived'] ?? false),
      CreatedAt: data['CreatedAt'] ? String(data['CreatedAt']) : undefined,
      UpdatedAt: data['UpdatedAt'] ? String(data['UpdatedAt']) : undefined
    };
  }
};
