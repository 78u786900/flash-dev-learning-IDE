# Skill: Audio Transcribe and Index 🎧📝

## Purpose
Transcribe audio/video to text with timestamps. Build searchable index for quick lookup of "what was said at time X".

## When to Use
- User uploads lecture audio/video
- User asks "transcribe this audio"
- User wants to search audio content: "where did they talk about X?"

## Input Contract
- `fileId`: string (required)
- `timeRange`: TimeRange (optional, transcribe specific segment)
- `language`: string (optional, default: auto-detect)
- `speakerDiarization`: boolean (optional, identify different speakers)

## Workflow

### Step 1: Extract audio track
If video file:
- Extract audio using Web Audio API or ffmpeg
- Convert to supported format (WAV, MP3, M4A)

If already audio:
- Read blob directly

### Step 2: Call transcription API
**Option A: Gemini API (if supports audio)**
```typescript
const audioDataUrl = await fileToBase64(audioBlob)
const prompt = "Transcribe this audio with timestamps every 30 seconds. Format: [00:00] text"
const result = await callGeminiAudio(audioDataUrl, prompt)
```

**Option B: Web Speech API** (client-side, real-time)
```typescript
const recognition = new webkitSpeechRecognition()
recognition.continuous = true
recognition.interimResults = true
const transcript = await recognizeAudio(audioBlob)
```

**Option C: External API** (Whisper, Google Speech-to-Text)
- Send audio to API
- Parse response with timestamps

### Step 3: Parse transcript and timestamps
Expected format:
```
[00:00] Welcome to today's lecture on photosynthesis
[00:32] First, let's define what photosynthesis means
[01:15] The process involves chlorophyll in plant cells
```

Parse into structured format:
```json
{
  "segments": [
    {"start": 0, "end": 32, "text": "Welcome to..."},
    {"start": 32, "end": 75, "text": "First, let's..."},
    {"start": 75, "end": 120, "text": "The process..."}
  ]
}
```

### Step 4: Build search index
- Split transcript into sentences
- Create keyword index (TF-IDF)
- Map each sentence to timestamp
- Store in file.index.chunks

### Step 5: (Optional) Speaker diarization
If `speakerDiarization = true`:
- Identify different speakers (Speaker 1, Speaker 2, etc)
- Label each segment with speaker
- Useful for interviews, group discussions

### Step 6: Format output
```json
{
  "transcript": "Full transcript text...",
  "segments": [
    {"start": 0, "end": 32, "text": "...", "speaker": "Speaker 1"}
  ],
  "duration": 1234.5,
  "language": "en",
  "confidence": 0.87,
  "timestamps": [
    {"time": 0, "label": "Introduction"},
    {"time": 300, "label": "Main Topic"},
    {"time": 900, "label": "Conclusion"}
  ]
}
```

## Output Contract
Must include:
- `transcript`: full text
- `segments`: array with timestamps
- `duration`: total seconds
- `confidence`: 0-1 score

## Atomic Tools Used
- `fileIO.getFileBlob(fileId)`
- `extract.extractAudioTrack(videoBlob)`
- `ocr.transcribeAudio(audioBlob, language)`
- `transform.parseTimestamps(transcript)`
- `fileIO.updateFileIndex(fileId, segments)`

## Verification Rules
- Transcript must be non-empty
- All segments must have valid timestamps (start < end)
- Total duration must match file metadata
- Confidence >= 0.5 (warn if lower)

## Error Handling
- If audio quality poor → return low confidence + warning
- If language not supported → return error with supported list
- If file too large → suggest splitting into chunks

## Estimated Tokens
~3000 tokens (transcription + indexing)

## Example Usage
**User**: Uploads `lecture_week3.mp3` (25 minutes)
**Output**:
```json
{
  "transcript": "Welcome to week 3. Today we'll discuss cellular respiration...",
  "segments": [
    {"start": 0, "end": 45, "text": "Welcome to week 3..."},
    {"start": 45, "end": 120, "text": "Today we'll discuss..."}
  ],
  "duration": 1500,
  "confidence": 0.89
}
```

User can now search: "where did they mention ATP?" → returns timestamp 03:45
