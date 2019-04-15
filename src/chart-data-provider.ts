import { IDataProvider, IChartData, IChartLine, LineType } from "./tg-chart/tg-chart";
import { IRawChartData } from "./app";
import { Animateable } from "./tg-chart/animateable";
import { easeInOutQuint, linear } from "./tg-chart/easing-functions";
import { SegmentTree } from "./tg-chart/segment-tree";
import { changeSaturation, binarySearch, oneDay } from "./tg-chart/utils";

export class ChartDataProvider implements IDataProvider {
  data?: IChartData;

  constructor(private chartId: string) {
  }

  public getOverview(): Promise<IChartData> {
    if (this.data) {
      return new Promise(r => r(this.data));
    }
    return fetch(`./data/${this.chartId}/overview.json`)
      .then(response => response.json())
      .then(this.createChartData)
      .then(data => this.data = data);
  }

  private findColumn(overviewJson: IRawChartData, id: string) {
    for (let index = 0; index < overviewJson.columns.length; index++) {
      const c = overviewJson.columns[index];
      if (c[0] === id) {
        return c;
      }

    }
    return null;
  }

  private createChartData = (overviewJson: IRawChartData): IChartData => {
    let xAxisId = '';
    for (var property in overviewJson.types) {
      if (overviewJson.types.hasOwnProperty(property) && overviewJson.types[property] === 'x') {
        xAxisId = property;
        break;
      }
    }
    const [, ...x] = this.findColumn(overviewJson, xAxisId)!;
    const yScaled = overviewJson.y_scaled || false;
    const result = new ChartData(
      x,
      this.createLines(overviewJson, yScaled),
      overviewJson.percentage || false,
      overviewJson.stacked || false,
      yScaled
    );
    return result;
  };

  private createLines(overviewJson: IRawChartData, yScaled: boolean): IChartLine[] {
    const result: IChartLine[] = [];
    for (const key in overviewJson.names) {
      if (overviewJson.names.hasOwnProperty(key)) {
        const [, ...y] = this.findColumn(overviewJson, key)!;
        const line = new ChartLine(
          key,
          overviewJson.names[key],
          overviewJson.types[key],
          overviewJson.colors[key],
          y);
        result.push(line);
      }
    }
    const maxY = result.reduce((m, l) => Math.max(l.maxY, m), 0);
    if (yScaled) {
      result.forEach(l => l.scale = maxY / l.maxY);
    }
    return result;
  }
}

class ChartData implements IChartData {
  private stackedMax?: SegmentTree;
  public readonly leftX: Animateable;
  public readonly rightX: Animateable;
  public readonly minX: number;
  public readonly maxX: number;
  public readonly range: number;
  public readonly maxY: number;
  private prevLeftX = 0;
  private prevRightX = 0;
  private viewportY?: { min: number, max: number };

  constructor(
    public readonly x: number[],
    public readonly lines: IChartLine[],
    public readonly percentage: boolean,
    public readonly stacked: boolean,
    public readonly y_scaled: boolean) {
    this.minX = x[0];
    this.maxX = x[x.length - 1];
    if (lines[0].type === 'bar') this.maxX += oneDay - 1;
    this.leftX = new Animateable(this.minX, easeInOutQuint);
    this.rightX = new Animateable(this.maxX, easeInOutQuint);
    this.maxY = this.max(0, x.length - 1);
    this.range = this.maxX - this.minX;
  }

  min(from: number, to: number) {
    from = Math.max(0, from);
    to = Math.min(this.x.length - 1, to);
    return this.lines.reduce((m, l) => Math.min(m, l.visibility.endValue * l.minSt.rangeQuery(from, to)), Number.MAX_VALUE);
  }

  max(from: number, to: number) {
    from = Math.max(0, from);
    to = Math.min(this.x.length - 1, to);
    return this.lines.reduce((m, l) => Math.max(m, l.visibility.endValue * l.maxSt.rangeQuery(from, to)), Number.MIN_VALUE);
  }

