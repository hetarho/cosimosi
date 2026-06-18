// Public API for the switch-appearance feature — 미인증 플레이그라운드 4축 인벤토리(배경·별·나·시냅스, spec 44).
// `AppearanceControls`=4축 라디오그룹 본문, `AppearanceSwitcher`=랜딩·사인인·초대 우하단 FAB(전부 잠금 해제·
// 로컬 즉시 확정). `usePlaygroundExtras`=세 페이지가 공유하는 미니 코스모스 어댑터(appearance 선택 →
// CosmosScene self/synapses/texture). (홈 우주의 편집기는 집중 모달 `pages/home/AppearanceModal` — 위젯
// 합성이라 feature가 아닌 page 소유.)
export { AppearanceControls, AppearanceSwitcher, type AppearanceSwitcherProps } from './ui/AppearanceSwitcher'
export {
  usePlaygroundExtras,
  type PlaygroundExtras,
  type PlaygroundSelf,
  type PlaygroundSynapse,
} from './model/playground'
