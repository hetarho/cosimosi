-- 야간 공고화(spec 27): "우주의 수면" 4패스(전체 재안정화·재분배·요지·가지치기)가
-- 쓰는 보조 상태. 안정 좌표(stable_*)는 **권위가 아니라 캐시**다(헌법3) — 좌표는 여전히
-- 클라 force-sim에서 창발하고, 서버는 이 캐시를 *야간 재안정화의 다음 밤 재진입 시드*로만
-- 쓴다(proto로 클라에 보내지 않는다 — 헌법3·memory.proto "no coordinate fields").
-- form_seed_delta는 23(00005)이 이미 추가했다 — 부재 시에만 보강(중복 정의 방지).
-- evolution_history(23)는 재사용한다(야간 요지는 trigger='nightly_gist'로 INSERT만).
-- jobs.user_id는 21(00004)이 이미 추가했다(consolidate job 키) — 보강 불필요.
-- 00001은 수정 금지(append-only DDL).

-- +goose Up

-- 형태 진화 상태(23이 Star에 노출): 야간 요지/재성형이 갱신하는 가변 layer. 부재 시 보강.
ALTER TABLE memories ADD COLUMN IF NOT EXISTS form_seed_delta REAL NOT NULL DEFAULT 0;

-- 야간 재안정화가 캐시하는 안정 좌표(권위 아님 — 헌법3). NULL이면 클라가/서버가 처음부터
-- 산출한다(야간 잡은 다음 밤 이 캐시를 force-sim 시드로 재사용해 수렴을 가속한다).
ALTER TABLE memories ADD COLUMN IF NOT EXISTS stable_x REAL;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS stable_y REAL;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS stable_z REAL;

-- 사용자당 활성(대기/실행) consolidate 잡은 최대 1개 — 야간 티커가 cmd/api·cmd/worker 양쪽에서
-- 돌거나 같은 시각에 두 번 깨어나도 중복 잡이 쌓이지 않게 하는 하드 백스톱. EnqueueConsolidateJob의
-- WHERE NOT EXISTS가 흔한 경우를 걸러주고, 드물게 동시 INSERT가 경합하면 이 인덱스가 진 쪽을
-- 23505로 막아(티커가 로그·스킵) 두 번째 잡이 절대 돌지 않게 한다. done/failed 행은 제외라
-- 다음 밤 새 잡은 정상 적재된다.
-- +goose StatementBegin
CREATE UNIQUE INDEX IF NOT EXISTS jobs_one_active_consolidate_idx
    ON jobs (user_id)
    WHERE kind = 'consolidate' AND status IN ('pending', 'running');
-- +goose StatementEnd

-- +goose Down

DROP INDEX IF EXISTS jobs_one_active_consolidate_idx;

ALTER TABLE memories DROP COLUMN IF EXISTS stable_z;
ALTER TABLE memories DROP COLUMN IF EXISTS stable_y;
ALTER TABLE memories DROP COLUMN IF EXISTS stable_x;
-- form_seed_delta는 23(00005)이 추가했다면 그 마이그레이션 소관 — 여기선 드롭하지 않는다.
