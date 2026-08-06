/**
 * Alongside — follow without catching.
 *
 * Ported from the prototype at `public/prototypes/alongside.html`, which stays
 * the design testbed (it keeps the live tuning panel and debug API). This is
 * the same engine wrapped as a module: it owns a canvas, runs its own loop,
 * and hands back a quiet record of the visit when it is torn down.
 *
 * Art is inlined SVG path data from `I:\Shared drives\ComeSee\Alongside\`
 * (grasspack, stones, wildflower, mushrooms, pond, flowers, glowtree,
 * clearing) — see `docs/markdowns/alongside_asset_list.md`.
 */
export function createAlongside(cv) {
  const offs = [];
  function on(target, ev, fn) {
    target.addEventListener(ev, fn);
    offs.push(() => target.removeEventListener(ev, fn));
  }
  const STATS = { mists: 0, together: 0, startedAt: performance.now() };
  let raf = 0, watchdog = 0, running = true;

  /* ============================================================
     ALONGSIDE — follow without catching.
     A creature of light drifts through a night meadow. Rush it
     and it dissolves to mist and reforms elsewhere — costless.
     Drift beside it at its pace and it warms, then leads, past
     things worth seeing. Fireflies gathering between you are
     the only sign. Nothing is scored.
     ============================================================ */

  const P = {
    nearR: 95,        // closer than this = too close
    farR: 300,        // companion band outer edge
    loseR: 520,       // beyond this bond slowly fades
    bondGrow: 0.028,  // per second in the companion band at matched pace
    playerSpd: 150,   // px/s
    wispSpd: 78,      // creature baseline drift px/s
  };

  const WORLD={w:2600,h:1800};
  const ctx=cv.getContext('2d');
  let W=0,H=0,DPR=1;
  function resize(){
    DPR=Math.min(window.devicePixelRatio||1,2);
    W=cv.clientWidth||window.innerWidth;
    H=cv.clientHeight||window.innerHeight;
    cv.width=Math.max(1,Math.round(W*DPR));
    cv.height=Math.max(1,Math.round(H*DPR));
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }

  // --- site art ----------------------------------------------------------------
  // Lifted from mushrooms.svg / pond.svg / flowers.svg / glowtree.svg /
  // clearing.svg. Those files are spec sheets — labelled demo states on a
  // backing rect — so only the <defs> geometry is taken and the presentation
  // chrome dropped. Radial gradients are built once at the local origin and
  // reused for every instance, since the context is translated to each sprite
  // before filling; rebuilding them per instance per frame is the easy way to
  // make a scene like this crawl.
  const GRAD={};
  function grad(key,r,stops){
    if(GRAD[key])return GRAD[key];
    const g=ctx.createRadialGradient(0,0,0,0,0,r);
    for(const s of stops) g.addColorStop(s[0],s[1]);
    return GRAD[key]=g;
  }
  function pth(d){return new Path2D(d);}
  // bark reads as brown rounded wood; foliage as its own deeper green, lit from
  // the upper left so each leaf-mass has a lit crown and a shaded underside
  // instead of the whole tree being one flat silhouette
  function barkGrad(){
    if(GRAD.bark)return GRAD.bark;
    const g=ctx.createLinearGradient(-12,0,12,0);
    g.addColorStop(0,'rgb(64,46,33)');
    g.addColorStop(0.45,'rgb(46,33,24)');
    g.addColorStop(1,'rgb(28,20,15)');
    return GRAD.bark=g;
  }
  const LEAF_TINTS=[
    ['rgb(58,96,64)','rgb(38,68,48)','rgb(22,42,31)'],
    ['rgb(50,88,60)','rgb(32,60,44)','rgb(19,37,28)'],
    ['rgb(64,100,68)','rgb(43,74,51)','rgb(25,46,34)'],
  ];
  function leafGrad(r,tint){
    const k='leaf'+r+'_'+(tint||0);
    if(GRAD[k])return GRAD[k];
    const c=LEAF_TINTS[tint||0];
    const g=ctx.createRadialGradient(-r*0.32,-r*0.36,r*0.06,0,0,r);
    g.addColorStop(0,c[0]);
    g.addColorStop(0.55,c[1]);
    g.addColorStop(1,c[2]);
    return GRAD[k]=g;
  }
  // one tree, drawn anywhere: the tour's glowtree and the ordinary trees
  // scattered through the meadow are the same plant, lit differently
  function drawTree(X,Y,s,flip,tint,lit,worms,wormBase,t,seed){
    ctx.save();
    ctx.translate(X,Y);
    ctx.scale(s*flip,s);
    ctx.fillStyle=barkGrad();
    ctx.fill(TREE.trunk);
    ctx.strokeStyle='rgba(22,15,11,0.5)';ctx.lineWidth=1.2/s;
    for(const b of TREE.bark) ctx.stroke(b);
    for(const c of TREE.canopy){
      ctx.save();ctx.translate(c[0],c[1]);
      ctx.fillStyle=leafGrad(c[2],tint);
      ctx.beginPath();ctx.arc(0,0,c[2],0,7);ctx.fill();
      ctx.restore();
    }
    if(lit>0.02){                                // the canopy holds the light
      ctx.save();ctx.translate(0,-135);
      ctx.globalAlpha=lit;
      ctx.fillStyle=grad('canopy',65,[[0,'rgba(180,240,150,0.22)'],[1,'rgba(180,240,150,0)']]);
      ctx.beginPath();ctx.arc(0,0,65,0,7);ctx.fill();
      ctx.restore();
    }
    for(let i=0;i<worms.length;i++){
      const w=worms[i];
      const a=Math.max(wormBase,lit)*(0.4+0.6*Math.max(0,Math.sin(t*0.8+i*1.7+seed)));
      if(a<=0.02) continue;
      ctx.save();ctx.translate(w[0],w[1]);
      ctx.globalAlpha=a;
      ctx.fillStyle=grad('worm',7,[[0,'rgba(180,240,150,1)'],[0.5,'rgba(180,240,150,0.45)'],[1,'rgba(180,240,150,0)']]);
      ctx.beginPath();ctx.arc(0,0,7,0,7);ctx.fill();
      ctx.fillStyle='rgba(240,255,210,1)';
      ctx.beginPath();ctx.arc(0,0,1.6,0,7);ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // mushrooms.svg — three caps, stem base at (12,19), glow centred near the cap
  const SHROOM=[
    {gx:12,gy:14,cap:pth('M 8.8,14 A 3.2,3.2 0 0,1 15.2,14 Z'),capF:'120,210,150',
     stem:[11.2,14,1.6,5],stemF:'80,140,105'},
    {gx:12,gy:13,cap:pth('M 8.2,14 L 12,10 L 15.8,14 L 14.5,14.5 L 12,12.5 L 9.5,14.5 Z'),capF:'90,235,180',
     stem:[11.2,13.5,1.6,5.5],stemF:'75,125,110'},
    {gx:11,gy:14,cap:pth('M 8,13 A 3.2,3.2 0 0,1 14.4,13 Z'),capF:'150,220,110',capRot:-15,capPivot:[11.2,13],
     stemPath:pth('M 11.5,19 Q 10,15 11.2,13'),stemF:'90,150,120'},
  ];
  function drawShroom(v,lit,pulse){
    const s=SHROOM[v];
    if(lit>0.02){
      ctx.save();ctx.translate(s.gx,s.gy);
      ctx.globalAlpha=lit*pulse;
      ctx.fillStyle=grad('foxfire',26,[[0,'rgba(120,235,190,0.85)'],[0.45,'rgba(120,235,190,0.35)'],[1,'rgba(120,235,190,0)']]);
      ctx.beginPath();ctx.arc(0,0,26,0,7);ctx.fill();
      ctx.restore();
    }
    const b=0.45+0.55*lit;                       // unlit caps are present, not absent
    if(s.stemPath){
      ctx.strokeStyle=`rgba(${s.stemF},${0.9*b})`;ctx.lineWidth=1.6;ctx.lineCap='round';
      ctx.stroke(s.stemPath);
    } else {
      ctx.fillStyle=`rgba(${s.stemF},${0.95*b})`;
      ctx.fillRect(s.stem[0],s.stem[1],s.stem[2],s.stem[3]);
    }
    ctx.save();
    if(s.capRot){ctx.translate(s.capPivot[0],s.capPivot[1]);ctx.rotate(s.capRot*Math.PI/180);
      ctx.translate(-s.capPivot[0],-s.capPivot[1]);}
    ctx.fillStyle=`rgba(${s.capF},${0.95*b})`;
    ctx.fill(s.cap);
    ctx.restore();
  }

  // pond.svg — organic basin, soft rim, moon-glint, scalable ripple ring
  const POND={
    basin:pth('M -160,0 C -160,-65 -90,-92 0,-92 C 100,-92 160,-60 160,0 C 160,65 80,92 0,92 C -100,92 -160,65 -160,0 Z'),
  };

  // glowtree.svg — silhouette, canopy backlight, 14 glowworm positions
  const TREE={
    trunk:pth('M -12,0 C -8,-30 -3.5,-60 -3.5,-120 L -3.5,-120 C -25,-125 -40,-150 -52,-118 C -40,-110 -20,-105 -2,-100 C 0,-115 15,-130 48,-108 C 30,-100 15,-95 3.5,-80 C 3.5,-40 8,-20 12,0 Z'),
    canopy:[[0,-140,45],[-40,-125,35],[40,-120,35],[-25,-160,30],[25,-160,30],[0,-175,25]],
    // the four lowest authored worms sat on or past the foliage edge — two of
    // them hung in open air below the tree — so they are drawn up into the
    // leaves. Glowworms live in the canopy, not under it.
    worms:[[-35,-150],[-15,-170],[20,-165],[42,-135],[-45,-120],[-10,-135],[15,-140],
           [35,-110],[-25,-105],[0,-110],[-46,-108],[26,-106],[-16,-112],[44,-104]],
    bark:[pth('M -6,-12 C -5,-42 -4,-72 -4,-98'),pth('M 5,-8 C 4,-34 2,-58 2,-76')],
  };

  // flowers.svg — a true 6-frame opening sequence, authored 48x48 with the stem
  // base at (24,42). Discrete frames, because that is what a keyframe sequence
  // is: the bloom unfurls in steps, the way stop-motion does.
  function pet(cx,cy,rx,ry,deg){const p=new Path2D();p.ellipse(cx,cy,rx,ry,(deg||0)*Math.PI/180,0,7);return p;}
  const FRAMES=[
    {stem:28,shapes:[{p:pth('M 24,16 C 18,20 18,30 24,30 C 30,30 30,20 24,16 Z'),f:'200,160,195',a:0.9}]},
    {stem:28,shapes:[{p:pth('M 24,18 C 16,21 17,29 24,29 C 31,29 32,21 24,18 Z'),f:'200,160,195',a:0.9},
                     {p:pth('M 21,17 C 22,22 26,22 27,17'),s:'230,190,215',w:1}]},
    {stem:26,shapes:[{p:pet(24,18,2.5,5),f:'215,170,205',a:0.9},
                     {p:pet(19.5,22,2.2,4.5,-35),f:'215,170,205',a:0.9},
                     {p:pet(28.5,22,2.2,4.5,35),f:'215,170,205',a:0.9}]},
    {stem:25,core:2,shapes:[{p:pet(24,17,3,6),f:'225,175,210',a:0.9},
                     {p:pet(30,21,3,5.5,60),f:'225,175,210',a:0.9},
                     {p:pet(18,21,3,5.5,-60),f:'225,175,210',a:0.9},
                     {p:pet(28,28,2.8,5,130),f:'225,175,210',a:0.9},
                     {p:pet(20,28,2.8,5,-130),f:'225,175,210',a:0.9}]},
    {stem:24,core:2.8,shapes:[{p:pet(24,15.5,3.5,6.5),f:'230,180,215',a:0.9},
                     {p:pet(32,21.5,3.5,6.5,72),f:'230,180,215',a:0.9},
                     {p:pet(29,30.5,3.5,6.5,144),f:'230,180,215',a:0.9},
                     {p:pet(19,30.5,3.5,6.5,216),f:'230,180,215',a:0.9},
                     {p:pet(16,21.5,3.5,6.5,288),f:'230,180,215',a:0.9}]},
    {stem:24,core:3.5,shapes:[{p:pet(24,14,4,7),f:'235,185,220',a:0.95},
                     {p:pet(33.5,20.9,4,7,72),f:'235,185,220',a:0.95},
                     {p:pet(29.8,32,4,7,144),f:'235,185,220',a:0.95},
                     {p:pet(18.2,32,4,7,216),f:'235,185,220',a:0.95},
                     {p:pet(14.5,20.9,4,7,288),f:'235,185,220',a:0.95}]},
  ];
  function drawBloom(open){
    const F=FRAMES[Math.max(0,Math.min(5,Math.round(open*5)))];
    ctx.strokeStyle='rgba(90,135,100,0.9)';ctx.lineWidth=1.5;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(24,42);ctx.lineTo(24,F.stem);ctx.stroke();
    for(const s of F.shapes){
      if(s.s){ctx.strokeStyle=`rgba(${s.s},1)`;ctx.lineWidth=s.w;ctx.stroke(s.p);}
      else{ctx.fillStyle=`rgba(${s.f},${s.a})`;ctx.fill(s.p);}
    }
    if(F.core){ctx.fillStyle='rgba(240,215,140,0.95)';
      ctx.beginPath();ctx.arc(24,24,F.core,0,7);ctx.fill();}
  }

  // clearing.svg — the one place in the meadow that had no art at all, and the
  // place the whole ending happens. Fairy ring, bare earth, a soft landing spot.
  const CLEAR={
    turf:pth('M -220,-30 C -200,-150 200,-150 220,-20 C 230,120 -200,160 -220,-30 Z'),
    soilEdge:pth('M -150,-10 C -140,-80 -60,-105 0,-105 C 80,-105 150,-70 150,0 C 150,75 70,105 0,105 C -80,105 -150,70 -150,-10 Z'),
    soilPad:pth('M -135,-5 C -125,-68 -50,-90 0,-90 C 70,-90 135,-60 135,0 C 135,65 60,90 0,90 C -70,90 -135,60 -135,-5 Z'),
    pebbles:[[-60,-30,3,2],[70,20,4,2.5],[-40,45,2.5,1.8],[50,-40,3.5,2],[10,-60,2,1.5]],
    ring:[[0,-80,0],[-45,-74,1],[45,-74,0],[-85,-55,0],[85,-55,1],[-115,-20,1],[115,-20,0],
          [-120,20,0],[120,20,1],[-90,55,1],[90,55,0],[-50,75,0],[50,75,1],[0,82,0]],
    tufts:[[-180,-80,1.2],[160,-90,1.1],[-150,90,1.3],[170,70,1],[0,-135,1.2],[-50,125,1.1]],
    tuft:[pth('M 0,0 C -2,-5 -4,-8 -7,-9'),pth('M 0,0 C 0,-6 0,-10 1,-12'),pth('M 0,0 C 2,-5 5,-8 8,-9')],
    spores:[[-20,-15,1.2],[25,-20,1.5],[15,18,1],[-30,22,1.4],[5,-35,0.8]],
    shroomStem:pth('M -1,2 L -1,7 A 1,1 0 0 0 1,7 L 1,2 Z'),
    shroomCap:pth('M -4.5,2 A 4.5,4.5 0 0,1 4.5,2 Z'),
  };

  // --- world dressing ---------------------------------------------------------
  function hash1(n){const s=Math.sin(n*127.1)*43758.5453;return s-Math.floor(s);}

  // Grass tufts, authored as SVG (grasspack.svg, 80x64, bottom-centre anchored
  // at 40,64) and inlined as path data so the prototype stays one self-contained
  // file with no fetches. Each blade is a separate path, which is what lets them
  // sway independently — a rigidly rotating tuft loses the ripple entirely.
  const GRASS_SRC=[
    ['M 38 64 C 36 40, 24 20, 32 8 C 36 2, 42 10, 39 18 C 36 26, 42 42, 42 64 Z',
     'M 37 64 C 28 46, 12 34, 8 26 C 16 28, 30 42, 38 64 Z',
     'M 40 64 C 46 48, 58 36, 66 30 C 58 40, 48 52, 42 64 Z'],
    ['M 37 64 C 34 38, 22 18, 28 10 C 33 5, 38 18, 41 64 Z',
     'M 39 64 C 44 44, 56 28, 62 22 C 54 34, 45 48, 41 64 Z'],
    ['M 38 64 C 36 40, 30 18, 38 6 C 42 18, 41 40, 42 64 Z',
     'M 36 64 C 26 44, 10 32, 6 22 C 16 26, 28 42, 37 64 Z',
     'M 40 64 C 46 48, 58 34, 68 28 C 58 38, 46 52, 42 64 Z',
     'M 39 64 C 42 52, 50 42, 56 38 C 48 46, 43 54, 41 64 Z'],
    ['M 38 64 C 36 36, 26 14, 34 4 C 38 14, 41 38, 42 64 Z',
     'M 36 64 C 28 46, 14 36, 10 28 C 18 32, 30 46, 37 64 Z',
     'M 37 64 C 32 50, 22 40, 18 34 C 24 40, 34 50, 38 64 Z',
     'M 40 64 C 46 48, 60 36, 70 30 C 60 40, 48 52, 42 64 Z',
     'M 40 64 C 44 52, 52 42, 58 38 C 50 46, 44 54, 41 64 Z'],
  ];
  const GRASS=GRASS_SRC.map(v=>v.map(d=>new Path2D(d)));

  // Palette. Night is carried by VALUE (everything stays dark) rather than by
  // draining the colour out — so the meadow keeps real green and reads as a
  // living place after dark. Moonlight stays blue; the contrast between cool
  // light and green growth is what makes it feel nocturnal rather than grey.
  // Light sources are still the only genuinely saturated things on screen.
  const PAL={
    groundTop:'#091620', groundBot:'#0d211d',
    grass:'58,92,74',                 // moonlit green, was 52,66,72 blue-grey
    moon:'74,96,124',
    bloomTint:'128,168,170',
  };

  // Stones (stones.svg, 96x64, centre-anchored at 48,32, pre-squashed). Three
  // tones each — shadow body, lit top, moonlight accent — so they have form
  // instead of reading as flat holes.
  function ell(cx,cy,rx,ry,rot){const p=new Path2D();p.ellipse(cx,cy,rx,ry,rot||0,0,7);return p;}
  const STONE=[
    [{p:ell(48,32,36,21),f:'34,40,48',a:1},
     {p:ell(46,30,30,17),f:'48,56,68',a:1},
     {p:new Path2D('M 22 28 C 26 18, 50 14, 68 20 C 52 16, 32 20, 22 28 Z'),f:'70,84,120',a:0.4}],
    [{p:ell(42,34,28,16),f:'34,40,48',a:1},
     {p:ell(40,32,23,13),f:'45,54,66',a:1},
     {p:ell(64,28,16,10),f:'34,40,48',a:1},
     {p:ell(63,27,13,8),f:'52,62,76',a:1}],
    [{p:new Path2D('M 16 32 C 16 18, 80 18, 80 32 C 80 46, 16 46, 16 32 Z'),f:'34,40,48',a:1},
     {p:new Path2D('M 20 31 C 20 20, 76 20, 76 31 C 76 41, 20 41, 20 31 Z'),f:'48,56,68',a:1},
     {p:ell(36,25,12,4),f:'70,84,120',a:0.3}],
    [{p:new Path2D('M 24 32 C 20 20, 72 16, 76 32 C 80 48, 30 46, 24 32 Z'),f:'34,40,48',a:1},
     {p:new Path2D('M 27 31 C 24 22, 68 19, 72 31 C 75 43, 32 42, 27 31 Z'),f:'46,55,67',a:1}],
  ];

  // Wild flower (wildflower.svg, 32x32, bottom-centre anchored at 16,32).
  // Closed all game; opens only in the finale. Its core is the traveller's own
  // gold — the meadow answers in the player's colour.
  const FLOWER={
    stalk:new Path2D('M 16 32 C 15 24, 17 18, 16 14'),
    budOuter:ell(16,13,3,3), budInner:ell(16,13,1.8,1.8),
    petals:[ell(16,8,2.5,4), ell(21,12,2.5,4,72*Math.PI/180), ell(19,18,2.5,4,144*Math.PI/180),
            ell(13,18,2.5,4,216*Math.PI/180), ell(11,12,2.5,4,288*Math.PI/180)],
    core:ell(16,13,2.2,2.2),
  };

  let tufts=[],stones=[],flowersWild=[],trees=[];
  (function dress(){
    for(let i=0;i<420;i++){
      tufts.push({x:hash1(i*3+1)*WORLD.w,y:hash1(i*3+2)*WORLD.h,
        v:Math.floor(hash1(i*13+3)*GRASS.length),      // which tuft shape
        s:0.26+hash1(i*5)*0.30,                        // 17-36 px tall
        flip:hash1(i*19+7)<0.5?-1:1,                   // mirrored, so 4 shapes read as 8
        ph:hash1(i*7)*7});
    }
    for(let i=0;i<26;i++){
      stones.push({x:hash1(i*11+5)*WORLD.w,y:hash1(i*11+6)*WORLD.h,r:6+hash1(i*13)*16,
        v:Math.floor(hash1(i*23+11)*STONE.length), flip:hash1(i*29+3)<0.5?-1:1,
        tone:hash1(i*17)});
    }
    for(let i=0;i<70;i++){
      flowersWild.push({x:hash1(i*23+9)*WORLD.w,y:hash1(i*23+10)*WORLD.h,
        s:0.38+hash1(i*31+13)*0.22, flip:hash1(i*37+5)<0.5?-1:1, ph:hash1(i*29)*7});
    }
  })();

  // ordinary trees through the meadow — most of the world is not a destination,
  // and a place with only four landmarks reads as a stage set. They keep clear
  // of the tour sites and the clearing so nothing important ends up hidden
  // behind a trunk. (Planted after `sites`/`clearing` exist, further down.)
  function plantTrees(){
    for(let i=0;i<60&&trees.length<18;i++){
      const x=140+hash1(i*41+17)*(WORLD.w-280);
      const y=200+hash1(i*43+19)*(WORLD.h-300);
      let clear=Math.hypot(x-clearing.x,y-clearing.y)>340;
      for(const s of sites) if(Math.hypot(x-s.x,y-s.y)<300) clear=false;
      for(const o of trees) if(Math.hypot(x-o.x,y-o.y)<210) clear=false;
      if(!clear) continue;
      trees.push({x,y,
        s:0.46+hash1(i*47+7)*0.44, flip:hash1(i*53+3)<0.5?-1:1,
        tint:Math.floor(hash1(i*59+11)*LEAF_TINTS.length),
        seed:hash1(i*61+5)*7,
        // one or two dormant glowworms apiece, the way the spec sheet's dark
        // state has them — the tour tree is the one that truly lights
        worms:hash1(i*67+13)<0.45?[[-10,-135]]:[[-10,-135],[15,-140]]});
    }
  }

  // savoring sites — on the wisp's tour route; each also stirs on its own
  const sites=[
    {kind:'foxfire', x:WORLD.w*0.28,y:WORLD.h*0.30, r:180, lit:0, selfNext:20,
      shrooms:Array.from({length:9},(_,i)=>({dx:(hash1(i*31)-0.5)*220,dy:(hash1(i*37)-0.5)*160,ph:hash1(i*41)*7}))},
    {kind:'pond', x:WORLD.w*0.70,y:WORLD.h*0.36, r:200, lit:0, selfNext:35, ripples:[], surfaceAt:0},
    {kind:'flowers', x:WORLD.w*0.62,y:WORLD.h*0.74, r:190, lit:0, selfNext:50,
      blooms:Array.from({length:12},(_,i)=>({dx:(hash1(i*43)-0.5)*260,dy:(hash1(i*47)-0.5)*180,ph:hash1(i*53)*7,open:0}))},
    {kind:'glowtree', x:WORLD.w*0.24,y:WORLD.h*0.72, r:170, lit:0, selfNext:65,
      worms:Array.from({length:14},(_,i)=>({dx:(hash1(i*59)-0.5)*120,dy:-20-hash1(i*61)*130,ph:hash1(i*67)*7}))},
  ];
  const clearing={x:WORLD.w*0.47,y:WORLD.h*0.52,r:160};
  plantTrees();

  // --- actors -----------------------------------------------------------------
  const player={x:WORLD.w*0.45,y:WORLD.h*0.55,vx:0,vy:0,spd:0,accel:0,trail:[]};
  const wisp={
    x:WORLD.w*0.52,y:WORLD.h*0.47,vx:0,vy:0,spd:0,
    state:'wander',           // wander | lead | wait | settle | gone
    mist:0,                    // >0 while dissolved
    target:null, tourIdx:-1,
    pauseT:0, look:0, mothT:0,
    particles:Array.from({length:14},(_,i)=>({a:i/14*Math.PI*2,r:8+hash1(i*71)*10,ph:hash1(i*73)*7})),
  };
  let bond=0, settleTimer=0, meadowBloom=0, endFireflies=[], inBandFor=0;
  let cloakGlow=0;   // the cloak stirs when it wakes a place on its own
  let fireflies=[];
  const cam={x:player.x,y:player.y};
  let pointer={x:0,y:0,down:false};

  // --- input ------------------------------------------------------------------
  on(cv,'pointerdown',e=>{const r=cv.getBoundingClientRect();pointer.down=true;pointer.x=e.clientX-r.left;pointer.y=e.clientY-r.top;startAudio();try{cv.setPointerCapture(e.pointerId);}catch(_){}});
  on(cv,'pointermove',e=>{const r=cv.getBoundingClientRect();pointer.x=e.clientX-r.left;pointer.y=e.clientY-r.top;});
  on(window,'pointerup',()=>{pointer.down=false;});
  on(window,'pointercancel',()=>{pointer.down=false;});

  // --- wisp brain -------------------------------------------------------------
  function pickWanderTarget(){
    return [WORLD.w*(0.15+Math.random()*0.7), WORLD.h*(0.15+Math.random()*0.7)];
  }
  function wispUpdate(t,dt){
    const w=wisp;
    if(w.state==='gone') return;
    if(w.mist>0){
      w.mist=Math.max(0,w.mist-dt);
      // the mist drifts toward where it will reform — a breadcrumb, so losing
      // it is a beat, not a blackout
      if(w.reform){ w.x+=(w.reform[0]-w.x)*dt*0.8; w.y+=(w.reform[1]-w.y)*dt*0.8; }
      if(w.mist<=0){
        if(w.reform){ w.x=w.reform[0]; w.y=w.reform[1]; w.reform=null; }
        w.vx=0;w.vy=0;
      }
      return;
    }
    const d=Math.hypot(player.x-w.x,player.y-w.y);

    // too close — it dissolves. Not a punishment; simply how it is. But it
    // reforms within sight (screen-scaled), and never while settled: a settled
    // creature that lets you walk right up is the final statement of trust.
    if(d<P.nearR&&meadowBloom===0&&w.state!=='settle'){
      w.mist=2.6; STATS.mists++;
      const a=Math.random()*Math.PI*2;
      const R=Math.min(W,H)*0.38;
      w.reform=[clamp(player.x+Math.cos(a)*R,100,WORLD.w-100),
                clamp(player.y+Math.sin(a)*R,100,WORLD.h-100)];
      bond*=0.86;
      sfxMist();
      return;
    }

    // state transitions
    if(w.state==='wander'&&bond>0.35){
      w.state='lead';
      // resume from the first unvisited site, not the top of the tour
      const next=sites.findIndex(s=>s.lit<0.5&&!s.visited);
      w.tourIdx=w.tourIdx<0?(next<0?0:next):w.tourIdx;
      w.target=null;
    }
    if(w.state==='lead'&&bond<0.18){ w.state='wander'; w.target=null; }

    // meaningless play: sometimes it chases a moth in a loop
    if(w.mothT>0){
      w.mothT-=dt;
      const a=t*3.1;
      w.vx+= (Math.cos(a)*90-w.vx)*dt*3;
      w.vy+= (Math.sin(a*1.3)*70-w.vy)*dt*3;
      w.x+=w.vx*dt; w.y+=w.vy*dt;
      return;
    }
    if(Math.random()<dt*0.02&&(w.state==='wander'||w.state==='lead')){ w.mothT=4+Math.random()*2; }

    // sometimes it stops and looks at you — a beat, nothing more
    if(w.look>0){
      w.look-=dt;
      w.vx*=Math.pow(0.05,dt); w.vy*=Math.pow(0.05,dt);
      w.x+=w.vx*dt;w.y+=w.vy*dt;
      return;
    }
    if(Math.random()<dt*0.015&&d<P.farR*1.4){ w.look=1.6+Math.random()*1.4; }

    // choose target
    if(w.state==='wander'){
      if(!w.target||Math.hypot(w.target[0]-w.x,w.target[1]-w.y)<40) w.target=pickWanderTarget();
    } else if(w.state==='lead'){
      // it keeps you company: waits if you fall behind — and the shared
      // moments wait with it (no lingering-out sites alone)
      if(d>P.farR*1.5){
        w.vx*=Math.pow(0.04,dt); w.vy*=Math.pow(0.04,dt);
        w.x+=w.vx*dt;w.y+=w.vy*dt;
        return;
      }
      if(w.tourIdx>=sites.length){
        w.target=[clearing.x,clearing.y];
        if(Math.hypot(clearing.x-w.x,clearing.y-w.y)<50){ w.state='settle'; }
      } else {
        const s=sites[w.tourIdx];
        w.target=[s.x,s.y];
        if(Math.hypot(s.x-w.x,s.y-w.y)<70){
          // linger at the site until it's had its moment, then move on
          w.pauseT+=dt;
          if(w.pauseT>7){ w.pauseT=0; s.visited=true; w.tourIdx++; }
        }
      }
    } else if(w.state==='settle'){
      w.vx*=Math.pow(0.05,dt);w.vy*=Math.pow(0.05,dt);
      w.x+=w.vx*dt;w.y+=w.vy*dt;
      // if the player circles without settling, it models the answer:
      // nestling lower, glow sinking toward the grass
      w.nestle=(w.nestle||0)+dt;
      return;
    }

    // move toward target at a drifting pace; unease when you dart
    const dart=player.accel>560;
    const spd=P.wispSpd*(w.state==='lead'?1.12:1)*(dart?1.5:1);
    if(w.target){
      const dx=w.target[0]-w.x,dy=w.target[1]-w.y;
      const l=Math.hypot(dx,dy)||1;
      // meander: a sideways breathing drift laid over the heading
      const mx=Math.sin(t*0.6+1)*30, my=Math.cos(t*0.47)*30;
      w.vx+=((dx/l*spd+mx)-w.vx)*dt*1.6;
      w.vy+=((dy/l*spd+my)-w.vy)*dt*1.6;
    }
    w.x+=w.vx*dt; w.y+=w.vy*dt;
    w.spd=Math.hypot(w.vx,w.vy);
  }

  // --- bond -------------------------------------------------------------------
  function bondUpdate(t,dt){
    if(meadowBloom>0&&meadowBloom<1) meadowBloom=Math.min(1,meadowBloom+dt*0.12);
    for(const f of endFireflies){ f.mig=Math.min(1,f.mig+dt*0.08); }
    if(wisp.mist>0||wisp.state==='gone') return;
    const d=Math.hypot(player.x-wisp.x,player.y-wisp.y);
    const paceMatch=Math.abs(player.spd-wisp.spd)<45;
    const calm=player.accel<560;
    // dwell: companionship is time spent alongside, not transit through the
    // band — a chase that clips the band earns nothing
    if(d>=P.nearR&&d<=P.farR) inBandFor+=dt; else inBandFor=0;
    if(inBandFor>1.8&&paceMatch&&calm){
      bond=Math.min(1,bond+P.bondGrow*dt);
      STATS.together+=dt;
    } else if(player.accel>560&&pointer.down){
      bond=Math.max(0,bond-0.06*dt);
    } else if(d>P.loseR){
      bond=Math.max(0,bond-0.006*dt);
    }
    // fireflies gather between you — the only sign
    const want=Math.floor(bond*14);
    while(fireflies.length<want){
      fireflies.push({k:Math.random(),off:(Math.random()-0.5)*70,ph:Math.random()*7,a:0});
    }
    if(fireflies.length>want&&Math.random()<dt*2) fireflies.pop();
    for(const f of fireflies){ f.a=Math.min(1,f.a+dt*0.5); }

    // settling together at the clearing
    if(wisp.state==='settle'){
      const nearClearing=Math.hypot(player.x-clearing.x,player.y-clearing.y)<clearing.r*1.4;
      if(nearClearing&&player.spd<28){ settleTimer+=dt; } else { settleTimer=Math.max(0,settleTimer-dt*0.5); }
      if(settleTimer>8&&meadowBloom===0){ meadowBloom=0.001; sfxBloom(); }
    }
    if(meadowBloom>0.9&&wisp.state==='settle'){
      // the wisp dissolves into fireflies that stay with you
      wisp.state='gone';
      for(let i=0;i<22;i++){
        endFireflies.push({a:Math.random()*7,r:30+Math.random()*90,ph:Math.random()*7,cx:wisp.x,cy:wisp.y,mig:0});
      }
    }
  }

  // --- sites ------------------------------------------------------------------
  function sitesUpdate(t,dt){
    cloakGlow=Math.max(0,cloakGlow-dt*0.5);
    for(const s of sites){
      const dw=Math.hypot(wisp.x-s.x,wisp.y-s.y);
      const dp=Math.hypot(player.x-s.x,player.y-s.y);
      // While the wisp is here, a place only wakes for the two of you together.
      // Afterwards — wearing the cloak of fireflies it left behind — you can
      // wake them alone. Nothing says so; you find it out by wandering back.
      const alone=wisp.state==='gone';
      const both=alone? dp<s.r*1.2
                      : (dw<s.r&&dp<s.r*1.5&&wisp.mist<=0);
      // full light when visited together; a low self-stirring otherwise
      const target=both? 1: 0;
      s.lit+= (target-s.lit)*dt*(both?(alone?0.4:0.5):0.08);
      if(s.lit>0.6){ if(!s.everLit) s.everLit=true; if(alone) s.litAlone=true; }
      if(both&&alone) cloakGlow=Math.min(1,cloakGlow+dt*0.8);
      // it also happens without you, quietly
      if(t>s.selfNext){
        s.selfNext=t+40+Math.random()*40;
        s.selfPulse=1;
      }
      s.selfPulse=Math.max(0,(s.selfPulse||0)-dt*0.15);
      if(s.kind==='pond'){
        if(both&&t>s.surfaceAt){
          s.surfaceAt=t+6+Math.random()*8;
          s.ripples.push({r:6,a:0.6});
          sfxSurface();
        }
        if(s.selfPulse>0.9) s.ripples.push({r:6,a:0.3});
        for(let i=s.ripples.length-1;i>=0;i--){
          const r=s.ripples[i]; r.r+=dt*40; r.a-=dt*0.25;
          if(r.a<=0) s.ripples.splice(i,1);
        }
      }
      if(s.kind==='flowers'){
        for(const b of s.blooms){ b.open+=((s.lit>0.5?1:s.selfPulse*0.4)-b.open)*dt*0.4; }
      }
    }
  }

  // --- player -----------------------------------------------------------------
  function playerUpdate(dt){
    let tx=0,ty=0,want=false;
    if(pointer.down){
      // pointer in screen space -> world direction
      const wx=cam.x+(pointer.x-W/2), wy=cam.y+(pointer.y-H/2);
      const dx=wx-player.x,dy=wy-player.y;
      const l=Math.hypot(dx,dy);
      if(l>14){ tx=dx/l*P.playerSpd; ty=dy/l*P.playerSpd; want=true; }
    }
    const ovx=player.vx,ovy=player.vy;
    player.vx+=(tx-player.vx)*dt*(want?3.2:4.5);
    player.vy+=(ty-player.vy)*dt*(want?3.2:4.5);
    const ox=player.x,oy=player.y;
    player.x=clamp(player.x+player.vx*dt,60,WORLD.w-60);
    player.y=clamp(player.y+player.vy*dt,60,WORLD.h-60);
    // speed from actual displacement — a wall-pinned player is genuinely still
    player.spd=Math.hypot(player.x-ox,player.y-oy)/Math.max(dt,0.001);
    player.accel=Math.hypot(player.vx-ovx,player.vy-ovy)/Math.max(dt,0.001);
    player.trail.push([player.x,player.y,0.5]);
    if(player.trail.length>26)player.trail.shift();
    for(const p of player.trail)p[2]-=dt*0.5;
    cam.x+=(player.x-cam.x)*dt*2.4;
    cam.y+=(player.y-cam.y)*dt*2.4;
  }

  // --- audio ------------------------------------------------------------------
  // --- audio: two cellos -------------------------------------------------------
  // The wisp and the traveller are each a bowed string, faint, always playing.
  // Distance is intonation: out at the edges the player's string sits flat of a
  // fifth and beats against the wisp's; at the companion distance, at a shared
  // pace, it glides true and the beating stops. Coming into tune IS the feedback
  // — no meter, no chime, and nothing announces the moment it locks.
  let AC=null,master=null,cricketsG=null,started=false;
  let wispCello=null,playerCello=null,harmony=0;
  // keeping pace means covering the same ground over time, not moving at an
  // identical instant — someone walking alongside is always correcting, so the
  // attunement signal reads smoothed speeds, never frame-level velocity
  let spdAvgP=0,spdAvgW=0,accAvg=0,AUD={};
  const ROOT=146.83;            // D3 — both voices sit in cello register

  function noiseBuffer(sec){
    const b=AC.createBuffer(1,Math.floor(AC.sampleRate*sec),AC.sampleRate);
    const d=b.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    return b;
  }

  function makeCello(freq,pan){
    const out=AC.createGain(); out.gain.value=0;
    const lp=AC.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=780; lp.Q.value=2.2;
    const body=AC.createBiquadFilter(); body.type='peaking';
    body.frequency.value=260; body.Q.value=1.1; body.gain.value=5;
    const oscs=[];
    for(const det of [-4,4]){                       // two strings' worth of body
      const o=AC.createOscillator(); o.type='sawtooth';
      o.frequency.value=freq; o.detune.value=det;
      const g=AC.createGain(); g.gain.value=0.42;
      o.connect(g); g.connect(lp); o.start(); oscs.push(o);
    }
    const bn=AC.createBufferSource(); bn.buffer=noiseBuffer(3); bn.loop=true;
    const bf=AC.createBiquadFilter(); bf.type='bandpass'; bf.frequency.value=1900; bf.Q.value=1.4;
    const bg=AC.createGain(); bg.gain.value=0.03;   // the bow on the string
    bn.connect(bf); bf.connect(bg); bg.connect(lp); bn.start();
    const vib=AC.createOscillator(); vib.frequency.value=4.4;
    const vibG=AC.createGain(); vibG.gain.value=8;  // cents, narrowed as it settles
    for(const o of oscs) vibG.connect(o.detune);
    vib.connect(vibG); vib.start();
    lp.connect(body);
    let tail=body;
    if(AC.createStereoPanner){ const p=AC.createStereoPanner(); p.pan.value=pan||0; body.connect(p); tail=p; }
    tail.connect(out); out.connect(master);
    return {out,oscs,vibG,lp,
      setFreq(f,tau){ for(const o of oscs) o.frequency.setTargetAtTime(f,AC.currentTime,tau); },
      setLevel(v,tau){ out.gain.setTargetAtTime(v,AC.currentTime,tau); },
      setVib(c,tau){ vibG.gain.setTargetAtTime(c,AC.currentTime,tau); },
      setTone(hz,tau){ lp.frequency.setTargetAtTime(hz,AC.currentTime,tau); }};
  }

  function startAudio(){
    if(started)return;started=true;
    try{
      AC=new (window.AudioContext||window.webkitAudioContext)();
      master=AC.createGain();master.gain.value=0.5;master.connect(AC.destination);
      // night air: bandpassed noise breathing under a slow tremolo — no tone
      const n=AC.createBufferSource(); n.buffer=noiseBuffer(4); n.loop=true;
      const bp=AC.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=4200; bp.Q.value=4;
      const trem=AC.createGain(); trem.gain.value=0.55;
      const lfo=AC.createOscillator(); lfo.type='sine'; lfo.frequency.value=5.2;
      const lfoG=AC.createGain(); lfoG.gain.value=0.4;
      lfo.connect(lfoG); lfoG.connect(trem.gain); lfo.start();
      cricketsG=AC.createGain(); cricketsG.gain.value=0.004;
      n.connect(bp); bp.connect(trem); trem.connect(cricketsG); cricketsG.connect(master); n.start();
      // the two voices, bowed in from silence
      wispCello=makeCello(ROOT,-0.16);
      playerCello=makeCello(ROOT*1.5,0.16);
      wispCello.setLevel(0.052,2.0);
      playerCello.setLevel(0.046,2.0);
    }catch(_){}
  }

  function audioUpdate(dt){
    if(!AC)return;
    const d=Math.hypot(player.x-wisp.x,player.y-wisp.y);
    const ideal=(P.nearR+P.farR)/2, span=(P.farR-P.nearR)/2;
    // a broad plateau through the middle of the band, falling off only toward
    // its edges: walking companionably is a zone, not a tightrope
    const near=1-clamp((Math.abs(d-ideal)-span*0.45)/(span*0.55),0,1);
    const a=1-Math.exp(-dt/1.8);
    spdAvgP+=(player.spd-spdAvgP)*a;
    spdAvgW+=(wisp.spd-spdAvgW)*a;
    accAvg+=(player.accel-accAvg)*a;
    const pace=1-clamp(Math.abs(spdAvgP-spdAvgW)/110,0,1);
    const calm=1-clamp(accAvg/900,0,1);
    AUD={near:+near.toFixed(2),pace:+pace.toFixed(2),calm:+calm.toFixed(2),
         d:d|0,spdP:spdAvgP|0,spdW:spdAvgW|0,acc:accAvg|0};
    // distance leads; pace and steadiness only colour it, so a player who is
    // simply there, correcting as anyone would, still gets to hear it lock
    let target=near*(0.75+0.25*pace)*(0.8+0.2*calm);
    if(wisp.mist>0||wisp.state==='gone') target=0;         // alone, you drift flat
    if(meadowBloom>0) target=1;                            // the ending resolves
    harmony+=(target-harmony)*Math.min(1,dt*0.7);          // settles slowly, like tuning
    // settling assist: get near enough and the string finishes the last of the
    // distance itself. You do not manufacture the harmony; you come close and
    // it arrives — and the smoothstep means it eases in rather than snapping.
    const k=clamp(harmony/0.8,0,1), tune=k*k*(3-2*k);
    const ratio=1.5*(1-0.038*(1-tune));                    // sour fifth → true fifth
    // the debug readout reports what is actually sounding, never its own copy
    // of the formula — a mirrored constant is how tuning data starts lying
    AUD.ratio=ratio;
    playerCello.setFreq(ROOT*ratio,0.55);
    playerCello.setVib(9-6*tune,1.2);                      // steadier, never louder
    wispCello.setVib(7-4*tune,1.2);
    playerCello.setTone(760+tune*260,1.0);
    wispCello.setTone(740+tune*240,1.0);
    const presence=(wisp.state==='gone'||wisp.mist>0)?0:clamp(1-(d-P.nearR)/P.loseR,0.25,1);
    const fade=meadowBloom>0?1-meadowBloom*0.55:1;
    // out of tune is also quieter — two voices that aren't blending don't fill
    // the air. Consonance is never a volume reward; dissonance simply recedes.
    wispCello.setLevel((0.034+0.018*tune)*presence*fade,1.4);
    playerCello.setLevel((0.030+0.016*tune)*fade,1.4);
    cricketsG.gain.setTargetAtTime(0.004+harmony*0.002,AC.currentTime,2);
  }

  function sfxMist(){
    if(!AC)return;
    // the bow lifts: a soft exhale, dark, not a hiss
    const t0=AC.currentTime;
    const n=AC.createBufferSource(); n.buffer=noiseBuffer(0.9);
    const f=AC.createBiquadFilter(); f.type='lowpass';
    f.frequency.setValueAtTime(1100,t0);
    f.frequency.exponentialRampToValueAtTime(280,t0+0.8);
    const g=AC.createGain();
    g.gain.setValueAtTime(0,t0);
    g.gain.linearRampToValueAtTime(0.045,t0+0.14);
    g.gain.exponentialRampToValueAtTime(0.001,t0+0.9);
    n.connect(f);f.connect(g);g.connect(master);n.start(t0);n.stop(t0+0.95);
  }
  function sfxSurface(){
    if(!AC)return;
    const t0=AC.currentTime;
    const o=AC.createOscillator(),g=AC.createGain();
    o.type='sine';o.frequency.setValueAtTime(180,t0);
    o.frequency.exponentialRampToValueAtTime(90,t0+0.4);
    g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(0.08,t0+0.05);
    g.gain.exponentialRampToValueAtTime(0.001,t0+0.5);
    o.connect(g);g.connect(master);o.start(t0);o.stop(t0+0.55);
  }
  function sfxBloom(){
    if(!AC)return;
    const t0=AC.currentTime;
    // D major over the two cellos' D and A — the ending resolves their fifth
    const fs=[293.66,369.99,440,587.33];
    fs.forEach((f,i)=>{
      const o=AC.createOscillator(),g=AC.createGain();
      o.type='sine';o.frequency.value=f;
      g.gain.setValueAtTime(0,t0+i*0.3);
      g.gain.linearRampToValueAtTime(0.03,t0+i*0.3+1.5);
      g.gain.exponentialRampToValueAtTime(0.001,t0+i*0.3+6);
      o.connect(g);g.connect(master);o.start(t0+i*0.3);o.stop(t0+i*0.3+6.2);
    });
  }

  // --- render -----------------------------------------------------------------
  function sx(x){return x-cam.x+W/2;}
  function sy(y){return y-cam.y+H/2;}
  function inView(x,y,m){return x>cam.x-W/2-m&&x<cam.x+W/2+m&&y>cam.y-H/2-m&&y<cam.y+H/2+m;}

  function render(t){
    // ground
    const g=ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,PAL.groundTop);
    g.addColorStop(1,PAL.groundBot);
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    // moonlight patches
    const mg=ctx.createRadialGradient(sx(WORLD.w*0.5),sy(WORLD.h*0.4),60,sx(WORLD.w*0.5),sy(WORLD.h*0.4),900);
    mg.addColorStop(0,`rgba(${PAL.moon},0.17)`);
    mg.addColorStop(1,`rgba(${PAL.moon},0)`);
    ctx.fillStyle=mg;ctx.fillRect(0,0,W,H);

    // meadow bloom lightens everything, gently
    if(meadowBloom>0){
      ctx.fillStyle=`rgba(${PAL.bloomTint},${meadowBloom*0.10})`;
      ctx.fillRect(0,0,W,H);
    }

    drawClearing(t);   // terrain: under everything that grows on it

    // stones — three tones apiece, so they sit in the grass instead of on it
    for(const s of stones){
      if(!inView(s.x,s.y,60))continue;
      const sc=s.r/36;
      ctx.save();
      ctx.translate(sx(s.x),sy(s.y));
      ctx.scale(sc*s.flip,sc);
      ctx.translate(-48,-32);
      for(const part of STONE[s.v]){
        ctx.fillStyle=`rgba(${part.f},${part.a*0.94})`;
        ctx.fill(part.p);
      }
      ctx.restore();
    }
    // wild flowers — a closed bud all game; only the finale opens them, and
    // they open into the traveller's own gold
    for(const f of flowersWild){
      if(!inView(f.x,f.y,40))continue;
      if(Math.hypot(f.x-clearing.x,f.y-clearing.y)<150)continue;
      drawFlower(sx(f.x),sy(f.y),f.s,f.flip,meadowBloom,t,f.ph);
    }
    // grass tufts, swaying; those near the player ripple. Each blade carries its
    // own phase, so a tuft bends like grass rather than turning like a signpost.
    ctx.fillStyle=`rgba(${PAL.grass},${0.78+meadowBloom*0.12})`;
    for(const tf of tufts){
      if(!inView(tf.x,tf.y,60))continue;
      // a clearing is only a clearing if nothing is growing in it
      if(Math.hypot(tf.x-clearing.x,tf.y-clearing.y)<150)continue;
      const dP=Math.hypot(player.x-tf.x,player.y-tf.y);
      const ripple=dP<70? (1-dP/70)*Math.min(1,player.spd/60):0;
      const wind=Math.sin(t*1.1+tf.ph)*0.055;
      const X=sx(tf.x), Y=sy(tf.y);
      const blades=GRASS[tf.v];
      for(let b=0;b<blades.length;b++){
        const lag=0.72+0.28*Math.sin(b*2.3+tf.ph);        // outer blades trail
        const ang=(wind+ripple*0.22*Math.sin(t*7+tf.ph+b))*lag;
        ctx.save();
        ctx.translate(X,Y);
        ctx.rotate(ang);
        ctx.scale(tf.s*tf.flip,tf.s);
        ctx.translate(-40,-64);
        ctx.fill(blades[b]);
        ctx.restore();
      }
    }

    // the meadow's own trees, behind the tour's set pieces
    for(const tr of trees){
      if(!inView(tr.x,tr.y,260))continue;
      drawTree(sx(tr.x),sy(tr.y),tr.s,tr.flip,tr.tint,0,tr.worms,0.22,t,tr.seed);
    }

    drawSites(t);

    // player trail (grass-light wake)
    for(const p of player.trail){
      if(p[2]<=0)continue;
      ctx.fillStyle=`rgba(230,220,180,${p[2]*0.06})`;
      ctx.beginPath();ctx.arc(sx(p[0]),sy(p[1]),7,0,7);ctx.fill();
    }
    // fireflies between you and the wisp — they hover through the mist, so
    // the bond sign never blacks out
    if(wisp.state!=='gone'){
      for(const f of fireflies){
        const bx=player.x+(wisp.x-player.x)*f.k;
        const by=player.y+(wisp.y-player.y)*f.k;
        const px=bx+Math.sin(t*0.9+f.ph)*f.off;
        const py=by+Math.cos(t*0.7+f.ph)*f.off*0.6;
        const blink=Math.max(0,Math.sin(t*1.6+f.ph*3));
        ctx.fillStyle=`rgba(215,255,170,${0.72*blink*f.a})`;
        ctx.beginPath();ctx.arc(sx(px),sy(py),2.1,0,7);ctx.fill();
      }
    }
    // ending fireflies orbit the player, and lean outward when the cloak is
    // waking a place — the light you were given doing the work
    for(const f of endFireflies){
      const cx0=f.cx+(player.x-f.cx)*f.mig, cy0=f.cy+(player.y-f.cy)*f.mig;
      const rr=f.r*(1+cloakGlow*0.35);
      const px=cx0+Math.cos(t*0.5+f.a)*rr, py=cy0+Math.sin(t*0.5+f.a)*rr*0.7;
      const blink=0.4+0.6*Math.max(0,Math.sin(t*1.3+f.ph));
      ctx.fillStyle=`rgba(215,255,170,${(0.6+cloakGlow*0.3)*blink})`;
      ctx.beginPath();ctx.arc(sx(px),sy(py),1.8+cloakGlow*0.7,0,7);ctx.fill();
    }

    drawWisp(t);
    drawPlayer();
    vignette();
  }

  // The clearing: bare earth inside a fairy ring, at the heart of the meadow.
  // The spec sheet's white centre dot is a settling target — that is UI, and the
  // game has none, so it is dropped; the soft landing glow says the same thing
  // diegetically. Nothing here is a prompt: the ring simply grows here.
  function drawClearing(t){
    if(!inView(clearing.x,clearing.y,420))return;
    const X=sx(clearing.x),Y=sy(clearing.y);
    ctx.save();
    ctx.translate(X,Y);
    ctx.scale(0.85,0.85);
    // turf shelf the clearing sits in
    ctx.fillStyle='#15241b';
    ctx.beginPath();ctx.ellipse(0,0,230,170,0,0,7);ctx.fill();
    ctx.fillStyle='#1a2d22';
    ctx.fill(CLEAR.turf);
    ctx.strokeStyle='rgba(45,80,55,0.9)';ctx.lineWidth=1.2;ctx.lineCap='round';
    for(const g of CLEAR.tufts){
      ctx.save();ctx.translate(g[0],g[1]);ctx.scale(g[2],g[2]);
      for(const p of CLEAR.tuft) ctx.stroke(p);
      ctx.restore();
    }
    // earth
    ctx.fillStyle='rgba(35,24,18,0.5)';
    ctx.fill(CLEAR.soilEdge);
    ctx.fillStyle=grad('soil',135,[[0,'rgba(78,60,48,0.95)'],[0.6,'rgba(52,38,30,0.9)'],
      [0.85,'rgba(34,25,20,0.8)'],[1,'rgba(21,36,27,0)']]);
    ctx.fill(CLEAR.soilPad);
    ctx.fillStyle='rgba(25,18,14,0.6)';
    for(const p of CLEAR.pebbles){ctx.beginPath();ctx.ellipse(p[0],p[1],p[2],p[3],0,0,7);ctx.fill();}
    // the landing spot warms as the two of you settle into it
    const land=0.28+0.72*Math.max(meadowBloom,Math.min(1,settleTimer/8));
    ctx.save();ctx.scale(1,0.58);ctx.globalAlpha=land;
    ctx.fillStyle=grad('landing',55,[[0,'rgba(180,240,200,0.5)'],[0.4,'rgba(120,235,190,0.25)'],[1,'rgba(120,235,190,0)']]);
    ctx.beginPath();ctx.arc(0,0,55,0,7);ctx.fill();
    ctx.restore();
    ctx.fillStyle=`rgba(220,255,230,${0.10+0.20*land})`;
    ctx.beginPath();ctx.ellipse(0,0,20,12,0,0,7);ctx.fill();
    // fairy ring — dim all game, kindling with the bloom
    const ringLit=0.34+0.66*meadowBloom;
    for(let i=0;i<CLEAR.ring.length;i++){
      const m=CLEAR.ring[i];
      const puls=0.65+0.35*Math.sin(t*0.7+i*0.9);
      ctx.save();ctx.translate(m[0],m[1]);
      ctx.save();ctx.globalAlpha=ringLit*puls;
      ctx.fillStyle=grad('fairy',14,[[0,'rgba(120,235,190,0.85)'],[0.5,'rgba(120,235,190,0.3)'],[1,'rgba(120,235,190,0)']]);
      ctx.beginPath();ctx.arc(0,0,14,0,7);ctx.fill();
      ctx.restore();
      const alt=m[2];
      ctx.fillStyle=alt?'rgb(210,190,200)':'rgb(180,200,175)';
      ctx.fill(CLEAR.shroomStem);
      ctx.fillStyle=alt?'rgb(210,160,210)':'rgb(110,225,165)';
      ctx.fill(CLEAR.shroomCap);
      ctx.fillStyle=alt?'rgb(160,120,160)':'rgb(80,170,125)';
      ctx.beginPath();ctx.ellipse(0,2,4.5,1.2,0,0,7);ctx.fill();
      ctx.restore();
    }
    // spores adrift over the earth
    for(let i=0;i<CLEAR.spores.length;i++){
      const p=CLEAR.spores[i];
      const dy=Math.sin(t*0.5+i*1.6)*7, dx=Math.cos(t*0.34+i*2.1)*5;
      ctx.fillStyle=`rgba(180,240,190,${0.45+0.3*Math.sin(t*0.9+i)})`;
      ctx.beginPath();ctx.arc(p[0]+dx,p[1]+dy,p[2],0,7);ctx.fill();
    }
    ctx.restore();
  }

  // a wild flower: stalk, then the bud dissolving into open petals as the
  // meadow blooms. Nothing here is interactive — it is only the world noticing.
  function drawFlower(X,Y,s,flip,open,t,ph){
    ctx.save();
    ctx.translate(X,Y);
    ctx.rotate(Math.sin(t*0.9+ph)*0.03);
    ctx.scale(s*flip,s);
    ctx.translate(-16,-32);
    ctx.strokeStyle=`rgba(${PAL.grass},0.85)`;
    ctx.lineWidth=1.5;
    ctx.stroke(FLOWER.stalk);
    if(open<0.98){
      ctx.fillStyle=`rgba(150,140,180,${0.35*(1-open)})`; ctx.fill(FLOWER.budOuter);
      ctx.fillStyle=`rgba(184,168,224,${0.5*(1-open)})`;  ctx.fill(FLOWER.budInner);
    }
    if(open>0.02){
      ctx.save();
      ctx.translate(16,13); ctx.scale(open,open); ctx.translate(-16,-13);
      ctx.fillStyle=`rgba(184,168,224,${0.85*open})`;
      for(const p of FLOWER.petals) ctx.fill(p);
      ctx.fillStyle=`rgba(255,226,170,${open})`;
      ctx.fill(FLOWER.core);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawSites(t){
    for(const s of sites){
      if(!inView(s.x,s.y,320))continue;
      const lit=Math.max(s.lit,(s.selfPulse||0)*0.4);
      if(s.kind==='foxfire'){
        for(let i=0;i<s.shrooms.length;i++){
          const m=s.shrooms[i];
          ctx.save();
          ctx.translate(sx(s.x+m.dx),sy(s.y+m.dy));
          ctx.scale(1.4,1.4);
          ctx.translate(-12,-19);                 // stem base is the anchor
          drawShroom(i%SHROOM.length,lit,0.5+0.5*Math.sin(t*0.9+m.ph));
          ctx.restore();
        }
      } else if(s.kind==='pond'){
        ctx.save();
        ctx.translate(sx(s.x),sy(s.y));
        // soft rim halo, faked with a gradient rather than a blur filter —
        // ctx.filter is costly and still patchy on mobile Safari
        ctx.save();ctx.scale(1,0.575);
        ctx.fillStyle=grad('pondRim',178,[[0.82,'rgba(140,170,220,0)'],[0.92,'rgba(140,170,220,0.20)'],[1,'rgba(140,170,220,0)']]);
        ctx.beginPath();ctx.arc(0,0,178,0,7);ctx.fill();
        ctx.restore();
        ctx.fillStyle=grad('pondWater',125,[[0,'rgba(35,48,80,0.9)'],[0.7,'rgba(24,34,58,0.95)'],[1,'rgba(14,20,34,1)']]);
        ctx.fill(POND.basin);
        ctx.strokeStyle=`rgba(140,170,220,${0.32+lit*0.25})`;ctx.lineWidth=1.5;
        ctx.stroke(POND.basin);
        // moon-glint, and the rings a rising fish leaves behind it
        ctx.save();
        ctx.translate(30,-10);
        for(const r of s.ripples){
          ctx.strokeStyle=`rgba(200,214,245,${r.a})`;ctx.lineWidth=1.2;
          ctx.beginPath();ctx.ellipse(0,0,r.r*1.6,r.r*0.82,0,0,7);ctx.stroke();
        }
        ctx.rotate(17.2*Math.PI/180);
        ctx.fillStyle=`rgba(200,214,245,${0.55+lit*0.35})`;
        ctx.beginPath();ctx.ellipse(0,0,13,4.5,0,0,7);ctx.fill();
        ctx.fillStyle=`rgba(255,255,255,${0.6+lit*0.4})`;
        ctx.beginPath();ctx.ellipse(0,0,6.5,2,0,0,7);ctx.fill();
        ctx.restore();
        ctx.restore();
      } else if(s.kind==='flowers'){
        for(const b of s.blooms){
          ctx.save();
          ctx.translate(sx(s.x+b.dx),sy(s.y+b.dy));
          ctx.rotate(Math.sin(t*0.8+b.ph)*0.035);
          ctx.scale(0.62,0.62);
          ctx.translate(-24,-42);                 // stem base is the anchor
          drawBloom(b.open);
          ctx.restore();
        }
      } else if(s.kind==='glowtree'){
        drawTree(sx(s.x),sy(s.y)+22,0.9,1,0,lit,TREE.worms,0.14,t,0);
      }
    }
  }

  function drawWisp(t){
    const w=wisp;
    if(w.state==='gone')return;
    // settled and unjoined, it nestles: glow sinking into the grass — modelling
    // the stillness it is waiting to share
    const nestle=w.state==='settle'? clamp(((w.nestle||0)-20)/15,0,1):0;
    const x=sx(w.x),y=sy(w.y)+nestle*9;
    const mist=w.mist>0? clamp(w.mist/2.6,0,1):0;
    const expand=(mist>0? (1-mist)*3+1:1)*(1-nestle*0.4);
    const alpha=(mist>0? mist*0.5:0.9)*(1-nestle*0.35);
    // heart glow — steadier with bond (stability over brightness)
    const jitter=(1-bond)*2.2;
    const hx=x+Math.sin(t*7.3)*jitter, hy=y+Math.cos(t*6.1)*jitter;
    const gg=ctx.createRadialGradient(hx,hy,0,hx,hy,46);
    gg.addColorStop(0,`rgba(190,220,255,${0.5*alpha})`);
    gg.addColorStop(0.4,`rgba(150,190,250,${0.18*alpha})`);
    gg.addColorStop(1,'rgba(150,190,250,0)');
    ctx.fillStyle=gg;ctx.beginPath();ctx.arc(hx,hy,46,0,7);ctx.fill();
    ctx.fillStyle=`rgba(235,244,255,${0.9*alpha})`;
    ctx.beginPath();ctx.arc(hx,hy,3.4,0,7);ctx.fill();
    // particle veil
    for(const p of w.particles){
      const r=(p.r+Math.sin(t*1.3+p.ph)*3)*expand;
      const px=x+Math.cos(p.a+t*0.7)*r, py=y+Math.sin(p.a+t*0.7)*r*0.8;
      ctx.fillStyle=`rgba(200,224,255,${(0.35+0.25*Math.sin(t*2+p.ph))*alpha})`;
      ctx.beginPath();ctx.arc(px,py,1.5,0,7);ctx.fill();
    }
    // when it looks at you, the glow leans your way — barely
    if(w.look>0){
      const dx=player.x-w.x,dy=player.y-w.y;const l=Math.hypot(dx,dy)||1;
      ctx.fillStyle=`rgba(210,232,255,${0.25})`;
      ctx.beginPath();ctx.arc(x+dx/l*10,y+dy/l*10,2,0,7);ctx.fill();
    }
  }

  function drawPlayer(){
    const x=sx(player.x),y=sy(player.y);
    const gg=ctx.createRadialGradient(x,y,0,x,y,34);
    gg.addColorStop(0,'rgba(255,226,170,0.55)');
    gg.addColorStop(0.5,'rgba(255,200,130,0.15)');
    gg.addColorStop(1,'rgba(255,200,130,0)');
    ctx.fillStyle=gg;ctx.beginPath();ctx.arc(x,y,34,0,7);ctx.fill();
    ctx.fillStyle='rgba(255,240,210,0.95)';
    ctx.beginPath();ctx.arc(x,y,3.6,0,7);ctx.fill();
  }

  function vignette(){
    const g=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*0.42,W/2,H/2,Math.max(W,H)*0.78);
    g.addColorStop(0,'rgba(3,4,10,0)');
    g.addColorStop(1,'rgba(3,4,10,0.55)');
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  }

  // --- loop -------------------------------------------------------------------
  const t0=performance.now();
  let skew=0;
  function T(){return (performance.now()-t0)/1000+skew;}
  let prev=performance.now(),lastFrameAt=performance.now();
  const DBG={frames:0};
  function frame(now){
    DBG.frames++;
    const dt=Math.min(0.05,(now-prev)/1000);prev=now;
    step(T(),dt);
    render(T());
    lastFrameAt=now;
    if(running) raf=requestAnimationFrame(frame);
  }
  function step(t,dt){
    playerUpdate(dt);
    wispUpdate(t,dt);
    bondUpdate(t,dt);
    sitesUpdate(t,dt);
    audioUpdate(dt);
  }
  watchdog=setInterval(()=>{if(running&&performance.now()-lastFrameAt>500)frame(performance.now());},250);

  // --- helpers ----------------------------------------------------------------
  function clamp(v,a,b){return v<a?a:(v>b?b:v);}

  resize();
  on(window, 'resize', resize);
  // The canvas can be measured before layout has given it a size (React mounts
  // it in the same tick), which would otherwise leave the meadow at 1x1 until
  // the window happened to be resized. Observe the element itself instead.
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => resize());
    ro.observe(cv);
    offs.push(() => ro.disconnect());
  }
  raf = requestAnimationFrame(frame);

  return {
    /** A record of the visit — for the summary screen, never shown in play. */
    stats() {
      return {
        durationMs: performance.now() - STATS.startedAt,
        mists: STATS.mists,
        togetherS: STATS.together,
        peakBond: bond,
        sitesSeen: sites.filter(s => s.everLit).length,
        sitesAlone: sites.filter(s => s.litAlone).length,
        arrived: meadowBloom > 0.9,
      };
    },
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      clearInterval(watchdog);
      for (const off of offs) off();
      try { if (AC) AC.close(); } catch (_) {}
    },
  };
}
