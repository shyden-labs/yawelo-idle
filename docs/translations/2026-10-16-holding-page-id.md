# Holding page: Indonesian lines (#621)

The production holding page shows five lines in Indonesian. Each was drafted by Claude (the writer) and read back into English by Google Cloud Translation (the independent reader), as the global rule requires, before Shyden saw it. Google's own English-to-Indonesian translation is shown beside it as a second, independent rendering. Run 2026-10-16 with the shared key, on Google day 2026-10-16, counted in the shared ledger.

| Key             | English (approved)                         | Indonesian (writer: Claude)                       | Google read-back id→en                         | Google's own en→id                      |
| --------------- | ------------------------------------------ | ------------------------------------------------- | ---------------------------------------------- | --------------------------------------- |
| `comingSoon`    | Coming soon                                | Segera hadir                                      | Coming soon                                    | Segera hadir                            |
| `tagline`       | An idle adventure through a real language. | Petualangan idle menjelajahi bahasa sungguhan.    | An idle adventure exploring real languages.    | Petualangan santai melalui bahasa asli. |
| `tagline`       | An idle adventure through a real language. | Petualangan santai menjelajahi bahasa yang nyata. | A relaxing adventure exploring real languages. | Petualangan santai melalui bahasa asli. |
| `notFoundTitle` | Page not found                             | Halaman tidak ditemukan                           | Page not found                                 | Halaman tidak ditemukan                 |
| `notFoundBody`  | There is no page at this address.          | Tidak ada halaman di alamat ini.                  | There are no pages at this address.            | Tidak ada halaman di alamat ini.        |
| `homeLink`      | Back to the home page                      | Kembali ke beranda                                | Back to homepage                               | Kembali ke halaman utama                |

Google day 2026-10-16; ledger /Users/shyden/.config/shyden/google-translate-ledger.json.

## Approval

Shyden approved, by AskUserQuestion on 2026-10-16:

- Tagline: _"Petualangan idle menjelajahi bahasa sungguhan. (Recommended)"_. It keeps "idle" as the genre word Indonesian players use. Google's own "bahasa asli" was not used, because it usually means "native language".
- The other four lines: _"Approve all four (Recommended)"_.

## Label audit (three words or fewer)

- **Segera hadir** (2 words): read back exactly as "Coming soon", and identical to Google's own translation.
- **Halaman tidak ditemukan** (3 words): read back exactly as "Page not found", and identical to Google's own translation.
- **Kembali ke beranda** (3 words): read back as "Back to homepage". Google's own was "Kembali ke halaman utama" (also correct). "Beranda" is the usual Indonesian web word for a home page.

The English lines are the operator-approved copy from #334 (`apps/site/src/copy-en.ts`). The full site's Indonesian, with its D18 evidence, stays with #338.
