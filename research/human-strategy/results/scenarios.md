# Scenario checks of the BGG tactical claims

All numbers are the printed circle numbers. Crossings are named by the circles next to them (e.g. 29/30/50).

## Board facts quoted in the threads

- Walking neighbours per circle (Andrea Bampi: "minimum 2 (81 & 61) ... maximum 15 (space 125) ... average ... near 8"): minimum 2 at 61, 81; maximum 15 at 125, 159; mean 7.95.
- The area grey_wolf calls "dreadful for Jack" (70, 71, 72, 87, 88): 70 has 4, 71 has 5, 72 has 6, 87 has 4, 88 has 5 walking neighbours (map mean 7.9).
- Circles one walk from two red circles (Andrea Bampi: "from three, 51, 66, 67"): 51, 66, 67, each next to 65, 84.
- "Catch me if you can" (no hideout on or next to a red circle; Pieter: "excludes about a quarter"): excludes 49 of 187 legal hideouts (26%).

## "An almost perfect winning scheme for Jack" (grey_wolf, 2 June 2011)

Hideout 51. Each night as posted, checked against the rules with no policemen in the way:

| Night | Crime scene(s) | Route | Legal on the empty board? | Moves | Coaches used (of held) |
|---|---|---|---|---:|---|
| 1 | 27 | 27 → coach (29, 66) → 51 | Yes | 3 | 1 of 3 |
| 2 | 149 | 149 → 148 → 114 → 96 → coach (78, 80) → coach (82, 65) → 51 | Yes | 8 | 2 of 2 |
| 3 | 3 and 84 | 84 → 51 | Yes | 1 | 0 of 2 |
| 4 | 65 | 65 → 51 | Yes | 1 | 0 of 1 |

In the revised rules this engine implements, a single-victim night starts with Jack's move and the police move only after it; on the double event the police move first (rules: "the second crime scene uses his first move"). So:
- Night 4 (kill at 65, walk to 51): the night ends on Jack's first move; the policemen never move. Only a policeman already standing where the walk passes, from the end of night 3, can stop it.
- Night 3 (kill at 3 and 84, walk to 51): the police get one turn before Jack's walk.
- Night 1 (coach, then walk): the police get one turn, after the coach.

**Night 1 counters.** The coach passes the station 29/30/50 legally (Coach: "can move through crossings containing Policeman pawns", rules page 12, quoted by grey_wolf; `rules.canUseCarriage`). After it the police have one turn:
- A policeman on 29/30/50 can search 29 without moving (it is next to 29): a clue there shows a route through 29.
- Pokey 64's counter ("moved my investigator from the yellow crossing near 30 two crossings south and arrested you at 66"): the crossings next to 66 are 65/66, 64/66; from 29/30/50 a policeman can reach 64/66 in one turn. So the arrest at 66 is possible.
- Georgios P.'s reading ("five possible spots Jack could have tried to reach when moving past 29. Namely: 30, 49, 50, 64 and 66"): coach destinations from 27 by way of 29 are 28, 30, 45, 46, 47, 48, 49, 50, 64, 66; of these, the ones a walk from 29 could not reach past a policeman on 29/30/50 (so the coach was needed to pass him) are 30, 49, 50, 64, 66.

**The proposed standing counter** (Andrea Bampi: "positioning a bobby on the crossing adjacent to 65 and 66 ... increases BY TWO the minimum distance between two red circles"). That crossing is 65/66. With a policeman on it:
- 51 can walk only to 31, 50, 52, 67 (without him: 31, 50, 52, 65, 66, 67, 84): 65 and 84 are no longer one walk from 51; walking distances 51→65 4, 51→84 5 (without him: 1 and 1). The same holds for 66 and 67: 66: 65 at 3, 84 at 5, 67: 65 at 5, 84 at 4.
- The shortest walk between two red circles goes from 1 to 3 (the claim "BY TWO" holds).
- The routes of that length (the forum lists "65-(83-99)-84 65-(83-100)-84 3-(2-28)-27 3-(2-26)-27"): 3-2-26-27, 3-2-28-27, 3-9-26-27, 3-9-28-27; 27-48-63-65; 65-83-99-84, 65-83-100-84.

**"An exhaustive enumeration of ALL the spaces that can be reached by a coach and another step"** from 27 (grey_wolf, 13 June 2011; 55 spaces): this map gives 55. In the post but not here: none. Here but not in the post: none.

## "Near perfect play for Jack at 134" (ketigid, 4 June 2011)

Hideout 134, the Wretched placed on 147 every night. 147 walks to 111, 133, 134, 146 (the post: "111, 133, 134 or 146"). From each, Jack's walking distance to 134: 111: 1, 133: 1, 134: 0, 146: 2; from 147 itself: 1.
- "The yellow crossing near 130 is an important initial position": that station is 130/145. In one police turn a policeman there reaches the crossings next to 146 of the scheme's circles (111, 133, 134, 146, 147).
- The walk 147 → 134 passes the crossing(s) 111/134/147. A policeman standing there at the start of night 4 (he stays from night 3) stops the one-move escape: then 147 → 134 takes 2 walks.
- Jason Lindahl's counter "why would a cop ever go anywhere besides the intersection of 131 and 146": crossings next to both 131 and 146 are 131/146.
- Pas L's counter (move the Wretched away: 147 → 146 → 131 → 106 → 105): legal steps for a Wretched with no patrols near: 147→146 yes, 146→131 yes, 131→106 yes, 106→105 yes; Jack's walking distance home from each: 146: 2, 131: 1, 106: 1, 105: 2.
- Rules as implemented: a Wretched killed on the hideout doesn't end the night (Jack must move off and walk back on: `rules.escapes` needs a walk onto the hideout, and `board.walk` never returns the start), as the FAQ Pieter cites says. Women may not be placed on earlier crime scenes, but 147 itself is only a crime scene once the Wretched is killed there, so the scheme's repeated placement on 147 is legal (`rules.targetCircles`).

## "Winning strategy for Jack? Is this game broken?" (mark_xiii, 9 September 2012)

"Place his hideout right next to two of the crime scenes in the center area of the map (numbers 66, 51, 67 - possibly 82, 63, 83 etc. with 2 moves to the second crime scene)":
- 66: red circles at walking distance 27 (2), 65 (1), 84 (1).
- 51: red circles at walking distance 65 (1), 84 (1).
- 67: red circles at walking distance 65 (1), 84 (1).
- 82: red circles at walking distance 65 (1), 84 (2).
- 63: red circles at walking distance 27 (2), 65 (1), 84 (2).
- 83: red circles at walking distance 65 (1), 84 (2).

## Cordons (grey_wolf, 15 June 2011; Andrea Bampi)

"There are potential hideouts that can be cordoned off using merely two patrols, there are those requiring three and four ..., and there are those that have as many as five (tricky to find)". Crossings next to each legal hideout (policemen needed to close every walk onto it at close quarters): 2 crossings: 139 hideouts; 3 crossings: 38 hideouts; 4 crossings: 9 hideouts; 5 crossings: 1 hideouts. With five: 185.
- Andrea Bampi: "175 & 188 may be cordoned as a subgraph by just two patrols". 175 and 188 are one walk apart; the fewest policemen, on any crossings a walk out of the pair passes, that stop every such walk: 2 (crossing 245 (by 188), 164/174).

