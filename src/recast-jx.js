// modifies OBJS AST to regular JS

const recast = require("recast");
const b = recast.types.builders;
require("./types-jx.js")();

function makeBoxExpression(object) {
	return b.callExpression(b.identifier("box"), [object]);
}

function makeTraversalFunction(traversalFunction) {
	return function(path) {
		this.traverse(path);
		return traversalFunction(path.node);
	};
}

module.exports = function(ast) {
	recast.visit(ast, {
		visitJXMethodCall: makeTraversalFunction(function(methodCall) {
			let target;
			let selector;
			if (methodCall.target === null) {
				target = b.identifier("self");
				selector = "^" + methodCall.selector;
			} else {
				target = methodCall.target;
				selector = "@" + methodCall.selector;
			}
			const selExpr = b.memberExpression(target, b.literal(selector), true);
			const selCall = b.callExpression(selExpr, methodCall.args);
			return selCall;
		}),

		visitJXBox: makeTraversalFunction(function(box) {
			return makeBoxExpression(box.value);
		}),

		visitJXLiteral: makeTraversalFunction(function(literal) {
			return makeBoxExpression(literal.value);
		}),

		visitJXOrigCall: makeTraversalFunction(function(call) {
			let args;
			if (call.passAll) {
				args = [b.identifier("arguments")];
			} else {
				args = [b.arrayExpression(call.values)];
			}
			return b.callExpression(b.identifier("orig"), args);
		}),

		visitJXClass: makeTraversalFunction(function(cls) {
			return b.expressionStatement(b.callExpression(b.identifier("defineClass"), [
				b.literal(cls.className),
				b.literal(cls.superclassName),
				b.arrayExpression(cls.protocols.map(p => b.literal(p))),
				b.objectExpression(cls.ivars.map(p => b.property("init", b.literal(p.name), b.literal(p.encoding)))),
				b.objectExpression(cls.methods),
			]));
		}),

		visitJXHook: makeTraversalFunction(function(hook) {
			return b.expressionStatement(b.callExpression(b.identifier("hookClass"), [
				b.literal(hook.className),
				b.objectExpression([]),
				b.objectExpression(hook.methods)
			]));
		}),

		visitJXMethod: makeTraversalFunction(function(method) {
			// @ and : are for id self and SEL _cmd, the "hidden" arguments in an objc method
			const sig = `${method.returnType.encoding}@:${method.argTypes.map(t => t.encoding).join("")}`;
			const key = `${sig}${method.isClassMethod ? "+" : "-"}${method.selector}`;
			return b.property("init", b.literal(key), b.functionExpression(null, method.params, method.body));
		}),

		visitJXBlock: makeTraversalFunction(function(block) {
			let retEncoding;
			if (block.returnType === null) {
				retEncoding = "v";
			} else {
				retEncoding = block.returnType.encoding;
			}
			// @? represents the block
			const sig = `${retEncoding}@?${block.argTypes.map(t => t.encoding).join("")}`;
			return b.callExpression(b.identifier("defineBlock"), [
				b.literal(sig),
				b.functionExpression(null, block.argTypes.map(t => b.identifier(t.name)), block.body)
			]);
		}),

		visitJXFuncDef: makeTraversalFunction(function(def) {
			let sig = def.returnType.encoding;
			sig += def.argTypes.map(t => t.encoding).join("");

			return b.expressionStatement(b.callExpression(b.identifier("loadFunc"), [
				b.literal(def.returnType.name),
				b.literal(sig),
				b.literal(true)
			]));
		}),

		visitJXExternDef: makeTraversalFunction(function(def) {
			return b.expressionStatement(b.callExpression(b.identifier("loadSymbol"), [
				b.literal(def.value.name),
				b.literal(def.value.encoding),
				b.literal(true)
			]))
		}),

		visitJXDeref: makeTraversalFunction(function(deref) {
			return b.memberExpression(deref.argument, b.identifier("pointee"))
		}),

		visitJXRef: makeTraversalFunction(function(ref) {
			return b.callExpression(b.identifier("getRef"), [b.literal(ref.value)]);
		}),

		visitJXStructDef: makeTraversalFunction(function(def) {
			return b.expressionStatement(b.callExpression(b.identifier("defineStruct"), [
				b.literal(def.name),
				b.literal(def.encoding)
			]));
		}),

		visitJXSizeof: makeTraversalFunction(function(expr) {
			return b.callExpression(b.identifier("sizeof"), [b.literal(expr.jxType.encoding)]);
		}),

		visitJXEncode: makeTraversalFunction(function(expr) {
			return b.literal(expr.jxType.encoding);
		}),

		visitJXCast: makeTraversalFunction(function(cast) {
			return b.callExpression(b.identifier("cast"), [
				b.literal(cast.jxType.encoding),
				cast.value
			]);
		}),
	});
};
