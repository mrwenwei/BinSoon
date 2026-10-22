import { test, expect } from "@playwright/test";

test("every demo bin has numeric levels for both waste streams", async ({
  page,
}) => {
  await page.goto("/");
  const missing = await page.evaluate(async () => {
    // @ts-expect-error Browser imports the application module through Vite.
    const { demoLocation } = await import("/src/data/demoBins.ts");
    // @ts-expect-error Browser imports the source inventory through Vite.
    const { default: data } = await import("/src/data/locations.json");
    const bins = Array.isArray(data) ? data : data.locations;
    return bins
      .filter((bin: { kind: string }) => bin.kind === "bin")
      .flatMap((bin: { id: string }) => {
        const item = demoLocation(
          {
            ...bin,
            kind: "bin",
            placement_status: "installed",
            bin_status: { operational_status: "normal" },
          },
          "general",
        );
        return item.compartments
          .filter(
            (part: { fill_level_pct: number | null }) =>
              !Number.isFinite(part.fill_level_pct),
          )
          .map(
            (part: { waste_type: string }) => `${bin.id}:${part.waste_type}`,
          );
      });
  });
  expect(missing).toEqual([]);
});
