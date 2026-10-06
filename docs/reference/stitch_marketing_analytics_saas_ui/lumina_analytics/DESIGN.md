---
name: Lumina Analytics
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#45464d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#0b1c30'
  on-tertiary-container: '#75859d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#d3e4fe'
  tertiary-fixed-dim: '#b7c8e1'
  on-tertiary-fixed: '#0b1c30'
  on-tertiary-fixed-variant: '#38485d'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  title-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 22px
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.02em
  data-metric:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.02em
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.25rem
  margin: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 1.75rem
  space-2xl: 2.5rem
---

## Brand & Style

This design system serves an enterprise analytics desktop platform built specifically for educational publishers, marketing directors, and institutional acquisition teams. The aesthetic communicates rigor, authority, and effortless clarity. It moves away from noisy, consumer-facing SaaS trends, anchoring instead in quiet editorial precision and institutional trust.

The visual style is **Corporate / Modern Minimalism**:
- **Purity and Precision:** Clean, hyper-structured whitespaces, 1px crisp borders, and balanced layout architecture eliminate visual debt and cognitive friction.
- **Data Forward:** Metrics, time series charts, conversion funnels, and multi-channel marketing attributions take center stage without unnecessary embellishment.
- **Calm Authority:** Deep prussian-slate typography paired with fresh mint-emerald accents provides high-contrast legibility, delivering a sense of growth, momentum, and operational reliability.
- **Explicit Exclusions:** Strictly zero glassmorphism, zero neon or heavy saturated gradients, no dark mode, and zero decorative or whimsical cartoon illustrations.

## Colors

The color palette is calibrated for long-form desktop data interpretation in bright workspaces, prioritizing visual hygiene and contrast.

- **Primary (`#0F172A` / `#1E293B`):** Deep Prussian Slate. Used for primary headlines, core numerical data points, prominent action buttons, and dominant interface text. It delivers the sharpness of black without harsh ink contrast.
- **Secondary (`#10B981` / `#059669`):** Mint Emerald. Serves as the growth indicator, primary visual reward, active tab indicators, and confirmed status marks. Accompanied by a soft mint background wash (`#ECFDF5`) for highlight cards and trend badges.
- **Tertiary (`#64748B` / `#94A3B8`):** Muted Slate. Used for secondary metadata, chart axis labels, non-active tab labels, and subtle supporting captions.
- **Neutral Canvas (`#F8FAFC` to `#FFFFFF`):** High-grade neutral tones. `#F8FAFC` forms the global viewport background, while `#FFFFFF` provides pure, elevated card and table surfaces.
- **Structural Lines (`#E2E8F0` / `#EDF2F7`):** Hairline borders framing metrics, tables, and section dividers without creating visual claustrophobia.
- **Semantic Badges:**
  - *Active / Growth:* Emerald text `#047857` on `#ECFDF5` mint background.
  - *Scheduled / Pending:* Amber text `#B45309` on `#FEF3C7` background.
  - *Flagged / Churn Alert:* Crimson text `#B91C1C` on `#FEE2E2` background.

## Typography

The typography uses Inter across headlines, body copy, and interface labels to maintain geometric clarity, strict vertical rhythm, and legibility at dense data scales.

- **KPI Numerical Treatment (`data-metric`):** Numbers and KPI totals are styled in semi-bold weights with negative tracking (`-0.02em`) to echo the tight, crisp display numbers from the reference UI.
- **Tabular Alignment:** When rendering tables, run rates, conversion percentages, and chronological timestamps, enable `font-variant-numeric: tabular-nums` to maintain vertical decimal alignment.
- **Data Monospace (`data-mono`):** Reserved for ISBN numbers, campaign IDs, UTM tracking codes, and SQL queries.

## Layout & Spacing

The layout is constructed around an analytical desktop workspace with an expandable side navigation rail and a dynamic dashboard workspace.

- **Grid Model:** 12-column fluid grid system with `1.25rem` (20px) gutters and a fixed canvas horizontal margin of `2rem` (32px).
- **Workspace Canvas:** Max-width capped at `1600px` for ultra-wide setups to preserve data readability, centered within the viewport.
- **Vertical Spacing Cadence:**
  - Card-to-card gap: `space-lg` (20px).
  - Internal card padding: `space-lg` (20px) for standard charts and metrics, compacting to `space-md` (12px) for micro-metrics.
  - Section-to-section separation: `space-2xl` (40px).
