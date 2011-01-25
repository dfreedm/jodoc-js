#!/usr/bin/env node

var fs = require('fs');
var path = require('path');
var spawn = require('child_process').spawn;

var jodoc = require('jodoc-lib'); // ~/.node_libraries/jodoc-lib.js -> lib/jodoc-lib.js

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

// avoid recursing down VCS directories
function no_vcs(infile) {
    // If there's any more, feel free to add
    var vcs = /^\.(git|svn|cvs|hg|bzr)$/;
    infile = path.basename(infile);
    return !infile.match(vcs);
}

// recursively flatten folders into files
function flatten_files(infiles) {
    var stat;
    var outfiles = [];
    infiles = infiles.filter(no_vcs);
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
            * Don't do a stupid and run jodoc on a block device or socket
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
    if (!files.length) {
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
        if (! file.match(/\.htm[l]?$/)) {
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

// wrap a markdown processor in a nice lambda
function markdown_pipe(callback) {
    var markdown_bin, markdown_wrapper;
    // try for markdown-js
    try{
        markdown_bin = require('markdown-js');
        markdown_wrapper = function(content){ callback(markdown_bin.toHTML(content)) };
    }
    // spawn a markdown process
    catch(_) {
        markdown_bin = spawn('markdown');
        markdown_wrapper = function(content){
            var buffer = "";
            markdown_bin.stdin.write(content);
            markdown_bin.stdout.on('data', function(i){ buffer += i });
            markdown_bin.stdout.on('end', callback(buffer));
        };
    }
    return markdown_wrapper;
}

main();
