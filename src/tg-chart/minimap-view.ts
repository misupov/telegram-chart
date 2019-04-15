import { View, IView } from "./view";
import { IDataProvider, IChartData, TgChart } from "./tg-chart";
import { Theme, Themes } from "./themes";
import { PercentageChartView } from "./percentage-chart-view";
import { BarChartView } from "./bar-chart-view";
import { LineChartView } from "./line-chart-view";

const selectorTemplate = document.createElement('template');
selectorTemplate.innerHTML =
  `<div class='slider' style='position: absolute; top: 0'>
  <div class='preview-left'></div>
  <div class='preview-right'></div>
  <div class='scroller'>
  <div class='thumb left'></div>
  <div class='thumb right'></div>
  <div class='center'></div>
  </div>
</div>`;

export class MinimapView extends View {
  container: HTMLElement;
  knobWidth = 14;
  knobGlowWidth = 0;
  paths: Path2D[] = [];
  dragDeltaLeft?: number;
  dragDeltaRight?: number;
  scale: number = 1;
  targetScale: number = 1;
  firstDraw: boolean = true;
  pcv!: IView;
  slider: HTMLElement;
  leftThumb: any;
  rightThumb: any;
  centerThumb: any;

  constructor(
    canvas: HTMLCanvasElement,
    theme: Theme,
    private chart: TgChart,
    private data: IChartData,
    private dataProvider: IDataProvider) {
    super(theme);
    this.container = document.createElement('div');
    this.container.classList.add('minimap-view');
    const dpr = window.devicePixelRatio;
    const padding = [360 * window.devicePixelRatio, 20 * dpr, 0, 20 * dpr];
    if (data.percentage) {
      this.pcv = new PercentageChartView(canvas, padding, theme, data, false, undefined);
      this.container.appendChild(this.pcv.getContainer());
    } else if (data.lines[0].type === 'bar') {
      this.pcv = new BarChartView(canvas, padding, theme, data, false, undefined);
      this.container.appendChild(this.pcv.getContainer());
    } else if (data.lines[0].type === 'line') {
      this.pcv = new LineChartView(canvas, padding, theme, data, false, undefined, 0.8);
      this.container.appendChild(this.pcv.getContainer());
    }
    this.slider = (selectorTemplate.content.cloneNode(true) as HTMLElement).firstElementChild as HTMLElement;
    this.container.appendChild(this.slider);
    this.leftThumb = this.slider.querySelector('.left.thumb');
    this.rightThumb = this.slider.querySelector('.right.thumb');
    this.centerThumb = this.slider.querySelector('.center');
    this.slider.addEventListener('mousedown', this.onmousedown);
    this.slider.addEventListener('touchstart', this.ontouchstart);
  }

  getContainer(): HTMLElement {
    return this.container;
  }

  protected onRender(t: number): boolean {
    const raf = this.data.animate(t);
    this.slider.style.setProperty('--left', ((this.data.leftX.value - this.data.minX) / this.data.range * 100) + '%');
    this.slider.style.setProperty('--right', ((this.data.rightX.value - this.data.minX) / this.data.range * 100) + '%');
    return raf;
  }

  protected onResize(): void {
    this.refresh(true);
  }

  private onmousedown = (e: MouseEvent) => {
    this.onpointerdown(e.target!, e.clientX);
    e.preventDefault();
  };
  private ontouchstart = (e: TouchEvent) => {
    this.onpointerdown(e.target!, e.touches[0].clientX);
    e.preventDefault();
  }

  private onpointerdown = (target: EventTarget, offsetX: number) => {
    if (target === this.leftThumb || target === this.rightThumb || target === this.centerThumb) {
      window.addEventListener('mousemove', this.onmousemove);
      window.addEventListener('mouseup', this.onmouseup);
      window.addEventListener('touchmove', this.ontouchmove);
      window.addEventListener('touchend', this.ontouchend);
      this.dragstart(target, offsetX);
    } else {
      const x = this.offsetToX(offsetX);
      const w = this.dataToX(this.data.rightX.value) - this.dataToX(this.data.leftX.value);
      this.setThumbs(x - w / 2, x + w / 2, w, 400);
    }
  }

