import { Animateable } from "./animateable";
import { easeInOutQuint } from "./easing-functions";

export interface Theme {
  fgColor: string;
  bgColor: string;
  overlayBgColor: string;
  tooltipArrow: string;
  gridLines: string;
  zoomOutText: string;
  scrollBackground: string;
  scrollSelector: string;
  xyAxisText: string;
  blendMask: number[];
}

export const themeTransition = new Animateable(0, easeInOutQuint);

export const Themes = {
  day: <Theme>{
    fgColor: 'black',
    bgColor: 'white',
    overlayBgColor: 'white',
    tooltipArrow: '#D2D5D7',
    gridLines: 'rgba(24,45,56,0.1)',
    zoomOutText: '#108BE3',
    scrollBackground: 'rgba(226,238,249,0.6)',
    scrollSelector: '#C0D1E1',
    xyAxisText: 'rgba(64,69,76,0.6)',
    blendMask: [0.5, 0.5, 0.5, 0.5]
  },
  night: <Theme>{
    fgColor: 'white',
    bgColor: 'rgb(36,47,62)',
    overlayBgColor: 'rgb(29, 37, 51)',
    tooltipArrow: '#D2D5D7',
    gridLines: 'rgba(255,255,255,0.1)',
    zoomOutText: '#48AAF0',
    scrollBackground: 'rgba(48,66,89,0.6)',
    scrollSelector: '#56626D',
    xyAxisText: 'rgb(236,242,248,0.5)',
    blendMask: [0.08, 0.08, 0.08, 0.5]
  }
}