# Pure Ratio 横向滚动简谱（Retune Preview Pure Mode + Lattice View）——二次差距盘点 & 修复指令（基于你最新上传的 ZIP）

> 本文目标：在你已经按上一份升级方案落地（`domain/scoreTimeline/*` + `PureRatioHorizontalScoreOverlay`）之后，再做一次**“不留死角”的缺口与不足清单**，把所有仍未实现/完成度不足/可能踩雷的点逐一列出来，并给出**可直接照做的详细改进指令**。  
>  
> 你最终验收目标（你原话抽象成可测标准）：
> - **场景**：Retune Preview + Pure UI Mode + Lattice View
> - **表现**：黑字白底、横向滚动
> - **谱面**：纯率“完全简谱”——数字被 ratio/decimal 替代；可读性达到“谱纸级”
> - **同步**：跟随 preview 播放时间轴实时移动；多声部独立行谱；支持和弦/并发

---

## 0. 你这版已经明显“做对”的部分（不再重复劳动）

你最新 ZIP 里这些关键点已经落地（这是好消息，也意味着后续主要是“打磨与补齐”）：

- ✅ 新增时间轴数据结构：`domain/scoreTimeline/types.ts`
- ✅ MIDI → 时间轴构建：`domain/scoreTimeline/buildFromMidi.ts`
- ✅ 横向滚动谱面 Overlay：`components/overlays/PureRatioHorizontalScoreOverlay.tsx`
- ✅ 已接入 Pure UI Mode：`components/DesktopOverlay.tsx` / `components/mobile/MobileOverlay.tsx`
- ✅ `MidiRealtimePlayer` 的 ratio update payload 已扩展（包含 startTick/startTime 等），并通过 `setPlayingRatios` 写入 store：`utils/midiRealtimePlayer.ts` + `MidiFileRetuneSection.tsx` + `store/storeImpl.ts`
- ✅ ratio / decimal / both 显示模式开关、octave folding（dot/comma）、bars、chord group、cents/Hz/primes（基础版）都已能看到效果

因此本文不再教你怎么“从 0 到 1”，而是专注：**还有哪些没做完/做得不稳/会在真实 MIDI 下出问题**。

---

## 1. 当前仍未实现 / 完成度不足（总清单）

我把问题按「阻塞程度」分成四档：

- **P0 阻塞**：不修会直接影响“实时观看/读谱/稳定性”
- **P1 高优先**：在真实 MIDI 或多声部下会明显难用
- **P2 中优先**：功能正确但体验/可维护性差，或边界条件不可靠
- **P3 低优先**：锦上添花

每个问题都包含：
- 现象（你会看到什么）
- 影响（为什么它会阻碍最终目标）
- 证据位置（文件 + 关键行号）
- 详细修复指令（按步骤写到“你照抄就能改”）

---

# P0 阻塞问题（强烈建议优先处理）

## PRS-P0-001：播放时每帧全量扫描 events，长 MIDI 会卡成 PPT

### 现象
- MIDI 稍长（几千 note）时：谱面滚动会抖、延迟明显，甚至浏览器主线程占满。
- CPU 占用会随着 note 数量线性变大。

### 影响
你要的是“实时观看横向滚动”，这类卡顿会直接毁体验；尤其在移动端/低配设备更明显。

### 证据位置
`components/overlays/PureRatioHorizontalScoreOverlay.tsx`
- 可见声部计算：`const visibleVoices = useMemo(... voice.events.forEach ...)`  
  **约 L337–L363**（你现在是“每次 playhead 变化都遍历 voice.events 全量过滤 + 分组”）

关键片段（节选）：
- L337: `const visibleVoices = useMemo(() => {`
- L341: `voice.events.forEach((event) => { ... if (event.t1 < windowStart || event.t0 > windowEnd) return; ... })`

### 修复指令（推荐：建立时间索引 + 二分截取）
目标：**每帧只处理“窗口内的那一小段 events”**，不要全量扫。

