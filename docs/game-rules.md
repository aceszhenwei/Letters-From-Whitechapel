# Game rules as implemented

The game follows the *Letters from Whitechapel* revised edition rulebook (Fantasy Flight Games, 2012). The player is the police; the computer is Jack. Each rule below names the code that enforces it and the test that checks it (mostly in `test/unit/rules.test.js`).

## Goal

Jack wins by killing five victims over four nights and reaching his hideout every night. The police win by arresting Jack, by trapping him so he can't move, or by stopping him reaching his hideout before his last move.

## Preparing the game

| Rule | Code |
|---|---|
| Jack secretly chooses a hideout: any numbered circle except a red one. | `game.selectBase` |
| Four nights: 31 August, 8 September, 30 September (the double event) and 9 November 1888. | `nights` in `content.js` |

## First part: Hell

| Phase | Rule | Code |
|---|---|---|
| 1 Preparing the scene | Jack gets 3, 2, 2, 1 coaches and 2, 2, 1, 1 alleys over the four nights. | `game.preparingTheScene`, `game.config.carriages`, `game.config.alleys` |
| 2 The targets are identified | Jack places 8, 7, 6, 4 women (5, 4, 3, 1 of them marked) on red numbered circles, never on a crime scene. | `game.theTargetsAreIdentified` |
| 3 Patrolling the streets | First night: 5 real and 2 fake patrol tokens on yellow-bordered crossings. Later nights: a token wherever a policeman ended the night before, and the other two on yellow-bordered crossings without a policeman. | `game.patrolPositions`, `game.patrollingTheStreets` |
| 4 The victims are chosen | Marked women become Wretched, the others are removed. The Time of the Crime token goes on I. | `game.theVictimsAreChosen` |
| 5 Blood on the streets | Jack kills or waits. On V he must kill. | `game.bloodOnTheStreets` |
| 6 Suspense grows | The Time of the Crime token moves on. The police move each Wretched to an adjacent numbered circle. A Wretched can't pass a patrol token, end next to one, or end on a Wretched or a crime scene. With no legal move it stays. | `game.suspenseGrows`, `game.wretchedMoves`, `game.patrolTokens` |
| 7 Ready to kill | Jack reveals a patrol token he hasn't revealed yet. A fake one is removed. Back to phase 5. | `game.readyToKill`, `game.revealPolice` |
| 8 A corpse on the sidewalk | The crime scene marker goes down. Jack's pawn starts on the Time of the Crime space. | `game.murder` |
| 9 Alarm whistles | Real patrols become policemen; fake patrols and Wretched are removed. | `game.alarmWhistles` |

**The double event:** on the third night Jack kills two Wretched. Both crime scenes are on his sheet, the second uses his first move, and the police move first (Hunting starts at phase 2).

## Second part: Hunting

| Phase | Rule | Code |
|---|---|---|
| 1 Escape in the night | Jack moves to an adjacent numbered circle, never past a crossing with a policeman, or uses a coach or alley. If he can't move, he loses. | `game.escapeTheNight`, `jack.move`, `jack.canMove` |
| | He escapes when a normal move takes him onto his hideout. A coach or alley onto it doesn't count. | `game.escapeTheNight` |
| | He loses if his last move (15) doesn't reach his hideout. | `game.escapeTheNight` |
| 2 Hunting the monster | Each policeman moves 0, 1 or 2 crossings, ignoring numbered circles. Policemen can pass each other but not share a crossing. | `game.huntingTheMonster`, `game.twoSteps` |
| 3 Clues and suspicion | Each policeman takes one action on the numbered circles directly connected to his crossing. **Search:** check circles one at a time until one is on Jack's sheet tonight (a clue). **Arrest:** check one circle; if Jack is there, the police win. | `game.cluesAndSuspicion`, `game.searchable`, `game.arrestable` |

After a night, clue markers are removed. Policemen and crime scenes stay.

## The move track

The track has 20 spaces: V, IV, III, II, I, then 1 to 15. The Time of the Crime token starts on I and moves left each time Jack waits. When Jack kills, his pawn starts on that space and moves right one space per move (two for a coach). So killing on I gives him 15 moves, and killing on V gives him 19. In the code, `trackPosition` counts spaces from the left (V is 1, I is 5, 15 is 20).

## Special movements

| Token | Rule | Code |
|---|---|---|
| Coach | Two moves in one, even past policemen. The two circles differ from each other and from the start. Both are on Jack's sheet. Covers two track spaces. | `jack.specialOptions` |
| Alley | From a numbered circle on a block's perimeter to any other on the same perimeter. One track space. | `map.computeAlleys`, `jack.specialOptions` |

## Not implemented

- **Optional rules:** Jack's Letters, False Clues, Rushing, Area Arrests, Catch Me If You Can, and I Know Your Address.
- **Head of the Investigation tiles:** these only decide who places patrols when several people play the police.
- **A human Jack:** the computer always plays Jack.

## Known differences from the physical board

- The map data has 7 yellow-bordered crossings, exactly the number of patrol tokens, so on the first night the police only choose which patrols are fake. If the printed board has more, add `map[id].station = true` for them in `js/map.js`.
