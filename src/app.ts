import "./index.css";
import "./slider.css";
import { TgChart } from "./tg-chart/tg-chart";
import { ChartDataProvider } from "./chart-data-provider";
import { Themes, Theme, themeTransition } from "./tg-chart/themes";


export interface IRawChartData {
  columns: [string, ...number[]][];
  types: { [name: string]: 'line' | 'area' | 'bar' | 'x' };
  names: { [name: string]: string };
  colors: { [name: string]: string };
  y_scaled?: boolean;
  stacked?: boolean;
  percentage?: boolean;
}

let theme: Theme = Themes.day;

const tgCharts: TgChart[] = [];
tgCharts.push(new TgChart("Followers", document.getElementById("chart1")!, new ChartDataProvider("1")));
tgCharts.push(new TgChart("Interactions", document.getElementById("chart2")!, new ChartDataProvider("2")));
tgCharts.push(new TgChart("Fruits", document.getElementById("chart3")!, new ChartDataProvider("3")));
tgCharts.push(new TgChart("Views", document.getElementById("chart4")!, new ChartDataProvider("4")));
tgCharts.push(new TgChart("Apps", document.getElementById("chart5")!, new ChartDataProvider("5")));
const themeSwitch = <HTMLElement>document.getElementById("switch");
themeSwitch.addEventListener('click', () => {
  setTheme(theme === Themes.day ? Themes.night : Themes.day);
});

Promise
  .all(tgCharts.map(c => c.init()))
  .then(() => {
    setTheme(Themes.day);
  });

function setTheme(t: Theme) {
  theme = t;
  if (t === Themes.day) {
    themeSwitch.innerText = "Switch to Night Mode";
    themeTransition.animateTo(0, 1000);
  } else {
    themeSwitch.innerText = "Switch to Day Mode";
    themeTransition.animateTo(1, 1000);
  }
  tgCharts.forEach(c => c.setTheme(t));
  document.body.style.setProperty('--bgColor', t.bgColor);
  document.body.style.setProperty('--fgColor', t.fgColor);
  document.body.style.setProperty('--overlay-bg-color', t.overlayBgColor);
  document.body.style.setProperty('--scroll-selector', t.scrollSelector);
  document.body.style.setProperty('--scroll-background', t.scrollBackground);
}
