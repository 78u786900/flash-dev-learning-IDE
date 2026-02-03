# LaTeX commutative diagrams & abstract algebra

How to write commutative diagrams and other complicated diagrams for higher-level abstract math (e.g. abstract algebra, category theory). **In-app notes use KaTeX**; full LaTeX (e.g. for PDF export) can use tikz-cd or xy-pic.

---

## 1. In-app: KaTeX `{CD}` (AMS CD)

Notes render with **KaTeX**, which supports the **AMS `{CD}` environment** only. No TikZ, no xy-pic.

### Supported: horizontal and vertical arrows only

- **No diagonal arrows** — AMS CD is strictly rectangular.
- Rows alternate: one row of **objects + horizontal arrows**, next row of **vertical arrows** (and optionally more horizontal connectors).

### Arrow syntax (between cells)

| Meaning        | Syntax (horizontal row) | Syntax (vertical column) |
|----------------|--------------------------|---------------------------|
| Right arrow    | `@>>>` or `@>label>>`    | —                         |
| Left arrow     | `@<<<` or `@<<label<<`   | —                         |
| Down arrow     | —                        | `@VVV` or `@VlabelV`      |
| Up arrow       | —                        | `@AAA` or `@AlabelA`      |
| Horizontal “=” | `@=`                      | —                         |
| Vertical “\|”  | —                        | `@\|`                     |
| Invisible      | `@.`                     | `@.`                      |

- **Labels**: For right arrow: `@>a>>` (label `a` above). For left: `@<<b<<` (label `b` above). For down: `@VfVV` (label `f` to the right of arrow). For up: `@AgA` (label `g` to the right). Use `@VVV` etc. when no label.
- **Swap label side**: In amscd, label position can be adjusted with spacing; KaTeX follows the same idea (label above/below or left/right depending on arrow type).
- **Common mistake**: In the vertical-arrow row, use exactly `@VlabelV` for each column (down arrow with label). Wrong: `@VpVVA` (trailing `A` breaks the diagram). Correct: `@VpVV` and `@VVuVV` (no extra letter after the final `V`).
- **Labels with brackets or special characters**: Wrap the label in **braces** so KaTeX does not treat `[` `]` as optional-argument delimiters. Wrong: `@V[-]BVV` (breaks). Correct: `@V{[-]_B}VV` or `@V{[-]_{B'}}VV`. Use `{...}` around any label that contains `[`, `]`, `_`, or multi-token math.

### Example (works in notes)

```latex
\begin{CD}
A @>f>> B \\
@VgVV @VVhV \\
C @>>k> D
\end{CD}
```

Short exact sequence:

```latex
\begin{CD}
0 @>>> A @>i>> B @>p>> C @>>> 0
\end{CD}
```

Another rectangle:

```latex
\begin{CD}
M @>\varphi>> M' \\
@V\pi VV @VV\pi'V \\
M/N @>\overline{\varphi}>> M'/N'
\end{CD}
```

### References

