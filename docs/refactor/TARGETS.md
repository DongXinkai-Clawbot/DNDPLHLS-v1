# Refactor Targets (Top 10 by LOC)

Generated with:
`rg --files -g "*.ts" -g "*.tsx" -g "!node_modules/**" -g "!dist/**" -g "!test-results/**" -g "!ui_baseline/**" -g "!android/**" -g "!api/**" -g "!native/**" | ForEach-Object { $p = $_; $lines = (Get-Content $p).Length; [pscustomobject]@{ Lines = $lines; Path = $p } } | Sort-Object Lines -Descending | Select-Object -First 10`

| Rank | Path | Lines | Domain | Split Risk | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | engine/midi/__tests__/deviceManager.test.ts | 2612 | midi/tests | low | Test-only; no runtime exports |
| 2 | components/overlays/simple/AdaptiveTemperamentSolver.tsx | 2058 | ui/solver | medium | Overlay + solver UI |
| 3 | components/overlays/SettingsTabsPart3.tsx | 1892 | ui/settings | medium | Settings UI |
| 4 | components/overlays/simple/RatioTool.tsx | 1585 | ui/solver | medium | Overlay + math UI |
| 5 | components/setharesEngine/sethares/SetharesExperiment.tsx | 1435 | ui/experiment | high | UI + experiment logic |
| 6 | components/overlays/SettingsTabsPart2.tsx | 1337 | ui/settings | medium | Settings UI |
| 7 | components/overlays/ear/EarLogic.ts | 1328 | ear/logic | medium | Logic-heavy; used by UI |
| 8 | timbreEngine.ts | 1278 | audio/timbre | high | WebAudio + runtime side-effects |
| 9 | components/museum/MuseumArchitecture.tsx | 1220 | museum/scene | high | WebGL/3D scene layout |
| 10 | components/lattice/HChromaVisualizer.tsx | 1097 | lattice/ui | medium | UI + canvas render logic |
