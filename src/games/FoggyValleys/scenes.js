// Foggy Valleys picture engine, ported unchanged from the Study 4 prototype
// (foggy_valleys_prototype_v0.3). Every picture is generated from a fixed seed,
// so all participants see the same 15 pictures; pictures 16 and up are extras
// for anyone who works through all 15. Pictures are 600 x 400 SVG strings.
//
// Do not change the generator, the seeds or the order of random draws: the
// pictures and their differences would change with them, and data from two
// versions would no longer describe the same pictures.

/* ===================== random numbers (seeded, so every participant sees the same pictures) ===================== */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const pick=(r,a)=>a[Math.floor(r()*a.length)];
const rint=(r,a,b)=>a+Math.floor(r()*(b-a+1));
const runif=(r,a,b)=>a+r()*(b-a);
function shuffle(r,arr){const a=arr.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

/* ===================== SVG helpers (pictures are 600 x 400) ===================== */
const f1=v=>Math.round(v*10)/10;
const C=(x,y,r,f,ex="")=>`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="${f}" ${ex}/>`;
const E=(x,y,rx,ry,f,ex="")=>`<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(rx)}" ry="${f1(ry)}" fill="${f}" ${ex}/>`;
const R=(x,y,w,h,f,ex="")=>`<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" fill="${f}" ${ex}/>`;
const P=(pts,f,ex="")=>`<polygon points="${pts}" fill="${f}" ${ex}/>`;
const PA=(d,f,ex="")=>`<path d="${d}" fill="${f}" ${ex}/>`;
const L=(x1,y1,x2,y2,s,w=2)=>`<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="${s}" stroke-width="${w}" stroke-linecap="round"/>`;
function starPts(cx,cy,ro,ri){const p=[];for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?ri:ro;p.push(`${f1(cx+rr*Math.cos(a))},${f1(cy+rr*Math.sin(a))}`);}return p.join(" ");}

/* ===================== colour changes =====================
   contrastAlt: an obvious recolour, with a clear lightness difference (medium).
   tint: a slight shift, 16 to 28 degrees of hue plus 4 to 8 points of lightness (hard), like the owl's eyes
   or the rainbow stripe in the original game. Whites and greys change in lightness only. */
function lstar(hex){const n=parseInt(hex.slice(1),16);const ch=[n>>16&255,n>>8&255,n&255].map(v=>{v/=255;return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4);});const Y=0.2126*ch[0]+0.7152*ch[1]+0.0722*ch[2];return Y>0.008856?116*Math.cbrt(Y)-16:903.3*Y;}
function contrastAlt(r,base,pool){const ok=pool.filter(c=>c!==base&&Math.abs(lstar(c)-lstar(base))>=22);return pick(r,ok.length?ok:pool.filter(c=>c!==base));}
function hexToHsl(hex){const n=parseInt(hex.slice(1),16);const r=(n>>16&255)/255,g=(n>>8&255)/255,b=(n&255)/255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b);let h=0,s=0;const l=(mx+mn)/2;if(mx!==mn){const d=mx-mn;s=l>.5?d/(2-mx-mn):d/(mx+mn);h=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;h*=60;}return[h,s*100,l*100];}
function hslToHex(h,s,l){s/=100;l/=100;const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));return"#"+[f(0),f(8),f(4)].map(x=>Math.round(x*255).toString(16).padStart(2,"0")).join("");}
function tint(r,hex){const[h,s,l]=hexToHsl(hex);const dh=(r()<.5?-1:1)*runif(r,16,28);let dl=(r()<.5?-1:1)*runif(r,4,8);if(l>88)dl=-Math.abs(dl)-3;if(l<14)dl=Math.abs(dl)+3;return hslToHex((h+dh+360)%360,s,Math.max(6,Math.min(96,l+dl)));}

/* ===================== object library =====================
   Each object is drawn around its own origin (ground objects stand on it, sky objects are centred on it).
   box   = [x, y, r] circle around the whole object, in local units
   area  = optional circles covering a tall object, used when the whole object is removed
   parts = a change to one detail: make() returns the changed settings and the circles that count as the difference
   tints = colours that can shift slightly: the setting's key, where it is, and how it is described */
