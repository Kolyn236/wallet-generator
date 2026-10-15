# Анализ состояния ChainCourier

Дата фиксации: 2026-10-15

## Область анализа

Анализ выполнен по состоянию удалённой ветки `main` на коммите:

```text
5784481cd5aaf7841c99b90888ceb4300452f6a1
```

Проверены архитектурные документы, frontend/backend runtime, локальные и удалённые ветки, открытые issues и pull requests, история GitHub Actions и repository-local verification contract.

GitHub Project board не был прочитан: текущему GitHub-токену не хватает scope `read:project`. Раздел о карточках основан на issues #54–#57.

В рамках анализа исходный код, runtime и настройки проекта не изменялись. Полный локальный verification suite не запускался.

## Краткий вывод

Архитектурная и security-основа проекта сильная. Главные риски находятся не в выбранной модели приложения, а в состоянии delivery-процесса:

1. GitHub Actions перестал фактически исполнять проверки;
2. документация и verification contract отстали от уже добавленного Litecoin runtime;
3. TRON разрабатывался в нескольких пересекающихся ветках и worktree;
4. открытые устаревшие PR создают неоднозначность относительно канонической реализации.

Рекомендуемый порядок: сначала восстановить доверие к baseline, затем последовательно выполнить #54, #55, #56 и #57.

## Сильные стороны

### Non-custodial граница

Проект последовательно сохраняет ключевые инварианты:

- seed phrase, WIF и private key остаются в памяти браузера;
- Symfony не подписывает транзакции;
- подготовка, локальная подпись и broadcast разделены;
- backend получает только публичные данные и уже подписанные транзакции;
- локально вычисленная идентичность транзакции сравнивается с результатом provider/node.

### Архитектура

Текущая модель соответствует характеру поддерживаемых сетей:

- Symfony modular monolith без преждевременного выделения микросервисов;
- capability-интерфейсы вместо универсального blockchain API;
- отдельные semantics для UTXO, EVM и будущего TRON runtime;
- точные chain/network и asset-route keys;
- отсутствие fallback на другой adapter;
- browser wallet identity отделён от asset-route balance и transfer behavior.

Переписывать архитектурный фундамент перед следующими задачами не требуется.

### Детерминированная проверка

В репозитории присутствуют deterministic frontend vectors для DOGE, BTC, LTC, ETH и USDT ERC-20, backend tests, PHPStan, PHP-CS-Fixer и Docker smoke topology. Repository-local `.hermes/verify.yaml` задаёт воспроизводимый verification contract.

Кодовая база остаётся относительно компактной: около 14,5 тыс. строк отслеживаемых PHP, TypeScript, TSX, CSS, YAML и Markdown; 85 backend source-файлов, 15 backend test-файлов и 41 frontend source-файл.

## Состояние Git и веток

На момент первоначального анализа рабочая директория была чистой, но находилась на уже смерженной ветке:

```text
feat/bitcoin-p2wpkh-recipient
7c4ab97f2013ce7482c854e1afee6426c0cea7d9
```

Изменения этой ветки вошли в `main` через PR #52. Актуальный удалённый `main` находился на `5784481`.

Для новых работ следует всегда начинать со свежего `origin/main`, а не продолжать текущие задачи от смерженных feature-веток.

В репозитории также существует большое количество worktree и локальных task-веток. Несколько из них содержат незакоммиченные изменения. Их нельзя массово удалять до переноса полезных результатов, но после определения канонической TRON-реализации старые worktree следует инвентаризировать и очистить.

## GitHub Actions: критический риск

Последние найденные реальные успешные запуски `Quality Gate` и `Integration Smoke` относятся к 2026-09-09 и коммиту:

```text
16e6070cb754281f471db4e501682700261a3f97
```

Более поздние workflow events завершаются до создания jobs:

```text
conclusion: startup_failure
path: BuildFailed
jobs: []
```

Это означает, что на поздних PR и merge-коммитах фактически не запускались PHPUnit, PHPStan, style checks, frontend vectors и production build. PR #52 прямо фиксирует это ограничение.

Текущий API-ответ GitHub не раскрывает первопричину `BuildFailed`; поэтому нельзя утверждать, что проблема находится в тестах или исходном коде. Сначала необходимо проверить repository/account Actions state, лимиты, billing/policy и synthetic `BuildFailed` workflow.

До восстановления CI нельзя считать зелёным коммит только потому, что PR был смержен или workflow run существует.

## Расхождение Litecoin runtime и документации

Litecoin уже присутствует как рабочий route в коде:

- `ltc-litecoin-mainnet-native` помечен `ready-next`;
- зарегистрированы `litecoin-mainnet` wallet adapter и Litecoin asset-route adapter;
- реализованы backend adapter и HTTP endpoints;
- существует deterministic Litecoin vector;
- архитектурный `UTXO_EXTENSION_GUIDE.md` описывает Litecoin profile.

Одновременно README, `AGENTS.md` и основные adapter-registry документы перечисляют live routes без Litecoin. Это создаёт расхождение между фактическим runtime и заявленными инвариантами.

Дополнительные gaps:

- `.github/workflows/ci.yml` не запускает `test:litecoin-vector`;
- `.hermes/verify.yaml` не запускает Litecoin vector;
- общий проход frontend invariant test видит Litecoin как live route, но Litecoin отсутствует в нескольких явных built-in collections и точечных assertions.

Рекомендуется отдельная небольшая baseline-задача, которая синхронизирует документацию, CI, Hermes verification contract и явные registry assertions, не меняя Litecoin behavior.

## Состояние TRON-работ

Открытый PR #48 содержит полезный прототип USDT TRC-20, но построен от устаревшего `main`. Его нельзя сливать целиком в актуальное состояние.

