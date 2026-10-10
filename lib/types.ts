// Shared types used by the client and the API routes.

export type SideEffectLevel = "common" | "rare" | "listed" | "stop";

export interface MedQuery {
  name: string;
  strength: string;
  form: string;
  ndc?: string;
}

export interface MedResult {
  query: MedQuery;
  /** Name of the official label that was matched, e.g. "Acetaminophen 500 MG Oral Tablet". */
  matchedName: string;
  genericNames: string[];
  brandNames: string[];
  pharmClasses: string[];
  oneLine: string;
  whatFor: string[];
  howToTake: string[];
  sideEffects: { text: string; level: SideEffectLevel }[];
  interactions: { title: string; text: string }[];
  getHelp: string[];
  /** true when the plain-language rewrite ran; false means the label's own words are shown. */
  plainLanguage: boolean;
  language: string;
  source: { name: "openFDA" | "DailyMed"; url: string; updated?: string };
  /** Raw label excerpts kept for on-device interaction checks and spoken questions. */
  labelText: { warnings: string; full: string };
}

export type LabelResponse =
  | { status: "ok"; result: MedResult; cached?: boolean; notice?: string }
  | { status: "not_found"; message: string }
  | { status: "error"; message: string };

export interface ExtractedMedicine {
  name: string;
  strength: string;
  form: string;
  method: "vision" | "ocr" | "barcode";
  lowConfidence?: boolean;
}

export interface ExtractedIngredients {
  productName: string;
  ingredients: string;
  method: "vision" | "ocr";
}

export interface SavedMedicine {
  id: string;
  savedAt: number;
  result: MedResult;
}

export interface Settings {
  textSize: 1 | 2 | 3 | 4;
  voiceMode: boolean;
  highContrast: boolean;
  voiceRate: number;
  language: string;
}

export interface Profile {
  allergies: string[];
  goals: string[];
}

export interface AppData {
  settings: Settings;
  profile: Profile;
  medicines: SavedMedicine[];
}
