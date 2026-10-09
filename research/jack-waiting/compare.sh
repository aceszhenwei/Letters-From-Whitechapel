#!/bin/sh
# The focused comparison (docs/jack-waiting.md): each base Jack with and without the waiting policy, 200 paired games
# against each police, on development seeds 550001-550200. Usage: compare.sh [games] [first seed]
cd "$(dirname "$0")/../.."
games=${1:-200}
first=${2:-550001}
for police in v3 v2 original; do
	for jack in jack-v2 jack-v2-waiting strategic strategic-waiting; do
		node research/jack-waiting/experiment.js $jack $police $games $first
	done
done
