import random, statistics, sys
FINE = {'action':[1,6,7,8,9],'practice':[2,3],'drift':[4,13,14],'view_core':[5,10,11,12],
        'view_stress':[16,18],'normalizing':[15,17],'completeness':[19,20,21],'safety':[22,23,24],
        'reward':[25,26,27],'view_open':[28,29,30,31,32]}
COARSE = {'view':[5,10,11,12,16,18,28,29,30,31,32]}
FLAGGED = [(4,13),(16,18),(1,9),(6,16)]
ATTN = 'A'
PAGES = [9,8,8,8]                       # 33 slots incl. the check
fine_of = {i:k for k,v in FINE.items() for i in v}
coarse_of = {i:k for k,v in COARSE.items() for i in v}
page_of = [p for p,n in enumerate(PAGES) for _ in range(n)]
starts = {sum(PAGES[:p]) for p in range(len(PAGES))}; ends = {sum(PAGES[:p+1])-1 for p in range(len(PAGES))}
def ok(seq, x):
    pos = len(seq)
    if x == ATTN:
        return 9 <= pos <= 32 - 9 and pos not in starts and pos not in ends
    for back in (1,2):                                   # same fine cluster >=3 apart
        if pos-back >= 0 and seq[pos-back] not in (ATTN, None) and fine_of[seq[pos-back]] == fine_of[x]: return False
    if x in coarse_of and pos >= 1 and seq[pos-1] in coarse_of: return False   # View never adjacent
    for a,b in FLAGGED:
        o = b if x == a else a if x == b else None
        if o is not None and o in seq[max(0,pos-2):]: return False
    pg = page_of[pos]; same_page = [y for k,y in enumerate(seq) if page_of[k]==pg and y not in (ATTN, None)]
    if sum(fine_of[y]==fine_of[x] for y in same_page) >= 2: return False
    if x in coarse_of and sum(y in coarse_of for y in same_page) >= 3: return False
    return True
def order(seed, budget=400):
    # Bounded randomized DFS; on exhausting the budget, restart with the next
    # sub-seed. Deterministic per seed, so a reload reproduces the same order.
    for attempt in range(1000):
        rng = random.Random(f"{seed}:{attempt}")
        slots = [k for k in range(33) if ok([None]*k, ATTN)]
        a_pos = rng.choice(slots)
        nodes = [0]
        def dfs(seq, left):
            nodes[0] += 1
            if nodes[0] > budget: return None
            if len(seq) == a_pos: return dfs(seq+[ATTN], left)
            if not left: return seq
            cand = left[:]; rng.shuffle(cand)
            for x in cand:
                if ok(seq, x):
                    r = dfs(seq+[x], [y for y in left if y != x])
                    if r: return r
            return None
        r = dfs([], list(range(1,33)))
        if r: return r
    return None
N = int(sys.argv[1]); pos = {i:[] for i in list(range(1,33))+[ATTN]}; fails = 0
for s in range(N):
    o = order(s)
    if o is None: fails += 1; continue
    # re-verify independently
    for k in range(len(o)): assert ok(o[:k], o[k]), (s, o)
    for k,x in enumerate(o): pos[x].append(k)
print('seeds', N, 'failed', fails)
means = {i: statistics.mean(v) for i,v in pos.items()}
print('mean position per item (uniform = 16.0): min %.2f max %.2f' % (min(means[i] for i in range(1,33)), max(means[i] for i in range(1,33))))
first = {i: sum(p==0 for p in pos[i])/N for i in range(1,33)}
print('share of orders each item opens (uniform = %.3f): min %.3f max %.3f' % (1/32*32/33, min(first.values()), max(first.values())))
print('attention check position range', min(pos[ATTN]), max(pos[ATTN]))
print('example order', order(12345))
