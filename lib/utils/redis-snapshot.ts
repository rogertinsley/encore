import { redis } from "@/lib/redis";

interface Snapshot<T> {
  value: T;
  freshUntil: number;
}

interface Refresh {
  promise: Promise<unknown>;
  valid: boolean;
}

const pending = new Map<string, Refresh>();

function redisCall<T>(operation: Promise<T>): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 150);
    operation
      .then(resolve, () => resolve(null))
      .finally(() => clearTimeout(timer));
  });
}

export async function invalidateRedisSnapshot(key: string) {
  const refresh = pending.get(key);
  if (refresh) {
    refresh.valid = false;
    pending.delete(key);
  }
  await redisCall(redis.del(key));
}

/** Return stale data immediately and coalesce refreshes within the server process. */
export async function readRedisSnapshot<T>(
  key: string,
  { freshFor, retainFor }: { freshFor: number; retainFor: number },
  load: () => Promise<T>,
  shouldStore: (value: T) => boolean = () => true
): Promise<T> {
  function refresh(): Promise<T> {
    const existing = pending.get(key);
    if (existing) return existing.promise as Promise<T>;

    const entry: Refresh = {
      valid: true,
      promise: Promise.resolve()
        .then(load)
        .then(async (value) => {
          if (entry.valid && shouldStore(value)) {
            const snapshot: Snapshot<T> = {
              value,
              freshUntil: Date.now() + freshFor * 1000,
            };
            await redisCall(
              redis.setex(key, retainFor, JSON.stringify(snapshot))
            );
          }
          return value;
        })
        .finally(() => {
          if (pending.get(key) === entry) pending.delete(key);
        }),
    };
    pending.set(key, entry);
    return entry.promise as Promise<T>;
  }

  const raw = await redisCall(redis.get(key));
  if (raw) {
    try {
      const snapshot = JSON.parse(raw) as Snapshot<T>;
      if (typeof snapshot.freshUntil === "number" && "value" in snapshot) {
        if (snapshot.freshUntil <= Date.now()) void refresh().catch(() => {});
        return snapshot.value;
      }
    } catch {
      // Rebuild an unreadable snapshot.
    }
  }
  return refresh();
}