1) **在构建 ScoreDocument 时为每个 voice 预构建索引**
   - 新建：`domain/scoreTimeline/index.ts`（或直接在 `types.ts` 里加）
   - 给 `ScoreVoice` 增加可选索引字段，例如：
     ```ts
     export type ScoreVoiceIndex = { t0s: number[] }; // 与 events 同序
     export type ScoreVoice = { voiceId: string; label?: string; events: ScoreEvent[]; index?: ScoreVoiceIndex };
     ```
2) **在 `buildScoreFromMidi()` 末尾生成 `t0s`**
   - `domain/scoreTimeline/buildFromMidi.ts`
   - 在 `events` sort 完成后加：
     ```ts
     const t0s = events.map(e => e.t0);
     return { voiceId: voice.voiceId, label: voice.label, events, index: { t0s } };
     ```
3) **写一个通用二分工具**
   - 新建：`domain/scoreTimeline/search.ts`
   - 实现：
     ```ts
     export const lowerBound = (arr: number[], x: number) => {
       let lo = 0, hi = arr.length;
       while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid] < x) lo = mid + 1; else hi = mid; }
       return lo;
     };
     export const upperBound = (arr: number[], x: number) => {
       let lo = 0, hi = arr.length;
       while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid] <= x) lo = mid + 1; else hi = mid; }
       return lo;
     };
     ```
4) **Overlay 中用索引截取窗口事件，而不是全量扫描**
   - `PureRatioHorizontalScoreOverlay.tsx`
   - 在 `visibleVoices` 里替换 `voice.events.forEach`：
     - 先拿 `t0s = voice.index?.t0s ?? voice.events.map(...)`
     - `startIdx = lowerBound(t0s, windowStart - 0.2)`（给一点 buffer）
     - `endIdx = upperBound(t0s, windowEnd + 0.2)`
     - 只遍历 `voice.events.slice(startIdx, endIdx)`
5) **分组时只对 slice 做 chordGroup 合并**
   - 这样复杂度从 O(总 events) 变为 O(窗口 events)

### 验收标准
- 10k notes 的 MIDI，在播放时谱面仍能保持平滑滚动（主线程明显下降）。
- Performance 面板里 `PureRatioHorizontalScoreOverlay` 不再成为 top hotspot。

---

## PRS-P0-002：Lattice Selection “提示”逻辑绑定 previewPositionSeconds，导致每帧扫全谱（隐形性能炸弹）

### 现象
你选中一个 lattice node 后，本意是提示“接下来将出现的最接近音符”。  
但当前实现里，提示 useEffect 依赖了 `previewPositionSeconds`，导致它在播放时 **每 10ms+ 触发一次**，而内部又遍历 `doc.voices -> voice.events` 全量扫描。

### 影响
即使你修了 PRS-P0-001，这个 effect 也会把性能再拖回去。

### 证据位置
`PureRatioHorizontalScoreOverlay.tsx`
- `useEffect(() => { ... if (!doc || !selectedNode) ... doc.voices.forEach ... })`
- **约 L257–L292**（你目前依赖数组是 `[selectedNode, previewPositionSeconds, scoreVersion]`）

### 修复指令（把“提示搜索”变成：选中时触发 + 轻量索引）
推荐两种方式，选一种就行：

#### 方案 A（最简单可用）：只在 selectedNode 变化时计算一次
1) 把依赖数组改成：`[selectedNode, scoreVersion]`  
2) 取 playheadSeconds 用 ref：
   - 在组件顶部维护 `const playheadRef = useRef(0);`
   - 每次渲染把 `playheadRef.current = playheadSeconds;`
   - 提示 effect 里用 `playheadRef.current` 作为当前时间

这会让提示不会“随着时间每帧重算”，但提示就不是“动态跟随下一次出现”了（很多人其实能接受）。

#### 方案 B（推荐）：为“按 nodeId / ratioKey 的事件”建立索引，然后二分找最近一次
1) 构建一个 Map：`nodeId -> sorted event.t0 list`（或 `ratioKey -> ...`）
   - 在 buildScoreFromMidi 后做一次预计算（或 overlay 里 useMemo，依赖 scoreVersion）
