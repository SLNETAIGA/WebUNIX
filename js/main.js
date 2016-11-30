var commands = [];
var commandIndex = 0;
var notYetEntered = "";
var lastKeyCode = 0;
document.onkeydown = function(event) {
    if (event.keyCode != 91 && event.keyCode != 17 && !(
        event.keyCode == 67 && (lastKeyCode === 91 || lastKeyCode === 17)))
        document.getElementById("input-text").focus();
    lastKeyCode = event.keyCode;
};

document.getElementById("input-text").onkeydown = function(event) {
    const input = document.getElementById("input-text");
    input.focus();
    switch (event.keyCode) {
    case 9: 
        tab();
        break;
    case 13: 
        const command = input.value.trim();
        if (command != "") { 
            saveCommand(command); 
            commands[commands.length] = command; 
            commandIndex = commands.length;
            parse(command);
            input.value = ""; 
        }
        break;
    case 38: 
        moveCursorToEnd();
        upKey();
        break;
    case 40: 
        moveCursorToEnd();
        downKey();
        break;
    case 67: 
        if (lastKeyCode === 17) 
            waiting = false;
        break;
    }
};

const parse = function(input) {
    const parts = input.split(" ");
    let root = "";
    let params = [];
    let lookingForParams = false;
    for (let i = 0; i < parts.length; i++) {
        const on = parts[i];
        switch (on) { 
        case "<":
            writeFileToStdin(parts[++i]);
            execute(root, params);
            params = [];
            lookingForParams = false;
            root = "";
            continue;
        case "|":
            execute(root, params);
            writeStdin(readStdout()); 
            params = [];
            lookingForParams = false;
            root = "";
            continue;
        case ">":
            execute(root, params);
            overwriteFromStdout(parts[++i]);
            params = [];
            lookingForParams = false;
            root = "";
            continue;
        case ">>":
            execute(root, params);
            concatFromStdout(parts[++i]);
            params = [];
            lookingForParams = false;
            root = "";
            continue;
        case "&&":
            if (root)
                execute(root, params);
            if (readStderr())
                writeToView(`error: ${readStderr()}`);
            if (readStdout())
                writeToView(readStdout());
            clearStderr();
            params = [];
            lookingForParams = false;
            root = "";
            continue;
        }
        if (lookingForParams) {
            params.push(on);
            continue;
        }
        if (root === "") { 
            if (typeof window[on] !== "function" && !isInPath(on)) { 
                addLine(`Unknown command '${on}'.`);
                return;
            }
            root = on;
            lookingForParams = true;
            continue;
        }
    }
    if (root) { 
        execute(root, params);
        lookingForParams = false;
        root = "";
    }
    if (readStderr())
        writeToView(`error: ${readStderr()}`);
    if (readStdout())
        writeToView(readStdout());
    clearStderr();
};


const execute = function(command, params) {
    waiting = true;
    stderr("");
    clearStdout();
    if (!command) {
        stderr("Cannot execute nothing.");
        addLine("Cannot execute nothing.");
        waiting = false;
        return;
    }
    let newCommand = command;
    if (!command.endsWith(".js"))
        newCommand = `${command}.js`;
    //const fn = window[command];
    const inPath = isInPath(newCommand);
    params.forEach((element) => {
        writeStdin(element);
    }, this);
    if (!inPath) {
        stderr("Command not found.");
        waiting = false;
        return;
    }
    const response = eval(inPath.content);
    clearStdin();
};

function runFile(path, file) {
    const resource = resolveResource(path);
    if (!resource || resource.type !== "folder") {
        stderr(`${path}/${file} not found.`);
        return;
    }
    const fileResource = resource.content[file];
    if (!fileResource || fileResource.type !== "file") {
        stderr(`${path}/${file} not found.`);
        return;
    }
    const content = fileResource.content;
    eval(content);
}


function tab() {
    if (window.event)
        window.event.returnValue = false;
    else if (event.cancelable)
        event.preventDefault();
}


document.getElementById("input-text").onkeyup = function(event) {
    switch (event.keyCode) {
    case 38:
        moveCursorToEnd();
        break;
    case 40:
        moveCursorToEnd();
        break;
    }
};

function upKey() {
    if (commandIndex > 0) {
        if (commandIndex === commands.length)
            notYetEntered = document.getElementById("input-text").value;
        const command = commands[--commandIndex];
        changeInputText(command);
    }
}

function downKey() {
    if (commandIndex < commands.length - 1) {
        const command = commands[++commandIndex];
        changeInputText(command);
    } else if (commandIndex === commands.length - 1) {
        commandIndex++;
        changeInputText(notYetEntered);
    }
}
function init() {
    initFiles();
    installPackageManager();
    loadUsername();
    loadPackages();
    updatePrefix();
    welcome();
}

