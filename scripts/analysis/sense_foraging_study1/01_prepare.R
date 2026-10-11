# 01: from the raw extraction to one analysis row per participant.
#
# Pre-registered rules applied here (Section 5, "Data exclusion"):
#   excluded  - sessions without a submitted scale; failing BOTH attention checks
#   first     - each questionnaire's first complete submission is used
#   flagged   - one check failed; < 2 s per item; longstring >= 15;
#               inconsistency >= 7 of 14 pairs; > 9 items declined; a recorded
#               translation crash (the browser was machine-translating the page)
# In permuted mode the item columns are shuffled BEFORE any item-derived index
# (longstring, inconsistency) is computed, so nothing structural leaks.

source("scripts/analysis/sense_foraging_study1/config.R")
`%||%` <- function(a, b) if (is.null(a) || length(a) == 0) b else a
def <- sf1_definition()

raw_file <- tail(sort(list.files(sf1_path("raw"), "^extract_.*\\.json$", full.names = TRUE)), 1)
stopifnot(length(raw_file) == 1)
rows <- fromJSON(raw_file, simplifyVector = FALSE)$rows
sf1_log("extraction: ", basename(raw_file), ", ", length(rows), " rows")

num <- function(v) if (is.null(v) || is.list(v) || identical(v, "pna") || identical(v, "not_applicable")) NA_real_ else as.numeric(v)
opt <- function(v) if (is.list(v) && !is.null(v$option_id)) v$option_id else if (is.character(v)) v else NA_character_

by_person <- split(rows, vapply(rows, `[[`, "", "participant"))
recs <- lapply(by_person, function(rs) {
  p <- rs[[1]]
  crashes <- sum(vapply(rs, function(r) as.numeric(r$step_crashes %||% 0), 0))
  pick <- function(slug, need) {
    cand <- Filter(function(r) identical(r$slug, slug) && is.null(r$resubmission_of) &&
                     all(need %in% names(r$responses)), rs)
    if (!length(cand)) return(NULL)
    cand[[order(vapply(cand, `[[`, "", "received_at"))[1]]]
  }
  scale <- pick("sf-pool6", c(def$items, "sf6_attn_disagree", "sf6_attn_agree"))
  bg <- pick("sf-background", "bg_practice_regular")
  n_scale_subs <- sum(vapply(rs, function(r) identical(r$slug, "sf-pool6"), TRUE))
  n_bg_subs <- sum(vapply(rs, function(r) identical(r$slug, "sf-background"), TRUE))
  out <- list(participant = p$participant,
              posting = unname(SF1$postings[p$prolific_study_id %||% ""]) %||% NA_character_,
              repository_consent = isTRUE(p$repository_consent),
              session_status = p$session_status, crashes = crashes,
              n_scale_submissions = n_scale_subs, n_background_submissions = n_bg_subs,
              has_scale = !is.null(scale))
  if (!is.null(bg)) {
    b <- bg$responses
    out$practice_regular <- opt(b$bg_practice_regular)
    out$practice_freq <- opt(b$bg_practice_freq)
    out$practice_training <- opt(b$bg_practice_training)
    out$age <- if (is.list(b$bg_age)) num(b$bg_age$value) else NA_real_
    out$gender <- opt(b$bg_gender)
    out$education <- opt(b$bg_education)
    out$country <- opt(b$bg_country)
  }
  if (!is.null(scale)) {
    s <- scale$responses
    out$items <- vapply(def$items, function(i) num(s[[i]]), 0)
    out$pna <- sum(vapply(def$items, function(i) identical(s[[i]], "pna"), TRUE))
    out$attn_disagree <- num(s$sf6_attn_disagree)
    out$attn_agree <- num(s$sf6_attn_agree)
    out$positions <- vapply(def$items, function(i) as.numeric(s[["_order"]]$positions[[i]] %||% NA), 0)
    out$order_method <- s[["_order"]]$method %||% NA_character_
    out$scale_secs <- as.numeric(s[["_timing"]]$total_ms %||% NA) / 1000
    out$format <- scale$presentation_format %||% NA_character_
  }
  out
})
meta <- rbindlist(lapply(recs, function(r) r[setdiff(names(r), c("items", "positions"))]), fill = TRUE)
flow <- data.table(step = "enrolled (consented, not staff tests)", n = nrow(meta))
flow <- rbind(flow, data.table(step = "submitted the scale", n = sum(meta$has_scale)))

with_scale <- recs[vapply(recs, `[[`, TRUE, "has_scale")]
X <- do.call(rbind, lapply(with_scale, `[[`, "items"))          # unrecoded, 1-6 / NA
POS <- do.call(rbind, lapply(with_scale, `[[`, "positions"))
M <- meta[has_scale == TRUE]
stopifnot(identical(rownames(X), M$participant) || is.null(rownames(X)))
rownames(X) <- rownames(POS) <- M$participant

