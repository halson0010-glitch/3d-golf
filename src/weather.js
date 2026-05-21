// 天气风险模块：提供本地模拟、高德天气占位和关闭三种模式。
import { appConfig } from "../config.js";

const WEATHER_MODE_MAP = {
  mock: "mockWeather",
  amap: "amapWeather",
  disabled: "disabled",
};

function hashText(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pickRainLabel(hasRain, seed) {
  if (!hasRain) return "无明显降雨";
  return seed % 3 === 0 ? "阵雨" : seed % 3 === 1 ? "小雨" : "雷阵雨风险";
}

function getRegionalBaseline(course) {
  const text = `${course.province || ""} ${course.city || ""} ${course.name || ""}`;
  if (/海南|广东|广西|福建|三亚|海口|深圳|广州|厦门/.test(text)) {
    return { temp: 32, humidity: 78, wind: 3, rainChance: 0.45 };
  }
  if (/重庆|武汉|长沙|南京|杭州|上海|苏州|无锡/.test(text)) {
    return { temp: 31, humidity: 74, wind: 2, rainChance: 0.34 };
  }
  if (/新疆|内蒙古|宁夏|甘肃|沙|荒漠|戈壁/.test(text)) {
    return { temp: 28, humidity: 34, wind: 5, rainChance: 0.12 };
  }
  if (/云南|昆明|丽江|大理|贵阳|贵州/.test(text)) {
    return { temp: 24, humidity: 58, wind: 3, rainChance: 0.28 };
  }
  if (/北京|天津|河北|山东|青岛|大连|辽宁/.test(text)) {
    return { temp: 27, humidity: 52, wind: 4, rainChance: 0.22 };
  }
  return { temp: 29, humidity: 62, wind: 3, rainChance: 0.25 };
}

function buildRiskRules(weather) {
  const risks = [];
  if (weather.temperature >= 35) {
    risks.push("高温风险：注意补水、防晒，并降低前九洞体能消耗。");
  }
  if (weather.windLevel >= 5) {
    risks.push("风力偏强：建议压低弹道，开球和攻果岭都选择更保守落点。");
  }
  if (weather.hasRain) {
    risks.push("降雨影响：果岭速度可能变慢，注意鞋钉抓地和下坡推杆力度。");
  }
  if (weather.humidity >= 75) {
    risks.push("湿度偏高：挥杆节奏容易变慢，建议分段补水并缩短热身强度。");
  }
  if (!risks.length) {
    risks.push("天气风险较低：可按正常节奏热身，但仍需确认临场风向和果岭速度。");
  }
  return risks;
}

function getRiskLevel(weather, risks) {
  if (weather.temperature >= 35 || weather.windLevel >= 6 || (weather.hasRain && weather.windLevel >= 5)) return "高";
  if (risks.length >= 2 || weather.windLevel >= 5 || weather.humidity >= 75 || weather.hasRain) return "中";
  return "低";
}

export function createMockWeather(course) {
  const seed = hashText(`${course.province || ""}-${course.city || ""}-${course.name || ""}`);
  const base = getRegionalBaseline(course);
  const temperature = clamp(Math.round(base.temp + (seed % 9) - 4), 16, 38);
  const windLevel = clamp(Math.round(base.wind + ((seed >> 3) % 5) - 2), 1, 7);
  const humidity = clamp(Math.round(base.humidity + ((seed >> 6) % 21) - 10), 28, 92);
  const hasRain = ((seed % 100) / 100) < base.rainChance || humidity >= 86;
  const rainfall = pickRainLabel(hasRain, seed);
  const weather = {
    mode: "mockWeather",
    source: "本地模拟天气",
    available: true,
    city: course.city || course.province || "球场所在地",
    temperature,
    windLevel,
    humidity,
    hasRain,
    rainfall,
    updatedAt: "模拟数据",
  };
  const risks = buildRiskRules(weather);
  const riskLevel = getRiskLevel(weather, risks);
  return {
    ...weather,
    riskLevel,
    risks,
    summary: `${temperature}°C · ${windLevel}级风 · 湿度${humidity}% · ${rainfall}`,
    caddyBrief: `天气：${temperature}°C，${windLevel}级风，湿度${humidity}%，${rainfall}。风险等级${riskLevel}。${risks.join("")}`,
  };
}

export async function getAmapWeather(course, config = appConfig) {
  if (!config.amapWeatherKey) {
    return {
      mode: "amapWeather",
      source: "高德天气占位",
      available: false,
      city: course.city || course.province || "",
      summary: "未配置高德天气 Key，天气模块暂不请求外部接口。",
      risks: [],
      caddyBrief: "天气模块未配置实时 API Key，本次不使用实时天气。",
    };
  }

  // 占位实现：真实项目建议通过后端代理调用，避免在前端暴露 Key。
  return {
    mode: "amapWeather",
    source: "高德天气占位",
    available: false,
    city: course.city || course.province || "",
    summary: "已检测到 Key 配置，但前端不会直接暴露调用；请接入后端代理后启用实时天气。",
    risks: [],
    caddyBrief: "天气实时接口等待后端代理接入。",
  };
}

export async function getCourseWeather(course, config = appConfig) {
  const mode = config.weatherMode || "mock";
  if (mode === "disabled") return null;
  if (mode === "amap") return getAmapWeather(course, config);
  return createMockWeather(course);
}

export function getWeatherModeLabel(config = appConfig) {
  return WEATHER_MODE_MAP[config.weatherMode] || "mockWeather";
}
