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
      return target[prop];
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
  if (!c.getAttribute) {
    const attrs: Record<string, string> = {};
    c.getAttribute = (name: string) => attrs[name] ?? (name === "dir" ? "ltr" : null);
    c.setAttribute = (name: string, val: string) => {
      attrs[name] = String(val);
    };
    c.removeAttribute = (name: string) => {
      delete attrs[name];
    };
  }
  if (!c.getBoundingClientRect) {
    c.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: canvas.width,
      height: canvas.height,
    });
  }
  return canvas;
}

// Polyfill OffscreenCanvas.prototype so any instance created has DOM methods
if (typeof OffscreenCanvas !== "undefined") {
  const proto = OffscreenCanvas.prototype as unknown as Record<string, unknown>;
  if (!proto.getAttribute) {
    proto.getAttribute = function (name: string) {
      const attrs = (this as Record<string, unknown>)._attrs as Record<string, string> | undefined;
      return attrs?.[name] ?? (name === "dir" ? "ltr" : null);
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
  }
  if (!proto.getBoundingClientRect) {
    proto.getBoundingClientRect = function () {
      return {
        left: 0,
        top: 0,
        width: (this as OffscreenCanvas).width,
        height: (this as OffscreenCanvas).height,
      };
    };
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

  const mockDoc = new (g.HTMLDocument as { new (): object })();
  const docObj = mockDoc as Record<string, unknown>;
  docObj.createElement = (type: string) => {
    if (type === "canvas" && typeof OffscreenCanvas !== "undefined") {
      const c = new OffscreenCanvas(1, 1);
      makeFabricCompatible(c);
      return c;
    }
    return {
      style: createStyleProxy(1, 1),
      setAttribute: () => {},
      removeAttribute: () => {},
      getAttribute: () => null,
      appendChild: () => {},
      removeChild: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      classList: createClassList(),
    };
  };
  docObj.getElementById = () => null;
  docObj.getElementsByTagName = () => [];
  docObj.childNodes = [];
  docObj.addEventListener = () => {};
  docObj.removeEventListener = () => {};
  docObj.head = { appendChild: () => {} };
  docObj.body = { appendChild: () => {} };
  docObj.documentElement = { style: createStyleProxy(1, 1) };
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
