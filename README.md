# 3D Golf China Map

3D 中国高尔夫球场地图，使用原生 HTML / CSS / ES Module / Three.js 构建。项目包含 3D 地球、中国球场点位、局部二维地图、球场 3D 模型、实景素材入口和数字球童建议功能。

## 本地运行

首次运行先安装依赖：

```bash
npm install
```

启动本地静态服务：

```bash
npm run dev
```

打开：

```text
http://localhost:5173/
```

如果 `5173` 端口被占用，当前本地服务会自动尝试下一个端口。也可以手动指定端口：

```powershell
$env:PORT="5174"
npm run dev
```

## 发布前检查

提交或部署前运行：

```bash
npm run check
```

检查脚本会输出中文报告，包含文件存在性、球场数据、经纬度、GitHub Pages 子路径资源路径、`assets/golf_scene.glb` 大小和不应被 Git 跟踪的本地目录。关键错误会返回非 0 exit code，警告不阻塞发布。

## GitHub Pages 部署

推荐设置：

```text
Branch: main
Folder: / (root)
```

Pages 链接格式：

```text
https://<github-username>.github.io/<repo-name>/
```

当前仓库示例：

```text
https://halson0010-glitch.github.io/3d-golf/
```

GitHub Pages 使用仓库子路径部署，因此资源必须使用相对路径，例如：

```text
./main.js
./style.css
./locations.js
./assets/golf_scene.glb
./assets/caddy_photo.png
```

不要写成 `/assets/...`，否则在 GitHub Pages 子路径下会 404。

## 必须上传的文件

发布时至少需要保留并上传：

```text
index.html
main.js
locations.js
style.css
assets/
package.json
```

建议一并保留：

```text
package-lock.json
local-server.mjs
scripts/check.mjs
config.js
src/
```

`assets/` 目录中当前关键资源包括：

```text
assets/golf_scene.glb
assets/caddy_photo.png
assets/course_realview_1.mp4
assets/course_realview_2.mp4
assets/fallback/terrain.svg
assets/fallback/satellite.svg
assets/fallback/environment.svg
```

## 大文件与资源加载

`assets/golf_scene.glb` 较大，当前已经做了懒加载：首屏不会请求高清 3D 球场模型，进入球场 3D 模型时才加载。后续如果模型或视频继续增大，建议放到 CDN 或对象存储，再通过 HTTPS 地址加载。

页面内置轻量中文错误提示层：

- Three.js CDN 加载失败：提示 `3D 引擎加载失败，请检查网络或稍后重试`
- `golf_scene.glb` 加载失败：提示 `高清 3D 球场模型加载失败，已切换为基础地形模式`
- 实景视频加载失败：提示 `实景素材加载失败，可使用外部地图查看`

错误提示不会遮挡整个页面，也不会导致黑屏。

## 数字球童与大模型

数字球童支持本地 Ollama、云端 API 和基础规则三层模式，配置位于 `config.js`：

```js
export const APP_CONFIG = {
  caddyMode: "auto", // "auto" | "local" | "cloud" | "basic"
  localBaseUrl: "http://localhost:11434/v1",
  localModel: "qwen3:8b",
  cloudEndpoint: "",
  requestTimeoutMs: 12000,
  weatherMode: "mock",
  amapWeatherKey: ""
};
```

`auto`：本地开发环境优先尝试 Ollama；GitHub Pages 环境不会主动请求 `localhost`，没有云端地址时显示“云端未配置”并回退基础建议。

`local`：只尝试本地 Ollama，适合开发电脑。失败后自动回退基础建议，不显示技术错误堆栈。

`cloud`：请求 `cloudEndpoint`。前端不要写任何真实 API Key；正式上线需要部署 `/api/caddy` 或外部后端，由后端安全调用大模型。

`basic`：只使用前端基础规则建议，不请求任何模型，GitHub Pages 可直接使用。

GitHub Pages 不能调用开发者电脑里的 Ollama。公网用户访问 `https://halson0010-glitch.github.io/3d-golf/` 时，浏览器不会去请求你的 `http://localhost:11434/v1`。

本地 Ollama 示例：

```bash
ollama pull qwen3:8b
ollama serve
```

如果 `ollama list` 为空，页面会提示本地未安装模型，并继续使用基础模式。云端模式请把大模型 Key 放在后端接口里，不要写进 `config.js`、`main.js` 或任何前端文件。

## 天气与打球风险

天气模块支持三种模式：

- `mock`：默认模式，根据球场省市和坐标生成稳定的模拟天气，用于展示温度、风力、湿度、降雨和打球风险。
- `amap`：高德天气占位模式。前端不要写真实 Key，正式接入建议通过后端代理调用高德天气接口。
- `disabled`：关闭天气模块，页面和数字球童继续正常运行。

`amapWeatherKey` 目前保留为空。不要把真实天气 API Key 写进前端仓库或 GitHub Pages。
