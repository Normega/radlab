# 03: how many factors (Section 5, step 2).
#
# Parallel analysis on the polychoric correlations of the keyed items (reverse
# items recoded): principal-axis eigenvalues, 500 random datasets, 95th
# percentile. Then models with k = PA-1, PA, PA+1, the hypothesized 7, and the
# 11-facet alternative are fitted as ordinal EFAs (WLSMV, geomin, lavaan), and
# for each: does every factor have >= 3 items with primary loading >= .40, and
# descriptive fit (CFI, RMSEA, SRMR). The choice is the PI's, by those criteria
# in that order; record it as SF1_K (config.R) with its reason.

source("scripts/analysis/sense_foraging_study1/config.R")
A <- readRDS(sf1_path("derived", sprintf("sf1_%s.rds", SF1$mode)))
K <- A$items_keyed
set.seed(SF1$seed)

R <- polychoric(K, correct = 0)$rho
saveRDS(R, sf1_path("derived", sprintf("polychoric_keyed_%s.rds", SF1$mode)))
pa <- PARALLEL(R, N = nrow(K), n_datasets = 500, percent = 95, eigen_type = "EFA", decision_rule = "percentile")
k_pa <- max(1L, as.integer(pa$n_factors[["EFA"]]))
sf1_log("parallel analysis suggests ", k_pa, " factor(s)")
res <- pa$results[[1]]
fwrite(data.table(factor = res$x, real = round(res$y, 3), random_95 = round(res$references[["95 Percentile"]], 3),
                  random_mean = round(res$references[["Means"]], 3)), sf1_out("03_parallel_analysis.csv"))

ks <- sort(unique(pmax(1, c(k_pa - 1, k_pa, k_pa + 1, 7, 11))))
Kdf <- as.data.frame(K)
fits <- rbindlist(lapply(ks, function(k) {
  sf1_log("ordinal EFA, k = ", k)
  m <- tryCatch(efa(data = Kdf, nfactors = k, ordered = TRUE, estimator = "WLSMV", rotation = "geomin",
                    output = "lavaan"), error = function(e) e)
  if (inherits(m, "error")) return(data.table(k = k, error = conditionMessage(m)))
  L <- inspect(m, "std")$lambda
  prim <- apply(abs(L), 1, which.max); load <- apply(abs(L), 1, max)
  per_factor <- tabulate(prim[load >= .40], nbins = k)
  fm <- fitMeasures(m, c("cfi.scaled", "rmsea.scaled", "srmr"))
  fwrite(data.table(item = rownames(L), round(L, 3)), sf1_out(sprintf("03_efa_k%02d_loadings.csv", k)))
  # A factor made mainly of reverse-keyed items, or one on which positive and
  # (recoded) reversed items load with OPPOSITE signs, is a method factor, not a
  # facet (prereg Section 1, expectation 3). In simulated data with acquiescence,
  # parallel analysis counts it as one extra factor.
  rev <- rownames(L) %in% A$definition$reversed
  method <- rbindlist(lapply(seq_len(k), function(j) {
    on <- abs(L[, j]) >= .30
    data.table(k = k, factor = j, n_items_30 = sum(on), pct_reversed = round(100 * mean(rev[on]), 0),
               opposite_signs = sum(on) > 0 && any(sign(L[on & rev, j]) != sign(median(L[on & !rev, j]))),
               method_suspect = sum(on) > 0 && (mean(rev[on]) >= 2/3 ||
                 (sum(on & rev) >= 3 && sum(on & !rev) >= 3 && all(sign(L[on & rev, j]) != sign(median(L[on & !rev, j]))))))
  }))
  fwrite(method, sf1_out(sprintf("03_efa_k%02d_method_check.csv", k)))
  data.table(k = k, from_pa = k %in% (k_pa + -1:1), hypothesized = k == 7, facets = k == 11,
             method_suspect_factors = sum(method$method_suspect),
             min_items_ge_40 = min(per_factor), factors_with_3plus = sum(per_factor >= 3),
             cfi = round(fm[[1]], 3), rmsea = round(fm[[2]], 3), srmr = round(fm[[3]], 3))
}), fill = TRUE)
fwrite(fits, sf1_out("03_factor_number_models.csv"))
print(fits)
