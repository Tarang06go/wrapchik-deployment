# Wrapchik admin screenshot checklist

This is a capture checklist for final browser/device review. It is not evidence that a screen has already been visually verified. Automated render-smoke tests exercise route components and form modals without a real browser layout engine.

## Capture set

- [ ] Admin dashboard at 360×800: outlet accepting/paused status, notification action, 4 compact metrics, live queue, kitchen load, QR Pickup shortcut, grouped drawer.
- [ ] Admin dashboard at 768×1024 and 1280×900: metric grid, overdue queue chip, revenue period controls, quick-action grouping, responsive max width.
- [ ] Admin drawer open at 360×800: every section and row fits, scrolling reaches Support issues and Log out, 48dp targets and close button remain visible.
- [ ] Kitchen & orders at 360×800 and 768×1024: filters, incoming-order cards, overdue state, payment review, group contribution review, empty and network-error states.
- [ ] QR Pickup at 360×800: camera permission/scan view in a compatible native build, manual code entry fallback, rejected and success messages. Never use a simulated scan or fabricated order.
- [ ] Product inventory and form modal: catalogue search/category filters, images, availability, add/edit fields and Save/Cancel footer.
- [ ] Categories, Coupons, Tables forms: keyboard-visible layout, scrollable fields, close/cancel/save actions, validation messages.
- [ ] Customer insights, Support issues and Restaurant Settings: loading, populated, empty and API error states.

## Review notes to record

- Device/browser, viewport, OS, font scale and build identifier.
- Screenshot filename per capture above.
- Any clipped/overlapping text, horizontal overflow, image crop, modal/footer occlusion, inaccessible touch target or navigation failure.
- Android TalkBack and iOS VoiceOver checks for drawer grouping, status chips, buttons, form labels and errors.

**Current status:** source-level component rendering and admin form-opening tests pass. Rendered screenshots, accessibility services, native camera scanning and physical-device behavior remain unverified.
