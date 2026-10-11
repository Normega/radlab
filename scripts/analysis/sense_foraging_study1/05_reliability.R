# 05: reliability (Section 5, step 4): ordinal omega for each factor (group
# omega from the bifactor decomposition of the polychoric matrix of keyed items)
# and hierarchical omega for the pool. Short-form reliability is in 06.

source("scripts/analysis/sense_foraging_study1/config.R")
A <- readRDS(sf1_path("derived", sprintf("sf1_%s.rds", SF1$mode)))
R <- readRDS(sf1_path("derived", sprintf("polychoric_keyed_%s.rds", SF1$mode)))
k <- SF1$k_primary

om <- psych::omega(R, nfactors = k, n.obs = nrow(A$items_keyed), fm = "minres", plot = FALSE)
groups <- data.table(factor = colnames(om$omega.group) , t(round(om$omega.group, 3)))
res <- data.table(statistic = c("omega_hierarchical", "omega_total", "alpha"),
                  value = round(c(om$omega_h, om$omega.tot, om$alpha), 3))
fwrite(res, sf1_out(sprintf("05_omega_pool_k%02d.csv", k)))
fwrite(as.data.table(round(om$omega.group, 3), keep.rownames = "factor"), sf1_out(sprintf("05_omega_groups_k%02d.csv", k)))
print(res)
