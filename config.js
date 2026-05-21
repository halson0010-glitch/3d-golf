// 前端公开配置：不要在这里写入真实 API Key，部署时可按需改为后端代理或环境注入。
export const appConfig = {
  caddyMode: "local",
  localBaseUrl: "http://localhost:11434/v1",
  cloudEndpoint: "/api/caddy",
  weatherMode: "mock",
  amapWeatherKey: "",
};
