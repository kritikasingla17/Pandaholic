// Supabase caps every response (1000 rows by default), so long lists are read
// page by page. Each page starts after the rows already received, which stays
// correct even if the project's row cap is lower than PAGE_SIZE.
const PAGE_SIZE = 1000;

interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
  count: number | null;
}

export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>
): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const { data, error, count } = await fetchPage(rows.length, rows.length + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return rows;
    rows.push(...data);
    if (count !== null && rows.length >= count) return rows;
  }
}
