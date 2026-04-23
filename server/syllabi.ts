/**
 * SynapseJourney — Pre-Planned Syllabi
 * ─────────────────────────────────────
 * Every topic on the platform has a structured syllabus with explicit unit titles,
 * learning objectives, and tier mappings. Dense subjects (physics, math, fluid dynamics,
 * thermodynamics, etc.) receive 5-6 units per tier with formula-heavy, theory-heavy
 * guidance. Practical topics (libraries, tools) receive 3-4 units per tier with
 * code-heavy guidance.
 *
 * These syllabi feed directly into generateLessonOutline() and generateBatchLessonContent()
 * so the AI produces deeply structured, non-duplicative content for each unit.
 */

export interface SyllabusUnit {
  tier: "beginner" | "intermediate" | "advanced" | "next_gen";
  position: number; // 1-based within tier
  title: string;
  objective: string;
  keyConcepts: string[];
  estimatedMinutes: number;
}

export interface TopicSyllabus {
  topicId: number;
  topicTitle: string;
  contentType: "theory_heavy" | "formula_heavy" | "code_heavy" | "visual_heavy" | "concept_heavy";
  units: SyllabusUnit[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper to build a syllabus quickly
// ─────────────────────────────────────────────────────────────────────────────
function s(
  tier: SyllabusUnit["tier"],
  position: number,
  title: string,
  objective: string,
  keyConcepts: string[],
  estimatedMinutes = 20,
): SyllabusUnit {
  return { tier, position, title, objective, keyConcepts, estimatedMinutes };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1 — Machine Learning
// ─────────────────────────────────────────────────────────────────────────────
const syllabusML: TopicSyllabus = {
  topicId: 1,
  topicTitle: "Machine Learning",
  contentType: "code_heavy",
  units: [
    s("beginner", 1, "What is Machine Learning?", "Distinguish ML from traditional programming and understand the three paradigms: supervised, unsupervised, and reinforcement learning.", [" supervised vs unsupervised vs RL", "features and labels", "training / validation / test split"]),
    s("beginner", 2, "Your First Model: k-Nearest Neighbors", "Build an intuition for similarity-based prediction without any gradient math.", ["distance metrics (Euclidean, Manhattan)", "choosing k", "curse of dimensionality intuition"]),
    s("beginner", 3, "Evaluating Models", "Learn why accuracy alone is dangerous and how precision, recall, F1, and ROC-AUC paint a fuller picture.", ["confusion matrix", "precision / recall trade-off", "overfitting vs underfitting intuition"]),
    s("intermediate", 1, "Linear Regression & Gradient Descent", "Fit lines to data using calculus-derived optimization and understand the role of the learning rate.", ["ordinary least squares", "gradient descent update rule", "learning rate decay", "MSE vs MAE"]),
    s("intermediate", 2, "Logistic Regression & Classification", "Extend linear models to probabilities with the sigmoid and cross-entropy loss.", ["sigmoid function", "log-odds", "cross-entropy loss", "multiclass softmax"]),
    s("intermediate", 3, "Decision Trees & Ensemble Methods", "Build interpretable models and combine them into powerful random forests.", ["Gini impurity / entropy", "pruning", "bagging", "random forest", "feature importance"]),
    s("intermediate", 4, "Support Vector Machines", "Find optimal separating hyperplanes and harness the kernel trick for non-linear boundaries.", ["margin maximization", "slack variables", "kernel trick (RBF, polynomial)", "support vectors"]),
    s("advanced", 1, "Gradient Boosting & XGBoost", "Understand sequential error correction and the modern implementation details of gradient boosting.", ["additive models", "shrinkage / learning rate", "XGBoost regularization", "early stopping"]),
    s("advanced", 2, "Dimensionality Reduction", "Compress high-dimensional data while preserving structure via PCA and manifold learning.", ["eigenvectors / eigenvalues", "PCA variance explained", "t-SNE", "UMAP intuition"]),
    s("advanced", 3, "ML Pipelines & Production", "Move from notebook experiments to reproducible training, versioning, and monitoring.", ["feature stores", "model versioning", "data drift detection", "A/B testing models"]),
    s("next_gen", 1, "Open Science in ML", "Critically examine benchmark gaming, reproducibility crises, and how to publish negative results that advance the field.", ["benchmark saturation", "publication bias", "pre-registration", "dataset documentation (Datasheets)"]),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 2 — Linear Algebra
// ─────────────────────────────────────────────────────────────────────────────
const syllabusLinAlg: TopicSyllabus = {
  topicId: 2,
  topicTitle: "Linear Algebra",
  contentType: "formula_heavy",
  units: [
    s("beginner", 1, "Vectors & Vector Spaces", "Represent quantities with magnitude and direction; understand closure under addition and scalar multiplication.", ["vector addition / scalar multiplication", "span", "linear independence intuition", "R^n spaces"]),
    s("beginner", 2, "Matrices as Transformations", "See matrices as machines that stretch, rotate, and project space.", ["matrix-vector multiplication", "identity matrix", "diagonal matrices", "geometric interpretation"]),
    s("beginner", 3, "Systems of Linear Equations", "Solve Ax = b using elimination and interpret the solution geometrically.", ["row reduction (Gaussian elimination)", "pivot positions", "consistency", "parametric solutions"]),
    s("intermediate", 1, "Determinants & Inverses", "Quantify how a transformation scales volume and when it is reversible.", ["det(A) geometric meaning", "cofactor expansion", "matrix inverse formula", "singular matrices"]),
    s("intermediate", 2, "Eigenvalues & Eigenvectors", "Find the special directions that a transformation only stretches, not rotates.", ["characteristic polynomial", "eigenspace", "algebraic vs geometric multiplicity", "spectral theorem preview"]),
    s("intermediate", 3, "Orthogonality & Projections", "Decompose vectors onto orthogonal bases and solve least-squares problems.", ["dot product / orthogonality", "Gram-Schmidt process", "QR decomposition", "least squares projection"]),
    s("advanced", 1, "Singular Value Decomposition", "Factor any matrix into rotations and scalings — the Swiss Army knife of numerical linear algebra.", ["U, Σ, V^T interpretation", "low-rank approximation", "principal components link", "pseudoinverse"]),
    s("advanced", 2, "Positive Definite Matrices & Quadratic Forms", "Classify surfaces and optimize functions using matrix definiteness.", ["positive / negative / semi-definite", "Cholesky decomposition", "quadratic form optimization", "Hessian connection"]),
    s("next_gen", 1, "Open Problems in Numerical Linear Algebra", "Explore communication-avoiding algorithms, randomized methods, and the search for matrix multiplication lower bounds.", ["Strassen's algorithm", "communication lower bounds", "randomized SVD", "tensor rank"]),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 3 — Data Structures
// ─────────────────────────────────────────────────────────────────────────────
const syllabusDS: TopicSyllabus = {
  topicId: 3,
  topicTitle: "Data Structures",
  contentType: "code_heavy",
  units: [
    s("beginner", 1, "Arrays, Lists & Strings", "Store sequential data and understand memory layout, resizing, and basic operations.", ["contiguous vs linked memory", "dynamic arrays (amortized analysis)", "string immutability", "slice / splice"]),
    s("beginner", 2, "Stacks & Queues", "Enforce LIFO and FIFO discipline for undo systems, BFS, and scheduling.", ["stack operations", "queue operations", "deque", "circular buffer"]),
    s("beginner", 3, "Hash Tables", "Achieve O(1) average lookup by mapping keys to indices with hash functions.", ["hash functions", "collision resolution (chaining / open addressing)", "load factor", "rehashing"]),
    s("intermediate", 1, "Trees & Binary Search Trees", "Build hierarchical structures that enable fast search, insertion, and deletion.", ["tree terminology", "BST invariants", "insert / delete / search", "tree traversal orders"]),
    s("intermediate", 2, "Balanced Trees: AVL & Red-Black", "Guarantee O(log n) height regardless of insertion order.", ["AVL rotations", "red-black coloring invariants", "amortized rebalancing cost", "B-tree preview"]),
    s("intermediate", 3, "Heaps & Priority Queues", "Maintain a partial order for efficient access to the minimum or maximum element.", ["binary heap", "heapify", "heap sort", "Fibonacci heap intuition"]),
    s("intermediate", 4, "Graph Representations", "Store adjacency information for networks using matrices, lists, and edge sets.", ["adjacency matrix", "adjacency list", "edge list", "space/time trade-offs"]),
    s("advanced", 1, "Advanced Trees: Tries & Segment Trees", "Support prefix searching and range queries with specialized tree structures.", ["trie insertion / search", "segment tree build / query / update", "lazy propagation", "Fenwick tree (BIT)"]),
    s("advanced", 2, "Disjoint Set Union (Union-Find)", "Track connected components with near-constant time union and find operations.", ["path compression", "union by rank / size", "offline connectivity", "Kruskal's algorithm link"]),
    s("next_gen", 1, "Cache-Oblivious & Succinct Data Structures", "Design structures that perform well at every level of the memory hierarchy using minimal bits.", ["cache-oblivious model", "van Emde Boas layout", "succinct trees", "rank / select operations"]),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 4 — Quantum Mechanics
// ─────────────────────────────────────────────────────────────────────────────
const syllabusQM: TopicSyllabus = {
  topicId: 4,
  topicTitle: "Quantum Mechanics",
  contentType: "theory_heavy",
  units: [
    s("beginner", 1, "The Ultraviolet Catastrophe & Planck's Quantum", "Discover why classical physics failed to explain blackbody radiation and how quantization saved it.", ["blackbody radiation curve", "Planck's postulate E = hν", "ultraviolet catastrophe", "experimental motivation"]),
    s("beginner", 2, "Wave-Particle Duality", "Understand how light and matter exhibit both wave and particle properties depending on observation.", ["photoelectric effect", "de Broglie wavelength λ = h/p", "double-slit experiment", "complementarity principle"]),
    s("beginner", 3, "The Schrödinger Equation", "Meet the central equation of non-relativistic quantum mechanics and its probabilistic interpretation.", ["time-dependent vs time-independent SE", "wavefunction ψ", "probability density |ψ|²", "normalization"]),
    s("intermediate", 1, "Operators & Observables", "Learn that every measurable quantity corresponds to a Hermitian operator acting on the wavefunction.", ["Hermitian operators", "eigenvalues as measurement outcomes", "commutators [A,B]", "uncertainty principle derivation"]),
    s("intermediate", 2, "The Infinite Square Well", "Solve the simplest confined quantum system and discover quantized energy levels.", ["boundary conditions", "energy eigenvalues E_n", "stationary states", "zero-point energy"]),
    s("intermediate", 3, "The Quantum Harmonic Oscillator", "Model particles near equilibrium using ladder operators and equally spaced energy levels.", ["raising / lowering operators a†, a", "energy spectrum E_n = ℏω(n+½)", "wavefunctions via Hermite polynomials", "zero-point energy ℏω/2"]),
    s("intermediate", 4, "Angular Momentum & Spin", "Quantize rotational motion and discover the intrinsic angular momentum of particles.", ["orbital angular momentum operators", "eigenvalues of L² and L_z", "spin-½ matrices (Pauli)", "total angular momentum J"]),
    s("advanced", 1, "The Hydrogen Atom", "Solve the two-body Coulomb problem exactly and derive the spectrum that underlies chemistry.", ["separation of variables (r,θ,φ)", "radial equation & Laguerre polynomials", "energy levels E_n ∝ -1/n²", "degeneracy counting"]),
    s("advanced", 2, "Approximation Methods", "Tackle problems without exact solutions using perturbation theory and variational principles.", ["time-independent perturbation theory", "variational principle / Ritz method", "WKB approximation", "Fermi's Golden Rule"]),
    s("advanced", 3, "Quantum Entanglement & Bell's Theorem", "Explore non-local correlations and why hidden-variable theories cannot reproduce quantum predictions.", ["EPR paradox", "Bell inequalities", "CHSH inequality", "loophole-free experiments"]),
    s("next_gen", 1, "Open Questions in Quantum Foundations", "Debate interpretations (Copenhagen, Many-Worlds, QBism) and identify experimentally testable distinctions.", ["measurement problem", "decoherence", "interpretations comparison", "quantum Darwinism"]),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 5 — Calculus
// ─────────────────────────────────────────────────────────────────────────────
const syllabusCalc: TopicSyllabus = {
  topicId: 5,
  topicTitle: "Calculus",
  contentType: "formula_heavy",
  units: [
    s("beginner", 1, "Limits & Continuity", "Formalize the idea of approaching a value and understand when functions behave smoothly.", ["ε-δ definition", "one-sided limits", "continuity conditions", "intermediate value theorem"]),
    s("beginner", 2, "Derivatives & Rates of Change", "Compute instantaneous rates of change and interpret them geometrically as slopes.", ["limit definition of derivative", "power / product / quotient / chain rules", "higher-order derivatives", "implicit differentiation"]),
    s("beginner", 3, "Applications of Derivatives", "Use calculus to optimize, approximate, and understand function behavior.", ["critical points", "first / second derivative tests", "optimization word problems", "linear approximation"]),
    s("intermediate", 1, "Integrals & The Fundamental Theorem", "Connect antiderivatives to signed area and learn techniques of integration.", ["Riemann sums", "FTC Part I & II", "substitution rule", "integration by parts"]),
    s("intermediate", 2, "Applications of Integration", "Compute volumes, arc lengths, centroids, and physical quantities using definite integrals.", ["disk / washer / shell methods", "arc length formula", "work & fluid pressure", "probability densities"]),
    s("intermediate", 3, "Sequences & Series", "Determine when infinite sums converge and approximate functions with power series.", ["convergence tests (comparison, ratio, root)", "Taylor & Maclaurin series", "radius of convergence", "error bounds"]),
    s("advanced", 1, "Multivariable Functions & Partial Derivatives", "Extend calculus to surfaces and understand directional rates of change.", ["partial derivatives", "gradient vector ∇f", "directional derivative", "tangent planes"]),
    s("advanced", 2, "Multiple Integrals", "Integrate over regions in 2D and 3D using polar, cylindrical, and spherical coordinates.", ["double integrals (Fubini)", "triple integrals", "Jacobian determinants", "change of variables"]),
    s("advanced", 3, "Vector Calculus: Divergence, Curl, & Stokes' Theorem", "Generalize the fundamental theorem to higher dimensions and understand flow fields.", ["line integrals", "Green's theorem", "divergence theorem", "Stokes' theorem", "curl & divergence physical meaning"]),
    s("next_gen", 1, "Open Problems in Analysis", "Explore the Riemann hypothesis connection, fractional calculus, and non-standard analysis.", ["fractional derivatives", "non-standard analysis (infinitesimals)", "distribution theory", "renormalization analogies"]),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 6 — Graph Theory
// ─────────────────────────────────────────────────────────────────────────────
const syllabusGraph: TopicSyllabus = {
  topicId: 6,
  topicTitle: "Graph Theory",
  contentType: "theory_heavy",
  units: [
    s("beginner", 1, "Graphs, Vertices & Edges", "Model pairwise relationships with directed and undirected graphs.", ["adjacency / incidence", "degree (in-degree / out-degree)", "paths & cycles", "graph isomorphism intuition"]),
    s("beginner", 2, "Connectivity & Components", "Determine when a graph is connected and find its connected pieces.", ["connected components", "strong vs weak connectivity (digraphs)", "bridges & articulation points", "biconnected components"]),
    s("beginner", 3, "Special Graph Families", "Recognize trees, complete graphs, bipartite graphs, and planar graphs.", ["trees (acyclic + connected)", "complete graphs K_n", "bipartite graphs & matchings", "planar graphs & Euler's formula"]),
    s("intermediate", 1, "Graph Traversals: BFS & DFS", "Systematically visit every vertex and solve reachability problems.", ["BFS queue mechanics", "DFS stack / recursion", "topological sort (DFS)", "bipartite checking (BFS)"]),
    s("intermediate", 2, "Shortest Path Algorithms", "Find optimal routes in weighted graphs using Dijkstra and Bellman-Ford.", ["Dijkstra's algorithm (greedy)", "Bellman-Ford (negative edges)", "Floyd-Warshall (all-pairs)", "A* heuristic search"]),
    s("intermediate", 3, "Minimum Spanning Trees", "Connect all vertices at minimum total edge weight.", ["Kruskal's algorithm (union-find)", "Prim's algorithm (priority queue)", "cut property", "Borůvka's algorithm"]),
    s("intermediate", 4, "Network Flow", "Model capacity-constrained networks and find maximum throughput.", ["Ford-Fulkerson method", "Edmonds-Karp (BFS augmentation)", "max-flow min-cut theorem", "bipartite matching reduction"]),
    s("advanced", 1, "Graph Coloring & Cliques", "Assign colors so no adjacent vertices share one, and find tightly-knit subgroups.", ["chromatic number", "greedy coloring bounds", "clique number", "Mycielski construction"]),
    s("advanced", 2, "Random Graphs & Extremal Graph Theory", "Study graphs generated by probabilistic rules and the limits of graph parameters.", ["Erdős–Rényi model G(n,p)", "threshold functions", "Ramsey numbers", "Turán's theorem"]),
    s("next_gen", 1, "Graphs in Modern Research", "Survey graph neural networks, expander graphs, and the graph isomorphism problem.", ["GNN message passing", "expander graphs & applications", "Babai's quasi-polynomial GI algorithm", "topological data analysis"]),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 7 — Algorithms
// ─────────────────────────────────────────────────────────────────────────────
const syllabusAlgo: TopicSyllabus = {
  topicId: 7,
  topicTitle: "Algorithms",
  contentType: "code_heavy",
  units: [
    s("beginner", 1, "Algorithm Analysis & Big-O", "Measure running time and space usage as functions of input size.", ["time complexity", "space complexity", "asymptotic notation (O, Ω, Θ)", "best / average / worst case"]),
    s("beginner", 2, "Sorting Fundamentals", "Order data efficiently and understand when each algorithm shines.", ["insertion / selection / bubble sort", "merge sort (divide & conquer)", "quick sort (partitioning)", "stability & in-place properties"]),
    s("beginner", 3, "Searching & Binary Search", "Find elements in sorted collections in logarithmic time.", ["linear search", "binary search (iterative & recursive)", "lower / upper bound", "binary search on answer"]),
    s("intermediate", 1, "Divide & Conquer", "Break problems into independent subproblems, solve recursively, and combine results.", ["master theorem", "merge sort analysis", "closest pair of points", "karatsuba multiplication"]),
    s("intermediate", 2, "Dynamic Programming", "Solve overlapping subproblems by memoizing optimal substructure.", ["top-down memoization", "bottom-up tabulation", "state transition", "reconstructing solutions"]),
    s("intermediate", 3, "Greedy Algorithms", "Make locally optimal choices and prove when they yield global optima.", ["activity selection", "Huffman coding", "exchange arguments", "matroids"]),
    s("intermediate", 4, "Backtracking & Branch-and-Bound", "Explore solution spaces systematically and prune unpromising branches.", ["state space tree", "N-queens", "subset sum", "branch-and-bound vs brute force"]),
    s("advanced", 1, "String Algorithms", "Search patterns and analyze text efficiently.", ["KMP failure function", "Rabin-Karp rolling hash", "suffix arrays", "Z-algorithm"]),
    s("advanced", 2, "Computational Geometry", "Solve geometric problems with sweep lines and convex hulls.", ["convex hull (Graham scan, monotone chain)", "line sweep", "point-in-polygon", "Voronoi diagram intuition"]),
    s("advanced", 3, "NP-Completeness & Intractability", "Classify problems by difficulty and understand the P vs NP question.", ["polynomial-time reductions", "SAT / 3-SAT", "NP-hard vs NP-complete", "approximation algorithms"]),
    s("next_gen", 1, "Quantum & Approximation Frontiers", "Survey Shor's algorithm, quantum supremacy claims, and the limits of approximation.", ["Shor's factoring", "quantum Fourier transform", "PTAS / FPTAS", "unique games conjecture"]),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 8 — Neural Networks
// ─────────────────────────────────────────────────────────────────────────────
const syllabusNN: TopicSyllabus = {
  topicId: 8,
  topicTitle: "Neural Networks",
  contentType: "code_heavy",
  units: [
    s("beginner", 1, "The Biological Neuron & Perceptron", "Draw inspiration from neuroscience and build the simplest trainable unit.", ["biological neuron structure", "perceptron model", "activation function (step)", "linear separability"]),
    s("beginner", 2, "Multi-Layer Perceptrons", "Stack perceptrons into hidden layers to learn non-linear decision boundaries.", ["forward pass", "hidden layers", "universal approximation theorem (intuition)", "XOR problem solution"]),
    s("beginner", 3, "Activation Functions", "Introduce non-linearity and understand why ReLU dominates modern deep learning.", ["sigmoid & tanh (pros/cons)", "ReLU & leaky ReLU", "softmax for classification", "dead neurons"]),
    s("intermediate", 1, "Backpropagation", "Compute gradients efficiently using the chain rule applied to computation graphs.", ["chain rule", "local gradients", "weight update rule", "computational graph visualization"]),
    s("intermediate", 2, "Optimization & Regularization", "Train faster and generalize better with modern optimizers and regularization.", ["SGD with momentum", "Adam / AdamW", "L1 / L2 regularization", "dropout", "batch normalization"]),
    s("intermediate", 3, "Convolutional Neural Networks", "Exploit spatial structure in images with shared-weight filters.", ["convolution operation", "padding & stride", "pooling layers", "CNN architectures (LeNet → ResNet)"]),
    s("intermediate", 4, "Recurrent Neural Networks", "Process sequences by maintaining hidden state across time steps.", ["vanilla RNN equations", "LSTM gates (forget, input, output)", "GRU simplification", "bidirectional RNNs"]),
    s("advanced", 1, "Transformers & Self-Attention", "Replace recurrence with attention mechanisms that scale to massive datasets.", ["self-attention mechanism", "multi-head attention", "positional encoding", "transformer block"]),
    s("advanced", 2, "Generative Models", "Learn probability distributions to synthesize new data.", ["VAE (encoder/decoder)", "GAN generator & discriminator", "mode collapse", "diffusion models intuition"]),
    s("advanced", 3, "Neural Architecture Search & Efficiency", "Automate network design and compress models for edge deployment.", ["NAS methods (RL, differentiable)", "pruning", "quantization", "knowledge distillation"]),
    s("next_gen", 1, "Toward Biological Plausibility", "Compare backpropagation to brain learning and survey neuromorphic computing.", ["backpropagation critique (Lillicrap)", "spiking neural networks", "neuromorphic hardware", "predictive coding"]),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 9 — Hugging Face
// ─────────────────────────────────────────────────────────────────────────────
const syllabusHF: TopicSyllabus = {
  topicId: 9,
  topicTitle: "Hugging Face",
  contentType: "code_heavy",
  units: [
    s("beginner", 1, "The Hugging Face Ecosystem", "Navigate the Hub, Models, Datasets, and Spaces and understand how they interrelate.", ["Hub repositories", "Model Cards", "Dataset Cards", "Spaces (Gradio/Streamlit)"]),
    s("beginner", 2, "Transformers Pipeline API", "Run inference on state-of-the-art models in three lines of code.", ["pipeline() function", "task selection", "model auto-loading", "device placement"]),
    s("beginner", 3, "Tokenization", "Convert text to model-ready inputs and understand subword algorithms.", ["wordpiece / BPE / unigram", "tokenizer.encode / decode", "special tokens", "padding & truncation"]),
    s("intermediate", 1, "Fine-Tuning with the Trainer API", "Adapt pretrained models to your own datasets with minimal boilerplate.", ["TrainingArguments", "dataset formatting", "evaluation strategy", "checkpointing"]),
    s("intermediate", 2, "The Tokenizers Library & Fast Preprocessing", "Build fast, customizable tokenizers and preprocess datasets efficiently.", ["Hugging Face Tokenizers", "batch encoding", "data collators", "map / filter / shuffle"]),
    s("intermediate", 3, "Model Hub & Versioning", "Publish, version, and discover models with Git LFS and model cards.", ["git-lfs for large files", "model card metadata", "model tags & search", "inference API"]),
    s("advanced", 1, "PEFT: LoRA & Adapters", "Fine-tune billion-parameter models on consumer GPUs by training tiny adapter matrices.", ["LoRA rank & alpha", "QLoRA (4-bit)", "adapter merging", "prefix tuning"]),
    s("advanced", 2, "Deploying Models with Inference Endpoints", "Serve models at scale with auto-scaling, GPU support, and private endpoints.", ["Inference Endpoints config", "custom handlers", "batching", "cost optimization"]),
    s("next_gen", 1, "Open Science on the Hub", "Evaluate model cards for missing documentation, reproducibility, and bias disclosures.", ["model card critique", "reproducibility checklists", "bias benchmarks", "community governance"]),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 10 — Gradio
// ─────────────────────────────────────────────────────────────────────────────
const syllabusGradio: TopicSyllabus = {
  topicId: 10,
  topicTitle: "Gradio",
  contentType: "code_heavy",
  units: [
    s("beginner", 1, "Your First Gradio App", "Build an interactive demo with inputs, outputs, and a launch command.", ["Interface class", "components (Textbox, Image, Audio)", "launch() parameters", "share links"]),
    s("beginner", 2, "Components & Layouts", "Arrange multiple inputs and outputs with rows, columns, tabs, and accordions.", ["Blocks API", "Row / Column / Tab", "conditional visibility", "state management"]),
    s("beginner", 3, "Event Listeners & Interactivity", "React to user actions with buttons, sliders, and live updates.", ["click / change / submit events", "gr.State", "streaming outputs", "queue() for concurrency"]),
    s("intermediate", 1, "Custom Components & Theming", "Style your app and extend Gradio with custom frontend components.", ["CSS theming", "custom component structure", "gradio cc dev", "packaging & distribution"]),
    s("intermediate", 2, "Integrating ML Models", "Load models from Hugging Face, PyTorch, or ONNX and wire them into Gradio interfaces.", ["pipeline integration", "GPU/CPU handling", "batch inference", "caching predictions"]),
    s("intermediate", 3, "Authentication & Security", "Protect demos with login, rate limiting, and input validation.", ["auth parameter", "file upload limits", "input sanitization", "HTTPS / SSL"]),
    s("advanced", 1, "Deploying to Hugging Face Spaces", "Publish persistent, scalable demos with CI/CD from GitHub.", ["Spaces hardware tiers", "Docker Spaces", "GitHub Actions integration", "secret management"]),
    s("next_gen", 1, "Accessibility & Inclusive Design for Demos", "Audit Gradio apps for screen-reader compatibility, color contrast, and multilingual support.", ["ARIA labels", "WCAG guidelines", "i18n / l10n", "user testing protocols"]),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 11 — Benefits of Open Source
// ─────────────────────────────────────────────────────────────────────────────
const syllabusOSS: TopicSyllabus = {
  topicId: 11,
  topicTitle: "Benefits of Open Source",
  contentType: "concept_heavy",
  units: [
    s("beginner", 1, "What is Open Source?", "Define open source software, its history, and the difference between free-as-in-beer and free-as-in-speech.", ["OSI definition", "FOSS vs OSS", "copyleft vs permissive", "history (GNU, Linux, Apache)"]),
    s("beginner", 2, "Community & Collaboration", "Understand how open source communities self-organize, communicate, and govern.", ["BDFL model", "meritocracy vs diversity", "Code of Conduct", "communication channels"]),
    s("beginner", 3, "Economic & Innovation Impact", "Quantify how open source accelerates startups, reduces costs, and drives standards.", ["total economic value studies", "startup acceleration", "standards adoption", "vendor independence"]),
    s("intermediate", 1, "Licensing Deep Dive", "Choose and comply with licenses correctly to avoid legal pitfalls.", ["MIT / BSD / Apache 2.0", "GPL v2 / v3 / AGPL", "license compatibility", "SPDX identifiers"]),
    s("intermediate", 2, "Sustainability Models", "Explore how projects survive financially: foundations, dual licensing, donations, and corporate backing.", ["non-profit foundations", "open core", "SaaS dual licensing", "GitHub Sponsors / Tidelift"]),
    s("intermediate", 3, "Security & Supply Chain", "Analyze Log4j, xz backdoor, and best practices for securing open source dependencies.", ["SBOMs", "vulnerability disclosure", "SLSA framework", "sigstore / cosign"]),
    s("advanced", 1, "Open Source in Science & Government", "Examine how open data, open hardware, and open standards transform research and policy.", ["open science movement", "FAIR principles", "government mandates", "reproducibility crisis link"]),
    s("next_gen", 1, "Pitching an Open Source Research Project", "Draft a proposal for an open science tool, dataset, or standard that addresses a real community gap.", ["problem statement", "community needs assessment", "governance model", "sustainability plan"]),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 12 — Classical Mechanics
// ─────────────────────────────────────────────────────────────────────────────
const syllabusClassMech: TopicSyllabus = {
  topicId: 12,
  topicTitle: "Classical Mechanics",
  contentType: "formula_heavy",
  units: [
    s("beginner", 1, "Kinematics: Describing Motion", "Quantify position, velocity, and acceleration without considering causes.", ["displacement vs distance", "average vs instantaneous velocity", "acceleration graphs", "equations of motion (constant a)"]),
    s("beginner", 2, "Newton's Laws of Motion", "Connect forces to changes in motion and analyze everyday situations.", ["inertia (1st law)", "F = ma (2nd law)", "action-reaction pairs (3rd law)", "free-body diagrams"]),
    s("beginner", 3, "Work, Energy & Power", "Discover scalar alternatives to vector analysis for solving motion problems.", ["work definition W = F·d·cosθ", "kinetic energy", "potential energy (gravitational, spring)", "conservation of mechanical energy", "power P = W/t"]),
    s("intermediate", 1, "Momentum & Collisions", "Analyze interactions where forces are impulsive or unknown using conserved quantities.", ["linear momentum p = mv", "impulse-momentum theorem", "elastic vs inelastic collisions", "center of mass"]),
    s("intermediate", 2, "Rotational Motion", "Extend Newton's laws to spinning objects and torques.", ["angular displacement / velocity / acceleration", "torque τ = r×F", "moment of inertia", "rotational kinetic energy", "angular momentum conservation"]),
    s("intermediate", 3, "Gravitation & Orbits", "Derive Kepler's laws from Newton's universal gravitation.", ["Newton's law of gravitation F = GmM/r²", "gravitational potential energy", "escape velocity", "Kepler's 3 laws derivation"]),
    s("advanced", 1, "Lagrangian Mechanics", "Reformulate mechanics using energy minimization and generalized coordinates.", ["principle of least action", "Euler-Lagrange equation", "generalized coordinates", "conservation laws from symmetries (Noether)"]),
    s("advanced", 2, "Hamiltonian Mechanics & Phase Space", "Describe systems using position and momentum as independent variables.", ["Hamilton's equations", "phase space trajectories", "Poisson brackets", "Liouville's theorem"]),
    s("advanced", 3, "Nonlinear Dynamics & Chaos", "Study systems where small changes produce wildly different outcomes.", ["phase portraits", "attractors", "Lyapunov exponent", "logistic map", "bifurcation diagrams"]),
    s("next_gen", 1, "Open Problems in Classical Mechanics", "Survey the three-body problem, granular materials, and active matter research.", ["three-body problem stability", "granular flow equations", "active matter (flocking)", "celestial mechanics missions"]),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 13 — Orbital Mechanics
// ─────────────────────────────────────────────────────────────────────────────
const syllabusOrbital: TopicSyllabus = {
  topicId: 13,
  topicTitle: "Orbital Mechanics",
  contentType: "formula_heavy",
  units: [
    s("beginner", 1, "The Two-Body Problem", "Reduce the motion of two gravitating bodies to a single particle in a central potential.", ["center of mass frame", "reduced mass μ", "conservation of energy & angular momentum", "effective potential"]),
    s("beginner", 2, "Conic Sections & Orbital Elements", "Classify orbits by shape and describe them with six Keplerian elements.", ["eccentricity e", "semi-major axis a", "inclination i", "RAAN Ω", "argument of periapsis ω", "true anomaly ν"]),
    s("beginner", 3, "Orbital Maneuvers: Hohmann & Bi-Elliptic", "Change orbits efficiently using impulsive burns.", ["delta-v budget", "Hohmann transfer (coplanar)", "bi-elliptic transfer", "plane change cost"]),
    s("intermediate", 1, "Patched Conics & Interplanetary Transfers", "Approximate spacecraft trajectories between spheres of influence.", ["sphere of influence (SOI)", "departure / arrival hyperbolas", "porkchop plots", "gravity assists"]),
    s("intermediate", 2, "Orbital Perturbations", "Account for Earth's oblateness, atmospheric drag, and solar radiation pressure.", ["J2 effect & nodal precession", "drag models", "solar radiation pressure", "third-body perturbations"]),
    s("intermediate", 3, "Lambert's Problem & Mission Design", "Given two position vectors and a time of flight, find the connecting orbit.", ["Lambert's theorem", "minimum energy transfer", "porkchop plot interpretation", "launch windows"]),
    s("advanced", 1, "Restricted Three-Body Problem", "Study motion near Lagrange points and halo orbits.", ["Jacobi integral", "Lagrange points L1-L5", "halo / Lissajous orbits", "stable / unstable manifolds"]),
    s("advanced", 2, "Low-Thrust Trajectories", "Optimize continuous propulsion trajectories using calculus of variations.", ["specific impulse & thrust", "Edelbaum's approximation", "spiral trajectories", "optimal control formulation"]),
    s("next_gen", 1, "Open Questions in Astrodynamics", "Propose research into cislunar logistics, debris remediation, or propellant depots.", ["cislunar architecture", "space debris modeling", "propellant depots", "interstellar precursor missions"]),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 14 — Optics & Light
// ─────────────────────────────────────────────────────────────────────────────
const syllabusOptics: TopicSyllabus = {
  topicId: 14,
  topicTitle: "Optics & Light",
  contentType: "theory_heavy",
  units: [
    s("beginner", 1, "The Nature of Light: Waves & Rays", "Understand light as an electromagnetic wave and when ray approximations suffice.", ["EM spectrum", "wave parameters (λ, f, c)", "ray approximation", "Huygens' principle"]),
    s("beginner", 2, "Reflection & Refraction", "Predict light paths at boundaries using the law of reflection and Snell's law.", ["law of reflection", "Snell's law n₁sinθ₁ = n₂sinθ₂", "index of refraction", "total internal reflection"]),
    s("beginner", 3, "Lenses & Image Formation", "Construct images using ray diagrams and the thin-lens equation.", ["converging vs diverging lenses", "focal length", "thin-lens equation 1/f = 1/do + 1/di", "magnification"]),
    s("intermediate", 1, "Wave Optics: Interference", "Analyze superposition of coherent waves to produce bright and dark fringes.", ["path difference", "Young's double slit", "thin-film interference", "Michelson interferometer"]),
    s("intermediate", 2, "Diffraction & Resolution", "Understand how wave bending limits the sharpness of images and sets fundamental resolution limits.", ["single-slit diffraction", "circular aperture (Airy disk)", "Rayleigh criterion", "diffraction gratings"]),
    s("intermediate", 3, "Polarization", "Describe the orientation of light's electric field and manipulate it with filters.", ["linear / circular / elliptical polarization", "Malus's law", "birefringence", "optical activity"]),
    s("advanced", 1, "Fourier Optics & Coherence", "Analyze imaging systems using spatial frequencies and understand temporal/spatial coherence.", ["Fourier transform in optics", "point spread function", "optical transfer function", "coherence length"]),
    s("advanced", 2, "Nonlinear Optics", "Study phenomena where the polarization depends nonlinearly on the electric field.", ["second-harmonic generation", "Kerr effect", "self-phase modulation", "solitons"]),
    s("next_gen", 1, "Quantum & Computational Optics", "Survey quantum imaging, metasurfaces, and lensless cameras.", ["quantum entanglement imaging", "metasurface optics", "computational imaging", "adaptive optics"]),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 15 — Fluid Dynamics
// ─────────────────────────────────────────────────────────────────────────────
const syllabusFluid: TopicSyllabus = {
  topicId: 15,
  topicTitle: "Fluid Dynamics",
  contentType: "theory_heavy",
  units: [
    s("beginner", 1, "Fluid Properties & Statics", "Define density, pressure, viscosity, and understand hydrostatic equilibrium.", ["density ρ & specific weight", "pressure P = F/A", "Pascal's principle", "Archimedes' principle", "manometers"]),
    s("beginner", 2, "Fluid Kinematics", "Describe fluid motion using streamlines, pathlines, and streaklines.", ["Lagrangian vs Eulerian description", "streamlines / pathlines / streaklines", "velocity field", "material derivative"]),
    s("beginner", 3, "The Continuity Equation", "Apply mass conservation to moving fluids and relate velocity to cross-sectional area.", ["mass flow rate", "volume flow rate Q = Av", "incompressible continuity A₁v₁ = A₂v₂", "divergence of velocity field"]),
    s("intermediate", 1, "Bernoulli's Equation & Applications", "Relate pressure, velocity, and elevation along a streamline for inviscid flow.", ["Bernoulli equation derivation", "venturi effect", "pitot tube", "siphon physics", "limitations (viscosity, compressibility)"]),
    s("intermediate", 2, "Viscous Flow & the Navier-Stokes Equation", "Introduce shear stress and the governing equations of viscous fluid motion.", ["Newton's law of viscosity τ = μ(du/dy)", "no-slip condition", "Navier-Stokes equations (incompressible)", "Reynolds number Re = ρvL/μ"]),
    s("intermediate", 3, "Laminar vs Turbulent Flow", "Classify flow regimes and understand the transition to turbulence.", ["critical Reynolds number", "laminar pipe flow (Hagen-Poiseuille)", "turbulent velocity profile", "energy dissipation in turbulence"]),
    s("intermediate", 4, "Boundary Layers", "Analyze the thin region near a solid surface where viscous effects dominate.", ["boundary layer thickness δ", "displacement & momentum thickness", "Blasius solution", "separation & adverse pressure gradient"]),
    s("advanced", 1, "Compressible Flow & Shock Waves", "Study flows where density changes significantly and shock waves form.", ["Mach number Ma = v/a", "isentropic relations", "normal shock relations", "oblique shocks", "Prandtl-Meyer expansion"]),
    s("advanced", 2, "Dimensional Analysis & Similarity", "Use Buckingham Pi theorem to scale experiments from wind tunnels to real aircraft.", ["Buckingham Pi theorem", "dimensionless numbers (Re, Ma, Fr, Eu, St)", "dynamic similarity", "model testing"]),
    s("advanced", 3, "Turbulence Modeling", "Approximate the effects of turbulent fluctuations using Reynolds-Averaged Navier-Stokes (RANS) and beyond.", ["Reynolds decomposition", "RANS equations", "turbulence closure problem", "k-ε & k-ω models", "LES & DNS overview"]),
    s("next_gen", 1, "Open Problems in Fluid Dynamics", "Propose research into drag reduction, microfluidics, or atmospheric/oceanic modeling.", ["turbulence closure", "drag reduction (riblets, superhydrophobic)", "microfluidics & lab-on-chip", "climate model resolution"]),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 16 — Electromagnetism
// ─────────────────────────────────────────────────────────────────────────────
const syllabusEM: TopicSyllabus = {
  topicId: 16,
  topicTitle: "Electromagnetism",
  contentType: "theory_heavy",
  units: [
    s("beginner", 1, "Electric Charge & Coulomb's Law", "Understand the fundamental force between charges and the concept of electric fields.", ["conservation of charge", "Coulomb's law F = kqQ/r²", "electric field E", "field lines"]),
    s("beginner", 2, "Gauss's Law", "Relate electric flux through closed surfaces to enclosed charge.", ["electric flux Φ_E", "Gauss's law ∮E·dA = Q_enc/ε₀", "spherical symmetry", "cylindrical symmetry", "infinite plane"]),
    s("beginner", 3, "Electric Potential & Capacitance", "Define potential energy per unit charge and storage in electric fields.", ["electric potential V", "potential difference", "capacitors C = Q/V", "energy stored U = ½CV²", "dielectrics"]),
    s("intermediate", 1, "Current, Resistance & Ohm's Law", "Model the flow of charge in conductors and circuits.", ["drift velocity", "current density J", "Ohm's law V = IR", "resistivity & conductivity", "power dissipation P = I²R"]),
    s("intermediate", 2, "Magnetic Fields & the Lorentz Force", "Describe forces on moving charges and current-carrying wires.", ["magnetic field B", "Lorentz force F = q(v×B)", "cyclotron motion", "Hall effect", "Biot-Savart law"]),
    s("intermediate", 3, "Ampère's Law & Faraday's Law", "Relate magnetic fields to currents and changing magnetic flux to induced EMF.", ["Ampère's law ∮B·dl = μ₀I_enc", "Faraday's law ε = -dΦ_B/dt", "Lenz's law", "self-inductance", "mutual inductance"]),
    s("intermediate", 4, "Maxwell's Equations", "Unify electricity and magnetism into four fundamental equations.", ["Gauss's law for E", "Gauss's law for B", "Faraday's law", "Ampère-Maxwell law", "electromagnetic waves derivation"]),
    s("advanced", 1, "Electromagnetic Waves", "Derive wave equations from Maxwell's equations and analyze their properties.", ["wave equation derivation", "E and B field relationship", "Poynting vector S", "radiation pressure", "spectrum"]),
    s("advanced", 2, "Electrodynamics & Potentials", "Solve for fields using scalar and vector potentials with gauge freedom.", ["scalar potential φ & vector potential A", "Lorenz gauge", "retarded potentials", "Liénard-Wiechert potentials"]),
    s("advanced", 3, "Relativity & Electromagnetism", "See how electric and magnetic fields transform into each other under Lorentz boosts.", ["four-current J^μ", "electromagnetic field tensor F^{μν}", "Lorentz force in covariant form", "relativistic invariants"]),
    s("next_gen", 1, "Open Frontiers in Electromagnetism", "Survey metamaterials, wireless power transfer, and quantum electrodynamics foundations.", ["metamaterials & negative index", "wireless power (inductive / resonant / beam)", "QED vacuum fluctuations", "plasmonics"]),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 17 — Waves & Frequencies
// ─────────────────────────────────────────────────────────────────────────────
const syllabusWaves: TopicSyllabus = {
  topicId: 17,
  topicTitle: "Waves & Frequencies",
  contentType: "theory_heavy",
  units: [
    s("beginner", 1, "Wave Fundamentals", "Describe oscillations and traveling waves with amplitude, wavelength, period, and frequency.", ["amplitude A", "wavelength λ", "period T & frequency f", "wave speed v = fλ", "transverse vs longitudinal"]),
    s("beginner", 2, "The Wave Equation", "Derive the equation governing wave propagation on a string and in general media.", ["wave equation derivation (string)", "general solution f(x±vt)", "linear superposition", "energy transport"]),
    s("beginner", 3, "Standing Waves & Resonance", "Analyze waves confined to boundaries and the frequencies at which systems naturally vibrate.", ["standing wave formation", "nodes & antinodes", "harmonics", "resonance & Q-factor"]),
    s("intermediate", 1, "Sound & Acoustics", "Study pressure waves in fluids and the perception of pitch, loudness, and timbre.", ["sound intensity & decibels", "Doppler effect", "shock waves (Mach cone)", "room acoustics (reverb, absorption)"]),
    s("intermediate", 2, "Fourier Analysis", "Decompose complex waves into sums of sinusoids and reconstruct signals from spectra.", ["Fourier series", "Fourier transform", "frequency spectrum", "sampling theorem (Nyquist)"]),
    s("intermediate", 3, "Interference & Diffraction", "Predict outcomes when waves overlap or bend around obstacles.", ["constructive / destructive interference", "beat frequency", "Huygens-Fresnel principle", "single / double slit"]),
    s("advanced", 1, "Dispersion & Group Velocity", "Distinguish phase velocity from signal velocity in dispersive media.", ["dispersion relation ω(k)", "phase velocity v_p = ω/k", "group velocity v_g = dω/dk", "wave packets"]),
    s("advanced", 2, "Nonlinear Waves & Solitons", "Explore waves in media where superposition fails and solitary waves maintain shape.", ["nonlinear Schrödinger equation", "Korteweg-de Vries equation", "soliton solutions", "optical solitons"]),
    s("next_gen", 1, "Wave Applications in Research", "Propose studies in gravitational wave astronomy, phononic crystals, or seismic imaging.", ["LIGO & gravitational waves", "phononic bandgaps", "seismic tomography", "medical ultrasound imaging"]),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 18 — General Chemistry
// ─────────────────────────────────────────────────────────────────────────────
const syllabusGenChem: TopicSyllabus = {
  topicId: 18,
  topicTitle: "General Chemistry",
  contentType: "theory_heavy",
  units: [
    s("beginner", 1, "Atoms, Elements & the Periodic Table", "Build a mental model of atomic structure and periodic trends.", ["subatomic particles", "atomic number & mass number", "isotopes", "periodic trends (radius, IE, EN)"]),
    s("beginner", 2, "Chemical Bonding", "Understand why atoms stick together through ionic, covalent, and metallic bonds.", ["octet rule", "ionic vs covalent", "Lewis structures", "VSEPR theory", "polarity"]),
    s("beginner", 3, "Stoichiometry", "Quantify reactants and products using balanced chemical equations.", ["moles & molar mass", "balancing equations", "limiting reactant", "percent yield", "concentration (M, molality)"]),
    s("intermediate", 1, "Gases & Gas Laws", "Model the behavior of gases under varying pressure, temperature, and volume.", ["Boyle's / Charles's / Avogadro's laws", "ideal gas law PV = nRT", "kinetic molecular theory", "real gases (van der Waals)"]),
    s("intermediate", 2, "Thermochemistry", "Track heat flow during chemical reactions and understand enthalpy.", ["enthalpy H", "endothermic vs exothermic", "Hess's law", "bond enthalpies", "calorimetry"]),
    s("intermediate", 3, "Chemical Equilibrium", "Predict the extent of reversible reactions using equilibrium constants.", ["Kc & Kp", "Le Chatelier's principle", "ICE tables", "reaction quotient Q", "temp dependence (van 't Hoff)"]),
    s("intermediate", 4, "Acids, Bases & pH", "Quantify acidity, understand buffer solutions, and calculate pH.", ["Arrhenius / Brønsted-Lowry / Lewis", "pH & pOH", "strong vs weak acids", "buffer equation (Henderson-Hasselbalch)", "titration curves"]),
    s("advanced", 1, "Electrochemistry", "Relate chemical energy to electrical potential in galvanic and electrolytic cells.", ["redox reactions", "galvanic cells", "standard reduction potentials", "Nernst equation", "electrolysis"]),
    s("advanced", 2, "Quantum Chemistry Basics", "Apply quantum mechanical models to atoms and simple molecules.", ["Bohr model", "quantum numbers", "orbital shapes", "electron configurations", "molecular orbital theory intro"]),
    s("next_gen", 1, "Open Science in Chemistry", "Evaluate open-access chemical databases, green chemistry metrics, and reproducibility in synthesis.", ["PubChem / ChemSpider", "green chemistry principles", "reproducibility in organic synthesis", "open lab notebooks"]),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 19 — Organic Chemistry
// ─────────────────────────────────────────────────────────────────────────────
const syllabusOrgChem: TopicSyllabus = {
  topicId: 19,
  topicTitle: "Organic Chemistry",
  contentType: "theory_heavy",
  units: [
    s("beginner", 1, "Structure & Nomenclature", "Name organic compounds using IUPAC rules and draw accurate structures.", ["hydrocarbon classes (alkane / alkene / alkyne / aromatic)", "IUPAC naming", "structural isomers", "stereochemistry intro (chirality)"]),
    s("beginner", 2, "Functional Groups", "Recognize the reactive moieties that define organic compound classes.", ["alcohols / ethers", "aldehydes / ketones", "carboxylic acids / esters / amides", "amines", "halides"]),
    s("beginner", 3, "Reaction Mechanisms: Substitution & Elimination", "Understand how electron movement drives organic reactions.", ["nucleophiles & electrophiles", "SN1 / SN2 mechanisms", "E1 / E2 mechanisms", "Zaitsev's rule"]),
    s("intermediate", 1, "Addition Reactions", "Add atoms across double and triple bonds with regio- and stereochemical control.", ["Markovnikov vs anti-Markovnikov", "hydroboration-oxidation", "halogenation", "epoxidation"]),
    s("intermediate", 2, "Conjugation & Aromaticity", "Explain stability and reactivity in systems with delocalized π electrons.", ["conjugated dienes", "resonance structures", "Hückel's rule (4n+2)", "electrophilic aromatic substitution"]),
    s("intermediate", 3, "Spectroscopy", "Determine molecular structure using IR, NMR, and mass spectrometry.", ["IR absorption frequencies", "¹H NMR (chemical shift, splitting, integration)", "¹³C NMR", "mass spec (molecular ion, fragmentation)"]),
    s("advanced", 1, "Carbonyl Chemistry", "Master the rich reactivity of aldehydes, ketones, and carboxylic acid derivatives.", ["nucleophilic addition", "enolate formation", "aldol condensation", "Claisen condensation", "Grignard reagents"]),
    s("advanced", 2, "Retrosynthetic Analysis", "Design syntheses by working backward from target molecules to simple precursors.", ["disconnections", "synthons", "FGI (functional group interconversion)", "protecting groups", "convergent synthesis"]),
    s("next_gen", 1, "Computational & Open Organic Chemistry", "Survey reaction prediction algorithms, open reaction databases, and automated synthesis.", ["computer-aided synthesis planning", "rxn / ORD open databases", "flow chemistry", "AI-driven retrosynthesis"]),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 20 — Music Theory
// ─────────────────────────────────────────────────────────────────────────────
const syllabusMusic: TopicSyllabus = {
  topicId: 20,
  topicTitle: "Music Theory",
  contentType: "visual_heavy",
  units: [
    s("beginner", 1, "Notes, Scales & Keys", "Map pitch names to staff positions and construct major and minor scales.", ["treble / bass clef", "chromatic scale", "major scale formula (WWHWWWH)", "natural minor / relative minor", "key signatures"]),
    s("beginner", 2, "Intervals & Chords", "Measure distances between pitches and build triads.", ["interval quality (perfect, major, minor, augmented, diminished)", "triads (major, minor, diminished, augmented)", "inversions", "circle of fifths"]),
    s("beginner", 3, "Rhythm & Meter", "Organize time into beats, measures, and rhythmic patterns.", ["note values & rests", "time signatures", "syncopation", "pickup notes / anacrusis", "tempo markings"]),
    s("intermediate", 1, "Harmony & Voice Leading", "Connect chords smoothly while preserving independence among melodic lines.", ["common-practice harmony", "voice leading rules", "non-chord tones", "cadences (authentic, plagal, deceptive, half)"]),
    s("intermediate", 2, "Seventh Chords & Extensions", "Add color and tension with seventh chords, ninths, elevenths, and thirteenths.", ["dominant seventh", "major / minor seventh", "half-diminished / fully diminished", "extended chords", "altered dominants"]),
    s("intermediate", 3, "Modulation & Tonicization", "Change keys artfully to create variety and drama.", ["pivot chord modulation", "common-tone modulation", "sequential modulation", "tonicization vs modulation"]),
    s("advanced", 1, "Form & Analysis", "Recognize structural patterns in compositions from minuets to sonatas.", ["phrase & period", "binary / ternary / rondo", "sonata-allegro form", "theme & variations", "fugue"]),
    s("advanced", 2, "20th Century & Contemporary Techniques", "Explore modes, atonality, serialism, and spectral music.", ["modes of limited transposition", "twelve-tone technique", "set theory (pitch-class sets)", "spectralism", "minimalism"]),
    s("next_gen", 1, "Open Science in Music Cognition", "Propose empirical studies on the neural basis of rhythm, cross-cultural tuning systems, or music generation ethics.", ["music & neuroscience", "cross-cultural tuning", "generative music ethics", "open music datasets"]),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 21 — Probability & Statistics
// ─────────────────────────────────────────────────────────────────────────────
const syllabusProbStat: TopicSyllabus = {
  topicId: 21,
  topicTitle: "Probability & Statistics",
  contentType: "formula_heavy",
  units: [
    s("beginner", 1, "Descriptive Statistics", "Summarize datasets with measures of center, spread, and shape.", ["mean / median / mode", "variance & standard deviation", "percentiles & IQR", "histograms & box plots", "skewness & kurtosis"]),
    s("beginner", 2, "Probability Foundations", "Quantify uncertainty using axioms, conditional probability, and independence.", ["sample spaces & events", "probability axioms (Kolmogorov)", "conditional probability P(A|B)", "Bayes' theorem", "independence"]),
    s("beginner", 3, "Random Variables & Distributions", "Model outcomes numerically with probability mass and density functions.", ["discrete vs continuous RVs", "PMF / PDF / CDF", "Bernoulli / binomial", "normal distribution", "expectation & variance"]),
    s("intermediate", 1, "Joint, Marginal & Conditional Distributions", "Handle multiple random variables and their relationships.", ["joint distributions", "marginalization", "conditional distributions", "covariance & correlation", "multivariate normal"]),
    s("intermediate", 2, "Sampling Distributions & the Central Limit Theorem", "Understand how sample statistics vary and why the normal distribution appears everywhere.", ["sampling distribution of mean", "CLT statement & conditions", "standard error", "law of large numbers"]),
    s("intermediate", 3, "Confidence Intervals & Hypothesis Testing", "Make reliable inferences from sample data with quantified uncertainty.", ["CI for mean & proportion", "null & alternative hypotheses", "p-values", "Type I / II errors", "power analysis"]),
    s("intermediate", 4, "Regression Analysis", "Model relationships between variables and quantify prediction uncertainty.", ["simple linear regression", "least-squares estimation", "R² interpretation", "residual analysis", "multiple regression intro"]),
    s("advanced", 1, "Bayesian Inference", "Update beliefs with evidence using prior distributions and Bayes' theorem.", ["prior / likelihood / posterior", "conjugate priors", "MCMC intuition", "Bayesian vs frequentist interpretation"]),
    s("advanced", 2, "Experimental Design & Causal Inference", "Draw causal conclusions from data using randomization and control.", ["randomized controlled trials", "blocking & stratification", "causal diagrams", "propensity score matching", "instrumental variables"]),
    s("next_gen", 1, "Reproducibility & Open Statistical Practice", "Address p-hacking, preregister studies, and share analysis code openly.", ["replication crisis", "pre-registration", "registered reports", "open data / code", "effect sizes & confidence over p-values"]),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 22 — Differential Equations
// ─────────────────────────────────────────────────────────────────────────────
const syllabusDiffEq: TopicSyllabus = {
  topicId: 22,
  topicTitle: "Differential Equations",
  contentType: "formula_heavy",
  units: [
    s("beginner", 1, "Introduction to ODEs", "Classify differential equations by order, linearity, and initial conditions.", ["order & degree", "linear vs nonlinear", "general vs particular solutions", "initial value problems", "direction fields"]),
    s("beginner", 2, "Separable & First-Order Linear ODEs", "Solve the two most common first-order equation types analytically.", ["separation of variables", "integrating factor μ(t)", "mixing problems", "exponential growth / decay"]),
    s("beginner", 3, "Second-Order Linear ODEs with Constant Coefficients", "Solve homogeneous and driven oscillatory systems.", ["characteristic equation", "real / complex / repeated roots", "method of undetermined coefficients", "mechanical & electrical analogies"]),
    s("intermediate", 1, "Laplace Transforms", "Convert differential equations into algebraic equations for easier solution.", ["definition & region of convergence", "transforms of derivatives", "partial fraction expansion", "solving IVPs", "transfer functions"]),
    s("intermediate", 2, "Systems of ODEs", "Model coupled quantities using matrices and eigenvalues.", ["state-space representation", "matrix exponential", "phase portraits (2D)", "stability of fixed points", "nonlinear systems linearization"]),
    s("intermediate", 3, "Fourier Series & Boundary Value Problems", "Expand periodic forcing functions and solve PDEs on bounded domains.", ["Fourier series coefficients", "odd / even extensions", "heat equation (1D)", "separation of variables", "boundary conditions (Dirichlet, Neumann)"]),
    s("advanced", 1, "Partial Differential Equations", "Classify and solve the classical equations of mathematical physics.", ["classification (elliptic / parabolic / hyperbolic)", "wave equation", "heat equation", "Laplace & Poisson equations", "method of characteristics"]),
    s("advanced", 2, "Green's Functions & Integral Transforms", "Construct solutions to inhomogeneous equations using fundamental solutions.", ["delta function & distributions", "Green's function for ODEs", "Green's function for Poisson", "Fourier transform method for PDEs"]),
    s("next_gen", 1, "Numerical Methods & Open Scientific Computing", "Survey finite element methods, open PDE solvers, and reproducibility in simulation science.", ["finite difference / element / volume", "FEniCS / deal.II / OpenFOAM", "verification & validation", "open benchmark suites"]),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 23 — Thermodynamics
// ─────────────────────────────────────────────────────────────────────────────
const syllabusThermo: TopicSyllabus = {
  topicId: 23,
  topicTitle: "Thermodynamics",
  contentType: "theory_heavy",
  units: [
    s("beginner", 1, "Systems, States & Processes", "Define thermodynamic systems and distinguish state variables from process quantities.", ["open / closed / isolated systems", "intensive vs extensive properties", "state variables (P, V, T, n)", "quasi-static processes", "reversible vs irreversible"]),
    s("beginner", 2, "The First Law of Thermodynamics", "Apply energy conservation to heat, work, and internal energy.", ["internal energy U", "heat Q & work W sign conventions", "First Law ΔU = Q - W", "enthalpy H = U + PV", "specific heats C_v & C_p"]),
    s("beginner", 3, "The Second Law & Entropy", "Understand why processes have a preferred direction and quantify irreversibility.", ["heat engines & Kelvin-Planck", "refrigerators & Clausius", "entropy S = Q_rev/T", "entropy as state function", "microscopic interpretation (Boltzmann)"]),
    s("intermediate", 1, "Thermodynamic Potentials", "Use Legendre transforms to switch between natural variables for convenience.", ["Helmholtz free energy F", "Gibbs free energy G", "Maxwell relations", "natural variables", "criteria for spontaneity"]),
    s("intermediate", 2, "Phase Transitions", "Classify changes of state and apply the Clausius-Clapeyron equation.", ["latent heat", "Clausius-Clapeyron relation", "phase diagrams", "critical point", "Gibbs phase rule"]),
    s("intermediate", 3, "Ideal & Real Gases", "Extend the ideal gas model to account for molecular size and intermolecular forces.", ["ideal gas law", "van der Waals equation", "virial expansion", "compressibility factor Z", "Joule-Thomson effect"]),
    s("advanced", 1, "Kinetic Theory of Gases", "Derive macroscopic properties from microscopic molecular motion.", ["Maxwell-Boltzmann distribution", "mean free path", "transport properties (viscosity, conductivity)", "equipartition theorem"]),
    s("advanced", 2, "Chemical Thermodynamics", "Apply thermodynamics to reacting systems and electrochemical cells.", ["reaction enthalpy & entropy", "Gibbs free energy of reaction", "equilibrium constant K", "van 't Hoff equation", "Nernst equation link"]),
    s("advanced", 3, "Statistical Mechanics Foundations", "Bridge microscopic states and macroscopic thermodynamics using ensembles.", ["microcanonical / canonical / grand canonical", "partition function Z", "deriving U, S, F from Z", "Boltzmann distribution"]),
    s("next_gen", 1, "Open Questions in Thermodynamics", "Explore finite-time thermodynamics, quantum heat engines, and information thermodynamics.", ["Curzon-Ahlborn efficiency", "quantum thermodynamics", "Landauer's principle", "active matter thermodynamics"]),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 24 — Statistical Mechanics
// ─────────────────────────────────────────────────────────────────────────────
const syllabusStatMech: TopicSyllabus = {
  topicId: 24,
  topicTitle: "Statistical Mechanics",
  contentType: "theory_heavy",
  units: [
    s("beginner", 1, "Microstates & Macrostates", "Count configurations and understand why entropy grows with available states.", ["microstate vs macrostate", "multiplicity Ω", "Boltzmann entropy S = k_B ln Ω", "stirling's approximation", "binomial distribution"]),
    s("beginner", 2, "Ensembles & Postulates", "Replace time averages with ensemble averages and define equilibrium statistically.", ["ergodic hypothesis", "microcanonical ensemble", "canonical ensemble", "partition function definition", "ensemble equivalence (thermodynamic limit)"]),
    s("beginner", 3, "The Canonical Ensemble", "Derive all thermodynamic quantities from a single generating function.", ["Boltzmann factor e^{-βE}", "partition function Z = Σ e^{-βE}", "average energy ⟨E⟩ = -∂lnZ/∂β", "entropy from Z", "fluctuations & heat capacity"]),
    s("intermediate", 1, "Quantum Statistics: Bose-Einstein & Fermi-Dirac", "Distinguish particles by quantum indistinguishability and spin.", ["indistinguishability", "bosons vs fermions", "Bose-Einstein distribution", "Fermi-Dirac distribution", "Maxwell-Boltzmann limit"]),
    s("intermediate", 2, "Ideal Quantum Gases", "Apply quantum statistics to photons, phonons, and electrons.", ["blackbody radiation (Planck)", "Debye model of solids", "free electron gas", "Fermi energy & temperature", "Pauli paramagnetism"]),
    s("intermediate", 3, "Phase Transitions & Critical Phenomena", "Understand collective behavior near critical points using mean-field and scaling.", ["order parameter", "mean-field theory (Landau)", "critical exponents", "scaling hypothesis", "Ising model"]),
    s("advanced", 1, "The Renormalization Group", "Explain universality by coarse-graining degrees of freedom iteratively.", ["blocking / decimation", "fixed points", "relevant / irrelevant operators", "universality classes", "ε-expansion"]),
    s("advanced", 2, "Non-Equilibrium Statistical Mechanics", "Extend statistical methods to driven, time-dependent, and fluctuating systems.", ["master equation", "Langevin equation", "Fokker-Planck equation", "fluctuation-dissipation theorem", "linear response theory"]),
    s("next_gen", 1, "Open Frontiers", "Survey active matter, econophysics, and quantum information thermodynamics.", ["active matter phases", "econophysics models", "quantum information & entropy", "machine learning & statistical mechanics"]),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 25 — Cell Biology
// ─────────────────────────────────────────────────────────────────────────────
const syllabusCellBio: TopicSyllabus = {
  topicId: 25,
  topicTitle: "Cell Biology",
  contentType: "visual_heavy",
  units: [
    s("beginner", 1, "Cell Theory & Microscopy", "Establish the foundational principles and tools for observing cells.", ["cell theory tenets", "prokaryotic vs eukaryotic", "light vs electron microscopy", "staining techniques", "scale & resolution"]),
    s("beginner", 2, "The Plasma Membrane", "Understand the fluid mosaic model and how membranes regulate transport.", ["phospholipid bilayer", "integral vs peripheral proteins", "passive vs active transport", "osmosis & tonicity", "membrane potential"]),
    s("beginner", 3, "Organelles & Their Functions", "Map the internal compartments of eukaryotic cells and their specialized roles.", ["nucleus & nuclear envelope", "mitochondria & ATP", "ER & Golgi (secretory pathway)", "lysosomes & peroxisomes", "cytoskeleton (microfilaments, intermediate filaments, microtubules)"]),
    s("intermediate", 1, "Protein Synthesis & Trafficking", "Follow the central dogma from DNA to functional protein localization.", ["transcription & RNA processing", "translation (initiation, elongation, termination)", "signal peptides", "co-translational import", "post-translational modifications"]),
    s("intermediate", 2, "Cell Cycle & Division", "Control the orderly duplication and segregation of genetic material.", ["interphase (G1, S, G2)", "mitosis stages", "cyclins & CDKs", "checkpoints (G1/S, G2/M, spindle)", "apoptosis"]),
    s("intermediate", 3, "Cell Signaling", "Decode how cells communicate via chemical messengers and signal transduction.", ["ligands & receptors", "G-protein coupled receptors", "receptor tyrosine kinases", "second messengers (cAMP, Ca²⁺)", "signal amplification & termination"]),
    s("advanced", 1, "Cytoskeleton Dynamics & Motor Proteins", "Understand intracellular transport and cell motility at the molecular level.", ["actin polymerization", "microtubule dynamics (dynamic instability)", "myosin, kinesin, dynein", "muscle contraction (sarcomere)", "cilia & flagella"]),
    s("advanced", 2, "Cell-Cell & Cell-Matrix Interactions", "Examine adhesion, junctions, and the extracellular matrix in tissue organization.", ["tight junctions", "adherens junctions & cadherins", "desmosomes & hemidesmosomes", "gap junctions", "ECM composition (collagen, fibronectin, proteoglycans)"]),
    s("next_gen", 1, "Open Questions in Cell Biology", "Propose research into organelle biogenesis, phase separation, or synthetic cells.", ["liquid-liquid phase separation", "organelle biogenesis", "synthetic minimal cells", "quantitative cell biology"]),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 26 — Genetics & Heredity
// ─────────────────────────────────────────────────────────────────────────────
const syllabusGenetics: TopicSyllabus = {
  topicId: 26,
  topicTitle: "Genetics & Heredity",
  contentType: "theory_heavy",
  units: [
    s("beginner", 1, "Mendelian Genetics", "Predict inheritance patterns using dominant and recessive alleles.", ["genes / alleles / loci", "dominant vs recessive", "genotype vs phenotype", "Punnett squares", "Mendel's laws (segregation, independent assortment)"]),
    s("beginner", 2, "Chromosomal Basis of Inheritance", "Connect genes to chromosomes and understand sex-linked traits.", ["chromosome structure", "homologous pairs", "sex chromosomes (XX / XY)", "sex-linked inheritance", "pedigree analysis"]),
    s("beginner", 3, "DNA Structure & Replication", "Understand the double helix and the semiconservative copying mechanism.", ["Watson-Crick base pairing", "antiparallel strands", "semiconservative replication", "DNA polymerase", "origin of replication"]),
    s("intermediate", 1, "Gene Expression & Regulation", "Control when and how much protein is produced from a gene.", ["operon model (lac, trp)", "transcription factors", "enhancers & silencers", "epigenetic modifications (methylation, acetylation)", "RNA interference"]),
    s("intermediate", 2, "Mutations & DNA Repair", "Classify genetic changes and the cellular mechanisms that correct them.", ["point mutations (silent, missense, nonsense)", "frameshifts", "chromosomal mutations", "mismatch repair", "homologous recombination repair"]),
    s("intermediate", 3, "Population Genetics", "Track allele frequencies across generations and understand evolutionary forces.", ["Hardy-Weinberg equilibrium", "allele & genotype frequencies", "mutation, migration, selection, drift", "founder effect & bottleneck", "FST"]),
    s("advanced", 1, "Quantitative Genetics", "Analyze traits controlled by many genes and environmental influences.", ["heritability (h²)", "QTL mapping", "GWAS", "polygenic risk scores", "G×E interactions"]),
    s("advanced", 2, "Genomic Technologies", "Sequence, edit, and analyze genomes at scale.", ["Sanger vs next-gen sequencing", "CRISPR-Cas9 mechanism", "guide RNA design", "whole-genome vs exome sequencing", "bioinformatics pipelines"]),
    s("next_gen", 1, "Ethics & Open Science in Genetics", "Debate germline editing, biobank governance, and open genomic data sharing.", ["germline vs somatic editing ethics", "biobank consent models", "data privacy (de-identification)", "open GWAS / dbGaP / 1000 Genomes"]),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 27 — Ecology & Ecosystems
// ─────────────────────────────────────────────────────────────────────────────
const syllabusEcology: TopicSyllabus = {
  topicId: 27,
  topicTitle: "Ecology & Ecosystems",
  contentType: "visual_heavy",
  units: [
    s("beginner", 1, "Levels of Organization", "Organize life from individuals to the biosphere.", ["individual / population / community / ecosystem / biome / biosphere", "abiotic vs biotic factors", "habitat vs niche", "ecological hierarchy"]),
    s("beginner", 2, "Population Ecology", "Model how populations grow, shrink, and interact with their environment.", ["exponential growth", "logistic growth & carrying capacity", "life tables & survivorship curves", "r-selected vs K-selected species"]),
    s("beginner", 3, "Community Interactions", "Analyze predation, competition, mutualism, and their effects on community structure.", ["predator-prey dynamics (Lotka-Volterra)", "competition (interference / exploitative)", "mutualism / commensalism / parasitism", "keystone species", "trophic cascades"]),
    s("intermediate", 1, "Ecosystem Energetics", "Trace energy flow through trophic levels and measure ecosystem productivity.", ["primary productivity (GPP / NPP)", "trophic efficiency (~10% rule)", "food chains & food webs", "ecological pyramids", "decomposition & nutrient cycling"]),
    s("intermediate", 2, "Biogeochemical Cycles", "Follow carbon, nitrogen, phosphorus, and water through living and non-living reservoirs.", ["carbon cycle", "nitrogen cycle (fixation, nitrification, denitrification)", "phosphorus cycle", "water cycle", "human perturbations"]),
    s("intermediate", 3, "Succession & Disturbance", "Understand how ecosystems recover and change over time after disruptions.", ["primary vs secondary succession", "climax community debate", "intermediate disturbance hypothesis", "resilience vs resistance"]),
    s("advanced", 1, "Landscape & Conservation Ecology", "Design reserves and model habitat fragmentation at large scales.", ["metapopulation theory", "island biogeography", "SLOSS debate", "corridors & connectivity", "conservation prioritization (hotspots)"]),
    s("advanced", 2, "Global Change Biology", "Study how climate change, invasive species, and pollution reshape ecosystems.", ["phenological shifts", "range shifts", "ocean acidification", "invasive species impacts", "ecosystem services valuation"]),
    s("next_gen", 1, "Open Science in Ecology", "Propose open-data biodiversity monitoring, citizen science protocols, or meta-analyses.", ["GBIF / iNaturalist", "open ecology data standards", "reproducible ecological modeling", "community-based monitoring"]),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 28 — Evolutionary Biology
// ─────────────────────────────────────────────────────────────────────────────
const syllabusEvoBio: TopicSyllabus = {
  topicId: 28,
  topicTitle: "Evolutionary Biology",
  contentType: "theory_heavy",
  units: [
    s("beginner", 1, "Darwin & Natural Selection", "Understand the mechanism that explains adaptation and diversity.", ["variation", "heritability", "differential survival & reproduction", "fitness", "adaptation vs exaptation"]),
    s("beginner", 2, "Evidence for Evolution", "Synthesize fossil, anatomical, molecular, and biogeographic evidence.", ["fossil record & transitional forms", "homologous vs analogous structures", "vestigial traits", "biogeography", "DNA sequence similarity"]),
    s("beginner", 3, "Sources of Variation", "Identify mutation, recombination, and gene flow as the raw material of evolution.", ["point mutations", "chromosomal rearrangements", "sexual recombination", "gene flow (migration)", "genetic drift introduction"]),
    s("intermediate", 1, "Population Genetics & the Modern Synthesis", "Merge Mendelian inheritance with Darwinian selection mathematically.", ["Hardy-Weinberg equilibrium", "selection coefficients", "mutation-selection balance", "heterozygote advantage", "modern synthesis overview"]),
    s("intermediate", 2, "Speciation", "Understand how new species arise through reproductive isolation.", ["allopatric vs sympatric speciation", "prezygotic vs postzygotic barriers", "ring species", "adaptive radiation", "hybrid zones"]),
    s("intermediate", 3, "Phylogenetics", "Reconstruct evolutionary history using shared derived characters and molecular clocks.", ["cladistics & synapomorphies", "parsimony", "maximum likelihood", "Bayesian inference", "molecular clock calibration"]),
    s("advanced", 1, "Macroevolution & Development", "Connect developmental biology to large-scale evolutionary patterns.", ["evo-devo", "Hox genes", "heterochrony", "modularity & evolvability", "convergent evolution at molecular level"]),
    s("advanced", 2, "Co-evolution & Social Behavior", "Analyze reciprocal evolutionary change and the genetics of altruism.", ["Red Queen hypothesis", "arms races", "kin selection & Hamilton's rule", "reciprocal altruism", "group selection debate"]),
    s("next_gen", 1, "Open Questions in Evolution", "Debate extended evolutionary synthesis, cultural evolution, and experimental evolution design.", ["extended evolutionary synthesis", "niche construction", "cultural evolution", "experimental evolution protocols", "open phylogenetic data (TreeBASE)"]),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 29 — Climate Science
// ─────────────────────────────────────────────────────────────────────────────
const syllabusClimate: TopicSyllabus = {
  topicId: 29,
  topicTitle: "Climate Science",
  contentType: "theory_heavy",
  units: [
    s("beginner", 1, "Earth's Energy Balance", "Model incoming solar radiation, albedo, and outgoing longwave radiation.", ["solar constant", "albedo", "Stefan-Boltzmann law", "greenhouse effect mechanism", "energy budget diagram"]),
    s("beginner", 2, "The Carbon Cycle", "Trace carbon through the atmosphere, oceans, biosphere, and geosphere.", ["photosynthesis & respiration", "ocean solubility pump", "biological pump", "fossil fuel emissions", "carbon sinks vs sources"]),
    s("beginner", 3, "Climate Forcings & Feedbacks", "Distinguish external drivers from internal amplifications and dampenings.", ["radiative forcing", "water vapor feedback", "ice-albedo feedback", "cloud feedback uncertainty", "aerosol forcing"]),
    s("intermediate", 1, "Climate Models", "Understand how general circulation models simulate Earth's climate system.", ["GCM structure (atmosphere, ocean, land, ice)", "grid resolution", "parameterizations", "ensemble forecasting", "CMIP projects"]),
    s("intermediate", 2, "Paleoclimate", "Reconstruct past climates using proxies and understand natural variability.", ["ice cores (CO₂, δ¹⁸O)", "tree rings", "sediment cores", "Milankovitch cycles", "Holocene climate optimum"]),
    s("intermediate", 3, "Observed Changes & Attribution", "Quantify current warming and attribute it to human activities with confidence.", ["surface temperature trends", "ocean heat content", "sea level rise (thermal expansion + ice melt)", "attribution studies", "IPCC confidence language"]),
    s("advanced", 1, "Impacts & Vulnerability", "Assess regional risks to ecosystems, agriculture, health, and infrastructure.", ["RCP / SSP scenarios", "extreme event attribution", "tipping points (AMOC, permafrost, ice sheets)", "vulnerability indices", "adaptation vs mitigation"]),
    s("advanced", 2, "Mitigation & Policy", "Evaluate technological and policy solutions for emissions reduction.", ["renewable energy transition", "carbon capture & storage", "reforestation & afforestation", "carbon pricing", "Paris Agreement mechanisms"]),
    s("next_gen", 1, "Open Science in Climate Research", "Audit climate model reproducibility, open datasets, and citizen science contributions.", ["open GCM code (CESM, HadGEM)", "FAIR climate data", "citizen science (weather rescue)", "transparent emissions accounting"]),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 30 — Geology & Plate Tectonics
// ─────────────────────────────────────────────────────────────────────────────
const syllabusGeology: TopicSyllabus = {
  topicId: 30,
  topicTitle: "Geology & Plate Tectonics",
  contentType: "visual_heavy",
  units: [
    s("beginner", 1, "Earth's Layers", "Understand the compositional and mechanical divisions of the planet.", ["crust / mantle / core", "lithosphere vs asthenosphere", "seismic wave evidence", "Mohorovičić discontinuity"]),
    s("beginner", 2, "Plate Tectonics Theory", "Explain how Earth's surface is divided into moving plates.", ["continental drift evidence", "seafloor spreading", "magnetic reversals", "plate boundaries (divergent, convergent, transform)"]),
    s("beginner", 3, "Rocks & the Rock Cycle", "Classify igneous, sedimentary, and metamorphic rocks and their interconversion.", ["igneous (intrusive vs extrusive)", "sedimentary (clastic, chemical, organic)", "metamorphic (foliated vs non-foliated)", "rock cycle processes"]),
    s("intermediate", 1, "Minerals & Crystallography", "Identify minerals by physical properties and understand atomic arrangements.", ["silicate structures", "Mohs hardness", "crystal systems", "X-ray diffraction basics", "phase diagrams (binary)"]),
    s("intermediate", 2, "Earthquakes & Seismology", "Analyze faulting, seismic waves, and earthquake hazards.", ["fault types (normal, reverse, strike-slip)", "P-waves vs S-waves", "Richter vs moment magnitude", "seismogram interpretation", "tsunami generation"]),
    s("intermediate", 3, "Volcanism", "Classify volcanic eruptions, landforms, and hazards.", ["magma composition & viscosity", "shield vs stratovolcano", "pyroclastic flows", "calderas", "volcanic hazards mitigation"]),
    s("advanced", 1, "Structural Geology", "Interpret deformed rocks and reconstruct tectonic stresses.", ["stress vs strain", "fold geometry", "fault mechanics", "brittle vs ductile deformation", "microstructures"]),
    s("advanced", 2, "Geochronology & Stratigraphy", "Date rocks and correlate strata across regions.", ["radiometric dating (K-Ar, U-Pb, C-14)", "half-life & decay systems", "principle of superposition", "biostratigraphy", "chemostratigraphy"]),
    s("next_gen", 1, "Open Data in Earth Science", "Propose open seismic networks, geochronology databases, or planetary geology comparisons.", ["IRIS / GSN seismic data", "GeoChron / EarthChem databases", "planetary geology (Mars, Moon)", "open geospatial tools (QGIS)"]),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// 31 — Ethics & Moral Philosophy
// ─────────────────────────────────────────────────────────────────────────────
const syllabus31: TopicSyllabus = {
  topicId: 31,
  topicTitle: "Ethics & Moral Philosophy",
  contentType: "concept_heavy",
  units: [
    s("beginner", 1, "Normative Ethics: Consequentialism", "Judge actions by their outcomes and maximize overall well-being.", ["act vs rule utilitarianism", "hedonistic vs preference satisfaction", "objections (utility monster, rights)"], 20),
    s("beginner", 2, "Normative Ethics: Deontology", "Follow moral duties and rules regardless of consequences.", ["Kant's categorical imperative", "universalizability", "treating persons as ends", "Ross's prima facie duties"], 20),
    s("beginner", 3, "Normative Ethics: Virtue Ethics", "Focus on character and flourishing rather than isolated actions.", ["Aristotle's eudaimonia", "moral virtues (mean between extremes)", "practical wisdom (phronesis)", "modern virtue ethics revival"], 20),
    s("intermediate", 1, "Applied Ethics", "Apply ethical frameworks to real-world dilemmas in medicine, technology, and environment.", ["trolley problem variants", "animal rights", "environmental ethics", "AI ethics"], 25),
    s("intermediate", 2, "Meta-Ethics", "Examine the nature, scope, and meaning of moral claims.", ["cognitivism vs non-cognitivism", "moral realism vs anti-realism", "naturalism vs non-naturalism", "error theory"], 25),
    s("advanced", 1, "Moral Psychology & Experimental Philosophy", "Study how humans actually make moral judgments and what it means for ethical theory.", ["dual-process theory", "trolley problem neuroscience", "cultural variation", "situationism vs character"], 25),
    s("next_gen", 1, "Open Questions in Moral Philosophy", "Propose empirical studies or conceptual analyses on moral uncertainty, longtermism, or moral circle expansion.", ["moral uncertainty", "longtermism", "moral circle expansion", "open science in philosophy"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 32 — Logic & Reasoning
// ─────────────────────────────────────────────────────────────────────────────
const syllabus32: TopicSyllabus = {
  topicId: 32,
  topicTitle: "Logic & Reasoning",
  contentType: "concept_heavy",
  units: [
    s("beginner", 1, "Arguments & Validity", "Distinguish premises from conclusions and identify deductive validity.", ["premise / conclusion / inference", "valid vs sound arguments", "argument forms", "enthymemes"], 20),
    s("beginner", 2, "Propositional Logic", "Analyze compound statements using truth tables and logical connectives.", ["negation / conjunction / disjunction", "conditional & biconditional", "truth tables", "tautology / contradiction / contingency"], 20),
    s("beginner", 3, "Common Fallacies", "Spot errors in reasoning that frequently appear in debates and media.", ["ad hominem / straw man / false dilemma", "slippery slope / appeal to authority", "circular reasoning", "post hoc ergo propter hoc"], 20),
    s("intermediate", 1, "Predicate Logic", "Express quantified statements about properties and relations.", ["quantifiers ∀ ∃", "predicates & variables", "translation from English", "validity in predicate logic"], 25),
    s("intermediate", 2, "Inductive & Abductive Reasoning", "Evaluate non-deductive arguments by strength and plausibility.", ["inductive generalization", "analogical reasoning", "inference to best explanation", "confirmation bias mitigation"], 25),
    s("intermediate", 3, "Formal Proof Systems", "Construct proofs using natural deduction or sequent calculus.", ["assumption / modus ponens / modus tollens", "conditional & indirect proof", "Fitch notation", "soundness & completeness"], 25),
    s("advanced", 1, "Modal & Non-Classical Logics", "Extend logic to necessity, possibility, and paraconsistent contexts.", ["modal operators □ ◊", "Kripke semantics", "intuitionistic logic", "paraconsistent logic"], 25),
    s("next_gen", 1, "Logic in Open Science", "Propose formal verification of scientific arguments or open-access logic education tools.", ["argument mapping tools", "formal verification of proofs", "open logic project", "reproducibility of deductive claims"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 33 — Epistemology
// ─────────────────────────────────────────────────────────────────────────────
const syllabus33: TopicSyllabus = {
  topicId: 33,
  topicTitle: "Epistemology",
  contentType: "theory_heavy",
  units: [
    s("beginner", 1, "The Analysis of Knowledge", "Investigate what conditions are necessary and sufficient for knowing something.", ["justified true belief (JTB)", "Gettier problems", "Nozick's truth-tracking", "reliabilism"], 20),
    s("beginner", 2, "Sources of Knowledge", "Compare perception, testimony, memory, and reason as epistemic foundations.", ["empiricism vs rationalism", "testimony & trust", "memory as generative vs preservative", "intuition & thought experiments"], 20),
    s("beginner", 3, "Skepticism", "Examine arguments that challenge the possibility of knowledge.", ["Cartesian evil demon", "brain-in-a-vat", "Pyrrhonian skepticism", "contextualist responses"], 20),
    s("intermediate", 1, "Internalism vs Externalism", "Debate whether justification depends solely on internal mental states.", ["access internalism", "mentalism", "process reliabilism", "virtue epistemology"], 25),
    s("intermediate", 2, "Social Epistemology", "Study how groups, institutions, and social processes produce knowledge.", ["testimony & expertise", "epistemic injustice (Fricker)", "collective knowledge", "disagreement & conciliation"], 25),
    s("advanced", 1, "Formal Epistemology", "Use probability and decision theory to model rational belief and inquiry.", ["Dutch book arguments", "probabilism", "Bayesian updating", "Jeffrey conditionalization"], 25),
    s("next_gen", 1, "Open Questions in Epistemology", "Propose research on ignorance, epistemic bubbles, or the epistemology of AI-generated content.", ["willful ignorance", "epistemic bubbles & echo chambers", "AI epistemology", "open peer review"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 34 — Microeconomics
// ─────────────────────────────────────────────────────────────────────────────
const syllabus34: TopicSyllabus = {
  topicId: 34,
  topicTitle: "Microeconomics",
  contentType: "theory_heavy",
  units: [
    s("beginner", 1, "Supply & Demand", "Model how prices coordinate markets through buyer and seller behavior.", ["demand curve (law of demand)", "supply curve (law of supply)", "equilibrium price & quantity", "shifts vs movements along curves"], 20),
    s("beginner", 2, "Elasticity", "Measure responsiveness of quantity to changes in price, income, or related goods.", ["price elasticity of demand", "income elasticity", "cross-price elasticity", "elasticity & total revenue"], 20),
    s("beginner", 3, "Consumer & Producer Surplus", "Quantify welfare gains from trade and the deadweight loss of interventions.", ["willingness to pay", "consumer surplus", "producer surplus", "deadweight loss", "tax incidence"], 20),
    s("intermediate", 1, "Market Structures: Perfect Competition & Monopoly", "Compare price-taking and price-setting firms and their welfare implications.", ["perfect competition (P = MC)", "monopoly (MR = MC)", "Lerner index", "natural monopoly", "price discrimination"], 25),
    s("intermediate", 2, "Oligopoly & Game Theory", "Model strategic interaction among few firms.", ["Cournot & Bertrand models", "Nash equilibrium", "prisoner's dilemma in pricing", "cartels & cheating incentives"], 25),
    s("intermediate", 3, "Market Failures", "Identify when markets fail to allocate resources efficiently and evaluate remedies.", ["externalities (Coase theorem)", "public goods (free-rider problem)", "asymmetric information (adverse selection, moral hazard)", "behavioral biases"], 25),
    s("advanced", 1, "General Equilibrium & Welfare", "Analyze economy-wide interactions and the efficiency of competitive markets.", ["Edgeworth box", "Pareto efficiency", "Walrasian equilibrium", "first & second welfare theorems", "Arrow's impossibility theorem"], 25),
    s("next_gen", 1, "Open Science in Economics", "Propose open-data replication studies, pre-registration of policy evaluations, or transparent modeling.", ["replication crisis in economics", "open data initiatives", "pre-registration", "computational reproducibility"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 35 — Macroeconomics
// ─────────────────────────────────────────────────────────────────────────────
const syllabus35: TopicSyllabus = {
  topicId: 35,
  topicTitle: "Macroeconomics",
  contentType: "theory_heavy",
  units: [
    s("beginner", 1, "Measuring the Economy", "Track output, prices, and employment using national accounts.", ["GDP (expenditure & income approaches)", "real vs nominal GDP", "inflation (CPI, GDP deflator)", "unemployment rate & types"], 20),
    s("beginner", 2, "The Short Run: Aggregate Demand & Supply", "Explain fluctuations in output and prices using the AD-AS model.", ["aggregate demand components", "short-run aggregate supply", "long-run aggregate supply (potential GDP)", "shocks & stabilization"], 20),
    s("beginner", 3, "Money & Banking", "Understand how banks create money and how central banks influence the economy.", ["functions of money", "fractional reserve banking", "money multiplier", "central bank tools (OMO, reserve requirements, discount rate)"], 20),
    s("intermediate", 1, "Fiscal Policy", "Analyze government spending and taxation as tools for macroeconomic management.", ["multiplier effect", "automatic stabilizers", "crowding out", "Ricardian equivalence", "debt sustainability"], 25),
    s("intermediate", 2, "Monetary Policy", "Evaluate how central banks target inflation and employment through interest rates.", ["Taylor rule", "quantitative easing", "forward guidance", "zero lower bound", "unconventional monetary policy"], 25),
    s("intermediate", 3, "International Macroeconomics", "Study exchange rates, trade balances, and capital flows.", ["exchange rate regimes", "purchasing power parity", "interest rate parity", "balance of payments", "Mundell-Fleming model"], 25),
    s("advanced", 1, "Economic Growth", "Explain why some countries grow faster than others using neoclassical and endogenous growth theory.", ["Solow growth model", "steady state & convergence", "total factor productivity", "Romer's endogenous growth", "institutions & growth"], 25),
    s("next_gen", 1, "Open Questions in Macroeconomics", "Propose research on secular stagnation, climate macroeconomics, or open-source macro models.", ["secular stagnation", "climate transition macro", "heterogeneous agent models", "open-source DSGE platforms"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 36 — Behavioral Economics
// ─────────────────────────────────────────────────────────────────────────────
const syllabus36: TopicSyllabus = {
  topicId: 36,
  topicTitle: "Behavioral Economics",
  contentType: "concept_heavy",
  units: [
    s("beginner", 1, "Prospect Theory", "Model how people actually make decisions under risk, with loss aversion and reference dependence.", ["reference dependence", "loss aversion (λ ≈ 2.25)", "diminishing sensitivity", "probability weighting"], 20),
    s("beginner", 2, "Heuristics & Biases", "Catalog the mental shortcuts that systematically distort judgment.", ["anchoring", "availability heuristic", "representativeness", "conjunction fallacy", "framing effects"], 20),
    s("beginner", 3, "Intertemporal Choice", "Explain why people procrastinate, overconsume, and under-save.", ["time inconsistency", "hyperbolic discounting", "present bias", "commitment devices", "mental accounting"], 20),
    s("intermediate", 1, "Social Preferences", "Measure fairness, reciprocity, and altruism in economic games.", ["ultimatum game", "dictator game", "public goods game", "inequality aversion (Fehr-Schmidt)", "conditional cooperation"], 25),
    s("intermediate", 2, "Nudging & Choice Architecture", "Design environments that help people make better decisions without restricting freedom.", ["default effects", "salience & simplification", "social norms", "implementation intentions", "ethical concerns (autonomy)"], 25),
    s("advanced", 1, "Behavioral Finance", "Apply psychological insights to asset pricing and market anomalies.", ["overconfidence & trading", "momentum & reversal", "bubble psychology", "herding behavior", "limits to arbitrage"], 25),
    s("next_gen", 1, "Open Science in Behavioral Economics", "Address replication concerns, pre-registration, and open data in experimental economics.", ["replication studies", "pre-registration (AEA registry)", "open data (GSS, World Values Survey)", "field experiment design"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 37 — Syntax & Grammar
// ─────────────────────────────────────────────────────────────────────────────
const syllabus37: TopicSyllabus = {
  topicId: 37,
  topicTitle: "Syntax & Grammar",
  contentType: "concept_heavy",
  units: [
    s("beginner", 1, "Morphemes & Words", "Decompose language into its smallest meaningful units and word classes.", ["free vs bound morphemes", "inflection vs derivation", "open vs closed word classes", "word formation processes"], 20),
    s("beginner", 2, "Phrase Structure", "Build sentences from noun phrases, verb phrases, and other constituents.", ["constituency tests", "phrase structure rules", "X-bar theory (basics)", "complement vs adjunct"], 20),
    s("beginner", 3, "Sentences & Clauses", "Analyze simple, compound, complex, and compound-complex sentences.", ["main vs subordinate clauses", "coordination vs subordination", "relative clauses", " embedded clauses"], 20),
    s("intermediate", 1, "Transformational Grammar", "Derive surface structures from deep structures using movement rules.", ["wh-movement", "passivization", "DP hypothesis", "VP-internal subject hypothesis"], 25),
    s("intermediate", 2, "The Minimalist Program", "Understand the latest Chomskyan framework with Merge and feature checking.", ["Merge (external & internal)", "feature checking & Agree", "phases & Phase Impenetrability", "economy principles"], 25),
    s("intermediate", 3, "Cross-Linguistic Variation", "Compare word order, case marking, and pro-drop across languages.", ["Greenberg's universals", "parametric variation", "head-direction parameter", "pro-drop parameter", "ergativity"], 25),
    s("advanced", 1, "Construction Grammar & Alternative Frameworks", "Explore non-generative approaches that treat form-meaning pairings as central.", ["constructions (Goldberg)", "usage-based models", "cognitive grammar (Langacker)", "dependency grammar"], 25),
    s("next_gen", 1, "Open Science in Linguistics", "Propose open-access corpora, cross-linguistic databases, or reproducible syntax experiments.", ["Universal Dependencies project", "open corpora (COCA, BNC)", "reproducible acceptability judgments", "language documentation ethics"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 38 — Semantics & Pragmatics
// ─────────────────────────────────────────────────────────────────────────────
const syllabus38: TopicSyllabus = {
  topicId: 38,
  topicTitle: "Semantics & Pragmatics",
  contentType: "concept_heavy",
  units: [
    s("beginner", 1, "Meaning & Reference", "Distinguish sense from reference and analyze how words pick out objects.", ["Frege's sense & reference", "denotation vs connotation", "definite descriptions (Russell)", "deixis"], 20),
    s("beginner", 2, "Truth-Conditional Semantics", "Compute sentence meaning by composing the meanings of parts.", ["compositionality", "truth conditions", "predicate logic for semantics", "quantifier scope ambiguity"], 20),
    s("beginner", 3, "Lexical Semantics", "Analyze word meanings, relations, and semantic fields.", ["synonymy / antonymy / hyponymy", "polysemy vs homonymy", "prototypes (Rosch)", "semantic frames"], 20),
    s("intermediate", 1, "Speech Acts", "Understand how utterances perform actions beyond stating facts.", ["locutionary / illocutionary / perlocutionary", "Searle's taxonomy", "felicity conditions", "indirect speech acts"], 25),
    s("intermediate", 2, "Implicature", "Decode what speakers mean beyond what they literally say.", ["Grice's maxims (quantity, quality, relation, manner)", "conversational implicature", "scalar implicatures", "relevance theory (Sperber & Wilson)"], 25),
    s("intermediate", 3, "Presupposition & Entailment", "Identify background assumptions and logical consequences of utterances.", ["entailment vs paraphrase", "presupposition triggers", "projection problem", "accommodation"], 25),
    s("advanced", 1, "Discourse & Information Structure", "Track how information flows across sentences and how prominence guides interpretation.", ["topic vs focus", "given vs new information", "discourse referents (DRT)", "anaphora resolution"], 25),
    s("next_gen", 1, "Open Questions in Meaning", "Propose studies on semantic change, cross-cultural pragmatics, or NLP benchmarking for meaning.", ["semantic change (diachronic semantics)", "cross-cultural politeness", "meaning in LLMs", "open semantic datasets"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 39 — Computational Linguistics
// ─────────────────────────────────────────────────────────────────────────────
const syllabus39: TopicSyllabus = {
  topicId: 39,
  topicTitle: "Computational Linguistics",
  contentType: "code_heavy",
  units: [
    s("beginner", 1, "Text Processing Fundamentals", "Normalize, tokenize, and represent text for computational analysis.", ["regular expressions", "tokenization", "stemming & lemmatization", "stop words", "n-grams"], 20),
    s("beginner", 2, "Part-of-Speech Tagging", "Assign grammatical categories to words using statistical models.", ["tagsets (Penn Treebank)", "hidden Markov models (HMM)", "Viterbi algorithm", "rule-based vs statistical tagging"], 20),
    s("beginner", 3, "Parsing", "Build syntactic tree structures from raw text.", ["constituency parsing (CKY)", "dependency parsing", "transition-based vs graph-based", "evaluation (labeled attachment score)"], 20),
    s("intermediate", 1, "Word Embeddings", "Represent words as dense vectors that capture semantic similarity.", ["word2vec (CBOW & Skip-gram)", "GloVe", "evaluation (analogies, similarity datasets)", "subword models (FastText)"], 25),
    s("intermediate", 2, "Sequence Labeling & Classification", "Tag spans and classify text using neural architectures.", ["named entity recognition (NER)", "RNNs for sequence labeling", "CRF layer", "text classification (CNN, RNN, attention)"], 25),
    s("intermediate", 3, "Machine Translation", "Automatically translate between languages using encoder-decoder models.", ["statistical MT (phrase-based)", "neural MT (seq2seq + attention)", "BLEU & chrF metrics", "low-resource MT"], 25),
    s("advanced", 1, "Pretrained Language Models", "Fine-tune large transformer models for linguistic tasks.", ["BERT (masked LM)", "GPT (autoregressive LM)", "prompt engineering", "few-shot learning"], 25),
    s("next_gen", 1, "Open Science in Computational Linguistics", "Audit benchmarks for bias, document datasets, and release reproducible training pipelines.", ["benchmark saturation", "datasheets for datasets", "model cards", "open-source NLP frameworks (Hugging Face)"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 40 — Ancient Civilizations
// ─────────────────────────────────────────────────────────────────────────────
const syllabus40: TopicSyllabus = {
  topicId: 40,
  topicTitle: "Ancient Civilizations",
  contentType: "concept_heavy",
  units: [
    s("beginner", 1, "Mesopotamia: Cradle of Civilization", "Explore Sumer, Babylon, and Assyria — the first cities, writing, and law codes.", ["cuneiform writing", "city-states & ziggurats", "Hammurabi's code", "agriculture & irrigation"], 20),
    s("beginner", 2, "Ancient Egypt", "Study the Nile civilization, pharaohs, pyramids, and hieroglyphic writing.", ["Nile River & agriculture", "pharaonic authority & ma'at", "pyramid construction", "hieroglyphs & papyrus"], 20),
    s("beginner", 3, "Indus Valley & Early China", "Compare urban planning in the Indus and the rise of dynasties along the Yellow River.", ["Harappa & Mohenjo-daro", "seals & undeciphered script", "Shang dynasty & oracle bones", "Zhou mandate of heaven"], 20),
    s("intermediate", 1, "Classical Greece", "Examine democracy, philosophy, theater, and the Persian & Peloponnesian Wars.", ["Athenian democracy", "philosophy (Socrates, Plato, Aristotle)", "tragedy & comedy", "Persian Wars & Peloponnesian War"], 25),
    s("intermediate", 2, "Rome: Republic to Empire", "Trace Rome's expansion, republican institutions, imperial rule, and eventual collapse.", ["Roman Republic (senate, consuls, assemblies)", "Punic Wars & expansion", "transition to empire (Augustus)", "decline & fall theories"], 25),
    s("intermediate", 3, "Religions & Belief Systems", "Compare polytheism, early monotheism, and philosophical spirituality.", ["Mesopotamian & Egyptian religion", "Greek mythology & mystery cults", "Judaism & early Christianity", "Hinduism & Buddhism origins"], 25),
    s("advanced", 1, "Trade, Technology & Cultural Diffusion", "Analyze how goods, ideas, and technologies spread across ancient networks.", ["Silk Road origins", "maritime trade (Indian Ocean)", "metallurgy (bronze & iron)", "writing systems diffusion"], 25),
    s("next_gen", 1, "Open Science in Archaeology", "Propose open-access excavation data, 3D artifact repositories, or ancient DNA sharing.", ["open excavation databases", "3D scanning & sharing", "aDNA open data", "community archaeology"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 41 — Modern History
// ─────────────────────────────────────────────────────────────────────────────
const syllabus41: TopicSyllabus = {
  topicId: 41,
  topicTitle: "Modern History",
  contentType: "concept_heavy",
  units: [
    s("beginner", 1, "The Age of Revolutions", "Analyze the American, French, and Haitian revolutions and their global impact.", ["Enlightenment ideas", "American Revolution causes & outcomes", "French Revolution stages", "Haitian Revolution & abolition"], 20),
    s("beginner", 2, "Industrialization & Its Discontents", "Examine how factories, steam power, and urbanization transformed societies.", ["steam power & mechanization", "factory system", "urbanization & public health", "labor movements & socialism"], 20),
    s("beginner", 3, "Imperialism & Colonialism", "Study European expansion, its justifications, and its lasting consequences.", ["motives (economic, political, cultural)", "scramble for Africa", "British Raj", "resistance movements"], 20),
    s("intermediate", 1, "The World Wars", "Understand the causes, conduct, and consequences of the two global conflicts.", ["WWI causes (militarism, alliances, imperialism, nationalism)", "treaty of Versailles", "WWII rise of fascism", "Holocaust & genocide", "United Nations formation"], 25),
    s("intermediate", 2, "The Cold War", "Analyze the ideological, military, and proxy conflicts between the US and USSR.", ["containment & domino theory", "Korean & Vietnam Wars", "Cuban Missile Crisis", "détente & collapse of USSR"], 25),
    s("intermediate", 3, "Decolonization & Globalization", "Trace the end of empires and the rise of an interconnected world.", ["Indian independence", "African decolonization", "Chinese revolution", "globalization (trade, migration, culture)"], 25),
    s("advanced", 1, "Social Movements & Rights", "Evaluate civil rights, feminism, and environmentalism as forces of change.", ["US civil rights movement", "women's rights waves", "LGBTQ+ rights", "environmentalism (Rachel Carson to Greta Thunberg)"], 25),
    s("next_gen", 1, "Open Questions in Modern History", "Propose digital humanities projects, oral history archives, or decolonized curricula.", ["digital humanities tools", "oral history preservation", "decolonizing history education", "open primary source archives"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 42 — Color Theory & Composition
// ─────────────────────────────────────────────────────────────────────────────
const syllabus42: TopicSyllabus = {
  topicId: 42,
  topicTitle: "Color Theory & Composition",
  contentType: "visual_heavy",
  units: [
    s("beginner", 1, "The Color Wheel & Harmonies", "Organize hues and create pleasing combinations using geometric relationships.", ["primary / secondary / tertiary", "complementary", "analogous", "triadic", "split-complementary"], 20),
    s("beginner", 2, "Color Properties", "Manipulate hue, saturation, and value to create mood and depth.", ["hue", "saturation / chroma", "value / brightness", "tints / shades / tones", "atmospheric perspective"], 20),
    s("beginner", 3, "Psychology of Color", "Understand cultural and emotional associations of different colors.", ["warm vs cool colors", "color symbolism across cultures", "color & emotion studies", "accessibility (color blindness)"], 20),
    s("intermediate", 1, "Composition Principles", "Arrange visual elements to guide the viewer's eye and create balance.", ["rule of thirds", "golden ratio", "leading lines", "framing", "symmetry vs asymmetry"], 25),
    s("intermediate", 2, "Contrast & Hierarchy", "Use contrast to create visual interest and establish information hierarchy.", ["size contrast", "color contrast", "typographic contrast", "white space", "focal point"], 25),
    s("intermediate", 3, "Color in Digital Media", "Manage color across screens, printers, and file formats.", ["RGB vs CMYK vs HSL", "hex codes", "color profiles (sRGB, P3)", "gamut & out-of-gamut colors"], 25),
    s("advanced", 1, "Advanced Color Systems", "Work with LAB, LCH, and OKLCH for perceptually uniform color manipulation.", ["CIELAB", "LCH & OKLCH", "perceptual uniformity", "color difference formulas (Delta E)"], 25),
    s("next_gen", 1, "Open Science in Color Research", "Propose studies on cross-cultural color naming, accessible palettes, or open color datasets.", ["Berlin & Kay color terms", "accessible color palette generators", "open image datasets", "reproducible color psychophysics"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 43 — Typography & Layout
// ─────────────────────────────────────────────────────────────────────────────
const syllabus43: TopicSyllabus = {
  topicId: 43,
  topicTitle: "Typography & Layout",
  contentType: "visual_heavy",
  units: [
    s("beginner", 1, "Type Anatomy & Classification", "Identify the parts of letterforms and categorize typefaces.", ["serif vs sans-serif", "x-height / ascenders / descenders", "stroke contrast", "classification (humanist, geometric, transitional)"], 20),
    s("beginner", 2, "Readability & Legibility", "Choose and set type so text is easy to read at length.", ["font size & line height", "line length (measure)", "tracking & kerning", "paragraph spacing", "contrast with background"], 20),
    s("beginner", 3, "Typographic Hierarchy", "Guide readers through content using size, weight, and style variations.", ["headings (H1-H6)", "body text & captions", "weight & style (bold, italic)", "color & spacing for hierarchy"], 20),
    s("intermediate", 1, "Grid Systems", "Structure layouts using columns, modules, and consistent margins.", ["column grids", "modular grids", "baseline grids", "margin & gutter ratios", "breaking the grid intentionally"], 25),
    s("intermediate", 2, "Responsive Typography", "Scale type fluidly across devices and viewport sizes.", ["viewport units (vw, vmin)", "fluid type scales (clamp)", "modular scales", "variable fonts"], 25),
    s("intermediate", 3, "Pairing Typefaces", "Combine fonts harmoniously for contrast and cohesion.", ["contrast via classification", "superfamilies", "mood & tone matching", "testing pairings in context"], 25),
    s("advanced", 1, "Type Design Fundamentals", "Understand the process of drawing original letterforms.", ["drawing basics (Bezier curves)", "spacing & kerning tables", "OpenType features", "font mastering & hinting"], 25),
    s("next_gen", 1, "Open Science in Typography", "Propose readability studies, open font projects, or typographic accessibility research.", ["open font licenses (OFL)", "readability empirical studies", "dyslexia-friendly fonts", "multilingual typography gaps"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 44 — UI/UX Design Principles
// ─────────────────────────────────────────────────────────────────────────────
const syllabus44: TopicSyllabus = {
  topicId: 44,
  topicTitle: "UI/UX Design Principles",
  contentType: "visual_heavy",
  units: [
    s("beginner", 1, "User-Centered Design Process", "Follow a research-driven workflow from discovery to delivery.", ["empathize / define / ideate / prototype / test", "personas", "user journeys", "job-to-be-done"], 20),
    s("beginner", 2, "Usability Heuristics", "Evaluate interfaces against established usability principles.", ["Nielsen's 10 heuristics", "visibility of system status", "match between system & real world", "error prevention & recovery"], 20),
    s("beginner", 3, "Wireframing & Prototyping", "Communicate design ideas quickly at varying levels of fidelity.", ["low-fi vs high-fi", "paper prototyping", "digital wireframing tools", "interactive prototypes", "prototype testing"], 20),
    s("intermediate", 1, "User Research Methods", "Gather qualitative and quantitative insights about user behavior.", ["interviews & surveys", "usability testing", "A/B testing", "card sorting", "diary studies"], 25),
    s("intermediate", 2, "Information Architecture", "Organize content so users can find what they need.", ["content inventory", "sitemaps", "navigation patterns", "search & filtering", "taxonomy & ontology"], 25),
    s("intermediate", 3, "Interaction Design", "Design how users manipulate interface elements and receive feedback.", ["affordances & signifiers", "feedback loops", "micro-interactions", "gestures & motion", "state machines"], 25),
    s("advanced", 1, "Design Systems", "Scale consistency across products with reusable components and tokens.", ["component libraries", "design tokens (color, type, spacing)", "documentation", "governance", "Figma / Storybook workflows"], 25),
    s("next_gen", 1, "Open Science in UX", "Propose open-access usability studies, inclusive design research, or replication of UX findings.", ["open UX research repositories", "inclusive design frameworks", "replication of Nielsen studies", "community-driven pattern libraries"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 45 — Human Physiology
// ─────────────────────────────────────────────────────────────────────────────
const syllabus45: TopicSyllabus = {
  topicId: 45,
  topicTitle: "Human Physiology",
  contentType: "visual_heavy",
  units: [
    s("beginner", 1, "Homeostasis & Feedback Loops", "Understand how the body maintains stable internal conditions.", ["negative feedback", "positive feedback (birth, clotting)", "set points", "sensor / integrator / effector"], 20),
    s("beginner", 2, "The Nervous System", "Explore how electrical and chemical signals coordinate rapid responses.", ["CNS vs PNS", "neuron structure", "action potentials", "synaptic transmission", "reflex arcs"], 20),
    s("beginner", 3, "The Cardiovascular System", "Follow blood as it delivers oxygen and nutrients throughout the body.", ["heart anatomy & conduction system", "cardiac cycle", "blood vessels (arteries, capillaries, veins)", "blood pressure regulation"], 20),
    s("intermediate", 1, "The Respiratory System", "Understand gas exchange and the mechanics of breathing.", ["lung anatomy", "ventilation (inspiration / expiration)", "gas diffusion (Dalton's law, Henry's law)", "oxygen transport (hemoglobin)", "CO2 transport & pH regulation"], 25),
    s("intermediate", 2, "The Endocrine System", "Study how hormones regulate metabolism, growth, and reproduction.", ["major glands & hormones", "hypothalamus-pituitary axis", "feedback in endocrine loops", "steroid vs peptide hormones"], 25),
    s("intermediate", 3, "The Renal System", "Examine how kidneys filter blood, regulate volume, and maintain electrolyte balance.", ["nephron structure", "glomerular filtration", "reabsorption & secretion", "urine concentration", "RAAS system"], 25),
    s("advanced", 1, "Integration & Exercise Physiology", "See how multiple systems coordinate during physical activity and stress.", ["oxygen debt & EPOC", "thermoregulation", "fluid balance during exercise", "training adaptations"], 25),
    s("next_gen", 1, "Open Science in Physiology", "Propose open-data physiology studies, wearable validation, or reproducibility in biomedicine.", ["open physiological datasets", "wearable sensor validation", "reproducibility in preclinical research", "citizen science health projects"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 46 — Immunology
// ─────────────────────────────────────────────────────────────────────────────
const syllabus46: TopicSyllabus = {
  topicId: 46,
  topicTitle: "Immunology",
  contentType: "theory_heavy",
  units: [
    s("beginner", 1, "Innate Immunity", "Meet the body's first line of defense: barriers, phagocytes, and inflammation.", ["physical & chemical barriers", "phagocytes (neutrophils, macrophages)", "inflammatory response", "complement system", "cytokines"], 20),
    s("beginner", 2, "Adaptive Immunity Overview", "Understand how B and T cells provide specific, memory-capable defense.", ["antigens & epitopes", "B cells & antibodies", "T cells (helper, cytotoxic, regulatory)", "primary vs secondary response"], 20),
    s("beginner", 3, "Antibodies & Antigen Recognition", "Explore the structure and diversity of immunoglobulins.", ["antibody structure (Y-shape)", "variable & constant regions", "isotypes (IgM, IgG, IgA, IgE, IgD)", "affinity maturation", "monoclonal antibodies"], 20),
    s("intermediate", 1, "MHC & Antigen Presentation", "Learn how cells display peptide fragments for immune surveillance.", ["MHC class I vs II", "endogenous vs exogenous pathways", "cross-presentation", "T cell receptor (TCR)"], 25),
    s("intermediate", 2, "Immunological Memory & Vaccines", "Harness immune memory to prevent disease.", ["memory B & T cells", "vaccine types (live attenuated, subunit, mRNA)", "herd immunity threshold", "vaccine hesitancy & communication"], 25),
    s("intermediate", 3, "Immune Dysregulation", "Study when the immune system misfires: autoimmunity, allergy, and immunodeficiency.", ["autoimmune mechanisms", "hypersensitivity types (I-IV)", "primary immunodeficiencies", "HIV & AIDS"], 25),
    s("advanced", 1, "Cancer Immunology", "Explore how the immune system detects and eliminates tumors, and how cancers evade it.", ["tumor antigens", "immune checkpoints (CTLA-4, PD-1)", "checkpoint inhibitors", "CAR-T therapy", "tumor microenvironment"], 25),
    s("next_gen", 1, "Open Science in Immunology", "Propose open-access immune profiling, reproducible assay standards, or global vaccine equity research.", ["open immune repertoire databases", "reproducibility in flow cytometry", "global vaccine access", "citizen science immune monitoring"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 47 — Nutrition & Metabolism
// ─────────────────────────────────────────────────────────────────────────────
const syllabus47: TopicSyllabus = {
  topicId: 47,
  topicTitle: "Nutrition & Metabolism",
  contentType: "theory_heavy",
  units: [
    s("beginner", 1, "Macronutrients", "Understand carbohydrates, proteins, and fats as energy sources and building blocks.", ["carbohydrates (simple vs complex)", "proteins (essential amino acids)", "fats (saturated, unsaturated, trans)", "fiber & gut health"], 20),
    s("beginner", 2, "Micronutrients", "Study vitamins and minerals required in small amounts for vital functions.", ["water-soluble vitamins (B, C)", "fat-soluble vitamins (A, D, E, K)", "major minerals", "trace minerals", "deficiency diseases"], 20),
    s("beginner", 3, "Energy Balance & Metabolism", "Track how the body converts food into usable energy and stores excess.", ["basal metabolic rate (BMR)", "thermic effect of food", "ATP production", "glycolysis overview", "fat storage & mobilization"], 20),
    s("intermediate", 1, "Digestion & Absorption", "Follow food through the gastrointestinal tract and into the bloodstream.", ["mechanical vs chemical digestion", "enzymes (amylase, protease, lipase)", "small intestine absorption", "liver metabolism", "gut microbiome"], 25),
    s("intermediate", 2, "Metabolic Pathways", "Map the biochemical reactions that extract energy and synthesize molecules.", ["glycolysis", "citric acid cycle (Krebs)", "oxidative phosphorylation", "gluconeogenesis", "lipogenesis & beta-oxidation"], 25),
    s("intermediate", 3, "Dietary Patterns & Health", "Evaluate evidence for different diets and their metabolic outcomes.", ["Mediterranean diet", "ketogenic diet", "intermittent fasting", "glycemic index", "systematic reviews & meta-analyses"], 25),
    s("advanced", 1, "Nutrigenomics & Personalized Nutrition", "Explore how genetics influences dietary response.", ["gene-diet interactions", "FTO & obesity", "lactase persistence", "personalized nutrition trials"], 25),
    s("next_gen", 1, "Open Science in Nutrition", "Address replication issues in nutritional epidemiology and propose open dietary databases.", ["replication crisis in nutrition", "open food composition tables", "transparent conflict-of-interest disclosure", "citizen science dietary tracking"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 48 — Circuit Analysis
// ─────────────────────────────────────────────────────────────────────────────
const syllabus48: TopicSyllabus = {
  topicId: 48,
  topicTitle: "Circuit Analysis",
  contentType: "formula_heavy",
  units: [
    s("beginner", 1, "Ohm's Law & Basic Components", "Analyze simple circuits with resistors, voltage sources, and current sources.", ["Ohm's law V = IR", "series & parallel resistors", "Kirchhoff's voltage law (KVL)", "Kirchhoff's current law (KCL)", "voltage & current division"], 20),
    s("beginner", 2, "Circuit Analysis Techniques", "Systematically solve for unknown voltages and currents using established methods.", ["nodal analysis", "mesh analysis", "superposition", "source transformation"], 20),
    s("beginner", 3, "Equivalent Circuits", "Simplify complex networks using Thévenin and Norton equivalents.", ["Thévenin equivalent (V_th, R_th)", "Norton equivalent", "maximum power transfer", "dependent sources"], 20),
    s("intermediate", 1, "Capacitors & Inductors", "Analyze transient and steady-state behavior in circuits with energy storage elements.", ["capacitor i = C(dv/dt)", "inductor v = L(di/dt)", "RC & RL time constants", "RLC natural response", "damping cases (over, under, critical)"], 25),
    s("intermediate", 2, "AC Circuit Analysis", "Use phasors and complex impedance to analyze sinusoidal steady-state circuits.", ["sinusoidal sources", "phasors", "impedance (Z_R, Z_C, Z_L)", "AC power (real, reactive, apparent)", "power factor"], 25),
    s("intermediate", 3, "Frequency Response & Filters", "Design circuits that selectively pass or block frequency ranges.", ["transfer function H(jω)", "Bode plots", "low-pass / high-pass / band-pass", "resonance", "Q-factor"], 25),
    s("advanced", 1, "Laplace Transform Circuit Analysis", "Solve transient and steady-state problems in the s-domain.", ["Laplace of R, L, C", "s-domain circuit models", "transfer functions in s", "pole-zero analysis", "stability"], 25),
    s("next_gen", 1, "Open Hardware & Reproducible Electronics", "Propose open-source circuit designs, shared PCB layouts, and reproducible hardware experiments.", ["open hardware licenses (CERN OHL)", "KiCad open-source EDA", "shared PCB repositories", "reproducible electronics education"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 49 — Signal Processing
// ─────────────────────────────────────────────────────────────────────────────
const syllabus49: TopicSyllabus = {
  topicId: 49,
  topicTitle: "Signal Processing",
  contentType: "formula_heavy",
  units: [
    s("beginner", 1, "Signals & Systems Basics", "Classify signals by domain, periodicity, and determinism.", ["continuous vs discrete", "analog vs digital", "periodic vs aperiodic", "deterministic vs random", "energy vs power signals"], 20),
    s("beginner", 2, "The Fourier Transform", "Decompose signals into their frequency components.", ["Fourier series (periodic)", "Fourier transform (aperiodic)", "magnitude & phase spectra", "Dirichlet conditions", "duality property"], 20),
    s("beginner", 3, "Sampling & Reconstruction", "Convert continuous signals to digital without losing information.", ["Nyquist-Shannon theorem", "aliasing", "anti-aliasing filters", "reconstruction (zero-order hold, sinc interpolation)", "quantization noise"], 20),
    s("intermediate", 1, "Digital Filters", "Design FIR and IIR filters to shape signal frequency content.", ["FIR vs IIR", "window method (FIR)", "bilinear transform (IIR)", "filter structures (direct form, cascade)", "stability & causality"], 25),
    s("intermediate", 2, "The Z-Transform & Discrete Systems", "Analyze discrete-time systems using the z-domain.", ["Z-transform definition", "region of convergence (ROC)", "inverse Z-transform", "difference equations", "poles & zeros"], 25),
    s("intermediate", 3, "The Discrete Fourier Transform (DFT)", "Compute frequency spectra of finite discrete sequences.", ["DFT definition", "circular convolution", "FFT algorithm (radix-2)", "spectral leakage", "windowing"], 25),
    s("advanced", 1, "Adaptive Filters & Spectral Estimation", "Optimize filters in real time and estimate power spectra.", ["LMS algorithm", "RLS algorithm", "Wiener filter", "periodogram", "Bartlett & Welch methods"], 25),
    s("next_gen", 1, "Open Science in Signal Processing", "Propose open datasets, reproducible audio/image benchmarks, or open-source DSP toolkits.", ["open audio datasets (AudioSet, FSD)", "reproducible image processing benchmarks", "GNU Radio / Liquid DSP", "open hardware SDR"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 50 — Control Systems
// ─────────────────────────────────────────────────────────────────────────────
const syllabus50: TopicSyllabus = {
  topicId: 50,
  topicTitle: "Control Systems",
  contentType: "formula_heavy",
  units: [
    s("beginner", 1, "Feedback Control Fundamentals", "Understand how feedback reduces error and improves system performance.", ["open-loop vs closed-loop", "reference / error / output", "negative feedback benefits", "block diagram algebra"], 20),
    s("beginner", 2, "System Modeling", "Represent physical systems with differential equations and transfer functions.", ["mechanical systems (mass-spring-damper)", "electrical circuits", "thermal systems", "transfer function G(s)", "pole-zero plots"], 20),
    s("beginner", 3, "Time-Domain Analysis", "Characterize system response to inputs using first- and second-order models.", ["step response", "first-order systems (time constant)", "second-order systems (ζ, ω_n)", "overshoot / settling time / rise time", "steady-state error"], 20),
    s("intermediate", 1, "Stability Analysis", "Determine whether a system returns to equilibrium after a disturbance.", ["BIBO stability", "Routh-Hurwitz criterion", "root locus (basics)", "Nyquist stability criterion"], 25),
    s("intermediate", 2, "PID Controller Design", "Tune proportional, integral, and derivative gains for desired performance.", ["proportional control", "integral control (eliminate steady-state error)", "derivative control (damping)", "Ziegler-Nichols tuning", "practical implementation issues"], 25),
    s("intermediate", 3, "Frequency-Domain Design", "Use Bode and Nyquist plots to design controllers.", ["Bode plots (magnitude & phase)", "gain & phase margins", "lead & lag compensators", "bandwidth & resonance"], 25),
    s("advanced", 1, "State-Space Methods", "Represent and control multi-input multi-output systems using matrices.", ["state-space representation (x_dot = Ax + Bu)", "controllability & observability", "state feedback & pole placement", "Luenberger observer", "LQR optimal control"], 25),
    s("next_gen", 1, "Open Science in Control", "Propose open robotics platforms, reproducible control benchmarks, or safety-certified open controllers.", ["open robotics (ROS, Gazebo)", "reproducible control benchmarks", "open-source PLC alternatives", "formal verification of controllers"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 51 — React & Modern Frontend
// ─────────────────────────────────────────────────────────────────────────────
const syllabus51: TopicSyllabus = {
  topicId: 51,
  topicTitle: "React & Modern Frontend",
  contentType: "code_heavy",
  units: [
    s("beginner", 1, "React Fundamentals", "Build user interfaces with components, props, and state.", ["JSX syntax", "functional components", "props & composition", "useState & useEffect", "conditional rendering"], 20),
    s("beginner", 2, "Event Handling & Forms", "Capture user input and manage form state in React.", ["event handlers", "controlled vs uncontrolled components", "form validation basics", "lifting state up"], 20),
    s("beginner", 3, "Lists, Keys & Conditional Rendering", "Render dynamic collections and handle empty or loading states.", ["rendering lists", "key prop importance", "filter / map / reduce in JSX", "loading & error states"], 20),
    s("intermediate", 1, "Hooks Deep Dive", "Master useEffect, useContext, useRef, and custom hooks.", ["useEffect dependencies & cleanup", "useContext for global state", "useRef & DOM access", "custom hooks", "rules of hooks"], 25),
    s("intermediate", 2, "State Management", "Scale state beyond useState with Context, Redux, or Zustand.", ["Context API patterns", "Redux (actions, reducers, store)", "Zustand", "React Query for server state", "state normalization"], 25),
    s("intermediate", 3, "Routing & Navigation", "Build multi-page SPAs with client-side routing.", ["React Router", "dynamic routes", "nested routes", "programmatic navigation", "protected routes"], 25),
    s("advanced", 1, "Performance Optimization", "Eliminate unnecessary renders and optimize bundle size.", ["React.memo & useMemo", "useCallback", "code splitting (lazy, Suspense)", "virtualization (react-window)", "profiling"], 25),
    s("next_gen", 1, "Open Science in Frontend", "Propose accessibility audits, open design systems, or reproducible UX measurement tools.", ["WCAG compliance testing", "open design systems (Carbon, Polaris)", "performance budget tools", "open-source component testing"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 52 — Node.js & Backend APIs
// ─────────────────────────────────────────────────────────────────────────────
const syllabus52: TopicSyllabus = {
  topicId: 52,
  topicTitle: "Node.js & Backend APIs",
  contentType: "code_heavy",
  units: [
    s("beginner", 1, "Node.js Fundamentals", "Write server-side JavaScript using the event loop and built-in modules.", ["event loop & non-blocking I/O", "modules (CommonJS & ESM)", "fs & path", "HTTP module", "npm & package management"], 20),
    s("beginner", 2, "Express.js Basics", "Build RESTful APIs with routing, middleware, and request handling.", ["routing (GET, POST, PUT, DELETE)", "middleware stack", "req / res objects", "error handling middleware", "static files"], 20),
    s("beginner", 3, "Database Integration", "Connect Node.js apps to SQL and NoSQL databases.", ["SQL drivers (pg, mysql2)", "NoSQL drivers (mongoose)", "connection pooling", "basic CRUD", "environment variables"], 20),
    s("intermediate", 1, "Authentication & Security", "Protect APIs with JWT, sessions, and secure headers.", ["JWT (sign / verify)", "bcrypt hashing", "passport.js strategies", "helmet.js", "CORS configuration", "rate limiting"], 25),
    s("intermediate", 2, "API Design Patterns", "Structure robust, versioned, and documented APIs.", ["RESTful conventions", "API versioning", "pagination", "validation (Zod, Joi)", "OpenAPI / Swagger"], 25),
    s("intermediate", 3, "Async Patterns & Error Handling", "Manage concurrency and failures gracefully.", ["Promises & async/await", "Promise.all / race", "try/catch patterns", "circuit breaker pattern", "retry logic"], 25),
    s("advanced", 1, "Scaling & Deployment", "Deploy Node.js apps with clustering, containers, and serverless.", ["cluster module", "PM2 process manager", "Docker & Docker Compose", "serverless (AWS Lambda)", "CI/CD pipelines"], 25),
    s("next_gen", 1, "Open Science in Backend Development", "Propose open API standards, transparent logging, or reproducible backend benchmarks.", ["OpenAPI standards", "structured logging (OpenTelemetry)", "reproducible load testing", "open-source PaaS alternatives"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 53 — Databases & SQL
// ─────────────────────────────────────────────────────────────────────────────
const syllabus53: TopicSyllabus = {
  topicId: 53,
  topicTitle: "Databases & SQL",
  contentType: "code_heavy",
  units: [
    s("beginner", 1, "Relational Database Concepts", "Model data with tables, keys, and relationships.", ["tables, rows, columns", "primary keys", "foreign keys", "one-to-one / one-to-many / many-to-many", "normalization (1NF-3NF)"], 20),
    s("beginner", 2, "SQL Fundamentals", "Query data using SELECT, INSERT, UPDATE, and DELETE.", ["SELECT & WHERE", "ORDER BY & LIMIT", "JOINs (INNER, LEFT, RIGHT)", "GROUP BY & HAVING", "aggregate functions"], 20),
    s("beginner", 3, "Database Design", "Create schemas that avoid redundancy and ensure integrity.", ["ER diagrams", "normalization process", "indexes (B-tree)", "constraints (UNIQUE, NOT NULL, CHECK)", "transactions (ACID)"], 20),
    s("intermediate", 1, "Advanced SQL", "Write subqueries, window functions, and CTEs for complex analytics.", ["subqueries (correlated & non-correlated)", "window functions (ROW_NUMBER, RANK, LEAD, LAG)", "CTEs (WITH clauses)", "pivoting & unpivoting"], 25),
    s("intermediate", 2, "NoSQL Databases", "Choose document, key-value, graph, or wide-column stores for flexible schemas.", ["MongoDB (documents)", "Redis (key-value)", "Neo4j (graph)", "Cassandra (wide-column)", "CAP theorem"], 25),
    s("intermediate", 3, "Query Optimization", "Speed up slow queries using indexes, execution plans, and denormalization.", ["EXPLAIN & EXPLAIN ANALYZE", "index selection", "query rewriting", "partitioning", "caching strategies"], 25),
    s("advanced", 1, "Transactions, Concurrency & Replication", "Ensure consistency under concurrent access and distribute data.", ["isolation levels", "deadlock detection", "MVCC", "master-slave replication", "sharding strategies"], 25),
    s("next_gen", 1, "Open Science in Data Management", "Propose open database benchmarks, reproducible query workloads, or open data lakes.", ["TPC benchmarks", "reproducible query workloads", "open data lakes (Delta Lake, Iceberg)", "FAIR data principles"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 54 — Cryptography
// ─────────────────────────────────────────────────────────────────────────────
const syllabus54: TopicSyllabus = {
  topicId: 54,
  topicTitle: "Cryptography",
  contentType: "theory_heavy",
  units: [
    s("beginner", 1, "Classical Ciphers", "Understand substitution, transposition, and the foundations of secret writing.", ["Caesar cipher", "Vigenère cipher", "frequency analysis", "one-time pad (perfect secrecy)", "Kerckhoffs's principle"], 20),
    s("beginner", 2, "Symmetric Encryption", "Use shared keys for fast, confidential communication.", ["block ciphers (AES)", "modes of operation (ECB, CBC, GCM)", "stream ciphers (ChaCha20)", "key exchange problem"], 20),
    s("beginner", 3, "Public-Key Cryptography", "Enable secure communication without shared secrets.", ["RSA algorithm", "Diffie-Hellman key exchange", "elliptic curve cryptography (ECC)", "hybrid encryption"], 20),
    s("intermediate", 1, "Cryptographic Hashing & MACs", "Ensure integrity and authenticity with one-way functions.", ["SHA-256 / SHA-3", "collision resistance", "HMAC", "password hashing (Argon2, bcrypt)", "Merkle trees"], 25),
    s("intermediate", 2, "Digital Signatures & Certificates", "Verify identity and non-repudiation in digital transactions.", ["RSA & ECDSA signatures", "X.509 certificates", "certificate chains", "PKI & trust anchors", "revocation (CRL, OCSP)"], 25),
    s("intermediate", 3, "Cryptographic Protocols", "Analyze how TLS, VPNs, and secure messaging work.", ["TLS handshake", "perfect forward secrecy", "VPN protocols (WireGuard, OpenVPN)", "end-to-end encryption (Signal protocol)"], 25),
    s("advanced", 1, "Zero-Knowledge Proofs", "Prove statements without revealing underlying data.", ["interactive proofs", "zk-SNARKs intuition", "zk-STARKs intuition", "applications (blockchain, identity)"], 25),
    s("next_gen", 1, "Open Science in Cryptography", "Propose open cryptanalysis challenges, transparent security audits, or post-quantum standardization research.", ["NIST post-quantum standards", "open cryptanalysis (Capture The Flag)", "reproducible security proofs", "open-source HSM alternatives"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 55 — Network Security
// ─────────────────────────────────────────────────────────────────────────────
const syllabus55: TopicSyllabus = {
  topicId: 55,
  topicTitle: "Network Security",
  contentType: "code_heavy",
  units: [
    s("beginner", 1, "Network Fundamentals for Security", "Understand TCP/IP, OSI, and common network protocols.", ["OSI & TCP/IP layers", "IP addressing & subnetting", "TCP vs UDP", "common ports", "packet sniffing basics"], 20),
    s("beginner", 2, "Threat Landscape", "Classify attackers, motives, and common attack vectors.", ["malware types (virus, worm, trojan, ransomware)", "phishing & social engineering", "DDoS", "insider threats", "APT lifecycle"], 20),
    s("beginner", 3, "Firewalls & Network Segmentation", "Control traffic flow and isolate critical assets.", ["packet-filtering firewalls", "stateful inspection", "DMZ", "VLANs", "zero-trust architecture (basics)"], 20),
    s("intermediate", 1, "Intrusion Detection & Prevention", "Monitor networks for malicious activity and respond automatically.", ["IDS vs IPS", "signature vs anomaly detection", "SIEM", "honey pots & honey nets", "log analysis"], 25),
    s("intermediate", 2, "Web Application Security", "Protect web apps from the OWASP Top 10 and beyond.", ["SQL injection", "XSS (stored, reflected, DOM)", "CSRF", "insecure deserialization", "security headers"], 25),
    s("intermediate", 3, "Wireless Security", "Secure Wi-Fi and identify rogue access points.", ["WPA2 / WPA3", "evil twin attacks", "wireless sniffing", "Bluetooth vulnerabilities", "RFID & NFC security"], 25),
    s("advanced", 1, "Penetration Testing & Ethical Hacking", "Systematically probe systems for weaknesses with permission.", ["reconnaissance & scanning", "vulnerability assessment", "exploitation frameworks (Metasploit)", "post-exploitation", "reporting & remediation"], 25),
    s("next_gen", 1, "Open Science in Cybersecurity", "Propose open threat intelligence sharing, reproducible security benchmarks, or transparent incident disclosure.", ["MITRE ATT&CK framework", "open threat intelligence (MISP)", "reproducible exploit research", "responsible disclosure"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 56 — Deep Learning
// ─────────────────────────────────────────────────────────────────────────────
const syllabus56: TopicSyllabus = {
  topicId: 56,
  topicTitle: "Deep Learning",
  contentType: "code_heavy",
  units: [
    s("beginner", 1, "Deep Learning Foundations", "Understand why depth matters and how to train deep networks.", ["universal approximation vs depth efficiency", "vanishing & exploding gradients", "ReLU & variants", "weight initialization (Xavier, He)", "batch normalization"], 20),
    s("beginner", 2, "Convolutional Neural Networks", "Build image classifiers and object detectors with convolutions.", ["convolution operation", "padding & stride", "pooling", "CNN architectures (LeNet → ResNet)", "transfer learning"], 20),
    s("beginner", 3, "Sequence Models", "Process text, audio, and time series with RNNs and LSTMs.", ["RNN unrolling", "LSTM gates", "GRU", "bidirectional RNNs", "sequence-to-sequence"], 20),
    s("intermediate", 1, "Attention & Transformers", "Replace recurrence with self-attention for parallelizable, long-range modeling.", ["self-attention mechanism", "multi-head attention", "positional encoding", "transformer encoder-decoder", "BERT & GPT families"], 25),
    s("intermediate", 2, "Training at Scale", "Handle large datasets, large models, and distributed training.", ["data parallelism", "model parallelism", "mixed precision training", "gradient accumulation", "checkpointing"], 25),
    s("intermediate", 3, "Generative Deep Learning", "Synthesize images, text, and audio with generative models.", ["VAE (reparameterization trick)", "GANs (generator & discriminator)", "diffusion models", "autoregressive models (PixelCNN, GPT)"], 25),
    s("advanced", 1, "Neural Architecture Search & AutoML", "Automate the design of network architectures.", ["search spaces", "RL-based NAS", "differentiable NAS (DARTS)", "EfficientNet scaling", "hardware-aware NAS"], 25),
    s("next_gen", 1, "Open Science in Deep Learning", "Address reproducibility, open model evaluation, and environmental impact transparency.", ["ML reproducibility checklist", "open leaderboards", "carbon footprint reporting", "open model weights & datasets"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 57 — Reinforcement Learning
// ─────────────────────────────────────────────────────────────────────────────
const syllabus57: TopicSyllabus = {
  topicId: 57,
  topicTitle: "Reinforcement Learning",
  contentType: "code_heavy",
  units: [
    s("beginner", 1, "RL Fundamentals", "Model decision-making as interactions between an agent and an environment.", ["agent / environment / state / action / reward", "policy (π)", "value functions (V, Q)", "MDP formalism", "discount factor γ"], 20),
    s("beginner", 2, "Dynamic Programming", "Solve MDPs exactly when the model is known.", ["policy evaluation", "policy improvement", "policy iteration", "value iteration", "Bellman equations"], 20),
    s("beginner", 3, "Model-Free Prediction & Control", "Learn value functions and policies without knowing the environment dynamics.", ["Monte Carlo methods", "TD(0)", "SARSA", "Q-learning", "on-policy vs off-policy"], 20),
    s("intermediate", 1, "Function Approximation", "Generalize to large or continuous state spaces using neural networks.", ["linear function approximation", "DQN (experience replay, target networks)", "Double DQN", "Dueling DQN", "prioritized replay"], 25),
    s("intermediate", 2, "Policy Gradient Methods", "Optimize policies directly via gradient ascent.", ["REINFORCE", "actor-critic architecture", "A3C", "PPO (clipped objective)", "TRPO (trust region)"], 25),
    s("intermediate", 3, "Advanced Topics", "Explore model-based RL, hierarchical RL, and multi-agent settings.", ["Dyna-Q & model-based planning", "hierarchical RL (options framework)", "curiosity-driven exploration", "multi-agent RL"], 25),
    s("advanced", 1, "RL in Practice", "Deploy RL systems with simulators, reward shaping, and safety constraints.", ["sim-to-real transfer", "reward shaping & inverse RL", "safe RL", "offline RL (batch RL)", "RLHF"], 25),
    s("next_gen", 1, "Open Science in RL", "Propose open benchmarks, reproducible agent evaluations, and safety testbeds.", ["OpenAI Gym / Gymnasium", "reproducible RL benchmarks", "safety gym", "open-source MuJoCo alternatives"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 58 — Computer Vision
// ─────────────────────────────────────────────────────────────────────────────
const syllabus58: TopicSyllabus = {
  topicId: 58,
  topicTitle: "Computer Vision",
  contentType: "code_heavy",
  units: [
    s("beginner", 1, "Image Representation", "Understand how digital images are stored and manipulated.", ["pixels & color channels", "grayscale vs RGB", "image filtering (convolution)", "edge detection (Sobel, Canny)", "image transformations (scale, rotate)"], 20),
    s("beginner", 2, "Traditional Feature Extraction", "Describe images using handcrafted features before deep learning.", ["HOG", "SIFT", "ORB", "color histograms", "feature matching"], 20),
    s("beginner", 3, "Image Classification with CNNs", "Train deep networks to categorize images.", ["ImageNet & pretrained models", "fine-tuning", "data augmentation", "evaluation metrics (top-1, top-5)"], 20),
    s("intermediate", 1, "Object Detection", "Locate and classify multiple objects in an image.", ["R-CNN family", "YOLO (single-shot)", "SSD", "anchor boxes", "NMS (non-maximum suppression)"], 25),
    s("intermediate", 2, "Segmentation", "Classify each pixel to understand image composition.", ["semantic segmentation", "instance segmentation", "U-Net architecture", "Mask R-CNN", "dice loss & IoU"], 25),
    s("intermediate", 3, "Video & Motion Analysis", "Extend vision to temporal sequences.", ["optical flow", "object tracking", "3D CNNs", "RNNs for video", "action recognition"], 25),
    s("advanced", 1, "Advanced Vision Architectures", "Survey Vision Transformers, self-supervised learning, and generative models.", ["Vision Transformer (ViT)", "Swin Transformer", "self-supervised pretraining (SimCLR, MoCo)", "diffusion models for images"], 25),
    s("next_gen", 1, "Open Science in Computer Vision", "Address dataset bias, open benchmarks, and reproducible vision research.", ["ImageNet bias critique", "open datasets (Open Images, COCO)", "reproducible training pipelines", "open model zoos"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 59 — Natural Language Processing
// ─────────────────────────────────────────────────────────────────────────────
const syllabus59: TopicSyllabus = {
  topicId: 59,
  topicTitle: "Natural Language Processing",
  contentType: "code_heavy",
  units: [
    s("beginner", 1, "Text Preprocessing", "Clean and normalize text for downstream tasks.", ["tokenization", "stop word removal", "stemming & lemmatization", "regular expressions", "lowercasing & normalization"], 20),
    s("beginner", 2, "Text Representation", "Convert text into numerical vectors.", ["bag-of-words", "TF-IDF", "n-grams", "one-hot encoding", "word embeddings (Word2Vec, GloVe)"], 20),
    s("beginner", 3, "Text Classification", "Assign categories to documents using machine learning.", ["Naive Bayes", "logistic regression for text", "RNNs for classification", "CNNs for text", "evaluation (accuracy, F1)"], 20),
    s("intermediate", 1, "Sequence Labeling", "Tag words with grammatical or semantic labels.", ["POS tagging", "named entity recognition (NER)", "chunking", "CRFs", "BiLSTM-CRF"], 25),
    s("intermediate", 2, "Machine Translation & Summarization", "Transform text from one language or length to another.", ["seq2seq with attention", "transformer MT", "extractive summarization", "abstractive summarization", "ROUGE & BLEU"], 25),
    s("intermediate", 3, "Pretrained Language Models", "Leverage BERT, GPT, and T5 for downstream NLP tasks.", ["BERT (masked LM, fine-tuning)", "GPT (autoregressive generation)", "T5 (text-to-text)", "prompt engineering", "few-shot learning"], 25),
    s("advanced", 1, "Information Extraction & Retrieval", "Build systems that find and structure information from text.", ["relation extraction", "knowledge graph construction", "semantic search", "dense retrieval (DPR)", "question answering"], 25),
    s("next_gen", 1, "Open Science in NLP", "Advocate for dataset documentation, model cards, and multilingual open resources.", ["datasheets for datasets", "model cards", "open multilingual corpora", "reproducible NLP benchmarks"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 60 — Data Visualization
// ─────────────────────────────────────────────────────────────────────────────
const syllabus60: TopicSyllabus = {
  topicId: 60,
  topicTitle: "Data Visualization",
  contentType: "visual_heavy",
  units: [
    s("beginner", 1, "Visualization Principles", "Choose the right chart for your data and audience.", ["bar / line / scatter / pie (when to use)", "data-ink ratio", "chart junk", "visual hierarchy", "accessibility (alt text, color)"], 20),
    s("beginner", 2, "Tools & Libraries", "Create static and interactive visualizations with popular tools.", ["Matplotlib / Seaborn", "D3.js basics", "Tableau / Power BI", "Plotly", "Observable / Vega-Lite"], 20),
    s("beginner", 3, "Color, Typography & Annotation", "Enhance readability and guide interpretation.", ["color palettes (ColorBrewer)", "direct labeling", "annotations & callouts", "scales (linear, log, ordinal)", "legends & titles"], 20),
    s("intermediate", 1, "Interactive & Web Visualizations", "Build dashboards and exploratory tools.", ["tooltips & brushing", "linked views", "dashboard layout", "responsive design", "performance (Canvas vs SVG)"], 25),
    s("intermediate", 2, "Geospatial Visualization", "Map data to geographic locations.", ["choropleth maps", "bubble maps", "heatmap overlays", "projections (Mercator, Albers)", "GeoJSON & TopoJSON"], 25),
    s("intermediate", 3, "Narrative & Storytelling", "Communicate insights through sequenced visual narratives.", ["story structure", "scrollytelling", "animated transitions", "audience adaptation", "ethical visualization"], 25),
    s("advanced", 1, "Visualization Research", "Evaluate perceptual effectiveness and design novel encodings.", ["perceptual pipelines (Mackinlay)", "user studies", "visual encoding ranking", "uncertainty visualization", "multivariate visualization"], 25),
    s("next_gen", 1, "Open Science in Visualization", "Propose open visualization benchmarks, reproducible figure pipelines, or accessible data comics.", ["reproducible figure generation", "open visualization datasets", "accessibility standards", "open peer review of visualizations"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 61 — Astrobiology
// ─────────────────────────────────────────────────────────────────────────────
const syllabus61: TopicSyllabus = {
  topicId: 61,
  topicTitle: "Astrobiology",
  contentType: "concept_heavy",
  units: [
    s("beginner", 1, "The Habitable Zone", "Define where liquid water can exist and why it matters for life.", ["stellar luminosity & distance", "circumstellar habitable zone", "tidal locking effects", "alternative solvents"], 20),
    s("beginner", 2, "Extremophiles", "Study Earth organisms that thrive in extreme conditions and expand our notion of habitability.", ["thermophiles & hyperthermophiles", "psychrophiles", "acidophiles & alkaliphiles", "radiotolerance", "astrobiological implications"], 20),
    s("beginner", 3, "Biosignatures & Detection Methods", "Identify chemical or structural markers that indicate life.", ["atmospheric biosignatures (O2, CH4)", "spectroscopy (transmission, reflection)", "false positives (abiotic O2)", "direct imaging challenges"], 20),
    s("intermediate", 1, "Planetary Environments", "Compare Mars, Europa, Enceladus, and exoplanets as potential habitats.", ["Mars past habitability", "Europa's subsurface ocean", "Enceladus plumes", "exoplanet atmospheres (JWST)", "Venus cloud habitability"], 25),
    s("intermediate", 2, "Origin of Life Theories", "Survey hypotheses for how life began on Earth.", ["RNA world hypothesis", "hydrothermal vents", "panspermia", "metabolism-first vs replication-first", "prebiotic chemistry"], 25),
    s("intermediate", 3, "SETI & Technosignatures", "Search for extraterrestrial intelligence and technological civilizations.", ["radio SETI", "optical SETI", "Dyson spheres & megastructures", "technosignature classification", "Great Filter discussion"], 25),
    s("advanced", 1, "Planetary Protection & Ethics", "Prevent biological contamination during space exploration.", ["COSPAR categories", "forward & backward contamination", "ethical implications of discovery", "post-detection protocols"], 25),
    s("next_gen", 1, "Open Science in Astrobiology", "Propose open exoplanet databases, shared spectroscopic models, or global SETI data sharing.", ["open exoplanet catalog", "shared atmospheric models", "SETI open data (Breakthrough Listen)", "citizen science (SETI@home successors)"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 62 — Stellar Evolution
// ─────────────────────────────────────────────────────────────────────────────
const syllabus62: TopicSyllabus = {
  topicId: 62,
  topicTitle: "Stellar Evolution",
  contentType: "theory_heavy",
  units: [
    s("beginner", 1, "The Interstellar Medium & Star Formation", "Understand how clouds of gas and dust collapse to form stars.", ["molecular clouds", "Jeans mass & instability", "protostars", "accretion disks", "bipolar outflows"], 20),
    s("beginner", 2, "Main Sequence Stars", "Explore the stable phase where stars fuse hydrogen in their cores.", ["hydrostatic equilibrium", "nuclear fusion (proton-proton chain, CNO cycle)", "mass-luminosity relation", "main-sequence lifetime"], 20),
    s("beginner", 3, "Stellar Classification", "Categorize stars by temperature, color, and spectral features.", ["Hertzsprung-Russell diagram", "spectral types (OBAFGKM)", "luminosity classes", "color-magnitude diagrams"], 20),
    s("intermediate", 1, "Post-Main Sequence Evolution", "Trace the life of a star after core hydrogen exhaustion.", ["red giant branch", "helium flash", "horizontal branch", "asymptotic giant branch", "planetary nebulae"], 25),
    s("intermediate", 2, "Stellar Remnants", "Study white dwarfs, neutron stars, and black holes as endpoints of stellar evolution.", ["white dwarfs & Chandrasekhar limit", "neutron stars & degeneracy pressure", "pulsars", "black hole formation", "event horizon"], 25),
    s("intermediate", 3, "Nucleosynthesis", "Understand how stars forge elements heavier than hydrogen and helium.", ["primordial nucleosynthesis", "stellar nucleosynthesis (s-process)", "supernova nucleosynthesis (r-process)", "cosmic abundances"], 25),
    s("advanced", 1, "Binary Star Evolution", "Analyze how stellar pairs interact and transfer mass.", ["Roche lobe overflow", "accretion & X-ray binaries", "type Ia supernovae (white dwarf accretion)", "common envelope evolution"], 25),
    s("next_gen", 1, "Open Questions in Stellar Astrophysics", "Propose research on stellar magnetism, convection, or gravitational wave progenitors.", ["stellar dynamo & magnetic fields", "3D convection simulations", "gravitational wave sources", "open stellar evolution codes (MESA)"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 63 — Cosmology
// ─────────────────────────────────────────────────────────────────────────────
const syllabus63: TopicSyllabus = {
  topicId: 63,
  topicTitle: "Cosmology",
  contentType: "theory_heavy",
  units: [
    s("beginner", 1, "The Big Bang & Expansion", "Model the origin and evolution of the universe.", ["Friedmann equations", "cosmic expansion (Hubble's law)", "scale factor a(t)", "cosmic microwave background (CMB)", "nucleosynthesis timeline"], 20),
    s("beginner", 2, "The Geometry of the Universe", "Determine whether space is flat, open, or closed.", ["critical density", "density parameter Ω", "flatness problem", "spatial curvature", "Friedmann-Robertson-Walker metric"], 20),
    s("beginner", 3, "Dark Matter & Dark Energy", "Confront the two dominant but mysterious components of the universe.", ["dark matter evidence (rotation curves, lensing)", "WIMPs & alternatives", "dark energy & accelerated expansion", "cosmological constant Λ", "equation of state w"], 20),
    s("intermediate", 1, "Inflation", "Explain the uniformity and flatness of the universe via exponential early expansion.", ["inflaton field", "solving flatness & horizon problems", "quantum fluctuations & structure formation", "reheating", "inflationary predictions"], 25),
    s("intermediate", 2, "Large-Scale Structure", "Map galaxies and voids to understand how structure grew from primordial seeds.", ["power spectrum P(k)", "correlation function", "dark matter halos", "baryon acoustic oscillations", "N-body simulations"], 25),
    s("intermediate", 3, "Cosmic Microwave Background", "Extract cosmological parameters from the relic radiation.", ["blackbody spectrum", "anisotropies (temperature & polarization)", "acoustic peaks", "Planck satellite results", "CMB polarization (B-modes)"], 25),
    s("advanced", 1, "Alternative Cosmologies & Open Problems", "Evaluate extensions to ΛCDM and remaining puzzles.", ["modified gravity (MOND, f(R))", "cosmological tensions (H0)", "multiverse speculations", "quantum gravity & the Big Bang singularity"], 25),
    s("next_gen", 1, "Open Science in Cosmology", "Propose open simulation codes, transparent parameter estimation, or citizen science galaxy classification.", ["open N-body codes (GADGET, AREPO)", "open CMB analysis tools", "Zooniverse galaxy projects", "reproducible cosmological inference"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 64 — CRISPR & Gene Editing
// ─────────────────────────────────────────────────────────────────────────────
const syllabus64: TopicSyllabus = {
  topicId: 64,
  topicTitle: "CRISPR & Gene Editing",
  contentType: "theory_heavy",
  units: [
    s("beginner", 1, "The CRISPR-Cas9 System", "Understand the bacterial immune system repurposed for genome editing.", ["spacer arrays & crRNA", "tracrRNA & guide RNA", "PAM sequence", "Cas9 nuclease domains (HNH, RuvC)", "double-strand break repair"], 20),
    s("beginner", 2, "Guide RNA Design", "Create effective gRNAs for precise targeting.", ["target selection", "off-target prediction", "gRNA efficiency scores", "secondary structure considerations", "validation methods"], 20),
    s("beginner", 3, "DNA Repair Pathways", "Harness NHEJ and HDR to achieve desired edits.", ["non-homologous end joining (NHEJ)", "insertions & deletions (indels)", "homology-directed repair (HDR)", "donor template design", "repair pathway choice"], 20),
    s("intermediate", 1, "Delivery Methods", "Get editing machinery into cells efficiently and safely.", ["plasmid transfection", "viral vectors (AAV, lentivirus)", "RNP complexes", "electroporation", "cell-type specific challenges"], 25),
    s("intermediate", 2, "Applications in Research & Medicine", "Survey disease models, functional genomics, and therapeutic trials.", ["knockout cell lines & animals", "CRISPR screens", "base editing", "prime editing", "CAR-T enhancements", "sickle cell therapy (Casgevy)"], 25),
    s("intermediate", 3, "Off-Target Effects & Safety", "Detect and minimize unintended genome modifications.", ["GUIDE-seq & CIRCLE-seq", "whole-genome sequencing", "toxicity assessments", "immunogenicity"], 25),
    s("advanced", 1, "Ethics & Regulation", "Navigate the governance landscape for germline and somatic editing.", ["germline editing moratoria", "somatic vs germline distinction", "international regulatory frameworks", "equitable access concerns"], 25),
    s("next_gen", 1, "Open Science in Gene Editing", "Propose open gRNA libraries, shared validation data, or transparent clinical trial reporting.", ["open gRNA databases (Addgene)", "shared off-target datasets", "transparent trial registries", "global benefit-sharing agreements"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 65 — Bioinformatics
// ─────────────────────────────────────────────────────────────────────────────
const syllabus65: TopicSyllabus = {
  topicId: 65,
  topicTitle: "Bioinformatics",
  contentType: "code_heavy",
  units: [
    s("beginner", 1, "Biological Databases", "Navigate the major repositories of sequence, structure, and functional data.", ["NCBI & GenBank", "UniProt", "PDB (protein structures)", "Ensembl & UCSC Genome Browser", "KEGG & Gene Ontology"], 20),
    s("beginner", 2, "Sequence Alignment", "Compare DNA, RNA, and protein sequences to infer homology.", ["pairwise alignment (Needleman-Wunsch, Smith-Waterman)", "BLAST heuristic", "scoring matrices (BLOSUM, PAM)", "gap penalties", "E-values & significance"], 20),
    s("beginner", 3, "Phylogenetics", "Reconstruct evolutionary trees from molecular sequences.", ["distance methods (UPGMA, neighbor-joining)", "maximum parsimony", "maximum likelihood", "Bayesian inference (MrBayes)", "bootstrapping"], 20),
    s("intermediate", 1, "Genome Assembly & Annotation", "Reconstruct genomes from sequencing reads and identify genes.", ["read mapping (BWA, Bowtie)", "de novo assembly (SPAdes)", "scaffolding", "gene prediction (ab initio, evidence-based)", "functional annotation"], 25),
    s("intermediate", 2, "RNA-Seq & Differential Expression", "Quantify gene expression and identify regulated genes.", ["read quantification (STAR, HISAT2)", "count matrices", "normalization (TPM, DESeq2)", "differential expression testing", "pathway enrichment"], 25),
    s("intermediate", 3, "Variant Calling", "Identify genetic differences between individuals and reference genomes.", ["SNPs & indels", "variant calling pipeline (GATK)", "VCF format", "variant annotation (VEP, SnpEff)", "GWAS basics"], 25),
    s("advanced", 1, "Structural Bioinformatics", "Predict and analyze protein 3D structures.", ["homology modeling", "threading", "ab initio prediction (AlphaFold)", "molecular dynamics", "docking"], 25),
    s("next_gen", 1, "Open Science in Bioinformatics", "Advocate for open pipelines, reproducible workflows, and FAIR biological data.", ["Snakemake / Nextflow reproducibility", "FAIR data principles", "open bioinformatics notebooks", "community-driven benchmark challenges (CASP)"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 66 — Renewable Energy Systems
// ─────────────────────────────────────────────────────────────────────────────
const syllabus66: TopicSyllabus = {
  topicId: 66,
  topicTitle: "Renewable Energy Systems",
  contentType: "theory_heavy",
  units: [
    s("beginner", 1, "Solar Photovoltaics", "Convert sunlight directly into electricity using semiconductor devices.", ["photovoltaic effect", "p-n junction", "silicon cell types (mono, poly, thin-film)", "efficiency limits (Shockley-Queisser)", "I-V curve"], 20),
    s("beginner", 2, "Wind Energy", "Harness kinetic energy from air motion with turbine aerodynamics.", ["Betz limit (16/27)", "lift vs drag turbines", "wind resource assessment", "turbine components", "capacity factor"], 20),
    s("beginner", 3, "Energy Storage", "Store electricity for when generation and demand mismatch.", ["lithium-ion batteries", "flow batteries", "pumped hydro", "compressed air", "gravity storage"], 20),
    s("intermediate", 1, "Power Electronics & Grid Integration", "Convert and condition renewable power for the grid.", ["inverters (string, central, micro)", "MPPT", "grid-tie vs off-grid", "power quality", "grid codes"], 25),
    s("intermediate", 2, "Hybrid & Distributed Systems", "Combine multiple sources and manage decentralized generation.", ["hybrid renewable systems", "microgrids", "demand response", "virtual power plants", "peer-to-peer energy trading"], 25),
    s("intermediate", 3, "Life Cycle Assessment & Economics", "Evaluate the true cost and environmental impact of energy technologies.", ["LCA methodology", "carbon payback time", "LCOE (levelized cost of energy)", "subsidies & policy instruments", "just transition"], 25),
    s("advanced", 1, "Future Technologies", "Survey emerging generation and storage technologies.", ["perovskite solar cells", "floating offshore wind", "green hydrogen", "solid-state batteries", "nuclear fusion (ITER, tokamak)"], 25),
    s("next_gen", 1, "Open Science in Energy Research", "Propose open energy system models, transparent LCA data, or citizen science monitoring.", ["open energy models (PyPSA, OSeMOSYS)", "transparent LCA databases", "open meteorological data for wind/solar", "community energy ownership models"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 67 — Oceanography
// ─────────────────────────────────────────────────────────────────────────────
const syllabus67: TopicSyllabus = {
  topicId: 67,
  topicTitle: "Oceanography",
  contentType: "visual_heavy",
  units: [
    s("beginner", 1, "Ocean Basins & Bathymetry", "Map the underwater topography and structure of ocean floors.", ["continental shelf / slope / rise", "abyssal plains", "mid-ocean ridges", "trenches", "sonar mapping"], 20),
    s("beginner", 2, "Seawater Properties", "Understand salinity, temperature, density, and their global distribution.", ["salinity & dissolved salts", "temperature profiles", "thermocline", "density & stratification", "pH & ocean acidification"], 20),
    s("beginner", 3, "Ocean Currents", "Follow surface and deep currents driven by wind, temperature, and salinity.", ["wind-driven currents (Ekman transport)", "thermohaline circulation", "gyres", "upwelling & downwelling", "El Niño / La Niña"], 20),
    s("intermediate", 1, "Waves & Tides", "Analyze oscillatory and periodic sea level changes.", ["wave generation & propagation", "tsunami mechanics", "tidal forces (Moon & Sun)", "spring & neap tides", "tidal energy"], 25),
    s("intermediate", 2, "Marine Ecosystems", "Explore coastal and open ocean biological communities.", ["coral reefs", "kelp forests", "deep-sea vents", "pelagic zones", "food webs & trophic levels"], 25),
    s("intermediate", 3, "Human Impacts on Oceans", "Assess pollution, overfishing, and climate change effects.", ["plastic pollution", "overfishing & bycatch", "ocean warming & bleaching", "dead zones", "marine protected areas"], 25),
    s("advanced", 1, "Ocean Observation & Modeling", "Monitor and simulate the ocean using satellites, floats, and computers.", ["satellite altimetry", "Argo floats", "ocean general circulation models", "data assimilation", "regional vs global models"], 25),
    s("next_gen", 1, "Open Science in Oceanography", "Propose open ocean data portals, community monitoring, or transparent fishery management.", ["open ocean data ( Copernicus Marine)", "citizen science (reef monitoring)", "transparent stock assessments", "open-source ocean models"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 68 — Meteorology
// ─────────────────────────────────────────────────────────────────────────────
const syllabus68: TopicSyllabus = {
  topicId: 68,
  topicTitle: "Meteorology",
  contentType: "visual_heavy",
  units: [
    s("beginner", 1, "Atmosphere Composition & Structure", "Layer the atmosphere by temperature and function.", ["troposphere / stratosphere / mesosphere / thermosphere", "ozone layer", "greenhouse gases", "atmospheric pressure"], 20),
    s("beginner", 2, "Weather Variables", "Measure and interpret temperature, humidity, pressure, and wind.", ["temperature (dry-bulb, wet-bulb)", "relative vs absolute humidity", "dew point", "barometric pressure", "wind speed & direction"], 20),
    s("beginner", 3, "Clouds & Precipitation", "Classify cloud types and understand precipitation formation.", ["cloud classification (cumulus, stratus, cirrus)", "warm-cloud process", "Bergeron-Findeisen process", "precipitation types (rain, snow, hail)"], 20),
    s("intermediate", 1, "Pressure Systems & Fronts", "Predict weather by analyzing high/low pressure and frontal boundaries.", ["high vs low pressure", "cold / warm / occluded fronts", "jet streams", "cyclogenesis"], 25),
    s("intermediate", 2, "Severe Weather", "Understand thunderstorms, tornadoes, and hurricanes.", ["thunderstorm formation", "tornado genesis (supercells)", "Saffir-Simpson scale", "storm surge", "warning systems"], 25),
    s("intermediate", 3, "Weather Forecasting", "Predict future weather using observations and numerical models.", ["synoptic chart interpretation", "numerical weather prediction (NWP)", "ensemble forecasting", "forecast verification", "nowcasting"], 25),
    s("advanced", 1, "Climate Connections", "Link short-term weather to long-term climate patterns.", ["teleconnections (NAO, ENSO, PDO)", "seasonal forecasting", "climate model downscaling", "extreme event attribution"], 25),
    s("next_gen", 1, "Open Science in Meteorology", "Propose open weather data sharing, citizen weather networks, or reproducible forecast verification.", ["open weather data (NOAA, ECMWF)", "citizen weather stations (Weather Underground)", "reproducible forecast benchmarks", "open-source radar analysis (Py-ART)"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 69 — Game Theory
// ─────────────────────────────────────────────────────────────────────────────
const syllabus69: TopicSyllabus = {
  topicId: 69,
  topicTitle: "Game Theory",
  contentType: "theory_heavy",
  units: [
    s("beginner", 1, "Games & Strategies", "Model strategic interactions with players, strategies, and payoffs.", ["players / strategies / payoffs", "normal form vs extensive form", "dominant strategies", " dominated strategies", "common knowledge"], 20),
    s("beginner", 2, "Nash Equilibrium", "Find stable outcomes where no player can benefit by unilaterally changing strategy.", ["best response", "pure strategy Nash equilibrium", "mixed strategies", "existence (Nash's theorem)", "coordination games"], 20),
    s("beginner", 3, "Classic Games", "Analyze the Prisoner's Dilemma, Battle of the Sexes, and Chicken.", ["Prisoner's Dilemma", "Battle of the Sexes", "Chicken", "Stag Hunt", "repeated games & cooperation"], 20),
    s("intermediate", 1, "Extensive Form Games & Backward Induction", "Solve sequential games using game trees.", ["game trees", "subgame perfect equilibrium", "backward induction", "commitment strategies", "first-mover advantage"], 25),
    s("intermediate", 2, "Auctions & Mechanism Design", "Design rules that elicit truthful behavior and maximize welfare.", ["types of auctions (English, Dutch, sealed-bid)", "revenue equivalence theorem", "Vickrey auction", "Gibbard-Satterthwaite theorem", "incentive compatibility"], 25),
    s("intermediate", 3, "Cooperative Game Theory", "Analyze binding agreements and fair division.", ["coalitions", "characteristic function", "Shapley value", "core", "bargaining solutions (Nash)"], 25),
    s("advanced", 1, "Evolutionary & Behavioral Game Theory", "Apply game theory to biology and bounded rationality.", ["evolutionarily stable strategies (ESS)", "replicator dynamics", "bounded rationality", "learning in games", "quantal response equilibrium"], 25),
    s("next_gen", 1, "Open Science in Game Theory", "Propose open experimental economics platforms, reproducible simulation code, or policy mechanism design studies.", ["open experimental platforms (oTree)", "reproducible agent-based models", "policy mechanism design (carbon markets)", "open game theory textbooks & courses"], 30),
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 70 — Metallurgy
// ─────────────────────────────────────────────────────────────────────────────
const syllabus70: TopicSyllabus = {
  topicId: 70,
  topicTitle: "Metallurgy",
  contentType: "theory_heavy",
  units: [
    s("beginner", 1, "Crystal Structures & Defects", "Understand how atoms arrange in metals and how defects influence properties.", ["unit cells (BCC, FCC, HCP)", "atomic packing factor", "point defects (vacancies, interstitials)", "dislocations (edge & screw)", "grain boundaries"], 20),
    s("beginner", 2, "Phase Diagrams", "Read binary phase diagrams to predict alloy microstructures.", [" unary phase diagrams", "binary isomorphous", "eutectic systems", "lever rule", "solid solutions & intermetallics"], 20),
    s("beginner", 3, "Mechanical Properties", "Measure and interpret strength, ductility, hardness, and toughness.", ["stress-strain curve", "yield strength & ultimate tensile strength", "ductility & percent elongation", "hardness tests (Rockwell, Vickers, Brinell)", "toughness & fracture"], 20),
    s("intermediate", 1, "Heat Treatment", "Alter microstructure and properties through controlled heating and cooling.", ["annealing", "normalizing", "quenching & tempering", "austenitizing", "TTT & CCT diagrams"], 25),
    s("intermediate", 2, "Alloying & Strengthening Mechanisms", "Improve metal performance through composition and processing.", ["solid solution strengthening", "precipitation hardening", "work hardening (strain hardening)", "grain refinement", "dispersion strengthening"], 25),
    s("intermediate", 3, "Corrosion & Protection", "Understand degradation mechanisms and prevention strategies.", ["galvanic corrosion", "passivation", "oxidation kinetics", "cathodic protection", "coatings & inhibitors"], 25),
    s("advanced", 1, "Advanced Materials", "Survey superalloys, shape-memory alloys, and metallic glasses.", ["Ni-based superalloys", "titanium alloys", "shape-memory alloys (NiTi)", "metallic glasses", "high-entropy alloys"], 25),
    s("next_gen", 1, "Open Science in Materials Research", "Propose open materials databases, reproducible processing protocols, or sustainable metallurgy studies.", ["Materials Project / AFLOW", "reproducible heat treatment protocols", "sustainable mining & recycling", "open-access metallurgy journals"], 30),
  ],
};

export const SYLLABI: TopicSyllabus[] = [
  syllabusML,
  syllabusLinAlg,
  syllabusDS,
  syllabusQM,
  syllabusCalc,
  syllabusGraph,
  syllabusAlgo,
  syllabusNN,
  syllabusHF,
  syllabusGradio,
  syllabusOSS,
  syllabusClassMech,
  syllabusOrbital,
  syllabusOptics,
  syllabusFluid,
  syllabusEM,
  syllabusWaves,
  syllabusGenChem,
  syllabusOrgChem,
  syllabusMusic,
  syllabusProbStat,
  syllabusDiffEq,
  syllabusThermo,
  syllabusStatMech,
  syllabusCellBio,
  syllabusGenetics,
  syllabusEcology,
  syllabusEvoBio,
  syllabusClimate,
  syllabusGeology,
  syllabus31, syllabus32, syllabus33, syllabus34, syllabus35, syllabus36, syllabus37, syllabus38, syllabus39,
  syllabus40, syllabus41, syllabus42, syllabus43, syllabus44, syllabus45, syllabus46, syllabus47, syllabus48,
  syllabus49, syllabus50, syllabus51, syllabus52, syllabus53, syllabus54, syllabus55, syllabus56, syllabus57,
  syllabus58, syllabus59, syllabus60, syllabus61, syllabus62, syllabus63, syllabus64, syllabus65, syllabus66,
  syllabus67, syllabus68, syllabus69, syllabus70,
];

export const SYLLABI_MAP = new Map<number, TopicSyllabus>(
  SYLLABI.map((s) => [s.topicId, s])
);
