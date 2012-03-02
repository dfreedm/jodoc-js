#!/usr/bin/env node

var fs = require("fs");
var path = require("path");
var markdown = require("github-flavored-markdown").parse;
var nopt = require("nopt");
var jodoc = require("./lib/jodoc-lib.js");

var options = {};

// process commandline arguments
function getOpts() {
	var opts = {
		output: path,
		template: path,
		toc: path,
		title: String,
		index: Boolean,
		config: String
	},
	shortHands = {
		o: ["--output"],
		t: ["--title"],
		ni: ["--no-index"]
	},
	config, prop;

	options = nopt(opts, shortHands);

	//require() only available in Node v0.3.7+
	if( options.config && require ){

		config = require( path.resolve( options.config ) );
		for( prop in opts ){

			if( config[ prop ] && !options[ prop ]){
				options[ prop ] = config[ prop ];
			}
		}

		//This can create duplicate file entries
		if( config.files ){
			Array.prototype.push.apply( options.argv.remain, config.files );
		}
	}

	if (typeof options.index === "undefined") {
		options.index = true;
	}
	return options.argv.remain;
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
	files = files.filter(function (file) { return file.match(/\.(js|css|htm[l]?|md(own)?|markdown)$/) });

	// read files
	files = files.map(function (file) {
			//dockify js and css files
			var content = fs.readFileSync(file,"utf8").toString();
			if (file.match(/\.(js|css)$/)) {
			content = jodoc.docker(content);
			}
			return {name: file, content: content};
			});

	for(var i = 0, len = files.length; i < len; i++) {
		if (!files[i].name.match(/\.htm[l]?$/)) {
			files[i].content = markdown(files[i].content);
		}
	}

	// toclink the incoming files
	if (options.output && options.toc) {
		var toc = fs.readFileSync(options.toc, "utf8").toString().split("\n");
		var marked_toc = markdown(jodoc.toclinker(toc,files));
		files.push({name:"_content", content: marked_toc});
	}
	files = files.map(function(file){ file.name = jodoc.munge_filename(file.name); return file; });
	var h1stuff = jodoc.h1finder(files);
	var linked_files = jodoc.autolink(files,h1stuff.h1s,options.output);
	var index = jodoc.indexer(h1stuff.h1s, options.output);
	var template;
	if (options.template) {
		template = fs.readFileSync(options.template,"utf8").toString();
	}
	if (options.output) {
		if (!path.existsSync(options.output)) {
			fs.mkdirSync(options.output,0777);
		}
		if (options.index) {
			linked_files.push({name:"_index.html",content:index});
		}
		linked_files.forEach(function(lf) {
				var out = jodoc.html_header(lf.content,options.title,template);
				fs.writeFile(path.join(options.output,lf.name),out,'utf8',function(e) { if(e) throw e });
				});
	} else {
		var out = linked_files.map(function(lf) {return lf.content});
		out = out.join('\n');
		out = jodoc.html_header(out,options.title,template);
		process.stdout.write(out);
	}
}

main();
