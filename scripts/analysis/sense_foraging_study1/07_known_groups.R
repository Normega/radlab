# 07: known groups (Section 5, step 6; exploratory). Current practitioners
# (regular practice, at least weekly now) vs never-practitioners on factor scores
# from the primary model; linear models with posting as a covariate; Holm
# correction across factors; standardized differences. Posting differences are
# reported descriptively.

source("scripts/analysis/sense_foraging_study1/config.R")
A <- readRDS(sf1_path("derived", sprintf("sf1_%s.rds", SF1$mode)))
k <- SF1$k_primary
P <- readRDS(sf1_path("derived", sprintf("primary_%s_k%02d.rds", SF1$mode, k)))
source("scripts/analysis/sense_foraging_study1/sf1_models.R")
FS <- as.data.table(lavPredict(P$with_ri))[, P$fnames, with = FALSE]
Lk <- sf1_loadings(P$with_ri, P$fnames)[A$definition$items, ]
Lk[A$definition$reversed, ] <- -Lk[A$definition$reversed, ]
orient <- sf1_orientation(Lk)
for (j in seq_along(P$fnames)) set(FS, j = P$fnames[j], value = FS[[P$fnames[j]]] * orient[j])
d <- cbind(A$meta[, .(participant, practice_group, posting)], FS)

kg <- rbindlist(lapply(P$fnames, function(f) {
  dd <- d[practice_group %in% c("current", "never")]
  dd[, current := as.integer(practice_group == "current")]
  m <- lm(reformulate(c("current", "posting"), f), data = dd)
  s <- summary(m)$coefficients["current", ]
  sdp <- sqrt(mean(tapply(dd[[f]], dd$current, var)))
  data.table(factor = f, n_current = sum(dd$current), n_never = sum(!dd$current),
             diff = round(s[["Estimate"]], 3), d = round(s[["Estimate"]] / sdp, 2), p = s[["Pr(>|t|)"]])
}))
kg[, p_holm := signif(p.adjust(p, "holm"), 3)][, p := signif(p, 3)]
post <- d[, lapply(.SD, function(v) round(mean(v), 3)), by = posting, .SDcols = P$fnames]
fwrite(kg, sf1_out(sprintf("07_known_groups_k%02d.csv", k)))
fwrite(post, sf1_out(sprintf("07_posting_means_k%02d.csv", k)))
print(kg)
