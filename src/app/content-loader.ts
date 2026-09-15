import type { DeliveryManifest, QuizBatchPackage, ReadingSectionPackage } from "../delivery/content-packages.js";

export class ContentLoader {
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;
  readonly #cache = new Map<string, Promise<unknown>>();

  constructor(baseUrl: string, fetchImplementation: typeof fetch = fetch) {
    this.#baseUrl = baseUrl.replace(/\/?$/, "/");
    // Window.fetch requires its browser receiver in some environments. Keep that
    // receiver when the function is stored for later use by the loader.
    this.#fetch = fetchImplementation.bind(globalThis);
  }

  manifest(): Promise<DeliveryManifest> {
    return this.#json<DeliveryManifest>("manifest.json");
  }

  section(workId: string, index: number): Promise<ReadingSectionPackage> {
    return this.#json<ReadingSectionPackage>(`reading/${workId}-${String(index).padStart(2, "0")}.json`);
  }

  preloadNextSection(workId: string, currentIndex: number, sectionCount: number): void {
    if (currentIndex + 1 < sectionCount) void this.section(workId, currentIndex + 1);
  }

  quizBatch(index: number): Promise<QuizBatchPackage> {
    return this.#json<QuizBatchPackage>(`quizzes/${String(index).padStart(2, "0")}.json`);
  }

  async quizBatchesForIdentities(identityKeys: readonly string[], manifest: DeliveryManifest): Promise<QuizBatchPackage[]> {
    const indices = [...new Set(identityKeys.map((key) => manifest.quizBatchForIdentity[key]).filter((value): value is number => value !== undefined))];
    return Promise.all(indices.map((index) => this.quizBatch(index)));
  }

  #json<T>(relativePath: string): Promise<T> {
    const cached = this.#cache.get(relativePath);
    if (cached) return cached as Promise<T>;
    const request = this.#fetch(`${this.#baseUrl}${relativePath}`).then((response) => {
      if (!response.ok) throw new Error(`Content request failed (${response.status}): ${relativePath}`);
      return response.json() as Promise<T>;
    });
    this.#cache.set(relativePath, request);
    request.catch(() => this.#cache.delete(relativePath));
    return request;
  }
}
