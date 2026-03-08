import test from "node:test";
import assert from "node:assert/strict";
import {
  convertJsonSchemaToTypeBox,
  createToolParameters,
  __setTypeBoxMissingForTests
} from "../schema-convert.ts";

test("converts string schema", async () => {
  __setTypeBoxMissingForTests(false);
  const schema = await convertJsonSchemaToTypeBox({ type: "string", minLength: 1 });
  assert.equal(schema.type, "string");
  assert.equal(schema.minLength, 1);
});

test("converts number schema", async () => {
  __setTypeBoxMissingForTests(false);
  const schema = await convertJsonSchemaToTypeBox({ type: "number", minimum: 2, maximum: 5 });
  assert.equal(schema.type, "number");
  assert.equal(schema.minimum, 2);
  assert.equal(schema.maximum, 5);
});

test("converts object schema", async () => {
  __setTypeBoxMissingForTests(false);
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
  __setTypeBoxMissingForTests(false);
  const schema = await convertJsonSchemaToTypeBox({ type: "array", items: { type: "string" } });
  assert.equal(schema.type, "array");
  assert.equal(schema.items.type, "string");
});

test("converts anyOf schema", async () => {
  __setTypeBoxMissingForTests(false);
  const schema = await convertJsonSchemaToTypeBox({
    anyOf: [{ type: "string" }, { type: "number" }]
  });

  assert.ok(Array.isArray(schema.anyOf));
  assert.equal(schema.anyOf.length, 2);
  assert.equal(schema.anyOf[0].type, "string");
  assert.equal(schema.anyOf[1].type, "number");
});

test("falls back when TypeBox is missing", async () => {
  __setTypeBoxMissingForTests(true);
  const schema = await convertJsonSchemaToTypeBox({ type: "string" });
  const params = await createToolParameters({ type: "object" });
  __setTypeBoxMissingForTests(false);

  assert.equal(schema.type, "any");
  assert.equal(params.type, "any");
});
