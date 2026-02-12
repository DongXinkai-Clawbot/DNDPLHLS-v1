# Algorithm Specifications: Microtonality Engine

## 1. Sethares Dissonance Calculation

### 1.1. Mathematical Formula
Given a timbre with partials $F = \{f_1, f_2, \dots, f_N\}$ and amplitudes $A = \{a_1, a_2, \dots, a_N\}$, the dissonance $D$ of an interval with frequency ratio $\alpha$ (where the second tone has frequencies $\alpha f_i$) is the sum of pairwise dissonances between all partials of the first tone and all partials of the second tone.

Let $x = |f_1 - f_2| / (0.021 \cdot f_{\min} + 19)$, where $f_{\min} = \min(f_1, f_2)$.
The dissonance between two partials $(f_1, a_1)$ and $(f_2, a_2)$ is:
$$ d(f_1, f_2, a_1, a_2) = a_{\min} \cdot (e^{-3.5 \cdot x} - e^{-5.75 \cdot x}) $$
Where $a_{\min} = \min(a_1, a_2)$.

### 1.2. Pseudocode
```typescript
function calculateDissonance(partials: {freq: number, amp: number}[], intervalRatio: number): number {
    let totalDissonance = 0;
    const tone1 = partials;
    const tone2 = partials.map(p => ({ freq: p.freq * intervalRatio, amp: p.amp }));

    // Compare all partials of tone1 with all partials of tone2
    for (let p1 of tone1) {
        for (let p2 of tone2) {
            totalDissonance += pairwiseDissonance(p1, p2);
        }
    }
    // Also add internal dissonance of tone2 (optional, usually constant for a fixed timbre)
    return totalDissonance;
}

function pairwiseDissonance(p1, p2): number {
    const fMin = Math.min(p1.freq, p2.freq);
    const fMax = Math.max(p1.freq, p2.freq);
    const aMin = Math.min(p1.amp, p2.amp);
    
    const s = 0.24 / (0.021 * fMin + 19); 
    const diff = fMax - fMin;
    const x = s * diff;
    
    return aMin * (Math.exp(-3.5 * x) - Math.exp(-5.75 * x));
}
```

## 2. Just Intonation Lattice Generation

### 2.1. Generation Algorithm
Generate points in a multi-dimensional lattice up to a certain "Tenney Height" or prime limit.

**Input:**
*   `primes`: Array of prime numbers (e.g., [2, 3, 5, 7]).
*   `limit`: Maximum complexity (e.g., Tenney Height < H).

**Algorithm:**
1.  Start with the origin vector $[0, 0, \dots, 0]$ (Unison, 1/1).
2.  Use a Breadth-First Search (BFS) or Priority Queue to explore neighbors.
3.  For each point $v = [v_2, v_3, \dots]$, neighbors are $v \pm e_i$ (where $e_i$ is the unit vector for prime $p_i$).
4.  Calculate the ratio: $R = \prod p_i^{v_i}$.
5.  Calculate Tenney Height: $H(n/d) = \log_2(n \cdot d)$.
6.  If $H(R) < limit$, add to set and continue exploring.

### 2.2. Mathematical Helper
To normalize to one octave ($1 \le R < 2$):
$$ v'_2 = v_2 - \lfloor \log_2(\prod_{i>0} p_i^{v_i}) \rfloor $$

## 3. Fokker Periodicity Block Construction

### 3.1. Mathematical Basis
Input: A set of unison vectors (commas) $U = \{u_1, u_2, \dots, u_k\}$ defined in prime basis.
Let $M$ be the matrix where rows are $u_i$.

**Algorithm:**
1.  Compute the **Hermite Normal Form (HNF)** of $M$.
    Let $H = U \cdot V$, where $V$ is unimodular.
2.  The non-zero rows of $H$ form a basis for the sublattice of unison vectors.
3.  The **Periodicity Block** corresponds to the fundamental domain of the lattice quotient $L / \text{span}(U)$.
4.  The number of pitches in the block is given by the determinant of the basis matrix (if full rank) or the index of the sublattice.
5.  **Identify Points:** Iterate through integer coordinates in the basis defined by the complementary subspace to find the unique representatives modulo $U$.

## 4. Regular Temperament Mapping

### 4.1. Mapping Matrix (Val)
A regular temperament is defined by a mapping matrix $T$ (often called a 'val' or 'valuation') that maps prime intervals to generator steps.
$$ \mathbf{g} = T \cdot \mathbf{p} $$
Where:
*   $\mathbf{p}$ is the interval vector in prime basis (e.g., $[v_2, v_3, v_5]^T$).
*   $T$ is a $k \times n$ matrix ($k$ generators, $n$ primes).
*   $\mathbf{g}$ is the vector of generator steps.

### 4.2. Example: 12-TET (Meantone-ish)
Primes: [2, 3, 5]
Map:
*   2 -> 12 steps
*   3 -> 19 steps (approximation of perfect fifth 701.9 cents -> 700)
*   5 -> 28 steps (approximation of major third 386.3 cents -> 400)
$$ T = [12, 19, 28] $$
Interval 5/4 (vector $[-2, 0, 1]$):
$$ steps = 12(-2) + 19(0) + 28(1) = -24 + 28 = 4 $$
4 steps = 400 cents (Major Third).

### 4.3. Generator Tuning
To find the exact tuning of the generator (e.g., the "fifth" in Meantone), we solve a least-squares optimization problem to minimize the error of the mapped prime intervals weighted by their importance (usually inversely proportional to prime limit or Tenney height).
