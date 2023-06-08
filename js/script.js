// noinspection JSUnusedGlobalSymbols

const container = document.querySelector(".container");
const cursor = document.querySelector(".cursor");
const title = document.querySelector(".title");

const worker = new Worker("./js/worker.js");
let capsLock = false;
/*** @type {Object<any, any>} */
let keys = {};
let _id = 0;
let cd = [];
let username = "usr";
let history = [""];
let historyIndex = 1;
let flickerTimeout = null;
const cmdVariables = {};
const processes = {};

const ErrorStyle = {color: "#f87171"};
const SuccessStyle = {color: "#6ee7b7"};
const InfoStyle = {color: "#fde047"};

const hasProcess = () => Object.keys(processes).length;

const Path = {
    allowedCharacters: [..."abcçdefgğhıijklmnoöprstuüvyzqwxABCÇDEFGĞHIİJKLMNOÖPRSTUÜVYZQWX0123456789.-_"],
    // noEmpty
    parse: str => {
        if (!str) return [...cd];
        if (str.endsWith("/")) str = str.substring(0, str.length - 1);
        let p = [...cd];
        const spl = str.split("/");
        for (let i = 0; i < spl.length; i++) {
            const s = spl[i];
            if (s === ".") continue;
            else if (s === "") p = [];
            else if (s === "..") p.pop();
            else p.push(s);
        }
        return p;
    },
    join: (...str) => Path.parse(str.filter(i => i).join("/")),
    stringify: path => "~" + (path.length ? "/" : "") + path.join("/"),
    isValid: path => {
        for (let i = 0; i < path.length; i++) {
            if (!path[i]) return false;
            for (let j = 0; j < path[i].length; j++) {
                if (!Path.allowedObject[path[i][j]]) return false;
            }
        }
        return true;
    }
};
Path.allowedObject = {};
Path.allowedCharacters.forEach(i => Path.allowedObject[i] = true);
const fs = {
    internal: {
        fetch: () => JSON.parse(localStorage.getItem("TERMINAL-FS-" + username) || "{}"),
        save: json => localStorage.setItem("TERMINAL-FS-" + username, JSON.stringify(json)),

        read: path => {
            let json = fs.internal.fetch();
            if (!path.length) return [json, json, json];
            let current = json;
            let ls;
            for (let i = 0; i < path.length - 1; i++) {
                ls = current;
                current = ls[path[i]];
                if (typeof current === "undefined") ls[path[i]] = current = {};
                if (typeof current === "string") return false;
            }
            return [current[path[path.length - 1]], current, json];
        },
        write: (path, content) => {
            if (!path.length) return fs.internal.save(content);
            const read = fs.internal.read(path);
            if (!read) return false;
            fs.internal.writeStream(read, path, content);
            return true;
        },
        remove: path => {
            if (!path.length) return false; // can't remove root
            const read = fs.internal.read(path);
            if (!read) return false;
            fs.internal.removeStream(read);
            return true;
        },
        writeStream: (st, path, content) => {
            st[1][path[path.length - 1]] = content;
            fs.internal.save(st[2]);
        },
        removeStream: (st, path) => {
            delete st[1][path[path.length - 1]];
            fs.internal.save(st[2]);
        }
    },
    read: file => fs.internal.read(Path.parse(file))[0],
    write: (file, content) => fs.internal.write(Path.parse(file), content),
    remove: file => fs.internal.remove(Path.parse(file)),

    /*internal: {
        DOES_NOT_EXIST: {value: "does-not-exist", isErr: true},
        NO_RECURSIVE: {value: "no-recursive", isErr: true},
        INVALID: {value: "invalid", isErr: true},
        CAN_NOT_WRITE_F: {value: "invalid", isErr: true},

        // File meta: type;lastEditDate;creationDate
        // Meta types: 0 = File, 1 = Directory
        // Example file meta: 0;1685879784826;1685879784826
        META_LENGTH: 3,

        read: path => {
            const meta = (localStorage.getItem("TERMINAL-FS-META-" + path.join("/")) || "").split(";");
            if (!meta.length) return false;
            if (meta.length !== fs.internal.META_LENGTH) throw "Invalid meta";
            const content = localStorage.getItem("TERMINAL-FS-CONTENT-" + path.join("/"));
            if (meta[0] === "0") return {isDir: false, content: content || "", meta};
            return {isDir: true, content: content.split(","), meta};
        },
        write: (path, content) => {
            const meta = JSON.parse(localStorage.getItem("TERMINAL-FS-META-" + path.join("/")) || "null");
            if (!meta || meta[0] === "1") return false;
            fs.mkdir(path);
            return false;
        },
        mkdir: (path, recursive = true) => {
            const meta = JSON.parse(localStorage.getItem("TERMINAL-FS-META-" + path.join("/")) || "null");

        },
        rm: path => {
            const res = fs.internal.read(path);
            if (!res) return false;
            if (!res.isDir) {
                localStorage.removeItem("TERMINAL-FS-META-" + path.join("/"));
                localStorage.removeItem("TERMINAL-FS-CONTENT-" + path.join("/"));
                return true;
            }

        }
    }*/
};

