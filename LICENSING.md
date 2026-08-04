<!--
SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
SPDX-License-Identifier: AGPL-3.0-only
-->

# Licensing

`openfastchat-core` is licensed **AGPL-3.0-only** (see `LICENSES/`). That applies
to everyone: if you run a modified version as a network service, the AGPL
requires you to offer your users the corresponding source.

## Open core, proprietary host

OpenFastChat follows an open-core model. Two wrappers build on this core:

- **[`openfastchat`](https://github.com/openfastchat/openfastchat)** — the AGPL
  self-host / bring-your-own-key app.
- **`openfastchat-hosted`** — a proprietary managed SaaS (billing + abuse layer).

Running a *proprietary* wrapper over AGPL core is permitted here **not because of
any exception clause, but because the copyright holder owns the core.** The AGPL
is a grant from the copyright holder to everyone else; the holder is not a
licensee of their own work and so is free to combine it with closed-source code.
There is deliberately **no** GPLv3 §7 additional permission — that would extend
the proprietary-combination right to all recipients, which is not the intent.

For anyone who is **not** the copyright holder, the AGPL applies in full: a
third-party hosted fork must itself be AGPL.

## Contributions

So that the project can keep offering both an AGPL build and a proprietary
hosted build, contributions are accepted under a Contributor License Agreement
(CLA) that grants the maintainer the right to license the contribution under
both AGPL-3.0 and proprietary terms. Without this, a third-party contribution
could not be used in the hosted wrapper. Sign-off (DCO) alone is not sufficient
for that dual use; the CLA is required before a contribution is merged.
