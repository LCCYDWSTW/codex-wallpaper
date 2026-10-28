# Contributing

Use Node.js 22+ and Windows PowerShell 5.1 for Windows integration work. There are no runtime package dependencies.

Run `npm test` and `npm run check`. Add regression cases for startup or filesystem-boundary changes. Never test process termination or profile mutation against a contributor's live Codex session.

Keep local media, logs, installed configs, profiles and account information out of commits. Use synthetic fixtures in tests. Update README.md, README.en.md and CHANGELOG.md when behavior changes. State whether validation was unit-level, a separate application profile, or a real sign-in/reboot.

To release, match package.json to the tag, run `npm run package`, review the ZIP entries, and push the release tag. CI uploads an allowlisted source archive rather than installed application state.
