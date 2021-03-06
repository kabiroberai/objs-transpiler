# objs-transpiler

The syntax transpiler for the [ObjectiveScript](https://objs.dev) programming language.

## Usage

### Setup

Include `ob.js` in your environment. This might, for example, entail using `<script src>`, `require()`, or `-[JSContext evaluateScript:]`.

### API

```ts
OBJSTranspiler.transpile(source: string, minify: boolean = false): { code: string; map: string; }
```

**Parameters**:

- `source`: The input source code written in ObjectiveScript
- `minify`: A flag which determines whether to minify the output

**Returns**:

- `code`: The generated JavaScript code, compatible with the ObjectiveScript runtime
- `map`: A [source map](https://github.com/mozilla/source-map) representing the entire transformation

```ts
OBJSTranspiler.tokenize(source: string): Iterable<acorn.Token>
```

**Parameters**:

- `source`: The input source code written in ObjectiveScript

**Returns**: An `Iterable` of tokens

## Development

Start by running `npm install` to set up the dependencies.

### Iteration

Run `npm run driver` to see the output of transpiling `test/app.objs` without having to compile the full `ob.js` file.

**Note**: At present, the `minify` parameter cannot be used during iteration because that involves building `uglify.js` which is an artifact created while performing a full build.

### Full Build

Use `npm run build` to perform a full build. The output will be the `ob.js` file at the root level of the repository.

### Tests

Execute `npm test` to run the test suite. 

**Note**: Test coverage is currently low, so the results are not a very strong indicator of regressions.

### Cleaning

Execute `npm run clean`.
