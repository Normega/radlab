import { useState, useEffect, useRef } from "react";

// World is scaled to 0.36× original so 2 spots ahead always fit in view.
// Mouse sits at 15% from left — looking fearfully forward.
const BARN_WIDTH = 1250;
const OFFSET = 0.15; // mouse position as fraction of viewport width

// Evenly spaced: 101 to 1091, 9 gaps of ~110px
const objects = [
  { id: 0,  name: "Back wall",      x: 22,   type: "start",     w: 0,   h: 0   },
  { id: 1,  name: "Hay bunch",      x: 101,  type: "hay_small", w: 48,  h: 26  },
  { id: 2,  name: "Worn boot",      x: 211,  type: "boot",      w: 43,  h: 35  },
  { id: 3,  name: "Wooden bucket",  x: 321,  type: "bucket",    w: 39,  h: 41  },
  { id: 4,  name: "Coil of rope",   x: 431,  type: "rope",      w: 48,  h: 28  },
  { id: 5,  name: "Hay bale",       x: 541,  type: "hay_large", w: 72,  h: 47  },
  { id: 6,  name: "Clay pot",       x: 651,  type: "pot",       w: 36,  h: 40  },
  { id: 7,  name: "Rusted lantern", x: 761,  type: "lantern",   w: 30,  h: 48  },
  { id: 8,  name: "Wooden crate",   x: 871,  type: "crate",     w: 60,  h: 53  },
  { id: 9,  name: "Burlap sacking", x: 981,  type: "burlap",    w: 66,  h: 35  },
  { id: 10, name: "Barn door",      x: 1091, type: "door",      w: 84,  h: 120 },
];

const owlPairs = [
  { x: 166, y: 46 }, { x: 295, y: 30 }, { x: 424, y: 54 },
  { x: 561, y: 36 }, { x: 709, y: 48 }, { x: 876, y: 34 },
  { x: 999, y: 50 }, { x: 1110, y: 42 },
];

const beams = [137, 280, 425, 568, 712, 856, 1000, 1115];



