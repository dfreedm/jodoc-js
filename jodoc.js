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

            case '-m':
            case '--markdown': options.markdown = args.shift();

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

// wrap a markdown processor in a nice lambda
function markdown_pipe(file, callback) {
    var markdown_bin;
    // try for markdown-js
    if (options.markdown) {
        markdown_bin = spawn(options.markdown || 'markdown');
        markdown_bin.stdin.write(file.content);
        markdown_bin.stdin.end();
        markdown_bin.stdout.on('data', function(buffer){ file.content = buffer.toString() });
        markdown_bin.stdout.on('end', function(){ callback(file) });
    }
    else {
        markdown_bin = require('./lib/showdown.js');
        file.content = markdown_bin.showdown(file.content);
        callback(file);
    }
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
        return file.match(/\.(js|css|htm[l]?|md(own)?|markdown)$/);
    });

    // allocate array for markdown'd files
    var marked = files.map(function(){ return null });

    // read files
    files = files.map(function (file) {
        //dockify js and css files
        var content = fs.readFileSync(file,"utf8")
        if (file.match(/\.(js|css)$/)) {
            content = jodoc.docker(content);
        }
        return {name: file, content: content};
    });

    // My sad attempt at a countdown latch
    // Continue only if all the files have passed through the markdown process
    var mark_done = function(index) {
        return function(marked_file) {
            marked[index] = marked_file;
            if (marked.every(function(c){ return c !== null })) toclink(marked);
        };
    };

    // async markdowning
    for(var i = 0, len = files.length; i < len; i++) {
        var file = files[i];
        if (file.name.match(/\.htm[l]?$/)) {
            marked[i] = file;
        }
        else {
            markdown_pipe(file, mark_done(i));
        }
    }
}

// toclink the incoming files
function toclink(files) {
    if (options.toc) {
        var tocline = /(\s*).\s*{(.+)}/, tocline_res;
        var h1stuff = jodoc.h1finder(files);
        var toc = fs.readFileSync(options.toc, "utf8").split("\n");
        var toclinked = [];
        toc.forEach(function(line) {
            if ((tocline_res = tocline.exec(line)) != null) {
                line = jodoc.toclinker(h1stuff, tocline_res[1], tocline_res[2]);
            }
            toclinked.push(line);
        });
        var tocfile = {name: "_content", content: toclinked.join("\n")};
        var toc_callback = function(marked_tocfile) {
            files.push(marked_tocfile);
            munge(files);
        };
        markdown_pipe(tocfile, toc_callback);
    } else {
        munge(files)
    };
}

function munge(files) {
    console.log(files);
}

/* TODO
    munge
    h1find
    autolink
    index
    spit out
*/

main();
