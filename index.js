const FaustModule = require("./src/libfaust-wasm-min.js");
class LibFaustLoader {
    static load(url) { // Don't convert to async
        return fetch(url || "https://faust.grame.fr/tools/editor/scripts/libfaust-wasm.wasm")
        .then(response => response.arrayBuffer())
        .then((buffer) => {
            const libFaust = FaustModule({ wasmBinary: buffer });
            libFaust.then = (f) => { // Workaround of issue https://github.com/emscripten-core/emscripten/issues/5820
                f(libFaust);
                delete libFaust.then;
                return Promise.resolve(libFaust);
            };
            libFaust.lengthBytesUTF8 = (str) => {
                let len = 0;
                for (let i = 0; i < str.length; ++i) {
                    let u = str.charCodeAt(i);
                    if (u >= 55296 && u <= 57343) u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023;
                    if (u <= 127) ++len;
                    else if (u <= 2047) len += 2;
                    else if (u <= 65535) len += 3;
                    else if (u <= 2097151) len += 4;
                    else if (u <= 67108863) len += 5;
                    else len += 6;
                }
                return len;
            };
            return libFaust;
        });
    }
}
module.exports = { FaustModule, LibFaustLoader };