function ObjShape({ type, isCurrent }) {
  const glow = isCurrent
    ? "drop-shadow(0 0 10px rgba(245,200,66,0.65)) drop-shadow(0 0 3px rgba(245,200,66,0.5))"
    : "none";
  const s = { filter: glow, position: "relative" };

  if (type === "hay_small")
    return (
      <div style={{ ...s, width: 48, height: 26, background: "linear-gradient(160deg,#7a5a1a,#5a3e0e)", borderRadius: "3px 3px 0 0" }}>
        {[5,14,23,32,40].map((x,i) => (
          <div key={i} style={{ position:"absolute", left:x, top:2+i%2*4, width:2, height:20, background:"rgba(200,160,60,0.45)", transform:"rotate(4deg)" }} />
        ))}
      </div>
    );

  if (type === "boot")
    return (
      <div style={{ ...s, width: 43, height: 35 }}>
        <div style={{ position:"absolute", bottom:0, left:2, width:38, height:11, background:"#241a0c", borderRadius:"0 0 8px 5px" }} />
        <div style={{ position:"absolute", bottom:9, left:2, width:19, height:24, background:"#1e160a", borderRadius:"3px 3px 0 0" }} />
        <div style={{ position:"absolute", bottom:17, left:21, width:14, height:5, background:"#2a1e10", borderRadius:"0 3px 3px 0" }} />
      </div>
    );

  if (type === "bucket")
    return (
      <div style={{ ...s, width: 39, height: 41 }}>
        <div style={{ position:"absolute", bottom:0, left:0, width:35, height:34, background:"linear-gradient(160deg,#3e2a14,#261a08)", borderRadius:"0 0 6px 6px", transform:"rotate(-5deg)" }} />
        <div style={{ position:"absolute", top:5, left:-1, width:38, height:5, background:"#1c1208", borderRadius:2 }} />
      </div>
    );

  if (type === "rope")
    return (
      <div style={{ ...s, width: 48, height: 28 }}>
        <div style={{ width:44, height:24, borderRadius:"50%", border:"8px solid #4a3218", boxSizing:"border-box" }} />
        <div style={{ position:"absolute", top:9, left:37, width:12, height:4, background:"#3a2810", borderRadius:2, transform:"rotate(-20deg)" }} />
      </div>
    );

  if (type === "hay_large")
    return (
      <div style={{ ...s, width: 72, height: 47, background: "linear-gradient(160deg,#8a6820,#6a4e14)", borderRadius: 3 }}>
        {[5,14,23,32,41,52,62].map((x,i) => (
          <div key={i} style={{ position:"absolute", left:x, top:2+i%2*6, width:2, height:40, background:"rgba(200,160,60,0.38)" }} />
        ))}
      </div>
    );

  if (type === "pot")
    return (
      <div style={{ ...s, width: 36, height: 40 }}>
        <div style={{ position:"absolute", bottom:0, left:2, width:32, height:37, background:"linear-gradient(160deg,#5a4030,#3a2820)", borderRadius:"36% 36% 16% 16%", transform:"rotate(-7deg)" }} />
        <div style={{ position:"absolute", top:7, left:1, width:32, height:2, background:"rgba(100,70,50,0.7)", transform:"rotate(-7deg)" }} />
      </div>
    );

  if (type === "lantern")
    return (
      <div style={{ ...s, width: 30, height: 48 }}>
        <div style={{ position:"absolute", top:0, left:12, width:6, height:9, background:"#1a1408" }} />
        <div style={{ position:"absolute", top:7, left:6, width:18, height:5, background:"#1e1a10", borderRadius:"2px 2px 0 0" }} />
        <div style={{ position:"absolute", top:11, left:5, width:20, height:31, background:"#221a0e", border:"2px solid #1a1208", borderRadius:"1px 1px 3px 3px" }} />
        <div style={{ position:"absolute", top:14, left:8, width:14, height:22, background:"rgba(20,14,6,0.85)", borderRadius:2 }} />
        {[17,24,31].map((y,i) => (
          <div key={i} style={{ position:"absolute", top:y, left:5, width:20, height:1, background:"rgba(10,8,4,0.7)" }} />
        ))}
      </div>
    );

  if (type === "crate")
    return (
      <div style={{ ...s, width: 60, height: 53 }}>
        <div style={{ position:"absolute", bottom:0, left:0, width:55, height:50, background:"linear-gradient(135deg,#3a2810,#261a08)", border:"1px solid #1c1208" }}>
          {[13,28,42].map((x,i) => (
            <div key={i} style={{ position:"absolute", left:x, top:0, width:2, height:"100%", background:"rgba(10,6,2,0.55)" }} />
          ))}
          {[14,28].map((y,i) => (
            <div key={i} style={{ position:"absolute", left:0, top:y, width:"100%", height:2, background:"rgba(10,6,2,0.55)" }} />
          ))}
        </div>
        <div style={{ position:"absolute", bottom:48, left:-4, width:46, height:7, background:"#2e2008", transform:"rotate(-8deg)", transformOrigin:"right center" }} />
      </div>
    );

  if (type === "burlap")
    return (
      <div style={{ ...s, width: 66, height: 35, background:"linear-gradient(160deg,#4a3820,#342810)", borderRadius:"20px 20px 7px 7px" }}>
        {[11,22,34,46].map((x,i) => (
          <div key={i} style={{ position:"absolute", top:5, left:x, width:1, height:25, background:"rgba(80,58,28,0.45)" }} />
        ))}
        <div style={{ position:"absolute", top:4, left:"50%", transform:"translateX(-50%)", width:18, height:4, background:"#3a2a18", borderRadius:2 }} />
      </div>
    );

  if (type === "door")
    return (
      <div style={{ ...s, width: 84, height: 120 }}>
        <div style={{ position:"absolute", bottom:0, left:0, width:78, height:120, background:"linear-gradient(to right,#1a1008,#0d0905 40%,#0a0704)", border:"2px solid #241a0a" }}>
          {[0,14,28,42,56,70,84,98,112].map((y,i) => (
            <div key={i} style={{ position:"absolute", left:0, top:y, width:"100%", height:1, background:"rgba(36,26,10,0.7)" }} />
          ))}
          <div style={{ position:"absolute", inset:0, background:"linear-gradient(to right,transparent 20%,rgba(100,140,180,0.07) 60%,transparent)" }} />
          <div style={{ position:"absolute", top:"40%", right:13, width:5, height:5, borderRadius:"50%", background:"#3a3020" }} />
        </div>
      </div>
    );

  return null;
}

