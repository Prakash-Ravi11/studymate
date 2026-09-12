# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Read [HANDOFF.md](./HANDOFF.md) first.** It carries the current project
> state, the active blocker, Supabase details, decisions already made, and the
> gotchas that cost real time to find. This file covers layout and commands.

## Current architecture

StudyMate is being rebuilt as a **Next.js web app on Supabase**. Three trees:

- `web/` — **the product.** Next.js 16 (App Router), React 19, TypeScript,
  Tailwind 4, Supabase for auth/database/storage.
- `supabase/` — `migrations/` (0001-0011, applied to the live project) and
  `tests/rls_test.sql` (cross-user penetration test, must stay 14/14).
- `frontend/`, `backend/` — **legacy.** The original Expo app and Spring Boot
  API. Superseded by `web/`, kept until the rebuild is runtime-verified. Do not
  add features here.

### Two things that will bite you

1. **Next.js 16 renamed `middleware` to `proxy`.** Auth session refresh and
   route protection live in `web/src/proxy.ts`. Training-data memory is wrong
   about this — read `node_modules/next/dist/docs/` before writing Next code.
2. **`web/src/lib/supabase/database.types.ts` must keep each table's
   `Relationships` key.** Without it the Supabase client's `Schema` generic
   silently collapses to `never` and every query loses its types while still
   compiling. After regenerating, confirm a deliberate type error is caught.

## Commands

### Web app (`cd web`)

```bash
npm install
npm run dev                 # http://localhost:3000
npm run build               # production build
npx tsc --noEmit            # typecheck
npm run lint

node --env-file=.env.local e2e/smoke.mjs   # end-to-end, real Chromium
```

The E2E suite probes Supabase first and marks auth-dependent checks **SKIPPED**
when it is unreachable — skipped is not passed. Chromium lives at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; never run
`playwright install`.

Copy `web/.env.example` to `web/.env.local` and fill it in. Standalone node
scripts need `--env-file=.env.local`; they do not inherit Next's env loading.

### Database

```bash
psql "$DATABASE_URL" -f supabase/tests/rls_test.sql   # expect 14 PASS
```

## Conventions in `web/`

- **Never hardcode a colour.** Use the semantic tokens in `src/app/globals.css`
  (`bg-surface`, `text-content-secondary`, `border-line`, ...). Dark mode is
  class-based so the user's choice persists.
- **Auth checks use `getUser()`, never `getSession()`** — the latter trusts the
  cookie without revalidating it.
- **Pages call `requireUser()` / `requireOnboardedUser()`** even though the proxy
  already redirects. Routing is not an authorisation boundary; RLS backstops both.
- **Business rules go in `src/lib/actions/*`**, reads in `src/lib/data/*`.
- **Every new route needs a `loading.tsx`.** Each signed-in route is dynamic, and
  Next only prefetches a dynamic route down to its nearest `loading` boundary —
  without one, tapping a link leaves the old page frozen until the server render
  lands. Build it from `components/ui/page-skeleton.tsx` and mirror the real
  page's container width and layout.
- **Per-request reads that more than one caller needs go through React `cache()`**
  (`getCurrentUser`, `getProfile`, `listSubjectOptions`, `getSubject`, `getNote`).
  The shell, the page and `generateMetadata` all run in one request; uncached,
  each one is another round trip to Mumbai.
- **RLS is the security boundary.** Any new table needs policies in a migration
  plus coverage in `supabase/tests/rls_test.sql`. New `public` functions need
  EXECUTE revoked from `anon` unless deliberately public.
- **No fake functionality.** If something cannot be finished, say so rather than
  stubbing it to look complete.

---

# Legacy trees (`frontend/`, `backend/`)

Retained for reference until the rebuild is verified. The notes below describe
them as they stand.

## Repository layout

- `frontend/` — React Native app on Expo (JavaScript, no TypeScript)
- `backend/` — Spring Boot 2.7 REST API built with Maven

## Commands

### Frontend (`cd frontend`)

```bash
npm install
npm start          # expo start (Metro + QR code)
npm run android    # expo start --android
npm run ios
npm run web
```

There is no test runner, linter, or formatter configured — no jest/eslint/prettier/babel/metro config files, and no `test` script. Verify frontend changes by running the app.

### Backend (`cd backend`)

```bash
mvn spring-boot:run                              # http://localhost:8080
mvn test                                         # full suite (currently one context-load test)
mvn test -Dtest=StudyMateApplicationTests#contextLoads   # single test
mvn clean package && java -jar target/studymate-backend-1.0.0.jar

mvn spring-boot:run -Dspring-boot.run.profiles=prod       # exercise the prod profile
```

`backend/mvnw` is checked in but not executable — use the system `mvn`, or `sh mvnw`.

Dev runs on an in-memory H2 database with `ddl-auto=create-drop`, so **all data is lost on every restart**. H2 console: `http://localhost:8080/h2-console`, JDBC URL `jdbc:h2:mem:studymatedb`, user `sa`, empty password.

## Architecture

### The two data stores barely talk to each other

This is the single most important thing to understand before changing anything.

- **AsyncStorage (`frontend/src/services/StorageService.js`)** holds the features users actually see: subjects and study sessions. `SubjectService` and `SessionService` are pure local storage — no network.
- **The backend** knows only about an `Event` entity. It has no concept of subjects or sessions.

