export const EXPRESSION_TABLE = {
  Alert: {
    mild:     { au1:0.33, au2:0.089, au4:0.273, au5:0.25,  au12:0.41,  au15:0,    au20:0.06,  au27:0.53,  au43:0,     sb2:0.383, mouthType:'alert',   pupilTier:2, blush:0.28,  it:0.3   },
    moderate: { au1:0.45, au2:0.179, au4:0.547, au5:0.93,  au12:0.42,  au15:0,    au20:0.651, au27:0.68,  au43:0,     sb2:0.383, mouthType:'alert',   pupilTier:2, blush:0.42,  it:0.24  },
    strong:   { au1:0.85, au2:0.51,  au4:0.82,  au5:1,     au12:0.58,  au15:0,    au20:0.976, au27:0.906, au43:0,     sb2:0.383, mouthType:'alert',   pupilTier:2, blush:0.6,   it:0.05  }
  },
  Excited: {
    mild:     { au1:0.12, au2:0.269, au4:0,     au5:0.449, au12:0.69,  au15:0,    au20:0.3,   au27:1,     au43:0,     sb2:0,     mouthType:'excited', pupilTier:2, blush:0.474, it:0.333 },
    moderate: { au1:0.3,  au2:0.76,  au4:0,     au5:0.598, au12:0.88,  au15:0,    au20:0.63,  au27:1,     au43:0,     sb2:0,     mouthType:'excited', pupilTier:2, blush:0.474, it:0.71  },
    strong:   { au1:0.44, au2:1,     au4:0,     au5:0.748, au12:1,     au15:0,    au20:1,     au27:1,     au43:0,     sb2:0,     mouthType:'excited', pupilTier:2, blush:0.6,   it:1     }
  },
  Good: {
    mild:     { au1:0,    au2:0.148, au4:0,     au5:0.229, au12:0.24,  au15:0,    au20:0,     au27:0,     au43:0,     sb2:0,     mouthType:'line',    pupilTier:1, blush:0.438, it:0.333 },
    moderate: { au1:0,    au2:0.295, au4:0,     au5:0.306, au12:0.48,  au15:0,    au20:0,     au27:0,     au43:0,     sb2:0,     mouthType:'line',    pupilTier:0, blush:0.438, it:0.667 },
    strong:   { au1:0,    au2:0.443, au4:0,     au5:0.383, au12:0.97,  au15:0,    au20:0.66,  au27:0,     au43:0,     sb2:0,     mouthType:'line',    pupilTier:1, blush:0.438, it:1     }
  },
  Calm: {
    mild:     { au1:0,    au2:0.095, au4:0,     au5:0.041, au12:0.267, au15:0,    au20:0.09,  au27:0,     au43:0.2,   sb2:0,     mouthType:'line',    pupilTier:0, blush:0.456, it:0.333 },
    moderate: { au1:0,    au2:0.19,  au4:0.29,  au5:0.054, au12:0.533, au15:0,    au20:0.25,  au27:0,     au43:0.3,   sb2:0,     mouthType:'line',    pupilTier:0, blush:0.456, it:0.667 },
    strong:   { au1:0.19, au2:0.285, au4:0.3,   au5:0.068, au12:0.8,   au15:0,    au20:0.4,   au27:0,     au43:0.5,   sb2:0,     mouthType:'line',    pupilTier:0, blush:0.456, it:1     }
  },
  Still: {
    mild:     { au1:0,    au2:0,     au4:0,     au5:0,     au12:0.03,  au15:0,    au20:0.11,  au27:0,     au43:0.438, sb2:0,     mouthType:'line',    pupilTier:0, blush:0.28,  it:0.333 },
    moderate: { au1:0.01, au2:0,     au4:0.05,  au5:0,     au12:0,     au15:0,    au20:0.22,  au27:0,     au43:0.585, sb2:0,     mouthType:'line',    pupilTier:0, blush:0.28,  it:0.667 },
    strong:   { au1:0,    au2:0,     au4:0,     au5:0,     au12:0.04,  au15:0,    au20:0.29,  au27:0,     au43:1,     sb2:0,     mouthType:'line',    pupilTier:0, blush:0.05,  it:1     }
  },
  Sad: {
    mild:     { au1:0.16, au2:0.14,  au4:0.033, au5:0,     au12:0,     au15:0.45, au20:0,     au27:0,     au43:0.37,  sb2:0,     mouthType:'line',    pupilTier:0, blush:0.28,  it:0.333 },
    moderate: { au1:0.61, au2:0.18,  au4:0.29,  au5:0,     au12:0,     au15:0.58, au20:0.27,  au27:0,     au43:0.52,  sb2:0,     mouthType:'line',    pupilTier:0, blush:0.28,  it:0.667 },
    strong:   { au1:0.92, au2:0,     au4:0.98,  au5:0,     au12:0,     au15:0.64, au20:0.73,  au27:0,     au43:0.77,  sb2:0,     mouthType:'line',    pupilTier:0, blush:0.28,  it:1     }
  },
  Bad: {
    mild:     { au1:0.02, au2:0.29,  au4:0.3,   au5:0,     au12:0,     au15:0.36, au20:0,     au27:0,     au43:0.05,  sb2:0,     mouthType:'line',    pupilTier:1, blush:0.28,  it:0.07  },
    moderate: { au1:0,    au2:0.3,   au4:0.4,   au5:0,     au12:0.02,  au15:0.53, au20:0.36,  au27:0,     au43:0.08,  sb2:0,     mouthType:'line',    pupilTier:1, blush:0.28,  it:0.13  },
    strong:   { au1:0.3,  au2:0.86,  au4:0.86,  au5:0,     au12:0.18,  au15:0.83, au20:0.69,  au27:0,     au43:0.12,  sb2:0,     mouthType:'line',    pupilTier:1, blush:0.28,  it:1     }
  },
  Tense: {
    mild:     { au1:0.02, au2:0.23,  au4:0.118, au5:0.26,  au12:0.28,  au15:0.33, au20:0.4,   au27:1,     au43:0,     sb2:0.112, mouthType:'tense',   pupilTier:2, blush:0.28,  it:0.333 },
    moderate: { au1:0.11, au2:0.56,  au4:0.47,  au5:0.56,  au12:0.25,  au15:0,    au20:0.83,  au27:1,     au43:0,     sb2:0.112, mouthType:'tense',   pupilTier:2, blush:0.47,  it:0.667 },
    strong:   { au1:0.09, au2:0.75,  au4:1,     au5:0.97,  au12:0.46,  au15:0.07, au20:1,     au27:1,     au43:0,     sb2:0.112, mouthType:'tense',   pupilTier:2, blush:0.6,   it:1     }
  }
}

export const ZONE_NAMES = ['mild', 'moderate', 'strong']

export const NEUTRAL_POS = { au1:0, au2:0, au4:0, au5:0, au12:0, au15:0, au20:0, au27:0, au43:0, sb2:0, mouthType:'line', pupilTier:1, blush:0.28, it:1 }

export const AU_NUMERIC_KEYS = ['au1', 'au2', 'au4', 'au5', 'au12', 'au15', 'au20', 'au27', 'au43', 'sb2', 'blush', 'it']
