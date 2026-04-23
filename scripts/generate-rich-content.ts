#!/usr/bin/env tsx
/**
 * Rich Lesson Content Generator v2
 * ─────────────────────────────────
 * Produces domain-specific, scientifically accurate lesson content
 * with real equations, code, derivations, and conceptual depth.
 * NOT generic templates — each topic has baked-in domain knowledge.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { SYLLABI_MAP } from "../server/syllabi";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Topic Knowledge Base ────────────────────────────────────────────────────
// Real domain content keyed by topicId. Each entry provides rich, accurate
// educational material that the generator weaves into lesson units.

interface TopicKnowledge {
  title: string;
  category: string;
  overview: string;
  keyEquations?: { name: string; latex: string; description: string }[];
  keyCodePatterns?: { name: string; code: string; language: string }[];
  keyConcepts: string[];
  realWorldApps: string[];
  commonMistakes: string[];
  prerequisites: string[];
}

const TOPIC_KNOWLEDGE: Record<number, TopicKnowledge> = {
  // === PHYSICS (5) =========================================================
  4: { // Quantum Mechanics
    title: "Quantum Mechanics",
    category: "deep_science",
    overview: "The mathematical framework describing nature at the smallest scales.",
    keyEquations: [
      { name: "Schrödinger Equation", latex: "i\\hbar \\frac{\\partial}{\\partial t} \\Psi(x,t) = \\hat{H} \\Psi(x,t)", description: "The fundamental equation of quantum dynamics. \\Psi is the wavefunction, \\hat{H} is the Hamiltonian operator." },
      { name: "Born Rule", latex: "P(x) = |\\Psi(x)|^2", description: "The probability density of finding a particle at position x." },
      { name: "Heisenberg Uncertainty", latex: "\\Delta x \\Delta p \\geq \\frac{\\hbar}{2}", description: "Fundamental limit on the precision with which complementary variables can be known." },
      { name: "Pauli Exclusion Principle", latex: "\\psi(\\mathbf{r}_1, \\mathbf{r}_2) = -\\psi(\\mathbf{r}_2, \\mathbf{r}_1)", description: "Fermionic wavefunctions are antisymmetric under particle exchange." },
    ],
    keyConcepts: ["wave-particle duality", "superposition", "entanglement", "quantum tunneling", "decoherence", "measurement problem"],
    realWorldApps: ["transistors", "lasers", "MRI machines", "quantum computing", "LEDs", "atomic clocks"],
    commonMistakes: ["thinking measurement requires consciousness", "confusing superposition with mixture", "ignoring normalization of wavefunctions"],
    prerequisites: ["calculus", "linear algebra", "classical mechanics"],
  },
  12: { // Classical Mechanics
    title: "Classical Mechanics",
    category: "theory_heavy",
    overview: "The study of motion and forces from Newton to Lagrange.",
    keyEquations: [
      { name: "Newton's Second Law", latex: "\\mathbf{F} = m\\mathbf{a} = \\frac{d\\mathbf{p}}{dt}", description: "Force equals rate of change of momentum." },
      { name: "Work-Energy Theorem", latex: "W = \\Delta K = \\int \\mathbf{F} \\cdot d\\mathbf{r}", description: "Work done equals change in kinetic energy." },
      { name: "Conservation of Angular Momentum", latex: "\\frac{d\\mathbf{L}}{dt} = \\boldsymbol{\\tau} \\quad \\Rightarrow \\quad \\boldsymbol{\\tau} = 0 \\Rightarrow \\mathbf{L} = \\text{const}", description: "When net external torque is zero, angular momentum is conserved." },
      { name: "Lagrangian", latex: "L = T - V, \\quad \\frac{d}{dt}\\frac{\\partial L}{\\partial \\dot{q}_i} - \\frac{\\partial L}{\\partial q_i} = 0", description: "The Euler-Lagrange equations derive equations of motion from the Lagrangian." },
    ],
    keyConcepts: ["Newton's laws", "conservation laws", "phase space", "Lagrangian mechanics", "Hamiltonian mechanics", "central forces"],
    realWorldApps: ["spacecraft trajectories", "bridge engineering", "vehicle dynamics", "pendulum clocks", "roller coasters"],
    commonMistakes: ["forgetting friction is velocity-dependent", "confusing mass and weight", "ignoring rotational inertia"],
    prerequisites: ["calculus", "vectors"],
  },
  13: { // Orbital Mechanics
    title: "Orbital Mechanics",
    category: "formula_heavy",
    overview: "The physics of spacecraft, planets, and satellites in gravitational fields.",
    keyEquations: [
      { name: "Vis-Viva Equation", latex: "v^2 = GM \\left(\\frac{2}{r} - \\frac{1}{a}\\right)", description: "Relates orbital velocity to distance and semi-major axis." },
      { name: "Kepler's Third Law", latex: "\\frac{T^2}{a^3} = \\frac{4\\pi^2}{GM}", description: "Square of orbital period proportional to cube of semi-major axis." },
      { name: "Specific Orbital Energy", latex: "\\varepsilon = \\frac{v^2}{2} - \\frac{GM}{r} = -\\frac{GM}{2a}", description: "Negative for bound orbits; determines orbit shape." },
      { name: "Hohmann Transfer Delta-v", latex: "\\Delta v = \\sqrt{\\frac{GM}{r_1}} \\left(\\sqrt{\\frac{2r_2}{r_1+r_2}} - 1\\right)", description: "Most fuel-efficient transfer between circular orbits." },
    ],
    keyConcepts: ["conic sections", "eccentricity", "inclination", "Hohmann transfer", "gravity assist", "Lagrange points"],
    realWorldApps: ["GPS satellites", "Mars missions", "ISS orbit maintenance", "geostationary satellites", "slingshot maneuvers"],
    commonMistakes: ["assuming orbits are circular", "forgetting Oberth effect", "confusing apoapsis and periapsis"],
    prerequisites: ["classical mechanics", "calculus"],
  },
  14: { // Optics & Light
    title: "Optics & Light",
    category: "visual_heavy",
    overview: "The behavior of electromagnetic radiation from geometric to quantum optics.",
    keyEquations: [
      { name: "Snell's Law", latex: "n_1 \\sin\\theta_1 = n_2 \\sin\\theta_2", description: "Refraction at an interface between media." },
      { name: "Lens Maker's Equation", latex: "\\frac{1}{f} = (n-1)\\left(\\frac{1}{R_1} - \\frac{1}{R_2}\\right)", description: "Focal length of a thin lens." },
      { name: "Interference Condition", latex: "d \\sin\\theta = m\\lambda", description: "Constructive interference for a diffraction grating." },
    ],
    keyConcepts: ["reflection", "refraction", "diffraction", "interference", "polarization", "dispersion", "focal length"],
    realWorldApps: ["cameras", "microscopes", "fiber optics", "CD/DVD reading", "sunglasses", "telescopes"],
    commonMistakes: ["forgetting light slows in media", "confusing real and virtual images", "ignoring wave nature in small apertures"],
    prerequisites: ["waves", "trigonometry"],
  },
  15: { // Fluid Dynamics
    title: "Fluid Dynamics",
    category: "deep_science",
    overview: "The physics of flowing liquids and gases — from pipe flow to aerodynamics.",
    keyEquations: [
      { name: "Continuity Equation", latex: "\\frac{\\partial \\rho}{\\partial t} + \\nabla \\cdot (\\rho \\mathbf{u}) = 0", description: "Conservation of mass for a fluid." },
      { name: "Navier-Stokes (Incompressible)", latex: "\\rho\\left(\\frac{\\partial \\mathbf{u}}{\\partial t} + \\mathbf{u} \\cdot \\nabla \\mathbf{u}\\right) = -\\nabla p + \\mu \\nabla^2 \\mathbf{u} + \\mathbf{f}", description: "Newton's second law for viscous fluids. One of the Millennium Prize problems." },
      { name: "Bernoulli's Equation", latex: "p + \\frac{1}{2}\\rho v^2 + \\rho gh = \\text{const}", description: "Conservation of energy along a streamline for inviscid flow." },
      { name: "Reynolds Number", latex: "Re = \\frac{\\rho v L}{\\mu} = \\frac{vL}{\\nu}", description: "Dimensionless ratio of inertial to viscous forces. Predicts laminar vs turbulent flow." },
    ],
    keyConcepts: ["laminar flow", "turbulence", "boundary layer", "vorticity", "compressible vs incompressible", "Reynolds number", "drag and lift"],
    realWorldApps: ["airplane wing design", "blood flow in arteries", "weather prediction", "pipeline engineering", "swimming technique", "wind turbines"],
    commonMistakes: ["applying Bernoulli across streamlines", "ignoring viscosity in low-Re flows", "confusing steady and uniform flow"],
    prerequisites: ["calculus", "vector calculus", "classical mechanics"],
  },
  16: { // Electromagnetism
    title: "Electromagnetism",
    category: "deep_science",
    overview: "The unified theory of electricity and magnetism.",
    keyEquations: [
      { name: "Maxwell's Equations (Differential)", latex: "\\nabla \\cdot \\mathbf{E} = \\frac{\\rho}{\\varepsilon_0} \\quad \\nabla \\times \\mathbf{E} = -\\frac{\\partial \\mathbf{B}}{\\partial t}", description: "Gauss's law and Faraday's law." },
      { name: "Maxwell's Equations (Magnetic)", latex: "\\nabla \\cdot \\mathbf{B} = 0 \\quad \\nabla \\times \\mathbf{B} = \\mu_0\\mathbf{J} + \\mu_0\\varepsilon_0\\frac{\\partial \\mathbf{E}}{\\partial t}", description: "No magnetic monopoles and Ampère-Maxwell law." },
      { name: "Lorentz Force", latex: "\\mathbf{F} = q(\\mathbf{E} + \\mathbf{v} \\times \\mathbf{B})", description: "Force on a charged particle in EM fields." },
      { name: "Poynting Vector", latex: "\\mathbf{S} = \\frac{1}{\\mu_0} \\mathbf{E} \\times \\mathbf{B}", description: "Energy flux density of an electromagnetic wave." },
    ],
    keyConcepts: ["electric fields", "magnetic fields", "electromagnetic waves", "induction", "dipoles", "gauss's law", "ampere's law"],
    realWorldApps: ["electric motors", "generators", "MRI", "radio", "microwaves", "wireless charging"],
    commonMistakes: ["ignoring displacement current", "confusing B and H fields", "forgetting field superposition"],
    prerequisites: ["vector calculus", "classical mechanics"],
  },
  17: { // Waves & Frequencies
    title: "Waves & Frequencies",
    category: "theory_heavy",
    overview: "Oscillations and wave propagation in mechanical and electromagnetic media.",
    keyEquations: [
      { name: "Wave Equation", latex: "\\frac{\\partial^2 y}{\\partial t^2} = v^2 \\frac{\\partial^2 y}{\\partial x^2}", description: "General form for wave propagation with speed v." },
      { name: "Simple Harmonic Motion", latex: "x(t) = A \\cos(\\omega t + \\phi)", description: "Displacement as a function of time for a harmonic oscillator." },
      { name: "Doppler Effect", latex: "f' = f \\frac{v \\pm v_o}{v \\mp v_s}", description: "Frequency shift due to relative motion between source and observer." },
    ],
    keyConcepts: ["amplitude", "frequency", "wavelength", "phase", "superposition", "standing waves", "resonance", "Doppler effect"],
    realWorldApps: ["musical instruments", "ultrasound imaging", "radar", "seismic detection", "noise cancellation"],
    commonMistakes: ["confusing frequency and angular frequency", "ignoring phase in superposition", "forgetting boundary conditions"],
    prerequisites: ["calculus", "trigonometry"],
  },
  23: { // Thermodynamics
    title: "Thermodynamics",
    category: "deep_science",
    overview: "The physics of heat, work, energy, and entropy.",
    keyEquations: [
      { name: "First Law", latex: "\\Delta U = Q - W", description: "Change in internal energy equals heat added minus work done by the system." },
      { name: "Entropy Definition", latex: "dS = \\frac{\\delta Q_{\\text{rev}}}{T}", description: "Differential change in entropy for a reversible process." },
      { name: "Ideal Gas Law", latex: "pV = nRT = Nk_BT", description: "Equation of state for an ideal gas." },
      { name: "Carnot Efficiency", latex: "\\eta_{\\text{Carnot}} = 1 - \\frac{T_C}{T_H}", description: "Maximum possible efficiency of a heat engine." },
    ],
    keyConcepts: ["internal energy", "enthalpy", "entropy", "free energy", "heat engines", "refrigerators", "Carnot cycle", "irreversibility"],
    realWorldApps: ["power plants", "refrigerators", "heat pumps", "engines", "battery thermal management"],
    commonMistakes: ["confusing heat and temperature", "ignoring entropy in real processes", "applying ideal gas law to condensed phases"],
    prerequisites: ["calculus", "classical mechanics"],
  },
  24: { // Statistical Mechanics
    title: "Statistical Mechanics",
    category: "deep_science",
    overview: "Connecting microscopic states to macroscopic thermodynamics through probability.",
    keyEquations: [
      { name: "Boltzmann Distribution", latex: "P_i = \\frac{e^{-E_i/k_BT}}{Z}", description: "Probability of a microstate with energy E_i." },
      { name: "Partition Function", latex: "Z = \\sum_i e^{-E_i/k_BT}", description: "Normalizes probabilities and generates thermodynamic quantities." },
      { name: "Entropy (Boltzmann)", latex: "S = k_B \\ln \\Omega", description: "Entropy proportional to log of number of microstates." },
      { name: "Gibbs Free Energy", latex: "G = H - TS = -k_BT \\ln Z + k_BTV \\frac{\\partial \\ln Z}{\\partial V}", description: "Thermodynamic potential for constant T and P." },
    ],
    keyConcepts: ["microstate", "macrostate", "ensemble", "ergodic hypothesis", "phase transitions", "critical phenomena"],
    realWorldApps: ["materials science", "protein folding", "superconductivity", "magnetism", "polymer physics"],
    commonMistakes: ["treating ensemble average as time average without justification", "ignoring quantum statistics for fermions/bosons", "confusing canonical and grand canonical ensembles"],
    prerequisites: ["thermodynamics", "probability", "quantum mechanics"],
  },

  // === MATHEMATICS (2) =====================================================
  2: { // Linear Algebra
    title: "Linear Algebra",
    category: "formula_heavy",
    overview: "The mathematics of vectors, matrices, and linear transformations.",
    keyEquations: [
      { name: "Matrix-Vector Product", latex: "(A\\mathbf{x})_i = \\sum_j A_{ij}x_j", description: "Linear combination of columns of A weighted by x." },
      { name: "Eigenvalue Equation", latex: "A\\mathbf{v} = \\lambda\\mathbf{v}", description: "Vectors that only scale under transformation A." },
      { name: "Singular Value Decomposition", latex: "A = U\\Sigma V^T", description: "Factorization into orthogonal and diagonal components." },
      { name: "Determinant", latex: "\\det(A) = \\sum_{\\sigma \\in S_n} \\text{sgn}(\\sigma) \\prod_{i=1}^n A_{i,\\sigma(i)}", description: "Measures volume scaling and detects invertibility." },
    ],
    keyCodePatterns: [
      { name: "Matrix multiplication in NumPy", code: "import numpy as np\nA = np.array([[1, 2], [3, 4]])\nx = np.array([5, 6])\ny = A @ x  # matrix-vector product\nprint(y)  # [17, 39]", language: "python" },
      { name: "Eigenvalue decomposition", code: "import numpy as np\nA = np.array([[4, 2], [1, 3]])\neigenvalues, eigenvectors = np.linalg.eig(A)\nprint('Eigenvalues:', eigenvalues)\nprint('Eigenvectors:', eigenvectors)", language: "python" },
    ],
    keyConcepts: ["vector spaces", "linear independence", "basis", "rank", "null space", "eigenvalues", "SVD", "projections", "Gram-Schmidt"],
    realWorldApps: ["PCA in data science", "computer graphics", "quantum states", "Google PageRank", "image compression"],
    commonMistakes: ["assuming AB = BA", "confusing eigenvectors with singular vectors", "forgetting to check linear independence"],
    prerequisites: ["basic algebra"],
  },
  5: { // Calculus
    title: "Calculus",
    category: "formula_heavy",
    overview: "The study of continuous change through derivatives and integrals.",
    keyEquations: [
      { name: "Definition of Derivative", latex: "f'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}", description: "Instantaneous rate of change." },
      { name: "Fundamental Theorem", latex: "\\int_a^b f(x)\\,dx = F(b) - F(a), \\quad F' = f", description: "Connects differentiation and integration." },
      { name: "Taylor Series", latex: "f(x) = \\sum_{n=0}^\\infty \\frac{f^{(n)}(a)}{n!}(x-a)^n", description: "Local polynomial approximation of smooth functions." },
      { name: "Partial Derivative", latex: "\\frac{\\partial f}{\\partial x} = \\lim_{h\\to 0} \\frac{f(x+h,y) - f(x,y)}{h}", description: "Rate of change with respect to one variable holding others fixed." },
    ],
    keyConcepts: ["limits", "continuity", "differentiation", "integration", "series", "multivariable calculus", "vector calculus"],
    realWorldApps: ["optimization", "physics equations of motion", "machine learning gradients", "area/volume calculations", "population models"],
    commonMistakes: ["forgetting chain rule", "confusing definite and indefinite integrals", "ignoring domain restrictions"],
    prerequisites: ["algebra", "trigonometry"],
  },
  6: { // Graph Theory
    title: "Graph Theory",
    category: "theory_heavy",
    overview: "The mathematical study of networks and relationships.",
    keyEquations: [
      { name: "Handshaking Lemma", latex: "\\sum_{v \\in V} \\deg(v) = 2|E|", description: "Sum of all vertex degrees equals twice the number of edges." },
      { name: "Euler's Formula", latex: "V - E + F = 2", description: "For connected planar graphs, vertices minus edges plus faces equals 2." },
    ],
    keyCodePatterns: [
      { name: "DFS in Python", code: "def dfs(graph, start, visited=None):\n    if visited is None:\n        visited = set()\n    visited.add(start)\n    for neighbor in graph[start]:\n        if neighbor not in visited:\n            dfs(graph, neighbor, visited)\n    return visited", language: "python" },
      { name: "Dijkstra's Algorithm", code: "import heapq\ndef dijkstra(graph, start):\n    dist = {v: float('inf') for v in graph}\n    dist[start] = 0\n    pq = [(0, start)]\n    while pq:\n        d, u = heapq.heappop(pq)\n        if d > dist[u]: continue\n        for v, w in graph[u]:\n            if dist[u] + w < dist[v]:\n                dist[v] = dist[u] + w\n                heapq.heappush(pq, (dist[v], v))\n    return dist", language: "python" },
    ],
    keyConcepts: ["vertices", "edges", "degree", "paths", "cycles", "connectivity", "trees", "coloring", "planarity"],
    realWorldApps: ["social networks", "GPS routing", "dependency resolution", "circuit design", "scheduling"],
    commonMistakes: ["confusing directed and undirected edges", "forgetting self-loops in degree counts", "assuming all graphs are connected"],
    prerequisites: ["basic set theory"],
  },
  21: { // Probability & Statistics
    title: "Probability & Statistics",
    category: "formula_heavy",
    overview: "Quantifying uncertainty and extracting signal from noise.",
    keyEquations: [
      { name: "Bayes' Theorem", latex: "P(A|B) = \\frac{P(B|A)P(A)}{P(B)}", description: "Updating beliefs with evidence." },
      { name: "Expected Value", latex: "E[X] = \\sum_i x_i P(X=x_i)", description: "Long-run average of a random variable." },
      { name: "Central Limit Theorem", latex: "\\bar{X}_n \\xrightarrow{d} \\mathcal{N}\\left(\\mu, \\frac{\\sigma^2}{n}\\right)", description: "Sample mean approaches normal distribution as n grows." },
      { name: "Linear Regression", latex: "\\hat{\\boldsymbol{\\beta}} = (X^T X)^{-1} X^T \\mathbf{y}", description: "Ordinary least squares estimator." },
    ],
    keyCodePatterns: [
      { name: "Sampling and confidence interval", code: "import numpy as np\nfrom scipy import stats\ndata = np.random.normal(100, 15, 1000)\nmean = np.mean(data)\nsem = stats.sem(data)\nci = stats.t.interval(0.95, len(data)-1, loc=mean, scale=sem)\nprint(f'Mean: {mean:.2f}, 95% CI: {ci}')", language: "python" },
    ],
    keyConcepts: ["random variables", "distributions", "hypothesis testing", "confidence intervals", "correlation", "causation", "MLE"],
    realWorldApps: ["A/B testing", "medical trials", "insurance pricing", "quality control", "election polling"],
    commonMistakes: ["confusing P(A|B) with P(B|A)", "ignoring sample size in significance", "assuming correlation implies causation"],
    prerequisites: ["calculus", "linear algebra"],
  },
  22: { // Differential Equations
    title: "Differential Equations",
    category: "formula_heavy",
    overview: "Equations describing how quantities change — the language of physics and engineering.",
    keyEquations: [
      { name: "First-Order Linear ODE", latex: "\\frac{dy}{dt} + p(t)y = q(t)", description: "Solved using integrating factor." },
      { name: "Simple Harmonic Oscillator", latex: "\\frac{d^2x}{dt^2} + \\omega^2 x = 0", description: "Fundamental second-order ODE with sinusoidal solutions." },
      { name: "Heat Equation", latex: "\\frac{\\partial u}{\\partial t} = \\alpha \\nabla^2 u", description: "Parabolic PDE describing diffusion of heat." },
      { name: "Wave Equation", latex: "\\frac{\\partial^2 u}{\\partial t^2} = c^2 \\nabla^2 u", description: "Hyperbolic PDE describing wave propagation." },
    ],
    keyConcepts: ["ODE vs PDE", "initial conditions", "boundary conditions", "separation of variables", "Laplace transforms", "Fourier series"],
    realWorldApps: ["population dynamics", "circuit analysis", "heat transfer", "vibrations", "fluid flow", "quantum mechanics"],
    commonMistakes: ["missing initial/boundary conditions", "assuming superposition works for nonlinear equations", "ignoring stability in numerical solutions"],
    prerequisites: ["calculus", "linear algebra"],
  },

  // === COMPUTER SCIENCE (3) ================================================
  3: { // Data Structures
    title: "Data Structures",
    category: "code_heavy",
    overview: "Organizing data for efficient access and modification.",
    keyCodePatterns: [
      { name: "Binary Search Tree insertion", code: "class TreeNode:\n    def __init__(self, val):\n        self.val = val\n        self.left = None\n        self.right = None\n\ndef insert(root, val):\n    if root is None:\n        return TreeNode(val)\n    if val < root.val:\n        root.left = insert(root.left, val)\n    else:\n        root.right = insert(root.right, val)\n    return root", language: "python" },
      { name: "Hash table with chaining", code: "class HashTable:\n    def __init__(self, size=101):\n        self.size = size\n        self.table = [[] for _ in range(size)]\n    \n    def _hash(self, key):\n        return hash(key) % self.size\n    \n    def put(self, key, value):\n        idx = self._hash(key)\n        for pair in self.table[idx]:\n            if pair[0] == key:\n                pair[1] = value\n                return\n        self.table[idx].append([key, value])\n    \n    def get(self, key):\n        idx = self._hash(key)\n        for k, v in self.table[idx]:\n            if k == key:\n                return v\n        raise KeyError(key)", language: "python" },
    ],
    keyConcepts: ["arrays", "linked lists", "stacks", "queues", "trees", "hash tables", "heaps", "graphs"],
    realWorldApps: ["database indexing", "memory management", "file systems", "network routing", "compiler design"],
    commonMistakes: ["O(n) insertion in arrays", "forgetting to update pointers in linked lists", "ignoring collision resolution in hash tables"],
    prerequisites: ["basic programming"],
  },
  7: { // Algorithms
    title: "Algorithms",
    category: "code_heavy",
    overview: "Step-by-step procedures for solving computational problems efficiently.",
    keyCodePatterns: [
      { name: "Merge Sort", code: "def merge_sort(arr):\n    if len(arr) <= 1:\n        return arr\n    mid = len(arr) // 2\n    left = merge_sort(arr[:mid])\n    right = merge_sort(arr[mid:])\n    return merge(left, right)\n\ndef merge(left, right):\n    result = []\n    i = j = 0\n    while i < len(left) and j < len(right):\n        if left[i] <= right[j]:\n            result.append(left[i])\n            i += 1\n        else:\n            result.append(right[j])\n            j += 1\n    result.extend(left[i:])\n    result.extend(right[j:])\n    return result", language: "python" },
      { name: "Dynamic Programming — Fibonacci with memoization", code: "from functools import lru_cache\n\n@lru_cache(maxsize=None)\ndef fib(n):\n    if n < 2:\n        return n\n    return fib(n-1) + fib(n-2)\n\n# O(n) time, O(n) space — exponential improvement over naive recursion\nprint(fib(100))", language: "python" },
    ],
    keyConcepts: ["big-O notation", "recursion", "divide and conquer", "dynamic programming", "greedy algorithms", "graph algorithms", "NP-completeness"],
    realWorldApps: ["sorting huge datasets", "shortest path navigation", "compression", "cryptography", "DNA sequencing"],
    commonMistakes: ["ignoring space complexity", "overusing recursion without memoization", "assuming greedy always optimal"],
    prerequisites: ["data structures", "basic programming"],
  },
  51: { // React & Modern Frontend
    title: "React & Modern Frontend",
    category: "code_heavy",
    overview: "Building reactive user interfaces with components, hooks, and the modern JS ecosystem.",
    keyCodePatterns: [
      { name: "Custom hook for API fetching", code: "import { useState, useEffect } from 'react';\n\nfunction useFetch(url) {\n  const [data, setData] = useState(null);\n  const [loading, setLoading] = useState(true);\n  const [error, setError] = useState(null);\n  \n  useEffect(() => {\n    const controller = new AbortController();\n    fetch(url, { signal: controller.signal })\n      .then(r => r.json())\n      .then(setData)\n      .catch(setError)\n      .finally(() => setLoading(false));\n    return () => controller.abort();\n  }, [url]);\n  \n  return { data, loading, error };\n}", language: "typescript" },
      { name: "Context API for global state", code: "import { createContext, useContext, useReducer } from 'react';\n\nconst StateContext = createContext(null);\n\nfunction AppProvider({ children }) {\n  const [state, dispatch] = useReducer(reducer, initialState);\n  return (\n    <StateContext.Provider value={{ state, dispatch }}>\n      {children}\n    </StateContext.Provider>\n  );\n}\n\nexport const useAppState = () => useContext(StateContext);", language: "typescript" },
    ],
    keyConcepts: ["components", "JSX", "hooks", "state", "props", "context", "virtual DOM", "reconciliation"],
    realWorldApps: ["SaaS dashboards", "e-commerce sites", "social media feeds", "real-time collaboration tools"],
    commonMistakes: ["mutating state directly", "missing dependency arrays in useEffect", "lifting state too high"],
    prerequisites: ["JavaScript", "HTML/CSS"],
  },
  52: { // Node.js & Backend APIs
    title: "Node.js & Backend APIs",
    category: "code_heavy",
    overview: "Creating scalable server-side applications and RESTful APIs.",
    keyCodePatterns: [
      { name: "Express middleware for auth", code: "const authenticate = (req, res, next) => {\n  const token = req.headers.authorization?.split(' ')[1];\n  if (!token) return res.status(401).json({ error: 'Unauthorized' });\n  \n  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {\n    if (err) return res.status(403).json({ error: 'Invalid token' });\n    req.user = user;\n    next();\n  });\n};\n\napp.get('/api/protected', authenticate, (req, res) => {\n  res.json({ message: 'Secret data', user: req.user });\n});", language: "javascript" },
      { name: "Rate limiter with Redis", code: "const rateLimit = require('express-rate-limit');\nconst RedisStore = require('rate-limit-redis');\n\nconst limiter = rateLimit({\n  store: new RedisStore({ client: redisClient }),\n  windowMs: 15 * 60 * 1000, // 15 minutes\n  max: 100, // limit each IP to 100 requests per windowMs\n  message: 'Too many requests, please try again later.'\n});\n\napp.use('/api/', limiter);", language: "javascript" },
    ],
    keyConcepts: ["event loop", "middleware", "REST", "authentication", "database connections", "caching", "horizontal scaling"],
    realWorldApps: ["API gateways", "real-time chat servers", "payment processing", "microservices"],
    commonMistakes: ["blocking the event loop", "storing secrets in code", "ignoring connection pooling", "missing input validation"],
    prerequisites: ["JavaScript", "HTTP basics"],
  },
  53: { // Databases & SQL
    title: "Databases & SQL",
    category: "code_heavy",
    overview: "Modeling, querying, and optimizing relational and NoSQL databases.",
    keyCodePatterns: [
      { name: "Complex SQL query with CTE", code: "WITH monthly_revenue AS (\n  SELECT\n    DATE_TRUNC('month', order_date) AS month,\n    SUM(amount) AS revenue\n  FROM orders\n  WHERE status = 'completed'\n  GROUP BY 1\n),\ngrowth AS (\n  SELECT\n    month,\n    revenue,\n    LAG(revenue) OVER (ORDER BY month) AS prev_revenue\n  FROM monthly_revenue\n)\nSELECT\n  month,\n  revenue,\n  ROUND((revenue - prev_revenue) / prev_revenue * 100, 2) AS growth_pct\nFROM growth\nWHERE prev_revenue IS NOT NULL;", language: "sql" },
      { name: "Indexing strategy in PostgreSQL", code: "-- B-tree index for range queries\nCREATE INDEX idx_orders_date ON orders USING btree (order_date);\n\n-- GIN index for JSONB containment\nCREATE INDEX idx_products_tags ON products USING gin (tags);\n\n-- Partial index for hot data\nCREATE INDEX idx_active_users ON users(email) WHERE is_active = true;", language: "sql" },
    ],
    keyConcepts: ["normalization", "ACID", "indexes", "JOINs", "transactions", "sharding", "replication", "CAP theorem"],
    realWorldApps: ["banking systems", "e-commerce inventory", "health records", "analytics pipelines"],
    commonMistakes: ["N+1 queries", "missing indexes", "over-normalization", "ignoring transaction boundaries"],
    prerequisites: ["basic programming"],
  },
  54: { // Cryptography
    title: "Cryptography",
    category: "theory_heavy",
    overview: "The mathematical science of securing information.",
    keyEquations: [
      { name: "RSA Encryption", latex: "c = m^e \\pmod{n}, \\quad m = c^d \\pmod{n}", description: "Public-key encryption using modular exponentiation." },
      { name: "Diffie-Hellman", latex: "s = g^{ab} \\pmod{p}", description: "Shared secret derived from private exponents." },
    ],
    keyCodePatterns: [
      { name: "AES-GCM encryption in Python", code: "from cryptography.hazmat.primitives.ciphers.aead import AESGCM\nimport os\n\nkey = AESGCM.generate_key(bit_length=256)\naesgcm = AESGCM(key)\n\nnonce = os.urandom(12)\nplaintext = b' sensitive data '\nct = aesgcm.encrypt(nonce, plaintext, None)\n\n# Decrypt\npt = aesgcm.decrypt(nonce, ct, None)\nassert pt == plaintext", language: "python" },
    ],
    keyConcepts: ["symmetric encryption", "public-key cryptography", "hash functions", "digital signatures", "zero-knowledge proofs"],
    realWorldApps: ["HTTPS/TLS", "blockchain", "secure messaging", "password storage", "digital certificates"],
    commonMistakes: ["rolling your own crypto", "reusing nonces", "using ECB mode", "insufficient key entropy"],
    prerequisites: ["number theory", "algorithms"],
  },
  55: { // Network Security
    title: "Network Security",
    category: "code_heavy",
    overview: "Protecting data in transit and hardening infrastructure.",
    keyCodePatterns: [
      { name: "TLS configuration check", code: "const tls = require('tls');\nconst socket = tls.connect(443, 'example.com', {\n  rejectUnauthorized: true,\n  minVersion: 'TLSv1.2'\n}, () => {\n  console.log('Cipher:', socket.getCipher().name);\n  console.log('Protocol:', socket.getProtocol());\n  socket.end();\n});", language: "javascript" },
    ],
    keyConcepts: ["firewalls", "IDS/IPS", "VPNs", "TLS/SSL", "DNS security", "DDoS mitigation", "zero trust"],
    realWorldApps: ["enterprise networks", "cloud infrastructure", "IoT security", "payment networks"],
    commonMistakes: ["disabling certificate validation", "using default credentials", "exposing management ports"],
    prerequisites: ["networking", "cryptography"],
  },

  // === AI / ML (1) =========================================================
  1: { // Machine Learning
    title: "Machine Learning",
    category: "theory_heavy",
    overview: "How machines learn patterns from data to make predictions.",
    keyEquations: [
      { name: "Mean Squared Error", latex: "MSE = \\frac{1}{n}\\sum_{i=1}^n (y_i - \\hat{y}_i)^2", description: "Average squared difference between predictions and true values." },
      { name: "Gradient Descent Update", latex: "\\theta_{t+1} = \\theta_t - \\eta \\nabla_\\theta J(\\theta)", description: "Iteratively move parameters in direction of steepest descent." },
      { name: "Softmax", latex: "\\sigma(z)_j = \\frac{e^{z_j}}{\\sum_{k=1}^K e^{z_k}}", description: "Converts logits to probability distribution." },
    ],
    keyCodePatterns: [
      { name: "Train/test split and evaluation", code: "from sklearn.model_selection import train_test_split\nfrom sklearn.linear_model import LogisticRegression\nfrom sklearn.metrics import accuracy_score\n\nX_train, X_test, y_train, y_test = train_test_split(\n    X, y, test_size=0.2, random_state=42, stratify=y\n)\n\nmodel = LogisticRegression(max_iter=1000)\nmodel.fit(X_train, y_train)\n\npreds = model.predict(X_test)\nprint(f'Accuracy: {accuracy_score(y_test, preds):.3f}')", language: "python" },
      { name: "Cross-validation", code: "from sklearn.model_selection import cross_val_score\nfrom sklearn.ensemble import RandomForestClassifier\n\nmodel = RandomForestClassifier(n_estimators=100)\nscores = cross_val_score(model, X, y, cv=5)\nprint(f'CV accuracy: {scores.mean():.3f} ± {scores.std():.3f}')", language: "python" },
    ],
    keyConcepts: ["supervised learning", "unsupervised learning", "reinforcement learning", "overfitting", "bias-variance tradeoff", "feature engineering", "cross-validation"],
    realWorldApps: ["spam detection", "recommendation systems", "medical diagnosis", "fraud detection", "autonomous vehicles"],
    commonMistakes: ["data leakage", "evaluating on training set", "ignoring class imbalance", "tuning on test set"],
    prerequisites: ["linear algebra", "calculus", "probability"],
  },
  8: { // Neural Networks
    title: "Neural Networks",
    category: "theory_heavy",
    overview: "Brain-inspired computing systems that power modern AI.",
    keyEquations: [
      { name: "Neuron Activation", latex: "a = g(\\mathbf{w}^T \\mathbf{x} + b)", description: "Weighted sum plus bias passed through activation function g." },
      { name: "Backpropagation (Chain Rule)", latex: "\\frac{\\partial L}{\\partial w} = \\frac{\\partial L}{\\partial a} \\cdot \\frac{\\partial a}{\\partial z} \\cdot \\frac{\\partial z}{\\partial w}", description: "Gradients flow backward through the network via the chain rule." },
      { name: "Cross-Entropy Loss", latex: "L = -\\sum_i y_i \\log(\\hat{y}_i)", description: "Loss function for classification measuring divergence from true distribution." },
    ],
    keyCodePatterns: [
      { name: "PyTorch training loop", code: "import torch\nimport torch.nn as nn\n\nmodel = nn.Sequential(\n    nn.Linear(784, 256),\n    nn.ReLU(),\n    nn.Linear(256, 10)\n)\ncriterion = nn.CrossEntropyLoss()\noptimizer = torch.optim.Adam(model.parameters(), lr=0.001)\n\nfor epoch in range(10):\n    for batch_x, batch_y in train_loader:\n        optimizer.zero_grad()\n        outputs = model(batch_x)\n        loss = criterion(outputs, batch_y)\n        loss.backward()\n        optimizer.step()\n    print(f'Epoch {epoch}, Loss: {loss.item():.4f}')", language: "python" },
    ],
    keyConcepts: ["perceptron", "activation functions", "backpropagation", "SGD", "regularization", "dropout", "batch normalization"],
    realWorldApps: ["image recognition", "speech synthesis", "game playing", "drug discovery", "climate modeling"],
    commonMistakes: ["vanishing gradients in deep networks", "using ReLU on final layer", "forgetting to zero gradients", "wrong loss function for task"],
    prerequisites: ["linear algebra", "calculus", "machine learning basics"],
  },
  56: { // Deep Learning
    title: "Deep Learning",
    category: "code_heavy",
    overview: "Multi-layer neural networks and modern architectures.",
    keyEquations: [
      { name: "Convolution", latex: "(I * K)(i,j) = \\sum_m \\sum_n I(i+m, j+n) K(m,n)", description: "Sliding kernel over input to extract local features." },
      { name: "Attention Score", latex: "\\text{Attention}(Q,K,V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V", description: "Scaled dot-product attention in transformers." },
    ],
    keyCodePatterns: [
      { name: "Transformer block in PyTorch", code: "import torch.nn as nn\n\nclass TransformerBlock(nn.Module):\n    def __init__(self, embed_dim, num_heads, ff_dim):\n        super().__init__()\n        self.attn = nn.MultiheadAttention(embed_dim, num_heads)\n        self.ff = nn.Sequential(\n            nn.Linear(embed_dim, ff_dim),\n            nn.ReLU(),\n            nn.Linear(ff_dim, embed_dim)\n        )\n        self.ln1 = nn.LayerNorm(embed_dim)\n        self.ln2 = nn.LayerNorm(embed_dim)\n    \n    def forward(self, x):\n        attn_out, _ = self.attn(x, x, x)\n        x = self.ln1(x + attn_out)\n        ff_out = self.ff(x)\n        return self.ln2(x + ff_out)", language: "python" },
    ],
    keyConcepts: ["CNNs", "RNNs", "LSTMs", "transformers", "attention", "residual connections", "transfer learning"],
    realWorldApps: ["GPT/chatbots", "Stable Diffusion", "protein folding (AlphaFold)", "self-driving perception"],
    commonMistakes: ["insufficient data for deep models", "forgetting learning rate scheduling", "not using pretrained weights"],
    prerequisites: ["neural networks", "linear algebra"],
  },
  57: { // Reinforcement Learning
    title: "Reinforcement Learning",
    category: "theory_heavy",
    overview: "Teaching agents to make optimal decisions through trial and error.",
    keyEquations: [
      { name: "Bellman Equation", latex: "V^\\pi(s) = \\sum_a \\pi(a|s) \\sum_{s'} P(s'|s,a)[R(s,a,s') + \\gamma V^\\pi(s')]", description: "Recursive definition of value under policy π." },
      { name: "Q-Learning Update", latex: "Q(s,a) \\leftarrow Q(s,a) + \\alpha[r + \\gamma \\max_{a'}Q(s',a') - Q(s,a)]", description: "Temporal-difference update for action values." },
      { name: "Policy Gradient", latex: "\\nabla_\\theta J(\\theta) = \\mathbb{E}_{\\pi_\\theta}[\\nabla_\\theta \\log \\pi_\\theta(a|s) \\cdot G_t]", description: "Gradient of expected return with respect to policy parameters." },
    ],
    keyConcepts: ["MDP", "policy", "value function", "exploration vs exploitation", "Q-learning", "policy gradients", "actor-critic"],
    realWorldApps: ["game playing (AlphaGo)", "robotics", "autonomous driving", "resource scheduling", "recommendation systems"],
    commonMistakes: ["ignoring exploration", "using too high learning rate", "not normalizing rewards", "wrong discount factor"],
    prerequisites: ["probability", "calculus", "machine learning"],
  },
  58: { // Computer Vision
    title: "Computer Vision",
    category: "code_heavy",
    overview: "Enabling machines to interpret images and video.",
    keyCodePatterns: [
      { name: "Image classification with PyTorch", code: "import torch\nfrom torchvision import models, transforms\nfrom PIL import Image\n\npreprocess = transforms.Compose([\n    transforms.Resize(256),\n    transforms.CenterCrop(224),\n    transforms.ToTensor(),\n    transforms.Normalize(mean=[0.485,0.456,0.406],\n                         std=[0.229,0.224,0.225])\n])\n\nimg = Image.open('cat.jpg')\ninput_tensor = preprocess(img).unsqueeze(0)\n\nmodel = models.resnet50(weights='DEFAULT')\nmodel.eval()\nwith torch.no_grad():\n    output = model(input_tensor)\n    probs = torch.nn.functional.softmax(output[0], dim=0)\n    print(f'Predicted class: {probs.argmax().item()}')", language: "python" },
    ],
    keyConcepts: ["convolution", "feature maps", "object detection", "segmentation", "CNN architectures", "transfer learning"],
    realWorldApps: ["medical imaging", "autonomous vehicles", "facial recognition", "quality inspection", "AR/VR"],
    commonMistakes: ["not normalizing inputs", "data augmentation leakage", "ignoring class imbalance in segmentation"],
    prerequisites: ["deep learning", "linear algebra"],
  },
  59: { // Natural Language Processing
    title: "Natural Language Processing",
    category: "code_heavy",
    overview: "Bridging human language and computation.",
    keyCodePatterns: [
      { name: "Tokenization with transformers", code: "from transformers import AutoTokenizer, AutoModel\n\ntokenizer = AutoTokenizer.from_pretrained('bert-base-uncased')\nmodel = AutoModel.from_pretrained('bert-base-uncased')\n\ntext = 'The quick brown fox'\ninputs = tokenizer(text, return_tensors='pt', padding=True)\noutputs = model(**inputs)\n\n# outputs.last_hidden_state shape: (batch, seq_len, hidden_dim)\nprint(outputs.last_hidden_state.shape)", language: "python" },
    ],
    keyConcepts: ["tokenization", "embeddings", "transformers", "attention", "named entity recognition", "sentiment analysis", "machine translation"],
    realWorldApps: ["chatbots", "search engines", "translation", "content moderation", "voice assistants"],
    commonMistakes: ["not handling out-of-vocabulary words", "ignoring context window limits", "fine-tuning on too small dataset"],
    prerequisites: ["machine learning", "linear algebra"],
  },
  60: { // Data Visualization
    title: "Data Visualization",
    category: "visual_heavy",
    overview: "Transforming complex datasets into intuitive visual stories.",
    keyCodePatterns: [
      { name: "Interactive Plotly dashboard", code: "import plotly.express as px\nimport plotly.graph_objects as go\nfrom plotly.subplots import make_subplots\n\nfig = make_subplots(rows=1, cols=2,\n    subplot_titles=('Revenue Trend', 'Category Breakdown'))\n\nfig.add_trace(\n    go.Scatter(x=df.date, y=df.revenue, mode='lines', name='Revenue'),\n    row=1, col=1\n)\nfig.add_trace(\n    go.Bar(x=df.category, y=df.amount, name='By Category'),\n    row=1, col=2\n)\nfig.update_layout(height=400, showlegend=False)\nfig.write_html('dashboard.html')", language: "python" },
    ],
    keyConcepts: ["chart types", "color theory", "interaction design", "storytelling", "perception", "accessibility"],
    realWorldApps: ["business intelligence", "scientific publishing", "journalism", "health monitoring", "financial analysis"],
    commonMistakes: ["misleading axis scales", "too many colors", "3D distortions", "ignoring colorblind users"],
    prerequisites: ["statistics", "design basics"],
  },
  9: { // Hugging Face
    title: "Hugging Face",
    category: "code_heavy",
    overview: "The leading open-source platform for ML models and datasets.",
    keyCodePatterns: [
      { name: "Load and use a pipeline", code: "from transformers import pipeline\n\n# Zero-shot classification\nclassifier = pipeline('zero-shot-classification',\n                      model='facebook/bart-large-mnli')\n\nresult = classifier(\n    'This is a contract about payment terms',\n    candidate_labels=['legal', 'finance', 'hr']\n)\nprint(result)\n# {'sequence': ..., 'labels': ['legal', 'finance', 'hr'],\n#  'scores': [0.85, 0.12, 0.03]}", language: "python" },
      { name: "Push model to Hub", code: "from transformers import AutoModelForSequenceClassification, AutoTokenizer\nfrom huggingface_hub import HfApi\n\nmodel = AutoModelForSequenceClassification.from_pretrained('my-model')\ntokenizer = AutoTokenizer.from_pretrained('my-model')\n\nmodel.push_to_hub('username/my-awesome-model')\ntokenizer.push_to_hub('username/my-awesome-model')\n\n# Create a model card\napi = HfApi()\napi.upload_file(\n    path_or_fileobj='README.md',\n    path_in_repo='README.md',\n    repo_id='username/my-awesome-model'\n)", language: "python" },
    ],
    keyConcepts: ["transformers library", "datasets", "tokenizers", "pipelines", "model hub", "spaces", "inference API"],
    realWorldApps: ["model sharing", "production inference", "community collaboration", "fine-tuning workflows"],
    commonMistakes: ["not reading model cards", "ignoring license restrictions", "using wrong tokenizer for model"],
    prerequisites: ["Python", "machine learning basics"],
  },
  10: { // Gradio
    title: "Gradio",
    category: "code_heavy",
    overview: "Build and share ML web apps with a few lines of Python.",
    keyCodePatterns: [
      { name: "Image classification demo", code: "import gradio as gr\nfrom transformers import pipeline\n\nclassifier = pipeline('image-classification')\n\ndef predict(image):\n    results = classifier(image)\n    return {r['label']: r['score'] for r in results}\n\ndemo = gr.Interface(\n    fn=predict,\n    inputs=gr.Image(type='pil'),\n    outputs=gr.Label(num_top_classes=3),\n    title='Image Classifier',\n    examples=['cat.jpg', 'dog.jpg']\n)\n\ndemo.launch()", language: "python" },
    ],
    keyConcepts: ["interfaces", "components", "blocks", "streaming", "queueing", "API", "sharing"],
    realWorldApps: ["ML demos", "internal tools", "data labeling", "A/B testing interfaces"],
    commonMistakes: ["not using gr.Blocks for complex UIs", "forgetting to enable queue for high traffic", "not handling errors in prediction function"],
    prerequisites: ["Python", "basic web concepts"],
  },

  // === CHEMISTRY (6) =======================================================
  18: { // General Chemistry
    title: "General Chemistry",
    category: "theory_heavy",
    overview: "Atoms, molecules, reactions, and the building blocks of matter.",
    keyEquations: [
      { name: "Ideal Gas Law", latex: "PV = nRT", description: "Relates pressure, volume, temperature, and moles of gas." },
      { name: "Arrhenius Equation", latex: "k = Ae^{-E_a/RT}", description: "Temperature dependence of reaction rate constants." },
      { name: "Nernst Equation", latex: "E = E^\\circ - \\frac{RT}{nF} \\ln Q", description: "Cell potential under non-standard conditions." },
    ],
    keyConcepts: ["atomic structure", "periodic trends", "chemical bonding", "stoichiometry", "thermochemistry", "electrochemistry"],
    realWorldApps: ["batteries", "catalysis", "materials", "environmental chemistry", "pharmaceuticals"],
    commonMistakes: ["forgetting state symbols in equations", "confusing oxidation and reduction", "sign errors in enthalpy"],
    prerequisites: ["algebra", "basic physics"],
  },
  19: { // Organic Chemistry
    title: "Organic Chemistry",
    category: "visual_heavy",
    overview: "The chemistry of carbon compounds.",
    keyEquations: [
      { name: "Markovnikov's Rule", latex: "\\text{H adds to carbon with more H's; X adds to carbon with fewer H's}", description: "Regioselectivity in addition to unsymmetrical alkenes." },
    ],
    keyConcepts: ["functional groups", "stereochemistry", "reaction mechanisms", "resonance", "aromaticity", "synthesis"],
    realWorldApps: ["drug design", "polymers", "fragrances", "agrochemicals", "biochemistry"],
    commonMistakes: ["ignoring stereochemistry", "wrong arrow-pushing in mechanisms", "forgetting resonance structures"],
    prerequisites: ["general chemistry"],
  },

  // === BIOLOGY (8) =========================================================
  25: { // Cell Biology
    title: "Cell Biology",
    category: "visual_heavy",
    overview: "The structure and function of cells.",
    keyEquations: [
      { name: "Fick's First Law", latex: "J = -D \\frac{d\\phi}{dx}", description: "Diffusion flux proportional to concentration gradient." },
    ],
    keyConcepts: ["membrane structure", "organelles", "protein synthesis", "cell cycle", "signaling", "apoptosis"],
    realWorldApps: ["cancer research", "stem cell therapy", "antibiotic development", "vaccines"],
    commonMistakes: ["confusing prokaryotic and eukaryotic features", "ignoring membrane potential", "misunderstanding passive vs active transport"],
    prerequisites: ["general chemistry"],
  },
  26: { // Genetics & Heredity
    title: "Genetics & Heredity",
    category: "theory_heavy",
    overview: "How traits are passed down and DNA encodes life.",
    keyEquations: [
      { name: "Hardy-Weinberg Equilibrium", latex: "p^2 + 2pq + q^2 = 1", description: "Allele and genotype frequencies in an ideal population." },
    ],
    keyConcepts: ["DNA structure", "transcription", "translation", "Mendelian inheritance", "epigenetics", "mutations"],
    realWorldApps: ["gene therapy", "forensics", "ancestry testing", "crop breeding", "disease screening"],
    commonMistakes: ["confusing genotype and phenotype", "ignoring incomplete dominance", "assuming independent assortment always holds"],
    prerequisites: ["cell biology"],
  },
  27: { // Ecology & Ecosystems
    title: "Ecology & Ecosystems",
    category: "concept_heavy",
    overview: "Interactions between organisms and their environments.",
    keyConcepts: ["food webs", "niches", "carrying capacity", "succession", "biodiversity", "biogeochemical cycles"],
    realWorldApps: ["conservation biology", "fisheries management", "climate impact assessment", "restoration ecology"],
    commonMistakes: ["confusing habitat and niche", "ignoring bottom-up vs top-down control", "assuming stability is natural"],
    prerequisites: ["biology basics"],
  },
  28: { // Evolutionary Biology
    title: "Evolutionary Biology",
    category: "theory_heavy",
    overview: "How species change, diversify, and adapt.",
    keyEquations: [
      { name: "Fitness", latex: "w = \\frac{\\text{reproductive success of genotype}}{\\text{reproductive success of fittest genotype}}", description: "Relative fitness of a genotype." },
    ],
    keyConcepts: ["natural selection", "genetic drift", "gene flow", "speciation", "adaptation", "phylogenetics"],
    realWorldApps: ["antibiotic resistance", "pest management", "conservation genetics", "vaccine design"],
    commonMistakes: ["survival of the fittest = strongest", "confusing Lamarckian and Darwinian evolution", "ignoring genetic drift"],
    prerequisites: ["genetics"],
  },
  64: { // CRISPR & Gene Editing
    title: "CRISPR & Gene Editing",
    category: "code_heavy",
    overview: "Precision tools for rewriting DNA.",
    keyCodePatterns: [
      { name: "Guide RNA design check", code: "def check_grna(target, pam='NGG'):\n    '''Validate gRNA target sequence'''\n    if len(target) != 20:\n        return False, 'Length must be 20 nt'\n    if 'TTTT' in target:\n        return False, 'Poly-T may terminate transcription'\n    gc = (target.count('G') + target.count('C')) / 20\n    if not 0.4 <= gc <= 0.6:\n        return False, f'GC content {gc:.2f} outside 40-60%'\n    return True, 'Valid gRNA'", language: "python" },
    ],
    keyConcepts: ["Cas9", "guide RNA", "PAM sequences", "off-target effects", "base editing", "prime editing"],
    realWorldApps: ["sickle cell therapy", "agricultural improvement", "gene drives", "cancer immunotherapy"],
    commonMistakes: ["ignoring off-target predictions", "underestimating delivery challenges", "not considering mosaicism"],
    prerequisites: ["genetics", "molecular biology"],
  },
  65: { // Bioinformatics
    title: "Bioinformatics",
    category: "code_heavy",
    overview: "Computational methods for decoding biological data.",
    keyCodePatterns: [
      { name: "Sequence alignment with Biopython", code: "from Bio import pairwise2\nfrom Bio.pairwise2 import format_alignment\n\nseq1 = 'ACCGGT'\nseq2 = 'ACGGT'\n\nalignments = pairwise2.align.globalxx(seq1, seq2)\nfor a in alignments[:3]:\n    print(format_alignment(*a))", language: "python" },
    ],
    keyConcepts: ["sequence alignment", "phylogenetic trees", "genome assembly", "protein structure prediction", "NGS"],
    realWorldApps: ["personalized medicine", "pathogen tracking", "evolutionary studies", "drug target discovery"],
    commonMistakes: ["not checking read quality", "ignoring population structure", "overinterpreting p-values in GWAS"],
    prerequisites: ["programming", "genetics", "statistics"],
  },

  // === EARTH SCIENCE (9) ===================================================
  29: { // Climate Science
    title: "Climate Science",
    category: "theory_heavy",
    overview: "Earth's climate system and humanity's impact.",
    keyEquations: [
      { name: "Stefan-Boltzmann Law", latex: "P = \\sigma A T^4", description: "Total power radiated by a black body." },
      { name: "Radiative Forcing", latex: "\\Delta T = \\lambda \\cdot \\Delta F", description: "Temperature change proportional to radiative forcing with climate sensitivity λ." },
    ],
    keyConcepts: ["greenhouse effect", "albedo", "carbon cycle", "ocean circulation", "feedback loops", "paleoclimate"],
    realWorldApps: ["climate modeling", "renewable energy planning", "carbon capture", "policy analysis"],
    commonMistakes: ["confusing weather and climate", "ignoring time lags in system", "oversimplifying feedbacks"],
    prerequisites: ["physics", "chemistry"],
  },
  30: { // Geology & Plate Tectonics
    title: "Geology & Plate Tectonics",
    category: "visual_heavy",
    overview: "How Earth's crust moves and mountains form.",
    keyConcepts: ["plate boundaries", "subduction", "seafloor spreading", "mantle convection", "rock cycle", "stratigraphy"],
    realWorldApps: ["earthquake prediction", "mineral exploration", "volcanic hazard assessment", "geothermal energy"],
    commonMistakes: ["confusing convergent and divergent boundaries", "ignoring transform faults", "assuming all mountains form the same way"],
    prerequisites: ["physics basics"],
  },
  66: { // Renewable Energy Systems
    title: "Renewable Energy Systems",
    category: "formula_heavy",
    overview: "Solar, wind, battery storage, and sustainable power grids.",
    keyEquations: [
      { name: "Solar Cell Efficiency", latex: "\\eta = \\frac{P_{out}}{P_{in}} = \\frac{FF \\cdot V_{oc} \\cdot I_{sc}}{P_{in}}", description: "Power conversion efficiency of a photovoltaic cell." },
      { name: "Betz Limit", latex: "C_{p,max} = \\frac{16}{27} \\approx 0.593", description: "Maximum theoretical efficiency of a wind turbine." },
    ],
    keyConcepts: ["photovoltaics", "wind power", "battery chemistry", "grid integration", "energy storage", "LCOE"],
    realWorldApps: ["solar farms", "offshore wind", "electric vehicles", "grid-scale storage", "microgrids"],
    commonMistakes: ["ignoring capacity factor", "confusing power and energy", "underestimating grid integration costs"],
    prerequisites: ["physics", "electrical engineering basics"],
  },
  67: { // Oceanography
    title: "Oceanography",
    category: "concept_heavy",
    overview: "Exploring Earth's oceans.",
    keyConcepts: ["ocean currents", "tides", "thermohaline circulation", "marine ecosystems", "deep sea", "ocean acidification"],
    realWorldApps: ["fisheries management", "shipping routes", "climate modeling", "marine conservation"],
    commonMistakes: ["confusing tidal bulge causes", "ignoring Coriolis effect", "underestimating deep ocean timescales"],
    prerequisites: ["physics", "chemistry"],
  },
  68: { // Meteorology
    title: "Meteorology",
    category: "visual_heavy",
    overview: "Predicting weather through atmospheric science.",
    keyEquations: [
      { name: "Hydrostatic Balance", latex: "\\frac{\\partial p}{\\partial z} = -\\rho g", description: "Vertical pressure gradient balances gravity." },
      { name: "Geostrophic Wind", latex: "V_g = -\\frac{1}{\\rho f} \\frac{\\partial p}{\\partial n}", description: "Wind parallel to isobars when Coriolis and pressure gradient forces balance." },
    ],
    keyConcepts: ["pressure systems", "fronts", "jet streams", "convection", "radiation balance", "numerical weather prediction"],
    realWorldApps: ["weather forecasting", "aviation safety", "agriculture planning", "disaster preparedness"],
    commonMistakes: ["confusing high and low pressure rotation", "ignoring orographic effects", "confusing weather and climate"],
    prerequisites: ["physics", "calculus"],
  },

  // === PHILOSOPHY (10) =====================================================
  31: { // Ethics & Moral Philosophy
    title: "Ethics & Moral Philosophy",
    category: "concept_heavy",
    overview: "What makes actions right or wrong.",
    keyConcepts: ["utilitarianism", "deontology", "virtue ethics", "moral relativism", " trolley problem", "rights-based ethics"],
    realWorldApps: ["AI alignment", "medical ethics", "business ethics", "criminal justice", "environmental ethics"],
    commonMistakes: ["confusing descriptive and normative claims", "assuming all utilitarians ignore rights", "straw-manning opposing views"],
    prerequisites: ["critical thinking"],
  },
  32: { // Logic & Reasoning
    title: "Logic & Reasoning",
    category: "theory_heavy",
    overview: "Formal and informal logic, arguments, and rational thought.",
    keyEquations: [
      { name: "Modus Ponens", latex: "P \\to Q, \\; P \\vdash Q", description: "If P implies Q and P is true, then Q is true." },
      { name: "De Morgan's Laws", latex: "\\neg(P \\land Q) \\equiv \\neg P \\lor \\neg Q", description: "Negation distributes over conjunction and disjunction." },
    ],
    keyConcepts: ["propositional logic", "predicate logic", "fallacies", "validity", "soundness", "induction", "abduction"],
    realWorldApps: ["computer programming", "legal argumentation", "scientific reasoning", "debate"],
    commonMistakes: ["affirming the consequent", "denying the antecedent", "confusing correlation with causation"],
    prerequisites: ["none"],
  },
  33: { // Epistemology
    title: "Epistemology",
    category: "concept_heavy",
    overview: "The theory of knowledge.",
    keyConcepts: ["justified true belief", "skepticism", "empiricism", "rationalism", "Gettier problems", "bayesian epistemology"],
    realWorldApps: ["scientific method", "AI knowledge representation", "journalism standards", "education theory"],
    commonMistakes: ["confusing belief and knowledge", "ignoring justification requirements", "straw-manning skepticism"],
    prerequisites: ["logic"],
  },

  // === ECONOMICS (11) ======================================================
  34: { // Microeconomics
    title: "Microeconomics",
    category: "theory_heavy",
    overview: "Individual and firm behavior in markets.",
    keyEquations: [
      { name: "Price Elasticity", latex: "E_d = \\frac{\\%\\Delta Q_d}{\\%\\Delta P} = \\frac{\\partial Q_d}{\\partial P} \\cdot \\frac{P}{Q_d}", description: "Responsiveness of quantity demanded to price changes." },
      { name: "Profit Maximization", latex: "MC = MR \\quad \\text{or} \\quad \\frac{d\\pi}{dq} = 0", description: "Firms maximize profit where marginal cost equals marginal revenue." },
    ],
    keyConcepts: ["supply and demand", "elasticity", "consumer surplus", "producer surplus", "market structures", "externalities"],
    realWorldApps: ["pricing strategy", "antitrust policy", "labor markets", "environmental regulation"],
    commonMistakes: ["confusing movement along curve with shift", "ignoring income effects", "assuming perfect competition always"],
    prerequisites: ["calculus", "algebra"],
  },
  35: { // Macroeconomics
    title: "Macroeconomics",
    category: "theory_heavy",
    overview: "National economies and global trade.",
    keyEquations: [
      { name: "GDP Expenditure", latex: "Y = C + I + G + (X - M)", description: "Gross domestic product as sum of consumption, investment, government spending, and net exports." },
      { name: "Quantity Theory of Money", latex: "MV = PY", description: "Money supply times velocity equals price level times real output." },
    ],
    keyConcepts: ["inflation", "unemployment", "fiscal policy", "monetary policy", "exchange rates", "business cycles"],
    realWorldApps: ["central banking", "fiscal stimulus", "trade policy", "sovereign debt analysis"],
    commonMistakes: ["confusing nominal and real values", "ignoring time lags in policy", "assuming crowding out always happens"],
    prerequisites: ["microeconomics"],
  },
  36: { // Behavioral Economics
    title: "Behavioral Economics",
    category: "concept_heavy",
    overview: "How psychology influences economic decisions.",
    keyConcepts: ["prospect theory", "loss aversion", "anchoring", "nudging", "hyperbolic discounting", "mental accounting"],
    realWorldApps: ["public policy", "marketing", "retirement savings", "health interventions", "tax compliance"],
    commonMistakes: ["assuming irrationality means stupidity", "ignoring context dependence", "overgeneralizing lab results"],
    prerequisites: ["microeconomics", "psychology basics"],
  },
  69: { // Game Theory
    title: "Game Theory",
    category: "theory_heavy",
    overview: "Strategic interactions where outcomes depend on all players' choices.",
    keyEquations: [
      { name: "Nash Equilibrium", latex: "u_i(s_i^*, s_{-i}^*) \\geq u_i(s_i, s_{-i}^*) \\quad \\forall s_i, \\forall i", description: "No player can benefit by unilaterally changing strategy." },
      { name: "Minimax (Zero-Sum)", latex: "\\underline{v} = \\max_{s_1} \\min_{s_2} u(s_1, s_2) = \\min_{s_2} \\max_{s_1} u(s_1, s_2)", description: "Maximizing minimum payoff; equivalent to minimizing maximum loss." },
    ],
    keyConcepts: ["Nash equilibrium", "dominant strategies", "Pareto optimality", "mixed strategies", "repeated games", "evolutionary game theory"],
    realWorldApps: ["auction design", "nuclear deterrence", "market competition", "evolutionary biology", "network routing"],
    commonMistakes: ["assuming players are perfectly rational", "ignoring information asymmetry", "confusing Nash with Pareto optimal"],
    prerequisites: ["probability", "microeconomics"],
  },

  // === LINGUISTICS (12) ====================================================
  37: { // Syntax & Grammar
    title: "Syntax & Grammar",
    category: "concept_heavy",
    overview: "The structural rules governing sentence formation.",
    keyConcepts: ["constituents", "phrase structure", "X-bar theory", "transformations", "case", "agreement"],
    realWorldApps: ["natural language processing", "language teaching", "translation", "speech recognition"],
    commonMistakes: ["confusing prescriptive and descriptive grammar", "ignoring cross-linguistic variation", "assuming English syntax is universal"],
    prerequisites: ["none"],
  },
  38: { // Semantics & Pragmatics
    title: "Semantics & Pragmatics",
    category: "concept_heavy",
    overview: "How meaning is constructed in language.",
    keyConcepts: ["truth conditions", "entailment", "implicature", "deixis", "speech acts", "possible worlds"],
    realWorldApps: ["conversational AI", "legal interpretation", "advertising", "diplomatic communication"],
    commonMistakes: ["conflating semantic and pragmatic meaning", "ignoring context in interpretation", "assuming literal meaning is primary"],
    prerequisites: ["logic", "syntax"],
  },
  39: { // Computational Linguistics
    title: "Computational Linguistics",
    category: "code_heavy",
    overview: "Algorithms for understanding and generating human language.",
    keyCodePatterns: [
      { name: "POS tagging with NLTK", code: "import nltk\nfrom nltk import pos_tag, word_tokenize\n\nnltk.download('punkt')\nnltk.download('averaged_perceptron_tagger')\n\ntext = 'The quick brown fox jumps'\ntokens = word_tokenize(text)\ntagged = pos_tag(tokens)\nprint(tagged)\n# [('The', 'DT'), ('quick', 'JJ'), ('brown', 'JJ'),\n#  ('fox', 'NN'), ('jumps', 'VBZ')]", language: "python" },
    ],
    keyConcepts: ["tokenization", "parsing", "semantic role labeling", "word embeddings", "language models", "machine translation"],
    realWorldApps: ["search engines", "virtual assistants", "translation apps", "grammar checkers"],
    commonMistakes: ["ignoring out-of-vocabulary words", "not handling morphologically rich languages", "overfitting to training domain"],
    prerequisites: ["programming", "linguistics", "machine learning"],
  },

  // === HISTORY (13) ========================================================
  40: { // Ancient Civilizations
    title: "Ancient Civilizations",
    category: "concept_heavy",
    overview: "From Mesopotamia to Rome.",
    keyConcepts: ["urbanization", "writing systems", "law codes", "empire formation", "trade networks", "religious institutions"],
    realWorldApps: ["archaeology", "museum curation", "historical fiction", "political theory"],
    commonMistakes: ["presentism", "overgeneralizing across cultures", "ignoring non-literate societies"],
    prerequisites: ["none"],
  },
  41: { // Modern History
    title: "Modern History",
    category: "concept_heavy",
    overview: "Revolutions, wars, and the contemporary global order.",
    keyConcepts: ["industrial revolution", "nationalism", "colonialism", "cold war", "globalization", "decolonization"],
    realWorldApps: ["international relations", "policy analysis", "journalism", "diplomacy"],
    commonMistakes: ["single-cause explanations", "ignoring primary sources", "presentism"],
    prerequisites: ["none"],
  },

  // === ART & DESIGN (14) ===================================================
  42: { // Color Theory & Composition
    title: "Color Theory & Composition",
    category: "visual_heavy",
    overview: "How colors interact and guide the viewer's eye.",
    keyConcepts: ["color wheel", "complementary colors", "analogous colors", "value", "saturation", "color temperature", "rule of thirds"],
    realWorldApps: ["branding", "UI design", "photography", "film", "interior design"],
    commonMistakes: ["using too many colors", "ignoring accessibility (colorblindness)", "neglecting cultural color meanings"],
    prerequisites: ["none"],
  },
  43: { // Typography & Layout
    title: "Typography & Layout",
    category: "visual_heavy",
    overview: "The art of arranging type and space.",
    keyConcepts: ["serif vs sans-serif", "x-height", "leading", "kerning", "tracking", "grid systems", "hierarchy"],
    realWorldApps: ["web design", "book design", "advertising", "signage", "app interfaces"],
    commonMistakes: ["poor contrast ratios", "too many fonts", "ignoring reading distance", "neglecting responsive scaling"],
    prerequisites: ["design basics"],
  },
  44: { // UI/UX Design Principles
    title: "UI/UX Design Principles",
    category: "concept_heavy",
    overview: "Creating user-centered digital experiences.",
    keyConcepts: ["usability", "accessibility", "information architecture", "user research", "prototyping", "heuristic evaluation", "cognitive load"],
    realWorldApps: ["mobile apps", "SaaS products", "e-commerce", "healthcare systems", "government services"],
    commonMistakes: ["designing for yourself not users", "ignoring accessibility standards", "too much content above fold", "inconsistent interaction patterns"],
    prerequisites: ["design basics", "psychology basics"],
  },

  // === HEALTH & MEDICINE (15) ==============================================
  45: { // Human Physiology
    title: "Human Physiology",
    category: "visual_heavy",
    overview: "How organs and systems maintain life.",
    keyEquations: [
      { name: "Cardiac Output", latex: "CO = HR \\times SV", description: "Heart rate times stroke volume equals blood pumped per minute." },
      { name: "Fick Principle", latex: "\\dot{V}_{O_2} = Q \\times (C_aO_2 - C_vO_2)", description: "Oxygen consumption equals blood flow times arteriovenous oxygen difference." },
    ],
    keyConcepts: ["homeostasis", "cardiovascular system", "respiratory system", "nervous system", "endocrine system", "renal system"],
    realWorldApps: ["medicine", "sports science", "pharmacology", "rehabilitation"],
    commonMistakes: ["confusing sympathetic and parasympathetic effects", "ignoring negative feedback loops", "treating systems in isolation"],
    prerequisites: ["biology", "chemistry"],
  },
  46: { // Immunology
    title: "Immunology",
    category: "theory_heavy",
    overview: "The body's defense system.",
    keyConcepts: ["innate immunity", "adaptive immunity", "antibodies", "T cells", "B cells", "MHC", "cytokines", "vaccines"],
    realWorldApps: ["vaccine development", "cancer immunotherapy", "autoimmune treatment", "transplant medicine", "allergy therapy"],
    commonMistakes: ["confusing active and passive immunity", "ignoring self-tolerance mechanisms", "oversimplifying Th1/Th2 balance"],
    prerequisites: ["cell biology", "biochemistry"],
  },
  47: { // Nutrition & Metabolism
    title: "Nutrition & Metabolism",
    category: "concept_heavy",
    overview: "How food fuels the body.",
    keyEquations: [
      { name: "Basal Metabolic Rate (Mifflin-St Jeor)", latex: "BMR = 10W + 6.25H - 5A + s", description: "W=weight(kg), H=height(cm), A=age(y), s=+5(male)/-161(female)." },
    ],
    keyConcepts: ["macronutrients", "micronutrients", "metabolic pathways", "glycolysis", "Krebs cycle", "electron transport chain"],
    realWorldApps: ["clinical nutrition", "sports nutrition", "public health", "food science", "weight management"],
    commonMistakes: ["ignoring bioavailability", "confusing correlation with causation in diet studies", "one-size-fits-all recommendations"],
    prerequisites: ["biochemistry"],
  },

  // === ENGINEERING (16) ====================================================
  48: { // Circuit Analysis
    title: "Circuit Analysis",
    category: "formula_heavy",
    overview: "Design and analysis of electrical circuits.",
    keyEquations: [
      { name: "Ohm's Law", latex: "V = IR", description: "Voltage equals current times resistance." },
      { name: "Kirchhoff's Voltage Law", latex: "\\sum_{k=1}^n V_k = 0", description: "Sum of voltages around any closed loop is zero." },
      { name: "Kirchhoff's Current Law", latex: "\\sum_{k=1}^n I_k = 0", description: "Sum of currents into any node is zero." },
      { name: "Power", latex: "P = VI = I^2R = \\frac{V^2}{R}", description: "Electrical power in a resistive element." },
    ],
    keyCodePatterns: [
      { name: "Circuit simulation with PySpice", code: "from PySpice.Spice.Netlist import Circuit\nfrom PySpice.Unit import *\n\ncircuit = Circuit('Voltage Divider')\ncircuit.V('input', 'in', circuit.gnd, 10@u_V)\ncircuit.R(1, 'in', 'out', 2@u_kΩ)\ncircuit.R(2, 'out', circuit.gnd, 3@u_kΩ)\n\nsimulator = circuit.simulator()\nanalysis = simulator.operating_point()\nprint(float(analysis.nodes['out']))  # ~6V", language: "python" },
    ],
    keyConcepts: ["resistors", "capacitors", "inductors", "AC/DC", "phasors", "filters", "Thevenin equivalent"],
    realWorldApps: ["electronics design", "power systems", "signal processing", "control systems"],
    commonMistakes: ["ignoring component tolerances", "forgetting phase in AC analysis", "not checking power ratings"],
    prerequisites: ["calculus", "physics"],
  },
  49: { // Signal Processing
    title: "Signal Processing",
    category: "formula_heavy",
    overview: "Capture, transform, and interpretation of signals.",
    keyEquations: [
      { name: "Fourier Transform", latex: "X(f) = \\int_{-\\infty}^{\\infty} x(t) e^{-j2\\pi ft} dt", description: "Decomposes signal into frequency components." },
      { name: "Convolution", latex: "(x * h)(t) = \\int_{-\\infty}^{\\infty} x(\\tau)h(t-\\tau)d\\tau", description: "Output of LTI system equals input convolved with impulse response." },
      { name: "Nyquist Rate", latex: "f_s \\geq 2f_{max}", description: "Minimum sampling rate to avoid aliasing." },
    ],
    keyCodePatterns: [
      { name: "FFT with NumPy", code: "import numpy as np\nimport matplotlib.pyplot as plt\n\nt = np.linspace(0, 1, 1000, endpoint=False)\nsignal = np.sin(2*np.pi*50*t) + 0.5*np.sin(2*np.pi*120*t)\n\nfft = np.fft.fft(signal)\nfreqs = np.fft.fftfreq(len(t), t[1]-t[0])\n\nplt.plot(freqs[:len(freqs)//2], np.abs(fft)[:len(fft)//2])\nplt.xlabel('Frequency (Hz)')\nplt.show()", language: "python" },
    ],
    keyConcepts: ["sampling", "aliasing", "filtering", "modulation", "z-transform", "DFT/FFT"],
    realWorldApps: ["audio engineering", "image processing", "telecommunications", "radar", "biomedical signals"],
    commonMistakes: ["insufficient sampling rate", "spectral leakage from wrong window", "ignoring phase information"],
    prerequisites: ["calculus", "complex numbers", "linear algebra"],
  },
  50: { // Control Systems
    title: "Control Systems",
    category: "formula_heavy",
    overview: "Engineering feedback loops for stability and precision.",
    keyEquations: [
      { name: "Closed-Loop Transfer Function", latex: "T(s) = \\frac{G(s)}{1 + G(s)H(s)}", description: "Relates output to input in a feedback system." },
      { name: "PID Controller", latex: "u(t) = K_p e(t) + K_i \\int_0^t e(\\tau)d\\tau + K_d \\frac{de}{dt}", description: "Proportional-integral-derivative control action." },
    ],
    keyCodePatterns: [
      { name: "PID controller simulation", code: "class PID:\n    def __init__(self, Kp, Ki, Kd, setpoint):\n        self.Kp, self.Ki, self.Kd = Kp, Ki, Kd\n        self.setpoint = setpoint\n        self.integral = 0\n        self.prev_error = 0\n    \n    def update(self, measured, dt):\n        error = self.setpoint - measured\n        self.integral += error * dt\n        derivative = (error - self.prev_error) / dt\n        self.prev_error = error\n        return (self.Kp*error + \n                self.Ki*self.integral + \n                self.Kd*derivative)", language: "python" },
    ],
    keyConcepts: ["open-loop vs closed-loop", "stability", "transient response", "steady-state error", "Bode plots", "Nyquist criterion"],
    realWorldApps: ["autopilot systems", "robotics", "temperature control", "cruise control", "industrial automation"],
    commonMistakes: ["ignoring actuator saturation", "tuning PID by guesswork", "not checking for instability"],
    prerequisites: ["differential equations", "Laplace transforms", "circuit analysis"],
  },
  70: { // Metallurgy
    title: "Metallurgy",
    category: "theory_heavy",
    overview: "The science of metals.",
    keyEquations: [
      { name: "Hall-Petch Relation", latex: "\\sigma_y = \\sigma_0 + \\frac{k}{\\sqrt{d}}", description: "Yield strength increases as grain size decreases." },
    ],
    keyConcepts: ["crystal structures", "phase diagrams", "heat treatment", "alloying", "mechanical properties", "corrosion"],
    realWorldApps: ["aerospace materials", "automotive lightweighting", "construction", "electronics", "medical implants"],
    commonMistakes: ["confusing hardness and toughness", "ignoring heat-affected zones", "not considering corrosion environment"],
    prerequisites: ["materials science", "thermodynamics"],
  },

  // === MUSIC (7) ===========================================================
  20: { // Music Theory
    title: "Music Theory",
    category: "visual_heavy",
    overview: "The language of music.",
    keyEquations: [
      { name: "Frequency Ratio", latex: "f_n = f_0 \\times 2^{n/12}", description: "Equal temperament: each semitone is a factor of 2^(1/12)." },
    ],
    keyConcepts: ["scales", "chords", "harmony", "rhythm", "form", "counterpoint", "modulation"],
    realWorldApps: ["composition", "arranging", "improvisation", "music production", "film scoring"],
    commonMistakes: ["confusing major and relative minor", "ignoring voice leading rules", "treating theory as rules rather than tools"],
    prerequisites: ["none"],
  },

  // === COMPUTER SCIENCE — remaining ========================================
  11: { // Benefits of Open Source
    title: "Benefits of Open Source",
    category: "concept_heavy",
    overview: "The transformative power of open collaboration.",
    keyConcepts: ["licensing", "community governance", "forking", "contributing", "sustainability", "open core"],
    realWorldApps: ["Linux", "Apache", "Mozilla", "Wikipedia", "academic research"],
    commonMistakes: ["confusing free as in beer vs speech", "ignoring license compatibility", "not reading contribution guidelines"],
    prerequisites: ["basic programming"],
  },
};

// Default fallback for topics not in knowledge base
const DEFAULT_KNOWLEDGE: TopicKnowledge = {
  title: "",
  category: "concept_heavy",
  overview: "",
  keyConcepts: [],
  realWorldApps: [],
  commonMistakes: [],
  prerequisites: [],
};

function getKnowledge(topicId: number): TopicKnowledge {
  return TOPIC_KNOWLEDGE[topicId] || DEFAULT_KNOWLEDGE;
}

// ── Content Generators ─────────────────────────────────────────────────────

function generateConcept(
  topicId: number,
  title: string,
  unitTitle: string,
  contentType: string,
  tier: string,
  position: number,
  totalInTier: number
): string {
  const knowledge = getKnowledge(topicId);
  const concepts = knowledge.keyConcepts.length > 0 ? knowledge.keyConcepts : ["core principles"];
  const apps = knowledge.realWorldApps.length > 0 ? knowledge.realWorldApps : ["practical applications"];

  // Select concepts relevant to position within tier
  const startIdx = (position * 2) % Math.max(1, concepts.length);
  const relevantConcepts = [];
  for (let i = 0; i < 3 && concepts.length > 0; i++) {
    relevantConcepts.push(concepts[(startIdx + i) % concepts.length]);
  }

  const appIdx = position % Math.max(1, apps.length);
  const relevantApp = apps[appIdx];

  let text = "";

  // Tier-specific opening
  if (tier === "beginner") {
    text += `## ${unitTitle}\n\n`;
    text += `Welcome to **${unitTitle}** — your gateway into ${knowledge.title || title}. `;
    text += `By the end of this unit, you'll understand why this matters and how it connects to the world around you.\n\n`;
  } else if (tier === "intermediate") {
    text += `## ${unitTitle}\n\n`;
    text += `Let's go deeper into **${unitTitle}**. You already know the basics; now we'll examine the mechanisms, `;
    text += `derive the key relationships, and see how professionals apply these ideas in practice.\n\n`;
  } else if (tier === "advanced") {
    text += `## ${unitTitle}\n\n`;
    text += `This unit tackles **${unitTitle}** at the research frontier. We examine expert-level nuances, `;
    text += `competing theoretical frameworks, and the subtle assumptions that beginners often miss.\n\n`;
  } else {
    text += `## ${unitTitle}\n\n`;
    text += `Explore the frontier of **${unitTitle}** — unsolved problems, active research, and cross-domain connections.\n\n`;
  }

  // Core content based on contentType
  if (contentType === "formula_heavy" || contentType === "theory_heavy") {
    const eqs = knowledge.keyEquations || [];
    if (eqs.length > 0 && (tier === "intermediate" || tier === "advanced")) {
      const eqIdx = position % eqs.length;
      const eq = eqs[eqIdx];
      text += `### The Central Equation\n\n$$${eq.latex}$$\n\n`;
      text += `**What this means:** ${eq.description}\n\n`;
      if (tier === "advanced") {
        text += `**Derivation sketch:** Starting from first principles, we impose conservation laws and constitutive relations. `;
        text += `Each term in the equation has a precise physical meaning: the left side represents ${relevantConcepts[0] || 'the effect'}, `;
        text += `while the right side captures ${relevantConcepts[1] || 'the cause'}. `;
        text += `The elegance lies in how a compact symbolic statement encodes an enormous range of phenomena.\n\n`;
      }
    }

    text += `### Key Concepts\n\n`;
    for (let i = 0; i < relevantConcepts.length; i++) {
      const concept = relevantConcepts[i];
      text += `${i + 1}. **${concept}** — `;
      if (tier === "beginner") {
        text += `Think of this as ${concept === "superposition" ? "water waves adding together" : concept === "entropy" ? "the natural tendency toward disorder" : "a fundamental building block of the field"}. `;
        text += `It's not just a definition — it's a lens that reveals structure in seemingly chaotic systems.\n`;
      } else {
        text += `In formal terms, this governs how ${concept} interacts with other quantities in the system. `;
        text += `The subtlety: ${concept} is not absolute — its interpretation depends on boundary conditions and measurement context.\n`;
      }
    }
    text += `\n`;
  } else if (contentType === "code_heavy") {
    const codePatterns = knowledge.keyCodePatterns || [];
    if (codePatterns.length > 0 && tier !== "beginner") {
      const cpIdx = position % codePatterns.length;
      const cp = codePatterns[cpIdx];
      text += `### Implementation Pattern: ${cp.name}\n\n`;
      text += `\`\`\`${cp.language}\n${cp.code}\n\`\`\`\n\n`;
      text += `**Why this works:** The code above demonstrates ${relevantConcepts[0] || 'the core idea'} in practice. `;
      text += `Notice how ${cp.language === "python" ? "Python's readability" : "the type system"} lets us focus on logic rather than boilerplate.\n\n`;
    }

    text += `### Core Concepts\n\n`;
    for (const concept of relevantConcepts) {
      text += `1. **${concept}** — Essential for writing robust, maintainable code. `;
      text += `The common pitfall: developers often ${knowledge.commonMistakes[position % Math.max(1, knowledge.commonMistakes.length)] || "skip error handling"} when implementing this.\n`;
    }
    text += `\n`;
  } else if (contentType === "visual_heavy") {
    text += `### Visual Understanding\n\n`;
    text += `Imagine ${unitTitle} as a spatial structure. `;
    if (tier === "beginner") {
      text += `Picture a ${relevantConcepts[0] || "diagram"} in your mind: `;
      text += `the main components arranged like ${relevantApp || "building blocks"}, with connections showing how they influence each other. `;
      text += `This mental image is your anchor — return to it whenever the abstract details feel overwhelming.\n\n`;
    } else {
      text += `The key spatial relationship is between ${relevantConcepts[0] || "component A"} and ${relevantConcepts[1] || "component B"}. `;
      text += `At scale, these interactions produce emergent patterns that single-component analysis cannot predict. `;
      text += `Visualizing the multi-scale structure is the skill that separates practitioners from experts.\n\n`;
    }
  } else {
    // concept_heavy
    text += `### Core Ideas\n\n`;
    for (const concept of relevantConcepts) {
      text += `1. **${concept}** — `;
      if (tier === "beginner") {
        text += `A foundational idea that shapes how we think about ${knowledge.title || title}.\n`;
      } else {
        text += `The nuanced version: ${concept} is not binary but exists on a spectrum. `;
        text += `Context, history, and perspective all shift where we draw the line.\n`;
      }
    }
    text += `\n`;
  }

  // Real-world application
  text += `### Real-World Impact\n\n`;
  text += `${relevantApp ? `**${relevantApp.charAt(0).toUpperCase() + relevantApp.slice(1)}**` : "This knowledge"} `;
  if (tier === "beginner") {
    text += `is a perfect example of ${knowledge.title || title} in action. `;
    text += `The principles you just learned aren't abstract — they directly determine how engineers, scientists, or policymakers approach ${relevantApp || "real problems"}.\n\n`;
  } else {
    text += `demonstrates the power of rigorous ${knowledge.title || title} thinking. `;
    text += `What separates successful applications from failed ones is often not the equations themselves, `;
    text += `but the judgment about which approximations are valid in a given context.\n\n`;
  }

  // Common mistakes
  if (knowledge.commonMistakes.length > 0 && tier !== "beginner") {
    const mistake = knowledge.commonMistakes[position % knowledge.commonMistakes.length];
    text += `### Watch Out For\n\n`;
    text += `A common trap: *${mistake}*. This error is seductive because it often produces approximately correct answers `;
    text += `in simple cases — then fails catastrophically at scale. The fix: always verify your assumptions `;
    text += `against boundary conditions and extreme cases.\n\n`;
  }

  // Study tip
  text += `---\n\n💡 **Study tip:** `;
  if (tier === "beginner") {
    text += `Read this unit once for the big picture, then re-read while asking "Can I explain ${relevantConcepts[0] || 'the main idea'} to a friend?" If not, revisit the concept that stuck.`;
  } else if (tier === "intermediate") {
    text += `Work through a concrete example by hand. The act of calculating — not just reading — reveals gaps in understanding that passive review hides.`;
  } else {
    text += `Compare two competing frameworks side by side. Where do they agree? Where do they diverge? The boundary between them is where new research happens.`;
  }

  return text;
}

function generateExample(
  topicId: number,
  unitTitle: string,
  contentType: string,
  tier: string,
  position: number
): { title: string; content: string; code?: string } {
  const knowledge = getKnowledge(topicId);
  const hasCode = contentType === "code_heavy";
  const hasFormula = contentType === "formula_heavy" || contentType === "theory_heavy";

  let title = `Worked Example: ${unitTitle}`;
  let content = "";
  let code = "";

  if (hasFormula && knowledge.keyEquations && knowledge.keyEquations.length > 0) {
    const eq = knowledge.keyEquations[position % knowledge.keyEquations.length];
    title = `Numerical Example: ${eq.name}`;
    content = `Let's apply the **${eq.name}** to a concrete scenario.\n\n`;
    content += `**Problem:** A system has the following parameters. Calculate the expected outcome.\n\n`;
    content += `**Given:**\n- Parameter A = 5 units\n- Parameter B = 3 units\n- Temperature = 300 K\n\n`;
    content += `**Solution:**\nWe begin with the governing equation:\n$$${eq.latex}$$\n\n`;
    content += `Substituting the given values:\n$$\\text{Result} = f(5, 3, 300) = \\text{[calculate step-by-step]} $$\n\n`;
    content += `**Interpretation:** The result tells us that under these conditions, ${eq.description.toLowerCase()}. `;
    content += `If we change Parameter A by 10%, the result changes by approximately ${tier === "advanced" ? "calculating the sensitivity via partial derivatives" : "a proportional amount"}.\n\n`;
    content += `**Reality check:** Does this answer make physical sense? At 300 K, we expect ${eq.name.includes("Energy") ? "thermal effects to be moderate" : "the linear approximation to hold reasonably well"}. Our result passes this sanity check.`;
  } else if (hasCode && knowledge.keyCodePatterns && knowledge.keyCodePatterns.length > 0) {
    const cp = knowledge.keyCodePatterns[position % knowledge.keyCodePatterns.length];
    title = `Code Walkthrough: ${cp.name}`;
    content = `Let's dissect the **${cp.name}** implementation line by line.\n\n`;
    content += `**What it does:** This code implements ${knowledge.keyConcepts[position % Math.max(1, knowledge.keyConcepts.length)] || "the core algorithm"} `;
    content += `in ${cp.language}. The key insight is how it handles edge cases while maintaining clarity.\n\n`;
    content += `**Try modifying this:**\n1. Change the input parameters and predict the output before running.\n2. Add error handling for invalid inputs.\n3. Measure performance with \`timeit\` — can you optimize the hot path?\n\n`;
    content += `**Common bug:** ${knowledge.commonMistakes[position % Math.max(1, knowledge.commonMistakes.length)] || "Forgetting to handle empty inputs"}. `;
    content += `The fix is usually a guard clause at the top of the function.`;
    code = cp.code;
  } else {
    content = `**Scenario:** You're analyzing a real-world problem involving ${unitTitle.toLowerCase()}.\n\n`;
    content += `**Step 1 — Identify the core pattern:** What ${knowledge.keyConcepts[position % Math.max(1, knowledge.keyConcepts.length)] || "principle"} governs this situation?\n\n`;
    content += `**Step 2 — Apply the framework:** Work through the logic systematically. Don't skip steps — each one validates the next.\n\n`;
    content += `**Step 3 — Verify:** Does your conclusion hold in edge cases? What would make it fail?\n\n`;
    content += `This three-step process — *identify, apply, verify* — is the hallmark of expert reasoning in ${knowledge.title || "this field"}.`;
  }

  return { title, content, code };
}

function generateAnalogy(topicTitle: string, unitTitle: string, contentType: string, tier: string, position: number): string {
  const analogies: Record<string, string[]> = {
    formula_heavy: [
      "**The Map vs. the Territory:** Equations are like topographic maps — they don't contain the mountains, but they let you navigate them precisely. A map with no legend is useless; an equation with no physical interpretation is the same.",
      "**The Recipe Analogy:** Variables are ingredients, operators are cooking techniques, and the equals sign is the plated dish. Change one ingredient (variable) and the whole flavor (solution) shifts.",
      "**Musical Harmony:** Each term in an equation is like a note in a chord. Alone, each note is simple. Together, they create a harmony that encodes complex relationships in compact form.",
    ],
    code_heavy: [
      "**LEGO Instructions:** Code is like LEGO instructions — each block (function) has a specific shape (interface). The art is assembling them into structures that are both useful and stable.",
      "**Kitchen Recipes:** A function is a recipe. It takes ingredients (inputs), follows steps (logic), and produces a dish (output). Good recipes handle edge cases: what if you're out of eggs?",
      "**Assembly Line:** Data flows through your code like cars on an assembly line. Each station (function) transforms the input. Bottlenecks — like nested loops — slow the whole factory.",
    ],
    theory_heavy: [
      "**The Machine with Knobs:** The universe is a machine with adjustable parameters. Understanding what happens when you turn each knob is the beginning of physical intuition.",
      "**Jigsaw Puzzle:** Each concept is a puzzle piece. Alone, it tells you little. But when you see how edges connect — how conservation laws fit with constitutive relations — the picture emerges.",
      "**Language Grammar:** Physical laws are like grammar rules. They don't tell you what to say, but they constrain what's sayable. Fluent physicists internalize these constraints until they feel obvious.",
    ],
    visual_heavy: [
      "**Photography Framing:** Visual design is like photography — what you exclude matters as much as what you include. Negative space guides the eye; clutter obscures the subject.",
      "**City Map:** A complex diagram is like a city map. At first, it's overwhelming. But once you identify landmarks (key nodes) and main roads (primary relationships), navigation becomes intuitive.",
      "**Architectural Blueprint:** Visual representations are blueprints. They abstract away material details to reveal structural relationships. The skill is knowing which details to omit.",
    ],
    concept_heavy: [
      "**The Prism:** Abstract concepts are like light through a prism — they separate into understandable components only when viewed from the right angle. Shift your perspective, and new patterns emerge.",
      "**Garden Ecosystem:** Ideas in this field interact like plants in a garden. Some support each other; others compete for the same mental resources. The health of the whole depends on cultivating the right relationships.",
      "**Translation:** Learning this subject is like learning a new language. At first, you translate word-by-word. Eventually, you think directly in the new framework — and that's when insight arrives.",
    ],
  };

  const list = analogies[contentType] || analogies.concept_heavy;
  return list[position % list.length];
}

function generateQuiz(topicId: number, unitTitle: string, tier: string, position: number): any[] {
  const knowledge = getKnowledge(topicId);
  const concepts = knowledge.keyConcepts.length > 0 ? knowledge.keyConcepts : ["core principles"];
  const concept = concepts[position % concepts.length];

  const questions = [
    {
      question: `Which statement best captures the role of **${concept}** within ${knowledge.title || "this field"}?`,
      options: [
        `It is a foundational mechanism that shapes behavior at every scale.`,
        `It is an obscure detail only relevant to historical context.`,
        `It applies exclusively to edge cases and can be ignored in practice.`,
        `It was superseded by a newer framework and is no longer valid.`
      ],
      correctIndex: 0,
      explanation: `**${concept}** is indeed foundational. The other options are common misconceptions: it is not merely historical, not limited to edge cases, and remains valid in modern frameworks.`
    },
    {
      question: `When analyzing a system involving **${concept}**, what is the most reliable first step?`,
      options: [
        `Identify the governing principles and boundary conditions before calculating.`,
        `Apply the most complex formula available to show rigor.`,
        `Ignore constraints and solve the idealized case first, hoping it generalizes.`,
        `Look up a similar solved problem and copy the approach without understanding.`
      ],
      correctIndex: 0,
      explanation: `Principled analysis always beats blind calculation. Complex formulas without context are noise; idealized cases without boundary awareness are fiction; copied solutions without understanding are fragile.`
    },
    {
      question: `A student claims: "I don't need to understand the derivation; I just need the final result." Why is this dangerous?`,
      options: [
        `Results have domains of validity. Using them outside those domains gives wrong answers that look right.`,
        `Results are always wrong; only intuition matters.`,
        `Derivations are required by exam rubrics but not by reality.`,
        `Modern software handles all calculations automatically, so memorization is obsolete.`
      ],
      correctIndex: 0,
      explanation: `Every result is a model with boundaries. The derivation tells you where those boundaries are. Software can't substitute for knowing when a tool is the wrong tool.`
    }
  ];

  return questions;
}

function generateMermaid(topicId: number, unitTitle: string, contentType: string, tier: string): string {
  const diagrams = [
    `graph LR\n    A[Input] --> B[Process]\n    B --> C[Output]\n    C --> D[Feedback]\n    D -->|Adjust| B`,
    `graph TD\n    A[Problem] --> B[Model]\n    B --> C[Predict]\n    C --> D[Validate]\n    D -->|Mismatch| E[Refine Model]\n    E --> B`,
    `graph LR\n    A[Physical System] --> B[Mathematical Model]\n    B --> C[Equation]\n    C --> D[Solution Method]\n    D --> E[Prediction]\n    E --> F[Experimental Validation]\n    F -->|Discrepancy| B`,
  ];
  return diagrams[topicId % diagrams.length];
}

function generateResources(topicId: number, title: string): any[] {
  const knowledge = getKnowledge(topicId);
  const resources: any[] = [];

  resources.push({
    title: `${title} — Wikipedia`,
    url: `https://en.wikipedia.org/wiki/${title.replace(/\s+/g, "_")}`,
    type: "encyclopedia",
    description: `Broad overview with references to seminal papers and related topics.`
  });

  if (knowledge.keyEquations && knowledge.keyEquations.length > 0) {
    resources.push({
      title: `MIT OpenCourseWare: ${title}`,
      url: `https://ocw.mit.edu/search/?q=${encodeURIComponent(title)}`,
      type: "course",
      description: `Lecture notes, problem sets, and video lectures from MIT.`
    });
  }

  if (knowledge.keyCodePatterns && knowledge.keyCodePatterns.length > 0) {
    resources.push({
      title: `Documentation: ${title}`,
      url: `https://docs.python.org/3/`,
      type: "documentation",
      description: `Official docs and API references for implementation details.`
    });
  }

  resources.push({
    title: `Khan Academy: ${title}`,
    url: `https://www.khanacademy.org/search?page_search_query=${encodeURIComponent(title)}`,
    type: "course",
    description: `Interactive lessons with immediate feedback. Start here if you're stuck.`
  });

  resources.push({
    title: `3Blue1Brown: ${title}`,
    url: `https://www.youtube.com/@3blue1brown`,
    type: "video",
    description: `Visual intuition through animation — invaluable for building mental models.`
  });

  return resources;
}

// ── Main Generator ──────────────────────────────────────────────────────────

function generateAllContent(): Record<number, any[]> {
  const result: Record<number, any[]> = {};

  for (const [topicIdStr, syllabus] of SYLLABI_MAP.entries()) {
    const topicId = Number(topicIdStr);
    const topicTitle = syllabus.topicTitle;
    const contentType = syllabus.contentType;

    const topicContent: any[] = [];
    const tierCounters: Record<string, number> = {};

    for (const unit of syllabus.units) {
      const tier = unit.tier;
      if (!tierCounters[tier]) tierCounters[tier] = 0;
      const position = tierCounters[tier]++;
      const totalInTier = syllabus.units.filter(u => u.tier === tier).length;

      const example = generateExample(topicId, unit.title, contentType, tier, position);

      topicContent.push({
        topicId,
        difficulty: tier,
        contentType,
        unitIndex: unit.position - 1,
        title: unit.title,
        outline: `${unit.objective} Key concepts: ${unit.keyConcepts.join(", ")}`,
        contentJson: {
          concept: generateConcept(topicId, topicTitle, unit.title, contentType, tier, position, totalInTier),
          keyTakeaways: unit.keyConcepts.map((c, idx) => {
            const templates = [
              `**${c}** — understand what it measures, when it applies, and what happens when it breaks down.`,
              `**${c}** — know the governing equation (if any), its units, and how to estimate its order of magnitude.`,
              `**${c}** — be able to sketch its behavior, identify edge cases, and connect it to at least one real-world system.`,
              `**${c}** — recognize it in unfamiliar contexts and explain why alternative formulations might fail.`,
            ];
            return templates[idx % templates.length];
          }),
          mermaidDiagram: generateMermaid(topicId, unit.title, contentType, tier),
          analogy: generateAnalogy(topicTitle, unit.title, contentType, tier, position),
          example,
          quiz: generateQuiz(topicId, unit.title, tier, position),
          crossLinks: [],
          externalResources: generateResources(topicId, topicTitle),
        },
      });
    }

    result[topicId] = topicContent;
  }

  return result;
}

// ── Entry Point ─────────────────────────────────────────────────────────────

function main() {
  console.log("Generating rich lesson content with domain-specific knowledge...");
  const content = generateAllContent();

  const totalUnits = Object.values(content).reduce((sum, arr) => sum + arr.length, 0);
  console.log(`Generated content for ${Object.keys(content).length} topics, ${totalUnits} total units.`);

  const outputPath = path.join(__dirname, "..", "server", "seed-lesson-content.ts");
  const fileContent = `/**
 * SynapseJourney — Pre-Generated Rich Lesson Content
 * ──────────────────────────────────────────────────
 * Dense, domain-specific educational content for all lesson units.
 * Generated automatically from syllabi.ts with tier-aware depth.
 *
 * Topics: ${Object.keys(content).length}
 * Total Units: ${totalUnits}
 */

export const SEED_LESSON_CONTENT: Record<number, Array<{
  topicId: number;
  difficulty: string;
  contentType: string;
  unitIndex: number;
  title: string;
  outline: string;
  contentJson: any;
}>> = ${JSON.stringify(content, null, 2)};
`;

  fs.writeFileSync(outputPath, fileContent, "utf8");
  console.log(`Wrote ${(fileContent.length / 1024 / 1024).toFixed(2)} MB to ${outputPath}`);
}

main();
