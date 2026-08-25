import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");

function pngDimensions(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

describe("cold-start launch experience", () => {
  test("uses the supplied full-bleed storyboard with no light flash", () => {
    const config = JSON.parse(readFileSync(join(root, "app.json"), "utf8")) as {
      expo: {
        splash: { backgroundColor: string; image: string; resizeMode: string };
        plugins: unknown[];
      };
    };

    expect(config.expo.splash).toEqual({
      image: "./assets/images/launch-screen.png",
      resizeMode: "cover",
      backgroundColor: "#512888",
    });
    expect(JSON.stringify(config.expo.plugins)).toContain("expo-splash-screen");
    expect(JSON.stringify(config.expo.plugins)).toContain("#512888");
    expect(pngDimensions(join(root, "assets/images/launch-screen.png"))).toEqual({
      width: 1179,
      height: 2556,
    });
  });

  test("keeps native-only Animated props off web SVG elements", () => {
    const source = readFileSync(join(root, "components/LaunchExperience.tsx"), "utf8");
    const ui = readFileSync(join(root, "components/ui.tsx"), "utf8");

    expect(source).toContain("({ collapsable: _collapsable, ...props }, ref)");
    expect(source).toContain("Animated.createAnimatedComponent(AnimationSafeG)");
    expect(source).not.toContain("Animated.createAnimatedComponent(G)");
    expect(ui).toContain("Animated.createAnimatedComponent(AnimationSafeCircle)");
    expect(ui).not.toContain("Animated.createAnimatedComponent(Circle)");
  });

  test("keeps final figure rotations on inner groups while wrappers animate", () => {
    const source = readFileSync(join(root, "components/LaunchExperience.tsx"), "utf8");

    expect(source).toContain("<AnimatedG transform={leftCounterRotation");
    expect(source).toContain('<G transform="rotate(4 10 91.95)">');
    expect(source).toContain("<AnimatedG transform={rightCounterRotation");
    expect(source).toContain('<G transform="rotate(-4 110 91.95)">');
    expect(source).toContain("outputRange: [\"rotate(-4 10 91.95)\", \"rotate(0 10 91.95)\"]");
    expect(source).toContain("outputRange: [\"rotate(4 110 91.95)\", \"rotate(0 110 91.95)\"]");
  });

  test("centers the complete single-line lockup rather than only the mark", () => {
    const source = readFileSync(join(root, "components/LaunchExperience.tsx"), "utf8");

    expect(source).toContain("const lockupHeight = markHeight + WORDMARK_GAP + WORDMARK_LINE_HEIGHT");
    expect(source).toContain("const lockupTop = (height - lockupHeight) / 2");
    expect(source).toContain("height: lockupHeight, top: lockupTop, width");
    expect(source).toContain("numberOfLines={1}");
    expect(source).not.toContain("markTop");
  });

  test("uses a readable Speak timeline, reduced motion, and non-looping exit", () => {
    const source = readFileSync(join(root, "components/LaunchExperience.tsx"), "utf8");

    for (const marker of ["Animated.delay(700)", "Animated.delay(950)", "Animated.delay(1100)", "Animated.delay(SPEAK_DURATION)"]) {
      expect(source).toContain(marker);
    }
    expect(source).toContain("const SPEAK_DURATION = 2200");
    expect(source).toContain("duration: 300");
    expect(source).toContain("isReduceMotionEnabled");
    expect(source).toContain("const REDUCED_MOTION_HOLD = 800");
    expect(source).not.toMatch(/Animated\.loop|setInterval|setTimeout/);
  });

  test("presents once per process so warm starts and resumes do not replay it", () => {
    const layout = readFileSync(join(root, "app/_layout.tsx"), "utf8");

    expect(layout).toContain("let hasPresentedLaunch = false");
    expect(layout).toContain("if (hasPresentedLaunch) return false");
    expect(layout).toContain("hasPresentedLaunch = true");
    expect(layout).toContain("showLaunch ? <LaunchExperience");
  });
});
