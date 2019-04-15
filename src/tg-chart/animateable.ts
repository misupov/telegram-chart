export class Animateable {
  startValue: number;
  endValue: number;
  startTime: number = -1;
  duration: number = 0;
  value: number;
  restart = false;
  easingFunc: (t: number) => number;

  constructor(value: number, easingFunc: (t: number) => number) {
    this.startValue = this.endValue = this.value = value;
    this.easingFunc = easingFunc;
  }

  animateTo(targetValue: number, duration: number) {
    if (targetValue === this.endValue) {
      return;
    }
    if (duration <= 0) {
      this.value = targetValue;
    }
    this.startValue = this.value;
    this.duration = duration;
    this.endValue = targetValue;
    this.startTime = -1;
    this.restart = true;
    this.value = this.startValue;
  }

  public animate(time: number): boolean {
    if (this.duration === 0 && this.restart) {
      this.value = this.endValue;
      this.startTime = 0;
      this.restart = false;
      return true;
    } else {
      if (this.startTime === 0) {
        return false;
      }
      if (this.restart) {
        this.startTime = time;
        this.restart = false;
      }
      const t = Math.max(0, Math.min(1, (time - this.startTime) / this.duration));
      const progress = this.easingFunc(t);
      this.value = this.endValue * progress + this.startValue * (1 - progress);
      if (time - this.startTime >= this.duration) {
        this.startTime = 0;
      }
    }
    return this.startTime > 0;
  }
}
