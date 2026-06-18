// Public API for the switch-appearance feature — 4축 인벤토리(배경·별·나·시냅스) 변경 + 구매(spec 44).
// `AppearanceControls`=4축 인벤토리 본문(드래프트 미리보기; 우주 메인 좌상단 알약/메뉴 Surface가 호스팅),
// `AppearanceSaveBar`=홈 플로팅 저장 바(드래프트→저장·미구매분 일괄 구매), `AppearanceSwitcher`=미인증
// 플레이그라운드 FAB(전부 잠금 해제·로컬 즉시). `usePlaygroundExtras`=랜딩·사인인·초대가 공유하는 미니
// 코스모스 어댑터(appearance 선택 → CosmosScene self/synapses/texture).
export { AppearanceControls, AppearanceSwitcher, type AppearanceSwitcherProps } from './ui/AppearanceSwitcher'
export { AppearanceSaveBar } from './ui/AppearanceSaveBar'
export {
  usePlaygroundExtras,
  type PlaygroundExtras,
  type PlaygroundSelf,
  type PlaygroundSynapse,
} from './model/playground'
