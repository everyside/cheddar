/**
 * Copyright (c) 2014, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * https://raw.github.com/facebook/regenerator/master/LICENSE file. An
 * additional grant of patent rights can be found in the PATENTS file in
 * the same directory.
 */

!(function(global) {
  "use strict";

  var hasOwn = Object.prototype.hasOwnProperty;
  var undefined; // More compressible than void 0.
  var iteratorSymbol =
    typeof Symbol === "function" && Symbol.iterator || "@@iterator";

  var inModule = typeof module === "object";
  var runtime = global.regeneratorRuntime;
  if (runtime) {
    if (inModule) {
      // If regeneratorRuntime is defined globally and we're in a module,
      // make the exports object identical to regeneratorRuntime.
      module.exports = runtime;
    }
    // Don't bother evaluating the rest of this file if the runtime was
    // already defined globally.
    return;
  }

  // Define the runtime globally (as expected by generated code) as either
  // module.exports (if we're in a module) or a new, empty object.
  runtime = global.regeneratorRuntime = inModule ? module.exports : {};

  function wrap(innerFn, outerFn, self, tryLocsList) {
    // If outerFn provided, then outerFn.prototype instanceof Generator.
    var generator = Object.create((outerFn || Generator).prototype);

    generator._invoke = makeInvokeMethod(
      innerFn, self || null,
      new Context(tryLocsList || [])
    );

    return generator;
  }
  runtime.wrap = wrap;

  // Try/catch helper to minimize deoptimizations. Returns a completion
  // record like context.tryEntries[i].completion. This interface could
  // have been (and was previously) designed to take a closure to be
  // invoked without arguments, but in all the cases we care about we
  // already have an existing method we want to call, so there's no need
  // to create a new function object. We can even get away with assuming
  // the method takes exactly one argument, since that happens to be true
  // in every case, so we don't have to touch the arguments object. The
  // only additional allocation required is the completion record, which
  // has a stable shape and so hopefully should be cheap to allocate.
  function tryCatch(fn, obj, arg) {
    try {
      return { type: "normal", arg: fn.call(obj, arg) };
    } catch (err) {
      return { type: "throw", arg: err };
    }
  }

  var GenStateSuspendedStart = "suspendedStart";
  var GenStateSuspendedYield = "suspendedYield";
  var GenStateExecuting = "executing";
  var GenStateCompleted = "completed";

  // Returning this object from the innerFn has the same effect as
  // breaking out of the dispatch switch statement.
  var ContinueSentinel = {};

  // Dummy constructor functions that we use as the .constructor and
  // .constructor.prototype properties for functions that return Generator
  // objects. For full spec compliance, you may wish to configure your
  // minifier not to mangle the names of these two functions.
  function Generator() {}
  function GeneratorFunction() {}
  function GeneratorFunctionPrototype() {}

  var Gp = GeneratorFunctionPrototype.prototype = Generator.prototype;
  GeneratorFunction.prototype = Gp.constructor = GeneratorFunctionPrototype;
  GeneratorFunctionPrototype.constructor = GeneratorFunction;
  GeneratorFunction.displayName = "GeneratorFunction";

  // Helper for defining the .next, .throw, and .return methods of the
  // Iterator interface in terms of a single ._invoke method.
  function defineIteratorMethods(prototype) {
    ["next", "throw", "return"].forEach(function(method) {
      prototype[method] = function(arg) {
        return this._invoke(method, arg);
      };
    });
  }

  runtime.isGeneratorFunction = function(genFun) {
    var ctor = typeof genFun === "function" && genFun.constructor;
    return ctor
      ? ctor === GeneratorFunction ||
        // For the native GeneratorFunction constructor, the best we can
        // do is to check its .name property.
        (ctor.displayName || ctor.name) === "GeneratorFunction"
      : false;
  };

  runtime.mark = function(genFun) {
    genFun.__proto__ = GeneratorFunctionPrototype;
    genFun.prototype = Object.create(Gp);
    return genFun;
  };

  // Within the body of any async function, `await x` is transformed to
  // `yield regeneratorRuntime.awrap(x)`, so that the runtime can test
  // `value instanceof AwaitArgument` to determine if the yielded value is
  // meant to be awaited. Some may consider the name of this method too
  // cutesy, but they are curmudgeons.
  runtime.awrap = function(arg) {
    return new AwaitArgument(arg);
  };

  function AwaitArgument(arg) {
    this.arg = arg;
  }

  function AsyncIterator(generator) {
    // This invoke function is written in a style that assumes some
    // calling function (or Promise) will handle exceptions.
    function invoke(method, arg) {
      var result = generator[method](arg);
      var value = result.value;
      return value instanceof AwaitArgument
        ? Promise.resolve(value.arg).then(invokeNext, invokeThrow)
        : Promise.resolve(value).then(function(unwrapped) {
            result.value = unwrapped;
            return result;
          }, invokeThrow);
    }

    if (typeof process === "object" && process.domain) {
      invoke = process.domain.bind(invoke);
    }

    var invokeNext = invoke.bind(generator, "next");
    var invokeThrow = invoke.bind(generator, "throw");
    var invokeReturn = invoke.bind(generator, "return");
    var previousPromise;

    function enqueue(method, arg) {
      var enqueueResult =
        // If enqueue has been called before, then we want to wait until
        // all previous Promises have been resolved before calling invoke,
        // so that results are always delivered in the correct order. If
        // enqueue has not been called before, then it is important to
        // call invoke immediately, without waiting on a callback to fire,
        // so that the async generator function has the opportunity to do
        // any necessary setup in a predictable way. This predictability
        // is why the Promise constructor synchronously invokes its
        // executor callback, and why async functions synchronously
        // execute code before the first await. Since we implement simple
        // async functions in terms of async generators, it is especially
        // important to get this right, even though it requires care.
        previousPromise ? previousPromise.then(function() {
          return invoke(method, arg);
        }) : new Promise(function(resolve) {
          resolve(invoke(method, arg));
        });

      // Avoid propagating enqueueResult failures to Promises returned by
      // later invocations of the iterator, and call generator.return() to
      // allow the generator a chance to clean up.
      previousPromise = enqueueResult["catch"](invokeReturn);

      return enqueueResult;
    }

    // Define the unified helper method that is used to implement .next,
    // .throw, and .return (see defineIteratorMethods).
    this._invoke = enqueue;
  }

  defineIteratorMethods(AsyncIterator.prototype);

  // Note that simple async functions are implemented on top of
  // AsyncIterator objects; they just return a Promise for the value of
  // the final result produced by the iterator.
  runtime.async = function(innerFn, outerFn, self, tryLocsList) {
    var iter = new AsyncIterator(
      wrap(innerFn, outerFn, self, tryLocsList)
    );

    return runtime.isGeneratorFunction(outerFn)
      ? iter // If outerFn is a generator, return the full iterator.
      : iter.next().then(function(result) {
          return result.done ? result.value : iter.next();
        });
  };

  function makeInvokeMethod(innerFn, self, context) {
    var state = GenStateSuspendedStart;

    return function invoke(method, arg) {
      if (state === GenStateExecuting) {
        throw new Error("Generator is already running");
      }

      if (state === GenStateCompleted) {
        // Be forgiving, per 25.3.3.3.3 of the spec:
        // https://people.mozilla.org/~jorendorff/es6-draft.html#sec-generatorresume
        return doneResult();
      }

      while (true) {
        var delegate = context.delegate;
        if (delegate) {
          if (method === "return" ||
              (method === "throw" && delegate.iterator[method] === undefined)) {
            // A return or throw (when the delegate iterator has no throw
            // method) always terminates the yield* loop.
            context.delegate = null;

            // If the delegate iterator has a return method, give it a
            // chance to clean up.
            var returnMethod = delegate.iterator["return"];
            if (returnMethod) {
              var record = tryCatch(returnMethod, delegate.iterator, arg);
              if (record.type === "throw") {
                // If the return method threw an exception, let that
                // exception prevail over the original return or throw.
                method = "throw";
                arg = record.arg;
                continue;
              }
            }

            if (method === "return") {
              // Continue with the outer return, now that the delegate
              // iterator has been terminated.
              continue;
            }
          }

          var record = tryCatch(
            delegate.iterator[method],
            delegate.iterator,
            arg
          );

          if (record.type === "throw") {
            context.delegate = null;

            // Like returning generator.throw(uncaught), but without the
            // overhead of an extra function call.
            method = "throw";
            arg = record.arg;
            continue;
          }

          // Delegate generator ran and handled its own exceptions so
          // regardless of what the method was, we continue as if it is
          // "next" with an undefined arg.
          method = "next";
          arg = undefined;

          var info = record.arg;
          if (info.done) {
            context[delegate.resultName] = info.value;
            context.next = delegate.nextLoc;
          } else {
            state = GenStateSuspendedYield;
            return info;
          }

          context.delegate = null;
        }

        if (method === "next") {
          if (state === GenStateSuspendedYield) {
            context.sent = arg;
          } else {
            delete context.sent;
          }

        } else if (method === "throw") {
          if (state === GenStateSuspendedStart) {
            state = GenStateCompleted;
            throw arg;
          }

          if (context.dispatchException(arg)) {
            // If the dispatched exception was caught by a catch block,
            // then let that catch block handle the exception normally.
            method = "next";
            arg = undefined;
          }

        } else if (method === "return") {
          context.abrupt("return", arg);
        }

        state = GenStateExecuting;

        var record = tryCatch(innerFn, self, context);
        if (record.type === "normal") {
          // If an exception is thrown from innerFn, we leave state ===
          // GenStateExecuting and loop back for another invocation.
          state = context.done
            ? GenStateCompleted
            : GenStateSuspendedYield;

          var info = {
            value: record.arg,
            done: context.done
          };

          if (record.arg === ContinueSentinel) {
            if (context.delegate && method === "next") {
              // Deliberately forget the last sent value so that we don't
              // accidentally pass it on to the delegate.
              arg = undefined;
            }
          } else {
            return info;
          }

        } else if (record.type === "throw") {
          state = GenStateCompleted;
          // Dispatch the exception by looping back around to the
          // context.dispatchException(arg) call above.
          method = "throw";
          arg = record.arg;
        }
      }
    };
  }

  // Define Generator.prototype.{next,throw,return} in terms of the
  // unified ._invoke helper method.
  defineIteratorMethods(Gp);

  Gp[iteratorSymbol] = function() {
    return this;
  };

  Gp.toString = function() {
    return "[object Generator]";
  };

  function pushTryEntry(locs) {
    var entry = { tryLoc: locs[0] };

    if (1 in locs) {
      entry.catchLoc = locs[1];
    }

    if (2 in locs) {
      entry.finallyLoc = locs[2];
      entry.afterLoc = locs[3];
    }

    this.tryEntries.push(entry);
  }

  function resetTryEntry(entry) {
    var record = entry.completion || {};
    record.type = "normal";
    delete record.arg;
    entry.completion = record;
  }

  function Context(tryLocsList) {
    // The root entry object (effectively a try statement without a catch
    // or a finally block) gives us a place to store values thrown from
    // locations where there is no enclosing try statement.
    this.tryEntries = [{ tryLoc: "root" }];
    tryLocsList.forEach(pushTryEntry, this);
    this.reset();
  }

  runtime.keys = function(object) {
    var keys = [];
    for (var key in object) {
      keys.push(key);
    }
    keys.reverse();

    // Rather than returning an object with a next method, we keep
    // things simple and return the next function itself.
    return function next() {
      while (keys.length) {
        var key = keys.pop();
        if (key in object) {
          next.value = key;
          next.done = false;
          return next;
        }
      }

      // To avoid creating an additional object, we just hang the .value
      // and .done properties off the next function object itself. This
      // also ensures that the minifier will not anonymize the function.
      next.done = true;
      return next;
    };
  };

  function values(iterable) {
    if (iterable) {
      var iteratorMethod = iterable[iteratorSymbol];
      if (iteratorMethod) {
        return iteratorMethod.call(iterable);
      }

      if (typeof iterable.next === "function") {
        return iterable;
      }

      if (!isNaN(iterable.length)) {
        var i = -1, next = function next() {
          while (++i < iterable.length) {
            if (hasOwn.call(iterable, i)) {
              next.value = iterable[i];
              next.done = false;
              return next;
            }
          }

          next.value = undefined;
          next.done = true;

          return next;
        };

        return next.next = next;
      }
    }

    // Return an iterator with no values.
    return { next: doneResult };
  }
  runtime.values = values;

  function doneResult() {
    return { value: undefined, done: true };
  }

  Context.prototype = {
    constructor: Context,

    reset: function() {
      this.prev = 0;
      this.next = 0;
      this.sent = undefined;
      this.done = false;
      this.delegate = null;

      this.tryEntries.forEach(resetTryEntry);

      // Pre-initialize at least 20 temporary variables to enable hidden
      // class optimizations for simple generators.
      for (var tempIndex = 0, tempName;
           hasOwn.call(this, tempName = "t" + tempIndex) || tempIndex < 20;
           ++tempIndex) {
        this[tempName] = null;
      }
    },

    stop: function() {
      this.done = true;

      var rootEntry = this.tryEntries[0];
      var rootRecord = rootEntry.completion;
      if (rootRecord.type === "throw") {
        throw rootRecord.arg;
      }

      return this.rval;
    },

    dispatchException: function(exception) {
      if (this.done) {
        throw exception;
      }

      var context = this;
      function handle(loc, caught) {
        record.type = "throw";
        record.arg = exception;
        context.next = loc;
        return !!caught;
      }

      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        var record = entry.completion;

        if (entry.tryLoc === "root") {
          // Exception thrown outside of any try block that could handle
          // it, so set the completion value of the entire function to
          // throw the exception.
          return handle("end");
        }

        if (entry.tryLoc <= this.prev) {
          var hasCatch = hasOwn.call(entry, "catchLoc");
          var hasFinally = hasOwn.call(entry, "finallyLoc");

          if (hasCatch && hasFinally) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            } else if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }

          } else if (hasCatch) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            }

          } else if (hasFinally) {
            if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }

          } else {
            throw new Error("try statement without catch or finally");
          }
        }
      }
    },

    abrupt: function(type, arg) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc <= this.prev &&
            hasOwn.call(entry, "finallyLoc") &&
            this.prev < entry.finallyLoc) {
          var finallyEntry = entry;
          break;
        }
      }

      if (finallyEntry &&
          (type === "break" ||
           type === "continue") &&
          finallyEntry.tryLoc <= arg &&
          arg <= finallyEntry.finallyLoc) {
        // Ignore the finally entry if control is not jumping to a
        // location outside the try/catch block.
        finallyEntry = null;
      }

      var record = finallyEntry ? finallyEntry.completion : {};
      record.type = type;
      record.arg = arg;

      if (finallyEntry) {
        this.next = finallyEntry.finallyLoc;
      } else {
        this.complete(record);
      }

      return ContinueSentinel;
    },

    complete: function(record, afterLoc) {
      if (record.type === "throw") {
        throw record.arg;
      }

      if (record.type === "break" ||
          record.type === "continue") {
        this.next = record.arg;
      } else if (record.type === "return") {
        this.rval = record.arg;
        this.next = "end";
      } else if (record.type === "normal" && afterLoc) {
        this.next = afterLoc;
      }
    },

    finish: function(finallyLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.finallyLoc === finallyLoc) {
          this.complete(entry.completion, entry.afterLoc);
          resetTryEntry(entry);
          return ContinueSentinel;
        }
      }
    },

    "catch": function(tryLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc === tryLoc) {
          var record = entry.completion;
          if (record.type === "throw") {
            var thrown = record.arg;
            resetTryEntry(entry);
          }
          return thrown;
        }
      }

      // The context.catch method must only be called with a location
      // argument that corresponds to a known catch block.
      throw new Error("illegal catch attempt");
    },

    delegateYield: function(iterable, resultName, nextLoc) {
      this.delegate = {
        iterator: values(iterable),
        resultName: resultName,
        nextLoc: nextLoc
      };

      return ContinueSentinel;
    }
  };
})(
  // Among the various tricks for obtaining a reference to the global
  // object, this seems to be the most reliable technique that does not
  // use indirect eval (which violates Content Security Policy).
  typeof global === "object" ? global :
  typeof window === "object" ? window :
  typeof self === "object" ? self : this
);
(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw (f.code="MODULE_NOT_FOUND", f)}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Not strict mode because it uses octal literals all over.
module.exports = {
  isBlob: function (mode) {
    return (mode & 0140000) === 0100000;
  },
  isFile: function (mode) {
    return (mode & 0160000) === 0100000;
  },
  toType: function (mode) {
    if (mode === 0160000) return "commit";
    if (mode ===  040000) return "tree";
    if ((mode & 0140000) === 0100000) return "blob";
    return "unknown";
  },
  tree:    040000,
  blob:   0100644,
  file:   0100644,
  exec:   0100755,
  sym:    0120000,
  commit: 0160000
};

},{}],2:[function(require,module,exports){
"use strict";
var bodec = require('bodec');
var modes = require('./modes');

// (body) -> raw-buffer
var encoders = exports.encoders = {
  blob: encodeBlob,
  tree: encodeTree,
  commit: encodeCommit,
  tag: encodeTag
};

  // ({type:type, body:raw-buffer}) -> buffer
exports.frame = frame;

// (raw-buffer) -> body
var decoders = exports.decoders ={
  blob: decodeBlob,
  tree: decodeTree,
  commit: decodeCommit,
  tag: decodeTag
};

// (buffer) -> {type:type, body:raw-buffer}
exports.deframe = deframe;

// Export git style path sort in case it's wanted.
exports.treeMap = treeMap;
exports.treeSort = treeSort;

function encodeBlob(body) {
  if (!bodec.isBinary(body)) throw new TypeError("Blobs must be binary values");
  return body;
}

function treeMap(key) {
  /*jshint validthis:true*/
  var entry = this[key];
  return {
    name: key,
    mode: entry.mode,
    hash: entry.hash
  };
}

function treeSort(a, b) {
  var aa = (a.mode === modes.tree) ? a.name + "/" : a.name;
  var bb = (b.mode === modes.tree) ? b.name + "/" : b.name;
  return aa > bb ? 1 : aa < bb ? -1 : 0;
}

function encodeTree(body) {
  var tree = "";
  if (Array.isArray(body)) throw new TypeError("Tree must be in object form");
  var list = Object.keys(body).map(treeMap, body).sort(treeSort);
  for (var i = 0, l = list.length; i < l; i++) {
    var entry = list[i];
    tree += entry.mode.toString(8) + " " + bodec.encodeUtf8(entry.name) +
            "\0" + bodec.decodeHex(entry.hash);
  }
  return bodec.fromRaw(tree);
}

function encodeTag(body) {
  var str = "object " + body.object +
    "\ntype " + body.type +
    "\ntag " + body.tag +
    "\ntagger " + formatPerson(body.tagger) +
    "\n\n" + body.message;
  return bodec.fromUnicode(str);
}

function encodeCommit(body) {
  var str = "tree " + body.tree;
  for (var i = 0, l = body.parents.length; i < l; ++i) {
    str += "\nparent " + body.parents[i];
  }
  str += "\nauthor " + formatPerson(body.author) +
         "\ncommitter " + formatPerson(body.committer) +
         "\n\n" + body.message;
  return bodec.fromUnicode(str);
}


function formatPerson(person) {
  return safe(person.name) +
    " <" + safe(person.email) + "> " +
    formatDate(person.date);
}

function safe(string) {
  return string.replace(/(?:^[\.,:;<>"']+|[\0\n<>]+|[\.,:;<>"']+$)/gm, "");
}

function two(num) {
  return (num < 10 ? "0" : "") + num;
}

function formatDate(date) {
  var seconds, offset;
  if (date.seconds) {
    seconds = date.seconds;
    offset = date.offset;
  }
  // Also accept Date instances
  else {
    seconds = Math.floor(date.getTime() / 1000);
    offset = date.getTimezoneOffset();
  }
  var neg = "+";
  if (offset <= 0) offset = -offset;
  else neg = "-";
  offset = neg + two(Math.floor(offset / 60)) + two(offset % 60);
  return seconds + " " + offset;
}

function frame(obj) {
  var type = obj.type;
  var body = obj.body;
  if (!bodec.isBinary(body)) body = encoders[type](body);
  return bodec.join([
    bodec.fromRaw(type + " " + body.length + "\0"),
    body
  ]);
}

function decodeBlob(body) {
  return body;
}

function decodeTree(body) {
  var i = 0;
  var length = body.length;
  var start;
  var mode;
  var name;
  var hash;
  var tree = {};
  while (i < length) {
    start = i;
    i = indexOf(body, 0x20, start);
    if (i < 0) throw new SyntaxError("Missing space");
    mode = parseOct(body, start, i++);
    start = i;
    i = indexOf(body, 0x00, start);
    name = bodec.toUnicode(body, start, i++);
    hash = bodec.toHex(body, i, i += 20);
    tree[name] = {
      mode: mode,
      hash: hash
    };
  }
  return tree;
}

function decodeCommit(body) {
  var i = 0;
  var start;
  var key;
  var parents = [];
  var commit = {
    tree: "",
    parents: parents,
    author: "",
    committer: "",
    message: ""
  };
  while (body[i] !== 0x0a) {
    start = i;
    i = indexOf(body, 0x20, start);
    if (i < 0) throw new SyntaxError("Missing space");
    key = bodec.toRaw(body, start, i++);
    start = i;
    i = indexOf(body, 0x0a, start);
    if (i < 0) throw new SyntaxError("Missing linefeed");
    var value = bodec.toUnicode(body, start, i++);
    if (key === "parent") {
      parents.push(value);
    }
    else {
      if (key === "author" || key === "committer") {
        value = decodePerson(value);
      }
      commit[key] = value;
    }
  }
  i++;
  commit.message = bodec.toUnicode(body, i, body.length);
  return commit;
}

function decodeTag(body) {
  var i = 0;
  var start;
  var key;
  var tag = {};
  while (body[i] !== 0x0a) {
    start = i;
    i = indexOf(body, 0x20, start);
    if (i < 0) throw new SyntaxError("Missing space");
    key = bodec.toRaw(body, start, i++);
    start = i;
    i = indexOf(body, 0x0a, start);
    if (i < 0) throw new SyntaxError("Missing linefeed");
    var value = bodec.toUnicode(body, start, i++);
    if (key === "tagger") value = decodePerson(value);
    tag[key] = value;
  }
  i++;
  tag.message = bodec.toUnicode(body, i, body.length);
  return tag;
}

function decodePerson(string) {
  var match = string.match(/^([^<]*) <([^>]*)> ([^ ]*) (.*)$/);
  if (!match) throw new Error("Improperly formatted person string");
  return {
    name: match[1],
    email: match[2],
    date: {
      seconds: parseInt(match[3], 10),
      offset: parseInt(match[4], 10) / 100 * -60
    }
  };
}

function deframe(buffer, decode) {
  var space = indexOf(buffer, 0x20);
  if (space < 0) throw new Error("Invalid git object buffer");
  var nil = indexOf(buffer, 0x00, space);
  if (nil < 0) throw new Error("Invalid git object buffer");
  var body = bodec.slice(buffer, nil + 1);
  var size = parseDec(buffer, space + 1, nil);
  if (size !== body.length) throw new Error("Invalid body length.");
  var type = bodec.toRaw(buffer, 0, space);
  return {
    type: type,
    body: decode ? decoders[type](body) : body
  };
}

function indexOf(buffer, byte, i) {
  i |= 0;
  var length = buffer.length;
  for (;;i++) {
    if (i >= length) return -1;
    if (buffer[i] === byte) return i;
  }
}

function parseOct(buffer, start, end) {
  var val = 0;
  while (start < end) {
    val = (val << 3) + buffer[start++] - 0x30;
  }
  return val;
}

function parseDec(buffer, start, end) {
  var val = 0;
  while (start < end) {
    val = val * 10 + buffer[start++] - 0x30;
  }
  return val;
}

},{"./modes":1,"bodec":6}],3:[function(require,module,exports){
"use strict";

var modes = require('../lib/modes.js');

module.exports = function (repo) {
  repo.createTree = createTree;

  function createTree(entries, callback) {
    if (!callback) return createTree.bind(null, entries);
    callback = singleCall(callback);
    if (!Array.isArray(entries)) {
      entries = Object.keys(entries).map(function (path) {
        var entry = entries[path];
        entry.path = path;
        return entry;
      });
    }

    // Tree paths that we need loaded
    var toLoad = {};
    function markTree(path) {
      while(true) {
        if (toLoad[path]) return;
        toLoad[path] = true;
        trees[path] = {
          add: [],
          del: [],
          tree: {}
        };
        if (!path) break;
        path = path.substring(0, path.lastIndexOf("/"));
      }
    }

    // Commands to run organized by tree path
    var trees = {};

    // Counter for parallel I/O operations
    var left = 1; // One extra counter to protect again zalgo cache callbacks.

    // First pass, stubs out the trees structure, sorts adds from deletes,
    // and saves any inline content blobs.
    entries.forEach(function (entry) {
      var index = entry.path.lastIndexOf("/");
      var parentPath = entry.path.substr(0, index);
      var name = entry.path.substr(index + 1);
      markTree(parentPath);
      var tree = trees[parentPath];
      var adds = tree.add;
      var dels = tree.del;

      if (!entry.mode) {
        dels.push(name);
        return;
      }
      var add = {
        name: name,
        mode: entry.mode,
        hash: entry.hash
      };
      adds.push(add);
      if (entry.hash) return;
      left++;
      repo.saveAs("blob", entry.content, function (err, hash) {
        if (err) return callback(err);
        add.hash = hash;
        check();
      });
    });

    // Preload the base trees
    if (entries.base) loadTree("", entries.base);

    // Check just in case there was no IO to perform
    check();

    function loadTree(path, hash) {
      left++;
      delete toLoad[path];
      repo.loadAs("tree", hash, function (err, tree) {
        if (err) return callback(err);
        trees[path].tree = tree;
        Object.keys(tree).forEach(function (name) {
          var childPath = path ? path + "/" + name : name;
          if (toLoad[childPath]) loadTree(childPath, tree[name].hash);
        });
        check();
      });
    }

    function check() {
      if (--left) return;
      findLeaves().forEach(processLeaf);
    }

    function processLeaf(path) {
      var entry = trees[path];
      delete trees[path];
      var tree = entry.tree;
      entry.del.forEach(function (name) {
        delete tree[name];
      });
      entry.add.forEach(function (item) {
        tree[item.name] = {
          mode: item.mode,
          hash: item.hash
        };
      });
      left++;
      repo.saveAs("tree", tree, function (err, hash, tree) {
        if (err) return callback(err);
        if (!path) return callback(null, hash, tree);
        var index = path.lastIndexOf("/");
        var parentPath = path.substring(0, index);
        var name = path.substring(index + 1);
        trees[parentPath].add.push({
          name: name,
          mode: modes.tree,
          hash: hash
        });
        if (--left) return;
        findLeaves().forEach(processLeaf);
      });
    }

    function findLeaves() {
      var paths = Object.keys(trees);
      var parents = {};
      paths.forEach(function (path) {
        if (!path) return;
        var parent = path.substring(0, path.lastIndexOf("/"));
        parents[parent] = true;
      });
      return paths.filter(function (path) {
        return !parents[path];
      });
    }
  }
};

function singleCall(callback) {
  var done = false;
  return function () {
    if (done) return console.warn("Discarding extra callback");
    done = true;
    return callback.apply(this, arguments);
  };
}

},{"../lib/modes.js":1}],4:[function(require,module,exports){
"use strict";

var bodec = require('bodec');
var treeMap = require('../lib/object-codec').treeMap;

module.exports = function (repo) {
  var loadAs = repo.loadAs;
  repo.loadAs = newLoadAs;
  var saveAs = repo.saveAs;
  repo.saveAs = newSaveAs;

  function newLoadAs(type, hash, callback) {
    if (!callback) return newLoadAs.bind(repo, type, hash);
    var realType = type === "text" ? "blob":
                   type === "array" ? "tree" : type;
    return loadAs.call(repo, realType, hash, onLoad);

    function onLoad(err, body, hash) {
      if (body === undefined) return callback(err);
      if (type === "text") body = bodec.toUnicode(body);
      if (type === "array") body = toArray(body);
      return callback(err, body, hash);
    }
  }

  function newSaveAs(type, body, callback) {
    if (!callback) return newSaveAs.bind(repo, type, body);
    type = type === "text" ? "blob":
           type === "array" ? "tree" : type;
    if (type === "blob") {
      if (typeof body === "string") {
        body = bodec.fromUnicode(body);
      }
    }
    else if (type === "tree") {
      body = normalizeTree(body);
    }
    else if (type === "commit") {
      body = normalizeCommit(body);
    }
    else if (type === "tag") {
      body = normalizeTag(body);
    }
    return saveAs.call(repo, type, body, callback);
  }

};

function toArray(tree) {
  return Object.keys(tree).map(treeMap, tree);
}

function normalizeTree(body) {
  var type = body && typeof body;
  if (type !== "object") {
    throw new TypeError("Tree body must be array or object");
  }
  var tree = {}, i, l, entry;
  // If array form is passed in, convert to object form.
  if (Array.isArray(body)) {
    for (i = 0, l = body.length; i < l; i++) {
      entry = body[i];
      tree[entry.name] = {
        mode: entry.mode,
        hash: entry.hash
      };
    }
  }
  else {
    var names = Object.keys(body);
    for (i = 0, l = names.length; i < l; i++) {
      var name = names[i];
      entry = body[name];
      tree[name] = {
        mode: entry.mode,
        hash: entry.hash
      };
    }
  }
  return tree;
}

function normalizeCommit(body) {
  if (!body || typeof body !== "object") {
    throw new TypeError("Commit body must be an object");
  }
  if (!(body.tree && body.author && body.message)) {
    throw new TypeError("Tree, author, and message are required for commits");
  }
  var parents = body.parents || (body.parent ? [ body.parent ] : []);
  if (!Array.isArray(parents)) {
    throw new TypeError("Parents must be an array");
  }
  var author = normalizePerson(body.author);
  var committer = body.committer ? normalizePerson(body.committer) : author;
  return {
    tree: body.tree,
    parents: parents,
    author: author,
    committer: committer,
    message: body.message
  };
}

function normalizeTag(body) {
  if (!body || typeof body !== "object") {
    throw new TypeError("Tag body must be an object");
  }
  if (!(body.object && body.type && body.tag && body.tagger && body.message)) {
    throw new TypeError("Object, type, tag, tagger, and message required");
  }
  return {
    object: body.object,
    type: body.type,
    tag: body.tag,
    tagger: normalizePerson(body.tagger),
    message: body.message
  };
}

function normalizePerson(person) {
  if (!person || typeof person !== "object") {
    throw new TypeError("Person must be an object");
  }
  if (!person.name || !person.email) {
    throw new TypeError("Name and email are required for person fields");
  }
  return {
    name: person.name,
    email: person.email,
    date: person.date || new Date()
  };
}

},{"../lib/object-codec":2,"bodec":6}],5:[function(require,module,exports){
"use strict";

// This replaces loadAs with a version that batches concurrent requests for
// the same hash.
module.exports = function (repo) {
  var pendingReqs = {};

  var loadAs = repo.loadAs;
  repo.loadAs = newLoadAs;

  function newLoadAs(type, hash, callback) {
    if (!callback) return newLoadAs.bind(null, type, hash);
    var list = pendingReqs[hash];
    if (list) {
      if (list.type !== type) callback(new Error("Type mismatch"));
      else list.push(callback);
      return;
    }
    list = pendingReqs[hash] = [callback];
    list.type = type;
    loadAs.call(repo, type, hash, function () {
      delete pendingReqs[hash];
      for (var i = 0, l = list.length; i < l; i++) {
        list[i].apply(this, arguments);
      }
    });
  }
};

},{}],6:[function(require,module,exports){
(function (process){
"use strict";
/*global escape, unescape*/

var isNode = typeof process === 'object' &&
             typeof process.versions === 'object' &&
             process.versions.node &&
             process.__atom_type !== "renderer";

if (isNode) {
  var nodeRequire = require; // Prevent mine.js from seeing this require
  module.exports = nodeRequire('./bodec-node.js');
}
else {

  // This file must be served with UTF-8 encoding for the utf8 codec to work.
  module.exports = {
    Binary: Uint8Array,
    // Utility functions
    isBinary: isBinary,
    create: create,
    join: join,

    // Binary input and output
    copy: copy,
    slice: slice,

    // String input and output
    toRaw: toRaw,
    fromRaw: fromRaw,
    toUnicode: toUnicode,
    fromUnicode: fromUnicode,
    toHex: toHex,
    fromHex: fromHex,
    toBase64: toBase64,
    fromBase64: fromBase64,

    // Array input and output
    toArray: toArray,
    fromArray: fromArray,

    // Raw <-> Hex-encoded codec
    decodeHex: decodeHex,
    encodeHex: encodeHex,

    decodeBase64: decodeBase64,
    encodeBase64: encodeBase64,

    // Unicode <-> Utf8-encoded-raw codec
    encodeUtf8: encodeUtf8,
    decodeUtf8: decodeUtf8,

    // Hex <-> Nibble codec
    nibbleToCode: nibbleToCode,
    codeToNibble: codeToNibble
  };
}

function isBinary(value) {
  return value &&
      typeof value === "object" &&
      value instanceof Uint8Array || value.constructor.name === "Uint8Array";
}

function create(length) {
  return new Uint8Array(length);
}

function join(chunks) {
  var length = chunks.length;
  var total = 0;
  for (var i = 0; i < length; i++) {
    total += chunks[i].length;
  }
  var binary = create(total);
  var offset = 0;
  for (i = 0; i < length; i++) {
    var chunk = chunks[i];
    copy(chunk, binary, offset);
    offset += chunk.length;
  }
  return binary;
}

function slice(binary, start, end) {
  if (end === undefined) {
    end = binary.length;
    if (start === undefined) start = 0;
  }
  return binary.subarray(start, end);
}

function copy(source, binary, offset) {
  var length = source.length;
  if (offset === undefined) {
    offset = 0;
    if (binary === undefined) binary = create(length);
  }
  for (var i = 0; i < length; i++) {
    binary[i + offset] = source[i];
  }
  return binary;
}

// Like slice, but encode as a hex string
function toHex(binary, start, end) {
  var hex = "";
  if (end === undefined) {
    end = binary.length;
    if (start === undefined) start = 0;
  }
  for (var i = start; i < end; i++) {
    var byte = binary[i];
    hex += String.fromCharCode(nibbleToCode(byte >> 4)) +
           String.fromCharCode(nibbleToCode(byte & 0xf));
  }
  return hex;
}

// Like copy, but decode from a hex string
function fromHex(hex, binary, offset) {
  var length = hex.length / 2;
  if (offset === undefined) {
    offset = 0;
    if (binary === undefined) binary = create(length);
  }
  var j = 0;
  for (var i = 0; i < length; i++) {
    binary[offset + i] = (codeToNibble(hex.charCodeAt(j++)) << 4)
                       |  codeToNibble(hex.charCodeAt(j++));
  }
  return binary;
}

function toBase64(binary, start, end) {
  return btoa(toRaw(binary, start, end));
}

function fromBase64(base64, binary, offset) {
  return fromRaw(atob(base64), binary, offset);
}

function nibbleToCode(nibble) {
  nibble |= 0;
  return (nibble + (nibble < 10 ? 0x30 : 0x57))|0;
}

function codeToNibble(code) {
  code |= 0;
  return (code - ((code & 0x40) ? 0x57 : 0x30))|0;
}

function toUnicode(binary, start, end) {
  return decodeUtf8(toRaw(binary, start, end));
}

function fromUnicode(unicode, binary, offset) {
  return fromRaw(encodeUtf8(unicode), binary, offset);
}

function decodeHex(hex) {
  var j = 0, l = hex.length;
  var raw = "";
  while (j < l) {
    raw += String.fromCharCode(
       (codeToNibble(hex.charCodeAt(j++)) << 4)
      | codeToNibble(hex.charCodeAt(j++))
    );
  }
  return raw;
}

function encodeHex(raw) {
  var hex = "";
  var length = raw.length;
  for (var i = 0; i < length; i++) {
    var byte = raw.charCodeAt(i);
    hex += String.fromCharCode(nibbleToCode(byte >> 4)) +
           String.fromCharCode(nibbleToCode(byte & 0xf));
  }
  return hex;
}

function decodeBase64(base64) {
  return atob(base64);
}

function encodeBase64(raw) {
  return btoa(raw);
}

function decodeUtf8(utf8) {
  return decodeURIComponent(escape(utf8));
}

function encodeUtf8(unicode) {
  return unescape(encodeURIComponent(unicode));
}

function toRaw(binary, start, end) {
  var raw = "";
  if (end === undefined) {
    end = binary.length;
    if (start === undefined) start = 0;
  }
  for (var i = start; i < end; i++) {
    raw += String.fromCharCode(binary[i]);
  }
  return raw;
}

function fromRaw(raw, binary, offset) {
  var length = raw.length;
  if (offset === undefined) {
    offset = 0;
    if (binary === undefined) binary = create(length);
  }
  for (var i = 0; i < length; i++) {
    binary[offset + i] = raw.charCodeAt(i);
  }
  return binary;
}

function toArray(binary, start, end) {
  if (end === undefined) {
    end = binary.length;
    if (start === undefined) start = 0;
  }
  var length = end - start;
  var array = new Array(length);
  for (var i = 0; i < length; i++) {
    array[i] = binary[i + start];
  }
  return array;
}

function fromArray(array, binary, offset) {
  var length = array.length;
  if (offset === undefined) {
    offset = 0;
    if (binary === undefined) binary = create(length);
  }
  for (var i = 0; i < length; i++) {
    binary[offset + i] = array[i];
  }
  return binary;
}

}).call(this,require('_process'))
},{"_process":13}],7:[function(require,module,exports){
(function (process){
"use strict";

var isNode = typeof process === 'object' &&
             typeof process.versions === 'object' &&
             process.versions.node &&
             process.__atom_type !== "renderer";

// Node.js https module
if (isNode) {
  var nodeRequire = require; // Prevent mine.js from seeing this require
  module.exports = nodeRequire('./xhr-node.js');
}

// Browser XHR
else {
  module.exports = function (root, accessToken) {
    var timeout = 2000;
    return request;

    function request(method, url, body, callback) {
      if (typeof body === "function") {
        callback = body;
        body = undefined;
      }
      else if (!callback) return request.bind(null, method, url, body);
      url = url.replace(":root", root);
      var done = false;
      var json;
      var xhr = new XMLHttpRequest();
      xhr.timeout = timeout;
      xhr.open(method, 'https://api.github.com' + url, true);
      xhr.setRequestHeader("Authorization", "token " + accessToken);
      if (body) {
        try { json = JSON.stringify(body); }
        catch (err) { return callback(err); }
      }
      xhr.ontimeout = onTimeout;
      xhr.onerror = function() {
        callback(new Error("Error requesting " + url));
      };
      xhr.onreadystatechange = onReadyStateChange;
      xhr.send(json);

      function onReadyStateChange() {
        if (done) return;
        if (xhr.readyState !== 4) return;
        // Give onTimeout a chance to run first if that's the reason status is 0.
        if (!xhr.status) return setTimeout(onReadyStateChange, 0);
        done = true;
        var response = {message:xhr.responseText};
        if (xhr.responseText){
          try { response = JSON.parse(xhr.responseText); }
          catch (err) {}
        }
        xhr.body = response;
        return callback(null, xhr, response);
      }

      function onTimeout() {
        if (done) return;
        if (timeout < 8000) {
          timeout *= 2;
          return request(method, url, body, callback);
        }
        done = true;
        callback(new Error("Timeout requesting " + url));
      }
    }
  };
}

}).call(this,require('_process'))
},{"_process":13}],8:[function(require,module,exports){
"use strict";

var modes = require('js-git/lib/modes');
var xhr = require('../lib/xhr');
var bodec = require('bodec');
var sha1 = require('git-sha1');
var frame = require('js-git/lib/object-codec').frame;

var modeToType = {
  "040000": "tree",
  "100644": "blob",  // normal file
  "100755": "blob",  // executable file
  "120000": "blob",  // symlink
  "160000": "commit" // gitlink
};

var encoders = {
  commit: encodeCommit,
  tag: encodeTag,
  tree: encodeTree,
  blob: encodeBlob
};

var decoders = {
  commit: decodeCommit,
  tag: decodeTag,
  tree: decodeTree,
  blob: decodeBlob,
};

var typeCache = {};

// Precompute hashes for empty blob and empty tree since github won't
var empty = bodec.create(0);
var emptyBlob = sha1(frame({ type: "blob", body: empty }));
var emptyTree = sha1(frame({ type: "tree", body: empty }));

// Implement the js-git object interface using github APIs
module.exports = function (repo, root, accessToken) {

  var apiRequest = xhr(root, accessToken);

  repo.loadAs = loadAs;         // (type, hash) -> value, hash
  repo.saveAs = saveAs;         // (type, value) -> hash, value
  repo.readRef = readRef;       // (ref) -> hash
  repo.updateRef = updateRef;   // (ref, hash) -> hash
  repo.createTree = createTree; // (entries) -> hash, tree
  repo.hasHash = hasHash;

  function loadAs(type, hash, callback) {
    if (!callback) return loadAs.bind(repo, type, hash);
    // Github doesn't like empty trees, but we know them already.
    if (type === "tree" && hash === emptyTree) return callback(null, {}, hash);
    apiRequest("GET", "/repos/:root/git/" + type + "s/" + hash, onValue);

    function onValue(err, xhr, result) {
      if (err) return callback(err);
      if (xhr.status < 200 || xhr.status >= 500) {
        return callback(new Error("Invalid HTTP response: " + xhr.statusCode + " " + result.message));
      }
      if (xhr.status >= 300 && xhr.status < 500) return callback();
      var body;
      try { body = decoders[type].call(repo, result); }
      catch (err) { return callback(err); }
      if (hashAs(type, body) !== hash) {
        if (fixDate(type, body, hash)) console.log(type + " repaired", hash);
        else console.warn("Unable to repair " + type, hash);
      }
      typeCache[hash] = type;
      return callback(null, body, hash);
    }
  }

  function hasHash(hash, callback) {
    if (!callback) return hasHash.bind(repo, hash);
    var type = typeCache[hash];
    var types = type ? [type] : ["tag", "commit", "tree", "blob"];
    start();
    function start() {
      type = types.pop();
      if (!type) return callback(null, false);
      apiRequest("GET", "/repos/:root/git/" + type + "s/" + hash, onValue);
    }

    function onValue(err, xhr, result) {
      if (err) return callback(err);
      if (xhr.status < 200 || xhr.status >= 500) {
        return callback(new Error("Invalid HTTP response: " + xhr.statusCode + " " + result.message));
      }
      if (xhr.status >= 300 && xhr.status < 500) return start();
      typeCache[hash] = type;
      callback(null, true);
    }
  }

  function saveAs(type, body, callback) {
    if (!callback) return saveAs.bind(repo, type, body);
    var hash;
    try {
      hash = hashAs(type, body);
    }
    catch (err) {
      return callback(err);
    }
    typeCache[hash] = type;
    repo.hasHash(hash, function (err, has) {
      if (err) return callback(err);
      if (has) return callback(null, hash, body);

      var request;
      try {
        request = encoders[type](body);
      }
      catch (err) {
        return callback(err);
      }

      // Github doesn't allow creating empty trees.
      if (type === "tree" && request.tree.length === 0) {
        return callback(null, emptyTree, body);
      }
      return apiRequest("POST", "/repos/:root/git/" + type + "s", request, onWrite);

    });

    function onWrite(err, xhr, result) {
      if (err) return callback(err);
      if (xhr.status < 200 || xhr.status >= 300) {
        return callback(new Error("Invalid HTTP response: " + xhr.status + " " + result.message));
      }
      return callback(null, result.sha, body);
    }
  }

  // Create a tree with optional deep paths and create new blobs.
  // Entries is an array of {mode, path, hash|content}
  // Also deltas can be specified by setting entries.base to the hash of a tree
  // in delta mode, entries can be removed by specifying just {path}
  function createTree(entries, callback) {
    if (!callback) return createTree.bind(repo, entries);
    var toDelete = entries.base && entries.filter(function (entry) {
      return !entry.mode;
    }).map(function (entry) {
      return entry.path;
    });
    var toCreate = entries.filter(function (entry) {
      return bodec.isBinary(entry.content);
    });

    if (!toCreate.length) return next();
    var done = false;
    var left = entries.length;
    toCreate.forEach(function (entry) {
      repo.saveAs("blob", entry.content, function (err, hash) {
        if (done) return;
        if (err) {
          done = true;
          return callback(err);
        }
        delete entry.content;
        entry.hash = hash;
        left--;
        if (!left) next();
      });
    });

    function next(err) {
      if (err) return callback(err);
      if (toDelete && toDelete.length) {
        return slowUpdateTree(entries, toDelete, callback);
      }
      return fastUpdateTree(entries, callback);
    }
  }

  function fastUpdateTree(entries, callback) {
    var request = { tree: entries.map(mapTreeEntry) };
    if (entries.base) request.base_tree = entries.base;

    apiRequest("POST", "/repos/:root/git/trees", request, onWrite);

    function onWrite(err, xhr, result) {
      if (err) return callback(err);
      if (xhr.status < 200 || xhr.status >= 300) {
        return callback(new Error("Invalid HTTP response: " + xhr.status + " " + result.message));
      }
      return callback(null, result.sha, decoders.tree(result));
    }
  }

  // Github doesn't support deleting entries via the createTree API, so we
  // need to manually create those affected trees and modify the request.
  function slowUpdateTree(entries, toDelete, callback) {
    callback = singleCall(callback);
    var root = entries.base;

    var left = 0;

    // Calculate trees that need to be re-built and save any provided content.
    var parents = {};
    toDelete.forEach(function (path) {
      var parentPath = path.substr(0, path.lastIndexOf("/"));
      var parent = parents[parentPath] || (parents[parentPath] = {
        add: {}, del: []
      });
      var name = path.substr(path.lastIndexOf("/") + 1);
      parent.del.push(name);
    });
    var other = entries.filter(function (entry) {
      if (!entry.mode) return false;
      var parentPath = entry.path.substr(0, entry.path.lastIndexOf("/"));
      var parent = parents[parentPath];
      if (!parent) return true;
      var name = entry.path.substr(entry.path.lastIndexOf("/") + 1);
      if (entry.hash) {
        parent.add[name] = {
          mode: entry.mode,
          hash: entry.hash
        };
        return false;
      }
      left++;
      repo.saveAs("blob", entry.content, function(err, hash) {
        if (err) return callback(err);
        parent.add[name] = {
          mode: entry.mode,
          hash: hash
        };
        if (!--left) onParents();
      });
      return false;
    });
    if (!left) onParents();

    function onParents() {
      Object.keys(parents).forEach(function (parentPath) {
        left++;
        // TODO: remove this dependency on pathToEntry
        repo.pathToEntry(root, parentPath, function (err, entry) {
          if (err) return callback(err);
          var tree = entry.tree;
          var commands = parents[parentPath];
          commands.del.forEach(function (name) {
            delete tree[name];
          });
          for (var name in commands.add) {
            tree[name] = commands.add[name];
          }
          repo.saveAs("tree", tree, function (err, hash, tree) {
            if (err) return callback(err);
            other.push({
              path: parentPath,
              hash: hash,
              mode: modes.tree
            });
            if (!--left) {
              other.base = entries.base;
              if (other.length === 1 && other[0].path === "") {
                return callback(null, hash, tree);
              }
              fastUpdateTree(other, callback);
            }
          });
        });
      });
    }
  }


  function readRef(ref, callback) {
    if (!callback) return readRef.bind(repo, ref);
    if (ref === "HEAD") ref = "refs/heads/master";
    if (!(/^refs\//).test(ref)) {
      return callback(new TypeError("Invalid ref: " + ref));
    }
    return apiRequest("GET", "/repos/:root/git/" + ref, onRef);

    function onRef(err, xhr, result) {
      if (err) return callback(err);
      if (xhr.status === 404) return callback();
      if (xhr.status < 200 || xhr.status >= 300) {
        return callback(new Error("Invalid HTTP response: " + xhr.status + " " + result.message));
      }
      return callback(null, result.object.sha);
    }
  }

  function updateRef(ref, hash, callback, force) {
    if (!callback) return updateRef.bind(repo, ref, hash);
    if (!(/^refs\//).test(ref)) {
      return callback(new Error("Invalid ref: " + ref));
    }
    return apiRequest("PATCH", "/repos/:root/git/" + ref, {
      sha: hash,
      force: !!force
    }, onResult);

    function onResult(err, xhr, result) {
      if (err) return callback(err);
      if (xhr.status === 422 && result.message === "Reference does not exist") {
        return apiRequest("POST", "/repos/:root/git/refs", {
          ref: ref,
          sha: hash
        }, onResult);
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        return callback(new Error("Invalid HTTP response: " + xhr.status + " " + result.message));
      }
      if (err) return callback(err);
      callback(null, hash);
    }

  }

};

// GitHub has a nasty habit of stripping whitespace from messages and losing
// the timezone.  This information is required to make our hashes match up, so
// we guess it by mutating the value till the hash matches.
// If we're unable to match, we will just force the hash when saving to the cache.
function fixDate(type, value, hash) {
  if (type !== "commit" && type !== "tag") return;
  // Add up to 3 extra newlines and try all 30-minutes timezone offsets.
  var clone = JSON.parse(JSON.stringify(value));
  for (var x = 0; x < 3; x++) {
    for (var i = -720; i < 720; i += 30) {
      if (type === "commit") {
        clone.author.date.offset = i;
        clone.committer.date.offset = i;
      }
      else if (type === "tag") {
        clone.tagger.date.offset = i;
      }
      if (hash !== hashAs(type, clone)) continue;
      // Apply the changes and return.
      value.message = clone.message;
      if (type === "commit") {
        value.author.date.offset = clone.author.date.offset;
        value.committer.date.offset = clone.committer.date.offset;
      }
      else if (type === "tag") {
        value.tagger.date.offset = clone.tagger.date.offset;
      }
      return true;
    }
    clone.message += "\n";
  }
  return false;
}

function mapTreeEntry(entry) {
  if (!entry.mode) throw new TypeError("Invalid entry");
  var mode = modeToString(entry.mode);
  var item = {
    path: entry.path,
    mode: mode,
    type: modeToType[mode]
  };
  // Magic hash for empty file since github rejects empty contents.
  if (entry.content === "") entry.hash = emptyBlob;

  if (entry.hash) item.sha = entry.hash;
  else item.content = entry.content;
  return  item;
}

function encodeCommit(commit) {
  var out = {};
  out.message = commit.message;
  out.tree = commit.tree;
  if (commit.parents) out.parents = commit.parents;
  else if (commit.parent) out.parents = [commit.parent];
  else commit.parents = [];
  if (commit.author) out.author = encodePerson(commit.author);
  if (commit.committer) out.committer = encodePerson(commit.committer);
  return out;
}

function encodeTag(tag) {
  return {
    tag: tag.tag,
    message: tag.message,
    object: tag.object,
    tagger: encodePerson(tag.tagger)
  };
}

function encodePerson(person) {
  return {
    name: person.name,
    email: person.email,
    date: encodeDate(person.date)
  };
}

function encodeTree(tree) {
  return {
    tree: Object.keys(tree).map(function (name) {
      var entry = tree[name];
      var mode = modeToString(entry.mode);
      return {
        path: name,
        mode: mode,
        type: modeToType[mode],
        sha: entry.hash
      };
    })
  };
}

function encodeBlob(blob) {
  if (typeof blob === "string") return {
    content: bodec.encodeUtf8(blob),
    encoding: "utf-8"
  };
  if (bodec.isBinary(blob)) return {
    content: bodec.toBase64(blob),
    encoding: "base64"
  };
  throw new TypeError("Invalid blob type, must be binary or string");
}

function modeToString(mode) {
  var string = mode.toString(8);
  // Github likes all modes to be 6 chars long
  if (string.length === 5) string = "0" + string;
  return string;
}

function decodeCommit(result) {
  return {
    tree: result.tree.sha,
    parents: result.parents.map(function (object) {
      return object.sha;
    }),
    author: pickPerson(result.author),
    committer: pickPerson(result.committer),
    message: result.message
  };
}

function decodeTag(result) {
  return {
    object: result.object.sha,
    type: result.object.type,
    tag: result.tag,
    tagger: pickPerson(result.tagger),
    message: result.message
  };
}

function decodeTree(result) {
  var tree = {};
  result.tree.forEach(function (entry) {
    tree[entry.path] = {
      mode: parseInt(entry.mode, 8),
      hash: entry.sha
    };
  });
  return tree;
}

function decodeBlob(result) {
  if (result.encoding === 'base64') {
    return bodec.fromBase64(result.content.replace(/\n/g, ''));
  }
  if (result.encoding === 'utf-8') {
    return bodec.fromUtf8(result.content);
  }
  throw new Error("Unknown blob encoding: " + result.encoding);
}

function pickPerson(person) {
  return {
    name: person.name,
    email: person.email,
    date: parseDate(person.date)
  };
}

function parseDate(string) {
  // TODO: test this once GitHub adds timezone information
  var match = string.match(/(-?)([0-9]{2}):([0-9]{2})$/);
  var date = new Date(string);
  var timezoneOffset = 0;
  if (match) {
    timezoneOffset = (match[1] === "-" ? 1 : -1) * (
      parseInt(match[2], 10) * 60 + parseInt(match[3], 10)
    );
  }
  return {
    seconds: date.valueOf() / 1000,
    offset: timezoneOffset
  };
}

function encodeDate(date) {
  var seconds = date.seconds - (date.offset) * 60;
  var d = new Date(seconds * 1000);
  var string = d.toISOString();
  var hours = (date.offset / 60)|0;
  var minutes = date.offset % 60;
  string = string.substring(0, string.lastIndexOf(".")) +
    (date.offset > 0 ? "-" : "+") +
    twoDigit(hours) + ":" + twoDigit(minutes);
  return string;
}

// Run some quick unit tests to make sure date encoding works.
[
  { offset: 300, seconds: 1401938626 },
  { offset: 400, seconds: 1401938626 }
].forEach(function (date) {
  var verify = parseDate(encodeDate(date));
  if (verify.seconds !== date.seconds || verify.offset !== date.offset) {
    throw new Error("Verification failure testing date encoding");
  }
});

function twoDigit(num) {
  if (num < 10) return "0" + num;
  return "" + num;
}

function singleCall(callback) {
  var done = false;
  return function () {
    if (done) return console.warn("Discarding extra callback");
    done = true;
    return callback.apply(this, arguments);
  };
}

function hashAs(type, body) {
  var buffer = frame({type: type, body: body});
  return sha1(buffer);
}

},{"../lib/xhr":7,"bodec":9,"git-sha1":10,"js-git/lib/modes":1,"js-git/lib/object-codec":2}],9:[function(require,module,exports){
arguments[4][6][0].apply(exports,arguments)
},{"_process":13,"dup":6}],10:[function(require,module,exports){
(function (process){
"use strict";

var isNode = typeof process === 'object' &&
             typeof process.versions === 'object' &&
             process.versions.node &&
             process.__atom_type !== "renderer";

var shared, create, crypto;
if (isNode) {
  var nodeRequire = require; // Prevent mine.js from seeing this require
  crypto = nodeRequire('crypto');
  create = createNode;
}
else {
  shared = new Uint32Array(80);
  create = createJs;
}


// Input chunks must be either arrays of bytes or "raw" encoded strings
module.exports = function sha1(buffer) {
  if (buffer === undefined) return create(false);
  var shasum = create(true);
  shasum.update(buffer);
  return shasum.digest();
};

// Use node's openssl bindings when available
function createNode() {
  var shasum = crypto.createHash('sha1');
  return {
    update: function (buffer) {
      return shasum.update(buffer);
    },
    digest: function () {
      return shasum.digest('hex');
    }
  };
}

// A pure JS implementation of sha1 for non-node environments.
function createJs(sync) {
  var h0 = 0x67452301;
  var h1 = 0xEFCDAB89;
  var h2 = 0x98BADCFE;
  var h3 = 0x10325476;
  var h4 = 0xC3D2E1F0;
  // The first 64 bytes (16 words) is the data chunk
  var block, offset = 0, shift = 24;
  var totalLength = 0;
  if (sync) block = shared;
  else block = new Uint32Array(80);

  return { update: update, digest: digest };

  // The user gave us more data.  Store it!
  function update(chunk) {
    if (typeof chunk === "string") return updateString(chunk);
    var length = chunk.length;
    totalLength += length * 8;
    for (var i = 0; i < length; i++) {
      write(chunk[i]);
    }
  }

  function updateString(string) {
    var length = string.length;
    totalLength += length * 8;
    for (var i = 0; i < length; i++) {
      write(string.charCodeAt(i));
    }
  }


  function write(byte) {
    block[offset] |= (byte & 0xff) << shift;
    if (shift) {
      shift -= 8;
    }
    else {
      offset++;
      shift = 24;
    }
    if (offset === 16) processBlock();
  }

  // No more data will come, pad the block, process and return the result.
  function digest() {
    // Pad
    write(0x80);
    if (offset > 14 || (offset === 14 && shift < 24)) {
      processBlock();
    }
    offset = 14;
    shift = 24;

    // 64-bit length big-endian
    write(0x00); // numbers this big aren't accurate in javascript anyway
    write(0x00); // ..So just hard-code to zero.
    write(totalLength > 0xffffffffff ? totalLength / 0x10000000000 : 0x00);
    write(totalLength > 0xffffffff ? totalLength / 0x100000000 : 0x00);
    for (var s = 24; s >= 0; s -= 8) {
      write(totalLength >> s);
    }

    // At this point one last processBlock() should trigger and we can pull out the result.
    return toHex(h0) +
           toHex(h1) +
           toHex(h2) +
           toHex(h3) +
           toHex(h4);
  }

  // We have a full block to process.  Let's do it!
  function processBlock() {
    // Extend the sixteen 32-bit words into eighty 32-bit words:
    for (var i = 16; i < 80; i++) {
      var w = block[i - 3] ^ block[i - 8] ^ block[i - 14] ^ block[i - 16];
      block[i] = (w << 1) | (w >>> 31);
    }

    // log(block);

    // Initialize hash value for this chunk:
    var a = h0;
    var b = h1;
    var c = h2;
    var d = h3;
    var e = h4;
    var f, k;

    // Main loop:
    for (i = 0; i < 80; i++) {
      if (i < 20) {
        f = d ^ (b & (c ^ d));
        k = 0x5A827999;
      }
      else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ED9EBA1;
      }
      else if (i < 60) {
        f = (b & c) | (d & (b | c));
        k = 0x8F1BBCDC;
      }
      else {
        f = b ^ c ^ d;
        k = 0xCA62C1D6;
      }
      var temp = (a << 5 | a >>> 27) + f + e + k + (block[i]|0);
      e = d;
      d = c;
      c = (b << 30 | b >>> 2);
      b = a;
      a = temp;
    }

    // Add this chunk's hash to result so far:
    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;

    // The block is now reusable.
    offset = 0;
    for (i = 0; i < 16; i++) {
      block[i] = 0;
    }
  }

  function toHex(word) {
    var hex = "";
    for (var i = 28; i >= 0; i -= 4) {
      hex += ((word >> i) & 0xf).toString(16);
    }
    return hex;
  }

}

}).call(this,require('_process'))
},{"_process":13}],11:[function(require,module,exports){
//     Underscore.js 1.8.3
//     http://underscorejs.org
//     (c) 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `exports` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var
    push             = ArrayProto.push,
    slice            = ArrayProto.slice,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind,
    nativeCreate       = Object.create;

  // Naked function reference for surrogate-prototype-swapping.
  var Ctor = function(){};

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.8.3';

  // Internal function that returns an efficient (for current engines) version
  // of the passed-in callback, to be repeatedly applied in other Underscore
  // functions.
  var optimizeCb = function(func, context, argCount) {
    if (context === void 0) return func;
    switch (argCount == null ? 3 : argCount) {
      case 1: return function(value) {
        return func.call(context, value);
      };
      case 2: return function(value, other) {
        return func.call(context, value, other);
      };
      case 3: return function(value, index, collection) {
        return func.call(context, value, index, collection);
      };
      case 4: return function(accumulator, value, index, collection) {
        return func.call(context, accumulator, value, index, collection);
      };
    }
    return function() {
      return func.apply(context, arguments);
    };
  };

  // A mostly-internal function to generate callbacks that can be applied
  // to each element in a collection, returning the desired result — either
  // identity, an arbitrary callback, a property matcher, or a property accessor.
  var cb = function(value, context, argCount) {
    if (value == null) return _.identity;
    if (_.isFunction(value)) return optimizeCb(value, context, argCount);
    if (_.isObject(value)) return _.matcher(value);
    return _.property(value);
  };
  _.iteratee = function(value, context) {
    return cb(value, context, Infinity);
  };

  // An internal function for creating assigner functions.
  var createAssigner = function(keysFunc, undefinedOnly) {
    return function(obj) {
      var length = arguments.length;
      if (length < 2 || obj == null) return obj;
      for (var index = 1; index < length; index++) {
        var source = arguments[index],
            keys = keysFunc(source),
            l = keys.length;
        for (var i = 0; i < l; i++) {
          var key = keys[i];
          if (!undefinedOnly || obj[key] === void 0) obj[key] = source[key];
        }
      }
      return obj;
    };
  };

  // An internal function for creating a new object that inherits from another.
  var baseCreate = function(prototype) {
    if (!_.isObject(prototype)) return {};
    if (nativeCreate) return nativeCreate(prototype);
    Ctor.prototype = prototype;
    var result = new Ctor;
    Ctor.prototype = null;
    return result;
  };

  var property = function(key) {
    return function(obj) {
      return obj == null ? void 0 : obj[key];
    };
  };

  // Helper for collection methods to determine whether a collection
  // should be iterated as an array or as an object
  // Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
  // Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094
  var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
  var getLength = property('length');
  var isArrayLike = function(collection) {
    var length = getLength(collection);
    return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
  };

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles raw objects in addition to array-likes. Treats all
  // sparse array-likes as if they were dense.
  _.each = _.forEach = function(obj, iteratee, context) {
    iteratee = optimizeCb(iteratee, context);
    var i, length;
    if (isArrayLike(obj)) {
      for (i = 0, length = obj.length; i < length; i++) {
        iteratee(obj[i], i, obj);
      }
    } else {
      var keys = _.keys(obj);
      for (i = 0, length = keys.length; i < length; i++) {
        iteratee(obj[keys[i]], keys[i], obj);
      }
    }
    return obj;
  };

  // Return the results of applying the iteratee to each element.
  _.map = _.collect = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length,
        results = Array(length);
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      results[index] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  };

  // Create a reducing function iterating left or right.
  function createReduce(dir) {
    // Optimized iterator function as using arguments.length
    // in the main function will deoptimize the, see #1991.
    function iterator(obj, iteratee, memo, keys, index, length) {
      for (; index >= 0 && index < length; index += dir) {
        var currentKey = keys ? keys[index] : index;
        memo = iteratee(memo, obj[currentKey], currentKey, obj);
      }
      return memo;
    }

    return function(obj, iteratee, memo, context) {
      iteratee = optimizeCb(iteratee, context, 4);
      var keys = !isArrayLike(obj) && _.keys(obj),
          length = (keys || obj).length,
          index = dir > 0 ? 0 : length - 1;
      // Determine the initial value if none is provided.
      if (arguments.length < 3) {
        memo = obj[keys ? keys[index] : index];
        index += dir;
      }
      return iterator(obj, iteratee, memo, keys, index, length);
    };
  }

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`.
  _.reduce = _.foldl = _.inject = createReduce(1);

  // The right-associative version of reduce, also known as `foldr`.
  _.reduceRight = _.foldr = createReduce(-1);

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, predicate, context) {
    var key;
    if (isArrayLike(obj)) {
      key = _.findIndex(obj, predicate, context);
    } else {
      key = _.findKey(obj, predicate, context);
    }
    if (key !== void 0 && key !== -1) return obj[key];
  };

  // Return all the elements that pass a truth test.
  // Aliased as `select`.
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    predicate = cb(predicate, context);
    _.each(obj, function(value, index, list) {
      if (predicate(value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, _.negate(cb(predicate)), context);
  };

  // Determine whether all of the elements match a truth test.
  // Aliased as `all`.
  _.every = _.all = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (!predicate(obj[currentKey], currentKey, obj)) return false;
    }
    return true;
  };

  // Determine if at least one element in the object matches a truth test.
  // Aliased as `any`.
  _.some = _.any = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (predicate(obj[currentKey], currentKey, obj)) return true;
    }
    return false;
  };

  // Determine if the array or object contains a given item (using `===`).
  // Aliased as `includes` and `include`.
  _.contains = _.includes = _.include = function(obj, item, fromIndex, guard) {
    if (!isArrayLike(obj)) obj = _.values(obj);
    if (typeof fromIndex != 'number' || guard) fromIndex = 0;
    return _.indexOf(obj, item, fromIndex) >= 0;
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      var func = isFunc ? method : value[method];
      return func == null ? func : func.apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matcher(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matcher(attrs));
  };

  // Return the maximum element (or element-based computation).
  _.max = function(obj, iteratee, context) {
    var result = -Infinity, lastComputed = -Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value > result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iteratee, context) {
    var result = Infinity, lastComputed = Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value < result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed < lastComputed || computed === Infinity && result === Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Shuffle a collection, using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  _.shuffle = function(obj) {
    var set = isArrayLike(obj) ? obj : _.values(obj);
    var length = set.length;
    var shuffled = Array(length);
    for (var index = 0, rand; index < length; index++) {
      rand = _.random(0, index);
      if (rand !== index) shuffled[index] = shuffled[rand];
      shuffled[rand] = set[index];
    }
    return shuffled;
  };

  // Sample **n** random values from a collection.
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  _.sample = function(obj, n, guard) {
    if (n == null || guard) {
      if (!isArrayLike(obj)) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }
    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // Sort the object's values by a criterion produced by an iteratee.
  _.sortBy = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value: value,
        index: index,
        criteria: iteratee(value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(behavior) {
    return function(obj, iteratee, context) {
      var result = {};
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index) {
        var key = iteratee(value, index, obj);
        behavior(result, value, key);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key].push(value); else result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  _.indexBy = group(function(result, value, key) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key]++; else result[key] = 1;
  });

  // Safely create a real, live array from anything iterable.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (isArrayLike(obj)) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return isArrayLike(obj) ? obj.length : _.keys(obj).length;
  };

  // Split a collection into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  _.partition = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var pass = [], fail = [];
    _.each(obj, function(value, key, obj) {
      (predicate(value, key, obj) ? pass : fail).push(value);
    });
    return [pass, fail];
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[0];
    return _.initial(array, array.length - n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array.
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[array.length - 1];
    return _.rest(array, Math.max(0, array.length - n));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, n == null || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, strict, startIndex) {
    var output = [], idx = 0;
    for (var i = startIndex || 0, length = getLength(input); i < length; i++) {
      var value = input[i];
      if (isArrayLike(value) && (_.isArray(value) || _.isArguments(value))) {
        //flatten current level of array or arguments object
        if (!shallow) value = flatten(value, shallow, strict);
        var j = 0, len = value.length;
        output.length += len;
        while (j < len) {
          output[idx++] = value[j++];
        }
      } else if (!strict) {
        output[idx++] = value;
      }
    }
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, false);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iteratee, context) {
    if (!_.isBoolean(isSorted)) {
      context = iteratee;
      iteratee = isSorted;
      isSorted = false;
    }
    if (iteratee != null) iteratee = cb(iteratee, context);
    var result = [];
    var seen = [];
    for (var i = 0, length = getLength(array); i < length; i++) {
      var value = array[i],
          computed = iteratee ? iteratee(value, i, array) : value;
      if (isSorted) {
        if (!i || seen !== computed) result.push(value);
        seen = computed;
      } else if (iteratee) {
        if (!_.contains(seen, computed)) {
          seen.push(computed);
          result.push(value);
        }
      } else if (!_.contains(result, value)) {
        result.push(value);
      }
    }
    return result;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(flatten(arguments, true, true));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    var result = [];
    var argsLength = arguments.length;
    for (var i = 0, length = getLength(array); i < length; i++) {
      var item = array[i];
      if (_.contains(result, item)) continue;
      for (var j = 1; j < argsLength; j++) {
        if (!_.contains(arguments[j], item)) break;
      }
      if (j === argsLength) result.push(item);
    }
    return result;
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = flatten(arguments, true, true, 1);
    return _.filter(array, function(value){
      return !_.contains(rest, value);
    });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function() {
    return _.unzip(arguments);
  };

  // Complement of _.zip. Unzip accepts an array of arrays and groups
  // each array's elements on shared indices
  _.unzip = function(array) {
    var length = array && _.max(array, getLength).length || 0;
    var result = Array(length);

    for (var index = 0; index < length; index++) {
      result[index] = _.pluck(array, index);
    }
    return result;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    var result = {};
    for (var i = 0, length = getLength(list); i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // Generator function to create the findIndex and findLastIndex functions
  function createPredicateIndexFinder(dir) {
    return function(array, predicate, context) {
      predicate = cb(predicate, context);
      var length = getLength(array);
      var index = dir > 0 ? 0 : length - 1;
      for (; index >= 0 && index < length; index += dir) {
        if (predicate(array[index], index, array)) return index;
      }
      return -1;
    };
  }

  // Returns the first index on an array-like that passes a predicate test
  _.findIndex = createPredicateIndexFinder(1);
  _.findLastIndex = createPredicateIndexFinder(-1);

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iteratee, context) {
    iteratee = cb(iteratee, context, 1);
    var value = iteratee(obj);
    var low = 0, high = getLength(array);
    while (low < high) {
      var mid = Math.floor((low + high) / 2);
      if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
    }
    return low;
  };

  // Generator function to create the indexOf and lastIndexOf functions
  function createIndexFinder(dir, predicateFind, sortedIndex) {
    return function(array, item, idx) {
      var i = 0, length = getLength(array);
      if (typeof idx == 'number') {
        if (dir > 0) {
            i = idx >= 0 ? idx : Math.max(idx + length, i);
        } else {
            length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
        }
      } else if (sortedIndex && idx && length) {
        idx = sortedIndex(array, item);
        return array[idx] === item ? idx : -1;
      }
      if (item !== item) {
        idx = predicateFind(slice.call(array, i, length), _.isNaN);
        return idx >= 0 ? idx + i : -1;
      }
      for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
        if (array[idx] === item) return idx;
      }
      return -1;
    };
  }

  // Return the position of the first occurrence of an item in an array,
  // or -1 if the item is not included in the array.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);
  _.lastIndexOf = createIndexFinder(-1, _.findLastIndex);

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (stop == null) {
      stop = start || 0;
      start = 0;
    }
    step = step || 1;

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var range = Array(length);

    for (var idx = 0; idx < length; idx++, start += step) {
      range[idx] = start;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Determines whether to execute a function as a constructor
  // or a normal function with the provided arguments
  var executeBound = function(sourceFunc, boundFunc, context, callingContext, args) {
    if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
    var self = baseCreate(sourceFunc.prototype);
    var result = sourceFunc.apply(self, args);
    if (_.isObject(result)) return result;
    return self;
  };

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = function(func, context) {
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
    var args = slice.call(arguments, 2);
    var bound = function() {
      return executeBound(func, bound, context, this, args.concat(slice.call(arguments)));
    };
    return bound;
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder, allowing any combination of arguments to be pre-filled.
  _.partial = function(func) {
    var boundArgs = slice.call(arguments, 1);
    var bound = function() {
      var position = 0, length = boundArgs.length;
      var args = Array(length);
      for (var i = 0; i < length; i++) {
        args[i] = boundArgs[i] === _ ? arguments[position++] : boundArgs[i];
      }
      while (position < arguments.length) args.push(arguments[position++]);
      return executeBound(func, bound, this, this, args);
    };
    return bound;
  };

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  _.bindAll = function(obj) {
    var i, length = arguments.length, key;
    if (length <= 1) throw new Error('bindAll must be passed function names');
    for (i = 1; i < length; i++) {
      key = arguments[i];
      obj[key] = _.bind(obj[key], obj);
    }
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memoize = function(key) {
      var cache = memoize.cache;
      var address = '' + (hasher ? hasher.apply(this, arguments) : key);
      if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
      return cache[address];
    };
    memoize.cache = {};
    return memoize;
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){
      return func.apply(null, args);
    }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = _.partial(_.delay, _, 1);

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  _.throttle = function(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    if (!options) options = {};
    var later = function() {
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    };
    return function() {
      var now = _.now();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, args, context, timestamp, result;

    var later = function() {
      var last = _.now() - timestamp;

      if (last < wait && last >= 0) {
        timeout = setTimeout(later, wait - last);
      } else {
        timeout = null;
        if (!immediate) {
          result = func.apply(context, args);
          if (!timeout) context = args = null;
        }
      }
    };

    return function() {
      context = this;
      args = arguments;
      timestamp = _.now();
      var callNow = immediate && !timeout;
      if (!timeout) timeout = setTimeout(later, wait);
      if (callNow) {
        result = func.apply(context, args);
        context = args = null;
      }

      return result;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a negated version of the passed-in predicate.
  _.negate = function(predicate) {
    return function() {
      return !predicate.apply(this, arguments);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var args = arguments;
    var start = args.length - 1;
    return function() {
      var i = start;
      var result = args[start].apply(this, arguments);
      while (i--) result = args[i].call(this, result);
      return result;
    };
  };

  // Returns a function that will only be executed on and after the Nth call.
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Returns a function that will only be executed up to (but not including) the Nth call.
  _.before = function(times, func) {
    var memo;
    return function() {
      if (--times > 0) {
        memo = func.apply(this, arguments);
      }
      if (times <= 1) func = null;
      return memo;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = _.partial(_.before, 2);

  // Object Functions
  // ----------------

  // Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
  var hasEnumBug = !{toString: null}.propertyIsEnumerable('toString');
  var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
                      'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];

  function collectNonEnumProps(obj, keys) {
    var nonEnumIdx = nonEnumerableProps.length;
    var constructor = obj.constructor;
    var proto = (_.isFunction(constructor) && constructor.prototype) || ObjProto;

    // Constructor is a special case.
    var prop = 'constructor';
    if (_.has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);

    while (nonEnumIdx--) {
      prop = nonEnumerableProps[nonEnumIdx];
      if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
        keys.push(prop);
      }
    }
  }

  // Retrieve the names of an object's own properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve all the property names of an object.
  _.allKeys = function(obj) {
    if (!_.isObject(obj)) return [];
    var keys = [];
    for (var key in obj) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Returns the results of applying the iteratee to each element of the object
  // In contrast to _.map it returns an object
  _.mapObject = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys =  _.keys(obj),
          length = keys.length,
          results = {},
          currentKey;
      for (var index = 0; index < length; index++) {
        currentKey = keys[index];
        results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
      }
      return results;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = createAssigner(_.allKeys);

  // Assigns a given object with all the own properties in the passed-in object(s)
  // (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
  _.extendOwn = _.assign = createAssigner(_.keys);

  // Returns the first key on an object that passes a predicate test
  _.findKey = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = _.keys(obj), key;
    for (var i = 0, length = keys.length; i < length; i++) {
      key = keys[i];
      if (predicate(obj[key], key, obj)) return key;
    }
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(object, oiteratee, context) {
    var result = {}, obj = object, iteratee, keys;
    if (obj == null) return result;
    if (_.isFunction(oiteratee)) {
      keys = _.allKeys(obj);
      iteratee = optimizeCb(oiteratee, context);
    } else {
      keys = flatten(arguments, false, false, 1);
      iteratee = function(value, key, obj) { return key in obj; };
      obj = Object(obj);
    }
    for (var i = 0, length = keys.length; i < length; i++) {
      var key = keys[i];
      var value = obj[key];
      if (iteratee(value, key, obj)) result[key] = value;
    }
    return result;
  };

   // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj, iteratee, context) {
    if (_.isFunction(iteratee)) {
      iteratee = _.negate(iteratee);
    } else {
      var keys = _.map(flatten(arguments, false, false, 1), String);
      iteratee = function(value, key) {
        return !_.contains(keys, key);
      };
    }
    return _.pick(obj, iteratee, context);
  };

  // Fill in a given object with default properties.
  _.defaults = createAssigner(_.allKeys, true);

  // Creates an object that inherits from the given prototype object.
  // If additional properties are provided then they will be added to the
  // created object.
  _.create = function(prototype, props) {
    var result = baseCreate(prototype);
    if (props) _.extendOwn(result, props);
    return result;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Returns whether an object has a given set of `key:value` pairs.
  _.isMatch = function(object, attrs) {
    var keys = _.keys(attrs), length = keys.length;
    if (object == null) return !length;
    var obj = Object(object);
    for (var i = 0; i < length; i++) {
      var key = keys[i];
      if (attrs[key] !== obj[key] || !(key in obj)) return false;
    }
    return true;
  };


  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a === 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className !== toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, regular expressions, dates, and booleans are compared by value.
      case '[object RegExp]':
      // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return '' + a === '' + b;
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive.
        // Object(NaN) is equivalent to NaN
        if (+a !== +a) return +b !== +b;
        // An `egal` comparison is performed for other numeric values.
        return +a === 0 ? 1 / +a === 1 / b : +a === +b;
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a === +b;
    }

    var areArrays = className === '[object Array]';
    if (!areArrays) {
      if (typeof a != 'object' || typeof b != 'object') return false;

      // Objects with different constructors are not equivalent, but `Object`s or `Array`s
      // from different frames are.
      var aCtor = a.constructor, bCtor = b.constructor;
      if (aCtor !== bCtor && !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
                               _.isFunction(bCtor) && bCtor instanceof bCtor)
                          && ('constructor' in a && 'constructor' in b)) {
        return false;
      }
    }
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.

    // Initializing stack of traversed objects.
    // It's done here since we only need them for objects and arrays comparison.
    aStack = aStack || [];
    bStack = bStack || [];
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] === a) return bStack[length] === b;
    }

    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);

    // Recursively compare objects and arrays.
    if (areArrays) {
      // Compare array lengths to determine if a deep comparison is necessary.
      length = a.length;
      if (length !== b.length) return false;
      // Deep compare the contents, ignoring non-numeric properties.
      while (length--) {
        if (!eq(a[length], b[length], aStack, bStack)) return false;
      }
    } else {
      // Deep compare objects.
      var keys = _.keys(a), key;
      length = keys.length;
      // Ensure that both objects contain the same number of properties before comparing deep equality.
      if (_.keys(b).length !== length) return false;
      while (length--) {
        // Deep compare each member
        key = keys[length];
        if (!(_.has(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return true;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;
    return _.keys(obj).length === 0;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) === '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError.
  _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) === '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE < 9), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return _.has(obj, 'callee');
    };
  }

  // Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
  // IE 11 (#1621), and in Safari 8 (#1929).
  if (typeof /./ != 'function' && typeof Int8Array != 'object') {
    _.isFunction = function(obj) {
      return typeof obj == 'function' || false;
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj !== +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, key) {
    return obj != null && hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iteratees.
  _.identity = function(value) {
    return value;
  };

  // Predicate-generating functions. Often useful outside of Underscore.
  _.constant = function(value) {
    return function() {
      return value;
    };
  };

  _.noop = function(){};

  _.property = property;

  // Generates a function for a given object that returns a given property.
  _.propertyOf = function(obj) {
    return obj == null ? function(){} : function(key) {
      return obj[key];
    };
  };

  // Returns a predicate for checking whether an object has a given set of
  // `key:value` pairs.
  _.matcher = _.matches = function(attrs) {
    attrs = _.extendOwn({}, attrs);
    return function(obj) {
      return _.isMatch(obj, attrs);
    };
  };

  // Run a function **n** times.
  _.times = function(n, iteratee, context) {
    var accum = Array(Math.max(0, n));
    iteratee = optimizeCb(iteratee, context, 1);
    for (var i = 0; i < n; i++) accum[i] = iteratee(i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  _.now = Date.now || function() {
    return new Date().getTime();
  };

   // List of HTML entities for escaping.
  var escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
  };
  var unescapeMap = _.invert(escapeMap);

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  var createEscaper = function(map) {
    var escaper = function(match) {
      return map[match];
    };
    // Regexes for identifying a key that needs to be escaped
    var source = '(?:' + _.keys(map).join('|') + ')';
    var testRegexp = RegExp(source);
    var replaceRegexp = RegExp(source, 'g');
    return function(string) {
      string = string == null ? '' : '' + string;
      return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
    };
  };
  _.escape = createEscaper(escapeMap);
  _.unescape = createEscaper(unescapeMap);

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  _.result = function(object, property, fallback) {
    var value = object == null ? void 0 : object[property];
    if (value === void 0) {
      value = fallback;
    }
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\u2028|\u2029/g;

  var escapeChar = function(match) {
    return '\\' + escapes[match];
  };

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  // NB: `oldSettings` only exists for backwards compatibility.
  _.template = function(text, settings, oldSettings) {
    if (!settings && oldSettings) settings = oldSettings;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset).replace(escaper, escapeChar);
      index = offset + match.length;

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      } else if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      } else if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }

      // Adobe VMs need the match returned to produce the correct offest.
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + 'return __p;\n';

    try {
      var render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled source as a convenience for precompilation.
    var argument = settings.variable || 'obj';
    template.source = 'function(' + argument + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function. Start chaining a wrapped Underscore object.
  _.chain = function(obj) {
    var instance = _(obj);
    instance._chain = true;
    return instance;
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(instance, obj) {
    return instance._chain ? _(obj).chain() : obj;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    _.each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result(this, func.apply(_, args));
      };
    });
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
      return result(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  _.each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result(this, method.apply(this._wrapped, arguments));
    };
  });

  // Extracts the result from a wrapped and chained object.
  _.prototype.value = function() {
    return this._wrapped;
  };

  // Provide unwrapping proxy for some methods used in engine operations
  // such as arithmetic and JSON stringification.
  _.prototype.valueOf = _.prototype.toJSON = _.prototype.value;

  _.prototype.toString = function() {
    return '' + this._wrapped;
  };

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
  if (typeof define === 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}.call(this));

},{}],12:[function(require,module,exports){
window.getRepo = function(repoName){
    
    var repo = {};
    require('js-github/mixins/github-db')(repo, repoName, cheddar.user.github.token);
    require('js-git/mixins/create-tree')(repo);
    require('js-git/mixins/read-combiner')(repo);
    require('js-git/mixins/formats')(repo);
    window._ = require('underscore');
    window.modes = require('js-git/lib/modes');
    return repo;
};



},{"js-git/lib/modes":1,"js-git/mixins/create-tree":3,"js-git/mixins/formats":4,"js-git/mixins/read-combiner":5,"js-github/mixins/github-db":8,"underscore":11}],13:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            currentQueue[queueIndex].run();
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}]},{},[12]);
