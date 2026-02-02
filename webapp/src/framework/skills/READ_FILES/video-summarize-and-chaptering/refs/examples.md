# Example: Biology Lecture Video

## Input
```json
{
  "fileId": "file-video-123",
  "minChapterLength": 120,
  "maxChapters": 5
}
```

## Video File
- `biology_lecture_ch3.mp4` (25 minutes, 1500 seconds)
- Topic: Cellular Respiration

## Output
```json
{
  "chapters": [
    {
      "index": 1,
      "title": "Introduction to Cellular Respiration",
      "start": 0,
      "end": 180,
      "summary": "Overview of cellular respiration process and its importance in energy production.",
      "keyPoints": [
        "Cellular respiration produces ATP",
        "Occurs in mitochondria",
        "Three main stages: glycolysis, Krebs cycle, electron transport"
      ]
    },
    {
      "index": 2,
      "title": "Glycolysis Process",
      "start": 180,
      "end": 540,
      "summary": "Detailed explanation of glycolysis steps and glucose breakdown in the cytoplasm.",
      "keyPoints": [
        "Takes place in cytoplasm",
        "Glucose → 2 pyruvate",
        "Net gain: 2 ATP + 2 NADH"
      ]
    },
    {
      "index": 3,
      "title": "Krebs Cycle",
      "start": 540,
      "end": 900,
      "summary": "The Krebs cycle oxidizes acetyl-CoA to produce electron carriers in the mitochondrial matrix.",
      "keyPoints": [
        "Occurs in mitochondrial matrix",
        "Produces NADH and FADH2",
        "Releases CO2 as waste"
      ]
    },
    {
      "index": 4,
      "title": "Electron Transport Chain",
      "start": 900,
      "end": 1260,
      "summary": "Final stage where most ATP is produced through oxidative phosphorylation.",
      "keyPoints": [
        "Inner mitochondrial membrane",
        "Uses NADH and FADH2",
        "Produces ~34 ATP"
      ]
    },
    {
      "index": 5,
      "title": "Summary and Applications",
      "start": 1260,
      "end": 1500,
      "summary": "Recap of key concepts and real-world applications of cellular respiration.",
      "keyPoints": [
        "Total ATP yield: ~38 ATP per glucose",
        "Clinical applications",
        "Connection to metabolism"
      ]
    }
  ],
  "totalDuration": 1500,
  "totalChapters": 5
}
```
