export async function fetchAll<T = any>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  pageSize = 1000
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await buildQuery(offset, offset + pageSize - 1);
    if (error) {
      throw new Error(error.message || 'Gagal mengambil data dari database.');
    }
    if (!data || data.length === 0) {
      break;
    }
    all.push(...data);
    offset += data.length;
  }

  return all;
}