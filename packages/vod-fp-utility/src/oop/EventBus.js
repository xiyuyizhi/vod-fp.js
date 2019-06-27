export default class EventBus {
  constructor() {
    this.events = {};
    //alias
    this.addEventListener = this.on.bind(this);
    this.removeEventListener = this.off.bind(this);
  }

  on(eventName, handler) {
    if (this.events[eventName]) {
      this.events[eventName].push(handler);
    } else {
      this.events[eventName] = [handler];
    }
    return this;
  }

  once(eventName, handler) {
    const wrapper = () => {
      handler();
      this.off(eventName, handler);
    };
    this.on(eventName, wrapper);
    return this;
  }

  emit(eventName, ...params) {
    if (!this.events[eventName]) return;
    this.events[eventName].forEach(listener => {
      listener(...params);
    });
    return this;
  }

  offAllEvents() {
    Object.keys(this.events).forEach(eveName => {
      this.events[eveName] = [];
    })
  }

  off(eventName, handler) {
    if (!eventName) return;
    if (!handler) {
      this.events[eventName] = [];
    } else {
      const index = this.events[eventName].indexOf(handler);
      this.events[eventName].splice(index, 1);
    }
    return this;
  }
}
