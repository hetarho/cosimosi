// The typed navigation seam. `pages` / `features` navigate through these
// re-exports so `@tanstack/react-router` stays confined to this app/routes
// segment — the web analogue of the mobile shell keeping react-navigation in
// app/navigation. Both are typed against the registered route tree.
export { Link, useNavigate as useAppNavigate } from '@tanstack/react-router'
