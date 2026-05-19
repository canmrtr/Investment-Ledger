# Design Audit

Date: 2026-05-15

Scope: Source inspection of the app UI in `index.html` and `src/components/*`. This audit intentionally does not evaluate color choices or font-family choices. It focuses on text size, hierarchy, button structure, menu layout, responsive behavior, tables, forms, cards, and interaction patterns.

## High-Level Findings

- The app has a compact, data-heavy product UI with a consistent overall shell: sticky top bar on desktop, bottom tabs and FAB on mobile, card/table-based content areas, compact labels, and dense numeric layouts.
- Most design implementation is inline style-driven rather than component/token-driven. This makes the UI flexible but creates inconsistency in text sizing, button sizing, spacing, and responsive behavior across screens.
- The core navigation model is clear, but the desktop and mobile navigation expose slightly different affordances. The Add action is a topbar button on desktop and a FAB on mobile, while the Add tab is omitted from both tab lists.
- Text hierarchy is very compressed. Labels often sit at 10-11px, table content at 12px, section titles at 10-13px, and primary metric values at 15-32px. This works for dense finance screens but creates scanability issues where many labels, hints, badges, and row actions compete at nearly the same size.
- Tables and list rows generally support dense scanning well, but several inline controls use small hit areas, especially `btn-xs`, chip buttons, compact collapse toggles, and row action buttons.
- The app has good mobile-specific handling in the dashboard position list, top/bottom navigation, and input zoom prevention. Some form grids and editable rows still use desktop-like 2 or 3 column layouts without explicit mobile collapse rules.

## Navigation And Menus

- Desktop topbar height is fixed at 52px with compact tabs at 13px and 6px/12px padding. This keeps the app dense, but the tab targets are smaller than typical touch-friendly sizes.
- Mobile switches to bottom tabs at 60px height and hides the topbar tab list. This is a good structural choice for frequent navigation.
- The mobile FAB sits above bottom tabs at `bottom:76px`, which should avoid the tab bar. It is hidden on Settings and Rehber, but visible on Dashboard, Watchlist, Analysis, History, Search, and Detail with context-specific behavior.
- Hamburger menu is minimal and clear, but it only contains Settings and Sign Out. Since Rehber exists as a main tab, the split between hamburger-only Settings and tab-based Rehber is understandable but slightly uneven.
- The hamburger button is visually compact at 18px by 13px plus padding. Its actual click area is acceptable due to padding, but still smaller than the FAB/bottom-tab affordances.
- `ham-menu` is absolutely positioned under the hamburger with `left:0`. Because `.topbar-left` is positioned relative, this anchors to the hamburger group rather than the viewport, which is appropriate.
- Topbar right can contain loading state, freshness text, privacy eye, and Add button. On narrower desktop widths before the 640px breakpoint, this area may become cramped because nav tabs do not wrap.

## Text Size And Hierarchy

- Global base button text is 12px. Inputs are 13px desktop and 16px mobile. Table cells are 12px. Table headers are 10px uppercase. Labels are commonly 10px uppercase. This creates a very compressed hierarchy.
- Primary dashboard market value uses a much larger 32px display size, which creates a clear anchor. Other KPI cards use 16px values, so the first card dominates strongly.
- Empty-card title text is 15px with body text at 12px. This is readable but modest for empty states that need to guide first-time users.
- Section titles use multiple patterns: `.stitle` at 10px uppercase, section dividers in Analysis at 13px, block headers in Dashboard at 17px, and card titles sometimes at 14-15px. The hierarchy is functional but not fully standardized.
- Many secondary explanatory lines are 10-11px. This is dense and efficient, but repeated long hints at 10px may be hard to read on mobile.
- Some emoji/icon prefixes are embedded directly in text labels and buttons. They add quick recognition but make text rhythm less consistent across buttons and rows.
- Dashboard position block headers at 17px provide good separation between asset categories. The internal table labels remain very small, which creates strong contrast between category headers and row content.
- Ticker detail header uses 22px ticker text and 18px price text, which gives the detail screen a clear focal point.
- The Rehber placeholder uses 36px icon, 16px title, 11px status label, and 13px body text. It reads as a placeholder rather than a full app section, which matches its current state.

## Buttons And Controls

- Button sizes are split into global default, `.pri`, `.btn-xs`, `.btn-sm`, `.btn-md`, `.mtab`, `.seg`, icon-like buttons, and many inline ad hoc styles. The system works, but there are too many sizing patterns.
- `.btn-xs` at 11px with 3px/9px padding is used for important actions such as edit, delete, collapse, and close. These controls are visually compact but not ideal for touch or accessibility.
- Primary buttons are visually consistent via `button.pri`, but some primary actions use inline button styles instead of the class.
- Segmented controls (`.seg`) are compact and appropriate for binary or small option sets. They are used for theme, manual/AI mode, and asset distribution mode.
- Mode tabs (`.mtab`) are used both as full-width tabs and small chips. The same class carries different meanings depending on context, which may make future styling harder.
- Some action buttons contain only symbols or emoji (`↻`, `×`, `✎`, `▴`, `▾`) with tooltips in some places but not all. Icon-only buttons should consistently have accessible labels and predictable hit boxes.
- The topbar privacy eye is a good icon button pattern and includes aria labels.
- The FAB is context-aware, which is useful, but it performs different actions depending on current tab. This is efficient for power users but can be surprising because the same plus button focuses search on the Search tab instead of adding an item.
- Destructive actions are usually styled with `danger` or `btn-danger-out` and routed through confirmation, which is structurally good.

