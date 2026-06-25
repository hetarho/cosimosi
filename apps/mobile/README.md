# apps/mobile — placeholder

미래 모바일 앱의 자리다. **이번 작업(job 52)은 이 placeholder만 둔다** — 실제 앱은 별도 plan에서 기술한다.

- **트랙:** React Native + TS + Zustand + Connect(unary). 웹과 도메인·상태·시뮬레이션·셰이더·Connect 클라이언트를 공유하려는 의도다(헌법 §4의 `model`/`shared/lib` 플랫폼 무의존이 이걸 위한 격리다).
- **렌더러:** 착수 시점에 확정. 목표는 `react-native-webgpu` + three `WebGPURenderer` + TSL(웹과 동일 셰이더). 안정성이 급하면 `react-native-filament` 폴백 검토.
- **공유:** 앱 간 직접 relative import 금지. 공유 로직은 `packages/*`로 승격하고(→ [packages/README.md](../../packages/README.md)), 전송 계약은 루트 `proto/`로만 연결한다.

배경과 근거: [spec/tech/architecture.md](../../spec/tech/architecture.md) §3.4 모바일 재사용 전략.
