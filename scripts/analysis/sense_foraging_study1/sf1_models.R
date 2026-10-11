# Model helpers shared by 04 (primary) and 08 (sensitivity), so a refit on a
# subset is the identical model.

# Target membership for k factors: the hypothesized factors when k == 7, else
# each item's primary factor in the k-factor EFA from 03.
sf1_membership <- function(def, k) {
  if (k == length(def$factors)) {
    m <- outer(def$factor, def$factors, `==`); fn <- make.names(def$factors)
  } else {
    L <- as.matrix(fread(sf1_out(sprintf("03_efa_k%02d_loadings.csv", k)))[, -1])
    fn <- paste0("F", seq_len(k)); m <- t(apply(abs(L), 1, function(r) seq_len(k) == which.max(r)))
  }
  dimnames(m) <- list(def$items, fn); m
}

# ESEM on unrecoded items: correlated content factors (partially specified target
# rotation: non-member loadings targeted to 0) and, optionally, a random-intercept
# acquiescence factor (loadings 1, variance free, orthogonal to content).
sf1_fit_esem <- function(X, member, with_ri = TRUE) {
  items <- rownames(member); fn <- colnames(member)
  target <- matrix(0, length(items), length(fn), dimnames = dimnames(member))
  mask <- ifelse(member, 0, 1)
  model <- paste0(paste0('efa("content")*', fn, collapse = " + "), " =~ ", paste(items, collapse = " + "))
  if (with_ri) model <- paste(model, paste0("RI =~ ", paste0("1*", items, collapse = " + ")),
                              paste0("RI ~~ ", paste0("0*", fn, collapse = " + ")), "RI ~~ RI", sep = "\n")
  sem(model, data = as.data.frame(X), ordered = items, estimator = "WLSMV", rotation = "pst",
      rotation.args = list(target = target, target_mask = mask, orthogonal = FALSE, rstarts = 30))
}

# Standardized content loadings as an items x factors matrix.
sf1_loadings <- function(m, fn) {
  s <- standardizedSolution(m); s <- s[s$op == "=~" & s$lhs %in% fn, ]
  items <- unique(s$rhs)
  L <- matrix(0, length(items), length(fn), dimnames = list(items, fn))
  L[cbind(s$rhs, s$lhs)] <- s$est.std; L
}

# Congruence between two loading matrices on shared items, columns matched to the
# best-congruent partner (sign-aligned).
sf1_congruence <- function(L_ref, L_new) {
  items <- intersect(rownames(L_ref), rownames(L_new))
  C <- psych::factor.congruence(L_ref[items, , drop = FALSE], L_new[items, , drop = FALSE])
  data.table(factor = colnames(L_ref), matched = colnames(L_new)[apply(abs(C), 1, which.max)],
             congruence = round(apply(abs(C), 1, max), 3))
}

# A factor's sign is arbitrary: an ESEM can return a factor pointing at either
# pole (Study 1's "letting be" factor came back as "needing to know"). Each factor
# is oriented so the keyed loadings of the items it defines sum to a positive
# number. Returns +1/-1 per factor; multiply loadings and factor scores by it.
sf1_orientation <- function(L_keyed) {
  pf <- apply(abs(L_keyed), 1, which.max)
  vapply(seq_len(ncol(L_keyed)), function(j) {
    s <- sum(L_keyed[pf == j, j]); if (s < 0) -1 else 1
  }, 1)
}
