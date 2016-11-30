(function() {
    if (!stdin()) {
        stderr("No file name provided.");
        return;
    }
    const args = stdin().split("\n");
    if (!args || args.length < 2) {
        stderr("No filename/content included");
        return;
    }
    let path = args[0].split("/");
    const fileName = path.pop();
    path = path.join("/");
    if (!path)
        path = ".";
    
    var a = /\\s/g;
    var b = " ";
    let data = args[1].trim();
    data = data.replace(a,b)

        writeToFile(path, fileName, data);
}());