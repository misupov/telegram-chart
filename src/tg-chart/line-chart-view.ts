import { IDataProvider, IChartData } from "./tg-chart";
import { Theme, themeTransition } from "./themes";
import { CanvasWebglView } from "./canvas-webgl-view";
import { IViewportAware } from "./view";
import { Overlay } from "./overlay";

export class LineChartView extends CanvasWebglView implements IViewportAware {
  viewportchanged: (() => void) | null = null;
  targetMin = 1;
  targetMax = 1;
  currentMin = 1;
  currentMax = 1;
  firstDraw = true;

  constructor(
    canvas: HTMLCanvasElement,
    padding: number[],
    theme: Theme,
    data: IChartData,
    private zoomable: boolean,
    overlay?: Overlay,
    private lineWidth = 1.5) {
    super(data, canvas, padding, theme, zoomable, overlay);
  }

  getViewport() {
    return {
      min: this.currentMin,
      max: this.currentMax,
      targetMin: this.targetMin,
      targetMax: this.targetMax
    };
  }

  protected fillTexture(chartData: Uint32Array): number {
    for (let index = 0; index < this.data.lines.length; index++) {
      const l = this.data.lines[index];
      const scale = this.data.y_scaled ? l.scale : 1;
      for (let i = 0; i < l.y.length; i++) {
        chartData[i + this.textureSize * index * this.textureChunk] = l.y[i] * scale;
      }
    }
    return this.gl.NEAREST;
  }

  protected onWebglRender(gl: WebGLRenderingContext, width: number, height: number, t: number): boolean {
    var raf = this.data.animate(t);
    raf = themeTransition.animate(t) || raf;

    let left = this.zoomable ? (this.data.leftX.value - this.data.minX) / this.data.range : 0;
    let right = this.zoomable ? (this.data.rightX.value - this.data.minX) / this.data.range : 1;
    const viewport = this.zoomable ? this.data.getViewportYRange() : this.data.getWholeYRange();
    this.targetMin = viewport.min;
    this.targetMax = viewport.max;
    if (this.firstDraw) {
      this.firstDraw = false;
      this.currentMin = this.targetMin;
      this.currentMax = this.targetMax;
    } else {
      this.currentMin = this.currentMin * 0.7 + this.targetMin * 0.3;
      this.currentMax = this.currentMax * 0.7 + this.targetMax * 0.3;
    }

    let pointerOffs = (this.pointerX - this.data.minX) / this.data.range;

    if (this.zoomable) {
      const rl = (right - left);
      left = left - 20 / width * rl;
      right = right + 20 / width * rl;
    }

    let colors: number[] = [];
    let visibility: number[] = [];
    let linesY: number[] = [];
    for (let i = 0; i < this.data.lines.length; i++) {
      const l = this.data.lines[i];
      const c = themeTransition.endValue === 0 ? l.dayColorRGB : l.nightColorRGB;
      colors.push(...c);
      visibility.push(l.visibility.value);
      const rrr = pointerOffs + 1 / this.data.x.length;
      const int = rrr * (this.data.x.length - 1) | 0;
      const frac = rrr * (this.data.x.length - 1) % 1;
      const l1 = l.y[int - 1];
      const l2 = l.y[int];
      linesY.push((l1 + (l2 - l1) * frac) * l.scale);
    }

    gl.uniform2f(this.programInfo!.windowSize, gl.canvas.width, gl.canvas.height);
    gl.uniform3fv(this.programInfo!.colors, colors);
    gl.uniform1fv(this.programInfo!.visibility, visibility);
    gl.uniform1f(this.programInfo!.count, this.data.x.length);
    gl.uniform1f(this.programInfo!.left, left);
    gl.uniform1f(this.programInfo!.right, right);
    gl.uniform1f(this.programInfo!.pointerX, pointerOffs);
    gl.uniform1fv(this.programInfo!.linesY, linesY);
    gl.uniform1f(this.programInfo!.lmin, this.currentMin);
    gl.uniform1f(this.programInfo!.lmax, this.currentMax);
    gl.uniform4f(this.programInfo!.padding, this.padding[0], this.padding[1], this.padding[2], this.padding[3]);
    if (Math.abs(this.currentMin - this.targetMin) < 1) {
      this.currentMin = this.targetMin;
    }
    if (Math.abs(this.currentMax - this.targetMax) < 1) {
      this.currentMax = this.targetMax;
    }

    if (this.currentMin !== this.targetMin || this.currentMax !== this.targetMax) {
      if (this.viewportchanged) this.viewportchanged();
      return true;
    }

    return raf;
  }

