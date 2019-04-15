import { Theme } from "./themes";
import { View } from "./view";

export abstract class CanvasView extends View {
  container: HTMLDivElement;
  canvas: HTMLCanvasElement;
  div: HTMLDivElement;
  destroyed: boolean = false;
  ctx: CanvasRenderingContext2D;
  width: number = 0;
  height: number = 0;
  animating: boolean = false;

  constructor(protected theme: Theme, className: string | null) {
    super(theme)
    this.container = document.createElement('div');
    // this.container.style.position = 'relative';
    if (className) { this.container.classList.add(className); }
    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.div = document.createElement('div');
    this.div.style.position = 'absolute';
    this.div.style.top = '0';
    this.container.appendChild(this.canvas);
    this.container.appendChild(this.div);
    this.ctx = this.canvas.getContext('2d')!;
  }

  getContainer() {
    return this.container;
  }

  abstract init(): Promise<void>;

  destroy() {
    this.destroyed = true;
    const c = this.container;
    while (c.firstChild) {
      c.removeChild(c.firstChild);
    }
  }

  setTheme(theme: Theme) {
    this.theme = theme;
    this.refresh(true);
  }

  protected abstract onCanvasRender(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    t: number): boolean;

  protected abstract onResize(): void;

  protected onRender(t: number): boolean {
    if (this.destroyed) {
      return false;
    }
    const canvas = this.canvas;
    const ctx = this.ctx;
    var rect = (<HTMLElement>canvas).getBoundingClientRect();
    const dpr = window.devicePixelRatio;
    if (this.width != rect.width || this.height != rect.height) {
      this.width = rect.width;
      this.height = rect.height;
      canvas.width = dpr * rect.width;
      canvas.height = dpr * rect.height;
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
      this.onResize();
    }
    return this.onCanvasRender(ctx, rect.width, rect.height, t);
  }
}