- **Reflow Adaptability:** Below 1280px desktop screens, the 4-column metric row collapses to a 2x2 grid, while full-width visualization modules remain persistent across the entire main viewport.

## Elevation & Depth

Visual depth is achieved through structural layering and soft ambient lighting rather than heavy elevation tiers.

- **Surface Layers:**
  - **Level 0 (Canvas Base):** Flat `#F8FAFC`.
  - **Level 1 (Card & Module Layer):** `#FFFFFF` bounded by a 1px solid hairline border in `#E2E8F0`. Shadow is minimal: `0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.02)`.
  - **Level 2 (Popovers, Tooltips & Context Floats):** Pure `#FFFFFF` surface with hairline border `#E2E8F0` and an ambient floating shadow: `0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)`.
  - **Level 3 (Modal Dialogs):** Centered `#FFFFFF` containers backed by a subtle slate overlay (`rgba(15, 23, 42, 0.35)`).
- **Hairline Border Rules:** All card separators, axis lines, and nested containers utilize crisp 1px borders. Never employ heavy strokes or dark outer outlines.

## Shapes

The design system employs a refined radius scale (`roundedness: 2`) that balances modern elegance with structural efficiency:

- **Metrics & Content Containers:** `rounded-lg` (16px) creates soft, friendly containers consistent with the floating cards in the reference imagery.
- **Buttons, Form Inputs & Select Menus:** `rounded` (8px) ensures tactile focus and balanced proportions beside typography.
- **Badges & Segmented Pills:** `rounded-full` (9999px) for status indicators, active tags, and filter tokens.
- **Tooltips & Micro-popovers:** `rounded-lg` (12px to 16px) matching the rounded floating "Processing" overlay in the reference.

## Components

### Buttons
- **Primary:** Background `#0F172A`, text `#FFFFFF`, 8px radius. Hover shifts to `#1E293B` with micro-lift transition. Focus ring is 2px mint `#10B981` with 2px offset.
- **Secondary / Ghost:** Pure white `#FFFFFF` surface with `#E2E8F0` border, `#0F172A` text. Hover tint `#F8FAFC`.
- **Tertiary Mint Action:** Subtle `#ECFDF5` background with `#059669` text, used for positive batch triggers and campaign approvals.

### Metric Cards & Trend Badges
- Pure `#FFFFFF` background, 1px `#E2E8F0` hairline border, 16px radius, `20px` internal padding.
- Headline metric in `data-metric` typography (`#0F172A`).
- Sub-label in `label-md` (`#64748B`).
- Growth pill placed top-right or below the number: Soft `#ECFDF5` background with `#047857` text and a subtle ascending arrow icon.

### Charts & Visualizations
- Crisp, dashed or hairline axis rules `#EDF2F7`.
- Primary series line in `#10B981` (2px width), dotted or solid depending on actual vs. forecasted educational adoption figures.
- Fill gradient strictly spans from `rgba(16, 185, 129, 0.18)` at the curve apex fading smoothly to `rgba(16, 185, 129, 0.00)` at the zero baseline.
- Floating data points on hover: `#FFFFFF` disc with 2px solid `#10B981` rim.

### Floating Process / Context Overlays
- Direct translation from the reference card: A floating `#FFFFFF` popover with subtle ambient shadow (`Level 2`), containing active task lists (e.g., "Data Ingestion", "Pattern Recognition") accompanied by mint circular checkmarks (`#10B981`) and subtle rotating slate spinners (`#94A3B8`) for in-progress operations.

### Data Tables
- Header row styled in `#F8FAFC` with 11px uppercase slate labels (`#64748B`), 1px bottom border `#E2E8F0`.
- Rows in pure white, height 52px, alternating hover state `#F8FAFC`.
- Integrated progress bars: 4px height, light gray track `#F1F5F9`, mint fill `#10B981`.

### Form Inputs & Dropdowns
- 38px standard height, `#FFFFFF` background, `#CBD5E1` border, 8px radius, placeholder in `#94A3B8`.
- Active focus state: `#0F172A` border with an emerald glow halo (`box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15)`).