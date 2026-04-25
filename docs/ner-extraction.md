# NER / Entity Extraction — Pioneer AI (GLiNER2)

## Endpoint

```
POST https://api.pioneer.ai/v1/chat/completions
```

## Auth

```
Authorization: Bearer pio_sk_e76ce3a4-c71b-4945-8a14-1855c3bbe62e_0wl_YlSYkfLGE6pGUbiY
```

## Model

```
fastino/gliner2-base-v1
```

## Request Format

The text to extract from goes inside `messages[0].content`. The `schema` field controls what to extract.

```json
{
  "model": "fastino/gliner2-base-v1",
  "messages": [
    { "role": "user", "content": "<your text here>" }
  ],
  "schema": {
    "entities": ["person", "organization", "location", "product"],
    "relations": ["ceo_of", "located_in", "unveiled"],
    "classifications": [
      { "task": "topic", "labels": ["technology", "business", "politics", "science"], "multi_label": true },
      { "task": "sentiment", "labels": ["positive", "negative", "neutral"] }
    ],
    "structures": {
      "press_event": {
        "fields": [
          { "name": "company", "dtype": "str" },
          { "name": "spokesperson", "dtype": "str" },
          { "name": "product_name", "dtype": "str" },
          { "name": "event_type", "dtype": "str", "choices": ["product_launch", "earnings_call", "keynote", "press_conference"] },
          { "name": "key_topics", "dtype": "list" }
        ]
      }
    }
  },
  "include_confidence": true,
  "include_spans": true
}
```

### Schema fields (all optional)

| Field             | Description                                                       |
|-------------------|-------------------------------------------------------------------|
| `entities`        | List of entity types to extract (e.g. person, location)          |
| `relations`       | List of relation types between entities                           |
| `classifications` | Text classification tasks with label sets                         |
| `structures`      | Named structured objects with typed fields to extract             |
| `include_confidence` | Return confidence scores per extraction (default: false)      |
| `include_spans`   | Return character start/end offsets (default: false)               |

## Invoice / Document Extraction Example

```bash
curl -X POST "https://api.pioneer.ai/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer pio_sk_e76ce3a4-c71b-4945-8a14-1855c3bbe62e_0wl_YlSYkfLGE6pGUbiY" \
  -d '{
    "model": "fastino/gliner2-base-v1",
    "messages": [
      { "role": "user", "content": "my address is mullerstrasse 55A. 555EUR in rent" }
    ],
    "schema": {
      "entities": ["address", "amount", "date", "email", "iban", "invoice_number", "location", "organization", "person_name", "phone", "tax_number", "time"]
    },
    "include_confidence": true,
    "include_spans": true
  }'
```

## Full Example (entities + relations + classification + structure)

```bash
curl -X POST "https://api.pioneer.ai/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer pio_sk_e76ce3a4-c71b-4945-8a14-1855c3bbe62e_0wl_YlSYkfLGE6pGUbiY" \
  -d '{
    "model": "fastino/gliner2-base-v1",
    "messages": [
      { "role": "user", "content": "Tim Cook, CEO of Apple, unveiled the Vision Pro headset during a keynote at Apple Park in Cupertino." }
    ],
    "schema": {
      "entities": ["person", "organization", "location", "product"],
      "relations": ["ceo_of", "located_in", "unveiled"],
      "classifications": [
        { "task": "topic", "labels": ["technology", "business", "politics", "science"], "multi_label": true },
        { "task": "sentiment", "labels": ["positive", "negative", "neutral"] }
      ],
      "structures": {
        "press_event": {
          "fields": [
            { "name": "company", "dtype": "str" },
            { "name": "spokesperson", "dtype": "str" },
            { "name": "product_name", "dtype": "str" },
            { "name": "event_type", "dtype": "str", "choices": ["product_launch", "earnings_call", "keynote", "press_conference"] },
            { "name": "key_topics", "dtype": "list" }
          ]
        }
      }
    },
    "include_confidence": true,
    "include_spans": true
  }'
```

## Response Format

The response is a standard OpenAI-compatible chat completion. The extracted data is a JSON string inside `choices[0].message.content`.

```json
{
  "entities": {
    "person": [{ "text": "Tim Cook", "confidence": 0.9999, "start": 0, "end": 8 }],
    "organization": [{ "text": "Apple", "confidence": 0.9997, "start": 17, "end": 22 }],
    "location": [{ "text": "Cupertino", "confidence": 0.9950, "start": 90, "end": 99 }],
    "product": [{ "text": "Vision Pro headset", "confidence": 0.9955, "start": 37, "end": 55 }]
  },
  "relation_extraction": {
    "ceo_of": [{ "head": { "text": "Tim Cook" }, "tail": { "text": "Apple" } }],
    "located_in": [{ "head": { "text": "Apple Park" }, "tail": { "text": "Cupertino" } }],
    "unveiled": [{ "head": { "text": "Tim Cook" }, "tail": { "text": "Vision Pro headset" } }]
  },
  "topic": [
    { "label": "technology", "confidence": 0.9997 },
    { "label": "business", "confidence": 0.9647 }
  ],
  "sentiment": { "label": "positive", "confidence": 1.0 },
  "press_event": [{
    "company": { "text": "Apple", "confidence": 0.9991 },
    "spokesperson": { "text": "Tim Cook", "confidence": 0.9873 },
    "product_name": { "text": "Vision Pro headset", "confidence": 0.9907 },
    "event_type": { "text": "keynote", "confidence": 0.8900 },
    "key_topics": [{ "text": "spatial computing", "confidence": 0.9937 }]
  }]
}
```

## Notes

- Text limit: keep under 8KB per call for best latency
- The response wraps the standard OpenAI chat completions shape — parse `choices[0].message.content` as JSON to get extractions
- `schema` fields are all optional — use only what you need
