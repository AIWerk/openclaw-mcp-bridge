# TODO

## Future
- [ ] `accept-submission.sh <issue#>` — parse issue, create servers/<name>/, commit, close issue
- [ ] Fix test runner — tests use node:test + tsx, try `node --import tsx --test tests/*.test.ts`
- [ ] Transport tests (SSE, Stdio, Streamable HTTP) — connect/disconnect lifecycle, reconnection
- [ ] Router edge case tests — connection drop during call, timeout, concurrent requests
