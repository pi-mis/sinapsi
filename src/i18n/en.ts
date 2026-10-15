import { APP } from "./en/app";
import { UI } from "./en/ui";
import { IMPORTS } from "./en/imports";
import { LOGIC } from "./en/logic";
import { ONBOARDING } from "./en/onboarding";
import { SERVER } from "./en/server";

/** Italian → English. Add new strings to the file of their area. */
export const EN = {
  ...APP,
  ...UI,
  ...IMPORTS,
  ...LOGIC,
  ...ONBOARDING,
  ...SERVER,
} as const;
