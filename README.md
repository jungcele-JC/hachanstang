# 하찮상 — 오늘의 하찮은 업적

하루 동안 한 아주 사소한 일을 적으면 어울리는 업적 뱃지를 수여합니다.
예) "사과 먹음" → 🍎 과일 구조대 / "사진 지움" → 🧹 디지털 청소부

## 실행
빌드 없음. 폴더에서 정적 서버를 띄우면 됩니다.
```
npx serve .        # 또는 python3 -m http.server 8000
```
(ES module이라 file:// 로 열면 안 됩니다.)

## 구조와 담당
```
index.html, css/style.css, js/app.js   A  화면
js/badge-engine.js, js/dictionary.js   B  뱃지 엔진(글귀·그림)
js/storage.js, js/share.js             C  기록·통계·공유 + 레포/배포
js/contract.js                         공통 규격 (3명 합의 없이 수정 금지)
test/                                  각자 테스트 페이지
```
지금 들어 있는 badge-engine.js / storage.js / share.js 는 **mock**입니다.
각 담당이 같은 export 이름으로 진짜 구현을 덮어쓰면 통합이 끝납니다.

## 규칙
1. 자기 담당 파일만 수정합니다. 다른 파일을 바꾸고 싶으면 담당자에게 말합니다.
2. `js/contract.js` 변경은 3명 합의 후 C가 반영합니다.
3. 브랜치 `a-ui`, `b-engine`, `c-storage` 에서 작업하고, 하루에 한 번은 `main`에 머지합니다.
