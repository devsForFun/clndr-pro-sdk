# Changelog

All notable changes to `@clndr-pro/sdk` and `@clndr-pro/react`.

## 0.1.4

### Fixed

- **@clndr-pro/sdk**: bind fallback global fetch so the SDK works in standard
  browsers and runtimes (previously threw `Illegal invocation` on the first
  network call in any environment without a global fetch wrapper). Native
  browser/undici `fetch` is WebIDL-branded and requires `this` to be the
  global object; storing it on an instance property and invoking it as a
  method rebound `this` to the `Clndr` instance and tripped the WebIDL
  guard. Caller-supplied `opts.fetch` is left untouched.
- **@clndr-pro/react**: bumped the `@clndr-pro/sdk` dependency to `0.1.4`
  so consumers pick up the fix transitively.

## 0.1.3

Initial public release.
