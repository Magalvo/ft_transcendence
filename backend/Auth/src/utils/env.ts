import { readFileSync } from "fs";

export function readConfigValue(name: string): string {
  const filePath = String(process.env[`${name}_FILE`] || "").trim();
  if (filePath) {
    try {
      return readFileSync(filePath, "utf8").trim();
    } catch (error) {
      console.error(`Failed to read ${name} from ${name}_FILE (${filePath}):`, error);
    }
  }

  return String(process.env[name] || "").trim();
}
