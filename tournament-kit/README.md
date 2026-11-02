# Tournament Launch Kit

One event configuration → one copyable tournament package: event page, registration setup, playing rules, player guide, director operations, communications, finance/results sheets, QR assets, and pinned implementation sources.

This kit is local tooling. It does not create a live event or send anything. All copied events start closed with fresh dates, provider/roster bindings, director coverage and verification needed.

## Start a tournament

Requires Node 22+; no account credentials are needed to generate or verify a package.

```bash
npm ci --prefix tournament-kit
node tournament-kit/cli.mjs init --id my-new-tournament --out ../my-new-tournament
# Adult fixed-partner starting point:
node tournament-kit/cli.mjs init --preset adult --id adult-doubles-cup --out ../adult-doubles-cup
```

Edit the generated `tournament.json`, then:

```bash
node tournament-kit/cli.mjs validate ../my-new-tournament/tournament.json
node tournament-kit/cli.mjs build ../my-new-tournament/tournament.json --out ../my-new-tournament-pack
node tournament-kit/cli.mjs verify ../my-new-tournament-pack
node tournament-kit/cli.mjs pack ../my-new-tournament-pack --out ../my-new-tournament.zip
```

To copy an existing event, pass `--from path/to/tournament.json` to `init`. This preserves the chosen format and fee starting point, while resetting dates, venue, eligibility text, provider bindings, director/courts, payment ownership, event policies and verification. It refuses to overwrite an existing destination.

The two examples are drafts, not approvals: `mvf-november.json` records the installed MVF adapter and existing playing format; `adult-fixed.json` demonstrates a different audience, entry unit, fee and external provider. Its suggested rules and price need review.

## What is in the package?

| Folder | Contents | Who uses it |
| --- | --- | --- |
| `public/` | Responsive event page, Register Now destination, format/rules, policies, public JSON, player guide, registration QR PNG/SVG | Players and their agents |
| `private/` | Editable event config, readiness report, director runbook, run of show, blank roster/payment/results CSVs, communications drafts, integration instructions | Organizer and director |
| `kit/` | This generator, examples, tests and locked dependencies | Next tournament’s builder |
| `reference/` | Optional complete source snapshot set: NGA registration adapters, Community OS tournament engine, capacity/publication integration and migrations | Developer integrating a new native event |
| `package-manifest.json` | File inventory and SHA-256 hashes | Anyone checking a copied package |

**Host only `public/`.** Keep the other folders restricted. The reusable package contains no real registrants, participant photos, invoices, credentials or provider exports. The blank operating sheets become sensitive once filled in; keep working copies in the event’s restricted workspace, separate from the template.

## Registration options

| Option | Works now | Setup for another event |
| --- | --- | --- |
| External provider | Any configured junior/adult, individual/pair/team tournament can link to its actual registration and payment provider | Create/verify that provider’s event and form; paste its public registration URL; verify eligibility, capacity, payment owner and policies |
| Existing NGA series | The installed November 2026, January/February 2027 MVF guardian → waiver → invoice → private receipt flow | A different native event needs the reviewed integration procedure and fresh backend keys/capacity; the kit refuses to pretend the six-key allowlist is generic |

For external registration, the provider owns the actual form and payment. The kit generates a form specification and links to it rather than collecting a second, disconnected roster. For the installed NGA adapter, the generated native form posts the existing contract, including optional home address, stable retry IDs, waiver-required recovery and private receipt navigation. Native pages must remain on the installed NGA origin/path. No new payment engine has been invented.

## Include the implementation sources in one ZIP

Given authenticated local Git checkouts containing the commits pinned in `source-lock.json`:

```bash
node tournament-kit/cli.mjs collect-sources \
  --nextgen /absolute/path/to/nextgen-academy \
  --community /absolute/path/to/community-os \
  --out ../tournament-sources
node tournament-kit/cli.mjs build tournament-kit/examples/mvf-november.json \
  --references ../tournament-sources --out ../mvf-reference-pack
node tournament-kit/cli.mjs pack ../mvf-reference-pack --out ../tournament-launch-kit.zip
```

The collector uses `git show` at exact commits, includes local import dependencies, and fails on unresolved local imports. It does not read the working tree’s `.env` files. Engine sources and tests are included; package manifests declare external npm/workspace dependencies. These are integration snapshots, not a self-contained replacement for the full hosting/database platforms. Historical ready=true activation scripts are excluded. Refresh source pins deliberately and rerun verification when the adapters change.

## Opening a tournament

`registration.state` can be `draft`, `open` or `closed`. An open configuration requires dated evidence for all ten gates in `readiness`: event details, playing format, registration, payments, capacity, waiver, privacy, director operations, mobile QA and desktop QA. Those records are local attestations; the validator does not query a provider or grant approval. A passed build is not proof of payment or attendance.

Generated native forms and registration actions retire at the configured deadline in the browser; the provider must independently enforce the same deadline. The public JSON carries the configured state and action expiry, so agents must evaluate the admission window. Closing admission must preserve existing invoices, receipts and callbacks.

Use `private/launch-checklist.md` to launch, `private/director-runbook.md` to run the day, and `private/payment-reconciliation.csv` plus the correct provider to close out. The kit never publishes a site, opens registration, applies a migration, sends drafts or moves money by itself.

## Tests

```bash
npm test --prefix tournament-kit
```

The tests exercise copying, event isolation, public/private separation, malformed/unsafe configuration, date offsets and deadlines, native retry/receipt boundaries, packet integrity and ZIP export. They make no live provider calls.
