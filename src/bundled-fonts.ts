import xiaolaiFontUrl from "../assets/fonts/Xiaolai-Regular.woff2";
import naikaiFontUrl from "../assets/fonts/NaikaiFont-Light.woff2";
import cefFontUrl from "../assets/fonts/CEFFontsCJK-Regular.woff2";
import type { LoadedFont } from "./fonts";

export const BUNDLED_HANDWRITING_FONTS: LoadedFont[] = [
  {
    id: "xiaolai-regular",
    name: "小赖字体 Regular",
    family: "XhsXiaolaiRegular",
    source: "bundled",
    format: "woff2",
    available: true,
    faceCss: `@font-face{font-family:"XhsXiaolaiRegular";src:url("${xiaolaiFontUrl}") format("woff2");font-style:normal;font-display:block;}`
  },
  {
    id: "naikai-light",
    name: "内海字体 Light",
    family: "XhsNaikaiLight",
    source: "bundled",
    format: "woff2",
    available: true,
    faceCss: `@font-face{font-family:"XhsNaikaiLight";src:url("${naikaiFontUrl}") format("woff2");font-style:normal;font-display:block;}`
  },
  {
    id: "cef-cjk-regular",
    name: "快去写作业 CJK Regular",
    family: "XhsCefCjkRegular",
    source: "bundled",
    format: "woff2",
    available: true,
    faceCss: `@font-face{font-family:"XhsCefCjkRegular";src:url("${cefFontUrl}") format("woff2");font-style:normal;font-display:block;}`
  }
];