2) selectedNode 改变时：
   - 从 map 取出该 node 对应的 times
   - 二分找到 `>= playheadSeconds` 的最小 t0
   - 把该 eventId 设为 hintEventId
3) 提示只要 set 一次，不需要每帧扫全谱

### 验收标准
- 播放时 CPU 不再因为 lattice selection 而飙升
- 选择 node 仍能在 50ms 内给出“下一处出现位置”的提示

---

## PRS-P0-003：Solo 目前只是“变暗”，并没有真正折叠声部（空间与性能都没省）

### 现象
点声部 label 后其他声部只会 `opacity-40`，但仍然占高度、仍然渲染所有 lane。

### 影响
- 多声部时可读性不够（你要“独立行谱”，solo 应该让读谱更专注）
- 性能也没提升（仍渲染所有组）

### 证据位置
`PureRatioHorizontalScoreOverlay.tsx`
- `toggleSolo`：约 L455–L457（只设置 state）
- 渲染时用 `isDimmed` 而不是过滤 lanes：约 L520+（label 列）和 L560+（lane 背景线）

### 修复指令（真正过滤 lanes）
1) 在 `visibleVoices` 的 useMemo 最后加过滤：
   ```ts
   const lanes = ... // 现有 map 结果
   return soloVoiceId ? lanes.filter(l => l.voice.voiceId === soloVoiceId) : lanes;
   ```
2) Label 列也要同步改为渲染过滤后的 lanes。
3) 清除 solo 的入口：
   - 再加一个按钮 `All Voices`，或者 label 再点一次取消（你已有这个逻辑）。
4) **注意**：过滤后 laneIndex 会变化
   - 你现在用 `top: lane.voiceIndex * laneHeight`
   - 改成 `renderIndex`（map 第二个参数）或自己计算 `laneRowIndex`

### 验收标准
- Solo 后只显示 1 条声部行谱，纵向高度显著减少
- 播放时渲染元素数量减少（性能提升）

---

# P1 高优先问题（不修会“很难用”）

## PRS-P1-001：谱面“简谱感”还不够强——目前更像“钢琴卷帘（piano roll）+ ratio 标签”

### 现象
- 你现在用的是“按时间宽度的块（button）”，确实能滚动、能看 ratio，但**缺少简谱的视觉语法**：
  - 没有下划线/连线/附点等“时值符号”（你现在靠宽度表达）
  - 没有明确的“拍”格（只有小节线 bars）
  - 没有休止符（空白就是休止）

### 影响
你说的“完全简谱”通常意味着：**即使不听，也能从谱面看出节奏**。  
目前版本“可用”，但读谱效率离“谱纸级”还有距离。

### 修复指令（分三步走：先易后难）
#### Step 1：补 beat grid（比补下划线更值）
1) 在 overlay 里在 bars 基础上再算 beats：
   - `beatSeconds = ticksPerBeat * secondsPerTick`
   - 在 windowStart/windowEnd 范围内画轻线
2) bars 线加粗、beats 线变细  
3) 可选：每小节写一个 bar number（在顶部小字）

#### Step 2：补 rest event（见 PRS-P1-002）
让“空白”变成可读的符号，而不是看不见的空格。

#### Step 3（进阶）：把“块宽度”升级为“简谱时值线条”
- 方案 A：在块内用 SVG 画 underline（根据 durationTicks 映射线条数/长度）
- 方案 B：完全改成“每拍一个 cell”，用 grid 布局（更像真正简谱，但工程量更大）

---

## PRS-P1-002：缺少休止符/空拍显示（“完全简谱”缺口）

### 现象
如果某个声部有长时间空白，谱面看起来像“断了”，读谱时难以判断这是休止还是缺失。

### 影响
完全简谱里休止符是必要信息，尤其多声部时更重要。

### 修复指令（建议在 ScoreDocument 构建阶段插入 rest 事件）
在 `domain/scoreTimeline/buildFromMidi.ts`：

