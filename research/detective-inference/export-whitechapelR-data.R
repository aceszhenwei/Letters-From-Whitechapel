# Exports whitechapelR's board graphs (roads and alleys between numbered circles) to JSON, so they can be compared
# with this project's map. Run from a clone of https://github.com/bmewing/whitechapelR (MIT licence):
#   Rscript export-whitechapelR-data.R <path to whitechapelR clone> <output directory>
args = commandArgs(trailingOnly = TRUE)
library(jsonlite)
load(file.path(args[1], "data", "roads.rda"))
load(file.path(args[1], "data", "alley.rda"))
write_json(unname(as.matrix(roads)), file.path(args[2], "whitechapelR-roads.json"))
write_json(unname(as.matrix(alley)), file.path(args[2], "whitechapelR-alley.json"))
