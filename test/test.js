const transpile = require('../ob.js');
const fs = require('fs');
const assert = require('assert');

// // Run `script` with `ctx` as the global var
// function run(script, ctx) {
// 	with (ctx) eval(script);
// }

// // TODO: Add tests for errors

function describeCode(message, code, execute) {
	describe(message, function() {
		before(function() {
			this.code = transpile(code);
		});

		execute();
	});
}

describe("OBJSTranspiler", function() {
	describe("JXMethodCall", function() {
		describe("without arguments", function() {
			it("should compile simple cases correctly", function() {
				let code = transpile("[NSDate date]");
				assert.equal(code, 'NSDate["@date"]()');
			});
			it("should allow JS keywords to be used as selectors", function() {
				let code = transpile("[NSArray new]");
				assert.equal(code, 'NSArray["@new"]()');
			});
			it("should work with super calls", function() {
				let code = transpile("[super init]");
				assert.equal(code, 'self["^init"]()');
			});
			it("should allow expressions to be used as targets", function() {
				let code = transpile('[foo+bar baz]');
				assert.equal(code, '(foo + bar)["@baz"]()');
			});
			it("should allow other method calls to be used as targets", function() {
				let code = transpile("[[NSArray alloc] init]");
				assert.equal(code, 'NSArray["@alloc"]()["@init"]()');
			});
		});
		describe("with arguments", function() {
			it("should compile simple single-argument cases correctly", function() {
				let code = transpile('[UIImage imageNamed:"Foo"]');
				assert.equal(code, 'UIImage["@imageNamed:"]("Foo")');
			});
			it("should compile simple multi-argument cases correctly", function() {
				let code = transpile('[Foo fooWithBar:"a" baz:"b"]');
				assert.equal(code, 'Foo["@fooWithBar:baz:"]("a", "b")');
			});
			it("should work with super calls", function() {
				let code = transpile('[super initWithBar:"a" baz:"b"]');
				assert.equal(code, 'self["^initWithBar:baz:"]("a", "b")');
			});
			it("should allow expressions to be used as arguments", function() {
				let code = transpile('[Foo fooWithBar:"a"+"b" baz:"c"]');
				assert.equal(code, 'Foo["@fooWithBar:baz:"]("a"+"b", "c")');
			})
			it("should allow other method calls to be used as arguments", function() {
				let code = transpile('[Foo fooWithBar:[Bar new] baz:[Baz bazWithArg:0]]');
				assert.equal(code, 'Foo["@fooWithBar:baz:"](Bar["@new"](), Baz["@bazWithArg:"](0))');
			})
		});
		describe("array handling", function() {
			function assertPassthrough(code) {
				assert.equal(transpile(code), code);
			}
			it("should not detect arrays as method calls", function() {
				assertPassthrough('[foo, bar]');
			});
			it("should allow trailing commas in arrays", function() {
				assertPassthrough('[foo,]');
			});
			it("should allow single-element arrays", function() {
				assertPassthrough('[foo]');
			});
			it("should allow empty arrays", function() {
				assertPassthrough('[]');
			});
			it("should allow subscripts", function() {
				assertPassthrough('[foo, bar][0]');
			});
			it("should allow method calls to be nested in arrays", function() {
				let code = transpile('[foo, [Bar baz]]');
				assert.equal(code, '[foo, Bar["@baz"]()]');
			});
			it("should allow arrays to be nested in method calls", function() {
				let code = transpile('[Foo fooWithBar:[baz]]');
				assert.equal(code, 'Foo["@fooWithBar:"]([baz])');
			});
		});
	});
});

// describe('OBJSTranspiler', function() {

// 	// describe('msgSend', function() {
// 	// 	describeCode('without args', '$[foo bar];', [
// 	// 		{
// 	// 			it: 'should have the right target',
// 	// 			foo: 1,
// 	// 			msgSend: function (target, sel, ...args) {
// 	// 				assert.equal(target, 1);
// 	// 			}
// 	// 		},
// 	// 		{
// 	// 			it: 'should have the right selector',
// 	// 			foo: 1,
// 	// 			msgSend: function (target, sel, ...args) {
// 	// 				assert.equal(sel, 'bar');
// 	// 			}
// 	// 		},
// 	// 		{
// 	// 			it: 'should have no args',
// 	// 			foo: 1,
// 	// 			msgSend: function (target, sel, ...args) {
// 	// 				assert.equal(args.length, 0);
// 	// 			}
// 	// 		}
// 	// 	]);