1) 在每个 voice 的 `events` sort 完成后，插入 rest：
   ```ts
   const withRests: ScoreEvent[] = [];
   for (let i = 0; i < events.length; i++) {
     const e = events[i];
     withRests.push(e);
     const next = events[i+1];
     if (!next) break;
     const gap = next.t0 - e.t1;
     if (gap >= 0.08) { // 阈值可调：小于 80ms 不显示
       withRests.push({
         id: `rest-${voice.voiceId}-${i}`,
         type: 'rest',
         voiceId: voice.voiceId,
         t0: e.t1,
         t1: next.t0,
         duration: gap,
       });
     }
   }
   ```
2) overlay 渲染 group 时对 `type === 'rest'`：
   - 用虚线框 / 更淡的灰色
   - `main` 文本显示 `rest` 或 `—`（极简）
3) rest 也要参与 isActive 高亮（让你知道此刻在休止）

---

## PRS-P1-003：点击音符目前只能“选 lattice node”，但不能“定位/跳转播放进度”

### 现象
你点击事件块会触发 `selectNode`，但不会把播放进度跳到该事件时间点。

### 影响
真实用谱时最常见的操作是：
- “点一下这里，从这儿开始听/练”
- “反复播放这一小节”
目前缺失会让这个功能更像展示，而不是“可交互的练习工具”。

### 修复指令（最小可行：点击 -> 更新 seekTick 并触发 preview seek）
你现在的 seek 逻辑在 `MidiFileRetuneSection.tsx` 内部（局部 state），外部 overlay 没法直接调用。建议加一个 store action 或 midiRetuner 方法。

**推荐实现路径：给 store 增加 action：`seekRetunePreview(seconds)`**

1) 在 store（`store/storeImpl.ts`）里增加一个 action：
   - 需要拿到 `realtimePlayer.current` 才能 seek。当前 realtimePlayer 在 `MidiFileRetuneSection` 内用 ref 管。  
   - 因此更合理：把 seek action 放在 `midiRetuner` 对象里（存一个回调）。

2) 在 `MidiFileRetuneSection.tsx`：
   - 初始化时把一个函数写入 store：
     ```ts
     updateState({ previewSeekToSeconds: (s: number) => realtimePlayer.current.seekToSeconds(s) });
     ```
   - 你需要在 `MidiRealtimePlayer` 增加 `seekToSeconds()`（如果没有）。

3) 在 `utils/midiRealtimePlayer.ts` 增加 seek：
   - 逻辑：stop 当前播放 -> 以 startAtSeconds = targetSeconds 重新 play（最稳，不做复杂 scheduler patch）
   - 同时清空 ratioQueue/currentRatios/visualQueue（否则显示残留）

4) overlay 点击时：
   - 如果 `midiRetuner.previewSeekToSeconds` 存在，就调用：
     ```ts
     midiRetuner.previewSeekToSeconds(group.t0);
     ```
   - 同时更新 store 的 `previewPositionSeconds = group.t0`

### 验收标准
- 点击任意事件块，预览播放会跳到该位置并继续滚动
- ratio/高亮/scroll 同步不乱

---

## PRS-P1-004：缺少缩放（pxPerSecond）与窗口长度（pre/post seconds）控制

### 现象
- `DEFAULT_PX_PER_SECOND = 120`、`DEFAULT_PRE_SECONDS = 6`、`DEFAULT_POST_SECONDS = 12` 写死。
- 对快/慢曲、长音符、密集音符都不一定合适。

### 影响
读谱最重要的是“密度合适”。不能缩放会让：
- 慢曲：块太长，信息密度太低
- 快曲：块挤成一坨

### 修复指令
1) 把这三个常量改成 state：
   ```ts
   const [pxPerSecond, setPxPerSecond] = useState(120);
   const [preSeconds, setPreSeconds] = useState(6);
   const [postSeconds, setPostSeconds] = useState(12);
   ```
2) 加 UI 控件（slider 或 +/- 按钮）
3) 用 state 替换所有计算：
   - `timelineWidth = totalDuration * pxPerSecond`
   - `windowStart/end` 用 pre/post
