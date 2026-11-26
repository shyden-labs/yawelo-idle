# Roadmap "Last updated" line: Indonesian (#1074)

The roadmap page's one line saying when the board it shows was last read (#1074). English from Shyden's ruling of 2026-11-23 (AskUserQuestion; recorded in the latest #1074 comments: "show when it was last updated using time (showing time zone for local time) and date", the line drafted as below, not objected to). Indonesian drafted by Claude; read back by Google Cloud Translation id→en (`scripts/google-read-back.ts id en`, 2026-11-23), and Google's own en→id rendering taken as the second, independent source (`scripts/google-read-back.ts en id`). Status: `claude-checked` (D18).

| Key               | English (approved)                 | Indonesian (shipped)                      | Google read-back (id→en)            | Google rendering (en→id)                        |
| ----------------- | ---------------------------------- | ----------------------------------------- | ----------------------------------- | ----------------------------------------------- |
| `map.lastUpdated` | Last updated {date}, {time} {zone} | Terakhir diperbarui {date}, {time} {zone} | Last updated {date} , {time} {zone} | Terakhir diperbarui pada {date} , {time} {zone} |

Google's rendering adds "pada" ("on"); the shipped line leaves it out, as the read-back shows the meaning is the same. The slots are filled in the browser: the date and time in the visitor's own time zone, formatted for the page's language (`id-ID`: "23 November 2026", "08.05", "WIB"), the zone by its short name.
