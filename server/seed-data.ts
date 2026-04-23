export const DEFAULT_CATEGORIES = [
  { id: 1, name: "Artificial Intelligence", color: "purple", icon: "Brain" },
  { id: 2, name: "Mathematics", color: "blue", icon: "Calculator" },
  { id: 3, name: "Computer Science", color: "green", icon: "Code" },
  { id: 4, name: "Science", color: "orange", icon: "Beaker" },
  { id: 5, name: "Physics", color: "yellow", icon: "Atom" },
  { id: 6, name: "Chemistry", color: "teal", icon: "FlaskConical" },
  { id: 7, name: "Music", color: "pink", icon: "Music" },
  { id: 8, name: "Biology", color: "lime", icon: "Leaf" },
  { id: 9, name: "Earth Science", color: "sky", icon: "Globe" },
  { id: 10, name: "Philosophy", color: "slate", icon: "BookOpen" },
  { id: 11, name: "Economics", color: "amber", icon: "TrendingUp" },
  { id: 12, name: "Linguistics", color: "violet", icon: "Languages" },
  { id: 13, name: "History", color: "stone", icon: "Landmark" },
  { id: 14, name: "Art & Design", color: "rose", icon: "Palette" },
  { id: 15, name: "Health & Medicine", color: "red", icon: "Heart" },
  { id: 16, name: "Engineering", color: "indigo", icon: "Cog" },
];

export const DEFAULT_PATHWAYS = [
  { id: 1, name: "Physics", description: "From classical mechanics to quantum theory, explore the fundamental laws that govern our universe.", icon: "Atom", color: "purple", difficulty: "mixed", estimatedHours: 50, isActive: true },
  { id: 2, name: "Engineering", description: "Apply scientific principles to design and build solutions for real-world problems.", icon: "Wrench", color: "blue", difficulty: "mixed", estimatedHours: 60, isActive: true },
  { id: 3, name: "Astrophysics", description: "Journey through the cosmos, from stellar evolution to black holes and the origins of the universe.", icon: "Rocket", color: "indigo", difficulty: "advanced", estimatedHours: 40, isActive: true },
  { id: 4, name: "Computer Science", description: "Master algorithms, data structures, and computational thinking.", icon: "Code", color: "green", difficulty: "mixed", estimatedHours: 55, isActive: true },
  { id: 5, name: "Artificial Intelligence", description: "Explore machine learning, neural networks, and the future of intelligent systems.", icon: "Brain", color: "pink", difficulty: "advanced", estimatedHours: 45, isActive: true },
  { id: 6, name: "Mathematics", description: "Build a strong foundation from algebra through calculus and beyond.", icon: "Calculator", color: "orange", difficulty: "mixed", estimatedHours: 65, isActive: true },
  { id: 7, name: "Chemistry", description: "Understand atomic structure, reactions, and the molecular basis of life.", icon: "Flask", color: "teal", difficulty: "mixed", estimatedHours: 40, isActive: true },
  { id: 8, name: "Biology", description: "From cells to ecosystems, discover the science of living organisms.", icon: "Leaf", color: "lime", difficulty: "mixed", estimatedHours: 45, isActive: true },
  { id: 9, name: "Music Theory", description: "Learn the language of music: scales, chords, harmony, and composition.", icon: "Music", color: "rose", difficulty: "beginner", estimatedHours: 30, isActive: true },
  { id: 10, name: "Open Source Contributing", description: "Learn to contribute to open source projects and collaborate with developers worldwide.", icon: "GitBranch", color: "gray", difficulty: "intermediate", estimatedHours: 25, isActive: true },
  // ── 15 additional pathways ────────────────────────────────────────────────
  { id: 11, name: "Data Science & Analytics", description: "Transform raw data into actionable insights using statistics, visualization, and predictive modeling.", icon: "BarChart3", color: "cyan", difficulty: "mixed", estimatedHours: 50, isActive: true },
  { id: 12, name: "Full-Stack Web Development", description: "Build modern web applications from front-end interfaces to back-end APIs and databases.", icon: "Globe", color: "emerald", difficulty: "mixed", estimatedHours: 60, isActive: true },
  { id: 13, name: "Cybersecurity", description: "Learn to protect systems, networks, and data from digital attacks and unauthorized access.", icon: "Shield", color: "red", difficulty: "advanced", estimatedHours: 55, isActive: true },
  { id: 14, name: "Robotics & Automation", description: "Design intelligent machines that sense, plan, and act in the physical world.", icon: "Bot", color: "indigo", difficulty: "advanced", estimatedHours: 50, isActive: true },
  { id: 15, name: "Molecular Biology & Genetics", description: "Explore DNA, gene expression, CRISPR, and the molecular machinery of life.", icon: "Dna", color: "green", difficulty: "advanced", estimatedHours: 45, isActive: true },
  { id: 16, name: "Environmental Science", description: "Study Earth's systems, climate change, sustainability, and humanity's impact on the planet.", icon: "TreePine", color: "teal", difficulty: "mixed", estimatedHours: 40, isActive: true },
  { id: 17, name: "Astronomy & Cosmology", description: "Observe celestial objects, understand cosmic evolution, and ponder the ultimate fate of the universe.", icon: "Telescope", color: "violet", difficulty: "mixed", estimatedHours: 45, isActive: true },
  { id: 18, name: "Philosophy & Critical Thinking", description: "Sharpen your reasoning, examine existence and ethics, and learn to dismantle flawed arguments.", icon: "BookOpen", color: "slate", difficulty: "mixed", estimatedHours: 35, isActive: true },
  { id: 19, name: "Economics & Finance", description: "Understand markets, monetary policy, investing, and the forces that shape global wealth.", icon: "DollarSign", color: "amber", difficulty: "mixed", estimatedHours: 45, isActive: true },
  { id: 20, name: "Linguistics & Natural Language", description: "Investigate the structure, meaning, and evolution of human language — and how machines process it.", icon: "Languages", color: "fuchsia", difficulty: "mixed", estimatedHours: 40, isActive: true },
  { id: 21, name: "World History", description: "Trace the arc of human civilization from ancient empires to the information age.", icon: "Landmark", color: "stone", difficulty: "beginner", estimatedHours: 50, isActive: true },
  { id: 22, name: "Digital Art & Design", description: "Master color theory, composition, typography, and digital tools for visual storytelling.", icon: "Palette", color: "rose", difficulty: "beginner", estimatedHours: 35, isActive: true },
  { id: 23, name: "Human Anatomy & Physiology", description: "Learn how the human body is organized and how its systems work together to sustain life.", icon: "Heart", color: "red", difficulty: "intermediate", estimatedHours: 50, isActive: true },
  { id: 24, name: "Electrical Engineering", description: "Design circuits, understand signal processing, and harness electromagnetism for practical systems.", icon: "Zap", color: "yellow", difficulty: "advanced", estimatedHours: 55, isActive: true },
  { id: 25, name: "Material Science", description: "Discover how atomic structure determines the properties of metals, polymers, ceramics, and composites.", icon: "Gem", color: "sky", difficulty: "advanced", estimatedHours: 45, isActive: true },
];

