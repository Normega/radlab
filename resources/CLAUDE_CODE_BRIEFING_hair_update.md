# Claude Code Briefing — Add "No Bangs" Hair Style

## Context
The avatar system already has hair support wired up from a previous session
(`hairDraw.js`, `hairStyles.js`, `BaseAvatar.jsx`, `AvatarEditor.jsx`).
This is a one-style addition — no structural changes needed.

## What to do

### 1. Replace two asset files verbatim
Upload and overwrite:
- `src/assets/hair/hairDraw.js` ← provided (hairDraw.js)
- `src/assets/hair/hairStyles.js` ← provided (hairStyles.js)

No other files need to change. The new `nobangs` style is already included
in both files.

### 2. Verify
- Run the dev server and open the avatar editor
- Confirm "No Bangs" appears in the hair style picker
- Confirm it renders correctly on the avatar
- Run existing tests if any

### 3. Commit
```
git add src/assets/hair/hairDraw.js src/assets/hair/hairStyles.js
git commit -m "feat(avatar): add No Bangs hair style"
```

## No database migration needed
`hair_style` column already exists. The new style id `'nobangs'` is a valid
value for the existing TEXT column.
