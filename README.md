Small and efficient declarative routing for React.

Inspired by react-router and reach-router

<p>
  <a href="https://www.npmjs.com/package/@yolajs/router"><img src="https://img.shields.io/npm/v/@yolajs/router.svg?style=flat-square"></a>
  <a href="https://www.npmjs.com/package/@yolajs/router"><img src="https://img.shields.io/npm/dm/@yolajs/router.svg?style=flat-square"></a>
  <a href="https://www.npmjs.com/package/@yolajs/router"><img src="https://img.shields.io/bundlephobia/minzip/@yolajs/router.svg?style=flat-square"></a>
</p>

## Installation

```
npm install --save @yolajs/router
```

## Usage

```
import { Case } from '@yolajs/router'

const App = () => (
  <div>
    <Case path="/" component={Home} />
    <Case path="/tag/:tag" component={Tag} />
    <Case path="/user/::userId" component={UserDetail} />
  </div>
)

const Home = () => <div>Home</div>
const Tag = ({tag}) => <div>Tag is a string: {tag}</div>
const UserDetail = ({userId}) => <div>userId is a Number: {userId}</div>
```

## Documentation
### `<Case />`