export const DEFAULT_TOPICS = [
  { id: 1, title: "Machine Learning", description: "Understanding how machines learn from data to make predictions and decisions.", categoryId: 1, difficulty: "intermediate" },
  { id: 2, title: "Linear Algebra", description: "The mathematics of vectors, matrices, and linear transformations.", categoryId: 2, difficulty: "beginner" },
  { id: 3, title: "Data Structures", description: "Organizing and storing data efficiently for quick access and modification.", categoryId: 3, difficulty: "beginner" },
  { id: 4, title: "Quantum Mechanics", description: "The bizarre world of subatomic particles and probability.", categoryId: 4, difficulty: "advanced" },
  { id: 5, title: "Calculus", description: "The study of continuous change and its applications.", categoryId: 2, difficulty: "intermediate" },
  { id: 6, title: "Graph Theory", description: "The mathematical study of relationships and connections.", categoryId: 2, difficulty: "intermediate" },
  { id: 7, title: "Algorithms", description: "Step-by-step procedures for solving computational problems.", categoryId: 3, difficulty: "intermediate" },
  { id: 8, title: "Neural Networks", description: "Exploring the brain-inspired computing systems that power modern AI.", categoryId: 1, difficulty: "advanced" },
  { id: 9, title: "Hugging Face", description: "The leading open-source platform for machine learning models, datasets, and collaborative AI development. Learn to use and share state-of-the-art models.", categoryId: 1, difficulty: "beginner" },
  { id: 10, title: "Gradio", description: "Build and share machine learning web apps with ease. Create interactive demos for your ML models in just a few lines of Python code.", categoryId: 1, difficulty: "beginner" },
  { id: 11, title: "Benefits of Open Source", description: "Explore the transformative power of open source collaboration - how sharing code accelerates innovation, builds communities, and democratizes technology.", categoryId: 3, difficulty: "beginner" },
  { id: 12, title: "Classical Mechanics", description: "The study of motion and forces - from falling apples to planetary orbits. Understand Newton's laws and how they govern everyday physics.", categoryId: 5, difficulty: "beginner" },
  { id: 13, title: "Orbital Mechanics", description: "How satellites stay in orbit, how rockets reach the moon, and why planets follow elliptical paths. The physics of space travel.", categoryId: 5, difficulty: "intermediate" },
  { id: 14, title: "Optics & Light", description: "Explore the nature of light - from rainbows to lasers. Understand reflection, refraction, and how we see the world around us.", categoryId: 5, difficulty: "beginner" },
  { id: 15, title: "Fluid Dynamics", description: "How liquids and gases flow - from airplane wings to blood circulation. The physics that shapes our world in motion.", categoryId: 5, difficulty: "intermediate" },
  { id: 16, title: "Electromagnetism", description: "The unified theory of electricity and magnetism. From motors to radio waves, this force shapes modern technology.", categoryId: 5, difficulty: "intermediate" },
  { id: 17, title: "Waves & Frequencies", description: "Sound, light, and vibrations - all forms of waves. Learn about frequency, amplitude, resonance, and the wave nature of reality.", categoryId: 5, difficulty: "beginner" },
  { id: 18, title: "General Chemistry", description: "The central science that connects physics to biology. Explore atoms, molecules, reactions, and the building blocks of matter.", categoryId: 6, difficulty: "beginner" },
  { id: 19, title: "Organic Chemistry", description: "The chemistry of carbon compounds - the basis of all life. From plastics to pharmaceuticals, organic molecules are everywhere.", categoryId: 6, difficulty: "intermediate" },
  { id: 20, title: "Music Theory", description: "The language of music - scales, chords, rhythm, and harmony. Understand why some combinations sound beautiful and others don't.", categoryId: 7, difficulty: "beginner" },
  // ── New topics for expanded pathways ───────────────────────────────────────
  { id: 21, title: "Probability & Statistics", description: "Quantify uncertainty, model randomness, and extract reliable conclusions from noisy data.", categoryId: 2, difficulty: "intermediate" },
  { id: 22, title: "Differential Equations", description: "Equations that describe how quantities change over time and space — the language of physics and engineering.", categoryId: 2, difficulty: "advanced" },
  { id: 23, title: "Thermodynamics", description: "The study of heat, energy, and entropy — governing everything from engines to the arrow of time.", categoryId: 5, difficulty: "advanced" },
  { id: 24, title: "Statistical Mechanics", description: "Bridge the microscopic world of atoms and the macroscopic properties of matter through probability.", categoryId: 5, difficulty: "advanced" },
  { id: 25, title: "Cell Biology", description: "Explore the structure and function of cells — the fundamental units of all living organisms.", categoryId: 8, difficulty: "beginner" },
  { id: 26, title: "Genetics & Heredity", description: "Understand how traits are passed down, how DNA encodes life, and the mechanisms of evolution.", categoryId: 8, difficulty: "intermediate" },
  { id: 27, title: "Ecology & Ecosystems", description: "Study the interactions between organisms and their environments, from microbial communities to global biomes.", categoryId: 8, difficulty: "intermediate" },
  { id: 28, title: "Evolutionary Biology", description: "The unifying theory of life: how species change, diversify, and adapt through natural selection.", categoryId: 8, difficulty: "intermediate" },
  { id: 29, title: "Climate Science", description: "Examine Earth's climate system, greenhouse gases, paleoclimate records, and future projections.", categoryId: 9, difficulty: "intermediate" },
  { id: 30, title: "Geology & Plate Tectonics", description: "Discover how Earth's crust moves, mountains form, and the dynamic forces sculpting our planet.", categoryId: 9, difficulty: "beginner" },
  { id: 31, title: "Ethics & Moral Philosophy", description: "Investigate what makes actions right or wrong, and how we ought to live in a complex world.", categoryId: 10, difficulty: "intermediate" },
  { id: 32, title: "Logic & Reasoning", description: "Master formal and informal logic: arguments, fallacies, proofs, and the foundations of rational thought.", categoryId: 10, difficulty: "beginner" },
  { id: 33, title: "Epistemology", description: "The theory of knowledge: what can we know, how do we know it, and what counts as evidence?", categoryId: 10, difficulty: "advanced" },
  { id: 34, title: "Microeconomics", description: "Study individual and firm behavior, supply and demand, and the pricing of goods and services.", categoryId: 11, difficulty: "beginner" },
  { id: 35, title: "Macroeconomics", description: "Analyze national economies, inflation, unemployment, fiscal policy, and global trade.", categoryId: 11, difficulty: "intermediate" },
  { id: 36, title: "Behavioral Economics", description: "Explore how psychology influences economic decisions and why humans are not always rational actors.", categoryId: 11, difficulty: "intermediate" },
  { id: 37, title: "Syntax & Grammar", description: "The structural rules that govern sentence formation in human languages.", categoryId: 12, difficulty: "beginner" },
  { id: 38, title: "Semantics & Pragmatics", description: "How meaning is constructed in language — from literal definitions to implied context.", categoryId: 12, difficulty: "intermediate" },
  { id: 39, title: "Computational Linguistics", description: "Apply algorithms and statistical models to understand, generate, and translate human language.", categoryId: 12, difficulty: "advanced" },
  { id: 40, title: "Ancient Civilizations", description: "From Mesopotamia to Rome — the foundations of law, writing, and urban life.", categoryId: 13, difficulty: "beginner" },
  { id: 41, title: "Modern History", description: "Revolutions, world wars, decolonization, and the making of the contemporary global order.", categoryId: 13, difficulty: "intermediate" },
  { id: 42, title: "Color Theory & Composition", description: "Learn how colors interact, create mood, and guide the viewer's eye in visual design.", categoryId: 14, difficulty: "beginner" },
  { id: 43, title: "Typography & Layout", description: "Master the art of arranging type and space for readability, hierarchy, and aesthetic impact.", categoryId: 14, difficulty: "beginner" },
  { id: 44, title: "UI/UX Design Principles", description: "Create user-centered digital experiences through research, prototyping, and iterative testing.", categoryId: 14, difficulty: "intermediate" },
  { id: 45, title: "Human Physiology", description: "How organs and systems — cardiovascular, nervous, respiratory — maintain life and respond to change.", categoryId: 15, difficulty: "intermediate" },
  { id: 46, title: "Immunology", description: "The body's defense system: how it recognizes threats, mounts attacks, and remembers invaders.", categoryId: 15, difficulty: "advanced" },
  { id: 47, title: "Nutrition & Metabolism", description: "How food fuels the body, the biochemistry of digestion, and the science of dietary health.", categoryId: 15, difficulty: "beginner" },
  { id: 48, title: "Circuit Analysis", description: "Apply Ohm's and Kirchhoff's laws to design and analyze electrical circuits and systems.", categoryId: 16, difficulty: "intermediate" },
  { id: 49, title: "Signal Processing", description: "Capture, transform, and interpret signals — the math behind audio, images, and communication.", categoryId: 16, difficulty: "advanced" },
  { id: 50, title: "Control Systems", description: "Engineer feedback loops that keep machines stable, precise, and autonomous.", categoryId: 16, difficulty: "advanced" },
  { id: 51, title: "React & Modern Frontend", description: "Build reactive user interfaces with components, hooks, and the modern JavaScript ecosystem.", categoryId: 3, difficulty: "intermediate" },
  { id: 52, title: "Node.js & Backend APIs", description: "Create scalable server-side applications, RESTful APIs, and real-time services.", categoryId: 3, difficulty: "intermediate" },
  { id: 53, title: "Databases & SQL", description: "Model, query, and optimize relational and NoSQL databases for robust data storage.", categoryId: 3, difficulty: "beginner" },
  { id: 54, title: "Cryptography", description: "The mathematical science of securing information: encryption, hashing, and digital signatures.", categoryId: 3, difficulty: "advanced" },
  { id: 55, title: "Network Security", description: "Protect data in transit, detect intrusions, and harden infrastructure against cyber threats.", categoryId: 3, difficulty: "advanced" },
  { id: 56, title: "Deep Learning", description: "Multi-layer neural networks, backpropagation, and the architectures behind modern AI breakthroughs.", categoryId: 1, difficulty: "advanced" },
  { id: 57, title: "Reinforcement Learning", description: "Teach agents to make optimal decisions through trial, error, and reward signals.", categoryId: 1, difficulty: "advanced" },
  { id: 58, title: "Computer Vision", description: "Enable machines to interpret images and video: detection, segmentation, and scene understanding.", categoryId: 1, difficulty: "advanced" },
  { id: 59, title: "Natural Language Processing", description: "Bridge human language and computation: parsing, sentiment, translation, and generation.", categoryId: 1, difficulty: "intermediate" },
  { id: 60, title: "Data Visualization", description: "Transform complex datasets into intuitive charts, dashboards, and interactive stories.", categoryId: 1, difficulty: "beginner" },
  { id: 61, title: "Astrobiology", description: "The search for life beyond Earth and the conditions that make planets habitable.", categoryId: 4, difficulty: "intermediate" },
  { id: 62, title: "Stellar Evolution", description: "How stars are born, live, die, and seed the universe with heavy elements.", categoryId: 4, difficulty: "intermediate" },
  { id: 63, title: "Cosmology", description: "The origin, evolution, and ultimate fate of the entire universe.", categoryId: 4, difficulty: "advanced" },
  { id: 64, title: "CRISPR & Gene Editing", description: "Precision tools for rewriting DNA and their revolutionary implications for medicine and ethics.", categoryId: 8, difficulty: "advanced" },
  { id: 65, title: "Bioinformatics", description: "Apply computational methods to decode biological data: genomes, proteins, and evolutionary trees.", categoryId: 8, difficulty: "advanced" },
  { id: 66, title: "Renewable Energy Systems", description: "Solar, wind, battery storage, and the engineering of a sustainable power grid.", categoryId: 9, difficulty: "intermediate" },
  { id: 67, title: "Oceanography", description: "Explore Earth's oceans: currents, marine ecosystems, and the deep-sea frontier.", categoryId: 9, difficulty: "beginner" },
  { id: 68, title: "Meteorology", description: "Predict the weather by understanding atmospheric dynamics, pressure systems, and climate patterns.", categoryId: 9, difficulty: "beginner" },
  { id: 69, title: "Game Theory", description: "Model strategic interactions where the outcome for each player depends on the choices of all.", categoryId: 11, difficulty: "intermediate" },
  { id: 70, title: "Metallurgy", description: "The science of metals: extraction, alloying, heat treatment, and mechanical properties.", categoryId: 16, difficulty: "advanced" },
];

