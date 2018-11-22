import React, {
  useState,
  ReactNode,
  ComponentType,
  ReactChild,
  ReactElement,
  AnchorHTMLAttributes
} from "react";

/**
 *
 * History (from reach router)
 *
 */
type Source = any;
type State = {};
type Action = "POP" | "PUSH";
type ListenerCallback = (arg: { location: Location; action: Action }) => void;
type NavigateOptions = { state?: State; replace?: boolean };
type History = {
  listen: (listener: ListenerCallback) => () => any;
  readonly location: Location;
  navigate: (to: string, options?: NavigateOptions) => null;
};

const assign = Object.assign;
const createElement = React.createElement;
/** @jsx createElement */
const useContext = React.useContext;
const useEffect = React.useEffect;
const createContext = React.createContext;

let getLocation = ({ location, history: { state } }: Source): Location => {
  return assign({}, location, {
    state,
    key: (state && state.key) || "initial"
  });
};

let createHistory = (source: Source): History => {
  let listeners: ListenerCallback[] = [];
  let location = getLocation(source);

  return {
    get location() {
      return location;
    },
    listen(listener: ListenerCallback) {
      listeners.push(listener);

      let popstateListener = () => {
        location = getLocation(source);
        listener({ location, action: "POP" });
      };

      source.addEventListener("popstate", popstateListener);

      return () => {
        source.removeEventListener("popstate", popstateListener);
        listeners = listeners.filter(fn => fn !== listener);
      };
    },

    navigate(to: string, { state, replace = false }: NavigateOptions = {}) {
      state = assign({}, state, { key: Date.now() + "" });

      // try...catch iOS Safari limits to 100 pushState calls
      try {
        if (replace) {
          source.history.replaceState(state, null, to);
        } else {
          source.history.pushState(state, null, to);
        }
      } catch (e) {
        source.location[replace ? "replace" : "assign"](to);
      }

      location = getLocation(source);
      listeners.forEach(listener => listener({ location, action: "PUSH" }));
      return null;
    }
  };
};

////////////////////////////////////////////////////////////////////////////////
// Stores history entries in memory for testing or other platforms like Native
let createMemorySource: (initial?: string) => Source;
if (process.env.NODE_ENV !== "production") {
  createMemorySource = (initialPathname = "/") => {
    let index = 0;
    let stack = [{ pathname: initialPathname, search: "" }];
    let states: {}[] = [];

    return {
      get location() {
        return stack[index];
      },
      addEventListener(name: any, fn: any) {},
      removeEventListener(name: any, fn: any) {},
      history: {
        get entries() {
          return stack;
        },
        get index() {
          return index;
        },
        get state() {
          return states[index];
        },
        pushState(state: State, _: any, uri: string) {
          let [pathname, search = ""] = uri.split("?");
          index++;
          stack.push({ pathname, search });
          states.push(state);
        },
        replaceState(state: State, _: any, uri: string) {
          let [pathname, search = ""] = uri.split("?");
          stack[index] = { pathname, search };
          states[index] = state;
        }
      }
    };
  };
}

////////////////////////////////////////////////////////////////////////////////
// global history - uses window.history as the source if available, otherwise a
// memory history
let getSource = () => {
  return !!(
    typeof window !== "undefined" &&
    window.document &&
    window.document.createElement
  )
    ? window
    : createMemorySource();
};

let globalHistory: History;
if (process.env.NODE_ENV !== "production") {
  globalHistory = createHistory(getSource());
} else {
  globalHistory = createHistory(window);
}

/**
 *
 * Utils
 *
 */

function startsWith(string: string, search: string) {
  return string.substr(0, search.length) === search;
}

function segmentize(uri: string) {
  return (
    uri
      // strip starting/ending slashes
      .replace(/(^\/+|\/+$)/g, "")
      .split("/")
  );
}

const addQuery = (pathname: string, query: string) =>
  pathname + (query ? `?${query}` : "");

