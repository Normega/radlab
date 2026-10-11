# 04: the primary model (Section 5, step 3).
#
# ESEM on all 48 UNRECODED items (WLSMV, ordered): SF1$k_primary correlated
# content factors, oblique, partially specified target rotation toward the
# hypothesized factor membership (non-member loadings targeted to 0, members left
# free), plus a random-intercept acquiescence factor: loadings fixed to 1 on every
# item, variance free, uncorrelated with the content factors (Maydeu-Olivares &
# Coffman 2006; Aichholzer 2014). The same model without the random intercept is
# fitted alongside (sensitivity 4).
#
# Factor labels: when k_primary == 7, factor j is the hypothesized factor j. For
# any other k the target is built from the k-factor geomin EFA in 03 (each item to
# its primary factor), and factors are named F1..Fk.

source("scripts/analysis/sense_foraging_study1/config.R")
A <- readRDS(sf1_path("derived", sprintf("sf1_%s.rds", SF1$mode)))
def <- A$definition; X <- as.data.frame(A$items_raw); items <- def$items
k <- SF1$k_primary

source("scripts/analysis/sense_foraging_study1/sf1_models.R")
member <- sf1_membership(def, k); fnames <- colnames(member)
fit_esem <- function(with_ri) sf1_fit_esem(X, member, with_ri)

sf1_log("ESEM with random intercept, k = ", k)
m_ri <- fit_esem(TRUE)
sf1_log("ESEM without random intercept, k = ", k)
m_no <- fit_esem(FALSE)
saveRDS(list(with_ri = m_ri, without_ri = m_no, member = member, fnames = fnames),
        sf1_path("derived", sprintf("primary_%s_k%02d.rds", SF1$mode, k)))

summarise <- function(m, label) {
  fm <- fitMeasures(m, c("chisq.scaled", "df", "cfi.scaled", "tli.scaled", "rmsea.scaled", "srmr"))
  data.table(model = label, t(round(fm, 3)))
}
fit_tab <- rbind(summarise(m_ri, "ESEM + random intercept"), summarise(m_no, "ESEM, no random intercept"))
pe <- parameterEstimates(m_ri, standardized = TRUE)
ri_var <- pe[pe$lhs == "RI" & pe$op == "~~" & pe$rhs == "RI", c("est", "se", "pvalue", "std.all")]
fit_tab[, ri_variance := c(sprintf("%.3f (SE %.3f, p %.3g)", ri_var$est, ri_var$se, ri_var$pvalue), NA)]
fwrite(fit_tab, sf1_out(sprintf("04_primary_fit_k%02d.csv", k)))

std <- standardizedSolution(m_ri)
lam <- std[std$op == "=~" & std$lhs %in% fnames, c("lhs", "rhs", "est.std")]
Lw <- dcast(as.data.table(lam), rhs ~ lhs, value.var = "est.std")
setnames(Lw, "rhs", "item"); Lw <- Lw[match(items, item)]
ri_load <- std[std$op == "=~" & std$lhs == "RI", c("rhs", "est.std")]
Lw[, `:=`(RI_std = round(ri_load$est.std[match(item, ri_load$rhs)], 3),
          hypothesized = def$factor, keying = ifelse(item %in% def$reversed, "reverse", "positive"))]
fwrite(Lw[, lapply(.SD, function(v) if (is.numeric(v)) round(v, 3) else v)], sf1_out(sprintf("04_primary_loadings_k%02d.csv", k)))
phi <- lavInspect(m_ri, "std")$psi[fnames, fnames]
fwrite(data.table(factor = fnames, round(phi, 3)), sf1_out(sprintf("04_primary_factor_correlations_k%02d.csv", k)))
print(fit_tab)
