import { Theme } from "./themes";
import { View } from "./view";
import { Overlay } from "./overlay";
import { IChartData } from "./tg-chart";
import { oneDay } from "./utils";

interface ProgramInfo {
  buffer: WebGLBuffer;
  texture: WebGLTexture;
  program: WebGLProgram;
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader,
  aVertexPosition: GLint;
  windowSize: WebGLUniformLocation;
  colors: WebGLUniformLocation;
  theme: WebGLUniformLocation;
  visibility: WebGLUniformLocation;
  uSampler: WebGLUniformLocation;
  count: WebGLUniformLocation;
  left: WebGLUniformLocation;
  right: WebGLUniformLocation;
  lmin: WebGLUniformLocation;
  lmax: WebGLUniformLocation;
  padding: WebGLUniformLocation;
  pointerX: WebGLUniformLocation;
  linesY: WebGLUniformLocation;
  blendMask: WebGLUniformLocation;
}

export abstract class CanvasWebglView extends View {
  gl: WebGLRenderingContext;
  pointerX: number = -1;
  targetPointerX: number = -1;
  programInfo?: ProgramInfo;
  textureSize = 512;
  textureChunk = 40;
  overlayTimer?: number;

  protected abstract onWebglRender(gl: WebGLRenderingContext, width: number, height: number, t: number): boolean;

  constructor(
    protected data: IChartData,
    protected canvas: HTMLCanvasElement,
    protected padding: number[],
    theme: Theme,
    zoomable: boolean,
    private overlay?: Overlay) {
    super(theme);
    this.gl = canvas.getContext('webgl', { preserveDrawingBuffer: true })!;

    if (zoomable) {
      const cont = this.getContainer();
      cont.addEventListener('touchstart', this.ontouchstart);
      cont.addEventListener('touchend', this.ontouchend);
      cont.addEventListener('touchmove', this.ontouchmove);
      cont.addEventListener('mousedown', this.onmousedown);
      cont.addEventListener('mousemove', this.onmousemove);
      // cont.addEventListener('mouseout', e => {
      //   this.hidePointer();
      // });
      // cont.addEventListener('touchend', e => {
      //   this.hidePointer();
      // });
    }
  }

  onmousedown = (e: MouseEvent) => {
    if (e.target !== this.canvas) {
      this.hideOverlay();
    } else {
      this.showOverlay(e.offsetX, e.offsetY);
    }
  }

  ontouchstart = (e: TouchEvent) => {
    if (e.target !== this.canvas) {
      this.hideOverlay();
    } else {
      const rect = (e.target as Element).getBoundingClientRect();
      const x = e.targetTouches[0].clientX - rect.left;
      const y = e.targetTouches[0].clientY - rect.top;
      this.overlayTimer = setTimeout(() => {
        this.showOverlay(x, y);
      }, 200);
    }
  }

  private ontouchend = (e: TouchEvent) => {
    clearTimeout(this.overlayTimer);
  }

  private onmousemove = (e: MouseEvent) => {
    if (e.buttons > 0 && this.overlay!.isVisible) {
      const rect = (e.target as Element).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.showOverlay(x, y);
    }
  }

  private ontouchmove = (e: TouchEvent) => {
    if (this.overlay!.isVisible) {
      const rect = (e.target as Element).getBoundingClientRect();
      const x = e.targetTouches[0].clientX - rect.left;
      const y = e.targetTouches[0].clientY - rect.top;
      this.showOverlay(x, y);
    }
  }

  private showOverlay(x: number, y: number) {
    let date = this.getDateFromScreenCoord(x);
    if (this.data.lines[0].type !== 'bar') {
      date = date + oneDay / 2;
    }
    date = (date / oneDay | 0) * oneDay;
    const clientWidth = this.getContainer().clientWidth;
    this.targetPointerX = (date / oneDay | 0) * oneDay;
    if (this.pointerX < 0) {
      this.pointerX = this.targetPointerX;
    }
    this.overlay!.show(date, x, y, this.data, clientWidth, 380);
    this.refresh(false);
    window.addEventListener('mousedown', this.onmousedown);
    window.addEventListener('touchstart', this.ontouchstart);
  }

  private hideOverlay() {
    window.removeEventListener('mousedown', this.onmousedown);
    window.removeEventListener('touchstart', this.ontouchstart);
    this.pointerX = this.targetPointerX = -1;
    this.overlay!.hide();
    this.refresh(false);
  }

  protected abstract getFragmentShader(textureSize: number, textureChunk: number): string;

  protected abstract fillTexture(chartData: Uint32Array): number;

  init(): Promise<void> {
    this.refresh(true);
    return Promise.resolve();
  }

  setTheme(theme: Theme) {
    this.theme = theme;
    this.refresh(true);
  }

  protected onResize(): void {
  }