const APPLES=[[-14,-80],[13,-88],[19,-60]], SPOTS=[[-8,-22,2.8],[3,-28,2.8],[9,-19,2.3]], BERRIES=[[-8,-17],[6,-22],[14,-9]];
const BOWS=[[5,38],[-4,57],[3,72]], POSTS=[-44,-22,0,22,44], HOLES=[[-14,4],[12,4]];
const PINE=[{b:-8,w:36,a:-58},{b:-34,w:29,a:-80},{b:-56,w:21,a:-100}];
const one=(r,n)=>{const a=Array(n).fill(1);const i=rint(r,0,n-1);a[i]=0;return[a,i];};
const TYPES={
 sun:{label:"sun",box:[0,0,40],
  init:(r,T)=>({c:T.key==="winter"?"#ffe08a":"#ffc93c",miss:-1}),
  draw:p=>{let s="";for(let i=0;i<8;i++){if(i===p.miss)continue;const a=i*Math.PI/4;s+=L(29*Math.cos(a),29*Math.sin(a),39*Math.cos(a),39*Math.sin(a),p.c,5);}return s+C(0,0,23,p.c);},
  parts:[{lvl:"hard",text:"One of the sun's rays is missing",make:r=>{const i=rint(r,0,7),a=i*Math.PI/4;return{props:{miss:i},hits:[[34*Math.cos(a),34*Math.sin(a),11]]};}}],
  tints:[{key:"c",lvl:"medium",text:"The sun is a slightly different colour",at:[[0,0,30]]}]},
 cloud:{label:"cloud",box:[0,-2,40],
  init:(r,T)=>({c:T.cloud||"#ffffff",puff:1}),
  draw:p=>E(0,0,34,15,p.c)+E(-22,4,22,11,p.c)+E(24,5,24,11,p.c)+(p.puff?E(-4,-11,17,12,p.c):""),
  parts:[{lvl:"medium",text:"A cloud has a different shape",make:()=>({props:{puff:0},hits:[[-4,-12,17]]})}],
  tints:[{key:"c",lvl:"hard",text:"A cloud is a slightly different shade",at:[[0,0,32]]}]},
 bird:{label:"bird",box:[0,-2,13],
  init:(r,T)=>({c:T.night?"#0e1424":"#34404c"}),
  draw:p=>PA("M-11 0 Q-5 -8 0 0 Q5 -8 11 0","none",`stroke="${p.c}" stroke-width="2.5" stroke-linecap="round"`)},
 kite:{label:"kite",box:[0,24,46],area:[[0,2,24],[1,52,24]],
  init:r=>{const a=pick(r,["#e8590c","#1971c2","#c2255c","#2b8a3e"]);return{a,b:contrastAlt(r,a,["#ffd43b","#f8f9fa","#a5d8ff","#ffc9c9"]),bows:[1,1,1]};},
  draw:p=>PA("M0 26 Q10 40 0 52 Q-10 64 4 78","none",'stroke="#495057" stroke-width="1.5"')+P("0,-22 15,0 0,26 -15,0",p.a)+P("0,-22 15,0 0,26",p.b)+L(0,-22,0,26,"#495057",1.2)+L(-15,0,15,0,"#495057",1.2)+BOWS.map(([x,y],i)=>p.bows[i]?P(`${x-6},${y-4} ${x+6},${y+4} ${x+6},${y-4} ${x-6},${y+4}`,"#e03131"):"").join(""),
  parts:[{lvl:"hard",text:"A bow is missing from the kite's tail",make:r=>{const[b,i]=one(r,3);return{props:{bows:b},hits:[[BOWS[i][0],BOWS[i][1],10]]};}},
         {lvl:"medium",text:"Half of the kite is a different colour",make:(r,p)=>({props:{b:contrastAlt(r,p.b,["#ffd43b","#f8f9fa","#212529","#a5d8ff","#5f3dc4"])},hits:[[6,2,14]]})}],
  tints:[{key:"a",lvl:"hard",text:"Half of the kite is a slightly different colour",at:[[-6,2,13]]}]},
 balloon:{label:"hot-air balloon",box:[0,-2,38],
  init:r=>({a:pick(r,["#f03e3e","#1c7ed6","#f76707","#7048e8"]),stripe:1,basket:1,ropes:[1,1]}),
  draw:p=>(p.ropes[0]?L(-10,10,-6,21,"#6b4f2f",1.5):"")+(p.ropes[1]?L(10,10,6,21,"#6b4f2f",1.5):"")+C(0,-12,27,p.a)+(p.stripe?E(0,-12,9,27,"#fff3bf"):"")+(p.basket?R(-8,21,16,11,"#a9743f",'rx="2"'):""),
  parts:[{lvl:"medium",text:"The balloon's stripe is missing",make:()=>({props:{stripe:0},hits:[[0,-12,16]]})},
         {lvl:"medium",text:"The balloon's basket is missing",make:()=>({props:{basket:0},hits:[[0,26,12]]})},
         {lvl:"hard",text:"One of the balloon's ropes is missing",make:r=>{const[a,i]=one(r,2);return{props:{ropes:a},hits:[[i?8:-8,16,8]]};}}],
  tints:[{key:"a",lvl:"medium",text:"The balloon is a slightly different colour",at:[[-17,-12,12],[17,-12,12]]}]},
 moon:{label:"moon",box:[-4,0,26],asym:true,
  init:()=>({c:"#fff3bf",crater:1}),
  draw:p=>PA("M0 -24 A24 24 0 0 0 0 24 A13 24 0 0 1 0 -24 Z",p.c)+(p.crater?C(-17,-3,3.2,"#e6d690"):""),
  parts:[{lvl:"hard",text:"The moon's small crater is missing",make:()=>({props:{crater:0},hits:[[-17,-3,8]]})}],
  tints:[{key:"c",lvl:"hard",text:"The moon is a slightly different colour",at:[[-14,0,14]]}]},
 star:{label:"star",box:[0,0,10],
  init:()=>({c:"#fff3bf"}),
  draw:p=>P(starPts(0,0,9,3.8),p.c),
  tints:[{key:"c",lvl:"hard",text:"A star is a slightly different colour",at:[[0,0,10]]}]},
 tree:{label:"tree",box:[0,-58,46],
  init:(r,T)=>({g:T.night?"#3b7a4b":pick(r,["#4c9a55","#3f8f4f","#5aa469"]),ap:T.night?[]:[1,1,1],apC:pick(r,["#e03131","#f08c00"])}),
  draw:p=>R(-6,-50,12,50,"#7a5134")+C(0,-76,32,p.g)+C(-22,-56,22,p.g)+C(22,-56,22,p.g)+APPLES.map(([x,y],i)=>p.ap[i]?C(x,y,4.6,p.apC):"").join(""),
  parts:[{lvl:"hard",when:p=>p.ap.length,text:"An apple is missing from a tree",make:r=>{const[a,i]=one(r,3);return{props:{ap:a},hits:[[APPLES[i][0],APPLES[i][1],9]]};}},
         {lvl:"medium",text:"A tree's leaves are a different shade",make:(r,p)=>({props:{g:contrastAlt(r,p.g,["#a9d16a","#1f5130","#c0d850","#245c35"])},hits:[[0,-68,38]]})}],
  tints:[{key:"g",lvl:"hard",text:"A tree's leaves are a slightly different green",at:[[0,-70,34]]},
         {key:"apC",lvl:"hard",when:p=>p.ap.length,text:"The apples on a tree are a slightly different colour",at:APPLES.map(([x,y])=>[x,y,9])}]},
 pine:{label:"pine tree",box:[0,-52,46],
  init:(r,T)=>({g:T.night?"#2f6446":"#2f6e4a",snow:T.snow?[1,1,1]:[],top:1}),
  draw:p=>R(-5,-14,10,14,"#6b4423")+PINE.map((t,i)=>(i===2&&!p.top)?"":P(`0,${t.a} ${-t.w},${t.b} ${t.w},${t.b}`,p.g)+(p.snow[i]?P(`${-t.w},${t.b} ${t.w},${t.b} ${t.w*.82},${t.b-5} ${-t.w*.82},${t.b-5}`,"#ffffff"):"")).join(""),
  parts:[{lvl:"medium",text:"The top of a pine tree is missing",make:()=>({props:{top:0},hits:[[0,-80,18]]})},
         {lvl:"hard",when:p=>p.snow.length,text:"Snow is missing from one branch of a pine tree",make:r=>{const[s,i]=one(r,3);const t=PINE[i];return{props:{snow:s},hits:[[-t.w/2,t.b-3,10],[0,t.b-3,10],[t.w/2,t.b-3,10]]};}}],
  tints:[{key:"g",lvl:"hard",text:"A pine tree is a slightly different green",at:[[0,-40,30]]}]},
 house:{label:"house",box:[0,-42,46],asym:true,
  init:(r,T)=>({wall:pick(r,["#f4e3c1","#e9ecef","#d8e8c8","#f6d5c3"]),roof:pick(r,["#b8473f","#4f5d6e","#7a5c3e"]),door:pick(r,["#2f4b7c","#8d3b2a","#2b6a3e"]),win:T.night?"#ffd96a":"#cfe8f5",chim:1,wl:1,wr:1,bars:[1,1],knob:1,snow:!!T.snow}),
  draw:p=>{const win=(x,i)=>R(x,-40,13,12,p.win)+(p.bars[i]?L(x+6.5,-40,x+6.5,-28,"#5a4a3a",1)+L(x,-34,x+13,-34,"#5a4a3a",1):"");
    return (p.chim?R(14,-80,9,22,p.roof):"")+R(-30,-48,60,48,p.wall)+P("-36,-48 0,-80 36,-48",p.roof)+(p.snow?PA("M-34 -49 L0 -78 L34 -49","none",'stroke="#ffffff" stroke-width="4" stroke-linejoin="round"'):"")
      +(p.wl?win(-25,0):"")+(p.wr?win(12,1):"")+R(-7,-27,14,27,p.door)+(p.knob?C(3.5,-13,1.7,"#f1f3f5"):"");},
  parts:[{lvl:"medium",text:"A chimney is missing",make:()=>({props:{chim:0},hits:[[18.5,-70,12]]})},
         {lvl:"medium",text:"A window is missing from a house",make:r=>r()<.5?{props:{wl:0},hits:[[-18.5,-34,11]]}:{props:{wr:0},hits:[[18.5,-34,11]]}},
         {lvl:"hard",text:"The frame is missing from a window",make:r=>{const[b,i]=one(r,2);return{props:{bars:b},hits:[[i?18.5:-18.5,-34,10]]};}},
         {lvl:"medium",text:"A door is a different colour",make:(r,p)=>({props:{door:contrastAlt(r,p.door,["#2f4b7c","#8d3b2a","#2b6a3e","#f2c94c","#e9ecef"])},hits:[[0,-14,13]]})},
         {lvl:"hard",text:"A door handle is missing",make:()=>({props:{knob:0},hits:[[3.5,-13,7]]})}],
  tints:[{key:"roof",lvl:"medium",text:"A roof is a slightly different colour",at:[[0,-60,18]]},
         {key:"wall",lvl:"hard",text:"A house's walls are a slightly different colour",at:[[-20,-14,12],[20,-14,12]]},
         {key:"door",lvl:"hard",text:"A door is a slightly different colour",at:[[0,-14,11]]}]},
 flower:{label:"flower",box:[0,-28,17],
  init:r=>({c:pick(r,["#f06595","#845ef7","#ff922b","#4dabf7"]),leaf:1,pet:[1,1,1,1,1,1]}),
  draw:p=>L(0,0,0,-32,"#3f8f4f",3)+(p.leaf?E(6,-14,7,3.2,"#4c9a55",'transform="rotate(-30 6 -14)"'):"")+p.pet.map((on,i)=>{const a=i*Math.PI/3;return on?C(7*Math.cos(a),-38+7*Math.sin(a),5,p.c):"";}).join("")+C(0,-38,4,"#ffd43b"),
  parts:[{lvl:"hard",text:"A leaf is missing from a flower",make:()=>({props:{leaf:0},hits:[[6,-14,9]]})},
         {lvl:"hard",text:"A petal is missing from a flower",make:r=>{const[a,i]=one(r,6);const t=i*Math.PI/3;return{props:{pet:a},hits:[[8*Math.cos(t),-38+8*Math.sin(t),8]]};}},
         {lvl:"medium",text:"A flower is a different colour",make:(r,p)=>({props:{c:contrastAlt(r,p.c,["#f8f9fa","#5f3dc4","#ffd8a8","#c92a2a","#1864ab"])},hits:[[0,-38,13]]})}],
  tints:[{key:"c",lvl:"hard",text:"A flower is a slightly different colour",at:[[0,-38,12]]}]},
 fence:{label:"fence",box:[0,-17,52],
  init:(r,T)=>({c:T.snow?"#8d6e4f":T.night?"#7a6a55":"#c79a63",posts:[1,1,1,1,1],short:-1,rail:1}),
  draw:p=>(p.rail?R(-52,-25,104,4,p.c):"")+R(-52,-13,104,4,p.c)+POSTS.map((x,i)=>{if(!p.posts[i])return"";const h=i===p.short?22:30;return P(`${x-3.5},0 ${x+3.5},0 ${x+3.5},${-h} ${x},${-h-5} ${x-3.5},${-h}`,p.c,'stroke="rgba(0,0,0,.18)" stroke-width="1"');}).join(""),
  parts:[{lvl:"medium",text:"A fence post is missing",make:r=>{const[ps,i]=one(r,5);return{props:{posts:ps},hits:[[POSTS[i],-17,11]]};}},
         {lvl:"hard",text:"One fence post is shorter",make:r=>{const i=rint(r,0,4);return{props:{short:i},hits:[[POSTS[i],-29,9]]};}},
         {lvl:"medium",text:"The top rail of a fence is missing",make:()=>({props:{rail:0},hits:[[-36,-23,10],[-12,-23,10],[12,-23,10],[36,-23,10]]})}],
  tints:[{key:"c",lvl:"hard",text:"A fence is a slightly different colour",at:[[-33,-17,13],[0,-17,13],[33,-17,13]]}]},
 mushroom:{label:"mushroom",box:[0,-18,18],
  init:r=>({c:pick(r,["#e5484d","#d9480f"]),sp:[1,1,1]}),
  draw:p=>R(-5,-15,10,15,"#f3e6d2",'rx="2"')+PA("M-17 -14 Q-16 -34 0 -34 Q16 -34 17 -14 Z",p.c)+SPOTS.map(([x,y,rr],i)=>p.sp[i]?C(x,y,rr,"#ffffff"):"").join(""),
  parts:[{lvl:"hard",text:"A white spot is missing from a mushroom",make:r=>{const[s,i]=one(r,3);return{props:{sp:s},hits:[[SPOTS[i][0],SPOTS[i][1],7]]};}},
         {lvl:"medium",text:"A mushroom is a different colour",make:(r,p)=>({props:{c:contrastAlt(r,p.c,["#5c3d1e","#ffd43b","#f8f9fa"])},hits:[[0,-24,15]]})}],
  tints:[{key:"c",lvl:"hard",text:"A mushroom is a slightly different colour",at:[[0,-24,14]]}]},
 bush:{label:"bush",box:[0,-13,27],
  init:()=>({g:"#3f7f4e",be:[1,1,1]}),
  draw:p=>C(-14,-10,12,p.g)+C(14,-10,12,p.g)+C(0,-15,16,p.g)+BERRIES.map(([x,y],i)=>p.be[i]?C(x,y,3.2,"#c92a2a"):"").join(""),
  parts:[{lvl:"hard",text:"A berry is missing from a bush",make:r=>{const[b,i]=one(r,3);return{props:{be:b},hits:[[BERRIES[i][0],BERRIES[i][1],8]]};}}],
  tints:[{key:"g",lvl:"hard",text:"A bush is a slightly different green",at:[[0,-14,20]]}]},
 snowman:{label:"snowman",box:[0,-42,32],asym:true,
  init:()=>({hat:1,nose:1,al:1,ar:1,b:[1,1],eyes:[1,1],scarf:"#e03131"}),
  draw:p=>{const o='stroke="#c9d4de" stroke-width="1.5"';
    return (p.al?L(-11,-44,-27,-55,"#7a5134",2.5):"")+(p.ar?L(11,-44,27,-55,"#7a5134",2.5):"")+C(0,-15,16,"#ffffff",o)+C(0,-41,12,"#ffffff",o)+C(0,-61,9,"#ffffff",o)
      +R(-9,-54,18,4,p.scarf,'rx="2"')+(p.hat?R(-11,-71,22,3,"#2b2f36")+R(-7,-82,14,11,"#2b2f36"):"")+(p.nose?P("0,-62 11,-60 0,-58","#f08c00"):"")
      +(p.eyes[0]?C(-3,-64,1.4,"#2b2f36"):"")+(p.eyes[1]?C(3,-64,1.4,"#2b2f36"):"")+[[0,-45],[0,-37]].map(([x,y],i)=>p.b[i]?C(x,y,1.9,"#2b2f36"):"").join("");},
  parts:[{lvl:"medium",text:"A snowman's hat is missing",make:()=>({props:{hat:0},hits:[[0,-75,13]]})},
         {lvl:"hard",text:"A snowman's nose is missing",make:()=>({props:{nose:0},hits:[[5,-60,8]]})},
         {lvl:"medium",text:"One of a snowman's arms is missing",make:r=>r()<.5?{props:{al:0},hits:[[-19,-50,11]]}:{props:{ar:0},hits:[[19,-50,11]]}},
         {lvl:"hard",text:"A button is missing from a snowman",make:r=>{const[b,i]=one(r,2);return{props:{b},hits:[[0,i?-37:-45,7]]};}},
         {lvl:"hard",text:"One of a snowman's eyes is missing",make:r=>{const[e,i]=one(r,2);return{props:{eyes:e},hits:[[i?3:-3,-64,6]]};}}],
  tints:[{key:"scarf",lvl:"hard",text:"A snowman's scarf is a slightly different colour",at:[[0,-52,10]]}]},
 umbrella:{label:"beach umbrella",box:[0,-44,38],
  init:r=>({a:pick(r,["#f03e3e","#1c7ed6","#f76707"]),b:"#ffffff",knob:1}),
  draw:p=>L(0,0,0,-58,"#868e96",3)+PA("M-36 -50 Q0 -86 36 -50 Z",p.a)+P("-12,-50 0,-68 12,-50",p.b)+(p.knob?C(0,-70,2.8,"#495057"):""),
  parts:[{lvl:"medium",text:"The middle stripe of an umbrella is a different colour",make:(r,p)=>({props:{b:contrastAlt(r,p.b,["#212529","#5f3dc4","#2b8a3e"])},hits:[[0,-56,11]]})},
         {lvl:"hard",text:"The knob on top of an umbrella is missing",make:()=>({props:{knob:0},hits:[[0,-70,7]]})}],
  tints:[{key:"a",lvl:"medium",text:"An umbrella is a slightly different colour",at:[[-21,-58,12],[21,-58,12]]}]},
 sailboat:{label:"sailboat",box:[0,-26,36],asym:true,
  init:r=>({hull:pick(r,["#c92a2a","#364fc7","#2b2f36"]),flag:1,flagC:"#f08c00",jib:1,holes:[1,1]}),
  draw:p=>L(0,0,0,-62,"#495057",2)+P("3,-58 3,-6 32,-6","#f8f9fa",'stroke="#ced4da"')+(p.jib?P("-3,-48 -3,-6 -24,-6","#f1f3f5",'stroke="#ced4da"'):"")+(p.flag?P("0,-62 13,-58 0,-54",p.flagC):"")+P("-34,-2 34,-2 25,12 -25,12",p.hull)+HOLES.map(([x,y],i)=>p.holes[i]?C(x,y,2.4,"#f8f9fa"):"").join(""),
  parts:[{lvl:"hard",text:"The flag on a boat is missing",make:()=>({props:{flag:0},hits:[[6,-58,8]]})},
         {lvl:"medium",text:"The small sail of a boat is missing",make:()=>({props:{jib:0},hits:[[-10,-20,13]]})},
         {lvl:"hard",text:"A round window is missing from a boat",make:r=>{const[h,i]=one(r,2);return{props:{holes:h},hits:[[HOLES[i][0],HOLES[i][1],7]]};}},
         {lvl:"medium",text:"A boat is a different colour",make:(r,p)=>({props:{hull:contrastAlt(r,p.hull,["#c92a2a","#364fc7","#2b2f36","#f2c94c","#f8f9fa"])},hits:[[0,5,16]]})}],
  tints:[{key:"flagC",lvl:"hard",text:"The flag on a boat is a slightly different colour",at:[[6,-58,8]]},
         {key:"hull",lvl:"hard",text:"A boat is a slightly different colour",at:[[-14,5,10],[14,5,10]]}]},
 fish:{label:"fish",box:[-4,0,24],asym:true,
  init:r=>({c:pick(r,["#ff922b","#fcc419","#ff6b6b"]),stripe:1,fin:1}),
  draw:p=>P("-12,0 -26,-10 -26,10",p.c)+(p.fin?P("-6,-7 3,-15 7,-7",p.c):"")+E(0,0,16,9,p.c)+(p.stripe?E(-2,0,2.6,8,"#ffffff"):"")+C(8,-2,1.8,"#212529"),
  parts:[{lvl:"hard",text:"The white stripe on a fish is missing",make:()=>({props:{stripe:0},hits:[[-2,0,8]]})},
         {lvl:"hard",text:"The fin on a fish's back is missing",make:()=>({props:{fin:0},hits:[[1,-11,8]]})}],
  tints:[{key:"c",lvl:"hard",text:"A fish is a slightly different colour",at:[[0,0,14]]}]},
 starfish:{label:"starfish",box:[0,-9,12],
  init:()=>({c:"#f08c00"}),
  draw:p=>P(starPts(0,-9,11,5),p.c),
  tints:[{key:"c",lvl:"hard",text:"A starfish is a slightly different colour",at:[[0,-9,11]]}]},
 bucket:{label:"bucket",box:[0,-16,19],
  init:r=>({c:pick(r,["#4dabf7","#e03131","#40c057"]),handle:1,band:1}),
  draw:p=>(p.handle?PA("M-10 -20 Q0 -37 10 -20","none",'stroke="#343a40" stroke-width="1.6"'):"")+P("-11,-20 11,-20 8,0 -8,0",p.c)+(p.band?P("-10.2,-13 10.2,-13 9.8,-10 -9.8,-10","#ffffff"):"")+R(-11,-22,22,3,"#343a40"),
  parts:[{lvl:"hard",text:"A bucket's handle is missing",make:()=>({props:{handle:0},hits:[[0,-29,9]]})},
         {lvl:"hard",text:"The white band on a bucket is missing",make:()=>({props:{band:0},hits:[[0,-11.5,9]]})},
         {lvl:"medium",text:"A bucket is a different colour",make:(r,p)=>({props:{c:contrastAlt(r,p.c,["#4dabf7","#e03131","#40c057","#212529","#f8f9fa"])},hits:[[0,-10,12]]})}],
  tints:[{key:"c",lvl:"hard",text:"A bucket is a slightly different colour",at:[[0,-10,11]]}]},
 sunflower:{label:"sunflower",box:[0,-44,26],area:[[0,-66,24],[0,-28,14]],
  init:()=>({ll:1,lr:1,ctr:"#6b4423",pc:"#fcc419",pet:Array(12).fill(1)}),
  draw:p=>{let s=L(0,0,0,-58,"#3f8f4f",4)+(p.ll?E(-9,-24,10,4,"#4c9a55",'transform="rotate(25 -9 -24)"'):"")+(p.lr?E(9,-36,10,4,"#4c9a55",'transform="rotate(-25 9 -36)"'):"");
    for(let i=0;i<12;i++){if(!p.pet[i])continue;const a=i*30,x=13*Math.cos(a*Math.PI/180),y=-66+13*Math.sin(a*Math.PI/180);s+=E(x,y,7,3.6,p.pc,`transform="rotate(${a} ${f1(x)} ${f1(y)})"`);}
    return s+C(0,-66,9,p.ctr);},
  parts:[{lvl:"medium",text:"A leaf is missing from a sunflower",make:r=>r()<.5?{props:{ll:0},hits:[[-9,-24,11]]}:{props:{lr:0},hits:[[9,-36,11]]}},
         {lvl:"hard",text:"A petal is missing from a sunflower",make:r=>{const[a,i]=one(r,12);const t=i*Math.PI/6;return{props:{pet:a},hits:[[14*Math.cos(t),-66+14*Math.sin(t),8]]};}},
         {lvl:"medium",text:"The centre of a sunflower is a different colour",make:()=>({props:{ctr:"#e8590c"},hits:[[0,-66,11]]})}],
  tints:[{key:"pc",lvl:"hard",text:"The petals of a sunflower are a slightly different yellow",at:[[0,-66,22]]}]},
 barn:{label:"barn",box:[0,-42,48],
  init:()=>({w:"#c92a2a",roof:"#495057",x:1,loft:1}),
  draw:p=>R(-36,-52,72,52,p.w)+P("-42,-52 0,-80 42,-52",p.roof)+R(-15,-34,30,34,"#f8f9fa")+R(-12,-31,24,31,p.w)+(p.x?L(-12,-31,12,0,"#f8f9fa",2.5)+L(12,-31,-12,0,"#f8f9fa",2.5):"")+(p.loft?R(-7,-66,14,10,"#f8f9fa"):""),
  parts:[{lvl:"medium",text:"The cross on a barn door is missing",make:()=>({props:{x:0},hits:[[0,-16,15]]})},
         {lvl:"medium",text:"The small window in a barn roof is missing",make:()=>({props:{loft:0},hits:[[0,-61,10]]})},
         {lvl:"medium",text:"A barn is a different colour",make:r=>({props:{w:pick(r,["#f59f00","#364fc7"])},hits:[[-26,-30,12],[26,-30,12]]})}],
  tints:[{key:"w",lvl:"hard",text:"A barn is a slightly different red",at:[[-26,-30,12],[26,-30,12]]},
         {key:"roof",lvl:"hard",text:"A barn roof is a slightly different grey",at:[[0,-62,16]]}]},
 chick:{label:"chick",box:[2,-11,13],asym:true,
  init:()=>({c:"#ffd43b",beak:"#f08c00",wing:1}),
  draw:p=>E(0,-7,9,7,p.c)+(p.wing?E(-2,-7,4.5,3,"#f2b705"):"")+C(7,-15,5.5,p.c)+P("12,-16 17,-14.5 12,-13",p.beak)+C(8.5,-16,1.1,"#212529"),
  parts:[{lvl:"hard",text:"A chick's wing is missing",make:()=>({props:{wing:0},hits:[[-2,-7,7]]})}],
  tints:[{key:"beak",lvl:"hard",text:"A chick's beak is a slightly different colour",at:[[14,-15,6]]},
         {key:"c",lvl:"hard",text:"A chick is a slightly different yellow",at:[[2,-11,11]]}]},
 hay:{label:"hay bale",box:[0,-12,22],
  init:()=>({c:"#e9c46a",bands:[1,1]}),
  draw:p=>R(-20,-24,40,24,p.c,'rx="5"')+L(-18,-16,18,-16,"#c9a227",1.5)+L(-18,-8,18,-8,"#c9a227",1.5)+(p.bands[0]?L(-8,-22,-8,-2,"#9c6f0b",2):"")+(p.bands[1]?L(8,-22,8,-2,"#9c6f0b",2):""),
  parts:[{lvl:"hard",text:"A band is missing from a hay bale",make:r=>{const[b,i]=one(r,2);return{props:{bands:b},hits:[[i?8:-8,-12,8]]};}}],
  tints:[{key:"c",lvl:"hard",text:"A hay bale is a slightly different colour",at:[[0,-12,18]]}]},
 lamp:{label:"street lamp",box:[0,-42,30],area:[[0,-20,14],[0,-66,22]],
  init:()=>({on:1,lc:"#ffe066"}),
  draw:p=>(p.on?C(0,-76,20,"rgba(255,224,102,.28)"):"")+R(-2.5,-70,5,70,"#3a3f47")+R(-8,-5,16,5,"#3a3f47")+P("-9,-70 9,-70 6,-84 -6,-84","#3a3f47")+R(-5.5,-81,11,9,p.on?p.lc:"#5c636e"),
  parts:[{lvl:"medium",text:"A street lamp is switched off",make:()=>({props:{on:0},hits:[[0,-77,13]]})}],
  tints:[{key:"lc",lvl:"hard",text:"A street lamp's light is a slightly different colour",at:[[0,-77,10]]}]},
 cat:{label:"cat",box:[0,-24,25],asym:true,
  init:(r,T)=>({c:T.night?"#9aa3ad":pick(r,["#495057","#e8590c"]),eyes:T.night?"#ffd43b":"#c3fae8",el:1,tail:1}),
  draw:p=>(p.tail?PA("M-11 -6 Q-28 -8 -22 -30","none",`stroke="${p.c}" stroke-width="4.5" stroke-linecap="round"`):"")+E(0,-14,12,14,p.c)+C(7,-33,9.5,p.c)+(p.el?P("1,-39 3,-50 9,-41",p.c):"")+P("9,-41 15,-50 16,-36",p.c)+C(5,-34,1.6,p.eyes)+C(10,-34,1.6,p.eyes),
  parts:[{lvl:"hard",text:"One of a cat's ears is missing",make:()=>({props:{el:0},hits:[[4,-45,7]]})},
         {lvl:"medium",text:"A cat's tail is missing",make:()=>({props:{tail:0},hits:[[-20,-17,12]]})}],
  tints:[{key:"eyes",lvl:"hard",text:"A cat's eyes are a slightly different colour",at:[[7.5,-34,7]]},
         {key:"c",lvl:"hard",text:"A cat is a slightly different colour",at:[[0,-20,15]]}]}
};

