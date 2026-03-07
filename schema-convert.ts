// Multiple fallback strategies for TypeBox import
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
      // Strategy 3: Try known OpenClaw paths
      const knownPaths = [
        "/home/agbergsmann/.nvm/versions/node/v22.22.0/lib/node_modules/openclaw",
        "/usr/local/lib/node_modules/openclaw",
        "/opt/openclaw/node_modules"
      ];
      
      let found = false;
      for (const path of knownPaths) {
        try {
          const typeboxPath = require.resolve("@sinclair/typebox", { paths: [path] });
          Type = require(typeboxPath).Type;
          found = true;
          break;
        } catch (e) {
          // Continue to next path
        }
      }
      
      if (!found) {
        throw new Error("TypeBox not found in any known location");
      }
    } catch (error3) {
      throw new Error(`Failed to import TypeBox: ${error3.message}. Original errors: ${error.message}, ${error2.message}`);
    }
  }
}
type TSchema = any;

export function convertJsonSchemaToTypeBox(schema: any): TSchema {
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
        return Type.Array(convertJsonSchemaToTypeBox(schema.items));
      }
      return Type.Array(Type.Any());
    
    case "object":
      if (schema.properties) {
        const properties: Record<string, TSchema> = {};
        for (const [key, value] of Object.entries(schema.properties)) {
          properties[key] = convertJsonSchemaToTypeBox(value as any);
        }
        
        const objectOptions: any = {};
        if (schema.required && Array.isArray(schema.required)) {
          // Mark required properties
          objectOptions.required = schema.required;
        }
        
        return Type.Object(properties, objectOptions);
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
    return convertJsonSchemaToTypeBox(inputSchema);
  }

  // If it's not an object, wrap it in an object
  return Type.Object({
    input: convertJsonSchemaToTypeBox(inputSchema)
  });
}