#!/usr/bin/env tsx
/**
 * Proof that the content gate actually rejects the junk that filled the corpus,
 * and accepts a well-formed unit. Run in CI or before a release:
 *
 *   npm run check:quality
 *
 * This is deliberately a self-test rather than a fixture suite: the gate's contract is
 * "reject these specific signatures", and if someone loosens a rule these assertions
 * fail immediately.
 */
import { scoreUnitContent, scoreCourse, blockingIssues } from "../server/content-quality";

const LEGACY_UNIT = {
  concept:
    "## The Biological Neuron & Perceptron\n\nWelcome to **The Biological Neuron & Perceptron** — your gateway into Neural Networks.\n\n### Core Concepts\n\n1. **perceptron** — At the implementation level, this is where bugs hide. The classic trap: vanishing gradients in deep networks.",
  keyTakeaways: ["a"],
  analogy: "short",
  quiz: [{ question: "Which statement best captures the role of **core principles**?", options: ["a", "b"], correctIndex: 0 }],
  externalResources: [
    { title: "Khan", url: "https://www.khanacademy.org/search?page_search_query=Data%20Structures", type: "course" },
  ],
};

const GOOD_UNIT = {
  concept:
    "## ReLU and the dying-unit failure\n\n" +
    "ReLU is piecewise linear: f(x) = max(0, x), so its gradient is exactly 1 for positive inputs and exactly 0 for negative ones. " +
    "That hard zero is the mechanism behind the dying-ReLU failure. A unit whose pre-activation stays negative for every sample in the batch " +
    "receives zero gradient, so its weights stop updating, and it cannot recover on its own even if a useful input pattern appears later. " +
    "Leaky ReLU (f(x) = max(0.01x, x)) restores a small gradient for negative inputs, which is why it usually fixes the symptom. " +
    "The practical diagnosis: log the fraction of units with zero activation across a full epoch. Above roughly 40% on a fresh network, " +
    "the learning rate is almost always too high, since a large step pushed the pre-activations negative and nothing pulled them back.\n\n" +
    "## Choosing an activation for a first model\n\n" +
    "For a feed-forward network on tabular or image data, start with ReLU and a learning rate near 1e-3 with Adam. " +
    "If more than a third of your units die in the first few epochs, halve the learning rate before swapping activations, because ReLU is not the bug. " +
    "GELU costs roughly 20-30% more compute per layer than ReLU and buys a small accuracy gain on transformer stacks; it is rarely worth it for a small MLP. " +
    "Sigmoid and tanh saturate outside roughly [-4, 4], where gradients fall below 0.02, so they belong in the output layer (binary classification) or in gates, not in the hidden layers of a deep stack. " +
    "Whichever you pick, verify the activation's output range matches what the next layer expects: feeding a ReLU's unbounded positive output into a layer initialised for unit-variance inputs " +
    "is what batch normalisation exists to absorb.",
  keyTakeaways: [
    "ReLU's gradient is exactly 0 for negative inputs, which is the mechanism behind dead units.",
    "Leaky ReLU restores a small negative-input gradient and usually fixes dying units without a topology change.",
    "Sigmoid and tanh saturate below gradients of ~0.02 outside [-4, 4], so they belong in output layers or gates.",
    "A learning rate that pushes pre-activations negative is the usual cause of mass unit death, not the activation choice.",
  ],
  analogy: "A dead ReLU is a switch welded open by one oversized step — it needs a small leak to be nudged shut again.",
  example: {
    title: "Gradient check on one ReLU unit",
    content:
      "A unit with weights w = [0.5, -1.2] and input x = [1, 1] gives z = 0.5 - 1.2 = -0.7. Since z < 0, the output is 0 and dL/dw = 0 for both weights. " +
      "With a leak of 0.01, the gradient becomes 0.01 * x = [0.01, 0.01], so the weights move by -lr * 0.01 instead of not at all. At lr = 0.05 that recovers roughly 0.0005 per step.",
    code: "",
  },
  quiz: [
    { question: "A ReLU unit receives z = -2.4. What is its gradient with respect to the weights?", options: ["Exactly zero", "Exactly one", "0.5", "-2.4"], correctIndex: 0, explanation: "ReLU's derivative is 0 for all negative inputs, so no gradient flows." },
    { question: "40% of hidden units output zero for every sample after two epochs. What is the most likely cause?", options: ["Learning rate too high", "Too few hidden units", "Batch size too small", "Activation is too smooth"], correctIndex: 0, explanation: "A large step pushes pre-activations negative across the whole dataset, and zero gradient prevents recovery." },
    { question: "With leak 0.01 and input x = [2, -1], what is the gradient of a negative-region unit?", options: ["[0.02, -0.01]", "[2, -1]", "[0, 0]", "[-0.02, 0.01]"], correctIndex: 0, explanation: "The leak multiplies each input by 0.01, preserving sign." },
    { question: "Why is sigmoid a poor choice for the hidden layers of a 20-layer network?", options: ["Its gradient falls below 0.02 outside [-4, 4], causing vanishing gradients", "Its outputs are unbounded", "It requires more parameters", "It cannot be differentiated"], correctIndex: 0, explanation: "Saturation compresses the gradient, and stacking 20 such layers multiplies it toward zero." },
  ],
  externalResources: [
    { title: "Deep Learning book, Ch. 6 (Goodfellow et al.)", url: "https://www.deeplearningbook.org/contents/mlp.html", type: "book", description: "Section 6.3 derives the backpropagation gradient for piecewise-linear units." },
    { title: "Wikipedia — Rectifier (neural networks)", url: "https://en.wikipedia.org/wiki/Rectifier_(neural_networks)", type: "encyclopedia", description: "Covers dying ReLU, leaky variants, and the original 2011 references." },
    { title: "MIT 6.S191 — Intro to Deep Learning", url: "https://ocw.mit.edu/courses/6-s191-introduction-to-deep-learning-january-iap-2020/", type: "course", description: "Lecture 1 builds a network from a single neuron and shows the activation choice." },
    { title: "CS231n — Neural Networks Part 1", url: "https://cs231n.github.io/neural-networks-1/", type: "course", description: "Practical comparison of activations with the dead-unit discussion." },
  ],
  crossLinks: [],
  mermaidDiagram: "graph LR\n  Z[z = w.x] --> R{ReLU}\n  R -->|z>0| G1[grad = 1]\n  R -->|z<0| G0[grad = 0]",
};

