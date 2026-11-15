## Summary

<!-- What does this PR change and why? -->

## Related issue

<!-- e.g. Closes #123 -->

## Checklist

- [ ] `node --test` passes locally.
- [ ] Locked identifiers are untouched (`model-aware-auto`, `auto`, `Auto`,
      `model-aware-auto/v1`, cordis/client id, failure codes, handoff protocol).
- [ ] No extra model calls introduced; fallback stays before visible output.
- [ ] If labels changed, `core/receipt.mjs` and `client.js` stay identical.
- [ ] Docs / CHANGELOG updated where behavior changed.

## Notes for reviewers

<!-- Anything that deserves extra attention. -->