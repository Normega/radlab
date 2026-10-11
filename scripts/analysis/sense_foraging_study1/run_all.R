# Runs the Study 1 pipeline in order. From the repo root:
#   SF1_MODE=permuted  Rscript scripts/analysis/sense_foraging_study1/run_all.R   (default)
#   SF1_MODE=simulated ...   then 99_check_recovery.R runs too
#   SF1_MODE=real      ...   only after the OSF registration (osf.io/48r2y) is approved
# SF1_K sets the number of content factors in the primary model (default 7),
# chosen from 03's output by the registered criteria.

source("scripts/analysis/sense_foraging_study1/config.R")
steps <- c("01_prepare", "02_items", "03_factor_number", "04_primary_model", "05_reliability",
           "06_item_selection", "07_known_groups", "08_sensitivity")
if (SF1$mode == "simulated") steps <- c(steps, "99_check_recovery")
for (s in steps) {
  sf1_log("==== ", s)
  source(sprintf("scripts/analysis/sense_foraging_study1/%s.R", s), local = new.env())
}
sf1_log("done; outputs in ", sf1_out(""))
