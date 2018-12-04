import React, {
  useState,
  ReactNode,
  ComponentType,
  ReactChild,
  ReactElement,
  AnchorHTMLAttributes,
  SFC,
  useMemo,
  memo,
  useCallback
} from "react";

/**
 *
 * History (from reach router)
 *
 */
type SourceEventListener = (
  type: "popstate",
  listener: EventListenerOrEventListenerObject
) => void;
type BaseLocation = Pick<
  Location,
  "pathname" | "search" | "assign" | "replace"
>;
type BaseHistory = Pick<History, "replaceState" | "pushState" | "state">;
type Source<T extends BaseLocation, U extends BaseHistory> = {
  location: T;
  history: U;
  addEventListener: SourceEventListener;
  removeEventListener: SourceEventListener;
};
type State = { [key: string]: any };
type Action = "POP" | "PUSH";
type NavigateOptions = { state?: State; replace?: boolean };
type ListenerCallback<T extends BaseLocation> = (
  arg: { location: RouterLocation<T>; action: Action }
) => void;
type RouterLocation<T extends BaseLocation = BaseLocation> = T & {
  state?: State;
  key: string;
};
type RouterHistory<T extends BaseLocation = BaseLocation> = {
  readonly location: RouterLocation<T>;
  listen: (listener: ListenerCallback<T>) => () => any;
  navigate: (to: string, options?: NavigateOptions) => void;
};

const assign = Object.assign;
const createElement = React.createElement;
/** @jsx createElement */
const useContext = React.useContext;
const useEffect = React.useEffect;
const createContext = React.createContext;

let getLocation = <T extends BaseLocation, U extends BaseHistory>({
  location,
  history: { state }
}: Source<T, U>): RouterLocation<T> => {
  return assign({}, location, {
    state,
    key: (state && state.key) || "initial"
  });
};

