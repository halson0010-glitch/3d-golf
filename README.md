# 3D Golf China Map

中国高尔夫球场 3D / 2D 交互静态网页。项目保持原生 HTML、CSS、ES Module 和 Three.js，不依赖 React、Vue 或 Next.js。

## 本地运行

```bash
npm run dev
```

默认会启动本地静态服务：

```text
http://localhost:5173/
```

如果端口被占用，可以设置 `PORT` 后再启动：

```powershell
$env:PORT="5174"
npm run dev
```

## GitHub Pages 部署

仓库发布地址：

```text
https://halson0010-glitch.github.io/3d-golf/
```

GitHub Pages 使用仓库子路径 `/3d-golf/` 部署，因此项目内资源必须使用相对路径，例如：

```text
./main.js
./style.css
./locations.js
./assets/golf_scene.glb
./assets/caddy_photo.png
```

不要写成 `/assets/...`，否则在 GitHub Pages 子路径下会 404。

## 必须上传的文件

发布时至少需要上传：

```text
index.html
main.js
locations.js
style.css
local-server.mjs
package.json
package-lock.json
assets/
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

## 外部依赖说明

Three.js 当前通过 importmap 使用 CDN：

```text
https://unpkg.com/three@0.160.0/
```

如果 CDN、Three.js、模型、贴图或视频加载失败，页面会显示中文错误提示，不会只留下黑屏。后续如果希望进一步提高国内访问速度，可以把 Three.js 文件下载到本项目中并改为本地相对路径。

## 数字球童模式

数字球童现在分为三层运行模式，配置位于 `config.js`：

```js
export const appConfig = {
  caddyMode: "local", // local | cloud | basic
  localBaseUrl: "http://localhost:11434/v1",
  cloudEndpoint: "/api/caddy",
};
```

`basic`：纯前端基础规则模式，GitHub Pages 可直接使用，不需要任何 API Key。

`local`：本地 Ollama 模式，只在开发电脑上有效，默认地址：

```text
http://localhost:11434/v1
```

这个能力只在访问者自己的电脑本地可用，不属于 GitHub Pages 公网功能。别人打开线上页面时，不能直接调用你电脑上的 Ollama 服务。线上页面会自动回退到基础模式，不会因为 `localhost` 请求失败影响页面使用。

`cloud`：云端球童模式，前端只请求：

```text
/api/caddy
```

不要把任何真实 API Key 写进前端代码。正式上线时需要额外部署后端接口 `/api/caddy`，由后端安全地调用大模型服务。GitHub Pages 是静态站点，如果没有单独部署后端接口，只能使用基础模式，或把 `cloudEndpoint` 配置为你自己已经部署好的 HTTPS 后端地址。

## Ollama 本地大模型

本地开发时可以继续使用 Ollama：

```text
http://localhost:11434/v1
```

推荐先在本机确认 Ollama 已启动，并安装兼容 OpenAI `/v1/chat/completions` 的模型。没有 Ollama 或模型不可用时，数字球童会自动切换到基础规则建议。

## 大文件建议

`assets/golf_scene.glb` 文件较大，当前已经改为进入球场 3D 模型时按需加载，不再阻塞首页。后续如果继续增大模型或视频资源，建议放到稳定 CDN 或对象存储中，再通过 HTTPS 地址加载。