function resolve(to: string, base: string) {
  // /foo/bar, /baz/qux => /foo/bar
  if (startsWith(to, "/")) {
    return to;
  }

  let [toPathname, toQuery] = to.split("?");
  let [basePathname] = base.split("?");

  let toSegments = segmentize(toPathname);
  let baseSegments = segmentize(basePathname);

  // ?a=b, /users?b=c => /users?a=b
  if (toSegments[0] === "") {
    return addQuery(basePathname, toQuery);
  }

  // profile, /users/789 => /users/789/profile
  if (!startsWith(toSegments[0], ".")) {
    let pathname = baseSegments.concat(toSegments).join("/");
    return addQuery((basePathname === "/" ? "" : "/") + pathname, toQuery);
  }

  // ./         /users/123  =>  /users/123
  // ../        /users/123  =>  /users
  // ../..      /users/123  =>  /
  // ../../one  /a/b/c/d    =>  /a/b/one
  // .././one   /a/b/c/d    =>  /a/b/c/one
  let allSegments = baseSegments.concat(toSegments);
  let segments = [];
  for (let i = 0, l = allSegments.length; i < l; i++) {
    let segment = allSegments[i];
    if (segment === "..") segments.pop();
    else if (segment !== ".") segments.push(segment);
  }

  return addQuery("/" + segments.join("/"), toQuery);
}

const shouldNavigate = (event: React.MouseEvent<HTMLAnchorElement>) =>
  !event.defaultPrevented &&
  event.button === 0 &&
  !(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey);

/**
 *
 * Components
 *
 */

type CasePropsBase<T extends string, V> = {
  children?: ReactNode;
  component?: ComponentType<any>;
  as?: T;
  basePath?: string;
  path: string;
  exact?: true;
};

type CasePropsPath<T extends string> = CasePropsBase<T, string> & {};

type CasePropsAnyText<T extends string> = CasePropsBase<T, string> & {
  anyText: true;
};

type CasePropsAnyNumber<T extends string> = CasePropsBase<T, number> & {
  anyNumber: true;
};

type CaseProps<T extends string> =
  | CasePropsPath<T>
  | CasePropsAnyText<T>
  | CasePropsAnyNumber<T>;

type RouterContext = {
  basePath: string;
  params: {
    [key: string]: string | number;
  };
  setFallback: (b: boolean) => void;
};

const RouterContext = createContext<RouterContext>({
  basePath: "/",
  params: {},
  setFallback: () => {}
});

const LocationContext = createContext<History>(globalHistory);

function useLocation() {
  const history = useContext(LocationContext);
  const [location, setLocation] = useState(history.location);
  useEffect(
    () =>
      history.listen(({ location }: any) => {
        setLocation(location);
      }),
    []
  );
  return history;
}

function useDebug(name: any, arg?: any) {
  if (process.env.NODE_ENV === "development") {
    useEffect(() => {
      console.log("rendering", name, arg);
    });
  }
}

const renderingPrimitive = (
  props: any,
  routerContext: RouterContext,
  matchedChildProps: {
    [key: string]: string | number;
  }
) => {
  const { children, component } = props;
  return (
    <RouterContext.Provider
      value={assign({}, routerContext, {
        basePath: routerContext.basePath + props.path + "/",
        params: assign({}, routerContext.params, matchedChildProps)
      })}
    >
      {children
        ? children instanceof Function
          ? children(matchedChildProps)
          : children
        : component
        ? createElement(component, matchedChildProps)
        : null}
    </RouterContext.Provider>
  );
};

const paramRe = /^:(:?)(.+)/;

function match(route: string, uri: string) {
  const routeSegments = segmentize(route);
  const uriSegments = segmentize(uri);
  const params: { [key: string]: string | number } = {};
  const isRootUri = uriSegments[0] === "";
  if (routeSegments.length > uriSegments.length) {
    // URI is shorter than the route, no match
    return null;
  }

  for (let index = 0; index < routeSegments.length; index++) {
    const routeSegment = routeSegments[index];
    const uriSegment = uriSegments[index];
    if (routeSegment === "*") {
      params["*"] = uriSegments
        .slice(index)
        .map(decodeURIComponent)
        .join("/");
      return params;
    }

    const dynamicMatch = paramRe.exec(routeSegment);

    if (dynamicMatch && !isRootUri) {
      let value: string | number = decodeURIComponent(uriSegment);
      if (dynamicMatch[1] === ":") {
        // Request a number
        value = Number(value);
        if (isNaN(value)) {
          // and it is not a number
          return null;
        }
      }
      params[dynamicMatch[2]] = value;
    } else if (routeSegment !== uriSegment) {
      return null;
    }
  }
  return params;
}