  getFragmentShader(textureSize: number, textureChunk: number): string {
    const n = this.data.lines.length;
    return `
    precision highp float;
    uniform vec4 padding;
    uniform vec2 windowSize;
    uniform sampler2D uSampler;
    uniform vec3 colors[${n}];
    uniform float visibility[${n}];
    uniform float linesY[${n}];
    uniform float lmin;
    uniform float lmax;
    uniform float count;
    uniform float left;
    uniform float right;
    uniform float pointerX;

    #define Thickness ${this.lineWidth.toFixed(2)}
    
    float color(float h) {
      return mix(1.0, 0.0, smoothstep(0.6 * Thickness, 1.4 * Thickness, h));
    }

    float drawLine(vec2 p1, vec2 p2, vec2 uv) {
      
      float a = abs(distance(p1, uv));
      float b = abs(distance(p2, uv));
      float c = abs(distance(p1, p2));
    
      if (a>=c || b>=c) {
        if (a < Thickness*1.4) return color(a);
        if (b < Thickness*1.4) return color(b);
        return 0.0;
      }

      float p = (a+b+c)*0.5;    
      float h = 2.0/c * sqrt(p*(p-a)*(p-b)*(p-c));
      return color(h);
    }

    float getValue(float series, float offset) {
      offset = offset*count;
      float yy = floor(offset/${textureSize}.0);
      float xx = offset - yy;
      vec4 value = texture2D(uSampler, vec2((floor(xx)+0.5)/${textureSize}.0, (series*${textureChunk}.0 + yy+0.5)/${textureSize}.0));
      return value.r*255.0+value.g*65280.0+value.b*16711680.0;
    }

    float r(float x, vec2 uv, vec2 ws, int i) {
      float c = count-1.0;
      float cc = 1.0/c;
      float rl = 1.0/(right-left);
      float c1 = floor(x*c)*cc;
      float c2 = c1 + 1.0/count;
      float p1 = getValue(float(i), c1);
      float p2 = getValue(float(i), c2);
      float x1 = (c1-left)*rl;
      float x2 = (c1-left+cc)*rl;
      float pp = p1+(p2-p1)*(x2-x1)/(x-x1);
      
      float line = drawLine(
        vec2(x1, (p1-lmin)/(lmax-lmin))*ws,
        vec2(x2, (p2-lmin)/(lmax-lmin))*ws,
        uv);
      return c1 < 0.0 || c2 > 1.0 ? 0.0 : line;
    }

    void main()
    {
      vec2 uv = gl_FragCoord.xy;
      if (uv.y < padding[2] || uv.y > windowSize.y - padding[0] || uv.x > windowSize.x - padding[1] || uv.x < padding[3]) discard;
      vec2 ws = vec2(windowSize.x - padding[1] - padding[3], windowSize.y - padding[0] - padding[2]);
      uv.x -= padding[3];
      uv.y -= padding[2];
      float x = left+uv.x*(right-left)/ws.x;
      for (int i = ${n} - 1; i >= 0; i--) {
        float ly = (linesY[i]-lmin)/(lmax-lmin)*ws.y;
        float d = distance(vec2(x*ws.x/(right-left), uv.y), vec2((pointerX)*ws.x/(right-left), ly));
        if (visibility[i] > 0.0 && d < 13.0) {
          gl_FragColor = d > 10.0 ? vec4(colors[i], visibility[i]*color(d/13.0)) : vec4(0.0);
          return;
        }
      }
      vec4 c[${n}];
      for (int i = 0; i < ${n}; i++) {
        float line = r(x, uv, ws, i);
        c[i] = vec4(colors[i]*line,line*visibility[i]);
      }
      vec4 result = vec4(0.0);
      for (int i = 0; i < ${n}; i++) result = mix(result, c[i], c[i].a);

      float vline = max(0.0, 1.0 - (abs(pointerX - x)*ws.x/(right-left)));
      result = mix(result, vec4(0.5, 0.5, 0.5, 0.8), vline);

      gl_FragColor = result;
    }`;
  }
}
