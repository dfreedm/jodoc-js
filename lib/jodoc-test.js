var sys = require('sys');
var jodoc = require('./jodoc-lib.js')

var a = jodoc.docker('/** 1 */ 2 /** \n3 */');

sys.puts(jodoc.html_header({title:'hey', body:'boy'}));

sys.puts(jodoc.munge_filename("../../../.././hi/there/man"));

