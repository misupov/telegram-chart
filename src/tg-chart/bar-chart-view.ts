import { IChartData } from "./tg-chart";
import { Theme, themeTransition } from "./themes";
import { CanvasWebglView } from "./canvas-webgl-view";
import { IViewportAware } from "./view";
import { Overlay } from "./overlay";

export class BarChartView extends CanvasWebglView implements IViewportAware {
  viewportchanged: (() => void) | null = null;
  targetMax = 1;
  currentMax = 1;
  firstDraw = true;

  constructor(
    canvas: HTMLCanvasElement,
    padding: number[],
    theme: Theme,
    data: IChartData,
    private zoomable: boolean,
    overlay?: Overlay) {
    super(data, canvas, padding, theme, zoomable, overlay);
  }

  getViewport() {
    return {
      min: 0,
      max: this.currentMax,
      targetMin: 0,
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

    let colors: number[] = [];
    let nightColors: number[] = [];
    let visibility: number[] = [];
    for (let index = 0; index < this.data.lines.length; index++) {
      const l = this.data.lines[index];
      colors.push(...themeTransition.endValue === 0 ? l.dayColorRGB : l.nightColorRGB);
      visibility.push(l.visibility.value);
    }
    let left = this.zoomable ? (this.data.leftX.value - this.data.minX) / this.data.range : 0;
    let right = this.zoomable ? (this.data.rightX.value - this.data.minX) / this.data.range : 1;

    const viewport = this.zoomable ? this.data.getViewportYRange() : this.data.getWholeYRange();

    this.targetMax = viewport.max;
    if (this.firstDraw) {
      this.firstDraw = false;
      this.currentMax = this.targetMax;
    } else {
      this.currentMax = this.currentMax * 0.7 + this.targetMax * 0.3;
    }

    if (this.zoomable) {
      left = left - 20 / width * (right - left);
      right = right + 20 / width * (right - left);
    }
    let pointerOffs = (this.pointerX - this.data.minX) / this.data.range;

    gl.uniform2f(this.programInfo!.windowSize, gl.canvas.width, gl.canvas.height);
    gl.uniform3fv(this.programInfo!.colors, colors);
    gl.uniform1fv(this.programInfo!.visibility, visibility);
    gl.uniform1f(this.programInfo!.count, this.data.x.length);
    gl.uniform1f(this.programInfo!.left, left);
    gl.uniform1f(this.programInfo!.right, right);
    gl.uniform1f(this.programInfo!.lmax, this.currentMax);
    gl.uniform1f(this.programInfo!.pointerX, pointerOffs);
    gl.uniform4f(this.programInfo!.blendMask, this.theme.blendMask[0], this.theme.blendMask[1], this.theme.blendMask[2], this.theme.blendMask[3]);
    gl.uniform4f(this.programInfo!.padding, this.padding[0], this.padding[1], this.padding[2], this.padding[3]);

    if (Math.abs(this.currentMax - this.targetMax) < 0.1) {
      this.currentMax = this.targetMax;
    }

    if (this.currentMax !== this.targetMax) {
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
    uniform float lmax;
    uniform float count;
    uniform float left;
    uniform float right;
    uniform float pointerX;
    uniform vec4 blendMask;

    float getValue(float series, float offset) {
      offset = offset*count;
      float yy = floor(offset/${textureSize}.0);
      float xx = offset - yy;
      vec4 value = texture2D(uSampler, vec2((floor(xx)+0.5)/${textureSize}.0, (series*${textureChunk}.0 + yy + 0.5)/${textureSize}.0));
      return value.r*255.0+value.g*65280.0+value.b*16711680.0+value.a*4278190080.0;
    }

    vec4 r(vec2 uv, vec2 ws, float pointerX) {
      uv = uv/ws;
      float o = left + uv.x*(right-left);
      float v = 0.0;
      for (int i = 0; i < ${n}; i++) {
        v = v + getValue(float(i), o) * visibility[i];
        if (uv.y < v/lmax) {
          vec4 result = vec4(colors[i], 1.0);
          if (pointerX >= 0.0 && abs(floor(o*count)/count - floor(pointerX*count)/count) > 0.0001) result = mix(result, blendMask, 0.5);
          return result;
        }
      }
      return vec4(0);
    }

    void main()
    {
      vec2 uv = gl_FragCoord.xy;
      if (uv.y < padding[2] || uv.y > windowSize.y - padding[0] || uv.x > windowSize.x - padding[1] || uv.x < padding[3]) discard;
      vec2 ws = vec2(windowSize.x - padding[1] - padding[3], windowSize.y - padding[0] - padding[2]);
      uv.x -= padding[3];
      uv.y -= padding[2];

      gl_FragColor = r(uv, ws, pointerX);
    }
`;
  }
}