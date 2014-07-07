var
    debug = require('debug')('swaggerfy')
    , trace = require('debug')('swaggerfy:trace')
    , assert = require('assert-plus')
    , path = require('path')
    , url = require('url')
    ;

var _descriptionMap = {};
var _models = {};

function listResources(opts, routeMap) {

    trace("descriptions %j", _descriptionMap);
    return function (req, res, next) {

        var resources = {
            "apiVersion": opts.apiVersion || "0.0.1",
            "swaggerVersion": "1.2",
            "apis": Object.keys(routeMap).map(function(resourceName){
                return{
                    path: "/" +resourceName,
                    description: _descriptionMap[resourceName]
                };
            })
        };

        res.send(resources);
    };
}

var convertRouteToOperation = function convertRouteToOperation(route) {
    var swaggerDef = {
        method: route.method,
        nickname: route.name,
        summary: route.spec.description || route.spec.summary,
        responseMessages: route.spec.responseMessages,
        permittedRoles: route.permittedRoles || []
    };

    if(route.path.restifyParams){
        swaggerDef.parameters = [];

        route.path.restifyParams.forEach(function(param){
            swaggerDef.parameters.push({
                paramType: "path",
                name: param,
                dataType: "string"
            });

        });
    }

    return swaggerDef;
};

var processPermittedRoles = function processPermittedRoles (route){
    return route.spec.swagger.permittedRoles || route.permittedRoles || [];
};

var declareRoute = function declareRoute(route){
    if(route.spec.swagger && (typeof route.spec.swagger === 'object')){

        // pull details direct from route spec if missing from swagger obj
        route.spec.swagger.method = route.spec.swagger.method || route.method;
        route.spec.swagger.nickname = route.spec.swagger.nickname || route.name;
        route.spec.swagger.summary = route.spec.swagger.summary || (route.spec.description || route.spec.summary);
        route.spec.swagger.permittedRoles = processPermittedRoles(route);
        return route.spec.swagger;
    }

    return convertRouteToOperation(route);
};


var shouldSkipRoute = function shouldSkipRoute(opts, route){
    if(route.spec.swagger === false){
        return true;
    }

    return !(route.spec.swagger || opts.auto);
};

var buildRouteMaps = function buildRouteMaps(opts, routes){
    debug("building route maps");
    var routeMap = {};

    Object.keys(routes).forEach(function (httpMethod) {
        routes[httpMethod].forEach(function (route) {
            trace("ROUTE: %j", route);
            if(shouldSkipRoute(opts, route)){
                return;
            }
            var routePath = route.spec.url || route.spec.path;
            routePath = routePath.replace(/:(\w*)/g, "{$1}");

            var routeKey = routePath.split("/")[1];
            debug("routeKey = %s routePath = %s", routeKey, routePath);
            if(routeKey){
                if (!routeMap[routeKey]) {
                    routeMap[routeKey] = {};
                }

                var routeByPath = routeMap[routeKey][routePath];
                trace("routeByPath %j", routeByPath);

                if (routeByPath){
                    trace("found it, pushing");
                    routeByPath.push(declareRoute(route));

                }else{
                    trace("nope, creating");
                    routeMap[routeKey][routePath] = [declareRoute(route)];
                }

                trace("MAP %j", routeMap);

            }
        });
    });

    trace("route map %j", routeMap);

    return routeMap;

};

var filterOperationsByRoles = function filterOperationsByRoles(operations, roles){
    var filteredOperations = [];
    for (var operationIndex = 0; operationIndex < operations.length; operationIndex++){
        var operation = operations[operationIndex];
        if (!operation.permittedRoles || operation.permittedRoles.length === 0){
            filteredOperations.push(operation);
        }else{
            for (var permittedRoleIndex = 0; permittedRoleIndex < operation.permittedRoles.length; permittedRoleIndex++){
                if (roles.indexOf(operation.permittedRoles[permittedRoleIndex]) >= 0){
                    filteredOperations.push(operation);
                    break;
                }
            }
        }
    }
    return filteredOperations;
};

var filterApisByRoles = function filterApisByRoles(apis, roles){
    var filteredApis = [];
    if (!roles){
        roles = [];
    }

    for (var apiIndex = 0; apiIndex < apis.length; apiIndex++){
        var api = apis[apiIndex]
            , isAnyOperationPermitted = false
            , filteredApi = {operations: []};
        filteredApi.operations = filterOperationsByRoles(api.operations, roles);
        isAnyOperationPermitted = filteredApi.operations && filteredApi.operations.length > 0;
        if (isAnyOperationPermitted){
            filteredApi.path = api.path;
            filteredApis.push(filteredApi);
        }
    }
    return filteredApis;
};

var showApiDeclaration = function showApiDeclaration(opts, resourceName,  apiDeclaration){
    trace("spec = %j", apiDeclaration);

    var apiDetails = {
            "apiVersion": opts.apiVersion || "0.0.0",
            "swaggerVersion": "1.2",
            "basePath": opts.basePath,

            // TODO: make configurable
            "produces": [
                "application/json"
            ],
            "resourcePath": "/" + resourceName,
            "apis": [],
            "models": {}
        },
        originalApis
        ;
    Object.keys(apiDeclaration).forEach(function(routePath){
        var operations = apiDeclaration[routePath];
        apiDetails.apis.push({path: routePath, operations: operations});
    });
    originalApis = apiDetails.apis;

    // TODO: Populate models with only models from this resource, instead of blindly adding all models.
    apiDetails.models = _models;

    return function(req, res, next){
        apiDetails.basePath = apiDetails.basePath || 'http://' + req.headers.host;
        apiDetails.apis = filterApisByRoles(originalApis, req.apiRoles);
        res.send(apiDetails);
        return next();
    };
};

var declareApis = function declareApis(opts, routeMap){
    var header = {
        "apiVersion": opts.apiVersion || "0.0.1",
        "swaggerVersion": "1.2",
        "apis": []
    };

    if(opts.inifo){
        header.info = opts.info;
    }

    Object.keys(routeMap).forEach(function(resourceName){
        header.apis.push({
            path: opts.docRoot + "/" +resourceName
        });
        if (opts.middleware){
            opts.app.get(opts.docRoot + "/" + resourceName, opts.middleware, showApiDeclaration(opts, resourceName, routeMap[resourceName]));
        }else{
            opts.app.get(opts.docRoot + "/" + resourceName, showApiDeclaration(opts, resourceName, routeMap[resourceName]));
        }

    });

};

// ------------ EXPORTS -------------------

module.exports.addResourceDescription = function addResourceDescription(resourceName, description){
    debug("setting description for %s", resourceName);
    _descriptionMap[resourceName] = description;
};

module.exports.addModel = function addModel(model, modelName){
    _models[modelName || model.id] = model;
};

module.exports.describeResources = function(opts){
    assert.ok(opts, "options are required");
    assert.object(opts, "opts");
    assert.object(opts.app, "opts.app");

    var routeMap = buildRouteMaps(opts, opts.app.router.routes);

    opts.app.get(opts.docRoot, listResources(opts, routeMap));
    declareApis(opts, routeMap);
};

