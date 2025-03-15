import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} from "obscenity";
import { simpleHash } from "../Util";

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

export const MIN_USERNAME_LENGTH = 3;
export const MAX_USERNAME_LENGTH = 27;

const validPattern = /^[a-zA-Z0-9_\[\] 🐈🍀üÜ]+$/u;

const shadowNames = [
  "NicePeopleOnly",
  "BeKindPlz",
  "LearningManners",
  "StayClassy",
  "BeNicer",
  "NeedHugs",
  "MakeFriends",
];

const banNames = [
  "nig",
  "n1g",
  "n!g",
  "n!6",
  "nigger",
  "nga",
  "nigga",
  "niga",
  "niger",
  "negro",
  "negre",
  "nègre",
  "niggaan",
  "niggit",
  "niggas",
  "niggging",
  "niggles",
  "nigglers",
  "niggly",
  "niggled",
  "niggler",
  "niggling",
  "niggo",
  "negroin",
  "negrin",
  "negrois",
  "negra",
  "negras",
  "negreis",
  "negranges",
  "negrra",
  "negrgba",
  "negrrana",
  "negrra8",
  "nigglor",
  "niggleros",
  "nigglerss",
  "nigglersa",
  "nigglersx",
  "nigglery",
  "nigglers",
  "nigglersf",
  "nigglersk",
  "nigglersc",
  "nigglersm",
  "negrra123",
  "negro123",
  "negre123",
  "negra123",
  "negras123",
  "negranges123",
  "negrra1234",
  "negro1234",
  "negre1234",
  "negra1234",
  "negras1234",
  "negranges1234",
  "niño de negro",
  "niña de negro",
  "niño de negros",
  "niña de negras",
  "niño de negre",
  "niño de nere",
  "niño de niqo",
  "niña de niqo",
  "negrof",
  "nigrof",
  "negrofi",
  "negrofie",
  "negrofil",
  "negrofr",
  "negrofra",
  "nigrofa",
  "nigrofeb",
  "nigrofec",
  "nigrofed",
  "nigrofen",
  "nigrofeq",
  "nigrofre",
  "nigrofrg",
  "nigrofrm",
  "nigrofrt",
  "nigrofro",
  "nigrofrr",
  "nigrofrs",
  "nigrofrt",
  "nigrofrv",
  "negrofri",
  "negrofrj",
  "negrofrk",
  "negrofrl",
  "negrofrm",
  "negrofrn",
  "negrofrx",
  "negrofrd",
  "negrofraa",
  "negrofrab",
  "negrofrac",
  "negrofrad",
  "negrofrae",
  "negrofrah",
  "negrofras",
  "negrofrat",
  "negrofrau",
  "negrofrav",
  "negrofrax",
  "negrofraa123",
  "negrofrab123",
  "negrofrac123",
];

export function fixProfaneUsername(username: string): string {
  if (isProfaneUsername(username)) {
    return shadowNames[simpleHash(username) % shadowNames.length];
  }
  return username;
}

export function isProfaneUsername(username: string): boolean {
  return matcher.hasMatch(username) || username.toLowerCase().includes("nig");
}

export function validateUsername(username: string): {
  isValid: boolean;
  error?: string;
} {
  if (typeof username !== "string") {
    return { isValid: false, error: "Username must be a string." };
  }

  if (
    username === banNames.find((name) => username.toLowerCase().includes(name))
  ) {
    return {
      isValid: false,
      error: "Username is banned.", // added banned usernames
    };
  }

  if (username.length < MIN_USERNAME_LENGTH) {
    return {
      isValid: false,
      error: `Username must be at least ${MIN_USERNAME_LENGTH} characters long.`,
    };
  }

  if (username.length > MAX_USERNAME_LENGTH) {
    return {
      isValid: false,
      error: `Username must not exceed ${MAX_USERNAME_LENGTH} characters.`,
    };
  }

  if (!validPattern.test(username)) {
    return {
      isValid: false,
      error:
        "Username can only contain letters, numbers, spaces, underscores, and [square brackets].",
    };
  }

  // All checks passed
  return { isValid: true };
}

export function sanitizeUsername(str: string): string {
  const sanitized = str
    .replace(/[^a-zA-Z0-9_\[\] 🐈🍀]/gu, "")
    .slice(0, MAX_USERNAME_LENGTH);
  return sanitized.padEnd(MIN_USERNAME_LENGTH, "x");
}
