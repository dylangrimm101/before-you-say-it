import { STAGING_AUTH_URL, type selectAuthEnvironment } from "./authEnvironment";

type AuthInputs = Readonly<Parameters<typeof selectAuthEnvironment>[0]>;
type AuthSelection = ReturnType<typeof selectAuthEnvironment>;

function presence(value: string | undefined): "missing" | "blank" | "present" {
  if (value === undefined) return "missing";
  return value.trim() ? "present" : "blank";
}

function versionLabel(value: string | null | undefined): string {
  return value && value.length <= 32 && /^\d+(?:\.\d+)*$/.test(value) ? value : "unavailable";
}

/** Describes the exact auth inputs consumed at startup, never their values or user data. Not an auth gate. */
export function describeAuthConfiguration(
  input: AuthInputs,
  selected: AuthSelection,
  installed: { version?: string | null; build?: string | null },
): string {
  const stagingRequested = Boolean(input.mode || input.nativeStagingBuild);
  const failedChecks: string[] = [];
  if (!selected) {
    if (stagingRequested) {
      if (!input.developmentBuild && !input.stagingAccountRelease) failedChecks.push("staging-release-not-enabled");
      if (!input.nativeStagingBuild) failedChecks.push("staging-native-identity-required");
      if (input.mode !== "staging-account") failedChecks.push("staging-mode-not-recognized");
      if (input.stagingUrl !== STAGING_AUTH_URL) failedChecks.push("staging-url-not-matched");
      if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(input.stagingKey ?? "")) failedChecks.push("staging-key-format-not-matched");
    } else {
      if (!input.productionUrl?.trim()) failedChecks.push("normal-url-missing-or-blank");
      if (!input.productionKey?.trim()) failedChecks.push("normal-key-missing-or-blank");
    }
    if (failedChecks.length === 0) failedChecks.push("selection-unavailable-other");
  }
  const identity = input.applicationId === "app.rork.8fc4qwsqaurkxk0pimyvx" ? "normal"
    : input.applicationId === "app.bysi.staging.account" ? "staging"
    : input.applicationId ? "other" : "unavailable";
  // Only fixed categories and bounded numeric app versions leave this function.
  return [
    "BYSI setup diagnostic D1",
    `Installed app: ${versionLabel(installed.version)} (${versionLabel(installed.build)})`,
    `Runtime: ${input.developmentBuild ? "development" : "release"}`,
    `App identity: ${identity}`,
    `Auth selection: ${selected ? selected.staging ? "staging" : "normal" : "unavailable"}`,
    `Build mode: ${!input.mode ? "unset" : input.mode === "staging-account" ? "staging-account" : "unrecognized"}`,
    `Normal URL: ${presence(input.productionUrl)}`,
    `Normal key: ${presence(input.productionKey)}`,
    ...(stagingRequested ? [
      `Native staging identity: ${input.nativeStagingBuild ? "yes" : "no"}`,
      `Staging release flag: ${input.stagingAccountRelease ? "enabled" : "disabled"}`,
      `Staging URL: ${presence(input.stagingUrl)}`,
      `Staging key: ${presence(input.stagingKey)}`,
    ] : []),
    `Failed checks: ${failedChecks.length ? failedChecks.join(", ") : "none"}`,
  ].join("\n");
}
