# Skill: Video Summarize and Chaptering 🎥⏱️

## Purpose
Segment video into chapters with summaries and timestamps. Help users navigate long lectures by jumping to specific topics.

## When to Use
- User uploads long lecture video (>10 minutes)
- User asks "create chapters for this video"
- User wants "summary of each section"

## Input Contract
- `fileId`: string (required)
- `minChapterLength`: number (optional, default: 120 seconds)
- `maxChapters`: number (optional, default: 10)

## Workflow

### Step 1: Extract keyframes
- Sample video frames every 5-10 seconds
- Detect scene changes (visual diff > threshold)
- Mark potential chapter boundaries

### Step 2: Transcribe audio (if not done)
- Use `audio-transcribe-and-index` skill
- Get full transcript with timestamps

### Step 3: Detect topic changes
Analyze transcript for topic shifts:
- Look for transition phrases: "Now let's move on to", "Next topic", "In conclusion"
- Detect keyword clusters (TF-IDF changes)
- Combine with scene changes

### Step 4: Create chapters
For each detected segment:
- Start time, end time
- Extract key sentence as title
- Generate 1-2 sentence summary

Example logic:
```typescript
const chapters = []
let currentStart = 0

for (const boundary of topicBoundaries) {
  const segment = transcript.slice(currentStart, boundary.timestamp)
  const title = extractKeyPhrase(segment)  // "Introduction to Photosynthesis"
  const summary = summarizeSegment(segment)  // "Explains basic concepts..."
  
  chapters.push({
    start: currentStart,
    end: boundary.timestamp,
    title,
    summary
  })
  
  currentStart = boundary.timestamp
}
```

### Step 5: Validate chapters
- Ensure min chapter length (merge if too short)
- Ensure max chapters (split if too many)
- Remove duplicate titles

### Step 6: Generate key points per chapter
For each chapter:
- Extract 3-5 bullet points
- Highlight important terms
- Note any visual aids (diagrams, slides)

### Step 7: Format output
```json
{
  "chapters": [
    {
      "index": 1,
      "title": "Introduction to Photosynthesis",
      "start": 0,
      "end": 180,
      "summary": "Introduces the concept of photosynthesis and its importance in biology.",
      "keyPoints": [
        "Photosynthesis converts light energy to chemical energy",
        "Occurs in chloroplasts",
        "Requires water, CO2, and sunlight"
      ],
      "thumbnail": "data:image/jpeg;base64,..."
    },
    {
      "index": 2,
      "title": "Light-Dependent Reactions",
      "start": 180,
      "end": 420,
      "summary": "Explains the light-dependent stage occurring in thylakoid membranes.",
      "keyPoints": [...]
    }
  ],
  "totalDuration": 1500,
  "totalChapters": 5
}
```

## Output Contract
Must include:
- `chapters`: array of chapter objects
- Each chapter must have: `index`, `title`, `start`, `end`, `summary`
- `totalDuration`: video length in seconds

## Atomic Tools Used
- `fileIO.getFileBlob(fileId)`
- `extract.extractKeyframes(videoBlob, interval)`
- `extract.detectSceneChanges(keyframes)`
- `ocr.transcribeAudio(audioTrack)` (reuse from audio skill)
- `transform.detectTopicBoundaries(transcript)`
- `transform.extractKeyPhrase(text)`
- `transform.summarizeSegment(text)`

## Verification Rules
- At least 2 chapters (otherwise video too short)
- All chapters within video duration
- No overlapping chapters
- Each chapter summary < 100 words

## Error Handling
- If video too short (<2 min) → return single chapter
- If transcript unavailable → use visual-only segmentation
- If topic detection fails → fallback to equal time segments

## Estimated Tokens
~4000 tokens (transcript analysis + summarization)

## Example Usage
**User**: Uploads `biology_lecture_ch3.mp4` (25 minutes)
**Output**:
```json
{
  "chapters": [
    {
      "index": 1,
      "title": "Introduction",
      "start": 0,
      "end": 180,
      "summary": "Overview of cellular respiration process",
      "keyPoints": ["ATP production", "Glycolysis overview"]
    },
    {
      "index": 2,
      "title": "Glycolysis",
      "start": 180,
      "end": 540,
      "summary": "Detailed explanation of glycolysis steps",
      "keyPoints": [...]
    }
  ],
  "totalChapters": 5,
  "totalDuration": 1500
}
```

User can click chapter 2 → jump to 03:00 in video