const isMobile = () => innerWidth - innerHeight < 250;
const onResize = () => {
    const mobile = isMobile();
    const style = document.documentElement.style;
    style.setProperty("--container-font-size", mobile ? "35px" : "14px");
    style.setProperty("--frame-title-font-size", mobile ? "40px" : "16px");
    style.setProperty("--cursor-width", mobile ? "3px" : "1px");
    style.setProperty("--cursor-height", mobile ? "45px" : "15px");
    style.setProperty("--button-size", mobile ? "34px" : "14px");
    style.setProperty("--frame-height", mobile ? "50px" : "20px");
    style.setProperty("--button-left", mobile ? "12px" : "5px");
    style.setProperty("--button-top", mobile ? "6px" : "4px");
    style.setProperty("--button-margin", mobile ? "7px" : "5px");
    style.setProperty("--terminal-border-radius", mobile ? "25px" : "10px");
    style.setProperty("--container-height-add", mobile ? "45px" : "20px");
};
addEventListener("resize", onResize);
onResize();
const getLineText = () => [...container.lastElementChild.children].filter(i => i.classList.contains("char") && !i.classList.contains("immutable")).map(i => i.innerText).join("").replaceAll("\xa0", " ");
const getRawLineText = () => [...container.lastElementChild.children].filter(i => i.classList.contains("char")).map(i => i.innerText).join("").replaceAll("\xa0", " ");
const writeChar = (char, styles = {}, immutable = false) => {
    if (char === "\n") {
        cursor.remove();
        const last = container.lastElementChild;
        if (last && !last.innerHTML) last.innerHTML = `<div class="char">&nbsp;</div>`;
        const div = document.createElement("div");
        div.classList.add("line");
        container.appendChild(div);
        div.appendChild(cursor);
        container.scrollTop = container.scrollHeight;
        return;
    }
    const div = document.createElement("span");
    div.classList.add("char");
    if (immutable) div.classList.add("immutable");
    Object.keys(styles).forEach(s => div.style[s] = styles[s]);
    if (char === " ") div.innerHTML = "&nbsp";
    else div.innerText = char;
    cursor.insertAdjacentElement("beforebegin", div);
};
const writeText = (string, styles = {}, immutable = false) => {
    for (let i = 0; i < string.length; i++) writeChar(string[i], styles, immutable);
};

/*worker.onmessage = ev => {
    const msg = ev.data;
    (runners[msg[0]] || (r => r))(msg[1]);
};
worker.onmessageerror = console.log;
worker.onerror = console.log;
const runners = {};
const runJS = async code => {
    let id = _id++;
    worker.postMessage([id, code]);
    return new Promise(r => runners[id] = r);
};*/
const QuoteNotEnd = {};
const UnexpectedAnd = {};
const UnexpectedPipe = {};
const parseLine = string => {
    let str_on = false;
    let result = [""];
    //const normal = [];
    //const attributes = {};

    function next(s = true) {
        if (!result[result.length - 1]) return;
        //const arg = result[result.length - 1];
        if (s) result.push("");
        /*if (arg[0] !== "-") return normal.push(arg);
        const equal = arg.indexOf("=");
        if (equal === -1) return attributes[arg.substring(1)] = true;
        attributes[arg.substring(1, equal)] = arg.substring(equal + 1);*/
    }

    for (let i = 0; i < string.length; i++) {
        const c = string[i];
        if (str_on) {
            if (c === "\"") {
                str_on = false;
                next();
                continue;
            }
            result[result.length - 1] += c;
        } else {
            if (c === " ") {
                next();
                continue;
            } else if (c === "\"" && !result[result.length - 1]) {
                str_on = true;
                next();
                continue;
            }
            result[result.length - 1] += c;
        }
    }
    if (str_on) return QuoteNotEnd;
    //if (result.length) next(false);
    const commands = [{normal: [], attributes: {}, raw: []}];
    for (let i = 0; i < result.length; i++) {
        const arg = result[i];
        if (arg.trim() === "&&") {
            if (i === 0) return UnexpectedAnd;
            commands.push({normal: [], attributes: {}, raw: []});
            continue;
        }
        if (arg.trim() === "|") {
            if (i === 0) return UnexpectedPipe;
            commands[commands.length - 1].pipe = true;
            commands.push({normal: [], attributes: {}, raw: []});
            continue;
        }
        if (arg[0] !== "-" || commands[commands.length - 1].normal.length > 1) {
            commands[commands.length - 1].normal.push(arg);
            continue;
        }
        const equal = arg.indexOf("=");
        if (equal === -1) {
            commands[commands.length - 1].attributes[arg.substring(1)] = true;
            continue;
        }
        commands[commands.length - 1].attributes[arg.substring(1, equal)] = arg.substring(equal + 1) || true;
    }
    return commands;
};
/**
 * @type {Object<any, ((o: Object<any, Object<any, any> | any>) => any) | any>}
 */
