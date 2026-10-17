# Idle / Incremental Game Research for a Language-and-Culture Idle Game

Compiled 2026-10-01. Every claim carries a source URL. Claims marked **[UNSOURCED]** are my own inference or background knowledge that I could not back with a fetched source; claims marked **[WEAK]** come from low-quality aggregator pages and should be re-verified before any business decision.

Method note: research used web search plus page fetches. Several primary pages (Kongregate blog Part III, some Steam pages) were unreachable, so some numbers come from aggregators (steamcharts, steambase, revenue calculators). Revenue "estimators" are notoriously unreliable (one returned an absurd figure for Melvor, see section 1).

---

## 1. Genre taxonomy and exemplars

### 1.1 Taxonomy (how the genre is classified)

- **Clicker vs idle.** Games stressing active clicking are "clicker games"; games centred on minimal interaction are "idle games"; many combine both. Source: https://en.wikipedia.org/wiki/Incremental_game
- **Open-ended vs closed-ending.** Cookie Clicker is open-ended; Candy Box! and Universal Paperclips have victory conditions. Same source.
- **Academic taxonomy.** "Playing to Wait: A Taxonomy of Idle Games" (CHI 2018, Alharthi, Alsaedi, Toups Dugas, Tanenbaum, Hammer) analysed 66 idle games against 10 non-idle games with grounded theory; found idle games move players "from playing to planning" and use player attention and computer cycles as resources. Source: https://par.nsf.gov/biblio/10061230-playing-wait-taxonomy-idle-games and https://dl.acm.org/doi/10.1145/3173574.3174195
- **Origins.** Progress Quest (2002, Eric Fredriksen) is usually called the first idle game, a parody of MMO stat progression; Cow Clicker (satire of social games); Cookie Clicker (2013) popularised the genre; Clicker Heroes (2014/15) popularised prestige on mobile; AdVenture Capitalist pioneered offline earnings and monetisation. Source: https://en.wikipedia.org/wiki/Incremental_game
- Practical sub-genres I use below: (a) number-go-up "pure incrementals" with deep prestige layers; (b) narrative/unfolding incrementals; (c) idle RPG / skill-based (Melvor, IdleOn); (d) F2P mobile idle (Egg Inc, AdVenture Capitalist); (e) strategy/automation incrementals (Trimps, Kittens Game, Evolve); (f) educational/themed incrementals (Cell to Singularity, Noun Town idle mode).

### 1.2 Exemplar table (20 games)

