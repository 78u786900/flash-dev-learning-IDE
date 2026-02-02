# Example 1: Simple Transcription

## Input
```json
{
  "fileId": "file-audio-123",
  "language": "en"
}
```

## Audio File
- `lecture_recording.mp3` (15 minutes)
- Single speaker

## Output
```json
{
  "transcript": "Welcome to today's lecture on photosynthesis. First, let's define what photosynthesis means...",
  "segments": [
    {
      "start": 0,
      "end": 32,
      "text": "Welcome to today's lecture on photosynthesis."
    },
    {
      "start": 32,
      "end": 75,
      "text": "First, let's define what photosynthesis means."
    }
  ],
  "duration": 900,
  "language": "en",
  "confidence": 0.89,
  "timestamps": [
    { "time": 0, "label": "Introduction" },
    { "time": 300, "label": "Main Topic" },
    { "time": 750, "label": "Conclusion" }
  ]
}
```

---

# Example 2: With Speaker Diarization

## Input
```json
{
  "fileId": "file-audio-456",
  "speakerDiarization": true
}
```

## Audio File
- `interview.mp3` (20 minutes)
- Two speakers (interviewer + guest)

## Output
```json
{
  "transcript": "Speaker 1: Thank you for joining us today. Speaker 2: Thank you for having me...",
  "segments": [
    {
      "start": 0,
      "end": 5,
      "text": "Thank you for joining us today.",
      "speaker": "Speaker 1"
    },
    {
      "start": 5,
      "end": 10,
      "text": "Thank you for having me.",
      "speaker": "Speaker 2"
    }
  ],
  "duration": 1200,
  "language": "en",
  "confidence": 0.87
}
```

---

# Example 3: Time Range Transcription

## Input
```json
{
  "fileId": "file-audio-789",
  "timeRange": { "start": 60, "end": 180 }
}
```

## Output
```json
{
  "transcript": "In this section, we'll discuss the light-dependent reactions...",
  "segments": [
    {
      "start": 60,
      "end": 90,
      "text": "In this section, we'll discuss the light-dependent reactions."
    }
  ],
  "duration": 120,
  "confidence": 0.92
}
```