// 	// 	describeCode('with args', '$[foo barWithA:10 b:"hello"];', [
// 	// 		{
// 	// 			it: 'should have the right target',
// 	// 			foo: 1,
// 	// 			msgSend: function (target, sel, ...args) {
// 	// 				assert.equal(target, 1);
// 	// 			}
// 	// 		},
// 	// 		{
// 	// 			it: 'should have the right selector',
// 	// 			foo: 1,
// 	// 			msgSend: function (target, sel, ...args) {
// 	// 				assert.equal(sel, 'barWithA:b:');
// 	// 			}
// 	// 		},
// 	// 		{
// 	// 			it: 'should have the right args',
// 	// 			foo: 1,
// 	// 			msgSend: function (target, sel, ...args) {
// 	// 				assert.equal(args[0], 10);
// 	// 				assert.equal(args[1], "hello");
// 	// 			}
// 	// 		}
// 	// 	]);

// 	// 	describeCode('with an expression target', '$["hello"+foo bar];', [
// 	// 		{
// 	// 			it: 'should have the right target',
// 	// 			foo: "!",
// 	// 			msgSend: function (target, sel, ...args) {
// 	// 				assert.equal(target, 'hello!');
// 	// 			}
// 	// 		}
// 	// 	]);

// 	// 	describeCode('with an expression argument', '$[foo barWithA:b+c];', [
// 	// 		{
// 	// 			it: 'should have one, correct arg',
// 	// 			foo: 1,
// 	// 			b: 5,
// 	// 			c: 6,
// 	// 			msgSend: function (target, sel, ...args) {
// 	// 				assert.equal(args.length, 1, "args.length != 1");
// 	// 				assert.equal(args[0], 11, "args[0] != 11");
// 	// 			}
// 	// 		}
// 	// 	]);

// 	// 	describeCode('with new as a target', '$[Foo new]', [
// 	// 		{
// 	// 			it: 'should have its selector set to `new`',
// 	// 			Foo: 1,
// 	// 			msgSend: function (target, sel, ...args) {
// 	// 				assert.equal(sel, 'new');
// 	// 			}
// 	// 		}
// 	// 	]);

// 	// 	// TODO: Add tests for super
// 	// });

// 	// describe('associatedObject', function() {
// 	// 	describeCode('getter', '$(_foo);', [
// 	// 		{
// 	// 			it: 'should have self as its target',
// 	// 			self: 10,
// 	// 			associatedObject: function (target, name, val) {
// 	// 				assert.equal(target, 10);
// 	// 			}
// 	// 		},
// 	// 		{
// 	// 			it: 'should have the right name',
// 	// 			self: 10,
// 	// 			associatedObject: function (target, name, val) {
// 	// 				assert.equal(name, '_foo');
// 	// 			}
// 	// 		}
// 	// 	]);

// 	// 	describeCode('setter', '$(_foo) = 30', [
// 	// 		{
// 	// 			it: 'should have the right value',
// 	// 			self: 10,
// 	// 			associatedObject: function (target, name, val) {
// 	// 				assert.equal(val, 30);
// 	// 			}
// 	// 		}
// 	// 	]);
// 	// });

// 	describe('$orig', function() {
// 		describeCode('with default args', '$orig()', [
// 			{
// 				it: 'should have the right arguments',
// 				arguments: ["a", "b", "c"],
// 				orig: function (args) {
// 					assert.equal(args.length, 3);
// 					assert.equal(args[0], "a");
// 					assert.equal(args[1], "b");
// 					assert.equal(args[2], "c");
// 				}
// 			}
// 		]);

// 		describeCode('with custom args', '$orig(a, b)', [
// 			{
// 				it: 'should have the right arguments',
// 				a: "x",
// 				b: "y",
// 				orig: function (args) {
// 					assert.equal(args.length, 2);
// 					assert.equal(args[0], "x");
// 					assert.equal(args[1], "y");
// 				}
// 			}
// 		]);
// 	});
	
// 	// TODO: Add tests
	
// 	describe('$class', function() {
		
// 	});

// 	describe('$class hook', function() {
// 		// remember to add tests for names with '.' in them (Swift), and unicode names too
// 	});

// 	describe('Test file', function() {
// 		it('should compile', function(done) {
// 			fs.readFile('test/app.objs', function (err, file) {
// 				if (err) done(err);
// 				const transpiled = transpile(file);
// 				console.log(transpiled);
// 				done();
// 			});
// 		});
// 	});

// });
