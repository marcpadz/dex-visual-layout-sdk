import { describe, expect, it } from "vitest";
import { describeLayoutStream } from "../src/detect.js";

describe("describeLayoutStream", () => {
  it("not started for plain prose", () => {
    expect(describeLayoutStream("Here is your document...\n")).toEqual({ started: false, preset: null });
  });
  it("detects fence with variant and height tokens", () => {
    const r = describeLayoutStream("Sure!\n```layout:html variant=magazine height=520\n<!DOCTYPE html>...");
    expect(r).toEqual({ started: true, preset: "html", variant: "magazine", initialHeight: 520 });
  });
  it("applies preset defaults without tokens", () => {
    expect(describeLayoutStream("```layout:html\n")).toEqual({ started: true, preset: "html", initialHeight: 420 });
    expect(describeLayoutStream("```layout:markdown\n# T")).toEqual({ started: true, preset: "markdown", initialHeight: 240 });
  });
  it("info string still arriving", () => {
    expect(describeLayoutStream("```layout:")).toEqual({ started: true, preset: null });
  });
  it("clamps height to sane bounds", () => {
    const r = describeLayoutStream("```layout:html height=99999\n");
    expect(r.initialHeight).toBe(2000);
  });
  it("whole-message html fallback streams as html", () => {
    expect(describeLayoutStream("<!DOCTYPE html><html>")).toEqual({ started: true, preset: "html", initialHeight: 420 });
  });
});
