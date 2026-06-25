// Public API for the star-explorer feature (change 09 — 망원경 별 탭). Named exports only
// (FSD public-API rule). StarExplorerList is CONTENT ONLY — the page composes it inside the
// universe shell's explorer sheet and wires onSelect → navigationActor.FLY_TO_STAR + shell
// setPeek (features don't import widgets/pages). Awake + dormant stars live in this one list;
// the old separate dormant entry point is retired from the product UI.
export { StarExplorerList, type StarExplorerListProps } from './ui/StarExplorerList'
