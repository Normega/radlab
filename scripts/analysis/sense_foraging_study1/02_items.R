# 02: item pre-checks (Section 5, step 1): distributions, floor and ceiling,
# "Prefer not to answer" rates, and the near-duplicate pairs' polychoric
# correlations, screened before any acquiescence model (an acquiescence factor
# can absorb doublets). Distributions are the same in both modes; correlations
# carry information only in real mode.

source("scripts/analysis/sense_foraging_study1/config.R")
A <- readRDS(sf1_path("derived", sprintf("sf1_%s.rds", SF1$mode)))
def <- A$definition; X <- A$items_raw

desc <- data.table(item = def$items, n = colSums(!is.na(X)),
                   keying = ifelse(def$items %in% def$reversed, "reverse", "positive"),
                   factor = def$factor, text = def$text)
for (k in 1:6) desc[[paste0("pct_", k)]] <- round(100 * colMeans(X == k, na.rm = TRUE), 1)
desc[, `:=`(mean = round(colMeans(X, na.rm = TRUE), 2), sd = round(apply(X, 2, sd, na.rm = TRUE), 2),
            missing_pct = round(100 * colMeans(is.na(X)), 1))]
desc[, `:=`(floor_pct = pct_1, ceiling_pct = pct_6, flag_missing_over_5pct = missing_pct > 5)]
fwrite(desc, sf1_out("02_item_descriptives.csv"))

nd <- rbindlist(lapply(SF1$near_duplicates, function(p) {
  a <- sprintf("sf6_%d", p[1]); b <- sprintf("sf6_%d", p[2])
  r <- polychoric(X[, c(a, b)], correct = 0)$rho[1, 2]
  data.table(pair = paste(p, collapse = "-"), polychoric_r = round(r, 3))
}))
fwrite(nd, sf1_out("02_near_duplicates.csv"))

sf1_log("items: missing > 5% on ", sum(desc$flag_missing_over_5pct), "; floor/ceiling > 25% on ",
        sum(desc$floor_pct > 25 | desc$ceiling_pct > 25), " items")
print(nd)
