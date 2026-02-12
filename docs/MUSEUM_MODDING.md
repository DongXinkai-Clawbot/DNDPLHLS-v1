# Microtonality Museum — Modding & Parameters Reference

> 目的：把「博物馆」所有可调参数集中在一个地方。
>
> - 开发者：快速查到某个展品（exhibit）的编号与位置参数，直接修改。
> - 使用者：可以替换展台里的内容（文字/音频/模型），或告诉 AI agent“某个展品的 a,b 参数要怎么改”。
> - AI agent：按本文流程快速、可复现地执行修改，并在完成后同步更新本文件。

---

## 0) 关键概念与坐标约定

### 0.1 Exhibit（展品）在哪里定义？

- **主配置文件**：`data/museumExhibits.ts`
- 每个展品是一个对象，最重要字段：
  - `id`：展品唯一编号（你对 AI 下指令的“关键字”）
  - `type`：`model | text | interactive | audio`
  - `position`：`[x, y, z]`
  - `rotation`：`[x, y, z]`（单位：弧度 rad）
  - `assets`：模型/音频等资源引用
  - `content`：展品文字内容

### 0.2 a,b 参数定义（给“非 3D 开发者”用）

为了让你能用更直觉的方式改位置，这里统一定义：

- **a = position[0] = x（左右）**
- **b = position[2] = z（前后）**
- `position[1] = y` 通常保持 `0`（展台落地）

> 例：你说“`microtonal-piano` 的 a,b 改成 -6, -1”，等价于把它的 `position` 改为 `[-6, 0, -1]`（y 不变）。

### 0.3 rotation（旋转）单位说明

- rotation 的单位是 **弧度**。
- 常用换算：
  - 45° = `Math.PI / 4`
  - 30° = `Math.PI / 6`
  - 90° = `Math.PI / 2`

---

### 0.3 博物馆空间布局约定（2026 重构版，必须遵守）

> 这份约定用于保证：入口 → 主轴 → 展区 → 终厅 → 退出 的动线稳定、不会迷路、灯光/导向可复用。

- 世界坐标：**Z 向前**，**X 左右**，**Y 向上**
- 入口前厅（暗/低）：`z ∈ [-3, 0]`
- 主轴走廊（Spine）：`x ∈ [-2, +2]`, `z ∈ [0, 32]`, 高约 `3.2`
- 展区 1（左）：门洞中心 `z=8`，房间 `x ∈ [-12, -2]`, `z ∈ [4, 14]`
- 展区 2（右）：门洞中心 `z=16`，房间 `x ∈ [2, 12]`, `z ∈ [12, 22]`
- 展区 3（左）：门洞中心 `z=24`，房间 `x ∈ [-12, -2]`, `z ∈ [20, 30]`
- 终厅（Finale）：`x ∈ [-7, +7]`, `z ∈ [32, 45]`, 高约 `4.2`
- 冷却退出廊：`x ∈ [7, 11]`, `z ∈ [36, 45]`（更窄、更暗）

**展品摆放规则（不考虑展品内容也必须遵守）：**
- 展台离墙至少 `0.8m`（避免卡碰撞，也避免“贴墙”廉价感）
- 侧厅内的展台朝向入口方向，用户一进门就能看到“可停留点”
- 主轴不堆展台，只放“节奏点/停留节点”（长凳、壁龛、灯光节奏）

### 0.4 关键文件（2026 重构版）

- 空间白盒/碰撞：`components/museum/MuseumArchitecture.tsx`
- 灯光三层（Orientation / Guiding / Attention）：`components/museum/MuseumLighting.tsx`
- 非 UI 导向（地面引导线 / 门洞信标 / 终厅信标）：`components/museum/MuseumWayfinding.tsx`
- 入馆引导（pointer lock onboarding）：`components/museum/MuseumUX.tsx`
- 玩家控制与 Esc 分层：`components/museum/PlayerController.tsx`
- 入口路由（静态部署不 404）：`#/museum`（hash route）


## 1) 全局参数（MuseumScene 渲染/画质/性能）

文件：`components/museum/MuseumScene.tsx`

### 1.1 相机

- 初始相机：`camera={{ position: [0, 1.6, 6], fov: 70 }}`

### 1.2 灯光与环境

- 主方向光：`position=[6,10,6]`，强度 `1.2`
- 次方向光：`position=[-6,6,-6]`，强度 `0.6`
- 环境贴图：`<Environment preset="warehouse" environmentIntensity=... />`

### 1.3 画质预设（Graphics Quality Presets）

用户可在博物馆中按 **G** 打开 Graphics 菜单选择画质（默认 `Medium`，以确保多数电脑能维持 >50Hz）：

- `High`（默认）：当前最佳视觉（保持原有默认效果）
- `Medium`：略降 DPR/阴影贴图尺寸，平衡性能
- `Low`：最低成本（降低 DPR、关闭抗锯齿、关闭阴影）

预设参数表（由 `MuseumScene.tsx` 内部映射控制）：

| Preset | DPR (min,max) | Shadows | Antialias | ShadowMapSize | EnvIntensity |
|---|---:|---:|---:|---:|---:|
| high | [1, 1.5] | on | on | 1024 | 0.15 |
| medium | [0.9, 1.1] | off | on | 512 | 0.10 |
| low | [0.75, 1] | off | off | 512 | 0.08 |

---

## 2) 展台（ExhibitStand）固定参数考虑

文件：`components/museum/ExhibitStand.tsx`

展台的尺寸（目前是统一的固定样式；**展台保持中性外观，不用彩色方块承载内容**）：

