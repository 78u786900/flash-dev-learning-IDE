# PlantUML digraph: use only DOT syntax

Inside `@startuml` + `digraph name { ... }`, **only GraphViz DOT** is allowed. PlantUML constructs like `note as N1 ... end note` are **not** valid and cause "syntax error".

To add a note/caption in DOT, use a **node** with a multi-line `label` (use `\n` for newlines):

```dot
N1 [label="泛性質:\n若 f: X → Y 滿足 f(R) = 0,\n則存在唯一的 g: X/R → Y,\n使得 f = g ∘ q", shape=box, style=rounded]
```

Use `rank=same` (no space around `=`) for DOT.