// Pathway-Topic mappings (linking topics to pathways they belong to)
// Pathways: 1=Physics, 2=Engineering, 3=Astrophysics, 4=CS, 5=AI, 6=Math, 7=Chemistry, 8=Biology, 9=Music Theory, 10=Open Source
export const DEFAULT_PATHWAY_TOPICS = [
  // Physics Pathway (id: 1) - physics topics
  { pathwayId: 1, topicId: 12, order: 1, isRequired: true }, // Classical Mechanics
  { pathwayId: 1, topicId: 17, order: 2, isRequired: true }, // Waves & Frequencies
  { pathwayId: 1, topicId: 14, order: 3, isRequired: true }, // Optics & Light
  { pathwayId: 1, topicId: 16, order: 4, isRequired: true }, // Electromagnetism
  { pathwayId: 1, topicId: 15, order: 5, isRequired: true }, // Fluid Dynamics
  { pathwayId: 1, topicId: 23, order: 6, isRequired: true }, // Thermodynamics
  { pathwayId: 1, topicId: 4, order: 7, isRequired: false }, // Quantum Mechanics (advanced)
  { pathwayId: 1, topicId: 24, order: 8, isRequired: false }, // Statistical Mechanics (advanced)
  
  // Engineering Pathway (id: 2) - applied physics + CS
  { pathwayId: 2, topicId: 12, order: 1, isRequired: true }, // Classical Mechanics
  { pathwayId: 2, topicId: 15, order: 2, isRequired: true }, // Fluid Dynamics
  { pathwayId: 2, topicId: 16, order: 3, isRequired: true }, // Electromagnetism
  { pathwayId: 2, topicId: 48, order: 4, isRequired: true }, // Circuit Analysis
  { pathwayId: 2, topicId: 50, order: 5, isRequired: false }, // Control Systems
  { pathwayId: 2, topicId: 3, order: 6, isRequired: true }, // Data Structures
  { pathwayId: 2, topicId: 7, order: 7, isRequired: true }, // Algorithms
  
  // Astrophysics Pathway (id: 3) - space-related physics
  { pathwayId: 3, topicId: 12, order: 1, isRequired: true }, // Classical Mechanics
  { pathwayId: 3, topicId: 13, order: 2, isRequired: true }, // Orbital Mechanics
  { pathwayId: 3, topicId: 14, order: 3, isRequired: true }, // Optics & Light
  { pathwayId: 3, topicId: 4, order: 4, isRequired: true }, // Quantum Mechanics
  
  // Computer Science Pathway (id: 4)
  { pathwayId: 4, topicId: 3, order: 1, isRequired: true }, // Data Structures
  { pathwayId: 4, topicId: 7, order: 2, isRequired: true }, // Algorithms
  { pathwayId: 4, topicId: 6, order: 3, isRequired: true }, // Graph Theory
  { pathwayId: 4, topicId: 53, order: 4, isRequired: true }, // Databases & SQL
  { pathwayId: 4, topicId: 52, order: 5, isRequired: false }, // Node.js & Backend APIs
  { pathwayId: 4, topicId: 11, order: 6, isRequired: false }, // Benefits of Open Source
  
  // Artificial Intelligence Pathway (id: 5)
  { pathwayId: 5, topicId: 1, order: 1, isRequired: true }, // Machine Learning
  { pathwayId: 5, topicId: 8, order: 2, isRequired: true }, // Neural Networks
  { pathwayId: 5, topicId: 2, order: 3, isRequired: true }, // Linear Algebra
  { pathwayId: 5, topicId: 56, order: 4, isRequired: true }, // Deep Learning
  { pathwayId: 5, topicId: 59, order: 5, isRequired: true }, // Natural Language Processing
  { pathwayId: 5, topicId: 58, order: 6, isRequired: false }, // Computer Vision
  { pathwayId: 5, topicId: 57, order: 7, isRequired: false }, // Reinforcement Learning
  { pathwayId: 5, topicId: 9, order: 8, isRequired: true }, // Hugging Face
  { pathwayId: 5, topicId: 10, order: 9, isRequired: false }, // Gradio
  
  // Mathematics Pathway (id: 6)
  { pathwayId: 6, topicId: 2, order: 1, isRequired: true }, // Linear Algebra
  { pathwayId: 6, topicId: 5, order: 2, isRequired: true }, // Calculus
  { pathwayId: 6, topicId: 6, order: 3, isRequired: true }, // Graph Theory
  { pathwayId: 6, topicId: 21, order: 4, isRequired: true }, // Probability & Statistics
  { pathwayId: 6, topicId: 22, order: 5, isRequired: false }, // Differential Equations
  
  // Chemistry Pathway (id: 7)
  { pathwayId: 7, topicId: 18, order: 1, isRequired: true }, // General Chemistry
  { pathwayId: 7, topicId: 19, order: 2, isRequired: true }, // Organic Chemistry
  
  // Biology Pathway (id: 8) - chemistry foundation + biology topics
  { pathwayId: 8, topicId: 18, order: 1, isRequired: true }, // General Chemistry
  { pathwayId: 8, topicId: 19, order: 2, isRequired: true }, // Organic Chemistry
  { pathwayId: 8, topicId: 25, order: 3, isRequired: true }, // Cell Biology
  { pathwayId: 8, topicId: 26, order: 4, isRequired: true }, // Genetics & Heredity
  { pathwayId: 8, topicId: 28, order: 5, isRequired: true }, // Evolutionary Biology
  { pathwayId: 8, topicId: 27, order: 6, isRequired: false }, // Ecology & Ecosystems
  
  // Music Theory Pathway (id: 9)
  { pathwayId: 9, topicId: 20, order: 1, isRequired: true }, // Music Theory
  { pathwayId: 9, topicId: 17, order: 2, isRequired: false }, // Waves & Frequencies (physics of sound)
  
  // Open Source Contributing Pathway (id: 10)
  { pathwayId: 10, topicId: 11, order: 1, isRequired: true }, // Benefits of Open Source
  { pathwayId: 10, topicId: 9, order: 2, isRequired: true }, // Hugging Face
  { pathwayId: 10, topicId: 10, order: 3, isRequired: true }, // Gradio
  { pathwayId: 10, topicId: 3, order: 4, isRequired: false }, // Data Structures

  // ── New pathway-topic mappings ────────────────────────────────────────────
  // Data Science & Analytics (id: 11)
  { pathwayId: 11, topicId: 21, order: 1, isRequired: true }, // Probability & Statistics
  { pathwayId: 11, topicId: 2, order: 2, isRequired: true }, // Linear Algebra
  { pathwayId: 11, topicId: 60, order: 3, isRequired: true }, // Data Visualization
  { pathwayId: 11, topicId: 1, order: 4, isRequired: false }, // Machine Learning

  // Full-Stack Web Development (id: 12)
  { pathwayId: 12, topicId: 51, order: 1, isRequired: true }, // React & Modern Frontend
  { pathwayId: 12, topicId: 52, order: 2, isRequired: true }, // Node.js & Backend APIs
  { pathwayId: 12, topicId: 53, order: 3, isRequired: true }, // Databases & SQL
  { pathwayId: 12, topicId: 7, order: 4, isRequired: false }, // Algorithms

  // Cybersecurity (id: 13)
  { pathwayId: 13, topicId: 54, order: 1, isRequired: true }, // Cryptography
  { pathwayId: 13, topicId: 55, order: 2, isRequired: true }, // Network Security
  { pathwayId: 13, topicId: 52, order: 3, isRequired: false }, // Node.js & Backend APIs

  // Robotics & Automation (id: 14)
  { pathwayId: 14, topicId: 50, order: 1, isRequired: true }, // Control Systems
  { pathwayId: 14, topicId: 48, order: 2, isRequired: true }, // Circuit Analysis
  { pathwayId: 14, topicId: 12, order: 3, isRequired: false }, // Classical Mechanics

  // Molecular Biology & Genetics (id: 15)
  { pathwayId: 15, topicId: 25, order: 1, isRequired: true }, // Cell Biology
  { pathwayId: 15, topicId: 26, order: 2, isRequired: true }, // Genetics & Heredity
  { pathwayId: 15, topicId: 64, order: 3, isRequired: true }, // CRISPR & Gene Editing

  // Environmental Science (id: 16)
  { pathwayId: 16, topicId: 29, order: 1, isRequired: true }, // Climate Science
  { pathwayId: 16, topicId: 30, order: 2, isRequired: true }, // Geology & Plate Tectonics
  { pathwayId: 16, topicId: 66, order: 3, isRequired: true }, // Renewable Energy Systems
  { pathwayId: 16, topicId: 67, order: 4, isRequired: false }, // Oceanography

  // Astronomy & Cosmology (id: 17)
  { pathwayId: 17, topicId: 62, order: 1, isRequired: true }, // Stellar Evolution
  { pathwayId: 17, topicId: 61, order: 2, isRequired: true }, // Astrobiology
  { pathwayId: 17, topicId: 63, order: 3, isRequired: true }, // Cosmology

  // Philosophy & Critical Thinking (id: 18)
  { pathwayId: 18, topicId: 32, order: 1, isRequired: true }, // Logic & Reasoning
  { pathwayId: 18, topicId: 31, order: 2, isRequired: true }, // Ethics & Moral Philosophy
  { pathwayId: 18, topicId: 33, order: 3, isRequired: false }, // Epistemology

  // Economics & Finance (id: 19)
  { pathwayId: 19, topicId: 34, order: 1, isRequired: true }, // Microeconomics
  { pathwayId: 19, topicId: 35, order: 2, isRequired: true }, // Macroeconomics
  { pathwayId: 19, topicId: 36, order: 3, isRequired: true }, // Behavioral Economics
  { pathwayId: 19, topicId: 69, order: 4, isRequired: false }, // Game Theory

  // Linguistics & Natural Language (id: 20)
  { pathwayId: 20, topicId: 37, order: 1, isRequired: true }, // Syntax & Grammar
  { pathwayId: 20, topicId: 38, order: 2, isRequired: true }, // Semantics & Pragmatics
  { pathwayId: 20, topicId: 39, order: 3, isRequired: true }, // Computational Linguistics

  // World History (id: 21)
  { pathwayId: 21, topicId: 40, order: 1, isRequired: true }, // Ancient Civilizations
  { pathwayId: 21, topicId: 41, order: 2, isRequired: true }, // Modern History

  // Digital Art & Design (id: 22)
  { pathwayId: 22, topicId: 42, order: 1, isRequired: true }, // Color Theory & Composition
  { pathwayId: 22, topicId: 43, order: 2, isRequired: true }, // Typography & Layout
  { pathwayId: 22, topicId: 44, order: 3, isRequired: true }, // UI/UX Design Principles

  // Human Anatomy & Physiology (id: 23)
  { pathwayId: 23, topicId: 45, order: 1, isRequired: true }, // Human Physiology
  { pathwayId: 23, topicId: 47, order: 2, isRequired: true }, // Nutrition & Metabolism
  { pathwayId: 23, topicId: 46, order: 3, isRequired: false }, // Immunology

  // Electrical Engineering (id: 24)
  { pathwayId: 24, topicId: 48, order: 1, isRequired: true }, // Circuit Analysis
  { pathwayId: 24, topicId: 49, order: 2, isRequired: true }, // Signal Processing
  { pathwayId: 24, topicId: 16, order: 3, isRequired: false }, // Electromagnetism

  // Material Science (id: 25)
  { pathwayId: 25, topicId: 70, order: 1, isRequired: true }, // Metallurgy
  { pathwayId: 25, topicId: 18, order: 2, isRequired: false }, // General Chemistry
];