function Case<T extends string>(props: CaseProps<T>) {
  const {
    location: { pathname }
  } = useLocation();
  const router = useContext(RouterContext);
  useDebug(`Case ${props.toString()} for pathname ${pathname}`);
  const { basePath } = router;
  const uriSuffix = pathname.substr(basePath.length);

  const matchedChildProps = match(props.path, uriSuffix);

  if (matchedChildProps) {
    return renderingPrimitive(props, router, matchedChildProps);
  } else {
    return null;
  }
}

function Switch({
  children,
  fallback
}: {
  children: ReactNode;
  fallback?: ComponentType<any>;
}) {
  const {
    location: { pathname }
  } = useLocation();
  let router = useContext(RouterContext);

  const { basePath } = router;
  const uriSuffix = pathname.substr(basePath.length);

  let matchedChildProps: {
    [key: string]: string | number;
  } | null = null;
  let matchedChild: ReactChild | null = null;
  React.Children.forEach(children, child => {
    if (
      matchedChildProps === null &&
      typeof child === "object" &&
      child &&
      "props" in child &&
      child.props.path !== undefined
    ) {
      // matchedChildProps = matchCase(
      //   child.props,
      //   router.basePath,
      //   location.pathname
      // );
      matchedChildProps = match(child.props.path, uriSuffix);
      if (matchedChildProps !== null) {
        matchedChild = child;
      }
    }
  });

  useDebug(`Switch match`, matchedChildProps);
  const [hasToFallBack, setHasToFallback] = useState(false);

  if (fallback) {
    router = assign({}, router, { setFallback: setHasToFallback });
  }
  if (typeof matchedChild === "object" && matchedChild !== null) {
    const renderedPrimitive = renderingPrimitive(
      (matchedChild as ReactElement<any>).props,
      router,
      matchedChildProps!
    );
    const noDisplay = { display: "none" };
    if (fallback) {
      return (
        <>
          <div style={hasToFallBack ? {} : noDisplay}>
            {createElement(fallback)}
          </div>
          <div style={!hasToFallBack ? {} : noDisplay}>{renderedPrimitive}</div>
        </>
      );
    } else {
      return renderedPrimitive;
    }
  } else {
    if (fallback) {
      return createElement(fallback);
    } else {
      return createElement(FallBackInParentTree);
      // return null;
    }
  }
}

function FallBackInParentTree() {
  const { setFallback } = useContext(RouterContext);
  useEffect(() => {
    setFallback(true);
    return () => setFallback(false);
  }, []);
  return null;
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { to: string };

function Link(props: LinkProps) {
  const { location, navigate } = useLocation();
  const router = useContext(RouterContext);
  useDebug(`Link ${props.to}`);

  let { to, ...anchorProps } = props;
  const href = resolve(to, router.basePath);
  const isCurrent = location.pathname === href;
  const isPartiallyCurrent = startsWith(location.pathname, href);
  return createElement(
    "a",
    assign({}, anchorProps, {
      "aria-current": isCurrent ? "page" : undefined,
      href,
      onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
        if (anchorProps.onClick) anchorProps.onClick(event);
        if (shouldNavigate(event)) {
          event.preventDefault();
          navigate(href);
        }
      }
    })
  );
}

function Redirect({ to }: { to: string }) {
  const { navigate } = useLocation();
  useEffect(() => {
    navigate(to, { replace: true });
  }, []);
  return null;
}

export {
  Case,
  Switch,
  Link,
  Redirect,
  createHistory,
  createMemorySource,
  RouterContext,
  LocationContext,
  resolve,
  match
};
