import test from "node:test";
import assert from "node:assert/strict";
import {
  convertJsonSchemaToTypeBox,
  createToolParameters,
  setTypeBoxLoader
} from "../schema-convert.ts";

test("converts string schema", async () => {
  const schema = await convertJsonSchemaToTypeBox({ type: "string", minLength: 1 });
  assert.equal(schema.type, "string");
  assert.equal(schema.minLength, 1);
});

test("converts number schema", async () => {
  const schema = await convertJsonSchemaToTypeBox({ type: "number", minimum: 2, maximum: 5 });
  assert.equal(schema.type, "number");
  assert.equal(schema.minimum, 2);
  assert.equal(schema.maximum, 5);
});

test("converts object schema", async () => {
  const schema = await convertJsonSchemaToTypeBox({
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "number" }
    },
    required: ["name"]
  });

  assert.equal(schema.type, "object");
  assert.ok(schema.properties.name);
  assert.ok(schema.properties.age);
});

test("converts array schema", async () => {
  const schema = await convertJsonSchemaToTypeBox({ type: "array", items: { type: "string" } });
  assert.equal(schema.type, "array");
  assert.equal(schema.items.type, "string");
});

test("converts anyOf schema", async () => {
  const schema = await convertJsonSchemaToTypeBox({
    anyOf: [{ type: "string" }, { type: "number" }]
  });

  assert.ok(Array.isArray(schema.anyOf));
  assert.equal(schema.anyOf.length, 2);
  assert.equal(schema.anyOf[0].type, "string");
  assert.equal(schema.anyOf[1].type, "number");
});

test("falls back when TypeBox is missing", async () => {
  // Inject a loader that simulates missing TypeBox
  setTypeBoxLoader(async () => null);

  try {
    const schema = await convertJsonSchemaToTypeBox({ type: "string" });
    const params = await createToolParameters({ type: "object" });

    // convertJsonSchemaToTypeBox fallback: empty schema {}
    assert.deepStrictEqual(schema, {});
    // createToolParameters fallback: returns raw inputSchema as-is
    assert.deepStrictEqual(params, { type: "object" });
  } finally {
    // Restore default loader
    setTypeBoxLoader(null);
  }
});
