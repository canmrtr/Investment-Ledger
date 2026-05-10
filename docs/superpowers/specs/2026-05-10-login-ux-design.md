# Login UX — Design Spec

**Date:** 2026-05-10  
**ROADMAP item:** H2. Login UX  
**File:** `src/components/Login.js` + `index.html` (login CSS)

---

## Problem

The current login screen places the logo inside the card, making it feel cramped. The primary button is 36px — below the 44px mobile touch target standard. Inputs lack `autocomplete` attributes, causing browsers to skip password autofill. Error/success messages are unstyled plain text.

---

## Changes

### 1. Logo placement

Move the logo **above** the card. The `login-box` div no longer contains the logo block.

```
.login-wrap
  ├── logo block (NEW: outside card)
  │     logo-full-dark.png / logo-full-light.png, height: 100px
  │     margin-bottom: 28px, text-align: center
  └── .login-box (form only)
        email field
        password field
        error/success banner
        submit button
        toggle link
```

The existing `theme-logo-dark` / `theme-logo-light` CSS classes handle dark/light switching — no JS needed.

### 2. Input & button sizing

- Input `height` → 44px (CSS: `.login-field input { height: 44px }`)
- Primary button `min-height` → 44px (inline style or CSS override on `.login-box .pri`)

### 3. Autocomplete attributes

| Field | Mode | `autocomplete` value |
|-------|------|----------------------|
| Email | both | `email` |
| Password | sign-in | `current-password` |
| Password | sign-up | `new-password` |

`isReg` state already exists — use it to switch the password `autocomplete` attribute.

### 4. Error / Success banner

Replace plain `<div style={{color:"var(--err)"}}>` with a styled banner:

```jsx
// Error
<div style={{
  background:"rgba(255,51,102,0.10)",
  border:"1px solid rgba(255,51,102,0.20)",
  borderRadius:8,
  padding:"8px 12px",
  fontSize:12,
  color:"var(--err)",
  marginTop:8
}}>✕ {errMsg}</div>

// Success
<div style={{
  background:"rgba(0,217,126,0.10)",
  border:"1px solid rgba(0,217,126,0.20)",
  borderRadius:8,
  padding:"8px 12px",
  fontSize:12,
  color:"var(--ok)",
  marginTop:8
}}>✓ {okMsg}</div>
```

`flash_()` is not used here — it lives inside the App component which isn't mounted at login time.

---

## Out of scope

- Password reset / forgot password flow
- OAuth / social login
- Any changes to Supabase auth logic

---

## Files changed

| File | Change |
|------|--------|
| `src/components/Login.js` | Logo moved outside card; autocomplete attrs; banner styling; 44px button |
| `index.html` | `.login-field input { height: 44px }` CSS update |