const commands = {
    clear: () => clear(),
    help: ({print, args, attributes} = {}) => {
        if (!args[0]) {
            print("These shell commands are defined internally. Type `help` to see this list.\n" +
                "Type `help name` to find out more about the function `name`.\n\n", InfoStyle);
            const maxLength = Math.max(...commandMeta.map(i => i.usage.length)) + 3;
            print(commandMeta.sort((a, b) => a.name > b.name ? 1 : -1).map(i => i.usage + (attributes.d ? " ".repeat(maxLength - i.usage.length) + " - " + i.description : "")).join("\n") + "\n", SuccessStyle);
            return;
        }
        const cmd = commandMeta.find(i => i.name === args[0]);
        if (!cmd) return commandNotFound(args[0]);
        let hasAtt = attributes.d || attributes.u;
        const desc = hasAtt ? attributes.d : true;
        const usage = hasAtt ? attributes.u : true;
        if (usage) print(args[0] + ": " + cmd.usage + "\n");
        if (desc) print("    " + cmd.description.split("\n").join("\n    ") + "\n");
    },
    date: ({pipePrint} = {}) => pipePrint(new Date),
    title: ({args} = {}) => {
        let newTitle = args.join(" ");
        if (newTitle.length > 20) newTitle = newTitle.substring(0, 19) + "...";
        title.innerText = newTitle;
    },
    exit: async ({print, printChar, args, piping} = {}) => {
        if (piping) return false;
        const exitCode = (args || [])[0] * 1 || 0;
        clear();
        print("Terminal by OguzhanUmutlu\n", SuccessStyle);
        print("Type `help` to see a list of commands.\n", InfoStyle);
        if (args) print("Exited with the code " + exitCode + "\n");
        else printChar("\n");
    },
    echo: ({args, pipePrint} = {}) => args[0] ? pipePrint(args.join(" ")) : null,
    lb: ({printChar} = {}) => printChar("\n"),
    wait: async ({args, pipePrint}) => {
        const sec = args[0] * 1;
        if (isNaN(sec)) return pipePrint((args[0] || "none") + ": not numeric", ErrorStyle);
        if (sec < 0) return pipePrint(args[0] + ": not positive", ErrorStyle);
        await new Promise(r => setTimeout(r, sec * 1000));
    },
    cd: ({args, pipePrint}) => {
        if (!args[0]) return pipePrint("/" + cd.join("/"), InfoStyle);
        let p = Path.join(args[0]);
        if (!Path.isValid(p)) return pipePrint(Path.stringify(p) + ": invalid path", ErrorStyle);
        const read = fs.internal.read(p)[0];
        if (typeof read !== "object") {
            pipePrint(Path.stringify(p) + ": not a directory", ErrorStyle);
            return false;
        }
        cd = p;
    },
    ls: ({args, pipePrint, print}) => {
        const p = Path.join(args[0] || "");
        if (!Path.isValid(p)) return pipePrint(Path.stringify(p) + ": invalid path", ErrorStyle);
        const read = fs.internal.read(p)[0];
        if (typeof read !== "object") {
            pipePrint(Path.stringify(p) + ": not a directory", ErrorStyle);
            return false;
        }
        const keys = Object.keys(read);
        if (!keys.length) return;
        keys.forEach((i, j, a) => {
            const isDir = typeof read[i] === "object";
            print(i + (j === a.length - 1 ? "" : " "), isDir ? {
                background: InfoStyle.color,
                color: "black"
            } : InfoStyle);
        });
        pipePrint(""); // line break
    },
    mkdir: ({args, pipePrint}) => {
        let p = Path.join(args[0]);
        if (!Path.isValid(p)) return pipePrint(Path.stringify(p) + ": invalid path", ErrorStyle);
        const read = fs.internal.read(p);
        if (typeof read[0] !== "undefined") {
            pipePrint(Path.stringify(p) + ": already exists", ErrorStyle);
            return false;
        }
        fs.internal.writeStream(read, p, {});
    },
    write: ({args, attributes, pipePrint}) => {
        let p = Path.join(args[0]);
        if (!Path.isValid(p)) return pipePrint(Path.stringify(p) + ": invalid path", ErrorStyle);
        const read = fs.internal.read(p);
        if (typeof read[0] === "object") {
            pipePrint(Path.stringify(p) + ": not a file", ErrorStyle);
            return false;
        }
        let writing = args.slice(1).join(" ");
        let {l: line, a: append} = attributes;
        if (typeof line === "string" && !isNaN(line * 1) && line * 1 >= 0) {
            const lines = read[0].split("\n");
            if (append) lines[line] += writing;
            else lines[line] = writing;
            writing = lines.join("\n");
        } else if (append) writing = read[0] + writing;
        fs.internal.writeStream(read, p, writing);
    },
    cat: ({args, pipePrint}) => {
        let p = Path.join(args[0]);
        if (!Path.isValid(p)) return pipePrint(Path.stringify(p) + ": invalid path", ErrorStyle);
        const read = fs.internal.read(p)[0];
        if (typeof read !== "string") {
            pipePrint(Path.stringify(p) + ": not a file", ErrorStyle);
            return false;
        }
        pipePrint(read);
    },
    rm: ({args, pipePrint}) => {
        let p = Path.join(args[0]);
        if (!Path.isValid(p)) return pipePrint(Path.stringify(p) + ": invalid path", ErrorStyle);
        const read = fs.internal.read(p);
        if (typeof read[0] === "undefined") {
            pipePrint(Path.stringify(p) + ": no such file or directory", ErrorStyle);
            return false;
        }
        fs.internal.removeStream(read, p);
    },
    info: ({attributes, pipePrint}) => {
        const at = [..."mwhWHcr"]
        const amn = at.filter(i => attributes[i]).length;
        if (!amn) at.forEach(i => attributes[i] = true);
        const str = amn > 1 || amn === 0;
        const res = [];
        const mobile = isMobile();
        let winWidth = mobile ? innerWidth - 70 : innerWidth - 60;
        if (winWidth < 470.4) winWidth = 470.4;
        let winHeight = mobile ? innerHeight - 116 : innerHeight - 91;
        if (winHeight < 224) winHeight = 224;
        const charWidth = mobile ? 19.25 : 7.7;
        const charHeight = mobile ? 40.8 : 16;
        if (attributes.m) res.push((str ? "Is mobile: " : "") + (mobile ? "true" : "false"));
        if (attributes.w) res.push((str ? "Width of a character: " : "") + charWidth);
        if (attributes.h) res.push((str ? "Height of a character: " : "") + charHeight);
        if (attributes.W) res.push((str ? "Width of the terminal: " : "") + winWidth);
        if (attributes.H) res.push((str ? "Height of the terminal: " : "") + winHeight);
        if (attributes.c) res.push((str ? "Columns: " : "") + winWidth / charWidth);
        if (attributes.r) res.push((str ? "Rows: " : "") + winHeight / charHeight);
        pipePrint(res.join("\n"));
    },
    input: async ({pipePrint, args, piping, print, attributes}) => {
        if (!args[0]) args[0] = "line";
        if (!["key", "line"].includes(args[0])) {
            pipePrint(args[0] + ": expected 'key' or 'line'");
            return false;
        }
        const res = await new Promise(r => {
            stdin.raw = false;
            stdin.rawSpecial = false;
            stdin.resume();
            if (args[0] === "line") {
                const fn = () => {
                    stdin.handlers.line.splice(stdin.handlers.line.indexOf(fn), 1);
                    stdin.pause();
                    r(getLineText());
                };
                stdin.handlers.line.push(fn);
            } else {
                stdin.raw = true;
                stdin.rawSpecial = attributes.s;
                const fn = key => {
                    stdin.handlers.raw.splice(stdin.handlers.raw.indexOf(fn), 1);
                    stdin.raw = false;
                    stdin.rawSpecial = false;
                    stdin.pause();
                    if (!piping) writeChar("\n", {}, true);
                    r(key);
                };
                stdin.handlers.raw.push(fn);
            }
        });
        if (piping) print(res);
    },
    set: async ({args, pipePrint}) => {
        if (!args[0]) {
            pipePrint((args[0] || "none") + ": expected a name for the variable", ErrorStyle);
            return false;
        }
        if (!args[1]) {
            pipePrint((args[1] || "none") + ": expected a value for the variable", ErrorStyle);
            return false;
        }
        cmdVariables[args[0]] = args.slice(1).join(" ");
    },
    del: async ({args, pipePrint}) => {
        if (!args[0]) {
            pipePrint((args[0] || "none") + ": expected a name for the variable", ErrorStyle);
            return false;
        }
        delete cmdVariables[args[0]];
    },
    mt: async ({args, pipePrint}) => {
        if (!args[0] || isNaN(args[0] * 1)) {
            pipePrint((args[0] || "none") + ": expected a number", ErrorStyle);
            return false;
        }
        const ops = ["+", "-", "*", "/", "**", ">", "<", ">=", "<=", "=", "!=", "%", "&", "|", "^", "~", ">>", "<<", ">>>"];
        if (!ops.includes(args[1])) {
            pipePrint((args[1] || "none") + ": expected: '+', '-', '*', '/', '**', '>', '<', '>=', '<=', '=', '!=', '%', '&', '|', '^', '>>', '<<', '>>>'", ErrorStyle);
            return false;
        }
        if (!args[2] || isNaN(args[2] * 1)) {
            pipePrint((args[2] || "none") + ": expected a number", ErrorStyle);
            return false;
        }
        const op = {
            "+": (a, b) => a + b,
            "-": (a, b) => a - b,
            "*": (a, b) => a * b,
            "/": (a, b) => a / b,
            "**": (a, b) => a ** b,
            ">": (a, b) => a > b,
            "<": (a, b) => a < b,
            ">=": (a, b) => a >= b,
            "<=": (a, b) => a <= b,
            "=": (a, b) => a === b,
            "!=": (a, b) => a !== b,
            "%": (a, b) => a % b,
            "&": (a, b) => a & b,
            "|": (a, b) => a | b,
            "^": (a, b) => a ^ b,
            ">>": (a, b) => a >> b,
            "<<": (a, b) => a << b,
            ">>>": (a, b) => a >>> b
        };
        pipePrint(op[args[1]](args[0] * 1, args[2] * 1) * 1);
    },
    mts: async ({args, pipePrint}) => {
        const ops = ["!", "~"];
        if (!ops.includes(args[0])) {
            pipePrint((args[0] || "none") + ": expected: '!', '~'", ErrorStyle);
            return false;
        }
        if (!args[1]) {
            pipePrint((args[1] || "none") + ": expected a number", ErrorStyle);
            return false;
        }
        const op = {
            "!": a => (!a) * 1,
            "~": a => ~a
        };
        pipePrint(op[args[0]](args[0] * 1) * 1);
    },
    if: async ({pipePrint, args}) => {
        if (!args[0] || isNaN(args[0] * 1)) {
            pipePrint((args[0] || "none") + ": expected an argument", ErrorStyle);
            return false;
        }
        const ops = [">", "<", ">=", "<=", "=", "!="];
        if (!ops.includes(args[1])) {
            pipePrint((args[1] || "none") + ": expected: '>', '<', '>=', '<=', '=', '!='", ErrorStyle);
            return false;
        }
        if (!args[2] || isNaN(args[2] * 1)) {
            pipePrint((args[2] || "none") + ": expected an argument", ErrorStyle);
            return false;
        }
        const op = {
            ">": (a, b) => a > b,
            "<": (a, b) => a < b,
            ">=": (a, b) => a >= b,
            "<=": (a, b) => a <= b,
            "=": (a, b) => a === b,
            "!=": (a, b) => a !== b
        };
        const r = !isNaN(args[0] * 1) && !isNaN(args[2] * 1) ? op[args[1]](args[0] * 1, args[2] * 1) : op[args[1]](args[0], args[2]);
        if (!r) return;
        const code = args.slice(3).join(" ");
        await runScript(code);
    },
    fn: async ({pipePrint, args, lines}) => {
        if (!args[0]) {
            pipePrint("expected an argument", ErrorStyle);
            return false;
        }
        const ln = [];
        let st = false;
        let en = false;
        for (let i = 0; i < lines.length; i++) {
            const l = lines[i];
            if (st) {
                if (l.trim() === ":" + args[0] + " )") {
                    en = true;
                    break;
                }
                ln.push(l);
            } else {
                if (l.trim() === ":" + args[0] + " (") st = true;
            }
        }
        if (!st) {
            pipePrint(args[0] + ": not found", ErrorStyle);
            return false;
        }
        if (!en) {
            pipePrint(args[0] + ": no ending found", ErrorStyle);
            return false;
        }
        await runScript(ln.join("\n"));
    }
};
const commandMeta = [
    {name: "clear", usage: "clear", description: "Clears the terminal"},
    {
        name: "help", usage: "help [-ud] [command]", description: "Shows the help menu\n\nOptions:\n" +
            "    -u    Should usage be shown\n" +
            "    -d    Should description be shown"
    },
    {name: "date", usage: "date", description: "Shows the date"},
    {name: "title", usage: "title [title]", description: "Sets/clears the title"},
    {name: "exit", usage: "exit [number]", description: "Exits and restarts the terminal"},
    {name: "echo", usage: "echo [...text]", description: "Prints a text to the terminal"},
    {name: "lb", usage: "lb", description: "Puts a line break"},
    {name: "wait", usage: "wait [seconds]", description: "Stops the process for given seconds"},
    {name: "cd", usage: "cd [directory]", description: "Alters the current directory"},
    {name: "ls", usage: "ls [directory]", description: "Lists the files and folders in the current directory"},
    {name: "mkdir", usage: "mkdir [directory]", description: "Makes a directory"},
    {
        name: "write",
        usage: "write [-al] [file] [content]",
        description: "Edits a file with the given content\n\nOptions:\n" +
            "    -a        Appends the text instead of overwriting it\n" +
            "    -l=1234   The line to alter(0 = first line)"
    },
    {name: "cat", usage: "cat [file]", description: "Reads a file"},
    {name: "rm", usage: "rm [file]", description: "Removes a file"},
    {
        name: "info", usage: "info [-mwhWHcr]", description: "Gives information about the terminal\n\nOptions:\n" +
            "    -m    Whether mobile mode is on or off\n" +
            "    -w    Width of a single character\n" +
            "    -h    Height of a single character\n" +
            "    -W    Width of the terminal\n" +
            "    -H    Height of the terminal\n" +
            "    -c    Amount of columns in the terminal\n" +
            "    -r    Amount of rows in the terminal"
    },
    {
        name: "input", usage: "input [-s] [key|line]", description: "Waits for a response from the user\n\nOptions:\n" +
            "    -s    Whether the special characters like arrow keys are allowed"
    },
    {name: "set", usage: "set [name] [...value]", description: "Sets a variable"},
    {
        name: "mt",
        usage: "mt [number] [+ - * / ** > < >= <= = != % & | ^ ~ >> << >>>] [number]",
        description: "Executes given math expression"
    },
    {
        name: "mts",
        usage: "mts [~ !] [number]",
        description: "Executes given math expression that only needs a single number"
    },
    {
        name: "if",
        usage: "if [any] [> < >= <= = !=] [any] [...script]",
        description: "Checks if a statement is true and runs a script"
    },
    {
        name: "fn",
        usage: "fn [name]",
        description: "Runs a part of the script, only works within the script, unless fails\n\n" +
            "To use this feature you must add a function to the script.\n" +
            "Example:\n" +
            "    :myFunction (\n" +
            "    echo Hello, world!\n" +
            "    echo I am alive!\n" +
            "    :myFunction )\n" +
            "To run this function, simply run: `fn myFunction`"
    }
];
const commandNotFound = cmd => {
    writeText(cmd + ": command not found", ErrorStyle, true);
    const similar = Object.keys(commands).map(c => {
        const min = Math.min(c.length, cmd.length);
        let sim = 0;
        for (let j = 0; j < min; j++) {
            if (c[j] !== cmd[j]) break;
            sim++;
        }
        let sim2 = 0;
        for (let j = 0; j < min; j++) {
            if (c[c.length - j] !== cmd[cmd.length - j]) break;
            sim2++;
        }
        return [c, Math.max(sim, sim2)];
    }).filter(i => i[1] > 2).sort((a, b) => b[1] - a[1]);
    if (similar.length) {
        writeText(", did you mean:\n" + similar.slice(0, 3).map(i => `  command '${i[0]}' from built-in`).join("\n"), ErrorStyle, true);
    }
    writeChar("\n", true);
};
const runCommandAnon = async ({
                                  name = "", args = [], attributes = {}, print = (a, b) => writeText(a, b, true),
                                  printChar = (a, b) => writeChar(a, b, true), piping = false, lines = [],
                                  isTerminal = false
                              }) => {
    if (!commands[name]) return false;
    return await commands[name]({
        args,
        attributes,
        print,
        printChar,
        pipePrint: (a, b) => print(a + (piping ? "" : "\n"), b),
        piping,
        lines,
        isTerminal
    });
};
const runFile = async (name, text) => {
    return await runScript(text);
    /*const extension = name.includes(".") ? name.split(".").reverse()[0] : "";
    if (extension === "") {
        // executable
    } else {
        // script
    }*/
};

