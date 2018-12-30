// produces AST for OBJS

module.exports = function() {
	return function(Parser) {
		return plugin(Parser);
	};
};

const SCOPE_FUNCTION = 2;
const SCOPE_SUPER = 64;

const acorn = require("acorn");

const tt = acorn.tokTypes;
const TokenType = acorn.TokenType;
const tok = {
	at: new TokenType("jxAt", { startsExpr: true }),
	origCall: new TokenType("jxOrigCall", { startsExpr: true }),
	startClass: new TokenType("jxStartClass"),
	endClass: new TokenType("jxEndClass"),
	startProtoList: new TokenType("jxStartProtoList"),
	endProtoList: new TokenType("jxEndProtoList"),
	startHook: new TokenType("jxStartHook"),
	endHook: new TokenType("jxEndHook"),
	blockStart: new TokenType("jxBlockStart", { startsExpr: true }),
	func: new TokenType("jxFuncDef"),
	variadicType: new TokenType("jxVariadicType"),
	structType: new TokenType("jxStructType"),
	structDef: new TokenType("jxStructDef"),
	deref: new TokenType("jxDeref", { prefix: true, beforeExpr: true, startsExpr: true }),
	ref: new TokenType("jxRef", { prefix: true, startsExpr: true }),
	sizeof: new TokenType("jxSizeof", { startsExpr: true }),
	encode: new TokenType("jxEncode", { startsExpr: true }),
	cast: new TokenType("jxCast"),
	extern: new TokenType("jxExtern"),
};

const TokContext = acorn.TokContext;
const ctx = {
	cls: new TokContext("@class ...", true),
	objcType: new TokContext("jxObjcType", true)
};

const starRegex = new RegExp("[^\s\*]");

tok.startClass.updateContext = function() {
	this.context.push(ctx.cls);
}
tok.endClass.updateContext = function() {
	this.context.pop();
}

