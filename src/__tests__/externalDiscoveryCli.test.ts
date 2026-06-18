import { describe, expect, it } from "vitest";
import {
  parseArgs,
  resolveExternalDiscoveryCliMode,
  validateExternalDiscoveryCliMatrix,
} from "../cli.ts";

const BASE_ARGV = ["node", "src/cli.ts"];
const DATE_ARGS = ["--date", "2026-06-14"];
const INPUT_PATH = "data/raw/external-discovery/fixtures/sanitized-agent-reach.sample.json";

function parse(command: string, ...args: string[]) {
  return parseArgs([...BASE_ARGV, command, ...DATE_ARGS, ...args]);
}

describe("external discovery CLI command matrix", () => {
  it("defaults run-daily to enabled external discovery without explicit input", () => {
    const { command, opts } = parse("run-daily");
    const mode = resolveExternalDiscoveryCliMode(command, opts);

    expect(opts.externalDiscoveryEnabled).toBe(true);
    expect(opts.externalDiscoveryInputExplicit).toBe(false);
    expect(mode).toEqual({
      enabled: true,
      readsExternalRawInput: true,
      generatesDailyAggregate: true,
      allowsExternalDiscoveryInput: true,
      externalDiscoveryInputExplicit: false,
    });
  });

  it("allows run-daily to preserve an explicit local input path", () => {
    const { command, opts } = parse("run-daily", "--external-discovery-input", INPUT_PATH);
    const mode = resolveExternalDiscoveryCliMode(command, opts);

    expect(opts.externalDiscoveryInputExplicit).toBe(true);
    expect(opts.externalDiscoveryInputPath).toBe(INPUT_PATH);
    expect(mode.externalDiscoveryInputPath).toBe(INPUT_PATH);
    expect(mode.readsExternalRawInput).toBe(true);
    expect(mode.generatesDailyAggregate).toBe(true);
  });

  it("disables run-daily external discovery when requested", () => {
    const { command, opts } = parse("run-daily", "--no-external-discovery");
    const mode = resolveExternalDiscoveryCliMode(command, opts);

    expect(mode).toEqual({
      enabled: false,
      readsExternalRawInput: false,
      generatesDailyAggregate: false,
      allowsExternalDiscoveryInput: true,
      externalDiscoveryInputExplicit: false,
      disabledStatusReason: "disabled_by_flag",
    });
  });

  it("keeps recover-daily from reading external raw input by default", () => {
    const { command, opts } = parse("recover-daily");
    const mode = resolveExternalDiscoveryCliMode(command, opts);

    expect(mode).toEqual({
      enabled: true,
      readsExternalRawInput: false,
      generatesDailyAggregate: false,
      allowsExternalDiscoveryInput: true,
      externalDiscoveryInputExplicit: false,
    });
  });

  it("allows recover-daily explicit input to express aggregate rebuild intent", () => {
    const { command, opts } = parse("recover-daily", "--external-discovery-input", INPUT_PATH);
    const mode = resolveExternalDiscoveryCliMode(command, opts);

    expect(mode).toEqual({
      enabled: true,
      readsExternalRawInput: true,
      generatesDailyAggregate: true,
      allowsExternalDiscoveryInput: true,
      externalDiscoveryInputExplicit: true,
      externalDiscoveryInputPath: INPUT_PATH,
    });
  });

  it("fails fast when run-weekly receives an explicit external discovery input", () => {
    const { command, opts } = parse("run-weekly", "--external-discovery-input", INPUT_PATH);

    expect(() => validateExternalDiscoveryCliMatrix(command, opts)).toThrow(
      /run-weekly does not accept --external-discovery-input/,
    );
  });

  it("fails fast when verify-daily receives an explicit external discovery input", () => {
    const { command, opts } = parse("verify-daily", "--external-discovery-input", INPUT_PATH);

    expect(() => validateExternalDiscoveryCliMatrix(command, opts)).toThrow(
      /verify-daily does not accept --external-discovery-input/,
    );
  });

  it.each(["run-weekly", "verify-daily"])(
    "allows %s to disable external discovery without an explicit raw input",
    (commandName) => {
      const { command, opts } = parse(commandName, "--no-external-discovery");
      const mode = resolveExternalDiscoveryCliMode(command, opts);

      expect(() => validateExternalDiscoveryCliMatrix(command, opts)).not.toThrow();
      expect(mode.enabled).toBe(false);
      expect(mode.readsExternalRawInput).toBe(false);
      expect(mode.generatesDailyAggregate).toBe(false);
      expect(mode.disabledStatusReason).toBe("disabled_by_flag");
    },
  );

  it("preserves dry-run run-daily disabled intent without raw reads or aggregate writes", () => {
    const { command, opts } = parse("run-daily", "--dry-run", "--no-external-discovery");
    const mode = resolveExternalDiscoveryCliMode(command, opts);

    expect(opts.dryRun).toBe(true);
    expect(mode.enabled).toBe(false);
    expect(mode.readsExternalRawInput).toBe(false);
    expect(mode.generatesDailyAggregate).toBe(false);
  });

  it("preserves dry-run run-daily explicit input intent as planned external work", () => {
    const { command, opts } = parse(
      "run-daily",
      "--dry-run",
      "--external-discovery-input",
      INPUT_PATH,
    );
    const mode = resolveExternalDiscoveryCliMode(command, opts);

    expect(opts.dryRun).toBe(true);
    expect(mode.externalDiscoveryInputExplicit).toBe(true);
    expect(mode.externalDiscoveryInputPath).toBe(INPUT_PATH);
    expect(mode.readsExternalRawInput).toBe(true);
    expect(mode.generatesDailyAggregate).toBe(true);
  });

  it("preserves dry-run recover-daily disabled intent", () => {
    const { command, opts } = parse("recover-daily", "--dry-run", "--no-external-discovery");
    const mode = resolveExternalDiscoveryCliMode(command, opts);

    expect(opts.dryRun).toBe(true);
    expect(mode.enabled).toBe(false);
    expect(mode.readsExternalRawInput).toBe(false);
    expect(mode.generatesDailyAggregate).toBe(false);
  });

  it.each(["run-weekly", "verify-daily"])(
    "preserves dry-run %s disabled intent",
    (commandName) => {
      const { command, opts } = parse(commandName, "--dry-run", "--no-external-discovery");
      const mode = resolveExternalDiscoveryCliMode(command, opts);

      expect(opts.dryRun).toBe(true);
      expect(mode.enabled).toBe(false);
      expect(mode.readsExternalRawInput).toBe(false);
      expect(mode.generatesDailyAggregate).toBe(false);
    },
  );

  it("rejects --external-discovery-input without a path", () => {
    expect(() => parse("run-daily", "--external-discovery-input")).toThrow(
      /--external-discovery-input requires a path/,
    );
  });

  it("rejects --external-discovery-input when the next token is another flag", () => {
    expect(() => parse("run-daily", "--external-discovery-input", "--dry-run")).toThrow(
      /--external-discovery-input requires a path/,
    );
  });

  it("lets --no-external-discovery take precedence over explicit input for run-daily", () => {
    const { command, opts } = parse(
      "run-daily",
      "--no-external-discovery",
      "--external-discovery-input",
      INPUT_PATH,
    );
    const mode = resolveExternalDiscoveryCliMode(command, opts);

    expect(mode.enabled).toBe(false);
    expect(mode.externalDiscoveryInputExplicit).toBe(true);
    expect(mode.readsExternalRawInput).toBe(false);
    expect(mode.generatesDailyAggregate).toBe(false);
  });

  it("lets --no-external-discovery take precedence over explicit input for recover-daily", () => {
    const { command, opts } = parse(
      "recover-daily",
      "--no-external-discovery",
      "--external-discovery-input",
      INPUT_PATH,
    );
    const mode = resolveExternalDiscoveryCliMode(command, opts);

    expect(mode.enabled).toBe(false);
    expect(mode.externalDiscoveryInputExplicit).toBe(true);
    expect(mode.readsExternalRawInput).toBe(false);
    expect(mode.generatesDailyAggregate).toBe(false);
  });

  it("still fails fast for run-weekly when disabled and explicit input are both present", () => {
    const { command, opts } = parse(
      "run-weekly",
      "--no-external-discovery",
      "--external-discovery-input",
      INPUT_PATH,
    );

    expect(() => validateExternalDiscoveryCliMatrix(command, opts)).toThrow(
      /run-weekly does not accept --external-discovery-input/,
    );
  });

  it("still fails fast for verify-daily when disabled and explicit input are both present", () => {
    const { command, opts } = parse(
      "verify-daily",
      "--no-external-discovery",
      "--external-discovery-input",
      INPUT_PATH,
    );

    expect(() => validateExternalDiscoveryCliMatrix(command, opts)).toThrow(
      /verify-daily does not accept --external-discovery-input/,
    );
  });
});
