/**
 * In-memory doubles for the Firebase Admin SDK used in unit tests.
 * Token convention: "id-token-<uid>" and "session-<uid>"; anything else is
 * invalid, and revoked uids fail verification like real revoked sessions.
 */

type DecodedLike = { uid: string; sub: string; email: string; name: string };

export function createFakeAdminAuth() {
  const state = { revoked: [] as string[] };

  function decode(prefix: string, value: string): string {
    if (!value.startsWith(prefix) || value.length === prefix.length) {
      throw new Error("Invalid token");
    }
    const uid = value.slice(prefix.length);
    if (state.revoked.includes(uid)) throw new Error("Token revoked");
    return uid;
  }

  function claims(uid: string): DecodedLike {
    return { uid, sub: uid, email: `${uid}@example.com`, name: `User ${uid}` };
  }

  return {
    state,
    reset() {
      state.revoked = [];
    },
    async verifyIdToken(idToken: string) {
      return claims(decode("id-token-", idToken));
    },
    async createSessionCookie(idToken: string) {
      return `session-${decode("id-token-", idToken)}`;
    },
    async verifySessionCookie(cookieValue: string) {
      return claims(decode("session-", cookieValue));
    },
    async revokeRefreshTokens(uid: string) {
      state.revoked.push(uid);
    },
  };
}

type DocData = Record<string, unknown>;

type FakeDocRef = {
  id: string;
  get: () => Promise<{ exists: boolean; id: string; data: () => DocData | undefined }>;
  set: (data: DocData) => Promise<void>;
  update: (data: DocData) => Promise<void>;
  delete: () => Promise<void>;
};

type FakeTx = {
  get: (ref: FakeDocRef) => ReturnType<FakeDocRef["get"]>;
  set: (ref: FakeDocRef, data: DocData) => Promise<void>;
  update: (ref: FakeDocRef, data: DocData) => Promise<void>;
};

/** Minimal Firestore double covering the calls src/server actually makes. */
export function createFakeDb() {
  let store = new Map<string, DocData>();
  let counter = 0;

  return {
    reset() {
      store = new Map();
      counter = 0;
    },
    seed(key: string, data: DocData) {
      store.set(key, data);
    },
    read(key: string) {
      return store.get(key);
    },
    /** Serial shim: real Firestore transactions retry; tests don't need that. */
    async runTransaction<T>(updateFunction: (tx: FakeTx) => Promise<T>): Promise<T> {
      const tx: FakeTx = {
        get: (ref) => ref.get(),
        set: (ref, data) => ref.set(data),
        update: (ref, data) => ref.update(data),
      };
      return updateFunction(tx);
    },
    collection(name: string) {
      return {
        doc(id?: string): FakeDocRef {
          const docId = id ?? `auto-${++counter}`;
          const key = `${name}/${docId}`;
          return {
            id: docId,
            async get() {
              const data = store.get(key);
              return { exists: data !== undefined, id: docId, data: () => data };
            },
            async set(data: DocData) {
              store.set(key, { ...data });
            },
            async update(data: DocData) {
              const existing = store.get(key);
              if (!existing) throw new Error(`No such document: ${key}`);
              store.set(key, { ...existing, ...data });
            },
            async delete() {
              store.delete(key);
            },
          };
        },
        where(field: string, operator: string, value: unknown) {
          void operator; // tests only use "=="
          return {
            async get() {
              const docs = [...store.entries()]
                .filter(
                  ([key, data]) =>
                    key.startsWith(`${name}/`) && data[field] === value,
                )
                .map(([key, data]) => ({
                  id: key.slice(name.length + 1),
                  data: () => data,
                }));
              return { docs };
            },
          };
        },
      };
    },
  };
}

/** Shared mutable cookie jar for the next/headers mock. */
export function createCookieJar() {
  return { session: undefined as string | undefined };
}