export const DEFAULT_KNOWLEDGE_CARDS = [
  { id: 1, topicId: 8, title: "What are Neural Networks?", content: "Neural networks are computing systems inspired by biological neural networks. They consist of interconnected nodes (neurons) that process information using connections (synapses) that can be adjusted through learning.", cardType: "text", tags: ["neural", "AI", "deep-learning"], order: 0 },
  { id: 2, topicId: 5, title: "The Derivative", content: "The derivative measures how a function changes as its input changes. It's the instantaneous rate of change, or the slope of the tangent line at any point on a curve.", cardType: "text", tags: ["calculus", "derivatives", "rates"], order: 0 },
  { id: 3, topicId: 7, title: "Big O Notation", content: "Big O notation describes the worst-case complexity of an algorithm. O(1) is constant time, O(n) is linear, O(n²) is quadratic. It helps us compare algorithm efficiency as inputs grow.", cardType: "text", tags: ["algorithms", "complexity", "efficiency"], order: 0 },
  { id: 4, topicId: 3, title: "Arrays vs Linked Lists", content: "Arrays store elements in contiguous memory locations for O(1) access but O(n) insertion. Linked lists use pointers for O(1) insertion but O(n) access. Choose based on your access patterns!", cardType: "text", tags: ["data-structures", "arrays", "comparison"], order: 0 },
  { id: 5, topicId: 2, title: "Vectors and Scalars", content: "A scalar is just a single number. A vector is an ordered list of numbers. Think of a scalar as a point, and a vector as an arrow pointing in a specific direction with a specific length.", cardType: "text", tags: ["vectors", "basics", "math"], order: 0 },
  { id: 6, topicId: 4, title: "Wave-Particle Duality", content: "Light and matter exhibit both wave and particle properties. This isn't about them 'switching' between states—they're always both, and which property we observe depends on how we measure them.", cardType: "text", tags: ["quantum", "physics", "waves"], order: 0 },
  { id: 7, topicId: 1, title: "Types of Machine Learning", content: "There are three main types: Supervised learning (learning from labeled examples), Unsupervised learning (finding patterns in unlabeled data), and Reinforcement learning (learning through trial and error).", cardType: "text", tags: ["ML", "types", "overview"], order: 0 },
  { id: 8, topicId: 1, title: "What is Machine Learning?", content: "Machine learning is a subset of artificial intelligence that enables computers to learn from experience without being explicitly programmed. Instead of writing rules, we feed data and let the algorithm discover patterns.", cardType: "text", tags: ["AI", "basics", "introduction"], order: 0 },
  { id: 9, topicId: 9, title: "What is Hugging Face?", content: "Hugging Face is the GitHub of machine learning. It hosts over 500,000 models, 100,000 datasets, and thousands of demo applications. Think of it as a one-stop shop for finding, sharing, and deploying AI models.", cardType: "text", tags: ["intro", "platform"], order: 1 },
  { id: 10, topicId: 9, title: "Transformers Library", content: "The Transformers library is Hugging Face's flagship product. It provides easy-to-use APIs for state-of-the-art NLP, computer vision, and audio models. Just a few lines of code to run powerful AI!", cardType: "text", tags: ["library", "code"], order: 2 },
  { id: 11, topicId: 9, title: "Model Hub", content: "The Model Hub hosts pre-trained models you can use instantly. From text generation to image classification, find a model for almost any task. Each model comes with documentation and example code.", cardType: "text", tags: ["models", "hub"], order: 3 },
  { id: 12, topicId: 9, title: "Spaces", content: "Hugging Face Spaces lets you deploy ML demos instantly. Build interactive apps with Gradio or Streamlit and share them with the world - all for free!", cardType: "text", tags: ["deployment", "demos"], order: 4 },
  { id: 13, topicId: 10, title: "What is Gradio?", content: "Gradio is a Python library that makes it incredibly easy to build web interfaces for machine learning models. Create a shareable demo in just 4-5 lines of code!", cardType: "text", tags: ["intro", "python"], order: 1 },
  { id: 14, topicId: 10, title: "Interface Components", content: "Gradio provides ready-made components: text boxes, image uploaders, audio players, sliders, and more. Mix and match to create the perfect interface for your model.", cardType: "text", tags: ["components", "ui"], order: 2 },
  { id: 15, topicId: 10, title: "Sharing Your App", content: "Every Gradio app gets a public URL instantly. Share your ML demo with anyone - no deployment knowledge needed. Links work for 72 hours on the free tier.", cardType: "text", tags: ["sharing", "deployment"], order: 3 },
  { id: 16, topicId: 10, title: "Blocks API", content: "For complex layouts, use Gradio Blocks. It gives you full control over your app's design with rows, columns, tabs, and custom styling.", cardType: "text", tags: ["advanced", "layout"], order: 4 },
  { id: 17, topicId: 11, title: "The Open Source Philosophy", content: "Open source means making source code freely available for anyone to view, modify, and distribute. It's built on the belief that collaboration creates better software than working in isolation.", cardType: "text", tags: ["philosophy", "intro"], order: 1 },
  { id: 18, topicId: 11, title: "Accelerated Innovation", content: "When code is open, thousands of developers can improve it simultaneously. Bugs get found faster, features get added quicker, and the software evolves rapidly. Linux, for example, has contributions from over 20,000 developers!", cardType: "text", tags: ["innovation", "collaboration"], order: 2 },
  { id: 19, topicId: 11, title: "Building Communities", content: "Open source projects create vibrant communities. Contributors learn from each other, mentor newcomers, and build professional networks. Many developers credit open source for launching their careers.", cardType: "text", tags: ["community", "networking"], order: 3 },
  { id: 20, topicId: 11, title: "Democratizing Technology", content: "Open source makes cutting-edge technology accessible to everyone. Small startups can use the same tools as tech giants. This levels the playing field and enables innovation worldwide.", cardType: "text", tags: ["accessibility", "equality"], order: 4 },
  { id: 21, topicId: 11, title: "How to Contribute", content: 'Start by finding a project you use and love. Look for "good first issues" on GitHub. Read the contribution guidelines, make small improvements, and submit pull requests. Every contribution matters!', cardType: "text", tags: ["contributing", "github"], order: 5 },
  { id: 22, topicId: 12, title: "Newton's Laws of Motion", content: "The three laws that govern all motion: Objects at rest stay at rest, F=ma, and every action has an equal and opposite reaction. These simple rules explain everything from car crashes to rocket launches.", cardType: "text", tags: ["newton", "forces"], order: 1 },
  { id: 23, topicId: 12, title: "Energy and Work", content: "Energy can be kinetic (motion) or potential (stored). Work transfers energy between objects. Understanding energy conservation is key to solving physics problems.", cardType: "text", tags: ["energy", "conservation"], order: 2 },
  { id: 24, topicId: 12, title: "Momentum", content: "Mass times velocity - the quantity that's always conserved in collisions. From pool balls to car safety, momentum explains how objects interact.", cardType: "text", tags: ["momentum", "collisions"], order: 3 },
  { id: 25, topicId: 13, title: "Kepler's Laws", content: "Planets orbit in ellipses with the sun at one focus. They sweep equal areas in equal times. And orbital period relates to distance from the sun. These laws unlock space travel.", cardType: "text", tags: ["kepler", "orbits"], order: 1 },
  { id: 26, topicId: 13, title: "Escape Velocity", content: "The minimum speed needed to leave a planet's gravity forever. For Earth, it's about 11.2 km/s. Understanding this is crucial for launching spacecraft.", cardType: "text", tags: ["velocity", "gravity"], order: 2 },
  { id: 27, topicId: 13, title: "Orbital Transfers", content: "The Hohmann transfer orbit is the most fuel-efficient way to travel between planets. It uses the physics of elliptical orbits to save rocket fuel.", cardType: "text", tags: ["spacecraft", "transfer"], order: 3 },
  { id: 28, topicId: 14, title: "Reflection and Refraction", content: "Light bounces off mirrors (reflection) and bends through glass (refraction). These simple principles explain everything from rainbows to fiber optics.", cardType: "text", tags: ["light", "reflection"], order: 1 },
  { id: 29, topicId: 14, title: "The Electromagnetic Spectrum", content: 'Light is just visible electromagnetic radiation. Radio waves, microwaves, infrared, UV, X-rays, and gamma rays are all "light" at different frequencies.', cardType: "text", tags: ["spectrum", "waves"], order: 2 },
  { id: 30, topicId: 14, title: "Lenses and Optical Instruments", content: "Converging and diverging lenses bend light to create images. Telescopes, microscopes, cameras, and your eyes all use these principles.", cardType: "text", tags: ["lenses", "optics"], order: 3 },
  { id: 31, topicId: 15, title: "Bernoulli's Principle", content: "Fast-moving fluids have lower pressure than slow-moving fluids. This explains how airplane wings generate lift and why shower curtains blow inward.", cardType: "text", tags: ["pressure", "bernoulli"], order: 1 },
  { id: 32, topicId: 15, title: "Viscosity and Flow", content: "Viscosity is a fluid's resistance to flow. Honey is viscous, water is not. Understanding viscosity is essential for everything from blood flow to oil pipelines.", cardType: "text", tags: ["viscosity", "flow"], order: 2 },
  { id: 33, topicId: 15, title: "Turbulence", content: "When flow becomes chaotic and unpredictable. Turbulence affects airplanes, weather patterns, and even cream mixing in coffee. It's one of physics' great unsolved problems.", cardType: "text", tags: ["turbulence", "chaos"], order: 3 },
  { id: 34, topicId: 16, title: "Electric Fields and Forces", content: "Charged particles create invisible fields that push and pull other charges. This force is 10^36 times stronger than gravity! It holds atoms together.", cardType: "text", tags: ["electric", "fields"], order: 1 },
  { id: 35, topicId: 16, title: "Magnetic Fields", content: "Moving charges create magnetic fields. Earth's magnetic field protects us from solar radiation. Magnets are simply materials where atomic magnetic fields align.", cardType: "text", tags: ["magnetic", "fields"], order: 2 },
  { id: 36, topicId: 16, title: "Maxwell's Equations", content: "Four elegant equations that unified electricity and magnetism. They predict electromagnetic waves travel at the speed of light - revealing that light IS an electromagnetic wave.", cardType: "text", tags: ["maxwell", "waves"], order: 3 },
  { id: 37, topicId: 17, title: "Wave Properties", content: "All waves have wavelength, frequency, and amplitude. Frequency times wavelength equals wave speed. Higher frequency means more energy.", cardType: "text", tags: ["waves", "properties"], order: 1 },
  { id: 38, topicId: 17, title: "Sound Waves", content: "Pressure waves traveling through air (or any medium). Frequency determines pitch, amplitude determines loudness. Sound can't travel in a vacuum.", cardType: "text", tags: ["sound", "audio"], order: 2 },
  { id: 39, topicId: 17, title: "Resonance", content: "When a system is driven at its natural frequency, it oscillates with maximum amplitude. This is how opera singers break glass and why bridges can collapse.", cardType: "text", tags: ["resonance", "frequency"], order: 3 },
  { id: 40, topicId: 18, title: "Atoms and Elements", content: "Everything is made of atoms - tiny nuclei surrounded by electrons. Elements are pure substances made of one type of atom. The periodic table organizes all known elements.", cardType: "text", tags: ["atoms", "elements"], order: 1 },
  { id: 41, topicId: 18, title: "Chemical Bonds", content: "Atoms connect through ionic bonds (electron transfer) or covalent bonds (electron sharing). These bonds determine a substance's properties.", cardType: "text", tags: ["bonds", "molecules"], order: 2 },
  { id: 42, topicId: 18, title: "Chemical Reactions", content: "Bonds break and form to create new substances. Conservation of mass means atoms are rearranged, not created or destroyed. Reactions can release or absorb energy.", cardType: "text", tags: ["reactions", "energy"], order: 3 },
  { id: 43, topicId: 19, title: "Carbon: The Building Block of Life", content: "Carbon can form four bonds and chain with itself endlessly. This versatility makes it the foundation of all known life and countless synthetic materials.", cardType: "text", tags: ["carbon", "life"], order: 1 },
  { id: 44, topicId: 19, title: "Functional Groups", content: "Specific atom arrangements that give molecules their properties. Alcohols, acids, amines - each functional group has characteristic behavior.", cardType: "text", tags: ["functional", "groups"], order: 2 },
  { id: 45, topicId: 19, title: "Biochemistry Basics", content: "Proteins, carbohydrates, lipids, and nucleic acids - the four classes of biological molecules. All are organic compounds essential to life.", cardType: "text", tags: ["biochemistry", "life"], order: 3 },
  { id: 46, topicId: 20, title: "Scales and Keys", content: 'Scales are collections of notes that sound good together. Keys establish the "home base" note. Major keys sound happy, minor keys sound sad.', cardType: "text", tags: ["scales", "keys"], order: 1 },
  { id: 47, topicId: 20, title: "Chords and Harmony", content: "Chords are multiple notes played together. Some combinations sound stable (consonant), others create tension (dissonant). Progressions create musical storytelling.", cardType: "text", tags: ["chords", "harmony"], order: 2 },
  { id: 48, topicId: 20, title: "Rhythm and Time", content: "Music happens in time. Beats, measures, tempo, and time signatures organize when notes happen. Rhythm gives music its pulse and groove.", cardType: "text", tags: ["rhythm", "tempo"], order: 3 },
  // ── New knowledge cards for expanded topics ───────────────────────────────
  { id: 49, topicId: 21, title: "The Law of Large Numbers", content: "As you repeat a random experiment many times, the average outcome converges to the expected value. This is why casinos always win in the long run.", cardType: "text", tags: ["probability", "statistics", "laws"], order: 1 },
  { id: 50, topicId: 21, title: "Normal Distribution", content: "The bell curve appears everywhere in nature. Heights, test scores, measurement errors — many phenomena cluster around a mean with predictable spread.", cardType: "text", tags: ["distribution", "bell-curve"], order: 2 },
  { id: 51, topicId: 22, title: "Ordinary Differential Equations", content: "ODEs involve derivatives with respect to a single variable. They describe populations, circuits, and pendulums. Solve them to predict future states.", cardType: "text", tags: ["ODE", "rates", "modeling"], order: 1 },
  { id: 52, topicId: 23, title: "The Laws of Thermodynamics", content: "Four laws governing energy: conservation, entropy increase, absolute zero unattainability, and temperature equilibrium. They dictate what machines can and cannot do.", cardType: "text", tags: ["energy", "entropy", "laws"], order: 1 },
  { id: 53, topicId: 24, title: "Entropy and Disorder", content: "Entropy measures the number of microscopic configurations corresponding to a macroscopic state. Higher entropy means more disorder — and the universe trends toward it.", cardType: "text", tags: ["entropy", "disorder", "arrow-of-time"], order: 1 },
  { id: 54, topicId: 25, title: "The Cell Membrane", content: "A phospholipid bilayer that controls what enters and exits the cell. It's selectively permeable, maintaining homeostasis through channels and pumps.", cardType: "text", tags: ["membrane", "homeostasis"], order: 1 },
  { id: 55, topicId: 25, title: "Organelles", content: "Specialized structures inside cells: mitochondria produce energy, ribosomes build proteins, and the nucleus stores DNA. Each has a crucial job.", cardType: "text", tags: ["organelles", "mitochondria"], order: 2 },
  { id: 56, topicId: 26, title: "DNA Structure", content: "A double helix of nucleotides encoding genetic information. Base pairs (A-T, G-C) form the rungs of the ladder, and the sequence spells out genes.", cardType: "text", tags: ["DNA", "genes", "helix"], order: 1 },
  { id: 57, topicId: 26, title: "Mendelian Inheritance", content: "Traits are passed via dominant and recessive alleles. Mendel's pea plant experiments revealed predictable ratios in offspring generations.", cardType: "text", tags: ["mendel", "inheritance"], order: 2 },
  { id: 58, topicId: 27, title: "Food Webs", content: "Energy flows from producers (plants) to consumers (herbivores, carnivores) to decomposers. Disrupt one link and the whole web trembles.", cardType: "text", tags: ["ecology", "energy-flow"], order: 1 },
  { id: 59, topicId: 28, title: "Natural Selection", content: "Organisms with advantageous traits survive and reproduce more. Over generations, populations adapt to their environments — evolution in action.", cardType: "text", tags: ["darwin", "adaptation"], order: 1 },
  { id: 60, topicId: 29, title: "The Greenhouse Effect", content: "Certain gases trap infrared radiation, warming Earth's surface. Without it, Earth would be frozen. Too much, and we risk runaway warming.", cardType: "text", tags: ["greenhouse", "warming"], order: 1 },
  { id: 61, topicId: 30, title: "Plate Boundaries", content: "Divergent plates spread, convergent plates collide, and transform plates slide past each other. These boundaries create earthquakes, volcanoes, and mountain ranges.", cardType: "text", tags: ["tectonics", "earthquakes"], order: 1 },
  { id: 62, topicId: 31, title: "Utilitarianism", content: "The greatest good for the greatest number. Actions are judged by their consequences, and morality is about maximizing overall well-being.", cardType: "text", tags: ["ethics", "utilitarianism"], order: 1 },
  { id: 63, topicId: 32, title: "Logical Fallacies", content: "Common errors in reasoning: ad hominem attacks, false dilemmas, straw man arguments. Spotting them makes you a stronger thinker and debater.", cardType: "text", tags: ["logic", "fallacies", "critical-thinking"], order: 1 },
  { id: 64, topicId: 33, title: "The Gettier Problem", content: "Is justified true belief sufficient for knowledge? Gettier showed cases where someone has a true, justified belief that still seems accidental — challenging classical epistemology.", cardType: "text", tags: ["knowledge", "justification"], order: 1 },
  { id: 65, topicId: 34, title: "Supply and Demand", content: "The price of a good settles where supply meets demand. Shifts in either curve change the equilibrium price and quantity traded.", cardType: "text", tags: ["markets", "equilibrium"], order: 1 },
  { id: 66, topicId: 35, title: "GDP and Economic Growth", content: "Gross Domestic Product measures total economic output. Growth depends on labor, capital, technology, and institutions — the engines of prosperity.", cardType: "text", tags: ["GDP", "growth"], order: 1 },
  { id: 67, topicId: 36, title: "Cognitive Biases", content: "Humans systematically deviate from rationality: confirmation bias, loss aversion, anchoring. Understanding them helps design better policies and choices.", cardType: "text", tags: ["bias", "psychology", "behavior"], order: 1 },
  { id: 68, topicId: 37, title: "Parts of Speech", content: "Nouns, verbs, adjectives, adverbs, pronouns, prepositions, conjunctions, and interjections. These categories form the building blocks of grammar.", cardType: "text", tags: ["grammar", "basics"], order: 1 },
  { id: 69, topicId: 38, title: "Implicature", content: "Speakers often mean more than they say. 'It's cold in here' can be a request to close the window. Pragmatics studies these implied meanings.", cardType: "text", tags: ["meaning", "context", "pragmatics"], order: 1 },
  { id: 70, topicId: 39, title: "The Turing Test", content: "If a machine's responses are indistinguishable from a human's, does it understand language? The Turing Test remains a benchmark and a philosophical provocation.", cardType: "text", tags: ["NLP", "AI", "turing"], order: 1 },
  { id: 71, topicId: 40, title: "The Agricultural Revolution", content: "Around 10,000 BCE, humans shifted from hunting and gathering to farming. This transformation led to cities, writing, and civilization itself.", cardType: "text", tags: ["agriculture", "civilization"], order: 1 },
  { id: 72, topicId: 41, title: "The Industrial Revolution", content: "Steam power, factories, and mass production transformed societies in the 18th-19th centuries. It raised living standards but also created new inequalities.", cardType: "text", tags: ["industry", "modernity"], order: 1 },
  { id: 73, topicId: 42, title: "The Color Wheel", content: "Primary, secondary, and tertiary colors arranged in a circle. Complementary colors sit opposite each other and create visual contrast when paired.", cardType: "text", tags: ["color", "design"], order: 1 },
  { id: 74, topicId: 43, title: "Serif vs Sans-Serif", content: "Serif fonts have small strokes at letter ends, conveying tradition and readability in print. Sans-serif fonts are cleaner, better for screens.", cardType: "text", tags: ["typography", "fonts"], order: 1 },
  { id: 75, topicId: 44, title: "User-Centered Design", content: "Start with user research, define problems from their perspective, prototype solutions, and test iteratively. Good design is invisible.", cardType: "text", tags: ["UX", "design-process"], order: 1 },
  { id: 76, topicId: 45, title: "The Circulatory System", content: "The heart pumps blood through arteries, capillaries, and veins, delivering oxygen and nutrients while removing waste. A closed loop of life.", cardType: "text", tags: ["heart", "blood", "circulation"], order: 1 },
  { id: 77, topicId: 46, title: "Adaptive Immunity", content: "B cells produce antibodies; T cells destroy infected cells. Together they form a memory bank that responds faster upon re-exposure to a pathogen.", cardType: "text", tags: ["immune", "antibodies"], order: 1 },
  { id: 78, topicId: 47, title: "Macronutrients", content: "Carbohydrates provide quick energy, fats store long-term energy, and proteins build tissues. Balancing them is key to metabolic health.", cardType: "text", tags: ["nutrition", "metabolism"], order: 1 },
  { id: 79, topicId: 48, title: "Ohm's Law", content: "V = I × R. Voltage equals current times resistance. This simple relationship is the foundation of all circuit analysis.", cardType: "text", tags: ["ohms-law", "circuits"], order: 1 },
  { id: 80, topicId: 49, title: "Fourier Transform", content: "Any signal can be decomposed into sine waves of different frequencies. The Fourier Transform is the mathematical tool that reveals a signal's frequency spectrum.", cardType: "text", tags: ["fourier", "frequency", "signals"], order: 1 },
  { id: 81, topicId: 50, title: "Feedback Loops", content: "Negative feedback stabilizes systems (like a thermostat). Positive feedback amplifies changes (like a microphone near a speaker). Control theory manages both.", cardType: "text", tags: ["feedback", "control"], order: 1 },
  { id: 82, topicId: 51, title: "Virtual DOM", content: "React creates a lightweight copy of the real DOM in memory. When state changes, it efficiently calculates the minimal updates needed — making UIs fast.", cardType: "text", tags: ["react", "DOM", "performance"], order: 1 },
  { id: 83, topicId: 52, title: "RESTful APIs", content: "Representational State Transfer: use HTTP methods (GET, POST, PUT, DELETE) on resource URLs. Stateless, cacheable, and the backbone of the modern web.", cardType: "text", tags: ["API", "REST", "HTTP"], order: 1 },
  { id: 84, topicId: 53, title: "Relational vs NoSQL", content: "SQL databases enforce structure with tables and joins. NoSQL databases offer flexibility with documents, key-value pairs, or graphs. Choose based on data shape.", cardType: "text", tags: ["databases", "SQL", "NoSQL"], order: 1 },
  { id: 85, topicId: 54, title: "Public-Key Cryptography", content: "Two keys: a public one for encryption and a private one for decryption. This enables secure communication without sharing secret keys in advance.", cardType: "text", tags: ["encryption", "security", "keys"], order: 1 },
  { id: 86, topicId: 55, title: "The OSI Model", content: "Seven layers from physical wires to applications. Understanding this stack helps diagnose network issues and design secure architectures.", cardType: "text", tags: ["networking", "OSI", "layers"], order: 1 },
  { id: 87, topicId: 56, title: "Backpropagation", content: "Neural networks learn by propagating error gradients backward through layers. This algorithm, combined with gradient descent, powers deep learning.", cardType: "text", tags: ["deep-learning", "gradients", "training"], order: 1 },
  { id: 88, topicId: 57, title: "Q-Learning", content: "An agent learns action values (Q-values) by exploring an environment and receiving rewards. Over time, it converges on an optimal policy.", cardType: "text", tags: ["RL", "Q-learning", "agents"], order: 1 },
  { id: 89, topicId: 58, title: "Convolutional Neural Networks", content: "CNNs use sliding filters to detect edges, textures, and shapes in images. They're the workhorse of modern computer vision.", cardType: "text", tags: ["CNN", "vision", "filters"], order: 1 },
  { id: 90, topicId: 59, title: "Tokenization", content: "Breaking text into words, subwords, or characters. It's the first step in NLP pipelines and strongly influences model performance.", cardType: "text", tags: ["NLP", "tokens", "preprocessing"], order: 1 },
  { id: 91, topicId: 60, title: "Data-Ink Ratio", content: "Every pixel of ink should convey data. Remove chart junk, maximize data-ink, and let the numbers tell their own story.", cardType: "text", tags: ["visualization", "design", "charts"], order: 1 },
  { id: 92, topicId: 61, title: "The Habitable Zone", content: "The orbital range around a star where liquid water can exist on a planet's surface. Earth sits in our Sun's habitable zone — not too hot, not too cold.", cardType: "text", tags: ["exoplanets", "habitability"], order: 1 },
  { id: 93, topicId: 62, title: "Nuclear Fusion in Stars", content: "Stars shine by fusing hydrogen into helium under extreme gravity. Heavier elements form in later stages, eventually seeding future generations of stars and planets.", cardType: "text", tags: ["fusion", "stars", "nucleosynthesis"], order: 1 },
  { id: 94, topicId: 63, title: "The Big Bang", content: "The universe began as an extremely hot, dense point approximately 13.8 billion years ago. It has been expanding and cooling ever since.", cardType: "text", tags: ["cosmology", "origin", "expansion"], order: 1 },
  { id: 95, topicId: 64, title: "CRISPR-Cas9", content: "A bacterial immune system repurposed as a genetic tool. It cuts DNA at precise locations, enabling gene editing with unprecedented accuracy and ease.", cardType: "text", tags: ["CRISPR", "gene-editing", "DNA"], order: 1 },
  { id: 96, topicId: 65, title: "Sequence Alignment", content: "Comparing DNA, RNA, or protein sequences to find similarities. Alignment reveals evolutionary relationships and functional domains.", cardType: "text", tags: ["bioinformatics", "sequences", "alignment"], order: 1 },
  { id: 97, topicId: 66, title: "Photovoltaic Effect", content: "Solar cells convert photons into electron-hole pairs, generating direct current. Semiconductors like silicon make this quantum process practical.", cardType: "text", tags: ["solar", "energy", "semiconductors"], order: 1 },
  { id: 98, topicId: 67, title: "Thermohaline Circulation", content: "A global ocean conveyor driven by temperature and salinity differences. It regulates Earth's climate by redistributing heat across latitudes.", cardType: "text", tags: ["ocean", "circulation", "climate"], order: 1 },
  { id: 99, topicId: 68, title: "High and Low Pressure Systems", content: "Air rises in low-pressure zones, creating clouds and precipitation. Air sinks in high-pressure zones, bringing clear skies. Their interaction drives weather.", cardType: "text", tags: ["weather", "pressure", "systems"], order: 1 },
  { id: 100, topicId: 69, title: "The Prisoner's Dilemma", content: "Two suspects must choose to cooperate or betray. Individual rationality leads to mutual defection, even though mutual cooperation is better. A paradox of strategic interaction.", cardType: "text", tags: ["game-theory", "dilemma", "strategy"], order: 1 },
  { id: 101, topicId: 70, title: "Phase Diagrams", content: "Maps showing which phase (solid, liquid, gas) a material occupies at given temperatures and pressures. They guide alloy design and heat treatment.", cardType: "text", tags: ["phases", "materials", "diagrams"], order: 1 },
];

