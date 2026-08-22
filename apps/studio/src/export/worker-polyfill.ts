/**
 * Worker Polyfill for Fabric.js
 *
 * Fabric.js checks:
 *   if (typeof document !== 'undefined' && typeof window !== 'undefined')
 *   if (document instanceof (typeof HTMLDocument !== 'undefined' ? HTMLDocument : Document))
 *
 * This file must be imported at the very top of the worker before Fabric.
 */

function createStyleProxy(initialWidth = 1920, initialHeight = 1080) {
  const store: Record<string, string> = {
    width: `${initialWidth}px`,
    height: `${initialHeight}px`,
    position: "relative",
    cssText: "",
    userSelect: "none",
  };
  return new Proxy(store, {
    get(target, prop: string) {
      if (prop === "setProperty") {
        return (key: string, val: string) => {
          target[key] = String(val);
        };
      }
      if (prop === "getPropertyValue") {
        return (key: string) => target[key] || "";
      }
      if (prop === "removeProperty") {
        return (key: string) => {
          const prev = target[key];
          delete target[key];
          return prev || "";
        };
      }
      if (prop === "cssText") {
        return Object.entries(target)
          .filter(([k]) => k !== "cssText")
          .map(([k, v]) => `${k}:${v}`)
          .join(";");
      }
      return target[prop] || "";
    },
    set(target, prop: string, val: unknown) {
      target[prop] = String(val);
      return true;
    },
  });
}

function createClassList() {
  const classes = new Set<string>();
  return {
    add: (...cls: string[]) => cls.forEach((c) => classes.add(c)),
    remove: (...cls: string[]) => cls.forEach((c) => classes.delete(c)),
    contains: (c: string) => classes.has(c),
    toggle: (c: string) => (classes.has(c) ? (classes.delete(c), false) : (classes.add(c), true)),
    toString: () => Array.from(classes).join(" "),
  };
}

export function makeFabricCompatible(canvas: OffscreenCanvas): OffscreenCanvas {
  const c = canvas as unknown as Record<string, unknown>;

  if (!c.style || typeof (c.style as { setProperty?: unknown }).setProperty !== "function") {
    c.style = createStyleProxy(canvas.width, canvas.height);
  }
  if (!c.classList) {
    c.classList = createClassList();
  }
  if (typeof c.className !== "string") {
    c.className = "";
  }
  if (!c._attrs) {
    c._attrs = {};
  }
  const attrs = c._attrs as Record<string, string>;

  c.getAttribute = (name: string) => attrs[name] ?? (name === "dir" ? "ltr" : null);
  c.hasAttribute = (name: string) => name in attrs;
  c.setAttribute = (name: string, val: string) => {
    attrs[name] = String(val);
  };
  c.removeAttribute = (name: string) => {
    delete attrs[name];
  };

  c.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: canvas.width,
    height: canvas.height,
    right: canvas.width,
    bottom: canvas.height,
    x: 0,
    y: 0,
  });

  if (!c.addEventListener) {
    c.addEventListener = () => {};
    c.removeEventListener = () => {};
    c.dispatchEvent = () => true;
  }

  if (typeof (globalThis as Record<string, unknown>).document !== "undefined") {
    c.ownerDocument = (globalThis as Record<string, unknown>).document;
  }
  return canvas;
}

// Polyfill OffscreenCanvas.prototype so any instance created has DOM methods
if (typeof OffscreenCanvas !== "undefined") {
  const proto = OffscreenCanvas.prototype as unknown as Record<string, unknown>;
  proto.getAttribute = function (name: string) {
    const attrs = (this as Record<string, unknown>)._attrs as Record<string, string> | undefined;
    return attrs?.[name] ?? (name === "dir" ? "ltr" : null);
  };
  proto.hasAttribute = function (name: string) {
    const attrs = (this as Record<string, unknown>)._attrs as Record<string, string> | undefined;
    return attrs ? name in attrs : false;
  };
  proto.setAttribute = function (name: string, value: string) {
    if (!(this as Record<string, unknown>)._attrs) {
      (this as Record<string, unknown>)._attrs = {};
    }
    ((this as Record<string, unknown>)._attrs as Record<string, string>)[name] = String(value);
  };
  proto.removeAttribute = function (name: string) {
    const attrs = (this as Record<string, unknown>)._attrs as Record<string, string> | undefined;
    if (attrs) delete attrs[name];
  };
  proto.getBoundingClientRect = function () {
    const w = (this as unknown as OffscreenCanvas).width || 1920;
    const h = (this as unknown as OffscreenCanvas).height || 1080;
    return {
      left: 0,
      top: 0,
      width: w,
      height: h,
      right: w,
      bottom: h,
      x: 0,
      y: 0,
    };
  };
  proto.addEventListener = function () {};
  proto.removeEventListener = function () {};
  proto.dispatchEvent = function () {
    return true;
  };
  if (!Object.getOwnPropertyDescriptor(OffscreenCanvas.prototype, "style")) {
    Object.defineProperty(OffscreenCanvas.prototype, "style", {
      get() {
        if (!this._style) {
          this._style = createStyleProxy(this.width || 1920, this.height || 1080);
        }
        return this._style;
      },
      set(val) {
        this._style = val;
      },
      configurable: true,
      enumerable: true,
    });
  }
  if (!Object.getOwnPropertyDescriptor(OffscreenCanvas.prototype, "classList")) {
    Object.defineProperty(OffscreenCanvas.prototype, "classList", {
      get() {
        if (!this._classList) {
          this._classList = createClassList();
        }
        return this._classList;
      },
      configurable: true,
      enumerable: true,
    });
  }
}