| #   | Game                                                                           | Sub-genre                                             | Core loop                                                                                  | Prestige / reset                                                                                   | Reveal of mechanics                                                                  | Platforms / monetisation                                                                                                                     | Success evidence                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Cookie Clicker** (2013, Orteil)                                              | Open-ended clicker                                    | Click cookie, buy buildings/upgrades                                                       | Ascension: heavenly chips and upgrade tree; lifetime-earnings based                                | New buildings/upgrades appear as cookies accumulate; later minigames in buildings    | Browser, then Steam 2021 (premium), mobile; Steam is a one-off purchase                                                                      | Steam: 2.8M units, ~$10.2M premium revenue per one tracker [WEAK]; ~8,950 concurrent, 285 h avg playtime. https://app.sensortower.com/vgi/game/cookie-clicker ; https://en.wikipedia.org/wiki/Cookie_Clicker (Steam release 1 Sep 2021). Creator calls such works "non-games". https://en.wikipedia.org/wiki/Incremental_game                                                                                                                                |
| 2   | **AdVenture Capitalist** (2014, Hyper Hippo)                                   | F2P mobile idle                                       | Buy businesses, hire managers to automate, earn offline                                    | "Angel investors" bonus on reset                                                                   | Businesses unlock in sequence; managers automate each                                | Browser, Android 2014; iOS/PC 2015; PS4 2016; F2P with IAP and ads                                                                           | Offline earnings made it the template. https://en.wikipedia.org/wiki/AdVenture_Capitalist . Players also complain when offline earnings break (Steam threads): https://steamcommunity.com/app/346900/discussions/0/618458030649166426                                                                                                                                                                                                                        |
| 3   | **Antimatter Dimensions** (2016, Hevipelle, now team)                          | Deep-prestige unfolding incremental                   | Buy 8 "dimensions" each producing the one below (Pecorella's "generators make generators") | Dimension Boost, Galaxy, Infinity, Eternity, Reality (and beyond): each opens whole new subsystems | "Highly unfolding": layers of unlocks, prestige and achievements                     | Browser (Kongregate) then Steam 17 Dec 2022, free, cloud save automatic, 100 Steam achievements                                              | Steam 92/100 from 4,297 reviews (3,969 positive); all-time peak 1,849 CCU (Feb 2025). https://store.steampowered.com/app/1399720/Antimatter_Dimensions/ ; https://steamcharts.com/app/1399720 ; https://antimatter-dimensions.fandom.com/wiki (via https://www.kongregate.com/en/games/hevipelle/antimatter-dimensions)                                                                                                                                      |
| 4   | **Universal Paperclips** (2017, Frank Lantz)                                   | Closed narrative incremental                          | Make paperclips; phases: manual, autoclippers/market, research/operations, trust, cosmic   | Effectively none; a definitive ending (plus a second-loop "new universe" option)                   | Each phase recontextualises earlier mechanics; meaning told through numbers          | Browser, free; later mobile/Steam ports (not verified here)                                                                                  | 450,000 players in first 11 days per Wired (via https://en.wikipedia.org/wiki/Universal_Paperclips); "2 million players" per https://if50.substack.com/p/2017-universal-paperclips . Lantz: clicker games give "a concrete, visceral sense of ... exponential growth and massive differences in scale" https://www.pcgamesinsider.biz/interviews-and-opinion/66271/interview-paperclips-developer-frank-lantz/                                               |
| 5   | **A Dark Room** (2013, Michael Townsend / Doublespeak; mobile port Amir Rajan) | Text "unfolding" adventure                            | Light a fire, gather wood, world unfolds from a single button                              | Minimal                                                                                            | Canonical unfolding: start from one button, each new system revealed by the previous | Browser free; iOS port reached #1 on App Store about 6 months after release                                                                  | https://en.wikipedia.org/wiki/A_Dark_Room ; https://press.doublespeakgames.com/adr/index.html                                                                                                                                                                                                                                                                                                                                                                |
| 6   | **Candy Box! / Candy Box 2** (2013, aniwey)                                    | ASCII incremental RPG                                 | Candies accrue 1/s; buy and unlock lollipop farms, quests, map                             | Minimal (closed)                                                                                   | Features gradually unfold from a candy counter into an RPG                           | Browser, free                                                                                                                                | Created by a 19-year-old French student, released April 2013; Candy Box 2 Oct 2013. https://en.wikipedia.org/wiki/Candy_Box! ; https://www.killscreen.com/candy-box-2-and-beauty-smart-stupid-game/                                                                                                                                                                                                                                                          |
| 7   | **Kittens Game** (bloodrizer / Nuclear Unicorn)                                | Civilisation-management incremental                   | Gather catnip, build a kitten village, research techs                                      | Two prestige systems (religion/metaphysics, time), challenges, space                               | 30+ buildings, 50+ resources, ~200 techs revealed as unlocked                        | Browser free for years; Steam Early Access 10 Feb 2026 with cloud save and achievements                                                      | https://store.steampowered.com/app/1097410/Kittens_Game/ ; https://kittensgame.com/web/ . I could not confirm whether the Steam build uses NW.js or Electron **[UNSOURCED]**.                                                                                                                                                                                                                                                                                |
| 8   | **Melvor Idle** (2019 EA, 1.0 Nov 2021, Games by Malcs / Jagex)                | Idle RPG (RuneScape-like)                             | Train skills, combat in real time while idle                                               | Expansions, ironman-style modes; not a classic reset loop                                          | Skills and mastery systems open as you level                                         | Steam $9.99/£7.19; mobile free-to-try, IAP to unlock full version; cross-platform cloud save via a free Melvor account, auto-push every 12 h | "More than a million players across Steam, App Store and Google Play" at 1.0 launch; Steam ~93% positive. https://www.jagex.com/news/melvor-idle-version-1-0-launches-on-pc-and-mobile ; https://wiki.melvoridle.com/w/FAQ . Note: a revenue calculator returned "$848,925,000" for the expansion, which is obviously wrong; ignore revenue "estimators". https://impress.games/steam-revenue-calculator/2055140/melvor-idle-throne-of-the-herald **[WEAK]** |
| 9   | **NGU Idle** (2019, 4G)                                                        | Deep active/idle hybrid                               | Allocate energy/magic to many systems, rebirth                                             | Multiple rebirth layers                                                                            | Many systems appear across tiers                                                     | Steam, free                                                                                                                                  | 95% positive from 10,907 reviews. https://store.steampowered.com/app/1147690/NGU_IDLE/ (revenue not found)                                                                                                                                                                                                                                                                                                                                                   |
| 10  | **Realm Grinder** (Divine Games / Kongregate)                                  | Faction-based idle                                    | Choose a faction, grow a kingdom                                                           | Two prestige layers: Abdication and Reincarnation; earnings-based on max currency                  | Factions and reincarnation reinterpret earlier mechanics                             | Browser, Steam, mobile; ads (incentivised, none forced) and gem IAP $4.99-$49.99                                                             | https://incrementalatlas.com/mechanics/idle-games-with-prestige/ ; https://www.kongregate.com/en/games/divinegames/realm-grinder ; https://store.steampowered.com/app/610080/Realm_Grinder/                                                                                                                                                                                                                                                                  |
| 11  | **Clicker Heroes** (2014, Playsaurus)                                          | Clicker/idle RPG                                      | Click monsters, hire heroes, ascend                                                        | Ascension/transcension pioneered mobile prestige                                                   | Zones and heroes unlock progressively                                                | Browser, mobile 2015, consoles 2017; F2P                                                                                                     | ~7.3M estimated players **[WEAK]** https://playtracker.net/insight/game/1117 ; Clicker Heroes 2 ~ $850k net Steam per a tracker **[WEAK]** https://games-stats.com/steam/?publisher=playsaurus                                                                                                                                                                                                                                                               |
| 12  | **Trimps** (Trimps/Steam)                                                      | Strategy idle                                         | Command creatures through zones and maps, equipment, automation                            | Portal resets with perks                                                                           | Automates old stuff as you unlock new                                                | Browser since 2015; Steam; "never balanced around expecting anyone to buy Bones", pay-what-you-want support                                  | https://store.steampowered.com/app/1877960/Trimps/ ; https://www.gamedeveloper.com/design/incremental-game-review-trimps                                                                                                                                                                                                                                                                                                                                     |
| 13  | **Evolve** (Demagorddon)                                                       | Civilisation incremental                              | Ooze to sapient species to space                                                           | Prestige layers (resets)                                                                           | Tech-tree reveal                                                                     | Browser, free, donations (Patreon)                                                                                                           | https://www.patreon.com/demagorddon ; https://www.incrementaldb.com/game/evolve                                                                                                                                                                                                                                                                                                                                                                              |
| 14  | **Egg, Inc.** (2016, Auxbrain)                                                 | F2P mobile idle with co-op                            | Grow chicken farms, unlock eggs, hab/silo upgrades                                         | Prestige = earnings since last reset (per Pecorella Part III)                                      | Progress via egg tiers                                                               | Mobile; rewarded video, "Pro Permit" (one-off, removes ads/adds bonuses), "Piggy Bank" where players name their own price, goodwill design   | "New gold standard for idle game monetization" (PocketGamer.biz). https://www.pocketgamer.biz/egg-inc-idle-games-gold-standard/ ; estimated ~$200k/month (old figure) https://en.wikipedia.org/wiki/Egg,_Inc. **[WEAK]**                                                                                                                                                                                                                                     |
| 15  | **Legends of Idleon** (2021+, LavaFlame2, solo dev)                            | Idle MMO                                              | Many characters, idle skilling across a class web, offline progress                        | Account-wide meta-progress                                                                         | Huge class/skill web                                                                 | Steam F2P + gem shop (cosmetics, companions, convenience)                                                                                    | Reported ~$1M/month gross at peak and ~$100k/day in early 2024 **[WEAK]** https://www.leetdom.com/reviews/legends-of-idleon ; Steam 76% positive of 21,202 reviews; "drifted from convenience toward outcomes that matter". https://store.steampowered.com/app/1476970/Legends_of_IdleOn__Idle_MMO/                                                                                                                                                          |
| 16  | **Idle Slayer** (Culzey)                                                       | Hybrid runner + idle                                  | Auto-running slayer, jump to collect                                                       | Ascension                                                                                          | Stages unlock                                                                        | Steam + mobile                                                                                                                               | "Mostly Positive" 78% of 4,315 reviews. https://store.steampowered.com/app/1353300/Idle_Slayer/ . Save-loss threads: https://steamcommunity.com/app/1353300/discussions/0/5487063042661950995/                                                                                                                                                                                                                                                               |
| 17  | **Revolution Idle**                                                            | Modern deep incremental                               | Mathematical generators with many layers                                                   | Multiple layers                                                                                    | Steady drip of new systems                                                           | Steam, F2P                                                                                                                                   | "Very Positive" 86% of 7,458 reviews. https://store.steampowered.com/app/2763740/Revolution_Idle/                                                                                                                                                                                                                                                                                                                                                            |
| 18  | **Increlution**                                                                | Roguelite-flavoured incremental about time management | Queue actions in limited time; meta-progression                                            | Roguelite-style loops                                                                              | New actions unlock by prior                                                          | Steam                                                                                                                                        | 85% positive of 1,238 reviews. https://store.steampowered.com/app/1593350/Increlution/                                                                                                                                                                                                                                                                                                                                                                       |
| 19  | **Unnamed Space Idle** (Sylv)                                                  | Space automation idle                                 | Mine, build, fleets                                                                        | Prestige                                                                                           | "Something new frequently appearing"                                                 | Steam F2P Early Access                                                                                                                       | 92% positive of 2,983 reviews. https://store.steampowered.com/app/2471100/Unnamed_Space_Idle/                                                                                                                                                                                                                                                                                                                                                                |
| 20  | **Idle Champions of the Forgotten Realms** (Codename Entertainment)            | Licensed F2P idle                                     | Formation-based party auto-battler                                                         | Resets via adventures/events                                                                       | Champions unlocked by gacha/purchase                                                 | Steam, mobile                                                                                                                                | Heavily criticised for monetisation (64 DLC packs totalling GBP 597; chests; battle passes). https://store.steampowered.com/app/627690/Idle_Champions_of_the_Forgotten_Realms/ ; https://steamcommunity.com/app/627690/negativereviews/?p=1&browsefilter=toprated                                                                                                                                                                                            |

### 1.3 Educational exemplars (see also section 4)

- **Cell to Singularity** (Computer Lunch, NYC): iOS Aug 2019, Android Apr 2020, Steam 3 Nov 2021, web June 2024; freemium with ads and "Darwinium" premium currency; teaches evolution and natural history through two parallel systems (biological + technological). https://en.wikipedia.org/wiki/Cell_to_Singularity
- **Bitburner** (teaches JavaScript), **Screeps** (programming), and **Noun Town: Learn & Chill** (idle vocabulary). https://noun.town/blog/best-idle-games-on-steam-that-actually-teach-you-something/
- **Language Invention Idle Game** (kalamayin, itch.io): generate letters, fuse into syllables, words, grammar. https://kalamayin.itch.io/language-idle

---

## 2. Design lessons

### 2.1 The core maths ("seesaw")

Pecorella (Kongregate; MIGS 2016 talk, then the 3-part blog): https://www.kongregate.com/en/pages/the-math-of-idle-games-part-i ; https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i ; https://www.gamedeveloper.com/game-platforms/the-math-of-idle-games-part-ii ; https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii ; GDC Europe slides https://media.gdcvault.com/gdceurope2016/presentations/Pecorella_Anthony_Quest%20for%20Progress.pdf

- Cost of the next generator: `cost_next = cost_base * rate_growth^owned`. Production: `production = production_base * owned * multipliers`. Exponential cost vs polynomial/linear production is the seesaw that creates pacing.
- Bulk purchase: `cost = b * r^k * (r^n - 1)/(r - 1)`.
- Variable multiplier thresholds (25, 50, 100 owned) keep older generators relevant.
- Prestige resets generators for persistent multipliers so the player "slides up" the cost curve again.
- Part II: cascading "generators make generators" gives `1, x, x^2/2, x^3/6 ... x^n/n!`, converging on e^x; used by Derivative Clicker, Shark Game (and Antimatter Dimensions' dimension chain).
- Part III (prestige): prestige currency can be based on max earnings (Realm Grinder), lifetime earnings (Cookie Clicker, AdVenture Capitalist) or earnings since last reset (Egg Inc). With square-root formulas, doubling prestige currency requires 4x earnings. Source: search summary of Part III, https://www.kongregate.com/en/pages/the-math-of-idle-games-part-iii (Kongregate blog mirror was 404 to my fetch).
- Independent corroboration (Eric Guan, idle design principles): production upgrades about x1.1, costs about x1.15 per purchase; justified by Weber's law (just-noticeable difference is proportional); multiple "clocks" with exponentially longer cycles (20 minutes, 5 hours, 2 days) support declining engagement. https://ericguan.substack.com/p/idle-game-design-principles

### 2.2 Layered prestige

- Antimatter Dimensions: Infinity, Eternity, Reality etc., each opening entire new mechanics (https://incrementalatlas.com/mechanics/idle-games-with-prestige/). Realm Grinder: Abdication and Reincarnation. Kittens Game: two prestige systems plus challenges (https://store.steampowered.com/app/1097410/Kittens_Game/).
- Runs lengthen over time: "your first prestige may take an evening, later ones a day or a week" (https://onirealms.com/guides/idle-games-explained/ **[WEAK]**).
- Key rule from Part III: the optimal reset is when you can reach at least your last reset point; design so resetting twice as early is worse, not better. Pecorella's worksheets: https://archive.org/details/idlegameworksheets

### 2.3 Unfolding / progressive reveal

- A Dark Room ("an entire world unfolds slowly from a single button") https://en.wikipedia.org/wiki/A_Dark_Room ; Candy Box ("features gradually unfold as players interact") https://candybox2.github.io/candybox/ ; Universal Paperclips: each era "introduces new systems that recontextualize previous mechanics" https://if50.substack.com/p/2017-universal-paperclips ; Antimatter Dimensions described as "a highly unfolding" game https://www.kongregate.com/en/games/hevipelle/antimatter-dimensions
- Reviewers of Unnamed Space Idle praise "something new frequently appearing" as the retention driver. https://store.steampowered.com/app/2471100/Unnamed_Space_Idle/

### 2.4 Offline progress

- Standard approach: store a last-seen timestamp, on return multiply elapsed time by current income rate, usually capped (often 2 to 24 h) and presented in a "welcome back" modal, sometimes with a rewarded-video multiplier. https://www.geekextreme.com/idle-games-offline-progression-math/ ; https://game-ace.com/blog/idle-game-development/ (marketing blogs, **[WEAK]**)
- Anti-cheat caveat: device-clock manipulation is trivial without a server-authoritative time. Same sources.
- Offline earnings themselves break and anger players (AdVenture Capitalist Steam threads above).
- Melvor Idle compares offline modes across games. https://tideward.app/offline-progression/ **[WEAK]**

### 2.5 Number scaling

- Plain JS doubles max out near 1.8e308. `break_infinity.js` (IvarK/Patashu) handles up to ~1e(9e15) and is 50x (add/mul) to 600x (log) faster than decimal.js; `break_eternity.js` goes to 10^^1e308 and is called "the de-facto standard" for incrementals, with ports for C#, Rust and Godot. https://github.com/Patashu/break_infinity.js/ ; https://github.com/Patashu/break_eternity.js/
- Paperclips shipped as plain JS with no frameworks and scaled to septendecillion-level numbers. https://if50.substack.com/p/2017-universal-paperclips
- For a language game the natural numbers (words known, XP) rarely need big-number types in the first layers; decide at design time how far layers go, and use the library only if you commit to 1e308+.

### 2.5b Active vs idle balance

- Eric Guan: the loop works fastest with active reinvestment but pauses cost little; differentiated playstyles (frequent checkers favour short cycle producers) keep all styles viable. https://ericguan.substack.com/p/idle-game-design-principles
- Academic finding that idle games move players "from playing to planning". https://par.nsf.gov/biblio/10061230-playing-wait-taxonomy-idle-games
- Hardcore players complain when games are tuned for non-idle players ("excessively slow progression"). https://itch.io/post/14706654 **[WEAK]**

### 2.6 Pacing and "the wall"

- Costs outrun production by design; the wall is the moment cost growth beats production growth and the player must prestige, automate or use a new mechanic. Pecorella Parts I and III (links above). Specific wall timings per game **[UNSOURCED]**.
- Mitigation used by successful games: frequent new system unlocks (Unnamed Space Idle), multiple clocks (Guan), automation unlocks (Trimps "automate old stuff as you unlock new stuff" https://www.gamedeveloper.com/design/incremental-game-review-trimps), and challenges (Kittens Game).

### 2.7 Challenges, achievements, automation

- Kittens Game ships challenges and achievements; Antimatter Dimensions has 100 Steam achievements (https://steamhunters.com/apps/1399720/achievements) plus in-game achievements that grant multipliers **[UNSOURCED for the multiplier detail in this session]**.
- Automation as reward: AdVenture Capitalist managers; Trimps automation; Melvor offline combat.

### 2.8 Narrative in idle games

- Paperclips tells a story "in numbers and tiny arcing pixels" and ends definitively; "playable philosophy". https://if50.substack.com/p/2017-universal-paperclips ; https://www.pcgamesinsider.biz/interviews-and-opinion/66271/interview-paperclips-developer-frank-lantz/
- Cell to Singularity frames the player as an "overseer of evolutionary processes", fact-driven narrative. https://en.wikipedia.org/wiki/Cell_to_Singularity

---

## 3. What players hate (and the design rule that avoids each)

Evidence caveat: Reddit was not reachable. Both `old.reddit.com/r/incremental_games/search.json` queries (q=hate, q=pet+peeve) were refused by the fetch tool ("unable to fetch from old.reddit.com"), and web searches never returned r/incremental_games threads. Evidence below is therefore Steam community threads and reviews, itch.io forum posts, app-store listings, articles and academic papers. Where a complaint is general industry knowledge with no fetched source, it is marked **[UNSOURCED]**. Platform column = where the complaint shows up most, inferred from the sources' own platform; "inferred" means I judged it from context.

Quotes come from search-result summaries unless a page was fetched in full; fully fetched pages are marked (fetched).

### 3.1 Time and pacing

**H1. Dead waiting time with no decisions.**

- Evidence: the CHI paper says idle games use "player attention and computer cycles" as resources and move players "from playing to planning" (https://par.nsf.gov/biblio/10061230-playing-wait-taxonomy-idle-games). An itch.io poster says idle games leave them "doing nothing for 2 days every time I pick one up" (fetched: https://itch.io/post/14213475). Article "Let's Talk About Idle Times": https://www.galahadcreative.com/blog/lets-talk-about-idle-times/ (title only, not fetched). Late-game "idle for weeks to earn a single upgrade" (Steam threads via https://steamcommunity.com/app/1353300/negativereviews/?l=english&browsefilter=toprated&snr=1_5_100010_).
- Hurt: late-game NGU Idle, Antimatter Dimensions Pelle, Idle Slayer.
- Platform: Steam and web (hardcore); mobile players tolerate more waiting but resent being sold a skip.
- Rule: every wait must contain at least one meaningful choice (what to queue, what to review, where to invest), and the game must say how long the wait is and what shortens it with play, not money.

**H2. Walls: progress stalls at an arbitrary point.**

- Evidence: "stuck on the 26th planet, it was incrementing too slow" (fetched: https://itch.io/post/14213475). "Late game is broken" (Idle Slayer): https://steamcommunity.com/app/1353300/discussions/0/2792747775858618516/ . "Suddenly slow progression after area 5?" (Nomad Idle): https://steamcommunity.com/app/3042190/discussions/0/601900862720228255/ . Pecorella notes the wall is built in by exponential costs vs polynomial production (https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i).
- Hurt: Nomad Idle, Idle Slayer, most deep incrementals.
- Platform: Steam and web.
- Rule: a wall is only acceptable if the screen names the way past it (next unlock, prestige, automation) and the expected time to clear is shown; never put a wall where the only exit is payment. Playtest with a spreadsheet simulation of time-to-next-purchase and cap it.

**H3. Prestige feels like lost progress or a downgrade.**

- Evidence: "seriously hate prestiging then spam clicking cheap upgrades" (fetched: https://itch.io/post/14213475). Forum summary: many incrementals make you wait for a number, then be "overwhelmed by upgrades before a forced 'prestige' which is really a downgrade" (https://itch.io/post/15658446 and search summary). A prestige system can be "completely and irredeemably useless" in poorly designed games (same search).
- Hurt: generic; Clicker Heroes-style reset loops.
- Platform: web and Steam.
- Rule: a reset must keep something visible the player earned (the first prestige in a few hours, not days), show the projected gain before confirming, never reset what the player sees as their identity (collected words/cultures stay, only "energy" resets), and make the post-reset run visibly faster.

**H4. Over-long or overly frequent prestige loops.**

- Evidence: "Runs get longer as you go"; the genre's norm is evening, then day, then week (https://onirealms.com/guides/idle-games-explained/ **[WEAK]**). "Late game grind has been noted as the worst part of incremental games" (search summary of itch/Steam threads: https://itch.io/post/14141969).
- Platform: Steam and web.
- Rule: cap any single layer's first clear at a stated target (for example 30-60 min early, 1-3 days late) and give a "time to next milestone" readout.

**H5. Late-game content drought / "nothing to do".**

- Evidence: players report reaching final upgrades takes "months" and abandon after rushing to the end; NGU Idle "What to do now? (end game)": https://steamcommunity.com/app/1147690/discussions/0/3077621289889694971/ ; Idle Slayer late game: https://steamcommunity.com/app/1353300/discussions/0/2792747775858618516/ ; search summary: "When games become a chore rather than fun, players quit".
- Hurt: NGU Idle, Idle Slayer, IdleOn.
- Platform: Steam (heavy players).
- Rule: plan content cadence before launch (new country/unit on a schedule); end the critical path at a known point with a credits/summary screen, then optional mastery content.

**H6. Having no ending (and the inverse, a dead-end ending).**

- Evidence: Universal Paperclips is praised for a "very definitive conclusion" (https://if50.substack.com/p/2017-universal-paperclips); open-ended games are described as indefinite by design (https://en.wikipedia.org/wiki/Incremental_game). Direct complaint evidence for "no ending" is thin **[UNSOURCED]**; inferred from the praise for closed games.
- Platform: Steam and web.
- Rule: give every country an authored ending moment (a fluency milestone, a certificate, a story close), with a visible "you can stop here" state; keep the endless layer optional.

### 3.2 Understanding and interface

**H7. Opaque formulas and hidden multipliers.**

- Evidence: Antimatter Dimensions Reality is "where the game's self-teaching breaks down"; players follow wiki guides for months and still feel stuck (https://playwanderer.online/game-reviews/antimatter-dimensions ; https://tvtropes.org/pmwiki/pmwiki.php/YMMV/AntimatterDimensions ; https://steamcommunity.com/app/1399720/discussions/0/3770111056978641345/). Pecorella: "glorified spreadsheets" (https://en.wikipedia.org/wiki/Incremental_game).
- Hurt: Antimatter Dimensions (late), any deep incremental.
- Platform: Steam and web.
- Rule: every multiplier is listed in a tooltip breakdown that sums to the displayed rate; no hidden multipliers; always show "why is this number what it is".

**H8. UI clutter and tab sprawl.**

- Evidence: "Excessive scrolling and UI friction" and constant scrolling between sections (https://itch.io/post/14706654 **[WEAK]**); "without a clear, intuitive UI, this beautiful complexity can quickly spiral into confusion and churn" (https://apptrove.com/how-to-make-an-idle-game/ **[WEAK]**).
- Platform: mobile (small screens) and Steam (late layers).
- Rule: reveal UI by unfolding (A Dark Room rule); hide anything not relevant to the current layer; one primary screen with at most four tabs on mobile.

**H9. Too many currencies.**

- Evidence: "Modern games have too many things to collect or too many different currency types" (https://chrisgio.substack.com/p/currency-confusion); designers recommend "one variable at a time (new currency, automation, or prestige)" (https://mobilefreetoplay.com/why-you-should-care-about-idle-games/). The extreme example cited (Zenless Zone Zero, 9 currencies) is not an idle game.
- Hurt: gacha-style idles, IdleOn-like sprawl (inferred).
- Platform: mobile.
- Rule: budget at most 3 visible currencies per layer; each new currency is introduced with a tutorial moment and must replace, not add to, an old one.

**H10. Unreadable big-number notation.**

- Evidence: numbers shown in scientific notation, suffixes ("1T") or special naming schemes are a genre feature (https://en.wikipedia.org/wiki/Incremental_game); screen readers misread such strings (https://vispero.com/resources/making-numbers-in-web-content-accessible/). A player complaint specifically about notation **[UNSOURCED]**.
- Platform: web and Steam.
- Rule: let the player choose notation (standard, scientific, engineering, words), default to readable suffixes, and keep numbers small; a language game's values (words known, minutes) rarely need 1e308.

**H11. Poor accessibility (colour, font size, screen readers).**

- Evidence: "Color alone should never be used to represent information" (colour-blind guidance in search results, https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/103); screen readers announce numbers in unexpected ways (https://vispero.com/resources/making-numbers-in-web-content-accessible/); Land of Livia is recommended for having handcrafted VoiceOver support and larger text (https://www.guidedogs.org.uk/getting-support/information-and-advice/how-can-technology-help-me/accessible-video-games-list/). Incremental-specific complaints **[UNSOURCED]**.
- Platform: all; mobile (font size) and web (screen readers).
- Rule: WCAG AA contrast, scalable text, no colour-only meaning, semantic HTML with aria-live for income changes (throttled), keyboard-operable everything, reduced-motion option.

### 3.3 Interaction and effort

**H12. Forced clicking and autoclicker dependence.**

- Evidence: "Don't autoclickers make the Active playstyle overpowered?" (Clicker Heroes): https://steamcommunity.com/app/363970/discussions/0/521643320350312126/ ; Firestone "Auto-Clicking and Cheating Policy": https://steamcommunity.com/app/1013320/discussions/0/1630790506918114781/ ; players say "you can't put the game in the background if you need your mouse to be doing something" and worry about carpal tunnel (search summary of the same threads).
- Hurt: Clicker Heroes, Firestone, Cookie Clicker active play.
- Platform: Steam and web.
- Rule: clicking (answering a prompt) must never beat idle play by more than a modest bonus; offer an "auto-answer/auto-review" toggle as an accessibility option; no anti-autoclicker punishment.

**H13. Energy and stamina systems that force downtime.**

- Evidence: Outernauts' energy system "the game's biggest hindrance" (https://en.wikipedia.org/wiki/Outernauts); players praise games with "no energy wall that says 'come back in 4 hours'" (search summary of https://minireview.io/top-mobile-games/best-mobile-idle-games); stamina forcing downtime (same search).
- Platform: mobile.
- Rule: no energy gates; time is the only pacing resource, and the cap on offline gains is a generous number shown up front.

**H14. Pay-to-skip and pay-to-win.**

- Evidence: Buergi (Replay): developers leverage impatience through microtransactions that "expedite progression in exchange for real-world money" (https://czasopisma.uni.lodz.pl/Replay/article/view/23588). IdleOn reviews: "Extreme P2W", stat-boosting packs, content inaccessible without paying (https://store.steampowered.com/app/1476970/Legends_of_IdleOn__Idle_MMO/). Idle Champions: "extremely predatory monetisation" (https://steamcommunity.com/app/627690/negativereviews/?p=1&browsefilter=toprated).
- Platform: mobile and Steam F2P.
- Rule: nothing purchasable changes learning outcomes or pacing; sell cosmetics, extra content (new countries) and supporter packs only.

**H15. Expiring DLC, battle passes and false scarcity.**

- Evidence: Idle Champions sells "continually expiring DLC forcing false scarcity, back-to-back battle passes" with 64 DLC packs totalling GBP 597 (https://en.wikipedia.org/wiki/Idle_Champions_of_the_Forgotten_Realms ; https://steamcommunity.com/app/627690/negativereviews/?p=1&browsefilter=toprated).
- Platform: Steam F2P.
- Rule: content packs never expire; once bought they are permanent, and any sale is transparent about its end.

**H16. Mandatory or spammy ads.**

- Evidence: Realm Grinder markets "no forced ads" (https://www.kongregate.com/en/games/divinegames/realm-grinder); Egg Inc praised for rewarded-only ads (https://www.pocketgamer.biz/egg-inc-idle-games-gold-standard/). Direct ad-spam complaint quotes **[UNSOURCED]** (inferred from the positive framing).
- Platform: mobile.
- Rule: no interstitials, ever; at most opt-in rewarded ads that give cosmetic or mildly convenient rewards; none in learning flows (and none at all in a child-directed build).

### 3.4 Time pressure and re-engagement

**H17. FOMO timed events.**

- Evidence: IdleOn players report "FOMO and Toxic RNG in events on daily basis" (https://steamcommunity.com/app/1476970/reviews/); "holidays, events and banners ... punishing players who don't show up" (https://www.howtogeek.com/how-your-favorite-online-games-use-fomo-against-you/ ; https://gamedesignskills.com/game-design/player-retention/).
- Platform: mobile and Steam F2P.
- Rule: seasonal content (festivals) is always replayable later; limited-time means "featured", not "lost".

**H18. Login-streak punishment.**

- Evidence: escalating daily rewards where missing a day breaks the streak (https://gamedesignskills.com/game-design/player-retention/); Duolingo users open the app at 11:58 PM to save a streak and report crying over broken 200-day streaks (https://medium.com/@varsharam/how-duolingo-makes-me-feel-guilty-and-why-that-works-ec70cc9b14b9 ; https://duolingoguides.com/why-duolingo-is-scary-the-psychology-behind-that-green-owl/).
- Platform: mobile.
- Rule: streaks are opt-in, freeze automatically, and a missed day never removes earned progress; reward "weeks practised", not "unbroken".

**H19. Notification spam and guilt-trip notifications.**

- Evidence: "come back now", "don't miss this reward" messages are "received with hostility" (https://www.gameanalytics.com/blog/learn-push-notifications-best-practices). Duolingo's "passive-aggressive" owl; a survey said 37.8% "felt personally threatened by the Duolingo owl" (https://duolingoguides.com/why-duolingo-is-scary-the-psychology-behind-that-green-owl/ **[WEAK, informal survey]**); a notification claiming "your friends are getting ahead" for a user with no friends (https://medium.com/@milessightings/i-reverse-engineered-duolingos-guilt-algorithm-6ddf598d2a72).
- Platform: mobile.
- Rule: notifications off until the player opts in per type; max one per day; never guilt, never fake social pressure; factual only ("your words are ready to collect").

### 3.5 Trust: saves, offline, balance, cheating

**H20. Save loss and no export.**

- Evidence: saves in localStorage lost to cleared history or CCleaner; "Lost save data" (https://steamcommunity.com/app/1353300/discussions/0/5487063042661950995/); "Having Steam Cloud Sync Issue or Lost Your Save?" (https://steamcommunity.com/app/1574000/discussions/0/5170673756526181610/); Melvor "what would cause local saves to disappear?" (https://steamcommunity.com/app/1267910/discussions/0/4431066036847139385/).
- Hurt: Idle Slayer, Industry Idle, Melvor Idle (web).
- Platform: web (localStorage) most; Steam cloud conflicts.
- Rule: account-based cloud save, visible "last synced" time, export/import string, rotating local backups (keep 3-5), never overwrite with an older save without a prompt.

**H21. Missing or broken offline progress.**

- Evidence: "Back to failed offline earnings?" (https://steamcommunity.com/app/346900/discussions/0/618458030649166426) and "Any fix yet for Earth's offline earnings?" (AdVenture Capitalist, https://steamcommunity.com/app/346900/discussions/0/3156453942271118386/); Idle Slayer offline grinding "nerfed multiple times" (search summary above).
- Platform: Steam and mobile.
- Rule: timestamp-based, deterministic catch-up with a "welcome back" summary, a tested cap, and automated tests that simulate 1 h, 1 day, 30 days away.

**H22. Nerf patches and retroactive balance changes.**

- Evidence: IdleOn raised a character-unlock level from 600 to 1100 and "QoL" updates seen as "nerfs in disguise"; Idle Champions nerfed characters after players paid for them; Nomad Idle Ghost Blade nerf; Idle Slayer slowed by over 50% (https://steamcommunity.com/app/1476970/reviews/?browsefilter=toprated&snr=1_5_100010_ ; https://steamcommunity.com/app/627690/discussions/0/2154350647522123894/?ctp=2 ; https://steamcommunity.com/app/3042190/discussions/0/601900862720228255/ ; https://steamcommunity.com/app/1353300/negativereviews/?l=english&browsefilter=toprated&snr=1_5_100010_).
- Platform: Steam.
- Rule: never slow paid-for or already-earned progress; buff rather than nerf; publish patch notes with before/after rates; grandfather existing saves.

**H23. Anti-cheat that punishes players.**

- Evidence: bans for clock manipulation or speed-up (Idle Hero TD "Banning people for using 6time speed up": https://steamcommunity.com/app/2897580/discussions/0/796709978759203434/ ; Leaf Blower Revolution "do not time travel" PSA: https://steamcommunity.com/app/1468260/discussions/0/3118150513201890716 ; automated save-value bans in Firestone: https://steamcommunity.com/app/1013320/discussions/0/3159763879073035335/). False-positive stories beyond these **[UNSOURCED]**.
- Platform: Steam and mobile with server saves.
- Rule: a single-player game should not punish clock changes: cap offline gains, compare to server time when synced, and silently ignore impossible jumps rather than banning; no leaderboard, no ban.

**H24. Battery drain and background CPU on mobile.**

- Evidence: games like AFK Arena "keep phone screens on", causing drain and heat; lowering the frame-rate cap is hard to notice in idle games (https://www.techmanly.com/mobile-game-battery-drain-whats-actually-draining-your-phone/ ; https://www.prismnews.com/hobbies/mobile-gaming/how-mobile-games-can-cut-battery-drain-heat-and-throttling). Specific complaint quotes against a named idle game are not sourced **[UNSOURCED]**.
- Platform: mobile.
- Rule: no per-frame rendering when idle (update DOM at 1-4 Hz or on change), no keep-awake, pause timers on `visibilitychange`, catch up by timestamp on resume (also avoids the WKWebView suspension issue in section 5).

### 3.6 Learning apps that feel like homework

**H25. Review pile-up and ease-hell burnout.**

- Evidence: people get burned out "when all these reviews come back to haunt them" after the spacing; Anki "ease hell" (https://www.tofugu.com/japanese/spaced-repetition/ ; https://community.wanikani.com/t/need-help-with-anki-steps-intervals/57357).
- Hurt: WaniKani, Anki.
- Platform: mobile and web apps.
- Rule: cap the daily review queue, let overdue items decay in value instead of accumulating as debt, and offer a "catch-up" mode with fewer, better-chosen items.

**H26. Gamification displacing learning (XP farming, "winning the game").**

- Evidence: users repeat easy lessons to farm XP; the game incentivises "winning the game" rather than learning (search summary of https://spellings.app/blog/duolingo-effect **[WEAK]**); peer-reviewed qualitative case "When Gamification Spoils Your Learning" (https://arxiv.org/pdf/2203.16175); ScienceDirect on the conflicting role of the game layer (https://www.sciencedirect.com/science/article/abs/pii/S0378720625000369).
- Platform: mobile.
- Rule: idle currency must be earned by demonstrated recall, not raw time or taps; do not reward repeating easy items.

**H27. League and leaderboard pressure.**

- Evidence: weekly 10-tier XP leagues with promotion and relegation (https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth); "XP leaderboards create artificial competition with strangers" and users anxious about rank (https://duolingoguides.com/why-duolingo-is-scary-the-psychology-behind-that-green-owl/ **[WEAK]**).
- Platform: mobile.
- Rule: no forced competition; optional friendly challenges or co-op goals (Egg Inc's co-op model) instead of relegation.

**H28. "Number go up" without meaning.**

- Evidence: Orteil calls his games "non-games" (https://en.wikipedia.org/wiki/Incremental_game); Lantz's counter: the best ones make exponential growth "concrete, visceral" and carry meaning (https://www.pcgamesinsider.biz/interviews-and-opinion/66271/interview-paperclips-developer-frank-lantz/). Direct player-complaint evidence **[UNSOURCED]**.
- Platform: all.
- Rule: every number should map to something a player can recognise (words known, places unlocked, phrases you can now say); show a real-world meaning next to each milestone ("you can now order in a restaurant").

**Summary by platform (inferred from the sources above):** web = save loss, UI sprawl, notation; Steam = walls, grind, nerfs, content droughts, autoclicker dependence, cloud conflicts; mobile = energy, ads, notifications, FOMO and streaks, battery, currency sprawl.

---

## 4. Educational / language-learning products

### 4.1 Duolingo: what works, what backfires

- Mechanics: streaks, weekly leagues (10 tiers up to Diamond, tested 2018), XP, streak-saver notifications. Claimed results: 7-day streak users 3.6x more likely to stay engaged; churn cut from 47% to 28% in major markets; DAU up 4.5x over four years; DAU/MAU around 20%. https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth ; https://nogood.io/blog/duolingo-case-study/ ; https://www.strivecloud.io/blog/gamification-examples-boost-user-retention-duolingo (marketing/analyst blogs; treat figures as **[WEAK]**)
- Criticism: streak anxiety; users farm XP on easy lessons; focus shifts to "winning the game" not learning; peer-reviewed qualitative case "When Gamification Spoils Your Learning" (misuse of gamification in a language app). https://arxiv.org/pdf/2203.16175 ; https://www.sciencedirect.com/science/article/abs/pii/S0378720625000369 ; only ~5% reach "level 5" per https://spellings.app/blog/duolingo-effect **[WEAK]**

### 4.2 SRS products and what burns people out

- WaniKani intervals: Apprentice (4 stages: 4 h, 8 h, 1 d, 2 d), Guru (1 w, 2 w), Master (1 month), Enlightened (4 months), Burned. https://knowledge.wanikani.com/wanikani/srs-stages/ ; https://wanilog.com/guides/wanikani-srs-explained
- Burnout: review piles return after the "space" elapses; Anki "ease hell". https://www.tofugu.com/japanese/spaced-repetition/ ; https://community.wanikani.com/t/need-help-with-anki-steps-intervals/57357 ; https://migaku.com/blog/japanese/anki-vs-wanikani
- Memrise considered solid only if multiple choice and dubious "mems" are avoided (same Migaku/Tofugu sources).

### 4.3 Direct competitors and analogues

- **Noun Town: Learn & Chill**: idle vocabulary sessions using "spaced repetition and native speaker recordings" across 12 languages, Windows only, low one-off price. https://noun.town/blog/best-idle-games-on-steam-that-actually-teach-you-something/ (Steam reception and player numbers not verified **[UNSOURCED]**)
- **Language Invention Idle Game** (kalamayin): letters to syllables to words to grammar. https://kalamayin.itch.io/language-idle
- **Cell to Singularity**: proof that an educational incremental can ship on web, iOS, Android and Steam; facts delivered as unlock content. https://en.wikipedia.org/wiki/Cell_to_Singularity
- Research on game-based informal digital learning of English (IDLE) reports vocabulary gains from gaming: https://onlinelibrary.wiley.com/doi/10.1111/ijal.12848 ; https://www.nature.com/articles/s41599-024-04073-3

### 4.4 Spaced repetition algorithms

- **Leitner**: boxes with fixed coarse intervals, not adaptive. https://expertium.github.io/Benchmark.html ; https://www.antiagent.io/blog/fsrs-vs-sm-2
- **SM-2** (SuperMemo, 1987; basis of Anki): one tunable value (ease factor).
- **FSRS** (Anki 23.10, 2023): memory-stability/retrievability model, 19 trainable weights; in the open benchmark over >700M reviews FSRS-6 beats SM-2 for 99.6% of users; claims 20-30% fewer reviews for same retention. https://github.com/ankitects/fsrs-benchmark ; https://expertium.github.io/Benchmark.html ; https://en.wikipedia.org/wiki/Anki (vendor/enthusiast blogs for the 20-30% figure are **[WEAK]**).

### 4.5 How SRS could map to idle timers (design proposals; mine, **[UNSOURCED]** as designs)

- Each word/phrase/custom is a "generator" whose output yield is proportional to its retrievability; producing decays over time like a forgetting curve; a short review "refreshes" it (resets stability), exactly like reviewing a card. The WaniKani ladder (4 h, 8 h, 1 d, 2 d, 1 w, 2 w, 1 m, 4 m) is a ready-made "clock ladder" that matches Eric Guan's "multiple clocks with exponentially longer cycles".
- Offline progress: items keep producing at decayed rate while away; returning shows a "welcome back" with a review queue sized by the cap (never a guilt pile). Avoid WaniKani-style unforgiving pile-ups and Duolingo streak anxiety (sections 3, 4.1).
- Prestige = "graduating" a language/level into a permanent bonus (analogue of Anki "burned" items), so the player slides up the cost curve but retains mastery.

---

## 5. Cross-platform shipping of web idle games

### 5.1 Steam (desktop wrapper)

- **Electron + steamworks.js** is the current mainstream path. steamworks.js (Rust, prebuilt binaries via npm) supports achievements, overlay, player info, and (per the API declarations) more; targets Electron, NW.js and Node. In the renderer it needs `contextIsolation: false`, `nodeIntegration: true`, plus `electronEnableSteamOverlay()`; redistributable files must be copied into the build root. It superseded **greenworks**, which is unmaintained and needs you to build binaries yourself; greenworks supports Steam Cloud (`saveTextToFile`/`readTextFromFile`), achievements, workshop. https://github.com/ceifa/steamworks.js/ ; https://github.com/greenheartgames/greenworks/wiki/API-Reference ; https://github.com/alexanderthurn/steam-electron-build (packaging recipe incl. Steam Deck fixes); https://www.overactiongamestudio.com/tutorials/18-developing-and-publishing-a-web-game-on-steam-with-electronjs-steamworks-js ; alt `steamworks-ffi-node` https://dev.to/arty_prof/steamworks-ffi-node-a-steamworks-sdk-library-for-javascript-game-frameworks-15h1
- Steam features in shipped idle games: Antimatter Dimensions has automatic Steam cloud saves and 100 Steam achievements (https://store.steampowered.com/app/1399720/Antimatter_Dimensions/); Kittens Game Steam EA includes cloud save and achievements (https://store.steampowered.com/app/1097410/Kittens_Game/). Which wrapper each uses (Electron vs NW.js) **[UNSOURCED]**.
- **Electron vs Tauri**: Electron bundles Chromium so rendering is identical across OSes (52 MB+ apps); Tauri uses system WebView (WebView2 on Windows, WebKit on macOS, WebKitGTK on Linux), giving ~3 MB apps but real compatibility differences. https://www.abratabia.com/native-wrappers/tauri-vs-capacitor.php ; https://blog.logrocket.com/tauri-electron-comparison-migration-guide/ ; https://dev.to/vorillaz/tauri-vs-electron-a-technical-comparison. For a game needing Steamworks bindings today, Electron is the path with documented, maintained bindings; a Tauri Steam route is possible but I found no source for maintained Steamworks bindings **[UNSOURCED]**.

### 5.2 Mobile

- **Capacitor** is the modern replacement for Cordova and works on iOS, Android, web and Electron. https://dev.to/ionic/the-easiest-way-for-web-developers-to-build-mobile-apps-1ih8
- Melvor Idle ships to iOS/Android with one cross-platform cloud save via its own account system (auto-push every 12 h). https://www.jagex.com/news/melvor-idle-version-1-0-launches-on-pc-and-mobile ; https://wiki.melvoridle.com/w/FAQ . The mobile wrapper technology **[UNSOURCED]**.
- **App Store guideline 4.2 (minimum functionality):** a bare web wrapper is a common first-submission rejection; add native integration (notifications, haptics, offline, platform features). https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper/ ; https://forum.ionicframework.com/t/apple-4-2-minimum-functionality/189688 . Games are generally treated differently from content apps **[UNSOURCED]**.
- **Background timers:** WKWebView suspends JS execution when the app is backgrounded (setTimeout/setInterval stop); on iOS 17.5 setInterval reportedly stopped where earlier versions worked. Capacitor Background Runner gives ~30 s per invocation, scheduled at iOS's discretion, not guaranteed. https://issues.apache.org/jira/browse/CB-10657 ; https://capacitorjs.com/docs/apis/background-runner ; https://developer.apple.com/forums/thread/757606 . Therefore: never rely on timers for idle accrual; store timestamps and compute deltas on resume (same pattern as offline progress in section 2.4), and use local notifications for re-engagement.
- Web wrappers reported white-screen on restore from background in Capacitor on iOS: https://github.com/ionic-team/capacitor/discussions/7097

### 5.3 Cloud save approaches

- Options seen in the wild: Steam Cloud (automatic, Steam build), a first-party account (Melvor: free Melvor account, 12 h auto-push), export/import save strings and rotating local backups (community practice). Sources above. Account-based sync is the only one that spans Steam, web and mobile; a Sign in with Apple / Google requirement for mobile sign-in **[UNSOURCED]**.
- Conflict policy (latest wins vs highest progress vs prompt) is a design decision; I found no authoritative source **[UNSOURCED]**.

### 5.4 Pitfalls checklist

- Clock cheating and timezone/DST changes with timestamp-based offline progress (sources in 2.4).
- Electron: `nodeIntegration` needed by steamworks.js conflicts with security best practice; prefer a preload with `contextBridge` **[UNSOURCED]**.
- Tauri: WebKit vs Chromium differences; test every target webview.
- WKWebView suspension and app-killed-by-OS; save on `visibilitychange`/`pagehide`, not on timers **[UNSOURCED, standard web practice]**.

---

## 6. Monetisation models players accept

| Model                                                                                       | Example                                    | Reception / evidence                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Premium one-off (Steam)**                                                                 | Melvor Idle $9.99; Cookie Clicker on Steam | Melvor ~93% positive; Cookie Clicker ~2.8M units [WEAK]. https://www.jagex.com/news/melvor-idle-version-1-0-launches-on-pc-and-mobile ; https://app.sensortower.com/vgi/game/cookie-clicker |
| **Free-to-try then one-off unlock (mobile)**                                                | Melvor on iOS/Android                      | 4.9/5 iOS, 4.8/5 Android per Jagex page. Same source                                                                                                                                        |
| **Free, donations / pay-what-you-want support**                                             | Trimps (Bones), Evolve (Patreon)           | Beloved; no pressure. https://store.steampowered.com/app/1877960/Trimps/ ; https://www.patreon.com/demagorddon                                                                              |
| **Goodwill F2P with optional rewarded video, one-off Pro Permit, player-priced Piggy Bank** | Egg, Inc.                                  | Held up as "gold standard". https://www.pocketgamer.biz/egg-inc-idle-games-gold-standard/                                                                                                   |
| **Cosmetics + convenience gems**                                                            | IdleOn gem shop                            | Commercially huge [WEAK] but drifting to P2W draws heavy criticism. https://www.leetdom.com/reviews/legends-of-idleon                                                                       |
| **Optional incentivised ads, no forced ads**                                                | Realm Grinder                              | https://www.kongregate.com/en/games/divinegames/realm-grinder                                                                                                                               |
| **Premium-currency time skips + ads**                                                       | Cell to Singularity (Darwinium)            | Accepted because most content is free; https://en.wikipedia.org/wiki/Cell_to_Singularity                                                                                                    |
| **DLC/battle-pass/chest treadmill**                                                         | Idle Champions                             | Major backlash (64 DLC, GBP 597). https://steamcommunity.com/app/627690/negativereviews/?p=1&browsefilter=toprated                                                                          |
| **No monetisation, story-complete**                                                         | Universal Paperclips, Candy Box            | Goodwill and press; no revenue model. https://if50.substack.com/p/2017-universal-paperclips                                                                                                 |

Backlash triggers: sold progress walls, expiring DLC/false scarcity, content gated behind paid stat packs, retroactive feature removal (sources above). Regulatory risk for child-directed educational apps (COPPA/age-appropriate design code, rewarded ads, loot boxes) **[UNSOURCED]**.

---

## 7. Top 12 lessons for a language-and-culture idle game

Each lesson pairs what works (section numbers 1, 2, 4, 5, 6) with what is hated (section 3, H-numbers).

1. **Make each language item a generator, and make every number mean something.** Pecorella's generators-make-generators (letters, syllables, words, grammar) fits language; the Language Invention Idle Game proves the shape. It also answers H28 (meaningless numbers): attach real-world meaning to each milestone. Evidence: https://www.gamedeveloper.com/game-platforms/the-math-of-idle-games-part-ii ; https://kalamayin.itch.io/language-idle ; https://www.pcgamesinsider.biz/interviews-and-opinion/66271/interview-paperclips-developer-frank-lantz/
2. **Use the forgetting curve as your "clock ladder", and never let it become a pile.** WaniKani's 4 h / 8 h / 1 d / 2 d / 1 w / 2 w / 1 m / 4 m ladder matches Guan's multi-clock design; a review refreshes a word's yield. Avoid review pile-up and burnout (H25), dead waiting (H1) and wall-like gating (H2). Evidence: https://knowledge.wanikani.com/wanikani/srs-stages/ ; https://ericguan.substack.com/p/idle-game-design-principles ; https://www.tofugu.com/japanese/spaced-repetition/
3. **Soft streaks, honest notifications, no leagues.** Duolingo's mechanics retain users but breed anxiety, guilt notifications and XP farming (H18, H19, H26, H27). Opt-in streaks with automatic freezes, factual notifications capped at one a day, and co-op instead of relegation. Evidence: https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth ; https://arxiv.org/pdf/2203.16175 ; https://www.gameanalytics.com/blog/learn-push-notifications-best-practices
4. **Unfold the world one country and one system at a time.** A Dark Room, Candy Box, Paperclips and Antimatter Dimensions show reveal works; it also prevents UI clutter and currency sprawl (H8, H9, H7). Evidence: https://en.wikipedia.org/wiki/A_Dark_Room ; https://if50.substack.com/p/2017-universal-paperclips ; https://mobilefreetoplay.com/why-you-should-care-about-idle-games/
5. **Prestige as "graduating", with a preview and a fast first reset.** Earnings-since-reset or max-earnings formulas with sqrt growth keep replay pointless; keep earned words visible so a reset never feels like lost progress (H3, H4). Evidence: https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii ; https://itch.io/post/14213475
6. **Authored endings plus optional endless mastery, with a content calendar.** Closed games are loved (Paperclips, 2M players); open-ended ones retain (Cookie Clicker 285 h average), but droughts and no-ending frustration are real (H5, H6). Evidence: https://if50.substack.com/p/2017-universal-paperclips ; https://app.sensortower.com/vgi/game/cookie-clicker ; https://steamcommunity.com/app/1147690/discussions/0/3077621289889694971/
7. **Timestamp-based, tested, battery-friendly progress.** WKWebView suspends timers in background, so catch up by timestamp; update the UI rarely; test 1 h / 1 day / 30 days away. Avoids broken offline (H21), battery drain (H24) and anti-cheat overreach (H23). Evidence: https://issues.apache.org/jira/browse/CB-10657 ; https://steamcommunity.com/app/346900/discussions/0/618458030649166426 ; https://www.techmanly.com/mobile-game-battery-drain-whats-actually-draining-your-phone/
8. **Saves are sacred: account cloud save, Steam Cloud, export string, rotating backups.** Save loss is the most repeated trust-breaker (H20). Evidence: https://steamcommunity.com/app/1353300/discussions/0/5487063042661950995/ ; https://wiki.melvoridle.com/w/FAQ
9. **Desktop via Electron + steamworks.js; mobile via Capacitor with real native features.** Steam achievements and cloud are solved there; Apple 4.2 rejects bare wrappers. Evidence: https://github.com/ceifa/steamworks.js/ ; https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper/
10. **Monetise like Melvor, Egg Inc and Trimps; never like Idle Champions.** One-off premium on Steam, free-to-try then unlock on mobile, optional rewarded ads and cosmetics; no pay-to-skip, expiring DLC, energy gates or nerf patches on paid content (H13-H17, H22). Evidence: https://www.jagex.com/news/melvor-idle-version-1-0-launches-on-pc-and-mobile ; https://www.pocketgamer.biz/egg-inc-idle-games-gold-standard/ ; https://steamcommunity.com/app/627690/negativereviews/?p=1&browsefilter=toprated
11. **Transparent maths and readable numbers for everyone.** Show a multiplier breakdown, offer notation choices, meet WCAG AA, support screen readers and reduced motion (H7, H10, H11). Evidence: https://playwanderer.online/game-reviews/antimatter-dimensions ; https://vispero.com/resources/making-numbers-in-web-content-accessible/
12. **Measure learning with FSRS-style scheduling and decouple it from idle currency.** FSRS beats SM-2 for 99.6% of users in an open 700M-review benchmark; rewarding recall (not time or taps) prevents gamified homework and XP farming (H26, H12). Evidence: https://github.com/ankitects/fsrs-benchmark ; https://en.wikipedia.org/wiki/Cell_to_Singularity

---

## 7b. Do-not list (derived from section 3)

1. Do not make players wait without a decision available (H1).
2. Do not place a wall without a named way past it, and never sell the way past (H2).
3. Do not make a reset feel like a downgrade; show the gain beforehand and keep what is visible (H3).
4. Do not let prestige cycles grow unbounded; state target times (H4).
5. Do not leave a content drought; plan cadence and a real ending (H5, H6).
6. Do not hide multipliers or formulas; every rate has a breakdown (H7).
7. Do not show features the player cannot yet use (H8).
8. Do not exceed three visible currencies per layer (H9).
9. Do not force scientific notation or colour-only meaning; provide notation, contrast and screen-reader support (H10, H11).
10. Do not make clicking beat idling, and do not punish autoclickers (H12).
11. Do not add energy or stamina gates (H13).
12. Do not sell progress, skips or learning-affecting boosts (H14).
13. Do not use expiring content, battle passes or false scarcity (H15).
14. Do not show interstitial or forced ads; no ads in learning flows (H16).
15. Do not make seasonal content missable for good (H17).
16. Do not punish missed days or remove progress for absence (H18).
17. Do not send guilt-trip, fake-social or more-than-daily notifications (H19).
18. Do not rely on a single localStorage save; always provide export and cloud sync (H20).
19. Do not ship offline progress untested, or without a cap and summary (H21).
20. Do not nerf earned or paid-for progress retroactively (H22).
21. Do not ban or punish players for clock changes in a single-player game (H23).
22. Do not render or poll continuously when idle; no keep-awake (H24).
23. Do not let review queues accumulate as debt (H25).
24. Do not reward time or taps as if they were learning (H26).
25. Do not force league or rank competition (H27).
26. Do not show numbers with no real-world meaning attached (H28).

---

## 8. Open questions / claims I could not source

- Which wrapper (Electron vs NW.js) Antimatter Dimensions, Kittens Game and Melvor use on Steam/mobile.
- Melvor's mobile wrapper tech; Universal Paperclips platform ports; NGU Idle revenue.
- Reliable revenue for Egg Inc, AdVenture Capitalist, Idle Slayer (only aggregator estimates, unreliable; Melvor estimate was absurd).
- Reddit: old.reddit.com JSON search was refused by the fetch tool; no r/incremental_games thread was quoted. See section 3 for evidence used instead and the [UNSOURCED] tags on H6, H10, H11, H16, H23, H24, H28.
- Maintained Steamworks bindings for Tauri; App Store leniency specifically for games wrapped with Capacitor; cloud-save conflict-resolution best practice.
- Steam reception of Noun Town: Learn & Chill.
