// 应用入口：只负责装配 src 下的 ES Module 并启动 3D 高尔夫地图。
import { initProfileModule } from "./src/profile.js?v=modular-main-20260521";
import { initCaddyModule } from "./src/caddy.js?v=modular-main-20260521";
import { initCourseListModule } from "./src/course-list.js?v=modular-main-20260521";
import { initGlobeModule } from "./src/globe.js?v=modular-main-20260521";
import { initDetailMapModule } from "./src/detail-map.js?v=modular-main-20260521";
import { initModelViewerModule } from "./src/model-viewer.js?v=modular-main-20260521";
import { initUtilsModule } from "./src/utils.js?v=modular-main-20260521";
import { initGolfApp } from "./src/app.js?v=modular-main-20260521";

const moduleRegistry = {
  profile: initProfileModule(),
  caddy: initCaddyModule(),
  courseList: initCourseListModule(),
  globe: initGlobeModule(),
  detailMap: initDetailMapModule(),
  modelViewer: initModelViewerModule(),
  utils: initUtilsModule(),
};

initGolfApp(moduleRegistry);
