var state = new Array();
for (var a = 0; a <= 11; a++ ){
    state[a] = new Array();
}
state[0].title = 'Prepare the scene';
state[0].part = 'Hell';
state[0].description = 'Jack collects the special movement tokens';
state[1].title = 'The targets are identified';
state[1].part = 'Hell';
state[1].description = 'Jack places women tokens facedown on red numbered circles';
state[2].title = 'Patrolling the streets';
state[2].part = 'Hell';
state[2].description = 'The head of the investigation places the police patrol tokens';
state[3].title = 'The victims are chosen';
state[3].part = 'Hell';
state[3].description = 'The women tokens marked red are replaced with wretched pawns';
state[4].title = 'Blood on the streets';
state[4].part = 'Hell';
state[4].description = 'Jack chooses between killing or waiting';
state[5].title = 'Suspense grows';
state[5].part = 'Hell';
state[5].description = 'The time of the crime token is moved, and each wreched pawn moves';
state[6].title = 'Ready to kill';
state[6].part = 'Hell';
state[6].description = 'Jack reveals a police patrol token';
state[7].title = 'A corpse on the sidewalk';
state[7].part = 'Hell';
state[7].description = 'Jack records on his sheet the number of the crime scene';
state[8].title = 'Alarm whistles';
state[8].part = 'Hell';
state[8].description = 'Replace the marked police patrol tokens with the corresponding pawns';
state[9].title = 'Escape in the night';
state[9].part = 'Hunting';
state[9].description = 'Jack moves, records his location, and advances the pawn on the move track';
state[10].title = 'Hunting the monster';
state[10].part = 'Hunting';
state[10].description = 'Each policeman pawn moves';
state[11].title = 'Clues and suspicion';
state[11].part = 'Hunting';
state[11].description = 'Each policeman pawn either looks for clues or executes an arrest';

var nights = [
    { name: 'First night', date: '31 August 1888' },
    { name: 'Second night', date: '8 September 1888' },
    { name: 'Third night', date: '30 September 1888', note: 'The double event' },
    { name: 'Fourth night', date: '9 November 1888' }
];
