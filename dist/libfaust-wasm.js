var FaustModule = (function () {
  var _scriptDir = typeof document !== 'undefined' && document.currentScript ? document.currentScript.src : undefined;
  return (
    function (FaustModule) {
      FaustModule = FaustModule || {};

      var Module = typeof FaustModule !== "undefined" ? FaustModule : {};
      var moduleOverrides = {};
      var key;
      for (key in Module) {
        if (Module.hasOwnProperty(key)) {
          moduleOverrides[key] = Module[key]
        }
      }
      Module["arguments"] = [];
      Module["thisProgram"] = "./this.program";
      Module["quit"] = function (status, toThrow) {
        throw toThrow
      };
      Module["preRun"] = [];
      Module["postRun"] = [];
      var ENVIRONMENT_IS_WEB = false;
      var ENVIRONMENT_IS_WORKER = false;
      var ENVIRONMENT_IS_NODE = false;
      var ENVIRONMENT_IS_SHELL = false;
      ENVIRONMENT_IS_WEB = typeof window === "object";
      ENVIRONMENT_IS_WORKER = typeof importScripts === "function";
      ENVIRONMENT_IS_NODE = typeof process === "object" && typeof require === "function" && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
      ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
      if (Module["ENVIRONMENT"]) {
        throw new Error("Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -s ENVIRONMENT=web or -s ENVIRONMENT=node)")
      }
      var scriptDirectory = "";

      function locateFile(path) {
        if (Module["locateFile"]) {
          return Module["locateFile"](path, scriptDirectory)
        } else {
          return scriptDirectory + path
        }
      }
      if (ENVIRONMENT_IS_NODE) {
        scriptDirectory = __dirname + "/";
        var nodeFS;
        var nodePath;
        Module["read"] = function shell_read(filename, binary) {
          var ret;
          if (!nodeFS) nodeFS = require("fs");
          if (!nodePath) nodePath = require("path");
          filename = nodePath["normalize"](filename);
          ret = nodeFS["readFileSync"](filename);
          return binary ? ret : ret.toString()
        };
        Module["readBinary"] = function readBinary(filename) {
          var ret = Module["read"](filename, true);
          if (!ret.buffer) {
            ret = new Uint8Array(ret)
          }
          assert(ret.buffer);
          return ret
        };
        if (process["argv"].length > 1) {
          Module["thisProgram"] = process["argv"][1].replace(/\\/g, "/")
        }
        Module["arguments"] = process["argv"].slice(2);
        process["on"]("uncaughtException", function (ex) {
          if (!(ex instanceof ExitStatus)) {
            throw ex
          }
        });
        process["on"]("unhandledRejection", abort);
        Module["quit"] = function (status) {
          process["exit"](status)
        };
        Module["inspect"] = function () {
          return "[Emscripten Module object]"
        }
      } else if (ENVIRONMENT_IS_SHELL) {
        if (typeof read != "undefined") {
          Module["read"] = function shell_read(f) {
            return read(f)
          }
        }
        Module["readBinary"] = function readBinary(f) {
          var data;
          if (typeof readbuffer === "function") {
            return new Uint8Array(readbuffer(f))
          }
          data = read(f, "binary");
          assert(typeof data === "object");
          return data
        };
        if (typeof scriptArgs != "undefined") {
          Module["arguments"] = scriptArgs
        } else if (typeof arguments != "undefined") {
          Module["arguments"] = arguments
        }
        if (typeof quit === "function") {
          Module["quit"] = function (status) {
            quit(status)
          }
        }
      } else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
        if (ENVIRONMENT_IS_WORKER) {
          scriptDirectory = self.location.href
        } else if (document.currentScript) {
          scriptDirectory = document.currentScript.src
        }
        if (_scriptDir) {
          scriptDirectory = _scriptDir
        }
        if (scriptDirectory.indexOf("blob:") !== 0) {
          scriptDirectory = scriptDirectory.substr(0, scriptDirectory.lastIndexOf("/") + 1)
        } else {
          scriptDirectory = ""
        }
        Module["read"] = function shell_read(url) {
          var xhr = new XMLHttpRequest;
          xhr.open("GET", url, false);
          xhr.send(null);
          return xhr.responseText
        };
        if (ENVIRONMENT_IS_WORKER) {
          Module["readBinary"] = function readBinary(url) {
            var xhr = new XMLHttpRequest;
            xhr.open("GET", url, false);
            xhr.responseType = "arraybuffer";
            xhr.send(null);
            return new Uint8Array(xhr.response)
          }
        }
        Module["readAsync"] = function readAsync(url, onload, onerror) {
          var xhr = new XMLHttpRequest;
          xhr.open("GET", url, true);
          xhr.responseType = "arraybuffer";
          xhr.onload = function xhr_onload() {
            if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
              onload(xhr.response);
              return
            }
            onerror()
          };
          xhr.onerror = onerror;
          xhr.send(null)
        };
        Module["setWindowTitle"] = function (title) {
          document.title = title
        }
      } else {
        throw new Error("environment detection error")
      }
      var out = Module["print"] || (typeof console !== "undefined" ? console.log.bind(console) : typeof print !== "undefined" ? print : null);
      var err = Module["printErr"] || (typeof printErr !== "undefined" ? printErr : typeof console !== "undefined" && console.warn.bind(console) || out);
      for (key in moduleOverrides) {
        if (moduleOverrides.hasOwnProperty(key)) {
          Module[key] = moduleOverrides[key]
        }
      }
      moduleOverrides = undefined;
      assert(typeof Module["memoryInitializerPrefixURL"] === "undefined", "Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead");
      assert(typeof Module["pthreadMainPrefixURL"] === "undefined", "Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead");
      assert(typeof Module["cdInitializerPrefixURL"] === "undefined", "Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead");
      assert(typeof Module["filePackagePrefixURL"] === "undefined", "Module.filePackagePrefixURL option was removed, use Module.locateFile instead");
      stackSave = stackRestore = stackAlloc = function () {
        abort("cannot use the stack before compiled code is ready to run, and has provided stack access")
      };

      function dynamicAlloc(size) {
        assert(DYNAMICTOP_PTR);
        var ret = HEAP32[DYNAMICTOP_PTR >> 2];
        var end = ret + size + 15 & -16;
        if (end <= _emscripten_get_heap_size()) {
          HEAP32[DYNAMICTOP_PTR >> 2] = end
        } else {
          var success = _emscripten_resize_heap(end);
          if (!success) return 0
        }
        return ret
      }

      function getNativeTypeSize(type) {
        switch (type) {
          case "i1":
          case "i8":
            return 1;
          case "i16":
            return 2;
          case "i32":
            return 4;
          case "i64":
            return 8;
          case "float":
            return 4;
          case "double":
            return 8;
          default:
            {
              if (type[type.length - 1] === "*") {
                return 4
              } else if (type[0] === "i") {
                var bits = parseInt(type.substr(1));
                assert(bits % 8 === 0, "getNativeTypeSize invalid bits " + bits + ", type " + type);
                return bits / 8
              } else {
                return 0
              }
            }
        }
      }

      function warnOnce(text) {
        if (!warnOnce.shown) warnOnce.shown = {};
        if (!warnOnce.shown[text]) {
          warnOnce.shown[text] = 1;
          err(text)
        }
      }
      var asm2wasmImports = {
        "f64-rem": function (x, y) {
          return x % y
        },
        "debugger": function () {
          debugger
        }
      };
      var functionPointers = new Array(0);
      if (typeof WebAssembly !== "object") {
        abort("No WebAssembly support found. Build with -s WASM=0 to target JavaScript instead.")
      }
      var wasmMemory;
      var wasmTable;
      var ABORT = false;
      var EXITSTATUS = 0;

      function assert(condition, text) {
        if (!condition) {
          abort("Assertion failed: " + text)
        }
      }

      function getCFunc(ident) {
        var func = Module["_" + ident];
        assert(func, "Cannot call unknown function " + ident + ", make sure it is exported");
        return func
      }

      function ccall(ident, returnType, argTypes, args, opts) {
        var toC = {
          "string": function (str) {
            var ret = 0;
            if (str !== null && str !== undefined && str !== 0) {
              var len = (str.length << 2) + 1;
              ret = stackAlloc(len);
              stringToUTF8(str, ret, len)
            }
            return ret
          },
          "array": function (arr) {
            var ret = stackAlloc(arr.length);
            writeArrayToMemory(arr, ret);
            return ret
          }
        };

        function convertReturnValue(ret) {
          if (returnType === "string") return UTF8ToString(ret);
          if (returnType === "boolean") return Boolean(ret);
          return ret
        }
        var func = getCFunc(ident);
        var cArgs = [];
        var stack = 0;
        assert(returnType !== "array", 'Return type should not be "array".');
        if (args) {
          for (var i = 0; i < args.length; i++) {
            var converter = toC[argTypes[i]];
            if (converter) {
              if (stack === 0) stack = stackSave();
              cArgs[i] = converter(args[i])
            } else {
              cArgs[i] = args[i]
            }
          }
        }
        var ret = func.apply(null, cArgs);
        ret = convertReturnValue(ret);
        if (stack !== 0) stackRestore(stack);
        return ret
      }

      function cwrap(ident, returnType, argTypes, opts) {
        return function () {
          return ccall(ident, returnType, argTypes, arguments, opts)
        }
      }

      function setValue(ptr, value, type, noSafe) {
        type = type || "i8";
        if (type.charAt(type.length - 1) === "*") type = "i32";
        switch (type) {
          case "i1":
            HEAP8[ptr >> 0] = value;
            break;
          case "i8":
            HEAP8[ptr >> 0] = value;
            break;
          case "i16":
            HEAP16[ptr >> 1] = value;
            break;
          case "i32":
            HEAP32[ptr >> 2] = value;
            break;
          case "i64":
            tempI64 = [value >>> 0, (tempDouble = value, +Math_abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], HEAP32[ptr >> 2] = tempI64[0], HEAP32[ptr + 4 >> 2] = tempI64[1];
            break;
          case "float":
            HEAPF32[ptr >> 2] = value;
            break;
          case "double":
            HEAPF64[ptr >> 3] = value;
            break;
          default:
            abort("invalid type for setValue: " + type)
        }
      }
      var ALLOC_NORMAL = 0;
      var ALLOC_STACK = 1;
      var ALLOC_NONE = 3;

      function allocate(slab, types, allocator, ptr) {
        var zeroinit, size;
        if (typeof slab === "number") {
          zeroinit = true;
          size = slab
        } else {
          zeroinit = false;
          size = slab.length
        }
        var singleType = typeof types === "string" ? types : null;
        var ret;
        if (allocator == ALLOC_NONE) {
          ret = ptr
        } else {
          ret = [_malloc, stackAlloc, dynamicAlloc][allocator](Math.max(size, singleType ? 1 : types.length))
        }
        if (zeroinit) {
          var stop;
          ptr = ret;
          assert((ret & 3) == 0);
          stop = ret + (size & ~3);
          for (; ptr < stop; ptr += 4) {
            HEAP32[ptr >> 2] = 0
          }
          stop = ret + size;
          while (ptr < stop) {
            HEAP8[ptr++ >> 0] = 0
          }
          return ret
        }
        if (singleType === "i8") {
          if (slab.subarray || slab.slice) {
            HEAPU8.set(slab, ret)
          } else {
            HEAPU8.set(new Uint8Array(slab), ret)
          }
          return ret
        }
        var i = 0,
          type, typeSize, previousType;
        while (i < size) {
          var curr = slab[i];
          type = singleType || types[i];
          if (type === 0) {
            i++;
            continue
          }
          assert(type, "Must know what type to store in allocate!");
          if (type == "i64") type = "i32";
          setValue(ret + i, curr, type);
          if (previousType !== type) {
            typeSize = getNativeTypeSize(type);
            previousType = type
          }
          i += typeSize
        }
        return ret
      }

      function getMemory(size) {
        if (!runtimeInitialized) return dynamicAlloc(size);
        return _malloc(size)
      }
      var UTF8Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf8") : undefined;

      function UTF8ArrayToString(u8Array, idx, maxBytesToRead) {
        var endIdx = idx + maxBytesToRead;
        var endPtr = idx;
        while (u8Array[endPtr] && !(endPtr >= endIdx)) ++endPtr;
        if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
          return UTF8Decoder.decode(u8Array.subarray(idx, endPtr))
        } else {
          var str = "";
          while (idx < endPtr) {
            var u0 = u8Array[idx++];
            if (!(u0 & 128)) {
              str += String.fromCharCode(u0);
              continue
            }
            var u1 = u8Array[idx++] & 63;
            if ((u0 & 224) == 192) {
              str += String.fromCharCode((u0 & 31) << 6 | u1);
              continue
            }
            var u2 = u8Array[idx++] & 63;
            if ((u0 & 240) == 224) {
              u0 = (u0 & 15) << 12 | u1 << 6 | u2
            } else {
              if ((u0 & 248) != 240) warnOnce("Invalid UTF-8 leading byte 0x" + u0.toString(16) + " encountered when deserializing a UTF-8 string on the asm.js/wasm heap to a JS string!");
              u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | u8Array[idx++] & 63
            }
            if (u0 < 65536) {
              str += String.fromCharCode(u0)
            } else {
              var ch = u0 - 65536;
              str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023)
            }
          }
        }
        return str
      }

      function UTF8ToString(ptr, maxBytesToRead) {
        return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : ""
      }

      function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
        if (!(maxBytesToWrite > 0)) return 0;
        var startIdx = outIdx;
        var endIdx = outIdx + maxBytesToWrite - 1;
        for (var i = 0; i < str.length; ++i) {
          var u = str.charCodeAt(i);
          if (u >= 55296 && u <= 57343) {
            var u1 = str.charCodeAt(++i);
            u = 65536 + ((u & 1023) << 10) | u1 & 1023
          }
          if (u <= 127) {
            if (outIdx >= endIdx) break;
            outU8Array[outIdx++] = u
          } else if (u <= 2047) {
            if (outIdx + 1 >= endIdx) break;
            outU8Array[outIdx++] = 192 | u >> 6;
            outU8Array[outIdx++] = 128 | u & 63
          } else if (u <= 65535) {
            if (outIdx + 2 >= endIdx) break;
            outU8Array[outIdx++] = 224 | u >> 12;
            outU8Array[outIdx++] = 128 | u >> 6 & 63;
            outU8Array[outIdx++] = 128 | u & 63
          } else {
            if (outIdx + 3 >= endIdx) break;
            if (u >= 2097152) warnOnce("Invalid Unicode code point 0x" + u.toString(16) + " encountered when serializing a JS string to an UTF-8 string on the asm.js/wasm heap! (Valid unicode code points should be in range 0-0x1FFFFF).");
            outU8Array[outIdx++] = 240 | u >> 18;
            outU8Array[outIdx++] = 128 | u >> 12 & 63;
            outU8Array[outIdx++] = 128 | u >> 6 & 63;
            outU8Array[outIdx++] = 128 | u & 63
          }
        }
        outU8Array[outIdx] = 0;
        return outIdx - startIdx
      }

      function stringToUTF8(str, outPtr, maxBytesToWrite) {
        assert(typeof maxBytesToWrite == "number", "stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!");
        return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite)
      }

      function lengthBytesUTF8(str) {
        var len = 0;
        for (var i = 0; i < str.length; ++i) {
          var u = str.charCodeAt(i);
          if (u >= 55296 && u <= 57343) u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023;
          if (u <= 127) ++len;
          else if (u <= 2047) len += 2;
          else if (u <= 65535) len += 3;
          else len += 4
        }
        return len
      }
      var UTF16Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-16le") : undefined;

      function allocateUTF8(str) {
        var size = lengthBytesUTF8(str) + 1;
        var ret = _malloc(size);
        if (ret) stringToUTF8Array(str, HEAP8, ret, size);
        return ret
      }

      function writeArrayToMemory(array, buffer) {
        assert(array.length >= 0, "writeArrayToMemory array must have a length (should be an array or typed array)");
        HEAP8.set(array, buffer)
      }

      function writeAsciiToMemory(str, buffer, dontAddNull) {
        for (var i = 0; i < str.length; ++i) {
          assert(str.charCodeAt(i) === str.charCodeAt(i) & 255);
          HEAP8[buffer++ >> 0] = str.charCodeAt(i)
        }
        if (!dontAddNull) HEAP8[buffer >> 0] = 0
      }

      function demangle(func) {
        warnOnce("warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling");
        return func
      }

      function demangleAll(text) {
        var regex = /__Z[\w\d_]+/g;
        return text.replace(regex, function (x) {
          var y = demangle(x);
          return x === y ? x : y + " [" + x + "]"
        })
      }

      function jsStackTrace() {
        var err = new Error;
        if (!err.stack) {
          try {
            throw new Error(0)
          } catch (e) {
            err = e
          }
          if (!err.stack) {
            return "(no stack trace available)"
          }
        }
        return err.stack.toString()
      }

      function stackTrace() {
        var js = jsStackTrace();
        if (Module["extraStackTrace"]) js += "\n" + Module["extraStackTrace"]();
        return demangleAll(js)
      }
      var WASM_PAGE_SIZE = 65536;

      function alignUp(x, multiple) {
        if (x % multiple > 0) {
          x += multiple - x % multiple
        }
        return x
      }
      var buffer, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;

      function updateGlobalBuffer(buf) {
        Module["buffer"] = buffer = buf
      }

      function updateGlobalBufferViews() {
        Module["HEAP8"] = HEAP8 = new Int8Array(buffer);
        Module["HEAP16"] = HEAP16 = new Int16Array(buffer);
        Module["HEAP32"] = HEAP32 = new Int32Array(buffer);
        Module["HEAPU8"] = HEAPU8 = new Uint8Array(buffer);
        Module["HEAPU16"] = HEAPU16 = new Uint16Array(buffer);
        Module["HEAPU32"] = HEAPU32 = new Uint32Array(buffer);
        Module["HEAPF32"] = HEAPF32 = new Float32Array(buffer);
        Module["HEAPF64"] = HEAPF64 = new Float64Array(buffer)
      }
      var STACK_BASE = 2016240,
        STACK_MAX = 7259120,
        DYNAMIC_BASE = 7259120,
        DYNAMICTOP_PTR = 2015984;
      assert(STACK_BASE % 16 === 0, "stack must start aligned");
      assert(DYNAMIC_BASE % 16 === 0, "heap must start aligned");
      var TOTAL_STACK = 5242880;
      if (Module["TOTAL_STACK"]) assert(TOTAL_STACK === Module["TOTAL_STACK"], "the stack size can no longer be determined at runtime");
      var TOTAL_MEMORY = Module["TOTAL_MEMORY"] || 16777216;
      if (TOTAL_MEMORY < TOTAL_STACK) err("TOTAL_MEMORY should be larger than TOTAL_STACK, was " + TOTAL_MEMORY + "! (TOTAL_STACK=" + TOTAL_STACK + ")");
      assert(typeof Int32Array !== "undefined" && typeof Float64Array !== "undefined" && Int32Array.prototype.subarray !== undefined && Int32Array.prototype.set !== undefined, "JS engine does not provide full typed array support");
      if (Module["buffer"]) {
        buffer = Module["buffer"];
        assert(buffer.byteLength === TOTAL_MEMORY, "provided buffer should be " + TOTAL_MEMORY + " bytes, but it is " + buffer.byteLength)
      } else {
        if (typeof WebAssembly === "object" && typeof WebAssembly.Memory === "function") {
          assert(TOTAL_MEMORY % WASM_PAGE_SIZE === 0);
          wasmMemory = new WebAssembly.Memory({
            "initial": TOTAL_MEMORY / WASM_PAGE_SIZE
          });
          buffer = wasmMemory.buffer
        } else {
          buffer = new ArrayBuffer(TOTAL_MEMORY)
        }
        assert(buffer.byteLength === TOTAL_MEMORY);
        Module["buffer"] = buffer
      }
      updateGlobalBufferViews();
      HEAP32[DYNAMICTOP_PTR >> 2] = DYNAMIC_BASE;

      function writeStackCookie() {
        assert((STACK_MAX & 3) == 0);
        HEAPU32[(STACK_MAX >> 2) - 1] = 34821223;
        HEAPU32[(STACK_MAX >> 2) - 2] = 2310721022
      }

      function checkStackCookie() {
        if (HEAPU32[(STACK_MAX >> 2) - 1] != 34821223 || HEAPU32[(STACK_MAX >> 2) - 2] != 2310721022) {
          abort("Stack overflow! Stack cookie has been overwritten, expected hex dwords 0x89BACDFE and 0x02135467, but received 0x" + HEAPU32[(STACK_MAX >> 2) - 2].toString(16) + " " + HEAPU32[(STACK_MAX >> 2) - 1].toString(16))
        }
        if (HEAP32[0] !== 1668509029) throw "Runtime error: The application has corrupted its heap memory area (address zero)!"
      }

      function abortStackOverflow(allocSize) {
        abort("Stack overflow! Attempted to allocate " + allocSize + " bytes on the stack, but stack has only " + (STACK_MAX - stackSave() + allocSize) + " bytes available!")
      }
      HEAP32[0] = 1668509029;
      HEAP16[1] = 25459;
      if (HEAPU8[2] !== 115 || HEAPU8[3] !== 99) throw "Runtime error: expected the system to be little-endian!";

      function callRuntimeCallbacks(callbacks) {
        while (callbacks.length > 0) {
          var callback = callbacks.shift();
          if (typeof callback == "function") {
            callback();
            continue
          }
          var func = callback.func;
          if (typeof func === "number") {
            if (callback.arg === undefined) {
              Module["dynCall_v"](func)
            } else {
              Module["dynCall_vi"](func, callback.arg)
            }
          } else {
            func(callback.arg === undefined ? null : callback.arg)
          }
        }
      }
      var __ATPRERUN__ = [];
      var __ATINIT__ = [];
      var __ATMAIN__ = [];
      var __ATPOSTRUN__ = [];
      var runtimeInitialized = false;
      var runtimeExited = false;

      function preRun() {
        if (Module["preRun"]) {
          if (typeof Module["preRun"] == "function") Module["preRun"] = [Module["preRun"]];
          while (Module["preRun"].length) {
            addOnPreRun(Module["preRun"].shift())
          }
        }
        callRuntimeCallbacks(__ATPRERUN__)
      }

      function ensureInitRuntime() {
        checkStackCookie();
        if (runtimeInitialized) return;
        runtimeInitialized = true;
        SOCKFS.root = FS.mount(SOCKFS, {}, null);
        if (!Module["noFSInit"] && !FS.init.initialized) FS.init();
        TTY.init();
        callRuntimeCallbacks(__ATINIT__)
      }

      function preMain() {
        checkStackCookie();
        FS.ignorePermissions = false;
        callRuntimeCallbacks(__ATMAIN__)
      }

      function exitRuntime() {
        checkStackCookie();
        runtimeExited = true
      }

      function postRun() {
        checkStackCookie();
        if (Module["postRun"]) {
          if (typeof Module["postRun"] == "function") Module["postRun"] = [Module["postRun"]];
          while (Module["postRun"].length) {
            addOnPostRun(Module["postRun"].shift())
          }
        }
        callRuntimeCallbacks(__ATPOSTRUN__)
      }

      function addOnPreRun(cb) {
        __ATPRERUN__.unshift(cb)
      }

      function addOnPostRun(cb) {
        __ATPOSTRUN__.unshift(cb)
      }
      assert(Math.imul, "This browser does not support Math.imul(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill");
      assert(Math.fround, "This browser does not support Math.fround(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill");
      assert(Math.clz32, "This browser does not support Math.clz32(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill");
      assert(Math.trunc, "This browser does not support Math.trunc(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill");
      var Math_abs = Math.abs;
      var Math_ceil = Math.ceil;
      var Math_floor = Math.floor;
      var Math_min = Math.min;
      var runDependencies = 0;
      var runDependencyWatcher = null;
      var dependenciesFulfilled = null;
      var runDependencyTracking = {};

      function getUniqueRunDependency(id) {
        var orig = id;
        while (1) {
          if (!runDependencyTracking[id]) return id;
          id = orig + Math.random()
        }
        return id
      }

      function addRunDependency(id) {
        runDependencies++;
        if (Module["monitorRunDependencies"]) {
          Module["monitorRunDependencies"](runDependencies)
        }
        if (id) {
          assert(!runDependencyTracking[id]);
          runDependencyTracking[id] = 1;
          if (runDependencyWatcher === null && typeof setInterval !== "undefined") {
            runDependencyWatcher = setInterval(function () {
              if (ABORT) {
                clearInterval(runDependencyWatcher);
                runDependencyWatcher = null;
                return
              }
              var shown = false;
              for (var dep in runDependencyTracking) {
                if (!shown) {
                  shown = true;
                  err("still waiting on run dependencies:")
                }
                err("dependency: " + dep)
              }
              if (shown) {
                err("(end of list)")
              }
            }, 1e4)
          }
        } else {
          err("warning: run dependency added without ID")
        }
      }

      function removeRunDependency(id) {
        runDependencies--;
        if (Module["monitorRunDependencies"]) {
          Module["monitorRunDependencies"](runDependencies)
        }
        if (id) {
          assert(runDependencyTracking[id]);
          delete runDependencyTracking[id]
        } else {
          err("warning: run dependency removed without ID")
        }
        if (runDependencies == 0) {
          if (runDependencyWatcher !== null) {
            clearInterval(runDependencyWatcher);
            runDependencyWatcher = null
          }
          if (dependenciesFulfilled) {
            var callback = dependenciesFulfilled;
            dependenciesFulfilled = null;
            callback()
          }
        }
      }
      Module["preloadedImages"] = {};
      Module["preloadedAudios"] = {};
      var dataURIPrefix = "data:application/octet-stream;base64,";

      function isDataURI(filename) {
        return String.prototype.startsWith ? filename.startsWith(dataURIPrefix) : filename.indexOf(dataURIPrefix) === 0
      }
      var wasmBinaryFile = "libfaust-wasm.wasm";
      if (!isDataURI(wasmBinaryFile)) {
        wasmBinaryFile = locateFile(wasmBinaryFile)
      }

      function getBinary() {
        try {
          if (Module["wasmBinary"]) {
            return new Uint8Array(Module["wasmBinary"])
          }
          if (Module["readBinary"]) {
            return Module["readBinary"](wasmBinaryFile)
          } else {
            throw "both async and sync fetching of the wasm failed"
          }
        } catch (err) {
          abort(err)
        }
      }

      function getBinaryPromise() {
        if (!Module["wasmBinary"] && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && typeof fetch === "function") {
          return fetch(wasmBinaryFile, {
            credentials: "same-origin"
          }).then(function (response) {
            if (!response["ok"]) {
              throw "failed to load wasm binary file at '" + wasmBinaryFile + "'"
            }
            return response["arrayBuffer"]()
          }).catch(function () {
            return getBinary()
          })
        }
        return new Promise(function (resolve, reject) {
          resolve(getBinary())
        })
      }

      function createWasm(env) {
        var info = {
          "env": env,
          "global": {
            "NaN": NaN,
            Infinity: Infinity
          },
          "global.Math": Math,
          "asm2wasm": asm2wasmImports
        };

        function receiveInstance(instance, module) {
          var exports = instance.exports;
          Module["asm"] = exports;
          removeRunDependency("wasm-instantiate")
        }
        addRunDependency("wasm-instantiate");
        if (Module["instantiateWasm"]) {
          try {
            return Module["instantiateWasm"](info, receiveInstance)
          } catch (e) {
            err("Module.instantiateWasm callback failed with error: " + e);
            return false
          }
        }
        var trueModule = Module;

        function receiveInstantiatedSource(output) {
          assert(Module === trueModule, "the Module object should not be replaced during async compilation - perhaps the order of HTML elements is wrong?");
          trueModule = null;
          receiveInstance(output["instance"])
        }

        function instantiateArrayBuffer(receiver) {
          getBinaryPromise().then(function (binary) {
            return WebAssembly.instantiate(binary, info)
          }).then(receiver, function (reason) {
            err("failed to asynchronously prepare wasm: " + reason);
            abort(reason)
          })
        }
        if (!Module["wasmBinary"] && typeof WebAssembly.instantiateStreaming === "function" && !isDataURI(wasmBinaryFile) && typeof fetch === "function") {
          WebAssembly.instantiateStreaming(fetch(wasmBinaryFile, {
            credentials: "same-origin"
          }), info).then(receiveInstantiatedSource, function (reason) {
            err("wasm streaming compile failed: " + reason);
            err("falling back to ArrayBuffer instantiation");
            instantiateArrayBuffer(receiveInstantiatedSource)
          })
        } else {
          instantiateArrayBuffer(receiveInstantiatedSource)
        }
        return {}
      }
      Module["asm"] = function (global, env, providedBuffer) {
        env["memory"] = wasmMemory;
        env["table"] = wasmTable = new WebAssembly.Table({
          "initial": 2682,
          "maximum": 2682,
          "element": "anyfunc"
        });
        env["__memory_base"] = 1024;
        env["__table_base"] = 0;
        var exports = createWasm(env);
        assert(exports, "binaryen setup failed (no wasm support?)");
        return exports
      };
      var ASM_CONSTS = [function ($0) {
        var dsp_code = "";
        try {
          var xmlhttp = new XMLHttpRequest;
          xmlhttp.open("GET", Module.UTF8ToString($0), false);
          xmlhttp.send();
          if (xmlhttp.status == 200) {
            dsp_code = xmlhttp.responseText
          }
        } catch (e) {
          console.log(e)
        }
        return allocate(intArrayFromString(dsp_code), "i8", ALLOC_STACK)
      }, function ($0) {
        return FaustModule._malloc($0)
      }, function ($0, $1) {
        FaustModule.faust.wasm_instance[$0] = null;
        FaustModule._free($1)
      }, function ($0, $1) {
        return FaustModule.faust.wasm_instance[$0].exports.getNumInputs($1)
      }, function ($0, $1) {
        return FaustModule.faust.wasm_instance[$0].exports.getNumOutputs($1)
      }, function ($0, $1) {
        return FaustModule.faust.wasm_instance[$0].exports.getSampleRate($1)
      }, function ($0, $1, $2) {
        FaustModule.faust.wasm_instance[$0].exports.init($1)
      }, function ($0, $1, $2) {
        FaustModule.faust.wasm_instance[$0].exports.instanceInit($1, $2)
      }, function ($0, $1, $2) {
        FaustModule.faust.wasm_instance[$0].exports.instanceConstants($1, $2)
      }, function ($0, $1) {
        FaustModule.faust.wasm_instance[$0].exports.instanceResetUserInterface($1)
      }, function ($0, $1) {
        FaustModule.faust.wasm_instance[$0].exports.instanceClear($1)
      }, function ($0, $1, $2, $3, $4) {
        FaustModule.faust.wasm_instance[$0].exports.compute($1, $2, $3, $4)
      }];

      function _emscripten_asm_const_iii(code, a0, a1) {
        return ASM_CONSTS[code](a0, a1)
      }

      function _emscripten_asm_const_iiiiii(code, a0, a1, a2, a3, a4) {
        return ASM_CONSTS[code](a0, a1, a2, a3, a4)
      }

      function _emscripten_asm_const_iiii(code, a0, a1, a2) {
        return ASM_CONSTS[code](a0, a1, a2)
      }

      function _emscripten_asm_const_ii(code, a0) {
        return ASM_CONSTS[code](a0)
      }

      function _createJSDSPInstance(module) {
        var wasm_instance = new WebAssembly.Instance(FaustModule.faust.wasm_module[module], FaustModule.faust.importObject);
        FaustModule.faust.wasm_instance.push(wasm_instance);
        return FaustModule.faust.wasm_instance.length - 1
      }
      __ATINIT__.push({
        func: function () {
          globalCtors()
        }
      });
      var tempDoublePtr = 2016224;
      assert(tempDoublePtr % 8 == 0);
      var ENV = {};

      function ___buildEnvironment(environ) {
        var MAX_ENV_VALUES = 64;
        var TOTAL_ENV_SIZE = 1024;
        var poolPtr;
        var envPtr;
        if (!___buildEnvironment.called) {
          ___buildEnvironment.called = true;
          ENV["USER"] = ENV["LOGNAME"] = "web_user";
          ENV["PATH"] = "/";
          ENV["PWD"] = "/";
          ENV["HOME"] = "/home/web_user";
          ENV["LANG"] = "C.UTF-8";
          ENV["_"] = Module["thisProgram"];
          poolPtr = getMemory(TOTAL_ENV_SIZE);
          envPtr = getMemory(MAX_ENV_VALUES * 4);
          HEAP32[envPtr >> 2] = poolPtr;
          HEAP32[environ >> 2] = envPtr
        } else {
          envPtr = HEAP32[environ >> 2];
          poolPtr = HEAP32[envPtr >> 2]
        }
        var strings = [];
        var totalSize = 0;
        for (var key in ENV) {
          if (typeof ENV[key] === "string") {
            var line = key + "=" + ENV[key];
            strings.push(line);
            totalSize += line.length
          }
        }
        if (totalSize > TOTAL_ENV_SIZE) {
          throw new Error("Environment size exceeded TOTAL_ENV_SIZE!")
        }
        var ptrSize = 4;
        for (var i = 0; i < strings.length; i++) {
          var line = strings[i];
          writeAsciiToMemory(line, poolPtr);
          HEAP32[envPtr + i * ptrSize >> 2] = poolPtr;
          poolPtr += line.length + 1
        }
        HEAP32[envPtr + strings.length * ptrSize >> 2] = 0
      }

      function ___cxa_allocate_exception(size) {
        return _malloc(size)
      }

      function ___cxa_free_exception(ptr) {
        try {
          return _free(ptr)
        } catch (e) {
          err("exception during cxa_free_exception: " + e)
        }
      }
      var EXCEPTIONS = {
        last: 0,
        caught: [],
        infos: {},
        deAdjust: function (adjusted) {
          if (!adjusted || EXCEPTIONS.infos[adjusted]) return adjusted;
          for (var key in EXCEPTIONS.infos) {
            var ptr = +key;
            var adj = EXCEPTIONS.infos[ptr].adjusted;
            var len = adj.length;
            for (var i = 0; i < len; i++) {
              if (adj[i] === adjusted) {
                return ptr
              }
            }
          }
          return adjusted
        },
        addRef: function (ptr) {
          if (!ptr) return;
          var info = EXCEPTIONS.infos[ptr];
          info.refcount++
        },
        decRef: function (ptr) {
          if (!ptr) return;
          var info = EXCEPTIONS.infos[ptr];
          assert(info.refcount > 0);
          info.refcount--;
          if (info.refcount === 0 && !info.rethrown) {
            if (info.destructor) {
              Module["dynCall_vi"](info.destructor, ptr)
            }
            delete EXCEPTIONS.infos[ptr];
            ___cxa_free_exception(ptr)
          }
        },
        clearRef: function (ptr) {
          if (!ptr) return;
          var info = EXCEPTIONS.infos[ptr];
          info.refcount = 0
        }
      };

      function ___cxa_pure_virtual() {
        ABORT = true;
        throw "Pure virtual function called!"
      }

      function ___cxa_throw(ptr, type, destructor) {
        EXCEPTIONS.infos[ptr] = {
          ptr: ptr,
          adjusted: [ptr],
          type: type,
          destructor: destructor,
          refcount: 0,
          caught: false,
          rethrown: false
        };
        EXCEPTIONS.last = ptr;
        if (!("uncaught_exception" in __ZSt18uncaught_exceptionv)) {
          __ZSt18uncaught_exceptionv.uncaught_exception = 1
        } else {
          __ZSt18uncaught_exceptionv.uncaught_exception++
        }
        throw ptr + " - Exception catching is disabled, this exception cannot be caught. Compile with -s DISABLE_EXCEPTION_CATCHING=0 or DISABLE_EXCEPTION_CATCHING=2 to catch."
      }

      function ___cxa_uncaught_exception() {
        return !!__ZSt18uncaught_exceptionv.uncaught_exception
      }

      function ___lock() {}

      function ___setErrNo(value) {
        if (Module["___errno_location"]) HEAP32[Module["___errno_location"]() >> 2] = value;
        else err("failed to set errno from JS");
        return value
      }

      function ___map_file(pathname, size) {
        ___setErrNo(1);
        return -1
      }
      var PATH = {
        splitPath: function (filename) {
          var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
          return splitPathRe.exec(filename).slice(1)
        },
        normalizeArray: function (parts, allowAboveRoot) {
          var up = 0;
          for (var i = parts.length - 1; i >= 0; i--) {
            var last = parts[i];
            if (last === ".") {
              parts.splice(i, 1)
            } else if (last === "..") {
              parts.splice(i, 1);
              up++
            } else if (up) {
              parts.splice(i, 1);
              up--
            }
          }
          if (allowAboveRoot) {
            for (; up; up--) {
              parts.unshift("..")
            }
          }
          return parts
        },
        normalize: function (path) {
          var isAbsolute = path.charAt(0) === "/",
            trailingSlash = path.substr(-1) === "/";
          path = PATH.normalizeArray(path.split("/").filter(function (p) {
            return !!p
          }), !isAbsolute).join("/");
          if (!path && !isAbsolute) {
            path = "."
          }
          if (path && trailingSlash) {
            path += "/"
          }
          return (isAbsolute ? "/" : "") + path
        },
        dirname: function (path) {
          var result = PATH.splitPath(path),
            root = result[0],
            dir = result[1];
          if (!root && !dir) {
            return "."
          }
          if (dir) {
            dir = dir.substr(0, dir.length - 1)
          }
          return root + dir
        },
        basename: function (path) {
          if (path === "/") return "/";
          var lastSlash = path.lastIndexOf("/");
          if (lastSlash === -1) return path;
          return path.substr(lastSlash + 1)
        },
        extname: function (path) {
          return PATH.splitPath(path)[3]
        },
        join: function () {
          var paths = Array.prototype.slice.call(arguments, 0);
          return PATH.normalize(paths.join("/"))
        },
        join2: function (l, r) {
          return PATH.normalize(l + "/" + r)
        },
        resolve: function () {
          var resolvedPath = "",
            resolvedAbsolute = false;
          for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
            var path = i >= 0 ? arguments[i] : FS.cwd();
            if (typeof path !== "string") {
              throw new TypeError("Arguments to path.resolve must be strings")
            } else if (!path) {
              return ""
            }
            resolvedPath = path + "/" + resolvedPath;
            resolvedAbsolute = path.charAt(0) === "/"
          }
          resolvedPath = PATH.normalizeArray(resolvedPath.split("/").filter(function (p) {
            return !!p
          }), !resolvedAbsolute).join("/");
          return (resolvedAbsolute ? "/" : "") + resolvedPath || "."
        },
        relative: function (from, to) {
          from = PATH.resolve(from).substr(1);
          to = PATH.resolve(to).substr(1);

          function trim(arr) {
            var start = 0;
            for (; start < arr.length; start++) {
              if (arr[start] !== "") break
            }
            var end = arr.length - 1;
            for (; end >= 0; end--) {
              if (arr[end] !== "") break
            }
            if (start > end) return [];
            return arr.slice(start, end - start + 1)
          }
          var fromParts = trim(from.split("/"));
          var toParts = trim(to.split("/"));
          var length = Math.min(fromParts.length, toParts.length);
          var samePartsLength = length;
          for (var i = 0; i < length; i++) {
            if (fromParts[i] !== toParts[i]) {
              samePartsLength = i;
              break
            }
          }
          var outputParts = [];
          for (var i = samePartsLength; i < fromParts.length; i++) {
            outputParts.push("..")
          }
          outputParts = outputParts.concat(toParts.slice(samePartsLength));
          return outputParts.join("/")
        }
      };
      var TTY = {
        ttys: [],
        init: function () {},
        shutdown: function () {},
        register: function (dev, ops) {
          TTY.ttys[dev] = {
            input: [],
            output: [],
            ops: ops
          };
          FS.registerDevice(dev, TTY.stream_ops)
        },
        stream_ops: {
          open: function (stream) {
            var tty = TTY.ttys[stream.node.rdev];
            if (!tty) {
              throw new FS.ErrnoError(ERRNO_CODES.ENODEV)
            }
            stream.tty = tty;
            stream.seekable = false
          },
          close: function (stream) {
            stream.tty.ops.flush(stream.tty)
          },
          flush: function (stream) {
            stream.tty.ops.flush(stream.tty)
          },
          read: function (stream, buffer, offset, length, pos) {
            if (!stream.tty || !stream.tty.ops.get_char) {
              throw new FS.ErrnoError(ERRNO_CODES.ENXIO)
            }
            var bytesRead = 0;
            for (var i = 0; i < length; i++) {
              var result;
              try {
                result = stream.tty.ops.get_char(stream.tty)
              } catch (e) {
                throw new FS.ErrnoError(ERRNO_CODES.EIO)
              }
              if (result === undefined && bytesRead === 0) {
                throw new FS.ErrnoError(ERRNO_CODES.EAGAIN)
              }
              if (result === null || result === undefined) break;
              bytesRead++;
              buffer[offset + i] = result
            }
            if (bytesRead) {
              stream.node.timestamp = Date.now()
            }
            return bytesRead
          },
          write: function (stream, buffer, offset, length, pos) {
            if (!stream.tty || !stream.tty.ops.put_char) {
              throw new FS.ErrnoError(ERRNO_CODES.ENXIO)
            }
            try {
              for (var i = 0; i < length; i++) {
                stream.tty.ops.put_char(stream.tty, buffer[offset + i])
              }
            } catch (e) {
              throw new FS.ErrnoError(ERRNO_CODES.EIO)
            }
            if (length) {
              stream.node.timestamp = Date.now()
            }
            return i
          }
        },
        default_tty_ops: {
          get_char: function (tty) {
            if (!tty.input.length) {
              var result = null;
              if (ENVIRONMENT_IS_NODE) {
                var BUFSIZE = 256;
                var buf = new Buffer(BUFSIZE);
                var bytesRead = 0;
                var isPosixPlatform = process.platform != "win32";
                var fd = process.stdin.fd;
                if (isPosixPlatform) {
                  var usingDevice = false;
                  try {
                    fd = fs.openSync("/dev/stdin", "r");
                    usingDevice = true
                  } catch (e) {}
                }
                try {
                  bytesRead = fs.readSync(fd, buf, 0, BUFSIZE, null)
                } catch (e) {
                  if (e.toString().indexOf("EOF") != -1) bytesRead = 0;
                  else throw e
                }
                if (usingDevice) {
                  fs.closeSync(fd)
                }
                if (bytesRead > 0) {
                  result = buf.slice(0, bytesRead).toString("utf-8")
                } else {
                  result = null
                }
              } else if (typeof window != "undefined" && typeof window.prompt == "function") {
                result = window.prompt("Input: ");
                if (result !== null) {
                  result += "\n"
                }
              } else if (typeof readline == "function") {
                result = readline();
                if (result !== null) {
                  result += "\n"
                }
              }
              if (!result) {
                return null
              }
              tty.input = intArrayFromString(result, true)
            }
            return tty.input.shift()
          },
          put_char: function (tty, val) {
            if (val === null || val === 10) {
              out(UTF8ArrayToString(tty.output, 0));
              tty.output = []
            } else {
              if (val != 0) tty.output.push(val)
            }
          },
          flush: function (tty) {
            if (tty.output && tty.output.length > 0) {
              out(UTF8ArrayToString(tty.output, 0));
              tty.output = []
            }
          }
        },
        default_tty1_ops: {
          put_char: function (tty, val) {
            if (val === null || val === 10) {
              err(UTF8ArrayToString(tty.output, 0));
              tty.output = []
            } else {
              if (val != 0) tty.output.push(val)
            }
          },
          flush: function (tty) {
            if (tty.output && tty.output.length > 0) {
              err(UTF8ArrayToString(tty.output, 0));
              tty.output = []
            }
          }
        }
      };
      var MEMFS = {
        ops_table: null,
        mount: function (mount) {
          return MEMFS.createNode(null, "/", 16384 | 511, 0)
        },
        createNode: function (parent, name, mode, dev) {
          if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
            throw new FS.ErrnoError(ERRNO_CODES.EPERM)
          }
          if (!MEMFS.ops_table) {
            MEMFS.ops_table = {
              dir: {
                node: {
                  getattr: MEMFS.node_ops.getattr,
                  setattr: MEMFS.node_ops.setattr,
                  lookup: MEMFS.node_ops.lookup,
                  mknod: MEMFS.node_ops.mknod,
                  rename: MEMFS.node_ops.rename,
                  unlink: MEMFS.node_ops.unlink,
                  rmdir: MEMFS.node_ops.rmdir,
                  readdir: MEMFS.node_ops.readdir,
                  symlink: MEMFS.node_ops.symlink
                },
                stream: {
                  llseek: MEMFS.stream_ops.llseek
                }
              },
              file: {
                node: {
                  getattr: MEMFS.node_ops.getattr,
                  setattr: MEMFS.node_ops.setattr
                },
                stream: {
                  llseek: MEMFS.stream_ops.llseek,
                  read: MEMFS.stream_ops.read,
                  write: MEMFS.stream_ops.write,
                  allocate: MEMFS.stream_ops.allocate,
                  mmap: MEMFS.stream_ops.mmap,
                  msync: MEMFS.stream_ops.msync
                }
              },
              link: {
                node: {
                  getattr: MEMFS.node_ops.getattr,
                  setattr: MEMFS.node_ops.setattr,
                  readlink: MEMFS.node_ops.readlink
                },
                stream: {}
              },
              chrdev: {
                node: {
                  getattr: MEMFS.node_ops.getattr,
                  setattr: MEMFS.node_ops.setattr
                },
                stream: FS.chrdev_stream_ops
              }
            }
          }
          var node = FS.createNode(parent, name, mode, dev);
          if (FS.isDir(node.mode)) {
            node.node_ops = MEMFS.ops_table.dir.node;
            node.stream_ops = MEMFS.ops_table.dir.stream;
            node.contents = {}
          } else if (FS.isFile(node.mode)) {
            node.node_ops = MEMFS.ops_table.file.node;
            node.stream_ops = MEMFS.ops_table.file.stream;
            node.usedBytes = 0;
            node.contents = null
          } else if (FS.isLink(node.mode)) {
            node.node_ops = MEMFS.ops_table.link.node;
            node.stream_ops = MEMFS.ops_table.link.stream
          } else if (FS.isChrdev(node.mode)) {
            node.node_ops = MEMFS.ops_table.chrdev.node;
            node.stream_ops = MEMFS.ops_table.chrdev.stream
          }
          node.timestamp = Date.now();
          if (parent) {
            parent.contents[name] = node
          }
          return node
        },
        getFileDataAsRegularArray: function (node) {
          if (node.contents && node.contents.subarray) {
            var arr = [];
            for (var i = 0; i < node.usedBytes; ++i) arr.push(node.contents[i]);
            return arr
          }
          return node.contents
        },
        getFileDataAsTypedArray: function (node) {
          if (!node.contents) return new Uint8Array;
          if (node.contents.subarray) return node.contents.subarray(0, node.usedBytes);
          return new Uint8Array(node.contents)
        },
        expandFileStorage: function (node, newCapacity) {
          var prevCapacity = node.contents ? node.contents.length : 0;
          if (prevCapacity >= newCapacity) return;
          var CAPACITY_DOUBLING_MAX = 1024 * 1024;
          newCapacity = Math.max(newCapacity, prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125) | 0);
          if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256);
          var oldContents = node.contents;
          node.contents = new Uint8Array(newCapacity);
          if (node.usedBytes > 0) node.contents.set(oldContents.subarray(0, node.usedBytes), 0);
          return
        },
        resizeFileStorage: function (node, newSize) {
          if (node.usedBytes == newSize) return;
          if (newSize == 0) {
            node.contents = null;
            node.usedBytes = 0;
            return
          }
          if (!node.contents || node.contents.subarray) {
            var oldContents = node.contents;
            node.contents = new Uint8Array(new ArrayBuffer(newSize));
            if (oldContents) {
              node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes)))
            }
            node.usedBytes = newSize;
            return
          }
          if (!node.contents) node.contents = [];
          if (node.contents.length > newSize) node.contents.length = newSize;
          else
            while (node.contents.length < newSize) node.contents.push(0);
          node.usedBytes = newSize
        },
        node_ops: {
          getattr: function (node) {
            var attr = {};
            attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
            attr.ino = node.id;
            attr.mode = node.mode;
            attr.nlink = 1;
            attr.uid = 0;
            attr.gid = 0;
            attr.rdev = node.rdev;
            if (FS.isDir(node.mode)) {
              attr.size = 4096
            } else if (FS.isFile(node.mode)) {
              attr.size = node.usedBytes
            } else if (FS.isLink(node.mode)) {
              attr.size = node.link.length
            } else {
              attr.size = 0
            }
            attr.atime = new Date(node.timestamp);
            attr.mtime = new Date(node.timestamp);
            attr.ctime = new Date(node.timestamp);
            attr.blksize = 4096;
            attr.blocks = Math.ceil(attr.size / attr.blksize);
            return attr
          },
          setattr: function (node, attr) {
            if (attr.mode !== undefined) {
              node.mode = attr.mode
            }
            if (attr.timestamp !== undefined) {
              node.timestamp = attr.timestamp
            }
            if (attr.size !== undefined) {
              MEMFS.resizeFileStorage(node, attr.size)
            }
          },
          lookup: function (parent, name) {
            throw FS.genericErrors[ERRNO_CODES.ENOENT]
          },
          mknod: function (parent, name, mode, dev) {
            return MEMFS.createNode(parent, name, mode, dev)
          },
          rename: function (old_node, new_dir, new_name) {
            if (FS.isDir(old_node.mode)) {
              var new_node;
              try {
                new_node = FS.lookupNode(new_dir, new_name)
              } catch (e) {}
              if (new_node) {
                for (var i in new_node.contents) {
                  throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY)
                }
              }
            }
            delete old_node.parent.contents[old_node.name];
            old_node.name = new_name;
            new_dir.contents[new_name] = old_node;
            old_node.parent = new_dir
          },
          unlink: function (parent, name) {
            delete parent.contents[name]
          },
          rmdir: function (parent, name) {
            var node = FS.lookupNode(parent, name);
            for (var i in node.contents) {
              throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY)
            }
            delete parent.contents[name]
          },
          readdir: function (node) {
            var entries = [".", ".."];
            for (var key in node.contents) {
              if (!node.contents.hasOwnProperty(key)) {
                continue
              }
              entries.push(key)
            }
            return entries
          },
          symlink: function (parent, newname, oldpath) {
            var node = MEMFS.createNode(parent, newname, 511 | 40960, 0);
            node.link = oldpath;
            return node
          },
          readlink: function (node) {
            if (!FS.isLink(node.mode)) {
              throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
            }
            return node.link
          }
        },
        stream_ops: {
          read: function (stream, buffer, offset, length, position) {
            var contents = stream.node.contents;
            if (position >= stream.node.usedBytes) return 0;
            var size = Math.min(stream.node.usedBytes - position, length);
            assert(size >= 0);
            if (size > 8 && contents.subarray) {
              buffer.set(contents.subarray(position, position + size), offset)
            } else {
              for (var i = 0; i < size; i++) buffer[offset + i] = contents[position + i]
            }
            return size
          },
          write: function (stream, buffer, offset, length, position, canOwn) {
            if (canOwn) {
              warnOnce("file packager has copied file data into memory, but in memory growth we are forced to copy it again (see --no-heap-copy)")
            }
            canOwn = false;
            if (!length) return 0;
            var node = stream.node;
            node.timestamp = Date.now();
            if (buffer.subarray && (!node.contents || node.contents.subarray)) {
              if (canOwn) {
                assert(position === 0, "canOwn must imply no weird position inside the file");
                node.contents = buffer.subarray(offset, offset + length);
                node.usedBytes = length;
                return length
              } else if (node.usedBytes === 0 && position === 0) {
                node.contents = new Uint8Array(buffer.subarray(offset, offset + length));
                node.usedBytes = length;
                return length
              } else if (position + length <= node.usedBytes) {
                node.contents.set(buffer.subarray(offset, offset + length), position);
                return length
              }
            }
            MEMFS.expandFileStorage(node, position + length);
            if (node.contents.subarray && buffer.subarray) node.contents.set(buffer.subarray(offset, offset + length), position);
            else {
              for (var i = 0; i < length; i++) {
                node.contents[position + i] = buffer[offset + i]
              }
            }
            node.usedBytes = Math.max(node.usedBytes, position + length);
            return length
          },
          llseek: function (stream, offset, whence) {
            var position = offset;
            if (whence === 1) {
              position += stream.position
            } else if (whence === 2) {
              if (FS.isFile(stream.node.mode)) {
                position += stream.node.usedBytes
              }
            }
            if (position < 0) {
              throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
            }
            return position
          },
          allocate: function (stream, offset, length) {
            MEMFS.expandFileStorage(stream.node, offset + length);
            stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length)
          },
          mmap: function (stream, buffer, offset, length, position, prot, flags) {
            if (!FS.isFile(stream.node.mode)) {
              throw new FS.ErrnoError(ERRNO_CODES.ENODEV)
            }
            var ptr;
            var allocated;
            var contents = stream.node.contents;
            if (!(flags & 2) && (contents.buffer === buffer || contents.buffer === buffer.buffer)) {
              allocated = false;
              ptr = contents.byteOffset
            } else {
              if (position > 0 || position + length < stream.node.usedBytes) {
                if (contents.subarray) {
                  contents = contents.subarray(position, position + length)
                } else {
                  contents = Array.prototype.slice.call(contents, position, position + length)
                }
              }
              allocated = true;
              ptr = _malloc(length);
              if (!ptr) {
                throw new FS.ErrnoError(ERRNO_CODES.ENOMEM)
              }
              buffer.set(contents, ptr)
            }
            return {
              ptr: ptr,
              allocated: allocated
            }
          },
          msync: function (stream, buffer, offset, length, mmapFlags) {
            if (!FS.isFile(stream.node.mode)) {
              throw new FS.ErrnoError(ERRNO_CODES.ENODEV)
            }
            if (mmapFlags & 2) {
              return 0
            }
            var bytesWritten = MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
            return 0
          }
        }
      };
      var IDBFS = {
        dbs: {},
        indexedDB: function () {
          if (typeof indexedDB !== "undefined") return indexedDB;
          var ret = null;
          if (typeof window === "object") ret = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
          assert(ret, "IDBFS used, but indexedDB not supported");
          return ret
        },
        DB_VERSION: 21,
        DB_STORE_NAME: "FILE_DATA",
        mount: function (mount) {
          return MEMFS.mount.apply(null, arguments)
        },
        syncfs: function (mount, populate, callback) {
          IDBFS.getLocalSet(mount, function (err, local) {
            if (err) return callback(err);
            IDBFS.getRemoteSet(mount, function (err, remote) {
              if (err) return callback(err);
              var src = populate ? remote : local;
              var dst = populate ? local : remote;
              IDBFS.reconcile(src, dst, callback)
            })
          })
        },
        getDB: function (name, callback) {
          var db = IDBFS.dbs[name];
          if (db) {
            return callback(null, db)
          }
          var req;
          try {
            req = IDBFS.indexedDB().open(name, IDBFS.DB_VERSION)
          } catch (e) {
            return callback(e)
          }
          if (!req) {
            return callback("Unable to connect to IndexedDB")
          }
          req.onupgradeneeded = function (e) {
            var db = e.target.result;
            var transaction = e.target.transaction;
            var fileStore;
            if (db.objectStoreNames.contains(IDBFS.DB_STORE_NAME)) {
              fileStore = transaction.objectStore(IDBFS.DB_STORE_NAME)
            } else {
              fileStore = db.createObjectStore(IDBFS.DB_STORE_NAME)
            }
            if (!fileStore.indexNames.contains("timestamp")) {
              fileStore.createIndex("timestamp", "timestamp", {
                unique: false
              })
            }
          };
          req.onsuccess = function () {
            db = req.result;
            IDBFS.dbs[name] = db;
            callback(null, db)
          };
          req.onerror = function (e) {
            callback(this.error);
            e.preventDefault()
          }
        },
        getLocalSet: function (mount, callback) {
          var entries = {};

          function isRealDir(p) {
            return p !== "." && p !== ".."
          }

          function toAbsolute(root) {
            return function (p) {
              return PATH.join2(root, p)
            }
          }
          var check = FS.readdir(mount.mountpoint).filter(isRealDir).map(toAbsolute(mount.mountpoint));
          while (check.length) {
            var path = check.pop();
            var stat;
            try {
              stat = FS.stat(path)
            } catch (e) {
              return callback(e)
            }
            if (FS.isDir(stat.mode)) {
              check.push.apply(check, FS.readdir(path).filter(isRealDir).map(toAbsolute(path)))
            }
            entries[path] = {
              timestamp: stat.mtime
            }
          }
          return callback(null, {
            type: "local",
            entries: entries
          })
        },
        getRemoteSet: function (mount, callback) {
          var entries = {};
          IDBFS.getDB(mount.mountpoint, function (err, db) {
            if (err) return callback(err);
            try {
              var transaction = db.transaction([IDBFS.DB_STORE_NAME], "readonly");
              transaction.onerror = function (e) {
                callback(this.error);
                e.preventDefault()
              };
              var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
              var index = store.index("timestamp");
              index.openKeyCursor().onsuccess = function (event) {
                var cursor = event.target.result;
                if (!cursor) {
                  return callback(null, {
                    type: "remote",
                    db: db,
                    entries: entries
                  })
                }
                entries[cursor.primaryKey] = {
                  timestamp: cursor.key
                };
                cursor.continue()
              }
            } catch (e) {
              return callback(e)
            }
          })
        },
        loadLocalEntry: function (path, callback) {
          var stat, node;
          try {
            var lookup = FS.lookupPath(path);
            node = lookup.node;
            stat = FS.stat(path)
          } catch (e) {
            return callback(e)
          }
          if (FS.isDir(stat.mode)) {
            return callback(null, {
              timestamp: stat.mtime,
              mode: stat.mode
            })
          } else if (FS.isFile(stat.mode)) {
            node.contents = MEMFS.getFileDataAsTypedArray(node);
            return callback(null, {
              timestamp: stat.mtime,
              mode: stat.mode,
              contents: node.contents
            })
          } else {
            return callback(new Error("node type not supported"))
          }
        },
        storeLocalEntry: function (path, entry, callback) {
          try {
            if (FS.isDir(entry.mode)) {
              FS.mkdir(path, entry.mode)
            } else if (FS.isFile(entry.mode)) {
              FS.writeFile(path, entry.contents, {
                canOwn: true
              })
            } else {
              return callback(new Error("node type not supported"))
            }
            FS.chmod(path, entry.mode);
            FS.utime(path, entry.timestamp, entry.timestamp)
          } catch (e) {
            return callback(e)
          }
          callback(null)
        },
        removeLocalEntry: function (path, callback) {
          try {
            var lookup = FS.lookupPath(path);
            var stat = FS.stat(path);
            if (FS.isDir(stat.mode)) {
              FS.rmdir(path)
            } else if (FS.isFile(stat.mode)) {
              FS.unlink(path)
            }
          } catch (e) {
            return callback(e)
          }
          callback(null)
        },
        loadRemoteEntry: function (store, path, callback) {
          var req = store.get(path);
          req.onsuccess = function (event) {
            callback(null, event.target.result)
          };
          req.onerror = function (e) {
            callback(this.error);
            e.preventDefault()
          }
        },
        storeRemoteEntry: function (store, path, entry, callback) {
          var req = store.put(entry, path);
          req.onsuccess = function () {
            callback(null)
          };
          req.onerror = function (e) {
            callback(this.error);
            e.preventDefault()
          }
        },
        removeRemoteEntry: function (store, path, callback) {
          var req = store.delete(path);
          req.onsuccess = function () {
            callback(null)
          };
          req.onerror = function (e) {
            callback(this.error);
            e.preventDefault()
          }
        },
        reconcile: function (src, dst, callback) {
          var total = 0;
          var create = [];
          Object.keys(src.entries).forEach(function (key) {
            var e = src.entries[key];
            var e2 = dst.entries[key];
            if (!e2 || e.timestamp > e2.timestamp) {
              create.push(key);
              total++
            }
          });
          var remove = [];
          Object.keys(dst.entries).forEach(function (key) {
            var e = dst.entries[key];
            var e2 = src.entries[key];
            if (!e2) {
              remove.push(key);
              total++
            }
          });
          if (!total) {
            return callback(null)
          }
          var errored = false;
          var completed = 0;
          var db = src.type === "remote" ? src.db : dst.db;
          var transaction = db.transaction([IDBFS.DB_STORE_NAME], "readwrite");
          var store = transaction.objectStore(IDBFS.DB_STORE_NAME);

          function done(err) {
            if (err) {
              if (!done.errored) {
                done.errored = true;
                return callback(err)
              }
              return
            }
            if (++completed >= total) {
              return callback(null)
            }
          }
          transaction.onerror = function (e) {
            done(this.error);
            e.preventDefault()
          };
          create.sort().forEach(function (path) {
            if (dst.type === "local") {
              IDBFS.loadRemoteEntry(store, path, function (err, entry) {
                if (err) return done(err);
                IDBFS.storeLocalEntry(path, entry, done)
              })
            } else {
              IDBFS.loadLocalEntry(path, function (err, entry) {
                if (err) return done(err);
                IDBFS.storeRemoteEntry(store, path, entry, done)
              })
            }
          });
          remove.sort().reverse().forEach(function (path) {
            if (dst.type === "local") {
              IDBFS.removeLocalEntry(path, done)
            } else {
              IDBFS.removeRemoteEntry(store, path, done)
            }
          })
        }
      };
      var NODEFS = {
        isWindows: false,
        staticInit: function () {
          NODEFS.isWindows = !!process.platform.match(/^win/);
          var flags = process["binding"]("constants");
          if (flags["fs"]) {
            flags = flags["fs"]
          }
          NODEFS.flagsForNodeMap = {
            1024: flags["O_APPEND"],
            64: flags["O_CREAT"],
            128: flags["O_EXCL"],
            0: flags["O_RDONLY"],
            2: flags["O_RDWR"],
            4096: flags["O_SYNC"],
            512: flags["O_TRUNC"],
            1: flags["O_WRONLY"]
          }
        },
        bufferFrom: function (arrayBuffer) {
          return Buffer.alloc ? Buffer.from(arrayBuffer) : new Buffer(arrayBuffer)
        },
        mount: function (mount) {
          assert(ENVIRONMENT_IS_NODE);
          return NODEFS.createNode(null, "/", NODEFS.getMode(mount.opts.root), 0)
        },
        createNode: function (parent, name, mode, dev) {
          if (!FS.isDir(mode) && !FS.isFile(mode) && !FS.isLink(mode)) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
          }
          var node = FS.createNode(parent, name, mode);
          node.node_ops = NODEFS.node_ops;
          node.stream_ops = NODEFS.stream_ops;
          return node
        },
        getMode: function (path) {
          var stat;
          try {
            stat = fs.lstatSync(path);
            if (NODEFS.isWindows) {
              stat.mode = stat.mode | (stat.mode & 292) >> 2
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code])
          }
          return stat.mode
        },
        realPath: function (node) {
          var parts = [];
          while (node.parent !== node) {
            parts.push(node.name);
            node = node.parent
          }
          parts.push(node.mount.opts.root);
          parts.reverse();
          return PATH.join.apply(null, parts)
        },
        flagsForNode: function (flags) {
          flags &= ~2097152;
          flags &= ~2048;
          flags &= ~32768;
          flags &= ~524288;
          var newFlags = 0;
          for (var k in NODEFS.flagsForNodeMap) {
            if (flags & k) {
              newFlags |= NODEFS.flagsForNodeMap[k];
              flags ^= k
            }
          }
          if (!flags) {
            return newFlags
          } else {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
          }
        },
        node_ops: {
          getattr: function (node) {
            var path = NODEFS.realPath(node);
            var stat;
            try {
              stat = fs.lstatSync(path)
            } catch (e) {
              if (!e.code) throw e;
              throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
            if (NODEFS.isWindows && !stat.blksize) {
              stat.blksize = 4096
            }
            if (NODEFS.isWindows && !stat.blocks) {
              stat.blocks = (stat.size + stat.blksize - 1) / stat.blksize | 0
            }
            return {
              dev: stat.dev,
              ino: stat.ino,
              mode: stat.mode,
              nlink: stat.nlink,
              uid: stat.uid,
              gid: stat.gid,
              rdev: stat.rdev,
              size: stat.size,
              atime: stat.atime,
              mtime: stat.mtime,
              ctime: stat.ctime,
              blksize: stat.blksize,
              blocks: stat.blocks
            }
          },
          setattr: function (node, attr) {
            var path = NODEFS.realPath(node);
            try {
              if (attr.mode !== undefined) {
                fs.chmodSync(path, attr.mode);
                node.mode = attr.mode
              }
              if (attr.timestamp !== undefined) {
                var date = new Date(attr.timestamp);
                fs.utimesSync(path, date, date)
              }
              if (attr.size !== undefined) {
                fs.truncateSync(path, attr.size)
              }
            } catch (e) {
              if (!e.code) throw e;
              throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
          },
          lookup: function (parent, name) {
            var path = PATH.join2(NODEFS.realPath(parent), name);
            var mode = NODEFS.getMode(path);
            return NODEFS.createNode(parent, name, mode)
          },
          mknod: function (parent, name, mode, dev) {
            var node = NODEFS.createNode(parent, name, mode, dev);
            var path = NODEFS.realPath(node);
            try {
              if (FS.isDir(node.mode)) {
                fs.mkdirSync(path, node.mode)
              } else {
                fs.writeFileSync(path, "", {
                  mode: node.mode
                })
              }
            } catch (e) {
              if (!e.code) throw e;
              throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
            return node
          },
          rename: function (oldNode, newDir, newName) {
            var oldPath = NODEFS.realPath(oldNode);
            var newPath = PATH.join2(NODEFS.realPath(newDir), newName);
            try {
              fs.renameSync(oldPath, newPath)
            } catch (e) {
              if (!e.code) throw e;
              throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
          },
          unlink: function (parent, name) {
            var path = PATH.join2(NODEFS.realPath(parent), name);
            try {
              fs.unlinkSync(path)
            } catch (e) {
              if (!e.code) throw e;
              throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
          },
          rmdir: function (parent, name) {
            var path = PATH.join2(NODEFS.realPath(parent), name);
            try {
              fs.rmdirSync(path)
            } catch (e) {
              if (!e.code) throw e;
              throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
          },
          readdir: function (node) {
            var path = NODEFS.realPath(node);
            try {
              return fs.readdirSync(path)
            } catch (e) {
              if (!e.code) throw e;
              throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
          },
          symlink: function (parent, newName, oldPath) {
            var newPath = PATH.join2(NODEFS.realPath(parent), newName);
            try {
              fs.symlinkSync(oldPath, newPath)
            } catch (e) {
              if (!e.code) throw e;
              throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
          },
          readlink: function (node) {
            var path = NODEFS.realPath(node);
            try {
              path = fs.readlinkSync(path);
              path = NODEJS_PATH.relative(NODEJS_PATH.resolve(node.mount.opts.root), path);
              return path
            } catch (e) {
              if (!e.code) throw e;
              throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
          }
        },
        stream_ops: {
          open: function (stream) {
            var path = NODEFS.realPath(stream.node);
            try {
              if (FS.isFile(stream.node.mode)) {
                stream.nfd = fs.openSync(path, NODEFS.flagsForNode(stream.flags))
              }
            } catch (e) {
              if (!e.code) throw e;
              throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
          },
          close: function (stream) {
            try {
              if (FS.isFile(stream.node.mode) && stream.nfd) {
                fs.closeSync(stream.nfd)
              }
            } catch (e) {
              if (!e.code) throw e;
              throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
          },
          read: function (stream, buffer, offset, length, position) {
            if (length === 0) return 0;
            try {
              return fs.readSync(stream.nfd, NODEFS.bufferFrom(buffer.buffer), offset, length, position)
            } catch (e) {
              throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
          },
          write: function (stream, buffer, offset, length, position) {
            try {
              return fs.writeSync(stream.nfd, NODEFS.bufferFrom(buffer.buffer), offset, length, position)
            } catch (e) {
              throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
          },
          llseek: function (stream, offset, whence) {
            var position = offset;
            if (whence === 1) {
              position += stream.position
            } else if (whence === 2) {
              if (FS.isFile(stream.node.mode)) {
                try {
                  var stat = fs.fstatSync(stream.nfd);
                  position += stat.size
                } catch (e) {
                  throw new FS.ErrnoError(ERRNO_CODES[e.code])
                }
              }
            }
            if (position < 0) {
              throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
            }
            return position
          }
        }
      };
      var WORKERFS = {
        DIR_MODE: 16895,
        FILE_MODE: 33279,
        reader: null,
        mount: function (mount) {
          assert(ENVIRONMENT_IS_WORKER);
          if (!WORKERFS.reader) WORKERFS.reader = new FileReaderSync;
          var root = WORKERFS.createNode(null, "/", WORKERFS.DIR_MODE, 0);
          var createdParents = {};

          function ensureParent(path) {
            var parts = path.split("/");
            var parent = root;
            for (var i = 0; i < parts.length - 1; i++) {
              var curr = parts.slice(0, i + 1).join("/");
              if (!createdParents[curr]) {
                createdParents[curr] = WORKERFS.createNode(parent, parts[i], WORKERFS.DIR_MODE, 0)
              }
              parent = createdParents[curr]
            }
            return parent
          }

          function base(path) {
            var parts = path.split("/");
            return parts[parts.length - 1]
          }
          Array.prototype.forEach.call(mount.opts["files"] || [], function (file) {
            WORKERFS.createNode(ensureParent(file.name), base(file.name), WORKERFS.FILE_MODE, 0, file, file.lastModifiedDate)
          });
          (mount.opts["blobs"] || []).forEach(function (obj) {
            WORKERFS.createNode(ensureParent(obj["name"]), base(obj["name"]), WORKERFS.FILE_MODE, 0, obj["data"])
          });
          (mount.opts["packages"] || []).forEach(function (pack) {
            pack["metadata"].files.forEach(function (file) {
              var name = file.filename.substr(1);
              WORKERFS.createNode(ensureParent(name), base(name), WORKERFS.FILE_MODE, 0, pack["blob"].slice(file.start, file.end))
            })
          });
          return root
        },
        createNode: function (parent, name, mode, dev, contents, mtime) {
          var node = FS.createNode(parent, name, mode);
          node.mode = mode;
          node.node_ops = WORKERFS.node_ops;
          node.stream_ops = WORKERFS.stream_ops;
          node.timestamp = (mtime || new Date).getTime();
          assert(WORKERFS.FILE_MODE !== WORKERFS.DIR_MODE);
          if (mode === WORKERFS.FILE_MODE) {
            node.size = contents.size;
            node.contents = contents
          } else {
            node.size = 4096;
            node.contents = {}
          }
          if (parent) {
            parent.contents[name] = node
          }
          return node
        },
        node_ops: {
          getattr: function (node) {
            return {
              dev: 1,
              ino: undefined,
              mode: node.mode,
              nlink: 1,
              uid: 0,
              gid: 0,
              rdev: undefined,
              size: node.size,
              atime: new Date(node.timestamp),
              mtime: new Date(node.timestamp),
              ctime: new Date(node.timestamp),
              blksize: 4096,
              blocks: Math.ceil(node.size / 4096)
            }
          },
          setattr: function (node, attr) {
            if (attr.mode !== undefined) {
              node.mode = attr.mode
            }
            if (attr.timestamp !== undefined) {
              node.timestamp = attr.timestamp
            }
          },
          lookup: function (parent, name) {
            throw new FS.ErrnoError(ERRNO_CODES.ENOENT)
          },
          mknod: function (parent, name, mode, dev) {
            throw new FS.ErrnoError(ERRNO_CODES.EPERM)
          },
          rename: function (oldNode, newDir, newName) {
            throw new FS.ErrnoError(ERRNO_CODES.EPERM)
          },
          unlink: function (parent, name) {
            throw new FS.ErrnoError(ERRNO_CODES.EPERM)
          },
          rmdir: function (parent, name) {
            throw new FS.ErrnoError(ERRNO_CODES.EPERM)
          },
          readdir: function (node) {
            var entries = [".", ".."];
            for (var key in node.contents) {
              if (!node.contents.hasOwnProperty(key)) {
                continue
              }
              entries.push(key)
            }
            return entries
          },
          symlink: function (parent, newName, oldPath) {
            throw new FS.ErrnoError(ERRNO_CODES.EPERM)
          },
          readlink: function (node) {
            throw new FS.ErrnoError(ERRNO_CODES.EPERM)
          }
        },
        stream_ops: {
          read: function (stream, buffer, offset, length, position) {
            if (position >= stream.node.size) return 0;
            var chunk = stream.node.contents.slice(position, position + length);
            var ab = WORKERFS.reader.readAsArrayBuffer(chunk);
            buffer.set(new Uint8Array(ab), offset);
            return chunk.size
          },
          write: function (stream, buffer, offset, length, position) {
            throw new FS.ErrnoError(ERRNO_CODES.EIO)
          },
          llseek: function (stream, offset, whence) {
            var position = offset;
            if (whence === 1) {
              position += stream.position
            } else if (whence === 2) {
              if (FS.isFile(stream.node.mode)) {
                position += stream.node.size
              }
            }
            if (position < 0) {
              throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
            }
            return position
          }
        }
      };
      var ERRNO_MESSAGES = {
        0: "Success",
        1: "Not super-user",
        2: "No such file or directory",
        3: "No such process",
        4: "Interrupted system call",
        5: "I/O error",
        6: "No such device or address",
        7: "Arg list too long",
        8: "Exec format error",
        9: "Bad file number",
        10: "No children",
        11: "No more processes",
        12: "Not enough core",
        13: "Permission denied",
        14: "Bad address",
        15: "Block device required",
        16: "Mount device busy",
        17: "File exists",
        18: "Cross-device link",
        19: "No such device",
        20: "Not a directory",
        21: "Is a directory",
        22: "Invalid argument",
        23: "Too many open files in system",
        24: "Too many open files",
        25: "Not a typewriter",
        26: "Text file busy",
        27: "File too large",
        28: "No space left on device",
        29: "Illegal seek",
        30: "Read only file system",
        31: "Too many links",
        32: "Broken pipe",
        33: "Math arg out of domain of func",
        34: "Math result not representable",
        35: "File locking deadlock error",
        36: "File or path name too long",
        37: "No record locks available",
        38: "Function not implemented",
        39: "Directory not empty",
        40: "Too many symbolic links",
        42: "No message of desired type",
        43: "Identifier removed",
        44: "Channel number out of range",
        45: "Level 2 not synchronized",
        46: "Level 3 halted",
        47: "Level 3 reset",
        48: "Link number out of range",
        49: "Protocol driver not attached",
        50: "No CSI structure available",
        51: "Level 2 halted",
        52: "Invalid exchange",
        53: "Invalid request descriptor",
        54: "Exchange full",
        55: "No anode",
        56: "Invalid request code",
        57: "Invalid slot",
        59: "Bad font file fmt",
        60: "Device not a stream",
        61: "No data (for no delay io)",
        62: "Timer expired",
        63: "Out of streams resources",
        64: "Machine is not on the network",
        65: "Package not installed",
        66: "The object is remote",
        67: "The link has been severed",
        68: "Advertise error",
        69: "Srmount error",
        70: "Communication error on send",
        71: "Protocol error",
        72: "Multihop attempted",
        73: "Cross mount point (not really error)",
        74: "Trying to read unreadable message",
        75: "Value too large for defined data type",
        76: "Given log. name not unique",
        77: "f.d. invalid for this operation",
        78: "Remote address changed",
        79: "Can   access a needed shared lib",
        80: "Accessing a corrupted shared lib",
        81: ".lib section in a.out corrupted",
        82: "Attempting to link in too many libs",
        83: "Attempting to exec a shared library",
        84: "Illegal byte sequence",
        86: "Streams pipe error",
        87: "Too many users",
        88: "Socket operation on non-socket",
        89: "Destination address required",
        90: "Message too long",
        91: "Protocol wrong type for socket",
        92: "Protocol not available",
        93: "Unknown protocol",
        94: "Socket type not supported",
        95: "Not supported",
        96: "Protocol family not supported",
        97: "Address family not supported by protocol family",
        98: "Address already in use",
        99: "Address not available",
        100: "Network interface is not configured",
        101: "Network is unreachable",
        102: "Connection reset by network",
        103: "Connection aborted",
        104: "Connection reset by peer",
        105: "No buffer space available",
        106: "Socket is already connected",
        107: "Socket is not connected",
        108: "Can't send after socket shutdown",
        109: "Too many references",
        110: "Connection timed out",
        111: "Connection refused",
        112: "Host is down",
        113: "Host is unreachable",
        114: "Socket already connected",
        115: "Connection already in progress",
        116: "Stale file handle",
        122: "Quota exceeded",
        123: "No medium (in tape drive)",
        125: "Operation canceled",
        130: "Previous owner died",
        131: "State not recoverable"
      };
      var ERRNO_CODES = {
        EPERM: 1,
        ENOENT: 2,
        ESRCH: 3,
        EINTR: 4,
        EIO: 5,
        ENXIO: 6,
        E2BIG: 7,
        ENOEXEC: 8,
        EBADF: 9,
        ECHILD: 10,
        EAGAIN: 11,
        EWOULDBLOCK: 11,
        ENOMEM: 12,
        EACCES: 13,
        EFAULT: 14,
        ENOTBLK: 15,
        EBUSY: 16,
        EEXIST: 17,
        EXDEV: 18,
        ENODEV: 19,
        ENOTDIR: 20,
        EISDIR: 21,
        EINVAL: 22,
        ENFILE: 23,
        EMFILE: 24,
        ENOTTY: 25,
        ETXTBSY: 26,
        EFBIG: 27,
        ENOSPC: 28,
        ESPIPE: 29,
        EROFS: 30,
        EMLINK: 31,
        EPIPE: 32,
        EDOM: 33,
        ERANGE: 34,
        ENOMSG: 42,
        EIDRM: 43,
        ECHRNG: 44,
        EL2NSYNC: 45,
        EL3HLT: 46,
        EL3RST: 47,
        ELNRNG: 48,
        EUNATCH: 49,
        ENOCSI: 50,
        EL2HLT: 51,
        EDEADLK: 35,
        ENOLCK: 37,
        EBADE: 52,
        EBADR: 53,
        EXFULL: 54,
        ENOANO: 55,
        EBADRQC: 56,
        EBADSLT: 57,
        EDEADLOCK: 35,
        EBFONT: 59,
        ENOSTR: 60,
        ENODATA: 61,
        ETIME: 62,
        ENOSR: 63,
        ENONET: 64,
        ENOPKG: 65,
        EREMOTE: 66,
        ENOLINK: 67,
        EADV: 68,
        ESRMNT: 69,
        ECOMM: 70,
        EPROTO: 71,
        EMULTIHOP: 72,
        EDOTDOT: 73,
        EBADMSG: 74,
        ENOTUNIQ: 76,
        EBADFD: 77,
        EREMCHG: 78,
        ELIBACC: 79,
        ELIBBAD: 80,
        ELIBSCN: 81,
        ELIBMAX: 82,
        ELIBEXEC: 83,
        ENOSYS: 38,
        ENOTEMPTY: 39,
        ENAMETOOLONG: 36,
        ELOOP: 40,
        EOPNOTSUPP: 95,
        EPFNOSUPPORT: 96,
        ECONNRESET: 104,
        ENOBUFS: 105,
        EAFNOSUPPORT: 97,
        EPROTOTYPE: 91,
        ENOTSOCK: 88,
        ENOPROTOOPT: 92,
        ESHUTDOWN: 108,
        ECONNREFUSED: 111,
        EADDRINUSE: 98,
        ECONNABORTED: 103,
        ENETUNREACH: 101,
        ENETDOWN: 100,
        ETIMEDOUT: 110,
        EHOSTDOWN: 112,
        EHOSTUNREACH: 113,
        EINPROGRESS: 115,
        EALREADY: 114,
        EDESTADDRREQ: 89,
        EMSGSIZE: 90,
        EPROTONOSUPPORT: 93,
        ESOCKTNOSUPPORT: 94,
        EADDRNOTAVAIL: 99,
        ENETRESET: 102,
        EISCONN: 106,
        ENOTCONN: 107,
        ETOOMANYREFS: 109,
        EUSERS: 87,
        EDQUOT: 122,
        ESTALE: 116,
        ENOTSUP: 95,
        ENOMEDIUM: 123,
        EILSEQ: 84,
        EOVERFLOW: 75,
        ECANCELED: 125,
        ENOTRECOVERABLE: 131,
        EOWNERDEAD: 130,
        ESTRPIPE: 86
      };
      var FS = {
        root: null,
        mounts: [],
        devices: {},
        streams: [],
        nextInode: 1,
        nameTable: null,
        currentPath: "/",
        initialized: false,
        ignorePermissions: true,
        trackingDelegate: {},
        tracking: {
          openFlags: {
            READ: 1,
            WRITE: 2
          }
        },
        ErrnoError: null,
        genericErrors: {},
        filesystems: null,
        syncFSRequests: 0,
        handleFSError: function (e) {
          if (!(e instanceof FS.ErrnoError)) throw e + " : " + stackTrace();
          return ___setErrNo(e.errno)
        },
        lookupPath: function (path, opts) {
          path = PATH.resolve(FS.cwd(), path);
          opts = opts || {};
          if (!path) return {
            path: "",
            node: null
          };
          var defaults = {
            follow_mount: true,
            recurse_count: 0
          };
          for (var key in defaults) {
            if (opts[key] === undefined) {
              opts[key] = defaults[key]
            }
          }
          if (opts.recurse_count > 8) {
            throw new FS.ErrnoError(40)
          }
          var parts = PATH.normalizeArray(path.split("/").filter(function (p) {
            return !!p
          }), false);
          var current = FS.root;
          var current_path = "/";
          for (var i = 0; i < parts.length; i++) {
            var islast = i === parts.length - 1;
            if (islast && opts.parent) {
              break
            }
            current = FS.lookupNode(current, parts[i]);
            current_path = PATH.join2(current_path, parts[i]);
            if (FS.isMountpoint(current)) {
              if (!islast || islast && opts.follow_mount) {
                current = current.mounted.root
              }
            }
            if (!islast || opts.follow) {
              var count = 0;
              while (FS.isLink(current.mode)) {
                var link = FS.readlink(current_path);
                current_path = PATH.resolve(PATH.dirname(current_path), link);
                var lookup = FS.lookupPath(current_path, {
                  recurse_count: opts.recurse_count
                });
                current = lookup.node;
                if (count++ > 40) {
                  throw new FS.ErrnoError(40)
                }
              }
            }
          }
          return {
            path: current_path,
            node: current
          }
        },
        getPath: function (node) {
          var path;
          while (true) {
            if (FS.isRoot(node)) {
              var mount = node.mount.mountpoint;
              if (!path) return mount;
              return mount[mount.length - 1] !== "/" ? mount + "/" + path : mount + path
            }
            path = path ? node.name + "/" + path : node.name;
            node = node.parent
          }
        },
        hashName: function (parentid, name) {
          var hash = 0;
          for (var i = 0; i < name.length; i++) {
            hash = (hash << 5) - hash + name.charCodeAt(i) | 0
          }
          return (parentid + hash >>> 0) % FS.nameTable.length
        },
        hashAddNode: function (node) {
          var hash = FS.hashName(node.parent.id, node.name);
          node.name_next = FS.nameTable[hash];
          FS.nameTable[hash] = node
        },
        hashRemoveNode: function (node) {
          var hash = FS.hashName(node.parent.id, node.name);
          if (FS.nameTable[hash] === node) {
            FS.nameTable[hash] = node.name_next
          } else {
            var current = FS.nameTable[hash];
            while (current) {
              if (current.name_next === node) {
                current.name_next = node.name_next;
                break
              }
              current = current.name_next
            }
          }
        },
        lookupNode: function (parent, name) {
          var err = FS.mayLookup(parent);
          if (err) {
            throw new FS.ErrnoError(err, parent)
          }
          var hash = FS.hashName(parent.id, name);
          for (var node = FS.nameTable[hash]; node; node = node.name_next) {
            var nodeName = node.name;
            if (node.parent.id === parent.id && nodeName === name) {
              return node
            }
          }
          return FS.lookup(parent, name)
        },
        createNode: function (parent, name, mode, rdev) {
          if (!FS.FSNode) {
            FS.FSNode = function (parent, name, mode, rdev) {
              if (!parent) {
                parent = this
              }
              this.parent = parent;
              this.mount = parent.mount;
              this.mounted = null;
              this.id = FS.nextInode++;
              this.name = name;
              this.mode = mode;
              this.node_ops = {};
              this.stream_ops = {};
              this.rdev = rdev
            };
            FS.FSNode.prototype = {};
            var readMode = 292 | 73;
            var writeMode = 146;
            Object.defineProperties(FS.FSNode.prototype, {
              read: {
                get: function () {
                  return (this.mode & readMode) === readMode
                },
                set: function (val) {
                  val ? this.mode |= readMode : this.mode &= ~readMode
                }
              },
              write: {
                get: function () {
                  return (this.mode & writeMode) === writeMode
                },
                set: function (val) {
                  val ? this.mode |= writeMode : this.mode &= ~writeMode
                }
              },
              isFolder: {
                get: function () {
                  return FS.isDir(this.mode)
                }
              },
              isDevice: {
                get: function () {
                  return FS.isChrdev(this.mode)
                }
              }
            })
          }
          var node = new FS.FSNode(parent, name, mode, rdev);
          FS.hashAddNode(node);
          return node
        },
        destroyNode: function (node) {
          FS.hashRemoveNode(node)
        },
        isRoot: function (node) {
          return node === node.parent
        },
        isMountpoint: function (node) {
          return !!node.mounted
        },
        isFile: function (mode) {
          return (mode & 61440) === 32768
        },
        isDir: function (mode) {
          return (mode & 61440) === 16384
        },
        isLink: function (mode) {
          return (mode & 61440) === 40960
        },
        isChrdev: function (mode) {
          return (mode & 61440) === 8192
        },
        isBlkdev: function (mode) {
          return (mode & 61440) === 24576
        },
        isFIFO: function (mode) {
          return (mode & 61440) === 4096
        },
        isSocket: function (mode) {
          return (mode & 49152) === 49152
        },
        flagModes: {
          "r": 0,
          "rs": 1052672,
          "r+": 2,
          "w": 577,
          "wx": 705,
          "xw": 705,
          "w+": 578,
          "wx+": 706,
          "xw+": 706,
          "a": 1089,
          "ax": 1217,
          "xa": 1217,
          "a+": 1090,
          "ax+": 1218,
          "xa+": 1218
        },
        modeStringToFlags: function (str) {
          var flags = FS.flagModes[str];
          if (typeof flags === "undefined") {
            throw new Error("Unknown file open mode: " + str)
          }
          return flags
        },
        flagsToPermissionString: function (flag) {
          var perms = ["r", "w", "rw"][flag & 3];
          if (flag & 512) {
            perms += "w"
          }
          return perms
        },
        nodePermissions: function (node, perms) {
          if (FS.ignorePermissions) {
            return 0
          }
          if (perms.indexOf("r") !== -1 && !(node.mode & 292)) {
            return 13
          } else if (perms.indexOf("w") !== -1 && !(node.mode & 146)) {
            return 13
          } else if (perms.indexOf("x") !== -1 && !(node.mode & 73)) {
            return 13
          }
          return 0
        },
        mayLookup: function (dir) {
          var err = FS.nodePermissions(dir, "x");
          if (err) return err;
          if (!dir.node_ops.lookup) return 13;
          return 0
        },
        mayCreate: function (dir, name) {
          try {
            var node = FS.lookupNode(dir, name);
            return 17
          } catch (e) {}
          return FS.nodePermissions(dir, "wx")
        },
        mayDelete: function (dir, name, isdir) {
          var node;
          try {
            node = FS.lookupNode(dir, name)
          } catch (e) {
            return e.errno
          }
          var err = FS.nodePermissions(dir, "wx");
          if (err) {
            return err
          }
          if (isdir) {
            if (!FS.isDir(node.mode)) {
              return 20
            }
            if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
              return 16
            }
          } else {
            if (FS.isDir(node.mode)) {
              return 21
            }
          }
          return 0
        },
        mayOpen: function (node, flags) {
          if (!node) {
            return 2
          }
          if (FS.isLink(node.mode)) {
            return 40
          } else if (FS.isDir(node.mode)) {
            if (FS.flagsToPermissionString(flags) !== "r" || flags & 512) {
              return 21
            }
          }
          return FS.nodePermissions(node, FS.flagsToPermissionString(flags))
        },
        MAX_OPEN_FDS: 4096,
        nextfd: function (fd_start, fd_end) {
          fd_start = fd_start || 0;
          fd_end = fd_end || FS.MAX_OPEN_FDS;
          for (var fd = fd_start; fd <= fd_end; fd++) {
            if (!FS.streams[fd]) {
              return fd
            }
          }
          throw new FS.ErrnoError(24)
        },
        getStream: function (fd) {
          return FS.streams[fd]
        },
        createStream: function (stream, fd_start, fd_end) {
          if (!FS.FSStream) {
            FS.FSStream = function () {};
            FS.FSStream.prototype = {};
            Object.defineProperties(FS.FSStream.prototype, {
              object: {
                get: function () {
                  return this.node
                },
                set: function (val) {
                  this.node = val
                }
              },
              isRead: {
                get: function () {
                  return (this.flags & 2097155) !== 1
                }
              },
              isWrite: {
                get: function () {
                  return (this.flags & 2097155) !== 0
                }
              },
              isAppend: {
                get: function () {
                  return this.flags & 1024
                }
              }
            })
          }
          var newStream = new FS.FSStream;
          for (var p in stream) {
            newStream[p] = stream[p]
          }
          stream = newStream;
          var fd = FS.nextfd(fd_start, fd_end);
          stream.fd = fd;
          FS.streams[fd] = stream;
          return stream
        },
        closeStream: function (fd) {
          FS.streams[fd] = null
        },
        chrdev_stream_ops: {
          open: function (stream) {
            var device = FS.getDevice(stream.node.rdev);
            stream.stream_ops = device.stream_ops;
            if (stream.stream_ops.open) {
              stream.stream_ops.open(stream)
            }
          },
          llseek: function () {
            throw new FS.ErrnoError(29)
          }
        },
        major: function (dev) {
          return dev >> 8
        },
        minor: function (dev) {
          return dev & 255
        },
        makedev: function (ma, mi) {
          return ma << 8 | mi
        },
        registerDevice: function (dev, ops) {
          FS.devices[dev] = {
            stream_ops: ops
          }
        },
        getDevice: function (dev) {
          return FS.devices[dev]
        },
        getMounts: function (mount) {
          var mounts = [];
          var check = [mount];
          while (check.length) {
            var m = check.pop();
            mounts.push(m);
            check.push.apply(check, m.mounts)
          }
          return mounts
        },
        syncfs: function (populate, callback) {
          if (typeof populate === "function") {
            callback = populate;
            populate = false
          }
          FS.syncFSRequests++;
          if (FS.syncFSRequests > 1) {
            console.log("warning: " + FS.syncFSRequests + " FS.syncfs operations in flight at once, probably just doing extra work")
          }
          var mounts = FS.getMounts(FS.root.mount);
          var completed = 0;

          function doCallback(err) {
            assert(FS.syncFSRequests > 0);
            FS.syncFSRequests--;
            return callback(err)
          }

          function done(err) {
            if (err) {
              if (!done.errored) {
                done.errored = true;
                return doCallback(err)
              }
              return
            }
            if (++completed >= mounts.length) {
              doCallback(null)
            }
          }
          mounts.forEach(function (mount) {
            if (!mount.type.syncfs) {
              return done(null)
            }
            mount.type.syncfs(mount, populate, done)
          })
        },
        mount: function (type, opts, mountpoint) {
          var root = mountpoint === "/";
          var pseudo = !mountpoint;
          var node;
          if (root && FS.root) {
            throw new FS.ErrnoError(16)
          } else if (!root && !pseudo) {
            var lookup = FS.lookupPath(mountpoint, {
              follow_mount: false
            });
            mountpoint = lookup.path;
            node = lookup.node;
            if (FS.isMountpoint(node)) {
              throw new FS.ErrnoError(16)
            }
            if (!FS.isDir(node.mode)) {
              throw new FS.ErrnoError(20)
            }
          }
          var mount = {
            type: type,
            opts: opts,
            mountpoint: mountpoint,
            mounts: []
          };
          var mountRoot = type.mount(mount);
          mountRoot.mount = mount;
          mount.root = mountRoot;
          if (root) {
            FS.root = mountRoot
          } else if (node) {
            node.mounted = mount;
            if (node.mount) {
              node.mount.mounts.push(mount)
            }
          }
          return mountRoot
        },
        unmount: function (mountpoint) {
          var lookup = FS.lookupPath(mountpoint, {
            follow_mount: false
          });
          if (!FS.isMountpoint(lookup.node)) {
            throw new FS.ErrnoError(22)
          }
          var node = lookup.node;
          var mount = node.mounted;
          var mounts = FS.getMounts(mount);
          Object.keys(FS.nameTable).forEach(function (hash) {
            var current = FS.nameTable[hash];
            while (current) {
              var next = current.name_next;
              if (mounts.indexOf(current.mount) !== -1) {
                FS.destroyNode(current)
              }
              current = next
            }
          });
          node.mounted = null;
          var idx = node.mount.mounts.indexOf(mount);
          assert(idx !== -1);
          node.mount.mounts.splice(idx, 1)
        },
        lookup: function (parent, name) {
          return parent.node_ops.lookup(parent, name)
        },
        mknod: function (path, mode, dev) {
          var lookup = FS.lookupPath(path, {
            parent: true
          });
          var parent = lookup.node;
          var name = PATH.basename(path);
          if (!name || name === "." || name === "..") {
            throw new FS.ErrnoError(22)
          }
          var err = FS.mayCreate(parent, name);
          if (err) {
            throw new FS.ErrnoError(err)
          }
          if (!parent.node_ops.mknod) {
            throw new FS.ErrnoError(1)
          }
          return parent.node_ops.mknod(parent, name, mode, dev)
        },
        create: function (path, mode) {
          mode = mode !== undefined ? mode : 438;
          mode &= 4095;
          mode |= 32768;
          return FS.mknod(path, mode, 0)
        },
        mkdir: function (path, mode) {
          mode = mode !== undefined ? mode : 511;
          mode &= 511 | 512;
          mode |= 16384;
          return FS.mknod(path, mode, 0)
        },
        mkdirTree: function (path, mode) {
          var dirs = path.split("/");
          var d = "";
          for (var i = 0; i < dirs.length; ++i) {
            if (!dirs[i]) continue;
            d += "/" + dirs[i];
            try {
              FS.mkdir(d, mode)
            } catch (e) {
              if (e.errno != 17) throw e
            }
          }
        },
        mkdev: function (path, mode, dev) {
          if (typeof dev === "undefined") {
            dev = mode;
            mode = 438
          }
          mode |= 8192;
          return FS.mknod(path, mode, dev)
        },
        symlink: function (oldpath, newpath) {
          if (!PATH.resolve(oldpath)) {
            throw new FS.ErrnoError(2)
          }
          var lookup = FS.lookupPath(newpath, {
            parent: true
          });
          var parent = lookup.node;
          if (!parent) {
            throw new FS.ErrnoError(2)
          }
          var newname = PATH.basename(newpath);
          var err = FS.mayCreate(parent, newname);
          if (err) {
            throw new FS.ErrnoError(err)
          }
          if (!parent.node_ops.symlink) {
            throw new FS.ErrnoError(1)
          }
          return parent.node_ops.symlink(parent, newname, oldpath)
        },
        rename: function (old_path, new_path) {
          var old_dirname = PATH.dirname(old_path);
          var new_dirname = PATH.dirname(new_path);
          var old_name = PATH.basename(old_path);
          var new_name = PATH.basename(new_path);
          var lookup, old_dir, new_dir;
          try {
            lookup = FS.lookupPath(old_path, {
              parent: true
            });
            old_dir = lookup.node;
            lookup = FS.lookupPath(new_path, {
              parent: true
            });
            new_dir = lookup.node
          } catch (e) {
            throw new FS.ErrnoError(16)
          }
          if (!old_dir || !new_dir) throw new FS.ErrnoError(2);
          if (old_dir.mount !== new_dir.mount) {
            throw new FS.ErrnoError(18)
          }
          var old_node = FS.lookupNode(old_dir, old_name);
          var relative = PATH.relative(old_path, new_dirname);
          if (relative.charAt(0) !== ".") {
            throw new FS.ErrnoError(22)
          }
          relative = PATH.relative(new_path, old_dirname);
          if (relative.charAt(0) !== ".") {
            throw new FS.ErrnoError(39)
          }
          var new_node;
          try {
            new_node = FS.lookupNode(new_dir, new_name)
          } catch (e) {}
          if (old_node === new_node) {
            return
          }
          var isdir = FS.isDir(old_node.mode);
          var err = FS.mayDelete(old_dir, old_name, isdir);
          if (err) {
            throw new FS.ErrnoError(err)
          }
          err = new_node ? FS.mayDelete(new_dir, new_name, isdir) : FS.mayCreate(new_dir, new_name);
          if (err) {
            throw new FS.ErrnoError(err)
          }
          if (!old_dir.node_ops.rename) {
            throw new FS.ErrnoError(1)
          }
          if (FS.isMountpoint(old_node) || new_node && FS.isMountpoint(new_node)) {
            throw new FS.ErrnoError(16)
          }
          if (new_dir !== old_dir) {
            err = FS.nodePermissions(old_dir, "w");
            if (err) {
              throw new FS.ErrnoError(err)
            }
          }
          try {
            if (FS.trackingDelegate["willMovePath"]) {
              FS.trackingDelegate["willMovePath"](old_path, new_path)
            }
          } catch (e) {
            console.log("FS.trackingDelegate['willMovePath']('" + old_path + "', '" + new_path + "') threw an exception: " + e.message)
          }
          FS.hashRemoveNode(old_node);
          try {
            old_dir.node_ops.rename(old_node, new_dir, new_name)
          } catch (e) {
            throw e
          } finally {
            FS.hashAddNode(old_node)
          }
          try {
            if (FS.trackingDelegate["onMovePath"]) FS.trackingDelegate["onMovePath"](old_path, new_path)
          } catch (e) {
            console.log("FS.trackingDelegate['onMovePath']('" + old_path + "', '" + new_path + "') threw an exception: " + e.message)
          }
        },
        rmdir: function (path) {
          var lookup = FS.lookupPath(path, {
            parent: true
          });
          var parent = lookup.node;
          var name = PATH.basename(path);
          var node = FS.lookupNode(parent, name);
          var err = FS.mayDelete(parent, name, true);
          if (err) {
            throw new FS.ErrnoError(err)
          }
          if (!parent.node_ops.rmdir) {
            throw new FS.ErrnoError(1)
          }
          if (FS.isMountpoint(node)) {
            throw new FS.ErrnoError(16)
          }
          try {
            if (FS.trackingDelegate["willDeletePath"]) {
              FS.trackingDelegate["willDeletePath"](path)
            }
          } catch (e) {
            console.log("FS.trackingDelegate['willDeletePath']('" + path + "') threw an exception: " + e.message)
          }
          parent.node_ops.rmdir(parent, name);
          FS.destroyNode(node);
          try {
            if (FS.trackingDelegate["onDeletePath"]) FS.trackingDelegate["onDeletePath"](path)
          } catch (e) {
            console.log("FS.trackingDelegate['onDeletePath']('" + path + "') threw an exception: " + e.message)
          }
        },
        readdir: function (path) {
          var lookup = FS.lookupPath(path, {
            follow: true
          });
          var node = lookup.node;
          if (!node.node_ops.readdir) {
            throw new FS.ErrnoError(20)
          }
          return node.node_ops.readdir(node)
        },
        unlink: function (path) {
          var lookup = FS.lookupPath(path, {
            parent: true
          });
          var parent = lookup.node;
          var name = PATH.basename(path);
          var node = FS.lookupNode(parent, name);
          var err = FS.mayDelete(parent, name, false);
          if (err) {
            throw new FS.ErrnoError(err)
          }
          if (!parent.node_ops.unlink) {
            throw new FS.ErrnoError(1)
          }
          if (FS.isMountpoint(node)) {
            throw new FS.ErrnoError(16)
          }
          try {
            if (FS.trackingDelegate["willDeletePath"]) {
              FS.trackingDelegate["willDeletePath"](path)
            }
          } catch (e) {
            console.log("FS.trackingDelegate['willDeletePath']('" + path + "') threw an exception: " + e.message)
          }
          parent.node_ops.unlink(parent, name);
          FS.destroyNode(node);
          try {
            if (FS.trackingDelegate["onDeletePath"]) FS.trackingDelegate["onDeletePath"](path)
          } catch (e) {
            console.log("FS.trackingDelegate['onDeletePath']('" + path + "') threw an exception: " + e.message)
          }
        },
        readlink: function (path) {
          var lookup = FS.lookupPath(path);
          var link = lookup.node;
          if (!link) {
            throw new FS.ErrnoError(2)
          }
          if (!link.node_ops.readlink) {
            throw new FS.ErrnoError(22)
          }
          return PATH.resolve(FS.getPath(link.parent), link.node_ops.readlink(link))
        },
        stat: function (path, dontFollow) {
          var lookup = FS.lookupPath(path, {
            follow: !dontFollow
          });
          var node = lookup.node;
          if (!node) {
            throw new FS.ErrnoError(2)
          }
          if (!node.node_ops.getattr) {
            throw new FS.ErrnoError(1)
          }
          return node.node_ops.getattr(node)
        },
        lstat: function (path) {
          return FS.stat(path, true)
        },
        chmod: function (path, mode, dontFollow) {
          var node;
          if (typeof path === "string") {
            var lookup = FS.lookupPath(path, {
              follow: !dontFollow
            });
            node = lookup.node
          } else {
            node = path
          }
          if (!node.node_ops.setattr) {
            throw new FS.ErrnoError(1)
          }
          node.node_ops.setattr(node, {
            mode: mode & 4095 | node.mode & ~4095,
            timestamp: Date.now()
          })
        },
        lchmod: function (path, mode) {
          FS.chmod(path, mode, true)
        },
        fchmod: function (fd, mode) {
          var stream = FS.getStream(fd);
          if (!stream) {
            throw new FS.ErrnoError(9)
          }
          FS.chmod(stream.node, mode)
        },
        chown: function (path, uid, gid, dontFollow) {
          var node;
          if (typeof path === "string") {
            var lookup = FS.lookupPath(path, {
              follow: !dontFollow
            });
            node = lookup.node
          } else {
            node = path
          }
          if (!node.node_ops.setattr) {
            throw new FS.ErrnoError(1)
          }
          node.node_ops.setattr(node, {
            timestamp: Date.now()
          })
        },
        lchown: function (path, uid, gid) {
          FS.chown(path, uid, gid, true)
        },
        fchown: function (fd, uid, gid) {
          var stream = FS.getStream(fd);
          if (!stream) {
            throw new FS.ErrnoError(9)
          }
          FS.chown(stream.node, uid, gid)
        },
        truncate: function (path, len) {
          if (len < 0) {
            throw new FS.ErrnoError(22)
          }
          var node;
          if (typeof path === "string") {
            var lookup = FS.lookupPath(path, {
              follow: true
            });
            node = lookup.node
          } else {
            node = path
          }
          if (!node.node_ops.setattr) {
            throw new FS.ErrnoError(1)
          }
          if (FS.isDir(node.mode)) {
            throw new FS.ErrnoError(21)
          }
          if (!FS.isFile(node.mode)) {
            throw new FS.ErrnoError(22)
          }
          var err = FS.nodePermissions(node, "w");
          if (err) {
            throw new FS.ErrnoError(err)
          }
          node.node_ops.setattr(node, {
            size: len,
            timestamp: Date.now()
          })
        },
        ftruncate: function (fd, len) {
          var stream = FS.getStream(fd);
          if (!stream) {
            throw new FS.ErrnoError(9)
          }
          if ((stream.flags & 2097155) === 0) {
            throw new FS.ErrnoError(22)
          }
          FS.truncate(stream.node, len)
        },
        utime: function (path, atime, mtime) {
          var lookup = FS.lookupPath(path, {
            follow: true
          });
          var node = lookup.node;
          node.node_ops.setattr(node, {
            timestamp: Math.max(atime, mtime)
          })
        },
        open: function (path, flags, mode, fd_start, fd_end) {
          if (path === "") {
            throw new FS.ErrnoError(2)
          }
          flags = typeof flags === "string" ? FS.modeStringToFlags(flags) : flags;
          mode = typeof mode === "undefined" ? 438 : mode;
          if (flags & 64) {
            mode = mode & 4095 | 32768
          } else {
            mode = 0
          }
          var node;
          if (typeof path === "object") {
            node = path
          } else {
            path = PATH.normalize(path);
            try {
              var lookup = FS.lookupPath(path, {
                follow: !(flags & 131072)
              });
              node = lookup.node
            } catch (e) {}
          }
          var created = false;
          if (flags & 64) {
            if (node) {
              if (flags & 128) {
                throw new FS.ErrnoError(17)
              }
            } else {
              node = FS.mknod(path, mode, 0);
              created = true
            }
          }
          if (!node) {
            throw new FS.ErrnoError(2)
          }
          if (FS.isChrdev(node.mode)) {
            flags &= ~512
          }
          if (flags & 65536 && !FS.isDir(node.mode)) {
            throw new FS.ErrnoError(20)
          }
          if (!created) {
            var err = FS.mayOpen(node, flags);
            if (err) {
              throw new FS.ErrnoError(err)
            }
          }
          if (flags & 512) {
            FS.truncate(node, 0)
          }
          flags &= ~(128 | 512);
          var stream = FS.createStream({
            node: node,
            path: FS.getPath(node),
            flags: flags,
            seekable: true,
            position: 0,
            stream_ops: node.stream_ops,
            ungotten: [],
            error: false
          }, fd_start, fd_end);
          if (stream.stream_ops.open) {
            stream.stream_ops.open(stream)
          }
          if (Module["logReadFiles"] && !(flags & 1)) {
            if (!FS.readFiles) FS.readFiles = {};
            if (!(path in FS.readFiles)) {
              FS.readFiles[path] = 1;
              console.log("FS.trackingDelegate error on read file: " + path)
            }
          }
          try {
            if (FS.trackingDelegate["onOpenFile"]) {
              var trackingFlags = 0;
              if ((flags & 2097155) !== 1) {
                trackingFlags |= FS.tracking.openFlags.READ
              }
              if ((flags & 2097155) !== 0) {
                trackingFlags |= FS.tracking.openFlags.WRITE
              }
              FS.trackingDelegate["onOpenFile"](path, trackingFlags)
            }
          } catch (e) {
            console.log("FS.trackingDelegate['onOpenFile']('" + path + "', flags) threw an exception: " + e.message)
          }
          return stream
        },
        close: function (stream) {
          if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(9)
          }
          if (stream.getdents) stream.getdents = null;
          try {
            if (stream.stream_ops.close) {
              stream.stream_ops.close(stream)
            }
          } catch (e) {
            throw e
          } finally {
            FS.closeStream(stream.fd)
          }
          stream.fd = null
        },
        isClosed: function (stream) {
          return stream.fd === null
        },
        llseek: function (stream, offset, whence) {
          if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(9)
          }
          if (!stream.seekable || !stream.stream_ops.llseek) {
            throw new FS.ErrnoError(29)
          }
          if (whence != 0 && whence != 1 && whence != 2) {
            throw new FS.ErrnoError(22)
          }
          stream.position = stream.stream_ops.llseek(stream, offset, whence);
          stream.ungotten = [];
          return stream.position
        },
        read: function (stream, buffer, offset, length, position) {
          if (length < 0 || position < 0) {
            throw new FS.ErrnoError(22)
          }
          if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(9)
          }
          if ((stream.flags & 2097155) === 1) {
            throw new FS.ErrnoError(9)
          }
          if (FS.isDir(stream.node.mode)) {
            throw new FS.ErrnoError(21)
          }
          if (!stream.stream_ops.read) {
            throw new FS.ErrnoError(22)
          }
          var seeking = typeof position !== "undefined";
          if (!seeking) {
            position = stream.position
          } else if (!stream.seekable) {
            throw new FS.ErrnoError(29)
          }
          var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
          if (!seeking) stream.position += bytesRead;
          return bytesRead
        },
        write: function (stream, buffer, offset, length, position, canOwn) {
          if (length < 0 || position < 0) {
            throw new FS.ErrnoError(22)
          }
          if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(9)
          }
          if ((stream.flags & 2097155) === 0) {
            throw new FS.ErrnoError(9)
          }
          if (FS.isDir(stream.node.mode)) {
            throw new FS.ErrnoError(21)
          }
          if (!stream.stream_ops.write) {
            throw new FS.ErrnoError(22)
          }
          if (stream.flags & 1024) {
            FS.llseek(stream, 0, 2)
          }
          var seeking = typeof position !== "undefined";
          if (!seeking) {
            position = stream.position
          } else if (!stream.seekable) {
            throw new FS.ErrnoError(29)
          }
          var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
          if (!seeking) stream.position += bytesWritten;
          try {
            if (stream.path && FS.trackingDelegate["onWriteToFile"]) FS.trackingDelegate["onWriteToFile"](stream.path)
          } catch (e) {
            console.log("FS.trackingDelegate['onWriteToFile']('" + stream.path + "') threw an exception: " + e.message)
          }
          return bytesWritten
        },
        allocate: function (stream, offset, length) {
          if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(9)
          }
          if (offset < 0 || length <= 0) {
            throw new FS.ErrnoError(22)
          }
          if ((stream.flags & 2097155) === 0) {
            throw new FS.ErrnoError(9)
          }
          if (!FS.isFile(stream.node.mode) && !FS.isDir(stream.node.mode)) {
            throw new FS.ErrnoError(19)
          }
          if (!stream.stream_ops.allocate) {
            throw new FS.ErrnoError(95)
          }
          stream.stream_ops.allocate(stream, offset, length)
        },
        mmap: function (stream, buffer, offset, length, position, prot, flags) {
          if ((stream.flags & 2097155) === 1) {
            throw new FS.ErrnoError(13)
          }
          if (!stream.stream_ops.mmap) {
            throw new FS.ErrnoError(19)
          }
          return stream.stream_ops.mmap(stream, buffer, offset, length, position, prot, flags)
        },
        msync: function (stream, buffer, offset, length, mmapFlags) {
          if (!stream || !stream.stream_ops.msync) {
            return 0
          }
          return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags)
        },
        munmap: function (stream) {
          return 0
        },
        ioctl: function (stream, cmd, arg) {
          if (!stream.stream_ops.ioctl) {
            throw new FS.ErrnoError(25)
          }
          return stream.stream_ops.ioctl(stream, cmd, arg)
        },
        readFile: function (path, opts) {
          opts = opts || {};
          opts.flags = opts.flags || "r";
          opts.encoding = opts.encoding || "binary";
          if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
            throw new Error('Invalid encoding type "' + opts.encoding + '"')
          }
          var ret;
          var stream = FS.open(path, opts.flags);
          var stat = FS.stat(path);
          var length = stat.size;
          var buf = new Uint8Array(length);
          FS.read(stream, buf, 0, length, 0);
          if (opts.encoding === "utf8") {
            ret = UTF8ArrayToString(buf, 0)
          } else if (opts.encoding === "binary") {
            ret = buf
          }
          FS.close(stream);
          return ret
        },
        writeFile: function (path, data, opts) {
          opts = opts || {};
          opts.flags = opts.flags || "w";
          var stream = FS.open(path, opts.flags, opts.mode);
          if (typeof data === "string") {
            var buf = new Uint8Array(lengthBytesUTF8(data) + 1);
            var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
            FS.write(stream, buf, 0, actualNumBytes, undefined, opts.canOwn)
          } else if (ArrayBuffer.isView(data)) {
            FS.write(stream, data, 0, data.byteLength, undefined, opts.canOwn)
          } else {
            throw new Error("Unsupported data type")
          }
          FS.close(stream)
        },
        cwd: function () {
          return FS.currentPath
        },
        chdir: function (path) {
          var lookup = FS.lookupPath(path, {
            follow: true
          });
          if (lookup.node === null) {
            throw new FS.ErrnoError(2)
          }
          if (!FS.isDir(lookup.node.mode)) {
            throw new FS.ErrnoError(20)
          }
          var err = FS.nodePermissions(lookup.node, "x");
          if (err) {
            throw new FS.ErrnoError(err)
          }
          FS.currentPath = lookup.path
        },
        createDefaultDirectories: function () {
          FS.mkdir("/tmp");
          FS.mkdir("/home");
          FS.mkdir("/home/web_user")
        },
        createDefaultDevices: function () {
          FS.mkdir("/dev");
          FS.registerDevice(FS.makedev(1, 3), {
            read: function () {
              return 0
            },
            write: function (stream, buffer, offset, length, pos) {
              return length
            }
          });
          FS.mkdev("/dev/null", FS.makedev(1, 3));
          TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
          TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
          FS.mkdev("/dev/tty", FS.makedev(5, 0));
          FS.mkdev("/dev/tty1", FS.makedev(6, 0));
          var random_device;
          if (typeof crypto === "object" && typeof crypto["getRandomValues"] === "function") {
            var randomBuffer = new Uint8Array(1);
            random_device = function () {
              crypto.getRandomValues(randomBuffer);
              return randomBuffer[0]
            }
          } else if (ENVIRONMENT_IS_NODE) {
            try {
              var crypto_module = require("crypto");
              random_device = function () {
                return crypto_module["randomBytes"](1)[0]
              }
            } catch (e) {
              random_device = function () {
                return Math.random() * 256 | 0
              }
            }
          } else {
            random_device = function () {
              abort("random_device")
            }
          }
          FS.createDevice("/dev", "random", random_device);
          FS.createDevice("/dev", "urandom", random_device);
          FS.mkdir("/dev/shm");
          FS.mkdir("/dev/shm/tmp")
        },
        createSpecialDirectories: function () {
          FS.mkdir("/proc");
          FS.mkdir("/proc/self");
          FS.mkdir("/proc/self/fd");
          FS.mount({
            mount: function () {
              var node = FS.createNode("/proc/self", "fd", 16384 | 511, 73);
              node.node_ops = {
                lookup: function (parent, name) {
                  var fd = +name;
                  var stream = FS.getStream(fd);
                  if (!stream) throw new FS.ErrnoError(9);
                  var ret = {
                    parent: null,
                    mount: {
                      mountpoint: "fake"
                    },
                    node_ops: {
                      readlink: function () {
                        return stream.path
                      }
                    }
                  };
                  ret.parent = ret;
                  return ret
                }
              };
              return node
            }
          }, {}, "/proc/self/fd")
        },
        createStandardStreams: function () {
          if (Module["stdin"]) {
            FS.createDevice("/dev", "stdin", Module["stdin"])
          } else {
            FS.symlink("/dev/tty", "/dev/stdin")
          }
          if (Module["stdout"]) {
            FS.createDevice("/dev", "stdout", null, Module["stdout"])
          } else {
            FS.symlink("/dev/tty", "/dev/stdout")
          }
          if (Module["stderr"]) {
            FS.createDevice("/dev", "stderr", null, Module["stderr"])
          } else {
            FS.symlink("/dev/tty1", "/dev/stderr")
          }
          var stdin = FS.open("/dev/stdin", "r");
          var stdout = FS.open("/dev/stdout", "w");
          var stderr = FS.open("/dev/stderr", "w");
          assert(stdin.fd === 0, "invalid handle for stdin (" + stdin.fd + ")");
          assert(stdout.fd === 1, "invalid handle for stdout (" + stdout.fd + ")");
          assert(stderr.fd === 2, "invalid handle for stderr (" + stderr.fd + ")")
        },
        ensureErrnoError: function () {
          if (FS.ErrnoError) return;
          FS.ErrnoError = function ErrnoError(errno, node) {
            this.node = node;
            this.setErrno = function (errno) {
              this.errno = errno;
              for (var key in ERRNO_CODES) {
                if (ERRNO_CODES[key] === errno) {
                  this.code = key;
                  break
                }
              }
            };
            this.setErrno(errno);
            this.message = ERRNO_MESSAGES[errno];
            if (this.stack) Object.defineProperty(this, "stack", {
              value: (new Error).stack,
              writable: true
            });
            if (this.stack) this.stack = demangleAll(this.stack)
          };
          FS.ErrnoError.prototype = new Error;
          FS.ErrnoError.prototype.constructor = FS.ErrnoError;
          [2].forEach(function (code) {
            FS.genericErrors[code] = new FS.ErrnoError(code);
            FS.genericErrors[code].stack = "<generic error, no stack>"
          })
        },
        staticInit: function () {
          FS.ensureErrnoError();
          FS.nameTable = new Array(4096);
          FS.mount(MEMFS, {}, "/");
          FS.createDefaultDirectories();
          FS.createDefaultDevices();
          FS.createSpecialDirectories();
          FS.filesystems = {
            "MEMFS": MEMFS,
            "IDBFS": IDBFS,
            "NODEFS": NODEFS,
            "WORKERFS": WORKERFS
          }
        },
        init: function (input, output, error) {
          assert(!FS.init.initialized, "FS.init was previously called. If you want to initialize later with custom parameters, remove any earlier calls (note that one is automatically added to the generated code)");
          FS.init.initialized = true;
          FS.ensureErrnoError();
          Module["stdin"] = input || Module["stdin"];
          Module["stdout"] = output || Module["stdout"];
          Module["stderr"] = error || Module["stderr"];
          FS.createStandardStreams()
        },
        quit: function () {
          FS.init.initialized = false;
          var fflush = Module["_fflush"];
          if (fflush) fflush(0);
          for (var i = 0; i < FS.streams.length; i++) {
            var stream = FS.streams[i];
            if (!stream) {
              continue
            }
            FS.close(stream)
          }
        },
        getMode: function (canRead, canWrite) {
          var mode = 0;
          if (canRead) mode |= 292 | 73;
          if (canWrite) mode |= 146;
          return mode
        },
        joinPath: function (parts, forceRelative) {
          var path = PATH.join.apply(null, parts);
          if (forceRelative && path[0] == "/") path = path.substr(1);
          return path
        },
        absolutePath: function (relative, base) {
          return PATH.resolve(base, relative)
        },
        standardizePath: function (path) {
          return PATH.normalize(path)
        },
        findObject: function (path, dontResolveLastLink) {
          var ret = FS.analyzePath(path, dontResolveLastLink);
          if (ret.exists) {
            return ret.object
          } else {
            ___setErrNo(ret.error);
            return null
          }
        },
        analyzePath: function (path, dontResolveLastLink) {
          try {
            var lookup = FS.lookupPath(path, {
              follow: !dontResolveLastLink
            });
            path = lookup.path
          } catch (e) {}
          var ret = {
            isRoot: false,
            exists: false,
            error: 0,
            name: null,
            path: null,
            object: null,
            parentExists: false,
            parentPath: null,
            parentObject: null
          };
          try {
            var lookup = FS.lookupPath(path, {
              parent: true
            });
            ret.parentExists = true;
            ret.parentPath = lookup.path;
            ret.parentObject = lookup.node;
            ret.name = PATH.basename(path);
            lookup = FS.lookupPath(path, {
              follow: !dontResolveLastLink
            });
            ret.exists = true;
            ret.path = lookup.path;
            ret.object = lookup.node;
            ret.name = lookup.node.name;
            ret.isRoot = lookup.path === "/"
          } catch (e) {
            ret.error = e.errno
          }
          return ret
        },
        createFolder: function (parent, name, canRead, canWrite) {
          var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
          var mode = FS.getMode(canRead, canWrite);
          return FS.mkdir(path, mode)
        },
        createPath: function (parent, path, canRead, canWrite) {
          parent = typeof parent === "string" ? parent : FS.getPath(parent);
          var parts = path.split("/").reverse();
          while (parts.length) {
            var part = parts.pop();
            if (!part) continue;
            var current = PATH.join2(parent, part);
            try {
              FS.mkdir(current)
            } catch (e) {}
            parent = current
          }
          return current
        },
        createFile: function (parent, name, properties, canRead, canWrite) {
          var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
          var mode = FS.getMode(canRead, canWrite);
          return FS.create(path, mode)
        },
        createDataFile: function (parent, name, data, canRead, canWrite, canOwn) {
          var path = name ? PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name) : parent;
          var mode = FS.getMode(canRead, canWrite);
          var node = FS.create(path, mode);
          if (data) {
            if (typeof data === "string") {
              var arr = new Array(data.length);
              for (var i = 0, len = data.length; i < len; ++i) arr[i] = data.charCodeAt(i);
              data = arr
            }
            FS.chmod(node, mode | 146);
            var stream = FS.open(node, "w");
            FS.write(stream, data, 0, data.length, 0, canOwn);
            FS.close(stream);
            FS.chmod(node, mode)
          }
          return node
        },
        createDevice: function (parent, name, input, output) {
          var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
          var mode = FS.getMode(!!input, !!output);
          if (!FS.createDevice.major) FS.createDevice.major = 64;
          var dev = FS.makedev(FS.createDevice.major++, 0);
          FS.registerDevice(dev, {
            open: function (stream) {
              stream.seekable = false
            },
            close: function (stream) {
              if (output && output.buffer && output.buffer.length) {
                output(10)
              }
            },
            read: function (stream, buffer, offset, length, pos) {
              var bytesRead = 0;
              for (var i = 0; i < length; i++) {
                var result;
                try {
                  result = input()
                } catch (e) {
                  throw new FS.ErrnoError(5)
                }
                if (result === undefined && bytesRead === 0) {
                  throw new FS.ErrnoError(11)
                }
                if (result === null || result === undefined) break;
                bytesRead++;
                buffer[offset + i] = result
              }
              if (bytesRead) {
                stream.node.timestamp = Date.now()
              }
              return bytesRead
            },
            write: function (stream, buffer, offset, length, pos) {
              for (var i = 0; i < length; i++) {
                try {
                  output(buffer[offset + i])
                } catch (e) {
                  throw new FS.ErrnoError(5)
                }
              }
              if (length) {
                stream.node.timestamp = Date.now()
              }
              return i
            }
          });
          return FS.mkdev(path, mode, dev)
        },
        createLink: function (parent, name, target, canRead, canWrite) {
          var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
          return FS.symlink(target, path)
        },
        forceLoadFile: function (obj) {
          if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
          var success = true;
          if (typeof XMLHttpRequest !== "undefined") {
            throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.")
          } else if (Module["read"]) {
            try {
              obj.contents = intArrayFromString(Module["read"](obj.url), true);
              obj.usedBytes = obj.contents.length
            } catch (e) {
              success = false
            }
          } else {
            throw new Error("Cannot load without read() or XMLHttpRequest.")
          }
          if (!success) ___setErrNo(5);
          return success
        },
        createLazyFile: function (parent, name, url, canRead, canWrite) {
          function LazyUint8Array() {
            this.lengthKnown = false;
            this.chunks = []
          }
          LazyUint8Array.prototype.get = function LazyUint8Array_get(idx) {
            if (idx > this.length - 1 || idx < 0) {
              return undefined
            }
            var chunkOffset = idx % this.chunkSize;
            var chunkNum = idx / this.chunkSize | 0;
            return this.getter(chunkNum)[chunkOffset]
          };
          LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(getter) {
            this.getter = getter
          };
          LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength() {
            var xhr = new XMLHttpRequest;
            xhr.open("HEAD", url, false);
            xhr.send(null);
            if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
            var datalength = Number(xhr.getResponseHeader("Content-length"));
            var header;
            var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
            var usesGzip = (header = xhr.getResponseHeader("Content-Encoding")) && header === "gzip";
            var chunkSize = 1024 * 1024;
            if (!hasByteServing) chunkSize = datalength;
            var doXHR = function (from, to) {
              if (from > to) throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
              if (to > datalength - 1) throw new Error("only " + datalength + " bytes available! programmer error!");
              var xhr = new XMLHttpRequest;
              xhr.open("GET", url, false);
              if (datalength !== chunkSize) xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
              if (typeof Uint8Array != "undefined") xhr.responseType = "arraybuffer";
              if (xhr.overrideMimeType) {
                xhr.overrideMimeType("text/plain; charset=x-user-defined")
              }
              xhr.send(null);
              if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
              if (xhr.response !== undefined) {
                return new Uint8Array(xhr.response || [])
              } else {
                return intArrayFromString(xhr.responseText || "", true)
              }
            };
            var lazyArray = this;
            lazyArray.setDataGetter(function (chunkNum) {
              var start = chunkNum * chunkSize;
              var end = (chunkNum + 1) * chunkSize - 1;
              end = Math.min(end, datalength - 1);
              if (typeof lazyArray.chunks[chunkNum] === "undefined") {
                lazyArray.chunks[chunkNum] = doXHR(start, end)
              }
              if (typeof lazyArray.chunks[chunkNum] === "undefined") throw new Error("doXHR failed!");
              return lazyArray.chunks[chunkNum]
            });
            if (usesGzip || !datalength) {
              chunkSize = datalength = 1;
              datalength = this.getter(0).length;
              chunkSize = datalength;
              console.log("LazyFiles on gzip forces download of the whole file when length is accessed")
            }
            this._length = datalength;
            this._chunkSize = chunkSize;
            this.lengthKnown = true
          };
          if (typeof XMLHttpRequest !== "undefined") {
            if (!ENVIRONMENT_IS_WORKER) throw "Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";
            var lazyArray = new LazyUint8Array;
            Object.defineProperties(lazyArray, {
              length: {
                get: function () {
                  if (!this.lengthKnown) {
                    this.cacheLength()
                  }
                  return this._length
                }
              },
              chunkSize: {
                get: function () {
                  if (!this.lengthKnown) {
                    this.cacheLength()
                  }
                  return this._chunkSize
                }
              }
            });
            var properties = {
              isDevice: false,
              contents: lazyArray
            }
          } else {
            var properties = {
              isDevice: false,
              url: url
            }
          }
          var node = FS.createFile(parent, name, properties, canRead, canWrite);
          if (properties.contents) {
            node.contents = properties.contents
          } else if (properties.url) {
            node.contents = null;
            node.url = properties.url
          }
          Object.defineProperties(node, {
            usedBytes: {
              get: function () {
                return this.contents.length
              }
            }
          });
          var stream_ops = {};
          var keys = Object.keys(node.stream_ops);
          keys.forEach(function (key) {
            var fn = node.stream_ops[key];
            stream_ops[key] = function forceLoadLazyFile() {
              if (!FS.forceLoadFile(node)) {
                throw new FS.ErrnoError(5)
              }
              return fn.apply(null, arguments)
            }
          });
          stream_ops.read = function stream_ops_read(stream, buffer, offset, length, position) {
            if (!FS.forceLoadFile(node)) {
              throw new FS.ErrnoError(5)
            }
            var contents = stream.node.contents;
            if (position >= contents.length) return 0;
            var size = Math.min(contents.length - position, length);
            assert(size >= 0);
            if (contents.slice) {
              for (var i = 0; i < size; i++) {
                buffer[offset + i] = contents[position + i]
              }
            } else {
              for (var i = 0; i < size; i++) {
                buffer[offset + i] = contents.get(position + i)
              }
            }
            return size
          };
          node.stream_ops = stream_ops;
          return node
        },
        createPreloadedFile: function (parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) {
          Browser.init();
          var fullname = name ? PATH.resolve(PATH.join2(parent, name)) : parent;
          var dep = getUniqueRunDependency("cp " + fullname);

          function processData(byteArray) {
            function finish(byteArray) {
              if (preFinish) preFinish();
              if (!dontCreateFile) {
                FS.createDataFile(parent, name, byteArray, canRead, canWrite, canOwn)
              }
              if (onload) onload();
              removeRunDependency(dep)
            }
            var handled = false;
            Module["preloadPlugins"].forEach(function (plugin) {
              if (handled) return;
              if (plugin["canHandle"](fullname)) {
                plugin["handle"](byteArray, fullname, finish, function () {
                  if (onerror) onerror();
                  removeRunDependency(dep)
                });
                handled = true
              }
            });
            if (!handled) finish(byteArray)
          }
          addRunDependency(dep);
          if (typeof url == "string") {
            Browser.asyncLoad(url, function (byteArray) {
              processData(byteArray)
            }, onerror)
          } else {
            processData(url)
          }
        },
        indexedDB: function () {
          return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB
        },
        DB_NAME: function () {
          return "EM_FS_" + window.location.pathname
        },
        DB_VERSION: 20,
        DB_STORE_NAME: "FILE_DATA",
        saveFilesToDB: function (paths, onload, onerror) {
          onload = onload || function () {};
          onerror = onerror || function () {};
          var indexedDB = FS.indexedDB();
          try {
            var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION)
          } catch (e) {
            return onerror(e)
          }
          openRequest.onupgradeneeded = function openRequest_onupgradeneeded() {
            console.log("creating db");
            var db = openRequest.result;
            db.createObjectStore(FS.DB_STORE_NAME)
          };
          openRequest.onsuccess = function openRequest_onsuccess() {
            var db = openRequest.result;
            var transaction = db.transaction([FS.DB_STORE_NAME], "readwrite");
            var files = transaction.objectStore(FS.DB_STORE_NAME);
            var ok = 0,
              fail = 0,
              total = paths.length;

            function finish() {
              if (fail == 0) onload();
              else onerror()
            }
            paths.forEach(function (path) {
              var putRequest = files.put(FS.analyzePath(path).object.contents, path);
              putRequest.onsuccess = function putRequest_onsuccess() {
                ok++;
                if (ok + fail == total) finish()
              };
              putRequest.onerror = function putRequest_onerror() {
                fail++;
                if (ok + fail == total) finish()
              }
            });
            transaction.onerror = onerror
          };
          openRequest.onerror = onerror
        },
        loadFilesFromDB: function (paths, onload, onerror) {
          onload = onload || function () {};
          onerror = onerror || function () {};
          var indexedDB = FS.indexedDB();
          try {
            var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION)
          } catch (e) {
            return onerror(e)
          }
          openRequest.onupgradeneeded = onerror;
          openRequest.onsuccess = function openRequest_onsuccess() {
            var db = openRequest.result;
            try {
              var transaction = db.transaction([FS.DB_STORE_NAME], "readonly")
            } catch (e) {
              onerror(e);
              return
            }
            var files = transaction.objectStore(FS.DB_STORE_NAME);
            var ok = 0,
              fail = 0,
              total = paths.length;

            function finish() {
              if (fail == 0) onload();
              else onerror()
            }
            paths.forEach(function (path) {
              var getRequest = files.get(path);
              getRequest.onsuccess = function getRequest_onsuccess() {
                if (FS.analyzePath(path).exists) {
                  FS.unlink(path)
                }
                FS.createDataFile(PATH.dirname(path), PATH.basename(path), getRequest.result, true, true, true);
                ok++;
                if (ok + fail == total) finish()
              };
              getRequest.onerror = function getRequest_onerror() {
                fail++;
                if (ok + fail == total) finish()
              }
            });
            transaction.onerror = onerror
          };
          openRequest.onerror = onerror
        }
      };
      var SOCKFS = {
        mount: function (mount) {
          Module["websocket"] = Module["websocket"] && "object" === typeof Module["websocket"] ? Module["websocket"] : {};
          Module["websocket"]._callbacks = {};
          Module["websocket"]["on"] = function (event, callback) {
            if ("function" === typeof callback) {
              this._callbacks[event] = callback
            }
            return this
          };
          Module["websocket"].emit = function (event, param) {
            if ("function" === typeof this._callbacks[event]) {
              this._callbacks[event].call(this, param)
            }
          };
          return FS.createNode(null, "/", 16384 | 511, 0)
        },
        createSocket: function (family, type, protocol) {
          var streaming = type == 1;
          if (protocol) {
            assert(streaming == (protocol == 6))
          }
          var sock = {
            family: family,
            type: type,
            protocol: protocol,
            server: null,
            error: null,
            peers: {},
            pending: [],
            recv_queue: [],
            sock_ops: SOCKFS.websocket_sock_ops
          };
          var name = SOCKFS.nextname();
          var node = FS.createNode(SOCKFS.root, name, 49152, 0);
          node.sock = sock;
          var stream = FS.createStream({
            path: name,
            node: node,
            flags: FS.modeStringToFlags("r+"),
            seekable: false,
            stream_ops: SOCKFS.stream_ops
          });
          sock.stream = stream;
          return sock
        },
        getSocket: function (fd) {
          var stream = FS.getStream(fd);
          if (!stream || !FS.isSocket(stream.node.mode)) {
            return null
          }
          return stream.node.sock
        },
        stream_ops: {
          poll: function (stream) {
            var sock = stream.node.sock;
            return sock.sock_ops.poll(sock)
          },
          ioctl: function (stream, request, varargs) {
            var sock = stream.node.sock;
            return sock.sock_ops.ioctl(sock, request, varargs)
          },
          read: function (stream, buffer, offset, length, position) {
            var sock = stream.node.sock;
            var msg = sock.sock_ops.recvmsg(sock, length);
            if (!msg) {
              return 0
            }
            buffer.set(msg.buffer, offset);
            return msg.buffer.length
          },
          write: function (stream, buffer, offset, length, position) {
            var sock = stream.node.sock;
            return sock.sock_ops.sendmsg(sock, buffer, offset, length)
          },
          close: function (stream) {
            var sock = stream.node.sock;
            sock.sock_ops.close(sock)
          }
        },
        nextname: function () {
          if (!SOCKFS.nextname.current) {
            SOCKFS.nextname.current = 0
          }
          return "socket[" + SOCKFS.nextname.current++ + "]"
        },
        websocket_sock_ops: {
          createPeer: function (sock, addr, port) {
            var ws;
            if (typeof addr === "object") {
              ws = addr;
              addr = null;
              port = null
            }
            if (ws) {
              if (ws._socket) {
                addr = ws._socket.remoteAddress;
                port = ws._socket.remotePort
              } else {
                var result = /ws[s]?:\/\/([^:]+):(\d+)/.exec(ws.url);
                if (!result) {
                  throw new Error("WebSocket URL must be in the format ws(s)://address:port")
                }
                addr = result[1];
                port = parseInt(result[2], 10)
              }
            } else {
              try {
                var runtimeConfig = Module["websocket"] && "object" === typeof Module["websocket"];
                var url = "ws:#".replace("#", "//");
                if (runtimeConfig) {
                  if ("string" === typeof Module["websocket"]["url"]) {
                    url = Module["websocket"]["url"]
                  }
                }
                if (url === "ws://" || url === "wss://") {
                  var parts = addr.split("/");
                  url = url + parts[0] + ":" + port + "/" + parts.slice(1).join("/")
                }
                var subProtocols = "binary";
                if (runtimeConfig) {
                  if ("string" === typeof Module["websocket"]["subprotocol"]) {
                    subProtocols = Module["websocket"]["subprotocol"]
                  }
                }
                subProtocols = subProtocols.replace(/^ +| +$/g, "").split(/ *, */);
                var opts = ENVIRONMENT_IS_NODE ? {
                  "protocol": subProtocols.toString()
                } : subProtocols;
                if (runtimeConfig && null === Module["websocket"]["subprotocol"]) {
                  subProtocols = "null";
                  opts = undefined
                }
                var WebSocketConstructor;
                if (ENVIRONMENT_IS_NODE) {
                  WebSocketConstructor = require("ws")
                } else if (ENVIRONMENT_IS_WEB) {
                  WebSocketConstructor = window["WebSocket"]
                } else {
                  WebSocketConstructor = WebSocket
                }
                ws = new WebSocketConstructor(url, opts);
                ws.binaryType = "arraybuffer"
              } catch (e) {
                throw new FS.ErrnoError(ERRNO_CODES.EHOSTUNREACH)
              }
            }
            var peer = {
              addr: addr,
              port: port,
              socket: ws,
              dgram_send_queue: []
            };
            SOCKFS.websocket_sock_ops.addPeer(sock, peer);
            SOCKFS.websocket_sock_ops.handlePeerEvents(sock, peer);
            if (sock.type === 2 && typeof sock.sport !== "undefined") {
              peer.dgram_send_queue.push(new Uint8Array([255, 255, 255, 255, "p".charCodeAt(0), "o".charCodeAt(0), "r".charCodeAt(0), "t".charCodeAt(0), (sock.sport & 65280) >> 8, sock.sport & 255]))
            }
            return peer
          },
          getPeer: function (sock, addr, port) {
            return sock.peers[addr + ":" + port]
          },
          addPeer: function (sock, peer) {
            sock.peers[peer.addr + ":" + peer.port] = peer
          },
          removePeer: function (sock, peer) {
            delete sock.peers[peer.addr + ":" + peer.port]
          },
          handlePeerEvents: function (sock, peer) {
            var first = true;
            var handleOpen = function () {
              Module["websocket"].emit("open", sock.stream.fd);
              try {
                var queued = peer.dgram_send_queue.shift();
                while (queued) {
                  peer.socket.send(queued);
                  queued = peer.dgram_send_queue.shift()
                }
              } catch (e) {
                peer.socket.close()
              }
            };

            function handleMessage(data) {
              assert(typeof data !== "string" && data.byteLength !== undefined);
              if (data.byteLength == 0) {
                return
              }
              data = new Uint8Array(data);
              var wasfirst = first;
              first = false;
              if (wasfirst && data.length === 10 && data[0] === 255 && data[1] === 255 && data[2] === 255 && data[3] === 255 && data[4] === "p".charCodeAt(0) && data[5] === "o".charCodeAt(0) && data[6] === "r".charCodeAt(0) && data[7] === "t".charCodeAt(0)) {
                var newport = data[8] << 8 | data[9];
                SOCKFS.websocket_sock_ops.removePeer(sock, peer);
                peer.port = newport;
                SOCKFS.websocket_sock_ops.addPeer(sock, peer);
                return
              }
              sock.recv_queue.push({
                addr: peer.addr,
                port: peer.port,
                data: data
              });
              Module["websocket"].emit("message", sock.stream.fd)
            }
            if (ENVIRONMENT_IS_NODE) {
              peer.socket.on("open", handleOpen);
              peer.socket.on("message", function (data, flags) {
                if (!flags.binary) {
                  return
                }
                handleMessage(new Uint8Array(data).buffer)
              });
              peer.socket.on("close", function () {
                Module["websocket"].emit("close", sock.stream.fd)
              });
              peer.socket.on("error", function (error) {
                sock.error = ERRNO_CODES.ECONNREFUSED;
                Module["websocket"].emit("error", [sock.stream.fd, sock.error, "ECONNREFUSED: Connection refused"])
              })
            } else {
              peer.socket.onopen = handleOpen;
              peer.socket.onclose = function () {
                Module["websocket"].emit("close", sock.stream.fd)
              };
              peer.socket.onmessage = function peer_socket_onmessage(event) {
                handleMessage(event.data)
              };
              peer.socket.onerror = function (error) {
                sock.error = ERRNO_CODES.ECONNREFUSED;
                Module["websocket"].emit("error", [sock.stream.fd, sock.error, "ECONNREFUSED: Connection refused"])
              }
            }
          },
          poll: function (sock) {
            if (sock.type === 1 && sock.server) {
              return sock.pending.length ? 64 | 1 : 0
            }
            var mask = 0;
            var dest = sock.type === 1 ? SOCKFS.websocket_sock_ops.getPeer(sock, sock.daddr, sock.dport) : null;
            if (sock.recv_queue.length || !dest || dest && dest.socket.readyState === dest.socket.CLOSING || dest && dest.socket.readyState === dest.socket.CLOSED) {
              mask |= 64 | 1
            }
            if (!dest || dest && dest.socket.readyState === dest.socket.OPEN) {
              mask |= 4
            }
            if (dest && dest.socket.readyState === dest.socket.CLOSING || dest && dest.socket.readyState === dest.socket.CLOSED) {
              mask |= 16
            }
            return mask
          },
          ioctl: function (sock, request, arg) {
            switch (request) {
              case 21531:
                var bytes = 0;
                if (sock.recv_queue.length) {
                  bytes = sock.recv_queue[0].data.length
                }
                HEAP32[arg >> 2] = bytes;
                return 0;
              default:
                return ERRNO_CODES.EINVAL
            }
          },
          close: function (sock) {
            if (sock.server) {
              try {
                sock.server.close()
              } catch (e) {}
              sock.server = null
            }
            var peers = Object.keys(sock.peers);
            for (var i = 0; i < peers.length; i++) {
              var peer = sock.peers[peers[i]];
              try {
                peer.socket.close()
              } catch (e) {}
              SOCKFS.websocket_sock_ops.removePeer(sock, peer)
            }
            return 0
          },
          bind: function (sock, addr, port) {
            if (typeof sock.saddr !== "undefined" || typeof sock.sport !== "undefined") {
              throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
            }
            sock.saddr = addr;
            sock.sport = port;
            if (sock.type === 2) {
              if (sock.server) {
                sock.server.close();
                sock.server = null
              }
              try {
                sock.sock_ops.listen(sock, 0)
              } catch (e) {
                if (!(e instanceof FS.ErrnoError)) throw e;
                if (e.errno !== ERRNO_CODES.EOPNOTSUPP) throw e
              }
            }
          },
          connect: function (sock, addr, port) {
            if (sock.server) {
              throw new FS.ErrnoError(ERRNO_CODES.EOPNOTSUPP)
            }
            if (typeof sock.daddr !== "undefined" && typeof sock.dport !== "undefined") {
              var dest = SOCKFS.websocket_sock_ops.getPeer(sock, sock.daddr, sock.dport);
              if (dest) {
                if (dest.socket.readyState === dest.socket.CONNECTING) {
                  throw new FS.ErrnoError(ERRNO_CODES.EALREADY)
                } else {
                  throw new FS.ErrnoError(ERRNO_CODES.EISCONN)
                }
              }
            }
            var peer = SOCKFS.websocket_sock_ops.createPeer(sock, addr, port);
            sock.daddr = peer.addr;
            sock.dport = peer.port;
            throw new FS.ErrnoError(ERRNO_CODES.EINPROGRESS)
          },
          listen: function (sock, backlog) {
            if (!ENVIRONMENT_IS_NODE) {
              throw new FS.ErrnoError(ERRNO_CODES.EOPNOTSUPP)
            }
            if (sock.server) {
              throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
            }
            var WebSocketServer = require("ws").Server;
            var host = sock.saddr;
            sock.server = new WebSocketServer({
              host: host,
              port: sock.sport
            });
            Module["websocket"].emit("listen", sock.stream.fd);
            sock.server.on("connection", function (ws) {
              if (sock.type === 1) {
                var newsock = SOCKFS.createSocket(sock.family, sock.type, sock.protocol);
                var peer = SOCKFS.websocket_sock_ops.createPeer(newsock, ws);
                newsock.daddr = peer.addr;
                newsock.dport = peer.port;
                sock.pending.push(newsock);
                Module["websocket"].emit("connection", newsock.stream.fd)
              } else {
                SOCKFS.websocket_sock_ops.createPeer(sock, ws);
                Module["websocket"].emit("connection", sock.stream.fd)
              }
            });
            sock.server.on("closed", function () {
              Module["websocket"].emit("close", sock.stream.fd);
              sock.server = null
            });
            sock.server.on("error", function (error) {
              sock.error = ERRNO_CODES.EHOSTUNREACH;
              Module["websocket"].emit("error", [sock.stream.fd, sock.error, "EHOSTUNREACH: Host is unreachable"])
            })
          },
          accept: function (listensock) {
            if (!listensock.server) {
              throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
            }
            var newsock = listensock.pending.shift();
            newsock.stream.flags = listensock.stream.flags;
            return newsock
          },
          getname: function (sock, peer) {
            var addr, port;
            if (peer) {
              if (sock.daddr === undefined || sock.dport === undefined) {
                throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN)
              }
              addr = sock.daddr;
              port = sock.dport
            } else {
              addr = sock.saddr || 0;
              port = sock.sport || 0
            }
            return {
              addr: addr,
              port: port
            }
          },
          sendmsg: function (sock, buffer, offset, length, addr, port) {
            if (sock.type === 2) {
              if (addr === undefined || port === undefined) {
                addr = sock.daddr;
                port = sock.dport
              }
              if (addr === undefined || port === undefined) {
                throw new FS.ErrnoError(ERRNO_CODES.EDESTADDRREQ)
              }
            } else {
              addr = sock.daddr;
              port = sock.dport
            }
            var dest = SOCKFS.websocket_sock_ops.getPeer(sock, addr, port);
            if (sock.type === 1) {
              if (!dest || dest.socket.readyState === dest.socket.CLOSING || dest.socket.readyState === dest.socket.CLOSED) {
                throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN)
              } else if (dest.socket.readyState === dest.socket.CONNECTING) {
                throw new FS.ErrnoError(ERRNO_CODES.EAGAIN)
              }
            }
            if (ArrayBuffer.isView(buffer)) {
              offset += buffer.byteOffset;
              buffer = buffer.buffer
            }
            var data;
            data = buffer.slice(offset, offset + length);
            if (sock.type === 2) {
              if (!dest || dest.socket.readyState !== dest.socket.OPEN) {
                if (!dest || dest.socket.readyState === dest.socket.CLOSING || dest.socket.readyState === dest.socket.CLOSED) {
                  dest = SOCKFS.websocket_sock_ops.createPeer(sock, addr, port)
                }
                dest.dgram_send_queue.push(data);
                return length
              }
            }
            try {
              dest.socket.send(data);
              return length
            } catch (e) {
              throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
            }
          },
          recvmsg: function (sock, length) {
            if (sock.type === 1 && sock.server) {
              throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN)
            }
            var queued = sock.recv_queue.shift();
            if (!queued) {
              if (sock.type === 1) {
                var dest = SOCKFS.websocket_sock_ops.getPeer(sock, sock.daddr, sock.dport);
                if (!dest) {
                  throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN)
                } else if (dest.socket.readyState === dest.socket.CLOSING || dest.socket.readyState === dest.socket.CLOSED) {
                  return null
                } else {
                  throw new FS.ErrnoError(ERRNO_CODES.EAGAIN)
                }
              } else {
                throw new FS.ErrnoError(ERRNO_CODES.EAGAIN)
              }
            }
            var queuedLength = queued.data.byteLength || queued.data.length;
            var queuedOffset = queued.data.byteOffset || 0;
            var queuedBuffer = queued.data.buffer || queued.data;
            var bytesRead = Math.min(length, queuedLength);
            var res = {
              buffer: new Uint8Array(queuedBuffer, queuedOffset, bytesRead),
              addr: queued.addr,
              port: queued.port
            };
            if (sock.type === 1 && bytesRead < queuedLength) {
              var bytesRemaining = queuedLength - bytesRead;
              queued.data = new Uint8Array(queuedBuffer, queuedOffset + bytesRead, bytesRemaining);
              sock.recv_queue.unshift(queued)
            }
            return res
          }
        }
      };

      function __inet_pton4_raw(str) {
        var b = str.split(".");
        for (var i = 0; i < 4; i++) {
          var tmp = Number(b[i]);
          if (isNaN(tmp)) return null;
          b[i] = tmp
        }
        return (b[0] | b[1] << 8 | b[2] << 16 | b[3] << 24) >>> 0
      }

      function __inet_pton6_raw(str) {
        var words;
        var w, offset, z;
        var valid6regx = /^((?=.*::)(?!.*::.+::)(::)?([\dA-F]{1,4}:(:|\b)|){5}|([\dA-F]{1,4}:){6})((([\dA-F]{1,4}((?!\3)::|:\b|$))|(?!\2\3)){2}|(((2[0-4]|1\d|[1-9])?\d|25[0-5])\.?\b){4})$/i;
        var parts = [];
        if (!valid6regx.test(str)) {
          return null
        }
        if (str === "::") {
          return [0, 0, 0, 0, 0, 0, 0, 0]
        }
        if (str.indexOf("::") === 0) {
          str = str.replace("::", "Z:")
        } else {
          str = str.replace("::", ":Z:")
        }
        if (str.indexOf(".") > 0) {
          str = str.replace(new RegExp("[.]", "g"), ":");
          words = str.split(":");
          words[words.length - 4] = parseInt(words[words.length - 4]) + parseInt(words[words.length - 3]) * 256;
          words[words.length - 3] = parseInt(words[words.length - 2]) + parseInt(words[words.length - 1]) * 256;
          words = words.slice(0, words.length - 2)
        } else {
          words = str.split(":")
        }
        offset = 0;
        z = 0;
        for (w = 0; w < words.length; w++) {
          if (typeof words[w] === "string") {
            if (words[w] === "Z") {
              for (z = 0; z < 8 - words.length + 1; z++) {
                parts[w + z] = 0
              }
              offset = z - 1
            } else {
              parts[w + offset] = _htons(parseInt(words[w], 16))
            }
          } else {
            parts[w + offset] = words[w]
          }
        }
        return [parts[1] << 16 | parts[0], parts[3] << 16 | parts[2], parts[5] << 16 | parts[4], parts[7] << 16 | parts[6]]
      }
      var DNS = {
        address_map: {
          id: 1,
          addrs: {},
          names: {}
        },
        lookup_name: function (name) {
          var res = __inet_pton4_raw(name);
          if (res !== null) {
            return name
          }
          res = __inet_pton6_raw(name);
          if (res !== null) {
            return name
          }
          var addr;
          if (DNS.address_map.addrs[name]) {
            addr = DNS.address_map.addrs[name]
          } else {
            var id = DNS.address_map.id++;
            assert(id < 65535, "exceeded max address mappings of 65535");
            addr = "172.29." + (id & 255) + "." + (id & 65280);
            DNS.address_map.names[addr] = name;
            DNS.address_map.addrs[name] = addr
          }
          return addr
        },
        lookup_addr: function (addr) {
          if (DNS.address_map.names[addr]) {
            return DNS.address_map.names[addr]
          }
          return null
        }
      };

      function __inet_ntop4_raw(addr) {
        return (addr & 255) + "." + (addr >> 8 & 255) + "." + (addr >> 16 & 255) + "." + (addr >> 24 & 255)
      }

      function __inet_ntop6_raw(ints) {
        var str = "";
        var word = 0;
        var longest = 0;
        var lastzero = 0;
        var zstart = 0;
        var len = 0;
        var i = 0;
        var parts = [ints[0] & 65535, ints[0] >> 16, ints[1] & 65535, ints[1] >> 16, ints[2] & 65535, ints[2] >> 16, ints[3] & 65535, ints[3] >> 16];
        var hasipv4 = true;
        var v4part = "";
        for (i = 0; i < 5; i++) {
          if (parts[i] !== 0) {
            hasipv4 = false;
            break
          }
        }
        if (hasipv4) {
          v4part = __inet_ntop4_raw(parts[6] | parts[7] << 16);
          if (parts[5] === -1) {
            str = "::ffff:";
            str += v4part;
            return str
          }
          if (parts[5] === 0) {
            str = "::";
            if (v4part === "0.0.0.0") v4part = "";
            if (v4part === "0.0.0.1") v4part = "1";
            str += v4part;
            return str
          }
        }
        for (word = 0; word < 8; word++) {
          if (parts[word] === 0) {
            if (word - lastzero > 1) {
              len = 0
            }
            lastzero = word;
            len++
          }
          if (len > longest) {
            longest = len;
            zstart = word - longest + 1
          }
        }
        for (word = 0; word < 8; word++) {
          if (longest > 1) {
            if (parts[word] === 0 && word >= zstart && word < zstart + longest) {
              if (word === zstart) {
                str += ":";
                if (zstart === 0) str += ":"
              }
              continue
            }
          }
          str += Number(_ntohs(parts[word] & 65535)).toString(16);
          str += word < 7 ? ":" : ""
        }
        return str
      }

      function __read_sockaddr(sa, salen) {
        var family = HEAP16[sa >> 1];
        var port = _ntohs(HEAP16[sa + 2 >> 1]);
        var addr;
        switch (family) {
          case 2:
            if (salen !== 16) {
              return {
                errno: 22
              }
            }
            addr = HEAP32[sa + 4 >> 2];
            addr = __inet_ntop4_raw(addr);
            break;
          case 10:
            if (salen !== 28) {
              return {
                errno: 22
              }
            }
            addr = [HEAP32[sa + 8 >> 2], HEAP32[sa + 12 >> 2], HEAP32[sa + 16 >> 2], HEAP32[sa + 20 >> 2]];
            addr = __inet_ntop6_raw(addr);
            break;
          default:
            return {
              errno: 97
            }
        }
        return {
          family: family,
          addr: addr,
          port: port
        }
      }

      function __write_sockaddr(sa, family, addr, port) {
        switch (family) {
          case 2:
            addr = __inet_pton4_raw(addr);
            HEAP16[sa >> 1] = family;
            HEAP32[sa + 4 >> 2] = addr;
            HEAP16[sa + 2 >> 1] = _htons(port);
            break;
          case 10:
            addr = __inet_pton6_raw(addr);
            HEAP32[sa >> 2] = family;
            HEAP32[sa + 8 >> 2] = addr[0];
            HEAP32[sa + 12 >> 2] = addr[1];
            HEAP32[sa + 16 >> 2] = addr[2];
            HEAP32[sa + 20 >> 2] = addr[3];
            HEAP16[sa + 2 >> 1] = _htons(port);
            HEAP32[sa + 4 >> 2] = 0;
            HEAP32[sa + 24 >> 2] = 0;
            break;
          default:
            return {
              errno: 97
            }
        }
        return {}
      }
      var SYSCALLS = {
        DEFAULT_POLLMASK: 5,
        mappings: {},
        umask: 511,
        calculateAt: function (dirfd, path) {
          if (path[0] !== "/") {
            var dir;
            if (dirfd === -100) {
              dir = FS.cwd()
            } else {
              var dirstream = FS.getStream(dirfd);
              if (!dirstream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
              dir = dirstream.path
            }
            path = PATH.join2(dir, path)
          }
          return path
        },
        doStat: function (func, path, buf) {
          try {
            var stat = func(path)
          } catch (e) {
            if (e && e.node && PATH.normalize(path) !== PATH.normalize(FS.getPath(e.node))) {
              return -ERRNO_CODES.ENOTDIR
            }
            throw e
          }
          HEAP32[buf >> 2] = stat.dev;
          HEAP32[buf + 4 >> 2] = 0;
          HEAP32[buf + 8 >> 2] = stat.ino;
          HEAP32[buf + 12 >> 2] = stat.mode;
          HEAP32[buf + 16 >> 2] = stat.nlink;
          HEAP32[buf + 20 >> 2] = stat.uid;
          HEAP32[buf + 24 >> 2] = stat.gid;
          HEAP32[buf + 28 >> 2] = stat.rdev;
          HEAP32[buf + 32 >> 2] = 0;
          HEAP32[buf + 36 >> 2] = stat.size;
          HEAP32[buf + 40 >> 2] = 4096;
          HEAP32[buf + 44 >> 2] = stat.blocks;
          HEAP32[buf + 48 >> 2] = stat.atime.getTime() / 1e3 | 0;
          HEAP32[buf + 52 >> 2] = 0;
          HEAP32[buf + 56 >> 2] = stat.mtime.getTime() / 1e3 | 0;
          HEAP32[buf + 60 >> 2] = 0;
          HEAP32[buf + 64 >> 2] = stat.ctime.getTime() / 1e3 | 0;
          HEAP32[buf + 68 >> 2] = 0;
          HEAP32[buf + 72 >> 2] = stat.ino;
          return 0
        },
        doMsync: function (addr, stream, len, flags) {
          var buffer = new Uint8Array(HEAPU8.subarray(addr, addr + len));
          FS.msync(stream, buffer, 0, len, flags)
        },
        doMkdir: function (path, mode) {
          path = PATH.normalize(path);
          if (path[path.length - 1] === "/") path = path.substr(0, path.length - 1);
          FS.mkdir(path, mode, 0);
          return 0
        },
        doMknod: function (path, mode, dev) {
          switch (mode & 61440) {
            case 32768:
            case 8192:
            case 24576:
            case 4096:
            case 49152:
              break;
            default:
              return -ERRNO_CODES.EINVAL
          }
          FS.mknod(path, mode, dev);
          return 0
        },
        doReadlink: function (path, buf, bufsize) {
          if (bufsize <= 0) return -ERRNO_CODES.EINVAL;
          var ret = FS.readlink(path);
          var len = Math.min(bufsize, lengthBytesUTF8(ret));
          var endChar = HEAP8[buf + len];
          stringToUTF8(ret, buf, bufsize + 1);
          HEAP8[buf + len] = endChar;
          return len
        },
        doAccess: function (path, amode) {
          if (amode & ~7) {
            return -ERRNO_CODES.EINVAL
          }
          var node;
          var lookup = FS.lookupPath(path, {
            follow: true
          });
          node = lookup.node;
          var perms = "";
          if (amode & 4) perms += "r";
          if (amode & 2) perms += "w";
          if (amode & 1) perms += "x";
          if (perms && FS.nodePermissions(node, perms)) {
            return -ERRNO_CODES.EACCES
          }
          return 0
        },
        doDup: function (path, flags, suggestFD) {
          var suggest = FS.getStream(suggestFD);
          if (suggest) FS.close(suggest);
          return FS.open(path, flags, 0, suggestFD, suggestFD).fd
        },
        doReadv: function (stream, iov, iovcnt, offset) {
          var ret = 0;
          for (var i = 0; i < iovcnt; i++) {
            var ptr = HEAP32[iov + i * 8 >> 2];
            var len = HEAP32[iov + (i * 8 + 4) >> 2];
            var curr = FS.read(stream, HEAP8, ptr, len, offset);
            if (curr < 0) return -1;
            ret += curr;
            if (curr < len) break
          }
          return ret
        },
        doWritev: function (stream, iov, iovcnt, offset) {
          var ret = 0;
          for (var i = 0; i < iovcnt; i++) {
            var ptr = HEAP32[iov + i * 8 >> 2];
            var len = HEAP32[iov + (i * 8 + 4) >> 2];
            var curr = FS.write(stream, HEAP8, ptr, len, offset);
            if (curr < 0) return -1;
            ret += curr
          }
          return ret
        },
        varargs: 0,
        get: function (varargs) {
          SYSCALLS.varargs += 4;
          var ret = HEAP32[SYSCALLS.varargs - 4 >> 2];
          return ret
        },
        getStr: function () {
          var ret = UTF8ToString(SYSCALLS.get());
          return ret
        },
        getStreamFromFD: function () {
          var stream = FS.getStream(SYSCALLS.get());
          if (!stream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
          return stream
        },
        getSocketFromFD: function () {
          var socket = SOCKFS.getSocket(SYSCALLS.get());
          if (!socket) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
          return socket
        },
        getSocketAddress: function (allowNull) {
          var addrp = SYSCALLS.get(),
            addrlen = SYSCALLS.get();
          if (allowNull && addrp === 0) return null;
          var info = __read_sockaddr(addrp, addrlen);
          if (info.errno) throw new FS.ErrnoError(info.errno);
          info.addr = DNS.lookup_addr(info.addr) || info.addr;
          return info
        },
        get64: function () {
          var low = SYSCALLS.get(),
            high = SYSCALLS.get();
          if (low >= 0) assert(high === 0);
          else assert(high === -1);
          return low
        },
        getZero: function () {
          assert(SYSCALLS.get() === 0)
        }
      };

      function ___syscall102(which, varargs) {
        SYSCALLS.varargs = varargs;
        try {
          var call = SYSCALLS.get(),
            socketvararg = SYSCALLS.get();
          SYSCALLS.varargs = socketvararg;
          switch (call) {
            case 1:
              {
                var domain = SYSCALLS.get(),
                  type = SYSCALLS.get(),
                  protocol = SYSCALLS.get();
                var sock = SOCKFS.createSocket(domain, type, protocol);assert(sock.stream.fd < 64);
                return sock.stream.fd
              }
            case 2:
              {
                var sock = SYSCALLS.getSocketFromFD(),
                  info = SYSCALLS.getSocketAddress();sock.sock_ops.bind(sock, info.addr, info.port);
                return 0
              }
            case 3:
              {
                var sock = SYSCALLS.getSocketFromFD(),
                  info = SYSCALLS.getSocketAddress();sock.sock_ops.connect(sock, info.addr, info.port);
                return 0
              }
            case 4:
              {
                var sock = SYSCALLS.getSocketFromFD(),
                  backlog = SYSCALLS.get();sock.sock_ops.listen(sock, backlog);
                return 0
              }
            case 5:
              {
                var sock = SYSCALLS.getSocketFromFD(),
                  addr = SYSCALLS.get(),
                  addrlen = SYSCALLS.get();
                var newsock = sock.sock_ops.accept(sock);
                if (addr) {
                  var res = __write_sockaddr(addr, newsock.family, DNS.lookup_name(newsock.daddr), newsock.dport);
                  assert(!res.errno)
                }
                return newsock.stream.fd
              }
            case 6:
              {
                var sock = SYSCALLS.getSocketFromFD(),
                  addr = SYSCALLS.get(),
                  addrlen = SYSCALLS.get();
                var res = __write_sockaddr(addr, sock.family, DNS.lookup_name(sock.saddr || "0.0.0.0"), sock.sport);assert(!res.errno);
                return 0
              }
            case 7:
              {
                var sock = SYSCALLS.getSocketFromFD(),
                  addr = SYSCALLS.get(),
                  addrlen = SYSCALLS.get();
                if (!sock.daddr) {
                  return -ERRNO_CODES.ENOTCONN
                }
                var res = __write_sockaddr(addr, sock.family, DNS.lookup_name(sock.daddr), sock.dport);assert(!res.errno);
                return 0
              }
            case 11:
              {
                var sock = SYSCALLS.getSocketFromFD(),
                  message = SYSCALLS.get(),
                  length = SYSCALLS.get(),
                  flags = SYSCALLS.get(),
                  dest = SYSCALLS.getSocketAddress(true);
                if (!dest) {
                  return FS.write(sock.stream, HEAP8, message, length)
                } else {
                  return sock.sock_ops.sendmsg(sock, HEAP8, message, length, dest.addr, dest.port)
                }
              }
            case 12:
              {
                var sock = SYSCALLS.getSocketFromFD(),
                  buf = SYSCALLS.get(),
                  len = SYSCALLS.get(),
                  flags = SYSCALLS.get(),
                  addr = SYSCALLS.get(),
                  addrlen = SYSCALLS.get();
                var msg = sock.sock_ops.recvmsg(sock, len);
                if (!msg) return 0;
                if (addr) {
                  var res = __write_sockaddr(addr, sock.family, DNS.lookup_name(msg.addr), msg.port);
                  assert(!res.errno)
                }
                HEAPU8.set(msg.buffer, buf);
                return msg.buffer.byteLength
              }
            case 14:
              {
                return -ERRNO_CODES.ENOPROTOOPT
              }
            case 15:
              {
                var sock = SYSCALLS.getSocketFromFD(),
                  level = SYSCALLS.get(),
                  optname = SYSCALLS.get(),
                  optval = SYSCALLS.get(),
                  optlen = SYSCALLS.get();
                if (level === 1) {
                  if (optname === 4) {
                    HEAP32[optval >> 2] = sock.error;
                    HEAP32[optlen >> 2] = 4;
                    sock.error = null;
                    return 0
                  }
                }
                return -ERRNO_CODES.ENOPROTOOPT
              }
            case 16:
              {
                var sock = SYSCALLS.getSocketFromFD(),
                  message = SYSCALLS.get(),
                  flags = SYSCALLS.get();
                var iov = HEAP32[message + 8 >> 2];
                var num = HEAP32[message + 12 >> 2];
                var addr, port;
                var name = HEAP32[message >> 2];
                var namelen = HEAP32[message + 4 >> 2];
                if (name) {
                  var info = __read_sockaddr(name, namelen);
                  if (info.errno) return -info.errno;
                  port = info.port;
                  addr = DNS.lookup_addr(info.addr) || info.addr
                }
                var total = 0;
                for (var i = 0; i < num; i++) {
                  total += HEAP32[iov + (8 * i + 4) >> 2]
                }
                var view = new Uint8Array(total);
                var offset = 0;
                for (var i = 0; i < num; i++) {
                  var iovbase = HEAP32[iov + (8 * i + 0) >> 2];
                  var iovlen = HEAP32[iov + (8 * i + 4) >> 2];
                  for (var j = 0; j < iovlen; j++) {
                    view[offset++] = HEAP8[iovbase + j >> 0]
                  }
                }
                return sock.sock_ops.sendmsg(sock, view, 0, total, addr, port)
              }
            case 17:
              {
                var sock = SYSCALLS.getSocketFromFD(),
                  message = SYSCALLS.get(),
                  flags = SYSCALLS.get();
                var iov = HEAP32[message + 8 >> 2];
                var num = HEAP32[message + 12 >> 2];
                var total = 0;
                for (var i = 0; i < num; i++) {
                  total += HEAP32[iov + (8 * i + 4) >> 2]
                }
                var msg = sock.sock_ops.recvmsg(sock, total);
                if (!msg) return 0;
                var name = HEAP32[message >> 2];
                if (name) {
                  var res = __write_sockaddr(name, sock.family, DNS.lookup_name(msg.addr), msg.port);
                  assert(!res.errno)
                }
                var bytesRead = 0;
                var bytesRemaining = msg.buffer.byteLength;
                for (var i = 0; bytesRemaining > 0 && i < num; i++) {
                  var iovbase = HEAP32[iov + (8 * i + 0) >> 2];
                  var iovlen = HEAP32[iov + (8 * i + 4) >> 2];
                  if (!iovlen) {
                    continue
                  }
                  var length = Math.min(iovlen, bytesRemaining);
                  var buf = msg.buffer.subarray(bytesRead, bytesRead + length);
                  HEAPU8.set(buf, iovbase + bytesRead);
                  bytesRead += length;
                  bytesRemaining -= length
                }
                return bytesRead
              }
            default:
              abort("unsupported socketcall syscall " + call)
          }
        } catch (e) {
          if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
          return -e.errno
        }
      }

      function ___syscall12(which, varargs) {
        SYSCALLS.varargs = varargs;
        try {
          var path = SYSCALLS.getStr();
          FS.chdir(path);
          return 0
        } catch (e) {
          if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
          return -e.errno
        }
      }

      function ___syscall140(which, varargs) {
        SYSCALLS.varargs = varargs;
        try {
          var stream = SYSCALLS.getStreamFromFD(),
            offset_high = SYSCALLS.get(),
            offset_low = SYSCALLS.get(),
            result = SYSCALLS.get(),
            whence = SYSCALLS.get();
          var offset = offset_low;
          FS.llseek(stream, offset, whence);
          HEAP32[result >> 2] = stream.position;
          if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null;
          return 0
        } catch (e) {
          if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
          return -e.errno
        }
      }

      function ___syscall142(which, varargs) {
        SYSCALLS.varargs = varargs;
        try {
          var nfds = SYSCALLS.get(),
            readfds = SYSCALLS.get(),
            writefds = SYSCALLS.get(),
            exceptfds = SYSCALLS.get(),
            timeout = SYSCALLS.get();
          assert(nfds <= 64, "nfds must be less than or equal to 64");
          assert(!exceptfds, "exceptfds not supported");
          var total = 0;
          var srcReadLow = readfds ? HEAP32[readfds >> 2] : 0,
            srcReadHigh = readfds ? HEAP32[readfds + 4 >> 2] : 0;
          var srcWriteLow = writefds ? HEAP32[writefds >> 2] : 0,
            srcWriteHigh = writefds ? HEAP32[writefds + 4 >> 2] : 0;
          var srcExceptLow = exceptfds ? HEAP32[exceptfds >> 2] : 0,
            srcExceptHigh = exceptfds ? HEAP32[exceptfds + 4 >> 2] : 0;
          var dstReadLow = 0,
            dstReadHigh = 0;
          var dstWriteLow = 0,
            dstWriteHigh = 0;
          var dstExceptLow = 0,
            dstExceptHigh = 0;
          var allLow = (readfds ? HEAP32[readfds >> 2] : 0) | (writefds ? HEAP32[writefds >> 2] : 0) | (exceptfds ? HEAP32[exceptfds >> 2] : 0);
          var allHigh = (readfds ? HEAP32[readfds + 4 >> 2] : 0) | (writefds ? HEAP32[writefds + 4 >> 2] : 0) | (exceptfds ? HEAP32[exceptfds + 4 >> 2] : 0);

          function check(fd, low, high, val) {
            return fd < 32 ? low & val : high & val
          }
          for (var fd = 0; fd < nfds; fd++) {
            var mask = 1 << fd % 32;
            if (!check(fd, allLow, allHigh, mask)) {
              continue
            }
            var stream = FS.getStream(fd);
            if (!stream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
            var flags = SYSCALLS.DEFAULT_POLLMASK;
            if (stream.stream_ops.poll) {
              flags = stream.stream_ops.poll(stream)
            }
            if (flags & 1 && check(fd, srcReadLow, srcReadHigh, mask)) {
              fd < 32 ? dstReadLow = dstReadLow | mask : dstReadHigh = dstReadHigh | mask;
              total++
            }
            if (flags & 4 && check(fd, srcWriteLow, srcWriteHigh, mask)) {
              fd < 32 ? dstWriteLow = dstWriteLow | mask : dstWriteHigh = dstWriteHigh | mask;
              total++
            }
            if (flags & 2 && check(fd, srcExceptLow, srcExceptHigh, mask)) {
              fd < 32 ? dstExceptLow = dstExceptLow | mask : dstExceptHigh = dstExceptHigh | mask;
              total++
            }
          }
          if (readfds) {
            HEAP32[readfds >> 2] = dstReadLow;
            HEAP32[readfds + 4 >> 2] = dstReadHigh
          }
          if (writefds) {
            HEAP32[writefds >> 2] = dstWriteLow;
            HEAP32[writefds + 4 >> 2] = dstWriteHigh
          }
          if (exceptfds) {
            HEAP32[exceptfds >> 2] = dstExceptLow;
            HEAP32[exceptfds + 4 >> 2] = dstExceptHigh
          }
          return total
        } catch (e) {
          if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
          return -e.errno
        }
      }

      function ___syscall145(which, varargs) {
        SYSCALLS.varargs = varargs;
        try {
          var stream = SYSCALLS.getStreamFromFD(),
            iov = SYSCALLS.get(),
            iovcnt = SYSCALLS.get();
          return SYSCALLS.doReadv(stream, iov, iovcnt)
        } catch (e) {
          if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
          return -e.errno
        }
      }

      function ___syscall146(which, varargs) {
        SYSCALLS.varargs = varargs;
        try {
          var stream = SYSCALLS.getStreamFromFD(),
            iov = SYSCALLS.get(),
            iovcnt = SYSCALLS.get();
          return SYSCALLS.doWritev(stream, iov, iovcnt)
        } catch (e) {
          if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
          return -e.errno
        }
      }

      function ___syscall183(which, varargs) {
        SYSCALLS.varargs = varargs;
        try {
          var buf = SYSCALLS.get(),
            size = SYSCALLS.get();
          if (size === 0) return -ERRNO_CODES.EINVAL;
          var cwd = FS.cwd();
          var cwdLengthInBytes = lengthBytesUTF8(cwd);
          if (size < cwdLengthInBytes + 1) return -ERRNO_CODES.ERANGE;
          stringToUTF8(cwd, buf, size);
          return buf
        } catch (e) {
          if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
          return -e.errno
        }
      }

      function ___syscall195(which, varargs) {
        SYSCALLS.varargs = varargs;
        try {
          var path = SYSCALLS.getStr(),
            buf = SYSCALLS.get();
          return SYSCALLS.doStat(FS.stat, path, buf)
        } catch (e) {
          if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
          return -e.errno
        }
      }

      function ___syscall197(which, varargs) {
        SYSCALLS.varargs = varargs;
        try {
          var stream = SYSCALLS.getStreamFromFD(),
            buf = SYSCALLS.get();
          return SYSCALLS.doStat(FS.stat, stream.path, buf)
        } catch (e) {
          if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
          return -e.errno
        }
      }

      function ___syscall221(which, varargs) {
        SYSCALLS.varargs = varargs;
        try {
          var stream = SYSCALLS.getStreamFromFD(),
            cmd = SYSCALLS.get();
          switch (cmd) {
            case 0:
              {
                var arg = SYSCALLS.get();
                if (arg < 0) {
                  return -ERRNO_CODES.EINVAL
                }
                var newStream;newStream = FS.open(stream.path, stream.flags, 0, arg);
                return newStream.fd
              }
            case 1:
            case 2:
              return 0;
            case 3:
              return stream.flags;
            case 4:
              {
                var arg = SYSCALLS.get();stream.flags |= arg;
                return 0
              }
            case 12:
              {
                var arg = SYSCALLS.get();
                var offset = 0;HEAP16[arg + offset >> 1] = 2;
                return 0
              }
            case 13:
            case 14:
              return 0;
            case 16:
            case 8:
              return -ERRNO_CODES.EINVAL;
            case 9:
              ___setErrNo(ERRNO_CODES.EINVAL);
              return -1;
            default:
              {
                return -ERRNO_CODES.EINVAL
              }
          }
        } catch (e) {
          if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
          return -e.errno
        }
      }

      function ___syscall3(which, varargs) {
        SYSCALLS.varargs = varargs;
        try {
          var stream = SYSCALLS.getStreamFromFD(),
            buf = SYSCALLS.get(),
            count = SYSCALLS.get();
          return FS.read(stream, HEAP8, buf, count)
        } catch (e) {
          if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
          return -e.errno
        }
      }

      function ___syscall39(which, varargs) {
        SYSCALLS.varargs = varargs;
        try {
          var path = SYSCALLS.getStr(),
            mode = SYSCALLS.get();
          return SYSCALLS.doMkdir(path, mode)
        } catch (e) {
          if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
          return -e.errno
        }
      }

      function ___syscall4(which, varargs) {
        SYSCALLS.varargs = varargs;
        try {
          var stream = SYSCALLS.getStreamFromFD(),
            buf = SYSCALLS.get(),
            count = SYSCALLS.get();
          return FS.write(stream, HEAP8, buf, count)
        } catch (e) {
          if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
          return -e.errno
        }
      }

      function ___syscall5(which, varargs) {
        SYSCALLS.varargs = varargs;
        try {
          var pathname = SYSCALLS.getStr(),
            flags = SYSCALLS.get(),
            mode = SYSCALLS.get();
          var stream = FS.open(pathname, flags, mode);
          return stream.fd
        } catch (e) {
          if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
          return -e.errno
        }
      }

      function ___syscall54(which, varargs) {
        SYSCALLS.varargs = varargs;
        try {
          var stream = SYSCALLS.getStreamFromFD(),
            op = SYSCALLS.get();
          switch (op) {
            case 21509:
            case 21505:
              {
                if (!stream.tty) return -ERRNO_CODES.ENOTTY;
                return 0
              }
            case 21510:
            case 21511:
            case 21512:
            case 21506:
            case 21507:
            case 21508:
              {
                if (!stream.tty) return -ERRNO_CODES.ENOTTY;
                return 0
              }
            case 21519:
              {
                if (!stream.tty) return -ERRNO_CODES.ENOTTY;
                var argp = SYSCALLS.get();HEAP32[argp >> 2] = 0;
                return 0
              }
            case 21520:
              {
                if (!stream.tty) return -ERRNO_CODES.ENOTTY;
                return -ERRNO_CODES.EINVAL
              }
            case 21531:
              {
                var argp = SYSCALLS.get();
                return FS.ioctl(stream, op, argp)
              }
            case 21523:
              {
                if (!stream.tty) return -ERRNO_CODES.ENOTTY;
                return 0
              }
            case 21524:
              {
                if (!stream.tty) return -ERRNO_CODES.ENOTTY;
                return 0
              }
            default:
              abort("bad ioctl syscall " + op)
          }
        } catch (e) {
          if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
          return -e.errno
        }
      }

      function ___syscall6(which, varargs) {
        SYSCALLS.varargs = varargs;
        try {
          var stream = SYSCALLS.getStreamFromFD();
          FS.close(stream);
          return 0
        } catch (e) {
          if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
          return -e.errno
        }
      }

      function ___syscall85(which, varargs) {
        SYSCALLS.varargs = varargs;
        try {
          var path = SYSCALLS.getStr(),
            buf = SYSCALLS.get(),
            bufsize = SYSCALLS.get();
          return SYSCALLS.doReadlink(path, buf, bufsize)
        } catch (e) {
          if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
          return -e.errno
        }
      }

      function ___syscall91(which, varargs) {
        SYSCALLS.varargs = varargs;
        try {
          var addr = SYSCALLS.get(),
            len = SYSCALLS.get();
          var info = SYSCALLS.mappings[addr];
          if (!info) return 0;
          if (len === info.len) {
            var stream = FS.getStream(info.fd);
            SYSCALLS.doMsync(addr, stream, len, info.flags);
            FS.munmap(stream);
            SYSCALLS.mappings[addr] = null;
            if (info.allocated) {
              _free(info.malloc)
            }
          }
          return 0
        } catch (e) {
          if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
          return -e.errno
        }
      }

      function ___unlock() {}

      function getShiftFromSize(size) {
        switch (size) {
          case 1:
            return 0;
          case 2:
            return 1;
          case 4:
            return 2;
          case 8:
            return 3;
          default:
            throw new TypeError("Unknown type size: " + size)
        }
      }

      function embind_init_charCodes() {
        var codes = new Array(256);
        for (var i = 0; i < 256; ++i) {
          codes[i] = String.fromCharCode(i)
        }
        embind_charCodes = codes
      }
      var embind_charCodes = undefined;

      function readLatin1String(ptr) {
        var ret = "";
        var c = ptr;
        while (HEAPU8[c]) {
          ret += embind_charCodes[HEAPU8[c++]]
        }
        return ret
      }
      var awaitingDependencies = {};
      var registeredTypes = {};
      var typeDependencies = {};
      var char_0 = 48;
      var char_9 = 57;

      function makeLegalFunctionName(name) {
        if (undefined === name) {
          return "_unknown"
        }
        name = name.replace(/[^a-zA-Z0-9_]/g, "$");
        var f = name.charCodeAt(0);
        if (f >= char_0 && f <= char_9) {
          return "_" + name
        } else {
          return name
        }
      }

      function createNamedFunction(name, body) {
        name = makeLegalFunctionName(name);
        return new Function("body", "return function " + name + "() {\n" + '    "use strict";' + "    return body.apply(this, arguments);\n" + "};\n")(body)
      }

      function extendError(baseErrorType, errorName) {
        var errorClass = createNamedFunction(errorName, function (message) {
          this.name = errorName;
          this.message = message;
          var stack = new Error(message).stack;
          if (stack !== undefined) {
            this.stack = this.toString() + "\n" + stack.replace(/^Error(:[^\n]*)?\n/, "")
          }
        });
        errorClass.prototype = Object.create(baseErrorType.prototype);
        errorClass.prototype.constructor = errorClass;
        errorClass.prototype.toString = function () {
          if (this.message === undefined) {
            return this.name
          } else {
            return this.name + ": " + this.message
          }
        };
        return errorClass
      }
      var BindingError = undefined;

      function throwBindingError(message) {
        throw new BindingError(message)
      }
      var InternalError = undefined;

      function throwInternalError(message) {
        throw new InternalError(message)
      }

      function whenDependentTypesAreResolved(myTypes, dependentTypes, getTypeConverters) {
        myTypes.forEach(function (type) {
          typeDependencies[type] = dependentTypes
        });

        function onComplete(typeConverters) {
          var myTypeConverters = getTypeConverters(typeConverters);
          if (myTypeConverters.length !== myTypes.length) {
            throwInternalError("Mismatched type converter count")
          }
          for (var i = 0; i < myTypes.length; ++i) {
            registerType(myTypes[i], myTypeConverters[i])
          }
        }
        var typeConverters = new Array(dependentTypes.length);
        var unregisteredTypes = [];
        var registered = 0;
        dependentTypes.forEach(function (dt, i) {
          if (registeredTypes.hasOwnProperty(dt)) {
            typeConverters[i] = registeredTypes[dt]
          } else {
            unregisteredTypes.push(dt);
            if (!awaitingDependencies.hasOwnProperty(dt)) {
              awaitingDependencies[dt] = []
            }
            awaitingDependencies[dt].push(function () {
              typeConverters[i] = registeredTypes[dt];
              ++registered;
              if (registered === unregisteredTypes.length) {
                onComplete(typeConverters)
              }
            })
          }
        });
        if (0 === unregisteredTypes.length) {
          onComplete(typeConverters)
        }
      }

      function registerType(rawType, registeredInstance, options) {
        options = options || {};
        if (!("argPackAdvance" in registeredInstance)) {
          throw new TypeError("registerType registeredInstance requires argPackAdvance")
        }
        var name = registeredInstance.name;
        if (!rawType) {
          throwBindingError('type "' + name + '" must have a positive integer typeid pointer')
        }
        if (registeredTypes.hasOwnProperty(rawType)) {
          if (options.ignoreDuplicateRegistrations) {
            return
          } else {
            throwBindingError("Cannot register type '" + name + "' twice")
          }
        }
        registeredTypes[rawType] = registeredInstance;
        delete typeDependencies[rawType];
        if (awaitingDependencies.hasOwnProperty(rawType)) {
          var callbacks = awaitingDependencies[rawType];
          delete awaitingDependencies[rawType];
          callbacks.forEach(function (cb) {
            cb()
          })
        }
      }

      function __embind_register_bool(rawType, name, size, trueValue, falseValue) {
        var shift = getShiftFromSize(size);
        name = readLatin1String(name);
        registerType(rawType, {
          name: name,
          "fromWireType": function (wt) {
            return !!wt
          },
          "toWireType": function (destructors, o) {
            return o ? trueValue : falseValue
          },
          "argPackAdvance": 8,
          "readValueFromPointer": function (pointer) {
            var heap;
            if (size === 1) {
              heap = HEAP8
            } else if (size === 2) {
              heap = HEAP16
            } else if (size === 4) {
              heap = HEAP32
            } else {
              throw new TypeError("Unknown boolean type size: " + name)
            }
            return this["fromWireType"](heap[pointer >> shift])
          },
          destructorFunction: null
        })
      }

      function ClassHandle_isAliasOf(other) {
        if (!(this instanceof ClassHandle)) {
          return false
        }
        if (!(other instanceof ClassHandle)) {
          return false
        }
        var leftClass = this.$$.ptrType.registeredClass;
        var left = this.$$.ptr;
        var rightClass = other.$$.ptrType.registeredClass;
        var right = other.$$.ptr;
        while (leftClass.baseClass) {
          left = leftClass.upcast(left);
          leftClass = leftClass.baseClass
        }
        while (rightClass.baseClass) {
          right = rightClass.upcast(right);
          rightClass = rightClass.baseClass
        }
        return leftClass === rightClass && left === right
      }

      function shallowCopyInternalPointer(o) {
        return {
          count: o.count,
          deleteScheduled: o.deleteScheduled,
          preservePointerOnDelete: o.preservePointerOnDelete,
          ptr: o.ptr,
          ptrType: o.ptrType,
          smartPtr: o.smartPtr,
          smartPtrType: o.smartPtrType
        }
      }

      function throwInstanceAlreadyDeleted(obj) {
        function getInstanceTypeName(handle) {
          return handle.$$.ptrType.registeredClass.name
        }
        throwBindingError(getInstanceTypeName(obj) + " instance already deleted")
      }

      function ClassHandle_clone() {
        if (!this.$$.ptr) {
          throwInstanceAlreadyDeleted(this)
        }
        if (this.$$.preservePointerOnDelete) {
          this.$$.count.value += 1;
          return this
        } else {
          var clone = Object.create(Object.getPrototypeOf(this), {
            $$: {
              value: shallowCopyInternalPointer(this.$$)
            }
          });
          clone.$$.count.value += 1;
          clone.$$.deleteScheduled = false;
          return clone
        }
      }

      function runDestructor(handle) {
        var $$ = handle.$$;
        if ($$.smartPtr) {
          $$.smartPtrType.rawDestructor($$.smartPtr)
        } else {
          $$.ptrType.registeredClass.rawDestructor($$.ptr)
        }
      }

      function ClassHandle_delete() {
        if (!this.$$.ptr) {
          throwInstanceAlreadyDeleted(this)
        }
        if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
          throwBindingError("Object already scheduled for deletion")
        }
        this.$$.count.value -= 1;
        var toDelete = 0 === this.$$.count.value;
        if (toDelete) {
          runDestructor(this)
        }
        if (!this.$$.preservePointerOnDelete) {
          this.$$.smartPtr = undefined;
          this.$$.ptr = undefined
        }
      }

      function ClassHandle_isDeleted() {
        return !this.$$.ptr
      }
      var delayFunction = undefined;
      var deletionQueue = [];

      function flushPendingDeletes() {
        while (deletionQueue.length) {
          var obj = deletionQueue.pop();
          obj.$$.deleteScheduled = false;
          obj["delete"]()
        }
      }

      function ClassHandle_deleteLater() {
        if (!this.$$.ptr) {
          throwInstanceAlreadyDeleted(this)
        }
        if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
          throwBindingError("Object already scheduled for deletion")
        }
        deletionQueue.push(this);
        if (deletionQueue.length === 1 && delayFunction) {
          delayFunction(flushPendingDeletes)
        }
        this.$$.deleteScheduled = true;
        return this
      }

      function init_ClassHandle() {
        ClassHandle.prototype["isAliasOf"] = ClassHandle_isAliasOf;
        ClassHandle.prototype["clone"] = ClassHandle_clone;
        ClassHandle.prototype["delete"] = ClassHandle_delete;
        ClassHandle.prototype["isDeleted"] = ClassHandle_isDeleted;
        ClassHandle.prototype["deleteLater"] = ClassHandle_deleteLater
      }

      function ClassHandle() {}
      var registeredPointers = {};

      function ensureOverloadTable(proto, methodName, humanName) {
        if (undefined === proto[methodName].overloadTable) {
          var prevFunc = proto[methodName];
          proto[methodName] = function () {
            if (!proto[methodName].overloadTable.hasOwnProperty(arguments.length)) {
              throwBindingError("Function '" + humanName + "' called with an invalid number of arguments (" + arguments.length + ") - expects one of (" + proto[methodName].overloadTable + ")!")
            }
            return proto[methodName].overloadTable[arguments.length].apply(this, arguments)
          };
          proto[methodName].overloadTable = [];
          proto[methodName].overloadTable[prevFunc.argCount] = prevFunc
        }
      }

      function exposePublicSymbol(name, value, numArguments) {
        if (Module.hasOwnProperty(name)) {
          if (undefined === numArguments || undefined !== Module[name].overloadTable && undefined !== Module[name].overloadTable[numArguments]) {
            throwBindingError("Cannot register public name '" + name + "' twice")
          }
          ensureOverloadTable(Module, name, name);
          if (Module.hasOwnProperty(numArguments)) {
            throwBindingError("Cannot register multiple overloads of a function with the same number of arguments (" + numArguments + ")!")
          }
          Module[name].overloadTable[numArguments] = value
        } else {
          Module[name] = value;
          if (undefined !== numArguments) {
            Module[name].numArguments = numArguments
          }
        }
      }

      function RegisteredClass(name, constructor, instancePrototype, rawDestructor, baseClass, getActualType, upcast, downcast) {
        this.name = name;
        this.constructor = constructor;
        this.instancePrototype = instancePrototype;
        this.rawDestructor = rawDestructor;
        this.baseClass = baseClass;
        this.getActualType = getActualType;
        this.upcast = upcast;
        this.downcast = downcast;
        this.pureVirtualFunctions = []
      }

      function upcastPointer(ptr, ptrClass, desiredClass) {
        while (ptrClass !== desiredClass) {
          if (!ptrClass.upcast) {
            throwBindingError("Expected null or instance of " + desiredClass.name + ", got an instance of " + ptrClass.name)
          }
          ptr = ptrClass.upcast(ptr);
          ptrClass = ptrClass.baseClass
        }
        return ptr
      }

      function constNoSmartPtrRawPointerToWireType(destructors, handle) {
        if (handle === null) {
          if (this.isReference) {
            throwBindingError("null is not a valid " + this.name)
          }
          return 0
        }
        if (!handle.$$) {
          throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name)
        }
        if (!handle.$$.ptr) {
          throwBindingError("Cannot pass deleted object as a pointer of type " + this.name)
        }
        var handleClass = handle.$$.ptrType.registeredClass;
        var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
        return ptr
      }

      function genericPointerToWireType(destructors, handle) {
        var ptr;
        if (handle === null) {
          if (this.isReference) {
            throwBindingError("null is not a valid " + this.name)
          }
          if (this.isSmartPointer) {
            ptr = this.rawConstructor();
            if (destructors !== null) {
              destructors.push(this.rawDestructor, ptr)
            }
            return ptr
          } else {
            return 0
          }
        }
        if (!handle.$$) {
          throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name)
        }
        if (!handle.$$.ptr) {
          throwBindingError("Cannot pass deleted object as a pointer of type " + this.name)
        }
        if (!this.isConst && handle.$$.ptrType.isConst) {
          throwBindingError("Cannot convert argument of type " + (handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name) + " to parameter type " + this.name)
        }
        var handleClass = handle.$$.ptrType.registeredClass;
        ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
        if (this.isSmartPointer) {
          if (undefined === handle.$$.smartPtr) {
            throwBindingError("Passing raw pointer to smart pointer is illegal")
          }
          switch (this.sharingPolicy) {
            case 0:
              if (handle.$$.smartPtrType === this) {
                ptr = handle.$$.smartPtr
              } else {
                throwBindingError("Cannot convert argument of type " + (handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name) + " to parameter type " + this.name)
              }
              break;
            case 1:
              ptr = handle.$$.smartPtr;
              break;
            case 2:
              if (handle.$$.smartPtrType === this) {
                ptr = handle.$$.smartPtr
              } else {
                var clonedHandle = handle["clone"]();
                ptr = this.rawShare(ptr, __emval_register(function () {
                  clonedHandle["delete"]()
                }));
                if (destructors !== null) {
                  destructors.push(this.rawDestructor, ptr)
                }
              }
              break;
            default:
              throwBindingError("Unsupporting sharing policy")
          }
        }
        return ptr
      }

      function nonConstNoSmartPtrRawPointerToWireType(destructors, handle) {
        if (handle === null) {
          if (this.isReference) {
            throwBindingError("null is not a valid " + this.name)
          }
          return 0
        }
        if (!handle.$$) {
          throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name)
        }
        if (!handle.$$.ptr) {
          throwBindingError("Cannot pass deleted object as a pointer of type " + this.name)
        }
        if (handle.$$.ptrType.isConst) {
          throwBindingError("Cannot convert argument of type " + handle.$$.ptrType.name + " to parameter type " + this.name)
        }
        var handleClass = handle.$$.ptrType.registeredClass;
        var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
        return ptr
      }

      function simpleReadValueFromPointer(pointer) {
        return this["fromWireType"](HEAPU32[pointer >> 2])
      }

      function RegisteredPointer_getPointee(ptr) {
        if (this.rawGetPointee) {
          ptr = this.rawGetPointee(ptr)
        }
        return ptr
      }

      function RegisteredPointer_destructor(ptr) {
        if (this.rawDestructor) {
          this.rawDestructor(ptr)
        }
      }

      function RegisteredPointer_deleteObject(handle) {
        if (handle !== null) {
          handle["delete"]()
        }
      }

      function downcastPointer(ptr, ptrClass, desiredClass) {
        if (ptrClass === desiredClass) {
          return ptr
        }
        if (undefined === desiredClass.baseClass) {
          return null
        }
        var rv = downcastPointer(ptr, ptrClass, desiredClass.baseClass);
        if (rv === null) {
          return null
        }
        return desiredClass.downcast(rv)
      }

      function getInheritedInstanceCount() {
        return Object.keys(registeredInstances).length
      }

      function getLiveInheritedInstances() {
        var rv = [];
        for (var k in registeredInstances) {
          if (registeredInstances.hasOwnProperty(k)) {
            rv.push(registeredInstances[k])
          }
        }
        return rv
      }

      function setDelayFunction(fn) {
        delayFunction = fn;
        if (deletionQueue.length && delayFunction) {
          delayFunction(flushPendingDeletes)
        }
      }

      function init_embind() {
        Module["getInheritedInstanceCount"] = getInheritedInstanceCount;
        Module["getLiveInheritedInstances"] = getLiveInheritedInstances;
        Module["flushPendingDeletes"] = flushPendingDeletes;
        Module["setDelayFunction"] = setDelayFunction
      }
      var registeredInstances = {};

      function getBasestPointer(class_, ptr) {
        if (ptr === undefined) {
          throwBindingError("ptr should not be undefined")
        }
        while (class_.baseClass) {
          ptr = class_.upcast(ptr);
          class_ = class_.baseClass
        }
        return ptr
      }

      function getInheritedInstance(class_, ptr) {
        ptr = getBasestPointer(class_, ptr);
        return registeredInstances[ptr]
      }

      function makeClassHandle(prototype, record) {
        if (!record.ptrType || !record.ptr) {
          throwInternalError("makeClassHandle requires ptr and ptrType")
        }
        var hasSmartPtrType = !!record.smartPtrType;
        var hasSmartPtr = !!record.smartPtr;
        if (hasSmartPtrType !== hasSmartPtr) {
          throwInternalError("Both smartPtrType and smartPtr must be specified")
        }
        record.count = {
          value: 1
        };
        return Object.create(prototype, {
          $$: {
            value: record
          }
        })
      }

      function RegisteredPointer_fromWireType(ptr) {
        var rawPointer = this.getPointee(ptr);
        if (!rawPointer) {
          this.destructor(ptr);
          return null
        }
        var registeredInstance = getInheritedInstance(this.registeredClass, rawPointer);
        if (undefined !== registeredInstance) {
          if (0 === registeredInstance.$$.count.value) {
            registeredInstance.$$.ptr = rawPointer;
            registeredInstance.$$.smartPtr = ptr;
            return registeredInstance["clone"]()
          } else {
            var rv = registeredInstance["clone"]();
            this.destructor(ptr);
            return rv
          }
        }

        function makeDefaultHandle() {
          if (this.isSmartPointer) {
            return makeClassHandle(this.registeredClass.instancePrototype, {
              ptrType: this.pointeeType,
              ptr: rawPointer,
              smartPtrType: this,
              smartPtr: ptr
            })
          } else {
            return makeClassHandle(this.registeredClass.instancePrototype, {
              ptrType: this,
              ptr: ptr
            })
          }
        }
        var actualType = this.registeredClass.getActualType(rawPointer);
        var registeredPointerRecord = registeredPointers[actualType];
        if (!registeredPointerRecord) {
          return makeDefaultHandle.call(this)
        }
        var toType;
        if (this.isConst) {
          toType = registeredPointerRecord.constPointerType
        } else {
          toType = registeredPointerRecord.pointerType
        }
        var dp = downcastPointer(rawPointer, this.registeredClass, toType.registeredClass);
        if (dp === null) {
          return makeDefaultHandle.call(this)
        }
        if (this.isSmartPointer) {
          return makeClassHandle(toType.registeredClass.instancePrototype, {
            ptrType: toType,
            ptr: dp,
            smartPtrType: this,
            smartPtr: ptr
          })
        } else {
          return makeClassHandle(toType.registeredClass.instancePrototype, {
            ptrType: toType,
            ptr: dp
          })
        }
      }

      function init_RegisteredPointer() {
        RegisteredPointer.prototype.getPointee = RegisteredPointer_getPointee;
        RegisteredPointer.prototype.destructor = RegisteredPointer_destructor;
        RegisteredPointer.prototype["argPackAdvance"] = 8;
        RegisteredPointer.prototype["readValueFromPointer"] = simpleReadValueFromPointer;
        RegisteredPointer.prototype["deleteObject"] = RegisteredPointer_deleteObject;
        RegisteredPointer.prototype["fromWireType"] = RegisteredPointer_fromWireType
      }

      function RegisteredPointer(name, registeredClass, isReference, isConst, isSmartPointer, pointeeType, sharingPolicy, rawGetPointee, rawConstructor, rawShare, rawDestructor) {
        this.name = name;
        this.registeredClass = registeredClass;
        this.isReference = isReference;
        this.isConst = isConst;
        this.isSmartPointer = isSmartPointer;
        this.pointeeType = pointeeType;
        this.sharingPolicy = sharingPolicy;
        this.rawGetPointee = rawGetPointee;
        this.rawConstructor = rawConstructor;
        this.rawShare = rawShare;
        this.rawDestructor = rawDestructor;
        if (!isSmartPointer && registeredClass.baseClass === undefined) {
          if (isConst) {
            this["toWireType"] = constNoSmartPtrRawPointerToWireType;
            this.destructorFunction = null
          } else {
            this["toWireType"] = nonConstNoSmartPtrRawPointerToWireType;
            this.destructorFunction = null
          }
        } else {
          this["toWireType"] = genericPointerToWireType
        }
      }

      function replacePublicSymbol(name, value, numArguments) {
        if (!Module.hasOwnProperty(name)) {
          throwInternalError("Replacing nonexistant public symbol")
        }
        if (undefined !== Module[name].overloadTable && undefined !== numArguments) {
          Module[name].overloadTable[numArguments] = value
        } else {
          Module[name] = value;
          Module[name].argCount = numArguments
        }
      }

      function embind__requireFunction(signature, rawFunction) {
        signature = readLatin1String(signature);

        function makeDynCaller(dynCall) {
          var args = [];
          for (var i = 1; i < signature.length; ++i) {
            args.push("a" + i)
          }
          var name = "dynCall_" + signature + "_" + rawFunction;
          var body = "return function " + name + "(" + args.join(", ") + ") {\n";
          body += "    return dynCall(rawFunction" + (args.length ? ", " : "") + args.join(", ") + ");\n";
          body += "};\n";
          return new Function("dynCall", "rawFunction", body)(dynCall, rawFunction)
        }
        var fp;
        if (Module["FUNCTION_TABLE_" + signature] !== undefined) {
          fp = Module["FUNCTION_TABLE_" + signature][rawFunction]
        } else if (typeof FUNCTION_TABLE !== "undefined") {
          fp = FUNCTION_TABLE[rawFunction]
        } else {
          var dc = Module["dynCall_" + signature];
          if (dc === undefined) {
            dc = Module["dynCall_" + signature.replace(/f/g, "d")];
            if (dc === undefined) {
              throwBindingError("No dynCall invoker for signature: " + signature)
            }
          }
          fp = makeDynCaller(dc)
        }
        if (typeof fp !== "function") {
          throwBindingError("unknown function pointer with signature " + signature + ": " + rawFunction)
        }
        return fp
      }
      var UnboundTypeError = undefined;

      function getTypeName(type) {
        var ptr = ___getTypeName(type);
        var rv = readLatin1String(ptr);
        _free(ptr);
        return rv
      }

      function throwUnboundTypeError(message, types) {
        var unboundTypes = [];
        var seen = {};

        function visit(type) {
          if (seen[type]) {
            return
          }
          if (registeredTypes[type]) {
            return
          }
          if (typeDependencies[type]) {
            typeDependencies[type].forEach(visit);
            return
          }
          unboundTypes.push(type);
          seen[type] = true
        }
        types.forEach(visit);
        throw new UnboundTypeError(message + ": " + unboundTypes.map(getTypeName).join([", "]))
      }

      function __embind_register_class(rawType, rawPointerType, rawConstPointerType, baseClassRawType, getActualTypeSignature, getActualType, upcastSignature, upcast, downcastSignature, downcast, name, destructorSignature, rawDestructor) {
        name = readLatin1String(name);
        getActualType = embind__requireFunction(getActualTypeSignature, getActualType);
        if (upcast) {
          upcast = embind__requireFunction(upcastSignature, upcast)
        }
        if (downcast) {
          downcast = embind__requireFunction(downcastSignature, downcast)
        }
        rawDestructor = embind__requireFunction(destructorSignature, rawDestructor);
        var legalFunctionName = makeLegalFunctionName(name);
        exposePublicSymbol(legalFunctionName, function () {
          throwUnboundTypeError("Cannot construct " + name + " due to unbound types", [baseClassRawType])
        });
        whenDependentTypesAreResolved([rawType, rawPointerType, rawConstPointerType], baseClassRawType ? [baseClassRawType] : [], function (base) {
          base = base[0];
          var baseClass;
          var basePrototype;
          if (baseClassRawType) {
            baseClass = base.registeredClass;
            basePrototype = baseClass.instancePrototype
          } else {
            basePrototype = ClassHandle.prototype
          }
          var constructor = createNamedFunction(legalFunctionName, function () {
            if (Object.getPrototypeOf(this) !== instancePrototype) {
              throw new BindingError("Use 'new' to construct " + name)
            }
            if (undefined === registeredClass.constructor_body) {
              throw new BindingError(name + " has no accessible constructor")
            }
            var body = registeredClass.constructor_body[arguments.length];
            if (undefined === body) {
              throw new BindingError("Tried to invoke ctor of " + name + " with invalid number of parameters (" + arguments.length + ") - expected (" + Object.keys(registeredClass.constructor_body).toString() + ") parameters instead!")
            }
            return body.apply(this, arguments)
          });
          var instancePrototype = Object.create(basePrototype, {
            constructor: {
              value: constructor
            }
          });
          constructor.prototype = instancePrototype;
          var registeredClass = new RegisteredClass(name, constructor, instancePrototype, rawDestructor, baseClass, getActualType, upcast, downcast);
          var referenceConverter = new RegisteredPointer(name, registeredClass, true, false, false);
          var pointerConverter = new RegisteredPointer(name + "*", registeredClass, false, false, false);
          var constPointerConverter = new RegisteredPointer(name + " const*", registeredClass, false, true, false);
          registeredPointers[rawType] = {
            pointerType: pointerConverter,
            constPointerType: constPointerConverter
          };
          replacePublicSymbol(legalFunctionName, constructor);
          return [referenceConverter, pointerConverter, constPointerConverter]
        })
      }

      function new_(constructor, argumentList) {
        if (!(constructor instanceof Function)) {
          throw new TypeError("new_ called with constructor type " + typeof constructor + " which is not a function")
        }
        var dummy = createNamedFunction(constructor.name || "unknownFunctionName", function () {});
        dummy.prototype = constructor.prototype;
        var obj = new dummy;
        var r = constructor.apply(obj, argumentList);
        return r instanceof Object ? r : obj
      }

      function runDestructors(destructors) {
        while (destructors.length) {
          var ptr = destructors.pop();
          var del = destructors.pop();
          del(ptr)
        }
      }

      function craftInvokerFunction(humanName, argTypes, classType, cppInvokerFunc, cppTargetFunc) {
        var argCount = argTypes.length;
        if (argCount < 2) {
          throwBindingError("argTypes array size mismatch! Must at least get return value and 'this' types!")
        }
        var isClassMethodFunc = argTypes[1] !== null && classType !== null;
        var needsDestructorStack = false;
        for (var i = 1; i < argTypes.length; ++i) {
          if (argTypes[i] !== null && argTypes[i].destructorFunction === undefined) {
            needsDestructorStack = true;
            break
          }
        }
        var returns = argTypes[0].name !== "void";
        var argsList = "";
        var argsListWired = "";
        for (var i = 0; i < argCount - 2; ++i) {
          argsList += (i !== 0 ? ", " : "") + "arg" + i;
          argsListWired += (i !== 0 ? ", " : "") + "arg" + i + "Wired"
        }
        var invokerFnBody = "return function " + makeLegalFunctionName(humanName) + "(" + argsList + ") {\n" + "if (arguments.length !== " + (argCount - 2) + ") {\n" + "throwBindingError('function " + humanName + " called with ' + arguments.length + ' arguments, expected " + (argCount - 2) + " args!');\n" + "}\n";
        if (needsDestructorStack) {
          invokerFnBody += "var destructors = [];\n"
        }
        var dtorStack = needsDestructorStack ? "destructors" : "null";
        var args1 = ["throwBindingError", "invoker", "fn", "runDestructors", "retType", "classParam"];
        var args2 = [throwBindingError, cppInvokerFunc, cppTargetFunc, runDestructors, argTypes[0], argTypes[1]];
        if (isClassMethodFunc) {
          invokerFnBody += "var thisWired = classParam.toWireType(" + dtorStack + ", this);\n"
        }
        for (var i = 0; i < argCount - 2; ++i) {
          invokerFnBody += "var arg" + i + "Wired = argType" + i + ".toWireType(" + dtorStack + ", arg" + i + "); // " + argTypes[i + 2].name + "\n";
          args1.push("argType" + i);
          args2.push(argTypes[i + 2])
        }
        if (isClassMethodFunc) {
          argsListWired = "thisWired" + (argsListWired.length > 0 ? ", " : "") + argsListWired
        }
        invokerFnBody += (returns ? "var rv = " : "") + "invoker(fn" + (argsListWired.length > 0 ? ", " : "") + argsListWired + ");\n";
        if (needsDestructorStack) {
          invokerFnBody += "runDestructors(destructors);\n"
        } else {
          for (var i = isClassMethodFunc ? 1 : 2; i < argTypes.length; ++i) {
            var paramName = i === 1 ? "thisWired" : "arg" + (i - 2) + "Wired";
            if (argTypes[i].destructorFunction !== null) {
              invokerFnBody += paramName + "_dtor(" + paramName + "); // " + argTypes[i].name + "\n";
              args1.push(paramName + "_dtor");
              args2.push(argTypes[i].destructorFunction)
            }
          }
        }
        if (returns) {
          invokerFnBody += "var ret = retType.fromWireType(rv);\n" + "return ret;\n"
        } else {}
        invokerFnBody += "}\n";
        args1.push(invokerFnBody);
        var invokerFunction = new_(Function, args1).apply(null, args2);
        return invokerFunction
      }

      function heap32VectorToArray(count, firstElement) {
        var array = [];
        for (var i = 0; i < count; i++) {
          array.push(HEAP32[(firstElement >> 2) + i])
        }
        return array
      }

      function __embind_register_class_class_function(rawClassType, methodName, argCount, rawArgTypesAddr, invokerSignature, rawInvoker, fn) {
        var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
        methodName = readLatin1String(methodName);
        rawInvoker = embind__requireFunction(invokerSignature, rawInvoker);
        whenDependentTypesAreResolved([], [rawClassType], function (classType) {
          classType = classType[0];
          var humanName = classType.name + "." + methodName;

          function unboundTypesHandler() {
            throwUnboundTypeError("Cannot call " + humanName + " due to unbound types", rawArgTypes)
          }
          var proto = classType.registeredClass.constructor;
          if (undefined === proto[methodName]) {
            unboundTypesHandler.argCount = argCount - 1;
            proto[methodName] = unboundTypesHandler
          } else {
            ensureOverloadTable(proto, methodName, humanName);
            proto[methodName].overloadTable[argCount - 1] = unboundTypesHandler
          }
          whenDependentTypesAreResolved([], rawArgTypes, function (argTypes) {
            var invokerArgsArray = [argTypes[0], null].concat(argTypes.slice(1));
            var func = craftInvokerFunction(humanName, invokerArgsArray, null, rawInvoker, fn);
            if (undefined === proto[methodName].overloadTable) {
              func.argCount = argCount - 1;
              proto[methodName] = func
            } else {
              proto[methodName].overloadTable[argCount - 1] = func
            }
            return []
          });
          return []
        })
      }

      function __embind_register_class_constructor(rawClassType, argCount, rawArgTypesAddr, invokerSignature, invoker, rawConstructor) {
        var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
        invoker = embind__requireFunction(invokerSignature, invoker);
        whenDependentTypesAreResolved([], [rawClassType], function (classType) {
          classType = classType[0];
          var humanName = "constructor " + classType.name;
          if (undefined === classType.registeredClass.constructor_body) {
            classType.registeredClass.constructor_body = []
          }
          if (undefined !== classType.registeredClass.constructor_body[argCount - 1]) {
            throw new BindingError("Cannot register multiple constructors with identical number of parameters (" + (argCount - 1) + ") for class '" + classType.name + "'! Overload resolution is currently only performed using the parameter count, not actual type info!")
          }
          classType.registeredClass.constructor_body[argCount - 1] = function unboundTypeHandler() {
            throwUnboundTypeError("Cannot construct " + classType.name + " due to unbound types", rawArgTypes)
          };
          whenDependentTypesAreResolved([], rawArgTypes, function (argTypes) {
            classType.registeredClass.constructor_body[argCount - 1] = function constructor_body() {
              if (arguments.length !== argCount - 1) {
                throwBindingError(humanName + " called with " + arguments.length + " arguments, expected " + (argCount - 1))
              }
              var destructors = [];
              var args = new Array(argCount);
              args[0] = rawConstructor;
              for (var i = 1; i < argCount; ++i) {
                args[i] = argTypes[i]["toWireType"](destructors, arguments[i - 1])
              }
              var ptr = invoker.apply(null, args);
              runDestructors(destructors);
              return argTypes[0]["fromWireType"](ptr)
            };
            return []
          });
          return []
        })
      }

      function __embind_register_class_function(rawClassType, methodName, argCount, rawArgTypesAddr, invokerSignature, rawInvoker, context, isPureVirtual) {
        var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
        methodName = readLatin1String(methodName);
        rawInvoker = embind__requireFunction(invokerSignature, rawInvoker);
        whenDependentTypesAreResolved([], [rawClassType], function (classType) {
          classType = classType[0];
          var humanName = classType.name + "." + methodName;
          if (isPureVirtual) {
            classType.registeredClass.pureVirtualFunctions.push(methodName)
          }

          function unboundTypesHandler() {
            throwUnboundTypeError("Cannot call " + humanName + " due to unbound types", rawArgTypes)
          }
          var proto = classType.registeredClass.instancePrototype;
          var method = proto[methodName];
          if (undefined === method || undefined === method.overloadTable && method.className !== classType.name && method.argCount === argCount - 2) {
            unboundTypesHandler.argCount = argCount - 2;
            unboundTypesHandler.className = classType.name;
            proto[methodName] = unboundTypesHandler
          } else {
            ensureOverloadTable(proto, methodName, humanName);
            proto[methodName].overloadTable[argCount - 2] = unboundTypesHandler
          }
          whenDependentTypesAreResolved([], rawArgTypes, function (argTypes) {
            var memberFunction = craftInvokerFunction(humanName, argTypes, classType, rawInvoker, context);
            if (undefined === proto[methodName].overloadTable) {
              memberFunction.argCount = argCount - 2;
              proto[methodName] = memberFunction
            } else {
              proto[methodName].overloadTable[argCount - 2] = memberFunction
            }
            return []
          });
          return []
        })
      }
      var emval_free_list = [];
      var emval_handle_array = [{}, {
        value: undefined
      }, {
        value: null
      }, {
        value: true
      }, {
        value: false
      }];

      function __emval_decref(handle) {
        if (handle > 4 && 0 === --emval_handle_array[handle].refcount) {
          emval_handle_array[handle] = undefined;
          emval_free_list.push(handle)
        }
      }

      function count_emval_handles() {
        var count = 0;
        for (var i = 5; i < emval_handle_array.length; ++i) {
          if (emval_handle_array[i] !== undefined) {
            ++count
          }
        }
        return count
      }

      function get_first_emval() {
        for (var i = 5; i < emval_handle_array.length; ++i) {
          if (emval_handle_array[i] !== undefined) {
            return emval_handle_array[i]
          }
        }
        return null
      }

      function init_emval() {
        Module["count_emval_handles"] = count_emval_handles;
        Module["get_first_emval"] = get_first_emval
      }

      function __emval_register(value) {
        switch (value) {
          case undefined:
            {
              return 1
            }
          case null:
            {
              return 2
            }
          case true:
            {
              return 3
            }
          case false:
            {
              return 4
            }
          default:
            {
              var handle = emval_free_list.length ? emval_free_list.pop() : emval_handle_array.length;emval_handle_array[handle] = {
                refcount: 1,
                value: value
              };
              return handle
            }
        }
      }

      function __embind_register_emval(rawType, name) {
        name = readLatin1String(name);
        registerType(rawType, {
          name: name,
          "fromWireType": function (handle) {
            var rv = emval_handle_array[handle].value;
            __emval_decref(handle);
            return rv
          },
          "toWireType": function (destructors, value) {
            return __emval_register(value)
          },
          "argPackAdvance": 8,
          "readValueFromPointer": simpleReadValueFromPointer,
          destructorFunction: null
        })
      }

      function _embind_repr(v) {
        if (v === null) {
          return "null"
        }
        var t = typeof v;
        if (t === "object" || t === "array" || t === "function") {
          return v.toString()
        } else {
          return "" + v
        }
      }

      function floatReadValueFromPointer(name, shift) {
        switch (shift) {
          case 2:
            return function (pointer) {
              return this["fromWireType"](HEAPF32[pointer >> 2])
            };
          case 3:
            return function (pointer) {
              return this["fromWireType"](HEAPF64[pointer >> 3])
            };
          default:
            throw new TypeError("Unknown float type: " + name)
        }
      }

      function __embind_register_float(rawType, name, size) {
        var shift = getShiftFromSize(size);
        name = readLatin1String(name);
        registerType(rawType, {
          name: name,
          "fromWireType": function (value) {
            return value
          },
          "toWireType": function (destructors, value) {
            if (typeof value !== "number" && typeof value !== "boolean") {
              throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name)
            }
            return value
          },
          "argPackAdvance": 8,
          "readValueFromPointer": floatReadValueFromPointer(name, shift),
          destructorFunction: null
        })
      }

      function __embind_register_function(name, argCount, rawArgTypesAddr, signature, rawInvoker, fn) {
        var argTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
        name = readLatin1String(name);
        rawInvoker = embind__requireFunction(signature, rawInvoker);
        exposePublicSymbol(name, function () {
          throwUnboundTypeError("Cannot call " + name + " due to unbound types", argTypes)
        }, argCount - 1);
        whenDependentTypesAreResolved([], argTypes, function (argTypes) {
          var invokerArgsArray = [argTypes[0], null].concat(argTypes.slice(1));
          replacePublicSymbol(name, craftInvokerFunction(name, invokerArgsArray, null, rawInvoker, fn), argCount - 1);
          return []
        })
      }

      function integerReadValueFromPointer(name, shift, signed) {
        switch (shift) {
          case 0:
            return signed ? function readS8FromPointer(pointer) {
              return HEAP8[pointer]
            } : function readU8FromPointer(pointer) {
              return HEAPU8[pointer]
            };
          case 1:
            return signed ? function readS16FromPointer(pointer) {
              return HEAP16[pointer >> 1]
            } : function readU16FromPointer(pointer) {
              return HEAPU16[pointer >> 1]
            };
          case 2:
            return signed ? function readS32FromPointer(pointer) {
              return HEAP32[pointer >> 2]
            } : function readU32FromPointer(pointer) {
              return HEAPU32[pointer >> 2]
            };
          default:
            throw new TypeError("Unknown integer type: " + name)
        }
      }

      function __embind_register_integer(primitiveType, name, size, minRange, maxRange) {
        name = readLatin1String(name);
        if (maxRange === -1) {
          maxRange = 4294967295
        }
        var shift = getShiftFromSize(size);
        var fromWireType = function (value) {
          return value
        };
        if (minRange === 0) {
          var bitshift = 32 - 8 * size;
          fromWireType = function (value) {
            return value << bitshift >>> bitshift
          }
        }
        var isUnsignedType = name.indexOf("unsigned") != -1;
        registerType(primitiveType, {
          name: name,
          "fromWireType": fromWireType,
          "toWireType": function (destructors, value) {
            if (typeof value !== "number" && typeof value !== "boolean") {
              throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name)
            }
            if (value < minRange || value > maxRange) {
              throw new TypeError('Passing a number "' + _embind_repr(value) + '" from JS side to C/C++ side to an argument of type "' + name + '", which is outside the valid range [' + minRange + ", " + maxRange + "]!")
            }
            return isUnsignedType ? value >>> 0 : value | 0
          },
          "argPackAdvance": 8,
          "readValueFromPointer": integerReadValueFromPointer(name, shift, minRange !== 0),
          destructorFunction: null
        })
      }

      function __embind_register_memory_view(rawType, dataTypeIndex, name) {
        var typeMapping = [Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array];
        var TA = typeMapping[dataTypeIndex];

        function decodeMemoryView(handle) {
          handle = handle >> 2;
          var heap = HEAPU32;
          var size = heap[handle];
          var data = heap[handle + 1];
          return new TA(heap["buffer"], data, size)
        }
        name = readLatin1String(name);
        registerType(rawType, {
          name: name,
          "fromWireType": decodeMemoryView,
          "argPackAdvance": 8,
          "readValueFromPointer": decodeMemoryView
        }, {
          ignoreDuplicateRegistrations: true
        })
      }

      function __embind_register_std_string(rawType, name) {
        name = readLatin1String(name);
        var stdStringIsUTF8 = name === "std::string";
        registerType(rawType, {
          name: name,
          "fromWireType": function (value) {
            var length = HEAPU32[value >> 2];
            var str;
            if (stdStringIsUTF8) {
              var endChar = HEAPU8[value + 4 + length];
              var endCharSwap = 0;
              if (endChar != 0) {
                endCharSwap = endChar;
                HEAPU8[value + 4 + length] = 0
              }
              var decodeStartPtr = value + 4;
              for (var i = 0; i <= length; ++i) {
                var currentBytePtr = value + 4 + i;
                if (HEAPU8[currentBytePtr] == 0) {
                  var stringSegment = UTF8ToString(decodeStartPtr);
                  if (str === undefined) str = stringSegment;
                  else {
                    str += String.fromCharCode(0);
                    str += stringSegment
                  }
                  decodeStartPtr = currentBytePtr + 1
                }
              }
              if (endCharSwap != 0) HEAPU8[value + 4 + length] = endCharSwap
            } else {
              var a = new Array(length);
              for (var i = 0; i < length; ++i) {
                a[i] = String.fromCharCode(HEAPU8[value + 4 + i])
              }
              str = a.join("")
            }
            _free(value);
            return str
          },
          "toWireType": function (destructors, value) {
            if (value instanceof ArrayBuffer) {
              value = new Uint8Array(value)
            }
            var getLength;
            var valueIsOfTypeString = typeof value === "string";
            if (!(valueIsOfTypeString || value instanceof Uint8Array || value instanceof Uint8ClampedArray || value instanceof Int8Array)) {
              throwBindingError("Cannot pass non-string to std::string")
            }
            if (stdStringIsUTF8 && valueIsOfTypeString) {
              getLength = function () {
                return lengthBytesUTF8(value)
              }
            } else {
              getLength = function () {
                return value.length
              }
            }
            var length = getLength();
            var ptr = _malloc(4 + length + 1);
            HEAPU32[ptr >> 2] = length;
            if (stdStringIsUTF8 && valueIsOfTypeString) {
              stringToUTF8(value, ptr + 4, length + 1)
            } else {
              if (valueIsOfTypeString) {
                for (var i = 0; i < length; ++i) {
                  var charCode = value.charCodeAt(i);
                  if (charCode > 255) {
                    _free(ptr);
                    throwBindingError("String has UTF-16 code units that do not fit in 8 bits")
                  }
                  HEAPU8[ptr + 4 + i] = charCode
                }
              } else {
                for (var i = 0; i < length; ++i) {
                  HEAPU8[ptr + 4 + i] = value[i]
                }
              }
            }
            if (destructors !== null) {
              destructors.push(_free, ptr)
            }
            return ptr
          },
          "argPackAdvance": 8,
          "readValueFromPointer": simpleReadValueFromPointer,
          destructorFunction: function (ptr) {
            _free(ptr)
          }
        })
      }

      function __embind_register_std_wstring(rawType, charSize, name) {
        name = readLatin1String(name);
        var getHeap, shift;
        if (charSize === 2) {
          getHeap = function () {
            return HEAPU16
          };
          shift = 1
        } else if (charSize === 4) {
          getHeap = function () {
            return HEAPU32
          };
          shift = 2
        }
        registerType(rawType, {
          name: name,
          "fromWireType": function (value) {
            var HEAP = getHeap();
            var length = HEAPU32[value >> 2];
            var a = new Array(length);
            var start = value + 4 >> shift;
            for (var i = 0; i < length; ++i) {
              a[i] = String.fromCharCode(HEAP[start + i])
            }
            _free(value);
            return a.join("")
          },
          "toWireType": function (destructors, value) {
            var HEAP = getHeap();
            var length = value.length;
            var ptr = _malloc(4 + length * charSize);
            HEAPU32[ptr >> 2] = length;
            var start = ptr + 4 >> shift;
            for (var i = 0; i < length; ++i) {
              HEAP[start + i] = value.charCodeAt(i)
            }
            if (destructors !== null) {
              destructors.push(_free, ptr)
            }
            return ptr
          },
          "argPackAdvance": 8,
          "readValueFromPointer": simpleReadValueFromPointer,
          destructorFunction: function (ptr) {
            _free(ptr)
          }
        })
      }

      function __embind_register_void(rawType, name) {
        name = readLatin1String(name);
        registerType(rawType, {
          isVoid: true,
          name: name,
          "argPackAdvance": 0,
          "fromWireType": function () {
            return undefined
          },
          "toWireType": function (destructors, o) {
            return undefined
          }
        })
      }

      function __emval_incref(handle) {
        if (handle > 4) {
          emval_handle_array[handle].refcount += 1
        }
      }

      function requireRegisteredType(rawType, humanName) {
        var impl = registeredTypes[rawType];
        if (undefined === impl) {
          throwBindingError(humanName + " has unknown type " + getTypeName(rawType))
        }
        return impl
      }

      function __emval_take_value(type, argv) {
        type = requireRegisteredType(type, "_emval_take_value");
        var v = type["readValueFromPointer"](argv);
        return __emval_register(v)
      }

      function _abort() {
        Module["abort"]()
      }

      function _emscripten_get_heap_size() {
        return TOTAL_MEMORY
      }

      function abortOnCannotGrowMemory(requestedSize) {
        abort("Cannot enlarge memory arrays to size " + requestedSize + " bytes (OOM). Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value " + TOTAL_MEMORY + ", (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime, or (3) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ")
      }

      function emscripten_realloc_buffer(size) {
        var PAGE_MULTIPLE = 65536;
        size = alignUp(size, PAGE_MULTIPLE);
        var old = Module["buffer"];
        var oldSize = old.byteLength;
        try {
          var result = wasmMemory.grow((size - oldSize) / 65536);
          if (result !== (-1 | 0)) {
            return Module["buffer"] = wasmMemory.buffer
          } else {
            return null
          }
        } catch (e) {
          console.error("emscripten_realloc_buffer: Attempted to grow from " + oldSize + " bytes to " + size + " bytes, but got error: " + e);
          return null
        }
      }

      function _emscripten_resize_heap(requestedSize) {
        var oldSize = _emscripten_get_heap_size();
        assert(requestedSize > oldSize);
        var PAGE_MULTIPLE = 65536;
        var LIMIT = 2147483648 - PAGE_MULTIPLE;
        if (requestedSize > LIMIT) {
          err("Cannot enlarge memory, asked to go up to " + requestedSize + " bytes, but the limit is " + LIMIT + " bytes!");
          return false
        }
        var MIN_TOTAL_MEMORY = 16777216;
        var newSize = Math.max(oldSize, MIN_TOTAL_MEMORY);
        while (newSize < requestedSize) {
          if (newSize <= 536870912) {
            newSize = alignUp(2 * newSize, PAGE_MULTIPLE)
          } else {
            newSize = Math.min(alignUp((3 * newSize + 2147483648) / 4, PAGE_MULTIPLE), LIMIT);
            if (newSize === oldSize) {
              warnOnce("Cannot ask for more memory since we reached the practical limit in browsers (which is just below 2GB), so the request would have failed. Requesting only " + TOTAL_MEMORY)
            }
          }
        }
        var start = Date.now();
        var replacement = emscripten_realloc_buffer(newSize);
        if (!replacement || replacement.byteLength != newSize) {
          err("Failed to grow the heap from " + oldSize + " bytes to " + newSize + " bytes, not enough memory!");
          if (replacement) {
            err("Expected to get back a buffer of size " + newSize + " bytes, but instead got back a buffer of size " + replacement.byteLength)
          }
          return false
        }
        updateGlobalBuffer(replacement);
        updateGlobalBufferViews();
        TOTAL_MEMORY = newSize;
        HEAPU32[DYNAMICTOP_PTR >> 2] = requestedSize;
        return true
      }

      function _exit(status) {
        exit(status)
      }

      function _getenv(name) {
        if (name === 0) return 0;
        name = UTF8ToString(name);
        if (!ENV.hasOwnProperty(name)) return 0;
        if (_getenv.ret) _free(_getenv.ret);
        _getenv.ret = allocateUTF8(ENV[name]);
        return _getenv.ret
      }

      function _gethostbyname(name) {
        name = UTF8ToString(name);
        var ret = _malloc(20);
        var nameBuf = _malloc(name.length + 1);
        stringToUTF8(name, nameBuf, name.length + 1);
        HEAP32[ret >> 2] = nameBuf;
        var aliasesBuf = _malloc(4);
        HEAP32[aliasesBuf >> 2] = 0;
        HEAP32[ret + 4 >> 2] = aliasesBuf;
        var afinet = 2;
        HEAP32[ret + 8 >> 2] = afinet;
        HEAP32[ret + 12 >> 2] = 4;
        var addrListBuf = _malloc(12);
        HEAP32[addrListBuf >> 2] = addrListBuf + 8;
        HEAP32[addrListBuf + 4 >> 2] = 0;
        HEAP32[addrListBuf + 8 >> 2] = __inet_pton4_raw(DNS.lookup_name(name));
        HEAP32[ret + 16 >> 2] = addrListBuf;
        return ret
      }

      function _gettimeofday(ptr) {
        var now = Date.now();
        HEAP32[ptr >> 2] = now / 1e3 | 0;
        HEAP32[ptr + 4 >> 2] = now % 1e3 * 1e3 | 0;
        return 0
      }

      function _llvm_log10_f32(x) {
        return Math.log(x) / Math.LN10
      }

      function _llvm_log10_f64(a0) {
        return _llvm_log10_f32(a0)
      }

      function _llvm_stackrestore(p) {
        var self = _llvm_stacksave;
        var ret = self.LLVM_SAVEDSTACKS[p];
        self.LLVM_SAVEDSTACKS.splice(p, 1);
        stackRestore(ret)
      }

      function _llvm_stacksave() {
        var self = _llvm_stacksave;
        if (!self.LLVM_SAVEDSTACKS) {
          self.LLVM_SAVEDSTACKS = []
        }
        self.LLVM_SAVEDSTACKS.push(stackSave());
        return self.LLVM_SAVEDSTACKS.length - 1
      }

      function _llvm_trap() {
        abort("trap!")
      }
      var ___tm_current = 2016080;
      var ___tm_timezone = (stringToUTF8("GMT", 2016128, 4), 2016128);

      function _tzset() {
        if (_tzset.called) return;
        _tzset.called = true;
        HEAP32[__get_timezone() >> 2] = (new Date).getTimezoneOffset() * 60;
        var winter = new Date(2e3, 0, 1);
        var summer = new Date(2e3, 6, 1);
        HEAP32[__get_daylight() >> 2] = Number(winter.getTimezoneOffset() != summer.getTimezoneOffset());

        function extractZone(date) {
          var match = date.toTimeString().match(/\(([A-Za-z ]+)\)$/);
          return match ? match[1] : "GMT"
        }
        var winterName = extractZone(winter);
        var summerName = extractZone(summer);
        var winterNamePtr = allocate(intArrayFromString(winterName), "i8", ALLOC_NORMAL);
        var summerNamePtr = allocate(intArrayFromString(summerName), "i8", ALLOC_NORMAL);
        if (summer.getTimezoneOffset() < winter.getTimezoneOffset()) {
          HEAP32[__get_tzname() >> 2] = winterNamePtr;
          HEAP32[__get_tzname() + 4 >> 2] = summerNamePtr
        } else {
          HEAP32[__get_tzname() >> 2] = summerNamePtr;
          HEAP32[__get_tzname() + 4 >> 2] = winterNamePtr
        }
      }

      function _localtime_r(time, tmPtr) {
        _tzset();
        var date = new Date(HEAP32[time >> 2] * 1e3);
        HEAP32[tmPtr >> 2] = date.getSeconds();
        HEAP32[tmPtr + 4 >> 2] = date.getMinutes();
        HEAP32[tmPtr + 8 >> 2] = date.getHours();
        HEAP32[tmPtr + 12 >> 2] = date.getDate();
        HEAP32[tmPtr + 16 >> 2] = date.getMonth();
        HEAP32[tmPtr + 20 >> 2] = date.getFullYear() - 1900;
        HEAP32[tmPtr + 24 >> 2] = date.getDay();
        var start = new Date(date.getFullYear(), 0, 1);
        var yday = (date.getTime() - start.getTime()) / (1e3 * 60 * 60 * 24) | 0;
        HEAP32[tmPtr + 28 >> 2] = yday;
        HEAP32[tmPtr + 36 >> 2] = -(date.getTimezoneOffset() * 60);
        var summerOffset = new Date(2e3, 6, 1).getTimezoneOffset();
        var winterOffset = start.getTimezoneOffset();
        var dst = (summerOffset != winterOffset && date.getTimezoneOffset() == Math.min(winterOffset, summerOffset)) | 0;
        HEAP32[tmPtr + 32 >> 2] = dst;
        var zonePtr = HEAP32[__get_tzname() + (dst ? 4 : 0) >> 2];
        HEAP32[tmPtr + 40 >> 2] = zonePtr;
        return tmPtr
      }

      function _localtime(time) {
        return _localtime_r(time, ___tm_current)
      }

      function _emscripten_memcpy_big(dest, src, num) {
        HEAPU8.set(HEAPU8.subarray(src, src + num), dest)
      }

      function _pthread_attr_init(attr) {
        return 0
      }

      function _pthread_attr_setdetachstate() {}

      function _pthread_cond_wait() {
        return 0
      }

      function _pthread_create() {
        return 11
      }

      function _pthread_join() {}

      function __isLeapYear(year) {
        return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
      }

      function __arraySum(array, index) {
        var sum = 0;
        for (var i = 0; i <= index; sum += array[i++]);
        return sum
      }
      var __MONTH_DAYS_LEAP = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      var __MONTH_DAYS_REGULAR = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

      function __addDays(date, days) {
        var newDate = new Date(date.getTime());
        while (days > 0) {
          var leap = __isLeapYear(newDate.getFullYear());
          var currentMonth = newDate.getMonth();
          var daysInCurrentMonth = (leap ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR)[currentMonth];
          if (days > daysInCurrentMonth - newDate.getDate()) {
            days -= daysInCurrentMonth - newDate.getDate() + 1;
            newDate.setDate(1);
            if (currentMonth < 11) {
              newDate.setMonth(currentMonth + 1)
            } else {
              newDate.setMonth(0);
              newDate.setFullYear(newDate.getFullYear() + 1)
            }
          } else {
            newDate.setDate(newDate.getDate() + days);
            return newDate
          }
        }
        return newDate
      }

      function _strftime(s, maxsize, format, tm) {
        var tm_zone = HEAP32[tm + 40 >> 2];
        var date = {
          tm_sec: HEAP32[tm >> 2],
          tm_min: HEAP32[tm + 4 >> 2],
          tm_hour: HEAP32[tm + 8 >> 2],
          tm_mday: HEAP32[tm + 12 >> 2],
          tm_mon: HEAP32[tm + 16 >> 2],
          tm_year: HEAP32[tm + 20 >> 2],
          tm_wday: HEAP32[tm + 24 >> 2],
          tm_yday: HEAP32[tm + 28 >> 2],
          tm_isdst: HEAP32[tm + 32 >> 2],
          tm_gmtoff: HEAP32[tm + 36 >> 2],
          tm_zone: tm_zone ? UTF8ToString(tm_zone) : ""
        };
        var pattern = UTF8ToString(format);
        var EXPANSION_RULES_1 = {
          "%c": "%a %b %d %H:%M:%S %Y",
          "%D": "%m/%d/%y",
          "%F": "%Y-%m-%d",
          "%h": "%b",
          "%r": "%I:%M:%S %p",
          "%R": "%H:%M",
          "%T": "%H:%M:%S",
          "%x": "%m/%d/%y",
          "%X": "%H:%M:%S"
        };
        for (var rule in EXPANSION_RULES_1) {
          pattern = pattern.replace(new RegExp(rule, "g"), EXPANSION_RULES_1[rule])
        }
        var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

        function leadingSomething(value, digits, character) {
          var str = typeof value === "number" ? value.toString() : value || "";
          while (str.length < digits) {
            str = character[0] + str
          }
          return str
        }

        function leadingNulls(value, digits) {
          return leadingSomething(value, digits, "0")
        }

        function compareByDay(date1, date2) {
          function sgn(value) {
            return value < 0 ? -1 : value > 0 ? 1 : 0
          }
          var compare;
          if ((compare = sgn(date1.getFullYear() - date2.getFullYear())) === 0) {
            if ((compare = sgn(date1.getMonth() - date2.getMonth())) === 0) {
              compare = sgn(date1.getDate() - date2.getDate())
            }
          }
          return compare
        }

        function getFirstWeekStartDate(janFourth) {
          switch (janFourth.getDay()) {
            case 0:
              return new Date(janFourth.getFullYear() - 1, 11, 29);
            case 1:
              return janFourth;
            case 2:
              return new Date(janFourth.getFullYear(), 0, 3);
            case 3:
              return new Date(janFourth.getFullYear(), 0, 2);
            case 4:
              return new Date(janFourth.getFullYear(), 0, 1);
            case 5:
              return new Date(janFourth.getFullYear() - 1, 11, 31);
            case 6:
              return new Date(janFourth.getFullYear() - 1, 11, 30)
          }
        }

        function getWeekBasedYear(date) {
          var thisDate = __addDays(new Date(date.tm_year + 1900, 0, 1), date.tm_yday);
          var janFourthThisYear = new Date(thisDate.getFullYear(), 0, 4);
          var janFourthNextYear = new Date(thisDate.getFullYear() + 1, 0, 4);
          var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
          var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
          if (compareByDay(firstWeekStartThisYear, thisDate) <= 0) {
            if (compareByDay(firstWeekStartNextYear, thisDate) <= 0) {
              return thisDate.getFullYear() + 1
            } else {
              return thisDate.getFullYear()
            }
          } else {
            return thisDate.getFullYear() - 1
          }
        }
        var EXPANSION_RULES_2 = {
          "%a": function (date) {
            return WEEKDAYS[date.tm_wday].substring(0, 3)
          },
          "%A": function (date) {
            return WEEKDAYS[date.tm_wday]
          },
          "%b": function (date) {
            return MONTHS[date.tm_mon].substring(0, 3)
          },
          "%B": function (date) {
            return MONTHS[date.tm_mon]
          },
          "%C": function (date) {
            var year = date.tm_year + 1900;
            return leadingNulls(year / 100 | 0, 2)
          },
          "%d": function (date) {
            return leadingNulls(date.tm_mday, 2)
          },
          "%e": function (date) {
            return leadingSomething(date.tm_mday, 2, " ")
          },
          "%g": function (date) {
            return getWeekBasedYear(date).toString().substring(2)
          },
          "%G": function (date) {
            return getWeekBasedYear(date)
          },
          "%H": function (date) {
            return leadingNulls(date.tm_hour, 2)
          },
          "%I": function (date) {
            var twelveHour = date.tm_hour;
            if (twelveHour == 0) twelveHour = 12;
            else if (twelveHour > 12) twelveHour -= 12;
            return leadingNulls(twelveHour, 2)
          },
          "%j": function (date) {
            return leadingNulls(date.tm_mday + __arraySum(__isLeapYear(date.tm_year + 1900) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, date.tm_mon - 1), 3)
          },
          "%m": function (date) {
            return leadingNulls(date.tm_mon + 1, 2)
          },
          "%M": function (date) {
            return leadingNulls(date.tm_min, 2)
          },
          "%n": function () {
            return "\n"
          },
          "%p": function (date) {
            if (date.tm_hour >= 0 && date.tm_hour < 12) {
              return "AM"
            } else {
              return "PM"
            }
          },
          "%S": function (date) {
            return leadingNulls(date.tm_sec, 2)
          },
          "%t": function () {
            return "\t"
          },
          "%u": function (date) {
            var day = new Date(date.tm_year + 1900, date.tm_mon + 1, date.tm_mday, 0, 0, 0, 0);
            return day.getDay() || 7
          },
          "%U": function (date) {
            var janFirst = new Date(date.tm_year + 1900, 0, 1);
            var firstSunday = janFirst.getDay() === 0 ? janFirst : __addDays(janFirst, 7 - janFirst.getDay());
            var endDate = new Date(date.tm_year + 1900, date.tm_mon, date.tm_mday);
            if (compareByDay(firstSunday, endDate) < 0) {
              var februaryFirstUntilEndMonth = __arraySum(__isLeapYear(endDate.getFullYear()) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, endDate.getMonth() - 1) - 31;
              var firstSundayUntilEndJanuary = 31 - firstSunday.getDate();
              var days = firstSundayUntilEndJanuary + februaryFirstUntilEndMonth + endDate.getDate();
              return leadingNulls(Math.ceil(days / 7), 2)
            }
            return compareByDay(firstSunday, janFirst) === 0 ? "01" : "00"
          },
          "%V": function (date) {
            var janFourthThisYear = new Date(date.tm_year + 1900, 0, 4);
            var janFourthNextYear = new Date(date.tm_year + 1901, 0, 4);
            var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
            var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
            var endDate = __addDays(new Date(date.tm_year + 1900, 0, 1), date.tm_yday);
            if (compareByDay(endDate, firstWeekStartThisYear) < 0) {
              return "53"
            }
            if (compareByDay(firstWeekStartNextYear, endDate) <= 0) {
              return "01"
            }
            var daysDifference;
            if (firstWeekStartThisYear.getFullYear() < date.tm_year + 1900) {
              daysDifference = date.tm_yday + 32 - firstWeekStartThisYear.getDate()
            } else {
              daysDifference = date.tm_yday + 1 - firstWeekStartThisYear.getDate()
            }
            return leadingNulls(Math.ceil(daysDifference / 7), 2)
          },
          "%w": function (date) {
            var day = new Date(date.tm_year + 1900, date.tm_mon + 1, date.tm_mday, 0, 0, 0, 0);
            return day.getDay()
          },
          "%W": function (date) {
            var janFirst = new Date(date.tm_year, 0, 1);
            var firstMonday = janFirst.getDay() === 1 ? janFirst : __addDays(janFirst, janFirst.getDay() === 0 ? 1 : 7 - janFirst.getDay() + 1);
            var endDate = new Date(date.tm_year + 1900, date.tm_mon, date.tm_mday);
            if (compareByDay(firstMonday, endDate) < 0) {
              var februaryFirstUntilEndMonth = __arraySum(__isLeapYear(endDate.getFullYear()) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, endDate.getMonth() - 1) - 31;
              var firstMondayUntilEndJanuary = 31 - firstMonday.getDate();
              var days = firstMondayUntilEndJanuary + februaryFirstUntilEndMonth + endDate.getDate();
              return leadingNulls(Math.ceil(days / 7), 2)
            }
            return compareByDay(firstMonday, janFirst) === 0 ? "01" : "00"
          },
          "%y": function (date) {
            return (date.tm_year + 1900).toString().substring(2)
          },
          "%Y": function (date) {
            return date.tm_year + 1900
          },
          "%z": function (date) {
            var off = date.tm_gmtoff;
            var ahead = off >= 0;
            off = Math.abs(off) / 60;
            off = off / 60 * 100 + off % 60;
            return (ahead ? "+" : "-") + String("0000" + off).slice(-4)
          },
          "%Z": function (date) {
            return date.tm_zone
          },
          "%%": function () {
            return "%"
          }
        };
        for (var rule in EXPANSION_RULES_2) {
          if (pattern.indexOf(rule) >= 0) {
            pattern = pattern.replace(new RegExp(rule, "g"), EXPANSION_RULES_2[rule](date))
          }
        }
        var bytes = intArrayFromString(pattern, false);
        if (bytes.length > maxsize) {
          return 0
        }
        writeArrayToMemory(bytes, s);
        return bytes.length - 1
      }

      function _strftime_l(s, maxsize, format, tm) {
        return _strftime(s, maxsize, format, tm)
      }

      function _time(ptr) {
        var ret = Date.now() / 1e3 | 0;
        if (ptr) {
          HEAP32[ptr >> 2] = ret
        }
        return ret
      }
      FS.staticInit();
      if (ENVIRONMENT_IS_NODE) {
        var fs = require("fs");
        var NODEJS_PATH = require("path");
        NODEFS.staticInit()
      }
      embind_init_charCodes();
      BindingError = Module["BindingError"] = extendError(Error, "BindingError");
      InternalError = Module["InternalError"] = extendError(Error, "InternalError");
      init_ClassHandle();
      init_RegisteredPointer();
      init_embind();
      UnboundTypeError = Module["UnboundTypeError"] = extendError(Error, "UnboundTypeError");
      init_emval();

      function intArrayFromString(stringy, dontAddNull, length) {
        var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
        var u8array = new Array(len);
        var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
        if (dontAddNull) u8array.length = numBytesWritten;
        return u8array
      }

      function nullFunc_i(x) {
        err("Invalid function pointer called with signature 'i'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
        err("Build with ASSERTIONS=2 for more info.");
        abort(x)
      }

      function nullFunc_ii(x) {
        err("Invalid function pointer called with signature 'ii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
        err("Build with ASSERTIONS=2 for more info.");
        abort(x)
      }

      function nullFunc_iii(x) {
        err("Invalid function pointer called with signature 'iii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
        err("Build with ASSERTIONS=2 for more info.");
        abort(x)
      }

      function nullFunc_iiid(x) {
        err("Invalid function pointer called with signature 'iiid'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
        err("Build with ASSERTIONS=2 for more info.");
        abort(x)
      }

      function nullFunc_iiii(x) {
        err("Invalid function pointer called with signature 'iiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
        err("Build with ASSERTIONS=2 for more info.");
        abort(x)
      }

      function nullFunc_iiiii(x) {
        err("Invalid function pointer called with signature 'iiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
        err("Build with ASSERTIONS=2 for more info.");
        abort(x)
      }

      function nullFunc_iiiiid(x) {
        err("Invalid function pointer called with signature 'iiiiid'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
        err("Build with ASSERTIONS=2 for more info.");
        abort(x)
      }

      function nullFunc_iiiiii(x) {
        err("Invalid function pointer called with signature 'iiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
        err("Build with ASSERTIONS=2 for more info.");
        abort(x)
      }

      function nullFunc_iiiiiid(x) {
        err("Invalid function pointer called with signature 'iiiiiid'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
        err("Build with ASSERTIONS=2 for more info.");
        abort(x)
      }

      function nullFunc_iiiiiii(x) {
        err("Invalid function pointer called with signature 'iiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
        err("Build with ASSERTIONS=2 for more info.");
        abort(x)
      }

      function nullFunc_iiiiiiii(x) {
        err("Invalid function pointer called with signature 'iiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
        err("Build with ASSERTIONS=2 for more info.");
        abort(x)
      }

      function nullFunc_iiiiiiiii(x) {
        err("Invalid function pointer called with signature 'iiiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
        err("Build with ASSERTIONS=2 for more info.");
        abort(x)
      }

      function nullFunc_iiiiij(x) {
        err("Invalid function pointer called with signature 'iiiiij'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
        err("Build with ASSERTIONS=2 for more info.");
        abort(x)
      }

      function nullFunc_v(x) {
        err("Invalid function pointer called with signature 'v'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
        err("Build with ASSERTIONS=2 for more info.");
        abort(x)
      }

      function nullFunc_vi(x) {
        err("Invalid function pointer called with signature 'vi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
        err("Build with ASSERTIONS=2 for more info.");
        abort(x)
      }

      function nullFunc_viddd(x) {
        err("Invalid function pointer called with signature 'viddd'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
        err("Build with ASSERTIONS=2 for more info.");
        abort(x)
      }

      function nullFunc_vidddd(x) {
        err("Invalid function pointer called with signature 'vidddd'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
        err("Build with ASSERTIONS=2 for more info.");
        abort(x)
      }

      function nullFunc_viddddii(x) {
        err("Invalid function pointer called with signature 'viddddii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
        err("Build with ASSERTIONS=2 for more info.");
        abort(x)
      }

      function nullFunc_viddddiii(x) {
        err("Invalid function pointer called with signature 'viddddiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
        err("Build with ASSERTIONS=2 for more info.");
        abort(x)
      }

      function nullFunc_vidddi(x) {
        err("Invalid function pointer called with signature 'vidddi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
        err("Build with ASSERTIONS=2 for more info.");
        abort(x)
      }

      function nullFunc_viddi(x) {
        err("Invalid function pointer called with signature 'viddi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
        err("Build with ASSERTIONS=2 for more info.");
        abort(x)
      }

      function nullFunc_viddii(x) {
        err("Invalid function pointer called with signature 'viddii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
        err("Build with ASSERTIONS=2 for more info.");
        abort(x)
      }

      function nullFunc_vidiii(x) {
        err("Invalid function pointer called with signature 'vidiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
        err("Build with ASSERTIONS=2 for more info.");
        abort(x)
      }

      function nullFunc_vii(x) {
        err("Invalid function pointer called with signature 'vii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
        err("Build with ASSERTIONS=2 for more info.");
        abort(x)
      }

      function nullFunc_viii(x) {
        err("Invalid function pointer called with signature 'viii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
        err("Build with ASSERTIONS=2 for more info.");
        abort(x)
      }

      function nullFunc_viiiff(x) {
        err("Invalid function pointer called with signature 'viiiff'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
        err("Build with ASSERTIONS=2 for more info.");
        abort(x)
      }

      function nullFunc_viiiffff(x) {
        err("Invalid function pointer called with signature 'viiiffff'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
        err("Build with ASSERTIONS=2 for more info.");
        abort(x)
      }

      function nullFunc_viiii(x) {
        err("Invalid function pointer called with signature 'viiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
        err("Build with ASSERTIONS=2 for more info.");
        abort(x)
      }

      function nullFunc_viiiiddd(x) {
        err("Invalid function pointer called with signature 'viiiiddd'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
        err("Build with ASSERTIONS=2 for more info.");
        abort(x)
      }

      function nullFunc_viiiii(x) {
        err("Invalid function pointer called with signature 'viiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
        err("Build with ASSERTIONS=2 for more info.");
        abort(x)
      }

      function nullFunc_viiiiii(x) {
        err("Invalid function pointer called with signature 'viiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
        err("Build with ASSERTIONS=2 for more info.");
        abort(x)
      }

      function nullFunc_viijii(x) {
        err("Invalid function pointer called with signature 'viijii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
        err("Build with ASSERTIONS=2 for more info.");
        abort(x)
      }
      var asmGlobalArg = {};
      var asmLibraryArg = {
        "b": abortStackOverflow,
        "Xa": nullFunc_i,
        "Ka": nullFunc_ii,
        "za": nullFunc_iii,
        "ra": nullFunc_iiid,
        "ka": nullFunc_iiii,
        "ea": nullFunc_iiiii,
        "aa": nullFunc_iiiiid,
        "V": nullFunc_iiiiii,
        "P": nullFunc_iiiiiid,
        "Wa": nullFunc_iiiiiii,
        "Ta": nullFunc_iiiiiiii,
        "Sa": nullFunc_iiiiiiiii,
        "Ra": nullFunc_iiiiij,
        "Qa": nullFunc_v,
        "Pa": nullFunc_vi,
        "Oa": nullFunc_viddd,
        "Na": nullFunc_vidddd,
        "Ma": nullFunc_viddddii,
        "La": nullFunc_viddddiii,
        "Ja": nullFunc_vidddi,
        "Ia": nullFunc_viddi,
        "Ha": nullFunc_viddii,
        "Ga": nullFunc_vidiii,
        "Fa": nullFunc_vii,
        "Ea": nullFunc_viii,
        "Da": nullFunc_viiiff,
        "Ca": nullFunc_viiiffff,
        "Ba": nullFunc_viiii,
        "Aa": nullFunc_viiiiddd,
        "ya": nullFunc_viiiii,
        "xa": nullFunc_viiiiii,
        "wa": nullFunc_viijii,
        "va": ___buildEnvironment,
        "e": ___cxa_allocate_exception,
        "ua": ___cxa_pure_virtual,
        "d": ___cxa_throw,
        "ta": ___cxa_uncaught_exception,
        "x": ___lock,
        "sa": ___map_file,
        "H": ___setErrNo,
        "w": ___syscall102,
        "qa": ___syscall12,
        "pa": ___syscall140,
        "oa": ___syscall142,
        "na": ___syscall145,
        "G": ___syscall146,
        "ma": ___syscall183,
        "F": ___syscall195,
        "la": ___syscall197,
        "q": ___syscall221,
        "ja": ___syscall3,
        "ia": ___syscall39,
        "ha": ___syscall4,
        "E": ___syscall5,
        "v": ___syscall54,
        "p": ___syscall6,
        "ga": ___syscall85,
        "fa": ___syscall91,
        "o": ___unlock,
        "da": __embind_register_bool,
        "s": __embind_register_class,
        "n": __embind_register_class_class_function,
        "r": __embind_register_class_constructor,
        "h": __embind_register_class_function,
        "ca": __embind_register_emval,
        "D": __embind_register_float,
        "ba": __embind_register_function,
        "j": __embind_register_integer,
        "g": __embind_register_memory_view,
        "C": __embind_register_std_string,
        "$": __embind_register_std_wstring,
        "_": __embind_register_void,
        "Z": __emval_decref,
        "Y": __emval_incref,
        "X": __emval_take_value,
        "c": _abort,
        "W": _createJSDSPInstance,
        "B": _emscripten_asm_const_ii,
        "m": _emscripten_asm_const_iii,
        "u": _emscripten_asm_const_iiii,
        "U": _emscripten_asm_const_iiiiii,
        "T": _emscripten_get_heap_size,
        "S": _emscripten_memcpy_big,
        "R": _emscripten_resize_heap,
        "f": _exit,
        "i": _getenv,
        "Q": _gethostbyname,
        "A": _gettimeofday,
        "t": _llvm_log10_f64,
        "l": _llvm_stackrestore,
        "k": _llvm_stacksave,
        "O": _llvm_trap,
        "z": _localtime,
        "N": _pthread_attr_init,
        "M": _pthread_attr_setdetachstate,
        "L": _pthread_cond_wait,
        "K": _pthread_create,
        "J": _pthread_join,
        "y": _strftime,
        "Va": _strftime_l,
        "I": _time,
        "Ua": abortOnCannotGrowMemory,
        "a": DYNAMICTOP_PTR
      };
      var asm = Module["asm"](asmGlobalArg, asmLibraryArg, buffer);
      var real___ZSt18uncaught_exceptionv = asm["Ya"];
      asm["Ya"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real___ZSt18uncaught_exceptionv.apply(null, arguments)
      };
      var real____cxa_can_catch = asm["Za"];
      asm["Za"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real____cxa_can_catch.apply(null, arguments)
      };
      var real____cxa_is_pointer_type = asm["_a"];
      asm["_a"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real____cxa_is_pointer_type.apply(null, arguments)
      };
      var real____em_js__createJSDSPInstance = asm["$a"];
      asm["$a"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real____em_js__createJSDSPInstance.apply(null, arguments)
      };
      var real____em_js__createJSModuleFromString = asm["ab"];
      asm["ab"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real____em_js__createJSModuleFromString.apply(null, arguments)
      };
      var real____errno_location = asm["bb"];
      asm["bb"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real____errno_location.apply(null, arguments)
      };
      var real____getTypeName = asm["cb"];
      asm["cb"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real____getTypeName.apply(null, arguments)
      };
      var real___get_daylight = asm["db"];
      asm["db"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real___get_daylight.apply(null, arguments)
      };
      var real___get_environ = asm["eb"];
      asm["eb"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real___get_environ.apply(null, arguments)
      };
      var real___get_timezone = asm["fb"];
      asm["fb"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real___get_timezone.apply(null, arguments)
      };
      var real___get_tzname = asm["gb"];
      asm["gb"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real___get_tzname.apply(null, arguments)
      };
      var real__cleanupAfterException = asm["hb"];
      asm["hb"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real__cleanupAfterException.apply(null, arguments)
      };
      var real__createWasmCDSPFactoryFromString = asm["ib"];
      asm["ib"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real__createWasmCDSPFactoryFromString.apply(null, arguments)
      };
      var real__deleteAllWasmCDSPFactories = asm["jb"];
      asm["jb"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real__deleteAllWasmCDSPFactories.apply(null, arguments)
      };
      var real__expandCDSPFromString = asm["kb"];
      asm["kb"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real__expandCDSPFromString.apply(null, arguments)
      };
      var real__fflush = asm["lb"];
      asm["lb"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real__fflush.apply(null, arguments)
      };
      var real__free = asm["mb"];
      asm["mb"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real__free.apply(null, arguments)
      };
      var real__freeCMemory = asm["nb"];
      asm["nb"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real__freeCMemory.apply(null, arguments)
      };
      var real__freeWasmCModule = asm["ob"];
      asm["ob"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real__freeWasmCModule.apply(null, arguments)
      };
      var real__getCLibFaustVersion = asm["pb"];
      asm["pb"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real__getCLibFaustVersion.apply(null, arguments)
      };
      var real__getErrorAfterException = asm["qb"];
      asm["qb"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real__getErrorAfterException.apply(null, arguments)
      };
      var real__getWasmCHelpers = asm["rb"];
      asm["rb"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real__getWasmCHelpers.apply(null, arguments)
      };
      var real__getWasmCModule = asm["sb"];
      asm["sb"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real__getWasmCModule.apply(null, arguments)
      };
      var real__getWasmCModuleSize = asm["tb"];
      asm["tb"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real__getWasmCModuleSize.apply(null, arguments)
      };
      var real__htonl = asm["ub"];
      asm["ub"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real__htonl.apply(null, arguments)
      };
      var real__htons = asm["vb"];
      asm["vb"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real__htons.apply(null, arguments)
      };
      var real__llvm_bswap_i16 = asm["wb"];
      asm["wb"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real__llvm_bswap_i16.apply(null, arguments)
      };
      var real__llvm_bswap_i32 = asm["xb"];
      asm["xb"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real__llvm_bswap_i32.apply(null, arguments)
      };
      var real__llvm_rint_f64 = asm["yb"];
      asm["yb"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real__llvm_rint_f64.apply(null, arguments)
      };
      var real__malloc = asm["zb"];
      asm["zb"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real__malloc.apply(null, arguments)
      };
      var real__memmove = asm["Ab"];
      asm["Ab"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real__memmove.apply(null, arguments)
      };
      var real__ntohs = asm["Bb"];
      asm["Bb"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real__ntohs.apply(null, arguments)
      };
      var real__pthread_cond_broadcast = asm["Cb"];
      asm["Cb"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real__pthread_cond_broadcast.apply(null, arguments)
      };
      var real__sbrk = asm["Db"];
      asm["Db"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real__sbrk.apply(null, arguments)
      };
      var real_establishStackSpace = asm["ic"];
      asm["ic"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real_establishStackSpace.apply(null, arguments)
      };
      var real_globalCtors = asm["jc"];
      asm["jc"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real_globalCtors.apply(null, arguments)
      };
      var real_stackAlloc = asm["kc"];
      asm["kc"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real_stackAlloc.apply(null, arguments)
      };
      var real_stackRestore = asm["lc"];
      asm["lc"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real_stackRestore.apply(null, arguments)
      };
      var real_stackSave = asm["mc"];
      asm["mc"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return real_stackSave.apply(null, arguments)
      };
      Module["asm"] = asm;
      var __ZSt18uncaught_exceptionv = Module["__ZSt18uncaught_exceptionv"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["Ya"].apply(null, arguments)
      };
      var ___cxa_can_catch = Module["___cxa_can_catch"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["Za"].apply(null, arguments)
      };
      var ___cxa_is_pointer_type = Module["___cxa_is_pointer_type"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["_a"].apply(null, arguments)
      };
      var ___em_js__createJSDSPInstance = Module["___em_js__createJSDSPInstance"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["$a"].apply(null, arguments)
      };
      var ___em_js__createJSModuleFromString = Module["___em_js__createJSModuleFromString"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["ab"].apply(null, arguments)
      };
      var ___errno_location = Module["___errno_location"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["bb"].apply(null, arguments)
      };
      var ___getTypeName = Module["___getTypeName"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["cb"].apply(null, arguments)
      };
      var __get_daylight = Module["__get_daylight"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["db"].apply(null, arguments)
      };
      var __get_environ = Module["__get_environ"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["eb"].apply(null, arguments)
      };
      var __get_timezone = Module["__get_timezone"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["fb"].apply(null, arguments)
      };
      var __get_tzname = Module["__get_tzname"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["gb"].apply(null, arguments)
      };
      var _cleanupAfterException = Module["_cleanupAfterException"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["hb"].apply(null, arguments)
      };
      var _createWasmCDSPFactoryFromString = Module["_createWasmCDSPFactoryFromString"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["ib"].apply(null, arguments)
      };
      var _deleteAllWasmCDSPFactories = Module["_deleteAllWasmCDSPFactories"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["jb"].apply(null, arguments)
      };
      var _expandCDSPFromString = Module["_expandCDSPFromString"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["kb"].apply(null, arguments)
      };
      var _fflush = Module["_fflush"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["lb"].apply(null, arguments)
      };
      var _free = Module["_free"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["mb"].apply(null, arguments)
      };
      var _freeCMemory = Module["_freeCMemory"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["nb"].apply(null, arguments)
      };
      var _freeWasmCModule = Module["_freeWasmCModule"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["ob"].apply(null, arguments)
      };
      var _getCLibFaustVersion = Module["_getCLibFaustVersion"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["pb"].apply(null, arguments)
      };
      var _getErrorAfterException = Module["_getErrorAfterException"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["qb"].apply(null, arguments)
      };
      var _getWasmCHelpers = Module["_getWasmCHelpers"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["rb"].apply(null, arguments)
      };
      var _getWasmCModule = Module["_getWasmCModule"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["sb"].apply(null, arguments)
      };
      var _getWasmCModuleSize = Module["_getWasmCModuleSize"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["tb"].apply(null, arguments)
      };
      var _htonl = Module["_htonl"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["ub"].apply(null, arguments)
      };
      var _htons = Module["_htons"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["vb"].apply(null, arguments)
      };
      var _llvm_bswap_i16 = Module["_llvm_bswap_i16"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["wb"].apply(null, arguments)
      };
      var _llvm_bswap_i32 = Module["_llvm_bswap_i32"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["xb"].apply(null, arguments)
      };
      var _llvm_rint_f64 = Module["_llvm_rint_f64"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["yb"].apply(null, arguments)
      };
      var _malloc = Module["_malloc"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["zb"].apply(null, arguments)
      };
      var _memmove = Module["_memmove"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["Ab"].apply(null, arguments)
      };
      var _ntohs = Module["_ntohs"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["Bb"].apply(null, arguments)
      };
      var _pthread_cond_broadcast = Module["_pthread_cond_broadcast"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["Cb"].apply(null, arguments)
      };
      var _sbrk = Module["_sbrk"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["Db"].apply(null, arguments)
      };
      var establishStackSpace = Module["establishStackSpace"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["ic"].apply(null, arguments)
      };
      var globalCtors = Module["globalCtors"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["jc"].apply(null, arguments)
      };
      var stackAlloc = Module["stackAlloc"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["kc"].apply(null, arguments)
      };
      var stackRestore = Module["stackRestore"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["lc"].apply(null, arguments)
      };
      var stackSave = Module["stackSave"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["mc"].apply(null, arguments)
      };
      var dynCall_i = Module["dynCall_i"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["Eb"].apply(null, arguments)
      };
      var dynCall_ii = Module["dynCall_ii"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["Fb"].apply(null, arguments)
      };
      var dynCall_iii = Module["dynCall_iii"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["Gb"].apply(null, arguments)
      };
      var dynCall_iiid = Module["dynCall_iiid"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["Hb"].apply(null, arguments)
      };
      var dynCall_iiii = Module["dynCall_iiii"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["Ib"].apply(null, arguments)
      };
      var dynCall_iiiii = Module["dynCall_iiiii"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["Jb"].apply(null, arguments)
      };
      var dynCall_iiiiid = Module["dynCall_iiiiid"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["Kb"].apply(null, arguments)
      };
      var dynCall_iiiiii = Module["dynCall_iiiiii"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["Lb"].apply(null, arguments)
      };
      var dynCall_iiiiiid = Module["dynCall_iiiiiid"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["Mb"].apply(null, arguments)
      };
      var dynCall_iiiiiii = Module["dynCall_iiiiiii"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["Nb"].apply(null, arguments)
      };
      var dynCall_iiiiiiii = Module["dynCall_iiiiiiii"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["Ob"].apply(null, arguments)
      };
      var dynCall_iiiiiiiii = Module["dynCall_iiiiiiiii"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["Pb"].apply(null, arguments)
      };
      var dynCall_iiiiij = Module["dynCall_iiiiij"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["Qb"].apply(null, arguments)
      };
      var dynCall_v = Module["dynCall_v"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["Rb"].apply(null, arguments)
      };
      var dynCall_vi = Module["dynCall_vi"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["Sb"].apply(null, arguments)
      };
      var dynCall_viddd = Module["dynCall_viddd"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["Tb"].apply(null, arguments)
      };
      var dynCall_vidddd = Module["dynCall_vidddd"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["Ub"].apply(null, arguments)
      };
      var dynCall_viddddii = Module["dynCall_viddddii"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["Vb"].apply(null, arguments)
      };
      var dynCall_viddddiii = Module["dynCall_viddddiii"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["Wb"].apply(null, arguments)
      };
      var dynCall_vidddi = Module["dynCall_vidddi"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["Xb"].apply(null, arguments)
      };
      var dynCall_viddi = Module["dynCall_viddi"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["Yb"].apply(null, arguments)
      };
      var dynCall_viddii = Module["dynCall_viddii"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["Zb"].apply(null, arguments)
      };
      var dynCall_vidiii = Module["dynCall_vidiii"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["_b"].apply(null, arguments)
      };
      var dynCall_vii = Module["dynCall_vii"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["$b"].apply(null, arguments)
      };
      var dynCall_viii = Module["dynCall_viii"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["ac"].apply(null, arguments)
      };
      var dynCall_viiiff = Module["dynCall_viiiff"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["bc"].apply(null, arguments)
      };
      var dynCall_viiiffff = Module["dynCall_viiiffff"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["cc"].apply(null, arguments)
      };
      var dynCall_viiii = Module["dynCall_viiii"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["dc"].apply(null, arguments)
      };
      var dynCall_viiiiddd = Module["dynCall_viiiiddd"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["ec"].apply(null, arguments)
      };
      var dynCall_viiiii = Module["dynCall_viiiii"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["fc"].apply(null, arguments)
      };
      var dynCall_viiiiii = Module["dynCall_viiiiii"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["gc"].apply(null, arguments)
      };
      var dynCall_viijii = Module["dynCall_viijii"] = function () {
        assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
        assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
        return Module["asm"]["hc"].apply(null, arguments)
      };
      Module["asm"] = asm;
      if (!Module["intArrayFromString"]) Module["intArrayFromString"] = function () {
        abort("'intArrayFromString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["intArrayToString"]) Module["intArrayToString"] = function () {
        abort("'intArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["ccall"]) Module["ccall"] = function () {
        abort("'ccall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      Module["cwrap"] = cwrap;
      if (!Module["setValue"]) Module["setValue"] = function () {
        abort("'setValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["getValue"]) Module["getValue"] = function () {
        abort("'getValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["allocate"]) Module["allocate"] = function () {
        abort("'allocate' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["getMemory"]) Module["getMemory"] = function () {
        abort("'getMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you")
      };
      if (!Module["AsciiToString"]) Module["AsciiToString"] = function () {
        abort("'AsciiToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["stringToAscii"]) Module["stringToAscii"] = function () {
        abort("'stringToAscii' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["UTF8ArrayToString"]) Module["UTF8ArrayToString"] = function () {
        abort("'UTF8ArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      Module["UTF8ToString"] = UTF8ToString;
      if (!Module["stringToUTF8Array"]) Module["stringToUTF8Array"] = function () {
        abort("'stringToUTF8Array' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      Module["stringToUTF8"] = stringToUTF8;
      if (!Module["lengthBytesUTF8"]) Module["lengthBytesUTF8"] = function () {
        abort("'lengthBytesUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["UTF16ToString"]) Module["UTF16ToString"] = function () {
        abort("'UTF16ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["stringToUTF16"]) Module["stringToUTF16"] = function () {
        abort("'stringToUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["lengthBytesUTF16"]) Module["lengthBytesUTF16"] = function () {
        abort("'lengthBytesUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["UTF32ToString"]) Module["UTF32ToString"] = function () {
        abort("'UTF32ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["stringToUTF32"]) Module["stringToUTF32"] = function () {
        abort("'stringToUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["lengthBytesUTF32"]) Module["lengthBytesUTF32"] = function () {
        abort("'lengthBytesUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["allocateUTF8"]) Module["allocateUTF8"] = function () {
        abort("'allocateUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["stackTrace"]) Module["stackTrace"] = function () {
        abort("'stackTrace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["addOnPreRun"]) Module["addOnPreRun"] = function () {
        abort("'addOnPreRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["addOnInit"]) Module["addOnInit"] = function () {
        abort("'addOnInit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["addOnPreMain"]) Module["addOnPreMain"] = function () {
        abort("'addOnPreMain' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["addOnExit"]) Module["addOnExit"] = function () {
        abort("'addOnExit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["addOnPostRun"]) Module["addOnPostRun"] = function () {
        abort("'addOnPostRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["writeStringToMemory"]) Module["writeStringToMemory"] = function () {
        abort("'writeStringToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["writeArrayToMemory"]) Module["writeArrayToMemory"] = function () {
        abort("'writeArrayToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["writeAsciiToMemory"]) Module["writeAsciiToMemory"] = function () {
        abort("'writeAsciiToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["addRunDependency"]) Module["addRunDependency"] = function () {
        abort("'addRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you")
      };
      if (!Module["removeRunDependency"]) Module["removeRunDependency"] = function () {
        abort("'removeRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you")
      };
      if (!Module["ENV"]) Module["ENV"] = function () {
        abort("'ENV' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["FS"]) Module["FS"] = function () {
        abort("'FS' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["FS_createFolder"]) Module["FS_createFolder"] = function () {
        abort("'FS_createFolder' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you")
      };
      if (!Module["FS_createPath"]) Module["FS_createPath"] = function () {
        abort("'FS_createPath' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you")
      };
      if (!Module["FS_createDataFile"]) Module["FS_createDataFile"] = function () {
        abort("'FS_createDataFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you")
      };
      if (!Module["FS_createPreloadedFile"]) Module["FS_createPreloadedFile"] = function () {
        abort("'FS_createPreloadedFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you")
      };
      if (!Module["FS_createLazyFile"]) Module["FS_createLazyFile"] = function () {
        abort("'FS_createLazyFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you")
      };
      if (!Module["FS_createLink"]) Module["FS_createLink"] = function () {
        abort("'FS_createLink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you")
      };
      if (!Module["FS_createDevice"]) Module["FS_createDevice"] = function () {
        abort("'FS_createDevice' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you")
      };
      if (!Module["FS_unlink"]) Module["FS_unlink"] = function () {
        abort("'FS_unlink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you")
      };
      if (!Module["GL"]) Module["GL"] = function () {
        abort("'GL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["dynamicAlloc"]) Module["dynamicAlloc"] = function () {
        abort("'dynamicAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["warnOnce"]) Module["warnOnce"] = function () {
        abort("'warnOnce' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["loadDynamicLibrary"]) Module["loadDynamicLibrary"] = function () {
        abort("'loadDynamicLibrary' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["loadWebAssemblyModule"]) Module["loadWebAssemblyModule"] = function () {
        abort("'loadWebAssemblyModule' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["getLEB"]) Module["getLEB"] = function () {
        abort("'getLEB' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["getFunctionTables"]) Module["getFunctionTables"] = function () {
        abort("'getFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["alignFunctionTables"]) Module["alignFunctionTables"] = function () {
        abort("'alignFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["registerFunctions"]) Module["registerFunctions"] = function () {
        abort("'registerFunctions' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["addFunction"]) Module["addFunction"] = function () {
        abort("'addFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["removeFunction"]) Module["removeFunction"] = function () {
        abort("'removeFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["getFuncWrapper"]) Module["getFuncWrapper"] = function () {
        abort("'getFuncWrapper' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["prettyPrint"]) Module["prettyPrint"] = function () {
        abort("'prettyPrint' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["makeBigInt"]) Module["makeBigInt"] = function () {
        abort("'makeBigInt' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["dynCall"]) Module["dynCall"] = function () {
        abort("'dynCall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["getCompilerSetting"]) Module["getCompilerSetting"] = function () {
        abort("'getCompilerSetting' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["stackSave"]) Module["stackSave"] = function () {
        abort("'stackSave' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["stackRestore"]) Module["stackRestore"] = function () {
        abort("'stackRestore' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["stackAlloc"]) Module["stackAlloc"] = function () {
        abort("'stackAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["establishStackSpace"]) Module["establishStackSpace"] = function () {
        abort("'establishStackSpace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["print"]) Module["print"] = function () {
        abort("'print' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["printErr"]) Module["printErr"] = function () {
        abort("'printErr' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["getTempRet0"]) Module["getTempRet0"] = function () {
        abort("'getTempRet0' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["setTempRet0"]) Module["setTempRet0"] = function () {
        abort("'setTempRet0' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["Pointer_stringify"]) Module["Pointer_stringify"] = function () {
        abort("'Pointer_stringify' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["writeStackCookie"]) Module["writeStackCookie"] = function () {
        abort("'writeStackCookie' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["checkStackCookie"]) Module["checkStackCookie"] = function () {
        abort("'checkStackCookie' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["abortStackOverflow"]) Module["abortStackOverflow"] = function () {
        abort("'abortStackOverflow' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
      };
      if (!Module["ALLOC_NORMAL"]) Object.defineProperty(Module, "ALLOC_NORMAL", {
        get: function () {
          abort("'ALLOC_NORMAL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
        }
      });
      if (!Module["ALLOC_STACK"]) Object.defineProperty(Module, "ALLOC_STACK", {
        get: function () {
          abort("'ALLOC_STACK' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
        }
      });
      if (!Module["ALLOC_DYNAMIC"]) Object.defineProperty(Module, "ALLOC_DYNAMIC", {
        get: function () {
          abort("'ALLOC_DYNAMIC' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
        }
      });
      if (!Module["ALLOC_NONE"]) Object.defineProperty(Module, "ALLOC_NONE", {
        get: function () {
          abort("'ALLOC_NONE' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)")
        }
      });
      Module["then"] = function (func) {
        if (Module["calledRun"]) {
          func(Module)
        } else {
          var old = Module["onRuntimeInitialized"];
          Module["onRuntimeInitialized"] = function () {
            if (old) old();
            func(Module)
          }
        }
        return Module
      };

      function ExitStatus(status) {
        this.name = "ExitStatus";
        this.message = "Program terminated with exit(" + status + ")";
        this.status = status
      }
      ExitStatus.prototype = new Error;
      ExitStatus.prototype.constructor = ExitStatus;
      dependenciesFulfilled = function runCaller() {
        if (!Module["calledRun"]) run();
        if (!Module["calledRun"]) dependenciesFulfilled = runCaller
      };

      function run(args) {
        args = args || Module["arguments"];
        if (runDependencies > 0) {
          return
        }
        writeStackCookie();
        preRun();
        if (runDependencies > 0) return;
        if (Module["calledRun"]) return;

        function doRun() {
          if (Module["calledRun"]) return;
          Module["calledRun"] = true;
          if (ABORT) return;
          ensureInitRuntime();
          preMain();
          if (Module["onRuntimeInitialized"]) Module["onRuntimeInitialized"]();
          assert(!Module["_main"], 'compiled without a main, but one is present. if you added it from JS, use Module["onRuntimeInitialized"]');
          postRun()
        }
        if (Module["setStatus"]) {
          Module["setStatus"]("Running...");
          setTimeout(function () {
            setTimeout(function () {
              Module["setStatus"]("")
            }, 1);
            doRun()
          }, 1)
        } else {
          doRun()
        }
        checkStackCookie()
      }
      Module["run"] = run;

      function checkUnflushedContent() {
        var print = out;
        var printErr = err;
        var has = false;
        out = err = function (x) {
          has = true
        };
        try {
          var flush = Module["_fflush"];
          if (flush) flush(0);
          var hasFS = true;
          if (hasFS) {
            ["stdout", "stderr"].forEach(function (name) {
              var info = FS.analyzePath("/dev/" + name);
              if (!info) return;
              var stream = info.object;
              var rdev = stream.rdev;
              var tty = TTY.ttys[rdev];
              if (tty && tty.output && tty.output.length) {
                has = true
              }
            })
          }
        } catch (e) {}
        out = print;
        err = printErr;
        if (has) {
          warnOnce("stdio streams had content in them that was not flushed. you should set EXIT_RUNTIME to 1 (see the FAQ), or make sure to emit a newline when you printf etc.")
        }
      }

      function exit(status, implicit) {
        checkUnflushedContent();
        if (implicit && Module["noExitRuntime"] && status === 0) {
          return
        }
        if (Module["noExitRuntime"]) {
          if (!implicit) {
            err("exit(" + status + ") called, but EXIT_RUNTIME is not set, so halting execution but not exiting the runtime or preventing further async execution (build with EXIT_RUNTIME=1, if you want a true shutdown)")
          }
        } else {
          ABORT = true;
          EXITSTATUS = status;
          exitRuntime();
          if (Module["onExit"]) Module["onExit"](status)
        }
        Module["quit"](status, new ExitStatus(status))
      }
      var abortDecorators = [];

      function abort(what) {
        if (Module["onAbort"]) {
          Module["onAbort"](what)
        }
        if (what !== undefined) {
          out(what);
          err(what);
          what = JSON.stringify(what)
        } else {
          what = ""
        }
        ABORT = true;
        EXITSTATUS = 1;
        var extra = "";
        var output = "abort(" + what + ") at " + stackTrace() + extra;
        if (abortDecorators) {
          abortDecorators.forEach(function (decorator) {
            output = decorator(output, what)
          })
        }
        throw output
      }
      Module["abort"] = abort;
      if (Module["preInit"]) {
        if (typeof Module["preInit"] == "function") Module["preInit"] = [Module["preInit"]];
        while (Module["preInit"].length > 0) {
          Module["preInit"].pop()()
        }
      }
      Module["noExitRuntime"] = true;
      run();


      return FaustModule
    }
  );
})();
if (typeof exports === 'object' && typeof module === 'object')
  module.exports = FaustModule;
else if (typeof define === 'function' && define['amd'])
  define([], function () {
    return FaustModule;
  });
else if (typeof exports === 'object')
  exports["FaustModule"] = FaustModule;