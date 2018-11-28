import React, { ReactElement, SFC } from "react";
import renderer from "react-test-renderer";
import {
  createHistory,
  createMemorySource,
  LocationContext,
  Case,
  Switch,
  resolve,
  match
} from ".";

let sleep = (ms: number) =>
  new Promise(resolve => setTimeout(() => resolve(), ms));

let snapshot = ({
  pathname,
  element
}: {
  pathname: string;
  element: ReactElement<any>;
}) => {
  let testHistory = createHistory(createMemorySource(pathname));
  let wrapper = renderer.create(
    <LocationContext.Provider value={testHistory}>
      {element}
    </LocationContext.Provider>
  );
  const tree = wrapper.toJSON();
  expect(tree).toMatchSnapshot();
  return tree;
};

let runWithNavigation = ({
  pathname,
  element
}: {
  pathname: string;
  element: ReactElement<any>;
}) => {
  let history = createHistory(createMemorySource(pathname));
  let wrapper = renderer.create(
    <LocationContext.Provider value={history}>
      {element}
    </LocationContext.Provider>
  );
  const snapshot = () => {
    expect(wrapper.toJSON()).toMatchSnapshot();
  };
  return { history, snapshot, wrapper };
};

let Home: SFC<any> = () => <div>Home</div>;
let Dash: SFC<any> = ({ children }) => <div>Dash {children}</div>;
let Group: SFC<any> = ({ groupId, children }) => (
  <div>
    Group: {groupId}
    {children}
  </div>
);
let PropsPrinter: SFC<any> = props => (
  <pre>{JSON.stringify(props, null, 2)}</pre>
);
let Reports: SFC<any> = ({ children }) => <div>Reports {children}</div>;
let AnnualReport: SFC<any> = () => <div>Annual Report</div>;
let NotFound: SFC<any> = () => <div>404</div>;
let CounterComponentFactory: () => [{ counter: number }, () => null] = () => {
  let ref = { counter: 0 };
  return [
    ref,
    () => {
      ref.counter++;
      return null;
    }
  ];
};

describe("smoke tests", () => {
  it(`renders the root component at "/"`, () => {
    snapshot({
      pathname: "/",
      element: (
        <>
          <Case path="" component={Home} />
          <Case path="dash" component={Dash} />
        </>
      )
    });
  });

  it(`renders the root component at "/" with path="/"`, () => {
    snapshot({
      pathname: "/",
      element: (
        <>
          <Case path="/" component={Home} />
          <Case path="dash" component={Dash} />
        </>
      )
    });
  });

  it("renders at a path", () => {
    snapshot({
      pathname: "/dash",
      element: (
        <>
          <Case path="" component={Home} />
          <Case path="dash" component={Dash} />
        </>
      )
    });
  });
});