`SyncService` is the seam between them, and it is mostly unimplemented: `syncSubjectsToBackend` and `syncSessionsToBackend` just read local data and `console.log` it. Only `syncEventsFromBackend` / `createEventInBackend` / `testBackendConnection` make real calls, and the only screen that uses them is `BackendTestScreen`. The README's "offline-first with cloud sync" describes the intent, not the code.

So: a feature touching subjects or sessions is a frontend-only change; a feature touching events is a backend change plus `BackendTestScreen`.

### Backend: one entity, classic three layers

`EventController` (`/api/**`) → `EventService` → `EventRepository extends JpaRepository`. Conventions worth matching:

- Business rules live in the service, not the controller — e.g. `createEvent` throws `IllegalArgumentException` for a past `eventDate`.
- `GlobalExceptionHandler` (`@RestControllerAdvice`) turns `MethodArgumentNotValidException` into a `{field: message}` 400 body and `IllegalArgumentException` into `{error: message}`. `EventController.createEvent` *also* catches these inline, so both paths exist.
- `Event` maintains `createdAt`/`updatedAt` inside its setters rather than with JPA lifecycle callbacks. A repository `save()` that bypasses setters will not bump `updatedAt`.
- Spring Boot 2.7 means **`javax.persistence` / `javax.validation`**, not `jakarta.*`. `pom.xml`, `system.properties`, and the Dockerfile all pin **Java 11** (the README's "Java 17" is wrong).
- CORS is wide open twice over: `CorsConfig` (both a `WebMvcConfigurer` mapping and a `CorsConfigurationSource` bean) and `@CrossOrigin(origins = "*")` on the controller.

### Frontend: theming is the cross-cutting system

```
constants/Colors.js  →  contexts/ThemeContext.js  →  useTheme() in every component
```

`Colors.js` exports `Colors.{light,dark}` (nested: `text.primary`, `background.secondary`, `glass.background`, `border.light`, …) and `Gradients.{light,dark}` (arrays for `LinearGradient`). `ThemeProvider` picks one set based on `isDark` and exposes `{ isDark, toggleTheme, colors, gradients }`.

Rules the existing components follow:

- Never hardcode a color. Read `colors.*` / `gradients.*` from `useTheme()` and apply it as an inline style on top of the `StyleSheet` entry.
- Screens paint their own background by inlining `<LinearGradient colors={gradients.background} start={{x:0,y:0}} end={{x:1,y:1}}>` as the root element, combined with `safeAreaStyle` from `hooks/useSafeArea`.
- `isDark` is component state only — it defaults to dark and is **not persisted**, so the theme resets on every app launch.

### Frontend: navigation and headers are centralized in `App.js`

`App.js` builds the whole navigation tree: a bottom tab navigator, plus a `SubjectsStack` (`SubjectsMain` → `LogStudy`) nested inside the Subjects tab. It also renders the shared `Header` through the tab navigator's `header` option, driven by a `tabHeaders` map of title/subtitle strings.

Adding a tab means editing three places in `App.js`: the `tabBarIcon` if-chain, the `tabHeaders` map, and the `<Tab.Screen>` list. The Subjects tab sets `headerShown: false` because its stack screens (`SubjectsScreen`, `LogStudyScreen`) render `Header` themselves — `Header` auto-shows a back button when `route.name === 'LogStudy'`.

### Frontend: no global state, so data goes stale

Every screen loads from `StorageService` in its own `useEffect`. Only `DashboardScreen` re-reads on navigation via `useIsFocused`. `SubjectsScreen`, `ProgressScreen`, and `LogStudyScreen` load once on mount and call their loader manually after a mutation, which means edits made on another screen are not picked up. Use the `useIsFocused` pattern when adding screens that display stored data.

### API client

`frontend/src/services/ApiService.js` hardcodes `API_BASE_URL` to the deployed Render URL — there is no env var or config file. Point it at `http://localhost:8080/api` (or your LAN IP for a physical device) to develop against a local backend. Axios interceptors log every request and response, so the Metro console is the place to debug connectivity.

## Known broken / dead code

Verified against the current tree — do not assume these are intentional.

- **`SubjectService.getSubjects()` is never defined** in `StorageService.js` but is called from 8 places (all four data screens and three `SubjectService` methods). Every subject read throws. Fix this first when touching subject features.
- `BackendTestScreen.js:21` references an undefined `YOUR_ACTUAL_IP` inside `testNetworkConnectivity`, which is never called.
- `application-prod.properties` switches the driver to PostgreSQL but does not override `spring.jpa.database-platform=org.hibernate.dialect.H2Dialect` inherited from `application.properties`.
- `components/GradientBackground.js` and `components/MainContainer.js` are identical apart from names, and neither is imported anywhere.
- `TimetableScreen` and `SettingsScreen` are static stubs with hardcoded dark colors — they predate the theme system and ignore `useTheme()`.
- `STORAGE_KEYS.GOALS` and `STORAGE_KEYS.TIMETABLE` are declared but unused.
- `backend/target/` compiled output is committed and there is no backend `.gitignore`; avoid adding more build artifacts to commits.

## Deployment

The backend deploys to Render from `backend/`: multi-stage `Dockerfile` (`maven:3.8.1-openjdk-11` → `openjdk:11-jre-slim`), with `Procfile` and `system.properties` as fallbacks for the buildpack path. `server.port=${PORT:8080}` and `spring.datasource.url=${SPRING_DATASOURCE_URL:...}` are the only environment hooks.
