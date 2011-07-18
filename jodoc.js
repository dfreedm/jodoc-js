#!/usr/bin/env node

var fs = require('fs'),
    path = require('path'),
    jodoc = require(__dirname + '/lib/jodoc-lib.js'),
    markdown = require(__dirname + '/lib/showdown.js').showdown;

var sys = require('sys'),
    http = require('http');

//Return an options struct, with files
function getOptions() {
    var args = process.argv.slice(2),
        arg = '',
        options = {
            files: []
        };

    while(args.length > 0) {
        arg = args.shift();
        switch(arg)
        {
        case '--server':
        case '-s': options.server = true;
            //Allow port to be passed optionally
            if( !isNaN( args[0] ) ){
                options.server = args.shift();
            }
            break;

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

        case '-ni':
        case '--no-index': options.noindex = true;
            break;

        default: options.files.push(arg);
        }
    }
    return options;
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

    var stat,
        outfiles = [];

    infiles = infiles.filter(no_vcs);
    infiles.forEach(function(file) {
        stat = fs.statSync(file);
        if (stat.isDirectory()) {
            // make sure readdir puts path back in after
            var newfiles = fs.readdirSync(file).map(function(f){
                return path.join(file,f);
            });
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
            outfiles.push( file );
        }
    });
    return outfiles;
}

function readFileContent( files, output, toc ){

    files = flatten_files( files );

    var result = files
        .filter(function( file ){

            //Filter to files we care about
            return file.match(/\.(js|css|htm[l]?|md(own)?|markdown)$/);
        })
        .map(function( file ){

            //dockify js and css files
            var content = fs.readFileSync( file, "utf8" ).toString();
            if( file.match( /\.(js|css)$/ ) ){

                content = jodoc.docker( content );
            }
            if( !file.match( /\.htm[l]?$/ ) ){

                content = markdown( content );
            }

            return {
                name: file,
                content: content
            };        
        });

    // toclink the incoming files
    if( output && toc ){

        toc = fs.readFileSync( toc, "utf8" ).toString().split("\n");
        var marked_toc = markdown( jodoc.toclinker( toc, files ) );
        result.push({
            name:"_content",
            content: marked_toc
        });
    }

    return result.map(function( file ){

        file.name = jodoc.munge_filename( file.name );
        return file;
    });


}

(function( ) {

    var options = getOptions(), //Parse command line arguments
        files = options.files,
        content;

    // if no files given, glob the current directory
    if (!files.length) {
        files.push('.');
    }

    // read files
    content = readFileContent( files, options.output, options.toc );

    if( options.server ){

        http.createServer(function( request, response ){

            var linked_files,
                content;

            var filePath = '.' + request.url;
            //Send any files that the user requests
            if( filePath !== './' ){ 

                filePath = options.output + filePath;
                path.exists(filePath, function(exists) {
	            
	            if( exists ){
	                fs.readFile(filePath, "binary", function(error, content) {
	                    if (error) {
	                        response.writeHead(500);
	                        response.end();
	                    }
	                    else {
	                        response.writeHead(200);//, { 'Content-Type': 'text/html' });
	                        response.end( content, 'binary' );
	                    }
	                });
	            }
	            else {
	                response.writeHead(404);
	                response.end();
	            }
	        });

            } else { //Rebuild the jodoc and send it

                content = readFileContent( files, options.output, options.toc );

                linked_files = jodoc.autolink( content,
                                               jodoc.h1finder( content ).h1s,
                                               options.output 
                                             );
                
                content = linked_files.map(function( lf ){ 
                    return lf.content; 
                }).join('\n');

                response.writeHead( 200, { "Content-Type": "text/html" });


                response.end( 
                    jodoc.html_header( content, options.title,
                                       options.template ?
                                       fs.readFileSync( options.template, "utf8" ).toString() :
                                       undefined ) 
                );

                //Write to disk subsequent times is broken, not sure why yet
                //writeToDisk( content, options.output, options.template, options.noindex, options.title  );
            }
        }).listen( !isNaN( options.web ) ? options.web : 1337
                   , 'localhost');

        sys.puts("Server running at http://localhost:1337");

    }

    writeToDisk( content, options.output, options.template, options.noindex, options.title  );
})();


function indexOfName( arr, name ){
    for( var i = 0, l = arr.length; i<l; i++ ){
        if( arr[i].name === name ){
            return i;
        }
    }
    return -1;
}

function writeToDisk( files, output, template, noindex, title ){

    var h1stuff = jodoc.h1finder( files ),
        linked_files = jodoc.autolink( files, h1stuff.h1s, output ),
        index = jodoc.indexer( h1stuff.h1s, output),
        i;

    if( template ){
        template = fs.readFileSync( template, "utf8" ).toString();
    }

    if( !noindex ){
        i = indexOfName( linked_files, '_index.html' );
        if( ~i ){ //Previous index not found

            linked_files.push({
                name:"_index.html",
                content:index
            });            
        } else {

            linked_files[i] = {
                name: '_index.html',
                content: index
            };
        }

    }

    //Create multiple files or just one
    if( output ){

        if ( !path.existsSync( output ) ) {
            fs.mkdirSync( output, 0777 );
        }

        linked_files.forEach(function( lf ){

            var out = jodoc.html_header( lf.content, title, template );
            fs.writeFile( path.join( output,lf.name ), out, 'utf8', failfast );
        });

    } else {

        var out = linked_files.map(function( lf ){

            return lf.content;
        }).join('\n');

        out = jodoc.html_header( out, title, template );

        process.stdout.write( out );
    }
}

function failfast(err) {

    if (err) throw err;
};



