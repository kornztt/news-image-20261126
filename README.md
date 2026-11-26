[![make.fun](https://make.fun/badge/news-image-20261126.svg)](https://make.fun/bounty/news-image-20261126)
[![rank](https://make.fun/badge/news-image-20261126/kornztt/news-image-20261126/rank.svg)](https://make.fun/bounty/news-image-20261126)
[![reward](https://make.fun/badge/news-image-20261126/kornztt/news-image-20261126/reward.svg)](https://make.fun/bounty/news-image-20261126)

# news-image-20261126 — THE WORLD TODAY

A 1024x1024 newspaper front page summing up the world's news of
Thursday 26 November 2026, drawn entirely in code.

Headline: the 100th Macy's Thanksgiving Day Parade is moved to Saturday —
the first weather postponement in its 100-year history — as a nor'easter
brings 60 mph gusts and flooding to New York. Also inside: the US tariff
salvo on 14 trading partners, the Cairo Ring Road tanker fire (at least
31 killed), and the Gulf war spreading to Ras Tanura and the Strait of
Hormuz.

`main.ts` is a Node 22 standard-library-only program. It hand-draws the
whole page (its own PNG encoder, canvas and 5x7 bitmap font) and writes
`entry.png` to `$MAKEFUN_OUTPUT_DIR`. Run it with:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Two runs produce byte-identical output.
