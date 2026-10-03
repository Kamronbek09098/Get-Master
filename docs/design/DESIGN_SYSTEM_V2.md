# GetMaster — Product Design System v2

## Product thesis
GetMaster is not a directory of masters. It is a decision engine that takes a real-world problem from description to a trusted outcome.

Core journey:
**Muammo → Tushunish → Moslashtirish → Tanlash → Ish → Isbot → To‘lov → Kafolat**

## Experience principles
1. **Problem first** — the customer never has to understand the marketplace before asking for help.
2. **Evidence over decoration** — trust is communicated with verification, real work, timing, price and proof.
3. **Progress is visible** — matching and order states show meaningful system activity, not generic spinners.
4. **Web and mobile are separate compositions** — shared language, different interaction models.
5. **Quiet premium** — typography, spacing, composition and motion create quality; not glassmorphism everywhere.
6. **Operational clarity** — master and admin interfaces prioritize scanability, density and fast action.
7. **Every state is designed** — loading, empty, error, success, offline, pending and permission states are first-class.

## Visual language
- Neutral base: warm-cool off-white / graphite instead of pure white + blue everywhere.
- Primary action: electric blue for customer surfaces; emerald for master; indigo for admin.
- Accent: restrained warm gold for moments of achievement, payment and confirmation.
- Typography: Inter for UI, Manrope for display/headings.
- Geometry: medium radius for controls, larger radius only for hero/premium surfaces.
- Borders: subtle 1px structural lines; shadows are used to establish hierarchy, not as decoration.
- Motion: short, directional, state-driven; reduced-motion support is mandatory.

## Web composition
### Landing
Storytelling and conversion. Large editorial typography, asymmetric hero, live matching visualization, proof signals, process narrative and a focused CTA.

### Customer app
Calm, guided and contextual. One primary action per viewport. Requests feel like a conversation rather than a form wizard.

### Matching
Show the matching engine as a system: request anchor, matching criteria, candidate signals, ETA and state transitions.

### Master profile
Proof-first profile: identity, trust, services, work area, availability, portfolio, completed work and reviews.

### Master workspace
Dense but calm. Today, new requests, active jobs, earnings and reputation are the primary objects. Secondary configuration stays out of the main flow.

### Order
A horizontal timeline on desktop and vertical timeline on mobile. Each stage answers: what happened, what happens next, who acts, and what evidence exists.

### Chat
Conversation first, context second: sticky order context, attachments, quick actions and status without turning the screen into a CRM.

### Admin
Operational control center: queue, severity, status, ownership, evidence and audit trail. Avoid consumer-style cards for every metric.

## Mobile language
- Bottom navigation for primary destinations.
- Bottom sheets for contextual decisions.
- Sticky contextual CTA instead of persistent desktop-style action bars.
- Swipe/drag only where the gesture has a clear semantic result.
- 44px+ touch targets.
- Thumb-zone prioritization.
- Edge-to-edge media and maps where useful.

## Component families
- Action / Button / IconButton / SplitButton
- Field / Search / Select / DateTime / Upload
- Status / Badge / Verification / Trust signal
- Card / List row / Timeline item / Metric
- Bottom sheet / Dialog / Drawer
- Toast / Inline alert / Empty state / Error state
- Master card / Request card / Offer card / Order card
- Evidence gallery / Portfolio / Review block
- Chat composer / Message / Attachment

## State system
Every meaningful component supports:
`default → hover → focus → pressed → loading → success → warning → error → disabled`

## Phase 1 implemented
- New landing-page composition with editorial hero and live matching scene.
- New visual token system for typography, color, spacing, radius and shadows.
- Responsive mobile composition instead of simply shrinking desktop.
- Reduced-motion support.
- Trust/proof language integrated into the visual hierarchy.

## Next implementation order
1. Customer home + request creation flow.
2. Matching results + master profile.
3. Master workspace/dashboard.
4. Order timeline + payment + warranty.
5. Chat.
6. Admin control center.
7. Global mobile navigation / sheets / interaction polish.
8. Dark mode parity, accessibility audit and performance pass.
