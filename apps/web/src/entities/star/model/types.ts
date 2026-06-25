// 별(기억) 오브제의 도메인 타입 — 고를 수 있는 종류와 그 메타. 렌더(3D/2D)는 같은 entity의
// single.ts / forms.ts / ui 가 이 종류로 dispatch한다. 유저가 *고른* 선호는 appearance entity가 든다.

/** 별 오브제의 종류(form). 3D·2D 렌더가 공유한다. 색은 항상 mood(감정 의미색)라 form만 바뀐다(change 11:
 *  pulsar 추가 — 색·밝기·기억 데이터 계약 불변). */
export type StarObject = 'deepfield' | 'aurora' | 'liquid' | 'ember' | 'pulsar'

export interface StarObjectMeta {
  id: StarObject
  /** 스위처에 보이는 이름. */
  name: string
  /** 한 줄 설명. */
  tagline: string
  /** 형태를 대표하는 미리보기 그라디언트(CSS background 값). */
  swatch: string
}
