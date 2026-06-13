// Cross-import public API (FSD `@x`) — entities/theory 전용. 이론 데모(SilentEngramDemo)가
// 실제 망각 모델의 정전 상수·식으로 시연하도록 노출한다(시연·실제 표류 방지). 26은 변조
// 감쇠(modulatedBrightness)와 계수를 더해 "연결+감정+요즘 관련성"을 같은 식으로 보인다.
export {
  A_MIN,
  HALF_LIFE_DAYS,
  modulatedBrightness,
  lambdaEff,
  ALPHA_CONN,
  BETA_RECENT,
  GAMMA_EMO,
  DELTA_VAL,
} from '../model/activation'
