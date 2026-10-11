# 06: the short-form proposal (Section 5, step 5). A PROPOSAL for the PI, who
# makes the final selection by these criteria and reports every departure.
#
# Per item, from the primary model (with random intercept; loadings of reverse-
# keyed items sign-flipped so "higher = more of the construct"):
#   eligible  primary loading >= .40, no secondary >= .30, primary - secondary >= .20,
#             "Prefer not to answer" <= 5%
#   preferred primary >= .50
#   at most one item of each near-duplicate pair (the stronger one)
# Per factor: the 3-4 strongest eligible items (target 21-28 items overall).
# Reverse-keyed pairs (4-6 to keep): polychoric r(reversed, partner) <= -.30 on raw
# items AND the reversed item's primary loading >= .40 on its partner's factor.

source("scripts/analysis/sense_foraging_study1/config.R")
A <- readRDS(sf1_path("derived", sprintf("sf1_%s.rds", SF1$mode)))
def <- A$definition; k <- SF1$k_primary
P <- readRDS(sf1_path("derived", sprintf("primary_%s_k%02d.rds", SF1$mode, k)))
source("scripts/analysis/sense_foraging_study1/sf1_models.R")
L <- sf1_loadings(P$with_ri, P$fnames)[def$items, ]
L[def$reversed, ] <- -L[def$reversed, ]
orient <- sf1_orientation(L); L <- sweep(L, 2, orient, `*`)
fwrite(data.table(factor = colnames(L), orientation = orient), sf1_out(sprintf("06_factor_orientation_k%02d.csv", k)))
desc <- fread(sf1_out("02_item_descriptives.csv"))

tab <- data.table(item = def$items, n = as.integer(sub("sf6_", "", def$items)),
                  keying = ifelse(def$items %in% def$reversed, "reverse", "positive"),
                  hypothesized = def$factor, text = def$text)
tab[, primary_factor := colnames(L)[apply(abs(L), 1, which.max)]]
tab[, primary := round(L[cbind(item, primary_factor)], 3)]
tab[, secondary := round(apply(abs(L), 1, function(r) sort(r, decreasing = TRUE)[2]), 3)]
tab[, `:=`(gap = round(primary - secondary, 3), missing_pct = desc$missing_pct[match(item, desc$item)])]
tab[, eligible := primary >= .40 & secondary < .30 & gap >= .20 & missing_pct <= 5]
tab[, preferred := eligible & primary >= .50]
for (p in SF1$near_duplicates) {
  ids <- sprintf("sf6_%d", p); both <- tab[item %in% ids & eligible == TRUE]
  if (nrow(both) == 2) tab[item == both[which.min(primary), item], `:=`(eligible = FALSE, note = paste0("near-duplicate of ", paste(p, collapse = "-")))]
}
setorder(tab, primary_factor, -eligible, -primary)
tab[, rank_in_factor := seq_len(.N), by = primary_factor]
tab[, proposed := eligible & rank_in_factor <= 4]

X <- A$items_raw
pairs <- rbindlist(lapply(seq_len(nrow(def$pairs)), function(i) {
  rv <- def$pairs[i, "reversed"]; pt <- def$pairs[i, "partner"]
  r <- psych::polychoric(X[, c(rv, pt)], correct = 0)$rho[1, 2]
  pf <- tab[item == pt, primary_factor]
  data.table(reversed = rv, partner = pt, polychoric_r = round(r, 3),
             reversed_loading_on_partner_factor = round(L[rv, pf], 3), partner_factor = pf)
}))
pairs[, qualifies := polychoric_r <= -.30 & reversed_loading_on_partner_factor >= .40]
setorder(pairs, -qualifies, polychoric_r)
pairs[, proposed := qualifies & seq_len(.N) <= 6]

fwrite(tab, sf1_out(sprintf("06_item_selection_k%02d.csv", k)))
fwrite(pairs, sf1_out(sprintf("06_reversal_pairs_k%02d.csv", k)))
short <- unique(c(tab[proposed == TRUE, item], unlist(pairs[proposed == TRUE, .(reversed, partner)])))
# Ordinal alpha and omega (total) of each proposed subscale, from the polychoric
# matrix of keyed items: descriptive, for the PI's decision.
Rk <- psych::polychoric(A$items_keyed, correct = 0)$rho
sub <- rbindlist(lapply(colnames(L), function(f) {
  ids <- intersect(short, tab[primary_factor == f, item])
  if (length(ids) < 2) return(data.table(factor = f, n_items = length(ids)))
  Rs <- Rk[ids, ids]
  a <- psych::alpha(Rs, warnings = FALSE)$total$raw_alpha
  o <- if (length(ids) >= 3) suppressWarnings(psych::omega(Rs, nfactors = 1, plot = FALSE)$omega.tot) else NA
  data.table(factor = f, n_items = length(ids), items = paste(sub("sf6_", "", ids), collapse = " "),
             ordinal_alpha = round(a, 3), ordinal_omega = round(o, 3))
}), fill = TRUE)
fwrite(sub, sf1_out(sprintf("06_short_form_reliability_k%02d.csv", k)))
print(sub)
sf1_log("proposed short form: ", length(short), " items (", sum(tab$proposed), " by loading + pairs); ",
        sum(pairs$qualifies), " of 14 reversal pairs qualify")
print(tab[proposed == TRUE, .N, by = primary_factor])
