// ─── Tune — mechanic constants + scene definitions ─────────────────────────────
// Auditory sibling to Delve: dwell near a sound "anchor" and it clarifies as the
// rest of the mix ducks away. Ported from the reviewed prototype
// (scratchpad/tune_prototype.html). Real clips are BBC Sound Effects (RemArc);
// music scenes (♪) are procedurally synthesised with the Web Audio API.

// Mechanic (matches the handoff spec + Delve's dwell model)
export const DWELL_VELOCITY = 55        // px/s below which the pointer counts as dwelling
export const INFLUENCE_RADIUS = 172     // px
export const GROWTH_RATE = 0.9          // clarity/sec while dwelling in range
export const DECAY_RATE  = 0.5          // clarity/sec otherwise
export const FREQ_MUFFLED = 520         // lowpass Hz at clarity 0 (resting haze brightness)

// Attention model: a voice stands out by DUCKING the others, not by boosting
// itself. Each voice sits at its resting level (rest); focusing a voice raises the
// attention peak A and attenuates every other voice by how far its clarity sits
// below A. The focused voice keeps its resting gain and only brightens.
export const DUCK_DEPTH = 0.82
export const DUCK_FLOOR = 0.14

// Audio delivery: clips live in the public `public-assets` Supabase Storage
// bucket under tune-audio/ (same bucket Delve uses for backgrounds). The public
// URL is built in Tune.jsx via supabase.storage.getPublicUrl(). Upload the 31
// clips with scripts/upload-tune-audio.mjs before this game will play.
export const AUDIO_BUCKET = 'public-assets'
export const audioPath = (id) => `tune-audio/${id}.mp3`

