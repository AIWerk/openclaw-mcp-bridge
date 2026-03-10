# Launch Plan — openclaw-mcp-bridge

## 1. npm publish
- [ ] npm account létrehozás (npmjs.com, AIWerk vagy openclaw-mcp-bridge scope)
- [ ] package.json: name, version (1.0.0), description, keywords, license, repository, files
- [ ] `prepublishOnly` script: `npm run build && npm test`
- [ ] `.npmignore` vagy `files` mező (csak dist/ + config + README)
- [ ] `npm publish` — első release
- [ ] Telepítés tesztelése: `openclaw plugins install openclaw-mcp-bridge`

## 2. awesome-openclaw lista
- [ ] Repo: github.com/vincentkoc/awesome-openclaw (60 ⭐)
- [ ] PR küldése: MCP plugins szekcióba felvétel
- [ ] Rövid leírás: "Bridges 12+ MCP servers into OpenClaw via a single tool with lazy connect, 3 transports (stdio/SSE/streamable-http), and a pre-configured server catalog."

## 3. OpenClaw GitHub (issue kommentek)
- [ ] #4834 — komment a mi bridge-ünkről (szöveg kész, Attila posztol)
- [ ] #29053 — komment (szöveg kész, Attila posztol)
- [ ] Hangnem: szerény, nem reklám — "I built this for my own setup, sharing in case useful"

## 4. OpenClaw Discord showcase
- [ ] #showcase vagy #plugins csatorna
- [ ] Rövid bemutató: mit csinál, hogyan telepíthető, screenshot/gif ha van
- [ ] Link a repo-ra + npm-re (ha már publisholva van)

## 5. GitHub Discussion (saját repo)
- [ ] Discussion nyitása: "Roadmap & Feature Requests"
- [ ] TODO.md tartalmát átlinkelni
- [ ] Közösségi input kérés: melyik feature a legfontosabb?

## 6. README frissítés (marketing értékű)
- [ ] Badges: npm version, CI status, license
- [ ] "Why this bridge?" szekció — miben más mint a többi (3 transport, catalog, lazy connect)
- [ ] Comparison table (opcionális, nem agresszív)
- [ ] Install: npm parancs az első helyen (git clone másodlagos)

## Sorrend
1. **npm publish** — alap, ezután minden könnyebb
2. **README frissítés** — hogy aki ránéz, meggyőző legyen
3. **awesome-openclaw PR** — passzív forgalom
4. **GitHub issue kommentek** — Attila posztol (#4834, #29053)
5. **Discord showcase** — aktív közönség
6. **GitHub Discussion** — közösség építés

## Konkurrensek (referencia)
| Projekt | ⭐ | Erősség |
|---|---|---|
| androidStern/openclaw-mcp-adapter | 25 | npm-ről telepíthető, egyszerű |
| lunarpulse/openclaw-mcp-plugin | 12 | streamable-http, jó doksik |
| gabrielekarra/openclaw-mcp-bridge | 4 | smart mode, schema compression |
| ChrisLAS/openclaw-mcp-bridge | 2 | Ollama fókusz |
| protolabs42/openclaw-plugin-mcp | 1 | trust levels, toolFilter, CLI integráció |

## Mi a miénk erőssége
- **3 transport** (egyedüliként mind a hármat támogatjuk)
- **12 előkonfigurált szerver** install scripttel (zero-config)
- **38 teszt + CI** (GitHub Actions, Node 20+22)
- **Lazy connect + idle timeout** (resource efficient)
- **Részletes roadmap** (smart mode, security, reliability — TODO.md)
