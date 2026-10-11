# 99: simulated mode only. Does the pipeline recover the model the data came from?
# Tucker congruence of each recovered factor with its true factor (matched by the
# target), and the random-intercept variance against the true .10.

source("scripts/analysis/sense_foraging_study1/config.R")
stopifnot(SF1$mode == "simulated")
truth <- readRDS(sf1_path("derived", "simulation_truth.rds"))
P <- readRDS(sf1_path("derived", sprintf("primary_%s_k%02d.rds", SF1$mode, SF1$k_primary)))
std <- standardizedSolution(P$with_ri)
lam <- std[std$op == "=~" & std$lhs %in% P$fnames, ]
L <- matrix(0, 48, length(P$fnames), dimnames = list(rownames(truth$Lambda), P$fnames))
L[cbind(lam$rhs, lam$lhs)] <- lam$est.std
congruence <- diag(psych::factor.congruence(L, truth$Lambda))
est <- parameterEstimates(P$with_ri)
ri <- est[est$lhs == "RI" & est$op == "~~" & est$rhs == "RI", "est"]
res <- data.table(factor = P$fnames, tucker_congruence = round(congruence, 3))
print(res); sf1_log("random-intercept variance: ", round(ri, 3), " (true 0.10 on the latent-response scale before cutting)")
fwrite(rbind(res, data.table(factor = "RI variance", tucker_congruence = round(ri, 3))), sf1_out("99_recovery.csv"))
