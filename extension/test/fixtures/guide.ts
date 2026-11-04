import type { Guide, Step } from "../../src/guide/types";

export function step(over: Partial<Step> = {}): Step {
  return {
    id: 1,
    kind: "code",
    title: "Mutation to save the photo",
    file: "convex/photos.ts",
    where: "at the end of the file",
    goal: "Save a photo with eventId and userId",
    concepts: [{ name: "mutation", explanation: "writes to the database", docs: "https://docs.convex.dev/functions/mutation-functions" }],
    criteria: ["SECRET-CRITERION uses mutation"],
    hints: ["HINT-1 gentle", "HINT-2 medium", "HINT-3 strong"],
    done: false,
    hintLevel: 0,
    ...over,
  };
}

export function guide(over: Partial<Guide> = {}): Guide {
  return {
    version: 1,
    request: "upload photos per event",
    title: "Photo upload",
    overview: "Schema, mutation and button",
    currentIndex: 0,
    finished: false,
    steps: [
      step({ id: 1, title: "photos table", file: "convex/schema.ts", goal: "GOAL-1 photos table" }),
      step({ id: 2, title: "Mutation", file: "convex/photos.ts", goal: "GOAL-2 mutation" }),
    ],
    ...over,
  };
}
