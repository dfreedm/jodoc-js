var sys = require('sys');
var child = require('child_process');

// a default html template
var default_template = '<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">\n<html lang="en">\n<head>\n<meta http-equiv="Content-Type" content="text/html; charset=utf-8">\n<title>$title</title>\n<meta name="generator" content="joDoc">\n<link rel="stylesheet" type="text/css" href="docbody.css">\n<link rel="stylesheet" type="text/css" href="doc.css">\n<meta name="viewport" content="initial-scale=1.0, maximum-scale=1.0, user-scalable=no, width=device-width">\n<meta name="format-detection" content="false">\n</head>\n<body>\n$body\n</body>\n</html>';

// strip incoming text of comments
function docker (input) {
	var strip_code = /\*\*(?:.|[\r\n])*?\*/g;
	var strip_stars = /\*|\*\*/g;
	var strip_extra_whitespace = /([\r\n]+)\s/g;
	var output = [];
	var a;
	while ((a = strip_code.exec(input)) != null)
	{
		a = a[0];
		a = a.replace(strip_stars,'');
		a = a.replace(strip_extra_whitespace, '$1');
		output.push(a);
	}
	return output.join("\n");
}

// add a nice header
function html_header (inbag) {
	var title, body, template, output;
	if (typeof inbag === "string") {
		body = inbag;
	}
	if (typeof inbag === "object") {
		body = inbag.body;
		title = inbag.title;
		template = inbag.template;
	}
	title = title || "joDoc";
	output = template || default_template;
	output = output.replace(/\$title/g,title);
	output = output.replace(/\$body/g,body);
	return output;
}

// munge output filenames
function munge_filename(file) {
	var path_parts = file.split("/");
	path_parts = path_parts.map(
		function(index) {
			return index.replace(/^\.+/g,"");
		}
	);
	path_parts = path_parts.filter(
		function(index){ return index != "" }
	);
	return path_parts.join("_") + ".html";
}

function index_to_json (keywords) {
	keywords = keywords.sort(function(a,b) { return a.term < b.term });
	return JSON.stringify(keywords);
}

// find and return all the h1 tags in the processed files
function h1finder (processed) {
	var h1s = {};
	var files_to_h1s = {};
	var h1find = /\<h1\>([^\<]+)\</h1\>/g;
	processed.forEach(
		function(file_info) {
			var accum_h1s = [];
			var h1 = "";
			while (h1 = h1find.exec(file_info.content) != null){
				accum_h1s.push(h1[1]);
			}
			accum_h1s.forEach(
				function (file) {
					h1s[file] = file_info.name;
				}
			);
			files_to_h1s[file_info.name] = accum_h1s;
		}
	);
	return [h1s, files_to_h1s];
}

exports.docker = docker;
exports.html_header = html_header;
exports.munge_filename = munge_filename;
exports.h1finder = h1finder;