if (typeof self !== "undefined") {
  const g = globalThis as unknown as Record<string, unknown>;

  // Define DOM Constructors globally on worker global scope
  if (typeof g.Element === "undefined") {
    class Element {}
    g.Element = Element;
  }
  if (typeof g.HTMLElement === "undefined") {
    class HTMLElement extends (g.Element as { new (): object }) {}
    g.HTMLElement = HTMLElement;
  }
  if (typeof g.HTMLCanvasElement === "undefined") {
    class HTMLCanvasElement extends (g.HTMLElement as { new (): object }) {}
    g.HTMLCanvasElement = HTMLCanvasElement;
  }
  if (typeof g.Document === "undefined") {
    class Document {}
    g.Document = Document;
  }
  if (typeof g.HTMLDocument === "undefined") {
    class HTMLDocument extends (g.Document as { new (): object }) {}
    g.HTMLDocument = HTMLDocument;
  }
  if (typeof g.Image === "undefined") {
    class Image {}
    g.Image = Image;
  }

  if (typeof g.window === "undefined") {
    g.window = self;
  }

  if (typeof (self as unknown as Record<string, unknown>).getComputedStyle === "undefined") {
    (self as unknown as Record<string, unknown>).getComputedStyle = () =>
      ({
        borderLeftWidth: "0",
        borderTopWidth: "0",
        paddingLeft: "0",
        paddingTop: "0",
      }) as unknown as CSSStyleDeclaration;
  }

  const mockDoc = new (g.HTMLDocument as { new (): object })();
  const docObj = mockDoc as Record<string, unknown>;
  docObj.defaultView = self;
  docObj.createElement = (type: string) => {
    if (type === "canvas" && typeof OffscreenCanvas !== "undefined") {
      const c = new OffscreenCanvas(1, 1);
      makeFabricCompatible(c);
      return c;
    }
    const elemAttrs: Record<string, string> = {};
    return {
      style: createStyleProxy(1, 1),
      hasAttribute: (name: string) => name in elemAttrs,
      setAttribute: (name: string, val: string) => {
        elemAttrs[name] = String(val);
      },
      removeAttribute: (name: string) => {
        delete elemAttrs[name];
      },
      getAttribute: (name: string) => elemAttrs[name] ?? null,
      appendChild: () => {},
      removeChild: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      classList: createClassList(),
      ownerDocument: mockDoc,
    };
  };
  docObj.getElementById = () => null;
  docObj.getElementsByTagName = () => [];
  docObj.childNodes = [];
  docObj.addEventListener = () => {};
  docObj.removeEventListener = () => {};
  docObj.head = { appendChild: () => {} };
  docObj.body = {
    appendChild: () => {},
    style: createStyleProxy(1, 1),
    scrollLeft: 0,
    scrollTop: 0,
  };
  docObj.documentElement = {
    style: createStyleProxy(1, 1),
    clientLeft: 0,
    clientTop: 0,
    scrollLeft: 0,
    scrollTop: 0,
  };
  docObj.implementation = {
    createHTMLDocument: () => mockDoc,
  };

  if (typeof g.document === "undefined") {
    g.document = mockDoc;
  }

  if (typeof g.DOMParser === "undefined") {
    g.DOMParser = class {
      parseFromString() {
        return {
          documentElement: {
            getAttribute: () => null,
            getElementsByTagName: () => [],
          },
        };
      }
    };
  }
}
