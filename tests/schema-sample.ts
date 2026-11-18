/**
 * Arguments a tool's input schema accepts, read from what `tools/list` answers: the walks over every
 * tool (several accounts, a master key's refusals) call each tool with them.
 */

export interface JsonSchema {
  type?: string;
  enum?: unknown[];
  const?: unknown;
  format?: string;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  items?: JsonSchema;
  minItems?: number;
  properties?: Record<string, JsonSchema>;
  required?: string[];
}

/** A value the schema accepts. */
export function sample(schema: JsonSchema): unknown {
  if (schema.const !== undefined) return schema.const;
  if (schema.enum) return schema.enum[0];
  if (schema.anyOf) return sample(schema.anyOf[schema.anyOf.length - 1]);
  if (schema.oneOf) return sample(schema.oneOf[0]);
  switch (schema.type) {
    case "integer":
    case "number":
      return 1;
    case "boolean":
      return true;
    case "object":
      // Its required properties, each with a value its own schema accepts.
      return Object.fromEntries((schema.required ?? []).map((name) => [name, sample(schema.properties?.[name] ?? {})]));
    case "array":
      return (schema.minItems ?? 0) > 0 && schema.items ? [sample(schema.items)] : [];
    default:
      return schema.format === "uuid" ? "0b6c5f3e-8a9d-4c2b-9e1f-7a3d5c8b2e40" : "x";
  }
}

/** Arguments that pass the tool's schema, with `confirm: true` so a write sends its request. */
export function argumentsFor(schema: JsonSchema, account?: string): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (const name of schema.required ?? []) {
    args[name] = sample(schema.properties?.[name] ?? {});
  }
  if (schema.properties?.confirm) args.confirm = true;
  if (account !== undefined) args.account = account;
  return args;
}