M[, checks_failed := (attn_disagree != 2 | is.na(attn_disagree)) + (attn_agree != 5 | is.na(attn_agree))]
M[, excluded_attention := checks_failed == 2]
flow <- rbind(flow, data.table(step = "excluded: failed both attention checks", n = sum(M$excluded_attention)))

if (SF1$mode == "simulated") {
  set.seed(SF1$seed)
  n <- nrow(X); k <- length(def$factors)
  Phi <- matrix(.3, k, k); diag(Phi) <- 1
  Lambda <- matrix(0, 48, k, dimnames = list(def$items, def$factors))
  for (j in seq_len(48)) Lambda[j, def$factor[j]] <- runif(1, .55, .75) * ifelse(def$items[j] %in% def$reversed, -1, 1)
  eta <- MASS::mvrnorm(n, rep(0, k), Phi)
  acq <- rnorm(n, 0, sqrt(.10))
  uniq <- sqrt(pmax(.05, 1 - rowSums((Lambda %*% Phi) * Lambda)))
  Y <- eta %*% t(Lambda) + acq + sweep(matrix(rnorm(n * 48), n), 2, uniq, `*`)
  # Cut each item at its real marginal proportions, so distributions match.
  for (j in seq_len(48)) {
    p <- cumsum(tabulate(X[, j], nbins = 6)) / sum(!is.na(X[, j]))
    X[, j] <- findInterval(Y[, j], quantile(Y[, j], p[1:5])) + 1
  }
  saveRDS(list(Lambda = Lambda, Phi = Phi, acq_var = .10), sf1_path("derived", "simulation_truth.rds"))
  sf1_log("answers replaced by data simulated from the known 7-factor + acquiescence model")
}
if (SF1$mode == "permuted") {
  set.seed(SF1$seed)
  X[] <- apply(X, 2, sample)
  sf1_log("item columns permuted independently (structure destroyed by design)")
}

# Item-derived quality indices, computed on whichever matrix is in use.
longstring <- vapply(seq_len(nrow(X)), function(i) {
  v <- X[i, order(POS[i, ])]
  r <- rle(ifelse(is.na(v), -1, v)); max(r$lengths[r$values != -1], 0)
}, 0)
same_side <- function(a, b) (a >= 4 & b >= 4) | (a <= 3 & b <= 3)
pairs <- def$pairs
inconsistency <- rowSums(sapply(seq_len(nrow(pairs)), function(k)
  same_side(X[, pairs[k, "reversed"]], X[, pairs[k, "partner"]])), na.rm = TRUE)
M[, `:=`(longstring = longstring, inconsistency = inconsistency, secs_per_item = scale_secs / 50)]
M[, `:=`(flag_one_check = checks_failed == 1,
         flag_speeder = !is.na(secs_per_item) & secs_per_item < SF1$speeder_secs_per_item,
         flag_longstring = longstring >= SF1$longstring_flag,
         flag_inconsistent = inconsistency >= SF1$inconsistency_flag,
         flag_pna = pna > SF1$pna_flag,
         flag_translation = crashes > 0)]
M[, flagged := flag_one_check | flag_speeder | flag_longstring | flag_inconsistent | flag_pna]
M[, practice_group := fifelse(practice_regular == "no", "never",
                       fifelse(practice_regular == "yes" & practice_freq %in% c("1_2_week", "3_5_week", "daily"), "current",
                       fifelse(practice_regular == "yes", "past_or_occasional", NA_character_)))]

keep <- !M$excluded_attention
analysis <- list(
  mode = SF1$mode, extraction = basename(raw_file), definition = def,
  items_raw = X[keep, , drop = FALSE],                         # unrecoded (for random-intercept models)
  items_keyed = { K <- X[keep, , drop = FALSE]; K[, def$reversed] <- 7 - K[, def$reversed]; K },
  positions = POS[keep, , drop = FALSE], meta = M[keep], meta_all = M, flow = flow)
flow <- rbind(flow, data.table(step = "analysable", n = sum(keep)))
analysis$flow <- flow

dir.create(sf1_path("derived"), showWarnings = FALSE)
saveRDS(analysis, sf1_path("derived", sprintf("sf1_%s.rds", SF1$mode)))
fwrite(flow, sf1_out("01_flow.csv"))
flags <- M[, .(n = .N, one_check = sum(flag_one_check), speeder = sum(flag_speeder), longstring = sum(flag_longstring),
               inconsistent = sum(flag_inconsistent), pna_over_9 = sum(flag_pna), translation_crash = sum(flag_translation),
               any_flag = sum(flagged)), by = .(excluded_attention)]
fwrite(flags, sf1_out("01_flags.csv"))
print(flow); print(flags)
