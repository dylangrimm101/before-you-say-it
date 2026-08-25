import { describe, expect, test } from "bun:test";

const appRoot = `${import.meta.dir}/..`;

describe("shared BYSI background field", () => {
  test("uses the exact flat base and three radial gradient definitions", async () => {
    const theme = await Bun.file(`${appRoot}/constants/theme.ts`).text();

    expect(theme).toContain('bg: "#EFEEF4"');
    expect(theme).toContain('glowTop: "#FDFDFE"');
    expect(theme).toContain('glowRight: "#E4E0F0"');
    expect(theme).toContain('glowBottom: "#DED5EA"');
    expect(theme).toContain('{ id: "top", color: C.glowTop, cx: "15%", cy: "0%", rx: "125%", ry: "75%", fadeAt: "55%" }');
    expect(theme).toContain('{ id: "right", color: C.glowRight, cx: "100%", cy: "18%", rx: "115%", ry: "70%", fadeAt: "62%" }');
    expect(theme).toContain('{ id: "bottom", color: C.glowBottom, cx: "55%", cy: "105%", rx: "140%", ry: "85%", fadeAt: "58%" }');
  });

  test("paints full-screen SVG rectangles bottom-first and preserves stop RGB", async () => {
    const ui = await Bun.file(`${appRoot}/components/ui.tsx`).text();

    expect(ui).toContain("const svgPaintOrder = [...FIELD_GLOWS].reverse()");
    expect(ui).toContain('style={[StyleSheet.absoluteFill, { backgroundColor: C.bg }]}');
    expect(ui).toContain('<Stop offset="0%" stopColor={glow.color} stopOpacity={1} />');
    expect(ui).toContain('<Stop offset={glow.fadeAt} stopColor={glow.color} stopOpacity={0} />');
    expect(ui).toContain('<Rect key={glow.id} width="100%" height="100%"');
    expect(ui).not.toContain("<Ellipse");
  });

  test("covers onboarding, rehearsal, results, and Today while launch stays solid", async () => {
    const targetFiles = [
      "app/onboarding.tsx",
      "app/rehearse/[id].tsx",
      "components/FreeJourneyResults.tsx",
      "app/(tabs)/index.tsx",
    ];

    for (const targetFile of targetFiles) {
      const source = await Bun.file(`${appRoot}/${targetFile}`).text();
      expect(source).toContain("<Backdrop />");
    }

    const launch = await Bun.file(`${appRoot}/components/LaunchExperience.tsx`).text();
    expect(launch).toContain('const FIELD = "#512888"');
    expect(launch).not.toContain("<Backdrop />");
  });
});
