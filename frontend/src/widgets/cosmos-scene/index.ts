// 공유 우주 씬(spec 43) — 배경(fluid 앞/뒤)+트윙클+별 프리미티브+bloom을 한 R3F 캔버스에 합성하는
// 재사용 widget. 사인인·초대·랜딩이 prop으로 데이터·팔레트만 주입해 공유한다(디커플드, 라이브러리화 토대).
export { CosmosScene, type CosmosSceneProps, type StarVisual, type CosmosQuality } from './ui/CosmosScene'
