import { 
	unwrap, 
	isIdentifier, isBrackets, isBraces, isParens, isPunctuator, isKeyword, isStringLiteral, 
	fromStringLiteral, fromIdentifier,
	unwrapped, nextClassName, parseType, nextType, fromKeyword
} from 'sweet.js/helpers' for syntax;

// syntax $ = ctx => {
// 	const container = ctx.next().value;

// 	if (!isBrackets(container)) throw new Error('Expected square brackets');
	
// 	const value = ctx.contextify(container);
	
// 	const marker = value.mark();
// 	const id = value.next().value;
// 	value.reset(marker);
// 	let target = value.expand('expr').value;
// 	let msgFunc = #`msgSend`;

// 	const dummy = id; // use id as the lexical context
	
// 	let sel = '';
// 	let args = #``;
// 	let _first = true;
// 	while (true) {
// 		const first = _first;
// 		_first = false;
		
// 		const selPartVal = value.next().value;
// 		const isNewKeyword = isKeyword(selPartVal) && unwrapped(selPartVal) === 'new';
// 		if (selPartVal === null) {
// 			if (first) throw new Error('Expected selector');
// 			break;
// 		} else if (!isIdentifier(selPartVal) && !isNewKeyword) {
// 			throw new Error('Expected selector to be identifier but got ' + JSON.stringify(selPartVal));
// 		}
		
// 		const selPart = unwrapped(selPartVal);
// 		if (selPart === ':') {
// 			selPart = '';
// 		} else {
// 			const colon = value.next().value;
// 			if (unwrapped(colon) !== ':') {
// 				if (first && colon === null) {
// 					sel += selPart;
// 					break;
// 				}
// 				throw new Error('Expected `:`');
// 			}
// 		}
// 		sel += selPart + ':';
		
// 		const next = value.expand('expr').value;
// 		if (next === null) throw new Error('Expected argument');
// 		args = args.concat(#`${next},`);
// 	}
	
// 	const selLiteral = fromStringLiteral(dummy, sel);
// 	return #`${msgFunc}(${target}, ${selLiteral}, ${args})`;
// };

// syntax $ = ctx => {
// 	const val = ctx.next().value;

// 	const testFuncs = [isBrackets, isStringLiteral, isBraces, isParens];
// 	if (testFuncs.find(fn => fn(val))) {
// 		return #`box(${val})`;
// 	} else {
// 		throw new Error('Invalid box value');
// 	}
// };

