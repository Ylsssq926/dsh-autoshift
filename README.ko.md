![Model Autoshift](docs/banner.png)

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![CI](https://github.com/Ylsssq926/dsh-autoshift/actions/workflows/ci.yml/badge.svg)](https://github.com/Ylsssq926/dsh-autoshift/actions/workflows/ci.yml)
[![Node ≥ 22](https://img.shields.io/badge/node-%3E%3D22-339933.svg?logo=node.js&logoColor=white)](package.json)
[![DSH 0.2.2-rc.1](https://img.shields.io/badge/DSH-0.2.2--rc.1-6d5ce7.svg)](https://github.com/Ylsssq926/dsh-autoshift)
[![i18n: 8 languages](https://img.shields.io/badge/i18n-8%20languages-2db7a3.svg)](README.md)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-6d5ce7.svg)](CONTRIBUTING.md)

# Model Autoshift (模型自动挡)

> 아직 수동으로 모델을 고르세요? Auto로 바꾸세요.

중계 서비스에서 모델을 잔뜩 모아 놓고도 작업마다 여전히 하나씩 손으로 고르세요? Model Autoshift는 DSH 모델 선택기에 **Auto** 기어를 추가합니다. 작업을 던지면 이미 설정한 모델 중에서 가장 알맞은 것을 자동으로 고릅니다. 잡일은 저렴한 모델에, 어려운 일은 플래그십에. 세션당 하나의 경로로 고정, 재시작해도 흔들리지 않으며, 추가 모델 호출은 제로.

작업만 던지세요. 모델 선택은 Auto에게.

[中文](README.md) · [English](README.en.md) · [日本語](README.ja.md) · **한국어** · [Français](README.fr.md) · [Español](README.es.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

![사용 개요](docs/flow.en.png)

## Auto를 쓰는 이유

- **설정 제로로 시작**: 설치하고 Auto를 고르면 바로 사용. 모델 풀도 YAML도 필요 없음. DSH에 설정한 모델——공식이든 중계든——낯선 ID까지 모두 인식.
- **작업별 변속**: 엔지니어링·크리에이티브·라이팅·리서치·아키텍처·일상 여섯 종류를 자동 매칭. 잡일은 저렴하게, 어려운 일은 플래그십으로.
- **세션당 하나의 경로**: 처음 고른 모델이 세션 전체에 고정. 컨텍스트 압축이나 데스크톱 재시작에도 경로를 복원하며 다시 고르지 않음. 컨텍스트와 공급자 캐시가 안정적.
- **추가 호출 제로**: 각 요청은 하나의 모델로만 전달. "라우터 모델"로 이중 과금하지 않고, 투표·워밍업·기본 재시도도 없음. usage는 그대로 통과, 청구는 평소와 동일.
- **매 턴 한눈에**: 응답 끝에 한 줄 영수증 `Auto · model · tier · role`. 누가·어떤 티어로·백업을 썼는지 한눈에.

## 이런 분께

- **중계 헤비 유저**: 수십~수백 개의 모델, 작업마다 수동 전환에서 해방;
- **멀티 공급자 유저**: DeepSeek·OpenAI·Gemini·Claude 혼합, 작업별 자동 dispatch;
- **초보자**: 모델 차이를 연구하기 싫다면 Auto를 고르고 시작.

## 설치

```bash
dsh plugin --profile web add -w link:/path/to/model-aware-auto-plugin
```

DSH를 재시작하고 플러그인을 활성화. 새 세션 모델 선택기에 **Model Autoshift → Auto**가 나타납니다. 데스크톱 앱은 `--profile web`을 `--profile desktop`으로.

## 빠른 시작

1. DSH 설정에서 텍스트 모델을 하나 이상 구성(공식·중계 모두 가능);
2. 새 세션에서 모델을 **Auto**로 선택;
3. 작업을 던지기.

끝.

<img src="docs/entry.en.png" alt="진입점: 모델 선택기의 Auto" width="440">

## 세 가지 모드

| 모드 | 동작 |
|---|---|
| `economy` | 잡일은 저렴한 모델 우선, 비용 가중치 최대 |
| `balanced`(기본) | 작업 적합 우선, 비용도 고려 |
| `quality` | 작업 적합만, 비용 무시 |

```yaml
mode: economy
```

## 작업 예시

| 역할 | 던지는 작업 |
|---|---|
| 엔지니어링 | 오류 수정, 함수 리팩터, 스크립트 작성, API 배포, 테스트 실행 |
| 크리에이티브 | 시 쓰기, 이야기 만들기, 롤플레이, 카피 작성 |
| 라이팅 | 이메일 다듬기, 기사 요약, 번역, 주간 보고서 |
| 리서치 | 문헌 조사, 선택지 비교, 벤치마크 |
| 아키텍처 | 시스템 설계, 기술 선정, 마이크로서비스 분리 |
| 일상 | 잡담, Q&A, 각종 잡일 |

읽어들인 역할에 맞춰 풀에서 모델을 선택. 잡일은 economy, 어려운 일은 플래그십.

## 설정 제로로 중계 모델 인식

중계 풀은 낯선 ID 투성이. Auto는 이름으로 티어를 나눠 dispatch:

- **economy**: `mini / flash / lite / haiku / free / turbo`, 그리고 `7b / 8b` 같은 소형 오픈웨이트 모델;
- **flagship**: `pro / opus / ultra / max`, 그리고 `r1 / o3 / reasoner / thinking` 같은 추론 모델;
- **엔지니어링 성향**: `coder / code / dev`, deepseek / claude 패밀리; **크리에이티브 성향**: gemini 패밀리.

플래그십 집안의 저렴한 변종(`pro-flash`)도 economy로 처리. 전달은 항상 카탈로그의 정확한 ID. 비용이나 역할을 미세 조정하려면 `preferences` / `routes`의 `economics`로 덮어쓰기.

## 세션에 고정, 재시작에도 흔들림 없음

첫 성공 경로가 세션 전체에 바인딩. 컨텍스트 압축이나 데스크톱 재시작 후에는 세션 이벤트에서 바인딩을 복원하며 다시 고르지 않음. 모델 간 컨텍스트를 섞지 않고, 안정 접두사는 공급자 캐시에 유리. 고정 모델이 언마운트되면 Auto는 몰래 모델을 바꾸지 않고 다음 단계를 안내.

## 경로 영수증

매 턴 끝에 작은 한 줄: `Auto · model · tier · role`, 백업 사용 시 `fallback×N`. 세션 내 기존 경로 메타데이터를 읽을 뿐 추가 요청 제로. Auto가 아닌 턴에는 표시하지 않음.

## 서브에이전트 분담(선택)

DSH 네이티브 subagent가 모델 선택을 활성화하고 세션에 하위 정책이 있으면, Auto는 **모델 미지정** 하위 작업에 로컬 역할 매칭과 짧은 인계를 한 번 수행. 명시 지정한 subagent 모델이 항상 우선. 시작·취소·권한·회수는 DSH 네이티브 그대로.

## 권한과 데이터

Auto는 마운트된 모델 카탈로그와 현재 세션 이벤트만 읽고, 설정된 공급자로만 전달. 워크스페이스 파일을 읽거나 쓰지 않고 텔레메트리를 업로드하지 않으며, 설정은 모두 로컬에 유지.

## 설정(모두 선택)

### 가벼운 preference

```yaml
preferences:
  - provider: your-provider-id
    model: exact-model-id
    roles: [engineering]
```

preference는 순서만 조정. 다른 마운트 모델도 정상 참여.

### 범위 제어

```yaml
scope:
  providers: [provider-a, provider-b]   # 허용 목록, 비어 있음 = 전체
  excludeProviders: [provider-c]
  excludeModels: [some-model]
```

### 고급 프로파일

전체 `routes` 목록은 자동 발견을 덮어씀. 팀 고정 흐름이나 장기 튜닝용: `roles`, `tools`, `behavior`, `dimensions`, `economics`, `contextWindow`, `maxOutputTokens`, `routeRevision`. 실제 DSH provider/model ID 사용. 설정에 API 키를 넣지 않음.

## 참고 사항

- 텍스트 작업만. 이미지 모달리티는 Auto 카탈로그 밖;
- 다른 모델로 시작한 이전 세션은 도중에 Auto로 전환 불가. 새 세션을 생성;
- 제목·요약 등 보조 요청은 세션의 고정 경로를 따름.

## 호환성

DSH `0.2.2-rc.1` · Node.js 22+.

## 아키텍처

![Architecture](docs/architecture.png)

## 개발

```bash
node --test
```

## 라이선스

Apache-2.0 © 2026 掠蓝 (Ylsssq926). 재배포·파생 시 [LICENSE](LICENSE)와 [NOTICE](NOTICE)의 서명을 유지하고 변경 사항을 명시하세요.