// ── Achievements ────────────────────────────────────────────────────────────
export const DEFAULT_ACHIEVEMENTS = [
  { id: 1, name: "First Steps", description: "Complete your first lesson unit.", icon: "Footprints", category: "milestone", requirement: { type: "lessons", value: 1 }, xpReward: 50, isSecret: false, rarity: "common" },
  { id: 2, name: "Getting Started", description: "Complete 5 lesson units across any topics.", icon: "Rocket", category: "milestone", requirement: { type: "lessons", value: 5 }, xpReward: 100, isSecret: false, rarity: "common" },
  { id: 3, name: "Dedicated Learner", description: "Complete 25 lesson units.", icon: "BookOpen", category: "milestone", requirement: { type: "lessons", value: 25 }, xpReward: 250, isSecret: false, rarity: "uncommon" },
  { id: 4, name: "Knowledge Seeker", description: "Complete 100 lesson units.", icon: "GraduationCap", category: "milestone", requirement: { type: "lessons", value: 100 }, xpReward: 500, isSecret: false, rarity: "rare" },
  { id: 5, name: "Explorer", description: "Explore 5 different topics.", icon: "Compass", category: "milestone", requirement: { type: "topics", value: 5 }, xpReward: 100, isSecret: false, rarity: "common" },
  { id: 6, name: "Scholar", description: "Explore 25 different topics.", icon: "Scroll", category: "milestone", requirement: { type: "topics", value: 25 }, xpReward: 300, isSecret: false, rarity: "uncommon" },
  { id: 7, name: "Polymath", description: "Explore 50 different topics.", icon: "Globe", category: "milestone", requirement: { type: "topics", value: 50 }, xpReward: 750, isSecret: false, rarity: "epic" },
  { id: 8, name: "Master", description: "Master a topic by completing all difficulty tiers.", icon: "Trophy", category: "mastery", requirement: { type: "masteredTopics", value: 1 }, xpReward: 200, isSecret: false, rarity: "uncommon" },
  { id: 9, name: "Grandmaster", description: "Master 10 topics.", icon: "Crown", category: "mastery", requirement: { type: "masteredTopics", value: 10 }, xpReward: 1000, isSecret: false, rarity: "legendary" },
  { id: 10, name: "Streak Starter", description: "Maintain a 3-day learning streak.", icon: "Flame", category: "streak", requirement: { type: "streak", value: 3 }, xpReward: 75, isSecret: false, rarity: "common" },
  { id: 11, name: "On Fire", description: "Maintain a 7-day learning streak.", icon: "Flame", category: "streak", requirement: { type: "streak", value: 7 }, xpReward: 150, isSecret: false, rarity: "uncommon" },
  { id: 12, name: "Unstoppable", description: "Maintain a 30-day learning streak.", icon: "Zap", category: "streak", requirement: { type: "streak", value: 30 }, xpReward: 500, isSecret: false, rarity: "epic" },
  { id: 13, name: "Open Mind", description: "Submit your first open science idea.", icon: "Lightbulb", category: "research", requirement: { type: "ideas", value: 1 }, xpReward: 100, isSecret: false, rarity: "common" },
  { id: 14, name: "Contributor", description: "Submit 5 open science ideas.", icon: "Microscope", category: "research", requirement: { type: "ideas", value: 5 }, xpReward: 300, isSecret: false, rarity: "uncommon" },
  { id: 15, name: "Pioneer", description: "Have a research idea validated by the community.", icon: "Award", category: "research", requirement: { type: "validatedIdeas", value: 1 }, xpReward: 500, isSecret: false, rarity: "rare" },
  { id: 16, name: "Night Owl", description: "Complete a lesson between midnight and 5 AM.", icon: "Moon", category: "rare", requirement: { type: "nightOwl", value: 1 }, xpReward: 50, isSecret: true, rarity: "uncommon" },
  { id: 17, name: "Early Bird", description: "Complete a lesson before 6 AM.", icon: "Sun", category: "rare", requirement: { type: "earlyBird", value: 1 }, xpReward: 50, isSecret: true, rarity: "uncommon" },
  { id: 18, name: "Speedster", description: "Complete 5 lessons in a single day.", icon: "Zap", category: "rare", requirement: { type: "speedster", value: 5 }, xpReward: 150, isSecret: false, rarity: "rare" },
];

