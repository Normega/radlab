# 08: sensitivity analyses (Section 5, "Exploratory analysis"), each compared with
# the primary solution by Tucker congruence of the content loadings:
#   1. EFA of the 34 positively keyed items only
#   2. the primary model without flagged respondents; separately without the
#      translation-crash group
#   3. acquiescence-corrected EFA, Lorenzo-Seva & Ferrando (siren::acquiextraction)
#   4. the primary model without the random-intercept factor
# Plus, exploratory: does an item's presented position shift its answers?

source("scripts/analysis/sense_foraging_study1/config.R")
source("scripts/analysis/sense_foraging_study1/sf1_models.R")
A <- readRDS(sf1_path("derived", sprintf("sf1_%s.rds", SF1$mode)))
def <- A$definition; k <- SF1$k_primary
P <- readRDS(sf1_path("derived", sprintf("primary_%s_k%02d.rds", SF1$mode, k)))
L0 <- sf1_loadings(P$with_ri, P$fnames)[def$items, ]
L0k <- L0; L0k[def$reversed, ] <- -L0k[def$reversed, ]     # keyed direction, to compare with keyed solutions
out <- list()

pos <- setdiff(def$items, def$reversed)
sf1_log("1. positive items only")
m1 <- efa(data = as.data.frame(A$items_keyed[, pos]), nfactors = k, ordered = TRUE, estimator = "WLSMV",
          rotation = "geomin", output = "lavaan")
out$positive_only <- sf1_congruence(L0k[pos, ], inspect(m1, "std")$lambda)

for (which in c("flagged", "translation")) {
  keep <- if (which == "flagged") !A$meta$flagged else !A$meta$flag_translation
  sf1_log("2. without ", which, " respondents (n = ", sum(keep), ")")
  m2 <- sf1_fit_esem(A$items_raw[keep, ], P$member, TRUE)
  out[[paste0("without_", which)]] <- sf1_congruence(L0, sf1_loadings(m2, P$fnames)[def$items, ])
}

sf1_log("3. siren acquiescence-corrected EFA")
s3 <- tryCatch(siren::acquiextraction(as.data.frame(A$items_raw), n_factors = k, corr = "Polychoric", raw_data = TRUE),
               error = function(e) e)
if (!inherits(s3, "error")) {
  # acquiextraction returns the inter-item correlations with the acquiescence
  # factor partialled out (Res); the content factors are then extracted from it.
  f3 <- psych::fa(s3$Res, nfactors = k, n.obs = nrow(A$items_raw), fm = "minres", rotate = "oblimin")
  Ls <- unclass(f3$loadings); rownames(Ls) <- def$items
  out$siren <- sf1_congruence(L0, Ls)
  sf1_log("siren acquiescence variance: ", round(s3$AQ_var, 3))
} else sf1_log("siren failed: ", conditionMessage(s3))

out$without_random_intercept <- sf1_congruence(L0, sf1_loadings(P$without_ri, P$fnames)[def$items, ])

res <- rbindlist(out, idcol = "analysis")
fwrite(res, sf1_out(sprintf("08_sensitivity_k%02d.csv", k)))
print(dcast(res, factor ~ analysis, value.var = "congruence"))

# Position effects (exploratory): per item, the correlation of the answer with
# the position it was shown at; positions were randomized, so a reliable trend is
# an order effect.
pe <- data.table(item = def$items, r_position = round(vapply(def$items, function(i)
  suppressWarnings(cor(A$items_keyed[, i], A$positions[, i], use = "complete.obs", method = "spearman")), 0), 3))
fwrite(pe, sf1_out("08_position_effects.csv"))
sf1_log("position effects: median |r| = ", round(median(abs(pe$r_position), na.rm = TRUE), 3))
