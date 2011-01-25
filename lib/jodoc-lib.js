// a default html template
var default_template = '<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">\n<html lang="en">\n<head>\n<meta http-equiv="Content-Type" content="text/html; charset=utf-8">\n<title>$title</title>\n<meta name="generator" content="joDoc">\n<link rel="stylesheet" type="text/css" href="docbody.css">\n<link rel="stylesheet" type="text/css" href="doc.css">\n<meta name="viewport" content="initial-scale=1.0, maximum-scale=1.0, user-scalable=no, width=device-width">\n<meta name="format-detection" content="false">\n</head>\n<body>\n$body\n</body>\n</html>';

// strip incoming text of comments
// input: "code"
// output: "comments"
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
// input: "body" | {body:"body", title:"title", template:"template"}
// output "templated html"
function html_header (inbag) {
	var title, body, template, output;
	if (typeof inbag === "string") {
		body = inbag;
	}
	else if (typeof inbag === "object") {
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
// input: "full/path/to/file"
// output: "munged_file_name"
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

// turn h1s into an index propertybag
// input: h1s
// output: "Stringified index"
function index_to_json (h1s) {
	var keywords = [];
	for (var keyword in h1s) {
		keywords.push({term:keyword, url:h1s[keyword]});
	}
	return JSON.stringify(keywords);
}

// find and return all the h1 tags in the processed files
// input: [{name:"filename", content:"file content"}]
// output: {h1s: {h1:file_name,...}, files_to_h1s: {filename:[h1s_in_file],...}}
function h1finder (processed) {
	var h1s = {};
	var files_to_h1s = {};
	var h1find = /\<h1\>([^\<]+)\</h1\>/g;
	processed.forEach(
		function(file_info) {
			var accum_h1s = [];
			var h1 = "";
			while ((h1 = h1find.exec(file_info.content)) != null){
				accum_h1s.push(h1[1]);
			}
			accum_h1s.forEach(
				function (h1) {
					h1s[h1] = file_info.name;
				}
			);
			files_to_h1s[file_info.name] = accum_h1s;
		}
	);
	return {h1s:h1s, files_to_h1s:files_to_h1s};
}

// make a nice index of the h1s
// input: h1s, outputdir = true | false
// output: "index markdown"
function indexer (h1s, outputdir) {
	var keywords = Object.keys(h1s).sort();
	var keyword_letters = {};
	// format output markdown based on outputdir
	var formatter = function(keyword) {
		if (outputdir) {
			return '- [' + keyword + ']' + '(' + h1s[keyword] + '#' + keyword + ')';
		} else {
			return '- [' + keyword + ']' + '(#' + keyword + ')';
		}
	};
	// split keyword list into lettered segments
	keywords.forEach(
		function(keyword) {
			// works for RTL languages only I guess
			var letter = keyword.toLocaleUpperCase.substr(0);
			letter = "## " + letter;
			if (typeof keyword_letters[letter] === "undefined") {
				keyword_letters[letter] = [formatter(keyword)];
			} else {
				(keyword_letters[letter]).push(formatter(keyword));
			}
		}
	);
	var keywords_marked = [];
	for (var letter in keyword_letters) {
		var list_out = letter + '\n';
		list_out += (keyword_letters[letter]).join("\n");
		keywords_marked.push(list_out);
	}
	return '#Index\n<span id="index">' + keywords_marked.join("\n") + '</span>';
}

exports.docker = docker;
exports.html_header = html_header;
exports.munge_filename = munge_filename;
exports.h1finder = h1finder;
exports.indexer = indexer;
