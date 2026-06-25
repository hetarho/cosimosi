// 에러/CTA 버튼 공용 클래스(17 — 에러 화면 세 곳이 같은 버튼 문자열을 복제하던 것을
// 두 번째 소비자 등장 시점에 승격, Architecture §2.2.1). 변형이 두 가지뿐이라 cva
// 컴포넌트화는 아직 과함 — 클래스 상수로 충분하다.
export const primaryButtonCls =
  'rounded-md bg-indigo-500/80 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500'

export const ghostButtonCls =
  'rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10'
