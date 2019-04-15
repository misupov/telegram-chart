import "./long-press-event.js";
import { IDataProvider, IChartData } from "./tg-chart";
import { IView } from "./view.js";
import { Theme } from "./themes.js";

export class ButtonsView implements IView {
  container: HTMLDivElement;
  data?: IChartData;

  constructor(className: string, private dataProvider: IDataProvider,
    private switchLine: (line: string, enable: boolean) => boolean,
    private activateSingleLine: (line: string) => void) {
    const container = this.container = document.createElement('div');
    container.classList.add(className);
  }

  getContainer(): HTMLElement {
    return this.container;
  }

  setTheme(theme: Theme): void {
  }

  refresh(): void {
  }

  init(): Promise<void> {
    return this.dataProvider.getOverview()
      .then(data => {
        this.data = data;
        if (data.lines.length < 2) {
          return;
        }
        data.lines.forEach(l => {
          const label = document.createElement('label');
          const input = document.createElement('input');
          input.type = 'checkbox';
          label.dataset.lineName = l.name;
          label.appendChild(input);
          label.appendChild(document.createElement('i'));
          const txt = document.createElement('b');
          txt.innerText = l.name;
          label.appendChild(txt);
          label.addEventListener('long-press', this.onlongpress as any);
          input.addEventListener('change', (e) => {
            if (this.switchLine(l.name, input.checked)) {
              label.classList.toggle('checked', input.checked);
            } else {
              input.checked = true;
            }
          })
          input.checked = true;
          label.classList.add('checked');
          label.style.setProperty('--color', l.color);
          this.container.appendChild(label);
        });
      });
  }
  onlongpress = (e: MouseEvent) => {
    if (!this.data) {
      return;
    }
    const label = <HTMLLabelElement>e.currentTarget;
    const line = label.dataset.lineName;
    this.activateSingleLine(line!);
    this.container.querySelectorAll('input[type="checkbox"]').forEach(cb => (<HTMLInputElement>cb).checked = false);
    this.container.querySelectorAll('label').forEach((l: HTMLLabelElement) => {
      if (l.dataset.lineName === line) {
        l.classList.add('checked');
      } else {
        l.classList.remove('checked');
      }
      e.preventDefault();
    });
  }
}