const runScript = async (code, {piping = false, print, printChar, isTerminal = false, linesActual = []} = {}) => {
    let pId = _id++;
    let onEnd;
    let terminated = false;
    let curTerm = null;
    processes[pId] = {
        code, terminate: () => {
            terminated = true;
            if (curTerm) curTerm();
        }, promise: new Promise(r => onEnd = () => {
            delete processes[pId];
            r();
        })
    };
    const lines = code.split("\n");
    let err = false;
    for (let i = 0; i < lines.length; i++) {
        if (terminated) break;
        if (err) break;
        const line = lines[i].trimStart();
        if (!line || line[0] === ":" || line[0] === "#") continue;
        const toRun = parseLine(line);
        if (toRun === QuoteNotEnd) {
            onEnd();
            return writeText("Expected a `\"`.\n", {}, true);
        }
        if (toRun === UnexpectedAnd) {
            onEnd();
            return writeText("Unexpected `&&`.\n", {}, true);
        }
        if (toRun === UnexpectedPipe) {
            onEnd();
            return writeText("Unexpected `|`.\n", {}, true);
        }
        for (let j = 0; j < toRun.length; j++) {
            if (terminated) break;
            const run = toRun[j];
            const cmd = run.normal[0].toLowerCase();
            if (commands[cmd]) {
                const printCache = [];
                const result = await new Promise(k => {
                    runCommandAnon({
                        name: cmd,
                        args: run.normal.slice(1).map(i => {
                            if (i === "%%") return "%";
                            if (i[0] === "%") {
                                const v = cmdVariables[i.substring(1)];
                                if (v) return v;
                            }
                            return i;
                        }), attributes: run.attributes,
                        print: print ? print : (run.pipe ? (a, b, c) => printCache.push([a, b, c, 0]) : (a, b) => writeText(a, b, true)),
                        printChar: printChar ? printChar : (run.pipe || piping ? (a, b, c) => printCache.push([a, b, c, 1]) : (a, b) => writeChar(a, b, true)),
                        piping: run.pipe || piping,
                        lines: [...lines, ...linesActual],
                        isTerminal
                    }).then(k);
                    curTerm = k;
                });
                if (terminated) break;
                if (result === false) return onEnd();
                if (run.pipe && toRun[j + 1]) toRun[j + 1].normal.push(printCache.map(i => i[0]).join(""));
            } else {
                if (cmd.includes("/")) {
                    let p = Path.join(cmd);
                    if (!Path.isValid(p)) {
                        writeText(Path.stringify(p) + ": invalid path\n", ErrorStyle, true);
                        break;
                    }
                    const read = fs.internal.read(p)[0];
                    if (typeof read === "string") {
                        if (!(await runFile(p[p.length - 1], read))) break;
                        continue;
                    } else {
                        writeText(Path.stringify(p) + ": no such file or directory\n", ErrorStyle, true);
                        break;
                    }
                }
                commandNotFound(cmd);
                break;
            }
        }
    }
    onEnd();
};

