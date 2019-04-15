import { ButtonsView } from "./buttons-view";
import { Animateable } from "./animateable";
import { Themes, Theme } from "./themes";
import { PercentageChartView } from "./percentage-chart-view";
import { SegmentTree } from "./segment-tree";
import { IView, IViewportAware } from "./view";
import { MinimapView } from "./minimap-view";
import { BarChartView } from "./bar-chart-view";
import { LineChartView } from "./line-chart-view";
import { Overlay } from "./overlay";
import { ScalesView } from "./scales-view";
import { formatDate, DateFormat } from "./utils";

export type LineType = "line" | "area" | "bar" | "x";

export interface IChartLine {
  color: string;
  dayColorRGB: number[];
  nightColorRGB: number[];
  name: string;
  type: LineType;
  y: number[];
  maxY: number;
  visibility: Animateable;
  minSt: SegmentTree;
  maxSt: SegmentTree;
  scale: number;
}

export interface IChartData {
  x: number[];
  leftX: Animateable;
  rightX: Animateable;
  minX: number;
  maxX: number;
  range: number;
  maxY: number;
  lines: IChartLine[];
  percentage: boolean;
  stacked: boolean;
  y_scaled: boolean;
  min: (from: number, to: number) => number;
  max: (from: number, to: number) => number;
  getViewportYRange(): { min: number, max: number };
  getWholeYRange(): { min: number, max: number };
  animate(t: number): boolean;
}

export interface IDataProvider {
  getOverview(): Promise<IChartData>;
}

export class TgChart {
  theme = Themes.day;
  data!: IChartData;
  views: IView[] = [];
  isActive = false;
  canvas: HTMLCanvasElement;
  titleDiv: HTMLDivElement;
  chartTitleHeader: HTMLDivElement;
  chartTitleDates: HTMLDivElement;
  overlay: Overlay;

  constructor(private title: string, private container: HTMLElement, private dataProvider: IDataProvider) {
    this.titleDiv = document.createElement('div');
    this.titleDiv.classList.add('chart-title-view');
    this.titleDiv.innerHTML = '<div class="chart-title-header"></div><div class="chart-title-dates"></div>';
    container.appendChild(this.titleDiv);
    this.chartTitleHeader = this.titleDiv.querySelector('.chart-title-header') as HTMLDivElement;
    this.chartTitleDates = this.titleDiv.querySelector('.chart-title-dates') as HTMLDivElement;
    this.canvas = document.createElement('canvas');
    this.canvas.classList.add('chart-view');
    this.canvas.style.height = "400px";
    container.appendChild(this.canvas);
    const overlayDiv = document.createElement('div');
    this.overlay = new Overlay(overlayDiv, this.canvas);
    container.appendChild(overlayDiv);
  }

  refresh(refreshPreview = false) {
    const rX = Math.min(this.data.x[this.data.x.length - 1], this.data.rightX.value);
    this.chartTitleDates.innerText = 
    formatDate(new Date(this.data.leftX.value), DateFormat.Full) + ' - '
     + formatDate(new Date(rX), DateFormat.Full);
    this.views.forEach(v => v.refresh(refreshPreview));
  }

  setTheme(theme: Theme) {
    this.views.forEach(v => v.setTheme(theme));
  }

  init(): Promise<void> {
    return this.dataProvider.getOverview()
      .then(data => {
        this.data = data;
        const dpr = window.devicePixelRatio;
        const padding = [0, 0, dpr * 60, 0];
        let mainChart: IView;
        if (data.percentage) {
          mainChart = new PercentageChartView(this.canvas, [dpr*17, 0, dpr * 60, 0], Themes.day, data, true, this.overlay);
        }
        else if (data.lines[0].type === 'bar') {
          mainChart = new BarChartView(this.canvas, padding, Themes.day, data, true, this.overlay);
        }
        else {
          mainChart = new LineChartView(this.canvas, padding, Themes.day, data, true, this.overlay);
        }
        this.views.push(mainChart);
        this.views.push(new ScalesView(Themes.day, this, 'scales-view', data, <IViewportAware>(mainChart as unknown)));
        const minimapView = new MinimapView(this.canvas, Themes.day, this, data, this.dataProvider);
        this.views.push(minimapView);
        this.views.push(new ButtonsView('buttons-view', this.dataProvider, (line, enable) => {
          return minimapView.switchLine(line, enable);
        },
        (line: string) => {
          minimapView.activateSingleLine(line);
        }
        ));
        this.views.forEach(v => this.container.appendChild(v.getContainer()));
        window.addEventListener('resize', this.onresize);
      })
      .then(() => Promise.all(this.views.filter(v => v.init())))
      .then(() => {
        this.chartTitleHeader.innerText = this.title;
      });
  }

  private onresize = () => {
    this.refresh(true);
  }
}