4) 可选：在滚轮/触控板上支持 zoom（按住 Alt/ctrl 才缩放，避免误触）

---

## PRS-P1-005：ratio 文本会被 truncate，长比率读不全且无 tooltip

### 现象
`<div className="... truncate">` 会把长 ratio 截断（例如 `531441/524288`、`2187/2048` 等）。

### 影响
你“数字换 ratio”的核心价值就是看清楚 ratio。截断等于直接损失信息。

### 证据位置
`PureRatioHorizontalScoreOverlay.tsx`
- 事件块内部：`<div className="text-[11px] ... truncate">{label.main}</div>`（约 L615 附近）

### 修复指令
- 最小修复：给块加 `title={fullText}`
  ```tsx
  <button ... title={`${label.main}${label.sub ? `\n${label.sub}` : ''}${extras ? `\n${extras}` : ''}`}>
  ```
- 更好：hover 时显示自定义 tooltip（避免移动端 hover 不可用，可点击弹出）

---

# P2 中优先问题（正确性/可维护性/边界条件）

## PRS-P2-001：Tempo/TimeSignature 只取“第一个遇到的”，与复杂 MIDI 不兼容

### 现象
- `buildScoreFromMidi()` 的 tempo 取法是遇到第一个 setTempo 就 break（`buildFromMidi.ts` L19–L35）。
- timeSignature 也是遇到一个就 return。
- `MidiRealtimePlayer` 里 tempo 取法又略不同（`utils/midiRealtimePlayer.ts` 构造函数里是“遍历所有 track，遇到 setTempo 就覆盖 microsecondsPerBeat”）。

### 影响
如果 MIDI 有：
- tempo change
- 多 track 中 tempo/event 分布异常  
那么播放与谱面 bars 可能不一致。

### 修复指令（至少做到“取最早的 tempo/timeSig 事件”）
1) 解析所有 track 的 tempo/timeSig 事件，带 absTick：
   - 你已经在 midiFileRetune 里计算 absTick（events flatten 时），可以复用思路
2) 找 `absTick` 最小的 tempo/timeSig 作为初值（兼容大多数 MIDI）
3) **更完整**：支持 tempo map（进阶），需要把 tick→seconds 变成分段函数（工程量大，可后置）

---

## PRS-P2-002：ChordGroup 计算用 seconds epsilon，与 tick-based MIDI 的边界不稳定

### 现象
`buildScoreFromMidi()` 的 chord grouping 使用 `chordEpsilonSeconds`（默认 20ms）判断同一和弦。

### 影响
- 不同 speed、不同 tempo、不同 ticksPerBeat 下，20ms 不一定合适
- 与 `MidiRealtimePlayer` 的 chord concurrency window（30ms）也不一致

### 修复指令
1) chord grouping 改成 tick-based：
   - 用 `startTick` 差值 <= epsilonTicks
   - `epsilonTicks = Math.round(ticksPerBeat * 0.03 / secondsPerTick)` 或直接固定 tick 数
2) 或者至少把两边 epsilon 统一（player & score builder 用同一个常量/配置）

---

## PRS-P2-003：ScoreDocument builder 缺少 bar/marker 事件（types 里有但没生成）

### 现象
`ScoreEventType = 'note' | 'rest' | 'bar' | 'marker'`，但 builder 目前只生成 note（以及你如果按 PRS-P1-002 才会有 rest）。

### 影响
- 目前 bars 是 overlay 用计算画线，没法对每个 voice 做“按小节对齐的布局”
- marker（段落/排练记号）未来很难加

### 修复指令
- 在 builder 里生成 bar 事件（全局或按 voice）：
  1) 用 tempoInfo + timeSig 计算每小节起点 t
  2) push `{type:'bar', t0:t, t1:t, duration:0}`
- overlay 里 barPositions 可以直接从 doc.events 读，不用再算一遍

---

## PRS-P2-004：`buildFromMidi.ts` 里 `events: any[]` 破坏类型安全