// ── Topic Connections (Prerequisites) ───────────────────────────────────────
export const DEFAULT_TOPIC_CONNECTIONS = [
  // Math foundations
  { fromTopicId: 2, toTopicId: 1, connectionType: "prerequisite", strength: 3 },   // Linear Algebra -> Machine Learning
  { fromTopicId: 2, toTopicId: 8, connectionType: "prerequisite", strength: 3 },   // Linear Algebra -> Neural Networks
  { fromTopicId: 5, toTopicId: 22, connectionType: "prerequisite", strength: 3 },  // Calculus -> Differential Equations
  { fromTopicId: 21, toTopicId: 1, connectionType: "prerequisite", strength: 2 },  // Probability & Statistics -> Machine Learning
  // Physics progression
  { fromTopicId: 12, toTopicId: 13, connectionType: "prerequisite", strength: 3 }, // Classical Mechanics -> Orbital Mechanics
  { fromTopicId: 12, toTopicId: 16, connectionType: "prerequisite", strength: 2 }, // Classical Mechanics -> Electromagnetism
  { fromTopicId: 12, toTopicId: 15, connectionType: "prerequisite", strength: 2 }, // Classical Mechanics -> Fluid Dynamics
  { fromTopicId: 17, toTopicId: 14, connectionType: "prerequisite", strength: 2 }, // Waves & Frequencies -> Optics & Light
  { fromTopicId: 15, toTopicId: 23, connectionType: "prerequisite", strength: 2 }, // Fluid Dynamics -> Thermodynamics
  { fromTopicId: 23, toTopicId: 24, connectionType: "prerequisite", strength: 3 }, // Thermodynamics -> Statistical Mechanics
  { fromTopicId: 16, toTopicId: 48, connectionType: "prerequisite", strength: 2 }, // Electromagnetism -> Circuit Analysis
  // Chemistry & Biology
  { fromTopicId: 18, toTopicId: 19, connectionType: "prerequisite", strength: 3 }, // General Chemistry -> Organic Chemistry
  { fromTopicId: 18, toTopicId: 25, connectionType: "prerequisite", strength: 2 }, // General Chemistry -> Cell Biology
  { fromTopicId: 19, toTopicId: 26, connectionType: "prerequisite", strength: 2 }, // Organic Chemistry -> Genetics & Heredity
  { fromTopicId: 25, toTopicId: 26, connectionType: "prerequisite", strength: 2 }, // Cell Biology -> Genetics & Heredity
  { fromTopicId: 26, toTopicId: 28, connectionType: "prerequisite", strength: 2 }, // Genetics -> Evolutionary Biology
  { fromTopicId: 26, toTopicId: 64, connectionType: "prerequisite", strength: 3 }, // Genetics -> CRISPR & Gene Editing
  { fromTopicId: 26, toTopicId: 65, connectionType: "prerequisite", strength: 2 }, // Genetics -> Bioinformatics
  // Computer Science
  { fromTopicId: 3, toTopicId: 7, connectionType: "prerequisite", strength: 3 },   // Data Structures -> Algorithms
  { fromTopicId: 7, toTopicId: 6, connectionType: "prerequisite", strength: 2 },   // Algorithms -> Graph Theory
  { fromTopicId: 53, toTopicId: 52, connectionType: "prerequisite", strength: 2 }, // Databases -> Node.js & Backend APIs
  // AI progression
  { fromTopicId: 1, toTopicId: 56, connectionType: "prerequisite", strength: 3 },  // Machine Learning -> Deep Learning
  { fromTopicId: 56, toTopicId: 58, connectionType: "prerequisite", strength: 2 }, // Deep Learning -> Computer Vision
  { fromTopicId: 56, toTopicId: 59, connectionType: "prerequisite", strength: 2 }, // Deep Learning -> NLP
  { fromTopicId: 56, toTopicId: 57, connectionType: "prerequisite", strength: 2 }, // Deep Learning -> Reinforcement Learning
  // Economics
  { fromTopicId: 34, toTopicId: 35, connectionType: "prerequisite", strength: 3 }, // Microeconomics -> Macroeconomics
  { fromTopicId: 34, toTopicId: 69, connectionType: "prerequisite", strength: 2 }, // Microeconomics -> Game Theory
  { fromTopicId: 35, toTopicId: 36, connectionType: "prerequisite", strength: 2 }, // Macroeconomics -> Behavioral Economics
  // Philosophy
  { fromTopicId: 32, toTopicId: 31, connectionType: "prerequisite", strength: 2 }, // Logic & Reasoning -> Ethics & Moral Philosophy
  { fromTopicId: 31, toTopicId: 33, connectionType: "prerequisite", strength: 2 }, // Ethics -> Epistemology
  // Linguistics
  { fromTopicId: 37, toTopicId: 38, connectionType: "prerequisite", strength: 3 }, // Syntax & Grammar -> Semantics & Pragmatics
  { fromTopicId: 38, toTopicId: 39, connectionType: "prerequisite", strength: 3 }, // Semantics -> Computational Linguistics
  // History
  { fromTopicId: 40, toTopicId: 41, connectionType: "prerequisite", strength: 2 }, // Ancient Civilizations -> Modern History
  // Design
  { fromTopicId: 42, toTopicId: 43, connectionType: "prerequisite", strength: 2 }, // Color Theory -> Typography & Layout
  { fromTopicId: 43, toTopicId: 44, connectionType: "prerequisite", strength: 2 }, // Typography -> UI/UX Design Principles
  // Engineering
  { fromTopicId: 48, toTopicId: 49, connectionType: "prerequisite", strength: 2 }, // Circuit Analysis -> Signal Processing
  { fromTopicId: 48, toTopicId: 50, connectionType: "prerequisite", strength: 2 }, // Circuit Analysis -> Control Systems
  // Web Development
  { fromTopicId: 51, toTopicId: 52, connectionType: "prerequisite", strength: 2 }, // React -> Node.js & Backend APIs
  { fromTopicId: 52, toTopicId: 53, connectionType: "prerequisite", strength: 2 }, // Node.js -> Databases & SQL
  // Security
  { fromTopicId: 54, toTopicId: 55, connectionType: "prerequisite", strength: 3 }, // Cryptography -> Network Security
  // Astronomy
  { fromTopicId: 62, toTopicId: 61, connectionType: "prerequisite", strength: 2 }, // Stellar Evolution -> Astrobiology
  { fromTopicId: 61, toTopicId: 63, connectionType: "prerequisite", strength: 2 }, // Astrobiology -> Cosmology
  // Earth Science
  { fromTopicId: 30, toTopicId: 29, connectionType: "prerequisite", strength: 2 }, // Geology & Plate Tectonics -> Climate Science
  // Related (weaker connections)
  { fromTopicId: 4, toTopicId: 24, connectionType: "related", strength: 1 },      // Quantum Mechanics -> Statistical Mechanics
  { fromTopicId: 14, toTopicId: 62, connectionType: "related", strength: 1 },     // Optics & Light -> Stellar Evolution
  { fromTopicId: 20, toTopicId: 17, connectionType: "related", strength: 1 },     // Music Theory -> Waves & Frequencies
  { fromTopicId: 45, toTopicId: 46, connectionType: "related", strength: 1 },     // Human Physiology -> Immunology
  { fromTopicId: 47, toTopicId: 45, connectionType: "related", strength: 1 },     // Nutrition & Metabolism -> Human Physiology
  { fromTopicId: 66, toTopicId: 16, connectionType: "related", strength: 1 },     // Renewable Energy -> Electromagnetism
  { fromTopicId: 9, toTopicId: 10, connectionType: "related", strength: 1 },      // Hugging Face -> Gradio
  { fromTopicId: 11, toTopicId: 9, connectionType: "related", strength: 1 },      // Benefits of Open Source -> Hugging Face
];