Локально обнаружены отдельные реализации и заготовки:

- browser wallet, address и signing primitives;
- frontend route foundation;
- backend provider/capability seam;
- backend TRC-20 balance path;
- EN/RU copy и архитектурные документы;
- frontend route registration;
- незакоммиченный набор архитектурных изменений.

Наиболее содержательные ветки включают:

- `chaincourier/t_9f9db899-tron-01-frontend-wallet-route-foundation`;
- `chaincourier/t_7513761f-tron-01-backend-mainnet-adapter-and-trc`;
- `chaincourier/t_558b4bb2-tron-01-architecture-and-security-docume`.

Реализации частично пересекаются и местами предлагают разные границы. Начинать TRON с нуля нецелесообразно, но объединять ветки wholesale также нельзя. Нужна выборочная пересборка на актуальном `main` с одним каноническим API и registry model.

## Оценка карточек

### #54 — TRON-01: rebase USDT TRC-20 foundations onto current main

Это правильная первая продуктовая задача.

Рекомендуемый подход:

- создать свежую ветку от актуального `main`;
- использовать PR #48 и локальные task-ветки только как источники отдельных решений;
- сохранить отдельную `tron-mainnet` wallet identity;
- сохранить browser-only key/signing boundary;
- включить deterministic TRON vectors в CI и `.hermes/verify.yaml`;
- оставить route неактивным, пока отсутствует полный backend/frontend transfer flow;
- не переносить старый PR одним merge или массовым cherry-pick.

### #55 — TRON-02: finish Symfony TRC-20 HTTP API and validation

Карточка правильно следует после #54, но является security-sensitive и достаточно крупной. Реализацию следует вести внутренними этапами:

1. capability/provider contracts;
2. balance;
3. prepare и строгая валидация provider snapshot;
4. broadcast с проверкой txid;
5. transaction status model;
6. controller и stable error mapping.

Особое внимание требуется TAPOS, expiry, fixed contract/calldata validation, integer quantities, retry semantics и различию между `accepted-for-broadcast` и подтверждённым execution success.

### #56 — TRON-03: complete browser TRC-20 transfer flow and activate route

Frontend flow следует реализовывать только поверх окончательного контракта #55. Старый `TronTransferPanel` можно использовать как reference, но не как источник API-контракта.

UI/state model должен различать как минимум:

```text
prepared
locally signed
accepted for broadcast
observed
executed successfully / executed with failure
```

Нельзя представлять принятие транзакции provider-ом как успешное исполнение.

Route должен стать live только после наличия wallet adapter, asset-route adapter, backend contract, deterministic vectors и fail-closed regression coverage.

### #57 — HACK-01: make ERC-20 vs TRC-20 USDT routing demo-ready

Карточка хорошо показывает главное продуктовое отличие ChainCourier:

- один asset USDT;
- разные Ethereum и TRON wallet identities;
- разные fee assets;
- browser-local signing;
- отсутствие fallback между маршрутами.

Эту работу следует выполнять последней. До завершения #54–#56 route chooser будет демонстрировать маршрут, который ещё не обеспечивает полный transfer flow.

## Открытые pull requests

### PR #48

Полезен как источник TRON-решений, но базируется на старом состоянии. После открытия заменяющего PR по #54 его следует закрыть как superseded.

### PR #49 и #50

Оба относятся к одному health no-cache изменению. Не следует сохранять два конкурирующих draft PR. Нужно выбрать актуальную реализацию либо повторить минимальный fix от свежего `main`.

### PR #43

Production deployment PR старый и содержит крупный отдельный operational scope. Его не следует смешивать с TRON/hackathon работами. Перед возвращением к нему нужен rebase/review относительно текущей topology и текущих production requirements.

### PR #46

Supply-chain PR является stacked change поверх другой незавершённой production-hardening ветки. Его нельзя сливать в текущем виде. Полезные guardrails следует перенести отдельным актуальным PR после определения production baseline.

## Рекомендуемый порядок действий

### Этап 0 — вернуть доверие к baseline

1. Определить и устранить причину GitHub Actions `startup_failure` / `BuildFailed`.
2. Подтвердить реальный запуск Quality Gate и Integration Smoke на актуальном `main` или тестовом PR.
3. Синхронизировать Litecoin в README, архитектурных документах, CI, `.hermes/verify.yaml` и frontend invariant assertions.
4. Определить судьбу PR #43, #46, #48, #49 и #50.
5. Инвентаризировать TRON worktree и отметить, из каких веток будут переноситься конкретные части.

### Этап 1 — TRON foundation

Выполнить #54 на свежем `main`, сохранив route planned/fail-closed и добавив repository-local deterministic verification.

### Этап 2 — backend contract

Выполнить #55 без server-side signing и без ослабления provider validation.

### Этап 3 — browser transfer flow

Выполнить #56, активируя route только после полного прохождения acceptance criteria.

### Этап 4 — demo UX

Выполнить #57 как ограниченное UI-улучшение поверх уже работающих ERC-20 и TRC-20 маршрутов.

## Итоговая оценка

- Архитектура: хорошая.
- Security model: сильный.
- Криптографическая regression coverage: разумная, но CI должен снова начать её исполнять.
- Product direction: TRON и наглядное сравнение ERC-20/TRC-20 логично продолжают текущую модель.
- Главный текущий риск: отсутствие достоверного automated quality signal.
- Главный организационный риск: несколько параллельных TRON-реализаций и устаревшие открытые PR.

Приоритетная рекомендация: не начинать широкий новый feature scope до восстановления baseline verification; после этого первой продуктовой задачей выполнять #54.