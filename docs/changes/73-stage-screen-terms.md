# #73 Fill in the film, opera, and musical terms for terms study

- Issue: [#73](https://github.com/sirloinbh/life-journal/issues/73)
- Branch: `feat/73-stage-screen-terms`

## Changes — 2026-11-03

Added 144 terms to the film, opera, and musical areas of terms study, making 50 per area. We confirmed the number with the user when starting. The card recommended 30 per area, but the user chose 50, the same as the first three areas. With this, all 6 areas of terms study are filled with 50 each.

The scopes follow the card recommendation (cinematography and editing for film, voice types and forms for opera, and numbers and stage for musicals) plus two more each, so each area is split into four. We added a comment per scope in `backend/src/terms-data.ts`, and on screen they appear in data order. The term names below are the Korean data as stored.

- Film
  - Cinematography (13): 롱 숏, 미디엄 숏, 클로즈업, 익스트림 클로즈업, 오버 더 숄더 숏, 시점 숏, 하이 앵글, 로 앵글, 팬, 틸트, 트래킹 숏, 핸드헬드, 심도
  - Editing (12): 몽타주(existing), 컷, 롱 테이크, 점프 컷, 디졸브, 페이드, 교차 편집, 매치 컷, 숏 리버스 숏, 180도 규칙, 인서트, 플래시백
  - Direction and story (13): 미장센(existing), 시나리오, 스토리보드, 신, 시퀀스, 블로킹, 로케이션, 세트, 맥거핀, 오마주, 카메오, 필름 누아르, 다큐멘터리
  - Sound and production (12): 디제시스 사운드, 논디제시스 사운드, 폴리, 후시 녹음, 영화 음악, 프리 프로덕션, 포스트 프로덕션, 색 보정, 시각 효과, 감독판, 엔딩 크레디트, 쿠키 영상
- Opera
  - Voice types (12): 소프라노, 메조소프라노, 콘트랄토, 카운터테너, 테너, 바리톤, 베이스, 콜로라투라, 리리코, 드라마티코, 프리마 돈나, 바지 역할
  - Forms (13): 아리아(existing), 레치타티보(existing), 서곡, 전주곡, 간주곡, 이중창, 중창, 합창, 카발레타, 다 카포 아리아, 라이트모티프, 리브레토, 막
  - Stage and performance (12): 오페라 하우스, 오케스트라 피트, 지휘자, 프롬프터, 자막, 인터미션, 브라보, 레지테아터, 레퍼토리, 프로덕션, 콘서트 오페라, 커버
  - Genres and trends (13): 오페라 세리아, 오페라 부파, 벨칸토, 베리스모, 그랑 오페라, 징슈필, 악극, 총체 예술, 오페레타, 바로크 오페라, 카스트라토, 실내 오페라, 사르수엘라
- Musical
  - Numbers (13): 넘버(existing), 오프닝 넘버, 아이 원트 송, 쇼스토퍼, 일레븐 어클락 넘버, 리프라이즈, 듀엣, 피날레, 오버추어, 앙트락트, 언더스코어, 벨팅, 성스루
  - Stage (12): 프로시니엄, 돌출 무대, 회전 무대, 플라이, 암전, 팔로 스폿, 업스테이지와 다운스테이지, 무대 감독, 큐, 제4의 벽, 핀 마이크, 세트 전환
  - Roles and viewing (12): 앙상블(existing), 언더스터디, 스윙, 멀티 캐스팅, 캐스팅 보드, 프리뷰, 프레스콜, 커튼콜, 스페셜 커튼콜, 회전문 관람, 막공, 퇴근길
  - Production and genres (13): 브로드웨이, 웨스트엔드, 대학로, 라이선스 뮤지컬, 창작 뮤지컬, 주크박스 뮤지컬, 북 뮤지컬, 콘셉트 뮤지컬, 리바이벌, 투어 공연, 트라이아웃, 워크숍 공연, 토니상

- Kept the IDs and content of the 6 existing terms (`movie-mise-en-scene`, `movie-montage`, `opera-aria`, `opera-recitative`, `musical-number`, `musical-ensemble`) as they are, because the memorized marks point to these IDs. When grouping by scope, mise-en-scène was moved to the start of direction and story. The others keep the existing order, with the new terms placed between them.
- For the musical terms closing night, repeat viewing, post-show exit, and special curtain call, which are words Korean audiences use, we put the closest English expression in the original-word field.
- The DB schema and the API do not change.

## Source

The meanings are sentences written directly for this app. We did not copy them from a particular glossary or book; we wrote them from widely known film, opera, and musical knowledge. There is no separate source. If you find an explanation that is wrong, fix this file and the data together.

## Tests

- `backend/test/terms.test.ts`: added film, opera, and musical to the per-area table `FILLED_DOMAINS`. For each area it checks 50 terms, the representative term of each scope, and the two existing IDs, and also checks that `GET /api/terms` sends 50 per area. We added a new test that checks that every area is in the table.
- `frontend/src/terms-study.test.tsx`: following the done criteria of the card, we added tests that pick film, opera, and musical in turn and check that only that area terms are shown. We put one film and one musical area and term into the fake API data.
- The scope check only looks at whether the one representative term chosen for each scope exists, because the data has no scope field.

## Verification

- `npm run check`: pass (backend 140 passed, 0 skipped, frontend 147 passed, 2 skipped, skills 4 passed).
- We did not check in a browser. The screen code did not change; the display of the three areas was checked with the screen tests, and the number of data items and the API response with the backend tests.

## Review

There were many terms, so we split the first review into film (including tests and docs), opera, and musical. We applied all 5 findings.

- Opera, baroque opera: "17th to early 18th century" was too narrow, so we changed the Korean meaning text to "from the early 17th century to the mid 18th century". It now matches opera seria, which is written as popular in the 18th century.
- Opera, ensemble (multi-voice piece): the idea of singing different emotions read like a condition, so we changed the Korean text to say it is a part sung together, and that different emotions may be sung at the same time.
- Musical, eleven o'clock number: the origin was changed from "the days when shows ended at 11" to "from this number coming at about 11 o'clock in shows that started around 8:30".
- Film, set: there are also outdoor open sets, so we widened the Korean text to "in a studio or outdoors".
- Film, fade: there are also fades to white, so we changed the Korean text to "mostly black".

For reference only: the opera term "악극" (music drama) has the same name as a popular Korean musical theater form of the 1930s to 1950s, but its meaning mentions Wagner, so we left it as is.

After applying the first review, `npm run check`: pass (backend 140 passed, 0 skipped, frontend 147 passed, 2 skipped, skills 4 passed).

Second review: all 5 first-round findings were applied and there was nothing to fix.
