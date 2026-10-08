/* Content: the words for each phase and night (no behaviour).
   Phase numbers are the ones the engine uses in state.phase. */
var WC = WC || {};

WC.content = (function () {

var phases = new Array();
for (var a = 0; a <= 11; a++ ){
    phases[a] = {};
}
phases[0].title = 'Prepare the scene';
phases[0].part = 'Hell';
phases[0].description = 'Jack collects the special movement tokens';
phases[1].title = 'The targets are identified';
phases[1].part = 'Hell';
phases[1].description = 'Jack places women tokens facedown on red numbered circles';
phases[2].title = 'Patrolling the streets';
phases[2].part = 'Hell';
phases[2].description = 'The head of the investigation places the police patrol tokens';
phases[3].title = 'The victims are chosen';
phases[3].part = 'Hell';
phases[3].description = 'The women tokens marked red are replaced with wretched pawns';
phases[4].title = 'Blood on the streets';
phases[4].part = 'Hell';
phases[4].description = 'Jack chooses between killing or waiting';
phases[5].title = 'Suspense grows';
phases[5].part = 'Hell';
phases[5].description = 'The time of the crime token is moved, and each wreched pawn moves';
phases[6].title = 'Ready to kill';
phases[6].part = 'Hell';
phases[6].description = 'Jack reveals a police patrol token';
phases[7].title = 'A corpse on the sidewalk';
phases[7].part = 'Hell';
phases[7].description = 'Jack records on his sheet the number of the crime scene';
phases[8].title = 'Alarm whistles';
phases[8].part = 'Hell';
phases[8].description = 'Replace the marked police patrol tokens with the corresponding pawns';
phases[9].title = 'Escape in the night';
phases[9].part = 'Hunting';
phases[9].description = 'Jack moves, records his location, and advances the pawn on the move track';
phases[10].title = 'Hunting the monster';
phases[10].part = 'Hunting';
phases[10].description = 'Each policeman pawn moves';
phases[11].title = 'Clues and suspicion';
phases[11].part = 'Hunting';
phases[11].description = 'Each policeman pawn either looks for clues or executes an arrest';

var nights = [
    { name: 'First night', date: '31 August 1888' },
    { name: 'Second night', date: '8 September 1888' },
    { name: 'Third night', date: '30 September 1888', note: 'The double event' },
    { name: 'Fourth night', date: '9 November 1888' }
];

return { phases: phases, nights: nights };

})();