const stdin = {
    on: false,
    raw: false,
    resume: () => {
        cursor.style.background = "var(--terminal-text)";
        stdin.on = true;
        stdin.handlers.resume.forEach(i => i());
    },
    pause: () => {
        cursor.style.background = "";
        stdin.on = false;
        stdin.handlers.pause.forEach(i => i());
    },
    handlers: {
        line: [],
        change: [],
        resume: [],
        pause: [],
        raw: []
    }
};

const typeCD = () => {
    writeText(username, {color: "#16c60c"}, true);
    writeChar(":", {}, true);
    writeText("~" + (cd.length ? "/" + cd.join("/") : ""), {color: "#3b78ff"}, true);
    writeChar("$", {}, true);
    writeChar(" ", {}, true);
};
const paste = async () => {
    const text = await navigator.clipboard.readText().catch(e => e);
    if (text instanceof Error || !text) return;
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        writeText(line);
        if (i !== lines.length - 1) await enter();
    }
};
const copy = async () => {
    const selection = getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const nodes = [...range.cloneContents().children];
    let text;
    if (nodes[0].classList.contains("line")) {
        text = nodes.map(i => [...i.children].map(j => j.innerText).join("")).join("\n");
    } else text = nodes.map(i => i.innerText).join("");
    await navigator.clipboard.writeText(text);
};
const backspace = () => {
    const lineDiv = container.lastElementChild;
    const children = [...lineDiv.children];
    const index = children.indexOf(cursor);
    if (index === -1 || index === 0 || children[index - 1].classList.contains("immutable")) return;
    children[index - 1].remove();
    updateFormatting();
};
const ctrlBackspace = () => {
    const lineDiv = container.lastElementChild;
    const children = [...lineDiv.children].reverse();
    const index = children.indexOf(cursor);
    if (index === -1) return;
    let gotLetter = false;
    for (let i = index + 1; i < children.length; i++) {
        const c = children[i];
        if (c.classList.contains("immutable")) break;
        c.remove();
        if (c.innerHTML !== "&nbsp;") gotLetter = true;
        if (c.innerHTML === "&nbsp;" && gotLetter) break;
    }
    updateFormatting();
};
const enter = async () => {
    stdin.handlers.line.forEach(i => i());
    if (hasProcess()) return writeChar("\n", {}, true);
    stdin.pause();
    const code = getLineText();
    writeChar("\n", {}, true);
    if (code && history[history.length - 2] !== code) {
        history[history.length - 1] = code;
        history.push("");
        historyIndex = history.length;
    }
    await runScript(code, {isTerminal: true});
    typeCD();
    stdin.resume();
};
const clearAll = () => {
    [...container.children].forEach(i => i.remove());
    if (hasProcess()) return;
    writeChar("\n", {}, true);
    typeCD();
};
const clear = () => [...container.children].forEach((i, j, a) => j !== a.length - 1 && i.remove());
const moveCursor = (amount = 1) => {
    if (!amount) return false;
    const lineDiv = container.lastElementChild;
    const children = [...lineDiv.children];
    const index = children.indexOf(cursor);
    if (index === -1) return false;
    const c = children[index + amount];
    if (c && !c.classList.contains("immutable")) {
        c.insertAdjacentElement(amount > 0 ? "afterend" : "beforebegin", cursor);
        return true;
    }
    return false;
};
const safeMoveCursor = (amount = 1) => {
    for (let i = 0; i < Math.abs(amount); i++) if (!moveCursor(Math.sign(amount))) break;
};
const ctrlMoveRight = () => {
    const lineDiv = container.lastElementChild;
    const children = [...lineDiv.children];
    const index = children.indexOf(cursor);
    let amount = 0;
    for (let i = index + 1; i < children.length; i++) {
        const c = children[i];
        if (c.classList.contains("immutable")) break;
        if (c.innerHTML === "&nbsp;" && i !== index + 1) break;
        amount++;
    }
    moveCursor(amount);
};
const ctrlMoveLeft = () => {
    const lineDiv = container.lastElementChild;
    const children = [...lineDiv.children];
    const index = children.indexOf(cursor);
    let amount = 0;
    for (let i = index - 1; i >= 0; i--) {
        const c = children[i];
        if (c.classList.contains("immutable")) break;
        if (c.innerHTML === "&nbsp;" && i !== index - 1) break;
        amount++;
    }
    moveCursor(-amount);
};
const updateFormatting = () => {
    stdin.handlers.change.forEach(i => i());
    if (hasProcess()) return;
    const lineDiv = container.lastElementChild;
    const children = [...lineDiv.children].filter(i => i.classList.contains("char") && !i.classList.contains("immutable"));
    let str = [];
    const nx = () => {
        const st = str.map(i => i.innerText).join("");
        str.forEach(s => {
            s.style.color = "";
            if (commands[st.toLowerCase()]) s.style.color = "#00FFFF";
            else if (st === "%%") s.style.color = "#00d200";
            else if (st[0] === "%" && /^%[a-zA-Z]+$/.test(st)) s.style.color = "#00FF00";
            else if (["&&", "|"].includes(st)) s.style.color = "#FF00FF";
        });
        str = [];
    };
    for (let i = 0; i < children.length; i++) {
        const c = children[i];
        if (c.innerHTML === "&nbsp;") {
            nx();
            continue;
        }
        str.push(c);
    }
    nx();
};
const historyMove = (amount = 1) => {
    historyIndex += amount;
    if (historyIndex < 1) historyIndex = 1;
    if (historyIndex > history.length) historyIndex = history.length;
    const lineDiv = container.lastElementChild;
    const children = [...lineDiv.children].filter(i => i.classList.contains("char") && !i.classList.contains("immutable"));
    children.forEach(i => i.remove());
    writeText(history[historyIndex - 1]);
    updateFormatting();
};

