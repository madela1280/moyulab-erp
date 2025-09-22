// app/workers/findWorker.ts
export type FindReq = {
  rows: Record<string,string>[];
  columns: string[];
  checkedIndices: number[];
  query: string;
  caseSensitive: boolean;
  wholeCell: boolean;
  wildcard: boolean;
  offset: number;
  limit: number;
  columnsToSearch?: string[] | null; // ★ 추가: 특정 열만 검색
};

export type FindHit = { r: number; c: number; v: string };
export type FindRes = { total: number; hits: FindHit[] };

const wildcardToRegex = (q: string) => {
  const esc = q.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&');
  return esc.replace(/\\\*/g, '\\*')
            .replace(/\*/g, '.*')
            .replace(/\\\?/g, '\\?')
            .replace(/\?/g, '.');
};

self.onmessage = (e: MessageEvent<FindReq>) => {
  const { rows, columns, checkedIndices, query, caseSensitive, wholeCell, wildcard, offset, limit, columnsToSearch } = e.data;
  let term = query || '';
  if (!term.trim()) { (self as any).postMessage({ total: 0, hits: [] } as FindRes); return; }

  const colIndexMap = new Map<string, number>();
  columns.forEach((c, i) => colIndexMap.set(c, i));
  const targetColIdx: number[] =
    (columnsToSearch && columnsToSearch.length)
    ? columnsToSearch.map(c => colIndexMap.get(c)).filter((v): v is number => typeof v === 'number')
    : columns.map((_, i) => i);

  let sourceRows = checkedIndices.length ? checkedIndices.map(i => ({ row: rows[i], idx: i })) :
                                           rows.map((row, i) => ({ row, idx: i }));

  let pattern = wildcard ? wildcardToRegex(term) : term.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  if (wholeCell) pattern = '^' + pattern + '$';
  const re = new RegExp(pattern, caseSensitive ? '' : 'i');

  const allHits: FindHit[] = [];
  for (const {row, idx} of sourceRows) {
    for (const c of targetColIdx) {
      const colName = columns[c];
      const v = (row[colName] ?? '').toString();
      if (re.test(v)) allHits.push({ r: idx, c, v });
    }
  }
  const total = allHits.length;
  const hits = allHits.slice(offset, offset + limit);
  (self as any).postMessage({ total, hits } as FindRes);
};

