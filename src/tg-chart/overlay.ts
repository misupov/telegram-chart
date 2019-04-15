import { formatDate, binarySearch, DateFormat } from "./utils";
import { IChartData } from "./tg-chart";

export class Overlay {
  isVisible: boolean = false;
  timer: number | undefined;
  data!: IChartData;
  lastRenderTime: number = 0;

  constructor(private overlayDiv: HTMLElement, private owner: Element) {
    overlayDiv.classList.add('overlay');
    overlayDiv.style.opacity = '0';
    overlayDiv.style.zIndex = '1';
  }

  public show(date: number, x: number, y: number, data: IChartData, containerWidth: number, containerHeight: number) {
    this.isVisible = true;
    let idx = binarySearch(data.x, date);
    if (idx < 0) idx = ~idx - 1;
    if (idx < 0) {
      this.hide();
      return;
    }
    this.data = data;
    const currentTime = new Date().getTime()
    if (currentTime - this.lastRenderTime < 200) {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.render(idx), 200);
    } else {
      this.render(idx);
    }
    const width = this.overlayDiv.clientWidth;
    const height = this.overlayDiv.clientHeight;
    if (x + width + 10 < containerWidth) {
      this.overlayDiv.style.left = (x + 10) + 'px';
    } else {
      this.overlayDiv.style.left = (x - width - 10) + 'px';
    }
    if (y - height - 30 > 0) {
      this.overlayDiv.style.top = Math.min(containerHeight - height - 20, y - height + 30) + 'px';
    } else {
      this.overlayDiv.style.top = Math.max(30, y + 30) + 'px';
    }
    this.overlayDiv.style.opacity = '1';
  }

  render(idx: number): any {
    this.lastRenderTime = new Date().getTime();
    const date = this.data.x[idx];
    this.overlayDiv.innerHTML = `<div class='benchmark-date'>${formatDate(new Date(date), DateFormat.Medium)}</div>
    <div class='benchmark-values'>${renderData(this.data, idx)}</div>`;
  }

  public hide() {
    this.overlayDiv.style.opacity = '0';
    this.isVisible = false;
  }
}

function renderData(data: IChartData, index: number) {
  let res: string;
  const total = data.lines.reduce((s, l) => s + l.visibility.endValue * l.y[index], 0);
  if (data.percentage) {
    const p = data.lines.filter(l => l.visibility.endValue > 0).map(l => (l.y[index] / total * 100) | 0);
    let t = 100 - p.reduce((x, s) => x + s, 0);
    for (let i = 0; t > 0; i++) {
      p[i % p.length]++;
      t--;
    }
    return data.lines.filter(l => l.visibility.endValue > 0).map((l, li) =>
      l.visibility.endValue > 0 ?
        `<div class='benchmark-point'>
        <div class='benchmark-name'><div class='benchmark-percent'>${p[li]}%</div> ${l.name}</div>
        <div class='benchmark-value' style='color:${l.color}'>${l.y[index]}</div>
      </div>` : '').join('');
  }
  res = data.lines.map(l =>
    l.visibility.endValue > 0 ?
      `<div class='benchmark-point'>
      <div class='benchmark-name'>${l.name}</div>
      <div class='benchmark-value' style='color:${l.color}'>${l.y[index]}</div>
    </div>` : '').join('');
  if (data.stacked) {
    res += `<div class='benchmark-point'>
      <div class='benchmark-name'>All</div>
      <div class='benchmark-value'>${data.lines.reduce((s, l) => s + l.y[index], 0)}</div>
    </div>`
  }
  return res;
}
