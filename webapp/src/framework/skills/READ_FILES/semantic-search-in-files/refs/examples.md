# Example: Search for "photosynthesis"

## Input
```json
{
  "query": "where is photosynthesis mentioned?",
  "fileIds": ["file-123", "file-456"],
  "maxResults": 5
}
```

## Output
```json
{
  "query": "where is photosynthesis mentioned?",
  "results": [
    {
      "file_id": "file-123",
      "file_name": "biology_notes.pdf",
      "location": "page:12",
      "quote": "Photosynthesis is the process by which plants convert light energy into chemical energy",
      "confidence": 0.95,
      "context": "In chapter 3, we discuss cellular processes. Photosynthesis is the process... This occurs in chloroplasts."
    },
    {
      "file_id": "file-456",
      "file_name": "chapter2.docx",
      "location": "page:5",
      "quote": "The rate of photosynthesis depends on light intensity, CO2 concentration, and temperature",
      "confidence": 0.88
    }
  ],
  "totalMatches": 2,
  "searchTime": 245
}
```