const initFiles = function() {
    const savedFileSystem = localStorage.getItem("fileStructure");
    if (savedFileSystem) { 
        const newFileStructure = JSON.parse(savedFileSystem);
        fileStructure = newFileStructure;
        directoryIn = fileStructure;
    } else { 
        const rootDirectories = ["bin", "dev", "etc", "home", "root", "sbin", "tmp", "usr", "var"];
        rootDirectories.forEach((dir) => {
            fileStructure.content[dir] = {
                name: dir,
                parent: "/",
                type: "folder",
                content: {}
            };
        }, this);
        updateDirectoryString();
    }
};

const installPackageManager = function() {
    const pacmanData = getPackageManager();
    writeToFile("/bin", "pacman.js", pacmanData);
};

const loadUsername = function() {
    if (localStorage.getItem("username")) {
        username = localStorage.getItem("username");
        updatePrefix();
    }
};

function loadPackages() {
    const packageList = localStorage.getItem("packages");
    if (packageList) { 
        packageList.split(",").forEach((element) => {
            if (!resolveResource(`${element}.js`)) { 
                writeStdin("install");
                writeStdin(element);
                writeStdin("false");
                runFile("/bin", "pacman.js");
                clearStdin();
            }
        }, this);
    } else { 
        const defaultList = ["cd", "ping", "date", "write", "rm", "clear", "echo", "ls", "pwd", "reset", "setUser", "cat", "mkdir", "help"];
        defaultList.forEach((element) => {
            writeStdin("install");
            writeStdin(element);
            writeStdin("false");
            runFile("/bin", "pacman.js");
            clearStdin();
        }, this);
    }
};

const welcome = function() {
    var welcomeText = "Welcome! Type 'help' to view list of available packages";
    writeToView(welcomeText);
};

window.onload = function() {
    init();
};

const getPackageManager = function() {
    const data = document.getElementById("packageManager").import.body.innerHTML;
    return interpretHTML(data);
};

const interpretHTML = function(data) {
    let newData = data;
    newData = newData.replaceAll(/&gt;/, ">");
    newData = newData.replaceAll(/&lt;/, "<");
    return newData;
};

String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, "g"), replacement);
};
var directoryString = "/";
var username = "root";
var fileStructure = {
    name: "",
    parent: "",
    type: "folder",
    content: {}
};
var directoryIn = fileStructure;


function updateDirectoryString() {
    if (directoryIn === fileStructure)
        directoryString = "/";
    else  {
        directoryString = `${directoryIn.parent}/${directoryIn.name}`.substring(1);
    }
    updatePrefix();
}

function write(file, fileContent) {
    if (!file) {
        stderr("No path provided.");
        addLine("No path provided.");
        return;
    }
    if (file.indexOf("/") !== -1) { //Those assholes gaves us a path.
        const path = file.split("/");
        const fileName = path.pop();
        const folder = resolveResource(path.join("/"));
        if (!folder) {
            stderr("Invalid path given.");
            addLine("Invalid path given.");
            return;
        }
        const newParent = (folder.parent === "/") ? `/${folder.name}` : `${folder.parent}/${folder.name}`;
        folder.content[fileName] = {
            name: fileName,
            parent: newParent,
            type: "file",
            content: fileContent
        };
    } else { //They just gave us a file name, do a simple write.
        const resource = resolveResource(file);
        if (resource && typeof resource.content !== "string") {
            stderr("Can only write to files.");
            addLine("Can only write to files.");
            return;
        }
        directoryIn.content[file] = {
            name: file,
            parent: `${directoryIn.parent}/${directoryIn.name}`,
            type: "file",
            content: fileContent
        };
    }
}

function writeToFile(path, fileName, fileContent) {
    const folder = resolveResource(path);
    if (!folder) {
        stderr("Invalid path provided.");
        return;
    }
    const newParent = (folder.parent === "/") ? `/${folder.name}` : `${folder.parent}/${folder.name}`;
    folder.content[fileName] = {
        name: fileName,
        parent: newParent,
        type: "file",
        content: fileContent
    };
}

function resolveResource(path) {
    if (!path || path === "") {
        stderr("No path to resolve.");
        return;
    }
    if (path === "/")
        return fileStructure;
    const start = path.charAt(0);
    const splitPath = path.split("/");
    let on = directoryIn;
    if (start === "/") {
        on = fileStructure;
        splitPath.shift();
    } else if (start === "~") {
        on = fileStructure.content["home"];
        splitPath.shift();
    }
    let worked = true;

    splitPath.some((element) => {
        if (element === ".") {
            on = on; 
        } else if (element === "..") {
            if (on.parent && on.parent !== "") {
                on = resolveResource(on.parent);
            } else {
                worked = false;
                return true;
            }
        } else if (on.content[element]) {
            on = on.content[element];
        } else {
            worked = false;
            return true;
        }
        return false;
    }, this);
    if (worked)
        return on;
    else return undefined;
}


