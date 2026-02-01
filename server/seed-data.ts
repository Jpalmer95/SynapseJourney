export const DEFAULT_CATEGORIES = [
  { id: 1, name: "Artificial Intelligence", color: "purple", icon: "Brain" },
  { id: 2, name: "Mathematics", color: "blue", icon: "Calculator" },
  { id: 3, name: "Computer Science", color: "green", icon: "Code" },
  { id: 4, name: "Science", color: "orange", icon: "Beaker" },
  { id: 5, name: "Physics", color: "yellow", icon: "Atom" },
  { id: 6, name: "Chemistry", color: "teal", icon: "FlaskConical" },
  { id: 7, name: "Music", color: "pink", icon: "Music" },
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
  { pathwayId: 1, topicId: 4, order: 6, isRequired: false }, // Quantum Mechanics (advanced)
  
  // Engineering Pathway (id: 2) - applied physics + CS
  { pathwayId: 2, topicId: 12, order: 1, isRequired: true }, // Classical Mechanics
  { pathwayId: 2, topicId: 15, order: 2, isRequired: true }, // Fluid Dynamics
  { pathwayId: 2, topicId: 16, order: 3, isRequired: true }, // Electromagnetism
  { pathwayId: 2, topicId: 3, order: 4, isRequired: true }, // Data Structures
  { pathwayId: 2, topicId: 7, order: 5, isRequired: true }, // Algorithms
  
  // Astrophysics Pathway (id: 3) - space-related physics
  { pathwayId: 3, topicId: 12, order: 1, isRequired: true }, // Classical Mechanics
  { pathwayId: 3, topicId: 13, order: 2, isRequired: true }, // Orbital Mechanics
  { pathwayId: 3, topicId: 14, order: 3, isRequired: true }, // Optics & Light
  { pathwayId: 3, topicId: 4, order: 4, isRequired: true }, // Quantum Mechanics
  
  // Computer Science Pathway (id: 4)
  { pathwayId: 4, topicId: 3, order: 1, isRequired: true }, // Data Structures
  { pathwayId: 4, topicId: 7, order: 2, isRequired: true }, // Algorithms
  { pathwayId: 4, topicId: 6, order: 3, isRequired: true }, // Graph Theory
  { pathwayId: 4, topicId: 11, order: 4, isRequired: false }, // Benefits of Open Source
  
  // Artificial Intelligence Pathway (id: 5)
  { pathwayId: 5, topicId: 1, order: 1, isRequired: true }, // Machine Learning
  { pathwayId: 5, topicId: 8, order: 2, isRequired: true }, // Neural Networks
  { pathwayId: 5, topicId: 2, order: 3, isRequired: true }, // Linear Algebra
  { pathwayId: 5, topicId: 9, order: 4, isRequired: true }, // Hugging Face
  { pathwayId: 5, topicId: 10, order: 5, isRequired: false }, // Gradio
  
  // Mathematics Pathway (id: 6)
  { pathwayId: 6, topicId: 2, order: 1, isRequired: true }, // Linear Algebra
  { pathwayId: 6, topicId: 5, order: 2, isRequired: true }, // Calculus
  { pathwayId: 6, topicId: 6, order: 3, isRequired: true }, // Graph Theory
  
  // Chemistry Pathway (id: 7)
  { pathwayId: 7, topicId: 18, order: 1, isRequired: true }, // General Chemistry
  { pathwayId: 7, topicId: 19, order: 2, isRequired: true }, // Organic Chemistry
  
  // Biology Pathway (id: 8) - chemistry foundation
  { pathwayId: 8, topicId: 18, order: 1, isRequired: true }, // General Chemistry
  { pathwayId: 8, topicId: 19, order: 2, isRequired: true }, // Organic Chemistry
  
  // Music Theory Pathway (id: 9)
  { pathwayId: 9, topicId: 20, order: 1, isRequired: true }, // Music Theory
  { pathwayId: 9, topicId: 17, order: 2, isRequired: false }, // Waves & Frequencies (physics of sound)
  
  // Open Source Contributing Pathway (id: 10)
  { pathwayId: 10, topicId: 11, order: 1, isRequired: true }, // Benefits of Open Source
  { pathwayId: 10, topicId: 9, order: 2, isRequired: true }, // Hugging Face
  { pathwayId: 10, topicId: 10, order: 3, isRequired: true }, // Gradio
  { pathwayId: 10, topicId: 3, order: 4, isRequired: false }, // Data Structures
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
];
