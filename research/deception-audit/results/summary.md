# Fake Wretched and fake patrol audit: results

Seeds 490001–490100 (100 games per row, paired by seed). Written by `summary.js` from `audit.js`'s files.

## What happened in the preparation phase

| Jack | Police | Variant | Jack wins | Nights | Women on every legal red circle | Nights Jack waited | Waits per night | Tokens revealed (fake) | Fakes = the free stations (nights 2–4) | Different night-1 fake pairs | Wait nights where the Wretched moves identify every fake | Designations Jack can't rule out on wait nights: after reveals → after moves (of 21) |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| baseline | original | normal | 23 | 271 | 62% | 128 | 0.88 | 238 (67) | 171/171 | 1 | 47/128 | 8.9 → 3.6 |
| baseline | v2 | normal | 10 | 259 | 64% | 121 | 0.88 | 227 (63) | 159/159 | 1 | 44/121 | 9.0 → 3.8 |
| baseline | v3 | normal | 15 | 265 | 65% | 122 | 0.91 | 240 (69) | 163/165 | 1 | 44/122 | 8.5 → 3.7 |
| baseline | v3 | police-oracle | 15 | 265 | 65% | 122 | 0.91 | 240 (69) | 163/165 | 1 | 44/122 | 8.5 → 3.7 |
| baseline | v3 | police-random | 12 | 257 | 66% | 123 | 0.90 | 232 (66) | 9/157 | 21 | 30/123 | 8.7 → 4.2 |
| jack-v2 | original | normal | 93 | 388 | 100% | 0 | 0.00 | 0 (0) | 288/288 | 1 | – | – → – |
| jack-v2 | v2 | jack-infer | 63 | 364 | 100% | 0 | 0.00 | 0 (0) | 264/264 | 1 | – | – → – |
| jack-v2 | v2 | jack-oracle | 63 | 364 | 100% | 0 | 0.00 | 0 (0) | 264/264 | 1 | – | – → – |
| jack-v2 | v2 | normal | 63 | 364 | 100% | 0 | 0.00 | 0 (0) | 264/264 | 1 | – | – → – |
| jack-v2 | v3 | jack-infer | 66 | 364 | 100% | 0 | 0.00 | 0 (0) | 255/264 | 1 | – | – → – |
| jack-v2 | v3 | jack-oracle | 66 | 364 | 100% | 0 | 0.00 | 0 (0) | 255/264 | 1 | – | – → – |
| jack-v2 | v3 | normal | 66 | 364 | 100% | 0 | 0.00 | 0 (0) | 255/264 | 1 | – | – → – |
| jack-v2 | v3 | police-oracle | 66 | 364 | 100% | 0 | 0.00 | 0 (0) | 255/264 | 1 | – | – → – |
| jack-v2 | v3 | police-random | 60 | 377 | 100% | 0 | 0.00 | 0 (0) | 19/277 | 21 | – | – → – |
| strategic | original | normal | 98 | 399 | 100% | 0 | 0.00 | 0 (0) | 299/299 | 1 | – | – → – |
| strategic | v2 | jack-infer | 21 | 344 | 100% | 0 | 0.00 | 0 (0) | 244/244 | 1 | – | – → – |
| strategic | v2 | jack-oracle | 21 | 344 | 100% | 0 | 0.00 | 0 (0) | 244/244 | 1 | – | – → – |
| strategic | v2 | normal | 21 | 344 | 100% | 0 | 0.00 | 0 (0) | 244/244 | 1 | – | – → – |
| strategic | v3 | jack-infer | 24 | 350 | 100% | 0 | 0.00 | 0 (0) | 240/250 | 1 | – | – → – |
| strategic | v3 | jack-oracle | 24 | 350 | 100% | 0 | 0.00 | 0 (0) | 240/250 | 1 | – | – → – |
| strategic | v3 | normal | 24 | 350 | 100% | 0 | 0.00 | 0 (0) | 240/250 | 1 | – | – → – |
| strategic | v3 | police-oracle | 24 | 350 | 100% | 0 | 0.00 | 0 (0) | 241/250 | 1 | – | – → – |
| strategic | v3 | police-random | 29 | 353 | 100% | 0 | 0.00 | 0 (0) | 16/253 | 21 | – | – → – |

## Paired comparisons with the unchanged AIs

| Jack | Police | Variant | Nights with a different choice of fakes | Police win only with the variant | Only without | Exact McNemar p |
|---|---|---|---:|---:|---:|---:|
| baseline | v3 | police-oracle | 0/265 | 0 | 0 | 1.00 |
| baseline | v3 | police-random | 205/211 | 12 | 9 | 0.66 |
| jack-v2 | v2 | jack-infer | 0/364 | 0 | 0 | 1.00 |
| jack-v2 | v2 | jack-oracle | 0/364 | 0 | 0 | 1.00 |
| jack-v2 | v3 | jack-infer | 0/364 | 0 | 0 | 1.00 |
| jack-v2 | v3 | jack-oracle | 0/364 | 0 | 0 | 1.00 |
| jack-v2 | v3 | police-oracle | 0/364 | 0 | 0 | 1.00 |
| jack-v2 | v3 | police-random | 339/346 | 24 | 18 | 0.44 |
| strategic | v2 | jack-infer | 0/344 | 0 | 0 | 1.00 |
| strategic | v2 | jack-oracle | 0/344 | 0 | 0 | 1.00 |
| strategic | v3 | jack-infer | 0/350 | 0 | 0 | 1.00 |
| strategic | v3 | jack-oracle | 0/350 | 0 | 0 | 1.00 |
| strategic | v3 | police-oracle | 1/350 | 0 | 0 | 1.00 |
| strategic | v3 | police-random | 310/320 | 15 | 20 | 0.50 |