let createHistory = <T extends BaseLocation, U extends BaseHistory>(
  source: Source<T, U>
): RouterHistory<T> => {
  let listeners: ListenerCallback<T>[] = [];
  let location = getLocation(source);

  return {
    get location() {
      return location;
    },
    listen(listener) {
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

    navigate(to, { state, replace = false }: NavigateOptions = {}) {
      state = assign({}, state, { key: Date.now() + "" });

      // try...catch iOS Safari limits to 100 pushState calls
      try {
        if (replace) {
          source.history.replaceState(state, "", to);
        } else {
          source.history.pushState(state, "", to);
        }
      } catch (e) {
        source.location[replace ? "replace" : "assign"](to);
      }

      location = getLocation(source);
      listeners.forEach(listener => listener({ location, action: "PUSH" }));
    }
  };
};

////////////////////////////////////////////////////////////////////////////////
// Stores history entries in memory for testing or other platforms like Native
let createMemorySource: (initial?: string) => Source<BaseLocation, BaseHistory>;
if (process.env.NODE_ENV !== "production") {
  createMemorySource = (initialPathname = "/") => {
    let index = 0;
    let stack = [{ pathname: initialPathname, search: "" }];
    let states: State[] = [];
    let locationProperties = {
      assign: () => {},
      replace: () => {}
    };

    return {
      get location() {
        return assign({}, stack[index], locationProperties);
      },
      addEventListener() {},
      removeEventListener() {},
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

let globalHistory: RouterHistory<Location | BaseLocation>;
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

type CaseProps = {
  children?: ReactNode;
  component?: ComponentType<any>;
  basePath?: string;
  path: string;
  exact?: true;
};

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

const LocationContext = createContext(globalHistory);

type MapLocation<T> = (location: RouterLocation) => T;
const identity: MapLocation<string> = (location: RouterLocation) =>
  location.pathname;

function useLocation(): [string, RouterHistory];
function useLocation<T>(mapLocation: MapLocation<T>): [T, RouterHistory];
function useLocation<T>(mapLocation?: MapLocation<T>): [T, RouterHistory] {
  const map = mapLocation || ((identity as any) as MapLocation<T>);
  const history = useContext(LocationContext);
  const [locationState, setLocation] = useState(map(history.location));
  useEffect(
    () =>
      history.listen(({ location }) => {
        const newLoc = map(location);
        // if (locationState !== newLoc) setLocation(newLoc);
        setLocation(newLoc);
      }),
    [map]
  );
  return [locationState, history];
}

function useDebug(name: any, arg?: any) {
  if (process.env.NODE_ENV === "development") {
    useEffect(() => {
      console.log("rendering", name, arg);
    });
  }
}

const renderingPrimitive = (
  props: CaseProps,
  routerContext: RouterContext,
  matchedChildProps: {
    params: { [key: string]: string | number };
    baseuri: string;
  }
) => {
  const { children, component } = props;
  return (
    <RouterContext.Provider
      value={assign({}, routerContext, {
        basePath: routerContext.basePath + matchedChildProps.baseuri + "/",
        params: assign({}, routerContext.params, matchedChildProps.params)
      })}
    >
      {children
        ? children instanceof Function
          ? children(matchedChildProps.params)
          : children
        : component
        ? createElement(component, matchedChildProps.params)
        : null}
    </RouterContext.Provider>
  );
};

const paramRe = /^:(:?)(.+)/;

function match(route: string, uri: string, exact: boolean = false) {
  const routeSegments = segmentize(route);
  const uriSegments = segmentize(uri);
  const params: { [key: string]: string | number } = {};
  const isRootUri = uriSegments[0] === "";
  if (
    routeSegments.length > uriSegments.length ||
    (exact && routeSegments.length !== uriSegments.length)
  ) {
    // URI is shorter than the route, no match
    // Or we want an exact match, so segments lengths should be the same
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
      return {
        params,
        baseuri: uriSegments
          .slice(0, index)
          .map(decodeURIComponent)
          .join("/")
      };
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
  return {
    params,
    baseuri: uriSegments
      .slice(0, routeSegments.length)
      .map(decodeURIComponent)
      .join("/")
  };
}

function renderCaseIfMatch(
  props: CaseProps,
  uri: string,
  router: RouterContext
) {
  // const uriSuffix = uri.substr(router.basePath.length);
  const matchedChildProps = match(props.path, uri, props.exact);
  if (matchedChildProps) {
    return renderingPrimitive(props, router, matchedChildProps);
  } else {
    return null;
  }
}

function isCaseElement(
  element: ReactChild
): element is ReactElement<CaseProps> {
  return (
    element !== null && typeof element === "object" && element.type === Case
  );
}

const Case = memo((props: CaseProps) => {
  const router = useContext(RouterContext);
  const mapLocation = useCallback(
    (loc: RouterLocation) => loc.pathname.substr(router.basePath.length),
    [router.basePath.length]
  );
  const [uriSuffix] = useLocation(mapLocation);
  useDebug(`Case ${props.toString()} for pathname ${uriSuffix}`);
  return useMemo(() => renderCaseIfMatch(props, uriSuffix, router), [
    uriSuffix,
    router,
    ...Object.values(props)
  ]);
});

const Switch: SFC<{
  children: any;
  fallback?: ComponentType<any>;
}> = memo(({ children, fallback }) => {
  let router = useContext(RouterContext);
  const mapLocation = useCallback(
    (loc: RouterLocation) => loc.pathname.substr(router.basePath.length),
    [router.basePath.length]
  );
  const [uriSuffix] = useLocation(mapLocation);
  const [hasToFallBack, setHasToFallback] = useState(false);

  const noDisplay = { display: "none" };

  if (fallback) {
    router = assign({}, router, { setFallback: setHasToFallback });
  }

  let matched = false;

  const mappedChildren = React.Children.map(children, child => {
    if (!isCaseElement(child)) {
      return child;
    } else if (!matched) {
      const ret = renderCaseIfMatch(child.props, uriSuffix, router);
      if (ret !== null) matched = true;
      return ret;
    } else {
      return null;
    }
  });

  if (matched) {
    if (fallback) {
      return (
        <>
          <div style={hasToFallBack ? undefined : noDisplay}>
            {createElement(fallback)}
          </div>
          <div style={!hasToFallBack ? undefined : noDisplay}>
            {mappedChildren}
          </div>
        </>
      );
    } else {
      return <>{mappedChildren}</>;
    }
  } else if (fallback) {
    return createElement(fallback);
  } else {
    return <FallBackInParentTree />;
  }
});

const FallBackInParentTree = memo(() => {
  const { setFallback } = useContext(RouterContext);
  useEffect(() => {
    setFallback(true);
    return () => setFallback(false);
  }, []);
  return null;
});

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { to: string };

const Link = memo((props: LinkProps) => {
  const [pathname, { navigate }] = useLocation();
  const router = useContext(RouterContext);
  useDebug(`Link ${props.to}`);

  let { to, ...anchorProps } = props;
  const href = resolve(to, router.basePath);
  const isCurrent = pathname === href;
  const isPartiallyCurrent = startsWith(pathname, href);
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
});

function Redirect({ to }: { to: string }) {
  const [, { navigate }] = useLocation(() => void 0);
  useEffect(
    () => {
      navigate(to, { replace: true });
    },
    [to]
  );
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
