import { readFileSync } from "fs";

export function readConfigValue(name: string): string {
  const directValue = String(process.env[name] || "").trim();
  if (directValue) return directValue;

  const filePath = String(process.env[`${name}_FILE`] || "").trim();
  if (!filePath) return "";

  try {
    return readFileSync(filePath, "utf8").trim();
  } catch (error) {
    console.error(`Failed to read ${name} from ${name}_FILE (${filePath}):`, error);
    return "";
  }
}
