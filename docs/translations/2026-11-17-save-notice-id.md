# Save notice: Indonesian lines (#160)

The save notice (`packages/ui/src/SaveNotice.svelte`) shows four UI strings (`packages/ui/src/i18n/catalogue.ts`). Each Indonesian line was drafted by Claude (the writer) and read back into English by Google Cloud Translation (the independent reader) before it was committed. Run 2026-11-17 06:18 WIB with the shared key, on Google day 2026-11-16, counted in the shared ledger (`~/.config/shyden/google-translate-ledger.json`). Each line's review block, with the same evidence, is in `packages/ui/src/i18n/review.ts`.

| Key                 | English (source)                                                     | Indonesian (writer: Claude)                                                         | Google read-back id→en                                                    |
| ------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `save.restored`     | Your latest save was damaged, so the backup saved {when} was loaded. | Data simpanan terakhir Anda rusak, jadi cadangan yang disimpan {when} telah dimuat. | Your last save data was corrupted, so the saved backup {when} was loaded. |
| `save.allDamaged`   | Your save and all its backups are damaged.                           | Data simpanan Anda dan semua cadangannya rusak.                                     | Your saved data and all backups are damaged.                              |
| `save.startNew`     | Start a new game                                                     | Mulai permainan baru                                                                | Start a new game                                                          |
| `save.keepAndClose` | Keep the damaged save and close                                      | Pertahankan data simpanan yang rusak dan tutup                                      | Retain corrupted save data and close it                                   |

`{when}` is filled by `Intl.RelativeTimeFormat` in the player's language ("5 minutes ago", "5 menit yang lalu"; `packages/ui/src/saved-ago.ts`).

## Sources

- **simpanan** (KBBI): "barang yang disimpan". **rusak** (KBBI): "sudah tidak sempurna (baik, utuh) lagi"; Wiktionary: "broken, damaged". **cadangan** (KBBI): "barang yang disediakan untuk keperluan kelak"; Wiktionary: "reserve, backup". **dimuat**: passive of memuat (KBBI: "mengisikan").
- **mulai** (KBBI): "awal; permulaan". **permainan** (KBBI): "sesuatu yang digunakan untuk bermain"; Wiktionary: "game".
- **pertahankan**: imperative of mempertahankan (KBBI: "menjaga ... supaya tetap"). **tutup** (KBBI): "menutup"; Wiktionary: "to close".

## Label audit (three words or fewer)

- **Mulai permainan baru** (3 words): a button label, read back exactly as "Start a new game".

## Shyden's reading

Shyden approved the Indonesian as written, 2026-11-17. The lines ship to dev as `claude-checked` (spec D18); players can report mistakes in game.