function plugin(Parser) {
	return class extends Parser {
		jx_eatTokenWord(word, offset) {
			if (!offset) {
				offset = 0;
			}

			if (this.input.slice(this.pos + offset, this.pos + offset + word.length) === word) {
				this.pos += word.length + offset;
				return true;
			}
			return false;
		}

		parseMaybeUnary(refDestructuringErrors, sawUnary) {
			let isRef = this.type === tok.ref;
			let isDeref = this.type === tok.deref;

			if (isRef || isDeref) {
				const node = this.startNode();
			    node.operator = this.value;
			    node.prefix = true;
			    this.next();

			    if (isRef) {
			    	node.value = this.parseIdent(false).name;
			    } else {
			    	node.argument = this.parseMaybeUnary(null, true);
			    }

			    this.checkExpressionErrors(refDestructuringErrors, true);
			    return this.finishNode(node, isRef ? "JXRef" : "JXDeref");
			}

			return super.parseMaybeUnary(refDestructuringErrors, sawUnary);
		}

		toAssignable(node, isBinding, refDestructuringErrors) {
			if (node.type !== "JXDeref") {
				return super.toAssignable(node, isBinding, refDestructuringErrors);
			}

			return node;
		}

		checkLVal(expr, bindingType, checkClashes) {
			return expr.type === "JXDeref" 
				|| super.checkLVal(expr, bindingType, checkClashes);
		}

		readToken(code) {
			const context = this.curContext();

			if (context === ctx.cls && code === 60) { // <
				++this.pos;
				return this.finishToken(tok.startProtoList);
			}

			if (context === ctx.cls && code === 62) { // >
				++this.pos;
				return this.finishToken(tok.endProtoList);
			}

			// we check code first because comparing the entire string is a slow operation
			if (code === 64) { // @
				if (this.jx_eatTokenWord("@class")) {
					return this.finishToken(tok.startClass);
				}

				if (this.jx_eatTokenWord("@end")) {
					return this.finishToken(tok.endClass);
				}

				if (this.jx_eatTokenWord("@function")) {
					return this.finishToken(tok.func);
				}

				if (this.jx_eatTokenWord("@struct")) {
					return this.finishToken(tok.structDef);
				}

				if (this.jx_eatTokenWord("@sizeof")) {
					return this.finishToken(tok.sizeof);
				}

				if (this.jx_eatTokenWord("@encode")) {
					return this.finishToken(tok.encode);
				}

				if (this.jx_eatTokenWord("@cast")) {
					return this.finishToken(tok.cast);
				}

				if (this.jx_eatTokenWord("@extern")) {
					return this.finishToken(tok.extern);
				}

				++this.pos;
				return this.finishToken(tok.at);
			}

			if (code === 37) { // %
				if (this.jx_eatTokenWord("%hook")) {
					return this.finishToken(tok.startHook);
				}

				if (this.jx_eatTokenWord("%end")) {
					return this.finishToken(tok.endHook);
				}

				if (this.jx_eatTokenWord("%orig")) {
					return this.finishToken(tok.origCall);
				}
			}

			if (this.exprAllowed && code === 94) { // ^
				++this.pos;
				return this.finishToken(tok.blockStart);
			}

			if (code === 46 && this.jx_eatTokenWord("...")) { // .
				return this.finishToken(tok.variadicType, "...");
			}

			if (this.jx_eatTokenWord("struct")) {
				return this.finishToken(tok.structType);
			}

			if (this.exprAllowed && code === 38) { // &
				++this.pos;
				return this.finishToken(tok.ref, "&");
			}

			if (this.exprAllowed && code === 42) { // *
				++this.pos;
				return this.finishToken(tok.deref, "*");
			}

			return super.readToken(code);
		}

		parseExprAtom(refDestructuringErrors) {
			const startPos = this.start, startLoc = this.startLoc;

			if (this.type === tt.bracketL) {
				return this.jx_parseMaybeMethodCall(refDestructuringErrors);
			}

			if (this.eat(tok.at)) {
				if (this.type === tt.parenL) {
					return this.jx_parseBox(startPos, startLoc);
				} else {
					return this.jx_parseLiteral(startPos, startLoc, refDestructuringErrors);
				}
			}

			if (this.type === tok.origCall) {
				return this.jx_parseOrigCall();
			}

			if (this.type === tok.blockStart) {
				return this.jx_parseBlock();
			}

			if (this.type === tok.sizeof) {
				return this.jx_parseSizeof();
			}

			if (this.type === tok.encode) {
				return this.jx_parseEncode();
			}

			if (this.type === tok.cast) {
				return this.jx_parseCast();
			}

			return super.parseExprAtom(refDestructuringErrors);
		}

		parseStatement(context, topLevel, exports) {
			if (this.type === tok.startClass) {
				return this.jx_parseClass();
			}

			if (this.type === tok.startHook) {
				return this.jx_parseHook();
			}

			if (this.type === tok.func) {
				return this.jx_parseFuncDef();
			}

			if (this.type === tok.extern) {
				return this.jx_parseExternDef();
			}

			if (this.type === tok.structDef) {
				return this.jx_parseStructDef();
			}

			return super.parseStatement(context, topLevel, exports);
		}

		jx_parseBasicType(typeArr) {
			let type = typeArr.join(" ");

			const types = {
				"char": "c",
				"int": "i",
				"short": "s",
				// `long` is normally treated as `long long` for some reason, so use `q` instead of `l`
				"long": "q",
				"long long": "q",
				"unsigned char": "C",
				"unsigned int": "I",
				"unsigned short": "S",
				"unsigned long": "Q",
				"unsigned long long": "Q",
				"float": "f",
				"double": "d",
				"BOOL": "B",
				"void": "v",
				"char *": "*",
				"id": "@",
				"Class": "#",
				"SEL": ":",
				"...": "..." // for varargs
				// TODO: Add full support for structs and arrays
			};

			let enc = types[type];
			if (enc === undefined) {
				this.raise(this.pos, `Unknown primitive type '${type}'`);
			}

			return enc;
		}

		jx_parseTypeArr(typeArr) {
			let encoding;

			let lastPart = typeArr[typeArr.length - 1];
			let secondLastPart;
			if (typeArr.length > 1) {
				secondLastPart = typeArr[typeArr.length - 2];
			}

			if (secondLastPart === "char" && lastPart === "*") {
				// string
				return this.jx_parseBasicType(typeArr);
			} else if (lastPart[lastPart.length - 1] === "*") {
				// other type of pointer
				if (lastPart.length === 1) {
					// if it's a single * then remove it and parse the rest
					typeArr.pop();
				} else {
					// if it's more than a single star then remove the last star and parse the rest
					typeArr[typeArr.length - 1] = lastPart.substring(0, lastPart.length - 1);
				}
				return `^${this.jx_parseTypeArr(typeArr)}`;
			} else if (typeof lastPart === "number") {
				const len = typeArr.pop();
				return `[${len}${this.jx_parseTypeArr(typeArr)}]`;
			} else if (lastPart.substring(0, 7) === "struct ") {
				const structName = typeArr.pop().substring(7);
				if (!this.structNodes || !(this.structNodes[structName])) {
					this.raise(this.pos, `Unknown struct type '${structName}'`);
				}
				return this.structNodes[structName].encoding;
			} else {
				return this.jx_parseBasicType(typeArr);
			}
		}

		jx_parseType(hasName, allowVoid, allowVariadic) {
			const node = this.startNode();

			let typeArr = [];
			for (;;) {
				if (this.value) {
					typeArr.push(this.value);
					this.next();
				} else if (this.eat(tt.bracketL)) {
					typeArr.push(this.value);
					this.expect(tt.num);
					this.expect(tt.bracketR);
				} else if (this.eat(tok.structType)) {
					typeArr.push("struct " + this.value);
					this.expect(tt.name);
				} else {
					break;
				}
			}

			if (hasName) {
				node.name = typeArr.pop();
			}

			let enc = this.jx_parseTypeArr(typeArr, hasName, allowVoid, allowVariadic);

			if (enc === "v" && !allowVoid) {
				this.raise(this.pos, "The type 'void' is not allowed here");
			}

			if (enc === "..." && !allowVariadic) {
				this.raise(this.pos, "Variadic args are not allowed here");
			}

			node.encoding = enc;

			return this.finishNode(node, "JXType");
		}

		jx_startTypeAcceptingNode() {
			const node = this.startNode();

			this.next();

			this.expect(tt.parenL);

			node.jxType = this.jx_parseType(false, false);

			this.expect(tt.parenR);

			return node;

			return this.finishNode(node, nodeName);
		}

		jx_parseCast() {
			const node = this.jx_startTypeAcceptingNode();
			node.value = this.parseMaybeAssign();
			return this.finishNode(node, "JXCast");
		}

		jx_parseEncode() {
			const node = this.jx_startTypeAcceptingNode();
			return this.finishNode(node, "JXEncode");
		}

		jx_parseSizeof() {
			const node = this.jx_startTypeAcceptingNode();
			return this.finishNode(node, "JXSizeof");
		}

		jx_parseStructDef() {
			const node = this.startNode();

			this.next();

			node.name = this.value;
			this.expect(tt.name);

			this.expect(tt.braceL);

			node.types = [];

			for (;;) {
				if (this.eat(tt.braceR)) {
					break;
				}

				node.types.push(this.jx_parseType(true, false));
				this.expect(tt.semi);
			}

			node.encoding = `{${node.name}=${node.types.map(t => `"${t.name}"${t.encoding}`).join("")}}`;

			this.finishNode(node, "JXStructDef");

			if (!this.structNodes) {
				this.structNodes = {};
			}
			this.structNodes[node.name] = node;

			return node;
		}

		// called *after* opening parenL. Eats closing parenR
		jx_parseArgTypeList(hasNames, allowVoid, allowVariadic) {
			let argTypes = [];

			for (;;) {
				const argType = this.jx_parseType(hasNames, allowVoid, allowVariadic);
				argTypes.push(argType);
				if (this.eat(tt.parenR)) {
					return argTypes;
				} else {
					this.expect(tt.comma);
				}
			}
		}

		jx_parseExternDef() {
			const node = this.startNode();

			this.next();

			node.value = this.jx_parseType(true, false);

			this.eat(tt.semi);

			return this.finishNode(node, "JXExternDef");
		}

		jx_parseFuncDef() {
			const node = this.startNode();

			this.next();

			node.returnType = this.jx_parseType(true, true);

			this.expect(tt.parenL);
			if (this.eat(tt.parenR)) {
				node.argTypes = [];
			} else {
				node.argTypes = this.jx_parseArgTypeList(false, true, true);
				// if argTypes contains a void type
				if (node.argTypes.find(e => e.encoding === "v") !== undefined) {
					if (node.argTypes.length !== 1) {
						this.raise(this.pos, "'void' must be the first and only parameter if specified");
					}
					node.argTypes = [];
				}
			}

			// semicolon isn't required, but if it's there then eat it
			this.eat(tt.semi);

			return this.finishNode(node, "JXFuncDef");
		}

		jx_parseBlock() {
			const node = this.startNode();

			this.enterScope(SCOPE_FUNCTION);

			this.next(); // eat '^'

			if (this.type !== tt.parenL && this.type !== tt.braceL) {
				// must be the return type
				node.returnType = this.jx_parseType(false, true);
			}

			// params is only here to appease parseFunctionBody
			node.params = [];

			if (this.type !== tt.braceL) {
				this.expect(tt.parenL);
				node.argTypes = this.jx_parseArgTypeList(true);
			} else {
				node.argTypes = [];
			}

			this.parseFunctionBody(node, false);

			return this.finishNode(node, "JXBlock")
		}

		jx_parseMethodDef() {
			const node = this.startNode();

			this.enterScope(SCOPE_FUNCTION);

			node.isClassMethod = this.value === "+";
			this.expect(tt.plusMin);

			this.expect(tt.parenL);
			node.returnType = this.jx_parseType(false, true);
			this.expect(tt.parenR);

			node.selector = "";
			node.argTypes = [];
			node.params = [];

			let isFirstIteration = true;
			while (true) {
				node.selector += this.value;
				this.expect(tt.name);
				if (isFirstIteration) {
					if (this.type === tt.braceL) {
						break;
					}
					isFirstIteration = false;
				}
				node.selector += ":";
				this.expect(tt.colon);
				this.expect(tt.parenL);
				node.argTypes.push(this.jx_parseType(false));
				this.expect(tt.parenR);

				node.params.push(this.parseIdent(false));

				if (this.type === tt.braceL) {
					break;
				}
			}

			this.parseFunctionBody(node, false);

			return this.finishNode(node, "JXMethod");
		}

		// parse class name, allowing dots
		jx_parseClassName() {
			let name = this.value;
			this.expect(tt.name);

			if (this.eat(tt.dot)) {
				name += "." + this.value;
				this.expect(tt.name);
			}

			return name;
		}

		jx_parseClass() {
			const node = this.startNode();

			this.next();

			node.className = this.jx_parseClassName();

			this.expect(tt.colon);

			node.superclassName = this.value;
			this.expect(tt.name);

			if (this.eat(tok.startProtoList)) {
				const protocols = this.parseExprList(tok.endProtoList, false, false);
				if (protocols.length === 0) {
					this.raise(this.pos, "Empty protocol list");
				}
				node.protocols = protocols.map(proto => proto.name);
			}

			if (this.eat(tt.braceL)) {
				let ivars = [];
				while (!this.eat(tt.braceR)) {
					ivars.push(this.jx_parseType(true));
					this.expect(tt.semi);
				}
				node.ivars = ivars;
			}

			node.methods = [];
			while (!this.eat(tok.endClass)) {
				node.methods.push(this.jx_parseMethodDef());
			}

			return this.finishNode(node, "JXClass");
		}

		jx_parseHook() {
			const node = this.startNode();

			this.next();

			node.className = this.jx_parseClassName();

			node.methods = [];
			while (!this.eat(tok.endHook)) {
				node.methods.push(this.jx_parseMethodDef());
			}

			return this.finishNode(node, "JXHook");
		}

		jx_finishOrigCallNode(node, passAll, values) {
			node.passAll = passAll;
			node.values = values;
			return this.finishNode(node, "JXOrigCall");
		}

		jx_finishArrayNode(node, elements) {
			node.elements = elements;
			return this.finishNode(node, "ArrayExpression");
		}

		jx_parseOrigCall() {
			const node = this.startNode();

			this.next();

			if (!this.eat(tt.parenL)) {
				return this.jx_finishOrigCallNode(node, true, null);
			} else {
				const values = this.parseExprList(tt.parenR, true, true);
				return this.jx_finishOrigCallNode(node, false, values);
			}
		}

		jx_parseLiteral(startPos, startLoc, refDestructuringErrors) {
			const node = this.startNodeAt(startPos, startLoc);

			if (this.type === tt.braceL) {
				// object literal
				node.value = this.parseObj();
			} else if (this.type === tt.bracketL) {
				// array literal
				const arrayNode = this.startNode();
				this.next();
				let elements = this.parseExprList(tt.bracketR, true, true, refDestructuringErrors);
				node.value = this.jx_finishArrayNode(arrayNode, elements);
			} else if (this.type === tt.num || this.type === tt.string) {
				// numeric or string literal
				node.value = this.parseLiteral();
			}

			return this.finishNode(node, "JXLiteral");
		}

		jx_parseBox(startPos, startLoc) {
			const node = this.startNodeAt(startPos, startLoc);

			this.expect(tt.parenL);
			node.value = this.parseExpression();
			this.expect(tt.parenR);

			return this.finishNode(node, "JXBox");
		}

		// bracketR might also refer to an array, so this distinguishes between the two
		jx_parseMaybeMethodCall(refDestructuringErrors) {
			const node = this.startNode();

			this.next();

			// if we immediately see a right bracket, then it's an empty array
			if (this.eat(tt.bracketR)) {
				return this.jx_finishArrayNode(node, []);
			}

			// if it isn't an empty array, then whether or not it's a method call or an array,
			// it will definitely have a first element/target, so fetch that.
			let expr;
			// if the token is "super", set the method's target to null
			if (this.type === tt._super) {
				this.next();
				expr = null;
			} else {
				expr = this.parseMaybeAssign();
			}

			// now, if we see a comma or a right bracket, then it's an array
			if (this.eat(tt.comma) || this.type === tt.bracketR) {
				// get the remaining elements of the array and add expr to the start
				let elements = this.parseExprList(tt.bracketR, true, true, refDestructuringErrors);
				elements.unshift(expr);
				return this.jx_finishArrayNode(node, elements);
			}

			// otherwise it's a method call
			return this.jx_parseMethodCall(node, expr);
		}

		jx_parseMethodCall(node, target) {
			node.target = target;
			node.selector = "";
			node.args = [];

			let isFirstIteration = true;
			for (;;) {
				let selPart = this.parseIdent(true);
				node.selector += selPart.name;
				if (isFirstIteration) {
					if (this.eat(tt.bracketR)) {
						break;
					}
					isFirstIteration = false;
				}
				this.expect(tt.colon);
				node.selector += ":";
				node.args.push(this.parseExpression());
				if (this.eat(tt.bracketR)) {
					break;
				}
			}

			return this.finishNode(node, "JXMethodCall");
		}
	};
}
