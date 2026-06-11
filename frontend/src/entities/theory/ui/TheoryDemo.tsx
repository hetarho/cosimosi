// 이론 id → 인터랙티브 데모 디스패처(spec 19). 랜딩 카드에서 이식한 시연 원본을 그대로
// 쓰고, 전용 인터랙션이 없는 이론(능동 인출·잠든 별)은 TheoryViz 미니 한 컷으로 폴백한다.
// 데모 모달과 랜딩 카드가 같은 컴포넌트를 소비한다 — 체험하기/배지 푸터는 소비처 소관.
import { EngramDemo } from './EngramDemo'
import { HebbianDemo } from './HebbianDemo'
import { TimeWindowDemo } from './TimeWindowDemo'
import { SilentEngramDemo } from './SilentEngramDemo'
import { TheoryViz } from './TheoryViz'

export function TheoryDemo({ id }: { id: string }) {
  switch (id) {
    case 'engram':
      return <EngramDemo />
    case 'synapse':
      return <TimeWindowDemo />
    case 'hebbian':
      return <HebbianDemo />
    case 'decay':
    case 'dormant':
      return <SilentEngramDemo />
    default:
      return <TheoryViz id={id} />
  }
}
