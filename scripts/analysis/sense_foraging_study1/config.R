# Sense Foraging Study 1: settings shared by every script.
#
# MODE. "permuted" (the default) shuffles every item's answers independently across
# participants before anything structural is computed: each item keeps its own
# distribution, but correlations between items are destroyed, so the code can be
# built and checked without seeing the structure. This is what the OSF
# preregistration (osf.io/48r2y) promises. Set SF1_MODE=real only once the
# registration is approved.
#
# "simulated" replaces the answers with data generated from a KNOWN model (the 7
# hypothesized factors, loadings .55-.75, reverse-keyed items loading negatively,
# factor correlations .3, and a random-intercept acquiescence factor with
# variance .10), cut into 6 categories with the real items' marginal
# proportions. 99_check_recovery.R then compares what the pipeline recovers with
# the truth, to show the code finds structure where structure exists.
#
# DATA. Participant data never live in the repo. They sit in SF1_DATA_DIR
# (default F:/radlab_data/sf_study1, local and unsynced): raw/ holds the
# extraction (extract.sql via the Supabase CLI), derived/ and output/<mode>/ are
# written by these scripts.
#
# Run from the repo root:  Rscript scripts/analysis/sense_foraging_study1/run_all.R

suppressPackageStartupMessages({
  library(jsonlite); library(data.table); library(psych); library(lavaan)
  library(GPArotation); library(EFAtools); library(siren)
})

SF1 <- list(
  mode      = Sys.getenv("SF1_MODE", "permuted"),
  data_dir  = Sys.getenv("SF1_DATA_DIR", "F:/radlab_data/sf_study1"),
  seed      = 20261011,
  # The live questionnaire definition (checked equal to the database): item
  # wording, hypothesized factors, reverse-keyed items, reversal partners.
  definition = "scripts/sense_foraging/study1/sf-pool6.json",
  postings   = c("6acba24833a7d3d37b4120d0" = "general",
                 "6acba90c115a0fa571456332" = "contemplative"),
  # Pre-registered thresholds (Section 5).
  speeder_secs_per_item = 2,
  longstring_flag       = 15,
  inconsistency_flag    = 7,      # of 14 reversal pairs on the same side
  pna_flag              = 9,      # more than 9 of 48 items declined
  near_duplicates = list(c(4, 13), c(16, 18), c(1, 9), c(6, 16), c(5, 10)),
  # Number of content factors in the primary model: set by the decision in
  # 04_factor_number (parallel analysis + criteria), recorded here with its reason.
  k_primary = as.integer(Sys.getenv("SF1_K", "7"))
)
stopifnot(SF1$mode %in% c("permuted", "simulated", "real"))

sf1_path <- function(...) file.path(SF1$data_dir, ...)
sf1_out  <- function(...) {
  d <- sf1_path("output", SF1$mode)
  dir.create(d, recursive = TRUE, showWarnings = FALSE)
  file.path(d, ...)
}
sf1_log <- function(...) cat(sprintf("[%s] ", SF1$mode), ..., "\n", sep = "")

# The definition: items 1-48, factors, keying, partners.
sf1_definition <- function() {
  d <- fromJSON(SF1$definition, simplifyVector = FALSE)
  comps <- unlist(lapply(d$pages, `[[`, "components"), recursive = FALSE)
  text <- setNames(vapply(comps, `[[`, "", "question"), vapply(comps, `[[`, "", "id"))
  factor_of <- unlist(lapply(names(d$factors), function(f) setNames(rep(f, length(d$factors[[f]])), unlist(d$factors[[f]]))))
  rev <- unlist(d$reverse_keyed)
  pairs <- t(vapply(d$interleave$apart_pages, function(p) c(reversed = p[[1]], partner = p[[2]]), c("", "")))
  items <- sprintf("sf6_%d", 1:48)
  list(items = items, text = text[items], factor = factor_of[items], reversed = rev,
       pairs = pairs, factors = names(d$factors))
}
