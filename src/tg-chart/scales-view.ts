import { IChartData, TgChart } from "./tg-chart";
import { Theme } from "./themes";
import { View, IViewportAware } from "./view";
import { getValuesBetween, getDatesBetween, DateFormat, formatDate, binarySearch } from "./utils";

class YScale {
  v1: number = 0;
  v2: number | undefined;
  constructor(public t1: SVGTextElement, public t2: SVGTextElement, public line: SVGLineElement) {
  }

  init(value: number, value2?: number) {
    this.t1.textContent = format(value);
    if (value2) { this.t2.textContent = format(value2); } else { this.t2.style.display = 'none'; }
    this.line.setAttribute('x1', '20');
    this.line.setAttribute('y1', '0');
    this.line.setAttribute('y2', '0');
    this.t1.setAttribute('x', '20');
  }

  draw(width: number, yOffs: number, visible: boolean) {
    visible = yOffs > 12 && visible;
    this.t1.style.opacity = this.line.style.opacity = visible ? "1" : "0";
    this.line.setAttribute('x2', String(width - 20));
    this.t1.setAttribute('y', `${yOffs - 3}`);
    this.line.setAttribute('y1', `${yOffs}`);
    this.line.setAttribute('y2', `${yOffs}`);
    if (this.t2.textContent) {
      this.t2.style.opacity = visible ? "1" : "0"
      this.t2.setAttribute('x', String(width - 20));
      this.t2.setAttribute('y', `${yOffs - 3}`);
    }
  }
}

class XScale {
  constructor(public text: SVGTextElement) {
  }

  init(value: number) {
    this.text.textContent = formatDate(new Date(value), DateFormat.Short);
  }

  draw(width: number, xOffs: number, yOffs: number, visible: boolean) {
    visible = xOffs > 15 && xOffs < width + 15 && visible;
    this.text.style.opacity = visible ? "1" : "0";
    this.text.setAttribute('x', String(xOffs));
    this.text.setAttribute('y', String(yOffs));
  }
}

export class ScalesView extends View {
  private container: SVGSVGElement;
  private activeYScales = new Map<number, YScale>();
  private yScalesPool: YScale[] = [];
  private activeXScales = new Map<number, XScale>();
  private xScalesPool: XScale[] = [];
  currentYViewport: any = {};
  currentXViewport: any = {};

  constructor(
    theme: Theme,
    private chart: TgChart,
    className: string,
    private data: IChartData,
    private viewportProvider: IViewportAware) {
    super(theme);
    this.viewportProvider.viewportchanged = () => this.refresh(false);
    this.container = document.createElementNS(svgNS, 'svg');
    this.container.classList.add(className);
    this.container.setAttribute('preserveAspectRatio', 'none');
    const colors = data.y_scaled ? [data.lines[0].color, data.lines[1].color] : null;
    for (let i = 0; i < 15; i++) {
      const s = createYScale(colors);
      this.container.appendChild(s.t1);
      this.container.appendChild(s.t2);
      this.container.appendChild(s.line);
      this.yScalesPool.push(s);
    }
    for (let i = 0; i < 50; i++) {
      const s = createXScale();
      this.container.appendChild(s.text);
      this.xScalesPool.push(s);
    }
  }

  init(): Promise<void> {
    this.refresh(false);
    return Promise.resolve();
  }

  setTheme(theme: Theme) {
    this.theme = theme;
    this.container.style.setProperty('--lines', theme.gridLines);
    this.container.style.setProperty('--text', theme.xyAxisText);
    this.refresh(false);
  }

