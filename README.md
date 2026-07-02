# scoredp API

[scoredp.vercel.app](https://scoredp.vercel.app)

beatmania IIDX DP 서열표 기록 사이트 

FastAPI + SQLite

## 실행 방법

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

최초 실행 시 `scoredp.db`(SQLite, WAL 모드)가 자동 생성됩니다.

### 환경 변수 (`.env`)

| 변수 | 설명                                             |
|---|------------------------------------------------|
| `ADMIN_PASSWORD` | `/admin/*` 엔드포인트 인증 키. 요청 헤더 `X-Admin-Key`와 비교 |

### 곡 데이터 초기 적재

`songs` 테이블이 비어있으면, [zasa 비공식 난이도표](https://zasa.sakura.ne.jp/dp/)를 크롤링하여 데이터를 채울 수 있습니다.

```bash
python -m scripts.fetch_zasa
```

이후 갱신은 `/admin` 페이지의 동기화 버튼으로 진행할 수 있습니다.

## 프로젝트 구조

```
scoredp_pyback/
├── main.py                # FastAPI 앱, 라우터 등록, 정적 스크립트 제공
├── requirements.txt
├── static/
│   ├── crawler.js         # 스코어 수집 크롤러
│   └── password.js        # 배치 저장용 비밀번호 등록용
├── scripts/
│   ├── fetch_zasa.py      # songs 테이블 초기 적재
│   └── add_indexes.py     # 기존 DB에 인덱스 추가 마이그레이션
└── app/
    ├── database.py        # SQLite 엔진, 세션
    ├── models.py           # User / Song / Score / Option
    ├── schemas.py          # Pydantic 요청/응답 모델
    ├── utils.py            # 곡명 정규화
    └── routers/
        ├── upload.py       # 크롤링을 통한 스코어 업로드
        ├── scores.py       # 스코어/유저/곡 조회, 랜덤 추천
        ├── auth.py         # 배치 저장용 4자리 비밀번호 등록/검증
        ├── options.py      # 곡별 배치 저장
        └── admin.py        # 곡/유저/기록 관리
```

## DB 스키마

### `users`
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | Integer PK | |
| iidx_id | String, unique | e-amusement ID |
| dj_name | String | DJ 이름 |
| password_hash | String, nullable | `sha256(iidx_id:password)` 배치 저장 기능용 4자리 비밀번호 |

### `songs`
| 컬럼 | 타입 | 설명                                  |
|---|---|-------------------------------------|
| id | Integer PK |                                     |
| zasa_id | String, nullable | zasa 곡 ID                           |
| title | String | 원본 곡명                               |
| title_normalized | String, indexed | 정규화된 곡명                             |
| level | Integer | 공식 난이도                              |
| chart | String | `HYPER` / `ANOTHER` / `LEGGENDARIA` |
| unofficial_level | Float, nullable | 비공식 난이도, `NULL`이면 서열표/기록 조회에서 제외  |

### `scores`
| 컬럼 | 타입 | 설명                                                                                                      |
|---|---|---------------------------------------------------------------------------------------------------------|
| id | Integer PK |                                                                                                         |
| user_id | Integer FK → users.id, indexed |                                                                                                         |
| song_id | Integer FK → songs.id, indexed |                                                                                                         |
| clear_type | Integer | 0 = `NO PLAY`, 1 = `FAILED`, 2 = `ASSIST`, 3 = `EASY`, 4 = `CLEAR`, 5 = `HARD`, 6 = `EX_HARD`, 7 = `FC` |
| score | Integer | 점수                                                                                                      |
| dj_level | String | 랭크, `---`~`AAA`                                                                                         |
| updated_at | DateTime |                                                                                                         |

### `options`
곡별 배치 저장

| 컬럼 | 타입 | 설명                                                                     |
|---|---|------------------------------------------------------------------------|
| flip | Integer | 0 / 1                                                                  |
| left_arr / right_arr | Integer | 0 = `None`, 1 = `Mirror`, 2 = `Random`, 3 = `R-Random`, 4 = `S-Random` |

전부 기본값(0,0,0)으로 저장 요청이 오면 행 삭제

## 엔드포인트

### 크롤러 데이터 수신 (`upload.py`)
| 메서드 | 경로 | 설명                                   |
|---|---|--------------------------------------|
| POST | `/upload` | 수집한 스코어 일괄 업로드, 매칭 실패 시 `WARNING` 로그 |

### 조회 (`scores.py`)
| 메서드 | 경로 | 설명                                                                           |
|---|---|------------------------------------------------------------------------------|
| GET | `/users` | 전체 유저 목록                                                                     |
| GET | `/songs` | `unofficial_level`이 있는 곡 목록 (`?level=N` 필터)                                  |
| GET | `/scores/{iidx_id}` | 유저 스코어 (`?level=N` 필터)                                    |
| GET | `/unofficial_levels` | 레벨별 존재하는 비공식 난이도 값 목록                                         |
| GET | `/songs/random` | `(from_level, from_unofficial) ~ (to_level, to_unofficial)` 범위 내 곡 1개 무작위 추천 |

### 배치 저장 인증 (`auth.py`)
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/auth/status/{iidx_id}` | 비밀번호 설정 여부(`has_password`) + `dj_name` 조회 |
| POST | `/auth/register` | 4자리 비밀번호 최초 등록 (유저가 존재해야 함) |
| POST | `/auth/verify` | 비밀번호 검증 |

### 곡 배치 저장 (`options.py`)
| 메서드 | 경로 | 설명                                                                      |
|---|---|-------------------------------------------------------------------------|
| POST | `/options` | 배치 옵션 `{iidx_id, password, song_id, flip, left_arr, right_arr}` 저장 및 삭제 |
| GET | `/options/{iidx_id}` | 유저의 전체 배치 목록                                                            |

### 관리자 (`admin.py`, `X-Admin-Key` 헤더 필요)
| 메서드 | 경로 | 설명                |
|---|---|-------------------|
| GET | `/admin/songs` | 곡 목록              |
| PUT | `/admin/songs/{id}` | 단건 수정             |
| DELETE | `/admin/songs/{id}` | 단건 삭제             |
| GET | `/admin/songs/export` | Excel 다운로드        |
| POST | `/admin/songs/import` | Excel 업로드         |
| POST | `/admin/songs/fetch-zasa` | zasa 비공식 난이도표 동기화 |
| GET | `/admin/users` | 유저 목록             |
| DELETE | `/admin/users/{id}` | 유저 데이터 삭제         |
| GET | `/admin/users/{id}/scores` | 유저가 플레이 한 기록 목록   |
| DELETE | `/admin/scores/{id}` | 스코어 단건 삭제         |

### 정적 스크립트 (`main.py`)
| 메서드 | 경로 | 설명                                                                                      |
|---|---|-----------------------------------------------------------------------------------------|
| GET | `/c` | `static/crawler.js` |
| GET | `/p` | `static/password.js` |

## 크롤러 (`static/crawler.js`, `static/password.js`)

e-amusement 페이지에서 북마클릿으로 실행하는 스크립트

- `crawler.js`: DJ NAME + IIDX ID를 `status.html`에서 파싱, `difficult` 기준 전 채보 스코어를 수집해 `/upload`로 전송
- `password.js`: 배치 저장 기능용 4자리 비밀번호 `/auth/register`에 등록

신작 출시의 경우 `IIDX_VERSION` 상수 갱신이 필요합니다.

## 곡명 정규화 (`app/utils.py`)

e-amusement와 zasa 간 곡명 표기 불일치를 해결하기 위한 `normalize_title()`

1. `_ALIASES`: 정규화 전 특수 예외 치환
2. `_TRANS`: NFKD로 분해되지 않는 유사자 치환
3. NFKD 정규화
4. 결합 문자 제거
5. 소문자화
6. 공백, 기호, 특수문자 제거

## 로깅

```python
logging.basicConfig(level=logging.WARNING, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
```

`upload.py`에서 곡 매칭 실패 시 `Song match failed | title=... | normalized=... | chart=...` 경고