# Claude Code Briefing — Hair Styles for Avatar System

## Before you start
Run `git log --oneline -5`, show me the output, and confirm the correct commit
to reset to before beginning any work.

---

## Objective
Add hair style + colour support to the avatar system.
**Hair only** — nose, mouth, marks are separate work.

## Architecture
SVG path data lives in asset files, never inside components:

```
src/
  assets/
    hair/
      hairDraw.js     ← all draw functions + SVG constants (provided below)
      hairStyles.js   ← catalog + colour swatches (provided below)
  components/
    avatar/
      BaseAvatar.jsx  ← add hair props + two ref <g> elements
      AvatarEditor.jsx ← add hair style + colour picker
```

---

## Step 1 — Create asset files

Create these two files verbatim:

### `src/assets/hair/hairDraw.js`
See `hairDraw.js` attached (140,982 chars). Create this file exactly as provided.

### `src/assets/hair/hairStyles.js`
See `hairStyles.js` attached (1,616 chars). Create this file exactly as provided.

---

## Step 2 — Database migration

```sql
ALTER TABLE avatars
  ADD COLUMN IF NOT EXISTS hair_style TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS hair_color TEXT DEFAULT '#784421';
```

---

## Step 3 — BaseAvatar.jsx

### New props
```js
hairStyle = 'none',
hairColor = '#784421',
```

### Imports
```js
import { drawHairBack, drawHairFront } from '../../assets/hair/hairDraw';
import { HAIR_BACK_STYLES } from '../../assets/hair/hairStyles';
```

### Inside the component
```js
const hC = hairColor;
const hD = hairColor; // darken slightly if desired
const needsBack = HAIR_BACK_STYLES.includes(hairStyle);
```

### In JSX — add two ref elements inside `<svg>`, in this render order:
```jsx
{/* 1. Hair back — behind head */}
{hairStyle !== 'none' && needsBack && (
  <g key={`hb-${hairStyle}-${hairColor}`}
     ref={el => {
       if (!el) return;
       while (el.firstChild) el.removeChild(el.firstChild);
       drawHairBack(el, hairStyle, hC, hD);
     }} />
)}

{/* 2. Head ellipse, ears, eyes, nose, mouth, blush — existing JSX unchanged */}

{/* 3. Hair front — over face */}
{hairStyle !== 'none' && (
  <g key={`hf-${hairStyle}-${hairColor}`}
     ref={el => {
       if (!el) return;
       while (el.firstChild) el.removeChild(el.firstChild);
       drawHairFront(el, hairStyle, hC, hD, `hf${el._uid || (el._uid = Math.random().toString(36).slice(2,6))}`);
     }} />
)}
```

The `key` prop forces React to remount (and re-draw) when style or colour changes.

---

## Step 4 — AvatarEditor.jsx

### Imports
```js
import { HAIR_STYLES, HAIR_COLORS } from '../../assets/hair/hairStyles';
```

### Hair style picker (use existing StyleChip pattern)
```jsx
<EditorSection title="Hair Style">
  <div className="style-grid">
    {HAIR_STYLES.map(s => (
      <StyleChip
        key={s.id}
        label={s.label}
        selected={avatar.hair_style === s.id}
        onClick={() => updateAvatar({ hair_style: s.id })}
      />
    ))}
  </div>
</EditorSection>
```

### Hair colour picker (use existing skin-tone swatch pattern)
```jsx
<EditorSection title="Hair Colour">
  <SwatchPicker
    colors={HAIR_COLORS}
    value={avatar.hair_color}
    onChange={c => updateAvatar({ hair_color: c })}
  />
</EditorSection>
```

---

## Notes
- `drawHairFront` takes a 5th arg `uid` — used for SVG mask ID namespacing in the
  bunbeard style. The `el._uid` trick above gives a stable per-element ID.
- The `mk()` helper inside hairDraw.js uses `document.createElementNS` — this is
  browser-only. It's called inside ref callbacks (client-side only), so SSR is safe
  as long as refs don't fire server-side (they don't in React).
- Do not import hairDraw.js at module level in an SSR context — use dynamic import
  inside a useEffect if needed.
