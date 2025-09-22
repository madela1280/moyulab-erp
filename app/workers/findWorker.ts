// app/workers/findWorker.ts
export type FindReq = {
  rows: Record<string,string>[];
  columns: string[];
  checkedIndices: number[];      // 체크된 행 인덱스만 검색
  query: string;
  caseSensitive: boolean;
  wholeCell: boolean;
  wildcard: boolean;             // * ? 지원 ( ~ 이스케이프는 생략 )
  offset: number;                // 페이지네이션 시작
  limit: number;                 // 최대 N건 반환
};

export type FindHit = { r: number; c: number; v: string };
export type FindRes = { total: number; hits: FindHit[] };

const wildcardToRegex = (q: string) => {
  // * -> .*  , ? -> .  (정규식 메타문자는 이스케이프)
  const esc = q.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&');
  return esc.replace(/\\\*/g, '\\*') // 이미 이스케이프된 * 보호
            .replace(/\*/g, '.*')
            .replace(/\\\?/g, '\\?')
            .replace(/\?/g, '.');
};

self.onmessage = (e: MessageEvent<FindReq>) => {
  const { rows, columns, checkedIndices, query, caseSensitive, wholeCell, wildcard, offset, limit } = e.data;
  let term = query || '';
  if (!term.trim()) { (self as any).postMessage({ total: 0, hits: [] } as FindRes); return; }

  let sourceRows = checkedIndices.length ? checkedIndices.map(i => ({ row: rows[i], idx: i })) :
                                           rows.map((row, i) => ({ row, idx: i }));

  let pattern = wildcard ? wildcardToRegex(term) : term.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  if (wholeCell) pattern = '^' + pattern + '$';
  const re = new RegExp(pattern, caseSensitive ? '' : 'i');

  const allHits: FindHit[] = [];
  for (const {row, idx} of sourceRows) {
    for (let c = 0; c < columns.length; c++) {
      const v = (row[columns[c]] ?? '').toString();
      if (re.test(v)) allHits.push({ r: idx, c, v });
    }
  }
  const total = allHits.length;
  const hits = allHits.slice(offset, offset + limit);
  (self as any).postMessage({ total, hits } as FindRes);
};
