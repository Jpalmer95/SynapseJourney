/**
 * Self-test for the Unified Knowledge Ledger & Cross-Stream Concept Matching
 */
import assert from "node:assert/strict";
import { normalizeConcept, computeConceptOverlap } from "../server/knowledge-ledger";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (err) {
    console.error(`FAIL  ${name}:`, err);
    process.exitCode = 1;
  }
}

test("normalizeConcept strips stop words and punctuation", () => {
  assert.equal(
    normalizeConcept("Introduction to J2 Orbital Perturbations & Station-Keeping"),
    "j2-orbital-perturbations-station-keeping",
  );
});

test("computeConceptOverlap matches JIT concept to canonical course unit", () => {
  const jitConcept = "J2 oblateness perturbation drift in LEO satellite TLE propagation";
  const canonicalUnit =
    "Orbital Mechanics: Perturbations, J2 oblateness, atmospheric drag, and station-keeping maneuvers";
  const score = computeConceptOverlap(jitConcept, canonicalUnit);
  assert.ok(score >= 0.38, `Expected overlap >= 0.38, got ${score}`);
});

test("computeConceptOverlap rejects unrelated concepts", () => {
  const concept = "Fourier transform phase unwrapping in audio DSP";
  const unrelatedUnit = "Cell Biology: Mitosis, meiosis, and chromosome segregation";
  const score = computeConceptOverlap(concept, unrelatedUnit);
  assert.ok(score < 0.15, `Expected overlap < 0.15, got ${score}`);
});

test("computeConceptOverlap matches stemmed variants across agent chat and linear units", () => {
  const agentChatConcept = "Lagrangian generalized coordinates and Euler-Lagrange equations";
  const linearUnit = "Classical Mechanics: Lagrangian formulation, generalized coordinate systems, and action";
  const score = computeConceptOverlap(agentChatConcept, linearUnit);
  assert.ok(score >= 0.38, `Expected overlap >= 0.38, got ${score}`);
});

console.log("\nall ledger self-tests passed");
