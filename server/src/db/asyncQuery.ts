export async function getOne<T>(query: any): Promise<T | undefined> {
  const executable = typeof query?.limit === 'function' ? query.limit(1) : query;
  const result = await executable.execute();

  if (Array.isArray(result)) {
    return result[0] as T | undefined;
  }

  return result as T | undefined;
}

export async function getMany<T>(query: any): Promise<T[]> {
  const result = await query.execute();
  return result as T[];
}

export async function exec(query: any): Promise<any> {
  return await query.execute();
}
