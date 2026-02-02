# Complete Examples - Codebase Reading

## Example: React TypeScript Project

### Input
```json
{
  "fileId": "file-zip-123",
  "language": "typescript",
  "maxDepth": 3
}
```

### Project Structure
```
my_react_app/
├── src/
│   ├── index.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── Header.tsx
│   │   └── Footer.tsx
│   └── utils/
│       └── helpers.ts
├── package.json
└── tsconfig.json
```

### Output
```json
{
  "fileTree": [
    "src/index.tsx",
    "src/App.tsx",
    "src/components/Header.tsx",
    "src/components/Footer.tsx",
    "src/utils/helpers.ts",
    "package.json",
    "tsconfig.json"
  ],
  "totalFiles": 7,
  "totalLOC": 420,
  "languages": ["typescript", "tsx", "json"],
  "dependencies": {
    "src/index.tsx": ["./App", "react", "react-dom"],
    "src/App.tsx": ["./components/Header", "./components/Footer", "react"],
    "src/components/Header.tsx": ["react"],
    "src/components/Footer.tsx": ["react"],
    "src/utils/helpers.ts": []
  },
  "entryPoints": ["src/index.tsx"],
  "keyModules": [
    {
      "name": "components",
      "purpose": "UI components",
      "files": 2
    },
    {
      "name": "utils",
      "purpose": "Helper functions",
      "files": 1
    }
  ],
  "summary": "A React TypeScript web application with component-based architecture. Uses React 19 with functional components and hooks.",
  "diagram": "graph LR\n  A[index.tsx] --> B[App.tsx]\n  B --> C[Header.tsx]\n  B --> D[Footer.tsx]"
}
```
