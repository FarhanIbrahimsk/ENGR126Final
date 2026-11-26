import { test } from "node:test";
import assert from "node:assert/strict";

import { FLAG_PHRASES, phraseFor } from "../src/app/audio/voice.js";
import { RULE_FLAGS } from "../src/shared/contract.js";

const rep = (ruleFlags = [], classifier = null) => ({ ruleFlags, classifier });

test("a clean rep is announced by the successful count", () => {
  assert.equal(phraseFor(rep(), 3), "3");
  assert.equal(phraseFor(rep([], { label: "good", confidence: 0.9 }), 4), "4");
});

test("a flagged rep says only its first problem", () => {
  assert.equal(phraseFor(rep(["shallow", "excessive_lean"]), 2), "Too shallow");
});

test("a rep only the classifier dislikes gets a general warning", () => {
  assert.equal(phraseFor(rep([], { label: "bad", confidence: 0.8 }), 2), "Check your form");
});

test("every rule flag has a phrase", () => {
  for (const flag of RULE_FLAGS) assert.ok(FLAG_PHRASES[flag], flag);
});
