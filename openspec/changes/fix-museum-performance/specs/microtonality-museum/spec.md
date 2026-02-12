# Microtonality Museum Requirements

### Requirement: 主展厅空间
- Scenario: 用户进入 Microtonality Museum 时，主展厅 SHALL 为长方体空间，天花板高度约 8 米；两侧 SHALL 有通往次级展厅的拱形门洞，门洞边缘无装饰线条且切割面平滑；墙面 SHALL 为哑光纯白、无颗粒感并呈漫反射。

### Requirement: 地面材质与反射
- Scenario: 主展厅地面 SHALL 铺设 1200mm x 1200mm 抛光深灰色石材地砖，砖缝 2mm 黑色填缝；地面 SHALL 具高光泽度并可模糊反射灯光轨迹与展柜倒影；视角向下时，地砖 SHALL 可见极细微不规则天然石纹。

### Requirement: 天花板与灯具布置
- Scenario: 天花板 SHALL 为深黑色并暴露内部结构；距地面 6 米处 SHALL 悬挂黑色金属网格框架；框架上每隔 1.5 米 SHALL 固定黑色圆柱形射灯筒。

### Requirement: 基础照明
- Scenario: 所有射灯 SHALL 开启并输出约 4000K 中性白光，光线 SHALL 以圆锥状向下投射。

### Requirement: 聚光与阴影
- Scenario: 每个空置展柜或展板中心 SHALL 有强光聚焦且亮度显著高于环境；展柜底部地面 SHALL 形成边缘锐利的黑色矩形阴影；墙角 SHALL 呈自然暗角并随距离逐渐衰减。

### Requirement: 空气与景深
- Scenario: 场景空气 SHALL 完全透明，无灰尘粒子；画面 SHALL 无景深模糊效果，近远景清晰度一致，物体边缘保持锐利。

### Requirement: 中央独立玻璃展柜
- Scenario: 大厅中央 SHALL 有 60cm x 60cm x 100cm 哑光白立方体木质基座；其上 SHALL 覆盖 60cm x 60cm x 60cm 五面透明玻璃罩，玻璃厚度约 8mm，边缘 45 度倒角抛光并呈淡青绿色；展柜内部底面 SHALL 铺设平整无褶皱的深灰绒布且无物品。

### Requirement: 墙面展板
- Scenario: 四周墙面 SHALL 悬挂黑色铝合金细边框，边框宽度 1.5cm；内部背板 SHALL 为纯白硬质板，尺寸包含 A1 (594mm x 841mm) 与横向 1500mm x 400mm；背板表面 SHALL 无文字、图片或纹理，仅为纯白平面并表现为中心亮、四周略暗。

### Requirement: 次级展厅悬浮展台
- Scenario: 次级展厅部分区域 SHALL 存在无支撑腿的白色平台，平台悬浮高度约 1.1 米，表面空无一物。

### Requirement: 鼠标视角旋转
- Scenario: 用户向右水平移动鼠标 1 厘米时，视野 SHALL 围绕垂直轴向右旋转约 15 度，原在右侧的空展柜 SHALL 平滑移动到屏幕中央。

### Requirement: 鼠标俯仰与停止
- Scenario: 用户向前推动鼠标时，视角 SHALL 向上抬起并可见黑色天花板与射灯光源；向后拉动时视角 SHALL 向下倾斜并可见地面倒影；鼠标停止时画面 SHALL 立即静止且无惯性滑行。

### Requirement: 键盘移动速度与方向
- Scenario: 按下 W 键时视点 SHALL 以约 1.4 米/秒向前平移；S 键 SHALL 后退，A 键向左平移，D 键向右平移；同时按下 W+A 时视点 SHALL 以 45 度向左前方移动。

### Requirement: 碰撞与滑动
- Scenario: 视点接近墙面约 20cm 时 SHALL 停止前进且无法穿透；试图穿过中央展柜时 SHALL 被基座阻挡，并在持续移动且略微偏转时沿展柜边缘产生滑动直到绕过障碍。

### Requirement: 光标与交互提示
- Scenario: 屏幕中心 SHALL 固定直径约 4 像素的白色半透明圆点；当对准空展柜或空展板时 SHALL 不改变形状、无高亮轮廓、无文字提示且无点击交互。