  private onpointerup = () => {
    window.removeEventListener('mousemove', this.onmousemove);
    window.removeEventListener('mouseup', this.onmouseup);
    window.removeEventListener('touchmove', this.ontouchmove);
    window.removeEventListener('touchend', this.ontouchend);
  }

  private onmousemove = (e: MouseEvent) => this.dragmove(e.clientX);
  private ontouchmove = (e: TouchEvent) => this.dragmove(e.touches[0].clientX);
  private onmouseup = () => this.onpointerup();
  private ontouchend = () => this.onpointerup();

  private dragstart = (target: EventTarget, offset: number) => {
    const dragOrigin = this.offsetToX(offset);
    if (target === this.leftThumb) {
      this.dragDeltaLeft = dragOrigin - this.dataToX(this.data.leftX.value);
      this.dragDeltaRight = undefined;
    } else if (target === this.rightThumb) {
      this.dragDeltaRight = dragOrigin - this.dataToX(this.data.rightX.value);
      this.dragDeltaLeft = undefined;
    } else {
      this.dragDeltaLeft = dragOrigin - this.dataToX(this.data.leftX.value);
      this.dragDeltaRight = dragOrigin - this.dataToX(this.data.rightX.value);
    }
  }

  private dragmove = (offset: number) => {
    const x = this.offsetToX(offset);
    const minWidth = 0.03;
    const sliderWidth = this.dataToX(this.data.rightX.value) - this.dataToX(this.data.leftX.value);
    let left = this.dragDeltaLeft ? x - this.dragDeltaLeft : this.dataToX(this.data.leftX.value);
    let right = this.dragDeltaRight ? x - this.dragDeltaRight : this.dataToX(this.data.rightX.value);
    if (this.dragDeltaLeft && this.dragDeltaRight) {
      if (right < sliderWidth) right = sliderWidth;
      if (left > 1 - sliderWidth) left = 1 - sliderWidth;
    } else {
      if (this.dragDeltaLeft && right - left < minWidth) left = right - minWidth;
      if (this.dragDeltaRight && right - left < minWidth) right = left + minWidth;
    }
    this.setThumbs(left, right, minWidth, 0);
  }

  init(): Promise<void> {
    return this.dataProvider.getOverview()
      .then(data => {
        this.data = data;
        this.setThumbs(0.8, 1, 0.1, 0);
        this.refreshThumbs();
        this.refresh(true);
      });
  }

  setTheme(theme: Theme) {
    this.theme = theme;
    this.refreshThumbs();
    this.refresh(true);
  }

  refreshThumbs() {
    if (this.theme === Themes.day && this.data
      && (this.data.lines[0].type === 'bar' || this.data.lines[0].type === 'area')) {
      this.slider.style.removeProperty('--scroll-shadow');
    } else {
      this.slider.style.setProperty('--scroll-shadow', 'transparent');
    }
  }

  public switchLine(line: string, enable: boolean): boolean {
    if (this.data.lines.every(l => l.visibility.endValue === 0 || l.name === line)) {
      return false;
    }
    this.data.lines.find(l => l.name === line)!.visibility.animateTo(enable ? 1 : 0, 200);
    this.chart.refresh(true);
    return true;
  }

  public activateSingleLine(line: string) {
    this.data.lines.forEach(l => l.visibility.animateTo(l.name === line ? 1 : 0, 200));
    this.chart.refresh(true);
  }

  public setThumbs(left: number, right: number, minWidth: number, duration: number) {
    if (left < 0) left = 0;
    if (right > 1) right = 1;
    if (left + minWidth > 1) {
      right = 1;
      left = 1 - minWidth;
    } else if (right - minWidth < 0) {
      left = 0;
      right = minWidth;
    }

    left = this.data.minX + this.data.range * left;
    right = this.data.minX + this.data.range * right;
    left = Math.max(this.data.minX, left);
    right = Math.min(this.data.maxX, right);

    this.data.leftX.animateTo(left, duration);
    this.data.rightX.animateTo(right, duration);
    this.chart.refresh(false);
  }

  public refresh(refreshPreview: boolean) {
    super.refresh(refreshPreview);
    if (refreshPreview) {
      this.pcv.refresh(true);
    }
  }

  private offsetToX(offset: number) {
    return (offset) / (this.container.clientWidth);
  }

  private dataToX(point: number) {
    return (point - this.data.minX) / this.data.range;
  }
}