### 现象
`voices` Map 的 value 是 `{ events: any[] }`，后面再塞对象。

### 影响
- TypeScript 失去保护，后续加字段容易漏
- IDE/refactor 容易出错

### 修复指令
- 把 `any[]` 改成 `ScoreEvent[]`：
  ```ts
  const voices = new Map<string, { voiceId: string; label: string; events: ScoreEvent[] }>();
  ```
- events.push 的对象也显式符合 ScoreEvent

---

## PRS-P2-005：Overlay 的“隐藏/折叠/显示模式”等状态不持久，重开就丢

### 现象
`hidden/collapsed/displayMode/...` 都是 overlay 的本地 state。

### 影响
最终用户会期待：
- “我喜欢 decimal 模式”能记住
- “我不想每次都点 Hide”

### 修复指令
1) 在 store 加一个轻量 slice：
   ```ts
   pureScoreOverlay: { hidden: boolean; collapsed: boolean; displayMode: RatioDisplayMode; showBars: boolean; ... }
   ```
2) overlay 用 store 替代 useState
3) 只把“频繁变化的 playhead”放 store（你已做），其他 UI 偏好同样可以放 store

---

## PRS-P2-006：Pure Mode 里仍默认挂着旧的 `PureRatioScorePanel`，可能带来额外负担/干扰

### 现象
Desktop/Mobile Overlay 里同时渲染：
- `PureRatioHorizontalScoreOverlay`（新）
- `PureRatioScorePanel`（旧 debug 面板）

### 影响
- 旧面板里有 followRetune/followLattice 等逻辑，可能导致节点选择跳来跳去
- 多一套系统（NotationSystem）会增大维护成本和运行成本

### 修复指令（建议做成“默认隐藏，手动打开调试”）
1) 给 `PureRatioScorePanel` 外层加一个显式开关（比如 Settings -> Debug -> Show Text Score Panel）
2) 或者 pure mode 下默认不渲染 panel，只在 dev flag 下渲染：
   ```tsx
   {process.env.NODE_ENV !== 'production' && <PanelWindow ...>...}
   ```
3) 如果你未来准备完全迁移到时间轴系统，建议把旧 NotationSystem 标记为 deprecated（仅供手动输入/研究）

---

# P3 低优先（锦上添花，但对“谱纸级体验”很加分）

## PRS-P3-001：增加 bar number / 当前小节提示

### 做法
- barPositions 计算时同时输出 index
- 在 bar 线顶部加一个小标签（例如 `#12`）

---

## PRS-P3-002：增加 loop A–B（反复练习段落）

### 做法
- 两个 marker（A/B）可拖动
- 到 B 时自动跳回 A
- 这个对“用谱练习”非常实用

---

## PRS-P3-003：更强的 ratio 格式（约分、prime-limit 标记、可配置小数位）

### 做法
- decimal 小数位可调（2/3/4/6）
- fraction 强制约分（对 dynamic ratio parse 后也 simplify）
- 复杂 ratio 允许换行显示（而不是 truncate）

---

# 2. 附录：旧 NotationSystem（domain/notation/**）仍然存在的历史缺口（如果你还打算保留它）

> 你现在的“最终目标”基本已经转向 ScoreTimeline + Horizontal Overlay。  
> 但旧的 NotationSystem（`PureRatioScorePanel`）还在工程里，如果它未来还要给用户用（例如手写简谱/编辑），这些问题依旧存在：

## LEGACY-001：只支持 1–7 单字符音级，scaleSize > 7 会错谱
- 位置：`domain/notation/defaults.ts`（degreeSymbols），`PureRatioScorePanel.buildMidiNotation()` 会产出 8/9/10
- 修复：让 parser 支持多位数字 token，或者彻底不用“数字简谱文本”做 MIDI 映射

## LEGACY-002：无多声部语义（单 token stream）
- 修复：如果要做文本多声部，要引入 voiceId + per-voice timeline（其实你现在已经在 ScoreTimeline 做到了）
