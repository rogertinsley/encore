export function createTestRedis() {
  const values = new Map<string, string>();
  return {
    get: async (key: string) => values.get(key) ?? null,
    setex: async (key: string, _ttl: number, value: string) => {
      values.set(key, value);
      return "OK";
    },
    del: async (key: string) => Number(values.delete(key)),
  };
}
