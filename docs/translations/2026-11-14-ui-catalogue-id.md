# Game UI catalogue: Indonesian lines (#104)

The game's shell shows five UI strings (`packages/ui/src/i18n/catalogue.ts`). Each Indonesian line was drafted by Claude (the writer) and read back into English by Google Cloud Translation (the independent reader) before it was committed, as the global rule requires. Run 2026-11-14 13:20 WIB with the shared key, on Google day 2026-11-13, counted in the shared ledger (`~/.config/shyden/google-translate-ledger.json`). Each line's review block, with the same evidence, is in `packages/ui/src/i18n/review.ts`.

Google's own English-to-Indonesian rendering was not run: the day's allowance had 67 characters left and the four lines need 132. The second sources are the KBBI (kbbi.kemendikdasmen.go.id, read 2026-11-14), en.wiktionary.org and the site's shipped Indonesian copy (`apps/site/src/copy.ts`), which Shyden approved.

| Key                    | English (source)           | Indonesian (writer: Claude)        | Google read-back id→en      |
| ---------------------- | -------------------------- | ---------------------------------- | --------------------------- |
| `game.name`            | Yawelo Idle                | Yawelo Idle                        | not sent (a name)           |
| `shell.comingSoon`     | Coming soon.               | Segera hadir.                      | Coming soon.                |
| `shell.next`           | {roadmap} or {launchList}. | {roadmap} atau {launchList}.       | {roadmap} or {launchList} . |
| `shell.followRoadmap`  | Follow the roadmap         | Ikuti peta jalan                   | Follow the road map         |
| `shell.joinLaunchList` | join the launch list       | bergabung dengan daftar peluncuran | join the launch list        |

## Sources

- **segera** (KBBI): "lekas; cepat (tentang peralihan waktu)". **hadir** (KBBI): "ada; (ada) datang".
- **atau** (KBBI): "kata penghubung untuk menandai pilihan di antara beberapa hal"; Wiktionary: "or".
- **ikut** (KBBI): "melakukan sesuatu sebagaimana dikerjakan orang lain"; Wiktionary: "to follow". **peta jalan** (KBBI): "peta panduan".
- **bergabung** (KBBI): "menjadi satu (dengan); berkumpul menjadi satu"; Wiktionary: "to join". **daftar** (KBBI): "catatan sejumlah nama atau hal"; Wiktionary: "list". **peluncuran** (KBBI): "proses, cara, perbuatan meluncurkan".
- Site copy already shipped: `comingSoon` "Segera hadir" (#621), `titles.roadmap` "Peta jalan", `privacy.soon` "... sebelum daftar peluncuran dibuka", `titles.home` "Yawelo Idle".

## Label audit (three words or fewer)

- **Yawelo Idle** (2 words): the game's name, never translated; the site's Indonesian title already uses it.
- **Segera hadir.** (2 words): read back exactly as "Coming soon."; the same words the holding page ships.
- **{roadmap} atau {launchList}.** (1 word of text): only "atau" is text; each slot is a link checked as its own key. Google's space before the full stop is its own; the text has none.
- **Ikuti peta jalan** (3 words): read back as "Follow the road map". It labels the link to the roadmap page, whose Indonesian title is "Peta jalan".

## Shyden's reading

Not yet read by Shyden. The lines ship to dev as `claude-checked` (spec D18); players can report mistakes in game.
