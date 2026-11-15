# SANDLINE — a three.js tactical FPS

A complete round-based tactical shooter in the style Counter-Strike made famous,
built as an original game: two teams, short rounds, a bomb to plant and defuse,
money between rounds, a buy menu, and gunfire where accuracy counts more than speed.

## The game

- **Yard 7** — an original freight-terminal map: two bomb sites (Warehouse A and
  Silo B), a mid lane, long sightlines and close corners, containers and crates
  for cover.
- **5 v 5** — you lead the Vanguard attack with four bot teammates against five
  Sentinel defenders. First to 5 rounds wins the match (max 9 rounds).
- **The objective** — plant the spike at A or B and defend it until it blows, or
  eliminate the whole defending team. Defenders win by stopping the plant,
  defusing it, or running the clock out.
- **The economy** — kills, round wins and plants pay. Spend it in the buy menu
  between rounds: SMG, rifle, sniper, frag grenades. Lose a round and the
  comeback bonus keeps you in the fight.
- **The gunplay** — hitscan weapons with headshots worth 4x, recoil and spread
  that punish firing on the move, crouching and jumping with real collision,
  a scope on the sniper rifle.
- **The bots** — defenders hold their sites and rotate when the spike goes down,
  attackers push lanes on waypoint routes, everyone reacts to what they see
  and to the sound of gunfire.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move |
| Mouse | Look (click to lock) |
| Click | Fire |
| R | Reload |
| 1–4 | Pistol / SMG / Rifle / Sniper |
| G | Throw frag grenade |
| E | Plant / defuse (hold, at a site / at the spike) |
| B | Buy menu (between rounds) |
| Shift | Walk slow (steadier aim) |
| Ctrl / C | Crouch |
| Space | Jump |
| M | Mute |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network: `game/` is plain static files, three.js 0.187.0 is
vendored under `game/vendor/three/`. Sounds are synthesized live with WebAudio.

## Shots

`?shot=start|play|end&seed=N` renders a deterministic frame for a screenshot
and freezes it, setting `window.__shotReady` (see `shots.json`).

## Entry

`main.ts` (Node 22, standard library only) hands the game in: it copies `game/`
and `screenshots/` to `/output` and writes `/output/dossier.json` with the
vendored make.fun library (`vendor/makefun-threejs.ts`).

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT. See `LICENSE`.