## Forms And Inputs

- Inputs have a consistent global shape, and mobile increases input font size to 16px to prevent iOS zoom. This is a strong mobile detail.
- Manual position form uses a two-column grid. Detail quick-add and history edit forms use three-column grids. These are efficient on desktop, but there are no obvious component-specific mobile collapse rules for every form grid.
- Several inline edit forms define fixed widths such as 80px, 90px, and 120px. This keeps rows compact but can become tight for localized labels, currency values, or larger numeric entries.
- Form labels are consistently small uppercase via `.kk` or `.lbl`, which supports dense scanning. The tradeoff is lower readability for long labels, especially BES and deposit fields.
- Validation messages generally appear inline at 11px near the field. This is good structurally.
- The Add flow has a strong type-first structure. The asset type picker uses large clickable cards with icon, title, and description, which is easier to understand than immediately showing a large generic form.
- CSV import preview is compact and practical. It shows first five rows only, which prevents the screen from becoming too long.
- Login form is simple and focused. The logo image height is 240px, which may dominate smaller screens before the form appears.

## Tables, Lists, And Dense Data

- Desktop dashboard positions use tables with sortable headers. Mobile uses a dedicated card-list layout instead of forcing the table, which is a good design decision.
- Table headers are clickable but rely mainly on text and arrow characters for sort state. This is usable, but hit areas are limited to the header cell and the visual state is subtle.
- The dashboard asset blocks are collapsible and default collapsed through `collapsedBlocks` initialization. This keeps the dashboard manageable for many asset types.
- Position rows are clickable and use hover states. On touch devices, the row-click behavior should still work, but row actions inside rows need careful event handling to avoid accidental navigation.
- History groups transactions by ticker with collapsible sections. This is a strong structure for an investment ledger.
- History row action buttons are compact and always visible. This is efficient but can create visual clutter in rows with long transaction details.
- Watchlist is a simple table. Unlike the dashboard, it does not have a mobile card variant. With four columns and a remove button it may still fit, but it is less mobile-optimized than the dashboard positions.
- Search results use row-style list groups with portfolio matches separated from all matches. This is clear and efficient.
- Public portfolio view uses rows with a horizontal percentage bar. The row structure is clear, though fixed-width ticker/bar/percentage columns may be tight on narrow screens.

## Cards And Layout

- Cards are used throughout for KPI groups, detail summaries, settings sections, analysis panels, empty states, warnings, modals, and form containers.
- There is a mix of semantic cards (`.card`, `.cbox`, `.empty-card`, `.warn-card`) and many ad hoc card-like inline divs. Consolidating these would make spacing and hierarchy more predictable.
- Grid utilities `.g2`, `.g3`, and `.g4` provide a useful layout baseline. There are mobile rules for these global grids, but many local inline grids are not covered.
- Main content max width is 920px with 20px desktop side padding and 12px mobile side padding. This is appropriate for a finance dashboard.
- The app has many nested visual containers, especially in Analysis and Settings. Some nested cards/panels are functionally useful, but the hierarchy can become visually busy.
- Empty states are consistent in Dashboard, History, Search, Analysis, and Public View. Watchlist empty state uses a custom simpler card and does not fully match the `.empty-card` title/subtitle structure.
- Warning cards use flexible layout with wrapping, which should prevent overflow for action buttons.

## Mobile And Responsiveness

- The breakpoint at 640px handles main navigation, bottom tabs, FAB, app padding, hidden desktop nav, hidden desktop Add button, and input font size. This is a coherent mobile shell.
- Dashboard position tables swap to card lists below 640px. This is the strongest responsive implementation in the app.
- Global grids collapse at 500px for `.g3` and `.g4`, but not every inline grid uses those classes.
- Add type picker uses `repeat(auto-fit,minmax(150px,1fr))`, which should adapt well.
- Filter chip rows use horizontal scrolling with hidden scrollbars. This preserves space, but hidden scrollbars can reduce discoverability.
- Tooltips become fixed bottom banners on mobile, which avoids viewport clipping. This is a thoughtful mobile adaptation.
- Some row-level layouts use `flexWrap:"wrap"` and should degrade reasonably, but critical edit forms with 3 columns may still feel cramped.
- Bottom tab labels are 11px and paired with icons. This is compact but acceptable for short Turkish labels. Longer future labels may not fit.

## Modals, Flash, Tooltips, And Feedback