const writeFileToStdin = function(location) {
    const resource = resolveResource(location);
    if (!resource) {
        stderr(`${location} cannot be located.`);
        addLine(`${location} cannot be located.`);
        return;
    }
    if (typeof resource.content !== "string") {
        stderr(`${location} is not a file.`);
        addLine(`${location} is not a file.`);
        return;
    }
    writeStdin(resource.content);
    return resource.content;
};

const overwriteFromStdout = function(location) {
    write(location, readStdout());
};


const concatFromStdout = function(location) {
    const resource = resolveResource(location);
    if (resource) {
        if (typeof resource.content != "string") {
            stderr("Cannot write to a folder");
            addLine("Cannot write to a folder");
            return;
        }
        write(location, `${resource.content}${readStdout()}`);
    } else write(location, readStdout());
};

function isInPath(name) {
    const bin = resolveResource("/bin");
    let newName = name;
    if (!name.endsWith(".js"))
        newName = `${name}.js`;
    if (bin)
        return bin.content[newName];
    return undefined;
}

function decide(params) {
    const flag = [];
    const arg = [];
    params.forEach((element) => {
        if (element.indexOf("-") === 0) {
            flag.push(element);
        } else {
            arg.push(element);
        }
    }, this);
    return {
        flags: flag,
        args: arg
    };
}
function stdin() {
    return readStdin();
}

function writeStdin(comingIn) {
    if (stdin()) {
        writeToFile("/dev", "stdin", `${stdin()}\n${comingIn}`);
    } else writeToFile("/dev", "stdin", comingIn);
}

function readStdin() {
    const stdin = resolveResource("/dev/stdin");
    if (stdin)
        return stdin.content;
    else return "";
}

function clearStdin() {
    writeToFile("/dev", "stdin", "");
}

function stdout(goingOut) {
    writeStdout(goingOut);
}

function writeStdout(goingOut) {
    if (!goingOut) 
        return;
    if (readStdout()) {
        writeToFile("/dev", "stdout", `${readStdout()}\n${goingOut}`);
    } else writeToFile("/dev", "stdout", goingOut);
}

function readStdout() {
    const stdoutFile = resolveResource("/dev/stdout");
    if (stdoutFile)
        return stdoutFile.content;
    else return "";
}

function clearStdout() {
    writeToFile("/dev", "stdout", "");
}

function stderr(err) {
    writeStderr(err);
}

function writeStderr(err) {
    if (readStderr()) {
        writeToFile("/dev", "stderr", `${readStderr()}\n${err}`);
    } else writeToFile("/dev", "stderr", err);
}

function readStderr() {
    const stderrFile = resolveResource("/dev/stderr");
    if (stderrFile)
        return stderrFile.content;
    else return "";
}

function clearStderr() {
    writeToFile("/dev", "stderr", "");
}

var numLines = 0;
var output = document.getElementById('output');

function saveCommand(input) {
    let parentNode = document.createElement("p");
    let spanNode = document.createElement("span");
    let textNode = document.createElement("p");
    textNode.className = "accent";
    spanNode.appendChild(textNode);
    parentNode.appendChild(spanNode);
    document.getElementById("output").appendChild(parentNode);
    textNode.innerHTML = `${directoryString} ${username}$&nbsp`;
    parentNode.innerHTML += input;
    return numLines++;
}


function addLine(input) {
    if (typeof input !== "string")
        return;
    let outputParent = document.getElementById("output");
    let newNode = document.createElement("p");
    const withSpacesFixed = input.replace(/ /g, "&nbsp");
    newNode.innerHTML = withSpacesFixed;
    outputParent.appendChild(newNode);
    window.scrollTo(0,document.body.scrollHeight);
    return numLines++;
}

function updatePrefix() {
    result = directoryString + " " + username + "$&nbsp";
    document.getElementById("input-prefix").innerHTML = result;
}

function changeLine(index, text) {
    let line = output.childNodes[index];
    if (line)
        output.childNodes[index].innerHTML = text;
}

function changeInputText(text) {
    const inputBox = document.getElementById("input-text");
    inputBox.value = text;
}


function moveCursorToEnd() {
    const inputBox = document.getElementById("input-text");
    inputBox.selectionStart = inputBox.value.length;
    inputBox.selectionEnd = inputBox.value.length;
}

function writeToView(input) {
    if (!input)
        return;
    const text = `${input}`;
    const lines = text.split("\n");
    const indices = [];
    lines.forEach((line) => {
        indices.push(addLine(line));
    }, this);
    return indices;
}