/* ===================== scene themes ===================== */
function tufts(r,c,n,y0,y1){let s="";for(let i=0;i<n;i++){const x=runif(r,10,590),y=runif(r,y0,y1);s+=P(`${f1(x-6)},${f1(y)} ${f1(x-3)},${f1(y-9)} ${f1(x)},${f1(y)} ${f1(x+3)},${f1(y-11)} ${f1(x+6)},${f1(y)}`,c);}return s;}
function waves(r){let s="";for(let i=0;i<9;i++){const x=runif(r,20,560),y=runif(r,214,292);s+=PA(`M${f1(x)} ${f1(y)} q8 -5 16 0 t16 0`,"none",'stroke="#7cc4ea" stroke-width="2" stroke-linecap="round"');}return s;}
function dots(r,c,n,y0,y1){let s="";for(let i=0;i<n;i++)s+=C(runif(r,8,592),runif(r,y0,y1),runif(r,1,1.8),c);return s;}
function shadows(r){let s="";for(let i=0;i<6;i++)s+=E(runif(r,40,560),runif(r,300,390),runif(r,40,80),runif(r,5,9),"#e1eaf3");return s;}
function decorStars(r){let s="";for(let i=0;i<26;i++)s+=C(runif(r,8,592),runif(r,8,230),runif(r,.9,1.5),"#e8edff",'opacity=".7"');return s;}
function furrows(){let s="";for(let i=0;i<5;i++){const y=260+i*5;s+=L(0,y,600,y-2,"#c4d78c",1.5);}return s;}
const THEMES={
 meadow:{key:"meadow",name:"Meadow",
  bg:r=>R(0,0,600,400,"#bfe4f6")+PA("M0 252 Q150 204 300 244 T600 236 L600 400 L0 400Z","#a8d78b")+R(0,272,600,128,"#8fc972")+tufts(r,"#77b45f",14,282,396),
  zones:{sky:[42,150],ground:[298,390]},scale:{ground:[1.0,1.32]},
  fill:[["sky",[4,5],{sun:1,cloud:3,bird:2,kite:1,balloon:1}],["ground",[8,11],{tree:2,house:1,flower:5,fence:1,bush:2,mushroom:3}]]},
 seaside:{key:"seaside",name:"Seaside",
  bg:r=>R(0,0,600,400,"#cdeefa")+PA("M380 205 Q430 180 480 205Z","#9cc2a3")+R(0,204,600,96,"#3f9bd2")+waves(r)+PA("M0 300 Q150 288 300 298 T600 294 L600 400 L0 400Z","#f0d99c")+dots(r,"#d8bd7e",26,312,396),
  zones:{sky:[40,140],water:[232,282],sand:[332,390]},scale:{water:[.95,1.15],sand:[1.0,1.25]},
  fill:[["sky",[3,4],{sun:1,cloud:2,bird:3}],["water",[3,4],{sailboat:2,fish:3}],["sand",[4,6],{umbrella:2,bucket:2,starfish:3}]]},
 winter:{key:"winter",name:"Winter",snow:true,
  bg:r=>R(0,0,600,400,"#d3e2ef")+PA("M0 250 Q160 200 320 246 T600 238 L600 400 L0 400Z","#e9f1f8")+R(0,276,600,124,"#f7fafc")+shadows(r),
  zones:{sky:[42,150],ground:[298,390]},scale:{ground:[1.0,1.32]},
  fill:[["sky",[3,4],{sun:1,cloud:3,bird:2}],["ground",[7,9],{pine:4,snowman:2,house:2,fence:1}]]},
 night:{key:"night",name:"Night",night:true,cloud:"#56618a",
  bg:r=>`<defs><linearGradient id="g-night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#18213f"/><stop offset="1" stop-color="#3d4c7a"/></linearGradient></defs>`+R(0,0,600,400,"url(#g-night)")+decorStars(r)+PA("M0 268 Q170 236 320 266 T600 258 L600 400 L0 400Z","#2c4039")+R(0,296,600,104,"#22342c"),
  zones:{sky:[40,160],ground:[318,390]},scale:{ground:[1.0,1.28]},
  fill:[["sky",[5,7],{moon:1,star:5,cloud:2}],["ground",[6,8],{house:2,lamp:2,tree:2,pine:2,cat:1,fence:1}]]},
 farm:{key:"farm",name:"Farm",
  bg:r=>R(0,0,600,400,"#c3e5f7")+PA("M0 258 Q150 228 300 252 T600 246 L600 400 L0 400Z","#d2e39b")+furrows()+R(0,286,600,114,"#a7d27a")+tufts(r,"#8cbf62",10,292,396),
  zones:{sky:[42,150],ground:[302,390]},scale:{ground:[1.0,1.3]},
  fill:[["sky",[3,4],{sun:1,cloud:2,bird:2,balloon:1}],["ground",[8,10],{barn:1,fence:1,sunflower:3,chick:4,hay:2,tree:1,flower:2}]]}
};
const THEME_ORDER=["meadow","seaside","winter","night","farm"];
const ZORDER={sky:0,water:1,sand:2,ground:3};

