import { db } from "./db";
import { sql } from "drizzle-orm";
import { practiceQuestionBank } from "@shared/schema";

interface SeedQuestion {
  testType: string;
  category: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: string;
  source?: string;
}

const sampleQuestions: SeedQuestion[] = [
  // MCAT Questions
  {
    testType: "MCAT",
    category: "Biology",
    question: "Which of the following best describes the primary function of mitochondria in eukaryotic cells?",
    options: ["Protein synthesis", "ATP production through cellular respiration", "DNA replication", "Cell division regulation"],
    correctIndex: 1,
    explanation: "Mitochondria are the 'powerhouses' of the cell, primarily responsible for producing ATP through oxidative phosphorylation during cellular respiration.",
    difficulty: "easy",
    source: "Public Domain - Biology Concepts"
  },
  {
    testType: "MCAT",
    category: "Biology",
    question: "During which phase of the cell cycle does DNA replication occur?",
    options: ["G1 phase", "S phase", "G2 phase", "M phase"],
    correctIndex: 1,
    explanation: "DNA replication occurs during the S (synthesis) phase of the cell cycle, when the cell duplicates its genetic material in preparation for division.",
    difficulty: "easy",
    source: "Public Domain - Cell Biology"
  },
  {
    testType: "MCAT",
    category: "Biology",
    question: "Which enzyme is responsible for unwinding the DNA double helix during replication?",
    options: ["DNA polymerase", "Helicase", "Ligase", "Primase"],
    correctIndex: 1,
    explanation: "Helicase unwinds the DNA double helix by breaking hydrogen bonds between base pairs, creating the replication fork.",
    difficulty: "medium",
    source: "Public Domain - Molecular Biology"
  },
  {
    testType: "MCAT",
    category: "Chemistry",
    question: "What is the pH of a solution with a hydrogen ion concentration of 1 × 10⁻⁵ M?",
    options: ["3", "5", "7", "9"],
    correctIndex: 1,
    explanation: "pH = -log[H⁺] = -log(10⁻⁵) = 5. This solution is slightly acidic.",
    difficulty: "easy",
    source: "Public Domain - General Chemistry"
  },
  {
    testType: "MCAT",
    category: "Chemistry",
    question: "Which type of bond involves the sharing of electrons between atoms?",
    options: ["Ionic bond", "Covalent bond", "Metallic bond", "Hydrogen bond"],
    correctIndex: 1,
    explanation: "Covalent bonds form when two atoms share one or more pairs of electrons, typically occurring between nonmetals.",
    difficulty: "easy",
    source: "Public Domain - General Chemistry"
  },
  {
    testType: "MCAT",
    category: "Physics",
    question: "An object is thrown vertically upward. At the maximum height, its velocity is:",
    options: ["Maximum", "Zero", "Equal to initial velocity", "Negative"],
    correctIndex: 1,
    explanation: "At maximum height, all kinetic energy has been converted to potential energy, and the instantaneous velocity is zero before the object begins to fall.",
    difficulty: "easy",
    source: "Public Domain - Classical Mechanics"
  },
  {
    testType: "MCAT",
    category: "Physics",
    question: "According to Newton's Third Law, when object A exerts a force on object B:",
    options: ["Object B accelerates", "Object B exerts an equal and opposite force on A", "Object A accelerates", "No reaction occurs"],
    correctIndex: 1,
    explanation: "Newton's Third Law states that for every action, there is an equal and opposite reaction. The forces act on different objects.",
    difficulty: "easy",
    source: "Public Domain - Classical Mechanics"
  },
  {
    testType: "MCAT",
    category: "Psychology",
    question: "Which psychologist is most closely associated with classical conditioning?",
    options: ["B.F. Skinner", "Ivan Pavlov", "Sigmund Freud", "Carl Rogers"],
    correctIndex: 1,
    explanation: "Ivan Pavlov discovered classical conditioning through his famous experiments with dogs, demonstrating how neutral stimuli can become associated with involuntary responses.",
    difficulty: "easy",
    source: "Public Domain - Psychology"
  },
  {
    testType: "MCAT",
    category: "Psychology",
    question: "The limbic system is primarily associated with:",
    options: ["Motor control", "Emotion and memory", "Vision processing", "Language production"],
    correctIndex: 1,
    explanation: "The limbic system includes structures like the amygdala and hippocampus, which play key roles in emotional processing and memory formation.",
    difficulty: "medium",
    source: "Public Domain - Neuroscience"
  },
  {
    testType: "MCAT",
    category: "Critical Analysis",
    question: "An author presents two conflicting research studies on a topic without taking a position. This approach is best described as:",
    options: ["Persuasive", "Balanced", "Argumentative", "Conclusive"],
    correctIndex: 1,
    explanation: "A balanced approach presents multiple perspectives without advocating for a particular viewpoint, allowing readers to form their own conclusions.",
    difficulty: "medium",
    source: "Public Domain - Critical Reasoning"
  },

  // GRE Questions
  {
    testType: "GRE",
    category: "Verbal Reasoning",
    question: "Select the word that best completes the sentence: The scientist's findings were _______, contradicting decades of established research.",
    options: ["orthodox", "conventional", "iconoclastic", "traditional"],
    correctIndex: 2,
    explanation: "Iconoclastic means attacking or challenging cherished beliefs or institutions. The context indicates findings that contradict established research.",
    difficulty: "medium",
    source: "Public Domain - Vocabulary"
  },
  {
    testType: "GRE",
    category: "Verbal Reasoning",
    question: "EPHEMERAL is most nearly opposite in meaning to:",
    options: ["fleeting", "transient", "enduring", "momentary"],
    correctIndex: 2,
    explanation: "Ephemeral means lasting for a very short time. Its antonym would be something lasting or enduring.",
    difficulty: "medium",
    source: "Public Domain - Vocabulary"
  },
  {
    testType: "GRE",
    category: "Verbal Reasoning",
    question: "Select the word that best completes the sentence: The professor's lectures were so _______ that even complex topics seemed simple.",
    options: ["abstruse", "lucid", "obscure", "cryptic"],
    correctIndex: 1,
    explanation: "Lucid means clear and easy to understand. The context indicates lectures that make complex topics seem simple.",
    difficulty: "medium",
    source: "Public Domain - Vocabulary"
  },
  {
    testType: "GRE",
    category: "Quantitative Reasoning",
    question: "If 3x + 7 = 22, what is the value of x?",
    options: ["3", "5", "7", "9"],
    correctIndex: 1,
    explanation: "3x + 7 = 22 → 3x = 15 → x = 5",
    difficulty: "easy",
    source: "Public Domain - Algebra"
  },
  {
    testType: "GRE",
    category: "Quantitative Reasoning",
    question: "What is the probability of getting exactly 2 heads when flipping a fair coin 3 times?",
    options: ["1/8", "3/8", "1/2", "5/8"],
    correctIndex: 1,
    explanation: "There are 8 possible outcomes (2³). Favorable outcomes (HHT, HTH, THH) = 3. Probability = 3/8.",
    difficulty: "medium",
    source: "Public Domain - Probability"
  },
  {
    testType: "GRE",
    category: "Quantitative Reasoning",
    question: "If the area of a square is 64 square units, what is the length of its diagonal?",
    options: ["8", "8√2", "16", "4√2"],
    correctIndex: 1,
    explanation: "Side = √64 = 8. Diagonal of a square = side × √2 = 8√2.",
    difficulty: "medium",
    source: "Public Domain - Geometry"
  },
  {
    testType: "GRE",
    category: "Reading Comprehension",
    question: "When an author uses 'nevertheless' to introduce a sentence, they are most likely:",
    options: ["Providing additional support", "Introducing a contrasting point", "Summarizing previous points", "Defining a term"],
    correctIndex: 1,
    explanation: "'Nevertheless' is a contrast word that signals the author is about to present information that contrasts with or qualifies what was stated before.",
    difficulty: "easy",
    source: "Public Domain - Reading Skills"
  },

  // SAT Questions
  {
    testType: "SAT",
    category: "Reading",
    question: "In a passage, when an author describes a character as 'stoic in the face of adversity,' they are suggesting the character is:",
    options: ["Emotional and reactive", "Calm and unemotional", "Angry and frustrated", "Fearful and anxious"],
    correctIndex: 1,
    explanation: "Stoic means enduring pain or hardship without showing feelings or complaining. The character remains calm despite difficulties.",
    difficulty: "medium",
    source: "Public Domain - Reading Comprehension"
  },
  {
    testType: "SAT",
    category: "Reading",
    question: "The primary purpose of a passage's introductory paragraph is typically to:",
    options: ["Present the main argument", "Provide background context", "Offer a conclusion", "List all supporting evidence"],
    correctIndex: 1,
    explanation: "Introductory paragraphs typically provide context, introduce the topic, and prepare readers for the main argument that follows.",
    difficulty: "easy",
    source: "Public Domain - Reading Skills"
  },
  {
    testType: "SAT",
    category: "Writing and Language",
    question: "Select the grammatically correct sentence:",
    options: ["Each of the students have their own laptop.", "Each of the students has their own laptop.", "Each of the students has his or her own laptop.", "Each of the students have his or her own laptop."],
    correctIndex: 2,
    explanation: "'Each' is singular and requires a singular verb 'has.' The pronoun should also be singular ('his or her' rather than 'their').",
    difficulty: "medium",
    source: "Public Domain - Grammar"
  },
  {
    testType: "SAT",
    category: "Writing and Language",
    question: "Which sentence correctly uses a semicolon?",
    options: ["I went to the store; and bought milk.", "I went to the store; I bought milk.", "I went to the store; buying milk.", "I went; to the store to buy milk."],
    correctIndex: 1,
    explanation: "A semicolon connects two independent clauses that are closely related. Both 'I went to the store' and 'I bought milk' are complete sentences.",
    difficulty: "medium",
    source: "Public Domain - Punctuation"
  },
  {
    testType: "SAT",
    category: "Math (No Calculator)",
    question: "If 2x² - 8 = 0, what are the possible values of x?",
    options: ["±2", "±4", "2 only", "-2 only"],
    correctIndex: 0,
    explanation: "2x² - 8 = 0 → 2x² = 8 → x² = 4 → x = ±2",
    difficulty: "easy",
    source: "Public Domain - Algebra"
  },
  {
    testType: "SAT",
    category: "Math (No Calculator)",
    question: "What is the slope of a line perpendicular to y = 3x + 5?",
    options: ["3", "-3", "1/3", "-1/3"],
    correctIndex: 3,
    explanation: "Perpendicular lines have slopes that are negative reciprocals. The slope of y = 3x + 5 is 3, so the perpendicular slope is -1/3.",
    difficulty: "medium",
    source: "Public Domain - Linear Equations"
  },
  {
    testType: "SAT",
    category: "Math (Calculator)",
    question: "A store offers a 20% discount on all items. If an item originally costs $75, what is the sale price?",
    options: ["$55", "$60", "$65", "$70"],
    correctIndex: 1,
    explanation: "20% of $75 = $15. Sale price = $75 - $15 = $60",
    difficulty: "easy",
    source: "Public Domain - Percentages"
  },
  {
    testType: "SAT",
    category: "Math (Calculator)",
    question: "If the mean of 5 numbers is 12, what is their sum?",
    options: ["17", "60", "50", "7"],
    correctIndex: 1,
    explanation: "Mean = Sum / Count. Therefore, Sum = Mean × Count = 12 × 5 = 60",
    difficulty: "easy",
    source: "Public Domain - Statistics"
  },

  // ACT Questions
  {
    testType: "ACT",
    category: "English",
    question: "Select the sentence with correct comma usage:",
    options: ["My brother who lives in Boston is a doctor.", "My brother, who lives in Boston, is a doctor.", "My brother who lives, in Boston is a doctor.", "My, brother who lives in Boston is a doctor."],
    correctIndex: 1,
    explanation: "Nonessential (nonrestrictive) clauses should be set off with commas. 'Who lives in Boston' provides extra information but isn't essential to identify the brother.",
    difficulty: "medium",
    source: "Public Domain - Grammar"
  },
  {
    testType: "ACT",
    category: "English",
    question: "Which word correctly completes the sentence: 'The effect of the new policy was _____ than expected.'",
    options: ["more greater", "greater", "more great", "greatest"],
    correctIndex: 1,
    explanation: "'Greater' is the correct comparative form. 'More greater' is a double comparative and grammatically incorrect.",
    difficulty: "easy",
    source: "Public Domain - Grammar"
  },
  {
    testType: "ACT",
    category: "Math",
    question: "What is the value of 5! (5 factorial)?",
    options: ["25", "60", "120", "720"],
    correctIndex: 2,
    explanation: "5! = 5 × 4 × 3 × 2 × 1 = 120",
    difficulty: "easy",
    source: "Public Domain - Arithmetic"
  },
  {
    testType: "ACT",
    category: "Math",
    question: "In a right triangle, if one leg is 6 and the hypotenuse is 10, what is the length of the other leg?",
    options: ["4", "6", "8", "12"],
    correctIndex: 2,
    explanation: "Using the Pythagorean theorem: a² + b² = c². So 6² + b² = 10² → 36 + b² = 100 → b² = 64 → b = 8",
    difficulty: "medium",
    source: "Public Domain - Geometry"
  },
  {
    testType: "ACT",
    category: "Reading",
    question: "When a passage uses the word 'paradoxically,' it indicates:",
    options: ["A logical conclusion", "A contradiction or seeming contradiction", "A straightforward comparison", "A historical reference"],
    correctIndex: 1,
    explanation: "Paradoxically indicates something that seems contradictory but may nonetheless be true or valid.",
    difficulty: "medium",
    source: "Public Domain - Reading Skills"
  },
  {
    testType: "ACT",
    category: "Science",
    question: "In an experiment testing plant growth, the controlled variable would be:",
    options: ["The type of fertilizer used", "The amount of sunlight", "Factors kept constant across all trials", "The height of the plants"],
    correctIndex: 2,
    explanation: "Controlled variables are factors that are kept constant across all experimental groups to ensure that any differences observed are due to the independent variable.",
    difficulty: "easy",
    source: "Public Domain - Scientific Method"
  },
  {
    testType: "ACT",
    category: "Science",
    question: "Which of the following is an example of an exothermic reaction?",
    options: ["Ice melting", "Photosynthesis", "Combustion of wood", "Evaporation of water"],
    correctIndex: 2,
    explanation: "Exothermic reactions release heat to the surroundings. Combustion (burning) releases energy in the form of heat and light.",
    difficulty: "medium",
    source: "Public Domain - Chemistry"
  },

  // IQ Test Questions
  {
    testType: "IQ",
    category: "Pattern Recognition",
    question: "What comes next in the sequence: 2, 6, 12, 20, 30, ?",
    options: ["40", "42", "44", "46"],
    correctIndex: 1,
    explanation: "The differences are 4, 6, 8, 10, 12. Next difference is 12, so 30 + 12 = 42. Pattern: n(n+1)",
    difficulty: "medium",
    source: "Public Domain - Number Sequences"
  },
  {
    testType: "IQ",
    category: "Pattern Recognition",
    question: "What comes next in the sequence: 1, 1, 2, 3, 5, 8, ?",
    options: ["11", "12", "13", "14"],
    correctIndex: 2,
    explanation: "This is the Fibonacci sequence where each number is the sum of the two preceding ones. 5 + 8 = 13",
    difficulty: "medium",
    source: "Public Domain - Number Sequences"
  },
  {
    testType: "IQ",
    category: "Logical Reasoning",
    question: "All roses are flowers. Some flowers fade quickly. Which conclusion is valid?",
    options: ["All roses fade quickly", "Some roses fade quickly", "No roses fade quickly", "None of the above can be concluded"],
    correctIndex: 3,
    explanation: "We cannot conclude anything about roses fading because 'some flowers fade quickly' doesn't tell us whether roses are in that group.",
    difficulty: "medium",
    source: "Public Domain - Logic"
  },
  {
    testType: "IQ",
    category: "Logical Reasoning",
    question: "If all A are B, and all B are C, then:",
    options: ["All C are A", "All A are C", "No A are C", "Some C are not A"],
    correctIndex: 1,
    explanation: "This is a transitive relationship. If A ⊂ B and B ⊂ C, then A ⊂ C. All A are C.",
    difficulty: "easy",
    source: "Public Domain - Logic"
  },
  {
    testType: "IQ",
    category: "Spatial Reasoning",
    question: "If you fold a square piece of paper in half diagonally, what shape do you get?",
    options: ["Rectangle", "Square", "Triangle", "Pentagon"],
    correctIndex: 2,
    explanation: "Folding a square diagonally creates a triangle (specifically, a right isosceles triangle).",
    difficulty: "easy",
    source: "Public Domain - Spatial Reasoning"
  },
  {
    testType: "IQ",
    category: "Verbal Ability",
    question: "Which word is the odd one out: Apple, Banana, Carrot, Orange?",
    options: ["Apple", "Banana", "Carrot", "Orange"],
    correctIndex: 2,
    explanation: "Carrot is a vegetable, while the others are fruits.",
    difficulty: "easy",
    source: "Public Domain - Classification"
  },
  {
    testType: "IQ",
    category: "Numerical Ability",
    question: "If a train travels 60 miles in 1.5 hours, what is its average speed in mph?",
    options: ["30", "40", "45", "50"],
    correctIndex: 1,
    explanation: "Speed = Distance / Time = 60 / 1.5 = 40 mph",
    difficulty: "easy",
    source: "Public Domain - Arithmetic"
  },

  // LSAT Questions
  {
    testType: "LSAT",
    category: "Logical Reasoning",
    question: "Statement: 'If it rains, the ground gets wet.' The ground is wet. What can we conclude?",
    options: ["It definitely rained", "It might have rained", "It did not rain", "The statement is false"],
    correctIndex: 1,
    explanation: "This is affirming the consequent, which is a logical fallacy. The ground could be wet for other reasons (sprinklers, etc.). We can only say it might have rained.",
    difficulty: "medium",
    source: "Public Domain - Logic"
  },
  {
    testType: "LSAT",
    category: "Logical Reasoning",
    question: "Which of the following weakens the argument: 'Exercise improves health, so everyone should exercise daily'?",
    options: ["Some people enjoy exercise", "Exercise can cause injuries in certain individuals", "Healthy people tend to exercise more", "Exercise equipment is expensive"],
    correctIndex: 1,
    explanation: "This weakens the conclusion by showing exercise isn't universally beneficial - it can harm some people.",
    difficulty: "medium",
    source: "Public Domain - Argumentation"
  },
  {
    testType: "LSAT",
    category: "Analytical Reasoning",
    question: "If A must come before B, and B must come before C, which arrangement is valid?",
    options: ["C, B, A", "B, A, C", "A, B, C", "C, A, B"],
    correctIndex: 2,
    explanation: "The only arrangement satisfying both conditions (A before B, B before C) is A, B, C.",
    difficulty: "easy",
    source: "Public Domain - Logic Games"
  },
  {
    testType: "LSAT",
    category: "Reading Comprehension",
    question: "When an author presents a counterargument then refutes it, they are using:",
    options: ["Ad hominem", "Strawman", "Concession and rebuttal", "False dichotomy"],
    correctIndex: 2,
    explanation: "Concession and rebuttal is a rhetorical strategy where the author acknowledges an opposing view before presenting reasons to reject it.",
    difficulty: "medium",
    source: "Public Domain - Rhetoric"
  },

  // GMAT Questions
  {
    testType: "GMAT",
    category: "Quantitative",
    question: "If the ratio of boys to girls in a class is 3:5, and there are 40 students total, how many boys are there?",
    options: ["12", "15", "18", "25"],
    correctIndex: 1,
    explanation: "Total parts = 3 + 5 = 8. Each part = 40/8 = 5 students. Boys = 3 × 5 = 15",
    difficulty: "medium",
    source: "Public Domain - Ratios"
  },
  {
    testType: "GMAT",
    category: "Quantitative",
    question: "A product's price increased by 20%, then decreased by 20%. The final price compared to the original is:",
    options: ["Same as original", "Higher than original", "Lower than original", "Double the original"],
    correctIndex: 2,
    explanation: "If original = 100, after 20% increase = 120. After 20% decrease of 120 = 120 - 24 = 96. Final is 4% less than original.",
    difficulty: "medium",
    source: "Public Domain - Percentages"
  },
  {
    testType: "GMAT",
    category: "Verbal",
    question: "Select the sentence with the correct parallel structure:",
    options: ["She likes swimming, to run, and biking.", "She likes to swim, run, and bike.", "She likes swimming, running, and to bike.", "She likes to swim, running, and biking."],
    correctIndex: 1,
    explanation: "Parallel structure requires using the same grammatical form for similar elements. 'To swim, run, and bike' all use the infinitive form.",
    difficulty: "medium",
    source: "Public Domain - Grammar"
  },
  {
    testType: "GMAT",
    category: "Integrated Reasoning",
    question: "A graph shows sales increasing 10% yearly from a base of 100 units in Year 1. What are projected sales in Year 3?",
    options: ["120", "121", "130", "110"],
    correctIndex: 1,
    explanation: "Year 1: 100, Year 2: 110, Year 3: 121. Compound growth: 100 × 1.1² = 121",
    difficulty: "medium",
    source: "Public Domain - Data Analysis"
  },
  {
    testType: "GMAT",
    category: "Data Sufficiency",
    question: "To determine the value of x, is it sufficient to know that x² = 16?",
    options: ["Yes, definitely sufficient", "No, not sufficient alone", "Only if x is positive", "Cannot be determined"],
    correctIndex: 1,
    explanation: "x² = 16 means x could be 4 or -4. Without additional information about whether x is positive or negative, we cannot determine the unique value.",
    difficulty: "medium",
    source: "Public Domain - Algebra"
  },

  // BAR Exam Questions
  {
    testType: "BAR",
    category: "Constitutional Law",
    question: "The Commerce Clause gives Congress the power to regulate:",
    options: ["Only trade between states", "Interstate and foreign commerce", "All economic activity", "State governments"],
    correctIndex: 1,
    explanation: "The Commerce Clause (Article I, Section 8) grants Congress power to regulate commerce with foreign nations, among the several states, and with Indian tribes.",
    difficulty: "medium",
    source: "Public Domain - Constitutional Law"
  },
  {
    testType: "BAR",
    category: "Contracts",
    question: "For a contract to be valid, which of the following is NOT required?",
    options: ["Offer and acceptance", "Consideration", "Legal capacity", "Written documentation"],
    correctIndex: 3,
    explanation: "While written documentation helps, many valid contracts can be oral. The essential elements are offer, acceptance, consideration, and legal capacity.",
    difficulty: "medium",
    source: "Public Domain - Contract Law"
  },
  {
    testType: "BAR",
    category: "Criminal Law",
    question: "In criminal law, 'mens rea' refers to:",
    options: ["The criminal act itself", "The defendant's mental state or intent", "The victim's injuries", "The prosecutor's burden"],
    correctIndex: 1,
    explanation: "Mens rea (guilty mind) refers to the mental element of a crime - the intent or knowledge required to establish criminal liability.",
    difficulty: "easy",
    source: "Public Domain - Criminal Law"
  },
  {
    testType: "BAR",
    category: "Evidence",
    question: "The hearsay rule generally prohibits:",
    options: ["All oral testimony", "Out-of-court statements offered for truth", "Expert witness testimony", "Documentary evidence"],
    correctIndex: 1,
    explanation: "Hearsay is an out-of-court statement offered to prove the truth of the matter asserted. It's generally inadmissible because the declarant cannot be cross-examined.",
    difficulty: "medium",
    source: "Public Domain - Evidence Law"
  },
  {
    testType: "BAR",
    category: "Torts",
    question: "In negligence, the 'reasonable person' standard refers to:",
    options: ["The defendant's subjective beliefs", "An objective standard of care", "The victim's expectations", "The judge's opinion"],
    correctIndex: 1,
    explanation: "The reasonable person standard is an objective legal standard representing how a hypothetical person of ordinary prudence would act in similar circumstances.",
    difficulty: "medium",
    source: "Public Domain - Tort Law"
  },
  {
    testType: "BAR",
    category: "Civil Procedure",
    question: "Personal jurisdiction refers to a court's power over:",
    options: ["The subject matter of the case", "The parties to the lawsuit", "The amount in controversy", "Federal questions"],
    correctIndex: 1,
    explanation: "Personal jurisdiction is the court's power to render a binding judgment against a particular defendant. It's distinct from subject matter jurisdiction.",
    difficulty: "medium",
    source: "Public Domain - Civil Procedure"
  }
];

export async function seedQuestionBank() {
  console.log("Checking question bank...");
  
  const existingCount = await db.select({ count: sql<number>`count(*)` })
    .from(practiceQuestionBank);
  
  if (Number(existingCount[0]?.count || 0) > 0) {
    console.log("Question bank already has data, skipping seed.");
    return;
  }
  
  console.log(`Seeding ${sampleQuestions.length} questions to question bank...`);
  
  const questionsToInsert = sampleQuestions.map(q => ({
    testType: q.testType,
    category: q.category,
    questionType: "multiple_choice" as const,
    question: q.question,
    options: q.options,
    correctIndex: q.correctIndex,
    explanation: q.explanation,
    difficulty: q.difficulty,
    isPublic: true,
    source: q.source || null,
  }));
  
  await db.insert(practiceQuestionBank).values(questionsToInsert);
  
  console.log("Question bank seeded successfully!");
}