syntax $orig = ctx => {
	let finalArgs;
	
	const args = ctx.next().value;
	if (!isParens(args)) throw new Error("Expected parentheses after $orig");

	// Use all arguments passed in to method if none specified.
	if (ctx.contextify(args).next().value === null) {
		finalArgs = #`arguments`;
	} else {
		// Otherwise use the args passed to $orig
		let argList = #``;
		const argsCtx = ctx.contextify(args);
		while (true) {
			const marker = argsCtx.mark();
			const token = argsCtx.next().value;
			if (isPunctuator(token) && unwrapped(token) === ',') continue;
			argsCtx.reset(marker);
			const val = argsCtx.expand('expr').value;
			if (val === null) break;
			argList = argList.concat(#`${val},`);
		}
		finalArgs = #`[${argList}]`;
	}

	return #`orig(${finalArgs})`;
};

syntax $class = ctx => {
	const dummy = #`x`.get(0);
	const makeStringLiteral = v => fromStringLiteral(dummy, v);
	
	const isHookMarker = ctx.mark();
	const isHookVal = ctx.next().value;
	const isHook = isIdentifier(isHookVal) && unwrapped(isHookVal) === 'hook';
	if (!isHook) ctx.reset(isHookMarker);

	const name = nextClassName(ctx);
	const nameLiteral = makeStringLiteral(name);
	
	let additionalArgs;
	if (isHook) {
		additionalArgs = #``;
	} else {
		const colon = unwrapped(ctx.next().value);
		if (colon !== ":") {
			throw new Error('Class \'' + name + '\' defined without specifying a base class');
		}

		const superclass = nextClassName(ctx);
		const superclassLiteral = makeStringLiteral(superclass);

		let protocols = #``;
		const protoMarker = ctx.mark();
		const bracket = unwrapped(ctx.next().value);
		if (bracket === "<") {
			while (true) {
				const protoName = nextClassName(ctx);
				const delim = unwrapped(ctx.next().value);
				const protoLiteral = makeStringLiteral(protoName);
				protocols = protocols.concat(#`${protoLiteral},`);
				if (delim === ">") break;
			}
		} else {
			ctx.reset(protoMarker);
		}

		additionalArgs = #`${superclassLiteral}, [${protocols}],`;
	}
	
	let associatedObjects = #``;
	const objMarker = ctx.mark();
	const objList = ctx.next().value;
	if (isBraces(objList)) {
		const objCtx = ctx.contextify(objList);
		let typeList = [];
		while (true) {
			const typeVal = objCtx.next().value;
			const type = unwrapped(typeVal);
			if (type === undefined) {
				break;
			} else if (isPunctuator(typeVal) && type === ';' && typeList.length > 1) {
				const objName = typeList.pop();
				const typeName = typeList.join(' ');
				const parsedType = parseType(typeName);
				
				typeList = [];
				
				const objLiteral = makeStringLiteral(objName);
				const typeLiteral = makeStringLiteral(parsedType);
				
				associatedObjects = associatedObjects.concat(#`${objLiteral}: ${typeLiteral},`);
			} else if (isIdentifier(typeVal)) {
				typeList.push(type);
			} else {
				throw new Error("Expected type or identifier");
			}
		}
	} else {
		ctx.reset(objMarker);
	}
	
	let methods = #``;
	// loop through all methods
	while (true) {
		let sig = '';
		let sel = '';
		
		const indicator = unwrapped(ctx.next().value);
		if (indicator === '$end') break;
		else if (indicator === '+' || indicator === '-') sel += indicator;
		else throw new Error('Expected method but found \'' + indicator + '\'');
		
		// return type
		sig += nextType(ctx);
		sig += parseType('id') + parseType('SEL'); // implicit (id)self & (SEL)_cmd args

		let argNames = #``;
		let body;
		
		let idx = 0;
		// loop through sel parts
		while (true) {
			const part = ctx.next().value;
			const unwrappedPart = unwrapped(part);

			if (isPunctuator(part) && unwrappedPart === ':') {
				// no selPart name, just add a colon
			} else if (isBraces(part) && idx !== 0) {
				body = part;
				break;
			} else if (isIdentifier(part)) {
				sel += unwrappedPart;
				const wrappedSep = ctx.next().value;
				const sep = unwrapped(wrappedSep);
				if (sep !== ":") {
					if (idx === 0) {
						body = wrappedSep;
						break;
					}
					throw new Error('Expected \':\'');
				}
			} else {
				throw new Error('Expected method name');
			}

			sel += ":";
			sig += nextType(ctx);
			
			const argName = ctx.next().value;
			if (!isIdentifier(argName)) throw new Error('Expected identifier');
			argNames = argNames.concat(argName);
			idx++;
		}
		
		const sigLiteral = makeStringLiteral(sig + sel);

		if (!isBraces(body)) throw new Error('Expected method body');

		methods = methods.concat(#`${sigLiteral}: function (${argNames}) ${body},`);
	}
	
	const func = isHook ? #`hookClass` : #`defineClass`;
	return #`${func}(${nameLiteral}, ${additionalArgs} {${associatedObjects}}, {${methods}})`;
};

// Recursive walker
syntax OBJS_START = ctx => {
	const dummy = #`x`.get(0);
	const makeStringLiteral = v => fromStringLiteral(dummy, v);

	// parses the contents of ctx recursively.
	// moves ctx forward in place
	// if stopAtTerminator is true then it returns once it hits a ','
	// this is useful for parsing an arguments of a method call (recursion)
	// otherwise, returns once it hits the end of ctx
	function parseCtxRecursively(ctx, stopAtTerminator) {
		let ret = #``;
		// stores whether the last keyword was an identifier
		// let prev = #``;
		for (const val of ctx) {
			if (val == null) break;
			if (stopAtTerminator && isPunctuator(val) && unwrapped(val) === ',') break;

			const prev = ret.get(-1);

			const isMethodCall = isIdentifier(prev) && isParens(val);

			if (!isMethodCall) {
				// this isn't a method call, so append the token to obj and move on
				// (if the token is a block then parse it)
				let parsed;

				// TODO: turn bracket syntax into subscripts as well, rather than making it call msgSend)

				if (isKeyword(val) && unwrapped(val) === 'super') {
					parsed = #`__objsSuper`;
				} else if (isParens(val) || isBraces(val) || isBrackets(val)) {
					const objCtx = ctx.contextify(val);
					const ret = parseCtxRecursively(objCtx);
					     if (isParens  (val)) parsed = #`(${ret})`;
					else if (isBraces  (val)) parsed = #`{${ret}}`;
					else if (isBrackets(val)) parsed = #`[${ret}]`;
				} else {
					parsed = val;
				}
				ret = ret.concat(parsed);
				continue;
			}

			// it _is_ a method call, so parse any swift-like syntax

			let selParts = [];
			let args = #``;

			let methodCtx = ctx.contextify(val);

			let i = 0;
			// loop through the method's tokens
			while (true) {
				const argStart = methodCtx.mark();
				const maybeSelPart = methodCtx.next().value;
				const maybeColon = methodCtx.next().value;

				// if not first iteration of loop, and is swift-style, (i.e. `selPart:expr`)
				if ((i > 0) && isIdentifier(maybeSelPart) && isPunctuator(maybeColon) && unwrapped(maybeColon) === ':') {
					// then set the 'i'th element of selParts to this
					selParts[i] = unwrapped(maybeSelPart);
				} else {
					// otherwise it isn't swift-style so reset to firstMarker to get the entire expression
					methodCtx.reset(argStart);
				}
				const argVal = parseCtxRecursively(methodCtx, true);
				// if this is the end of the braces, exit the loop
				if (!argVal.get(0)) break;
				// if (!(isPunctuator(comma) && unwrapped(comma) === ',')) throw new Error('Expected comma');
				args = args.concat(#`${argVal},`);
				i++;
			}

			// get the callee
			let callee = ret.get(-3);
			const isSuper = isIdentifier(callee) && unwrapped(callee) === '__objsSuper';
			
			// if super, insert ^ before selector
			const prefix = isSuper ? '^' : '';
			// if it's super then change it to self
			if (isSuper) {
				callee = #`self`;
			} else if (!callee) { // if callee is null or undefined make it #``
				callee = #``;
			}

			// if not a swift call
			if (selParts.length === 0 && !isSuper) {
				ret = ret.concat(val);
				continue;
			}

			// combine prefix, the func name, and the other args, into a string literal
			// no need to add a colon after prev because selParts will be ['', 'foo', 'bar']
			// so it gets joined into ':foo:bar'
			// trailing colons are automatically added on the objc side
			const selLiteral = makeStringLiteral(prefix + unwrapped(prev) + selParts.join(':'));
			// foo.barWithA(1, b: 10) => foo["barWithA:b"](1, 10)
			ret = ret.pop().pop().pop().concat(#`${callee}[${selLiteral}](${args})`);
		}
		return ret;
	}

	return parseCtxRecursively(ctx);
};

// since syntax.js is appended to the start of the source code, OBJS_START becomes the first line
OBJS_START