- Confirmation modal has a clear overlay, max width, and danger handling that prevents Enter from confirming destructive actions. This is a strong interaction detail.
- Flash messages are fixed below the topbar and span from left to right. They are visible, but because they use `position:fixed` and top placement, they can overlap content near the top.
- Parse errors sometimes reuse `.flash err` inline inside forms. Since `.flash` is globally fixed, using it inline can create layout surprises unless overridden enough by inline styles.
- Tooltips are pervasive and useful for finance concepts. The data-tip implementation supports touch via `data-tip-visible`.
- Tooltips are not shown for interactive buttons by default in touch handling, even when buttons have `data-tip`. This avoids accidental touch conflicts, but means some button hints are hover-only on desktop.
- Loading states use small spinners in buttons and rows. Most long-running actions communicate progress text, especially price/history fetch and CSV import.

## Screen-Specific Notes

### Dashboard

- Strong information architecture: warnings, nudges, summary KPIs, period selector, benchmarks, collapsible asset blocks, and explanatory notes.
- The first KPI card creates a clear anchor, but the second and third KPI cards are much smaller and can feel secondary even when their information is important.
- Asset block headers are easy to scan and the collapse state reduces page length.
- Desktop table is dense and efficient. Mobile card list is well-tailored.
- Period selector chips are compact and horizontally scrollable. Disabled states are present.

### Analysis

- Analysis contains many panels and advanced concepts. Section dividers help group the content into Performance, Distribution, and Fundamentals.
- Aylik Ozet card is highly structured and readable, but it has many nested mini-panels at similar sizes.
- Distribution panels use stacked bars plus expandable rows, which is space-efficient.
- Fundamentals health table is very dense. The collapsed summary helps, but when expanded it becomes a complex horizontal table, requiring scrolling.
- Health badges and metric pills are compact; they work for power users but may be visually noisy for casual users.

### Add

- Type-first picker is a good flow decision.
- Mode tabs are easy to understand, but labels mix emoji and text. This makes them more recognizable but less aligned with other navigation controls.
- Manual form is extensive and practical, but the two-column layout may need stronger mobile-specific rules.
- CSV flow has good progressive disclosure: choose/paste, preview, import, progress.

### History

- Search/filter toolbar is clear and compact.
- Group-by-ticker accordion is a good fit for transaction history.
- Inline editing is efficient but dense. Three-column edit grid may be tight on small screens.
- Row action buttons are compact and may be hard to tap.

### Search

- Search screen is focused and uses recent searches effectively.
- Result rows are clear, with ticker, name, status badges, watchlist action, and chevron.
- Watchlist toggle in search results is implemented as a styled span, not a button. Structurally it behaves like a button but may be weaker for semantics and keyboard access.

### Watchlist

- Simple and scannable table.
- Empty state is useful but visually less consistent than other empty states.
- Remove action is small and sits inside a clickable row. Event propagation is handled, but the tap target remains compact.

### Detail

- Header layout is clear: back, meta refresh, ticker summary, price.
- Position summary cards work well for held tickers.
- Company info and fundamentals sections are structured but dense.
- Add transaction inline form is useful, but the mode switch and form fields are compact.
- Non-held ticker state is clear and provides watchlist/add affordances.

### Settings

- Settings are organized into account, portfolio, appearance, price/data, tools, system status, and danger zone.
- Many settings sections use compact row patterns with right-aligned actions. This is efficient and scannable.
- Some settings buttons are potentially long in Turkish, especially data/tool actions. They wrap through `.brow`, which helps.
- Danger zone sign out is full width, which is clear.

## Priority Recommendations

1. Standardize control sizes.
   Define clear button tiers for icon button, compact row action, normal action, primary action, and segmented/chip controls. Reduce ad hoc inline padding and font-size overrides.

2. Improve mobile form grids.
   Add responsive rules or reusable form grid classes so two- and three-column form layouts collapse predictably below 640px.

3. Increase or rationalize tiny text usage.
   Keep dense numeric rows compact, but consider raising explanatory hints, empty-state copy, warning descriptions, and important secondary labels from 10-11px to a more readable size.

4. Normalize empty states.
   Bring Watchlist and Public View empty states closer to the main `.empty-card` structure.

5. Make row actions more touch-friendly.
   Increase tap targets for edit/delete/remove/collapse controls, especially in History, Watchlist, ConfirmBox, and expanded tables.

6. Replace button-like spans with buttons.
   Search result watchlist toggles and similar interactive spans should use button semantics while keeping the same visual treatment.

7. Consolidate card and panel patterns.
   Use fewer card-like variants and move repeated inline panel styles into reusable classes.

8. Review topbar capacity at tablet widths.
   The desktop topbar may become crowded before the 640px breakpoint. Consider an intermediate breakpoint or moving lower-priority items into the menu sooner.

9. Keep tooltip behavior consistent.
   Ensure icon-only and symbol-only actions have accessible labels and, where appropriate, consistent tooltip behavior across mouse and touch.

10. Avoid reusing `.flash` as inline form feedback.
    Create an inline alert class for parse/form errors so fixed-position flash styling does not leak into form layouts.

