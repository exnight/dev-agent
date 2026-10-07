# /usage extension

Shows the cost Pi recorded for the current session, grouped by provider/model.

## Commands

- `/usage` - recorded cost by provider/model, split by category (input, output, cache read, cache write), and the session total.
- `/usage details` - the same, plus cost by source and cumulative token counts.
- `/usage rates` - derived USD per million tokens, per provider/model and category. Use it to compare with online price lists.

In headless mode (no UI) the report goes to stderr, so stdout stays clean for print and JSONL output.

## How it is calculated

- Scope: the whole session, including all branches and history before compaction. It reads raw session entries, not the active branch.
- Total = sum of the recorded `usage.cost.total` values. Past records are never repriced from the current model catalog.
- Category costs are Pi's recorded component costs. Cache costs are already part of the recorded cost. Nothing extra is subtracted.
- Tokens = input + output + cacheRead + cacheWrite. Reasoning and long-retention cache writes are already included in these.
- Records without a usable cost are excluded from the total, but their tokens still count. The report warns about them.
- Records with tokens but zero cost are flagged: pricing may be missing, free, or covered by a subscription.
- If component costs are missing or do not add up to the recorded total, the report warns. The recorded total stays authoritative.
- Tool and summary usage that has no provider/model is listed as "Unattributed tools / summaries".

## Rates

- Rate = recorded category cost / (tokens / 1,000,000), rounded to 12 significant digits.
- A rate is shown only when the record has tokens, a usable component cost, and a positive recorded total. Otherwise the tokens are listed as "unknown".
- Different rates in one category (tiered or historical pricing) are listed separately with the tokens at each rate. They are never averaged.

## Display

- Costs and token counts use 2 decimal places. Nonzero costs under $0.01 show as `<$0.01`.
- Rates use 2 to 4 decimal places, so values like $0.075 are not rounded away.
- Token counts show K from 1,000 and M from 1,000,000.

## Limits

These are Pi's recorded estimates. They are not a provider invoice, a billed charge, or a remaining allowance.