// ─── Scenes ─────────────────────────────────────────────────────────────────
// kind: realCont | realEvent | procCont | procEvent
// pos: [x,y] viewport fractions. rest: resting mix level. freqClear: lowpass Hz
// at clarity 1. Events: iv=base interval(s), jit=jitter frac, slice=seconds per
// call, density=true scales rate with clarity. Music scenes carry music:{bpm,steps}
// and procEvent voices carry an 8-step pattern (freq per step, 0=rest, 1=fixed).
export const SCENES = [
  { key:'woodland', label:'Woodland', accent:'#7fd39a',
    blurb:'English wood at mid-morning',
    voices:[
      { name:'Blackbird', kind:'realEvent', id:'NHU05096015', pos:[.24,.34], rest:.40, freqClear:11000, iv:5, jit:.5, slice:3.2 },
      { name:'Wren', kind:'realEvent', id:'NHU05085203', pos:[.70,.28], rest:.38, freqClear:12000, iv:6.5, jit:.5, slice:3.4 },
      { name:'Wood pigeon', kind:'realEvent', id:'NHU05040045', pos:[.44,.62], rest:.34, freqClear:5200, iv:8, jit:.4, slice:4.5 },
      { name:'Cuckoo', kind:'realEvent', id:'NHU05084193', pos:[.82,.60], rest:.42, freqClear:4200, iv:13, jit:.35, slice:2.4 },
      { name:'Stream', kind:'realCont', id:'NHU05075046', pos:[.16,.74], rest:.66, freqClear:3400 },
      { name:'Wind in trees', kind:'realCont', id:'07005205', pos:[.60,.80], rest:.54, freqClear:3200 },
    ]},

  { key:'marketplace', label:'Marketplace', accent:'#e0b26a',
    blurb:'a street market — with a busker (synth)',
    voices:[
      { name:'Footsteps', kind:'realEvent', id:'07041187', pos:[.22,.40], rest:.36, freqClear:6000, iv:6, jit:.5, slice:3.0 },
      { name:'Pony & cart', kind:'realEvent', id:'07000027', pos:[.72,.36], rest:.40, freqClear:4800, iv:11, jit:.4, slice:4.2 },
      { name:'Stall bell', kind:'realEvent', id:'07012071', pos:[.50,.24], rest:.42, freqClear:13000, iv:12, jit:.4, slice:3.0 },
      { name:'Crowd murmur', kind:'realCont', id:'0009021', pos:[.40,.68], rest:.60, freqClear:3000 },
      { name:'Church bell', kind:'realEvent', id:'07061005', pos:[.84,.66], rest:.50, freqClear:6500, iv:22, jit:.25, slice:5.0 },
      { name:'Busker', kind:'procEvent', synth:'busker', pos:[.20,.74], rest:.42, freqClear:5000, iv:5.5, jit:.15 },
    ]},

  { key:'wildnight', label:'Wild Night', accent:'#8fb0e6',
    blurb:'wetland edge after dark',
    voices:[
      { name:'Crickets', kind:'realCont', id:'NHU05079181', pos:[.30,.72], rest:.56, freqClear:9000 },
      { name:'Frogs', kind:'realEvent', id:'NHU05079035', pos:[.68,.70], rest:.42, freqClear:5500, iv:5, minIv:0.9, density:true, jit:.5, slice:2.4 },
      { name:'Owl', kind:'realEvent', id:'NHU05085238', pos:[.24,.30], rest:.48, freqClear:3600, iv:16, jit:.35, slice:4.0 },
      { name:'Loon (diver)', kind:'realEvent', id:'07044094', pos:[.78,.30], rest:.52, freqClear:4200, iv:24, jit:.3, slice:5.5 },
      { name:'Wolf', kind:'realEvent', id:'NHU05081095', pos:[.50,.50], rest:.52, freqClear:2800, iv:30, jit:.3, slice:6.0 },
      { name:'Night breeze', kind:'realCont', id:'07047147', pos:[.52,.84], rest:.50, freqClear:2800 },
    ]},

  { key:'tideline', label:'Tideline ♪', accent:'#6fd0d0',
    blurb:'a shore, with a slow synth pad woven through',
    voices:[
      { name:'Waves', kind:'realCont', id:'NHU05017165', pos:[.28,.74], rest:.62, freqClear:3200 },
      { name:'Gull', kind:'realEvent', id:'NHU05056200', pos:[.30,.30], rest:.42, freqClear:9000, iv:9, jit:.5, slice:2.4 },
      { name:'Curlew', kind:'realEvent', id:'NHU05073017', pos:[.74,.32], rest:.40, freqClear:8000, iv:15, jit:.4, slice:3.0 },
      { name:'Sea breeze', kind:'realCont', id:'07061034', pos:[.66,.80], rest:.50, freqClear:3000 },
      { name:'Ocean pad', kind:'procCont', synth:'pad', chord:[220,277.18,329.63], pos:[.48,.46], rest:.46, freqClear:1500 },
      { name:'Sea bells', kind:'procEvent', synth:'bell', pos:[.82,.60], rest:.44, freqClear:11000, iv:7, jit:.5, note:[587.33,880,988,1174.66] },
    ]},

  { key:'rainforest', label:'Rainforest', accent:'#3fbf8a',
    blurb:'humid tropical forest by day',
    voices:[
      { name:'Cicada chorus', kind:'realCont', id:'NHU05080056', pos:[.30,.72], rest:.56, freqClear:9000 },
      { name:'Rain on leaves', kind:'realCont', id:'NHU05032131', pos:[.66,.78], rest:.50, freqClear:4200 },
      { name:'Toucan', kind:'realEvent', id:'NHU05005151', pos:[.24,.32], rest:.42, freqClear:9000, iv:10, jit:.5, slice:3.0 },
      { name:'Gibbon', kind:'realEvent', id:'NHU05072171', pos:[.52,.44], rest:.48, freqClear:5000, iv:17, jit:.4, slice:5.0 },
      { name:'Hornbill', kind:'realEvent', id:'NHU05069096', pos:[.80,.34], rest:.44, freqClear:6000, iv:14, jit:.4, slice:3.5 },
      { name:'Frog', kind:'realEvent', id:'NHU05079035', pos:[.44,.64], rest:.40, freqClear:5500, iv:6, minIv:1.1, density:true, jit:.5, slice:2.4 },
    ]},

  { key:'cafe', label:'Café', accent:'#d2a25f',
    blurb:'a warm coffee house — with piano (synth)',
    voices:[
      { name:'Chatter', kind:'realCont', id:'07011340', pos:[.40,.70], rest:.58, freqClear:2800 },
      { name:'Espresso machine', kind:'realEvent', id:'07011346', pos:[.22,.40], rest:.44, freqClear:6000, iv:12, jit:.4, slice:4.0 },
      { name:'Crockery', kind:'realEvent', id:'07067001', pos:[.70,.36], rest:.42, freqClear:12000, iv:7, jit:.5, slice:3.0 },
      { name:'Coffee grinder', kind:'realEvent', id:'07042262', pos:[.80,.66], rest:.40, freqClear:5000, iv:16, jit:.35, slice:3.5 },
      { name:'Till', kind:'realEvent', id:'07040187', pos:[.50,.24], rest:.44, freqClear:9000, iv:20, jit:.3, slice:3.0 },
      { name:'Café piano', kind:'procEvent', synth:'epiano', pos:[.22,.74], rest:.44, freqClear:6000, iv:4.5, jit:.2, note:[523.25,587.33,659.25,783.99,880,659.25] },
    ]},

  { key:'reverie', label:'Reverie ♪', accent:'#c79ae6',
    blurb:'an all-synth musical scene (A minor pentatonic, 64 BPM)',
    music:{ bpm:64, steps:8 },
    voices:[
      { name:'Pad', kind:'procCont', synth:'pad', pos:[.30,.40], rest:.50, freqClear:1500 },
      { name:'Drone', kind:'procCont', synth:'drone', pos:[.70,.44], rest:.44, freqClear:900 },
      { name:'Bass', kind:'procEvent', synth:'bass', pos:[.22,.72], rest:.50, freqClear:1400, pattern:[110,0,0,110,0,0,98,0] },
      { name:'Kalimba', kind:'procEvent', synth:'pluck', pos:[.52,.28], rest:.50, freqClear:9000, pattern:[440,0,523.25,0,392,0,659.25,0] },
      { name:'Bells', kind:'procEvent', synth:'bell', pos:[.80,.68], rest:.46, freqClear:12000, pattern:[0,0,0,1046.5,0,0,880,0] },
      { name:'Hand drum', kind:'procEvent', synth:'drum', pos:[.48,.78], rest:.50, freqClear:1800, pattern:[1,0,0,1,0,1,0,0] },
    ]},

  { key:'sunroom', label:'Sunroom ♪', accent:'#e6c15f',
    blurb:'warm major-key lo-fi (C major, 74 BPM)',
    music:{ bpm:74, steps:8 },
    voices:[
      { name:'Keys', kind:'procCont', synth:'warmpad', chord:[261.63,329.63,392,493.88], pos:[.30,.40], rest:.50, freqClear:1900 },
      { name:'Sub', kind:'procCont', synth:'drone', tones:[130.81,196], pos:[.72,.44], rest:.42, freqClear:1000 },
      { name:'Bass', kind:'procEvent', synth:'bass', pos:[.22,.72], rest:.50, freqClear:1400, pattern:[65.41,0,0,65.41,0,49,0,0] },
      { name:'Vibraphone', kind:'procEvent', synth:'bell', pos:[.52,.28], rest:.50, freqClear:11000, pattern:[523.25,0,659.25,0,587.33,0,783.99,0] },
      { name:'E-piano', kind:'procEvent', synth:'epiano', pos:[.80,.68], rest:.48, freqClear:6500, pattern:[329.63,0,392,0,493.88,0,440,0] },
      { name:'Brush kit', kind:'procEvent', synth:'drum', pos:[.48,.80], rest:.46, freqClear:1800, pattern:[1,0,0,1,0,0,1,0] },
    ]},

  { key:'aurora', label:'Aurora ♪', accent:'#8496e0',
    blurb:'slow cinematic minor (D minor, 54 BPM)',
    music:{ bpm:54, steps:8 },
    voices:[
      { name:'Deep pad', kind:'procCont', synth:'pad', chord:[146.83,174.61,220], pos:[.30,.42], rest:.50, freqClear:1400 },
      { name:'Sub drone', kind:'procCont', synth:'drone', tones:[73.42,110], pos:[.70,.46], rest:.46, freqClear:900 },
      { name:'Cello swell', kind:'procEvent', synth:'swell', pos:[.22,.72], rest:.50, freqClear:1600, pattern:[220,0,0,0,174.61,0,0,0] },
      { name:'Harp', kind:'procEvent', synth:'pluck', pos:[.52,.28], rest:.46, freqClear:8000, pattern:[293.66,349.23,440,523.25,440,349.23,293.66,0] },
      { name:'High bell', kind:'procEvent', synth:'bell', pos:[.80,.66], rest:.44, freqClear:12000, pattern:[0,0,0,0,880,0,0,0] },
      { name:'Heartbeat', kind:'procEvent', synth:'drum', pos:[.48,.80], rest:.46, freqClear:1600, pattern:[1,0,0,0,1,0,0,0] },
    ]},

  { key:'gamelan', label:'Gamelan ♪', accent:'#d8b24a',
    blurb:'bright metallic pentatonic (96 BPM)',
    music:{ bpm:96, steps:8 },
    voices:[
      { name:'Shimmer', kind:'procCont', synth:'warmpad', chord:[523.25,659.25,783.99], pos:[.30,.42], rest:.42, freqClear:2200 },
      { name:'Gong', kind:'procEvent', synth:'bell', pos:[.70,.46], rest:.52, freqClear:3000, pattern:[130.81,0,0,0,0,0,0,0] },
      { name:'Metallophone', kind:'procEvent', synth:'metallo', pos:[.22,.30], rest:.50, freqClear:13000, pattern:[523.25,587.33,659.25,783.99,659.25,587.33,523.25,880] },
      { name:'Kotekan', kind:'procEvent', synth:'pluck', pos:[.52,.72], rest:.46, freqClear:10000, pattern:[880,0,783.99,0,880,0,659.25,0] },
      { name:'Kendang', kind:'procEvent', synth:'drum', pos:[.80,.68], rest:.50, freqClear:2000, pattern:[1,0,1,1,0,1,0,1] },
      { name:'Bonang', kind:'procEvent', synth:'metallo', pos:[.46,.20], rest:.46, freqClear:14000, pattern:[0,1046.5,0,0,1174.66,0,0,987.77] },
    ]},
]