describe("Switch", () => {
  it("ignores falsey chidlren", () => {
    snapshot({
      pathname: "/",
      element: (
        <Switch>
          <Case path="" component={Home} />
          {null}
        </Switch>
      )
    });
  });

  it("render only one", () => {
    snapshot({
      pathname: "/",
      element: (
        <Switch>
          <Case path="" component={Home} />
          <Case path="" component={Dash} />
        </Switch>
      )
    });
  });

  it("render first match", () => {
    snapshot({
      pathname: "/tag",
      element: (
        <Switch>
          <Case path="/" component={Home} />
          <Case path="tag" component={Dash} />
        </Switch>
      )
    });
  });

  it("render what is not a Case", () => {
    snapshot({
      pathname: "/tag",
      element: (
        <Switch>
          <Home />
          <Case path="tag" component={Dash} />
        </Switch>
      )
    });
  });

  it("renders null if no match and no fallback", () => {
    snapshot({
      pathname: "/404",
      element: (
        <Switch>
          <Case path="dash" component={Dash} />
        </Switch>
      )
    });
  });

  it("renders fallback if no match", () => {
    let [ref, CounterComponent] = CounterComponentFactory();
    snapshot({
      pathname: "/404",
      element: (
        <Switch fallback={NotFound}>
          <Case path="dash" component={Dash} />
          <CounterComponent />
        </Switch>
      )
    });

    expect(ref.counter).toBe(0);
  });

  it("renders fallback on nested switch with no match", async () => {
    let [ref, CounterComponent] = CounterComponentFactory();
    let [innerRef, InnerCounterComponent] = CounterComponentFactory();
    const tree = runWithNavigation({
      pathname: "/home/404",
      element: (
        <Switch fallback={NotFound}>
          <Case path="home">
            <span>Home</span>
            <CounterComponent />
            <Switch>
              <Case path="tag" component={Dash} />
              <Case path="tag2" component={Home} />
              <InnerCounterComponent />
            </Switch>
          </Case>
        </Switch>
      )
    });
    await sleep(10);
    expect(ref.counter).toBe(1);
    expect(innerRef.counter).toBe(0);
    tree.snapshot();
    tree.history.navigate("/404");
    await sleep(10);
    tree.snapshot();
    expect(ref.counter).toBe(1);
    expect(innerRef.counter).toBe(0);
  });

  it("renders fallback on nested switch with no match, then renders on match", async () => {
    let [ref, CounterComponent] = CounterComponentFactory();
    let [innerRef, InnerCounterComponent] = CounterComponentFactory();
    const tree = runWithNavigation({
      pathname: "/home/404",
      element: (
        <Switch fallback={NotFound}>
          <Case path="home">
            <span>Home</span>
            <CounterComponent />
            <Switch>
              <Case path="tag" component={Dash} />
              <Case path="tag2" component={Home} />
              <InnerCounterComponent />
            </Switch>
          </Case>
        </Switch>
      )
    });
    await sleep(10);
    expect(ref.counter).toBe(1);
    expect(innerRef.counter).toBe(0);
    tree.snapshot();
    tree.history.navigate("/home/tag");
    await sleep(10);
    tree.snapshot();
    expect(ref.counter).toBe(1);
    expect(innerRef.counter).toBe(1);
  });
});

describe("Case", () => {
  it("renders multiple matches", () => {
    snapshot({
      pathname: "/home/dash",
      element: (
        <Case path="home">
          <Home />
          <Case path="dash">
            <Dash />
          </Case>
        </Case>
      )
    });
  });

  it("renders only if exact match", () => {
    snapshot({
      pathname: "/home/dash",
      element: (
        <Case exact path="home">
          <Home />
          <Case path="dash">
            <Dash />
          </Case>
        </Case>
      )
    });
  });
});

describe("Passed props", () => {
  it("parses dynamic segments and passes to components", () => {
    snapshot({
      pathname: "/123",
      element: <Case path=":groupId" component={Group} />
    });
  });
});

describe("resolve", () => {
  it("empty string as root", () => {
    expect(resolve("", "/")).toBe("/");
  });

  it("root as root", () => {
    expect(resolve("/", "/")).toBe("/");
  });

  it("string from root", () => {
    expect(resolve("user", "/")).toBe("/user");
  });

  it("string from any base", () => {
    expect(resolve("user", "/home")).toBe("/home/user");
  });

  it("root from any base", () => {
    expect(resolve("/", "/home")).toBe("/");
  });
});

describe("match", () => {
  it("should match", () => {
    expect(match("/", "/")).toEqual({});
    expect(match("", "")).toEqual({});
    expect(match("", "/")).toEqual({});
    expect(match("/::id", "/123")).toEqual({ id: 123 });
    expect(match("/:user", "/jean")).toEqual({ user: "jean" });
    expect(match("/user/:user/*", "/user/jean/bla/bla")).toEqual({
      "*": "bla/bla",
      user: "jean"
    });
  });

  it("should not match", () => {
    expect(match("/group", "/")).toBe(null);
    expect(match("/user/jean/*", "/user/jea/blabla")).toBe(null);
  });
});
