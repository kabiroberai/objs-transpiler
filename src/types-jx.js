// Definitions for OBJS AST types

const types = require("ast-types");
const Type = types.Type;
const def = Type.def;
const or = Type.or;

module.exports = function() {
	def("JXMethodCall")
		.bases("Expression")
		.field("target", or(def("Expression"), null))
		.field("selector", String)
		.field("args", [def("Expression")])
		.finalize();

	def("JXBox")
		.bases("Expression")
		.field("value", def("Expression"))
		.finalize();

	def("JXLiteral")
		.bases("Literal")
		.field("value", def("Literal"))
		.finalize();

	def("JXOrigCall")
		.bases("Expression")
		.field("passAll", Boolean)
		.field("values", [def("Expression")])
		.finalize();

	def("JXType")
		.bases("Node")
		.field("encoding", String)
		.field("name", String)
		.finalize();

	def("JXBlock")
		.bases("Expression")
		.field("returnType", or(def("JXType"), null), () => null)
		.field("argTypes", [def("JXType")])
        .field("body", def("BlockStatement"))
		.finalize();

	def("JXMethod")
		.bases("Node")
		.field("isClassMethod", Boolean)
		.field("selector", String)
		.field("returnType", def("JXType"))
		.field("argTypes", [def("JXType")])
		.field("params", [def("Pattern")])
        .field("body", def("BlockStatement"))
		.finalize();

	def("JXClass")
		.bases("Node")
		.field("className", String)
		.field("superclassName", String)
		.field("protocols", [String], () => [])
		.field("ivars", [def("JXType")], () => [])
		.field("methods", [def("JXMethod")], () => [])
		.finalize();

	def("JXHook")
		.bases("Node")
		.field("className", String)
		.field("methods", [def("JXMethod")], () => [])
		.finalize();

	def("JXFuncDef")
		.bases("Statement")
		.field("returnType", def("JXType"))
		.field("argTypes", [def("JXType")])
		.finalize();

	def("JXDeref")
		.bases("Expression")
		.field("argument", def("Pattern"))
		.finalize();

	// used at both runtime and compile time
	def("JXStructDef")
		.bases("Statement")
		.field("name", String)
		.field("types", [def("JXType")])
		.finalize();

	def("JXSizeof")
		.bases("Expression")
		.field("jxType", def("JXType"))
		.finalize();

	def("JXEncode")
		.bases("Expression")
		.field("jxType", def("JXType"))
		.finalize();

	def("JXCast")
		.bases("Expression")
		.field("jxCast", def("JXType"))
		.field("value", def("Expression"))
		.finalize();
}
