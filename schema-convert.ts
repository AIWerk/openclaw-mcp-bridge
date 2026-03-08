const fs = require("fs");
const path = require("path");

// Multiple fallback strategies for TypeBox import
// TODO: Refactor when OpenClaw supports native ESM / dependency injection for plugins
let Type: any;
try {
  // Strategy 1: Try normal require first
  Type = require("@sinclair/typebox").Type;
} catch (error) {
  try {
    // Strategy 2: Try resolving from process.cwd()
    const typeboxPath = require.resolve("@sinclair/typebox", { paths: [process.cwd()] });
    Type = require(typeboxPath).Type;
  } catch (error2) {
    try {
      // Strategy 3: Resolve from __dirname, then walk parent directories
      const searchPaths: string[] = [__dirname];
      let currentDir = __dirname;

      while (true) {
        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) {
          break;
        }
        currentDir = parentDir;
        searchPaths.push(currentDir);
      }

      let found = false;
      for (const basePath of searchPaths) {
        try {
          const localNodeModulesPath = path.join(basePath, "node_modules");
          const typeboxPkgPath = path.join(localNodeModulesPath, "@sinclair", "typebox", "package.json");
          if (!fs.existsSync(typeboxPkgPath)) {
            continue;
          }

          const typeboxPath = require.resolve("@sinclair/typebox", { paths: [basePath, localNodeModulesPath] });
          Type = require(typeboxPath).Type;
          found = true;
          break;
        } catch (e) {
          // Continue to next path
        }
      }
      
      if (!found) {
        throw new Error("TypeBox not found from __dirname parent search paths");
      }
    } catch (error3) {
      throw new Error(`Failed to import TypeBox: ${error3.message}. Original errors: ${error.message}, ${error2.message}`);
    }
  }
}
type TSchema = any;

// Logger can be injected via setSchemaLogger(); defaults to console
let schemaLogger: { warn: (...args: any[]) => void } = console;
export function setSchemaLogger(logger: { warn: (...args: any[]) => void }): void {
  schemaLogger = logger;
}

export function convertJsonSchemaToTypeBox(schema: any, depth = 0): TSchema {
  if (depth > 10) {
    schemaLogger.warn("[mcp-client] JSON schema depth limit exceeded (>10), falling back to Type.Any()");
    return Type.Any();
  }

  if (!schema || typeof schema !== "object") {
    return Type.Any();
  }

  // Handle type property
  switch (schema.type) {
    case "string":
      if (schema.enum) {
        return Type.Union(schema.enum.map((value: string) => Type.Literal(value)));
      }
      const stringOptions: any = {};
      if (schema.minLength !== undefined) stringOptions.minLength = schema.minLength;
      if (schema.maxLength !== undefined) stringOptions.maxLength = schema.maxLength;
      if (schema.pattern !== undefined) stringOptions.pattern = schema.pattern;
      return Type.String(stringOptions);
    
    case "number":
    case "integer":
      const numberOptions: any = {};
      if (schema.minimum !== undefined) numberOptions.minimum = schema.minimum;
      if (schema.maximum !== undefined) numberOptions.maximum = schema.maximum;
      return Type.Number(numberOptions);
    
    case "boolean":
      return Type.Boolean();
    
    case "array":
      if (schema.items) {
        return Type.Array(convertJsonSchemaToTypeBox(schema.items, depth + 1));
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
          const converted = convertJsonSchemaToTypeBox(value as any, depth + 1);
          properties[key] = requiredSet.has(key) ? converted : Type.Optional(converted);
        }

        return Type.Object(properties);
      }
      return Type.Object({});
    
    case "null":
      return Type.Null();
    
    default:
      // Unknown type or no type specified
      return Type.Any();
  }
}

export function createToolParameters(inputSchema: any): TSchema {
  if (!inputSchema) {
    return Type.Object({});
  }

  // If the inputSchema is already a proper object schema, convert it
  if (inputSchema.type === "object") {
    return convertJsonSchemaToTypeBox(inputSchema, 0);
  }

  // If it's not an object, wrap it in an object
  return Type.Object({
    input: convertJsonSchemaToTypeBox(inputSchema, 0)
  });
}
