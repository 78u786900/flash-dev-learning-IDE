# Tables in notes (KaTeX array)

Notes render math with **KaTeX**. Tables use the **`array`** environment (KaTeX does not support full LaTeX `tabular`).

## Syntax

- **Environment**: `\begin{array}{column spec} ... \end{array}`
- **Column spec**: `c` = center, `l` = left, `r` = right; `|` = vertical rule between columns.
- **Rows**: separate with `\\`; **cells**: separate with `&`.
- **Horizontal rule**: use `\hline` after `\\` for a full-width line.

## Examples

**Simple 2×3 table (centered):**

```latex
\begin{array}{ccc}
a & b & c \\
d & e & f
\end{array}
```

**With vertical lines and header row:**

```latex
\begin{array}{c|l|r}
\text{左} & \text{中} & \text{右} \\
\hline
1 & 2 & 3 \\
x & y & z
\end{array}
```

**In notes:** You can write the block **with or without** `$$` or `\[ \]`; naked `\begin{array}...\end{array}` is detected and rendered as display math.

## Limitations (KaTeX)

- No `\multicolumn` or `\multirow` (no cell spanning).
- For very complex tables, use HTML `<table>` in a custom block or an image.
