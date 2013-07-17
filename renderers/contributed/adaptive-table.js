// Generic renderer for arrays
// Requires "render.table" and "render.generator" plugins
Jsonary.render.register(Jsonary.plugins.Generator({
    // Part of the generator plugin - this function returns a renderer based on the data/schema requirements
    rendererForData: function (data) {
        var FancyTableRenderer = Jsonary.plugins.FancyTableRenderer;
        var renderer = new FancyTableRenderer({
            sort: {},
            rowsPerPage: 15,
            cellAction: {
                'remove': function (data, context, actionName) {
                    if (actionName == "remove") {
                        data.remove();
                        return false;
                    }
                },
                'moveUp': function (data, context, actionName) {
                    if (actionName == "moveUp") {
                        var idx = data.parentKey();
                        if (idx > 0) {
                            // Array.prototype.move = function (from, to) {this.splice(to, 0, this.splice(from, 1)[0]);};
                            var a = data.parent().value();
                            a.splice(idx - 1, 0, a.splice(idx, 1)[0]);
                            data.parent().setValue (a);
//                            console.log("Up");
                        }
                        return false;
                    }
                },
                'moveDown': function (data, context, actionName) {
                    if (actionName == "moveDown") {
                        var idx = data.parentKey();
                        if (idx < data.parent().value().length - 1) {
                            var a = data.parent().value();
                            a.splice(idx + 1, 0, a.splice(idx, 1)[0]);
                            data.parent().setValue (a);
//                            console.log("Down");
                        }
                        return false;
                    }
                }
            }
        });
        var columnsObj = {};

        function addColumnsFromSchemas(schemas, pathPrefix) {
            schemas = schemas.getFull();

            pathPrefix = pathPrefix || "";
            var basicTypes = schemas.basicTypes();

            // If the data might not be an object, add a column for it
            if (basicTypes.length != 1 || basicTypes[0] != "object") {
                var column = pathPrefix;
                if (!columnsObj[column]) {
                    columnsObj[column] = true;
                    renderer.addColumn(column, schemas.title() || column, function (data, context) {
                        if (data.basicType() == "object") {
                            return '<td></td>';
                        } else {
                            return this.defaultCellRenderHtml(data, context);
                        }
                    });
                    // add sorting
                    renderer.config.sort[column] = true;
                }
            }

            // If the data might be an object, add columns for its links/properties
            if (basicTypes.indexOf('object') != -1) {
                if (data.readOnly()) {
                    var links = schemas.links();
                    for (var i = 0; i < links.length; i++) {
                        var link = links[i];
                        addColumnsFromLink(link, i);
                    }
                }
                var knownProperties = schemas.knownProperties();
                // Sort object properties by displayOrder
                var knownPropertyOrder = {};
                for (var i = 0; i < knownProperties.length; i++) {
                    var key = knownProperties[i];
                    knownPropertyOrder[key] = schemas.propertySchemas(key).displayOrder();
                }
                knownProperties.sort(function (keyA, keyB) {
                    if (knownPropertyOrder[keyA] == null) {
                        if (knownPropertyOrder[keyB] == null) {
                            return (keyA > keyB) ? 1 : ((keyA < keyB) ? -1 : 0);
                        }
                        return 1;
                    } else if (knownPropertyOrder[keyB] == null) {
                        return -1;
                    }
                    return knownPropertyOrder[keyA] = knownPropertyOrder[keyB];
                });
                // Iterate over the potential properties
                for (var i = 0; i < knownProperties.length; i++) {
                    var key = knownProperties[i];
                    addColumnsFromSchemas(schemas.propertySchemas(key), pathPrefix + Jsonary.joinPointer([key]));
                }
            }
        }

        function addColumnsFromLink(linkDefinition, index) {
            var columnName = "link$" + index + "$" + linkDefinition.rel();

            var columnTitle = Jsonary.escapeHtml(linkDefinition.title || linkDefinition.rel());
            var linkText = columnTitle;
            var activeText = null, isConfirm = true;
            if (linkDefinition.rel() == 'edit') {
                activeText = 'save';
            }

            renderer.addLinkColumn(linkDefinition, columnTitle, linkText, activeText, isConfirm);
        }

        // 'remove' column
        if (!data.readOnly()) {
            renderer.addColumn('remove', '', function (data, context) {
                var result = '<td>';
                result += context.actionHtml('<span class="json-table-object-delete">X</span>', 'remove');
                return result + '</td>';
            });
            renderer.addColumn('moveUp', '', function (data, context) {
                var result = '<td>';
                result += context.actionHtml('<span class="json-table-object-moveUp">^</span>', 'moveUp');
                return result + '</td>';
            });
            renderer.addColumn('moveDown', '', function (data, context) {
                var result = '<td>';
                result += context.actionHtml('<span class="json-table-object-moveDown">v</span>', 'moveDown');
                return result + '</td>';
            });
        }

        var itemSchemas = data.schemas().indexSchemas(0).getFull();
        addColumnsFromSchemas(itemSchemas);
        return renderer;
    },
    filter: function (data, schemas) {
        if (data.basicType() == "array") {
            if (schemas.displayAsTable()) {
                return true;
            }
            // Array full of objects
            if (!schemas.tupleTyping()) {
                var indexSchemas = schemas.indexSchemas(0).getFull();
                var itemTypes = indexSchemas.basicTypes();
                if (itemTypes.length == 1 && itemTypes[0] == "object") {
                    return true;
                }
            }
        }
        return false;
    }
}));

// Display-order extension (non-standard keyword)
Jsonary.extendSchema({
    displayOrder: function () {
        return this.data.propertyValue("displayOrder");
    }
});
Jsonary.extendSchemaList({
    displayOrder: function () {
        var displayOrder = null;
        this.each(function (index, schema) {
            var value = schema.displayOrder();
            if (value != null && (displayOrder == null || value < displayOrder)) {
                displayOrder = value;
            }
        });
        return displayOrder;
    }
});

// displayAsTable extension (non-standard keyword, suggested by Ognian)
Jsonary.extendSchema({
    displayAsTable: function () {
        return !!this.data.propertyValue("displayAsTable");
    }
});
Jsonary.extendSchemaList({
    displayAsTable: function () {
        var displayAsTable = false;
        this.each(function (index, schema) {
            displayAsTable = displayAsTable || schema.displayAsTable();
        });
        return displayAsTable;
    }
});