  public getContainer() {
    return this.canvas;
  }

  protected getDateFromScreenCoord(x: number): number {
    const xNorm = (x - 20) / (this.canvas.clientWidth - 40);
    let result = this.data.leftX.value + (this.data.rightX.value - this.data.leftX.value) * xNorm;
    result = Math.max(result, this.data.minX);
    result = Math.min(result, this.data.x[this.data.x.length - 1]);
    return result;
  }

  protected onRender(t: number) {
    const canvas = this.canvas;

    var rect = (<HTMLElement>canvas).getBoundingClientRect();
    const dpr = window.devicePixelRatio;
    if (this.width != rect.width || this.height != rect.height) {
      this.width = rect.width;
      this.height = rect.height;
      canvas.width = dpr * rect.width;
      canvas.height = dpr * rect.height;
      this.onResize();
    }

    if (!this.programInfo) {
      this.initGl(this.gl);
    }

    this.gl.useProgram(this.programInfo!.program);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.programInfo!.buffer);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.programInfo!.texture);
    this.gl.viewport(this.padding[3], this.padding[2],
      this.gl.canvas.width - this.padding[3] - this.padding[1], this.gl.canvas.height - this.padding[2] - this.padding[0]);

    this.pointerX = this.pointerX * 0.7 + this.targetPointerX * 0.3;
    if (Math.abs(this.pointerX - this.targetPointerX) < oneDay / 100) {
      this.pointerX = this.targetPointerX;
    }
    let raf = this.pointerX !== this.targetPointerX;

    raf = this.onWebglRender(this.gl, rect.width, rect.height, t) || raf;

    const offset = 0;
    const vertexCount = 4;
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, offset, vertexCount);
    return raf;
  }

  private initGl(gl: WebGLRenderingContext) {
    const vsSource = `
    attribute vec4 aVertexPosition;

    void main() {
      gl_Position = aVertexPosition;
    }
  `;

    const vertexShader = this.loadShader(gl, gl.VERTEX_SHADER, vsSource)!;

    const fragmentShader = this.loadShader(gl, gl.FRAGMENT_SHADER, this.getFragmentShader(
      this.textureSize,
      this.textureChunk))!;

    const program = this.initShaderProgram(gl, vertexShader, fragmentShader)!;

    const texture = this.createTexture(gl)!;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    const buffer = this.initBuffer(gl)!;

    this.programInfo = {
      texture: texture,
      program: program,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      aVertexPosition: gl.getAttribLocation(program, "aVertexPosition")!,
      windowSize: gl.getUniformLocation(program, "windowSize")!,
      colors: gl.getUniformLocation(program, "colors")!,
      theme: gl.getUniformLocation(program, "theme")!,
      visibility: gl.getUniformLocation(program, "visibility")!,
      uSampler: gl.getUniformLocation(program, "uSampler")!,
      count: gl.getUniformLocation(program, "count")!,
      left: gl.getUniformLocation(program, "left")!,
      right: gl.getUniformLocation(program, "right")!,
      lmin: gl.getUniformLocation(program, "lmin")!,
      lmax: gl.getUniformLocation(program, "lmax")!,
      padding: gl.getUniformLocation(program, "padding")!,
      pointerX: gl.getUniformLocation(program, "pointerX")!,
      linesY: gl.getUniformLocation(program, "linesY")!,
      blendMask: gl.getUniformLocation(program, "blendMask")!,
      buffer: buffer
    }

    var aVertexPosition = this.programInfo!.aVertexPosition;
    gl.vertexAttribPointer(aVertexPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aVertexPosition);
  }

  initShaderProgram(gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader) {

    // Create the shader program

    const shaderProgram = gl.createProgram()!;
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    // If creating the shader program failed, alert

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
      alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
      return null;
    }

    return shaderProgram;
  }

  loadShader(gl: WebGLRenderingContext, type: number, source: string) {

    const shader = gl.createShader(type)!;

    // Send the source to the shader object

    gl.shaderSource(shader, source);

    // Compile the shader program

    gl.compileShader(shader);

    // See if it compiled successfully

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  initBuffer(gl: WebGLRenderingContext) {
    const buffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

    const positions = [
      -1.0, 1.0,
      1.0, 1.0,
      -1.0, -1.0,
      1.0, -1.0,
    ];

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    return buffer;
  }

  createTexture(gl: WebGLRenderingContext) {

    var buf = new ArrayBuffer(this.textureSize * this.textureSize * 4);
    const chartData = new Uint32Array(buf);
    const filter = this.fillTexture(chartData);

    // Convert to WebGL texture
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D,
      0,
      gl.RGBA,
      this.textureSize, this.textureSize,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array(buf));

    // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);

    gl.bindTexture(gl.TEXTURE_2D, null); // 'clear' texture status
    return texture;
  }
}