/* ===================== scene generator ===================== */
function wbox(o,dx=0){const b=TYPES[o.type].box;return[o.x+dx+b[0]*o.s,o.y+b[1]*o.s,b[2]*o.s];}
function place(r,T,zone,type,objs){
  const Ty=TYPES[type],[y0,y1]=T.zones[zone],sc=(T.scale&&T.scale[zone])||[1.0,1.25];
  for(let t=0;t<200;t++){
    const y=runif(r,y0,y1);
    const s=zone==="sky"?runif(r,sc[0],sc[1]):(sc[0]+(sc[1]-sc[0])*(y-y0)/(y1-y0))*runif(r,.94,1.06);
    const br=Ty.box[2]*s,x=runif(r,14+br,586-br),cx=x+Ty.box[0]*s,cy=y+Ty.box[1]*s;
    if(cy-br<2)continue;
    if(objs.some(q=>{const[qx,qy,qr]=wbox(q);return Math.hypot(qx-cx,qy-cy)<(qr+br)*.82+2;}))continue;
    return{type,zone,x,y,s,p:Ty.init(r,T)};
  }
  return null;
}
/* Every way an object can differ, with a difficulty guess. Whole-object changes scale with its size. */
function options(o){
  const T=TYPES[o.type],br=T.box[2]*o.s,list=[];
  (T.parts||[]).forEach(pt=>{if(!pt.when||pt.when(o.p))list.push({kind:"part",pt,lvl:pt.lvl});});
  (T.tints||[]).forEach(tn=>{if(!tn.when||tn.when(o.p))list.push({kind:"tint",tn,lvl:tn.lvl});});
  list.push({kind:"remove",lvl:br>=34?"easy":br>=17?"medium":"hard"});
  list.push({kind:"shift",lvl:br>=17?"medium":"hard"});
  list.push({kind:"nudge",lvl:"hard"});
  if(T.asym)list.push({kind:"flip",lvl:"medium"});
  if(br>=26)list.push({kind:"size",lvl:"medium"});
  list.push({kind:"shrink",lvl:"hard"});
  list.push({kind:"tilt",lvl:br>=30?"medium":"hard"});
  return list;
}
const CAPS={remove:2,shift:1,nudge:1,flip:1,size:1,shrink:1,tilt:1};   // per picture, so no one kind dominates
function moveTo(r,o,objs,lo,hi){
  const[bx,by,br]=wbox(o);
  for(const sg of shuffle(r,[-1,1])){
    const dx=sg*rint(r,lo,hi),nx=bx+dx;
    if(nx-br<6||nx+br>594)continue;
    if(objs.some(q=>{if(q===o)return false;const[qx,qy,qr]=wbox(q);return Math.hypot(qx-nx,qy-by)<(qr+br)*.8;}))continue;
    return dx;
  }
  return null;
}
function makeDiff(r,o,opt,objs,k){
  const T=TYPES[o.type],W=h=>[f1(o.x+h[0]*o.s),f1(o.y+h[1]*o.s),f1(Math.max(h[2]*o.s,9))];
  const d={id:"d"+(k+1),obj:o.uid,kind:opt.kind,lvl:opt.lvl,label:T.label};
  const[bx,by,br]=wbox(o);
  switch(opt.kind){
    case"part":{const m=opt.pt.make(r,o.p);d.bp=Object.assign({},o.p,m.props);d.hits=m.hits.map(W);d.text=opt.pt.text;break;}
    case"tint":{d.bp=Object.assign({},o.p,{[opt.tn.key]:tint(r,o.p[opt.tn.key])});d.hits=opt.tn.at.map(W);d.text=opt.tn.text;break;}
    case"remove":d.hits=(T.area||[T.box]).map(W);d.text=`A ${T.label} is missing from one picture`;break;
    case"shift":case"nudge":{
      const dx=opt.kind==="shift"?moveTo(r,o,objs,30,48):moveTo(r,o,objs,10,15);if(dx===null)return null;
      d.dx=dx;const hr=f1(Math.max(br*.8,12));
      d.hits=opt.kind==="shift"?[[f1(bx),f1(by),hr],[f1(bx+dx),f1(by),hr]]:[[f1(bx+dx/2),f1(by),f1(Math.max(br*.85,12))]];
      d.text=opt.kind==="shift"?`A ${T.label} has moved`:`A ${T.label} is in a slightly different place`;break;}
    case"flip":d.hits=[[f1(bx),f1(by),f1(br*.9)]];d.text=`A ${T.label} faces the other way`;break;
    case"size":d.hits=[[f1(bx),f1(by),f1(br*.9)]];d.text=`A ${T.label} is smaller in one picture`;break;
    case"shrink":d.hits=[[f1(bx),f1(by),f1(Math.max(br*.9,10))]];d.text=`A ${T.label} is slightly smaller in one picture`;break;
    case"tilt":d.rot=(r()<.5?-1:1)*rint(r,9,13);d.hits=[[f1(bx),f1(by),f1(Math.max(br*.9,10))]];d.text=`A ${T.label} is tilted in one picture`;break;
  }
  return d;
}
const clash=(a,b)=>a.hits.some(([x1,y1,r1])=>b.hits.some(([x2,y2,r2])=>Math.hypot(x1-x2,y1-y2)<(r1+r2)*.8));
/* 5 to 9 differences per picture, at least two of them hard; about half are hard overall */
function chooseDiffs(r,objs){
  const n=rint(r,5,9),want=["hard","hard"];
  while(want.length<n){const u=r();want.push(u<.12?"easy":u<.45?"medium":"hard");}
  const pool=shuffle(r,objs),out=[],used=new Set(),count={};
  const tryObj=(o,lvl)=>{
    const opts=shuffle(r,options(o)).filter(x=>(!lvl||x.lvl===lvl)&&(count[x.kind]||0)<(CAPS[x.kind]??99));
    for(const opt of opts){const d=makeDiff(r,o,opt,objs,out.length);if(d&&!out.some(e=>clash(d,e))){count[opt.kind]=(count[opt.kind]||0)+1;return d;}}
    return null;
  };
  for(const lvl of want){
    let d=null;
    for(const o of pool){if(used.has(o.uid))continue;d=tryObj(o,lvl);if(d){used.add(o.uid);break;}}
    if(!d)for(const o of pool){if(used.has(o.uid))continue;d=tryObj(o,null);if(d){used.add(o.uid);break;}}
    if(d)out.push(d);
  }
  return out;
}
function buildScene(idx){
  const seed=4049+idx*7919,r=mulberry32(seed),key=THEME_ORDER[idx%THEME_ORDER.length],T=THEMES[key];
  const bg=T.bg(r),objs=[];
  for(const[zone,[n0,n1],caps]of T.fill){
    const n=rint(r,n0,n1),left=Object.assign({},caps);
    for(let k=0;k<n;k++){
      const types=Object.keys(left).filter(t=>left[t]>0);if(!types.length)break;
      const type=pick(r,types),o=place(r,T,zone,type,objs);
      if(o){objs.push(o);left[type]--;}else left[type]=0;
    }
  }
  objs.sort((a,b)=>ZORDER[a.zone]-ZORDER[b.zone]||a.y-b.y);
  objs.forEach((o,i)=>o.uid=i);
  const diffs=chooseDiffs(r,objs),byObj={};
  diffs.forEach(d=>byObj[d.obj]=d);
  return{idx,seed,theme:key,themeName:T.name,bg,objs,diffs,byObj};
}
const sceneCache={};
const getScene=i=>sceneCache[i]||(sceneCache[i]=buildScene(i));