export default function OwlBarnMap() {
  const [step, setStep] = useState(0);
  const [moving, setMoving] = useState(false);
  const viewRef = useRef(null);
  const [vw, setVw] = useState(390);

  useEffect(() => {
    const update = () => viewRef.current && setVw(viewRef.current.offsetWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const cur = objects[step];
  const mouseX = step === 0 ? cur.x + 20 : cur.x + Math.round(cur.w * 0.4);
  const camRaw = mouseX - vw * OFFSET;
  const camX = Math.max(0, Math.min(BARN_WIDTH - vw, camRaw));

  const advance = () => {
    if (step < 10 && !moving) {
      setMoving(true);
      setTimeout(() => { setStep(s => s + 1); setMoving(false); }, 420);
    }
  };
  const back = () => { if (step > 0 && !moving) setStep(s => s - 1); };

  // How far ahead can we see from current position?
  const visibleRightEdge = camX + vw;
  const visibleSpots = objects.filter(o => o.id > step && o.x <= visibleRightEdge);

  return (
    <div style={{ background:"#060402", minHeight:"100vh", display:"flex", flexDirection:"column", fontFamily:"'Space Mono', monospace", color:"#d4b896" }}>

      {/* Header */}
      <div style={{ padding:"14px 18px", borderBottom:"1px solid #160e04", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:10, letterSpacing:"0.16em", textTransform:"uppercase", opacity:0.5 }}>Owl Barn — Level Map</span>
        <span style={{ fontSize:10, letterSpacing:"0.1em", color:"#f5c842", opacity:0.8 }}>
          {step === 0 ? "START" : step === 10 ? "BARN DOOR" : `Spot ${step} / 9`}
        </span>
      </div>

      {/* Visibility debug strip */}
      <div style={{ padding:"6px 18px", background:"#080502", borderBottom:"1px solid #120a02", fontSize:9, opacity:0.45, letterSpacing:"0.08em" }}>
        Visible ahead: {visibleSpots.length > 0
          ? visibleSpots.map(s => `${s.id} (${s.name})`).join(", ")
          : step === 10 ? "—" : "none yet"}
      </div>

      {/* Viewport */}
      <div ref={viewRef} style={{ position:"relative", overflow:"hidden", height:300, flexShrink:0 }}>
        <div style={{
          position:"absolute", width:BARN_WIDTH, height:300,
          transform:`translateX(${-camX}px)`,
          transition:`transform ${moving?"0.42s":"0.55s"} cubic-bezier(0.4,0,0.2,1)`,
        }}>

          {/* Sky */}
          <div style={{ position:"absolute", top:0, left:0, right:0, height:140, background:"linear-gradient(to bottom,#080502 0%,#0d0905 60%,transparent 100%)" }} />

          {/* Wall planks */}
          {Array.from({length: Math.ceil(BARN_WIDTH/38)}).map((_,i) => (
            <div key={i} style={{ position:"absolute", top:0, left:i*38, width:1, height:240, background:"rgba(20,12,4,0.5)" }} />
          ))}

          {/* Horizontal rafters */}
          {[0,280,560,840,1120].map((x,i) => (
            <div key={i} style={{ position:"absolute", top:14, left:x, width:290, height:7, background:"#150e04", boxShadow:"0 2px 8px rgba(0,0,0,0.9)" }} />
          ))}

          {/* Vertical beams */}
          {beams.map((x,i) => (
            <div key={i} style={{ position:"absolute", top:20, left:x-9, width:18, height:185, background:"linear-gradient(to right,#0e0804,#1c1208,#0e0804)", boxShadow:"2px 0 8px rgba(0,0,0,0.7)" }} />
          ))}

          {/* Moonlight shafts */}
          {[108,324,540,756,972].map((x,i) => (
            <div key={i} style={{ position:"absolute", top:0, left:x, width:16, height:260, background:"linear-gradient(to bottom,rgba(140,170,210,0.06),transparent)", transform:"rotate(2deg)" }} />
          ))}

          {/* Owl eyes */}
          {owlPairs.map((owl,i) => (
            <div key={i} style={{ position:"absolute", left:owl.x, top:owl.y, display:"flex", gap:8 }}>
              {[0,1].map(j => (
                <div key={j} style={{
                  width:6, height:6, borderRadius:"50%",
                  background:"#c97800",
                  boxShadow:"0 0 4px 2px #a05500, 0 0 9px 3px rgba(160,85,0,0.25)",
                  animation:`blink ${3.2+i*0.45}s ease-in-out infinite`,
                  animationDelay:`${i*0.55+j*0.07}s`
                }} />
              ))}
            </div>
          ))}

          {/* Floor */}
          <div style={{ position:"absolute", bottom:0, left:0, right:0, height:100, background:"linear-gradient(to top,#180c04 0%,#100804 40%,transparent 100%)" }} />
          {Array.from({length: Math.ceil(BARN_WIDTH/42)}).map((_,i) => (
            <div key={i} style={{ position:"absolute", bottom:0, left:i*42, width:1, height:75, background:"rgba(24,14,4,0.65)" }} />
          ))}

          {/* Paw trail */}
          {step > 0 && Array.from({length: step}).map((_,i) => {
            const a = objects[i]; const b = objects[i+1];
            return [0.35, 0.65].map((t,j) => (
              <div key={`${i}-${j}`} style={{ position:"absolute", bottom:56, left:a.x+(b.x-a.x)*t, fontSize:8, opacity:0.18, color:"#d4b896" }}>🐾</div>
            ));
          })}

          {/* Hiding objects */}
          {objects.slice(1).map(obj => (
            <div key={obj.id} style={{
              position:"absolute",
              bottom: obj.type === "door" ? 34 : 44,
              left: obj.x,
            }}>
              <ObjShape type={obj.type} isCurrent={obj.id === step} />
              <div style={{
                position:"absolute", bottom:-14, left:"50%", transform:"translateX(-50%)",
                fontSize:8, letterSpacing:"0.05em", whiteSpace:"nowrap",
                color: obj.id === step ? "#f5c842" : obj.id < step ? "rgba(212,184,150,0.25)" : "rgba(212,184,150,0.18)"
              }}>
                {obj.type === "door" ? "EXIT" : obj.id}
              </div>
            </div>
          ))}

          {/* Mouse */}
          <div style={{
            position:"absolute", bottom:49, left:mouseX-12,
            transition:`left 0.42s cubic-bezier(0.4,0,0.2,1)`,
            fontSize:20,
            filter:"drop-shadow(0 0 7px rgba(245,200,66,0.35))",
            zIndex:10
          }}>🐭</div>

          {/* Dust motes */}
          {[140,420,700,980,1140].map((x,i) => (
            <div key={i} style={{
              position:"absolute", left:x, top:48+(i%4)*22,
              width:2, height:2, borderRadius:"50%",
              background:"rgba(255,215,140,0.35)",
              animation:`mote ${2.8+i*0.3}s ease-in-out infinite`,
              animationDelay:`${i*0.4}s`
            }} />
          ))}
        </div>

        {/* Offset guideline (faint) */}
        <div style={{ position:"absolute", top:0, left:vw*OFFSET, width:1, height:"100%", background:"rgba(245,200,66,0.05)", pointerEvents:"none" }} />
      </div>

      {/* Controls */}
      <div style={{ padding:"16px 18px 8px", display:"flex", gap:12, justifyContent:"center", alignItems:"center" }}>
        <button onClick={back} disabled={step===0} style={{
          background:"transparent", border:"1px solid rgba(212,184,150,0.18)",
          color:step===0?"rgba(212,184,150,0.18)":"#d4b896",
          padding:"7px 16px", fontSize:10, letterSpacing:"0.12em",
          cursor:step===0?"default":"pointer", fontFamily:"inherit"
        }}>← BACK</button>
        <div style={{ fontSize:10, opacity:0.4, minWidth:130, textAlign:"center", letterSpacing:"0.06em" }}>
          {objects[step].name.toUpperCase()}
        </div>
        <button onClick={advance} disabled={step===10} style={{
          background:step===10?"transparent":"rgba(245,200,66,0.07)",
          border:`1px solid ${step===10?"rgba(212,184,150,0.18)":"rgba(245,200,66,0.35)"}`,
          color:step===10?"rgba(212,184,150,0.18)":"#f5c842",
          padding:"7px 16px", fontSize:10, letterSpacing:"0.12em",
          cursor:step===10?"default":"pointer", fontFamily:"inherit"
        }}>ADVANCE →</button>
      </div>

      {/* Progress bar */}
      <div style={{ padding:"4px 18px 14px" }}>
        <div style={{ height:2, background:"rgba(212,184,150,0.07)", position:"relative" }}>
          <div style={{ height:"100%", width:`${(step/10)*100}%`, background:"linear-gradient(to right,#7a2800,#f5c842)", transition:"width 0.42s ease", boxShadow:"0 0 7px rgba(245,200,66,0.45)" }} />
          {objects.slice(1).map(obj => (
            <div key={obj.id} style={{ position:"absolute", top:-3, left:`${(obj.id/10)*100}%`, width:2, height:8, background:obj.id<=step?"#f5c842":"rgba(212,184,150,0.22)", transform:"translateX(-50%)" }} />
          ))}
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:5, fontSize:8, opacity:0.28, letterSpacing:"0.1em" }}>
          <span>BACK WALL</span><span>BARN DOOR</span>
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%,86%,100%{opacity:1} 93%{opacity:0.07} }
        @keyframes mote  { 0%,100%{transform:translateY(0);opacity:0.35} 50%{transform:translateY(-12px);opacity:0.1} }
      `}</style>
    </div>
  );
}
