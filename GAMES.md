# Cartridge Games — the wanted list

> Master registry of every game Aaron has said yes to (consolidated 2026-06-10).
> Canonical share link: `https://aaron-ferber.github.io/cartridge/#cart=<payload>`
> (deployed player supports fragment auto-run, QR scan via jsQR, offline via SW).
> Convention for ALL games: end screen = a compact score/result card that copies
> into the chat — the paste-loop is the social layer.

## Tier 1 — Infinite arcade (build first; pure rules, no content corpus)

| #   | Game                                       | Controls                                | Size class              | Status               |
| --- | ------------------------------------------ | --------------------------------------- | ----------------------- | -------------------- |
| 1   | **2048**                                   | swipe 4-way                             | tight link / small file | built — bundled 2026-06-10 |
| 2   | **Snake**                                  | swipe to steer                          | link-sized              | built — bundled 2026-06-10 |
| 3   | **Tetris**                                 | swipe move, tap rotate, swipe-down drop | file cartridge          | built — bundled 2026-06-10 |
| 4   | **Minesweeper**                            | tap reveal, long-press flag             | borderline link         | built — bundled 2026-06-10 |
| 5   | **One-tap runner** (Flappy/Canabalt-style) | single tap                              | link-sized              | built — bundled 2026-06-10 |

## Tier 2 — Guess→gasp reveal games (bundled seed decks; offline; room-playable)

All from the hackathon idea board (explicitly liked). Each ships with a baked-in
data deck — no backend, decks refresh by shipping a new cartridge.

| #   | Game                       | One-liner                                                        | Seed data             |
| --- | -------------------------- | ---------------------------------------------------------------- | --------------------- |
| 6   | **Rentle**                 | guess the rent from listing clues                                | bundled seed deck — built 2026-06-10 |
| 7   | **Price Is Wrong**         | guess the NYC contract amount from agency+purpose                | bundled seed deck — built 2026-06-10 |
| 8   | **Payroll Tab**            | guess what the city pays a Bridge Painter                        | bundled seed deck — built 2026-06-10 |
| 9   | **Chargemaster Roulette**  | guess the MRI price, hospital vs hospital                        | bundled seed deck — built 2026-06-10 |
| 10  | **Menus of New York**      | guess the year from a historical menu                            | bundled seed deck — built 2026-06-10 |
| 11  | **Hydrant Index: Jackpot** | guess what this corner earned in tickets                         | bundled seed deck — built 2026-06-10 |
| 12  | **Who Said It?**           | guess who said the quote from a bundled archetype cast           | bundled seed deck — built 2026-06-10 |

## Tier 3 — Swipe & group (engine already exists)

| #   | Game                                | Notes                                                                                                                  |
| --- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 13  | **Swipe decks** (IdeaSwipe pattern) | taste-learning swipe engine — built as `Swipe Decks`, bundled 2026-06-10                                                |
| 14  | **Group Table**                     | pass-and-play table picker, least-misery scoring — built and bundled 2026-06-10                                         |

## Rejected for now (don't re-pitch)

Challenge-code/async-multiplayer games (set-your-own Wordle, Trivia Duel,
Battleship-by-code), Who Wants to Be a Millionaire, 20 Questions, Heads Up.
Offered 2026-06-10; Aaron chose the infinite-arcade family instead.

## Standing decisions

- Player stays publicly hosted at `aaron-ferber.github.io/cartridge/` (Aaron,
  2026-06-10) — anonymity requirement re-scoped: the generic player is public;
  cartridge payloads still travel data-in-link/file, never uploaded.
- Per-game share loop: score cards as copyable text, results paste back into chat.
