import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Ban the local-time Date constructor: `new Date(y, m, d)` builds in the
    // server's local time, so a date-only value renders off-by-one on Vercel's
    // UTC build servers (CLAUDE.md "Date Handling"). The selector targets a
    // 2+-arg Date NewExpression; the safe `new Date(Date.UTC(...))` is a
    // single-arg outer call and is not flagged.
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "NewExpression[callee.name='Date'][arguments.length>=2]",
          message:
            "Local-time Date constructor shifts off-by-one on UTC build servers. Use new Date(Date.UTC(y, m-1, d)) or format an ISO string with an explicit timeZone. See CLAUDE.md.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Nested build artifacts (e.g. Claude Code worktrees with their own .next):
    "**/.next/**",
    ".claude/**",
  ]),
]);

export default eslintConfig;
