# Self-Critic Review

You are reviewing your own implementation work. You just implemented a sprint of features. Now switch to a critical reviewer mindset. Your job is to find real issues before the QA evaluator does.

## Review Checklist

Read `CLAUDE.md` to understand the project's expected patterns, then go through each item. For each, state PASS or FAIL with specific details.

### 1. Auth & Security
- [ ] Every new endpoint has the project's auth guard/dependency
- [ ] No hardcoded secrets or API keys
- [ ] No SQL injection vectors (should use ORM, not raw SQL)
- [ ] Form inputs are validated via schemas

### 2. Pattern Compliance
- [ ] New routes/modules registered in the app entry point
- [ ] Services follow the project's async/sync pattern
- [ ] API responses follow the project's standard format
- [ ] UI components follow the project's templating/component pattern
- [ ] New pages added to navigation if appropriate

### 3. Error Handling
- [ ] Endpoints return proper HTTP status codes (400 for bad input, 404 for not found)
- [ ] Database lookups handle "not found" cases
- [ ] Foreign key references check that target exists

### 4. Project-Specific Patterns
- [ ] Datetime handling follows the project's convention (timezone-aware if applicable)
- [ ] File structure follows the project's layout
- [ ] Naming conventions match existing code

### 5. Database
- [ ] Migration file created for new tables/columns (using the project's migration pattern)
- [ ] Primary key type matches existing models
- [ ] Cascade deletes configured where appropriate
- [ ] Unique constraints where needed

### 6. Frontend/UI
- [ ] Follows the project's design system (layout, colors, spacing)
- [ ] Responsive/mobile considerations if the project requires them
- [ ] Forms have proper labels and validation feedback

### 7. Integration
- [ ] New features don't break existing routes
- [ ] Import paths are correct (no circular imports)
- [ ] No missing dependencies

## Output Format

Return ONLY a JSON object:

```json
{
  "verdict": "pass | self_correcting | fail_needs_rethink",
  "issues": [
    {
      "severity": "high | medium | low",
      "category": "auth | pattern | error_handling | project_specific | database | frontend | integration",
      "file": "path/to/file.py",
      "line_range": "45-52",
      "description": "Clear description of the issue",
      "suggested_fix": "Specific fix instruction",
      "auto_fixable": true
    }
  ],
  "checks_passed": [
    "List of checks that passed"
  ]
}
```

**Verdict rules:**
- `"pass"`: No high-severity issues, at most 1-2 low-severity items
- `"self_correcting"`: Has fixable issues — you will be asked to fix them next
- `"fail_needs_rethink"`: Fundamental design problem that can't be patched (rare)

Be HONEST. Do not talk yourself into deciding issues aren't a big deal. If you find a real bug, report it. The evaluator will find it anyway.