  protected onResize(): void {
    this.container.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);
  }

  getContainer(): Element {
    return this.container;
  }

  protected onRender(t: number): boolean {
    let forceRedraw = false;
    const bounds = this.container.getBoundingClientRect();
    if (bounds.width !== this.width || bounds.height !== this.height) {
      this.width = bounds.width;
      this.height = bounds.height;
      this.onResize();
      forceRedraw = true;
    }

    let raf = this.drawYScales(forceRedraw);
    raf = this.drawXScales(forceRedraw) || raf;

    return raf;
  }

  drawYScales(forceRedraw: boolean): boolean {
    const viewport = this.viewportProvider.getViewport();
    if (!forceRedraw && this.currentYViewport.min === viewport.min && this.currentYViewport.max === viewport.max) {
      return false;
    }
    this.currentYViewport = viewport;
    if (viewport.max === viewport.min) {
      return false;
    }

    if (this.data.percentage) {
      for (let i = 0; i < 5; i++) {
        let s = this.getYScale(i * 25);
        s.draw(this.width, (1 - i / 4 * 0.95) * (this.height - 20), true);
      }
      return false;
    }

    const values = getValuesBetween(viewport.targetMin, viewport.targetMax * 0.9, 6);
    const activeValues = new Set<number>(values);
    for (let i = 0; i < values.length; i++) {
      const value = values[i];

      const offset = (1 - (value - viewport.min) / (viewport.max - viewport.min)) * (this.height - 20);
      const value2 = this.data.y_scaled ? value / this.data.lines[1].scale | 0 : undefined;
      let s = this.getYScale(value, value2);
      s.draw(this.width, offset, true);
    }
    this.activeYScales.forEach((s, v) => {
      if (!activeValues.has(v)) {
        const offset = (1 - (v - viewport.min) / (viewport.max - viewport.min)) * (this.height - 20);
        s.draw(this.width, offset, false);
      }
    });

    return true;
  }

  drawXScales(forceRedraw: boolean): boolean {
    const viewport = { min: this.data.leftX.value, max: this.data.rightX.value };
    if (!forceRedraw && this.currentXViewport.min === viewport.min
      && this.currentXViewport.max === viewport.max) {
      return false;
    }
    this.currentXViewport = viewport;
    if (viewport.max === viewport.min) {
      return false;
    }

    const capacity = this.width / 40 | 0;

    let startIndex = binarySearch(this.data.x, this.data.leftX.value);
    if (startIndex < 0) {
      startIndex = ~startIndex - 1;
    }
    let endIndex = binarySearch(this.data.x, this.data.rightX.value);
    if (endIndex < 0) {
      endIndex = ~endIndex;
    }

    const dates = getDatesBetween(this.data.maxX, this.data.leftX.value, this.data.rightX.value, capacity);

    const activeValues = new Set<number>(dates);
    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];

      let s = this.getXScale(date);
      const offset = 20 + (date - this.data.leftX.value) / (this.data.rightX.value - this.data.leftX.value) * (this.width - 40);
      s.draw(this.width, offset, 350, true);
    }
    this.activeXScales.forEach((s, date) => {
      if (!activeValues.has(date)) {
        const offset = 20 + (date - this.data.leftX.value) / (this.data.rightX.value - this.data.leftX.value) * (this.width - 40);
        s.draw(this.width, offset, 350, false);
      }
    });

    return false;
  }

  getYScale(value: number, value2?: number) {
    let s = this.activeYScales.get(value);
    if (s) {
      return s;
    }
    s = this.yScalesPool.shift();
    if (!s) {
      const v = this.activeYScales.keys().next().value;
      s = this.activeYScales.get(v);
      this.activeYScales.delete(v);
    }
    this.activeYScales.set(value, s!);
    s!.init(value, value2);
    return s!;
  }

  getXScale(value: number) {
    let s = this.activeXScales.get(value);
    if (s) {
      return s;
    }
    if (!s) {
      s = this.xScalesPool.shift();
      if (!s) {
        const v = this.activeXScales.keys().next().value;
        s = this.activeXScales.get(v);
        this.activeXScales.delete(v);
      }
      this.activeXScales.set(value, s!);
    }
    s!.init(value);
    return s!;
  }
}

function createYScale(colors: string[] | null) {
  const t1 = document.createElementNS(svgNS, 'text');
  const t2 = document.createElementNS(svgNS, 'text');
  const line = document.createElementNS(svgNS, 'line');
  t1.style.fill = colors ? colors[0] : 'var(--text)';
  t2.style.fill = colors ? colors[1] : 'var(--text)';
  t1.style.font = '10px sans-serif';
  t2.style.font = '10px sans-serif';
  line.style.stroke = 'var(--lines)';
  t1.style.transition = 'opacity .2s ease';
  t2.style.transition = 'opacity .2s ease';
  t2.setAttribute('text-anchor', 'end');
  line.style.transition = 'opacity .2s ease';
  t1.style.opacity = '0';
  t2.style.opacity = '0';
  line.style.opacity = '0';
  return new YScale(t1, t2, line);
}

function createXScale() {
  const text = document.createElementNS(svgNS, 'text');
  text.style.fill = 'var(--text)';
  text.style.font = '10px sans-serif';
  text.style.transition = 'opacity 0.2s ease';
  text.setAttribute('text-anchor', 'middle');
  text.style.opacity = '0';
  return new XScale(text);
}

function format(v: number) {
  if (v < 0) return '';
  const p1 = (v % 1000) | 0;
  const p11 = p1 / 100 | 0;
  const p2 = (v % 1000000) / 1000 | 0;
  const p22 = p2 / 100 | 0;
  const p3 = v / 1000000 | 0;
  if (p3 > 0) {
    return p3 + (p2 > 0 ? '.' + p22 : '') + 'M';
  }
  if (p2 > 0) {
    return p2 + (p1 > 0 ? '.' + p11 : '') + 'K';
  }
  return String(p1);
}

const svgNS = "http://www.w3.org/2000/svg";