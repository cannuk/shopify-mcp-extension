// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { createJsonTree } from "../json-tree";

describe("createJsonTree", () => {
  describe("primitives", () => {
    it("renders null", () => {
      const el = createJsonTree(null);
      expect(el.textContent).toBe("null");
      expect(el.className).toBe("json-null");
    });

    it("renders undefined", () => {
      const el = createJsonTree(undefined);
      expect(el.textContent).toBe("undefined");
      expect(el.className).toBe("json-null");
    });

    it("renders strings with quotes", () => {
      const el = createJsonTree("hello");
      expect(el.textContent).toBe('"hello"');
      expect(el.className).toBe("json-string");
    });

    it("renders numbers", () => {
      const el = createJsonTree(42);
      expect(el.textContent).toBe("42");
      expect(el.className).toBe("json-number");
    });

    it("renders booleans", () => {
      const el = createJsonTree(true);
      expect(el.textContent).toBe("true");
      expect(el.className).toBe("json-boolean");
    });
  });

  describe("objects", () => {
    it("renders empty object", () => {
      const el = createJsonTree({});
      expect(el.textContent).toBe("{}");
      expect(el.className).toBe("json-bracket");
    });

    it("renders object with keys", () => {
      const el = createJsonTree({ name: "test", count: 5 });
      expect(el.tagName).toBe("DETAILS");
      expect(el.className).toBe("json-node");
      // Should have summary + 2 rows
      const rows = el.querySelectorAll(".json-row");
      expect(rows).toHaveLength(2);
      // Check key names are present
      expect(el.textContent).toContain("name:");
      expect(el.textContent).toContain("count:");
    });

    it("opens top-level by default", () => {
      const el = createJsonTree({ a: 1 }) as HTMLDetailsElement;
      expect(el.open).toBe(true);
    });

    it("collapses nested objects", () => {
      const el = createJsonTree({ nested: { a: 1 } });
      const nestedDetails = el.querySelector("details.json-node");
      expect((nestedDetails as HTMLDetailsElement)?.open).toBe(false);
    });
  });

  describe("arrays", () => {
    it("renders empty array", () => {
      const el = createJsonTree([]);
      expect(el.textContent).toBe("[]");
      expect(el.className).toBe("json-bracket");
    });

    it("renders array with items", () => {
      const el = createJsonTree([1, 2, 3]);
      expect(el.tagName).toBe("DETAILS");
      const rows = el.querySelectorAll(".json-row");
      expect(rows).toHaveLength(3);
    });

    it("shows array count in summary", () => {
      const el = createJsonTree(["a", "b"]);
      const summary = el.querySelector("summary");
      expect(summary?.textContent).toContain("(2)");
    });
  });

  describe("double-encoded JSON", () => {
    it("parses JSON strings into trees", () => {
      const jsonStr = JSON.stringify({ product: "shoes", price: 50 });
      const el = createJsonTree(jsonStr);
      // Should render as an object tree, not a string
      expect(el.tagName).toBe("DETAILS");
      expect(el.textContent).toContain("product:");
      expect(el.textContent).toContain("price:");
    });

    it("parses JSON array strings into trees", () => {
      const jsonStr = JSON.stringify([1, 2, 3]);
      const el = createJsonTree(jsonStr);
      expect(el.tagName).toBe("DETAILS");
      const rows = el.querySelectorAll(".json-row");
      expect(rows).toHaveLength(3);
    });

    it("renders non-JSON strings normally", () => {
      const el = createJsonTree("just a string");
      expect(el.textContent).toBe('"just a string"');
      expect(el.className).toBe("json-string");
    });

    it("renders strings starting with { but invalid JSON as strings", () => {
      const el = createJsonTree("{not json");
      expect(el.textContent).toBe('"{not json"');
      expect(el.className).toBe("json-string");
    });
  });

  describe("nested structures", () => {
    it("handles deeply nested data", () => {
      const data = { a: { b: { c: [1, { d: "deep" }] } } };
      const el = createJsonTree(data);
      expect(el.textContent).toContain("deep");
    });
  });

  describe("HTML escaping", () => {
    it("escapes HTML characters in keys", () => {
      const el = createJsonTree({ "<script>": "xss" });
      const keyEl = el.querySelector(".json-key");
      expect(keyEl?.innerHTML).toContain("&lt;script&gt;");
    });
  });
});
