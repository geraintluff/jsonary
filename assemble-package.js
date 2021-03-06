var path = require('path');
var fs = require('fs');
var wrench = require('wrench');

var licenseText = fs.readFileSync('LICENSE.txt', {enc: 'utf-8'});

var bundle = require('./node-package/create-bundle.js');
var masterBundle = bundle.base(__dirname)
	.code('/* ' + licenseText + ' */')
	.js([
		// Replacement for jsonary.js, assembled from individual files
		'jsonary/_compatability.js',
		'jsonary/_header.js',
		'jsonary/uri.js',
		'jsonary/uri-templates/uri-templates.js',
		'jsonary/utils.js',
		'jsonary/monitors.js',
		'jsonary/request.js',
		'jsonary/patch.js',
		'jsonary/data.js',
		'jsonary/schema.js',
		'jsonary/schemamatch.js',
		'jsonary/schemaset.js',
		'jsonary/main.js',
		'jsonary/_footer.js',
		'jsonary/jsonary.render.js'
	])
	.code('var Jsonary = this.Jsonary;')

	// http://json-schema.org/ meta-schemas
	.js('jsonary/_cache-json-schema-org.js')

	// Renderers
	.js('renderers/list-links.js')
	.css('renderers/common.css')

	.js('renderers/plain.jsonary.js')
	.css('renderers/plain.jsonary.css')

	.js('renderers/string-formats.js');

console.log("Writing jsonary-core");
masterBundle.compileJs('node-package/core/jsonary-core.js', true);
masterBundle.compileCss('node-package/core/jsonary-core.css');

console.log("Writing jsonary-super-bundle");
var superBundle = require('./node-package').superBundle();
superBundle.writeJs('node-package/super-bundle/jsonary-super-bundle.js', true, true);
console.log("Jsonary bundles complete");
	
console.log("Copying files");
// copy license
fs.writeFileSync('node-package/LICENSE.txt', licenseText, {enc: 'utf-8'});
// copy plugins
wrench.copyDirSyncRecursive('plugins', 'node-package/plugins', {
	forceDelete: true,
	excludeHiddenUnix: true
});
// copy renderers
wrench.copyDirSyncRecursive('renderers/contributed', 'node-package/renderers', {
	forceDelete: true,
	excludeHiddenUnix: true
});