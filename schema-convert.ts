type TSchema = any;
type TypeBoxMod = { Type: any } | null;

let cachedTypeBoxPromise: Promise<TypeBoxMod> | null = null;
let forceTypeBoxMissingForTests = false;

async function getTypeBox(): Promise<TypeBoxMod> {
  if (cachedTypeBoxPromise) {
    return cachedTypeBoxPromise;
  }

  cachedTypeBoxPromise = (async () => {
    try {
      if (forceTypeBoxMissingForTests) {
        throw new Error("TypeBox forced missing for tests");
      }
      const mod: any = await import("@sinclair/typebox");
      const Type = mod?.Type ?? mod?.default?.Type;
      if (!Type) {
        throw new Error("TypeBox module missing Type export");
      }
      return { Type };
    } catch (error) {
      return null;
    }
  })();

  return cachedTypeBoxPromise;
}

async function anyFallback(): Promise<TSchema> {
  const typeBox = await getTypeBox();
  if (typeBox?.Type) {
    return typeBox.Type.Any();
  }
  return { type: "any" };
}

// Logger can be injected via setSchemaLogger(); defaults to console
let schemaLogger: { warn: (...args: any[]) => void } = console;
export function setSchemaLogger(logger: { warn: (...args: any[]) => void }): void {
  schemaLogger = logger;
}

export async function convertJsonSchemaToTypeBox(schema: any, depth = 0): Promise<TSchema> {
  const typeBox = await getTypeBox();
  const Type = typeBox?.Type;
  if (!Type) {
    return anyFallback();
  }

  try {
    if (depth > 10) {
      schemaLogger.warn("[mcp-client] JSON schema depth limit exceeded (>10), falling back to Type.Any()");
      return Type.Any();
    }

    if (!schema || typeof schema !== "object") {
      return Type.Any();
    }

    if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
      const variants = await Promise.all(
        schema.anyOf.map((item: any) => convertJsonSchemaToTypeBox(item, depth + 1))
      );
      return Type.Union(variants);
    }

    switch (schema.type) {
      case "string": {
        if (schema.enum) {
          return Type.Union(schema.enum.map((value: string) => Type.Literal(value)));
        }
        const stringOptions: any = {};
        if (schema.minLength !== undefined) stringOptions.minLength = schema.minLength;
        if (schema.maxLength !== undefined) stringOptions.maxLength = schema.maxLength;
        if (schema.pattern !== undefined) stringOptions.pattern = schema.pattern;
        return Type.String(stringOptions);
      }
      case "number":
      case "integer": {
        const numberOptions: any = {};
        if (schema.minimum !== undefined) numberOptions.minimum = schema.minimum;
        if (schema.maximum !== undefined) numberOptions.maximum = schema.maximum;
        return Type.Number(numberOptions);
      }
      case "boolean":
        return Type.Boolean();
      case "array":
        if (schema.items) {
          return Type.Array(await convertJsonSchemaToTypeBox(schema.items, depth + 1));
        }
        return Type.Array(Type.Any());
      case "object":
        if (schema.properties) {
          const propertyEntries = Object.entries(schema.properties);
          if (propertyEntries.length > 100) {
            schemaLogger.warn("[mcp-client] JSON schema object has too many properties (>100), falling back to Type.Any()");
            return Type.Any();
          }

          const properties: Record<string, TSchema> = {};
          const requiredSet = new Set<string>(
            Array.isArray(schema.required) ? schema.required : []
          );

          for (const [key, value] of propertyEntries) {
            const converted = await convertJsonSchemaToTypeBox(value as any, depth + 1);
            properties[key] = requiredSet.has(key) ? converted : Type.Optional(converted);
          }
          return Type.Object(properties);
        }
        return Type.Object({});
      case "null":
        return Type.Null();
      default:
        return Type.Any();
    }
  } catch (error) {
    schemaLogger.warn("[mcp-client] Failed to convert JSON schema, falling back to Type.Any()");
    return Type.Any();
  }
}

export async function createToolParameters(inputSchema: any): Promise<TSchema> {
  const typeBox = await getTypeBox();
  const Type = typeBox?.Type;
  if (!Type) {
    return anyFallback();
  }

  if (!inputSchema) {
    return Type.Object({});
  }

  // If the inputSchema is already a proper object schema, convert it
  if (inputSchema.type === "object") {
    return convertJsonSchemaToTypeBox(inputSchema, 0);
  }

  // If it's not an object, wrap it in an object
  return Type.Object({
    input: await convertJsonSchemaToTypeBox(inputSchema, 0)
  });
}

export function __setTypeBoxMissingForTests(missing: boolean): void {
  forceTypeBoxMissingForTests = missing;
  cachedTypeBoxPromise = null;
}