- KaTeX supported functions: [Environments](https://katex.org/docs/supported.html) — see `\begin{CD}`.
- AMS CD (same as KaTeX): [J.S. Milne, CDGuide](https://www.jmilne.org/not/CDGuide.html), [Mamscd.pdf](https://www.jmilne.org/not/Mamscd.pdf).

---

## 2. Full LaTeX: complex diagrams (when you need diagonals, pullbacks, etc.)

For **export to full LaTeX / PDF** (or if you later paste into a real LaTeX doc), use one of these.

### Recommended: **tikz-cd**

- **Package**: `\usepackage{tikz-cd}` (needs TikZ).
- **Strengths**: Diagonals, curved arrows, dashed/hooked/double arrows, pullbacks, pushouts, snake lemma, full control.
- **Syntax**: Matrix-like; arrows from cell to cell with direction letters.

**Direction letters**: `r` right, `l` left, `u` up, `d` down, and combinations: `dr`, `dl`, `ur`, `ul`, `rr`, `dd`, etc.

**Basic example (rectangle):**

```latex
\begin{tikzcd}
A \ar[r,"f"] \ar[d,"g"'] & B \ar[d,"h"] \\
C \ar[r,"k"] & D
\end{tikzcd}
```

**Diagonal arrows (e.g. universal map):**

```latex
\begin{tikzcd}
T \ar[r,"\eta T"] \ar[d,swap,"T\eta"] \ar[dr] & T^2 \ar[d,"\mu"] \\
T^2 \ar[r,swap,"\mu"] & T
\end{tikzcd}
```

**Pullback (with dashed universal arrow):**

```latex
\begin{tikzcd}
B \ar[ddr,"\mathrm{Id}"'] \ar[drr,"h"] \ar[dr,dashed,"\exists!\beta"] \\
& P \ar[r,"p"] \ar[d,"q"'] & A \ar[d,"f"] \\
& B \ar[r,"g"'] & C
\end{tikzcd}
```

**Arrow options**: `dashed`, `hook` (injection), `two heads` (surjection), `tail`, `swap` (label on other side). Example: `\ar[r, hook, "i"]`, `\ar[r, two heads, "\pi"]`, `\ar[dr, dashed, "\exists!u"]`.

**References**: [CTAN tikz-cd](https://ctan.org/pkg/tikz-cd), TeX Stack Exchange (e.g. “pullback with universal property”, “diagonal lines in commutative diagrams”).

### Alternative: **xy-pic / xymatrix**

- **Package**: `\usepackage[all,cmtip]{xy}`; then `\xymatrix{ ... }`.
- **Syntax**: Objects in matrix; arrows attached to **source** with `\ar[direction]`. Diagonals: `\ar[rd]`, `\ar[lu]`, etc.

**Example:**

```latex
\xymatrix{
  A \ar[r]^f \ar[d]_g & B \ar[d]^h \\
  C \ar[r]_k & D
}
```

Diagonal: `\ar[rd]^u` (right-down with label `u`). Curved: `\ar@/^/[r]`, `\ar@/_/[r]`. Dashed: `\ar@{-->}[r]`, injection `\ar@{|->}[r]`, surjection `\ar@{->>}[r]`.

**References**: [xy-pic](https://ctan.org/pkg/xymatrix), [J.S. Milne, xymatrix](https://www.jmilne.org/not/Mxymatrix.pdf).

### Simple full LaTeX: **amscd**

- **Package**: `\usepackage{amscd}`.
- **Same as KaTeX CD**: only horizontal and vertical arrows, rectangular. Use when you want the **same** source in KaTeX and in a LaTeX PDF.

---

## 3. Summary: what to use where

| Context              | Use                    | Diagonals / complex? |
|----------------------|------------------------|------------------------|
| **In-app notes**     | KaTeX `\begin{CD}...\end{CD}` | No — horizontal/vertical only |
| **Full LaTeX / PDF** | **tikz-cd** (or xy-pic) | Yes — pullbacks, snake lemma, etc. |
| **Same diagram in both** | Keep it rectangular and use `{CD}` in notes; in LaTeX you can still use `amscd` or tikz-cd for the same layout |

---

## 4. Workarounds in notes (KaTeX only)

- **Diagonals**: KaTeX CD does **not** support them. Options:
  - Use a **rectangular** version of the diagram (extra objects and horizontal/vertical arrows only), or
  - Describe the diagram in words and add a **PlantUML** or **external image** (e.g. “see diagram below”) if you need a picture.
- **Fancy arrows** (injection, surjection, dashed): In `{CD}` you only get solid arrows and “=”; you can denote injective/surjective in the **label** (e.g. `@>i\ \text{(inj)}>>` or “\(\hookrightarrow\)” in label text).
- **Very large diagrams**: Consider splitting into smaller `{CD}` blocks or one PlantUML diagram for overview.

---

## 5. Quick reference: KaTeX CD only (copy-paste)

```
Horizontal:  @>>>  @<<<  @>label>>  @<<label<<  @=
Vertical:    @VVV  @AAA  @VlabelV    @AlabelA    @|
Empty:       @.
Row format:  A @>>> B \\   then   @VVV @VVV \\   then   C @>>> D
```

Use `$$ ... $$`, `\[ ... \]`, or **naked** `\begin{CD} ... \end{CD}` in notes (all are detected as display math). Labels with brackets or subscripts must be braced: `@V{[-]_B}VV`, not `@V[-]BVV`.
