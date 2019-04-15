import { Theme } from "./themes";

export interface IViewportAware {
  getViewport(): { min: number, max: number, targetMin: number, targetMax: number };
  viewportchanged: (() => void) | null;
}

export interface IView {
  init(): Promise<void>;
  getContainer(): Element;
  setTheme(theme: Theme): void;
  refresh(refreshPreview: boolean): void;
}

export abstract class View implements IView {
  destroyed: boolean = false;
  width: number = 0;
  height: number = 0;
  animating: boolean = false;

  constructor(protected theme: Theme) {
  }

  abstract init(): Promise<void>;

  abstract getContainer(): Element;

  destroy() {
    this.destroyed = true;
  }

  setTheme(theme: Theme) {
    this.theme = theme;
    this.refresh(true);
  }

  refresh(refreshPreview: boolean) {
    if (!this.animating) {
      requestAnimationFrame(this.render);
    }
  }

  protected abstract onRender(t: number): boolean;

  protected abstract onResize(): void;

  private render = (t: number) => {
    if (this.destroyed) {
      return;
    }
    this.animating = true;
    const requireNextFrame = this.onRender(t);
    if (requireNextFrame) {
      requestAnimationFrame(this.render);
    } else {
      this.animating = false;
    }
  }
}