  animate(t: number): boolean {
    const visibilityChanged = this.lines.reduce((r, l) => l.visibility.animate(t) || r, false);
    if (visibilityChanged) {
      this.stackedMax = undefined;
      this.viewportY = undefined;
    }
    let raf = visibilityChanged;
    raf = this.leftX.animate(t) || raf;
    raf = this.rightX.animate(t) || raf;
    const xScaleChanged = this.prevLeftX !== this.leftX.value || this.prevRightX !== this.rightX.value;
    if (xScaleChanged) {
      this.prevLeftX = this.leftX.value;
      this.prevRightX = this.rightX.value;
      this.viewportY = undefined;
    }
    raf = xScaleChanged || raf;
    return raf;
  }

  public getViewportYRange() {
    if (this.viewportY) {
      return this.viewportY;
    }
    this.viewportY = this.getYRange(this.leftX.value, this.rightX.value);
    return this.viewportY;
  }

  public getWholeYRange() {
    return this.getYRange(this.minX, this.maxX);
  }

  private getYRange(leftX: number, rightX: number) {
    let from = binarySearch(this.x, leftX);
    let to = binarySearch(this.x, rightX);
    if (from < 0)
      from = ~from;
    if (to < 0)
      to = ~to;

    let min = this.getMinVisibleY(from, to);
    let max = this.getMaxVisibleY(from, to);
    const error = Math.pow(10, Math.floor(Math.log10(max)) - 1);
    min = Math.floor(min / error) * error;
    max = Math.ceil(max / error) * error;
    return { min, max };
  }

  getMaxVisibleY(from: number, to: number): number {
    if (!this.stacked) {
      return this.lines.reduce((m, l) => Math.max(l.maxSt.rangeQuery(from, to) * l.scale * l.visibility.endValue, m), 0);
    }

    if (!this.stackedMax) {
      const sum = new Array(this.x.length).fill(0);
      for (let i = 0; i < this.lines.length; i++) {
        const l = this.lines[i];
        for (let j = 0; j < l.y.length; j++)
          sum[j] += l.y[j] * l.visibility.value;
      }
      this.stackedMax = new SegmentTree(sum, Math.max, Number.MIN_VALUE);
    }

    return this.stackedMax.rangeQuery(from, to);
  }

  getMinVisibleY(from: number, to: number): number {
    return this.lines.reduce((m, l) => {
      if (l.visibility.endValue > 0) {
        return Math.min(l.minSt.rangeQuery(from, to) * l.scale, m)
      }
      else { return m; }
    }, Number.MAX_VALUE);
  }
}

class ChartLine implements IChartLine {
  public readonly maxY: number;
  public readonly visibility: Animateable;
  public readonly minSt: SegmentTree;
  public readonly maxSt: SegmentTree;
  public readonly dayColorRGB: number[];
  public readonly nightColorRGB: number[];
  public scale: number = 1;

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly type: LineType,
    public readonly color: string,
    public readonly y: number[]) {
    this.minSt = new SegmentTree(y, Math.min, Number.MAX_VALUE);
    this.maxSt = new SegmentTree(y, Math.max, Number.MIN_VALUE);
    this.maxY = this.maxSt.rangeQuery(0, y.length - 1);
    this.visibility = new Animateable(1, linear);
    this.dayColorRGB = this.parseColor(color);
    this.nightColorRGB = changeSaturation(this.dayColorRGB[0], this.dayColorRGB[1], this.dayColorRGB[2], 0.66);
  }

  parseColor(color: string): number[] {
    const m = color.match(/^#([0-9a-f]{6})$/i)![1];
    if (m) {
      return [
        parseInt(m.substr(0, 2), 16) / 256,
        parseInt(m.substr(2, 2), 16) / 256,
        parseInt(m.substr(4, 2), 16) / 256
      ];
    }
    return [0, 0, 0];
  }
}