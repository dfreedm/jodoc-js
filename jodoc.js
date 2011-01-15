var fs = require('fs');
var path = require('path');
var jodoc = require('./lib/jodoc-lib.js');

var options = {};

// process commandline arguments
function getOpts() {
    var args = process.argv.slice(2), arg = '';
    var files = [];
    while(args.length > 0) {
        arg = args.shift();
        switch(arg)
        {
            case '--output':
            case '-o': options.output = args.shift();
                break;

            case '--template': options.template = args.shift();
                break;

            case '--toc': options.toc = args.shift();
                break;

            case '-t':
            case '--title': options.title = args.shift();
                break;

            default: files.push(arg);
        }
    }
    return files;
}

// recursively flatten folders into files
function flatten_files(infiles) {
    var stat;
    var outfiles = [];
    infiles.forEach(function(file) {
        try {
            stat = fs.statSync(file);
            if (stat.isDirectory()) {
                // make sure readdir puts path back in after
                var newfiles = fs.readdirSync(file).map(function(f){return path.join(file,f)});
                // recurse
                var flat = flatten_files(newfiles);
                // add the flattened bits back in
                outfiles = outfiles.concat(flat);
            }
            /*
            * I assume it is a regular file here
            * Don't do stupid and do jodoc on a fscking block device or socket
            * You're gonna have a bad time
            */
            else {
                outfiles.push(file);
            }
        } catch (e) {console.log(e)}
    });
    return outfiles;
}

function main() {
    var files = getOpts();
    // if no files given, glob the current directory
    if (files.length == 0) {
        files.push('.');
    }
    files = flatten_files(files);

    // filter files
    files = files.filter(function (file) {
        return file.match(/\.(js|css|mdown|htm[l]?|md|markdown)$/);
    });

    // read files
    files = files.map(function (file) {
        //dockify js and css files
        var content = fs.readFileSync(file,"utf8")
        if (file.match(/\.(js|css)$/)) {
            content = jodoc.docker(content);
        }
        //pass through markdown
        if (! file.match(/\.html$/)) {
            //TODO content = markdown(content);
        }
        return content;
    });
    console.log(files);


    /* TODO
     toclink
     munge
     h1find
     autolink
     index
     spit out
    */
}

main();