addEventListener("keydown", async e => {
    const key = e.key.toLowerCase();
    keys[key] = true;
    if (hasProcess() && keys.control && key === "c") {
        Object.values(processes).forEach(i => i.terminate());
        return;
    }
    if (key === "capslock") {
        if (stdin.raw && stdin.on && stdin.rawSpecial) stdin.handlers.raw.forEach(i => i(key));
        capsLock = !capsLock;
        return;
    }
    if (!stdin.on) {
        if (keys.control || keys.meta) {
            if (key === "l") hasProcess() ? clearAll() : clear();
        }
        return;
    }
    if (key === "altgraph") {
        if (stdin.raw && stdin.on && stdin.rawSpecial) stdin.handlers.raw.forEach(i => i(key));
        delete keys.control;
        return;
    }
    if (keys.control || keys.meta) {
        if (stdin.raw && stdin.on) {
            if (stdin.rawSpecial && key.length > 1) stdin.handlers.raw.forEach(i => i(key));
            return;
        }
        if (key === "c") await copy();
        else if (key === "v") await paste();
        else if (key === "l") hasProcess() ? clearAll() : clear();
        else if (key === "backspace") ctrlBackspace();
        else if (key === "enter") await enter();
        else if (key === "arrowup") historyMove(-1);
        else if (key === "arrowdown") historyMove(1);
        else if (key === "arrowleft") ctrlMoveLeft();
        else if (key === "arrowright") ctrlMoveRight();
        else return;
        e.preventDefault();
        return;
    }
    if (key.length > 1) {
        if (stdin.raw && stdin.on) {
            if (stdin.rawSpecial && key.length > 1) stdin.handlers.raw.forEach(i => i(key));
            return;
        }
        if (key === "backspace") backspace();
        else if (key === "enter") await enter();
        else if (key === "arrowup") historyMove(-1);
        else if (key === "arrowdown") historyMove(1);
        else if (key === "arrowleft") moveCursor(-1);
        else if (key === "arrowright") moveCursor(1);
        else return;
        return;
    }
    writeChar(e.key);
    if (stdin.on && stdin.raw) stdin.handlers.raw.forEach(i => i(e.key));
    updateFormatting();

    // stop flickering when typing
    cursor.classList.remove("flickering");
    clearTimeout(flickerTimeout);
    flickerTimeout = setTimeout(() => cursor.classList.add("flickering"), 250);
});
addEventListener("keyup", e => delete keys[e.key.toLowerCase()]);
addEventListener("blur", () => keys = {});

stdin.resume();
await runCommandAnon({name: "exit", args: null});
typeCD();
// todo: text completion for commands and files?