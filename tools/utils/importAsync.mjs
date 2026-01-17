import fs from "node:fs";
import { pathToFileURL } from "node:url";

export const importAsync = async (filePath) => {
  
  if (!filePath) return null;
  if (!fs.existsSync(filePath)) return null;
  return  await import(pathToFileURL(filePath).href)
}