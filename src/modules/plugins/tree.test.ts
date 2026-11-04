import { describe, expect, it } from "vitest";
import { parseActivity, parseNode, parsePeek } from "./tree";

describe("parseNode", () => {
  it("reads a tree, with defaults", () => {
    const node = parseNode({
      type: "row",
      children: [
        { type: "icon", icon: "☀️" },
        { type: "text", text: "14°", style: "large", color: "orange" },
        { type: "button", label: "Refresh", action: "refresh" },
      ],
    });
    expect(node).toEqual({
      type: "stack",
      direction: "row",
      gap: 8,
      align: "center",
      justify: "start",
      grow: false,
      children: [
        { type: "icon", icon: "☀️", size: 20 },
        { type: "text", text: "14°", style: "large", color: "orange", lines: 2 },
        { type: "button", label: "Refresh", icon: "", action: "refresh", style: "pill", color: "primary" },
      ],
    });
  });

  it("drops what it does not know, and buttons without an action", () => {
    const node = parseNode({
      type: "column",
      children: [{ type: "html", html: "<script>" }, { type: "button", label: "x" }, "text", null, { type: "spacer" }],
    });
    expect(node?.type === "stack" && node.children).toEqual([{ type: "spacer" }]);
  });

  it("keeps values in range and colours among Quiera's", () => {
    const node = parseNode({ type: "progress", value: 7, color: "#ff0000", size: 500 });
    expect(node).toEqual({ type: "progress", value: 1, color: "primary", ring: false, size: 64 });
    expect(parseNode({ type: "text", text: "x", style: "huge" })).toMatchObject({ style: "body" });
  });

  it("stops at a reasonable depth", () => {
    let deep: unknown = { type: "text", text: "bottom" };
    for (let i = 0; i < 20; i++) deep = { type: "column", children: [deep] };
    const flat = JSON.stringify(parseNode(deep));
    expect(flat).not.toContain("bottom");
  });

  it("does not let a long text pass for an icon", () => {
    expect(parseNode({ type: "icon", icon: "Click here to log in to your bank" })).toMatchObject({ icon: "Clic" });
  });
});

describe("parseActivity and parsePeek", () => {
  it("reads them, or nothing when empty", () => {
    expect(parseActivity({ icon: "☀️", text: "14°" })).toEqual({ icon: "☀️", text: "14°", color: "primary", progress: null });
    expect(parseActivity({ progress: 0.5, text: "Build" })).toMatchObject({ progress: 0.5 });
    expect(parseActivity({})).toBeNull();
    expect(parsePeek({ title: "Rain at 15:00", icon: "🌧️" })).toEqual({ icon: "🌧️", title: "Rain at 15:00", text: "" });
    expect(parsePeek({ text: "no title" })).toBeNull();
  });
});