let failures = 0;
function expect(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  <- " + detail}`);
  if (!cond) failures++;
}

// 1. legacy junk must be rejected
const legacy = scoreUnitContent(LEGACY_UNIT, "focused_skill");
const legacyCodes = new Set(legacy.issues.map((i) => i.code));
expect("legacy unit scores low", legacy.score < 40, `score=${legacy.score}`);
expect("template prose detected", legacyCodes.has("template_prose"));
expect("placeholder resource detected", legacyCodes.has("resource_placeholder"));
expect("thin prose detected", legacyCodes.has("thin_prose") || legacyCodes.has("too_few_sections"));

// 2. a good unit must pass cleanly
const good = scoreUnitContent(GOOD_UNIT, "focused_skill");
const goodBlocking = good.issues.filter((i) => i.severity === "error");
expect("good unit has no blocking issues", goodBlocking.length === 0, JSON.stringify(goodBlocking.slice(0, 2)));
expect("good unit scores high", good.score >= 90, `score=${good.score}`);

// 3. course-level repetition detection (the 285-times-repeated quiz stem)
const repeated = Array.from({ length: 8 }, (_, i) => ({
  title: `Unit ${i + 1}`,
  contentJson: { ...GOOD_UNIT, quiz: [{ ...GOOD_UNIT.quiz[0], question: "A student claims: I don't need the derivation" }] },
}));
const courseQuality = scoreCourse(repeated, "focused_skill");
expect(
  "repeated quiz stems fail the course",
  courseQuality.issues.some((i) => i.code === "quiz_repetition"),
  JSON.stringify(courseQuality.issues.map((i) => i.code)),
);

// 4. blockingIssues only returns errors
expect("blockingIssues filters warnings", blockingIssues(courseQuality).every((i) => i.severity === "error"));

console.log(failures === 0 ? "\nall quality self-tests passed" : `\n${failures} failure(s)`);
process.exitCode = failures === 0 ? 0 : 1;
