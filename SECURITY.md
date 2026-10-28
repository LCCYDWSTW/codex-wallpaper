# Security

This is a local runtime customization tool. Enabling it exposes Codex's Chromium debugging interface on loopback, which other local processes may access. Do not use on an untrusted or shared machine or against organizational policy.

Do not publish secrets, chat content or full profiles in issues. If you find a vulnerability, use the repository's private vulnerability reporting feature if enabled; otherwise contact its maintainer privately. The distributed template does not invent a maintainer email or promise a response SLA.

The installer is per-user. It changes only the documented shortcuts and, when requested, the Codex MSIX startup state. Review changes before installation. Startup-state registry layout and renderer selectors are compatibility assumptions, not official extension contracts.
