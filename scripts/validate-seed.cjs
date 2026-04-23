// Quick Node script to validate seed-data.ts relational integrity
// Reads the compiled output or raw file to check ID consistency

const fs = require("fs");
const path = require("path");

const seedPath = path.join(__dirname, "..", "server", "seed-data.ts");
const content = fs.readFileSync(seedPath, "utf-8");

function extractIds(pattern) {
  const ids = new Set();
  let m;
  while ((m = pattern.exec(content)) !== null) {
    ids.add(parseInt(m[1], 10));
  }
  return ids;
}

const topicIds = extractIds(/id:\s*(\d+)/g);
const pathwayTopicIds = extractIds(/topicId:\s*(\d+)/g);
const pathwayIds = extractIds(/pathwayId:\s*(\d+)/g);
const cardTopicIds = extractIds(/topicId:\s*(\d+)/g);

// More precise: extract DEFAULT_TOPICS ids
const topicBlock = content.substring(content.indexOf("export const DEFAULT_TOPICS"));
const topicIds2 = extractIds(/\{[\s\S]*?id:\s*(\d+)[\s\S]*?\}/g);
// The regex above is too greedy; let's do line-by-line for topics

const lines = content.split("\n");
const topicIdsArr = [];
const pathwayIdsArr = [];
const pathwayTopicLinks = [];
const cardTopicIdsArr = [];

let inTopics = false;
let inPathways = false;
let inPathwayTopics = false;
let inCards = false;

lines.forEach((line) => {
  if (line.includes("export const DEFAULT_TOPICS")) inTopics = true;
  if (line.includes("export const DEFAULT_PATHWAYS")) { inTopics = false; inPathways = true; }
  if (line.includes("export const DEFAULT_PATHWAY_TOPICS")) { inPathways = false; inPathwayTopics = true; }
  if (line.includes("export const DEFAULT_KNOWLEDGE_CARDS")) { inPathwayTopics = false; inCards = true; }
  if (line.includes("export const DEFAULT_") && !line.includes("DEFAULT_KNOWLEDGE_CARDS") && inCards) inCards = false;

  if (inTopics && /id:\s*(\d+)/.test(line)) {
    const m = line.match(/id:\s*(\d+)/);
    if (m) topicIdsArr.push(parseInt(m[1], 10));
  }
  if (inPathways && /id:\s*(\d+)/.test(line)) {
    const m = line.match(/id:\s*(\d+)/);
    if (m) pathwayIdsArr.push(parseInt(m[1], 10));
  }
  if (inPathwayTopics && /topicId:\s*(\d+)/.test(line)) {
    const m = line.match(/topicId:\s*(\d+)/);
    if (m) pathwayTopicLinks.push(parseInt(m[1], 10));
  }
  if (inCards && /topicId:\s*(\d+)/.test(line)) {
    const m = line.match(/topicId:\s*(\d+)/);
    if (m) cardTopicIdsArr.push(parseInt(m[1], 10));
  }
});

const topicSet = new Set(topicIdsArr);
const missingTopics = pathwayTopicLinks.filter(id => !topicSet.has(id));
const missingCards = cardTopicIdsArr.filter(id => !topicSet.has(id));

console.log("Topics count:", topicSet.size, "IDs:", [...topicSet].sort((a,b)=>a-b).join(","));
console.log("Pathways count:", pathwayIdsArr.length, "IDs:", pathwayIdsArr.join(","));
console.log("PathwayTopic links count:", pathwayTopicLinks.length);
console.log("Card topic links count:", cardTopicIdsArr.length);
console.log("Missing topic IDs in pathway links:", missingTopics.length ? [...new Set(missingTopics)] : "None");
console.log("Missing topic IDs in card links:", missingCards.length ? [...new Set(missingCards)] : "None");