/* ===================== rendering ===================== */
function objSVG(o,d){
  let x=o.x,s=o.s,fx=1,p=o.p,rot=0;
  if(d)switch(d.kind){
    case"remove":return"";
    case"part":case"tint":p=d.bp;break;
    case"shift":case"nudge":x+=d.dx;break;
    case"flip":fx=-1;break;
    case"size":s*=.72;break;
    case"shrink":s*=.86;break;
    case"tilt":rot=d.rot;break;
  }
  return`<g transform="translate(${f1(x)} ${f1(o.y)}) rotate(${rot}) scale(${(s*fx).toFixed(3)} ${s.toFixed(3)})">${TYPES[o.type].draw(p)}</g>`;
}
function sceneSVG(sc,which,ov=""){
  let s=sc.bg;for(const o of sc.objs)s+=objSVG(o,which==="B"?sc.byObj[o.uid]:null);
  return`<svg viewBox="0 0 600 400" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${which==="A"?"First":"Second"} picture">${s}${ov}</svg>`;
}
const ring=(x,y,r,c,dash)=>`<circle cx="${x}" cy="${y}" r="${f1(r)}" fill="none" stroke="#ffffff" stroke-width="6" opacity=".85"/><circle cx="${x}" cy="${y}" r="${f1(r)}" fill="none" stroke="${c}" stroke-width="3"${dash?' stroke-dasharray="6 4"':""}/>`;
const cross=(x,y)=>`<path d="M${x-6} ${y-6}L${x+6} ${y+6}M${x+6} ${y-6}L${x-6} ${y+6}" stroke="#ffffff" stroke-width="6" stroke-linecap="round" opacity=".8"/><path d="M${x-6} ${y-6}L${x+6} ${y+6}M${x+6} ${y-6}L${x-6} ${y+6}" stroke="#343a40" stroke-width="3" stroke-linecap="round"/>`;
function foundOverlay(sc,found,debug=false){
  let o="";
  for(const d of sc.diffs){
    if(found.includes(d.id))for(const[x,y,r]of d.hits)o+=ring(x,y,r+3,"#e03131",false);
    else if(debug)for(const[x,y,r]of d.hits)o+=`<circle cx="${x}" cy="${y}" r="${r}" fill="rgba(255,0,0,.12)" stroke="red" stroke-width="1"/>`;
  }
  return o;
}
function reviewOverlay(sc,found,misses){
  let o="";
  for(const d of sc.diffs){const got=found.includes(d.id);for(const[x,y,r]of d.hits)o+=ring(x,y,r+3,got?"#2f9e44":"#e03131",!got);}
  for(const m of misses)o+=cross(m.x,m.y);
  return o;
}
function answerOverlay(sc){let o="";for(const d of sc.diffs)for(const[x,y,r]of d.hits)o+=ring(x,y,r+3,"#e8590c",false);return o;}

export const FIXED_PICTURES = 15
export { mulberry32, shuffle, f1, getScene, sceneSVG, foundOverlay, reviewOverlay, answerOverlay }
