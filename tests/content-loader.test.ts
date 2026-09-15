import { describe, expect, it, vi } from "vitest";
import { ContentLoader } from "../src/app/content-loader.js";

describe("incremental content loader", () => {
  it("caches repeated sections and preloads only the next section", async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) => new Response(JSON.stringify({ url }), { status: 200 })) as unknown as typeof fetch;
    const loader = new ContentLoader("/french-reading-studio/content", fetcher);
    const first = loader.section("wrk_example", 0);
    loader.preloadNextSection("wrk_example", 0, 2);
    loader.preloadNextSection("wrk_example", 1, 2);
    await Promise.all([first, loader.section("wrk_example", 0)]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenNthCalledWith(1, "/french-reading-studio/content/reading/wrk_example-00.json");
    expect(fetcher).toHaveBeenNthCalledWith(2, "/french-reading-studio/content/reading/wrk_example-01.json");
  });
});