- 底座：`boxGeometry [2.2, 0.6, 1.6]`
- 中性柱体：`boxGeometry [1.15, 1.65, 1.15]`，位置 `[0, 1.05, 0]`
- 触发范围（靠近可按 E 检视）：`CuboidCollider args=[1.5, 1.2, 1.5]`，位置 `[0, 1, 0]`

> 如果你想“只改某个展品的位置/内容”，通常不需要碰 `ExhibitStand.tsx`。

**文字展示约定**：如果需要在场景里“看到文字”，应该放在墙面展报/展框上，而不是放在展台的彩色块上。

---

## 3) 展品目录（Exhibits Index）

> 这是给人类/AI 都能快速查找的索引。**每次修改展品参数后，必须同步更新本表**。

| # | id | type | a=x | y | b=z | rotY(rad) | 主要内容 |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | harry-partch-corner | interactive | 6 | 0 | -4 | Math.PI/4 | Partch 43-tone JI & instruments |
| 2 | microtonal-piano | audio | -4 | 0 | -2 | -Math.PI/6 | 12TET / 19TET / JI A/B clips |
| 3 | ratio-wall | text | 0 | 0 | -8 | Math.PI | intervals as ratios & commas |

---

## 4) 如何替换/新增“展台里的内容（物件/音频/文字）”

### 4.1 替换文字内容（最简单）

在 `data/museumExhibits.ts` 里找到对应 `id`，修改：

- `content.title`
- `content.description`
- `content.shortDescription`
- `content.longDescription` / `sections` / `keyTakeaways` / `references`

### 4.2 替换音频内容（audio exhibit）

仍然在 `data/museumExhibits.ts` 的对应展品下：

- 推荐使用 `assets.audioClips`（支持 A/B 多段音频）
- 每段结构：

```ts
audioClips: [
  { id: '12tet', label: '12-TET', url: '/audio/xxx.mp3', description: '...' },
  ...
]
```

音频文件放置位置：

- `public/audio/`
- 并确保 `url` 以 `/audio/...` 开头

### 4.3 替换展台上的 3D 物件（model exhibit / 或任意 exhibit）

项目已支持：当某展品设置 `assets.modelUrl` 时，展台会加载并显示该模型。

在 `data/museumExhibits.ts`：

```ts
assets: {
  modelUrl: '/models/my-object.glb',
  modelTransform: {
    position: [0, 1.15, 0],
    rotation: [0, 0, 0],
    scale: 0.75
  }
}
```

模型文件放置位置：

- `public/models/`
- 建议使用 `.glb`

> 注意：如果你替换成很大的模型，优先把 `scale` 调小，并确保模型原点/轴向合理。

---

## 5) 给 AI agent 的“超详细执行流程”

> 你只要对 AI 说：`<id> 的 a,b 参数改成 ...` 或 `把 <id> 的 audioClips 换成 ...`，AI 就应当严格按下面步骤执行。

### 5.1 输入解析（AI 必做）

1. 从用户句子中提取：
   - 目标展品 `id`（必须精确匹配本文件第 3 节表格）
   - 修改类型：位置 / 旋转 / 文字 / 音频 / 模型
   - 具体数值：
     - 若提到 **a,b**：映射到 `position[0]` 与 `position[2]`
     - 若提到角度：必须转换为弧度

2. 如果用户提供的是“编号 #”，先用第 3 节表格把 `# -> id` 解析出来。

### 5.2 文件定位（AI 必做）

- 展品参数：`data/museumExhibits.ts`
- 展台显示逻辑（一般不改）：`components/museum/ExhibitStand.tsx`
- 画质预设（一般不改）：`components/museum/MuseumScene.tsx`
- 资源目录：
  - 音频：`public/audio/`
  - 模型：`public/models/`

### 5.3 修改实施（AI 必做）

#### A) 修改位置

1. 找到 `museumExhibits` 数组里 `id === <目标id>` 的对象。
2. 只改 `position`：
   - a -> `position[0]`
   - b -> `position[2]`
   - 保持 `position[1]` 不动（除非用户明确要改 y）
3. 保存文件。

#### B) 修改旋转

1. 找到目标展品对象。
2. 只改 `rotation` 对应轴。
3. 若用户给角度（°），必须转弧度（rad）。

#### C) 替换音频

1. 把用户给的新音频列表写入 `assets.audioClips`。
2. 检查所有 url 是否以 `/audio/` 开头。
3. 若用户同时提供了音频文件：
   - 将文件放入 `public/audio/`
   - 确保文件名与 url 匹配

#### D) 替换模型

1. 写入 `assets.modelUrl` 指向 `/models/<file>.glb`。
2. 如需要微调展示位置/大小，写 `assets.modelTransform`。
3. 若用户提供模型文件：放入 `public/models/`。

### 5.4 必须同步更新本文件（AI 必做）

修改完成后，AI 必须：

1. 更新第 3 节表格中该展品的：
   - a,b（或 rotation）
   - 主要内容摘要（如果内容发生变化）
2. 若新增/删除展品：
   - 在表格增删对应行
   - 确保编号 # 连续

### 5.5 最小影响原则（AI 必做）

- 只改用户指明的展品与字段。
- 不重排 `museumExhibits` 的数组顺序（除非用户明确要排序）。
- 不改变其他模式（lattice 等）任何行为。
- 不改动无关组件。

---

## 6) 快速指令模板（你可以直接复制给 AI）

### 改位置（a,b）

- `microtonal-piano 的 a,b 改成 -6, -1（y 不变）`

### 改旋转（用度数更直观）

- `ratio-wall 的 rotY 改成 90°`

### 换音频

- `microtonal-piano 的 audioClips 改成：A=/audio/a.mp3, B=/audio/b.mp3，并更新 label/description`

### 换模型

- `harry-partch-corner 加一个模型 /models/partch.glb，scale 0.5，position [0,1.2,0]`

