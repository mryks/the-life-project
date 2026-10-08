# Handcrafted Doodle Design Tokens & Techniques

## 1. Organic Wobbly Border Radii (CSS)
Use these organic border radii to give cards a natural, hand-drawn paper look:
```css
/* Organic Card Box 1 */
border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
border: 2px solid #2C2A26;

/* Organic Card Box 2 (Subtle) */
border-radius: 20px 255px 20px 25px / 255px 20px 25px 255px;

/* Stamp / Badge */
border-radius: 50% 45% 52% 48% / 48% 52% 47% 53%;
```

## 2. Hand-Drawn Color Palettes (Warm Light)
- **Base Canvas**: `#FAF7EE` (Warm Rice Paper) / `#FBF9F5` (Oat Milk)
- **Surface Paper**: `#FFFFFF` (Clean Sheet) / `#FFFDF9` (Ivory Card)
- **Graphite / Charcoal Ink**: `#2C2A26` (Primary Text) / `#635E54` (Pencil Gray)
- **Income Accent**: `#4A7C59` (Sage Leaf Green) / `#3B8A5A`
- **Expense Accent**: `#C85A48` (Terracotta / Clay Red) / `#D9534F`
- **Highlighter Accent**: `#FDE68A` (Yellow Highlighter) / `#FED7AA` (Peach)
- **Washi Tape Accents**: `#E2E8F0` (Muted Blue Tape), `#FEF08A` (Soft Lemon Tape)

## 3. Handwriting Font Imports (Google Fonts)
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=Patrick+Hand&family=Plus+Jakarta+Sans:wght@500;600;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
```

## 4. SVG Doodle Snippets
- **Hand-drawn Underline**: An SVG path with subtle bezier curves (`d="M 5,15 Q 100,5 200,14 Q 300,22 400,12"`).
- **Hand-drawn Circle/Scribble**: Rough loop around important numbers.
- **Washi Tape Effect**: A rectangular div with `transform: rotate(-2deg); background: rgba(254, 240, 138, 0.7);` placed on the top edge of cards.
