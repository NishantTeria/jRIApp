'use strict';
if (!window['RIAPP']) {
    var RIAPP = {};
}

RIAPP.global = null;
RIAPP.Application = null;

RIAPP.utils = (function () {
    if (!Array['clone']) {
        Array.clone = function (array) {
            if (array.length === 1) {
                return [array[0]];
            }
            else {
                return Array.apply(null, array);
            }
        };
    }

    /* Essential utility functions */
    var utils = {
        isFunc:function (a) {
            if (!a)
                return false;
            var rx = /Function/;
            return (typeof (a) === 'function') ? rx.test(a.constructor.toString()) : false;
        },
        endsWith:function (str, suffix) {
            return (str.substr(str.length - suffix.length) === suffix);
        },
        startsWith:function (str, prefix) {
            return (str.substr(0, prefix.length) === prefix);
        },
        fastTrim:function (str) {
            return str.replace(/^\s+|\s+$/g, '');
        },
        trim:function (str, chars) {
            if (!chars) {
                return utils.fastTrim(str);
            }
            return utils.ltrim(utils.rtrim(str, chars), chars);
        },
        ltrim:function (str, chars) {
            chars = chars || "\\s";
            return str.replace(new RegExp("^[" + chars + "]+", "g"), "");
        },
        rtrim:function (str, chars) {
            chars = chars || "\\s";
            return str.replace(new RegExp("[" + chars + "]+$", "g"), "");
        },
        isArray:function (o) {
            if (!o)
                return false;
            return Array.isArray(o);
        },
        /**
         *    Usage:     format('test {0}={1}', 'x', 100);
         *    result:    test x=100
         **/
        format:function () {
            var result = '', args = arguments, format = args[0];
            for (var i = 0; ;) {
                var open = format.indexOf('{', i);
                var close = format.indexOf('}', i);
                if ((open < 0) && (close < 0)) {
                    result += format.slice(i);
                    break;
                }
                if ((close > 0) && ((close < open) || (open < 0))) {
                    if (format.charAt(close + 1) !== '}') {
                        throw new Error(utils.format(RIAPP.ERRS.ERR_STRING_FORMAT_INVALID, format));
                    }
                    result += format.slice(i, close + 1);
                    i = close + 2;
                    continue;
                }
                result += format.slice(i, open);
                i = open + 1;
                if (format.charAt(i) === '{') {
                    result += '{';
                    i++;
                    continue;
                }
                if (close < 0) throw new Error(utils.format(RIAPP.ERRS.ERR_STRING_FORMAT_INVALID, format));
                var brace = format.substring(i, close);
                var colonIndex = brace.indexOf(':');
                var argNumber = parseInt((colonIndex < 0) ? brace : brace.substring(0, colonIndex), 10) + 1;
                if (isNaN(argNumber)) throw new Error(utils.format(RIAPP.ERRS.ERR_STRING_FORMAT_INVALID, format));
                var argFormat = (colonIndex < 0) ? '' : brace.substring(colonIndex + 1);
                var arg = args[argNumber];
                if (arg === undefined || arg === null) {
                    arg = '';
                }

                if (arg.format) {
                    result += arg.format(argFormat);
                }
                else
                    result += arg.toString();
                i = close + 1;
            }
            return result;
        }
    };

    if (!String['format']) {
        String.format = function () {
            var args = Array.prototype.slice.call(arguments);
            return utils.format.apply(utils, args);
        };
    }
    return utils;
})();


RIAPP.BaseObject = {
    _create:function _create() {
        this._super = null;
        this.__events = null;
        this._isDestroyed = false;
        this._isDestroyCalled = false;
    },
    create:function create() {
        var instance = Object.create(this);
        instance._create.apply(instance, arguments);
        Object.seal(instance);
        return instance;
    },
    extend:function extend(properties, propertyDescriptors, fn_afterExtend) {
        var pds = propertyDescriptors || {}, propertyName, simpleProperties, i = 0, len, obj;
        var pdsProperties = Object.getOwnPropertyNames(pds), rx_super = /\._super\s*\(/;
        pdsProperties.forEach(function (name) {
            var pd = pds[name];
            if (pd['enumerable'] === undefined) {
                pd['enumerable'] = true;
            }
            if (pd['configurable'] === undefined) {
                pd['configurable'] = false;
            }
        });
        //add new property for every object prototype to store type name for easier debugging
        pds['_typeName'] = Object.getOwnPropertyDescriptor({_typeName:''}, '_typeName');
        pds['__eventNames'] = Object.getOwnPropertyDescriptor({__eventNames:[]}, '__eventNames');

        if (!!properties) {
            simpleProperties = Object.getOwnPropertyNames(properties);
            for (i = 0, len = simpleProperties.length; i < len; i += 1) {
                propertyName = simpleProperties[i];
                if (pds.hasOwnProperty(propertyName)) {
                    continue;
                }

                pds[propertyName] = Object.getOwnPropertyDescriptor(properties, propertyName);
            }
        }

        obj = Object.create(this, pds);
        var pnames = Object.getOwnPropertyNames(obj);
        pnames.forEach(function (name) {
            var p = Object.getOwnPropertyDescriptor(obj, name), fn, fn_str, superProto;
            if (!!p.value && RIAPP.utils.isFunc(p.value)) {
                fn_str = p.value.toString();
                fn = obj[name];
                //this wrapping of the original function is only for the functions which use _super function calls
                if (rx_super.test(fn_str)) {
                    superProto = Object.getPrototypeOf(obj);
                    if (name == 'destroy'){
                        p.value = function () {
                            var old = this._super;
                            this._super = superProto[name];
                            try {
                                this._isDestroyCalled = true;
                                return fn.apply(this, arguments);
                            }
                            finally {
                                this._super = old;
                            }
                        };
                    }
                    else{
                        p.value = function () {
                            var old = this._super;
                            this._super = superProto[name];
                            try {
                                return fn.apply(this, arguments);
                            }
                            finally {
                                this._super = old;
                            }
                        };
                    }
                    Object.defineProperty(obj, name, p);
                }
                else if (name == 'destroy'){
                    p.value = function () {
                        this._isDestroyCalled = true;
                        return fn.apply(this, arguments);
                    };
                    Object.defineProperty(obj, name, p);
                }
            }
        });

        //store (cache) in prototype all event names for the objects based on this prototype
        //it is already computed and so it is faster to access than function call with this._getEventNames()
        obj.__eventNames = obj._getEventNames();

        if (!!fn_afterExtend)
            fn_afterExtend(obj);
        return obj;
    },
    _addHandler:function (name, fn, namespace, prepend) {
        if (this._isDestroyed)
            return;

        if (!RIAPP.utils.isFunc(fn))
            throw new Error(RIAPP.ERRS.ERR_EVENT_INVALID_FUNC);
        if (!name)
            throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_EVENT_INVALID, name));

        if (this.__events === null)
            this.__events = {};
        var self = this, ev = self.__events, n = name, ns = '*';

        if (!!namespace)
            ns = '' + namespace;

        if (!ev[n])
            ev[n] = [];
        var arr = ev[n];
        if (!arr.some(function (obj) {
            return obj.fn === fn && obj.ns == ns;
        })) {
            if (!prepend)
                arr.push({fn:fn, ns:ns});
            else
                arr.unshift({fn:fn, ns:ns});
        }
    },
    _removeHandler:function (name, namespace) {
        var self = this, ev = self.__events, n = name, ns = '*';
        if (!ev)
            return;

        if (!!namespace)
            ns = '' + namespace;
        var arr, toRemove, i;

        //arguments supplyed name (and optionally namespace)
        if (!!n) {
            if (!ev[n])
                return;
            if (ns == '*') {
                delete ev[n];
            }
            else {
                arr = ev[n];
                toRemove = arr.filter(function (obj) {
                    return obj.ns == ns;
                });
                i = arr.length;

                while (i > 0) {
                    i -= 1;
                    if (toRemove.indexOf(arr[i]) > -1) {
                        arr.splice(i, 1);
                    }
                }
                if (arr.length == 0)
                    delete ev[n];
            }
            return;
        }

        //arguments supplyed only namespace
        if (ns != '*') {
            var keys = Object.keys(ev);
            keys.forEach(function (n) {
                var arr = ev[n];
                var toRemove = arr.filter(function (obj) {
                    return obj.ns == ns;
                });
                i = arr.length;
                while (i > 0) {
                    i -= 1;
                    if (toRemove.indexOf(arr[i]) > -1) {
                        arr.splice(i, 1);
                    }
                }
                if (arr.length == 0)
                    delete ev[n];
            });
            return;
        }

        //no arguments supplyed
        self.__events = null;
    },
    _raiseEvent:function (name, data) {
        var self = this, ev = self.__events;
        if (ev === null)
            return;

        if (!!name) {
            if (name != '0*' && RIAPP.utils.startsWith(name, '0'))  //property changed
            {
                this._raiseEvent('0*', data); //who subscribed for all property changes
            }
            if (!ev[name])
                return;
            var arr = Array.clone(ev[name]);
            arr.forEach(function (obj) {
                obj.fn.apply(self, [self, data]);
            });
        }
    },
    _onError:function (error, source) {
        if (!!RIAPP.global && RIAPP.global._checkIsDummy(error)) {
            return true;
        }
        if (!error.message) {
            error = new Error('' + error);
        }
        var args = { error:error, source:source, isHandled:false };
        this._raiseEvent('error', args);
        return args.isHandled;
    },
    _getEventNames:function () {
        return ['error', 'destroyed'];
    },
    _checkEventName:function (name) {
        if (this.__eventNames.indexOf(name) === -1)
            throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_EVENT_INVALID, name));
    },
    raisePropertyChanged:function (name) {
        var data = { property:name };
        this._raiseEvent('0' + name, data);
    },
    addHandler:function (name, fn, namespace) {
        this._checkEventName(name);
        this._addHandler(name, fn, namespace, false);
    },
    removeHandler:function (name, namespace) {
        if (!!name) {
            this._checkEventName(name);
        }
        this._removeHandler(name, namespace);
    },
    addOnDestroyed:function (fn, namespace) {
        this._addHandler('destroyed', fn, namespace, false);
    },
    removeOnDestroyed:function (namespace) {
        this._removeHandler('destroyed', namespace);
    },
    //remove all handlers registered with some namespace
    removeNSHandlers:function (namespace) {
        this._removeHandler(undefined, namespace);
    },
    raiseEvent:function (name, data) {
        this._checkEventName(name);
        this._raiseEvent(name, data);
    },
    getEventNames:function () {
        return this.__eventNames;
    },
    //to subscribe for all properties changes supply in prop parameter '*'
    addOnPropertyChange:function (prop, fn, namespace) {
        if (!prop)
            throw new Error(RIAPP.ERRS.ERR_PROP_NAME_EMPTY);
        prop = '0' + prop;
        this._addHandler(prop, fn, namespace, false);
    },
    removeOnPropertyChange:function (prop, namespace) {
        if (!!prop) prop = '0' + prop;
        this._removeHandler(prop, namespace);
    },
    destroy:function () {
        if (this._isDestroyed)
            return;
        this._isDestroyed = true;
        try {
            this._raiseEvent('destroyed', {});
        }
        finally {
            this.__events = null;
        }
    },
    toString:function () {
        if (!!this._typeName) {
            return this._typeName;
        }
        else
            return 'RIAPP Object';
    }
};

RIAPP._glob_modules = ['array_ext', 'consts', 'errors', 'defaults', 'utils', 'riapp'];
RIAPP._app_modules = ['converter','parser', 'baseElView', 'binding', 'template', 'mvvm', 'collection', 'db', 'listbox',
    'datadialog', 'baseContent', 'datagrid', 'pager', 'stackpanel', 'dataform', 'elview', 'content'];
RIAPP.css_riaTemplate = 'ria-template';

RIAPP.Global = RIAPP.BaseObject.extend({
        version:"1.2.4.1",
        _TEMPLATES_SELECTOR:['section.', RIAPP.css_riaTemplate].join(''),
        _TEMPLATE_SELECTOR:'*[data-role="template"]',
        __coreModules:{}, //static
        _create:function (window, jQuery) {
            this._super();
            if (!!RIAPP.global)
                throw new Error(RIAPP.ERRS.ERR_GLOBAL_SINGLTON);
            if (!jQuery)
                throw new Error(RIAPP.ERRS.ERR_APP_NEED_JQUERY);
            var curMod, curModName;
            this._window = window;
            this._appInst = {};
            this._$ = jQuery;
            this._modInst = {};
            this._currentSelectable = null;
            this._defaults = null;
            this._userCode = {};
            this._exports = {}; //exported types
            this._utils = null;
            this._consts = null;
            this._templateLoaders = {};
            this._promises = [];
            this._nextAppInstanceNum = 0;

            //initialize the required coreModules
            for (var i = 0; i < RIAPP._glob_modules.length; i += 1) {
                curMod = {};
                curModName = RIAPP._glob_modules[i];
                this._coreModules[curModName].apply(curMod, [this]);
                Object.freeze(curMod);
                this._modInst[RIAPP._glob_modules[i]] = curMod;
            }
            this._init();
            Object.freeze(this._coreModules);
            this._waitQueue = this.utils.WaitQueue.create(this);
        },
        _getNextAppNum:function () {
            this._nextAppInstanceNum +=1;
            return this._nextAppInstanceNum;
        },
        _init:function () {
            var self = this;
            self.$(self.document).ready(function ($) {
                self._processTemplateSections(self.document);
                self.raiseEvent('load', { });
            });
            //when clicked outside any Selectable set _currentSelectable = null
            self.$(self.document).on("click.global", function (e) {
                e.stopPropagation();
                self.currentSelectable = null;
            });
            self.$(self.document).on("keydown.global", function (e) {
                e.stopPropagation();
                if (!!self._currentSelectable) {
                    self._currentSelectable._onKeyDown(e.which, e);
                }
            });
            self.$(self.document).on("keyup.global", function (e) {
                e.stopPropagation();
                if (!!self._currentSelectable) {
                    self._currentSelectable._onKeyUp(e.which, e);
                }
            });
            self.$(self.window).unload(function () {
                self.raiseEvent('unload', { });
            });
            //this way to attach for correct work in firefox
            self.window.onerror = function (msg, url, linenumber) {
                if (!!msg && msg.indexOf("DUMMY_ERROR") > -1) {
                    return true;
                }
                alert('Error message: ' + msg + '\nURL: ' + url + '\nLine Number: ' + linenumber);
                return false;
            }
        },
        _getEventNames:function () {
            var base_events = this._super();
            return ['load','unload'].concat(base_events);
        },
        _onGridAdded:function (grid) {
            var self = this, utils = self.utils, tableEl = grid.$container;
            tableEl.on("click." + grid.uniqueID, function (e) {
                e.stopPropagation();
                var target = e.target;
                if (utils.isContained(target, tableEl.get(0)))
                    self.currentSelectable = grid;
            });
        },
        _onGridRemoved:function (grid) {
            grid.$container.off("click." + grid.uniqueID);
            if (this.currentSelectable === grid)
                this.currentSelectable = null;
        },
        _onStackPanelAdded:function (panel) {
            var self = this, utils = self.utils, el = panel._$el;
            el.on("click." + panel.uniqueID, function (e) {
                e.stopPropagation();
                var target = e.target;
                if (utils.isContained(target, el.get(0)))
                    self.currentSelectable = panel;
            });
        },
        _onStackPanelRemoved:function (panel) {
            panel._$el.off("click." + panel.uniqueID);
            if (this.currentSelectable === panel)
                this.currentSelectable = null;
        },
        _registerApp:function (app) {
            if (!this._appInst[app.appName])
                this._appInst[app.appName] = app;
        },
        _unregisterApp:function (app) {
            if (!this._appInst[app.appName])
                return;
            delete this._appInst[app.appName];
            delete this._templateLoaders[app.appName];
        },
        _destroyApps:function () {
            var self = this;
            this.utils.forEachProp(this._appInst, function (id) {
                self._appInst[id].destroy();
            });
        },
        _throwDummy:function (origErr) {
            var errMod = this.modules.errors;
            if (!!errMod && !!origErr && !origErr.isDummy) {
                throw errMod.DummyError.create(origErr);
            }
            throw origErr;
        },
        _checkIsDummy:function (error) {
            return !!error.isDummy;
        },
        _registerType:function (root, name, obj) {
            var parts = name.split('.'),
                parent = root['_exports'],
                i;

            for (i = 0; i < parts.length - 1; i += 1) {
                // create a property if it doesn't exist
                if (!parent[parts[i]]) {
                    parent[parts[i]] = {};
                }
                parent = parent[parts[i]];
            }
            var n = parts[parts.length - 1]; //the last part is the type name itself
            if (!!parent[n])
                throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_TYPE_ALREDY_REGISTERED, name));
            obj._typeName = name;
            parent[n] = obj;
            return parent;
        },
        _getType:function (root, name) {
            var parts = name.split('.'),
                parent = root['_exports'],
                i;
            for (i = 0; i < parts.length; i += 1) {
                if (!parent[parts[i]]) {
                    return null;
                }
                parent = parent[parts[i]];
            }
            return parent;
        },
        _processTemplateSections:function(root){
            var self = this;
            var sections = Array.fromList(root.querySelectorAll(self._TEMPLATES_SELECTOR));
            sections.forEach(function (el) {
                self._processTemplateSection(el, null);
                self.utils.removeNode(el);
            });
        },
        _processTemplateSection:function(templateSection, app){
            var self = this;
            var templates = Array.fromList(templateSection.querySelectorAll(self._TEMPLATE_SELECTOR));
            templates.forEach(function (el) {
                var tmpDiv = self.document.createElement('div'), html, name = el.getAttribute('id'), deferred = self.utils.createDeferred();
                el.removeAttribute('id');
                tmpDiv.appendChild(el);
                html = tmpDiv.innerHTML;
                deferred.resolve(html);
                var fn_loader = function(){
                    return deferred.promise();
                };
                if (!!app){
                    name = app.appName+'.'+name;
                }
                self._registerTemplateLoader(name,fn_loader);
            });
        },
        /*
         fn_loader must load template and return promise which resolves
         with loaded HTML string
         */
        _registerTemplateLoader:function (name, fn_loader) {
            var self = this;
            if (!self.utils.check_is.Function(fn_loader)){
                throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_ASSERTION_FAILED, 'fn_loader is Function'));
            }
            var parts = name.split('.'),
                parent = self._templateLoaders,
                i;
            for (i = 0; i < parts.length - 1; i += 1) {
                // create a property if it doesn't exist
                if (!parent[parts[i]]) {
                    parent[parts[i]] = {};
                }
                parent = parent[parts[i]];
            }
            var n = parts[parts.length - 1]; //the last part is the loader name itself
            if (!!parent[n])
               throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_TEMPLATE_ALREDY_REGISTERED, name));
            parent[n] = fn_loader;
            return parent;
        },
        _getTemplateLoader:function(name) {
            var parts = name.split('.'),
                parent = this._templateLoaders,
                i;
            for (i = 0; i < parts.length; i += 1) {
                if (!parent[parts[i]]) {
                    return null;
                }
                parent = parent[parts[i]];
            }
            return parent;
        },
        _waitForNotLoading:function (callback, callbackArgs) {
            this._waitQueue.enQueue({
                prop:'isLoading',
                groupName:null,
                predicate:function (val) {
                    return !val;
                },
                action:callback,
                actionArgs:callbackArgs
            });
        },
        _loadTemplatesAsync:function (fn_loader, app) {
            var self = this, promise = fn_loader(), old = self.isLoading;
            self._promises.push(promise);
            if (self.isLoading !== old)
                self.raisePropertyChanged('isLoading');
            promise.done(function(html){
                self.utils.removeFromArray(self._promises,promise);
                try
                {
                    var tmpDiv = self.document.createElement('div');
                    tmpDiv.innerHTML = html;
                    self._processTemplateSection(tmpDiv,app);
                }
                catch(ex){
                    self._onError(ex,self);
                }
                if (!self.isLoading)
                    self.raisePropertyChanged('isLoading');
            });
            promise.fail(function(err){
                self.utils.removeFromArray(self._promises,promise);
                if (!self.isLoading)
                    self.raisePropertyChanged('isLoading');
                if (!!err && !!err.message){
                    self._onError(err,self);
                }
                else if (!!err && !!err.responseText){
                    self._onError(new Error(err.responseText),self);
                }
                else
                    self._onError(new Error('Failed to load templates'),self);
            });
        },
        reThrow:function (ex, isHandled) {
            if (!!isHandled)
                this._throwDummy(ex);
            else
                throw ex;
        },
        findApp:function (name) {
            return this._appInst[name];
        },
        destroy:function () {
            if (this._isDestroyed)
                return;
            
            var self = this;
            if (!!self._waitQueue){
                self._waitQueue.destroy()
                self._waitQueue = null;
            }
            self._promises = [];
            self.removeHandler();
            self._destroyApps();
            self._modInst = {};
            self._exports = {};
            self._templateLoaders = {};
            self.$(self.document).off(".global");
            RIAPP.Application = null;
            RIAPP.global = null;
            self.window.onerror = null;
            self._super();
        },
        registerType:function (name, obj) {
            return this._registerType(this, name, obj);
        },
        getType:function (name) {
            return this._getType(this, name);
        },
        getImagePath:function (imageName) {
            var images = this.defaults.imagesPath;
            return images + imageName;
        },
        loadTemplates:function (url) {
            var self= this;
           this._loadTemplatesAsync(function(){
               return self.utils.performAjaxGet(url);
           },null);
        },
        toString:function () {
            return 'Global';
        }
    },
    {
        _coreModules:{
            get:function () {
                return this.__coreModules;
            }
        },
        isLoading:{
            get:function () {
                return this._promises.length >0;
            }
        },
        //jQuery
        $:{
            get:function () {
                return this._$;
            }
        },
        modules:{
            get:function () {
                return this._modInst;
            }
        },
        window:{
            get:function () {
                return this._window;
            }
        },
        document:{
            get:function () {
                return this._window.document;
            }
        },
        currentSelectable:{
            set:function (v) {
                if (this._currentSelectable !== v) {
                    this._currentSelectable = v;
                    this.raisePropertyChanged('currentSelectable');
                }
            },
            get:function () {
                return this._currentSelectable;
            }
        },
        defaults:{
            set:function (v) {
                if (this._defaults !== v) {
                    this._defaults = v;
                    this.raisePropertyChanged('defaults');
                }
            },
            get:function () {
                return this._defaults;
            }
        },
        consts:{
            set:function (v) {
                if (!this._consts)
                    this._consts = v;
                else
                    throw new Error('Global consts already initialized');
            },
            get:function () {
                return this._consts;
            }
        },
        utils:{
            set:function (v) {
                if (!this._utils)
                    this._utils = v;
                else
                    throw new Error('Global utils already initialized');
            },
            get:function () {
                return this._utils;
            }
        },
        //Namespace for custom user code
        //can be used to exchange some data between applications
        UC:{
            get:function () {
                return this._userCode;
            }
        }
    }, null);

RIAPP.Global._coreModules.array_ext = function (global) {
    Array.prototype.distinct = function () {
        var o = {}, i, l = this.length, r = [];
        for (i = 0; i < l; i += 1) o[this[i]] = this[i];
        var k = Object.keys(o);
        for (i = 0, l = k.length; i < l; i += 1)
            r.push(o[k[i]]);
        return r;
    };

    Array.prototype.intersect = function (arr) {
        return this.filter(function (n) {
            return (arr.indexOf(n) > -1);
        });
    };

    Array.fromList = function (list) {
        var array = new Array(list.length);
        for (var i = 0, n = list.length; i < n; i++)
            array[i] = list[i];
        return array;
    };
};

RIAPP.Global._coreModules.consts = function (global) {
    var thisModule = this, consts = {};
    thisModule.CHUNK_SEP = '$&@';
    consts.DATA_ATTR = {
        EL_VIEW_KEY:'data-elvwkey',
        DATA_BIND:'data-bind',
        DATA_VIEW:'data-view',
        DATA_APP:'data-app',
        DATA_EVENT_SCOPE:'data-scope',
        DATA_ITEM_KEY:'data-key',
        DATA_CONTENT:'data-content',
        DATA_COLUMN:'data-column',
        DATA_NAME:'data-name'
    };
    consts.DATA_TYPE = { None:0, String:1, Bool:2, Integer:3, Decimal:4, Float:5, DateTime:6, Date:7, Time:8, Guid:9, Binary:10 };
    consts.CHANGE_TYPE = { NONE:0, ADDED:1, UPDATED:2, DELETED:3 };
    consts.KEYS = {
        backspace:8,
        tab:9,
        enter:13,
        esc:27,
        space:32,
        pageUp:33,
        pageDown:34,
        end:35,
        home:36,
        left:37,
        up:38,
        right:39,
        down:40,
        del:127
    };
    consts.ELVIEW_NM = {DATAFORM:'dataform',DYNACONT:'dynacontent'};
    var names = Object.getOwnPropertyNames(consts);
    names.forEach(function (nm) {
        Object.freeze(consts[nm]);
    });
    Object.freeze(consts);

    thisModule.consts = consts;
    global.consts = thisModule.consts;
};

RIAPP.Global._coreModules.errors = function (global) {
    var thisModule = this;

    var BaseError = RIAPP.BaseObject.extend({
        _create:function (message) {
            this._super();
            this._message = message;
            this._isDummy = false;
            this._origError = null;
        },
        toString:function () {
            return this._message;
        }
    }, {
        message:{
            set:function (v) {
                this._message = v;
            },
            get:function () {
                return this._message;
            }
        },
        isDummy:{
            set:function (v) {
                this._isDummy = v;
            },
            get:function () {
                return this._isDummy;
            }
        },
        origError:{
            set:function (v) {
                this._origError = v;
            },
            get:function () {
                return this._origError;
            }
        }
    }, function (obj) {
        thisModule.BaseError = obj;
    });

    var DummyError = BaseError.extend({
        _create:function (ex) {
            this._super("DUMMY_ERROR");
            this._origError = ex;
            this._isDummy = true;
        }
    }, null, function (obj) {
        thisModule.DummyError = obj;
    });
};

RIAPP.Global._coreModules.defaults = function (global) {
    var thisModule = this;

    var Defaults = RIAPP.BaseObject.extend({
        _create:function () {
            this._super();
            this._imagesPath = '';
            this._datepickerRegional = '';
            if (!global.$.datepicker) {
                throw new Error(RIAPP.ERRS.ERR_JQUERY_DATEPICKER_NOTFOUND);
            }
            this._datepickerDefaults = global.$.datepicker.regional[this._datepickerRegional];
            this._dateTimeFormat = 'dd.MM.yyyy HH:mm:ss';
            this._timeFormat = 'HH:mm:ss';
            this._decimalPoint = ',';
            this._thousandSep = ' ';
            this._decPrecision = 2;
            this._ajaxTimeOut = 600; //ten minutes
        },
        destroy:function () {
            this._super();
        },
        _setDatePickerRegion:function (v) {
            var regional;
            if (!!v) {
                regional = global.$.datepicker.regional[v];
            }
            else {
                regional = global.$.datepicker.regional[""];
            }
            this.datepickerDefaults = regional;
        },
        toString:function () {
            return 'Defaults';
        }
    }, {
        //timeout for server requests in seconds
        ajaxTimeOut:{
            set:function (v) {
                if (this._ajaxTimeOut !== v) {
                    this._ajaxTimeOut = v;
                    this.raisePropertyChanged('ajaxTimeOut');
                }
            },
            get:function () {
                return  this._ajaxTimeOut;
            }
        },
        //uses jQuery datepicker format
        dateFormat:{
            set:function (v) {
                if (this._datepickerDefaults.dateFormat !== v) {
                    this._datepickerDefaults.dateFormat = v;
                    global.$.datepicker.setDefaults(this._datepickerDefaults);
                    this.raisePropertyChanged('dateFormat');
                }
            },
            get:function () {
                return  this._datepickerDefaults.dateFormat;
            }
        },
        //uses datejs format http://code.google.com/p/datejs/
        timeFormat:{
            set:function (v) {
                if (this._timeFormat !== v) {
                    this._timeFormat = v;
                    this.raisePropertyChanged('timeFormat');
                }
            },
            get:function () {
                return this._timeFormat;
            }
        },
        //uses datejs format http://code.google.com/p/datejs/
        dateTimeFormat:{
            set:function (v) {
                if (this._dateTimeFormat !== v) {
                    this._dateTimeFormat = v;
                    this.raisePropertyChanged('timeFormat');
                }
            },
            get:function () {
                return this._dateTimeFormat;
            }
        },
        datepickerDefaults:{
            set:function (v) {
                if (!v)
                    v = global.$.datepicker.regional[this._datepickerRegional];
                var old = this._datepickerDefaults;
                this._datepickerDefaults = v;
                global.$.datepicker.setDefaults(v);
                if (old.dateFormat !== v.dateFormat) {
                    this.raisePropertyChanged('dateFormat');
                }
            },
            get:function () {
                return this._datepickerDefaults;
            }
        },
        datepickerRegional:{
            set:function (v) {
                if (!v)
                    v = "";
                if (this._datepickerRegional !== v) {
                    this._datepickerRegional = v;
                    this._setDatePickerRegion(v);
                    this.raisePropertyChanged("datepickerRegional");
                }
            },
            get:function () {
                return this._datepickerRegional;
            }
        },
        /*
         path where application images are stored
         */
        imagesPath:{
            set:function (v) {
                if (!v)
                    v = "";
                if (this._imagesPath !== v) {
                    if (!RIAPP.utils.endsWith(v, '/')) {
                        this._imagesPath = v + '/';
                    }
                    else
                        this._imagesPath = v;
                    this.raisePropertyChanged("imagesPath");
                }
            },
            get:function () {
                return this._imagesPath;
            }
        },
        decimalPoint:{
            set:function (v) {
                if (this._decimalPoint !== v) {
                    this._decimalPoint = v;
                    this.raisePropertyChanged("decimalPoint");
                }
            },
            get:function () {
                return this._decimalPoint;
            }
        },
        thousandSep:{
            set:function (v) {
                if (this._thousandSep !== v) {
                    this._thousandSep = v;
                    this.raisePropertyChanged("thousandSep");
                }
            },
            get:function () {
                return this._thousandSep;
            }
        },
        //money decimal presision defaults to 2
        decPrecision:{
            set:function (v) {
                if (this._decPrecision !== v) {
                    this._decPrecision = v;
                    this.raisePropertyChanged("decPrecision");
                }
            },
            get:function () {
                return this._decPrecision;
            }
        }
    }, function (obj) {
        thisModule.Defaults = obj;
    });

    global.defaults = Defaults.create();
    global.defaults.dateFormat = 'dd.mm.yy'; //russian style
    global.defaults.imagesPath = '/Scripts/jriapp/img/';
};

RIAPP.Global._coreModules.utils = function (global) {
    var thisModule = this, base_utils = RIAPP.utils, _newID = 0;

    var check_is = {
        Null:function (a) {
            return a === null;
        },
        Undefined:function (a) {
            return a === undefined;
        },
        //checking for null type
        nt:function (a) {
            return (a === null || a === undefined);
        },
        Function:base_utils.isFunc,
        String:function (a) {
            if (check_is.nt(a)) return false;
            var rx = /string/i;
            return (typeof (a) === 'string') ? true : (typeof (a) === 'object') ? rx.test(a.constructor.toString()) : false;
        },
        Array:base_utils.isArray,
        Boolean:function (a) {
            if (check_is.nt(a)) return false;
            var rx = /boolean/i;
            return (typeof (a) === 'boolean') ? true : (typeof (a) === 'object') ? rx.test(a.constructor.toString()) : false;
        },
        Date:function (a) {
            if (check_is.nt(a)) return false;
            var rx = /date/i;
            return (typeof (a) === 'date') ? true : (typeof (a) === 'object') ? rx.test(a.constructor.toString()) : false;
        },
        HTML:function (a) {
            if (check_is.nt(a)) return false;
            var rx = /html/i;
            return (typeof (a) === 'object') ? rx.test(a.constructor.toString()) : false;
        },
        Number:function (a) {
            if (check_is.nt(a)) return false;
            var rx = /Number/;
            return (typeof (a) === 'number') ? true : (typeof (a) === 'object') ? rx.test(a.constructor.toString()) : false;
        },
        Object:function (a) {
            if (check_is.nt(a)) return false;
            var rx = /object/i;
            return (typeof (a) === 'object') ? rx.test(a.constructor.toString()) : false;
        },
        SimpleObject:function (a) {
            if (check_is.nt(a)) return false;
            var res = check_is.Object(a);
            return res && (Object.prototype === Object.getPrototypeOf(a));
        },
        RegExp:function (a) {
            if (check_is.nt(a)) return false;
            var rx = /regexp/i;
            return (typeof (a) === 'function') ? rx.test(a.constructor.toString()) : false;
        },
        Numeric:function (obj) {
            return check_is.Number(obj) || (check_is.String(obj) && !isNaN(Number(obj)) );
        },
        BoolString:function (a) {
            if (check_is.nt(a)) return false;
            return (a == 'true' || a == 'false');
        }
    };

    var strings = {
        endsWith:base_utils.endsWith,
        startsWith:base_utils.startsWith,
        trim:base_utils.trim,
        /**
         *    Usage:     formatNumber(123456.789, 2, '.', ',');
         *    result:    123,456.79
         **/
        formatNumber:function (number, decimals, dec_point, thousands_sep) {
            number = (number + '').replace(/[^0-9+-Ee.]/g, '');
            var n = !isFinite(+number) ? 0 : +number,
                prec = !isFinite(+decimals) ? 0 : Math.abs(decimals),
                sep = (thousands_sep === undefined) ? ',' : thousands_sep,
                dec = (dec_point === undefined) ? '.' : dec_point,
                s = '',
            // Fix for IE parseFloat(0.55).toFixed(0) = 0;
                toFixedFix = function (n, prec) {
                    var k = Math.pow(10, prec);
                    return '' + Math.round(n * k) / k;
                };

            if (utils.check_is.nt(decimals)) {
                s = ('' + n).split('.');
                prec = 2;
            }
            else
                s = (prec ? toFixedFix(n, prec) : '' + Math.round(n)).split('.');

            var i, s0 = '', len = s[0].length;
            if (len > 3) {
                for (i = 0; i < len; i += 1) {
                    s0 = s0 + s[0].charAt(i);
                    if (i < (len - 1) && (len - i - 1) % 3 === 0)
                        s0 = s0 + sep;
                }
                s[0] = s0;
            }
            if ((s[1] || '').length < prec) {
                s[1] = s[1] || '';
                s[1] += new Array(prec - s[1].length + 1).join('0');
            }
            return s.join(dec);
        },
        stripNonNumeric:function (str) {
            str += '';
            var rgx = /^\d|\.|-$/;
            var out = '';
            for (var i = 0; i < str.length; i++) {
                if (rgx.test(str.charAt(i))) {
                    if (!( ( str.charAt(i) == '.' && out.indexOf('.') != -1 ) ||
                        ( str.charAt(i) == '-' && out.length != 0 ) )) {
                        out += str.charAt(i);
                    }
                }
            }
            return out;
        }
    };

    var validation = {
        checkNumRange:function (num, range) {
            var rangeParts = range.split(',');
            if (!!rangeParts[0]) {
                if (num < parseFloat(rangeParts[0])) {
                    throw new Error(String.format(RIAPP.ERRS.ERR_FIELD_RANGE, num, range));
                }
            }
            if (!!rangeParts[1]) {
                if (num > parseFloat(rangeParts[1])) {
                    throw new Error(String.format(RIAPP.ERRS.ERR_FIELD_RANGE, num, range));
                }
            }
        },
        _dtRangeToDate:function (str) {
            var dtParts = str.split('-');
            var dt = new Date(parseInt(dtParts[0], 10), parseInt(dtParts[1], 10) - 1, dtParts[2]);
            return dt;
        },
        checkDateRange:function (dt, range) {
            var rangeParts = range.split(',');
            if (!!rangeParts[0]) {
                if (dt < validation._dtRangeToDate(rangeParts[0])) {
                    throw new Error(String.format(RIAPP.ERRS.ERR_FIELD_RANGE, dt, range));
                }
            }
            if (!!rangeParts[1]) {
                if (dt > validation._dtRangeToDate(rangeParts[1])) {
                    throw new Error(String.format(RIAPP.ERRS.ERR_FIELD_RANGE, dt, range));
                }
            }
        }
    };

    var utils = {
        str:strings,
        check_is: check_is,
        validation: validation,
        getNewID:function () {
            var id = _newID;
            _newID += 1;
            return id;
        },
        isContained:function (oNode, oCont) {
            if (!oNode) return false;
            while (!!(oNode = oNode.parentNode)) if (oNode === oCont) return true;
            return false;
        },
        slice:Array.prototype.slice,
        get_timeZoneOffset:(function () {
            var dt = new Date();
            var tz = dt.getTimezoneOffset();

            return function () {
                return tz;
            }
        })(),
        parseBool:function (bool_value) {
            var v = base_utils.trim(bool_value).toLowerCase();
            if (v === 'false') return false;
            if (v === 'true') return true;
            throw new Error(utils.format(RIAPP.ERRS.ERR_PARAM_INVALID, 'bool_value', bool_value));
        },
        round:function (number, decimals) {
            return parseFloat(number.toFixed(decimals));
        },
        performAjaxCall:function (url, postData, async, fn_success, fn_error, context) {
            var req = new XMLHttpRequest(), mimeType='application/json; charset=utf-8';
            req.open('POST', url, async);
            var deferred = utils.createDeferred();
            req.responseType = 'text';
            req.onload = function(e) {
                if (this.status == 200) {
                    var res = this.response;
                    deferred.resolve(res);
                }
            };
            req.onerror = function(e){
                deferred.reject(new Error(e.target.status));
            };
            req.ontimeout = function () {
                deferred.reject(new Error("The request for " + url + " timed out."));
            };
            req.timeout = global.defaults.ajaxTimeOut * 1000;
            req.setRequestHeader('Content-Type', mimeType);
            req.send(postData);
            var promise = deferred.promise();

            if (!!fn_success){
                promise.done(function(data){
                    fn_success.call(context, data);
                });
            }

            if (!!fn_error){
                promise.fail(function(err){
                    fn_error.call(context, err);
                });
            }
            return promise;
        },
        performAjaxGet:function(url){
            var req = new XMLHttpRequest();
            req.open('GET', url, true); /* always async mode */
            var deferred = utils.createDeferred();
            req.responseType = 'text';
            req.onload = function(e) {
                if (this.status == 200) {
                    var res = this.response;
                    deferred.resolve(res);
                }
            };
            req.onerror = function(e){
                deferred.reject(new Error(e.target.status));
            };
            req.ontimeout = function () {
                deferred.reject(new Error("The request for " + url + " timed out."));
            };
            req.timeout = global.defaults.ajaxTimeOut * 1000;
            req.send(null);
            var promise = deferred.promise();
            return promise;
        },
        format: base_utils.format,
        extend:function (deep, defaults, options) {
            if (deep)
                return utils.cloneObj(options, defaults);
            else
                return utils.mergeObj(options, defaults);
        },
        removeNode:function (node) {
            if (!node)
                return;
            var pnd = node.parentNode;
            if (!!pnd)
                pnd.removeChild(node);
        },
        insertAfter:function (referenceNode, newNode) {
            var parent = referenceNode.parentNode;
            if (parent.lastChild === referenceNode)
                parent.appendChild(newNode);
            else
                parent.insertBefore(newNode, referenceNode.nextSibling);
        },
        getProps:function (obj) {
            return Object.getOwnPropertyNames(obj);
        },
        forEachProp:function (obj, fn) {
            var names = Object.getOwnPropertyNames(obj);
            names.forEach(fn);
        },
        addToolTip:function ($el, tip, className) {
            var options = {
                content:{
                    text:tip
                },
                style:{
                    classes:!!className ? className : null
                },
                position:{
                    my:'top left',
                    at:'bottom right',
                    target:$el,
                    viewport:$(global.window),
                    adjust:{
                        method:'flip none',
                        x:0,
                        y:0
                    }
                },
                hide:{
                    fixed:true,
                    delay:250
                }
            };
            if (!!$el.data('qtip')) {
                if (!tip) {
                    $el.qtip('destroy');
                }
                else
                    $el.qtip('option', 'content.text', tip);
            }
            else if (!!tip) {
                $el.qtip(options);
            }
        },
        hasProp:function (obj, prop) {
            if (!obj)
                return false;
            var res = obj.hasOwnProperty(prop);
            if (res)
                return true;
            else {
                if (Object === obj)
                    return false;
                else {
                    var pr = Object.getPrototypeOf(obj);
                    return utils.hasProp(pr, prop);
                }
            }
        },
        createDeferred:function () {
            return global.$.Deferred();
        },
        cloneObj:function (o, mergeIntoObj) {
            var c, i, len;
            if (!o) {
                return o;
            }

            if (check_is.Array(o)){
                len = o.length;
                c = new Array(len);
                for (i = 0; i < len; i += 1) {
                    c[i] = utils.cloneObj(o[i], null);
                }
            }
            else if (check_is.SimpleObject(o)){
                //clone only simple objects
                c = mergeIntoObj || {};
                var p, keys = Object.getOwnPropertyNames(o);
                len = keys.length;
                for (i = 0; i < len; i += 1) {
                    p = keys[i];
                    c[p] = utils.cloneObj(o[p], null);
                }
            }
            else
                return o;
            return c;
        },
        shallowCopy:function (o) {
            return utils.mergeObj(o,{});
        },
        mergeObj: function(obj, mergeIntoObj){
            if (!mergeIntoObj){
                mergeIntoObj = {};
            }
            if (!obj)
                return mergeIntoObj;
            var names = Object.getOwnPropertyNames(obj), n;
            for(var i= 0,len=names.length;i<len;i+=1){
                n = names[i];
                mergeIntoObj[n] = obj[n];
            }
            return mergeIntoObj;
        },
        removeFromArray:function(array,obj){
            var i = array.indexOf(obj);
            if (i > -1) {
                array.splice(i, 1);
            }
            return i;
        },
        insertIntoArray:function(array,obj,pos){
            array.splice(pos, 0, obj);
        },
        destroyJQueryPlugin: function($el,name){
            var plugin = $el.data(name);
            if (!!plugin){
                $el[name]('destroy');
            }
        },
        /*
         * Generate a random uuid.
         *
         * USAGE: utils.uuid(length, radix)
         *   length - the desired number of characters
         *   radix  - the number of allowable values for each character.
         *
         * EXAMPLES:
         *   // No arguments  - returns RFC4122, version 4 ID
         *   >>> utils.uuid()
         *   "92329D39-6F5C-4520-ABFC-AAB64544E172"
         *
         *   // One argument - returns ID of the specified length
         *   >>> utils.uuid(15)     // 15 character ID (default base=62)
         *   "VcydxgltxrVZSTV"
         *
         *   // Two arguments - returns ID of the specified length, and radix. (Radix must be <= 62)
         *   >>> utils.uuid(8, 2)  // 8 character ID (base=2)
         *   "01001010"
         *   >>> utils.uuid(8, 10) // 8 character ID (base=10)
         *   "47473046"
         *   >>> utils.uuid(8, 16) // 8 character ID (base=16)
         *   "098F4D35"
         */
        uuid:(function () {
            // Private array of chars to use
            var CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');

            return function (len, radix) {
                var i, chars = CHARS, uuid = [], rnd = Math.random;
                radix = radix || chars.length;

                if (!!len) {
                    // Compact form
                    for (i = 0; i < len; i += 1) uuid[i] = chars[0 | rnd() * radix];
                } else {
                    // rfc4122, version 4 form
                    var r;

                    // rfc4122 requires these characters
                    uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
                    uuid[14] = '4';

                    // Fill in random data.  At i==19 set the high bits of clock sequence as
                    // per rfc4122, sec. 4.1.5
                    for (i = 0; i < 36; i += 1) {
                        if (!uuid[i]) {
                            r = 0 | rnd() * 16;
                            uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r & 0xf];
                        }
                    }
                }

                return uuid.join('');
            };
        })()
    };

    //LifeTimeScope used to hold references to objects and destroys them all when LifeTimeScope is destroyed itself
    var LifeTimeScope = RIAPP.BaseObject.extend({
        _cnt:0,
        _create:function () {
            this._super();
            this._objs = [];
            LifeTimeScope._cnt += 1;
            this._cnt = LifeTimeScope._cnt;
        },
        addObj:function (b) {
            if (this._objs.indexOf(b) < 0)
                this._objs.push(b);
        },
        removeObj:function (b) {
            utils.removeFromArray(this._objs,b);
        },
        getObjs:function () {
            return this._objs;
        },
        destroy:function () {
            this._objs.forEach(function (obj) {
                if (!obj._isDestroyCalled)
                    obj.destroy();
            });
            this._objs = [];
            this._super();
        },
        toString:function () {
            return 'LifeTimeScope '+this._cnt;
        }
    }, null, function (obj) {
        thisModule.LifeTimeScope = obj;
    });

    thisModule.PropWatcher = RIAPP.BaseObject.extend({
        _create:function () {
            this._super();
            this._objId = 'prw' + utils.getNewID();
            this._objs = [];
        },
        addPropWatch:function (obj, prop, fn_onChange) {
            var self = this;
            obj.addOnPropertyChange(prop, function (s, a) {
                fn_onChange(a.property);
            }, self.uniqueID);

            if (self._objs.indexOf(obj) < 0)
                self._objs.push(obj);
        },
        addWatch:function (obj, props, fn_onChange) {
            var self = this;
            obj.addOnPropertyChange('*', function (s, a) {
                if (props.indexOf(a.property) > -1) {
                    fn_onChange(a.property);
                }
            }, self.uniqueID);

            if (self._objs.indexOf(obj) < 0)
                self._objs.push(obj);
        },
        removeWatch:function (obj) {
            obj.removeNSHandlers(this.uniqueID);
        },
        destroy:function () {
            var self = this;
            this._objs.forEach(function (obj) {
                self.removeWatch(obj);
            });
            this._objs = [];
            this._super();
        },
        toString:function () {
            return 'PropWatcher ' + this._objId;
        }
    }, {
        uniqueID:{
            get:function () {
                return this._objId;
            }
        }
    }, function(obj){
        global.registerType('PropWatcher',obj);
    });
    // waits for property change on the object (the owner)
    // then checks queue of actions for the property change
    // based on property value checking predicate
    // if the predicate returns true, invokes the task's action
    thisModule.WaitQueue = RIAPP.BaseObject.extend({
        _create:function (owner) {
            this._super();
            this._objId = 'wq' + utils.getNewID();
            this._owner = owner;
            this._queue = {}
        },
        _checkQueue:function (prop, value) {
            if (!this._owner || this._owner._isDestroyCalled) {
                return;
            }
            var self = this, propQueue = this._queue[prop], task;
            if (!propQueue || propQueue.length == 0) {
                return;
            }

            var i, firstWins, groups = {group:null, arr:[]}, found = [], forRemoval = [];

            for (i = 0; i < propQueue.length; i += 1) {
                task = propQueue[i];
                if (task.predicate(value)) {
                    if (!task.group && groups.arr.length == 0) {
                        firstWins = task;
                        break;
                    }
                    else if (!!task.group) { //the task in the group of tasks
                        if (!groups.group) {
                            groups.group = task.group;
                        }
                        if (groups.group === task.group) {
                            groups.arr.push(task); //if the task in the same group, add it to the array
                        }
                    }
                }
            }

            if (!!firstWins) { //the first task will be executed, in normal queued order, the rest tasks are waiting
                found.push(firstWins);
                forRemoval.push(firstWins);
            }
            else {
                while (groups.arr.length > 0) {
                    task = groups.arr.pop();
                    if (!firstWins) {
                        firstWins = task;
                    }

                    if (firstWins.lastWins) { //the last task wins, the rest is ignored
                        if (found.length == 0)
                            found.push(task); //add only the last task, the rest just remove from queue
                    }
                    else
                        found.push(task); //add all tasks in the group, they will be executed all
                    forRemoval.push(task);
                }
            }

            try {
                if (found.length > 0) {
                    i = propQueue.length;
                    while (i > 0) {
                        i -= 1;
                        if (forRemoval.indexOf(propQueue[i]) > -1) {
                            propQueue.splice(i, 1);
                        }
                    }

                    found.forEach(function (task) {
                        try {
                            task.action.apply(self._owner, task.args);
                        }
                        catch (ex) {
                            self._owner._onError(ex, self);
                        }
                    });
                }
            }
            finally {
                if (propQueue.length == 0) {
                    delete this._queue[prop];
                    this._owner.removeOnPropertyChange(prop, this.uniqueID);
                }
            }
        },
        enQueue:function (options) {
            var opts = utils.extend(false, {
                prop:"",
                groupName:null,
                predicate:null,
                action:null,
                actionArgs:[],
                lastWins:false,
                syncCheck:false
            }, options);

            var self = this;
            if (!this._owner)
                return;
            var property = opts.prop, propQueue = this._queue[property];

            if (!propQueue) {
                propQueue = [];
                this._queue[property] = propQueue;
                this._owner.addOnPropertyChange(property, function (s, a) {
                    setTimeout(function () {
                        if (self._isDestroyCalled)
                            return;
                        self._checkQueue(property, self._owner[property]);
                    }, 0);
                }, self.uniqueID);
            }
            var task = {predicate:opts.predicate,
                action:opts.action,
                group:opts.groupName,
                lastWins:opts.lastWins,
                args:(!opts.actionArgs ? [] : opts.actionArgs)
            };
            propQueue.push(task);
            if (!!opts.syncCheck) {
                self._checkQueue(property, self._owner[property]);
            }
            else {
                setTimeout(function () {
                    if (self._isDestroyCalled)
                        return;
                    self._checkQueue(property, self._owner[property]);
                }, 0);
            }
        },
        destroy:function () {
            this._owner.removeOnPropertyChange(null, this.uniqueID);
            this._queue = {};
            this._owner = null;
            this._super();
        },
        toString:function () {
            return 'WaitQueue ' + this._objId;
        }
    }, {
        uniqueID:{
            get:function () {
                return this._objId;
            }
        },
        owner:{
            get:function () {
                return this._owner;
            }
        }
    }, null);

    utils.mergeObj(utils, thisModule);
    global.utils = thisModule; //for more speedy access
};

RIAPP.Global._coreModules.riapp = function (global) {
    var thisModule = this, utils = global.utils, consts = global.consts, coreModules = {}, userModules = {};

    var AppType = RIAPP.BaseObject.extend({
            _DATA_BIND_SELECTOR:['*[', consts.DATA_ATTR.DATA_BIND, ']'].join(''),
            _TEMPLATES_DATA_BIND_SELECTOR:['section.', RIAPP.css_riaTemplate, ' *[', consts.DATA_ATTR.DATA_BIND, ']'].join(''),
            //static method
            registerModule:function (name, fn_module) {
                if (!!userModules[name])
                    throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_MODULE_ALREDY_REGISTERED, name));
               userModules[name] = fn_module;
            },
            _create:function (options) {
                this._super();
                var self = this, opts = utils.extend(false, { app_name:'default',
                        service_url:'',
                        metadata:null,
                        createDbContext:true,
                        moduleNames:[]
                    }, options),
                    app_name = opts.app_name, curMod;
                if (!!global.findApp(app_name))
                    throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_APP_NAME_NOT_UNIQUE, app_name));
                Object.freeze(opts);
                this._options = opts;
                this._parser = null;
                this._converters = {};
                this._dbContext = null;
                this._lftmBind = null; //lifetime object to store references to the bindings created by this application
                this._instanceNum = global._getNextAppNum();
                this._ELV_STORE_KEY = consts.DATA_ATTR.EL_VIEW_KEY + this._instanceNum;
                this._bindingContentFactory = null;
                this._modInst = {};
                this._exports = {}; //registered exported types
                this._elViews = {}; //registered element view types
                //each Element view created by application stored in this hash map
                //it keeps them alive until they are destroyed
                this._elViewStore = {};
                this._global = global;
                //used to create sequential keys to store new element views
                this._nextElViewStoreKey = 0;
                this._userCode = {};
                this._viewModels = {};
                var i, len;
                //initialize core Modules
                for (i = 0, len = RIAPP._app_modules.length; i < len; i += 1) {
                    curMod = {};
                    coreModules[RIAPP._app_modules[i]].apply(curMod, [self]);
                    Object.freeze(curMod);
                    this._modInst[RIAPP._app_modules[i]] = curMod;
                }

                var mod_names = (utils.check_is.Array(opts.moduleNames) && opts.moduleNames.length > 0) ? opts.moduleNames : [];
                //initialize Modules added by user
                for (i = 0, len = mod_names.length; i < len; i += 1) {
                    if (!userModules[mod_names[i]]) {
                        throw new Error(String.format(RIAPP.ERRS.ERR_MODULE_UNDEFINED, mod_names[i]));
                    }
                    curMod = {};
                    userModules[mod_names[i]].apply(curMod, [self]);
                    Object.freeze(curMod);
                    this._modInst[mod_names[i]] = curMod;
                }
                //register self instance
                global._registerApp(this);
            },
            destroy:function () {
                if (this._isDestroyed)
                    return;
                
                var self = this;
                global._unregisterApp(self);
                self._destroyBindings();
                if (!!self._dbContext) {
                    self._dbContext.destroy();
                    self._dbContext = null;
                }
                self._elViews = {};
                self._exports = {};
                self._global = null;
                self._options = null;
                self._parser = null;
                self._converters = {};
                self._elViewStore = {};
                self._userCode = {};
                self._viewModels = {};
                self._modInst = {};
                self._bindingContentFactory = null;
                self._super();
            },
            _getEventNames:function () {
                var base_events = this._super();
                return ['define_calc'].concat(base_events);
            },
            _onError:function (error, source) {
                if (global._checkIsDummy(error)) {
                    return true;
                }
                var isHandled = this._super(error, source);
                if (!isHandled) {
                    return global._onError(error, source);
                }
                return isHandled;
            },
            _onGetCalcField:function (args) {
                this.raiseEvent('define_calc', args);
            },
            _getBindingOption:function (options, defaultTarget, defaultSource) {
                var BINDING_MODE = this.modules.binding.BINDING_MODE,
                opts = {
                    mode:BINDING_MODE[1],
                    converterParam:null,
                    converter:null,
                    targetPath:null,
                    sourcePath:null,
                    target:null,
                    source:null,
                    isSourceFixed:false
                };

                var fixedSource = options.source, fixedTarget = options.target;

                if (!options.sourcePath && !!options.to)
                    opts.sourcePath = options.to;
                else if (!!options.sourcePath)
                    opts.sourcePath = options.sourcePath;
                if (!!options.targetPath)
                    opts.targetPath = options.targetPath;
                if (!!options.converterParam)
                    opts.converterParam = options.converterParam;
                if (!!options.mode)
                    opts.mode = options.mode;

                if (!!options.converter){
                    if (utils.check_is.String(options.converter))
                        opts.converter = this.getConverter(options.converter);
                    else
                        opts.converter = options.converter;
                }


                if (!fixedTarget)
                    opts.target = defaultTarget;
                else {
                    if (utils.check_is.String(fixedTarget)) {
                        if (fixedTarget == 'this')
                            opts.target = defaultTarget;
                        else
                            opts.target = this.parser.resolveBindingSource(this, this.parser._getPathParts(fixedTarget));
                        //target evaluation starts from this app
                    }
                    else
                        opts.target = fixedTarget;
                }

                if (!fixedSource) {
                    opts.source = defaultSource; //if source is not supplied use defaultSource parameter as source
                }
                else {
                    opts.isSourceFixed = true;
                    if (utils.check_is.String(fixedSource)) {
                        if (fixedSource == 'this') {
                            opts.source = defaultTarget;
                        }
                        else
                            opts.source = this.parser.resolveBindingSource(this, this.parser._getPathParts(fixedSource));
                        //source evaluation starts from this app
                    }
                    else
                        opts.source = fixedSource;
                }

                return opts;
            },
            _getElViewType:function (name) {
                return this._elViews[name];
            },
            //get element view associated with HTML element (if any)
            _getElView:function (el) {
                var storeID = el.getAttribute(this._ELV_STORE_KEY);
                if (!!storeID) {
                    return this._elViewStore[storeID];
                }
                return null;
            },
            //store association of HTML element with its element View
            _setElView:function (el, view) {
                var storeID = el.getAttribute(this._ELV_STORE_KEY);
                if (!storeID) {
                    if (!view)
                        return;
                    storeID = 's_' + this._nextElViewStoreKey;
                    this._nextElViewStoreKey += 1;
                    el.setAttribute(this._ELV_STORE_KEY, storeID);
                    this._elViewStore[storeID] = view;
                }
                else {
                    if (!view) {
                        el.removeAttribute(this._ELV_STORE_KEY);
                        delete this._elViewStore[storeID];
                    }
                    else {
                        this._elViewStore[storeID] = view;
                    }
                }
            },
            //check if element is used as DataForm
            _isDataForm:function (el) {
                if (!el)
                    return false;
                var attr = el.getAttribute(consts.DATA_ATTR.DATA_VIEW);
                if (!attr) {
                    return false;
                }
                var opts = this.parser.parseOptions(attr);
                return (opts.length > 0 && opts[0].name === consts.ELVIEW_NM.DATAFORM);
            },
            //check if element is placed inside DataForm
            _isInsideDataForm:function (el) {
                if (!el)
                    return false;
                var parent = el.parentElement;
                if (!!parent) {
                    if (!this._isDataForm(parent)) {
                        return this._isInsideDataForm(parent);
                    }
                    else
                        return true;
                }
                return false;
            },
            //checks for binding html elements attributes and parses attribute data to create binding for elements
            _bindTemplateElements:function (templateEl) {
                var self = this, allBoundElem = Array.fromList(templateEl.querySelectorAll(self._DATA_BIND_SELECTOR));
                var lftm = utils.LifeTimeScope.create();
                if (templateEl.hasAttribute(consts.DATA_ATTR.DATA_BIND)) {
                    allBoundElem.push(templateEl);
                }

                allBoundElem.forEach(function (target) {
                    var op, j, len, binding, bindstr, temp_opts, elView;
                    if (self._isInsideDataForm(target))
                        return;
                    bindstr = target.getAttribute(consts.DATA_ATTR.DATA_BIND);
                    target.removeAttribute(consts.DATA_ATTR.DATA_BIND);
                    temp_opts = self.parser.parseOptions(bindstr);
                    elView = self.getElementView(target);
                    lftm.addObj(elView);
                    for (j = 0, len = temp_opts.length; j < len; j += 1) {
                        op = self._getBindingOption(temp_opts[j], elView, null);
                        binding = self.bind(op);
                        op.target = null;
                        lftm.addObj(binding);
                    }
                });

                return lftm;
            },
            _bindElements:function (scope, dctx, isDataForm) {
                var self = this;
                scope = scope || global.document;
                //select all elements with binding attributes inside templates
                var allBoundElem = Array.fromList(scope.querySelectorAll(self._DATA_BIND_SELECTOR));
                var lftm = utils.LifeTimeScope.create();

                allBoundElem.forEach(function (target) {
                    var app_name, binding, bindstr, temp_opts, bind_op, elView;
                    if (!isDataForm && self._isInsideDataForm(target)) { //skip elements inside dataform
                        return;
                    }

                    if (!isDataForm) {
                        if (target.hasAttribute(consts.DATA_ATTR.DATA_APP)) {
                            app_name = target.getAttribute(consts.DATA_ATTR.DATA_APP);
                        }

                        //check for which application this binding is for
                        if (!!app_name && self.appName !== app_name)
                            return;
                        if (!app_name && self.appName !== 'default')
                            return;
                    }

                    //else proceed create binding
                    bindstr = target.getAttribute(consts.DATA_ATTR.DATA_BIND);
                    elView = self.getElementView(target);
                    lftm.addObj(elView);
                    temp_opts = self.parser.parseOptions(bindstr);
                    for (var i = 0, len = temp_opts.length; i < len; i += 1) {
                        bind_op = self._getBindingOption(temp_opts[i], elView, dctx);
                        binding = self.bind(bind_op);
                        lftm.addObj(binding);
                    }
                });
                return lftm;
            },
            //used as factory to create Data Contents
            _getContent:function (contentType, options, parentEl, dctx, isEditing) {
                var content;
                if (!!options.templateInfo) {
                    content = contentType.create(parentEl, options.templateInfo, dctx, isEditing);
                }
                else if (!!options.bindingInfo) {
                    content = contentType.create(parentEl, options, dctx, isEditing);
                }
                else {
                    throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_PARAM_INVALID, 'options', 'bindingInfo'));
                }

                return content;
            },
            _getContentType:function (options) {
                var content;
                if (!!options.templateInfo) {
                    content = this.modules.baseContent.TemplateContent;
                }
                else if (!!options.bindingInfo) {
                    content = this.bindingContentFactory.getContentType(options);
                }
                else {
                    throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_PARAM_INVALID, 'options', 'bindingInfo'));
                }

                return content;
            },
            _parseContentAttr:function (content_attr) {
                var defaultOp = {
                    templateInfo:null,
                    bindingInfo:null,
                    displayInfo:null,
                    fieldName:null
                };
                var temp_opts = this.parser.parseOptions(content_attr);
                if (temp_opts.length === 0)
                    return defaultOp;
                var op = temp_opts[0];
                if (!op.template && !!op.fieldName) {
                    var bindOpt = { target:null, source:null,
                        targetPath:null, sourcePath:op.fieldName, mode:"OneWay",
                        converter:null, converterParam:null
                    };
                    op.bindingInfo = bindOpt;
                    op.displayInfo = op.css;
                }
                else if (!!op.template) {
                    op.templateInfo = op.template;
                    delete op.template;
                }
                return utils.extend(false, defaultOp, op);
            },
            _destroyBindings:function () {
                if (!!this._lftmBind) {
                    this._lftmBind.destroy();
                    this._lftmBind = null;
                }
            },
            getNewObjectID:function () {
                return utils.getNewID();
            },
            setUpBindings:function () {
                var defScope = global.document, defDctxt = this;
                this._destroyBindings();
                this._lftmBind = this._bindElements(defScope, defDctxt, false);
            },
            registerElView:function (name, type) {
                if (!this._elViews[name])
                    this._elViews[name] = type;
            },
            getElementView:function (el) {
                var viewType, attr, attr_obj_arr, attr_obj, options, elView;

                elView = this._getElView(el);
                if (!!elView) //view already created for this element
                    return elView;

                //proceed to create new element view...
                if (el.hasAttribute(consts.DATA_ATTR.DATA_VIEW)) {
                    attr = el.getAttribute(consts.DATA_ATTR.DATA_VIEW);
                    attr_obj_arr = this.parser.parseOptions(attr);
                    if (!!attr_obj_arr && attr_obj_arr.length > 0) {
                        attr_obj = attr_obj_arr[0];
                        if (!!attr_obj.name && attr_obj.name !== 'default') {
                            viewType = this._getElViewType(attr_obj.name); //try get view by explicit view name
                            if (!viewType)
                                throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_ELVIEW_NOT_REGISTERED, attr_obj.name));
                        }
                        if (!!attr_obj.options)
                            options = attr_obj.options;
                    }
                }

                if (!viewType) {
                    var nodeNm = el.nodeName.toLowerCase(), type;
                    switch (nodeNm) {
                        case 'input':
                        {
                            type = el.getAttribute('type');
                            nodeNm = nodeNm + ':' + type;
                            viewType = this._getElViewType(nodeNm);
                        }
                            break;
                        default:
                            viewType = this._getElViewType(nodeNm);
                    }

                    if (!viewType)
                        throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_ELVIEW_NOT_CREATED, nodeNm));
                }

                elView = viewType.create(el, options || {});
                return elView;
            },
            registerConverter:function (name, obj) {
                if (!this._converters[name]) {
                    this._converters[name] = obj;
                }
                else
                    throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_TYPE_ALREDY_REGISTERED, name));
            },
            getConverter:function (name) {
                var res = this._converters[name];
                if (!res)
                    throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_CONVERTER_NOTREGISTERED, name));
                return res;
            },
            registerType:function (name, obj) {
                return global._registerType(this, name, obj);
            },
            getType:function (name) {
                var res = global._getType(this, name);
                if (!res) {
                    res = global._getType(this.global, name);
                }
                return res;
            },
            bind:function (opts) {
                return this.getType('Binding').create(opts);
            },
            //set up application - use fn_sandbox callback to setUp handlers on objects, create viewModels and etc.
            startUp:function (fn_sandbox) {
                var self = this, fn_init = function () {
                    fn_sandbox.apply(self, [self]);
                    self.setUpBindings();
                };

                try {
                    if (!utils.check_is.Function(fn_sandbox))
                        throw new Error(RIAPP.ERRS.ERR_APP_SETUP_INVALID);
                    if (self.options.createDbContext) {
                        self._dbContext = self.getType('DbContext').create();
                        self._dbContext.addHandler('define_calc', function (s, a) {
                            self._onGetCalcField(a);
                        });
                        self._dbContext.initialize({
                            serviceUrl:self.options.service_url,
                            metadata:self.options.metadata
                        });
                        global._waitForNotLoading(function(){
                            self._dbContext.waitForInitialized(fn_init, null);
                        },null);
                    }
                    else {
                        global._waitForNotLoading(fn_init,null);
                    }
                }
                catch (ex) {
                    global.reThrow(ex, self._onError(ex, self));
                }
            },
            /*
             loads a group of templates from the server
             */
            loadTemplates:function (url) {
               this.loadTemplatesAsync(function(){
                    return global.utils.performAjaxGet(url);
                });
            },
            /*
             loads a group of templates from the server
            */
            loadTemplatesAsync:function (fn_loader) {
                global._loadTemplatesAsync(fn_loader,this);
            },
            /*
                fn_loader must load template and return promise which resolves
                with loaded HTML string
            */
            registerTemplateLoader:function (name, fn_loader) {
                global._registerTemplateLoader(this.appName+'.'+name, fn_loader);
            },
            getTemplateLoader:function (name) {
                var res = global._getTemplateLoader(this.appName+'.'+name);
                if (!res){
                    res = global._getTemplateLoader(name);
                }
                return res;
            },
            toString:function () {
                return 'Application' + this._instanceNum;
            }
        },
        {
            _coreModules:{
                get:function () {
                    return coreModules;
                }
            },
            bindingContentFactory:{
                get:function () {
                    return this._bindingContentFactory;
                },
                set:function (v) {
                    this._bindingContentFactory = v;
                }
            },
            options:{
                get:function () {
                    return this._options;
                }
            },
            modules:{
                get:function () {
                    return this._modInst;
                }
            },
            parser:{
                get:function () {
                    return this._parser;
                }
            },
            instanceNum:{
                get:function () {
                    return this._instanceNum;
                }
            },
            appName:{
                get:function () {
                    return this.options.app_name;
                }
            },
            global:{
                get:function () {
                    return this._global;
                }
            },
            dbContext:{
                get:function () {
                    return this._dbContext;
                }
            },
            //Namespace for custom user code (functions and objects)
            UC:{
                get:function () {
                    return this._userCode;
                }
            },
            //Namespace for adding application viewmodels
            VM:{
                get:function () {
                    return this._viewModels;
                }
            },
            //returns self reference
            app:{
                get:function () {
                    return this;
                }
            },
            localizable:{
                get:function () {
                    return RIAPP.localizable;
                }
            }
        }, function (obj) {
            thisModule.Application = obj;
            global.registerType('Application', obj);
        });

    //shortcut name for the Application type
    RIAPP.Application = AppType;
};

/* Singleton object instance that is shared among all Apps
 defines types in global namespace */
RIAPP.global = RIAPP.Global.create(window, jQuery, []);

RIAPP.Application._coreModules.converter = function (app) {
    var global = app.global, utils = global.utils, strings = utils.str;
    var NUM_CONV = { None:0, Integer:1, Decimal:2, Float:3, SmallInt:4 };

    var BaseConverter = RIAPP.BaseObject.extend({
        convertToSource:function (val, param, dataContext) {
            return val;
        },
        convertToTarget:function (val, param, dataContext) {
            if (utils.check_is.nt(val))
                return null;
            return val;
        }
    }, null, function (obj) {
        app.registerType('BaseConverter', obj);
        app.registerConverter('BaseConverter', obj);
    });

    var DateConverter = BaseConverter.extend({
        convertToSource:function (val, param, dataContext) {
            if (!val)
                return null;
            return global.$.datepicker.parseDate(param, val);
        },
        convertToTarget:function (val, param, dataContext) {
            if (utils.check_is.nt(val))
                return '';
            return global.$.datepicker.formatDate(param, val);
        },
        toString:function () {
            return 'DateConverter';
        }
    }, null, function (obj) {
        app.registerConverter('dateConverter', obj);
    });

    var DateTimeConverter = BaseConverter.extend({
        convertToSource:function (val, param, dataContext) {
            if (!val)
                return null;
            var res = Date.parseExact(val, param);
            if (!res) {
                throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_CONV_INVALID_DATE, val));
            }
            return res;
        },
        convertToTarget:function (val, param, dataContext) {
            if (utils.check_is.nt(val)) {
                return '';
            }
            return val.toString(param);
        },
        toString:function () {
            return 'DateTimeConverter';
        }
    }, null, function (obj) {
        app.registerConverter('dateTimeConverter', obj);
    });

    var NumberConverter = BaseConverter.extend({
        convertToSource:function (val, param, dataContext) {
            if (utils.check_is.nt(val))
                return null;
            var defaults = global.defaults, dp = defaults.decimalPoint, thousand_sep = defaults.thousandSep, prec = 4;
            var value = val.replace(thousand_sep, '');
            value = value.replace(dp, '.');
            value = strings.stripNonNumeric(value);
            if (value === '') {
                return null;
            }
            var num = null;
            switch (param) {
                case NUM_CONV.SmallInt:
                    num = parseInt(value, 10);
                    break;
                case NUM_CONV.Integer:
                    num = parseInt(value, 10);
                    break;
                case NUM_CONV.Decimal:
                    prec = defaults.decPrecision;
                    num = utils.round(parseFloat(value), prec);
                    break;
                case NUM_CONV.Float:
                    num = parseFloat(value);
                    break;
                default:
                    num = Number(value);
            }

            if (!utils.check_is.Number(num)) {
                throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_CONV_INVALID_NUM, val));
            }
            return num;
        },
        convertToTarget:function (val, param, dataContext) {
            if (utils.check_is.nt(val)) {
                return '';
            }
            var defaults = global.defaults, dp = defaults.decimalPoint, thousand_sep = defaults.thousandSep, prec;
            switch (param) {
                case NUM_CONV.Integer:
                    prec = 0;
                    return strings.formatNumber(val, prec, dp, thousand_sep);
                case NUM_CONV.Decimal:
                    prec = defaults.decPrecision;
                    return strings.formatNumber(val, prec, dp, thousand_sep);
                case NUM_CONV.SmallInt:
                    prec = 0;
                    return strings.formatNumber(val, prec, dp, '');
                case NUM_CONV.Float:
                    //float number type preserves all number precision
                    return strings.formatNumber(val, null, dp, thousand_sep);
                    break;
                default:
                    return strings.formatNumber(val, null, dp, thousand_sep);
            }
        },
        toString:function () {
            return 'NumberConverter';
        }
    }, null, function (obj) {
        app.registerConverter('numberConverter', obj);
    });

    var IntegerConverter = BaseConverter.extend({
        convertToSource:function (val, param, dataContext) {
            return NumberConverter.convertToSource(val, NUM_CONV.Integer, dataContext);
        },
        convertToTarget:function (val, param, dataContext) {
            return NumberConverter.convertToTarget(val, NUM_CONV.Integer, dataContext);
        },
        toString:function () {
            return 'IntegerConverter';
        }
    }, null, function (obj) {
        app.registerConverter('integerConverter', obj);
    });

    var SmallIntConverter = BaseConverter.extend({
        convertToSource:function (val, param, dataContext) {
            return NumberConverter.convertToSource(val, NUM_CONV.SmallInt, dataContext);
        },
        convertToTarget:function (val, param, dataContext) {
            return NumberConverter.convertToTarget(val, NUM_CONV.SmallInt, dataContext);
        },
        toString:function () {
            return 'SmallIntConverter';
        }
    }, null, function (obj) {
        app.registerConverter('smallIntConverter', obj);
    });

    var DecimalConverter = BaseConverter.extend({
        convertToSource:function (val, param, dataContext) {
            return NumberConverter.convertToSource(val, NUM_CONV.Decimal, dataContext);
        },
        convertToTarget:function (val, param, dataContext) {
            return NumberConverter.convertToTarget(val, NUM_CONV.Decimal, dataContext);
        },
        toString:function () {
            return 'DecimalConverter';
        }
    }, null, function (obj) {
        app.registerConverter('decimalConverter', obj);
    });

    var FloatConverter = BaseConverter.extend({
        convertToSource:function (val, param, dataContext) {
            return NumberConverter.convertToSource(val, NUM_CONV.Float, dataContext);
        },
        convertToTarget:function (val, param, dataContext) {
            return NumberConverter.convertToTarget(val, NUM_CONV.Float, dataContext);
        },
        toString:function () {
            return 'FloatConverter';
        }
    }, null, function (obj) {
        app.registerConverter('floatConverter', obj);
    });
};

RIAPP.Application._coreModules.parser = function (app) {
    var global = app.global, utils = global.utils;
    var strings = utils.str;

    var Parser = RIAPP.BaseObject.extend({
        __trimOuterBracesRX:/^([{]){0,1}|([}]){0,1}$/g,
        __trimQuotsRX:/^(['"])+|(['"])+$/g,
        __trimBracketsRX:/^(\[)+|(\])+$/g,
        __indexedPropRX:/(^\w+)\s*\[\s*['"]?\s*([^'"]+)\s*['",]?\s*\]/i, //regex expression to extract parts from obj[index] strings
        __valueDelimeter1:':',
        __valueDelimeter2:'=',
        __keyValDelimeter:',',
        _getPathParts:function (path) {
            var self = this, parts = (!path) ? [] : path.split('.'), parts2 = [];
            parts.forEach(function (part) {
                var matches, obj, index;
                matches = part.match(self.__indexedPropRX);
                if (!!matches) {
                    obj = matches[1];
                    index = matches[2];
                    parts2.push(obj);
                    parts2.push('[' + index + ']');
                }
                else
                    parts2.push(part);
            });

            return parts2;
        },
        _resolveProp:function (obj, prop) {
            var collMod;
            if (!prop)
                return obj;
            if (strings.startsWith(prop, '[')) { //it is indexed property, obj must be of collection type
                collMod = app.modules.collection;
                prop = this.trimQuotes(this.trimBrackets(prop));
                if (collMod.Dictionary.isPrototypeOf(obj)) {
                    return obj.getItemByKey(prop);
                }
                else if (collMod.Collection.isPrototypeOf(obj)) {
                    return obj.getItemByPos(parseInt(prop, 10));
                }
                else if (RIAPP.utils.isArray(obj)) {
                    return obj[parseInt(prop, 10)];
                }
                else
                    return obj[prop];
            }
            else
                return obj[prop];
        },
        _resolvePath:function (root, parts) {
            if (!root)
                return undefined;

            if (parts.length === 0) {
                return root;
            }

            if (parts.length === 1) {
                return this._resolveProp(root, parts[0]);
            }
            else {
                return this._resolvePath(this._resolveProp(root, parts[0]), parts.slice(1));
            }
        },
        _setPropertyValue:function (obj, prop, val) {
            if (RIAPP.utils.startsWith(prop, '[')) { //it is indexed property, obj must be of collection type
                prop = this.trimQuotes(this.trimBrackets(prop));  //remove brakets from string like: [index]
                if (RIAPP.utils.isArray(obj)) {
                    obj[parseInt(prop, 10)] = val;
                }
                else
                    obj[prop] = val;
            }
            else
                obj[prop] = val;
        },
        //extract key - value pairs
        _getKeyVals:function (val) {
            var i, ch, literal, parts = [], kv = {key:'', val:''}, isKey = true, bracePart,
                vd1 = this.__valueDelimeter1, vd2 = this.__valueDelimeter2, kvd = this.__keyValDelimeter;

            var addNewKeyValPair = function (kv) {
                if (kv.val) {
                    if (utils.check_is.Numeric(kv.val)) {
                        kv.val = Number(kv.val);
                    }
                    else if (utils.check_is.BoolString(kv.val)) {
                        kv.val = utils.parseBool(kv.val);
                    }
                }
                parts.push(kv);
            };

            var checkTokens = function (kv) {
                //key starts with this like used in binding expressions this.property
                if (kv.val === '' && strings.startsWith(kv.key, 'this.')) {
                    kv.val = kv.key.substr(5); //extract property
                    kv.key = 'targetPath';
                }
            };

            for (i = 0; i < val.length; i += 1) {
                ch = val.charAt(i);
                //is this content inside '' or "" ?
                if (ch === "'" || ch === '"') {
                    if (!literal)
                        literal = ch;
                    else if (literal === ch)
                        literal = null;
                }

                //value inside braces
                if (!literal && ch === "{" && !isKey) {
                    bracePart = val.substr(i);
                    bracePart = this.getBraceParts(bracePart, true)[0];
                    kv.val += bracePart;
                    i += bracePart.length - 1;
                    continue;
                }

                if (!literal && ch === kvd) {
                    if (!!kv.key) {
                        addNewKeyValPair(kv);
                        kv = {key:'', val:''};
                        isKey = true; //currently parsing key value
                    }
                }
                else if (!literal && (ch === vd1 || ch === vd2)) {
                    isKey = false; //begin parsing value
                }
                else {
                    if (isKey)
                        kv.key += ch;
                    else
                        kv.val += ch;
                }
            }

            if (!!kv.key) {
                addNewKeyValPair(kv);
            }

            parts.forEach(function (kv) {
                kv.key = strings.trim(kv.key);
                if (utils.check_is.String(kv.val))
                    kv.val = strings.trim(kv.val);
                checkTokens(kv);
            });

            parts = parts.filter(function (kv) {
                return kv.val !== ''; //when key has value
            });
            return parts;
        },
        resolveBindingSource:function (root, srcParts) {
            if (!root)
                return undefined;

            if (srcParts.length === 0) {
                return root;
            }

            if (srcParts.length > 0) {
                return this.resolveBindingSource(this._resolveProp(root, srcParts[0]), srcParts.slice(1));
            }

            throw new Error('Invalid operation');
        },
        resolvePath:function (obj, path) {
            if (!path)
                return obj;
            var parts = this._getPathParts(path);
            return this._resolvePath(obj, parts);
        },
        //extract top level braces
        getBraceParts:function (val, firstOnly) {
            var i, s = '', ch, literal, cnt = 0, parts = [];
            for (i = 0; i < val.length; i += 1) {
                ch = val.charAt(i);
                //is this content inside '' or "" ?
                if (ch === "'" || ch === '"') {
                    if (!literal)
                        literal = ch;
                    else if (literal === ch)
                        literal = null;
                }

                if (!literal && ch === '{') {
                    cnt += 1;
                    s += ch;
                }
                else if (!literal && ch === '}') {
                    cnt -= 1;
                    s += ch;
                    if (cnt === 0) {
                        parts.push(s);
                        s = '';
                        if (firstOnly)
                            return parts;
                    }
                }
                else {
                    if (cnt > 0) {
                        s += ch;
                    }
                }
            }

            return parts;
        },
        trimOuterBraces:function (val) {
            return strings.trim(val.replace(this.__trimOuterBracesRX, ''));
        },
        trimQuotes:function (val) {
            return strings.trim(val.replace(this.__trimQuotsRX, ''));
        },
        trimBrackets:function (val) {
            return strings.trim(val.replace(this.__trimBracketsRX, ''));
        },
        isWithOuterBraces:function (str) {
            return (strings.startsWith(str, '{') && strings.endsWith(str, '}'));
        },
        parseOption:function (part) {
            var res = {}, self = this;
            part = strings.trim(part);
            if (self.isWithOuterBraces(part))
                part = self.trimOuterBraces(part);
            var kvals = self._getKeyVals(part);
            kvals.forEach(function (kv) {
                var isString = utils.check_is.String(kv.val);
                if (isString && self.isWithOuterBraces(kv.val))
                    res[kv.key] = self.parseOption(kv.val);
                else {
                    if (isString)
                        res[kv.key] = self.trimQuotes(kv.val);
                    else
                        res[kv.key] = kv.val;
                }
            });
            return res;
        },
        parseOptions:function (str) {
            var res = [], self = this;
            str = strings.trim(str);
            var parts = [str];
            if (self.isWithOuterBraces(str)) {
                parts = self.getBraceParts(str, false);
            }
            parts.forEach(function (part) {
                res.push(self.parseOption(part));
            });

            return res;
        },
        toString:function () {
            return 'Parser';
        }
    }, null);

    app._parser = Parser.create();
};

RIAPP.Application._coreModules.baseElView = function (app) {
    var thisModule = this, global = app.global, utils = global.utils, consts = global.consts,
        ERRTEXT = RIAPP.localizable.VALIDATE;

    var _css = thisModule.css = {
        fieldError:'ria-field-error',
        errorTip:'ui-tooltip-red',
        commandLink:'ria-command-link'
    };
    Object.freeze(_css);

    var BaseElView = RIAPP.BaseObject.extend({
            _app:app,
            _create:function (el, options) {
                this._super();
                this._el = el;
                this._$el = null;
                this._oldDisplay = null;
                this._objId = 'elv' + this._app.getNewObjectID();
                this._propChangedCommand = null;
                this._app._setElView(this._el, this);
                this._errors = null;
                this._toolTip = options.tip;
                this._css = options.css;
                this._init(options);
                this._applyToolTip();
            },
            _applyToolTip:function () {
                if (!!this._toolTip) {
                    this._setToolTip(this.$el, this._toolTip);
                }
            },
            _init:function (options) {
                if (!!this._css) {
                    this.$el.addClass(this._css);
                }
            },
            _createElement:function (tag) {
                return global.$(global.document.createElement(tag));
            },
            _setIsEnabled:function ($el, v) {
                $el.prop('disabled', !v);
                if (!v)
                    $el.addClass('disabled');
                else
                    $el.removeClass('disabled');
            },
            _getIsEnabled:function ($el) {
                return !($el.prop('disabled'));
            },
            destroy:function () {
                if (this._isDestroyed)
                    return;
                var $el = this._$el, el = this._el;
                if (!!$el)
                    $el.off('.' + this._objId);
                try {
                    this._propChangedCommand = null;
                    this.validationErrors = null;
                    this.toolTip = null;
                    this._el = null;
                    this._$el = null;
                }
                finally {
                    this._app._setElView(el, null);
                }
                this._super();
            },
            invokePropChanged:function (property) {
                var self = this, data = {property:property};
                if (!!self._propChangedCommand) {
                    self._propChangedCommand.execute(self, data);
                }
            },
            _getErrorTipInfo:function (errors) {
                var tip = ['<b>', ERRTEXT.errorInfo, '</b>', '<br/>'];
                errors.forEach(function (info) {
                    var res = '';
                    info.errors.forEach(function (str) {
                        res = res + ' ' + str;
                    });
                    tip.push(res);
                    res = '';
                });
                return tip.join('');
            },
            _setFieldError:function (isError) {
                var $el = this.$el;
                if (isError) {
                    $el.addClass(_css.fieldError);
                }
                else {
                    $el.removeClass(_css.fieldError);
                }
            },
            _updateErrorUI:function (el, errors) {
                if (!el) {
                    return;
                }
                var $el = this.$el;
                if (!!errors && errors.length > 0) {
                    utils.addToolTip($el, this._getErrorTipInfo(errors), _css.errorTip);
                    this._setFieldError(true);
                }
                else {
                    this._setToolTip($el, this.toolTip);
                    this._setFieldError(false);
                }
            },
            _onError:function (error, source) {
                var isHandled = this._super(error, source);
                if (!isHandled) {
                    return this._app._onError(error, source);
                }
                return isHandled;
            },
            _setToolTip:function ($el, tip, className) {
                utils.addToolTip($el, tip, className);
            },
            toString:function () {
                return 'BaseElView';
            }
        },
        {
            app:{
                get:function () {
                    return this._app;
                }
            },
            $el:{
                get:function () {
                    if (!!this._el && !this._$el)
                        this._$el = global.$(this._el);
                    return this._$el;
                }
            },
            el:{
                get:function () {
                    return this._el;
                }
            },
            uniqueID:{
                get:function () {
                    return this._objId;
                }
            },
            isVisible:{
                set:function (v) {
                    v = !!v;
                    if (v !== this.isVisible) {
                        if (!v) {
                            this._oldDisplay = this.el.style.display;
                            this.el.style.display = 'none';
                        }
                        else {
                            if (!!this._oldDisplay)
                                this.el.style.display = this._oldDisplay;
                            else
                                this.el.style.display = '';
                        }
                        this.raisePropertyChanged('isVisible');
                    }
                },
                get:function () {
                    var v = this.el.style.display;
                    return !(v === 'none');
                }
            },
            propChangedCommand:{
                set:function (v) {
                    var old = this._propChangedCommand;
                    if (v !== old) {
                        this._propChangedCommand = v;
                        this.invokePropChanged('*');
                    }
                },
                get:function () {
                    return this._propChangedCommand;
                }
            },
            validationErrors:{
                set:function (v) {
                    if (v !== this._errors) {
                        this._errors = v;
                        this.raisePropertyChanged('validationErrors');
                        this._updateErrorUI(this._el, this._errors);
                    }
                },
                get:function () {
                    return this._errors;
                }
            },
            dataNameAttr:{
                get:function () {
                    return this._el.getAttribute(consts.DATA_ATTR.DATA_NAME);
                }
            },
            toolTip:{
                set:function (v) {
                    if (this._toolTip != v) {
                        this._toolTip = v;
                        this._setToolTip(this.$el, v);
                        this.raisePropertyChanged('toolTip');
                    }
                },
                get:function () {
                    return this._toolTip;
                }
            },
            css:{
                set:function (v) {
                    var $el = this.$el;
                    if (this._css != v) {
                        if (!!this._css)
                            $el.removeClass(this._css);
                        this._css = v;
                        if (!!this._css)
                            $el.addClass(this._css);
                        this.raisePropertyChanged('css');
                    }
                },
                get:function () {
                    return this._css;
                }
            }
        }, function (obj) {
            thisModule.BaseElView = obj;
            app.registerType('BaseElView', obj);
        });

    var EditableElView = BaseElView.extend(null,
        {
            isEnabled:{
                set:function (v) {
                    v = !!v;
                    if (v !== this.isEnabled) {
                        this._setIsEnabled(this.$el, v);
                        this.raisePropertyChanged('isEnabled');
                    }
                },
                get:function () {
                    return this._getIsEnabled(this.$el);
                }
            }
        }, function (obj) {
            thisModule.EditableElView = obj;
            app.registerType('EditableElView',obj);
        });

    var CommandElView = BaseElView.extend({
            _init:function (options) {
                this._super(options);
                this._command = null;
                this._commandParam = null;
            },
            destroy:function () {
                this.command = null;
                this.commandParam = null;
                this._super();
            },
            invokeCommand:function () {
                var self = this, command = self.command, param = self.commandParam;
                if (!!command && command.canExecute(self, param)) {
                    setTimeout(function(){
                        command.execute(self, param);
                    },0);
                }
            },
            _onCommandChanged:function () {
                this.raisePropertyChanged('command');
            },
            _setCommand:function (v) {
                var self = this;
                if (v !== this._command) {
                    if (!!this._command) {
                        this._command.removeNSHandlers(this._objId);
                    }
                    this._command = v;
                    if (!!this._command) {
                        this._command.addHandler('canExecute_changed', function (sender, args) {
                            self.isEnabled = sender.canExecute(self, self.commandParam);
                        }, this._objId);
                        self.isEnabled = this._command.canExecute(self, self.commandParam);
                    }
                    else
                        self.isEnabled = false;
                    this._onCommandChanged();
                }
            },
            toString:function () {
                return 'CommandElView';
            }
        },
        {
            isEnabled:{
                set:function (v) {
                    if (v !== this.isEnabled) {
                        this._setIsEnabled(this.$el, v);
                        this.raisePropertyChanged('isEnabled');
                    }
                },
                get:function () {
                    return this._getIsEnabled(this.$el);
                }
            },
            command:{
                set:function (v) {
                    this._setCommand(v);
                },
                get:function () {
                    return this._command;
                }
            },
            commandParam:{
                set:function (v) {
                    if (v !== this._commandParam) {
                        this._commandParam = v;
                        this.raisePropertyChanged('commandParam');
                    }
                },
                get:function () {
                    return this._commandParam;
                }
            }
        },
        function (obj) {
            thisModule.CommandElView = obj;
            app.registerType('CommandElView',obj);
        });

    var TemplateElView = CommandElView.extend({
            _init: function(options){
                this._super(options);
                this._template = null;
                this._isEnabled = true;
            },
            templateLoaded:function (template) {
                var self = this, p = self._commandParam;
                self._template = template;
                self._template.isDisabled = !self._isEnabled;
                self._commandParam = {template:template, isLoaded:true};
                self.invokeCommand();
                self._commandParam = p;
                this.raisePropertyChanged('template');
            },
            templateUnloading:function (template) {
                var self = this, p = self._commandParam;
                try
                {
                    self._commandParam = {template:template, isLoaded:false};
                    self.invokeCommand();
                }
                finally{
                    self._commandParam = p;
                    self._template = null;
                }
                this.raisePropertyChanged('template');
            },
            toString:function () {
                return 'TemplateElView';
            }
        },
        {
            isEnabled:{
                set:function (v) {
                    if (this._isEnabled !== v){
                        this._isEnabled = v;
                        if (!!this._template){
                            this._template.isDisabled = !this._isEnabled;
                        }
                        this.raisePropertyChanged('isEnabled');
                    }
                },
                get:function () {
                    return this._isEnabled;
                }
            },
            template:{
                get:function () {
                    return this._template;
                }
            }
        },
        function (obj) {
            thisModule.TemplateElView = obj;
            app.registerType('TemplateElView',obj);
            app.registerElView('template', obj);
        });


    var DynaContentElView = BaseElView.extend({
            _init:function (options) {
                this._super(options);
                this._dataContext = null;
                this._template = null;
            },
            _templateChanged: function(){
                this.raisePropertyChanged('templateID');
                if (!this._template)
                    return;
                this.$el.empty().append(this._template.el);
            },
            updateTemplate: function(name){
                var self = this;
                try{
                    if (!name && !!this._template){
                        this._template.destroy();
                        this._template = null;
                        self._templateChanged();
                        return;
                    }
                }catch(ex){
                    this._onError(ex,this);
                    global._throwDummy(ex);
                }

                try{
                    if (!this._template){
                        this._template = this._app.getType('Template').create(name);
                        this._template.dataContext = this._dataContext;
                        this._template.addOnPropertyChange('templateID',function(s,a){
                            self._templateChanged();
                        },this._objId);
                        self._templateChanged();
                        return;
                    }

                    this._template.templateID = name;
                }catch(ex){
                    this._onError(ex,this);
                    global._throwDummy(ex);
                }
            },
            destroy:function () {
                if (!!this._template){
                    this._template.destroy();
                    this._template = null;
                }
                this._dataContext = null;
                this._super();
            }
        },
        {
            templateID:{
                set:function (v) {
                    this.updateTemplate(v);
                },
                get:function () {
                    if (!this._template)
                        return null;
                    return this._template.templateID;
                }
            },
            template:{
                get:function () {
                    return this._template;
                }
            },
            dataContext:{
                set:function (v) {
                    var self = this;
                    if (this._dataContext !== v) {
                        this._dataContext = v;
                        if (!!this._template)
                            this._template.dataContext = this._dataContext;
                    }
                },
                get:function () {
                    return this._dataContext;
                }
            }
        },
        function (obj) {
            thisModule.DynaContentElView = obj;
            app.registerType('DynaContentElView',obj);
            app.registerElView(global.consts.ELVIEW_NM.DYNACONT, obj);
        });
};

RIAPP.Application._coreModules.binding = function (app) {
    var thisModule = this, global = app.global, utils = global.utils,
        errorMod = global.modules.errors, BaseElView = app.modules.baseElView.BaseElView,
        BINDING_MODE = ['OneTime', 'OneWay', 'TwoWay'];
    thisModule.BINDING_MODE = BINDING_MODE;

    thisModule.ValidationError = errorMod.BaseError.extend({
        _create:function (errorInfo, item) {
            var message = RIAPP.ERRS.ERR_VALIDATION + '\r\n', i = 0;
            errorInfo.forEach(function (err) {
                if (i > 0)
                    message = message + '\r\n';
                if (!!err.fieldName)
                    message = message + ' ' + RIAPP.localizable.TEXT.txtField + ': ' + err.fieldName + ' -> ' + err.errors.join(', ');
                else
                    message = message + err.errors.join(', ');
                i += 1;
            });
            this._super(message);
            this._errors = errorInfo;  //[{fieldName:name, errors:[]}]
            this._item = item;
        }
    }, {
        item:{
            get:function () {
                return this._item;
            }
        },
        errors:{
            get:function () {
                return this._errors;
            }
        }
    }, function (obj) {
        app.registerType('ValidationError', obj);
    });

    thisModule.Binding = RIAPP.BaseObject.extend({
            _app:app,
            _create:function (options) {
                this._super();
                var opts = utils.extend(false, {target:null, source:null,
                    targetPath:null, sourcePath:null, mode:BINDING_MODE[1],
                    converter:null, converterParam:null, isSourceFixed:false
                }, options);

                if (!opts.target) {
                    throw new Error(RIAPP.ERRS.ERR_BIND_TARGET_EMPTY);
                }

                if (!utils.check_is.String(opts.targetPath)) {
                    throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_BIND_TGTPATH_INVALID, opts.targetPath));
                }

                if (BINDING_MODE.indexOf(opts.mode) < 0){
                    throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_BIND_MODE_INVALID, opts.mode));
                }

                if (!RIAPP.BaseObject.isPrototypeOf(opts.target)) {
                    throw new Error(RIAPP.ERRS.ERR_BIND_TARGET_INVALID);
                }

                this._state = null; //save state - source and target when binding is disabled
                this._mode = opts.mode;
                this._converter = opts.converter || this._app.getConverter('BaseConverter');
                this._converterParam = opts.converterParam;
                this._srcPath = this._app.parser._getPathParts(opts.sourcePath);
                this._tgtPath = this._app.parser._getPathParts(opts.targetPath);
                if (this._tgtPath.length < 1)
                    throw new Error(String.format(RIAPP.ERRS.ERR_BIND_TGTPATH_INVALID, opts.targetPath));
                this._isSourceFixed = (!!opts.isSourceFixed);
                this._bounds = {};
                this._objId = 'bnd' + this._app.getNewObjectID();
                this._ignoreSrcChange = false;
                this._ignoreTgtChange = false;
                this._sourceObj = null;
                this._targetObj = null;
                this._source = null;
                this._target = null;
                this.target = opts.target;
                this.source = opts.source;
                if (!!this._sourceObj && !!this._sourceObj.addOnItemErrorsChanged && this._sourceObj.getIsHasErrors())
                    this._onSrcErrorsChanged();
            },
            _getOnTgtDestroyedProxy:function () {
                var self = this;
                return function (s, a) {
                    self._onTgtDestroyed();
                };
            },
            _getOnSrcDestroyedProxy:function () {
                var self = this;
                return function (s, a) {
                    self._onSrcDestroyed();
                };
            },
            _getUpdTgtProxy:function () {
                var self = this;
                return function () {
                    self._updateTarget();
                };
            },
            _getUpdSrcProxy:function () {
                var self = this;
                return function () {
                    self._updateSource();
                };
            },
            _getSrcErrChangedProxy:function () {
                var self = this;
                return function (s, a) {
                    self._onSrcErrorsChanged();
                };
            },
            _onSrcErrorsChanged:function () {
                var errors = [], tgt = this._targetObj, src = this._sourceObj, srcPath = this._srcPath;
                if (!!tgt && BaseElView.isPrototypeOf(tgt)) {
                    if (!!src && srcPath.length > 0) {
                        var prop = srcPath[srcPath.length - 1];
                        errors = src.getFieldErrors(prop);
                    }
                    tgt.validationErrors = errors;
                }
            },
            _onError:function (error, source) {
                var isHandled = this._super(error, source);
                if (!isHandled) {
                    return this._app._onError(error, source);
                }
                return isHandled;
            },
            _getTgtChangedFn:function (self, obj, prop, restPath, lvl) {
                var fn = function (sender, data) {
                    var val = self._app.parser._resolveProp(obj, prop);
                    if (restPath.length > 0) {
                        self._checkBounded(null, 'target', lvl, restPath);
                    }
                    self._parseTgtPath(val, restPath, lvl); //bind and trigger target update
                };
                return fn;
            },
            _getSrcChangedFn:function (self, obj, prop, restPath, lvl) {
                var fn = function (sender, data) {
                    var val = self._app.parser._resolveProp(obj, prop);
                    if (restPath.length > 0) {
                        self._checkBounded(null, 'source', lvl, restPath);
                    }
                    self._parseSrcPath(val, restPath, lvl);
                };
                return fn;
            },
            _parseSrcPath:function (obj, path, lvl) {
                var self = this;
                self._sourceObj = null;
                if (path.length === 0) {
                    self._sourceObj = obj;
                }
                else
                    self._parseSrcPath2(obj, path, lvl);
                if (!!self._targetObj)
                    self._updateTarget();
            },
            _parseSrcPath2:function (obj, path, lvl) {
                var self = this, BaseObj = RIAPP.BaseObject, nextObj;
                var isBaseObj = (!!obj && BaseObj.isPrototypeOf(obj));


                if (isBaseObj) {
                    obj.addOnDestroyed(self._getOnSrcDestroyedProxy(), self._objId);
                    self._checkBounded(obj, 'source', lvl, path);
                }

                if (path.length > 1) {
                    if (isBaseObj) {
                        obj.addOnPropertyChange(path[0], self._getSrcChangedFn(self, obj, path[0], path.slice(1), lvl + 1), self._objId);
                    }

                    if (!!obj) {
                        nextObj = self._app.parser._resolveProp(obj, path[0]);
                        if (!!nextObj)
                            self._parseSrcPath2(nextObj, path.slice(1), lvl + 1);
                    }
                    return;
                }

                if (!!obj && path.length === 1) {
                    var updateOnChange = (self._mode === BINDING_MODE[1] || self._mode === BINDING_MODE[2]);
                    if (updateOnChange && isBaseObj) {
                        obj.addOnPropertyChange(path[0], self._getUpdTgtProxy(), this._objId);
                    }
                    if (!!obj && !!obj.addOnItemErrorsChanged) {
                        obj.addOnItemErrorsChanged(self._getSrcErrChangedProxy(), self._objId);
                    }
                    this._sourceObj = obj;
                }
            },
            _parseTgtPath:function (obj, path, lvl) {
                var self = this;
                self._targetObj = null;
                if (path.length === 0) {
                    self._targetObj = obj;
                }
                else
                    self._parseTgtPath2(obj, path, lvl);
                if (!!self._targetObj) //new target
                    self._updateTarget();  //update target (not source!)
            },
            _parseTgtPath2:function (obj, path, lvl) {
                var self = this, BaseObj = RIAPP.BaseObject, nextObj;
                var isBaseObj = (!!obj && BaseObj.isPrototypeOf(obj));

                if (isBaseObj) {
                    obj.addOnDestroyed(self._getOnTgtDestroyedProxy(), self._objId);
                    self._checkBounded(obj, 'target', lvl, path);
                }

                if (path.length > 1) {
                    if (isBaseObj) {
                        obj.addOnPropertyChange(path[0], self._getTgtChangedFn(self, obj, path[0], path.slice(1), lvl + 1), self._objId);
                    }
                    if (!!obj) {
                        nextObj = self._app.parser._resolveProp(obj, path[0]);
                        if (!!nextObj)
                            self._parseTgtPath2(nextObj, path.slice(1), lvl + 1);
                    }
                    return;
                }

                if (!!obj && path.length === 1) {
                    var updateOnChange = (self._mode === BINDING_MODE[2]);
                    if (updateOnChange && isBaseObj) {
                        obj.addOnPropertyChange(path[0], self._getUpdSrcProxy(), this._objId);
                    }
                    self._targetObj = obj;
                }
            },
            _checkBounded:function (obj, to, lvl, restPath) {
                var old, key;
                if (to === 'source') {
                    key = 's' + lvl;
                }
                else if (to === 'target') {
                    key = 't' + lvl;
                }
                else
                    throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_PARAM_INVALID, 'to', to));

                old = this._bounds[key];
                if (!!old) {
                    old.removeNSHandlers(this._objId);
                    delete this._bounds[key];
                }

                if (restPath.length > 0) {
                    this._checkBounded(null, to, lvl + 1, restPath.slice(1));
                }

                if (!!obj) {
                    this._bounds[key] = obj;
                }
            },
            _onTgtDestroyed:function (sender, args) {
                if (this._isDestroyCalled)
                    return;
                this.target = null;
            },
            _onSrcDestroyed:function (sender, args) {
                var self = this;
                if (self._isDestroyCalled)
                    return;
                if (sender === self.source)
                    self.source = null;
                else {
                    self._checkBounded(null, 'source', 0, self._srcPath);
                    setTimeout(function () {
                        if (self._isDestroyCalled)
                            return;
                        //rebind after source destroy fully completed
                        self._bindToSource();
                    }, 0);
                }
            },
            _bindToSource:function () {
                this._parseSrcPath(this.source, this._srcPath, 0);
            },
            _bindToTarget:function () {
                this._parseTgtPath(this.target, this._tgtPath, 0);
            },
            _updateTarget:function () {
                if (this._ignoreSrcChange)
                    return;
                this._ignoreTgtChange = true;
                try {
                    var res = this._converter.convertToTarget(this.sourceValue, this._converterParam, this._sourceObj);
                    if (res !== undefined)
                        this.targetValue = res;
                }
                catch (ex) {
                    global.reThrow(ex, this._onError(ex, this));
                }
                finally {
                    this._ignoreTgtChange = false;
                }
            },
            _updateSource:function () {
                if (this._ignoreTgtChange)
                    return;
                this._ignoreSrcChange = true;
                try {
                    var res = this._converter.convertToSource(this.targetValue, this._converterParam, this._sourceObj);
                    if (res !== undefined)
                        this.sourceValue = res;
                }
                catch (ex) {
                    if (!thisModule.ValidationError.isPrototypeOf(ex) || !BaseElView.isPrototypeOf(this._targetObj)) {
                        //BaseElView is notified about errors in _onSrcErrorsChanged event handler
                        //we only need to invoke _onError in other cases
                        //1) when target is not BaseElView
                        //2) when error is not ValidationError

                        this._updateTarget(); //resync target with source
                        if (!this._onError(ex, this))
                            throw ex;
                    }
                }
                finally {
                    this._ignoreSrcChange = false;
                }
            },
            destroy:function () {
                if (this._isDestroyed)
                    return;
                
                var self = this;
                utils.forEachProp(this._bounds, function (key) {
                    var old = self._bounds[key];
                    old.removeNSHandlers(self._objId);
                });
                this._bounds = {};
                this.source = null;
                this.target = null;
                this._state = null;
                this._converter = null;
                this._converterParam = null;
                this._srcPath = null;
                this._tgtPath = null;
                this._sourceObj = null;
                this._targetObj = null;
                this._source = null;
                this._target = null;
                this._super();
            },
            toString:function () {
                return 'Binding';
            }
        },
        {
            bindingID:{
                get:function () {
                    return this._objId;
                }
            },
            target:{
                set:function (v) {
                    if (!!this._state) {
                        this._state.target = v;
                        return;
                    }
                    if (this._target !== v) {
                        var tgtObj = this._targetObj;
                        if (!!tgtObj && !tgtObj._isDestroyCalled) {
                            this._ignoreTgtChange = true;
                            try {
                                this.targetValue = null;
                            }
                            finally {
                                this._ignoreTgtChange = false;
                            }
                        }
                        this._checkBounded(null, 'target', 0, this._tgtPath);
                        if (!!v && !RIAPP.BaseObject.isPrototypeOf(v))
                            throw new Error(RIAPP.ERRS.ERR_BIND_TARGET_INVALID);
                        this._target = v;
                        this._bindToTarget();
                        if (!!this._target && !this._targetObj)
                            throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_BIND_TGTPATH_INVALID, this._tgtPath.join('.')));
                    }
                },
                get:function () {
                    return this._target;
                }
            },
            source:{
                set:function (v) {
                    if (!!this._state) {
                        this._state.source = v;
                        return;
                    }
                    if (this._source !== v) {
                        this._checkBounded(null, 'source', 0, this._srcPath);
                        this._source = v;
                        this._bindToSource();
                    }
                },
                get:function () {
                    return this._source;
                }
            },
            targetPath:{
                get:function () {
                    return this._tgtPath;
                }
            },
            sourcePath:{
                get:function () {
                    return this._srcPath;
                }
            },
            sourceValue:{
                set:function (v) {
                    if (this._srcPath.length === 0 || this._sourceObj === null)
                        return;
                    var prop = this._srcPath[this._srcPath.length - 1];
                    this._app.parser._setPropertyValue(this._sourceObj, prop, v);
                },
                get:function () {
                    if (this._srcPath.length === 0)
                        return this._sourceObj;
                    if (this._sourceObj === null)
                        return null;
                    var prop = this._srcPath[this._srcPath.length - 1];
                    var res = this._app.parser._resolveProp(this._sourceObj, prop);
                    return res;
                }
            },
            targetValue:{
                set:function (v) {
                    if (this._targetObj === null)
                        return;
                    var prop = this._tgtPath[this._tgtPath.length - 1];
                    this._app.parser._setPropertyValue(this._targetObj, prop, v);
                },
                get:function () {
                    if (this._targetObj === null)
                        return null;
                    var prop = this._tgtPath[this._tgtPath.length - 1];
                    return this._app.parser._resolveProp(this._targetObj, prop);
                }
            },
            mode:{
                get:function () {
                    return this._mode;
                }
            },
            converter:{
                set:function (v) {
                    this._converter = v;
                },
                get:function () {
                    return this._converter;
                }
            },
            converterParam:{
                set:function (v) {
                    this._converterParam = v;
                },
                get:function () {
                    return this._converterParam;
                }
            },
            isSourceFixed:{
                get:function () {
                    return this._isSourceFixed;
                }
            },
            isDisabled:{
                set:function (v) {
                    var s;
                    v = !!v;
                    if (this.isDisabled != v) {
                        if (v) { //going to disabled state
                            s = {source:this._source, target:this._target};
                            try {
                                this.target = null;
                                this.source = null;
                            }
                            finally {
                                this._state = s;
                            }
                        }
                        else {
                            s = this._state;
                            this._state = null;
                            this.target = s.target;
                            this.source = s.source;
                        }
                    }
                },
                get:function () {
                    return !!this._state;
                }
            }
        }, function (obj) {
            app.registerType('Binding', obj);
        });
};

RIAPP.Application._coreModules.template = function (app) {
    var thisModule = this, global = app.global, utils = global.utils, consts = global.consts,
        Binding = app.modules.binding.Binding, BaseElView = app.modules.baseElView.BaseElView,
        TemplateElView = app.modules.baseElView.TemplateElView;

    /*define Template class and register its type*/
    thisModule.Template = RIAPP.BaseObject.extend({
        _app:app,
        _create:function (templateID) {
            this._super();
            this._dctxt = null;
            this._el = null;
            this._isDisabled = false;
            this._lfTime = null;
            this._templateID = templateID;
            this._templElView = undefined;
            this._promise = null;
            if (!!this._templateID)
                this._loadTemplate();
        },
        _getBindings:function () {
            if (!this._lfTime)
                return [];
            var arr = this._lfTime.getObjs(), res = [];
            for (var i = 0, len = arr.length; i < len; i += 1) {
                if (Binding.isPrototypeOf(arr[i]))
                    res.push(arr[i]);
            }
            return res;
        },
        _getElViews:function () {
            if (!this._lfTime)
                return [];
            var arr = this._lfTime.getObjs(), res = [];
            for (var i = 0, len = arr.length; i < len; i += 1) {
                if (BaseElView.isPrototypeOf(arr[i]))
                    res.push(arr[i]);
            }
            return res;
        },
        _getTemplateElView:function () {
            if (!this._lfTime || this._templElView === null)
                return null;
            if (!!this._templElView)
                return this._templElView;
            var res = null, arr = this._getElViews();
            for (var i = 0, j = arr.length; i < j; i += 1) {
                if (TemplateElView.isPrototypeOf(arr[i])) {
                    res = arr[i];
                    break;
                }
            }
            this._templElView = res;
            return res;
        },
        //returns promise which resolves with loaded template DOM element
        _loadTemplateElAsync:function (name) {
            var self = this, fn_loader = self._app.getTemplateLoader(name), deferred;
            if (!!fn_loader){
                return fn_loader().then(function(html){
                    var $tel = global.$(html), el =$tel.get(0);
                    return el;
                });
            }
            else
            {
                deferred = utils.createDeferred();
                deferred.reject(new Error(String.format(RIAPP.ERRS.ERR_TEMPLATE_ID_INVALID, self._templateID)));
                return deferred.promise();
            }
        },
        _loadTemplate:function () {
            var self = this, tid = self._templateID, promise;
            self._unloadTemplate();
            if (!!tid) {
                promise = self._loadTemplateElAsync(tid);

                if (promise.state() == "pending"){
                    self._el = global.document.createElement("div");
                    self._promise = utils.createDeferred();
                    promise.then(function(){
                        self._promise.resolve();
                    });
                    promise = global.$.when(promise,self._promise);
                }

                promise.then(function(tel){
                        if (self._isDestroyCalled)
                            return;
                        var asyncLoad = !!self._promise;
                        self._promise = null;
                        if (!tel){
                            self._unloadTemplate();
                            return;
                        }
                        if (asyncLoad) {
                            self._el.appendChild(tel);
                        }
                        self._el = tel;
                        self._lfTime = self._app._bindTemplateElements(self._el);
                        var telv = self._getTemplateElView();
                        if (!!telv) {
                            telv.templateLoaded(self);
                        }
                        self._updateBindingSource();
                    },
                    function(arg){
                        if (self._isDestroyCalled)
                            return;
                        self._promise = null;
                        if (arg == 'cancel')
                            return;
                        if (!!arg && !!arg.message)
                            self._app._onError(arg,self);
                        else
                            self._app._onError(new Error(String.format(RIAPP.ERRS.ERR_TEMPLATE_ID_INVALID, self._templateID)),self);
                    });
            }
        },
        _updateBindingSource:function () {
            var i, len, obj, bindings = this._getBindings();
            for (i = 0, len = bindings.length; i < len; i += 1) {
                obj = bindings[i];
                obj.isDisabled = this._isDisabled;
                if (!obj.isSourceFixed)
                    obj.source = this._dctxt;
            }
        },
        _updateIsDisabled:function () {
            var i, len, obj, bindings = this._getBindings(), elViews = this._getElViews(),
                DataFormElView = this._app._getElViewType(consts.ELVIEW_NM.DATAFORM);
            for (i = 0, len = bindings.length; i < len; i += 1) {
                obj = bindings[i];
                obj.isDisabled = this._isDisabled;
            }
            for (i = 0, len = elViews.length; i < len; i += 1) {
                obj = elViews[i];
                if (DataFormElView.isPrototypeOf(obj) && !!obj.form){
                    obj.form.isDisabled = this._isDisabled;
                }
            }
        },
        _unloadTemplate:function () {
            try {
                if (!!this._el) {
                    var telv = this._templElView;
                    this._templElView = undefined;
                    if (!!telv) {
                        telv.templateUnloading(this);
                    }
                }
            }
            finally {
                if (!!this._lfTime) {
                    this._lfTime.destroy();
                    this._lfTime = null;
                }

                if (!!this._el) {
                    global.$(this._el).remove(); //remove with jQuery method to ensure proper cleanUp
                }
                this._el = null;
            }
        },
        destroy:function () {
            if (this._isDestroyed)
                return;
            
            if (!!this._promise){
                this._promise.reject('cancel');
                this._promise = null;
            }
            this._dctxt = null;
            this._unloadTemplate();
            this._templateID = null;
            this._templElView = undefined;
            this._super();
        },
        //find elements which has specific data-name attribute value
        //returns plain array of elements, or empty array
        findElByDataName:function (name) {
            var $foundEl = global.$(this._el).find(['*[', consts.DATA_ATTR.DATA_NAME, '="', name, '"]'].join(''));
            return $foundEl.toArray();
        },
        findElViewsByDataName:function (name) {
            //first return elements with the needed data attributes those are inside template
            var self = this, els = this.findElByDataName(name), res = [];
            els.forEach(function (el) {
                var elView = self._app._getElView(el);
                if (!!elView)
                    res.push(elView);
            });
            return res;
        },
        toString:function () {
            return 'Template';
        }
    },{
        dataContext:{
            set:function (v) {
                if (this._dctxt !== v) {
                    this._dctxt = v;
                    this.raisePropertyChanged('dataContext');
                    this._updateBindingSource();
                }
            },
            get:function () {
                return this._dctxt;
            }
        },
        templateID:{
            set:function (v) {
                if (this._templateID !== v) {
                    if (!!this._promise){
                        this._promise.reject('cancel'); //cancel previous load
                        this._promise = null;
                    }
                    this._templateID = v;
                    this._loadTemplate();
                    this.raisePropertyChanged('templateID');
                }
            },
            get:function () {
                return this._templateID;
            }
        },
        el:{
            get:function () {
                return this._el;
            }
        },
        isDisabled:{
            set:function (v) {
                if (this._isDisabled !== v) {
                    this._isDisabled = !!v;
                    this._updateIsDisabled();
                    this.raisePropertyChanged('isDisabled');
                }
            },
            get:function () {
                return this._isDisabled;
            }
        }
    }, function (obj) {
        app.registerType('Template', obj);
    });
};

RIAPP.Application._coreModules.mvvm = function (app) {
    var thisModule = this, global = app.global, utils = global.utils;

    thisModule.Command = RIAPP.BaseObject.extend({
        _app:app,
        _create:function (fn_action, thisObj, fn_canExecute) {
            this._super();
            this._action = fn_action;
            this._thisObj = thisObj;
            this._canExecute = fn_canExecute;
            this._isEnabled = true;
            this._objId = 'cmd' + this._app.getNewObjectID();
        },
        _getEventNames:function () {
            var base_events = this._super();
            return ['canExecute_changed'].concat(base_events);
        },
        canExecute:function (sender, param) {
            if (!this._canExecute)
                return true;
            return this._canExecute.apply(this._thisObj, [sender, param]);
        },
        execute:function (sender, param) {
            if (!this._isEnabled)
                return;
            if (!!this._action) {
                this._action.apply(this._thisObj, [sender, param]);
            }
        },
        destroy:function () {
            if (this._isDestroyed)
                return;
            this._action = null;
            this._thisObj = null;
            this._canExecute = null;
            this._super();
        },
        raiseCanExecuteChanged:function () {
            this.raiseEvent('canExecute_changed', {});
        },
        toString:function () {
            return 'Command';
        }
    }, {
        app:{
            get:function () {
                return this._app;
            }
        }
    }, function (obj) {
        app.registerType('Command', obj);
    });

    thisModule.BaseViewModel = RIAPP.BaseObject.extend({
            _app:app,
            _create:function () {
                this._super();
                this._objId = 'vm' + this._app.getNewObjectID();
            },
            _onError:function (error, source) {
                var isHandled = this._super(error, source);
                if (!isHandled) {
                    return this._app._onError(error, source);
                }
                return isHandled;
            },
            toString:function () {
                if (!!this._typeName)
                    return this._super();
                return 'BaseViewModel';
            }
        },
        {
            uniqueID:{
                get:function () {
                    return this._objId;
                }
            },
            app:{
                get:function () {
                    return this._app;
                }
            },
            $:{
                get:function () {
                    return this._app.global.$;
                }
            }
        }, function (obj) {
            app.registerType('BaseViewModel', obj);
        });
};

RIAPP.Application._coreModules.baseContent = function (app) {
    var thisModule = this, global = app.global, utils = global.utils;
    var Template = app.modules.template.Template, Binding = app.modules.binding.Binding;

    var _css = thisModule.css = {
        content:'ria-content-field',
        required:'ria-required-field'
    };
    Object.freeze(_css);

    thisModule.BindingContent = RIAPP.BaseObject.extend({
            _app:app,
            _create:function (parentEl, options, dctx, isEditing) {
                this._super();
                this._parentEl = parentEl;
                this._el = null;
                this._options = options;
                this._isReadOnly = !!this._options.readOnly;
                this._isEditing = !!isEditing;
                this._dctx = dctx;
                this._lfScope = null;
                this._tgt = null;
                var $p = global.$(this._parentEl);
                $p.addClass(_css.content);
                if (!!options.initContentFn) {
                    options.initContentFn(this);
                }
                this._init();
                this.update();
            },
            _init:function () {
            },
            _updateCss:function () {
                var displayInfo = this._getDisplayInfo(), $p = global.$(this._parentEl), fieldInfo = this.getFieldInfo();
                if (this._isEditing && this._canBeEdited()) {
                    if (!!displayInfo) {
                        if (!!displayInfo.editCss) {
                            $p.addClass(displayInfo.editCss);
                        }
                        if (!!displayInfo.displayCss) {
                            $p.removeClass(displayInfo.displayCss);
                        }
                    }
                    if (!!fieldInfo && !fieldInfo.isNullable) {
                        $p.addClass(_css.required);
                    }
                }
                else {
                    if (!!displayInfo) {
                        if (!!displayInfo.displayCss) {
                            $p.addClass(displayInfo.displayCss);
                        }
                        if (!!displayInfo.editCss) {
                            $p.removeClass(displayInfo.editCss);
                        }
                        if (!!fieldInfo && !fieldInfo.isNullable) {
                            $p.removeClass(_css.required);
                        }
                    }
                }
            },
            _canBeEdited:function () {
                if (this._isReadOnly)
                    return false;
                var finf = this.getFieldInfo();
                if (!finf)
                    return false;
                var editable = !!this._dctx && !!this._dctx.beginEdit;
                return editable && !finf.isReadOnly && !finf.isCalculated;
            },
            _createTargetElement:function () {
                var tgt, doc = global.document;
                if (this._isEditing && this._canBeEdited()) {
                    tgt = doc.createElement('input');
                    tgt.setAttribute('type', 'text');
                }
                else {
                    tgt = doc.createElement('span');
                }
                this._updateCss();
                return tgt;
            },
            _getBindingOption:function (bindingInfo, tgt, dctx, targetPath) {
                var options = this._app._getBindingOption(bindingInfo, tgt, dctx);
                if (this.isEditing && this._canBeEdited())
                    options.mode = 'TwoWay';
                else
                    options.mode = 'OneWay';
                if (!!targetPath)
                    options.targetPath = targetPath;
                return options;
            },
            _getBindings:function () {
                if (!this._lfScope)
                    return [];
                var arr = this._lfScope.getObjs(), res = [];
                for (var i = 0, len = arr.length; i < len; i += 1) {
                    if (Binding.isPrototypeOf(arr[i]))
                        res.push(arr[i]);
                }
                return res;
            },
            _updateBindingSource:function () {
                var i, len, obj, bindings = this._getBindings();
                for (i = 0, len = bindings.length; i < len; i += 1) {
                    obj = bindings[i];
                    if (!obj.isSourceFixed)
                        obj.source = this._dctx;
                }
            },
            _cleanUp:function () {
                if (!!this._lfScope) {
                    this._lfScope.destroy();
                    this._lfScope = null;
                }
                if (!!this._el) {
                    global.$(this._el).remove();
                    this._el = null;
                }
                this._tgt = null;
            },
            getFieldInfo:function () {
                return this._options.fieldInfo;
            },
            _getBindingInfo:function () {
                return this._options.bindingInfo;
            },
            _getDisplayInfo:function () {
                return this._options.displayInfo;
            },
            _getElementView:function (el) {
                return this._app.getElementView(el);
            },
            update:function () {
                this._cleanUp();
                var bindingInfo = this._getBindingInfo();
                if (!!bindingInfo) {
                    this._el = this._createTargetElement();
                    this._tgt = this._getElementView(this._el);
                    this._lfScope = global.utils.LifeTimeScope.create();
                    this._lfScope.addObj(this._tgt);
                    var options = this._getBindingOption(bindingInfo, this._tgt, this._dctx, 'value');
                    this._parentEl.appendChild(this._el);
                    this._lfScope.addObj(this._app.bind(options));
                }
            },
            destroy:function () {
                if (this._isDestroyed)
                    return;
                
                var displayInfo = this._getDisplayInfo(), $p = global.$(this._parentEl);
                $p.removeClass(_css.content);
                $p.removeClass(_css.required);
                if (!!displayInfo && !!displayInfo.displayCss) {
                    $p.removeClass(displayInfo.displayCss);
                }
                if (!!displayInfo && !!displayInfo.editCss) {
                    $p.removeClass(displayInfo.editCss);
                }

                this._cleanUp();
                this._parentEl = null;
                this._dctx = null;
                this._options = null;
                this._super();
            },
            toString:function () {
                return 'BindingContent';
            }
        },
        {
            parentEl:{
                get:function () {
                    return this._parentEl;
                }
            },
            target:{
                get:function () {
                    return this._tgt;
                }
            },
            isEditing:{
                set:function (v) {
                    if (this._isEditing !== v) {
                        this._isEditing = v;
                        this.update();
                    }
                },
                get:function () {
                    return this._isEditing;
                }
            },
            dataContext:{
                set:function (v) {
                    if (this._dctx !== v) {
                        this._dctx = v;
                        this._updateBindingSource();
                    }
                },
                get:function () {
                    return this._dctx;
                }
            },
            app:{
                get:function () {
                    return this._app;
                }
            }
        }, null);

    thisModule.TemplateContent = RIAPP.BaseObject.extend({
            _app:app,
            _create:function (parentEl, templateInfo, dctx, isEditing) {
                this._super();
                this._parentEl = parentEl;
                this._isEditing = !!isEditing;
                this._dctx = dctx;
                this._templateInfo = templateInfo;
                this._template = null;
                var $p = global.$(this._parentEl);
                $p.addClass(_css.content);
                this.update();
            },
            _createTemplate:function () {
                var inf = this._templateInfo, id = inf.displayID;
                if (this._isEditing) {
                    if (!!inf.editID) {
                        id = inf.editID;
                    }
                }
                else {
                    if (!id) {
                        id = inf.editID;
                    }
                }
                if (!id)
                    throw new Error(RIAPP.ERRS.ERR_TEMPLATE_ID_INVALID);

                return Template.create(id);
            },
            update:function () {
                this._cleanUp();
                var template;
                if (!!this._templateInfo) {
                    template = this._createTemplate();
                    this._template = template;
                    this._parentEl.appendChild(template.el);
                    template.dataContext = this._dctx;
                }
            },
            _cleanUp:function () {
                if (!!this._template) {
                    this._template.destroy();
                    this._template = null;
                }
            },
            destroy:function () {
                if (this._isDestroyed)
                    return;
                
                var $p = global.$(this._parentEl);
                $p.removeClass(_css.content);
                this._cleanUp();
                this._parentEl = null;
                this._dctx = null;
                this._templateInfo = null;
                this._super();
            },
            toString:function () {
                return 'TemplateContent';
            }
        },
        {
            parentEl:{
                get:function () {
                    return this._parentEl;
                }
            },
            template:{
                get:function () {
                    return this._template;
                }
            },
            isEditing:{
                set:function (v) {
                    if (this._isEditing !== v) {
                        this._isEditing = v;
                        this.update();
                    }
                },
                get:function () {
                    return this._isEditing;
                }
            },
            dataContext:{
                set:function (v) {
                    if (this._dctx !== v) {
                        this._dctx = v;
                        if (!!this._template) {
                            this._template.dataContext = this._dctx;
                        }
                    }
                },
                get:function () {
                    return this._dctx;
                }
            },
            app:{
                get:function () {
                    return this._app;
                }
            }
        }, null);
};

RIAPP.Application._coreModules.collection = function (app) {
    var thisModule = this, global = app.global, utils = global.utils;
    var Collection, CollectionItem, List, ListItem, Dictionary,
        DATA_TYPE = global.consts.DATA_TYPE,
        COLL_CHANGE_TYPE = {REMOVE:'0', ADDED:'1', RESET:'2', REMAP_KEY:'3'};
    var consts = {};
    consts.DATA_TYPE = DATA_TYPE;
    consts.SORT_ORDER = { ASC:0, DESC:1 };
    consts.COLL_CHANGE_TYPE = COLL_CHANGE_TYPE;
    consts.DATE_CONVERSION = { None:0, ServerLocalToClientLocal:1, UtcToClientLocal:2 };
    thisModule.consts = consts;
    Object.freeze(consts);

    var ValidationError = app.modules.binding.ValidationError;
    var valueUtils = {
        valueToDate:function (val, dtcnv, stz) {
            if (!val)
                return null;
            val = '' + val;
            var parts = val.split("&");
            if (parts.length != 7) {
                throw new Error(base_utils.format(RIAPP.ERRS.ERR_PARAM_INVALID, 'val', val));
            }
            var dt = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), parseInt(parts[3], 10),
                parseInt(parts[4], 10), parseInt(parts[5], 10), parseInt(parts[6], 10));
            var DATE_CONVERSION = consts.DATE_CONVERSION;
            var ctz = utils.get_timeZoneOffset();

            switch (dtcnv) {
                case DATE_CONVERSION.None:
                    break;
                case DATE_CONVERSION.ServerLocalToClientLocal:
                    dt.setMinutes(dt.getMinutes() + stz); //ServerToUTC
                    dt.setMinutes(dt.getMinutes() - ctz); //UtcToLocal
                    break;
                case DATE_CONVERSION.UtcToClientLocal:
                    dt.setMinutes(dt.getMinutes() - ctz); //UtcToLocal
                    break;
                default:
                    throw new Error(base_utils.format(RIAPP.ERRS.ERR_PARAM_INVALID, 'dtcnv', dtcnv));
            }
            return dt;
        },
        dateToValue:function (dt, dtcnv, stz) {
            if (dt === null)
                return null;
            if (!utils.check_is.Date(dt))
                throw new Error(base_utils.format(RIAPP.ERRS.ERR_PARAM_INVALID, 'dt', dt));
            var DATE_CONVERSION = consts.DATE_CONVERSION;
            var ctz = utils.get_timeZoneOffset();
            switch (dtcnv) {
                case DATE_CONVERSION.None:
                    break;
                case DATE_CONVERSION.ServerLocalToClientLocal:
                    dt.setMinutes(dt.getMinutes() + ctz); //LocalToUTC
                    dt.setMinutes(dt.getMinutes() - stz); //UtcToServer
                    break;
                case DATE_CONVERSION.UtcToClientLocal:
                    dt.setMinutes(dt.getMinutes() + ctz); //LocalToUTC
                    break;
                default:
                    throw new Error(utils.format(RIAPP.ERRS.ERR_PARAM_INVALID, 'dtcnv', dtcnv));
            }
            return ("" + dt.getFullYear() + "&" + (dt.getMonth() + 1) + "&" + dt.getDate() + "&" + dt.getHours() + "&" + dt.getMinutes() + "&" + dt.getSeconds() + "&" + dt.getMilliseconds());
        },
        compareVals:function (v1, v2, dataType) {
            if ((v1 === null && v2 !== null) || (v1 !== null && v2 === null))
                return false;

            switch (dataType) {
                case DATA_TYPE.DateTime:
                case DATA_TYPE.Date:
                case DATA_TYPE.Time:
                    if (utils.check_is.Date(v1) && utils.check_is.Date(v2))
                        return v1.getTime() === v2.getTime();
                    else
                        return false;
                default:
                    return v1 === v2;
            }
        },
        stringifyValue:function (v, dcnv, stz) {
            if (utils.check_is.nt(v))
                return null;
            if (utils.check_is.Date(v))
                return valueUtils.dateToValue(v, dcnv, stz);
            else
                return '' + v;
        },
        parseValue:function (v, dataType, dcnv, stz) {
            var res = null;

            if (v === undefined || v === null)
                return res;

            switch (dataType) {
                case DATA_TYPE.None:
                    res = v;
                    break;
                case DATA_TYPE.String:
                    res = v;
                    break;
                case DATA_TYPE.Bool:
                    res = utils.parseBool(v);
                    break;
                case DATA_TYPE.Integer:
                    res = parseInt(v, 10);
                    break;
                case DATA_TYPE.Decimal:
                case DATA_TYPE.Float:
                    res = parseFloat(v);
                    break;
                case DATA_TYPE.DateTime:
                case DATA_TYPE.Date:
                case DATA_TYPE.Time:
                    res = valueUtils.valueToDate(v, dcnv, stz);
                    break;
                case DATA_TYPE.Guid:
                case DATA_TYPE.Binary:
                    res = v;
                    break;
                default:
                    throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_PARAM_INVALID, 'dataType', dataType));
            }
            return res;
        }
    };
    thisModule.valueUtils = valueUtils;

    //Base Collection Item interface - contains _key property
    CollectionItem = RIAPP.BaseObject.extend({
            _app:app,
            _create:function () {
                this._super();
                this._fkey = null;
                this._isEditing = false;
                this._saveVals = null;
                this._vals = {};
                this._notEdited = true;
            },
            _getEventNames:function () {
                var base_events = this._super();
                return ['errors_changed'].concat(base_events);
            },
            _onError:function (error, source) {
                var isHandled = this._super(error, source);
                if (!isHandled) {
                    return this._collection._onError(error, source);
                }
                return isHandled;
            },
            _beginEdit:function () {
                var coll = this._collection, isHandled;
                if (coll.isEditing) {
                    var eitem = coll._EditingItem;
                    if (eitem === this)
                        return false;
                    try {
                        eitem.endEdit();
                        if (eitem.getIsHasErrors()) {
                            this._onError(ValidationError.create(eitem.getAllErrors(), eitem), eitem);
                            eitem.cancelEdit();
                        }
                    } catch (ex) {
                        isHandled = this._onError(ex, eitem);
                        eitem.cancelEdit();
                        global.reThrow(ex, isHandled);
                    }
                }
                this._isEditing = true;
                this._saveVals = utils.shallowCopy(this._vals);
                this._collection.currentItem = this;
                return true;
            },
            _endEdit:function () {
                if (!this._isEditing)
                    return false;
                var validation_errors, coll = this._collection, self = this;
                if (this.getIsHasErrors()) {
                    return false;
                }
                coll._removeAllErrors(this); //revalidate all
                validation_errors = this._validateAll();
                if (validation_errors.length > 0) {
                    coll._addErrors(self, validation_errors);
                }
                if (this.getIsHasErrors()) {
                    return false;
                }
                this._isEditing = false;
                this._saveVals = null;
                return true;
            },
            _validate:function () {
                return this._collection._validateItem(this);
            },
            _skipValidate:function (fieldInfo, val) {
                return false;
            },
            _validateField:function (fieldName) {
                var val, fieldInfo = this.getFieldInfo(fieldName), res = null;
                try {
                    val = this._vals[fieldName];
                    if (this._skipValidate(fieldInfo, val))
                        return res;
                    if (this._isNew) {
                        if (val === null && !fieldInfo.isNullable && !fieldInfo.isReadOnly && !fieldInfo.isAutoGenerated)
                            throw new Error(RIAPP.ERRS.ERR_FIELD_ISNOT_NULLABLE);
                    }
                    else {
                        if (val === null && !fieldInfo.isNullable && !fieldInfo.isReadOnly)
                            throw new Error(RIAPP.ERRS.ERR_FIELD_ISNOT_NULLABLE);
                    }
                } catch (ex) {
                    res = {fieldName:fieldName, errors:[ex.message]};
                }
                var tmp = this._collection._validateItemField(this, fieldName);
                if (!!res && !!tmp) {
                    res.errors = res.errors.concat(tmp.errors);
                }
                else if (!!tmp)
                    res = tmp;
                return res;
            },
            _validateAll:function () {
                var self = this, fields = this.getFieldNames(), errs = [];
                fields.forEach(function (fieldName) {
                    var res = self._validateField(fieldName);
                    if (!!res) {
                        errs.push(res);
                    }
                });
                var res = self._validate();
                if (!!res) {
                    errs.push(res);
                }
                return errs;
            },
            _checkVal:function (fieldInfo, val) {
                var res = val, ERRS = RIAPP.ERRS;
                if (this._skipValidate(fieldInfo, val))
                    return res;
                if (fieldInfo.isReadOnly && !(fieldInfo.allowClientDefault && this._isNew))
                    throw new Error(ERRS.ERR_FIELD_READONLY);
                if ((val === null || (utils.check_is.String(val) && !val)) && !fieldInfo.isNullable)
                    throw new Error(ERRS.ERR_FIELD_ISNOT_NULLABLE);

                if (val === null)
                    return val;

                switch (fieldInfo.dataType) {
                    case DATA_TYPE.None:
                        break;
                    case DATA_TYPE.Guid:
                    case DATA_TYPE.Binary:
                    case DATA_TYPE.String:
                        if (!utils.check_is.String(val)) {
                            throw new Error(String.format(ERRS.ERR_FIELD_WRONG_TYPE, val, 'String'));
                        }
                        if (fieldInfo.maxLength > 0 && val.length > fieldInfo.maxLength)
                            throw new Error(String.format(ERRS.ERR_FIELD_MAXLEN, fieldInfo.maxLength));
                        if (fieldInfo.isNullable && val === '')
                            res = null;
                        if (!!fieldInfo.regex) {
                            var reg = new RegExp(fieldInfo.regex, "i");
                            if (!reg.test(val)) {
                                throw new Error(String.format(ERRS.ERR_FIELD_REGEX, val));
                            }
                        }
                        break;
                    case DATA_TYPE.Bool:
                        if (!utils.check_is.Boolean(val))
                            throw new Error(String.format(ERRS.ERR_FIELD_WRONG_TYPE, val, 'Boolean'));
                        break;
                    case DATA_TYPE.Integer:
                    case DATA_TYPE.Decimal:
                    case DATA_TYPE.Float:
                        if (!utils.check_is.Number(val))
                            throw new Error(String.format(ERRS.ERR_FIELD_WRONG_TYPE, val, 'Number'));
                        if (!!fieldInfo.range) {
                            utils.validation.checkNumRange(Number(val), fieldInfo.range);
                        }
                        break;
                    case DATA_TYPE.DateTime:
                    case DATA_TYPE.Date:
                        if (!utils.check_is.Date(val))
                            throw new Error(String.format(ERRS.ERR_FIELD_WRONG_TYPE, val, 'Date'));
                        if (!!fieldInfo.range) {
                            utils.validation.checkDateRange(val, fieldInfo.range);
                        }
                        break;
                    case DATA_TYPE.Time:
                        if (!utils.check_is.Date(val))
                            throw new Error(String.format(ERRS.ERR_FIELD_WRONG_TYPE, val, 'Time'));
                        break;
                    default:
                        throw new Error(String.format(ERRS.ERR_PARAM_INVALID, 'dataType', fieldInfo.dataType));
                }
                return res;
            },
            _onErrorsChanged:function (args) {
                this.raiseEvent('errors_changed', args);
            },
            _resetIsNew:function () {
            },
            getFieldInfo:function (fieldName) {
                return this._collection.getFieldInfo(fieldName);
            },
            getFieldNames:function () {
                return this._collection.getFieldNames();
            },
            addOnItemErrorsChanged:function (fn, namespace) {
                this.addHandler('errors_changed', fn, namespace);
            },
            getFieldErrors:function (fieldName) {
                var itemErrors = this._collection._getErrors(this);
                if (!itemErrors)
                    return [];
                var name = fieldName;
                if (!fieldName)
                    fieldName = '*';
                if (!itemErrors[fieldName])
                    return [];
                if (fieldName === '*')
                    name = null;
                return [
                    {fieldName:name, errors:itemErrors[fieldName]}
                ];
            },
            getAllErrors:function () {
                var itemErrors = this._collection._getErrors(this);
                if (!itemErrors)
                    return [];
                var res = [];
                utils.forEachProp(itemErrors, function (name) {
                    var fieldName = null;
                    if (name !== '*') {
                        fieldName = name;
                    }
                    res.push({fieldName:fieldName, errors:itemErrors[name]});
                });
                return res;
            },
            getErrorString:function () {
                var itemErrors = this._collection._getErrors(this);
                if (!itemErrors)
                    return '';
                var res = [];
                utils.forEachProp(itemErrors, function (name) {
                    res.push(String.format('{0}: {1}', name, itemErrors[name]));
                });
                return res.join('|');
            },
            _onAttaching:function () {
            },
            _onAttach:function () {
            },
            beginEdit:function () {
                var coll = this._collection;
                if (!this._beginEdit())
                    return false;
                coll._onEditing(this, true, false);
                this.raisePropertyChanged('isEditing');
                return true;
            },
            endEdit:function () {
                var coll = this._collection;
                if (!this._endEdit())
                    return false;
                coll._onEditing(this, false, false);
                this._notEdited = false;
                this.raisePropertyChanged('isEditing');
                return true;
            },
            cancelEdit:function () {
                if (!this._isEditing)
                    return false;
                var coll = this._collection, isNew = this._isNew;
                var changes = this._saveVals;
                this._vals = this._saveVals;
                this._saveVals = null;
                coll._removeAllErrors(this);
                //refresh User interface when values restored
                coll.getFieldNames().forEach(function (name) {
                    if (changes[name] !== this._vals[name])
                        this.raisePropertyChanged(name);
                }, this);

                if (isNew && this._notEdited)
                    coll.removeItem(this);

                this._isEditing = false;
                coll._onEditing(this, false, true);
                this.raisePropertyChanged('isEditing');
                return true;
            },
            deleteItem:function () {
                var coll = this._collection;
                if (this._key === null)
                    return false;
                if (!coll._onItemDeleting(this)) {
                    return false;
                }
                coll.removeItem(this);
                return true;
            },
            getIsNew:function () {
                return this._isNew;
            },
            getIsDeleted:function () {
                return this._isDeleted;
            },
            getKey:function () {
                return this._key;
            },
            getCollection:function () {
                return this._collection;
            },
            getIsEditing:function () {
                return this._isEditing;
            },
            getIsHasErrors:function () {
                var itemErrors = this._collection._getErrors(this);
                return !!itemErrors;
            },
            destroy:function () {
                this._fkey = null;
                this._saveVals = null;
                this._vals = {};
                this._isEditing = false;
                this._super();
            },
            toString:function () {
                return 'CollectionItem';
            }
        },
        {
            _isNew:{
                get:function () {
                    return false;
                }
            },
            _isDeleted:{
                get:function () {
                    return false;
                }
            },
            _key:{
                set:function (v) {
                    if (v !== null)
                        v = '' + v;
                    this._fkey = v;
                },
                get:function () {
                    return this._fkey;
                }
            },
            _collection:{
                get:function () {
                    return null;
                }
            },
            _isUpdating:{
                get:function () {
                    var coll = this._collection;
                    if (!coll)
                        return false;
                    return coll.isUpdating;
                }
            },
            isEditing:{
                get:function () {
                    return this._isEditing;
                }
            }
        }, function (obj) {
            thisModule.CollectionItem = obj;
        });

    //base collection class
    Collection = RIAPP.BaseObject.extend({
            _app:app,
            _create:function () {
                this._super();
                this._options = {};
                this._isLoading = false;
                this._options.enablePaging = false;
                this._options.pageSize = 10;
                this._EditingItem = null;
                this._perms = {canAddRow:true, canEditRow:true, canDeleteRow:true, canRefreshRow:false };
                this._totalCount = 0; //includes stored on server
                this._pageIndex = 0;
                this._items = [];
                this._itemsByKey = {};
                this._currentPos = -1;
                this._newKey = 0;
                this._fieldMap = {};
                this._errors = {};
                this._ignoreChangeErrors = false;
                this._pkInfo = null;
                this._isUpdating = false;
                this._waitQueue = global.utils.WaitQueue.create(this);
            },
            _getEventNames:function () {
                var base_events = this._super();
                return ['begin_edit', 'end_edit', 'fill', 'coll_changed', 'item_deleting', 'item_adding', 'item_added',
                    'validate', 'current_changing', 'page_changing', 'errors_changed', 'status_changed', 'clearing',
                    'cleared', 'commit_changes'].concat(base_events);
            },
            _getStrValue:function (val, fieldInfo) {
                var dcnv = fieldInfo.dateConversion, stz = utils.get_timeZoneOffset();
                return valueUtils.stringifyValue(val, dcnv, stz);
            },
            _getPKFieldInfos:function () {
                if (!!this._pkInfo)
                    return this._pkInfo;
                var fldMap = this._fieldMap, pk = [];
                utils.forEachProp(fldMap, function (fldName) {
                    if (fldMap[fldName].isPrimaryKey > 0) {
                        pk.push(fldMap[fldName]);
                    }
                });
                pk.sort(function (a, b) {
                    return a.isPrimaryKey - b.isPrimaryKey;
                });
                this._pkInfo = pk;
                return this._pkInfo;
            },
            _onError:function (error, source) {
                var isHandled = this._super(error, source);
                if (!isHandled) {
                    return this._app._onError(error, source);
                }
                return isHandled;
            },
            _onCurrentChanging:function (newCurrent) {
                try {
                    this.endEdit();
                } catch (ex) {
                    global.reThrow(ex, this._onError(ex, this));
                }
                this.raiseEvent('current_changing', { newCurrent:newCurrent });
            },
            _onCurrentChanged:function () {
                this.raisePropertyChanged('currentItem');
            },
            _onEditing:function (item, isBegin, isCanceled) {
                if (this._isUpdating)
                    return;
                if (isBegin) {
                    this._EditingItem = item;
                    this.raiseEvent('begin_edit', { item:item });
                }
                else {
                    this._EditingItem = null;
                    this.raiseEvent('end_edit', { item:item, isCanceled:isCanceled });
                }
            },
            //used by descendants when commiting submits for items
            _onCommitChanges:function (item, isBegin, isRejected, changeType) {
                this.raiseEvent('commit_changes', { item:item, isBegin:isBegin, isRejected:isRejected, changeType:changeType });
            },
            //occurs when item changeType Changed (not used in simple collections)
            _onItemStatusChanged:function (item, oldChangeType) {
                this.raiseEvent('status_changed', { item:item, oldChangeType:oldChangeType, key:item._key });
            },
            _validateItem:function (item) {
                var args = {item:item, fieldName:null, errors:[] };
                this.raiseEvent('validate', args);
                if (!!args.errors && args.errors.length > 0)
                    return {fieldName:null, errors:args.errors};
                else
                    return null;
            },
            _validateItemField:function (item, fieldName) {
                var args = {item:item, fieldName:fieldName, errors:[] };
                this.raiseEvent('validate', args);
                if (!!args.errors && args.errors.length > 0)
                    return {fieldName:fieldName, errors:args.errors};
                else
                    return null;
            },
            _addErrors:function (item, errors) {
                var self = this;
                this._ignoreChangeErrors = true;
                try {
                    errors.forEach(function (err) {
                        self._addError(item, err.fieldName, err.errors);
                    });
                } finally {
                    this._ignoreChangeErrors = false;
                }
                this._onErrorsChanged(item);
            },
            _addError:function (item, fieldName, errors) {
                if (!fieldName)
                    fieldName = '*';
                if (!(utils.check_is.Array(errors) && errors.length > 0)) {
                    this._removeError(item, fieldName);
                    return;
                }
                if (!this._errors[item._key])
                    this._errors[item._key] = {};
                var itemErrors = this._errors[item._key];
                itemErrors[fieldName] = errors;
                if (!this._ignoreChangeErrors)
                    this._onErrorsChanged(item);
            },
            _removeError:function (item, fieldName) {
                var itemErrors = this._errors[item._key];
                if (!itemErrors)
                    return;
                if (!fieldName)
                    fieldName = '*';
                if (!itemErrors[fieldName])
                    return;
                delete itemErrors[fieldName];
                if (utils.getProps(itemErrors).length === 0) {
                    delete this._errors[item._key];
                }
                this._onErrorsChanged(item);
            },
            _removeAllErrors:function (item) {
                var self = this, itemErrors = this._errors[item._key];
                if (!itemErrors)
                    return;
                delete this._errors[item._key];
                self._onErrorsChanged(item);
            },
            _getErrors:function (item) {
                return this._errors[item._key];
            },
            _onErrorsChanged:function (item) {
                var args = { item:item };
                this.raiseEvent('errors_changed', args);
                item._onErrorsChanged(args);
            },
            _onItemDeleting:function (item) {
                var args = { item:item, isCancel:false };
                this.raiseEvent('item_deleting', args);
                return !args.isCancel;
            },
            _onFillStart:function (args) {
                this.raiseEvent('fill', args);
            },
            _onFillEnd:function (args) {
                this.raiseEvent('fill', args);
            },
            _onItemsChanged:function (args) {
                this.raiseEvent('coll_changed', args);
            },
            //new item is being added, but is not in the collection now
            _onItemAdding:function (item) {
                var args = { item:item, isCancel:false };
                this.raiseEvent('item_adding', args);
                if (args.isCancel)
                    global._throwDummy(new Error('operation canceled'));
            },
            //new item has been added and now is in editing state and is currentItem
            _onItemAdded:function (item) {
                var args = { item:item, isAddNewHandled:false };
                this.raiseEvent('item_added', args);
            },
            _createNew:function () {
                throw new Error('Not implemented');
            },
            _attach:function (item, itemPos) {
                if (!!this._itemsByKey[item._key]) {
                    throw new Error(RIAPP.ERRS.ERR_ITEM_IS_ATTACHED);
                }
                try {
                    this.endEdit();
                } catch (ex) {
                    global.reThrow(ex, this._onError(ex, this));
                }
                var pos;
                item._onAttaching();
                if (utils.check_is.nt(itemPos)) {
                    pos = this._items.length;
                    this._items.push(item);
                }
                else {
                    pos = itemPos;
                    utils.insertIntoArray(this._items,item,pos);
                }
                this._itemsByKey[item._key] = item;
                this._onItemsChanged({ change_type:COLL_CHANGE_TYPE.ADDED, items:[item], pos:[pos] });
                item._onAttach();
                this.raisePropertyChanged('count');
                this._onCurrentChanging(item);
                this._currentPos = pos;
                this._onCurrentChanged();
                return pos;
            },
            _onRemoved:function (item, pos) {
                var CH_T = COLL_CHANGE_TYPE;
                try {
                    this._onItemsChanged({ change_type:CH_T.REMOVE, items:[item], pos:[pos] });
                }
                finally {
                    this.raisePropertyChanged('count');
                }
            },
            _onPageSizeChanged:function () {
            },
            _onPageChanging:function () {
                var args = {page:this.pageIndex, isCancel:false};
                this._raiseEvent('page_changing', args);
                if (!args.isCancel) {
                    try {
                        this.endEdit();
                    } catch (ex) {
                        global.reThrow(ex, this._onError(ex, this));
                    }
                }
                return !args.isCancel;
            },
            _onPageChanged:function () {
            },
            _setCurrentItem:function (v) {
                var self = this, oldPos = self._currentPos;
                if (!v) {
                    if (oldPos !== -1) {
                        self._onCurrentChanging(null);
                        self._currentPos = -1;
                        self._onCurrentChanged();
                    }
                    return;
                }
                if (v._key === null)
                    throw new Error(RIAPP.ERRS.ERR_ITEM_IS_DETACHED);
                var oldItem, pos, item = self.getItemByKey(v._key);
                if (!item) {
                    throw new Error(RIAPP.ERRS.ERR_ITEM_IS_NOTFOUND);
                }
                oldItem = self.getItemByPos(oldPos);
                pos = self._items.indexOf(v);
                if (pos < 0)
                    throw new Error(RIAPP.ERRS.ERR_ITEM_IS_NOTFOUND);
                if (oldPos !== pos || oldItem !== v) {
                    self._onCurrentChanging(v);
                    self._currentPos = pos;
                    self._onCurrentChanged();
                }
            },
            _destroyItems:function () {
                this._items.forEach(function (item) {
                    item.destroy();
                });
            },
            getFieldInfo:function (fieldName) {
                return this._fieldMap[fieldName];
            },
            getFieldNames:function () {
                var fldMap = this._fieldMap;
                return utils.getProps(fldMap);
            },
            cancelEdit:function () {
                if (this.isEditing)
                    this._EditingItem.cancelEdit();
            },
            endEdit:function () {
                var EditingItem;
                if (this.isEditing) {
                    EditingItem = this._EditingItem;
                    if (!EditingItem.endEdit() && EditingItem.getIsHasErrors()) {
                        this._onError(ValidationError.create(EditingItem.getAllErrors(), EditingItem), EditingItem);
                        this.cancelEdit();
                    }
                }
            },
            getItemsWithErrors:function () {
                var self = this, res = [];
                utils.forEachProp(this._errors, function (key) {
                    var item = self.getItemByKey(key);
                    res.push(item);
                });
                return res;
            },
            addNew:function () {
                var item, isHandled;
                item = this._createNew();
                this._onItemAdding(item);
                this._attach(item, null);
                try {
                    this.currentItem = item;
                    item.beginEdit();
                    this._onItemAdded(item);
                }
                catch (ex) {
                    isHandled = this._onError(ex, this);
                    item.cancelEdit();
                    global.reThrow(ex, isHandled);
                }
                return item;
            },
            getItemByPos:function (pos) {
                if (pos < 0 || pos >= this._items.length)
                    return null;
                return this._items[pos];
            },
            getItemByKey:function (key) {
                if (!key)
                    throw new Error(RIAPP.ERRS.ERR_KEY_IS_EMPTY);
                var map = this._itemsByKey;
                return map['' + key];
            },
            findByPK:function () {
                if (arguments.length === 0)
                    return null;
                var args = utils.slice.call(arguments);
                var self = this, pkInfo = self._getPKFieldInfos(), arr = [], key;
                if (args.length === 1 && utils.check_is.Array(args[0])) {
                    args = args[0];
                }
                if (args.length !== pkInfo.length) {
                    return null;
                }
                for (var i = 0, len = pkInfo.length; i < len; i += 1) {
                    arr.push(self._getStrValue(args[i], pkInfo[i]));
                }

                key = arr.join(';');
                return self.getItemByKey(key);
            },
            moveFirst:function (skipDeleted) {
                var pos = 0, old = this._currentPos;
                if (old === pos)
                    return false;
                var item = this.getItemByPos(pos);
                if (!item)
                    return false;
                if (!!skipDeleted) {
                    if (item._isDeleted) {
                        return this.moveNext(true);
                    }
                }
                this._onCurrentChanging(item);
                this._currentPos = pos;
                this._onCurrentChanged();
                return true;
            },
            movePrev:function (skipDeleted) {
                var pos = -1, old = this._currentPos;
                var item = this.getItemByPos(old);
                if (!!item) {
                    pos = old;
                    pos -= 1;
                }
                item = this.getItemByPos(pos);
                if (!item)
                    return false;
                if (!!skipDeleted) {
                    if (item._isDeleted) {
                        this._currentPos = pos;
                        return this.movePrev(true);
                    }
                }
                this._onCurrentChanging(item);
                this._currentPos = pos;
                this._onCurrentChanged();
                return true;
            },
            moveNext:function (skipDeleted) {
                var pos = -1, old = this._currentPos;
                var item = this.getItemByPos(old);
                if (!!item) {
                    pos = old;
                    pos += 1;
                }
                item = this.getItemByPos(pos);
                if (!item)
                    return false;
                if (!!skipDeleted) {
                    if (item._isDeleted) {
                        this._currentPos = pos;
                        return this.moveNext(true);
                    }
                }
                this._onCurrentChanging(item);
                this._currentPos = pos;
                this._onCurrentChanged();
                return true;
            },
            moveLast:function (skipDeleted) {
                var pos = this._items.length - 1, old = this._currentPos;
                if (old === pos)
                    return false;
                var item = this.getItemByPos(pos);
                if (!item)
                    return false;
                if (!!skipDeleted) {
                    if (item._isDeleted) {
                        return this.movePrev(true);
                    }
                }
                this._onCurrentChanging(item);
                this._currentPos = pos;
                this._onCurrentChanged();
                return true;
            },
            goTo:function (pos) {
                var old = this._currentPos;
                if (old === pos)
                    return false;
                var item = this.getItemByPos(pos);
                if (!item)
                    return false;
                this._onCurrentChanging(item);
                this._currentPos = pos;
                this._onCurrentChanged();
                return true;
            },
            forEach:function (callback, thisObj) {
                this._items.forEach(callback, thisObj);
            },
            removeItem:function (item) {
                if (item._key === null) {
                    throw new Error(RIAPP.ERRS.ERR_ITEM_IS_DETACHED);
                }
                if (!this._itemsByKey[item._key])
                    return;
                var oldPos = utils.removeFromArray(this._items,item);
                if (oldPos < 0) {
                    throw new Error(RIAPP.ERRS.ERR_ITEM_IS_NOTFOUND);
                }
                delete this._itemsByKey[item._key];
                delete this._errors[item._key];
                this._onRemoved(item, oldPos);
                item._key = null;
                item.removeHandler(null, null);
                var test = this.getItemByPos(oldPos), curPos = this._currentPos;

                //if detached item was current item
                if (curPos === oldPos) {
                    if (!test) { //it was the last item
                        this._currentPos = curPos - 1;
                    }
                    this._onCurrentChanged();
                }

                if (curPos > oldPos) {
                    this._currentPos = curPos - 1;
                    this._onCurrentChanged();
                }
            },
            getIsHasErrors:function () {
                if (!this._errors)
                    return false;
                return (utils.getProps(this._errors).length > 0);
            },
            sortLocal:function (fieldNames, sortOrder) {
                var mult = 1;
                if (!!sortOrder && sortOrder.toUpperCase() === 'DESC')
                    mult = -1;
                var fn_sort = function (a, b) {
                    var res = 0, i, len, af, bf, fieldName;
                    for (i = 0, len = fieldNames.length; i < len; i += 1) {
                        fieldName = fieldNames[i];
                        af = a[fieldName];
                        bf = b[fieldName];
                        if (af < bf)
                            res = -1 * mult;
                        else if (af > bf)
                            res = mult;
                        else
                            res = 0;

                        if (res !== 0)
                            return res;
                    }
                    return res;
                };
                this.sortLocalByFunc(fn_sort);
            },
            sortLocalByFunc:function (fn) {
                this.waitForNotLoading(function () {
                    var self = this, cur = self.currentItem;
                    self.isLoading = true;
                    try {
                        self._items.sort(fn);
                        self._onItemsChanged({ change_type:COLL_CHANGE_TYPE.RESET, items:[] });
                    } finally {
                        self.isLoading = false;
                    }
                    self.currentItem = null;
                    self.currentItem = cur;
                }, [], false, null);
            },
            clear:function () {
                this.raiseEvent('clearing', {});
                this.cancelEdit();
                this._EditingItem = null;
                this._newKey = 0;
                this.currentItem = null;
                this._destroyItems();
                this._items = [];
                this._itemsByKey = {};
                this._errors = {};
                this._onItemsChanged({ change_type:COLL_CHANGE_TYPE.RESET, items:[] });
                this.raiseEvent('cleared', {});
                this.raisePropertyChanged('count');
            },
            destroy:function () {
                if (!this._waitQueue)
                    return;
                this._waitQueue.destroy();
                this._waitQueue = null;
                this.clear();
                this._fieldMap = {};
                this._super();
            },
            waitForNotLoading:function (callback, callbackArgs, syncCheck, groupName) {
                this._waitQueue.enQueue({
                    prop:'isLoading',
                    groupName:null,
                    predicate:function (val) {
                        return !val;
                    },
                    action:callback,
                    actionArgs:callbackArgs,
                    lastWins:!!groupName,
                    syncCheck:!!syncCheck
                });
            },
            toString:function () {
                return 'Collection';
            }
        },
        {
            app:{
                get:function () {
                    return this._app;
                }
            },
            options:{
                get:function () {
                    return this._options;
                }
            },
            currentItem:{
                set:function (v) {
                    this._setCurrentItem(v);
                },
                get:function () {
                    return this.getItemByPos(this._currentPos);
                }
            },
            count:{
                get:function () {
                    return this._items.length;
                }
            },
            totalCount:{
                set:function (x) {
                    if (x != this._totalCount) {
                        this._totalCount = x;
                        this.raisePropertyChanged('totalCount');
                        this.raisePropertyChanged('pageCount');
                    }
                },
                get:function () {
                    return this._totalCount;
                }
            },
            pageSize:{
                set:function (v) {
                    if (this._options.pageSize !== v) {
                        this._options.pageSize = v;
                        this.raisePropertyChanged('pageSize');
                        this._onPageSizeChanged();
                    }
                },
                get:function () {
                    return this._options.pageSize;
                }
            },
            pageIndex:{
                set:function (x) {
                    if (x !== this._pageIndex && this.isPagingEnabled) {
                        if (x < 0)
                            return;
                        if (!this._onPageChanging()) {
                            return;
                        }
                        this._pageIndex = x;
                        this._onPageChanged();
                        this.raisePropertyChanged('pageIndex');
                    }
                },
                get:function () {
                    return this._pageIndex;
                }
            },
            items:{
                get:function () {
                    return this._items;
                }
            },
            isPagingEnabled:{
                get:function () {
                    return this._options.enablePaging;
                }
            },
            permissions:{
                get:function () {
                    return this._perms;
                }
            },
            isEditing:{
                get:function () {
                    return !!this._EditingItem;
                }
            },
            isLoading:{
                set:function (v) {
                    if (this._isLoading !== v) {
                        this._isLoading = v;
                        this.raisePropertyChanged('isLoading');
                    }
                },
                get:function () {
                    return this._isLoading;
                }
            },
            isUpdating:{
                set:function (v) {
                    if (this._isUpdating !== v) {
                        this._isUpdating = v;
                        this.raisePropertyChanged('isUpdating');
                    }
                },
                get:function () {
                    return this._isUpdating;
                }
            },
            pageCount:{
                get:function () {
                    var rowCount = this.totalCount, rowPerPage = this.pageSize, result;

                    if ((rowCount === 0) || (rowPerPage === 0)) {
                        return 0;
                    }

                    if ((rowCount % rowPerPage) === 0) {
                        return (rowCount / rowPerPage);
                    }
                    else {
                        result = (rowCount / rowPerPage);
                        result = Math.floor(result) + 1;
                        return result;
                    }
                }
            }
        }, function (obj) {
            thisModule.Collection = obj;
        });

    //static method
    Collection.getEmptyFieldInfo = function (fieldName) {
        var fieldInfo = {isPrimaryKey:0,
            isRowTimeStamp:false,
            dataType:DATA_TYPE.NONE,
            isNullable:true,
            maxLength:-1,
            isReadOnly:false,
            isAutoGenerated:false,
            allowClientDefault:false,
            dateConversion:consts.DATE_CONVERSION.NONE,
            isClientOnly:true,
            isCalculated:false,
            isNeedOriginal:false,
            dependentOn:null,
            range:null,
            regex:null,
            isNavigation:false,
            fieldName:fieldName
        };
        return fieldInfo;
    };

    //ListItem contains _vals to store values of properties
    //it is used as prototype to create item types as in List's _createItemType method;
    ListItem = CollectionItem.extend({
        //obj parameter is optional
        _create:function (obj) {
            this._super();
            this.__isNew = !obj;
            //if object provided then all properties are exposed from the object
            if (!!obj)
                this._vals = obj;

            if (!obj) { //if no object then fill values with nulls
                this._collection.getFieldNames().forEach(function (name) {
                    this._vals[name] = null;
                }, this);
            }
        },
        _setProp:function (name, val) {
            var validation_error, error, coll = this._collection;
            if (this._vals[name] !== val) {
                try {
                    this._vals[name] = val;
                    this.raisePropertyChanged(name);
                    coll._removeError(this, name);
                    validation_error = this._validateField(name);
                    if (!!validation_error) {
                        throw ValidationError.create([validation_error], this);
                    }
                } catch (ex) {
                    if (ValidationError.isPrototypeOf(ex)) {
                        error = ex;
                    }
                    else {
                        error = ValidationError.create([
                            {fieldName:name, errors:[ex.message]}
                        ], this);
                    }
                    coll._addError(this, name, error.errors[0].errors);
                    throw error;
                }
            }
        },
        _getProp:function (name) {
            return this._vals[name];
        },
        _resetIsNew:function () {
            this.__isNew = false;
        },
        toString:function () {
            return 'ListItem';
        }
    }, {
        _isNew:{
            get:function () {
                return this.__isNew;
            }
        },
        _collection:{
            get:function () {
                return this.__coll;
            }
        }
    }, function (obj) {
        thisModule.ListItem = obj;
    });

    //concrete realisation of Collection base class
    List = Collection.extend({
        //expects array of property names, like ['someprop1','someprop2'] or
        //object from which properties is taken (all properties that object has)
        _create:function (type_name, properties) {
            this._super();
            this._type_name = type_name;
            if (RIAPP.utils.isArray(properties)) {
                this._props = properties;
                if (this._props.length === 0)
                    throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_PARAM_INVALID, 'properties', properties));
                this._initFieldMap(false, properties);
            }
            else if (CollectionItem.isPrototypeOf(properties)) {
                //for properties which is collection item, we can obtain names by using getFieldNames();
                this._props = properties.getFieldNames();
                this._initFieldMap(true, properties);
            }
            else if (!!properties) {
                //properties parameter is just simple object
                //all its keys will be property names
                this._props = Object.keys(properties);
                this._initFieldMap(false, properties);
            }
            else
                throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_PARAM_INVALID, 'properties', properties));
            this._itemType = null;
            this._createItemType();
        },
        _initFieldMap:function (isCollectionItem, obj) {
            var self = this;
            if (!isCollectionItem) {
                this._props.forEach(function (prop) {
                    self._fieldMap[prop] = Collection.getEmptyFieldInfo(prop);
                });
            }
            else {
                this._props.forEach(function (prop) {
                    self._fieldMap[prop] = utils.extend(false, {}, obj.getFieldInfo(prop));
                });
            }
        },
        _attach:function (item) {
            try {
                this.endEdit();
            } catch (ex) {
                global.reThrow(ex, this._onError(ex, this));
            }
            var pos = this._super(item);
            return pos;
        },
        _createNew:function () {
            var item = this._itemType.create(null);
            item._key = this._getNewKey(null); //client item ID
            return item;
        },
        _createItemType:function () {
            var fd = {};
            //create field accessor descriptor for each field
            this.getFieldNames().forEach(function (name) {
                fd[name] = {
                    set:function (x) {
                        this._setProp(name, x);
                    },
                    get:function () {
                        return this._getProp(name);
                    }
                };
            }, this);

            //accessor from Item to ArraySet
            fd['_collection'] = {
                get:function () {
                    return this.__coll;
                }
            };
            var typename = this._type_name;
            this._itemType = ListItem.extend({ __coll:this }, fd, function (obj) {
                obj._typeName = typename + 'Item';
            });
        },
        //here item parameter is not used, but can be used in descendants
        _getNewKey:function (item) {
            var key = 'clkey_' + this._newKey; //client's item ID
            this._newKey += 1;
            return key;
        },
        fillItems:function (objArray, clearAll) {
            var newItems = [], positions = [], fetchedItems = [];
            this._onFillStart({ isBegin:true, rowCount:objArray.length, time:new Date(), isPageChanged:false });
            try {
                if (!!clearAll) this.clear();

                objArray.forEach(function (obj) {
                    var item = this._itemType.create(obj);
                    item._key = this._getNewKey(item);
                    var oldItem = this._itemsByKey[item._key];
                    if (!oldItem) {
                        this._items.push(item);
                        this._itemsByKey[item._key] = item;
                        newItems.push(item);
                        positions.push(this._items.length - 1);
                        fetchedItems.push(item);
                    }
                    else {
                        fetchedItems.push(oldItem);
                    }
                }, this);

                if (newItems.length > 0) {
                    this._onItemsChanged({ change_type:COLL_CHANGE_TYPE.ADDED, items:newItems, pos:positions });
                    this.raisePropertyChanged('count');
                }
            }
            finally {
                this._onFillEnd({ isBegin:false, rowCount:fetchedItems.length, time:new Date(), resetUI:!!clearAll,
                    fetchedItems:fetchedItems, newItems:newItems, isPageChanged:false });
            }
            this.moveFirst();
        },
        getNewObjects:function () {
            return this._items.filter(function (item) {
                return item._isNew;
            });
        },
        resetNewObjects:function () {
            this._items.forEach(function (item) {
                item._resetIsNew();
            });
        },
        toString:function () {
            return 'List';
        }
    }, null, function (obj) {
        thisModule.List = obj;
        app.registerType('List', obj);
    });

    //concrete realisation of Collection base class - extends List class
    //keyName will be primary key
    Dictionary = List.extend({
        //expects properties - array of property names, like ['someprop1','someprop2']
        //and keyName - property name which will be the key in dictionary collection
        _create:function (type_name, properties, keyName) {
            if (!keyName)
                throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_PARAM_INVALID, 'keyName', keyName));
            this._keyName = keyName;
            this._super(type_name, properties);
            var keyFld = this.getFieldInfo(keyName);
            if (!keyFld)
                throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_DICTKEY_IS_NOTFOUND, keyName));
            keyFld.isPrimaryKey = 1;
        },
        _getNewKey:function (item) {
            if (!item) {
                return this._super(null);
            }
            var key = item[this._keyName];
            if (utils.check_is.nt(key))
                throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_DICTKEY_IS_EMPTY, this._keyName));
            return '' + key;
        },
        toString:function () {
            return 'Dictionary';
        }
    }, null, function (obj) {
        thisModule.Dictionary = obj;
        app.registerType('Dictionary', obj);
    });
};

RIAPP.Application._coreModules.db = function (app) {
    var thisModule = this, global = app.global, collMod = app.modules.collection, errorMod = global.modules.errors,
        utils = global.utils, Entity, DataQuery, DbSet, DATA_TYPE = global.consts.DATA_TYPE, CHANGE_TYPE = global.consts.CHANGE_TYPE;
    var valueUtils = collMod.valueUtils, COLL_CHANGE_TYPE = collMod.consts.COLL_CHANGE_TYPE,
        FLAGS = {None:0, Changed:1, Setted:2, Refreshed:4},
        FILTER_TYPE = { Equals:0, Between:1, StartsWith:2, EndsWith:3, Contains:4, Gt:5, Lt:6, GtEq:7, LtEq:8, NotEq:9 },
        SORT_ORDER = collMod.consts.SORT_ORDER;

    var DATA_OPER = {SUBMIT:'submit', LOAD:'load', INVOKE:'invoke', REFRESH:'refresh', INIT:'initDbContext'};
    var DATA_SVC_METH = { Invoke:'InvokeMethod', LoadData:'GetItems', InitDbContext:'GetMetadata',
        Submit:'SaveChanges', Refresh:'RefreshItem' };
    var REFRESH_MODE = {NONE:0, RefreshCurrent:1, MergeIntoCurrent:2, CommitChanges:3};
    var DELETE_ACTION = {NoAction:0, Cascade:1, SetNulls:2};

    var DataOperationError = errorMod.BaseError.extend({
        _create:function (ex, operationName) {
            var message;
            if (!!ex)
                message = ex.message;
            if (!message)
                message = '' + ex;
            this._super(message);
            this._origError = ex;
            this._operationName = operationName;
        }
    }, {
        operationName:{
            get:function () {
                return this._operationName;
            }
        }
    }, function (obj) {
        thisModule.DataOperationError = obj;
        app.registerType('DataOperationError', obj);
    });

    var ValidationError = app.modules.binding.ValidationError;

    thisModule.AccessDeniedError = DataOperationError.extend(null, null, function (obj) {
        app.registerType('AccessDeniedError', obj);
    });

    thisModule.ConcurrencyError = DataOperationError.extend(null, null, function (obj) {
        app.registerType('ConcurrencyError', obj);
    });

    thisModule.SvcValidationError = DataOperationError.extend(null, null, function (obj) {
        app.registerType('SvcValidationError', obj);
    });

    var SubmitError = thisModule.SubmitError = DataOperationError.extend({
        _create:function (origError, allSubmitted, notValidated) {
            var message = origError.message || ('' + origError);
            this._super(message, 'submit');
            this._origError = origError;
            this._allSubmitted = allSubmitted || [];
            this._notValidated = notValidated || [];
            if (this._notValidated.length > 0) {
                var res = [message + ':'];
                this._notValidated.forEach(function (item) {
                    res.push(String.format('item key:{0} errors:{1}', item._key, item.getErrorString()));
                });
                this._message = res.join('\r\n');
            }
        }
    }, {
        allSubmitted:{
            get:function () {
                return this._allSubmitted;
            }
        },
        notValidated:{
            get:function () {
                return this._notValidated;
            }
        }
    }, function (obj) {
        app.registerType('SubmitError', obj);
    });

    thisModule.checkError = function (svcError, oper) {
        if (!svcError)
            return;
        switch (svcError.name) {
            case "AccessDeniedException":
                throw thisModule.AccessDeniedError.create(RIAPP.ERRS.ERR_ACCESS_DENIED, oper);
                break;
            case "ConcurrencyException":
                throw thisModule.ConcurrencyError.create(RIAPP.ERRS.ERR_CONCURRENCY, oper);
                break;
            case "ValidationException":
                throw thisModule.SvcValidationError.create(utils.format(RIAPP.ERRS.ERR_VALIDATION,
                    svcError.message), oper);
                break;
            case "DomainServiceException":
                throw DataOperationError.create(utils.format(RIAPP.ERRS.ERR_SVC_ERROR,
                    svcError.message), oper);
                break;
            default:
                throw DataOperationError.create(utils.format(RIAPP.ERRS.ERR_UNEXPECTED_SVC_ERROR,
                    svcError.message), oper);
        }
    };

    var DataCache = RIAPP.BaseObject.extend({
            _create:function (query) {
                this._super();
                this._query = query;
                this._cache = [];
                this._totalCount = 0;
                this._itemsByKey = {};
            },
            getCachedPage:function (pageIndex) {
                var res = this._cache.filter(function (item) {
                    return item.pageIndex === pageIndex;
                });
                if (res.length == 0)
                    return null;
                if (res.length != 1)
                    throw new Error(String.format(RIAPP.ERRS.ERR_ASSERTION_FAILED, "res.length == 1"));
                return res[0];
            },
            //reset items key index
            reindexCache:function () {
                this._itemsByKey = {};
                for (var i = 0; i < this._cache.length; i += 1) {
                    this._cache[i].items.forEach(function (item) {
                        this._itemsByKey[item._key] = item;
                    }, this);
                }
            },
            getPrevCachedPageIndex:function (currentPageIndex) {
                var pageIndex = -1, cachePageIndex;
                for (var i = 0; i < this._cache.length; i += 1) {
                    cachePageIndex = this._cache[i].pageIndex;
                    if (cachePageIndex > pageIndex && cachePageIndex < currentPageIndex)
                        pageIndex = cachePageIndex;
                }
                return pageIndex;
            },
            getNextRange:function (pageIndex) {
                var half = Math.floor(((this.loadPageCount - 1) / 2));
                var above = (pageIndex + half) + ((this.loadPageCount - 1) % 2);
                var below = (pageIndex - half), prev = this.getPrevCachedPageIndex(pageIndex);
                if (below < 0) {
                    above += (0 - below);
                    below = 0;
                }
                if (below <= prev) {
                    above += (prev - below + 1);
                    below += (prev - below + 1);
                }
                if (this._pageCount > this.loadPageCount && above > (this._pageCount - 1)) {
                    below -= (above - (this._pageCount - 1));

                    if (below < 0) {
                        below = 0;
                    }

                    above = this._pageCount - 1;
                }
                //once again check for previous cached range
                if (below <= prev) {
                    above += (prev - below + 1);
                    below += (prev - below + 1);
                }

                var cnt = above - below + 1;
                if (cnt < this.loadPageCount) {
                    above += this.loadPageCount - cnt;
                    cnt = above - below + 1;
                }
                var start = below;
                var end = above;
                return {start:start, end:end, cnt:cnt };
            },
            fillCache:function (start, items) {
                var item, keyMap = this._itemsByKey;
                var i, j, k, len = items.length, pageIndex, cache, pageSize = this.pageSize;
                for (i = 0; i < this.loadPageCount; i += 1) {
                    pageIndex = start + i;
                    cache = this.getCachedPage(pageIndex);
                    if (!cache) {
                        cache = {items:[], pageIndex:pageIndex};
                        this._cache.push(cache);
                    }
                    for (j = 0; j < pageSize; j += 1) {
                        k = (i * pageSize) + j;
                        if (k < len) {
                            item = items[k];
                            if (!!keyMap[item._key]) {
                                continue;
                            }
                            cache.items.push(item);
                            keyMap[item._key] = item;
                            item._isCached = true;
                        }
                        else {
                            return;
                        }
                    }
                }
            },
            clear:function () {
                var i, j, items, item, dbSet = this._query.dbSet;
                for (i = 0; i < this._cache.length; i += 1) {
                    items = this._cache[i].items;
                    for (j = 0; j < items.length; j += 1) {
                        item = items[j];
                        if (!!item && item._key !== null) {
                            item._isCached = false;
                            if (!dbSet.getItemByKey(item._key))
                                item.destroy();
                        }
                    }
                }
                this._cache = [];
                this._itemsByKey = {};
            },
            clearCacheForPage:function (pageIndex) {
                var cache = this.getCachedPage(pageIndex), dbSet = this._query.dbSet;
                if (!cache)
                    return;
                var j, items, item, index = this._cache.indexOf(cache);
                items = cache.items;
                for (j = 0; j < items.length; j += 1) {
                    item = items[j];
                    if (!!item && item._key !== null) {
                        delete this._itemsByKey[item._key];
                        item._isCached = false;
                        if (!dbSet.getItemByKey(item._key))
                            item.destroy();
                    }
                }
                this._cache.splice(index, 1);
            },
            hasPage:function (pageIndex) {
                for (var i = 0; i < this._cache.length; i += 1) {
                    if (this._cache[i].pageIndex === pageIndex)
                        return true;
                }
                return false;
            },
            getItemByKey:function (key) {
                return this._itemsByKey[key];
            },
            getPageByItem:function (item) {
                item = this._itemsByKey[item._key];
                if (!item)
                    return -1;
                for (var i = 0; i < this._cache.length; i += 1) {
                    if (this._cache[i].items.indexOf(item) > -1) {
                        return this._cache[i].pageIndex;
                    }
                }
                return -1;
            },
            destroy:function () {
                this.clear();
                this._super();
            },
            toString:function () {
                return 'DataCache';
            }
        }, {
            _pageCount:{
                get:function () {
                    var rowCount = this.totalCount, rowPerPage = this.pageSize, result;

                    if ((rowCount === 0) || (rowPerPage === 0)) {
                        return 0;
                    }

                    if ((rowCount % rowPerPage) === 0) {
                        return (rowCount / rowPerPage);
                    }
                    else {
                        result = (rowCount / rowPerPage);
                        result = Math.floor(result) + 1;
                        return result;
                    }
                }
            },
            pageSize:{
                get:function () {
                    return this._query.pageSize;
                }
            },
            //measured in cached pages
            loadPageCount:{
                get:function () {
                    return this._query.loadPageCount;
                }
            },
            totalCount:{
                set:function (v) {
                    if (utils.check_is.nt(v))
                        v = 0;
                    if (v !== this._totalCount) {
                        this._totalCount = v;
                        this.raisePropertyChanged('totalCount');
                    }
                },
                get:function () {
                    return this._totalCount;
                }
            },
            cacheSize:{
                get:function () {
                    return this._cache.length;
                }
            }
        },
        function (obj) {
            thisModule.DataCache = obj;
        }
    );

    DataQuery = RIAPP.BaseObject.extend({
            _app:app,
            _create:function (dbSet, queryInfo) {
                this._super();
                this._dbSet = dbSet;
                this.__queryInfo = queryInfo;
                this._filterInfo = { filterItems:[] };
                this._sortInfo = { sortItems:[] };
                this._isIncludeTotalCount = true;
                this._isClearPrevData = true;
                this._pageSize = dbSet.pageSize;
                this._pageIndex = dbSet.pageIndex;
                this._params = {};
                this._loadPageCount = 1;
                this._isClearCacheOnEveryLoad = true;
                this._dataCache = null;
                this._cacheInvalidated = false;
            },
            getFieldInfo:function (fieldName) {
                return this._dbSet.getFieldInfo(fieldName);
            },
            getFieldNames:function () {
                var fldMap = this._dbSet._fieldMap;
                return utils.getProps(fldMap);
            },
            _addSort:function (fieldName, sortOrder) {
                var sort = SORT_ORDER.ASC, sortInfo = this._sortInfo;
                if (!!sortOrder && sortOrder.toLowerCase().substr(0, 1) === 'd')
                    sort = SORT_ORDER.DESC;
                var sortItem = { fieldName:fieldName, sortOrder:sort };
                sortInfo.sortItems.push(sortItem);
                this._cacheInvalidated = true;
            },
            _addFilterItem:function (fieldName, operand, value) {
                var F_TYPE = FILTER_TYPE, fkind = F_TYPE.Equals;
                var fld = this.getFieldInfo(fieldName);
                if (!fld)
                    throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_DBSET_INVALID_FIELDNAME, this.dbSetName, fieldName));

                var stz = this._serverTimezone, dcnv = fld.dateConversion, val = value;
                if (!utils.check_is.Array(val))
                    val = [value];
                var tmp = Array.clone(val);
                val = tmp.map(function (el) {
                    return valueUtils.stringifyValue(el, dcnv, stz);
                });

                switch (operand.toLowerCase()) {
                    case "equals":
                    case "=":
                        fkind = F_TYPE.Equals;
                        break;
                    case "noteq":
                    case "!=":
                    case "<>":
                        fkind = F_TYPE.NotEq;
                        break;
                    case "between":
                        fkind = F_TYPE.Between;
                        if (value.length != 2)
                            throw new Error(RIAPP.ERRS.ERR_QUERY_BETWEEN);
                        break;
                    case "startswith":
                        fkind = F_TYPE.StartsWith;
                        break;
                    case "endswith":
                        fkind = F_TYPE.EndsWith;
                        break;
                    case "contains":
                        fkind = F_TYPE.Contains;
                        break;
                    case "gt":
                    case ">":
                        fkind = F_TYPE.Gt;
                        break;
                    case "gteq":
                    case ">=":
                        fkind = F_TYPE.GtEq;
                        break;
                    case "lt":
                    case "<":
                        fkind = F_TYPE.Lt;
                        break;
                    case "lteq":
                    case "<=":
                        fkind = F_TYPE.LtEq;
                        break;
                    default:
                        throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_QUERY_OPERATOR_INVALID, operand));
                }
                var filterItem = { fieldName:fieldName, kind:fkind, values:val };
                this._filterInfo.filterItems.push(filterItem);
                this._cacheInvalidated = true;
            },
            where:function (fieldName, operand, value) {
                this._addFilterItem(fieldName, operand, value);
                return this;
            },
            and:function (fieldName, operand, value) {
                this._addFilterItem(fieldName, operand, value);
                return this;
            },
            orderBy:function (fieldName, sortOrder) {
                this._addSort(fieldName, sortOrder);
                return this;
            },
            thenBy:function (fieldName, sortOrder) {
                this._addSort(fieldName, sortOrder);
                return this;
            },
            clearSort:function () {
                this._sortInfo.sortItems = [];
                this._cacheInvalidated = true;
                return this;
            },
            clearFilter:function () {
                this._filterInfo.filterItems = [];
                this._cacheInvalidated = true;
                return this;
            },
            clearParams:function () {
                this._params = {};
                this._cacheInvalidated = true;
                return this;
            },
            _clearCache:function () {
                if (!!this._dataCache) {
                    this._dataCache.destroy();
                    this._dataCache = null;
                }
                this._resetCacheInvalidated();
            },
            _getCache:function () {
                if (!this._dataCache) {
                    this._dataCache = DataCache.create(this);
                }
                return this._dataCache;
            },
            _reindexCache:function () {
                if (!this._dataCache) {
                    return;
                }
                this._dataCache.reindexCache();
            },
            _isPageCached:function (pageIndex) {
                if (!this._dataCache) {
                    return false;
                }
                return this._dataCache.hasPage(pageIndex);
            },
            _resetCacheInvalidated:function () {
                this._cacheInvalidated = false;
            },
            destroy:function () {
                this._clearCache();
                this._super();
            },
            toString:function () {
                return 'DataQuery';
            }
        },
        {
            _queryInfo:{
                get:function () {
                    return this.__queryInfo;
                }
            },
            _serverTimezone:{
                get:function () {
                    return this._dbSet.dbContext.serverTimezone;
                }
            },
            entityType:{
                get:function () {
                    return this._dbSet.entityType;
                }
            },
            dbSet:{
                get:function () {
                    return this._dbSet;
                }
            },
            dbSetName:{
                get:function () {
                    return this._dbSet.dbSetName;
                }
            },
            queryName:{
                get:function () {
                    return this.__queryInfo.methodName;
                }
            },
            filterInfo:{
                get:function () {
                    return this._filterInfo;
                }
            },
            sortInfo:{
                get:function () {
                    return this._sortInfo;
                }
            },
            isIncludeTotalCount:{
                set:function (v) {
                    this._isIncludeTotalCount = v;
                },
                get:function () {
                    return this._isIncludeTotalCount;
                }
            },
            isClearPrevData:{
                set:function (v) {
                    this._isClearPrevData = v;
                },
                get:function () {
                    return this._isClearPrevData;
                }
            },
            pageSize:{
                set:function (v) {
                    if (this._pageSize != v) {
                        this._pageSize = v;
                    }
                },
                get:function () {
                    return this._pageSize;
                }
            },
            pageIndex:{
                set:function (v) {
                    if (this._pageIndex != v) {
                        this._pageIndex = v;
                    }
                },
                get:function () {
                    return this._pageIndex;
                }
            },
            params:{
                set:function (v) {
                    if (this._params !== v) {
                        this._params = v;
                        this._cacheInvalidated = true;
                    }
                },
                get:function () {
                    return this._params;
                }
            },
            isPagingEnabled:{

                get:function () {
                    return  this._dbSet.isPagingEnabled;
                }
            },
            //how much pages to load at once
            loadPageCount:{
                set:function (v) {
                    if (v < 1) {
                        v = 1;
                    }
                    if (this._loadPageCount != v) {
                        this._loadPageCount = v;
                        if (v === 1) {
                            this._clearCache();
                        }
                        this.raisePropertyChanged('loadPageCount');
                    }
                },
                get:function () {
                    return this._loadPageCount;
                }
            },
            //is clear previous cached items after new data load from server
            //or append new items to existing cache
            isClearCacheOnEveryLoad:{
                set:function (v) {
                    if (this._isClearCacheOnEveryLoad != v) {
                        this._isClearCacheOnEveryLoad = v;
                        this.raisePropertyChanged('isClearCacheOnEveryLoad');
                    }
                },
                get:function () {
                    return this._isClearCacheOnEveryLoad;
                }
            },
            isCacheValid:{
                get:function () {
                    return !!this._dataCache && !this._cacheInvalidated;
                }
            }
        }, function (obj) {
            thisModule.DataQuery = obj;
        });

    Entity = collMod.CollectionItem.extend({
            _create:function (row, names) {
                this._super();
                this.__changeType = CHANGE_TYPE.NONE;
                this._srvRowKey = null;
                this._origVals = null;
                this._saveChangeType = null;
                this.__isRefreshing = false;
                this.__isCached = false;
                var fields = this.getFieldNames();
                fields.forEach(function (fieldName) {
                    this._vals[fieldName] = null;
                }, this);
                this._initRowInfo(row, names);
            },
            _initRowInfo:function (row, names) {
                if (!row)
                    return;
                var self = this, stz = self._serverTimezone;
                this._srvRowKey = row.key;
                this._key = row.key;
                row.values.forEach(function (val, index) {
                    var fieldName = names[index], fld = self.getFieldInfo(fieldName);
                    if (!fld)
                        throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_DBSET_INVALID_FIELDNAME, self._dbSetName, fieldName));

                    var newVal = val, dataType = fld.dataType, dcnv = fld.dateConversion,
                        res = valueUtils.parseValue(newVal, dataType, dcnv, stz);
                    self._vals[fld.fieldName] = res;
                });
            },
            _checkCanRefresh:function () {
                if (this._key === null || this._changeType === CHANGE_TYPE.ADDED) {
                    throw new Error(RIAPP.ERRS.ERR_OPER_REFRESH_INVALID);
                }
            },
            _refreshValue:function (val, fieldName, refreshMode) {
                var self = this, fld = self.getFieldInfo(fieldName);
                if (!fld)
                    throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_DBSET_INVALID_FIELDNAME, this._dbSetName, fieldName));
                var stz = self._serverTimezone, newVal, oldVal, oldValOrig,
                    dataType = fld.dataType, dcnv = fld.dateConversion;
                newVal = valueUtils.parseValue(val, dataType, dcnv, stz);
                oldVal = self._vals[fieldName];
                switch (refreshMode) {
                    case REFRESH_MODE.CommitChanges:
                    {
                        if (!valueUtils.compareVals(newVal, oldVal, dataType)) {
                            self._vals[fieldName] = newVal;
                            self._onFieldChanged(fld);
                        }
                    }
                        break;
                    case REFRESH_MODE.RefreshCurrent:
                    {
                        if (!!self._origVals) {
                            self._origVals[fieldName] = newVal;
                        }
                        if (!!self._saveVals) {
                            self._saveVals[fieldName] = newVal;
                        }
                        if (!valueUtils.compareVals(newVal, oldVal, dataType)) {
                            self._vals[fieldName] = newVal;
                            self._onFieldChanged(fld);
                        }
                    }
                        break;
                    case REFRESH_MODE.MergeIntoCurrent:
                    {
                        if (!!self._origVals) {
                            oldValOrig = self._origVals[fieldName];
                            self._origVals[fieldName] = newVal;
                        }
                        if (oldValOrig === undefined || valueUtils.compareVals(oldValOrig, oldVal, dataType)) { //unmodified
                            if (!valueUtils.compareVals(newVal, oldVal, dataType)) {
                                self._vals[fieldName] = newVal;
                                self._onFieldChanged(fld);
                            }
                        }
                    }
                        break;
                    default:
                        throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_PARAM_INVALID, 'refreshMode', refreshMode));
                }
            },
            _refreshValues:function (rowInfo, refreshMode) {
                var self = this, oldCT = this._changeType;
                if (!this._isDestroyed) {
                    if (!refreshMode) {
                        refreshMode = REFRESH_MODE.RefreshCurrent;
                    }
                    rowInfo.values.forEach(function (val) {
                        if (!((val.flags & FLAGS.Refreshed) === FLAGS.Refreshed))
                            return;
                        self._refreshValue(val.val, val.fieldName, refreshMode);
                    });

                    if (oldCT === CHANGE_TYPE.UPDATED) {
                        var changes = this._getStrValues(true);
                        if (changes.length === 0) {
                            this._origVals = null;
                            this._changeType = CHANGE_TYPE.NONE;
                        }
                    }
                }
            },
            _onFieldChanged:function (fieldInfo) {
                this.raisePropertyChanged(fieldInfo.fieldName);
                if (!!fieldInfo.dependents && fieldInfo.dependents.length > 0)
                    fieldInfo.dependents.forEach(function (d) {
                        this.raisePropertyChanged(d);
                    }, this);
            },
            _getStrValues:function (changedOnly) {
                var names = this.getFieldNames(), dbSet = this._dbSet , res, res2;
                res = names.map(function (name) {
                    var fld = this.getFieldInfo(name);
                    if (fld.isClientOnly)
                        return null;

                    var newVal = dbSet._getStrValue(this._vals[name], fld),
                        oldV = this._origVals === null ? newVal : dbSet._getStrValue(this._origVals[name], fld),
                        isChanged = (oldV !== newVal);
                    if (isChanged)
                        return { val:newVal, orig:oldV, fieldName:name, flags:(FLAGS.Changed | FLAGS.Setted) };
                    else if (fld.isPrimaryKey > 0 || fld.isRowTimeStamp || fld.isNeedOriginal)
                        return { val:newVal, orig:oldV, fieldName:name, flags:FLAGS.Setted };
                    else
                        return { val:null, orig:null, fieldName:name, flags:FLAGS.None };

                }, this);

                res2 = res.filter(function (v) {
                    if (!v)
                        return false;
                    return changedOnly ? ((v.flags & FLAGS.Changed) === FLAGS.Changed) : true;
                });
                return res2;
            },
            _getRowInfo:function () {
                var rowInfo = { values:this._getStrValues(false),
                    changeType:this._changeType,
                    serverKey:this._srvKey,
                    clientKey:this._key,
                    error:null };
                return rowInfo;
            },
            _fldChanging:function (fieldInfo, oldV, newV) {
                if (!this._origVals) {
                    this._origVals = utils.shallowCopy(this._vals);
                }
                return true;
            },
            _fldChanged:function (fieldInfo, oldV, newV) {
                if (!fieldInfo.isClientOnly) {
                    switch (this._changeType) {
                        case CHANGE_TYPE.NONE:
                            this._changeType = CHANGE_TYPE.UPDATED;
                            break;
                    }
                }
                this._onFieldChanged(fieldInfo);
                return true;
            },
            _clearFieldVal:function (fieldName) {
                this._vals[fieldName] = null;
            },
            _skipValidate:function (fieldInfo, val) {
                var childToParentNames = this._dbSet._trackAssocMap[fieldInfo.fieldName], res = false;
                if (!!childToParentNames && val === null) {
                    for (var i = 0, len = childToParentNames.length; i < len; i += 1) {
                        res = !!this._getFieldVal(childToParentNames[i]);
                        if (res)
                            break;
                    }
                }
                return res;
            },
            _getFieldVal:function (fieldName) {
                return this._vals[fieldName];
            },
            _setFieldVal:function (fieldName, val) {
                var validation_error, error, dbSetName = this._dbSetName, coll = this._collection,
                    ERRS = RIAPP.ERRS, oldV = this._vals[fieldName], newV = val, fld = this.getFieldInfo(fieldName);
                if (!fld)
                    throw new Error(String.format(ERRS.ERR_DBSET_INVALID_FIELDNAME, dbSetName, fieldName));
                if (!this._isEditing && !this._isUpdating)
                    this.beginEdit();
                try {
                    newV = this._checkVal(fld, newV);
                    if (oldV != newV) {
                        if (this._fldChanging(fld, oldV, newV)) {
                            this._vals[fieldName] = newV;
                            this._fldChanged(fld, oldV, newV);
                        }
                    }
                    coll._removeError(this, fieldName);
                    validation_error = this._validateField(fieldName);
                    if (!!validation_error) {
                        throw ValidationError.create([validation_error], this);
                    }
                } catch (ex) {
                    if (ValidationError.isPrototypeOf(ex)) {
                        error = ex;
                    }
                    else {
                        error = ValidationError.create([
                            {fieldName:fieldName, errors:[ex.message]}
                        ], this);
                    }
                    coll._addError(this, fieldName, error.errors[0].errors);
                    throw error;
                }
                return true;
            },
            _onAttaching:function () {
                this._super();
                this.__changeType = CHANGE_TYPE.ADDED;
            },
            _onAttach:function () {
                this._super();
                if (this._key === null)
                    throw new Error(RIAPP.ERRS.ERR_ITEM_IS_DETACHED);
                this._dbSet._addToChanged(this);
            },
            _beginEdit:function () {
                if (!this._super())
                    return false;
                this._saveChangeType = this._changeType;
                return true;
            },
            _endEdit:function () {
                if (!this._super())
                    return false;
                this._saveChangeType = null;
                return true;
            },
            deleteItem:function () {
                return this.deleteOnSubmit();
            },
            deleteOnSubmit:function () {
                var oldCT = this._changeType, eset = this._dbSet;
                if (!eset._onItemDeleting(this)) {
                    return false;
                }
                if (this._key === null)
                    return false;
                if (oldCT === CHANGE_TYPE.ADDED) {
                    eset.removeItem(this);
                    return true;
                }
                this._changeType = CHANGE_TYPE.DELETED;
                return true;
            },
            acceptChanges:function (rowInfo) {
                var oldCT = this._changeType, eset = this._dbSet;
                if (this._key === null)
                    return;
                if (oldCT !== CHANGE_TYPE.NONE) {
                    eset._onCommitChanges(this, true, false, oldCT);
                    if (oldCT === CHANGE_TYPE.DELETED) {
                        eset.removeItem(this);
                        return;
                    }
                    this._origVals = null;
                    if (!!this._saveVals)
                        this._saveVals = utils.shallowCopy(this._vals);
                    this._changeType = CHANGE_TYPE.NONE;
                    eset._removeAllErrors(this);
                    if (!!rowInfo)
                        this._refreshValues(rowInfo, REFRESH_MODE.CommitChanges);
                    eset._onCommitChanges(this, false, false, oldCT);
                }
            },
            rejectChanges:function () {
                var oldCT = this._changeType, eset = this._dbSet;
                if (this._key === null)
                    return;

                if (oldCT !== CHANGE_TYPE.NONE) {
                    eset._onCommitChanges(this, true, true, oldCT);
                    if (oldCT === CHANGE_TYPE.ADDED) {
                        eset.removeItem(this);
                        return;
                    }

                    var changes = this._getStrValues(true);
                    if (!!this._origVals) {
                        this._vals = utils.shallowCopy(this._origVals);
                        this._origVals = null;
                        if (!!this._saveVals) {
                            this._saveVals = utils.shallowCopy(this._vals);
                        }
                    }
                    this._changeType = CHANGE_TYPE.NONE;
                    eset._removeAllErrors(this);
                    changes.forEach(function (v) {
                        this._onFieldChanged(eset.getFieldInfo(v.fieldName));
                    }, this);
                    eset._onCommitChanges(this, false, true, oldCT);
                }
            },
            //returns promise
            refresh:function () {
                var eset = this._dbSet, db = eset.dbContext;
                return db._refreshItem(this);
            },
            cancelEdit:function () {
                if (!this._isEditing)
                    return false;
                var changes = this._getStrValues(true), isNew = this._isNew, coll = this._dbSet;
                this._isEditing = false;
                this._vals = this._saveVals;
                this._saveVals = null;
                this._changeType = this._saveChangeType;
                this._saveChangeType = null;
                coll._removeAllErrors(this);
                changes.forEach(function (v) {
                    this.raisePropertyChanged(v.fieldName);
                }, this);
                if (isNew && this._notEdited) {
                    coll.removeItem(this);
                }
                coll._onEditing(this, false, true);
                this.raisePropertyChanged('isEditing');
                return true;
            },
            getDbContext:function () {
                return this._dbSet.dbContext;
            },
            toString:function () {
                return 'Entity: ' + this._typeName;
            },
            destroy:function () {
                this._srvRowKey = null;
                this._origVals = null;
                this._saveChangeType = null;
                this.__isRefreshing = false;
                this.__isCached = false;
                this._super();
            }
        },
        {
            _isNew:{
                get:function () {
                    return this._changeType === CHANGE_TYPE.ADDED;
                }
            },
            _isDeleted:{
                get:function () {
                    return this._changeType === CHANGE_TYPE.DELETED;
                }
            },
            _entityType:{
                get:function () {
                    return this._dbSet.entityType;
                }
            },
            _srvKey:{
                get:function () {
                    return this._srvRowKey;
                }
            },
            _dbSetName:{
                get:function () {
                    return this._dbSet.dbSetName;
                }
            },
            _changeType:{
                set:function (v) {
                    if (this.__changeType !== v) {
                        var oldChangeType = this.__changeType;
                        this.__changeType = v;
                        if (v !== CHANGE_TYPE.NONE)
                            this._dbSet._addToChanged(this);
                        else
                            this._dbSet._removeFromChanged(this._key);
                        this._dbSet._onItemStatusChanged(this, oldChangeType);
                    }
                },
                get:function () {
                    return this.__changeType;
                }
            },
            _serverTimezone:{
                get:function () {
                    return this.getDbContext().serverTimezone;
                }
            },
            _collection:{
                get:function () {
                    return this._dbSet;
                }
            },
            _isRefreshing:{
                set:function (v) {
                    if (this.__isRefreshing !== v) {
                        this.__isRefreshing = v;
                        this.raisePropertyChanged('_isRefreshing');
                    }
                },
                get:function () {
                    return this.__isRefreshing;
                }
            },
            //a flag that the item is also in the query's datacache and it should not be destroyed
            _isCached:{
                set:function (v) {
                    this.__isCached = v;
                },
                get:function () {
                    return this.__isCached;
                }
            },
            isHasChanges:{
                get:function () {
                    return this._changeType !== CHANGE_TYPE.NONE;
                }
            }
        }, function (obj) {
            thisModule.Entity = obj;
        });

    DbSet = collMod.Collection.extend({
            _create:function (options) {
                this._super();
                var opts = utils.extend(false, {
                    dbContext:null,
                    dbSetInfo:null,
                    childAssoc:[], //this dbSet on child side
                    parentAssoc:[] //this dbSet on parent side
                }, options), dbContext = opts.dbContext, dbSetInfo = opts.dbSetInfo;
                this._dbContext = dbContext;
                this._options.dbSetName = dbSetInfo.dbSetName;
                this._options.enablePaging = dbSetInfo.enablePaging;
                this._options.pageSize = dbSetInfo.pageSize;
                this._perms = utils.extend(false, {}, dbSetInfo.permissions);
                this._query = null;
                this._entityType = null;
                this._isSubmitOnDelete = false;
                //association infos maped by name
                //we should track changes in navigation properties for this associations
                this._trackAssoc = {};
                //map childToParentName by childField as a key
                this._trackAssocMap = {};
                //map association infos by childToParent fieldname
                this._childAssocMap = {};
                //map association infos by parentToChildren fieldname
                this._parentAssocMap = {};

                this._changeCount = 0;
                this._changeCache = {};
                this._ignorePageChanged = false;
                Object.freeze(this._perms);
                this._createEntityType(dbSetInfo.dbSetName, dbSetInfo.fieldInfos, opts.childAssoc, opts.parentAssoc);
            },
            getFieldInfo:function (fieldName) {
                var assoc, parentDB, names = fieldName.split('.'); //for example Customer.Name
                if (names.length == 1)
                    return this._fieldMap[fieldName];
                else if (names.length > 1) {
                    assoc = this._childAssocMap[names[0]];
                    if (!!assoc) {
                        parentDB = this.dbContext.getDbSet(assoc.parentDbSetName);
                        fieldName = names.slice(1).join('.');
                        return parentDB.getFieldInfo(fieldName);
                    }
                }
                throw new Error(String.format(RIAPP.ERRS.ERR_DBSET_INVALID_FIELDNAME, this.dbSetName, fieldName));
            },
            _onError:function (error, source) {
                return this.dbContext._onError(error, source);
            },
            _mapAssocFields:function () {
                var tas = this._trackAssoc, assoc, tasKeys = Object.keys(tas), frel, map = this._trackAssocMap;
                for (var i = 0, len = tasKeys.length; i < len; i += 1) {
                    assoc = tas[tasKeys[i]];
                    for (var j = 0, len2 = assoc.fieldRels.length; j < len2; j += 1) {
                        frel = assoc.fieldRels[j];
                        if (!map[frel.childField]) {
                            map[frel.childField] = [assoc.childToParentName];
                        }
                        else {
                            map[frel.childField].push(assoc.childToParentName);
                        }
                    }
                }
            },
            _getStrValue:function (val, fieldInfo) {
                var dcnv = fieldInfo.dateConversion, stz = this.dbContext.serverTimezone;
                return valueUtils.stringifyValue(val, dcnv, stz);
            },
            _createEntityType:function (dbSetName, fldInfos, childAssoc, parentAssoc) {
                var self = this, fd = {};
                if (!utils.check_is.Array(fldInfos))
                    throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_PARAM_INVALID_TYPE, 'fldInfos', 'Array'));

                fldInfos.forEach(function (f) {
                    var f2 = utils.extend(false, {}, f);
                    f2.dependents = [];
                    self._fieldMap[f.fieldName] = f2;
                }, this);

                var doDependants = function (f) {
                    var deps = f.dependentOn.split(',');
                    deps.forEach(function (depOn) {
                        var depOnFld = self._fieldMap[depOn];
                        if (!depOnFld)
                            throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_CALC_FIELD_DEFINE, depOn));
                        if (f.fieldName === depOn)
                            throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_CALC_FIELD_SELF_DEPEND, depOn));
                        if (depOnFld.dependents.indexOf(f.fieldName) < 0) {
                            depOnFld.dependents.push(f.fieldName);
                        }
                    });
                };

                var calcFldBuilder = function (f) {
                    var fInfo = self.getFieldInfo(f.fieldName);
                    fInfo.isClientOnly = true; //enforce
                    fInfo.isReadOnly = true; //enforce
                    var args = {dbSetName:dbSetName, fieldName:f.fieldName, getFunc:null };
                    self.dbContext._onGetCalcField(args);
                    if (utils.check_is.Function(args.getFunc)) {
                        if (!!f.dependentOn) {
                            doDependants(f);
                        }

                        fd[f.fieldName] = {
                            get:args.getFunc
                        };
                    }
                };

                var navFldBuilder = function (f) {
                    var fInfo = self._fieldMap[f.fieldName], isChild = true, assocs = childAssoc.filter(function (a) {
                        return a.childToParentName == f.fieldName;
                    });
                    if (assocs.length === 0) {
                        assocs = parentAssoc.filter(function (a) {
                            return a.parentToChildrenName == f.fieldName;
                        });
                        isChild = false;
                    }
                    if (assocs.length != 1)
                        throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_PARAM_INVALID_TYPE, 'assocs', 'Array'));
                    fInfo.isClientOnly = true; //enforce
                    fInfo.isReadOnly = true; //enforce
                    var getFunc = function () {
                        throw new Error("getFunc is not emplemented!");
                    }, setFunc;
                    var assocName = assocs[0].name;

                    if (isChild) {
                        fInfo.isReadOnly = false;
                        self._childAssocMap[assocs[0].childToParentName] = assocs[0];

                        assocs[0].fieldRels.forEach(function (frel) {
                            var chf = self._fieldMap[frel.childField];
                            if (!fInfo.isReadOnly && chf.isReadOnly) {
                                fInfo.isReadOnly = true;
                            }
                        });

                        //this property should return parent
                        getFunc = function () {
                            var assoc = self.dbContext.getAssociation(assocName);
                            return assoc.getParentItem(this);
                        };

                        if (!fInfo.isReadOnly) {
                            //should track this association for new items parent child relationship changes
                            self._trackAssoc[assocName] = assocs[0];

                            setFunc = function (v) {
                                var entity = this, i, len, assoc = self.dbContext.getAssociation(assocName);
                                if (!!v && !assoc.parentDS.entityType.isPrototypeOf(v)) {
                                    throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_PARAM_INVALID_TYPE, 'value', assoc.parentDS.entityType._typeName));
                                }

                                if (!!v && v._isNew) {
                                    entity._setFieldVal(f.fieldName, v._key);
                                }
                                else if (!!v) {
                                    for (i = 0, len = assoc.childFldInfos.length; i < len; i += 1) {
                                        entity[assoc.childFldInfos[i].fieldName] = v[assoc.parentFldInfos[i].fieldName];
                                    }
                                }
                                else {
                                    var oldKey = entity._getFieldVal(f.fieldName);
                                    if (!!oldKey) {
                                        entity._setFieldVal(f.fieldName, null);
                                    }
                                    for (i = 0, len = assoc.childFldInfos.length; i < len; i += 1) {
                                        entity[assoc.childFldInfos[i].fieldName] = null;
                                    }
                                }
                            }
                        }
                    } //if (isChild)
                    else {   //return children
                        self._parentAssocMap[assocs[0].parentToChildrenName] = assocs[0];
                        getFunc = function () {
                            return self.dbContext.getAssociation(assocName).getChildItems(this);
                        };
                    }

                    fd[f.fieldName] = {
                        set:setFunc,
                        get:getFunc
                    };
                };

                var simpleFldBuilder = function (f) {
                    fd[f.fieldName] = {
                        set:function (x) {
                            this._setFieldVal(f.fieldName, x);
                        },
                        get:function () {
                            return this._getFieldVal(f.fieldName);
                        }
                    };
                };

                //create field accessor descriptor for each field
                fldInfos.forEach(function (f) {
                    if (utils.hasProp(Entity, f.fieldName)) {
                        throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_ITEM_NAME_COLLISION, dbSetName, f.fieldName));
                    }
                    if (f.isCalculated) {
                        calcFldBuilder(f);
                    }
                    else if (f.isNavigation) {
                        navFldBuilder(f);
                    }
                    else {
                        simpleFldBuilder(f);
                    }
                });


                //add _dbSet property to the entity type
                fd['_dbSet'] = {
                    get:function () {
                        return this.__dbSet;
                    }
                };

                this._entityType = Entity.extend({ __dbSet:self }, fd, function (obj) {
                    obj._typeName = dbSetName + 'Entity';
                });

                this._mapAssocFields();
            },
            _fillFromService:function (data) {
                data = utils.extend(false, {
                    res:{names:[], rows:[], pageIndex:null, pageCount:null, dbSetName:this.dbSetName, totalCount:null},
                    isPageChanged:false,
                    fn_beforeFillEnd:null
                }, data);
                var self =this, res = data.res, fieldNames = res.names, rows = res.rows || [], rowCount = rows.length,
                    entityType = this._entityType, newItems = [], positions = [], created_items = [], fetchedItems = [],
                    isPagingEnabled = this.isPagingEnabled, RM = REFRESH_MODE.RefreshCurrent, query = this.query, clearAll = true, dataCache;

                this._onFillStart({ isBegin:true, rowCount:rowCount, time:new Date(), isPageChanged:data.isPageChanged });
                try {
                    if (!!query) {
                        clearAll = query.isClearPrevData;
                        if (query.isClearCacheOnEveryLoad)
                            query._clearCache();
                        if (clearAll) this.clear();
                        query._reindexCache();
                        if (query.loadPageCount > 1 && isPagingEnabled) {
                            dataCache = query._getCache();
                            if (query.isIncludeTotalCount && !utils.check_is.nt(res.totalCount))
                                dataCache.totalCount = res.totalCount;
                        }
                    }
                    var created_items = rows.map(function (row) {
                        //row.key already string value generated on server (no need to convert to string)
                        var key = row.key;
                        if (!key)
                            throw new Error(RIAPP.ERRS.ERR_KEY_IS_EMPTY);

                        var item = self._itemsByKey[key];
                        if (!item) {
                            if (!!dataCache) {
                                item = dataCache.getItemByKey(key);
                            }
                            if (!item)
                                item = entityType.create(row, fieldNames);
                            else {
                                row.values.forEach(function (val, index) {
                                    item._refreshValue(val, fieldNames[index], RM);
                                });
                            }
                        }
                        else {
                            row.values.forEach(function (val, index) {
                                item._refreshValue(val, fieldNames[index], RM);
                            });
                        }
                        return item;
                    });

                    if (!!query) {
                        if (query.isIncludeTotalCount && !utils.check_is.nt(res.totalCount)) {
                            this.totalCount = res.totalCount;
                        }

                        if (query.loadPageCount > 1 && isPagingEnabled) {
                            dataCache.fillCache(res.pageIndex, created_items);
                            var pg = dataCache.getCachedPage(query.pageIndex);
                            if (!!pg)
                                created_items = pg.items;
                            else
                                created_items = [];
                        }
                    }

                    created_items.forEach(function (item) {
                        var oldItem = this._itemsByKey[item._key];
                        if (!oldItem) {
                            this._items.push(item);
                            this._itemsByKey[item._key] = item;
                            newItems.push(item);
                            positions.push(this._items.length - 1);
                            fetchedItems.push(item);
                        }
                        else
                            fetchedItems.push(oldItem);
                    }, this);

                    if (newItems.length > 0) {
                        this._onItemsChanged({ change_type:COLL_CHANGE_TYPE.ADDED, items:newItems, pos:positions });
                        this.raisePropertyChanged('count');
                    }

                    if (!!data.fn_beforeFillEnd) {
                        data.fn_beforeFillEnd();
                    }
                }
                finally {
                    this._onFillEnd({ isBegin:false, rowCount:fetchedItems.length, time:new Date(), resetUI:clearAll,
                        fetchedItems:fetchedItems, newItems:newItems, isPageChanged:data.isPageChanged });
                }
                this.moveFirst();
                return {fetchedItems:fetchedItems, newItems:newItems, isPageChanged:data.isPageChanged };
            },
            _fillFromCache:function (data) {
                data = utils.extend(false, {
                    isPageChanged:false,
                    fn_beforeFillEnd:null
                }, data);
                var self = this, positions = [], fetchedItems = [], query = this.query;
                if (!query)
                    throw new Error(String.format(RIAPP.ERRS.ERR_ASSERTION_FAILED, 'query is not null'));
                var dataCache = query._getCache();
                var cachedPage = dataCache.getCachedPage(query.pageIndex),
                    items = !cachedPage ? [] : cachedPage.items;

                this._onFillStart({ isBegin:true, rowCount:items.length, time:new Date(), isPageChanged:data.isPageChanged });
                try {
                    this.clear();
                    this._items = items;

                    items.forEach(function (item, index) {
                        self._itemsByKey[item._key] = item;
                        positions.push(index);
                        fetchedItems.push(item);
                    });

                    if (!!data.fn_beforeFillEnd) {
                        data.fn_beforeFillEnd();
                    }

                    if (fetchedItems.length > 0) {
                        this._onItemsChanged({ change_type:COLL_CHANGE_TYPE.ADDED, items:fetchedItems, pos:positions });
                        this.raisePropertyChanged('count');
                    }
                }
                finally {
                    this._onFillEnd({ isBegin:false, rowCount:fetchedItems.length, time:new Date(), resetUI:true,
                        fetchedItems:fetchedItems, newItems:fetchedItems, isPageChanged:data.isPageChanged });
                }
                this.moveFirst();
                return {fetchedItems:fetchedItems, newItems:fetchedItems, isPageChanged:data.isPageChanged};
            },
            _commitChanges:function (rows) {
                var self = this, COLL_CT = COLL_CHANGE_TYPE;

                rows.forEach(function (rowInfo) {
                    var key = rowInfo.clientKey, item = self._itemsByKey[key];
                    if (!item) {
                        throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_KEY_IS_NOTFOUND, key));
                    }
                    var itemCT = item._changeType;
                    item.acceptChanges(rowInfo);
                    if (itemCT === CHANGE_TYPE.ADDED) {
                        //on insert
                        delete self._itemsByKey[key];
                        item._srvRowKey = rowInfo.serverKey;
                        item._key = item._srvRowKey;
                        self._itemsByKey[item._key] = item;
                        self._onItemsChanged({ change_type:COLL_CT.REMAP_KEY,
                            items:[item],
                            old_key:key,
                            new_key:item._key })
                    }
                });
            },
            _setItemInvalid:function (row) {
                var keyMap = this._itemsByKey, item = keyMap[row.clientKey];
                var errors = {};
                row.invalid.forEach(function (err) {
                    if (!err.fieldName)
                        err.fieldName = '*';
                    if (!!errors[err.fieldName]) {
                        errors[err.fieldName].push(err.message);
                    }
                    else
                        errors[err.fieldName] = [err.message];
                });
                var res = [];
                utils.forEachProp(errors, function (fieldName) {
                    res.push({fieldName:fieldName, errors:errors[fieldName]});
                });
                this._addErrors(item, res);
                return item;
            },
            _getChanges:function () {
                var changes = [];
                var csh = this._changeCache;
                utils.forEachProp(csh, function (key) {
                    var item = csh[key];
                    changes.push(item._getRowInfo());
                });
                return changes;
            },
            _getTrackAssocInfo:function () {
                var self = this, res = [];
                var csh = this._changeCache, assocNames = Object.keys(self._trackAssoc);
                utils.forEachProp(csh, function (key) {
                    var item = csh[key];
                    assocNames.forEach(function (assocName) {
                        var assocInfo = self._trackAssoc[assocName], parentKey = item._getFieldVal(assocInfo.childToParentName),
                            childKey = item._key;
                        if (!!parentKey && !!childKey) {
                            res.push({assocName:assocName, parentKey:parentKey, childKey:childKey });
                        }
                    });
                });
                return res;
            },
            _getNewKey:function (item) {
                var key = 'clkey_' + this._newKey; //client's item ID
                this._newKey += 1;
                return key;
            },
            _createNew:function () {
                var item = this._entityType.create(null, null);
                item._key = this._getNewKey(item);
                return item;
            },
            _addToChanged:function (item) {
                if (item._key === null)
                    return;
                if (!this._changeCache[item._key]) {
                    this._changeCache[item._key] = item;
                    this._changeCount += 1;
                    if (this._changeCount === 1)
                        this.raisePropertyChanged('hasChanges');
                }
            },
            _removeFromChanged:function (key) {
                if (key === null)
                    return;
                if (!!this._changeCache[key]) {
                    delete this._changeCache[key];
                    this._changeCount -= 1;
                    if (this._changeCount === 0)
                        this.raisePropertyChanged('hasChanges');
                }
            },
            _clearChangeCache:function () {
                var old = this._changeCount;
                this._changeCache = {};
                this._changeCount = 0;
                if (old !== this._changeCount)
                    this.raisePropertyChanged('hasChanges');
            },
            //occurs when item changeType Changed (not used in simple collections)
            _onItemStatusChanged:function (item, oldChangeType) {
                this._super(item, oldChangeType);
                if (item._isDeleted && this.isSubmitOnDelete) {
                    this.dbContext.submitChanges();
                }
            },
            _onRemoved:function (item, pos) {
                this._removeFromChanged(item._key);
                this._super(item, pos);
            },
            _onPageChanging:function () {
                var res = this._super();
                if (!res) {
                    return res;
                }
                if (this.hasChanges) {
                    this.rejectChanges();
                }
                return res;
            },
            _onPageChanged:function () {
                this.cancelEdit();
                this._super();
                if (this._ignorePageChanged)
                    return;
                this.query.pageIndex = this.pageIndex;
                this.dbContext._load(this.query, true);
            },
            _onPageSizeChanged:function () {
                this._super();
                if (!!this._query)
                    this._query.pageSize = this.pageSize;
            },
            _destroyItems:function () {
                this._items.forEach(function (item) {
                    if (item._isCached)
                        item.removeHandler(null, null);
                    else
                        item.destroy();
                });
            },
            //manually fill data from result when page is first loaded
            //from data stored inside page (without ajax request)
            //convenient for loading classifiers (for lookup data)
            fillItems:function (data) {
                var res = utils.extend(false, {names:[], rows:[],
                        pageIndex:(!!this.query) ? this.query.pageIndex : null,
                        pageCount:null,
                        dbSetName:this.dbSetName,
                        totalCount:null},
                    data), filldata = {
                    res:res,
                    isPageChanged:false,
                    fn_beforeFillEnd:null
                };
                this._fillFromService(filldata);
            },
            acceptChanges:function () {
                var csh = this._changeCache;
                utils.forEachProp(csh, function (key) {
                    var item = csh[key];
                    item.acceptChanges(null);
                });
                this._changeCount = 0;
            },
            rejectChanges:function () {
                var csh = this._changeCache;
                utils.forEachProp(csh, function (key) {
                    var item = csh[key];
                    item.rejectChanges();
                });
            },
            deleteOnSubmit:function (item) {
                item.deleteOnSubmit();
            },
            clear:function () {
                this._clearChangeCache();
                this._super();
            },
            createQuery:function (name) {
                var queryInfo = this.dbContext._getQueryInfo(name);
                if (!queryInfo) {
                    throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_QUERY_NAME_NOTFOUND, name));
                }
                return DataQuery.create(this, queryInfo);
            },
            clearCache:function () {
                var query = this._query;
                if (!!query) {
                    query._clearCache()();
                }
            },
            destroy:function () {
                var query = this._query;
                this._query = null;
                if (!!query) {
                    query.destroy();
                }
                this._super();
            },
            toString:function () {
                return 'DbSet:' + this._options.dbSetName;
            }
        },
        {
            dbContext:{
                get:function () {
                    return this._dbContext;
                }
            },
            dbSetName:{
                get:function () {
                    return this._options.dbSetName;
                }
            },
            entityType:{
                get:function () {
                    return this._entityType;
                }
            },
            query:{
                get:function () {
                    return this._query;
                }
            },
            hasChanges:{
                get:function () {
                    return this._changeCount > 0;
                }
            },
            cacheSize:{
                get:function () {
                    var query = this._query, dataCache;
                    if (!!query && query.isCacheValid) {
                        dataCache = query._getCache();
                        return dataCache.cacheSize;
                    }
                    return 0;
                }
            },
            isSubmitOnDelete:{
                set:function (v) {
                    if (this._isSubmitOnDelete !== v) {
                        this._isSubmitOnDelete = !!v;
                        this.raisePropertyChanged('isSubmitOnDelete');
                    }
                },
                get:function () {
                    return this._isSubmitOnDelete;
                }
            }
        }, function (obj) {
            thisModule.DbSet = obj;
        });


    var DbContext = RIAPP.BaseObject.extend({
            _app:app,
            _create:function () {
                this._super();
                this._isInitialized = false;
                this._dbSets = {};
                this._arrDbSets = [];
                this._svcMethods = {};
                this._assoc = {};
                this._arrAssoc = [];
                this._queryInf = {};
                this._serviceUrl = null;
                this._isBusy = 0;
                this._isSubmiting = false;
                this._hasChanges = false;
                this._pendingSubmit = null;
                this._serverTimezone = utils.get_timeZoneOffset();
                this._waitQueue = utils.WaitQueue.create(this);
            },
            _onGetCalcField:function (args) {
                this.raiseEvent('define_calc', args);
            },
            _getQueryInfo:function (name) {
                return this._queryInf[name];
            },
            _initDbSets:function (metadata) {
                if (this._isInitialized)
                    throw new Error(RIAPP.ERRS.ERR_DOMAIN_CONTEXT_INITIALIZED);
                var self = this, eSets = this._dbSets, eSetType = DbSet;
                if (!utils.check_is.Array(metadata.dbSets))
                    throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_PARAM_INVALID_TYPE, 'metadata.dbSets', 'Array'));
                this._serverTimezone = metadata.serverTimezone;
                metadata.dbSets.forEach(function (dbInfo) {
                    var dbSetName = dbInfo.dbSetName, eSet, childAssoc = metadata.associations.filter(function (assoc) {
                            return dbInfo.dbSetName == assoc.childDbSetName;
                        }),
                        parentAssoc = metadata.associations.filter(function (assoc) {
                            return dbInfo.dbSetName == assoc.parentDbSetName;
                        }),
                        options = {
                            dbContext:self,
                            dbSetInfo:dbInfo,
                            childAssoc:childAssoc,
                            parentAssoc:parentAssoc
                        };
                    eSet = eSetType.create(options);
                    self._arrDbSets.push(eSet);
                    eSet.addOnPropertyChange('hasChanges', function (sender, args) {
                        self._onDbSetHasChangesChanged(sender);
                    }, null);
                    eSets[dbSetName] = eSet;
                });
                //parent child relationships
                metadata.associations.forEach(function (assoc) {
                    self._initAssociation(assoc);
                });
                //service methods proxies creation
                metadata.methods.forEach(function (info) {
                    if (info.isQuery) //query info
                        self._queryInf[info.methodName] = info;
                    else { //service method info
                        self._initMethod(info);
                    }
                });
                Object.freeze(this._dbSets);
                Object.freeze(this._svcMethods);
                Object.freeze(this._queryInf);
                this._isInitialized = true;
                this.raisePropertyChanged('isInitialized');
            },
            _onDbSetHasChangesChanged:function (eSet) {
                var old = this._hasChanges, test;
                this._hasChanges = false;
                if (eSet.hasChanges) {
                    this._hasChanges = true;
                }
                else {
                    for (var i = 0, len = this._arrDbSets.length; i < len; i += 1) {
                        test = this._arrDbSets[i];
                        if (test.hasChanges) {
                            this._hasChanges = true;
                            break;
                        }
                    }
                }
                if (this._hasChanges !== old) {
                    this.raisePropertyChanged('hasChanges');
                }
            },
            _initAssociation:function (assoc) {
                var self = this, options = {
                    dbContext:self,
                    parentName:assoc.parentDbSetName,
                    childName:assoc.childDbSetName,
                    onDeleteAction:assoc.onDeleteAction,
                    parentKeyFields:assoc.fieldRels.map(function (f) {
                        return f.parentField;
                    }),
                    childKeyFields:assoc.fieldRels.map(function (f) {
                        return f.childField;
                    }),
                    parentToChildrenName:assoc.parentToChildrenName,
                    childToParentName:assoc.childToParentName,
                    name:assoc.name
                };
                //lazy initialization pattern
                this._assoc[assoc.name] = function () {
                    var t = Association.create(options);
                    self._arrAssoc.push(t);
                    var f = function () {
                        return t;
                    };
                    self._assoc[assoc.name] = f;
                    return f();
                };

            },
            _initMethod:function (methodInfo) {
                var self = this;
                //function expects method parameters
                this._svcMethods[methodInfo.methodName] = function (args) {
                    var deferred = utils.createDeferred();
                    var callback = function (res) {
                        if (!res.error) {
                            deferred.resolve(res.result);
                        }
                        else {
                            deferred.reject();
                        }
                    };

                    try {
                        var data = self._getMethodParams(methodInfo, args);
                        self._invokeMethod(methodInfo, data, callback);
                    } catch (ex) {
                        if (!global._checkIsDummy(ex)) {
                            self._onError(ex, self);
                            callback({result:null, error:ex});
                        }
                    }

                    return deferred.promise();
                };
            },
            _getMethodParams:function (methodInfo, args) {
                var methodName = methodInfo.methodName, data = { methodName:methodName, paramInfo:{parameters:[]}};
                var i, pinfos = methodInfo.parameters, len = pinfos.length, pinfo, val, value;
                if (!args)
                    args = {};
                for (i = 0; i < len; i += 1) {
                    pinfo = pinfos[i];
                    val = args[pinfo.name];
                    if (!pinfo.isNullable && !pinfo.isArray && pinfo.dataType !== DATA_TYPE.String && utils.check_is.nt(val)) {
                        throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_SVC_METH_PARAM_INVALID, pinfo.name, val, methodInfo.methodName));
                    }
                    if (utils.check_is.Function(val)) {
                        throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_SVC_METH_PARAM_INVALID, pinfo.name, val, methodInfo.methodName));
                    }
                    if (pinfo.isArray && !utils.check_is.nt(val) && !utils.check_is.Array(val)) {
                        val = [val];
                    }
                    value = null;
                    if (utils.check_is.Array(val)) {
                        value = [];
                        val.forEach(function (v) {
                            value.push(valueUtils.stringifyValue(v, pinfo.dateConversion, self._serverTimezone));
                        });
                        value = JSON.stringify(value); //.join(',');
                    }
                    else
                        value = valueUtils.stringifyValue(val, pinfo.dateConversion, self._serverTimezone);

                    data.paramInfo.parameters.push({ name:pinfo.name, value:value});
                }
                return data;
            },
            _invokeMethod:function (methodInfo, data, callback) {
                var self = this, operType = DATA_OPER.INVOKE, postData, invokeUrl;
                this.isBusy = true;
                var fn_onComplete = function (res) {
                    try {
                        if (!res)
                            throw new Error(utils.format(RIAPP.ERRS.ERR_UNEXPECTED_SVC_ERROR, 'operation result is undefined'));
                        thisModule.checkError(res.error, operType);
                        callback({result:res.result, error:null});
                    } catch (ex) {
                        if (global._checkIsDummy(ex)) {
                            return;
                        }
                        self._onDataOperError(ex, operType);
                        callback({result:null, error:ex});
                    }
                };

                try {
                    postData = JSON.stringify(data);
                    invokeUrl = this._getUrl(DATA_SVC_METH.Invoke);
                    utils.performAjaxCall(
                        invokeUrl,
                        postData,
                        true,
                        function (res) { //success
                            fn_onComplete(JSON.parse(res));
                            self.isBusy = false;
                        },
                        function (er) { //error
                            fn_onComplete({result:null, error:er});
                            self.isBusy = false;
                        }, null);
                }
                catch (ex) {
                    if (global._checkIsDummy(ex)) {
                        global._throwDummy(ex);
                    }
                    this.isBusy = false;
                    this._onDataOperError(ex, operType);
                    callback({result:null, error:ex});
                    global._throwDummy(ex);
                }
            },
            _getEventNames:function () {
                var base_events = this._super();
                return ['submit_error', 'define_calc'].concat(base_events);
            },
            _loadFromCache:function (query, isPageChanged) {
                var operType = DATA_OPER.LOAD, dbSet = query._dbSet, methRes;
                try {
                    methRes = dbSet._fillFromCache({isPageChanged:isPageChanged, fn_beforeFillEnd:null});
                } catch (ex) {
                    if (global._checkIsDummy(ex)) {
                        global._throwDummy(ex);
                    }
                    this._onDataOperError(ex, operType);
                    global._throwDummy(ex);
                }
                return methRes;
            },
            _loadIncluded:function (res) {
                var self = this, hasIncluded = !!res.included && res.included.length > 0;
                if (!hasIncluded)
                    return;
                res.included.forEach(function (subset) {
                    var dbSet = self.getDbSet(subset.dbSetName);
                    dbSet.fillItems(subset, true);
                });
            },
            _onLoaded:function (res, isPageChanged) {
                var self = this, operType = DATA_OPER.LOAD, dbSetName, dbSet, methRes;
                try {
                    if (!res)
                        throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_UNEXPECTED_SVC_ERROR, 'null result'));
                    dbSetName = res.dbSetName;
                    dbSet = this.getDbSet(dbSetName);
                    if (!dbSet)
                        throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_DBSET_NAME_INVALID, dbSetName));
                    thisModule.checkError(res.error, operType);
                    methRes = dbSet._fillFromService(
                        {
                            res:res,
                            isPageChanged:isPageChanged,
                            fn_beforeFillEnd:function () {
                                self._loadIncluded(res);
                            }
                        });
                } catch (ex) {
                    if (global._checkIsDummy(ex)) {
                        global._throwDummy(ex);
                    }
                    this._onDataOperError(ex, operType);
                    global._throwDummy(ex);
                }
                return methRes;
            },
            _dataSaved:function (res) {
                var self = this, submitted = [], notvalid = [];
                try {
                    try {
                        thisModule.checkError(res.error, DATA_OPER.SUBMIT);
                    }
                    catch (ex) {
                        res.dbSets.forEach(function (jsDB) {
                            var eSet = self._dbSets[jsDB.dbSetName];
                            jsDB.rows.forEach(function (row) {
                                var item = eSet.getItemByKey(row.clientKey);
                                if (!item) {
                                    throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_KEY_IS_NOTFOUND, row.clientKey));
                                }
                                submitted.push(item);
                                if (!!row.invalid) {
                                    eSet._setItemInvalid(row);
                                    notvalid.push(item);
                                }
                            });
                        });
                        throw SubmitError.create(ex, submitted, notvalid);
                    }

                    res.dbSets.forEach(function (jsDB) {
                        self._dbSets[jsDB.dbSetName]._commitChanges(jsDB.rows);
                    });
                }
                catch (ex) {
                    if (global._checkIsDummy(ex)) {
                        global._throwDummy(ex);
                    }
                    this._onSubmitError(ex);
                    global._throwDummy(ex);
                }
            },
            _getChanges:function () {
                var changeSet = { dbSets:[], error:null, trackAssocs:[]  };
                this._arrDbSets.forEach(function (eSet) {
                    eSet.endEdit();
                    var changes = eSet._getChanges();
                    if (changes.length === 0)
                        return;
                    //it needs to apply updates in parent-child relationship order on the server
                    //and provides child to parent map of the keys for new entities
                    var trackAssoc = eSet._getTrackAssocInfo();
                    var jsDB = { dbSetName:eSet.dbSetName, rows:changes };
                    changeSet.dbSets.push(jsDB);
                    changeSet.trackAssocs = changeSet.trackAssocs.concat(trackAssoc);
                });
                return changeSet;
            },
            _getUrl:function (action) {
                var loadUrl = this.service_url;
                if (!utils.str.endsWith(loadUrl, '/'))
                    loadUrl = loadUrl + '/';
                loadUrl = loadUrl + [action, ''].join('/');
                return loadUrl;
            },
            _onItemRefreshed:function (res, item) {
                var operType = DATA_OPER.REFRESH;
                try {
                    thisModule.checkError(res.error, operType);
                    if (!res.rowInfo) {
                        item._dbSet.removeItem(item);
                        item.destroy();
                        throw new Error(RIAPP.ERRS.ERR_ITEM_DELETED_BY_ANOTHER_USER);
                    }
                    else
                        item._refreshValues(res.rowInfo, REFRESH_MODE.MergeIntoCurrent);
                }
                catch (ex) {
                    if (global._checkIsDummy(ex)) {
                        global._throwDummy(ex);
                    }
                    this._onDataOperError(ex, operType);
                    global._throwDummy(ex);
                }
            },
            //returns promise
            _refreshItem:function (item) {
                var deferred = utils.createDeferred(), callback = function (isOk) {
                    if (isOk) {
                        deferred.resolve(item);
                    }
                    else {
                        deferred.reject();
                    }
                };
                var url = this._getUrl(DATA_SVC_METH.Refresh), dbSet = item._dbSet;
                this.waitForNotSubmiting(function () {
                    var self = this;
                    dbSet.waitForNotLoading(function () {
                        var args, postData, operType = DATA_OPER.REFRESH;
                        var fn_onEnd = function () {
                                self.isBusy = false;
                                dbSet.isLoading = false;
                                item._isRefreshing = false;
                            },
                            fn_onErr = function (ex) {
                                fn_onEnd();
                                self._onDataOperError(ex, operType);
                            },
                            fn_onOK = function (res) {
                                self._onItemRefreshed(res, item);
                                fn_onEnd();
                            };

                        item._isRefreshing = true;
                        self.isBusy = true;
                        dbSet.isLoading = true;
                        try {
                            var request = { dbSetName:item._dbSetName, rowInfo:item._getRowInfo(), error:null };
                            item._checkCanRefresh();
                            postData = JSON.stringify(request);
                            utils.performAjaxCall(
                                url,
                                postData,
                                true,
                                function (res) { //success
                                    try {
                                        fn_onOK(JSON.parse(res));
                                        callback(true);
                                    }
                                    catch (ex) {
                                        fn_onErr(ex);
                                        callback(false);
                                    }
                                },
                                function (er) { //error
                                    fn_onEnd();
                                    self._onDataOperError(er, operType);
                                    callback(false);
                                }, null);
                        }
                        catch (ex) {
                            fn_onErr(ex);
                            callback(false);
                        }
                    }, [], true, null);
                }, [], null);
                return deferred.promise();
            },
            _onError:function (error, source) {
                var isHandled = this._super(error, source);
                if (!isHandled) {
                    if (!!this.app)
                        return this.app._onError(error, source);
                    else
                        return global._onError(error, source);
                }
                return isHandled;
            },
            _onDataOperError:function (ex, oper) {
                if (global._checkIsDummy(ex))
                    return true;
                var er;
                if (DataOperationError.isPrototypeOf(ex))
                    er = ex;
                else
                    er = DataOperationError.create(ex, oper);
                return this._onError(er, this);
            },
            _onSubmitError:function (error) {
                var args = {error:error, isHandled:false};
                this.raiseEvent('submit_error', args);
                if (!args.isHandled) {
                    this.rejectChanges();
                    this._onDataOperError(error, DATA_OPER.SUBMIT);
                }
            },
            _beforeLoad:function (query, oldQuery, dbSet) {
                if (query && oldQuery !== query) {
                    dbSet._query = query;
                    dbSet.pageIndex = 0;
                }
                if (!!oldQuery && oldQuery !== query) {
                    oldQuery.destroy();
                }

                if (query.pageSize !== dbSet.pageSize) {
                    dbSet._ignorePageChanged = true;
                    try {
                        dbSet.pageIndex = 0;
                        dbSet.pageSize = query.pageSize;
                    } finally {
                        dbSet._ignorePageChanged = false;
                    }
                }

                if (query.pageIndex !== dbSet.pageIndex) {
                    dbSet._ignorePageChanged = true;
                    try {
                        dbSet.pageIndex = query.pageIndex;
                    }
                    finally {
                        dbSet._ignorePageChanged = false;
                    }
                }

                if (!query.isCacheValid) {
                    query._clearCache();
                }
            },
            _load:function (query, isPageChanged) {
                if (!query) {
                    throw new Error(RIAPP.ERRS.ERR_DB_LOAD_NO_QUERY);
                }
                var self = this, deferred = utils.createDeferred();
                var fn_onComplete = function (isOk, res) {
                    if (isOk) {
                        deferred.resolve(res);
                    }
                    else {
                        deferred.reject();
                    }
                };

                var loadPageCount = query.loadPageCount, pageIndex = query.pageIndex, isPagingEnabled = query.isPagingEnabled,
                    dbSetName = query.dbSetName, dbSet = this.getDbSet(dbSetName);

                //this wait is asynchronous
                this.waitForNotSubmiting(function () {
                    dbSet.waitForNotLoading(function () {
                        var oldQuery = dbSet.query;
                        var loadUrl = self._getUrl(DATA_SVC_METH.LoadData), requestInfo, postData,
                            operType = DATA_OPER.LOAD,
                            fn_onEnd = function () {
                                dbSet.isLoading = false;
                                self.isBusy = false;
                            },
                            fn_onOK = function (res) {
                                fn_onEnd();
                                fn_onComplete(true, res);
                            },
                            fn_onErr = function (ex) {
                                fn_onEnd();
                                self._onDataOperError(ex, operType);
                                fn_onComplete(false, null);
                            },
                            fn_onErr2 = function (ex) {
                                fn_onEnd();
                                self._onDataOperError(ex, operType);
                                fn_onComplete(false, null);
                            }, loadRes;

                        dbSet.isLoading = true;
                        self.isBusy = true;
                        try {
                            //restore pageIndex
                            query.pageIndex = pageIndex;
                            self._beforeLoad(query, oldQuery, dbSet);
                            var range, pageCount = 1;

                            if (loadPageCount > 1 && isPagingEnabled) {
                                if (query._isPageCached(pageIndex)) {
                                    loadRes = self._loadFromCache(query, isPageChanged);
                                    loadRes.outOfBandData = null;
                                    //loadRes is in the format {fetchedItems:[], newItems:[], isPageChanged:bool, outOfBandData: object }
                                    fn_onOK(loadRes);
                                    return;
                                }
                                else {
                                    range = query._getCache().getNextRange(pageIndex);
                                    pageIndex = range.start;
                                    pageCount = range.cnt;
                                }
                            }


                            requestInfo = { dbSetName:dbSetName,
                                pageIndex:pageIndex,
                                pageSize:query.pageSize,
                                pageCount:pageCount,
                                isIncludeTotalCount:query.isIncludeTotalCount,
                                filterInfo:query.filterInfo,
                                sortInfo:query.sortInfo,
                                paramInfo:self._getMethodParams(query._queryInfo, query.params).paramInfo,
                                queryName:query.queryName
                            };

                            postData = JSON.stringify(requestInfo);
                            utils.performAjaxCall(
                                loadUrl,
                                postData,
                                true,
                                function (res) { //success
                                    var data = [], idx;
                                    try {
                                        idx = res.indexOf(global.modules.consts.CHUNK_SEP);
                                        if (idx>-1){ //rows were serialized separately
                                            data.push(res.substr(0,idx));//the first item is getDataResult
                                            data.push(res.substr(idx+global.modules.consts.CHUNK_SEP.length)); //the rest is rows
                                        }
                                        else{
                                            data.push(res); //all response is serialized as getDataResult
                                        }
                                        data = data.map(function(txt){
                                            return JSON.parse(txt);
                                        });

                                        //let the UI some time, then do the rest of the work
                                        setTimeout(function(){
                                            var allRows, getDataResult = data[0];//first item is GetDataResult
                                            var hasIncluded = !!getDataResult.included && getDataResult.included.length > 0;
                                            try
                                            {
                                                if (data.length>1){ //rows was loaded separately from GetDataResult
                                                    allRows = data[1];
                                                    if (allRows && allRows.length>0){
                                                        if (hasIncluded){
                                                            getDataResult.included.forEach(function (subset) {
                                                                subset.rows = allRows.splice(0,subset.rowCount);
                                                                if (subset.rowCount != subset.rows.length){
                                                                    throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_ASSERTION_FAILED,'subset.rowCount == subset.rows.length'));
                                                                }
                                                            });
                                                        }
                                                        getDataResult.rows = allRows;
                                                        if (getDataResult.rowCount != getDataResult.rows.length){
                                                            throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_ASSERTION_FAILED,'getDataResult.rowCount == getDataResult.rows.length'));
                                                        }
                                                    }
                                                }
                                                loadRes = self._onLoaded(getDataResult, isPageChanged);
                                                loadRes.outOfBandData = res.extraInfo;
                                                fn_onOK(loadRes);
                                            }
                                            catch (ex) {
                                                fn_onErr(ex);
                                            }
                                        },0);
                                    }
                                    catch (ex) {
                                        fn_onErr(ex);
                                    }
                                },
                                function (er) { //error
                                    fn_onErr2(er);
                                }, null);
                        }
                        catch (ex) {
                            fn_onErr(ex);
                        }
                    }, [], true, isPageChanged ? 'paging' : null);

                }, [], isPageChanged ? 'paging' : null);

                return deferred.promise();
            },
            getDbSet:function (name) {
                if (!this.isInitialized)
                    throw new Error(RIAPP.ERRS.ERR_DOMAIN_CONTEXT_NOT_INITIALIZED);
                var eSet = this._dbSets[name];
                if (!eSet)
                    throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_DBSET_NAME_INVALID, name));
                return eSet;
            },
            getAssociation:function (name) {
                var f = this._assoc[name];
                if (!f)
                    throw new Error(RIAPP.utils.format(RIAPP.ERR_ASSOC_NAME_INVALID, name));
                return f();
            },
            //returns promise
            submitChanges:function () {
                //dont submit when the submit already in the queue
                if (!!this._pendingSubmit) {
                    //return promise for the already enqueued submit
                    return this._pendingSubmit.deferred.promise();
                }

                var self = this, submitState = {deferred:utils.createDeferred()};
                var callback = function (isOk) {
                    if (isOk) {
                        submitState.deferred.resolve();
                    }
                    else {
                        submitState.deferred.reject();
                    }
                };

                this._pendingSubmit = submitState;

                //this wait is asynchronous
                this.waitForNotBusy(function () {
                    var url, postData, operType = DATA_OPER.SUBMIT, changeSet;
                    var fn_onEnd = function () {
                            self.isBusy = false;
                            self.isSubmiting = false;
                        },
                        fn_onErr = function (ex) {
                            fn_onEnd();
                            self._onDataOperError(ex, operType);
                            callback(false);
                        };

                    try {
                        this.isBusy = true;
                        this.isSubmiting = true;
                        this._pendingSubmit = null; //allow to post new submit
                        url = this._getUrl(DATA_SVC_METH.Submit);
                        changeSet = this._getChanges();

                        if (changeSet.dbSets.length === 0) {
                            fn_onEnd();
                            callback(true);
                            return;
                        }
                    }
                    catch (ex) {
                        fn_onErr(ex);
                        return;
                    }

                    try {
                        postData = JSON.stringify(changeSet);
                        utils.performAjaxCall(
                            url,
                            postData,
                            true,
                            function (res) { //success
                                try {
                                    self._dataSaved(JSON.parse(res));
                                    fn_onEnd();
                                    callback(true);
                                }
                                catch (ex) {
                                    fn_onErr(ex);
                                }
                            },
                            function (er) { //submit error
                                fn_onEnd();
                                self._onSubmitError(er);
                                callback(false);
                            }, null);
                    }
                    catch (ex) {
                        fn_onErr(ex);
                    }
                }, []);
                return submitState.deferred.promise();
            },
            //returns promise
            load:function (query) {
                return this._load(query, false);
            },
            acceptChanges:function () {
                this._arrDbSets.forEach(function (eSet) {
                    eSet.acceptChanges();
                });
            },
            rejectChanges:function () {
                this._arrDbSets.forEach(function (eSet) {
                    eSet.rejectChanges();
                });
            },
            initialize:function (options) {
                if (this._isInitialized)
                    return;
                var self = this, opts = utils.extend(false, {
                    serviceUrl:null,
                    metadata:null
                }, options);
                this._serviceUrl = opts.serviceUrl;
                if (!!opts.metadata) {
                    this._initDbSets(opts.metadata);
                    return;
                }
                //initialize by obtaining metadata from the data service by ajax call
                var loadUrl = this._getUrl(DATA_SVC_METH.InitDbContext), operType = DATA_OPER.INIT;
                try {
                    this.isBusy = true;
                    utils.performAjaxCall(
                        loadUrl,
                        undefined,
                        true,
                        function (metadata) { //success
                            try {
                                self._initDbSets(JSON.parse(metadata));
                                self.isBusy = false;
                            }
                            catch (ex) {
                                self.isBusy = false;
                                self._onDataOperError(ex, operType);
                                global._throwDummy(ex);
                            }
                        },
                        function (er) { //error
                            self.isBusy = false;
                            self._onDataOperError(er, operType);
                        }, null);
                }
                catch (ex) {
                    this.isBusy = false;
                    this._onDataOperError(ex, operType);
                    global._throwDummy(ex);
                }
            },
            waitForNotBusy:function (callback, callbackArgs) {
                this._waitQueue.enQueue({
                    prop:'isBusy',
                    groupName:null,
                    predicate:function (val) {
                        return !val;
                    },
                    action:callback,
                    actionArgs:callbackArgs
                });
            },
            waitForNotSubmiting:function (callback, callbackArgs, groupName) {
                this._waitQueue.enQueue({
                    prop:'isSubmiting',
                    predicate:function (val) {
                        return !val;
                    },
                    action:callback,
                    actionArgs:callbackArgs,
                    groupName:groupName,
                    lastWins:!!groupName
                });
            },
            waitForInitialized:function (callback, callbackArgs) {
                this._waitQueue.enQueue({
                    prop:'isInitialized',
                    groupName:'dbContext',
                    predicate:function (val) {
                        return !!val;
                    },
                    action:callback,
                    actionArgs:callbackArgs
                });
            },
            destroy:function () {
                if (!this._waitQueue)
                    return;
                this._waitQueue.destroy();
                this._waitQueue = null;
                this._arrAssoc.forEach(function (assoc) {
                    assoc.destroy();
                });
                this._arrAssoc = [];
                this._assoc = {};
                this._arrDbSets.forEach(function (dbSet) {
                    dbSet.destroy();
                });
                this._arrDbSets = [];
                this._dbSets = {};
                this._svcMethods = {};
                this._queryInf = {};
                this._serviceUrl = null;
                this._isInitialized = false;
                this._isBusy = false;
                this._isSubmiting = false;
                this._hasChanges = false;
                this._super();
            }
        },
        {
            app:{
                get:function () {
                    return this._app;
                }
            },
            service_url:{
                get:function () {
                    return this._serviceUrl;
                }
            },
            isInitialized:{
                get:function () {
                    return this._isInitialized;
                }
            },
            isBusy:{
                set:function (v) {
                    var old = this._isBusy > 0, cur;
                    if (!v) {
                        this._isBusy -= 1;
                        if (this._isBusy < 0)
                            this._isBusy = 0;
                    }
                    else {
                        this._isBusy += 1;
                    }
                    cur = this._isBusy > 0;
                    if (cur != old) {
                        this.raisePropertyChanged('isBusy');
                    }
                },
                get:function () {
                    return this._isBusy > 0;
                }
            },
            isSubmiting:{
                set:function (v) {
                    if (this._isSubmiting !== v) {
                        this._isSubmiting = v;
                        this.raisePropertyChanged('isSubmiting');
                    }
                },
                get:function () {
                    return this._isSubmiting;
                }
            },
            serverTimezone:{
                get:function () {
                    return this._serverTimezone;
                }
            },
            //hash map of {dbSetName: dbSet} structure
            dbSets:{
                get:function () {
                    return  this._dbSets;
                }
            },
            //dbSets in the form of array
            arrDbSets:{
                get:function () {
                    return  this._arrDbSets;
                }
            },
            serviceMethods:{
                get:function () {
                    return this._svcMethods;
                }
            },
            hasChanges:{
                get:function () {
                    return this._hasChanges;
                }
            }
        }, function (obj) {
            thisModule.DbContext = obj;
            app.registerType('DbContext', obj);
        });

    var DataView = collMod.Collection.extend({
            _create:function (options) {
                this._super();
                var opts = utils.extend(false, {
                    dataSource:null,
                    fn_filter:null,
                    fn_sort:null,
                    fn_itemsProvider:null
                }, options);

                if (!opts.dataSource || !collMod.Collection.isPrototypeOf(opts.dataSource))
                    throw new Error(RIAPP.ERRS.ERR_DATAVIEW_DATASRC_INVALID);
                if (!opts.fn_filter || !utils.check_is.Function(opts.fn_filter))
                    throw new Error(RIAPP.ERRS.ERR_DATAVIEW_FILTER_INVALID);
                this._dataSource = opts.dataSource;
                this._fn_filter = opts.fn_filter;
                this._fn_sort = opts.fn_sort;
                this._fn_itemsProvider = opts.fn_itemsProvider;
                this._isDSFilling = false;
                this._isAddingNew = false;
                var self = this, ds = this._dataSource;
                ds.getFieldNames().forEach(function (prop) {
                    self._fieldMap[prop] = utils.extend(false, {}, ds.getFieldInfo(prop));
                });
                this._bindDS();
            },
            _getEventNames:function () {
                var base_events = this._super();
                return ['view_refreshed'].concat(base_events);
            },
            _filterForPaging:function (items) {
                var skip = 0, take = 0, pos = -1, cnt = -1, result = [];
                skip = this.pageSize * this.pageIndex;
                take = this.pageSize;
                items.forEach(function (item) {
                    cnt += 1;
                    if (cnt < skip) {
                        return;
                    }
                    pos += 1;
                    if (pos < take) {
                        result.push(item);
                    }
                });
                return result;
            },
            _onViewRefreshed:function (args) {
                this.raiseEvent('view_refreshed', args);
            },
            _refresh:function (isPageChanged) {
                var items;
                var ds = this._dataSource;
                if (!ds)
                    return;
                if (!!this._fn_itemsProvider) {
                    items = this._fn_itemsProvider(ds);
                }
                else
                    items = ds.items;
                if (!!this._fn_filter) {
                    items = items.filter(this._fn_filter);
                }
                if (!!this._fn_sort) {
                    items = items.sort(this._fn_sort);
                }
                this._fillItems({items:items, isPageChanged:!!isPageChanged, clear:true, isAppend:false});
                this._onViewRefreshed({});
            },
            _fillItems:function (data) {
                data = utils.extend(false, {
                    items:[],
                    isPageChanged:false,
                    clear:true,
                    isAppend:false
                }, data);
                var items, newItems = [], positions = [], fetchedItems = [];
                this._onFillStart({ isBegin:true, rowCount:data.items.length, time:new Date(), isPageChanged:data.isPageChanged });
                try {
                    if (!!data.clear)
                        this.clear();
                    if (this.isPagingEnabled && !data.isAppend) {
                        items = this._filterForPaging(data.items);
                    }
                    else
                        items = data.items;

                    items.forEach(function (item) {
                        var oldItem = this._itemsByKey[item._key];
                        if (!oldItem) {
                            this._itemsByKey[item._key] = item;
                            newItems.push(item);
                            positions.push(this._items.length - 1);
                            this._items.push(item);
                            fetchedItems.push(item);
                        }
                        else {
                            fetchedItems.push(oldItem);
                        }
                    }, this);

                    if (newItems.length > 0) {
                        this._onItemsChanged({ change_type:COLL_CHANGE_TYPE.ADDED, items:newItems, pos:positions });
                        this.raisePropertyChanged('count');
                    }
                } finally {
                    this._onFillEnd({ isBegin:false, rowCount:fetchedItems.length, time:new Date(), resetUI:!!data.clear,
                        fetchedItems:fetchedItems, newItems:newItems, isPageChanged:data.isPageChanged});
                }
                if (!!data.clear)
                    this.totalCount = data.items.length;
                else
                    this.totalCount = this.totalCount + newItems.length;
                this.moveFirst();
                return newItems;
            },
            _onDSCollectionChanged:function (args) {
                var self = this, item, CH_T = COLL_CHANGE_TYPE, items = args.items;
                switch (args.change_type) {
                    case CH_T.RESET:
                        if (!this._isDSFilling)
                            this._refresh(false);
                        break;
                    case CH_T.ADDED:
                        if (!this._isAddingNew && !this._isDSFilling) {
                            if (!!self._fn_filter) {
                                items = items.filter(self._fn_filter);
                            }
                            self.appendItems([items]);
                        }
                        break;
                    case CH_T.REMOVE:
                        items.forEach(function (item) {
                            var key = item._key;
                            item = self._itemsByKey[key];
                            if (!!item) {
                                self.removeItem(item);
                            }
                        });
                        break;
                    case CH_T.REMAP_KEY:
                    {
                        item = self._itemsByKey[args.old_key];
                        if (!!item) {
                            delete self._itemsByKey[args.old_key];
                            self._itemsByKey[args.new_key] = item;
                            this._onItemsChanged(args);
                        }
                    }
                        break;
                    default:
                        throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_COLLECTION_CHANGETYPE_INVALID, args.change_type));
                }
            },
            _onDSFill:function (args) {
                var self = this, items = args.fetchedItems, isEnd = !args.isBegin;
                if (isEnd) {
                    this._isDSFilling = false;
                    if (args.resetUI)
                        this._refresh(false);
                    else {
                        if (!!self._fn_filter) {
                            items = items.filter(self._fn_filter);
                        }
                        self.appendItems(items);
                    }
                }
                else {
                    this._isDSFilling = true;
                }
            },
            _onDSStatusChanged:function (args) {
                var self = this, item = args.item, key = args.key, oldChangeType = args.oldChangeType, isOk, canFilter = !!self._fn_filter;
                if (!!self._itemsByKey[key]) {
                    self._onItemStatusChanged(item, oldChangeType);

                    if (canFilter) {
                        isOk = self._fn_filter(item);
                        if (!isOk) {
                            self.removeItem(item);
                        }
                    }
                }
                else {
                    if (canFilter) {
                        isOk = self._fn_filter(item);
                        if (isOk) {
                            self.appendItems([item]);
                        }
                    }
                }
            },
            _bindDS:function () {
                var self = this, ds = this._dataSource;
                if (!ds) return;
                ds.addHandler('coll_changed', function (sender, args) {
                    if (ds !== sender) return;
                    self._onDSCollectionChanged(args);
                }, self._objId);
                ds.addHandler('fill', function (sender, args) {
                    if (ds !== sender) return;
                    self._onDSFill(args);
                }, self._objId);
                ds.addHandler('begin_edit', function (sender, args) {
                    if (ds !== sender) return;
                    if (!!self._itemsByKey[args.item._key]) {
                        self._onEditing(args.item, true, false);
                    }
                }, self._objId);
                ds.addHandler('end_edit', function (sender, args) {
                    if (ds !== sender) return;
                    var isOk, item = args.item, canFilter = !!self._fn_filter;
                    if (!!self._itemsByKey[item._key]) {
                        self._onEditing(item, false, args.isCanceled);
                        if (!args.isCanceled && canFilter) {
                            isOk = self._fn_filter(item);
                            if (!isOk)
                                self.removeItem(item);
                        }
                    }
                    else {
                        if (!args.isCanceled && canFilter) {
                            isOk = self._fn_filter(item);
                            if (isOk) {
                                self.appendItems([item]);
                            }
                        }
                    }
                }, self._objId);
                ds.addHandler('errors_changed', function (sender, args) {
                    if (ds !== sender) return;
                    if (!!self._itemsByKey[args.item._key]) {
                        self._onErrorsChanged(args.item);
                    }
                }, self._objId);
                ds.addHandler('status_changed', function (sender, args) {
                    if (ds !== sender) return;
                    self._onDSStatusChanged(args);
                }, self._objId);

                ds.addHandler('item_deleting', function (sender, args) {
                    if (ds !== sender) return;
                    if (!!self._itemsByKey[args.item._key]) {
                        self._onItemDeleting(args);
                    }
                }, self._objId);
                ds.addHandler('item_added', function (sender, args) {
                    if (ds !== sender) return;
                    if (self._isAddingNew) {
                        if (!self._itemsByKey[args.item._key]) {
                            self._attach(args.item);
                        }
                        self.currentItem = args.item;
                        self._onEditing(args.item, true, false);
                        self._onItemAdded(args.item);
                    }
                }, self._objId);
                ds.addHandler('item_adding', function (sender, args) {
                    if (ds !== sender) return;
                    if (self._isAddingNew) {
                        self._onItemAdding(args.item);
                    }
                }, self._objId);
            },
            _unbindDS:function () {
                var self = this, ds = this._dataSource;
                if (!ds) return;
                ds.removeNSHandlers(self._objId);
            },
            appendItems:function (items) {
                if (this._isDestroyed)
                    return [];
                return this._fillItems({items:items, isPageChanged:false, clear:false, isAppend:true});
            },
            _getStrValue:function (val, fieldInfo) {
                return this._dataSource._getStrValue(val, fieldInfo);
            },
            _onCurrentChanging:function (newCurrent) {
                var ds = this._dataSource;
                try {
                    if (!!ds._EditingItem && newCurrent !== ds._EditingItem)
                        ds.endEdit();
                }
                catch (ex) {
                    ds.cancelEdit();
                    global.reThrow(ex, this._onError(ex, this));
                }
            },
            _getErrors:function (item) {
                var ds = this._dataSource;
                return ds._getErrors(item);
            },
            _onPageChanged:function () {
                this._refresh(true);
            },
            getItemsWithErrors:function () {
                var ds = this._dataSource;
                return ds.getItemsWithErrors();
            },
            addNew:function () {
                var ds = this._dataSource, item;
                this._isAddingNew = true;
                try {
                    item = ds.addNew();
                } finally {
                    this._isAddingNew = false;
                }
                return item;
            },
            removeItem:function (item) {
                if (item._key === null) {
                    throw new Error(RIAPP.ERRS.ERR_ITEM_IS_DETACHED);
                }
                if (!this._itemsByKey[item._key])
                    return;
                var oldPos = utils.removeFromArray(this._items,item);
                if (oldPos < 0) {
                    throw new Error(RIAPP.ERRS.ERR_ITEM_IS_NOTFOUND);
                }
                delete this._itemsByKey[item._key];
                delete this._errors[item._key];
                this.totalCount = this.totalCount - 1;
                this._onRemoved(item, oldPos);
                var test = this.getItemByPos(oldPos), curPos = this._currentPos;
                //if detached item was current item
                if (curPos === oldPos) {
                    if (!test) { //it was the last item
                        this._currentPos = curPos - 1;
                    }
                    this._onCurrentChanged();
                }

                if (curPos > oldPos) {
                    this._currentPos = curPos - 1;
                    this._onCurrentChanged();
                }
            },
            sortLocal:function (fieldNames, sortOrder) {
                var mult = 1, parser = this._app.parser;
                if (!!sortOrder && sortOrder.toUpperCase() === 'DESC')
                    mult = -1;
                var fn_sort = function (a, b) {
                    var res = 0, i, len, af, bf, fieldName;
                    for (i = 0, len = fieldNames.length; i < len; i += 1) {
                        fieldName = fieldNames[i];
                        af = parser.resolvePath(a, fieldName);
                        bf = parser.resolvePath(b, fieldName);
                        if (af < bf)
                            res = -1 * mult;
                        else if (af > bf)
                            res = mult;
                        else
                            res = 0;

                        if (res !== 0)
                            return res;
                    }
                    return res;
                };
                this.fn_sort = fn_sort;
            },
            getIsHasErrors:function () {
                return this._dataSource.getIsHasErrors();
            },
            clear:function () {
                this.cancelEdit();
                this._EditingItem = null;
                this._newKey = 0;
                this.currentItem = null;
                this._items = [];
                this._itemsByKey = {};
                this._errors = {};
                this._onItemsChanged({ change_type:COLL_CHANGE_TYPE.RESET, items:[] });
                this.pageIndex = 0;
                this.raisePropertyChanged('count');
            },
            refresh:function () {
                this._refresh(false);
            },
            destroy:function () {
                if (this._isDestroyed)
                    return;
                this._unbindDS();
                this._dataSource = null;
                this._fn_filter = null;
                this._fn_sort = null;
                this._super();
            }
        },
        {
            isPagingEnabled:{
                set:function (v) {
                    if (this._options.enablePaging !== v) {
                        this._options.enablePaging = v;
                        this.raisePropertyChanged('isPagingEnabled');
                        this._refresh();
                    }
                },
                get:function () {
                    return this._options.enablePaging;
                }
            },
            permissions:{
                get:function () {
                    return this._dataSource.permissions;
                }
            },
            fn_filter:{
                set:function (v) {
                    if (this._fn_filter !== v) {
                        this._fn_filter = v;
                        this._refresh();
                    }
                },
                get:function () {
                    return this._fn_filter;
                }
            },
            fn_sort:{
                set:function (v) {
                    if (this._fn_sort !== v) {
                        this._fn_sort = v;
                        this._refresh();
                    }
                },
                get:function () {
                    return this._fn_sort;
                }
            },
            fn_itemsProvider:{
                set:function (v) {
                    if (this._fn_itemsProvider !== v) {
                        this._fn_itemsProvider = v;
                        this._refresh();
                    }
                },
                get:function () {
                    return this._fn_itemsProvider;
                }
            }
        },
        function (obj) {
            thisModule.DataView = obj;
            app.registerType('DataView', obj);
        });

    /*encapsulates parent-child relationship management*/
    var Association = RIAPP.BaseObject.extend({
            _app:app,
            _create:function (options) {
                this._super();
                var self = this;
                this._objId = 'ass' + this._app.getNewObjectID();
                var opts = utils.extend(false, {
                    dbContext:null,
                    parentName:'',
                    childName:'',
                    parentKeyFields:[],
                    childKeyFields:[],
                    parentToChildrenName:null,
                    childToParentName:null,
                    name:this._objId,
                    onDeleteAction:DELETE_ACTION.NoAction
                }, options);

                this._name = opts.name;
                this._dbContext = opts.dbContext;
                this._onDeleteAction = opts.onDeleteAction;
                this._parentDS = opts.dbContext.dbSets[opts.parentName];
                this._childDS = opts.dbContext.dbSets[opts.childName];
                this._parentFldInfos = opts.parentKeyFields.map(function (name) {
                    return self._parentDS.getFieldInfo(name);
                });
                this._childFldInfos = opts.childKeyFields.map(function (name) {
                    return self._childDS.getFieldInfo(name);
                });
                this._parentToChildrenName = opts.parentToChildrenName;
                this._childToParentName = opts.childToParentName;
                this._parentMap = {};
                this._childMap = {};
                this._isParentFilling = false;
                this._isChildFilling = false;
                this._bindParentDS();
                var changed1 = this._mapParentItems(this._parentDS.items);
                this._bindChildDS();
                var changed2 = this._mapChildren(this._childDS.items);
                this._saveParentFKey = null;
                this._saveChildFKey = null;
                this._changedTimeout = null;
                this._changed = {};
                self._notifyParentChanged(changed1);
                self._notifyChildrenChanged(changed2);
            },
            _onError:function (error, source) {
                var isHandled = this._super(error, source);
                if (!isHandled) {
                    return this.app._onError(error, source);
                }
                return isHandled;
            },
            _bindParentDS:function () {
                var self = this, ds = this._parentDS;
                if (!ds) return;
                ds._addHandler('coll_changed', function (sender, args) {
                    if (ds !== sender) return;
                    self._onParentCollChanged(args);
                }, self._objId, true);
                ds._addHandler('fill', function (sender, args) {
                    if (ds !== sender) return;
                    self._onParentFill(args);
                }, self._objId, true);
                ds._addHandler('begin_edit', function (sender, args) {
                    if (ds !== sender) return;
                    self._onParentEdit(args.item, true, undefined);
                }, self._objId, true);
                ds._addHandler('end_edit', function (sender, args) {
                    if (ds !== sender) return;
                    self._onParentEdit(args.item, false, args.isCanceled);
                }, self._objId, true);
                ds._addHandler('item_deleting', function (sender, args) {
                }, self._objId, true);
                ds._addHandler('status_changed', function (sender, args) {
                    if (ds !== sender) return;
                    self._onParentStatusChanged(args.item, args.oldChangeType);
                }, self._objId, true);
                ds._addHandler('commit_changes', function (sender, args) {
                    if (ds !== sender) return;
                    self._onParentCommitChanges(args.item, args.isBegin, args.isRejected, args.changeType);
                }, self._objId, true);
            },
            _bindChildDS:function () {
                var self = this, ds = this._childDS;
                if (!ds) return;
                ds._addHandler('coll_changed', function (sender, args) {
                    if (ds !== sender) return;
                    self._onChildCollChanged(args);
                }, self._objId, true);
                ds._addHandler('fill', function (sender, args) {
                    if (ds !== sender) return;
                    self._onChildFill(args);
                }, self._objId, true);
                ds._addHandler('begin_edit', function (sender, args) {
                    if (ds !== sender) return;
                    self._onChildEdit(args.item, true, undefined);
                }, self._objId, true);
                ds._addHandler('end_edit', function (sender, args) {
                    if (ds !== sender) return;
                    self._onChildEdit(args.item, false, args.isCanceled);
                }, self._objId, true);
                ds._addHandler('status_changed', function (sender, args) {
                    if (ds !== sender) return;
                    self._onChildStatusChanged(args.item, args.oldChangeType);
                }, self._objId, true);
                ds._addHandler('commit_changes', function (sender, args) {
                    if (ds !== sender) return;
                    self._onChildCommitChanges(args.item, args.isBegin, args.isRejected, args.changeType);
                }, self._objId, true);
            },
            _onParentCollChanged:function (args) {
                var self = this, CH_T = COLL_CHANGE_TYPE, item, items = args.items, changed = [], changedKeys = {};
                switch (args.change_type) {
                    case CH_T.RESET:
                        if (!self._isParentFilling)
                            changed = self.refreshParentMap();
                        break;
                    case CH_T.ADDED:
                        if (!this._isParentFilling) //if items are filling then it will be appended when fill ends
                            changed = self._mapParentItems(items);
                        break;
                    case CH_T.REMOVE:
                        items.forEach(function (item) {
                            var key = self._unMapParentItem(item);
                            if (!!key) {
                                changedKeys[key] = null;
                            }
                        });
                        changed = Object.keys(changedKeys);
                        break;
                    case CH_T.REMAP_KEY:
                    {
                        if (!!args.old_key) {
                            item = this._parentMap[args.old_key];
                            if (!!item) {
                                delete this._parentMap[args.old_key];
                                changed = this._mapParentItems([item]);
                            }
                        }
                    }
                        break;
                    default:
                        throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_COLLECTION_CHANGETYPE_INVALID, args.change_type));
                }
                self._notifyParentChanged(changed);
            },
            _onParentFill:function (args) {
                var isEnd = !args.isBegin, self = this, changed;
                if (isEnd) {
                    self._isParentFilling = false;
                    if (args.resetUI) {
                        changed = self.refreshParentMap();
                    }
                    else
                        changed = self._mapParentItems(args.newItems);
                    self._notifyParentChanged(changed);
                }
                else {
                    self._isParentFilling = true;
                }
            },
            _onParentEdit:function (item, isBegin, isCanceled) {
                var self = this;
                if (isBegin) {
                    self._storeParentFKey(item);
                }
                else {
                    if (!isCanceled)
                        self._checkParentFKey(item);
                    else
                        self._saveParentFKey = null;
                }
            },
            _onParentCommitChanges:function (item, isBegin, isRejected, changeType) {
                var self = this, fkey;
                if (isBegin) {
                    if (isRejected && changeType === CHANGE_TYPE.ADDED) {
                        fkey = this._unMapParentItem(item);
                        if (!!fkey)
                            self._notifyParentChanged([fkey]);
                        return;
                    }
                    else if (!isRejected && changeType === CHANGE_TYPE.DELETED) {
                        fkey = this._unMapParentItem(item);
                        if (!!fkey)
                            self._notifyParentChanged([fkey]);
                        return;
                    }

                    self._storeParentFKey(item);
                }
                else {
                    self._checkParentFKey(item);
                }
            },
            _storeParentFKey:function (item) {
                var self = this, fkey = self.getParentFKey(item);
                if (fkey !== null && !!self._parentMap[fkey]) {
                    self._saveParentFKey = fkey;
                }
            },
            _checkParentFKey:function (item) {
                var self = this, fkey, savedKey = self._saveParentFKey;
                self._saveParentFKey = null;
                fkey = self.getParentFKey(item);
                if (fkey !== savedKey) {
                    if (!!savedKey) {
                        delete self._parentMap[savedKey];
                        self._notifyChildrenChanged([savedKey]);
                        self._notifyParentChanged([savedKey]);
                    }

                    if (!!fkey) {
                        self._mapParentItems([item]);
                        self._notifyChildrenChanged([fkey]);
                        self._notifyParentChanged([fkey]);
                    }
                }
            },
            _onParentStatusChanged:function (item, oldChangeType) {
                var self = this, DEL_STATUS = CHANGE_TYPE.DELETED, newChangeType = item._changeType, fkey;
                var children, DA = DELETE_ACTION;
                if (newChangeType === DEL_STATUS) {
                    children = self.getChildItems(item);
                    fkey = this._unMapParentItem(item);
                    switch (self.onDeleteAction) {
                        case DA.NoAction:
                            //nothing
                            break;
                        case DA.Cascade:
                            children.forEach(function (child) {
                                child.deleteItem();
                            });
                            break;
                        case DA.SetNulls:
                            children.forEach(function (child) {
                                var isEdit = child.isEditing;
                                if (!isEdit)
                                    child.beginEdit();
                                try {
                                    self._childFldInfos.forEach(function (f) {
                                        child[f.fieldName] = null;
                                    });
                                    if (!isEdit)
                                        child.endEdit();
                                }
                                finally {
                                    if (!isEdit)
                                        child.cancelEdit();
                                }
                            });
                            break;
                    }
                    if (!!fkey) {
                        self._notifyParentChanged([fkey]);
                    }
                }
            },
            _onChildCollChanged:function (args) {
                var self = this, CH_T = COLL_CHANGE_TYPE, item, items = args.items, changed = [], changedKeys = {};
                switch (args.change_type) {
                    case CH_T.RESET:
                        if (!self._isChildFilling)
                            changed = self.refreshChildMap();
                        break;
                    case CH_T.ADDED:
                        if (!this._isChildFilling) //if items are filling then it will be appended when fill ends
                            changed = self._mapChildren(items);
                        break;
                    case CH_T.REMOVE:
                        items.forEach(function (item) {
                            var key = self._unMapChildItem(item);
                            if (!!key) {
                                changedKeys[key] = null;
                            }
                        });
                        changed = Object.keys(changedKeys);
                        break;
                    case CH_T.REMAP_KEY:
                    {
                        if (!!args.old_key) {
                            item = items[0];
                            if (!!item) {
                                var parentKey = item._getFieldVal(this._childToParentName);
                                if (!!parentKey) {
                                    delete this._childMap[parentKey];
                                    item._clearFieldVal(this._childToParentName);
                                }
                                changed = this._mapChildren([item]);
                            }
                        }
                    }
                        break;
                    default:
                        throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_COLLECTION_CHANGETYPE_INVALID, args.change_type));
                }
                self._notifyChildrenChanged(changed);
            },
            _notifyChildrenChanged:function (changed) {
                this._notifyChanged([], changed);
            },
            _notifyParentChanged:function (changed) {
                this._notifyChanged(changed, []);
            },
            _notifyChanged:function (changed_pkeys, changed_ckeys) {
                var self = this;
                if (changed_pkeys.length > 0 || changed_ckeys.length > 0) {
                    changed_pkeys.forEach(function (key) {
                        var res = self._changed[key];
                        if (!res)
                            res = 1;
                        else
                            res = res | 1;
                        self._changed[key] = res;
                    });
                    changed_ckeys.forEach(function (key) {
                        var res = self._changed[key];
                        if (!res)
                            res = 2;
                        else
                            res = res | 2;
                        self._changed[key] = res;
                    });

                    if (!this._changedTimeout) {
                        this._changedTimeout = setTimeout(function () {
                            if (self._isDestroyCalled)
                                return;
                            self._changedTimeout = null;
                            var changed = self._changed;
                            self._changed = {};
                            var keys = Object.keys(changed);
                            keys.forEach(function (fkey) {
                                var res = changed[fkey];
                                if ((res & 1) == 1) {
                                    self._onParentChanged(fkey);
                                }
                                if ((res & 2) == 2) {
                                    self._onChildrenChanged(fkey);
                                }
                            });
                        }, 50);
                    }
                }
            },
            _onChildFill:function (args) {
                var isEnd = !args.isBegin, self = this, changed;
                if (isEnd) {
                    self._isChildFilling = false;
                    if (args.resetUI) {
                        changed = self.refreshChildMap();
                    }
                    else
                        changed = self._mapChildren(args.newItems);
                    self._notifyChildrenChanged(changed);
                }
                else {
                    self._isChildFilling = true;
                }
            },
            _onChildEdit:function (item, isBegin, isCanceled) {
                var self = this;
                if (isBegin) {
                    self._storeChildFKey(item);
                }
                else {
                    if (!isCanceled)
                        self._checkChildFKey(item);
                    else {
                        self._saveChildFKey = null;
                    }
                }
            },
            _onChildCommitChanges:function (item, isBegin, isRejected, changeType) {
                var self = this, fkey;
                if (isBegin) {
                    if (isRejected && changeType === CHANGE_TYPE.ADDED) {
                        fkey = this._unMapChildItem(item);
                        if (!!fkey)
                            self._notifyChildrenChanged([fkey]);
                        return;
                    }
                    else if (!isRejected && changeType === CHANGE_TYPE.DELETED) {
                        fkey = self._unMapChildItem(item);
                        if (!!fkey)
                            self._notifyChildrenChanged([fkey]);
                        return;
                    }

                    self._storeChildFKey(item);
                }
                else {
                    self._checkChildFKey(item);
                }
            },
            _storeChildFKey:function (item) {
                var self = this, fkey = self.getChildFKey(item), arr;
                if (!!fkey) {
                    arr = self._childMap[fkey];
                    if (!!arr && arr.indexOf(item) > -1) {
                        self._saveChildFKey = fkey;
                    }
                }
            },
            _checkChildFKey:function (item) {
                var self = this, savedKey = self._saveChildFKey, fkey, arr;
                self._saveChildFKey = null;
                fkey = self.getChildFKey(item);
                if (fkey !== savedKey) {
                    if (!!savedKey) {
                        arr = self._childMap[savedKey];
                        utils.removeFromArray(arr,item);
                        if (arr.length == 0) {
                            delete self._childMap[savedKey];
                        }
                        self._notifyParentChanged([savedKey]);
                        self._notifyChildrenChanged([savedKey]);
                    }
                    if (!!fkey) {
                        self._mapChildren([item]);
                        self._notifyParentChanged([fkey]);
                        self._notifyChildrenChanged([fkey]);
                    }
                }
            },
            _onChildStatusChanged:function (item, oldChangeType) {
                var self = this, DEL_STATUS = CHANGE_TYPE.DELETED, newChangeType = item._changeType;
                var fkey = self.getChildFKey(item);
                if (!fkey)
                    return;
                if (newChangeType === DEL_STATUS) {
                    fkey = self._unMapChildItem(item);
                    if (!!fkey)
                        self._notifyChildrenChanged([fkey]);
                }
            },
            _getItemKey:function (finf, ds, item) {
                var arr = [], val, strval;
                for (var i = 0, len = finf.length; i < len; i += 1) {
                    val = item[finf[i].fieldName];
                    strval = ds._getStrValue(val, finf[i]);
                    if (strval === null)
                        return null;
                    arr.push(strval);
                }
                return arr.join(';');
            },
            _resetChildMap:function () {
                var self = this, fkeys = Object.keys(this._childMap);
                this._childMap = {};
                self._notifyChildrenChanged(fkeys);
            },
            _resetParentMap:function () {
                var self = this, fkeys = Object.keys(this._parentMap);
                this._parentMap = {};
                self._notifyParentChanged(fkeys);
            },
            _unMapChildItem:function (item) {
                var fkey, arr, idx, changedKey = null;
                fkey = this.getChildFKey(item);
                if (!!fkey) {
                    arr = this._childMap[fkey];
                    if (!!arr) {
                        idx = utils.removeFromArray(arr,item);
                        if (idx > -1) {
                            if (arr.length == 0)
                                delete this._childMap[fkey];
                            changedKey = fkey;
                        }
                    }
                }
                return changedKey;
            },
            _unMapParentItem:function (item) {
                var fkey, changedKey = null;
                fkey = this.getParentFKey(item);
                if (!!fkey && !!this._parentMap[fkey]) {
                    delete this._parentMap[fkey];
                    changedKey = fkey;
                }
                return changedKey;
            },
            _mapParentItems:function (items) {
                var item, fkey, DEL_STATUS = CHANGE_TYPE.DELETED, chngType, old, chngedKeys = {};
                for (var i = 0, len = items.length; i < len; i += 1) {
                    item = items[i];
                    chngType = item._changeType;
                    if (chngType === DEL_STATUS)
                        continue;
                    fkey = this.getParentFKey(item);
                    if (!!fkey) {
                        old = this._parentMap[fkey];
                        if (old !== item) {
                            this._parentMap[fkey] = item; //map items by foreign keys
                            chngedKeys[fkey] = null;
                        }
                    }
                }
                return Object.keys(chngedKeys);
            },
            _onChildrenChanged:function (fkey) {
                if (!!fkey && !!this._parentToChildrenName) {
                    var obj = this._parentMap[fkey];
                    if (!!obj) {
                        obj.raisePropertyChanged(this._parentToChildrenName);
                    }
                }
            },
            _onParentChanged:function (fkey) {
                var self = this, arr;
                if (!!fkey && !!this._childToParentName) {
                    arr = this._childMap[fkey];
                    if (!!arr) {
                        arr.forEach(function (item) {
                            item.raisePropertyChanged(self._childToParentName);
                        });
                    }
                }
            },
            _mapChildren:function (items) {
                var item, fkey, arr, DEL_STATUS = CHANGE_TYPE.DELETED, chngType, chngedKeys = {};
                for (var i = 0, len = items.length; i < len; i += 1) {
                    item = items[i];
                    chngType = item._changeType;
                    if (chngType === DEL_STATUS)
                        continue;
                    fkey = this.getChildFKey(item);
                    if (!!fkey) {
                        arr = this._childMap[fkey];
                        if (!arr) {
                            arr = [];
                            this._childMap[fkey] = arr;
                        }
                        if (arr.indexOf(item) < 0) {
                            arr.push(item);
                            if (!chngedKeys[fkey])
                                chngedKeys[fkey] = null;
                        }
                    }
                }
                return Object.keys(chngedKeys);
            },
            _unbindParentDS:function () {
                var self = this, ds = this.parentDS;
                if (!ds) return;
                ds.removeNSHandlers(self._objId);
            },
            _unbindChildDS:function () {
                var self = this, ds = this.childDS;
                if (!ds) return;
                ds.removeNSHandlers(self._objId);
            },
            getParentFKey:function (item) {
                if (!!item && item._isNew)
                    return item._key;
                return this._getItemKey(this._parentFldInfos, this._parentDS, item);
            },
            getChildFKey:function (item) {
                if (!!item && !!this._childToParentName) {
                    var parentKey = item._getFieldVal(this._childToParentName);
                    if (!!parentKey) {
                        return parentKey;
                    }
                }
                return this._getItemKey(this._childFldInfos, this._childDS, item);
            },
            //get all childrens for parent item
            getChildItems:function (item) {
                if (!item)
                    return [];
                var fkey = this.getParentFKey(item), arr = this._childMap[fkey];
                if (!arr)
                    return [];
                return arr;
            },
            //get the parent for child item
            getParentItem:function (item) {
                if (!item)
                    return null;
                var fkey = this.getChildFKey(item);
                var obj = this._parentMap[fkey];
                if (!!obj)
                    return obj;
                else
                    return null;
            },
            refreshParentMap:function () {
                this._resetParentMap();
                return this._mapParentItems(this._parentDS.items);
            },
            refreshChildMap:function () {
                this._resetChildMap();
                return this._mapChildren(this._childDS.items);
            },
            destroy:function () {
                
                clearTimeout(this._changedTimeout);
                this._changedTimeout = null;
                this._changed = {};
                this._unbindParentDS();
                this._unbindChildDS();
                this._parentMap = null;
                this._childMap = null;
                this._parentFldInfos = null;
                this._childFldInfos = null;
                this._super();
            },
            toString:function () {
                return 'Association: ' + this._name;
            }
        },
        {
            app:{
                get:function () {
                    return this._app;
                }
            },
            name:{
                get:function () {
                    return this._name;
                }
            },
            parentToChildrenName:{
                get:function () {
                    return this._parentToChildrenName;
                }
            },
            childToParentName:{
                get:function () {
                    return this._childToParentName;
                }
            },
            parentDS:{
                get:function () {
                    return this._parentDS;
                }
            },
            childDS:{
                get:function () {
                    return this._childDS;
                }
            },
            parentFldInfos:{
                get:function () {
                    return this._parentFldInfos;
                }
            },
            childFldInfos:{
                get:function () {
                    return this._childFldInfos;
                }
            },
            onDeleteAction:{
                get:function () {
                    return this._onDeleteAction;
                }
            }

        }, function (obj) {
            thisModule.Association = obj;
        });

    var ChildDataView = DataView.extend({
            _create:function (options) {
                this._parentItem = null;
                this._refreshTimeout = null;
                this._association = options.association;
                options.dataSource = this._association.childDS;

                var self = this, assoc = this._association, save_fn_filter = options.fn_filter;
                options.fn_filter = function (item) {
                    if (!self._parentItem)
                        return false;
                    var fkey1 = assoc.getParentFKey(self._parentItem);
                    if (!fkey1)
                        return false;
                    var fkey2 = assoc.getChildFKey(item);
                    if (!fkey2)
                        return false;
                    if (fkey1 !== fkey2)
                        return false;
                    if (!save_fn_filter)
                        return true;
                    else
                        return save_fn_filter(item);
                };
                this._super(options);
            },
            _refresh:function () {
                var self = this, ds = this._dataSource;
                if (!ds)
                    return;
                clearTimeout(self._refreshTimeout);
                self._refreshTimeout = setTimeout(function () {
                    if (self._isDestroyCalled)
                        return;
                    var items = self._association.getChildItems(self._parentItem);
                    if (!!self._fn_filter) {
                        items = items.filter(self._fn_filter);
                    }
                    if (!!self._fn_sort) {
                        items = items.sort(self._fn_sort);
                    }
                    self._fillItems({items:items, isPageChanged:false, clear:true, isAppend:false});
                    self._onViewRefreshed({});
                }, 250);
            },
            destroy:function () {
                clearTimeout(this._refreshTimeout);
                this._association = null;
                this._super();
            },
            toString:function () {
                if (!!this._association)
                    return 'ChildDataView for ' + this._association.toString();
                return 'ChildDataView';
            }
        },
        {
            parentItem:{
                set:function (v) {
                    if (this._parentItem !== v) {
                        this._parentItem = v;
                        this.raisePropertyChanged('parentItem');
                        if (this.items.length > 0) {
                            this.clear();
                            this._onViewRefreshed({});
                        }
                        this._refresh();
                    }
                },
                get:function () {
                    return this._parentItem;
                }
            },
            association:{
                get:function () {
                    return this._association;
                }
            }
        }, function (obj) {
            thisModule.ChildDataView = obj;
            app.registerType('ChildDataView', obj);
        });

};

RIAPP.Application._coreModules.datadialog = function (app) {
    var thisModule = this, global = app.global, utils = global.utils, TEXT = RIAPP.localizable.TEXT;
    var dbMod = app.modules.db, Template = app.modules.template.Template;
    var consts = {};
    consts.DIALOG_ACTION = {Default:0, StayOpen:1};
    Object.freeze(consts.DIALOG_ACTION);
    Object.freeze(consts);
    thisModule.consts = consts;

    var DataEditDialog = RIAPP.BaseObject.extend({
            _app:app,
             DIALOG_ACTION:consts.DIALOG_ACTION,
            _create:function (options) {
                this._super();
                var self = this;
                this._objId = 'dlg' + this._app.getNewObjectID();
                var opts = utils.extend(false, {
                    dataContext:null,
                    dbContext:null,
                    templateID:null,
                    width:500,
                    height:350,
                    title:'data edit dialog',
                    submitOnOK:false,
                    canRefresh:false,
                    canCancel:true,
                    fn_OnClose:null,
                    fn_OnOK:null,
                    fn_OnCancel:null,
                    fn_OnTemplateCreated:null
                }, options);
                this._dataContext = opts.dataContext;
                this._dbContext = opts.dbContext || this._app.dbContext;
                this._templateID = opts.templateID;
                this._submitOnOK = opts.submitOnOK;
                this._canRefresh = opts.canRefresh;
                this._canCancel = opts.canCancel;
                this._fn_OnClose = opts.fn_OnClose;
                this._fn_OnOK = opts.fn_OnOK;
                this._fn_OnShow = opts.fn_OnShow;
                this._fn_OnCancel = opts.fn_OnCancel;
                this._fn_OnTemplateCreated = opts.fn_OnTemplateCreated;

                this._isEditable = false;
                this._template = null;
                this._$template = null;
                this._result = null;
                this._fn_submitOnOK = function () {
                    var dbContext = self._dbContext;
                    if (!dbContext) {
                        //signals immediatly
                        return utils.createDeferred().resolve();
                    }

                    dbContext.addHandler('submit_error', function (s, a) {
                        if (dbMod.SubmitError.isPrototypeOf(a.error)) {
                            if (a.error.notValidated.length > 0) {
                                a.isHandled = true; //don't reject changes, user can see errors in edit dialog
                            }
                        }
                    }, self._objId);

                    //return promise
                    //accepts callback function, which executed when submit ends
                    var promise = dbContext.submitChanges();
                    promise.always(function () {
                        dbContext.removeHandler('submit_error', self._objId);
                    });
                    return promise;
                };
                this._updateIsEditable();
                this._options = {
                    width:opts.width,
                    height:opts.height,
                    title:opts.title,
                    autoOpen:false,
                    modal:true,
                    close:function (event, ui) {
                        self._onClose();
                    },
                    buttons:self._getButtons()
                };
                this._dialogCreated = false;
                this._createDialog();
            },
            _updateIsEditable:function () {
                var dataContext = this._dataContext;
                this._isEditable = !!dataContext ? (!!dataContext.endEdit && !!dataContext.cancelEdit) : false;
            },
            _createDialog:function () {
                if (this._dialogCreated)
                    return;
                var dctx = this._dataContext;
                this._template = this._createTemplate(dctx);
                this._$template = global.$(this._template.el);
                global.document.body.appendChild(this._template.el);
                this._$template.dialog(this._options);
                this._dialogCreated = true;
                if (!!this._fn_OnTemplateCreated) {
                    this._fn_OnTemplateCreated(this._template);
                }
            },
            _getEventNames:function () {
                var base_events = this._super();
                return ['close', 'refresh'].concat(base_events);
            },
            _createTemplate:function (dcxt) {
                var t = Template.create(this._templateID);
                t.isDisabled = true; //create in disabled state
                t.dataContext = dcxt;
                return t;
            },
            _getButtons:function () {
                var self = this, buttons = [
                    {
                        'id':self._objId + 'Refresh',
                        'text':TEXT.txtRefresh,
                        'class':'btn btn-info',
                        'click':function () {
                            self._onRefresh();
                        }
                    },
                    {
                        'id':self._objId + 'Ok',
                        'text':TEXT.txtOk,
                        'class':'btn btn-info',
                        'click':function () {
                            self._onOk();
                        }
                    },
                    {
                        'id':self._objId + 'Cancel',
                        'text':TEXT.txtCancel,
                        'class':'btn btn-info',
                        'click':function () {
                            self._onCancel();
                        }
                    }
                ];
                if (!this.canRefresh) {
                    buttons.shift();
                }
                if (!this.canCancel) {
                    buttons.pop();
                }
                return buttons;
            },
            _getOkButton:function () {
                return $("#" + this._objId + 'Ok');
            },
            _getCancelButton:function () {
                return $("#" + this._objId + 'Cancel');
            },
            _getRefreshButton:function () {
                return $("#" + this._objId + 'Refresh');
            },
            _getAllButtons:function () {
                return [this._getOkButton(), this._getCancelButton(), this._getRefreshButton()];
            },
            _disableButtons:function (isDisable) {
                var btns = this._getAllButtons();
                btns.forEach(function ($btn) {
                    $btn.prop("disabled", !!isDisable);
                });
            },
            _onOk:function () {
                var self = this, canCommit, action = consts.DIALOG_ACTION.Default;
                if (!!this._fn_OnOK) {
                    action = this._fn_OnOK(this);
                }
                if (action == consts.DIALOG_ACTION.StayOpen)
                    return;

                if (!this._dataContext) {
                    self.hide();
                    return;
                }

                if (this._isEditable)
                    canCommit = this._dataContext.endEdit();
                else
                    canCommit = true;

                if (canCommit) {
                    if (this._submitOnOK) {
                        this._disableButtons(true);
                        var title = this.title;
                        this.title = TEXT.txtSubmitting;
                        var promise = this._fn_submitOnOK();
                        promise.always(function () {
                            self._disableButtons(false);
                            self.title = title;
                        });
                        promise.done(function () {
                            self._result = 'ok';
                            self.hide();
                        });
                        promise.fail(function () {
                            //resume editing if fn_onEndEdit callback returns false in isOk argument
                            if (self._isEditable)
                                self._dataContext.beginEdit();
                        });
                    }
                    else {
                        self._result = 'ok';
                        self.hide();
                    }
                }
            },
            _onCancel:function () {
                var action = consts.DIALOG_ACTION.Default;
                if (!!this._fn_OnCancel) {
                    action = this._fn_OnCancel(this);
                }
                if (action == consts.DIALOG_ACTION.StayOpen)
                    return;

                this._result = 'cancel';
                this.hide();
            },
            _onRefresh:function () {
                var args = {isHandled:false};
                this.raiseEvent('refresh', args);
                if (args.isHandled)
                    return;
                if (!!this._dataContext && !!this._dataContext.refresh) {
                    this._dataContext.refresh();
                }
            },
            _onClose:function () {
                try {
                    if (this._result != 'ok' && !!this._dataContext) {
                        if (this._isEditable)
                            this._dataContext.cancelEdit();
                        if (this._submitOnOK && !!this._dataContext.rejectChanges) {
                            this._dataContext.rejectChanges();
                        }
                    }
                    if (!!this._fn_OnClose)
                        this._fn_OnClose(this);
                    this.raiseEvent('close', {});
                }
                finally {
                    this._template.isDisabled = true;
                }
            },
            show:function () {
                this._result = null;
                this._$template.dialog("option", "buttons", this._getButtons());
                this._template.isDisabled = false;
                if (!!this._fn_OnShow) {
                    this._fn_OnShow(this);
                }
                this._$template.dialog("open");
            },
            hide:function () {
                this._$template.dialog("close");
            },
            getOption:function (name) {
                return this._$template.dialog('option', name);
            },
            setOption:function (name, value) {
                this._$template.dialog('option', name, value);
            },
            destroy:function () {
                if (this._dialogCreated) {
                    this.hide();
                    this._$template.remove();
                    this._template.destroy();
                    this._$template = null;
                    this._template = null;
                    this._dialogCreated = false;
                }
                this._dataContext = null;
                this._dbContext = null;
                this._fn_submitOnOK = null;
                this._super();
            }
        }, {
            app:{
                get:function () {
                    return this._app;
                }
            },
            dataContext:{
                set:function (v) {
                    if (v !== this._dataContext) {
                        this._dataContext = v;
                        if (!!this._template)
                            this._template.dataContext = this._dataContext;
                        this._updateIsEditable();
                        this.raisePropertyChanged('dataContext');
                    }
                },
                get:function () {
                    return this._dataContext;
                }
            },
            result:{
                get:function () {
                    return this._result;
                }
            },
            template:{
                get:function () {
                    return this._template;
                }
            },
            isSubmitOnOK:{
                set:function (v) {
                    if (this._submitOnOK !== v) {
                        this._submitOnOK = v;
                        this.raisePropertyChanged('isSubmitOnOK');
                    }
                },
                get:function () {
                    return this._submitOnOK;
                }
            },
            width:{
                set:function (v) {
                    var x = this.getOption('width');
                    if (v !== x) {
                        this.setOption('width', v);
                        this.raisePropertyChanged('width');
                    }
                },
                get:function () {
                    return this.getOption('width');
                }
            },
            height:{
                set:function (v) {
                    var x = this.getOption('height');
                    if (v !== x) {
                        this.setOption('height', v);
                        this.raisePropertyChanged('height');
                    }
                },
                get:function () {
                    return this.getOption('height');
                }
            },
            title:{
                set:function (v) {
                    var x = this.getOption('title');
                    if (v !== x) {
                        this.setOption('title', v);
                        this.raisePropertyChanged('title');
                    }
                },
                get:function () {
                    return this.getOption('title');
                }
            },
            canRefresh:{
                set:function (v) {
                    var x = this._canRefresh;
                    if (v !== x) {
                        this._canRefresh = v;
                        this.raisePropertyChanged('canRefresh');
                    }
                },
                get:function () {
                    return this._canRefresh;
                }
            },
            canCancel:{
                set:function (v) {
                    var x = this._canCancel;
                    if (v !== x) {
                        this._canCancel = v;
                        this.raisePropertyChanged('canCancel');
                    }
                },
                get:function () {
                    return this._canCancel;
                }
            }
        },
        function (obj) {
            thisModule.DataEditDialog = obj;
            app.registerType('DataEditDialog', obj);
        });

};

RIAPP.Application._coreModules.datagrid = function (app) {
    var thisModule = this, global = app.global, utils = global.utils, consts = global.consts, BaseCell, DetailsRow, DetailsCell,
        BaseColumn, DataCell, Row, DataGrid, ExpanderCell, ActionsCell, RowSelectorCell, DataColumn, ExpanderColumn,
        ActionsColumn, RowSelectorColumn, BaseElView = app.modules.baseElView.BaseElView;
    var collMod = app.modules.collection, DataEditDialog = app.modules.datadialog.DataEditDialog,
        Template = app.modules.template.Template, TEXT = RIAPP.localizable.TEXT,
        COLUMN_TYPE = { DATA:'data', ROW_EXPANDER:'row_expander', ROW_ACTIONS:'row_actions', ROW_SELECTOR:'row_selector' };

    var _css = {
        container:'ria-table-container',
        dataTable:'ria-data-table',
        columnInfo:'ria-col-info',
        column:'ria-ex-column',
        cellDiv:'cell-div',
        headerDiv:'ria-table-header',
        wrapDiv:'ria-table-wrap',
        dataColumn:'data-column',
        rowCollapsed:'row-collapsed',
        rowExpanded:'row-expanded',
        rowExpander:'row-expander',
        columnSelected:'selected',
        rowSelected:'selected',
        rowActions:'row-actions',
        rowDetails:'row-details',
        rowSelector:'row-selector',
        rowHighlight:'row-highlight',
        rowDeleted:'row-deleted',
        rowError:'row-error',
        nobr:'ria-nobr',
        colSortable:'sortable',
        colSortAsc:'sort-asc',
        colSortDesc:'sort-desc'
    };
    Object.freeze(_css);
    thisModule.css = _css;

    BaseCell = RIAPP.BaseObject.extend({
            _app:app,
            _create:function (row, options) {
                this._super();
                this._row = row;
                this._el = options.td;
                this._column = options.column;
                this._div = global.document.createElement("div");
                var $div = global.$(this._div);
                this._clickTimeOut = null;
                $div.addClass(_css.cellDiv).attr(consts.DATA_ATTR.DATA_EVENT_SCOPE, this._column.uniqueID);
                this._div.cell = this;
                if (this._column.options.width) {
                    this._el.style.width = this._column.options.width;
                }
                this._init();
                if (this._column.options.rowCellCss) {
                    $div.addClass(this._column.options.rowCellCss);
                }
                this._el.appendChild(this._div);
                this._row.el.appendChild(this._el);
            },
            _init:function () {
            },
            _onCellClicked:function () {
                this.grid.currentRow = this._row;
            },
            _onDblClicked:function () {
                this.grid.currentRow = this._row;
                this.grid._onCellDblClicked(this);
            },
            _onError:function (error, source) {
                var isHandled = this._super(error, source);
                if (!isHandled) {
                    return this.row._onError(error, source);
                }
                return isHandled;
            },
            scrollIntoView:function (isUp) {
                var div = this._div;
                div.scrollIntoView(!!isUp);
            },
            destroy:function () {
                if (this._isDestroyed)
                    return;
                if (!!this._clickTimeOut){
                    clearTimeout(this._clickTimeOut);
                    this._clickTimeOut = null;
                }
                var $div = global.$(this._div);
                $div.remove();
                this._div.cell = null;
                this._div = null;
                this._row = null;
                this._el = null;
                this._column = null;
                this._super();
            },
            toString:function () {
                return 'BaseCell';
            }
        },
        {
            el:{
                get:function () {
                    return this._el;
                }
            },
            row:{
                get:function () {
                    return this._row;
                }
            },
            column:{
                get:function () {
                    return this._column;
                }
            },
            grid:{
                get:function () {
                    return this._row.grid;
                }
            },
            app:{
                get:function () {
                    return this._app;
                }
            },
            item:{
                get:function () {
                    return this._row.item;
                }
            }
        }, function (obj) {
            thisModule.BaseCell = obj;
        });

    /*displays row data in cell for display and editing*/
    DataCell = BaseCell.extend({
        _create:function (row, options) {
            this._content = null;
            this._stateCss = null;
            this._super(row, options);
        },
        _init:function () {
            var options = this._column.options.content;
            if (!options.fieldInfo && !!options.fieldName) {
                options.fieldInfo = this.item.getFieldInfo(options.fieldName);
                if (!options.fieldInfo) {
                    throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_DBSET_INVALID_FIELDNAME, '', options.fieldName));
                }
            }
            options.initContentFn = null;
            try {
                var contentType = this.app._getContentType(options);
                if (this.app.modules.content.LookupContent === contentType) {
                    options.initContentFn = this._getInitLookUpFn();
                }
                this._content = this.app._getContent(contentType, options, this._div, this.item, this.item.isEditing);
            }
            finally {
                delete options.initContentFn;
            }
        },
        _getInitLookUpFn:function () {
            var self = this;
            return function (content) {
                content.addHandler('listbox_created', function (sender, args) {
                    self._column._listBox = args.listBox;
                    args.isCachedExternally = !!self._column._listBox;
                });
                content.addHandler('need_listbox', function (sender, args) {
                    args.listBox = self._column._listBox;
                });
            };
        },
        _beginEdit:function () {
            if (!this._content.isEditing) {
                this._content.isEditing = true;
            }
        },
        _endEdit:function (isCanceled) {
            if (this._content.isEditing) {
                this._content.isEditing = false;
            }
        },
        _setState:function (css) {
            var $div;
            if (this._stateCss !== css) {
                $div = global.$(this._div);
                if (!!this._stateCss)
                    $div.removeClass(this._stateCss);
                this._stateCss = css;
                if (!!this._stateCss)
                    $div.addClass(this._stateCss);
            }
        },
        destroy:function () {
            if (this._isDestroyed)
                return;
            if (!!this._content) {
                this._content.destroy();
                this._content = null;
            }
            this._super();
        },
        toString:function () {
            return 'DataCell';
        }
    }, null, function (obj) {
        thisModule.DataCell = obj;
    });

    /*contains plus and minus signs images to invoke detail row expanding and collapsing*/
    ExpanderCell = BaseCell.extend({
        _init:function () {
            var $el = global.$(this.el);
            $el.addClass(_css.rowCollapsed);
            $el.addClass(_css.rowExpander);
        },
        _onCellClicked:function () {
            if (!this._row)
                return;
            this._super();
            this._row.isExpanded = !this._row.isExpanded;
        },
        _toggleImage:function () {
            var $el = global.$(this.el);
            if (this._row.isExpanded) {
                $el.removeClass(_css.rowCollapsed);
                $el.addClass(_css.rowExpanded);
            }
            else {
                $el.removeClass(_css.rowExpanded);
                $el.addClass(_css.rowCollapsed);
            }
        },
        toString:function () {
            return 'ExpanderCell';
        }
    }, null, function (obj) {
        thisModule.ExpanderCell = obj;
    });

    /*contains image buttons for invoking row editing ctions*/
    ActionsCell = BaseCell.extend({
            _create:function (row, options) {
                this._isEditing = false;
                this._super(row, options);
            },
            _init:function () {
                var $el = global.$(this.el), $div = global.$(this._div);
                $el.addClass([_css.rowActions, _css.cellDiv, _css.nobr].join(' '));
                $div.on("mouseenter", "img", function (e) {
                    e.stopPropagation();
                    $(this).css("opacity", 0.5);
                });
                $div.on("mouseout", "img", function (e) {
                    e.stopPropagation();
                    $(this).css("opacity", 1.0);
                });
                this._createButtons(false);
            },
            destroy:function () {
                if (this._isDestroyed)
                    return;
                
                var imgs = this._div.getElementsByTagName('img');
                for (var i = 0, len = imgs.length; i < len; i += 1) {
                    imgs[i].cell = null;
                }
                this._super();
            },
            _createButtons:function (editing) {
                if (!this._el)
                    return;
                var self = this, $ = global.$, $div = global.$(this._div), newElems;
                var txtMap = {img_ok:'txtOk', img_cancel:'txtCancel',
                    img_edit:'txtEdit', img_delete:'txtDelete'};
                $div.empty();
                var opts = self._column.options, fn_setUpImages = function (images) {
                    images.each(function (index, elem) {
                        var $el = global.$(elem);
                        elem.style.cursor = 'pointer';
                        elem.src = opts[elem.name];
                        elem.cell = self;
                        utils.addToolTip($el, TEXT[txtMap[elem.name]]);
                        $(elem).attr(consts.DATA_ATTR.DATA_EVENT_SCOPE, self._column.uniqueID);
                    });
                };

                if (editing) {
                    this._isEditing = true;
                    newElems = $('<img name="img_ok" alt="ok"/>&nbsp;<img name="img_cancel" alt="cancel"/>');
                    fn_setUpImages(newElems.filter('img'));
                }
                else {
                    this._isEditing = false;
                    newElems = $('<img name="img_edit" alt="edit"/>&nbsp;<img name="img_delete" alt="delete"/>');
                    if (!self.isCanEdit) {
                        newElems = newElems.not('img[name="img_edit"]');
                    }
                    if (!self.isCanDelete) {
                        newElems = newElems.not('img[name="img_delete"]');
                    }
                    fn_setUpImages(newElems.filter('img'));
                }
                $div.append(newElems);
            },
            update:function () {
                if (!this._row)
                    return;
                if (this._isEditing != this._row.isEditing) {
                    this._createButtons(this._row.isEditing);
                }
            },
            toString:function () {
                return 'ActionsCell';
            }
        },
        {
            isCanEdit:{
                get:function () {
                    return this.grid.isCanEdit;
                }
            },
            isCanDelete:{
                get:function () {
                    return this.grid.isCanDelete;
                }
            }
        }, function (obj) {
            thisModule.ActionsCell = obj;
        });

    /* contains checkbox to for row selection */
    RowSelectorCell = BaseCell.extend({
        _init:function () {
            var $el = global.$(this.el);
            $el.addClass(_css.rowSelector);
            var op = {}, bindOpt = { target:null, source:null,
                targetPath:null, sourcePath:'isSelected', mode:'TwoWay',
                converter:null, converterParam:null
            };
            op.bindingInfo = bindOpt;
            op.displayInfo = null;
            op.fieldName = 'isSelected';
            this._content = this.app.modules.content.RowSelectContent.create(this._div, op, this.row, true);
        },
        destroy:function () {
            if (this._isDestroyed)
                return;
            
            if (!!this._content) {
                this._content.destroy();
                this._content = null;
            }
            this._super();
        },
        toString:function () {
            return 'RowSelectorCell';
        }
    }, null, function (obj) {
        thisModule.RowSelectorCell = obj;
    });

    DetailsCell = RIAPP.BaseObject.extend({
            _app:app,
            _create:function (row, options) {
                this._super();
                this._row = row;
                this._el = options.td;
                this._init(options);
            },
            _init:function (options) {
                var details_id = options.details_id;
                if (!details_id)
                    return;
                this._template = Template.create(details_id);
                this._el.colSpan = this.grid.columns.length;
                this._el.appendChild(this._template.el);
                this._row.el.appendChild(this._el);
            },
            destroy:function () {
                if (this._isDestroyed)
                    return;
                
                if (!!this._template) {
                    this._template.destroy();
                    this._template = null;
                }
                this._row = null;
                this._el = null;
                this._super();
            },
            toString:function () {
                return 'DetailsCell';
            }
        },
        {
            el:{
                get:function () {
                    return this._el;
                }
            },
            row:{
                get:function () {
                    return this._row;
                }
            },
            grid:{
                get:function () {
                    return this._row.grid;
                }
            },
            app:{
                get:function () {
                    return this._app;
                }
            },
            item:{
                set:function (v) {
                    this._template.dataContext = v;
                },
                get:function () {
                    return this._template.dataContext;
                }
            }
        }, function (obj) {
            thisModule.DetailsCell = obj;
        });

    Row = RIAPP.BaseObject.extend({
            _app:app,
            _create:function (grid, options) {
                var self = this;
                this._super();
                this._grid = grid;
                this._el = options.tr;
                this._item = options.item;
                this._cells = [];
                this._objId = this._grid.uniqueID + '_' + this._item._key;
                this._expanderCell = null;
                this._actionsCell = null;
                this._rowSelectorCell = null;
                this._isCurrent = false;
                this._isDeleted = false;
                this._isSelected = false;
                this._createCells();
                this._item.addOnDestroyed(function (sender, args) {
                    self._onItemDestroyed(args);
                }, self._objId);
                this.isDeleted = this._item._isDeleted;
                var fn_state = function () {
                    var css = self._grid._onRowStateChanged(self, self._item[self._grid._options.rowStateField]);
                    self._setState(css);
                };
                if (!!this._grid._options.rowStateField) {
                    this._item.addOnPropertyChange(this._grid._options.rowStateField, function (s, a) {
                        fn_state();
                    }, this._objId);
                    fn_state();
                }
            },
            _onItemDestroyed:function () {
                this.destroy();
            },
            _onError:function (error, source) {
                var isHandled = this._super(error, source);
                if (!isHandled) {
                    return this.grid._onError(error, source);
                }
                return isHandled;
            },
            _createCells:function () {
                var self = this;
                this.columns.forEach(function (col) {
                    var cell = self._createCell(col);
                    self._cells.push(cell);
                });
            },
            _createCell:function (col) {
                var self = this, td = global.document.createElement('td'), cell;
                if (ExpanderColumn.isPrototypeOf(col)) {
                    cell = ExpanderCell.create(self, {td:td, column:col});
                    this._expanderCell = cell;
                }
                else if (ActionsColumn.isPrototypeOf(col)) {
                    cell = ActionsCell.create(self, {td:td, column:col});
                    this._actionsCell = cell;
                }
                else if (RowSelectorColumn.isPrototypeOf(col)) {
                    cell = RowSelectorCell.create(self, {td:td, column:col});
                    this._rowSelectorCell = cell;
                }
                else
                    cell = DataCell.create(self, {td:td, column:col});
                return cell;
            },
            _onBeginEdit:function () {
                var self = this;
                self._cells.forEach(function (cell) {
                    if (DataCell.isPrototypeOf(cell)) {
                        cell._beginEdit();
                    }
                });
                if (!!this._actionsCell)
                    this._actionsCell.update();
            },
            _onEndEdit:function (isCanceled) {
                var self = this;
                self._cells.forEach(function (cell) {
                    if (DataCell.isPrototypeOf(cell)) {
                        cell._endEdit(isCanceled);
                    }
                });
                if (!!this._actionsCell)
                    this._actionsCell.update();
            },
            beginEdit:function () {
                return this._item.beginEdit();
            },
            endEdit:function () {
                return this._item.endEdit();
            },
            cancelEdit:function () {
                return this._item.cancelEdit();
            },
            destroy:function () {
                if (this._isDestroyed)
                    return;
                
                var grid = this._grid;
                if (!!grid) {
                    if (this.isExpanded)
                        grid.collapseDetails();
                    this._cells.forEach(function (cell) {
                        cell.destroy();
                    });
                    this._cells = [];
                    if (!grid._isClearing) {
                        grid._removeRow(this);
                        if (!!this._el) {
                            global.$(this._el).remove();
                        }
                    }
                }
                if (!!this._item)
                    this._item.removeNSHandlers(this._objId);
                this._item = null;
                this._expanderCell = null;
                this._el = null;
                this._grid = null;
                this._super();
            },
            deleteRow:function () {
                this._item.deleteItem();
            },
            updateErrorState:function () {
                //TODO: add implementation to show explanation of error
                var hasErrors = this._item.getIsHasErrors();
                var $el = global.$(this.el);
                if (hasErrors) {
                    $el.addClass(_css.rowError);
                }
                else
                    $el.removeClass(_css.rowError);
            },
            scrollIntoView:function (isUp) {
                if (this._cells.length > 0)
                    this._cells[0].scrollIntoView(isUp);
            },
            _setState:function (css) {
                this.cells.forEach(function (cell) {
                    if (DataCell.isPrototypeOf(cell)) {
                        cell._setState(css);
                    }
                });
            },
            toString:function () {
                return 'Row';
            }
        },
        {
            el:{
                get:function () {
                    return this._el;
                }
            },
            grid:{
                get:function () {
                    return this._grid;
                }
            },
            item:{
                get:function () {
                    return this._item;
                }
            },
            cells:{
                get:function () {
                    return this._cells;
                }
            },
            columns:{
                get:function () {
                    return this._grid.columns;
                }
            },
            uniqueID:{
                get:function () {
                    return this._objId;
                }
            },
            itemKey:{
                get:function () {
                    if (!this._item)
                        return null;
                    return this._item._key;
                }
            },
            isCurrent:{
                set:function (v) {
                    var curr = this._isCurrent;
                    if (v !== curr) {
                        var $el = global.$(this._el);
                        this._isCurrent = v;
                        if (v) {
                            $el.addClass(_css.rowHighlight);
                        }
                        else {
                            $el.removeClass(_css.rowHighlight);
                        }
                        this.raisePropertyChanged('isCurrent');
                    }
                },
                get:function () {
                    return this._isCurrent;
                }
            },
            isSelected:{
                set:function (v) {
                    if (this._isSelected != v) {
                        this._isSelected = v;
                        this.raisePropertyChanged('isSelected');
                        this.grid._onRowSelectionChanged(this);
                    }
                },
                get:function () {
                    return this._isSelected;
                }
            },
            isExpanded:{
                set:function (v) {
                    if (v !== this.isExpanded) {
                        if (!v && this.isExpanded) {
                            this.grid._expandDetails(this, false);
                        }
                        else if (v) {
                            this.grid._expandDetails(this, true);
                        }
                    }
                },
                get:function () {
                    return this.grid._expandedRow === this;
                }
            },
            expanderCell:{
                get:function () {
                    return this._expanderCell;
                }
            },
            actionsCell:{
                get:function () {
                    return this._actionsCell;
                }
            },
            isDeleted:{
                set:function (v) {
                    if (!this._el)
                        return;
                    if (this._isDeleted !== v) {
                        this._isDeleted = v;
                        if (this._isDeleted) {
                            this.isExpanded = false;
                            global.$(this._el).addClass(_css.rowDeleted);
                        }
                        else
                            global.$(this._el).removeClass(_css.rowDeleted);
                    }
                },
                get:function () {
                    if (!this._el)
                        return true;
                    return this._isDeleted;
                }
            },
            isEditing:{
                get:function () {
                    return this._item._isEditing;
                }
            }
        }, function (obj) {
            thisModule.Row = obj;
        });

    DetailsRow = RIAPP.BaseObject.extend({
            _app:app,
            _create:function (grid, options) {
                this._super();
                this._grid = grid;
                this._el = options.tr;
                this._item = null;
                this._cell = null;
                this._parentRow = null;
                this._objId = 'drow' + this.grid.app.getNewObjectID();
                this._createCell(options.details_id);
                this.$el = global.$(this._el);
                this.$el.addClass(_css.rowDetails);
            },
            _createCell:function (details_id) {
                var td = global.document.createElement('td');
                this._cell = DetailsCell.create(this, {td:td, details_id:details_id});
            },
            destroy:function () {
                if (this._isDestroyed)
                    return;
                if (!!this._cell) {
                    this._cell.destroy();
                    this._cell = null;
                }
                global.$(this._el).remove();
                this._item = null;
                this._el = null;
                this._grid = null;
                this._super();
            },
            _setParentRow:function (row) {
                var self = this;
                this._item = null;
                this._cell.item = null;
                utils.removeNode(this.el); //don't use global.$(this._el).remove() here
                if (!row || row._isDestroyCalled){
                    this._parentRow = null;
                    return;
                }
                this._parentRow = row;
                this._item = row.item;
                this._cell.item = this._item;
                utils.insertAfter(row.el, this.el);
                var $cell = global.$(this._cell._template.el);
                //var isLast = this.grid._getLastRow() === this._parentRow;
                $cell.slideDown('fast', function () {
                    var row = self._parentRow;
                    if (!row || row._isDestroyCalled)
                        return;
                    if (self.grid._options.isUseScrollIntoDetails)
                        row.scrollIntoView(true);
                });
            },
            toString:function () {
                return 'DetailsRow';
            }
        },
        {
            el:{
                get:function () {
                    return this._el;
                }
            },
            grid:{
                get:function () {
                    return this._grid;
                }
            },
            item:{
                set:function (v) {
                    if (this._item !== v) {
                        this._item = v;
                    }
                },
                get:function () {
                    return this._item;
                }
            },
            cell:{
                get:function () {
                    return this._cell;
                }
            },
            uniqueID:{
                get:function () {
                    return this._objId;
                }
            },
            itemKey:{
                get:function () {
                    if (!this._item)
                        return null;
                    return this._item._key;
                }
            },
            parentRow:{
                set:function (v) {
                    var self = this;
                    if (v !== this._parentRow) {
                        var $cell = global.$(this._cell._template.el);
                        if (!!self._parentRow) {
                            $cell.slideUp('fast', function () {
                                self._setParentRow(v);
                            });
                        }
                        else {
                            self._setParentRow(v);
                        }
                    }
                },
                get:function () {
                    return this._parentRow;
                }
            }
        }, function (obj) {
            thisModule.DetailsRow = obj;
        });

    BaseColumn = RIAPP.BaseObject.extend({
            _app:app,
            _create:function (grid, options) {
                this._super();
                var self = this;
                this._grid = grid;
                this._el = options.th;
                this._options = options.colinfo;
                this._isSelected = false;
                this._objId = 'col' + this.app.getNewObjectID();

                var $extcol = global.$('<div></div>');
                $extcol.addClass(_css.column);
                this._grid._headerDiv.append($extcol);
                this._extcol = $extcol;

                var $div = global.$('<div></div>');
                $div.addClass(_css.cellDiv).click(function (e) {
                    e.stopPropagation();
                    global.currentSelectable = grid;
                    grid._setCurrentColumn(self);
                    self._onColumnClicked();
                });

                $extcol.append($div);
                $div.get(0).cell = this;
                this._div = $div;

                global.$(this.grid._tableEl).on('click', 'div[' + consts.DATA_ATTR.DATA_EVENT_SCOPE + '="' +
                    this.uniqueID + '"]',
                    function (e) {
                        e.stopPropagation();
                        var cell = this.cell;
                        if (!!cell) {
                            global.currentSelectable = grid;
                            grid._setCurrentColumn(self);
                            if (DataCell.isPrototypeOf(cell)) {
                                if (!!cell._clickTimeOut) {
                                    clearTimeout(cell._clickTimeOut);
                                    cell._clickTimeOut = null;
                                    cell._onDblClicked();
                                }
                                else {
                                    cell._onCellClicked();
                                    cell._clickTimeOut = setTimeout(function () {
                                        cell._clickTimeOut = null;
                                    }, 350);
                                }
                            }
                            else {
                                cell._onCellClicked();
                            }
                        }
                    });

                if (this._options.width) {
                    this._el.style.width = this._options.width;
                }
                this._init();

                if (this._options.colCellCss) {
                    $div.addClass(this._options.colCellCss);
                }
            },
            _init:function () {
                if (!!this.title)
                    this._div.html(this.title);
            },
            destroy:function () {
                if (this._isDestroyed)
                    return;
                
                this._extcol.remove();
                this._extcol = null;
                this._div.get(0).cell = null;
                this._div = null;
                this._item = null;
                this._el = null;
                this._grid = null;
                this._super();
            },
            scrollIntoView:function (isUp) {
                if (!this._div)
                    return;
                var div = this._div.get(0);
                div.scrollIntoView(!!isUp);
            },
            _onColumnClicked:function () {
            },
            toString:function () {
                return 'BaseColumn';
            }
        },
        {
            uniqueID:{
                get:function () {
                    return this._objId;
                }
            },
            app:{
                get:function () {
                    return this._app;
                }
            },
            el:{
                get:function () {
                    return this._el;
                }
            },
            $div:{
                get:function () {
                    return this._div;
                }
            },
            $extcol:{
                get:function () {
                    return this._extcol;
                }
            },
            grid:{
                get:function () {
                    return this._grid;
                }
            },
            options:{
                get:function () {
                    return this._options;
                }
            },
            title:{
                get:function () {
                    return this._options.title;
                }
            },
            isSelected:{
                set:function (v) {
                    if (this._isSelected !== v) {
                        this._isSelected = v;
                        if (this._isSelected) {
                            this._div.addClass(_css.columnSelected);
                        }
                        else
                            this._div.removeClass(_css.columnSelected);
                    }
                },
                get:function () {
                    return this._isSelected;
                }
            }
        }, function (obj) {
            thisModule.BaseColumn = obj;
        });

    DataColumn = BaseColumn.extend({
            _create:function (grid, options) {
                this._super(grid, options);
                // DataCell caches here listbox (for LookupContent)
                //so not to create it for every cell
                this._listBox = null;
                this.$div.addClass(_css.dataColumn);
            },
            _init:function () {
                this._super();
                if (this.isSortable) {
                    this.$div.addClass(_css.colSortable);
                }
                this._sortOrder = null;
            },
            _onColumnClicked:function () {
                if (this.isSortable && !!this.sortMemberName) {
                    var sortOrd = this._sortOrder;
                    this.grid._resetColumnsSort();

                    if (sortOrd == 'ASC') {
                        this.sortOrder = 'DESC';
                    }
                    else if (sortOrd == 'DESC') {
                        this.sortOrder = 'ASC';
                    }
                    else
                        this.sortOrder = 'ASC';
                    this.grid.sortByColumn(this);
                }
            },
            destroy:function () {
                if (this._isDestroyed)
                    return;
                
                if (!!this._listBox) {
                    this._listBox.destroy();
                    this._listBox = null;
                }
                this._super();
            },
            toString:function () {
                return 'DataColumn';
            }
        },
        {
            isSortable:{
                get:function () {
                    return this._options.sortable;
                }
            },
            sortMemberName:{
                get:function () {
                    return this._options.sortMemberName;
                }
            },
            sortOrder:{
                set:function (v) {
                    var $el = this.$div;
                    $el.removeClass(_css.colSortable).removeClass(_css.colSortAsc).removeClass(_css.colSortDesc);
                    switch (v) {
                        case 'ASC':
                            $el.addClass(_css.colSortAsc);
                            break;
                        case 'DESC':
                            $el.addClass(_css.colSortDesc);
                            break;
                        default:
                            if (this.isSortable)
                                $el.addClass(_css.colSortable);
                    }
                    this._sortOrder = v;
                },
                get:function () {
                    return this._sortOrder;
                }
            }
        }, function (obj) {
            thisModule.DataColumn = obj;
        });

    ExpanderColumn = BaseColumn.extend({
        _init:function () {
            this._super();
            this.$div.addClass(_css.rowExpander);
        },
        toString:function () {
            return 'ExpanderColumn';
        }
    }, null, function (obj) {
        thisModule.ExpanderColumn = obj;
    });

    ActionsColumn = BaseColumn.extend({
        _init:function () {
            this._super();
            var self = this, opts = this.options;
            this.$div.addClass(_css.rowActions);
            opts.img_ok = global.getImagePath(opts.img_ok || 'ok.png');
            opts.img_cancel = global.getImagePath(opts.img_cancel || 'cancel.png');
            opts.img_edit = global.getImagePath(opts.img_edit || 'edit.png');
            opts.img_delete = global.getImagePath(opts.img_delete || 'delete.png');
            global.$(this.grid._tableEl).on("click", 'img[' + consts.DATA_ATTR.DATA_EVENT_SCOPE + '="' + this.uniqueID + '"]',
                function (e) {
                    e.stopPropagation();
                    var name = this.name, cell = this.cell;
                    switch (name) {
                        case 'img_ok':
                            self._onOk(cell);
                            break;
                        case 'img_cancel':
                            self._onCancel(cell);
                            break;
                        case 'img_edit':
                            self._onEdit(cell);
                            break;
                        case 'img_delete':
                            self._onDelete(cell);
                            break;
                    }
                });
        },
        _onOk:function (cell) {
            if (!cell._row)
                return;
            cell._row.endEdit();
            cell.update();
        },
        _onCancel:function (cell) {
            if (!cell._row)
                return;
            cell._row.cancelEdit();
            cell.update();
        },
        _onDelete:function (cell) {
            if (!cell._row)
                return;
            cell._row.deleteRow();
        },
        _onEdit:function (cell) {
            if (!cell._row)
                return;
            cell._row.beginEdit();
            cell.update();
            this.grid.showEditDialog();
        },
        toString:function () {
            return 'ActionsColumn';
        }
    }, null, function (obj) {
        thisModule.ActionsColumn = obj;
    });

    RowSelectorColumn = BaseColumn.extend({
        _init:function () {
            this._super();
            var self = this;
            this._val = false;
            this.$div.addClass(_css.rowSelector);
            var $chk = global.$('<input type="checkbox"/>');
            this.$div.append($chk);
            this._chk = $chk;
            $chk.click(function (e) {
                e.stopPropagation();
                self._onCheckBoxClicked(this.checked);
            });
            $chk.on('change', function (e) {
                e.stopPropagation();
                self.checked = this.checked;
            });
        },
        _onCheckBoxClicked:function (isChecked) {
            this.grid.selectRows(isChecked);
        },
        toString:function () {
            return 'RowSelectorColumn';
        }
    }, {
        checked:{
            set:function (v) {
                var el = this._chk;
                if (v !== null)
                    v = !!v;
                if (v !== this._val) {
                    this._val = v;
                    if (el)
                        el[0].checked = !!this._val;
                    this.raisePropertyChanged('checked');
                }
            },
            get:function () {
                return this._val;
            }
        }
    }, function (obj) {
        thisModule.RowSelectorColumn = obj;
    });

    DataGrid = RIAPP.BaseObject.extend({
            _app:app,
            _create:function (el, dataSource, options) {
                this._super();
                if (!!dataSource && !collMod.Collection.isPrototypeOf(dataSource))
                    throw new Error(RIAPP.ERRS.ERR_GRID_DATASRC_INVALID);
                this._options = utils.extend(false,
                    {isUseScrollInto:true,
                        isUseScrollIntoDetails:true,
                        containerCss:null, //div that wraps all table and header
                        wrapCss:null, //div that wraps only table without header
                        headerCss:null, //div inside which are column cells
                        rowStateField:null,
                        isCanEdit:null,
                        isCanDelete:null,
                        isHandleAddNew:false}, options);
                var $t = global.$(el);
                this._tableEl = el;
                this._$tableEl = $t;
                $t.addClass(_css.dataTable);
                this._name = $t.attr(consts.DATA_ATTR.DATA_NAME);
                this._objId = 'grd' + this._app.getNewObjectID();
                this._dataSource = dataSource;
                this._rowMap = {};
                this._rows = [];
                this._columns = [];
                this._isClearing = false;
                this._isDSFilling = false;
                this._currentRow = null;
                this._expandedRow = null;
                this._details = null;
                this._expanderCol = null;
                this._actionsCol = null;
                this._rowSelectorCol = null;
                this._currentColumn = null;
                this._editingRow = null;
                this._isSorting = false;
                this._dialog = null;
                this._headerDiv = null;
                this._chkWidthInterval = null;
                this._wrapDiv = null;
                this._contaner = null;
                this._wrapTable();
                this._createColumns();
                this._bindDS();
                this._refreshGrid(); //fills all rows
                this._updateColsDim();
                this._onDSCurrentChanged();
            },
            _getEventNames:function () {
                var base_events = this._super();
                return ['row_expanded', 'row_selected', 'page_changed', 'row_state_changed',
                    'cell_dblclicked'].concat(base_events);
            },
            _setCurrentColumn:function (column) {
                if (!!this._currentColumn)
                    this._currentColumn.isSelected = false;
                this._currentColumn = column;
                if (!!this._currentColumn)
                    this._currentColumn.isSelected = true;
            },
            _parseColumnAttr:function (column_attr, content_attr) {
                var defaultOp = {
                    type:COLUMN_TYPE.DATA, //default column type
                    title:null,
                    sortable:false,
                    sortMemberName:null,
                    content:{}
                }, options;
                var temp_opts = this._app.parser.parseOptions(column_attr);
                if (temp_opts.length > 0)
                    options = utils.extend(false, defaultOp, temp_opts[0]);
                else
                    options = defaultOp;

                if (!!content_attr) {
                    options.content = this._app._parseContentAttr(content_attr);
                    if (!options.sortMemberName && !!options.content.fieldName)
                        options.sortMemberName = options.content.fieldName;
                }

                return options;
            },
            _findUndeleted:function (row, isUp) {
                if (!row)
                    return null;
                if (!row.isDeleted)
                    return row;
                //find nearest nondeleted row (search up and down)
                var delIndex = this.rows.indexOf(row), i = delIndex, len = this.rows.length;
                if (!isUp) {
                    i -= 1;
                    if (i >= 0)
                        row = this.rows[i];
                    while (i >= 0 && row.isDeleted) {
                        i -= 1;
                        if (i >= 0)
                            row = this.rows[i];
                    }
                    if (row.isDeleted)
                        row = null;
                }
                else {
                    i += 1;
                    if (i < len)
                        row = this.rows[i];
                    while (i < len && row.isDeleted) {
                        i += 1;
                        if (i < len)
                            row = this.rows[i];
                    }
                    if (row.isDeleted)
                        row = null;
                }
                return row;
            },
            _updateCurrent:function (row, withScroll) {
                this.currentRow = row;
                if (withScroll && !!row && !row.isDeleted)
                    this._scrollToCurrent(true);
            },
            _scrollToCurrent:function (isUp) {
                var row = this.currentRow;
                if (!!row) {
                    row.scrollIntoView(isUp);
                }
            },
            _onRowStateChanged:function (row, val) {
                var args = {row:row, val:val, css:null};
                this.raiseEvent('row_state_changed', args);
                return args.css;
            },
            _onCellDblClicked:function (cell) {
                var args = {cell:cell};
                this.raiseEvent('cell_dblclicked', args);
            },
            _onError:function (error, source) {
                var isHandled = this._super(error, source);
                if (!isHandled) {
                    return this._app._onError(error, source);
                }
                return isHandled;
            },
            _onDSCurrentChanged:function () {
                var ds = this._dataSource, cur;
                if (!!ds)
                    cur = ds.currentItem;
                if (!cur)
                    this._updateCurrent(null, false);
                else {
                    this._updateCurrent(this._rowMap[cur._key], false);
                }
            },
            _onDSCollectionChanged:function (args) {
                var self = this, row, CH_T = collMod.consts.COLL_CHANGE_TYPE, items = args.items;
                switch (args.change_type) {
                    case CH_T.RESET:
                        if (!this._isDSFilling)
                            this._refreshGrid();
                        break;
                    case CH_T.ADDED:
                        if (!this._isDSFilling) //if items are filling then it will be appended when fill ends
                            self._appendItems(args.items, args.pos);
                        break;
                    case CH_T.REMOVE:
                        items.forEach(function (item) {
                            var row = self._rowMap[item._key];
                            if (!!row) {
                                self._removeRow(row);
                            }
                        });
                        break;
                    case CH_T.REMAP_KEY:
                    {
                        row = self._rowMap[args.old_key];
                        if (!!row) {
                            delete self._rowMap[args.old_key];
                            self._rowMap[args.new_key] = row;
                        }
                    }
                        break;
                    default:
                        throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_COLLECTION_CHANGETYPE_INVALID, args.change_type));
                }
            },
            _onDSFill:function (args) {
                var isEnd = !args.isBegin, self = this;
                if (isEnd) {
                    self._isDSFilling = false;
                    if (args.resetUI)
                        self._refreshGrid();
                    else
                        self._appendItems(args.newItems);

                    if (!!args.isPageChanged) {
                        setTimeout(function () {
                            if (self._isDestroyCalled)
                                return;
                            self._onPageChanged();
                        }, 100);
                    }
                    setTimeout(function () {
                        if (self._isDestroyCalled)
                            return;
                        self._updateColsDim();
                    }, 200);
                }
                else {
                    self._isDSFilling = true;
                    if (self._isSorting) {
                        self._isSorting = false;
                    }
                    else if (!args.isPageChanged)
                        self._resetColumnsSort();
                }
            },
            _onPageChanged:function () {
                if (!!this._rowSelectorCol) {
                    this._rowSelectorCol.checked = false;
                }
                this._scrollToCurrent(false);
                this.raiseEvent('page_changed', {});
            },
            _onItemEdit:function (item, isBegin, isCanceled) {
                var row = this._rowMap[item._key];
                if (!row)
                    return;
                if (isBegin) {
                    row._onBeginEdit();
                    this._editingRow = row;
                }
                else {
                    row._onEndEdit(isCanceled);
                    this._editingRow = null;
                }
                this.raisePropertyChanged('editingRow');
            },
            _onItemAdded:function (args) {
                var item = args.item, row = this._rowMap[item._key];
                if (!row)
                    return;
                this._updateCurrent(row, true);
                //row.isExpanded = true;
                if (this._options.isHandleAddNew && !args.isAddNewHandled) {
                    args.isAddNewHandled = this.showEditDialog();
                }
            },
            _onItemStatusChanged:function (item, oldChangeType) {
                var DEL_STATUS = consts.CHANGE_TYPE.DELETED, newChangeType = item._changeType, ds = this._dataSource;
                var row = this._rowMap[item._key];
                if (!row)
                    return;
                if (newChangeType === DEL_STATUS) {
                    row.isDeleted = true;
                    var row2 = this._findUndeleted(row, true);
                    if (!row2) {
                        row2 = this._findUndeleted(row, false);
                    }
                    if (!!row2) {
                        ds.currentItem = row2.item;
                    }
                }
                else if (oldChangeType === DEL_STATUS && newChangeType !== DEL_STATUS) {
                    row.isDeleted = false;
                }
            },
            _onRowSelectionChanged:function (row) {
                this.raiseEvent('row_selected', {row:row});
            },
            _onDSErrorsChanged:function (item) {
                var row = this._rowMap[item._key];
                if (!row)
                    return;
                row.updateErrorState();
            },
            _resetColumnsSort:function () {
                this.columns.forEach(function (col) {
                    if (DataColumn.isPrototypeOf(col)) {
                        col.sortOrder = null;
                    }
                });
            },
            _bindDS:function () {
                var self = this, ds = this._dataSource;
                if (!ds) return;
                ds.addHandler('coll_changed', function (sender, args) {
                    if (ds !== sender) return;
                    self._onDSCollectionChanged(args);
                }, self._objId);
                ds.addHandler('fill', function (sender, args) {
                    if (ds !== sender) return;
                    self._onDSFill(args);
                }, self._objId);
                ds.addOnPropertyChange('currentItem', function (sender, args) {
                    if (ds !== sender) return;
                    self._onDSCurrentChanged();
                }, self._objId);
                ds.addHandler('begin_edit', function (sender, args) {
                    if (ds !== sender) return;
                    self._onItemEdit(args.item, true, undefined);
                }, self._objId);
                ds.addHandler('end_edit', function (sender, args) {
                    if (ds !== sender) return;
                    self._onItemEdit(args.item, false, args.isCanceled);
                }, self._objId);
                ds.addHandler('errors_changed', function (sender, args) {
                    if (ds !== sender) return;
                    self._onDSErrorsChanged(args.item);
                }, self._objId);
                ds.addHandler('status_changed', function (sender, args) {
                    if (ds !== sender) return;
                    self._onItemStatusChanged(args.item, args.oldChangeType);
                }, self._objId);
                ds.addHandler('item_added', function (sender, args) {
                    if (ds !== sender) return;
                    self._onItemAdded(args);
                }, self._objId);
            },
            _unbindDS:function () {
                var self = this, ds = this._dataSource;
                if (!ds) return;
                ds.removeNSHandlers(self._objId);
            },
            _getLastRow:function () {
                if (this._rows.length === 0)
                    return null;
                var i = this._rows.length - 1, row = this._rows[i];
                while (row.isDeleted && i > 0) {
                    i -= 1;
                    row = this._rows[i];
                }
                if (row.isDeleted)
                    return null;
                else
                    return row;
            },
            _removeRow:function (row) {
                if (this._expandedRow === row) {
                    this.collapseDetails();
                }
                if (this._rows.length === 0)
                    return;
                var rowkey = row.itemKey, i = utils.removeFromArray(this._rows,row), oldRow;
                try {
                    if (i > -1) {
                        oldRow = row;
                        if (!oldRow._isDestroyCalled)
                            oldRow.destroy();
                    }
                }
                finally {
                    if (!!this._rowMap[rowkey])
                        delete this._rowMap[rowkey];
                }
            },
            _clearGrid:function () {
                if (this._rows.length === 0)
                    return;
                this._isClearing = true;
                try {
                    this.collapseDetails();
                    var self = this, tbody = self._tBodyEl, newTbody = global.document.createElement('tbody');
                    this._tableEl.replaceChild(newTbody, tbody);
                    var rows = this._rows;
                    this._rows = [];
                    this._rowMap = {};
                    rows.forEach(function (row) {
                        row.destroy();
                    });
                }
                finally {
                    this._isClearing = false;
                }
                this._currentRow = null;
            },
            _updateColsDim:function () {
                var width = 0, headerDiv = this._headerDiv;
                this._columns.forEach(function (col) {
                    width += col.el.offsetWidth;
                });
                headerDiv.width(width);
                this._columns.forEach(function (col) {
                    col.$extcol.width(col.el.offsetWidth);
                    col.$extcol.position({
                        my:"left top",
                        at:"left top",
                        of:headerDiv,
                        offset:"" + col.el.offsetLeft + " 0"
                    });
                });
            },
            _wrapTable:function () {
                var $t = this._$tableEl, headerDiv, wrapDiv, container, self = this;

                $t.wrap(global.$('<div></div>').addClass(_css.wrapDiv));
                wrapDiv = $t.parent();
                wrapDiv.wrap(global.$('<div></div>').addClass(_css.container));
                container = wrapDiv.parent();

                headerDiv = global.$('<div></div>').addClass(_css.headerDiv).insertBefore(wrapDiv);
                global.$(this._tHeadRow).addClass(_css.columnInfo);
                this._wrapDiv = wrapDiv;
                this._headerDiv = headerDiv;

                this._contaner = container;

                if (this._options.containerCss) {
                    container.addClass(this._options.containerCss);
                }

                if (this._options.wrapCss) {
                    wrapDiv.addClass(this._options.wrapCss);
                }
                if (this._options.headerCss) {
                    headerDiv.addClass(this._options.headerCss);
                }
                var tw = {w:$t.width()};
                this._chkWidthInterval = setInterval(function () {
                    var test = {w:$t.width()};
                    if (tw.w !== test.w) {
                        tw.w = test.w;
                        self._updateColsDim();
                    }
                }, 1000);
            },
            _unWrapTable:function () {
                var $t = this._$tableEl;
                if (!this._headerDiv)
                    return;
                clearInterval(this._chkWidthInterval);
                this._chkWidthInterval = null;
                this._headerDiv.remove();
                this._headerDiv = null;
                //remove wrapDiv
                $t.unwrap();
                this._wrapDiv = null;
                //remove container
                $t.unwrap();
                this._contaner = null;
            },
            _createColumns:function () {
                var self = this, headCells = this._tHeadCells, cnt = headCells.length, cellInfo = [];
                var th, attr;
                for (var i = 0; i < cnt; i += 1) {
                    th = headCells[i];
                    attr = this._parseColumnAttr(th.getAttribute(consts.DATA_ATTR.DATA_COLUMN), th.getAttribute(consts.DATA_ATTR.DATA_CONTENT));
                    cellInfo.push({th:th, colinfo:attr});
                }

                cellInfo.forEach(function (inf) {
                    var col = self._createColumn(inf);
                    if (!!col)
                        self._columns.push(col);
                });
            },
            _createColumn:function (options) {
                var col;
                switch (options.colinfo.type) {
                    case COLUMN_TYPE.ROW_EXPANDER:
                        if (!this._expanderCol) {
                            col = ExpanderColumn.create(this, options);
                            this._expanderCol = col;
                        }
                        break;
                    case COLUMN_TYPE.ROW_ACTIONS:
                        if (!this._actionsCol) {
                            col = ActionsColumn.create(this, options);
                            this._actionsCol = col;
                        }
                        break;
                    case COLUMN_TYPE.ROW_SELECTOR:
                        if (!this._rowSelectorCol) {
                            col = RowSelectorColumn.create(this, options);
                            this._rowSelectorCol = col;
                        }
                        break;
                    case COLUMN_TYPE.DATA:
                        col = DataColumn.create(this, options);
                        break;
                    default:
                        throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_GRID_COLTYPE_INVALID, options.colinfo.type));
                }
                return col;
            },
            _appendItems:function (newItems) {
                if (this._isDestroyCalled)
                    return;
                var self = this, item, tbody = this._tBodyEl;
                for (var i = 0, k = newItems.length; i < k; i += 1) {
                    item = newItems[i];
                    if (!self._rowMap[item._key])  //not row for item already exists
                        self._createRowForItem(tbody, item);
                }
            },
            _onKeyDown:function (key, event) {
                var ds = this._dataSource, Keys = consts.KEYS, self = this;
                if (!ds)
                    return;
                switch (key) {
                    case Keys.up:
                        event.preventDefault();
                        if (ds.movePrev(true)) {
                            if (self.isUseScrollInto) {
                                self._scrollToCurrent(false);
                            }
                        }
                        break;
                    case Keys.down:
                        event.preventDefault();
                        if (ds.moveNext(true)) {
                            if (self.isUseScrollInto) {
                                self._scrollToCurrent(false);
                            }
                        }
                        break;
                    case Keys.pageDown:
                        /*
                         if (!!this._currentRow && !!this._currentRow.expanderCell && !this._currentRow.isExpanded) {
                         this._currentRow.expanderCell._onCellClicked();
                         event.preventDefault();
                         }
                         */
                        if (ds.pageIndex > 0)
                            ds.pageIndex = ds.pageIndex - 1;
                        break;
                    case Keys.pageUp:
                        /*
                         if (!!this._currentRow && !!this._currentRow.expanderCell && !!this._currentRow.isExpanded) {
                         this._currentRow.expanderCell._onCellClicked();
                         event.preventDefault();
                         }
                         */
                        ds.pageIndex = ds.pageIndex + 1;
                        break;
                    case Keys.enter:
                        if (!!this._currentRow && !!this._actionsCol) {
                            if (this._currentRow.isEditing) {
                                event.preventDefault();
                            }
                            else {
                                event.preventDefault();
                            }
                        }
                        break;
                    case Keys.esc:
                        if (!!this._currentRow && !!this._actionsCol) {
                            if (this._currentRow.isEditing) {
                                event.preventDefault();
                            }
                        }
                        break;
                    case Keys.space:
                        if (!!this._rowSelectorCol && !!this._currentRow && !this._currentRow.isEditing) {
                            event.preventDefault();
                        }
                        break;
                }
            },
            _onKeyUp:function (key, event) {
                var ds = this._dataSource, Keys = consts.KEYS;
                if (!ds)
                    return;
                switch (key) {
                    case Keys.enter:
                        if (!!this._currentRow && !!this._actionsCol) {
                            if (this._currentRow.isEditing) {
                                this._actionsCol._onOk(this._currentRow.actionsCell);
                                event.preventDefault();
                            }
                            else {
                                this._actionsCol._onEdit(this._currentRow.actionsCell);
                                event.preventDefault();
                            }
                        }
                        break;
                    case Keys.esc:
                        if (!!this._currentRow && !!this._actionsCol) {
                            if (this._currentRow.isEditing) {
                                this._actionsCol._onCancel(this._currentRow.actionsCell);
                                event.preventDefault();
                            }
                        }
                        break;
                    case Keys.space:
                        if (!!this._rowSelectorCol && !!this._currentRow && !this._currentRow.isEditing) {
                            event.preventDefault();
                            this._currentRow.isSelected = !this._currentRow.isSelected;
                        }
                        break;
                }
            },
            //Full grid refresh
            _refreshGrid:function () {
                var self = this, ds = this._dataSource;
                self._clearGrid();
                if (!ds) return;
                var docFr = global.document.createDocumentFragment(), oldTbody = this._tBodyEl, newTbody = global.document.createElement('tbody');
                ds.items.forEach(function (item, pos) {
                    self._createRowForItem(docFr, item, pos);
                });
                newTbody.appendChild(docFr);
                self._tableEl.replaceChild(newTbody, oldTbody);
            },
            _createRowForItem:function (parent, item) {
                var self = this, tr = global.document.createElement('tr');
                var gridRow = Row.create(self, {tr:tr, item:item});
                self._rowMap[item._key] = gridRow;
                self._rows.push(gridRow);
                parent.appendChild(gridRow.el);
                return gridRow;
            },
            _createDetails:function () {
                var details_id = this._options.details.templateID;
                var tr = global.document.createElement('tr');
                return DetailsRow.create(this, {tr:tr, details_id:details_id});
            },
            _expandDetails:function (parentRow, expanded) {
                if (!this._options.details)
                    return;
                if (!this._details) {
                    this._details = this._createDetails();
                }
                var old = this._expandedRow;
                if (old === parentRow) {
                    if (!!old && expanded)
                        return;
                }
                this._expandedRow = null;
                this._details.parentRow = null;

                if (expanded) {
                    this._expandedRow = parentRow;
                    this._details.parentRow = parentRow;
                    this._expandedRow.expanderCell._toggleImage();
                }
                else {
                    this._expandedRow = null;
                    this._details.parentRow = null;
                    if (!!old) {
                        old.expanderCell._toggleImage();
                    }
                }
                if (old !== parentRow) {
                    if (!!old)
                        old.expanderCell._toggleImage();
                }
                this.raiseEvent('row_expanded', {old_expandedRow:old, expandedRow:parentRow, isExpanded:expanded});
            },
            sortByColumn:function (column) {
                var ds = this._dataSource, query = ds.query;
                var sorts = column.sortMemberName.split(';');
                if (!!query) {
                    query.clearSort();
                    for (var i = 0; i < sorts.length; i += 1) {
                        if (i == 0)
                            query.orderBy(sorts[i], column.sortOrder);
                        else
                            query.thenBy(sorts[i], column.sortOrder);
                    }

                    query.isClearPrevData = true;
                    query.pageIndex = 0;
                    this._isSorting = true;
                    ds.dbContext.load(query);
                }
                else {
                    this._isSorting = true;
                    ds.sortLocal(sorts, column.sortOrder);
                }
            },
            selectRows:function (isSelect) {
                this._rows.forEach(function (row) {
                    if (row.isDeleted)
                        return;
                    row.isSelected = isSelect;
                });
            },
            findRowByItem:function (item) {
                var row = this._rowMap[item._key];
                if (!row)
                    return null;
                return row;
            },
            collapseDetails:function () {
                if (!this._details)
                    return;
                var old = this._expandedRow;
                if (!!old) {
                    this._expandedRow = null;
                    this._details._setParentRow(null);
                    this.raiseEvent('row_expanded', {old_expandedRow:old, expandedRow:null, isExpanded:false});
                }
            },
            getSelectedRows:function () {
                var res = [];
                this._rows.forEach(function (row) {
                    if (row.isDeleted)
                        return;
                    if (row.isSelected) {
                        res.push(row);
                    }
                });
                return res;
            },
            showEditDialog:function () {
                if (!this._options.editor || !this._options.editor.templateID || !this._editingRow)
                    return false;
                var editorOptions, item = this._editingRow.item;
                if (!item.isEditing)
                    item.beginEdit();
                if (!this._dialog) {
                    editorOptions = utils.extend(false, {dataContext:item
                    }, this._options.editor);
                    this._dialog = DataEditDialog.create(editorOptions);
                }
                else
                    this._dialog.dataContext = item;
                this._dialog.canRefresh = !!this.dataSource.permissions.canRefreshRow && !item._isNew;
                this._dialog.show();
                return true;
            },
            scrollToCurrent:function (isUp) {
                this._scrollToCurrent(isUp);
            },
            addNew:function () {
                var ds = this._dataSource;
                try {
                    ds.addNew();
                    this.showEditDialog();
                } catch (ex) {
                    global.reThrow(ex, this._onError(ex, this));
                }
            },
            destroy:function () {
                if (this._isDestroyed)
                    return;
                
                if (!!this._details) {
                    this._details.destroy();
                    this._details = null;
                }
                if (!!this._dialog) {
                    this._dialog.destroy();
                    this._dialog = null;
                }
                this._clearGrid();
                this._unbindDS();
                this._dataSource = null;
                this._unWrapTable();
                this._$tableEl.removeClass(_css.dataTable);
                global.$(this._tHeadRow).removeClass(_css.columnInfo);
                this._tableEl = null;
                this._$tableEl = null;
                this._super();
            }
        },
        {
            app:{
                get:function () {
                    return this._app;
                }
            },
            //it wraps all the grid, can be used to position grid
            $container:{
                get:function () {
                    return this._contaner;
                }
            },
            _tBodyEl:{
                get:function () {
                    return this._tableEl.tBodies[0];
                }
            },
            _tHeadEl:{
                get:function () {
                    return this._tableEl.tHead;
                }
            },
            _tFootEl:{
                get:function () {
                    return this._tableEl.tFoot;
                }
            },
            _tHeadRow:{
                get:function () {
                    if (!this._tHeadEl)
                        return [];
                    var trs = this._tHeadEl.rows;
                    if (trs.length === 0)
                        return null;
                    return trs[0];
                }
            },
            _tHeadCells:{
                get:function () {
                    var row = this._tHeadRow;
                    if (!row)
                        return [];
                    return row.cells;
                }
            },
            uniqueID:{
                get:function () {
                    return this._objId;
                }
            },
            name:{
                get:function () {
                    return this._name;
                }
            },
            dataSource:{
                set:function (v) {
                    if (v === this._dataSource)
                        return;
                    if (this._dataSource !== null) {
                        this._unbindDS();
                    }
                    this._clearGrid();
                    this._dataSource = v;
                    if (this._dataSource !== null)
                        this._bindDS();
                    this.raisePropertyChanged('dataSource');
                },
                get:function () {
                    return this._dataSource;
                }
            },
            rows:{
                get:function () {
                    return this._rows;
                }
            },
            columns:{
                get:function () {
                    return this._columns;
                }
            },
            currentRow:{
                set:function (row) {
                    var ds = this._dataSource, old = this._currentRow, isChanged = false;
                    if (!ds)
                        return;
                    if (old !== row) {
                        this._currentRow = row;
                        if (!!old) {
                            old.isCurrent = false;
                        }
                        if (!!row)
                            row.isCurrent = true;
                        isChanged = true;
                    }
                    if (!!row) {
                        if (row.item !== ds.currentItem)
                            ds.currentItem = row.item;
                    }
                    else
                        ds.currentItem = null;
                    if (isChanged)
                        this.raisePropertyChanged('currentRow');
                },
                get:function () {
                    return this._currentRow;
                }
            },
            editingRow:{
                get:function () {
                    return this._editingRow;
                }
            },
            isCanEdit:{
                get:function () {
                    if (this._options.isCanEdit !== null)
                        return this._options.isCanEdit;
                    var ds = this._dataSource;
                    return !!ds && ds.permissions.canEditRow;
                }
            },
            isCanDelete:{
                get:function () {
                    if (this._options.isCanDelete !== null)
                        return this._options.isCanDelete;
                    var ds = this._dataSource;
                    return !!ds && ds.permissions.canDeleteRow;
                }
            },
            isCanAddNew:{
                get:function () {
                    var ds = this._dataSource;
                    return !!ds && ds.permissions.canAddRow;
                }
            },
            isUseScrollInto:{
                set:function (v) {
                    this._options.isUseScrollInto = v;
                },
                get:function () {
                    return this._options.isUseScrollInto;
                }
            }
        }, function (obj) {
            thisModule.DataGrid = obj;
        });

    var GridElView = BaseElView.extend({
            _init:function (options) {
                this._super(options);
                this._dataSource = null;
                this._grid = null;
                this._gridEventCommand = null;
                this._options = options;
            },
            destroy:function () {
                if (!!this._dataSource) {
                    this.dataSource = null;
                }
                this._gridEventCommand = null;
                this._super();
            },
            _createGrid:function () {
                this._grid = DataGrid.create(this._el, this._dataSource, this._options);
                this._bindGridEvents();
            },
            _bindGridEvents:function () {
                if (!this._grid)
                    return;
                var self = this;
                this._grid.addHandler('row_expanded', function (s, args) {
                    self.invokeGridEvent('row_expanded', args);
                }, this.uniqueID);
                this._grid.addHandler('row_selected', function (s, args) {
                    self.invokeGridEvent('row_selected', args);
                }, this.uniqueID);
                this._grid.addHandler('page_changed', function (s, args) {
                    self.invokeGridEvent('page_changed', args);
                }, this.uniqueID);
                this._grid.addOnDestroyed(function (s, args) {
                    self._grid = null;
                }, this.uniqueID);

            },
            invokeGridEvent:function (eventName, args) {
                var self = this, data = {eventName:eventName, args:args};
                if (!!self._gridEventCommand) {
                    self._gridEventCommand.execute(self, data);
                }
            },
            toString:function () {
                return 'GridElView';
            }
        },
        {
            dataSource:{
                set:function (v) {
                    var self = this;
                    if (this._dataSource !== v) {
                        this._dataSource = v;
                        if (!!this._grid && !this._grid._isDestroyCalled) {
                            this._grid.destroy();
                            this._grid = null;
                        }
                        if (!!this._dataSource) {
                            this._createGrid();
                        }
                        self.invokePropChanged('grid');
                    }
                },
                get:function () {
                    return this._dataSource;
                }
            },
            grid:{
                get:function () {
                    return this._grid;
                }
            },
            gridEventCommand:{
                set:function (v) {
                    var old = this._gridEventCommand;
                    if (v !== old) {
                        if (!!this._gridEventCommand)
                            this.invokeGridEvent('command_disconnected', {});
                        this._gridEventCommand = v;
                        if (!!this._gridEventCommand)
                            this.invokeGridEvent('command_connected', {});
                    }
                },
                get:function () {
                    return this._gridEventCommand;
                }
            }
        },
        function (obj) {
            thisModule.GridElView = obj;
            app.registerType('GridElView',obj);
            app.registerElView('table', obj);
        });
};

RIAPP.Application._coreModules.pager = function (app) {
    var thisModule = this, global = app.global, utils = global.utils, collMod = app.modules.collection,
        BaseElView = app.modules.baseElView.BaseElView;

    var _css = {
        pager:'ria-data-pager',
        info:'pager-info',
        currentPage:'pager-current-page',
        otherPage:'pager-other-page'
    };
    Object.freeze(_css);
    thisModule.css = _css;

    var PAGER_TXT = RIAPP.localizable.PAGER, format = RIAPP.utils.format;

    var Pager = RIAPP.BaseObject.extend({
            _app:app,
            _create:function (el, dataSource, options) {
                this._super();
                this._el = el;
                this._$el = global.$(this._el);
                this._objId = 'pgr' + this._app.getNewObjectID();
                if (!!dataSource && !collMod.Collection.isPrototypeOf(dataSource))
                    throw new Error(RIAPP.ERRS.ERR_PAGER_DATASRC_INVALID);
                this._dataSource = dataSource;
                this._showTip = true;
                this._showInfo = false;
                this._showFirstAndLast = true;
                this._showPreviousAndNext = false;
                this._showNumbers = true;
                this._rowPerPage = 25;
                this._rowCount = 0;
                this._currentPage = 1;
                this._useSlider = utils.check_is.nt(options.useSlider) ? true : !!options.useSlider;
                this._sliderSize = options.sliderSize || 25;
                this._hideOnSinglePage = utils.check_is.nt(options.hideOnSinglePage) ? true : !!options.hideOnSinglePage;
                this._$el.addClass(_css.pager);
                if (!!this._dataSource) {
                    this._bindDS();
                }
            },
            _createElement:function (tag) {
                return global.$(global.document.createElement(tag));
            },
            _render:function () {
                var $el = this._$el, rowCount, currentPage, pageCount;
                this._clearContent();

                if (this.rowPerPage === 0) {
                    return;
                }

                rowCount = this.rowCount;
                if (rowCount == 0) {
                    return;
                }
                currentPage = this.currentPage;
                if (currentPage == 0) {
                    return;
                }

                pageCount = this.pageCount;

                if (this.hideOnSinglePage && (pageCount == 1)) {
                    $el.hide();
                }
                else {
                    $el.show();

                    if (this.showInfo) {
                        var $span = this._createElement('span');
                        var info = format(PAGER_TXT.pageInfo, currentPage, pageCount);
                        $span.addClass(_css.info).text(info).appendTo($el);
                    }

                    if (this.showFirstAndLast && (currentPage != 1)) {
                        $el.append(this._createFirst());
                    }

                    if (this.showPreviousAndNext && (currentPage != 1)) {
                        $el.append(this._createPrevious());
                    }

                    if (this.showNumbers) {
                        var start = 1, end = pageCount, sliderSize = this.sliderSize, half, above, below;

                        if (this.useSlider && (sliderSize > 0)) {
                            half = Math.floor(((sliderSize - 1) / 2));
                            above = (currentPage + half) + ((sliderSize - 1) % 2);
                            below = (currentPage - half);

                            if (below < 1) {
                                above += (1 - below);
                                below = 1;
                            }

                            if (above > pageCount) {
                                below -= (above - pageCount);

                                if (below < 1) {
                                    below = 1;
                                }

                                above = pageCount;
                            }

                            start = below;
                            end = above;
                        }

                        for (var i = start; i <= end; i++) {
                            if (i === currentPage) {
                                $el.append(this._createCurrent());
                            }
                            else {
                                $el.append(this._createOther(i));
                            }
                        }
                    }

                    if (this.showPreviousAndNext && (currentPage != pageCount)) {
                        $el.append(this._createNext());
                    }

                    if (this.showFirstAndLast && (currentPage != pageCount)) {
                        $el.append(this._createLast());
                    }
                }
            },
            _setDSPageIndex:function (page) {
                this.dataSource.pageIndex = page - 1;
            },
            _onPageSizeChanged:function (ds) {
                this.rowPerPage = ds.pageSize;
            },
            _onPageIndexChanged:function (ds) {
                this.currentPage = ds.pageIndex + 1;
            },
            _onTotalCountChanged:function (ds) {
                this.rowCount = ds.totalCount;
            },
            destroy:function () {
                if (this._isDestroyed)
                    return;
                
                this._unbindDS();
                this._clearContent();
                this._$el.removeClass(_css.pager);
                this._el = null;
                this._$el = null;
                this._super();
            },
            _bindDS:function () {
                var self = this, ds = this._dataSource;
                if (!ds) return;

                ds.addOnPropertyChange('pageIndex', function (sender, args) {
                    if (ds !== sender) return;
                    self._onPageIndexChanged(ds);
                }, self._objId);
                ds.addOnPropertyChange('pageSize', function (sender, args) {
                    if (ds !== sender) return;
                    self._onPageSizeChanged(ds);
                }, self._objId);
                ds.addOnPropertyChange('totalCount', function (sender, args) {
                    if (ds !== sender) return;
                    self._onTotalCountChanged(ds);
                }, self._objId);
                this._currentPage = ds.pageIndex + 1;
                this._rowPerPage = ds.pageSize;
                this._rowCount = ds.totalCount;
                this._render();
            },
            _unbindDS:function () {
                var self = this, ds = this._dataSource;
                if (!ds) return;
                ds.removeNSHandlers(self._objId);
            },
            _clearContent:function () {
                this._$el.empty();
            },
            _createLink:function (page, text, tip) {
                var a = this._createElement('a'), self = this;
                a.text('' + text);
                a.attr('href', 'javascript:void(0)');

                if (!!tip) {
                    utils.addToolTip(a, tip);
                }
                a.click(function (e) {
                    e.preventDefault();
                    self._setDSPageIndex(page);
                    self.currentPage = page;
                });

                return a;
            },
            _createFirst:function () {
                var $span = this._createElement('span'), tip, a;

                if (this.showTip) {
                    tip = PAGER_TXT.firstPageTip;
                }
                a = this._createLink(1, PAGER_TXT.firstText, tip);
                $span.addClass(_css.otherPage).append(a);
                return $span;
            },
            _createPrevious:function () {
                var span = this._createElement('span'), previousPage = this.currentPage - 1, tip, a;

                if (this.showTip) {
                    tip = format(PAGER_TXT.prevPageTip, previousPage);
                }

                a = this._createLink(previousPage, PAGER_TXT.previousText, tip);
                span.addClass(_css.otherPage).append(a);
                return span;
            },
            _createCurrent:function () {
                var span = this._createElement('span'), currentPage = this.currentPage;

                span.text('' + currentPage);

                if (this.showTip) {
                    utils.addToolTip(span, this._buildTip(currentPage));
                }

                span.addClass(_css.currentPage);
                return span;
            },
            _createOther:function (page) {
                var span = this._createElement('span'), tip, a;

                if (this.showTip) {
                    tip = this._buildTip(page);
                }

                a = this._createLink(page, page, tip);
                span.addClass(_css.otherPage);
                span.append(a);
                return span;
            },
            _createNext:function () {
                var span = this._createElement('span'), nextPage = this.currentPage + 1, tip, a;

                if (this.showTip) {
                    tip = format(PAGER_TXT.nextPageTip, nextPage);
                }
                a = this._createLink(nextPage, PAGER_TXT.nextText, tip);
                span.addClass(_css.otherPage).append(a);
                return span;
            },
            _createLast:function () {
                var span = this._createElement('span'), tip, a;

                if (this.showTip) {
                    tip = PAGER_TXT.lastPageTip;
                }
                a = this._createLink(this.pageCount, PAGER_TXT.lastText, tip);
                span.addClass(_css.otherPage).append(a);
                return span;
            },
            _buildTip:function (page) {
                var rowPerPage = this.rowPerPage, rowCount = this.rowCount,
                    start = (((page - 1) * rowPerPage) + 1),
                    end = (page == this.pageCount) ? rowCount : (page * rowPerPage), tip = '';

                if (page == this.currentPage) {
                    tip = format(PAGER_TXT.showingTip, start, end, rowCount);
                }
                else {
                    tip = format(PAGER_TXT.showTip, start, end, rowCount);
                }
                return tip;
            },
            toString:function () {
                return 'Pager';
            }
        },
        {
            el:{
                get:function () {
                    return this._el;
                }
            },
            app:{
                get:function () {
                    return this._app;
                }
            },
            dataSource:{
                set:function (v) {
                    if (v === this._dataSource)
                        return;
                    if (this._dataSource !== null) {
                        this._unbindDS();
                    }
                    this._dataSource = v;
                    if (this._dataSource !== null)
                        this._bindDS();
                    this.raisePropertyChanged('dataSource');
                },
                get:function () {
                    return this._dataSource;
                }
            },
            pageCount:{
                get:function () {
                    var rowCount = this.rowCount, rowPerPage = this.rowPerPage, result;

                    if ((rowCount === 0) || (rowPerPage === 0)) {
                        return 0;
                    }

                    if ((rowCount % rowPerPage) === 0) {
                        return (rowCount / rowPerPage);
                    }
                    else {
                        result = (rowCount / rowPerPage);
                        result = Math.floor(result) + 1;
                        return result;
                    }
                }
            },
            rowCount:{
                set:function (v) {
                    if (this._rowCount != v) {
                        this._rowCount = v;
                        this._render();
                        this.raisePropertyChanged('rowCount');
                    }
                },
                get:function () {
                    return this._rowCount;
                }
            },
            rowPerPage:{
                set:function (v) {
                    if (this._rowPerPage != v) {
                        this._rowPerPage = v;
                        this._render();
                    }
                },
                get:function () {
                    return this._rowPerPage;
                }
            },
            currentPage:{
                set:function (v) {
                    if (this._currentPage != v) {
                        this._currentPage = v;
                        this._render();
                        this.raisePropertyChanged('currentPage');
                    }
                },
                get:function () {
                    return this._currentPage;
                }
            },
            useSlider:{
                set:function (v) {
                    if (this._useSlider != v) {
                        this._useSlider = v;
                        this._render();
                    }
                },
                get:function () {
                    return this._useSlider;
                }
            },
            sliderSize:{
                set:function (v) {
                    if (this._sliderSize != v) {
                        this._sliderSize = v;
                        this._render();
                    }
                },
                get:function () {
                    return this._sliderSize;
                }
            },
            hideOnSinglePage:{
                set:function (v) {
                    if (this._hideOnSinglePage != v) {
                        this._hideOnSinglePage = v;
                        this._render();
                    }
                },
                get:function () {
                    return this._hideOnSinglePage;
                }
            },
            showTip:{
                set:function (v) {
                    if (this._showTip !== v) {
                        this._showTip = v;
                        this._render();
                    }
                },
                get:function () {
                    return this._showTip;
                }
            },
            showInfo:{
                set:function (v) {
                    if (this._showInfo !== v) {
                        this._showInfo = v;
                        this._render();
                    }
                },
                get:function () {
                    return this._showInfo;
                }
            },
            showFirstAndLast:{
                set:function (v) {
                    if (this._showFirstAndLast !== v) {
                        this._showFirstAndLast = v;
                        this._render();
                    }
                },
                get:function () {
                    return this._showFirstAndLast;
                }
            },
            showPreviousAndNext:{
                set:function (v) {
                    if (this._showPreviousAndNext !== v) {
                        this._showPreviousAndNext = v;
                        this._render();
                    }
                },
                get:function () {
                    return this._showPreviousAndNext;
                }
            },
            showNumbers:{
                set:function (v) {
                    if (this._showNumbers !== v) {
                        this._showNumbers = v;
                        this._render();
                    }
                },
                get:function () {
                    return this._showNumbers;
                }
            }
        }, function (obj) {
            thisModule.Pager = obj;
        });

    var PagerElView = BaseElView.extend({
            _init:function (options) {
                this._super(options);
                this._dataSource = null;
                this._pager = null;
                this._options = options;
            },
            destroy:function () {
                if (!!this._pager && !this._pager._isDestroyCalled) {
                    this._pager.destroy();
                }
                this._pager = null;
                this._dataSource = null;
                this._super();
            },
            toString:function () {
                return 'PagerElView';
            }
        },
        {
            dataSource:{
                set:function (v) {
                    var self = this;
                    if (this._dataSource !== v) {
                        this._dataSource = v;
                        if (!!this._pager)
                            this._pager.destroy();
                        this._pager = null;
                        if (!!this._dataSource && this._dataSource.isPagingEnabled) {
                            this._pager =Pager.create(this._el, this._dataSource, this._options);
                            this._pager.addOnDestroyed(function () {
                                self._pager = null;
                            });
                        }
                        self.invokePropChanged('pager');
                    }
                },
                get:function () {
                    return this._dataSource;
                }
            },
            pager:{
                get:function () {
                    return this._pager;
                }
            }
        },
        function (obj) {
            thisModule.PagerElView = obj;
            app.registerType('PagerElView',obj);
            app.registerElView('pager', obj);
        });
};

RIAPP.Application._coreModules.stackpanel = function (app) {
    var thisModule = this, global = app.global, utils = global.utils, consts = global.consts,
        collMod = app.modules.collection, Template = app.modules.template.Template, BaseElView = app.modules.baseElView.BaseElView;
    var _css = {
        stackpanel:'ria-stackpanel',
        item:'stackpanel-item',
        currentItem:'current-item'
    };
    Object.freeze(_css);
    thisModule.css = _css;

    var StackPanel = RIAPP.BaseObject.extend({
            _app:app,
            _create:function (el, dataSource, options) {
                this._super();
                this._el = el;
                this._$el = global.$(this._el);
                this._objId = 'pnl' + this._app.getNewObjectID();
                if (!!dataSource && !collMod.Collection.isPrototypeOf(dataSource))
                    throw new Error(RIAPP.ERRS.ERR_STACKPNL_DATASRC_INVALID);
                this._dataSource = dataSource;
                this._isDSFilling = false;
                this._orientation = options.orientation || 'horizontal';
                this._templateID = options.templateID;
                this._currentItem = null;
                this._$el.addClass(_css.stackpanel);
                this._itemMap = {};
                if (!this._templateID)
                    throw new Error(RIAPP.ERRS.ERR_STACKPNL_TEMPLATE_INVALID);
                if (!!this._dataSource) {
                    this._bindDS();
                }
                global._onStackPanelAdded(this);
            },
            _getEventNames:function () {
                var base_events = this._super();
                return ['item_clicked'].concat(base_events);
            },
            _onKeyDown:function (key, event) {
                var ds = this._dataSource, Keys = consts.KEYS, self = this;
                if (!ds)
                    return;
                if (this._orientation == 'horizontal') {
                    switch (key) {
                        case Keys.left:
                            event.preventDefault();
                            if (ds.movePrev(true)) {
                                self.scrollIntoView(ds.currentItem);
                            }
                            break;
                        case Keys.right:
                            event.preventDefault();
                            if (ds.moveNext(true)) {
                                self.scrollIntoView(ds.currentItem);
                            }
                            break;
                    }
                }
                else {
                    switch (key) {
                        case Keys.up:
                            event.preventDefault();
                            if (ds.movePrev(true)) {
                                self.scrollIntoView(ds.currentItem);
                            }
                            break;
                        case Keys.down:
                            event.preventDefault();
                            if (ds.moveNext(true)) {
                                self.scrollIntoView(ds.currentItem);
                            }
                            break;
                    }
                }
            },
            _onKeyUp:function (key, event) {
            },
            _updateCurrent:function (item, withScroll) {
                var self = this, old = self._currentItem, obj;
                if (old !== item) {
                    this._currentItem = item;
                    if (!!old) {
                        obj = self._itemMap[old._key];
                        if (!!obj) {
                            global.$(obj.div).removeClass(_css.currentItem);
                        }
                    }
                    if (!!item) {
                        obj = self._itemMap[item._key];
                        if (!!obj) {
                            global.$(obj.div).addClass(_css.currentItem);
                            if (withScroll)
                                obj.div.scrollIntoView(false);
                        }
                    }
                    this.raisePropertyChanged('currentItem');
                }
            },
            _onDSCurrentChanged:function (args) {
                var ds = this._dataSource, cur = ds.currentItem;
                if (!cur)
                    this._updateCurrent(null, false);
                else {
                    this._updateCurrent(cur, true);
                }
            },
            _onDSCollectionChanged:function (args) {
                var self = this, CH_T = collMod.consts.COLL_CHANGE_TYPE, items = args.items;
                switch (args.change_type) {
                    case CH_T.RESET:
                        if (!this._isDSFilling)
                            this._refresh();
                        break;
                    case CH_T.ADDED:
                        if (!this._isDSFilling) //if items are filling then it will be appended when fill ends
                            self._appendItems(items);
                        break;
                    case CH_T.REMOVE:
                        items.forEach(function (item) {
                            self._removeItem(item);
                        });
                        break;
                    case CH_T.REMAP_KEY:
                    {
                        var obj = self._itemMap[args.old_key];
                        if (!!obj) {
                            delete self._itemMap[args.old_key];
                            self._itemMap[args.new_key] = obj;
                            obj.div.setAttribute(consts.DATA_ATTR.DATA_ITEM_KEY, args.new_key);
                        }
                    }
                        break;
                    default:
                        throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_COLLECTION_CHANGETYPE_INVALID, args.change_type));
                }
            },
            _onDSFill:function (args) {
                var isEnd = !args.isBegin;
                if (isEnd) {
                    this._isDSFilling = false;
                    if (args.resetUI)
                        this._refresh();
                    else
                        this._appendItems(args.newItems);
                }
                else {
                    this._isDSFilling = true;
                }
            },
            _onItemStatusChanged:function (item, oldChangeType) {
                var DEL_STATUS = consts.CHANGE_TYPE.DELETED, newChangeType = item._changeType;
                var obj = this._itemMap[item._key];
                if (!obj)
                    return;
                if (newChangeType === DEL_STATUS) {
                    global.$(obj.div).hide();
                }
                else if (oldChangeType === DEL_STATUS && newChangeType !== DEL_STATUS) {
                    global.$(obj.div).show();
                }
            },
            _createTemplate:function (dcxt) {
                var t = Template.create(this._templateID);
                t.dataContext = dcxt;
                return t;
            },
            _appendItems:function (newItems) {
                if (this._isDestroyCalled)
                    return;
                var self = this;
                newItems.forEach(function (item) {
                    if (!!self._itemMap[item._key])  //row for item already exists
                        return;
                    self._appendItem(item);
                });
            },
            _appendItem:function (item) {
                if (!item._key)
                    return;
                var self = this, $div = self._createElement('div'), div = $div.get(0), template = self._createTemplate(item);
                $div.addClass(_css.item);
                $div.append(template.el);
                if (this._orientation == 'horizontal') {
                    $div.css('display', 'inline-block');
                }
                self._$el.append($div);
                $div.attr(consts.DATA_ATTR.DATA_ITEM_KEY, item._key);
                $div.click(function (e) {
                    var key = this.getAttribute(consts.DATA_ATTR.DATA_ITEM_KEY);
                    var obj = self._itemMap[key];
                    if (!!obj)
                        self._onItemClicked(obj.div, obj.item);
                });
                self._itemMap[item._key] = {div:div, template:template, item:item};
            },
            _bindDS:function () {
                var self = this, ds = this._dataSource;
                if (!ds) return;
                ds.addHandler('coll_changed', function (sender, args) {
                    if (ds !== sender) return;
                    self._onDSCollectionChanged(args);
                }, self._objId);
                ds.addHandler('fill', function (sender, args) {
                    if (ds !== sender) return;
                    self._onDSFill(args);
                }, self._objId);
                ds.addOnPropertyChange('currentItem', function (sender, args) {
                    if (ds !== sender) return;
                    self._onDSCurrentChanged(args);
                }, self._objId);
                if (ds.getEventNames().indexOf('status_changed') > -1) {
                    ds.addHandler('status_changed', function (sender, args) {
                        if (ds !== sender) return;
                        self._onItemStatusChanged(args.item, args.oldChangeType);
                    }, self._objId);
                }

                this._refresh();
            },
            _unbindDS:function () {
                var self = this, ds = this._dataSource;
                if (!ds) return;
                ds.removeNSHandlers(self._objId);
            },
            _createElement:function (tag) {
                return global.$(global.document.createElement(tag));
            },
            _onItemClicked:function (div, item) {
                this._updateCurrent(item, false);
                this._dataSource.currentItem = item;
                this.raiseEvent('item_clicked', {item:item});
            },
            destroy:function () {
                if (this._isDestroyed)
                    return;
                
                global._onStackPanelRemoved(this);
                this._unbindDS();
                this._clearContent();
                this._$el.removeClass(_css.stackpanel);
                this._el = null;
                this._$el = null;
                this._currentItem = null;
                this._itemMap = {};
                this._super();
            },
            _clearContent:function () {
                var self = this;
                self._$el.empty();
                utils.forEachProp(self._itemMap, function (key) {
                    self._removeItemByKey(key);
                });
            },
            _removeItemByKey:function (key) {
                var self = this, obj = self._itemMap[key];
                if (!obj)
                    return;
                delete self._itemMap[key];
                obj.template.destroy();
            },
            _removeItem:function (item) {
                var self = this, key = item._key, obj = self._itemMap[key];
                if (!obj)
                    return;
                delete self._itemMap[key];
                obj.template.destroy();
                global.$(obj.div).remove();
            },
            _refresh:function () {
                var ds = this._dataSource, self = this;
                this._clearContent();
                if (!ds)
                    return;
                ds.forEach(function (item) {
                    self._appendItem(item);
                });
            },
            scrollIntoView:function (item) {
                if (!item)
                    return;
                var obj = this._itemMap[item._key];
                if (!!obj) {
                    obj.div.scrollIntoView(false);
                }
            },
            getDivElementByItem:function (item) {
                var obj = this._itemMap[item._key];
                if (!obj)
                    return null;
                return obj.div;
            },
            toString:function () {
                return 'StackPanel';
            }
        },
        {
            el:{
                get:function () {
                    return this._el;
                }
            },
            app:{
                get:function () {
                    return this._app;
                }
            },
            dataSource:{
                set:function (v) {
                    if (v === this._dataSource)
                        return;
                    if (this._dataSource !== null) {
                        this._unbindDS();
                    }
                    this._dataSource = v;
                    if (this._dataSource !== null)
                        this._bindDS();
                    this.raisePropertyChanged('dataSource');
                },
                get:function () {
                    return this._dataSource;
                }
            },
            currentItem:{
                get:function () {
                    return this._currentItem;
                }
            }
        },
        function (obj) {
            thisModule.StackPanel = obj;
        });


    var StackPanelElView = BaseElView.extend({
            _init:function (options) {
                this._super(options);
                this._dataSource = null;
                this._panel = null;
                this._options = options;
            },
            destroy:function () {
                if (!!this._panel && !this._panel._isDestroyCalled) {
                    this._panel.destroy();
                }
                this._panel = null;
                this._dataSource = null;
                this._super();
            },
            toString:function () {
                return 'StackPanelElView';
            }
        },
        {
            dataSource:{
                set:function (v) {
                    var self = this;
                    if (this._dataSource !== v) {
                        this._dataSource = v;
                        if (!!this._panel)
                            this._panel.destroy();
                        this._panel = null;
                        if (!!this._dataSource) {
                            this._panel = StackPanel.create(this._el, this._dataSource, this._options);
                            this._panel.addOnDestroyed(function () {
                                self._panel = null;
                            });
                        }
                        self.invokePropChanged('panel');
                    }
                },
                get:function () {
                    return this._dataSource;
                }
            },
            panel:{
                get:function () {
                    return this._panel;
                }
            }
        },
        function (obj) {
            thisModule.StackPanelElView = obj;
            app.registerType('StackPanelElView',obj);
            app.registerElView('stackpanel', obj);
        });
};

RIAPP.Application._coreModules.listbox = function (app) {
    var thisModule = this, global = app.global, utils = global.utils, consts = global.consts,
        collMod = app.modules.collection, EditableElView = app.modules.baseElView.EditableElView;

    var ListBox = RIAPP.BaseObject.extend({
            _app:app,
            _create:function (el, dataSource, options) {
                var self = this;
                this._super();
                this._el = el;
                this._$el = global.$(this._el);
                this._objId = 'lst' + this._app.getNewObjectID();
                if (!!dataSource && !collMod.Collection.isPrototypeOf(dataSource))
                    throw new Error(RIAPP.ERRS.ERR_LISTBOX_DATASRC_INVALID);
                this._$el.on('change.' + this._objId, function (e) {
                    e.stopPropagation();
                    if (self._isRefreshing)
                        return;
                    self._onChanged();
                });
                this._dataSource = null;
                this._css = options.css;
                this._isDSFilling = false;
                this._isRefreshing = false;
                this._valuePath = options.valuePath;
                this._textPath = options.textPath;
                this._selectedItem = null;
                this._saveSelected = null;
                this._keyMap = {};
                this._valMap = {};
                this._saveVal = undefined;
                if (!!this._css) {
                    this._$el.addClass(this._css);
                }
                this.dataSource = dataSource;
            },
            destroy:function () {
                if (this._isDestroyed)
                    return;
                
                this._unbindDS();
                this._$el.off('.' + this._objId);
                if (!!this._css) {
                    this._$el.removeClass(this._css);
                }
                this._clear(true);
                this._el = null;
                this._$el = null;
                this._super();
            },
            _onChanged:function () {
                var op = null, key, data;
                if (this._el.selectedIndex >= 0) {
                    op = this._el.options[this._el.selectedIndex];
                    key = op.value;
                    data = this._keyMap[key];
                }

                if (!data && !!this._selectedItem) {
                    this.selectedItem = null;
                }
                else if (data.item !== this._selectedItem) {
                    this.selectedItem = data.item;
                }
            },
            _getValue:function (item) {
                var v = this._getRealValue(item);
                if (utils.check_is.nt(v))
                    return '';
                return v;
            },
            _getRealValue:function (item) {
                if (!item)
                    return null;
                if (!!this._valuePath) {
                    return this._app.parser.resolvePath(item, this._valuePath);
                }
                else
                    return undefined;
            },
            _getText:function (item) {
                if (!item)
                    return '';
                if (!!this._textPath) {
                    var t = this._app.parser.resolvePath(item, this._textPath);
                    if (utils.check_is.nt(t))
                        return '';
                    return '' + t;
                }
                else
                    return '' + this._getValue(item);
            },
            _onDSCollectionChanged:function (args) {
                var self = this, CH_T = collMod.consts.COLL_CHANGE_TYPE, data;
                switch (args.change_type) {
                    case CH_T.RESET:
                        if (!this._isDSFilling)
                            this._refresh();
                        break;
                    case CH_T.ADDED:
                        if (!this._isDSFilling) //if items are filling then it will be appended when fill ends
                        {
                            args.items.forEach(function (item) {
                                self._addOption(item, item._isNew);
                            });
                        }
                        break;
                    case CH_T.REMOVE:
                        args.items.forEach(function (item) {
                            self._removeOption(item);
                        });
                        break;
                    case CH_T.REMAP_KEY:
                    {
                        data = self._keyMap[args.old_key];
                        if (!!data) {
                            delete self._keyMap[args.old_key];
                            self._keyMap[args.new_key] = data;
                            data.op.value = args.new_key;
                        }
                    }
                }
            },
            _onDSFill:function (args) {
                var isEnd = !args.isBegin;
                if (isEnd) {
                    this._isDSFilling = false;
                    this._refresh();
                }
                else {
                    this._isDSFilling = true;
                }
            },
            _onEdit:function (item, isBegin, isCanceled) {
                var self = this, key, data , oldVal, val;
                if (isBegin) {
                    this._saveVal = this._getValue(item);
                }
                else {
                    oldVal = this._saveVal;
                    this._saveVal = undefined;
                    if (!isCanceled) {
                        key = item._key;
                        data = self._keyMap[key];
                        if (!!data) {
                            data.op.text = self._getText(item);
                            val = this._getValue(item);
                            if (oldVal !== val) {
                                if (oldVal !== '') {
                                    delete self._valMap[oldVal];
                                }
                                if (val !== '') {
                                    self._valMap[val] = data;
                                }
                            }
                        }
                        else {
                            if (oldVal !== '') {
                                delete self._valMap[oldVal];
                            }
                        }
                    }
                }
            },
            _onStatusChanged:function (item, oldChangeType) {
                var DEL_STATUS = consts.CHANGE_TYPE.DELETED, newChangeType = item._changeType;
                if (newChangeType === DEL_STATUS) {
                    this._removeOption(item);
                }
            },
            _onCommitChanges:function (item, isBegin, isRejected, changeType) {
                var self = this, ct = consts.CHANGE_TYPE, oldVal, val, data;
                if (isBegin) {
                    if (isRejected && changeType === ct.ADDED) {
                        return;
                    }
                    else if (!isRejected && changeType === ct.DELETED) {
                        return;
                    }

                    this._saveVal = this._getValue(item);
                }
                else {
                    oldVal = this._saveVal;
                    this._saveVal = undefined;

                    if (isRejected && changeType === ct.DELETED) {
                        this._addOption(item, true);
                        return;
                    }
                    val = this._getValue(item);
                    data = self._keyMap[item._key];
                    if (oldVal !== val) {
                        if (oldVal !== '') {
                            delete self._valMap[oldVal];
                        }
                        if (!!data && val !== '') {
                            self._valMap[val] = data;
                        }
                    }
                    if (!!data) {
                        data.op.text = self._getText(item);
                    }
                }
            },
            _bindDS:function () {
                var self = this, ds = this._dataSource;
                if (!ds) return;
                ds.addHandler('coll_changed', function (sender, args) {
                    if (ds !== sender) return;
                    self._onDSCollectionChanged(args);
                }, self._objId);
                ds.addHandler('fill', function (sender, args) {
                    if (ds !== sender) return;
                    self._onDSFill(args);
                }, self._objId);
                ds.addHandler('begin_edit', function (sender, args) {
                    if (ds !== sender) return;
                    self._onEdit(args.item, true, undefined);
                }, self._objId);
                ds.addHandler('end_edit', function (sender, args) {
                    if (ds !== sender) return;
                    self._onEdit(args.item, false, args.isCanceled);
                }, self._objId);
                ds.addHandler('status_changed', function (sender, args) {
                    if (ds !== sender) return;
                    self._onStatusChanged(args.item, args.oldChangeType);
                }, self._objId);
                ds.addHandler('commit_changes', function (sender, args) {
                    if (ds !== sender) return;
                    self._onCommitChanges(args.item, args.isBegin, args.isRejected, args.changeType);
                }, self._objId);
            },
            _unbindDS:function () {
                var self = this, ds = this._dataSource;
                if (!ds) return;
                ds.removeNSHandlers(self._objId);
            },
            _addOption:function (item, first) {
                if (this._isDestroyCalled)
                    return null;
                var oOption, key = '', val, text;
                if (!!item) {
                    key = item._key;
                }
                if (!!this._keyMap[key]) {
                    return null;
                }
                text = this._getText(item);
                val = this._getValue(item);
                oOption = global.document.createElement("option");
                oOption.text = text;
                oOption.value = key;
                var data = {item:item, op:oOption };
                this._keyMap[key] = data;
                if (val !== '')
                    this._valMap[val] = data;
                if (!!first) {
                    if (this._el.options.length < 2)
                        this._el.add(oOption, null);
                    else
                        this._el.add(oOption, this._el.options[1]);
                }
                else
                    this._el.add(oOption, null);
                return oOption;
            },
            _removeOption:function (item) {
                if (this._isDestroyCalled)
                    return;
                var key = '', data, val;
                if (!!item) {
                    key = item._key;
                    data = this._keyMap[key];
                    if (!data) {
                        return;
                    }
                    this._el.remove(data.op.index);
                    val = this._getValue(item);
                    delete this._keyMap[key];
                    if (val !== '')
                        delete this._valMap[val];
                    if (this._saveSelected === item) {
                        this._saveSelected = null;
                    }
                    if (this.selectedItem === item) {
                        this.selectedItem = this._saveSelected;
                    }
                }
            },
            _clear:function (isDestroy) {
                this._el.options.length = 0;
                this._keyMap = {};
                this._valMap = {};
                this._saveSelected = null;
                if (!isDestroy) {
                    this._addOption(null, false);
                    this.selectedItem = null;
                }
                else
                    this._selectedItem = null;
            },
            clear:function () {
                this._clear(false);
            },
            _refresh:function () {
                var self = this, ds = this._dataSource, oldItem = this._selectedItem;
                this._isRefreshing = true;
                try {
                    this.clear();
                    if (!!ds) {
                        ds.forEach(function (item) {
                            self._addOption(item, false);
                        });
                    }
                    this._el.selectedIndex = this._findItemIndex(oldItem);
                } finally {
                    this._isRefreshing = false;
                }
                this._onChanged();
            },
            _findItemIndex:function (item) {
                if (!item)
                    return 0;
                var data = this._keyMap[item._key];
                if (!data)
                    return 0;
                return data.op.index;
            },
            findItemByValue:function (val) {
                var data = this._valMap[val];
                if (!data)
                    return null;
                return data.item;
            },
            getTextByValue:function (val) {
                var data = this._valMap[val];
                if (!data)
                    return '';
                else
                    return data.op.text;
            },
            _setIsEnabled:function (el, v) {
                el.disabled = !v;
            },
            _getIsEnabled:function (el) {
                return !el.disabled;
            },
            toString:function () {
                return 'ListBox';
            }
        },
        {
            dataSource:{
                set:function (v) {
                    if (this._dataSource !== v) {
                        if (!!this._dataSource)
                            this._unbindDS();
                        this.clear();
                        this._dataSource = v;
                        if (!!this._dataSource) {
                            this._bindDS();
                        }
                        this._refresh();
                        this.raisePropertyChanged('dataSource');
                    }
                },
                get:function () {
                    return this._dataSource;
                }
            },
            selectedValue:{
                set:function (v) {
                    if (this.selectedValue !== v) {
                        var item = this.findItemByValue(v);
                        this.selectedItem = item;
                    }
                },
                get:function () {
                    var item = this.selectedItem;
                    return this._getRealValue(item);
                }
            },
            selectedItem:{
                set:function (v) {
                    if (this._selectedItem !== v) {
                        if (!!this._selectedItem)
                            this._saveSelected = this._selectedItem;
                        this._selectedItem = v;
                        this._el.selectedIndex = this._findItemIndex(this._selectedItem);
                        this.raisePropertyChanged('selectedItem');
                        this.raisePropertyChanged('selectedValue');
                    }
                },
                get:function () {
                    return this._selectedItem;
                }
            },
            valuePath:{
                set:function (v) {
                    if (v !== this._valuePath) {
                        this._valuePath = v;
                        this.raisePropertyChanged('valuePath');
                    }
                },
                get:function () {
                    return this._valuePath;
                }
            },
            textPath:{
                set:function (v) {
                    if (v !== this._textPath) {
                        this._textPath = v;
                        this._refresh();
                        this.raisePropertyChanged('textPath');
                    }
                },
                get:function () {
                    return this._textPath;
                }
            },
            isEnabled:{
                set:function (v) {
                    if (v !== this.isEnabled) {
                        this._setIsEnabled(this.$el, v);
                        this.raisePropertyChanged('isEnabled');
                    }
                },
                get:function () {
                    return this._getIsEnabled(this.$el);
                }
            },
            el:{
                get:function () {
                    return this._el;
                }
            }
        },
        function (obj) {
            thisModule.ListBox = obj;
        });

    var SelectElView = EditableElView.extend({
            _init:function (options) {
                this._super(options);
                this._dataSource = null;
                this._listBox = null;
                this._options = options;
            },
            destroy:function () {
                if (!!this._listBox && !this._listBox._isDestroyCalled) {
                    this._listBox.destroy();
                }
                this._listBox = null;
                this._dataSource = null;
                this._super();
            },
            toString:function () {
                return 'SelectElView';
            }
        },
        {
            dataSource:{
                set:function (v) {
                    var self = this;
                    if (this._dataSource !== v) {
                        this._dataSource = v;
                        if (!!this._listBox)
                            this._listBox.destroy();
                        this._listBox = null;
                        if (!!this._dataSource) {
                            this._listBox = ListBox.create(this._el, this._dataSource, this._options);
                            this._listBox.addOnDestroyed(function () {
                                self._listBox = null;
                            }, this.uniqueID);
                            this._listBox.addOnPropertyChange('*', function (sender, args) {
                                self.raisePropertyChanged(args.property);
                            }, this.uniqueID);
                        }
                        self.invokePropChanged('listBox');
                    }
                },
                get:function () {
                    return this._dataSource;
                }
            },
            selectedValue:{
                set:function (v) {
                    if (!this._listBox)
                        return;
                    if (this._listBox.selectedValue !== v) {
                        this._listBox.selectedValue = v;
                    }
                },
                get:function () {
                    if (!this._listBox)
                        return null;
                    return this._listBox.selectedValue;
                }
            },
            selectedItem:{
                set:function (v) {
                    if (!this._listBox)
                        return;
                    this._listBox.selectedItem = v;
                },
                get:function () {
                    if (!this._listBox)
                        return null;
                    return this._listBox.selectedItem;
                }
            },
            listBox:{
                get:function () {
                    return this._listBox;
                }
            }
        },
        function (obj) {
            thisModule.SelectElView = obj;
            app.registerType('SelectElView',obj);
            app.registerElView('select', obj);
        });
};

RIAPP.Application._coreModules.dataform = function (app) {
    var thisModule = this, global = app.global, utils = global.utils, consts = global.consts,
        Binding = app.modules.binding.Binding,  BaseElView = app.modules.baseElView.BaseElView,
        _css = {
        dataform:'ria-dataform'
        }, ERRTEXT = RIAPP.localizable.VALIDATE;
    Object.freeze(_css);
    thisModule.css = _css;

    var DataForm = RIAPP.BaseObject.extend({
            _DATA_CONTENT_SELECTOR:'*[' + consts.DATA_ATTR.DATA_CONTENT + ']:not([' + consts.DATA_ATTR.DATA_COLUMN + '])',
            _app:app,
            _create:function (el, options) {
                var self = this, parent;
                this._super();
                this._el = el;
                this._$el = global.$(this._el);
                this._objId = 'frm' + this._app.getNewObjectID();
                this._css = options.css;
                this._dataContext = null;
                this._$el.addClass(_css.dataform);
                if (!!this._css) {
                    this._$el.addClass(this._css);
                }
                this._isEditing = false;
                this._isDisabled = false;
                this._content = [];
                this._lfTime = null;
                this._contentCreated = false;
                this._supportEdit = false;
                this._collection = null;
                this._parentDataForm = null;
                this._errors = null;
                parent = this._getParentDataForm(this._el);
                //if this form is nested inside other form
                //subscribe for parent destroy event
                if (!!parent) {
                    self._parentDataForm = app.getElementView(parent);
                    self._parentDataForm.addOnDestroyed(function (sender, args) {
                        self.destroy(); //destroy itself if parent form is destroyed
                    }, self._objId);
                }
            },
            _getBindings:function () {
                if (!this._lfTime)
                    return [];
                var arr = this._lfTime.getObjs(), res = [];
                for (var i = 0, len = arr.length; i < len; i += 1) {
                    if (Binding.isPrototypeOf(arr[i]))
                        res.push(arr[i]);
                }
                return res;
            },
            _getElViews:function () {
                if (!this._lfTime)
                    return [];
                var arr = this._lfTime.getObjs(), res = [];
                for (var i = 0, len = arr.length; i < len; i += 1) {
                    if (BaseElView.isPrototypeOf(arr[i]))
                        res.push(arr[i]);
                }
                return res;
            },
            _updateIsDisabled:function () {
                var i, len, obj, bindings = this._getBindings(), elViews = this._getElViews(),
                    DataFormElView = this._app._getElViewType(consts.ELVIEW_NM.DATAFORM);
                for (i = 0, len = bindings.length; i < len; i += 1) {
                    obj = bindings[i];
                    obj.isDisabled = this._isDisabled;
                }
                for (i = 0, len = elViews.length; i < len; i += 1) {
                    obj = elViews[i];
                    if (DataFormElView.isPrototypeOf(obj) && !!obj.form){
                        obj.form.isDisabled = this._isDisabled;
                    }
                }
            },
            _updateContent:function () {
                var dctx = this._dataContext, bindings, self = this;

                if (this._contentCreated) {
                    this._content.forEach(function (content) {
                        content.dataContext = dctx;
                        content.isEditing = this.isEditing;
                    }, this);

                    bindings = this._getBindings();
                    bindings.forEach(function (binding) {
                        if (!binding.isSourceFixed)
                            binding.source = dctx;
                    });
                    return;
                }

                if (!dctx) {
                    return;
                }
                var elements = Array.fromList(this._el.querySelectorAll(self._DATA_CONTENT_SELECTOR)), isEditing = this.isEditing;
                elements.forEach(function (el) {
                    if (self._getParentDataForm(el) !== self._el) //element inside nested dataform
                        return;
                    var attr = el.getAttribute(consts.DATA_ATTR.DATA_CONTENT), op = self._app._parseContentAttr(attr);
                    if (!!op.fieldName && !op.fieldInfo) {
                        if (!dctx.getFieldInfo) {
                            throw new Error(RIAPP.ERRS.ERR_DCTX_HAS_NO_FIELDINFO);
                        }
                        op.fieldInfo = dctx.getFieldInfo(op.fieldName);
                        if (!op.fieldInfo) {
                            throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_DBSET_INVALID_FIELDNAME, '', op.fieldName));
                        }
                    }
                    var contentType = self._app._getContentType(op);
                    var content = self._app._getContent(contentType, op, el, dctx, isEditing);
                    if (!!content) {
                        self._content.push(content);
                    }
                });
                this._lfTime = this._app._bindElements(this._el, dctx, true);
                this._contentCreated = true;
            },
            /*
             in case of dataforms nesting, elements parent dataform can be nested dataform
             this function returns element dataform
             */
            _getParentDataForm:function (el) {
                if (!el)
                    return null;
                var parent = el.parentElement, document = global.document, attr, opts;
                if (!!parent) {
                    if (parent === this._el)
                        return this._el;
                    if (parent === document)
                        return null;
                    attr = parent.getAttribute(consts.DATA_ATTR.DATA_VIEW);
                    if (!attr) {
                        return this._getParentDataForm(parent);
                    }
                    opts = this._app.parser.parseOptions(attr);
                    if (opts.length > 0 && opts[0].name == consts.ELVIEW_NM.DATAFORM) {
                        return parent;
                    }
                    else
                        return this._getParentDataForm(parent);
                }

                return null;
            },
            _onDSErrorsChanged:function (item) {
                if (!item)
                    this.validationErrors = null;
                else
                    this.validationErrors = item.getAllErrors();
            },
            _bindDS:function () {
                var dataContext = this._dataContext, self = this;
                if (!dataContext)
                    return;
                dataContext.addOnDestroyed(function (s, a) {
                    self.dataContext = null;
                }, this._objId);

                if (this._supportEdit) {
                    dataContext.addOnPropertyChange('isEditing', function (sender, args) {
                        self.isEditing = sender.isEditing;
                    }, this._objId);
                }

                if (!!this._collection) {
                    this._collection.addHandler('errors_changed', function (sender, args) {
                        if (args.item !== dataContext)
                            return;
                        self._onDSErrorsChanged(args.item);
                    }, self._objId);
                }
            },
            _unbindDS:function () {
                var dataContext = this._dataContext, coll = this._collection;
                this.validationErrors = null;
                if (!!dataContext  && !dataContext._isDestroyCalled) {
                    dataContext.removeNSHandlers(this._objId);
                }
                if (!!coll && !coll._isDestroyCalled) {
                    coll.removeNSHandlers(this._objId);
                }
            },
            _clearContent:function () {
                this._content.forEach(function (content) {
                    content.destroy();
                });
                this._content = [];
                if (!!this._lfTime) {
                    this._lfTime.destroy();
                    this._lfTime = null;
                }
                this._contentCreated = false;
            },
            _onError:function (error, source) {
                var isHandled = this._super(error, source);
                if (!isHandled) {
                    return this._app._onError(error, source);
                }
                return isHandled;
            },
            destroy:function () {
                if (this._isDestroyed)
                    return;
                
                this._clearContent();
                if (!!this._css) {
                    this._$el.removeClass(this._css);
                }
                this._$el.removeClass(_css.dataform);
                this._el = null;
                this._$el = null;
                this._unbindDS();
                var parentDataForm = this._parentDataForm;
                this._parentDataForm = null;
                if (!!parentDataForm && !parentDataForm._isDestroyCalled) {
                    parentDataForm.removeNSHandlers(this._objId);
                }
                this._dataContext = null;
                this._contentCreated = false;
                this._super();
            },
            toString:function () {
                return 'DataForm';
            }
        },
        {
            el:{
                get:function () {
                    return this._el;
                }
            },
            app:{
                get:function () {
                    return this._app;
                }
            },
            dataContext:{
                set:function (v) {
                    var dataContext;
                    try {
                        if (v === this._dataContext)
                            return;
                        if (!!v && !RIAPP.BaseObject.isPrototypeOf(v)) {
                            throw new Error(RIAPP.ERRS.ERR_DATAFRM_DCTX_INVALID);
                        }
                        this._unbindDS();
                        this._supportEdit = false;
                        this._collection = null;
                        this._dataContext = v;
                        dataContext = this._dataContext;
                        if (!!dataContext) {
                            this._supportEdit = utils.hasProp(dataContext, 'isEditing') && !!dataContext.beginEdit;
                            if (!!dataContext._collection)
                                this._collection = dataContext._collection;
                        }
                        this._bindDS();
                        this._updateContent();
                        this.raisePropertyChanged('dataContext');
                        if (!!dataContext) {
                            if (this._supportEdit && this._isEditing !== dataContext.isEditing) {
                                this.isEditing = dataContext.isEditing;
                            }
                            if (!!this._collection && !!dataContext.getAllErrors) {
                                this._onDSErrorsChanged(dataContext);
                            }
                        }
                    } catch (ex) {
                        global.reThrow(ex, this._onError(ex, this));
                    }
                },
                get:function () {
                    return this._dataContext;
                }
            },
            isEditing:{
                set:function (v) {
                    var dataContext = this._dataContext, isEditing = this._isEditing;
                    if (!dataContext)
                        return;
                    if (!this._supportEdit && v !== isEditing) {
                        this._isEditing = v;
                        this._updateContent();
                        this.raisePropertyChanged('isEditing');
                        return;
                    }
                    if (v !== isEditing) {
                        try {
                            if (v) {
                                dataContext.beginEdit();
                            }
                            else {
                                dataContext.endEdit();
                            }
                        }
                        catch (ex) {
                            global.reThrow(ex, this._onError(ex, dataContext));
                        }
                    }
                    if (dataContext.isEditing !== isEditing) {
                        this._isEditing = dataContext.isEditing;
                        this._updateContent();
                        this.raisePropertyChanged('isEditing');
                    }
                },
                get:function () {
                    return this._isEditing;
                }
            },
            validationErrors:{
                set:function (v) {
                    if (v !== this._errors) {
                        this._errors = v;
                        this.raisePropertyChanged('validationErrors');
                    }
                },
                get:function () {
                    return this._errors;
                }
            },
            isDisabled:{
                set:function (v) {
                    if (this._isDisabled !== v) {
                        this._isDisabled = !!v;
                        this._updateIsDisabled();
                        this.raisePropertyChanged('isDisabled');
                    }
                },
                get:function () {
                    return this._isDisabled;
                }
            }
        },
        function (obj) {
            thisModule.DataForm = obj;
        });

    var DataFormElView = BaseElView.extend({
            _init:function (options) {
                this._super(options);
                this._dataContext = null;
                this._form = null;
                this._options = options;
            },
            _getErrorTipInfo:function (errors) {
                var tip = ['<b>', ERRTEXT.errorInfo, '</b>', '<ul>'];
                errors.forEach(function (info) {
                    var fieldName = info.fieldName, res = '';
                    if (!!fieldName) {
                        res = ERRTEXT.errorField + ' ' + fieldName
                    }
                    info.errors.forEach(function (str) {
                        if (!!res)
                            res = res + ' -> ' + str;
                        else
                            res = str;
                    });
                    tip.push('<li>' + res + '</li>');
                    res = '';
                });
                tip.push('</ul>');
                return tip.join('');
            },
            _updateErrorUI:function (el, errors) {
                if (!el) {
                    return;
                }
                var $el = this.$el;
                if (!!errors && errors.length > 0) {
                    var $img, image_src = global.getImagePath('warning.png');
                    $img = global.$('<img name="error_info" alt="error_info" class="error-info" />');
                    $el.prepend($img);
                    $img.get(0).src = image_src;
                    utils.addToolTip($img, this._getErrorTipInfo(errors), _css.errorTip);
                    this._setFieldError(true);
                }
                else {
                    $el.children('img[name="error_info"]').remove();
                    this._setFieldError(false);
                }
            },
            destroy:function () {
                if (!!this._form && !this._form._isDestroyCalled) {
                    this._form.destroy();
                }
                this._form = null;
                this._dataContext = null;
                this._super();
            },
            toString:function () {
                return 'DataFormElView';
            }
        },
        {
            dataContext:{
                set:function (v) {
                    var self = this;
                    if (this._dataContext !== v) {
                        this._dataContext = v;
                        if (!this._form)
                            this._form = DataForm.create(this._el, this._options);
                        this._form.dataContext = this._dataContext;
                        this._form.addOnDestroyed(function () {
                            self._form = null;
                        });
                        this.form.addOnPropertyChange('validationErrors', function (item, args) {
                            self.validationErrors = item.validationErrors;
                        }, this._objId);
                        self.invokePropChanged('form');
                    }
                },
                get:function () {
                    return this._dataContext;
                }
            },
            form:{
                get:function () {
                    return this._form;
                }
            }
        },
        function (obj) {
            thisModule.DataFormElView = obj;
            app.registerType('DataFormElView',obj);
            app.registerElView(global.consts.ELVIEW_NM.DATAFORM, obj);
        });
};

RIAPP.Application._coreModules.elview = function (app) {
    var thisModule = this, global = app.global, utils = global.utils, baseElViewMod = app.modules.baseElView;
    var BaseElView = baseElViewMod.BaseElView,  EditableElView = baseElViewMod.EditableElView,
        CommandElView = baseElViewMod.CommandElView, _css = baseElViewMod.css;

    thisModule.BaseElView = BaseElView;
    thisModule.EditableElView = EditableElView;
    thisModule.CommandElView = CommandElView;

    var DebuggerElView = BaseElView.extend({
            _init:function (options) {
                this._super(options);
                this._someProp = null;
            }
        },
        {
            someProp:{
                set:function (v) {
                    if (v !== this._someProp) {
                        debugger;
                        this._someProp = v;
                        this.raisePropertyChanged('someProp');
                        this.$el.html(''+this._someProp);
                    }
                },
                get:function () {
                    return this._someProp;
                }
            }
        },
        function (obj) {
            thisModule.DebuggerElView = obj;
            app.registerType('DebuggerElView',obj);
            app.registerElView('debugger', obj);
        });

    var TextBoxElView = EditableElView.extend({
            _init:function (options) {
                var self = this;
                this._super(options);
                var $el = this.$el;
                $el.on('change.' + this._objId, function (e) {
                    e.stopPropagation();
                    self.raisePropertyChanged('value');
                });
                $el.on('keypress.' + this._objId, function (e) {
                    e.stopPropagation();
                    var args = {keyCode:e.which, value:e.target.value, isCancel:false};
                    self.raiseEvent('keypress', args);
                    if (args.isCancel)
                        e.preventDefault();
                });
                if (!!options.updateOnKeyUp) {
                    $el.on('keyup.' + this._objId, function (e) {
                        e.stopPropagation();
                        self.raisePropertyChanged('value');
                    });
                }
            },
            _getEventNames:function () {
                var base_events = this._super();
                return ['keypress'].concat(base_events);
            },
            toString:function () {
                return 'TextBoxElView';
            }
        },
        {
            value:{
                set:function (v) {
                    if (!this._el)
                        return;
                    var el = this._el;
                    var x = el.value;
                    var str = '' + v;
                    v = (v === null) ? '' : str;
                    if (x !== v) {
                        el.value = v;
                        this.raisePropertyChanged('value');
                    }
                },
                get:function () {
                    var el = this._el;
                    if (!el)
                        return '';
                    return el.value;
                }
            }
        },
        function (obj) {
            thisModule.TextBoxElView = obj;
            app.registerType('TextBoxElView',obj);
            app.registerElView('input:text', obj);
        });

    var HiddenElView = BaseElView.extend({
            toString:function () {
                return 'HiddenElView';
            }
        },
        {
            value:{
                set:function (v) {
                    if (!this._el)
                        return;
                    var el = this._el;
                    var x = el.value;
                    var str = '' + v;
                    v = (v === null) ? '' : str;
                    if (x !== v) {
                        el.value = v;
                        this.raisePropertyChanged('value');
                    }
                },
                get:function () {
                    var el = this._el;
                    if (!el)
                        return '';
                    return el.value;
                }
            }
        },
        function (obj) {
            thisModule.HiddenElView = obj;
            app.registerType('HiddenElView',obj);
            app.registerElView('input:hidden', obj);
        });

    var TextAreaElView = TextBoxElView.extend({
            _init:function (options) {
                this._super(options);
                if (!!options.rows) {
                    this.rows = options.rows;
                }
                if (!!options.cols) {
                    this.cols = options.cols;
                }
                if (!!options.wrap) {
                    this.wrap = options.wrap;
                }
            },
            toString:function () {
                return 'TextAreaElView';
            }
        },
        {
            rows:{
                set:function (v) {
                    var el = this._el;
                    if (!el)
                        return;
                    var x = el.rows;
                    v = (!v) ? 1 : v;
                    if (x !== v) {
                        el.rows = v;
                        this.raisePropertyChanged('rows');
                    }
                },
                get:function () {
                    var el = this._el;
                    if (!el)
                        return 1;
                    return el.rows;
                }
            },
            cols:{
                set:function (v) {
                    var el = this._el;
                    if (!el)
                        return;
                    var x = el.cols;
                    v = (!v) ? 1 : v;
                    if (x !== v) {
                        el.cols = v;
                        this.raisePropertyChanged('cols');
                    }
                },
                get:function () {
                    var el = this._el;
                    if (!el)
                        return 1;
                    return el.cols;
                }
            },
            wrap:{
                set:function (v) {
                    var el = this._el;
                    if (!el)
                        return;
                    var x = el.wrap, wraps = ['hard', 'off', 'soft'];
                    v = (!v) ? 'off' : v;
                    if (wraps.indexOf(v) < 0)
                        v = 'off';
                    if (x !== v) {
                        el.wrap = v;
                        this.raisePropertyChanged('wrap');
                    }
                },
                get:function () {
                    var el = this._el;
                    if (!el)
                        return 'off';
                    return el.wrap;
                }
            }
        },
        function (obj) {
            thisModule.TextAreaElView = obj;
            app.registerType('TextAreaElView',obj);
            app.registerElView('textarea', obj);
        });

    var CheckBoxElView = EditableElView.extend({
            _init:function (options) {
                var self = this;
                this._super(options);
                this._val = this.el.checked;
                this.$el.on('change.' + this._objId, function (e) {
                    e.stopPropagation();
                    self.checked = this.checked;
                });
            },
            _setFieldError:function (isError) {
                var $el = this.$el;
                if (isError) {
                    var span = global.$('<div></div>').addClass(_css.fieldError);
                    $el.wrap(span);
                }
                else {
                    if ($el.parent('.' + _css.fieldError).length > 0)
                        $el.unwrap();
                }
            },
            destroy:function () {
                this.$el.off('.' + this._objId);
                this._super();
            },
            toString:function () {
                return 'CheckBoxElView';
            }
        },
        {
            checked:{
                set:function (v) {
                    var el = this._el;
                    if (v !== null)
                        v = !!v;
                    if (v !== this._val) {
                        this._val = v;
                        if (el)
                            el.checked = !!this._val;

                        if (this._val === null) {
                            this.$el.css("opacity", 0.33);
                        }
                        else
                            this.$el.css("opacity", 1.0);
                        this.raisePropertyChanged('checked');
                    }
                },
                get:function () {
                    return this._val;
                }
            }
        },
        function (obj) {
            thisModule.CheckBoxElView = obj;
            app.registerType('CheckBoxElView',obj);
            app.registerElView('input:checkbox', obj);
        });

    var RadioElView = EditableElView.extend({
            _init:function (options) {
                var self = this;
                this._super(options);
                this._val = this.el.checked;
                this.$el.on('change.' + this._objId, function (e) {
                    e.stopPropagation();
                    self.checked = this.checked;
                    self._updateGroup();
                });
            },
            _updateGroup:function () {
                var groupName = this.el.getAttribute('name');
                if (!groupName)
                    return;
                var parent = this.el.parentElement;
                if (!parent)
                    return;
                var self = this, cur = self.el;
                global.$('input[type="radio"][name="' + groupName + '"]', parent).each(function (index, el) {
                    if (cur !== this) {
                        var vw = self.app._getElView(this);
                        if (!!vw) {
                            vw.checked = this.checked;
                        }
                    }
                });
            },
            _setFieldError:function (isError) {
                var $el = this.$el;
                if (isError) {
                    var span = global.$('<div></div>').addClass(_css.fieldError);
                    $el.wrap(span);
                }
                else {
                    if ($el.parent('.' + _css.fieldError).length > 0)
                        $el.unwrap();
                }
            },
            toString:function () {
                return 'RadioElView';
            }
        },
        {
            checked:{
                set:function (v) {
                    var el = this._el;
                    if (v !== null)
                        v = !!v;
                    if (v !== this._val) {
                        this._val = v;
                        if (el)
                            el.checked = !!this._val;

                        if (this._val === null) {
                            this.$el.css("opacity", 0.33);
                        }
                        else
                            this.$el.css("opacity", 1.0);
                        this.raisePropertyChanged('checked');
                    }
                },
                get:function () {
                    return this._val;
                }
            },
            value:{
                set:function (v) {
                    var el = this._el;
                    if (!el)
                        return;
                    var strv = '' + v;
                    if (v === null)
                        strv = '';
                    if (strv !== el.value) {
                        el.value = strv;
                        this.raisePropertyChanged('value');
                    }
                },
                get:function () {
                    return this._el.value;
                }
            },
            name:{
                get:function () {
                    return this._el.name;
                }
            }
        },
        function (obj) {
            thisModule.RadioElView = obj;
            app.registerType('RadioElView',obj);
            app.registerElView('input:radio', obj);
        });

    var ButtonElView = CommandElView.extend({
            _init:function (options) {
                this._super(options);
                var self = this, $el = this.$el;

                $el.on('click.' + this._objId, function (e) {
                    self._onClick(e);
                });
            },
            _onClick:function (e) {
                this.invokeCommand();
            },
            toString:function () {
                return 'ButtonElView';
            }
        },
        {
            value:{
                set:function (v) {
                    if (!this._el)
                        return;

                    var x = this.$el.val();
                    if (v === null)
                        v = '';
                    else
                        v = '' + v;
                    if (x !== v) {
                        this.$el.val(v);
                        this.raisePropertyChanged('value');
                    }
                },
                get:function () {
                    if (!this._el)
                        return '';
                    return this.$el.val();
                }
            },
            text:{
                set:function (v) {
                    if (!this._el)
                        return;

                    var x = this.$el.text();
                    if (v === null)
                        v = '';
                    else
                        v = '' + v;
                    if (x !== v) {
                        this.$el.text(v);
                        this.raisePropertyChanged('text');
                    }
                },
                get:function () {
                    if (!this._el)
                        return '';
                    return this.$el.text();
                }
            },
            html:{
                set:function (v) {
                    if (!this._el)
                        return;

                    var x = this.$el.html();
                    if (v === null)
                        v = '';
                    else
                        v = '' + v;
                    if (x !== v) {
                        this.$el.html(v);
                        this.raisePropertyChanged('html');
                    }
                },
                get:function () {
                    if (!this._el)
                        return '';
                    return this.$el.html();
                }
            }
        },
        function (obj) {
            thisModule.ButtonElView = obj;
            app.registerType('ButtonElView',obj);
            app.registerElView('input:button', obj);
            app.registerElView('input:submit', obj);
            app.registerElView('button', obj);
        });

    var AncorButtonElView = CommandElView.extend({
            _init:function (options) {
                this._super(options);
                var self = this, $el = this.$el;
                this._imageSrc = null;
                this._image = null;
                if (!!options.imageSrc)
                    this.imageSrc = options.imageSrc;
                $el.addClass(_css.commandLink);
                $el.on('click.' + this._objId, function (e) {
                    self._onClick(e);
                });
            },
            _onClick:function (e) {
                e.preventDefault();
                this.invokeCommand();
            },
            _updateImage:function (src) {
                var $a = this.$el, $img, self = this;
                if (this._imageSrc === src)
                    return;
                this._imageSrc = src;
                if (!!this._image && !src) {
                    global.$(this._image).remove();
                    this._image = null;
                }

                if (!!src) {
                    if (!this._image) {
                        self.html = null;
                        $img = global.$(new Image()).attr('src', src).mouseenter(
                            function (e) {
                                if (self._isEnabled)
                                    global.$(this).css("opacity", 0.5);
                            }).mouseout(
                            function (e) {
                                if (self._isEnabled)
                                    global.$(this).css("opacity", 1.0);
                            }).appendTo($a);
                        this._image = $img.get(0);
                    }
                    else
                        this._image.src = src;
                }
            },
            destroy:function () {
                if (this._isDestroyed)
                    return;
                this.$el.removeClass(_css.commandLink);
                this.imageSrc = null;
                this._super();
            },
            toString:function () {
                return 'AncorButtonElView';
            }
        },
        {
            imageSrc:{
                set:function (v) {
                    if (!this._$el)
                        return;
                    var x = this._imageSrc;
                    if (x !== v) {
                        this._updateImage(v);
                        this.raisePropertyChanged('imageSrc');
                    }
                },
                get:function () {
                    return this._imageSrc;
                }
            },
            html:{
                set:function (v) {
                    if (!this._el)
                        return;

                    var x = this.$el.html();
                    if (v === null)
                        v = '';
                    else
                        v = '' + v;
                    if (x !== v) {
                        this.$el.html(v);
                        this.raisePropertyChanged('html');
                    }
                },
                get:function () {
                    if (!this._el)
                        return '';
                    return this.$el.html();
                }
            },
            text:{
                set:function (v) {
                    if (!this._el)
                        return;

                    var x = this.$el.text();
                    if (v === null)
                        v = '';
                    else
                        v = '' + v;
                    if (x !== v) {
                        this.$el.text(v);
                        this.raisePropertyChanged('text');
                    }
                },
                get:function () {
                    if (!this._el)
                        return '';
                    return this.$el.text();
                }
            },
            href:{
                set:function (v) {
                    if (!this._el)
                        return;

                    var x = this.href;
                    if (v === null)
                        v = '';
                    else
                        v = '' + v;
                    if (x !== v) {
                        this.$el.prop('href', v);
                        this.raisePropertyChanged('href');
                    }
                },
                get:function () {
                    if (!this._el)
                        return '';
                    return this.$el.prop('href');
                }
            }
        },
        function (obj) {
            thisModule.AncorButtonElView = obj;
            app.registerType('AncorButtonElView',obj);
            app.registerElView('a', obj);
            app.registerElView('abutton', obj);
        });

    var ExpanderElView = AncorButtonElView.extend({
        _init:function (options) {
            this._expandedsrc = options.expandedsrc || global.getImagePath('collapse.jpg');
            this._collapsedsrc = options.collapsedsrc || global.getImagePath('expand.jpg');
            this._isExpanded = !!options.isExpanded;
            options.imageSrc = this._isExpanded ? this._expandedsrc : this._collapsedsrc;
            this._super(options);
        },
        destroy:function () {
            if (this._isDestroyed)
                return;
            this._expandedsrc = null;
            this._collapsedsrc = null;
            this._isExpanded = false;
            this._super();
        },
        _onCommandChanged:function () {
            this._super();
            this.invokeCommand();
        },
        _onClick:function (e) {
            var self = this;
            self._isExpanded = !self._isExpanded;
            self._super(e);
        },
        invokeCommand:function () {
            var self = this;
            self.imageSrc = self._isExpanded ? self._expandedsrc : self._collapsedsrc;
            self._super();
        },
        toString:function () {
            return 'ExpanderElView';
        }
    },
        {
        isExpanded:{
            set:function (v) {
                if (this._isExpanded !== v) {
                    this._isExpanded = v;
                    this.invokeCommand();
                    this.raisePropertyChanged('isExpanded');
                }
            },
            get:function () {
                return this._isExpanded;
            }
        }
    },
        function (obj) {
        thisModule.ExpanderElView = obj;
        app.registerType('ExpanderElView',obj);
        app.registerElView('expander', obj);
    });

    var SpanElView = BaseElView.extend({
            toString:function () {
                return 'SpanElView';
            }
        },
        {
            value:{
                set:function (v) {
                    this.text = v;
                },
                get:function () {
                    return this.text;
                }
            },
            text:{
                set:function (v) {
                    var $el = this.$el, x = $el.text();
                    var str = '' + v;
                    v = v === null ? '' : str;
                    if (x !== v) {
                        $el.text(v);
                        this.raisePropertyChanged('text');
                        this.raisePropertyChanged('value');
                    }
                },
                get:function () {
                    return this.$el.text();
                }
            },
            html:{
                set:function (v) {
                    var x = this.el.innerHTML;
                    var str = '' + v;
                    v = v === null ? '' : str;
                    if (x !== v) {
                        this.el.innerHTML = v;
                        this.raisePropertyChanged('html');
                    }
                },
                get:function () {
                    return this.el.innerHTML;
                }
            },
            color:{
                set:function (v) {
                    var $el = this.$el;
                    var x = $el.css('color');
                    if (v !== x) {
                        $el.css('color', v);
                        this.raisePropertyChanged('color');
                    }
                },
                get:function () {
                    var $el = this.$el;
                    return $el.css('color');
                }
            },
            fontSize:{
                set:function (v) {
                    var $el = this.$el;
                    var x = $el.css('font-size');
                    if (v !== x) {
                        $el.css('font-size', v);
                        this.raisePropertyChanged('fontSize');
                    }
                },
                get:function () {
                    var $el = this.$el;
                    return $el.css('font-size');
                }
            }
        },
        function (obj) {
            thisModule.SpanElView = obj;
            app.registerType('SpanElView',obj);
            app.registerElView('span', obj);
        });

    var DivElView = SpanElView.extend({
            toString:function () {
                return 'DivElView';
            }
        },
        {
            borderColor:{
                set:function (v) {
                    var $el = this.$el;
                    var x = $el.css('border-top-color');
                    if (v !== x) {
                        this.el.style.borderColor = v;
                        this.raisePropertyChanged('borderColor');
                    }
                },
                get:function () {
                    var $el = this.$el;
                    return $el.css('border-top-color');
                }
            },
            borderStyle:{
                set:function (v) {
                    var $el = this.$el;
                    var x = $el.css('border-top-style');
                    if (v !== x) {
                        $el.css('border-style', v);
                        this.raisePropertyChanged('borderStyle');
                    }
                },
                get:function () {
                    var $el = this.$el;
                    return $el.css('border-top-style');
                }
            },
            width:{
                set:function (v) {
                    var $el = this.$el;
                    var x = $el.width();
                    if (v !== x) {
                        $el.width(v);
                        this.raisePropertyChanged('width');
                    }
                },
                get:function () {
                    var $el = this.$el;
                    return $el.width();
                }
            },
            height:{
                set:function (v) {
                    var $el = this.$el;
                    var x = $el.height();
                    if (v !== x) {
                        $el.height(v);
                        this.raisePropertyChanged('height');
                    }
                },
                get:function () {
                    var $el = this.$el;
                    return $el.height();
                }
            }
        },
        function (obj) {
            thisModule.DivElView = obj;
            app.registerType('DivElView',obj);
            app.registerElView('div', obj);
        });

    var ImgElView = BaseElView.extend({
            _init:function (options) {
                this._super(options);
            },
            toString:function () {
                return 'ImgElView';
            }
        },
        {
            src:{
                set:function (v) {
                    var x = this.$el.prop('src');
                    if (x !== v) {
                        this.$el.prop('src', v);
                        this.raisePropertyChanged('src');
                    }
                },
                get:function () {
                    return this.$el.prop('src');
                }
            }
        },
        function (obj) {
            thisModule.ImgElView = obj;
            app.registerType('ImgElView',obj);
            app.registerElView('img', obj);
        });


    var BusyElView = BaseElView.extend({
            _init:function (options) {
                this._super(options);
                this._loaderPath = global.getImagePath('loader.gif');
                this._$loader = global.$(new Image());
                this._$loader.css({position:"absolute", display:"none", zIndex:"10000"});
                this._$loader.attr('src', this._loaderPath);
                this._$loader.appendTo(this.el);
                this._isBusy = false;
            },
            destroy:function () {
                if (!this._$loader)
                    return;
                this._$loader.remove();
                this._$loader = null;
                this._super();
            },
            toString:function () {
                return 'BusyElView';
            }
        },
        {
            isBusy:{
                set:function (v) {
                    if (v !== this._isBusy) {
                        this._isBusy = v;
                        if (this._isBusy) {
                            this._$loader.show();
                            this._$loader.position({
                                //"my": "right top",
                                //"at": "left bottom",
                                "of":global.$(this.el)
                            });
                        }
                        else
                            this._$loader.hide();
                    }
                },
                get:function () {
                    return this._isBusy;
                }
            }
        },
        function (obj) {
            thisModule.BusyElView = obj;
            app.registerType('BusyElView',obj);
            app.registerElView('busy_indicator', obj);
        });


    var TabsElView = BaseElView.extend({
            _init:function (options) {
                this._super(options);
                this._tabsEventCommand = null;
                this._tabOpts = options;
            },
            _createTabs:function () {
                var $el = this.$el, self = this, tabOpts = {
                    select:function (e, tab) {
                        self.invokeTabsEvent("select", tab);
                    },
                    show:function (e, tab) {
                        self.invokeTabsEvent("show", tab);
                    },
                    disable:function (e, tab) {
                        self.invokeTabsEvent("disable", tab);
                    },
                    enable:function (e, tab) {
                        self.invokeTabsEvent("enable", tab);
                    },
                    add:function (e, tab) {
                        self.invokeTabsEvent("add", tab);
                    },
                    remove:function (e, tab) {
                        self.invokeTabsEvent("remove", tab);
                    },
                    load:function (e, tab) {
                        self.invokeTabsEvent("load", tab);
                    }
                };
                tabOpts = utils.extend(false, tabOpts, self._tabOpts);
                $el.tabs(tabOpts);
            },
            _destroyTabs:function () {
                var $el = this.$el;
                utils.destroyJQueryPlugin($el,'tabs');
            },
            invokeTabsEvent:function (eventName, args) {
                var self = this, data = {eventName:eventName, args:args};
                if (!!self._tabsEventCommand) {
                    self._tabsEventCommand.execute(self, data);
                }
            },
            destroy:function () {
                if (this._isDestroyed)
                    return;
                this._tabsEventCommand = null;
                this._destroyTabs();
                this._super();
            },
            toString:function () {
                return 'TabsElView';
            }
        },
        {
            tabsEventCommand:{
                set:function (v) {
                    var old = this._tabsEventCommand;
                    if (v !== old) {
                        if (!!old) {
                            this._destroyTabs();
                        }
                        this._tabsEventCommand = v;
                        if (!!this._tabsEventCommand)
                            this._createTabs();
                    }
                },
                get:function () {
                    return this._tabsEventCommand;
                }
            }
        },
        function (obj) {
            thisModule.TabsElView = obj;
            app.registerType('TabsElView',obj);
            app.registerElView('tabs', obj);
        });
};

RIAPP.Application._coreModules.content = function (app) {
    var thisModule = this, global = app.global, utils = global.utils;
    var Binding = app.modules.binding.Binding,
        baseContentMod = app.modules.baseContent, elviewMod = app.modules.elview,
        DATA_TYPE = global.consts.DATA_TYPE, KEYS = global.consts.KEYS;

    var BindingContent = baseContentMod.BindingContent;

    var DateContent = BindingContent.extend({
        _create:function (parentEl, options, dctx) {
            this._super(parentEl, options, dctx);
            this._fn_cleanup = null;
        },
        _getBindingOption:function (bindingInfo, tgt, dctx, targetPath) {
            var options = this._super(bindingInfo, tgt, dctx, targetPath);
            options.converter = app.getConverter('dateConverter');
            options.converterParam = global.defaults.dateFormat;
            return options;
        },
        _createTargetElement:function () {
            var el = this._super();
            if (this.isEditing) {
                var $el = global.$(el);
                $el.datepicker();
                this._fn_cleanup = function () {
                    utils.destroyJQueryPlugin($el,'datepicker');
                };
            }
            return el;
        },
        _cleanUp:function () {
            if (!!this._fn_cleanup) {
                this._fn_cleanup();
                this._fn_cleanup = null;
            }
            this._super();
        },
        toString:function () {
            return 'DateContent';
        }
    }, null, function (obj) {
        thisModule.DateContent = obj;
    });

    var BoolContent = BindingContent.extend({
        _init:function () {
            this._createTargetElement();
            var bindingInfo = this._getBindingInfo();
            if (!!bindingInfo) {
                this._updateCss();
                this._lfScope = global.utils.LifeTimeScope.create();
                var options = this._getBindingOption(bindingInfo, this._tgt, this._dctx, 'checked');
                options.mode = 'TwoWay';
                this._lfScope.addObj(this._app.bind(options));
            }
        },
        _createCheckBoxView:function () {
            var el = global.document.createElement('input');
            el.setAttribute('type', 'checkbox');
            var CheckBoxElView = this._app.modules.elview.CheckBoxElView;
            var chbxView = CheckBoxElView.create(el, {});
            return chbxView;
        },
        _createTargetElement:function () {
            if (!this._tgt) {
                this._tgt = this._createCheckBoxView();
                this._el = this._tgt.el;
            }
            this._parentEl.appendChild(this._el);
        },
        _updateCss:function () {
            this._super();
            if (this._isEditing && this._canBeEdited()) {
                if (this._el.hasAttribute('disabled'))
                    this._el.removeAttribute('disabled');
            }
            else {
                if (!this._el.hasAttribute('disabled'))
                    this._el.setAttribute('disabled', 'disabled');
            }
        },
        destroy:function () {
            if (this._isDestroyed)
                return;
            if (!!this._lfScope) {
                this._lfScope.destroy();
                this._lfScope = null;
            }
            if (!!this._tgt) {
                this._tgt.destroy();
                this._tgt = null;
            }
            this._super();
        },
        _cleanUp:function () {
        },
        update:function () {
            this._cleanUp();
            this._updateCss();
        },
        toString:function () {
            return 'BoolContent';
        }
    }, null, function (obj) {
        thisModule.BoolContent = obj;
    });

    var RowSelectContent = BoolContent.extend({
        _canBeEdited:function () {
            return true;
        },
        toString:function () {
            return 'RowSelectContent';
        }
    }, null, function (obj) {
        thisModule.RowSelectContent = obj;
    });

    var DateTimeContent = BindingContent.extend({
        _getBindingOption:function (bindingInfo, tgt, dctx, targetPath) {
            var options = this._super(bindingInfo, tgt, dctx, targetPath);
            options.converter = app.getConverter('dateTimeConverter');
            var finf = this.getFieldInfo(), defaults = global.defaults;
            switch (finf.dataType) {
                case DATA_TYPE.DateTime:
                    options.converterParam = defaults.dateTimeFormat;
                    break;
                case DATA_TYPE.Time:
                    options.converterParam = defaults.timeFormat;
                    break;
                default:
                    options.converterParam = defaults.dateTimeFormat;
                    break;
            }
            return options;
        },
        toString:function () {
            return 'DateTimeContent';
        }
    }, null, function (obj) {
        thisModule.DateTimeContent = obj;
    });

    var NumberContent = BindingContent.extend({
        _allowedKeys:[0, KEYS.backspace, KEYS.del, KEYS.left, KEYS.right, KEYS.end,
            KEYS.home, KEYS.tab, KEYS.esc, KEYS.enter],
        _getBindingOption:function (bindingInfo, tgt, dctx, targetPath) {
            var options = this._super(bindingInfo, tgt, dctx, targetPath);
            var finf = this.getFieldInfo();
            switch (finf.dataType) {
                case DATA_TYPE.Integer:
                    options.converter = app.getConverter('integerConverter');
                    break;
                case DATA_TYPE.Decimal:
                    options.converter = app.getConverter('decimalConverter');
                    break;
                default:
                    options.converter = app.getConverter('floatConverter');
                    break;
            }
            return options;
        },
        update:function () {
            this._super();
            var self = this;
            if (elviewMod.TextBoxElView.isPrototypeOf(self._tgt)) {
                self._tgt.addHandler('keypress', function (sender, args) {
                    args.isCancel = !self._previewKeyPress(args.keyCode, args.value);
                });
            }
        },
        _previewKeyPress:function (keyCode, value) {
            if (this._allowedKeys.indexOf(keyCode) > -1)
                return true;
            if (keyCode === 47) // backslash
            {
                return false;
            }
            var keys = {32:' ', 44:',', 46:'.'};
            var ch = keys[keyCode];
            var defaults = global.defaults;
            if (ch === defaults.decimalPoint) {
                if (value.length === 0)
                    return false;
                else return value.indexOf(ch) < 0;
            }
            if (!!ch && ch !== defaults.thousandSep)
                return false;
            return !(!ch && (keyCode < 45 || keyCode > 57));
        },
        toString:function () {
            return 'NumberContent';
        }
    }, null, function (obj) {
        thisModule.NumberContent = obj;
    });

    var StringContent = BindingContent.extend({
        _allowedKeys:[0, KEYS.backspace, KEYS.del, KEYS.left, KEYS.right, KEYS.end,
            KEYS.home, KEYS.tab, KEYS.esc, KEYS.enter],
        update:function () {
            this._super();
            var self = this, fieldInfo = self.getFieldInfo();

            if (elviewMod.TextBoxElView.isPrototypeOf(self._tgt)) {
                self._tgt.addHandler('keypress', function (sender, args) {
                    args.isCancel = !self._previewKeyPress(fieldInfo, args.keyCode, args.value);
                });
            }
        },
        _previewKeyPress:function (fieldInfo, keyCode, value) {
            return !(fieldInfo.maxLength > 0 && value.length >= fieldInfo.maxLength && this._allowedKeys.indexOf(keyCode) === -1);
        },
        toString:function () {
            return 'StringContent';
        }
    }, null, function (obj) {
        thisModule.StringContent = obj;
    });

    var MultyLineContent = BindingContent.extend({
        _allowedKeys:[0, KEYS.backspace, KEYS.del, KEYS.left, KEYS.right, KEYS.end,
            KEYS.home, KEYS.tab, KEYS.esc, KEYS.enter],
        update:function () {
            this._super();
            var self = this, fieldInfo = self.getFieldInfo();

            if (elviewMod.TextAreaElView.isPrototypeOf(self._tgt)) {
                self._tgt.addHandler('keypress', function (sender, args) {
                    args.isCancel = !self._previewKeyPress(fieldInfo, args.keyCode, args.value);
                });
                var multylnOpt = this._options.multyline;
                if (!!multylnOpt) {
                    if (!!multylnOpt.rows) {
                        self._tgt.rows = multylnOpt.rows;
                    }
                    if (!!multylnOpt.cols) {
                        self._tgt.cols = multylnOpt.cols;
                    }
                    if (!!multylnOpt.wrap) {
                        self._tgt.wrap = multylnOpt.wrap;
                    }
                }
            }
        },
        _createTargetElement:function () {
            var tgt;
            if (this._isEditing && this._canBeEdited()) {
                tgt = global.document.createElement('textarea');
            }
            else {
                tgt = global.document.createElement('div');
            }
            this._updateCss();
            return tgt;
        },
        _previewKeyPress:function (fieldInfo, keyCode, value) {
            return !(fieldInfo.maxLength > 0 && value.length >= fieldInfo.maxLength && this._allowedKeys.indexOf(keyCode) === -1);
        },
        toString:function () {
            return 'MultyLineContent';
        }
    }, null, function (obj) {
        thisModule.MultyLineContent = obj;
    });

    var LookupContent = BindingContent.extend({
            _init:function () {
                this._super();
                this._spanView = null;
                this._valBinding = null;
                this._listBox = null;
                this._isListBoxCachedExternally = false;
                this._valBinding = null;
                this._listBinding = null;
            },
            _getEventNames:function () {
                var base_events = this._super();
                return ['listbox_created', 'need_listbox'].concat(base_events);
            },
            _getListBox:function () {
                if (!!this._listBox)
                    return this._listBox;
                var lookUpOptions = this._options.lookup;
                var args = {listBox:null, dataSource:lookUpOptions.dataSource};
                //try get externally externally cached listBox
                this.raiseEvent('need_listbox', args);
                if (!!args.listBox) {
                    this._isListBoxCachedExternally = true;
                    return args.listBox;
                }
                //else proceed creating new listbox
                var app = this._app, dataSource = app.parser.resolvePath(app, lookUpOptions.dataSource),
                    options = {valuePath:lookUpOptions.valuePath, textPath:lookUpOptions.textPath};
                var el = global.document.createElement('select');
                el.setAttribute('size', '1');
                var listBox = this._getListBoxElView(el, options);
                listBox.dataSource = dataSource;
                args = {listBox:listBox, dataSource:lookUpOptions.dataSource, isCachedExternally:false};
                //this allows to cache listBox externally
                this.raiseEvent('listbox_created', args);
                this._isListBoxCachedExternally = args.isCachedExternally;
                return listBox;
            },
            _getListBoxElView:function (el, options) {
                var elView;

                elView = this.app._getElView(el);
                if (!!elView) //view already created for this element
                    return elView;
                elView = this.app.getType('SelectElView').create(el, options || {});
                return elView;
            },
            _updateTextValue:function () {
                var self = this;
                if (!!self._spanView)
                    self._spanView.value = self._getLookupText();
            },
            _getLookupText:function () {
                var listBoxView = this._getListBox();
                return listBoxView.listBox.getTextByValue(this.value);
            },
            _createSpanView:function () {
                var el = global.document.createElement('span'), displayInfo = this._getDisplayInfo();

                var SpanElView = elviewMod.SpanElView;
                var spanView = SpanElView.create(el, {});
                if (!!displayInfo) {
                    if (!!displayInfo.displayCss) {
                        spanView.$el.addClass(displayInfo.displayCss);
                    }
                }
                return spanView;
            },
            update:function () {
                this._cleanUp();
                this._el = this._createTargetElement();
                this._parentEl.appendChild(this._el);
            },
            _createTargetElement:function () {
                var el;
                if (this._isEditing && this._canBeEdited()) {
                    if (!this._listBox) {
                        this._listBox = this._getListBox();
                    }
                    this._listBinding = this._bindToList();
                    el = this._listBox.el;
                }
                else {
                    if (!this._spanView) {
                        this._spanView = this._createSpanView();
                    }
                    this._valBinding = this._bindToValue();
                    el = this._spanView.el;
                }
                this._updateCss();
                return el;
            },
            _cleanUp:function () {
                if (!!this._el) {
                    global.$(this._el).remove();
                    this._el = null;
                }
                if (!!this._listBinding) {
                    this._listBinding.destroy();
                    this._listBinding = null;
                }
                if (!!this._valBinding) {
                    this._valBinding.destroy();
                    this._valBinding = null;
                }

                if (!!this._listBox && this._isListBoxCachedExternally) {
                    this._listBox = null;
                }
            },
            _updateBindingSource:function () {
                if (!!this._valBinding) {
                    this._valBinding.source = this._dctx;
                }
                if (!!this._listBinding) {
                    this._listBinding.source = this._dctx;
                }
            },
            _bindToValue:function () {
                if (!this._options.fieldName)
                    return null;

                var options = { target:this, source:this._dctx,
                    targetPath:'value', sourcePath:this._options.fieldName, mode:"OneWay",
                    converter:null, converterParam:null, isSourceFixed:false
                };
                return Binding.create(options);
            },
            _bindToList:function () {
                if (!this._options.fieldName)
                    return null;

                var options = { target:this._getListBox(), source:this._dctx,
                    targetPath:'selectedValue', sourcePath:this._options.fieldName, mode:"TwoWay",
                    converter:null, converterParam:null, isSourceFixed:false
                };
                return Binding.create(options);
            },
            destroy:function () {
                if (this._isDestroyed)
                    return;
                this._cleanUp();
                if (!!this._listBox && !this._isListBoxCachedExternally) {
                    this._listBox.destroy();
                }
                this._listBox = null;
                if (!!this._spanView) {
                    this._spanView.destroy();
                }
                this._spanView = null;
                this._super();
            },
            toString:function () {
                return 'LookupContent';
            }
        },
        {
            value:{
                set:function (v) {
                    if (this._value !== v) {
                        this._value = v;
                        this._updateTextValue();
                        this.raisePropertyChanged('value');
                    }
                },
                get:function () {
                    return this._value;
                }
            }
        }
        ,function (obj) {
            thisModule.LookupContent = obj;
        });

    thisModule.BindingContentFactory = RIAPP.BaseObject.extend({
        _app:app,
        getContentType:function (options) {
            var fieldInfo = options.fieldInfo, res;
            if (!!options.lookup) {
                return LookupContent;
            }

            switch (fieldInfo.dataType) {
                case DATA_TYPE.None:
                    res = BindingContent;
                    break;
                case DATA_TYPE.String:
                    if (!options.multyline)
                        res = StringContent;
                    else
                        res = MultyLineContent;
                    break;
                case DATA_TYPE.Bool:
                    res = BoolContent;
                    break;
                case DATA_TYPE.Integer:
                    res = NumberContent;
                    break;
                case DATA_TYPE.Decimal:
                case DATA_TYPE.Float:
                    res = NumberContent;
                    break;
                case DATA_TYPE.DateTime:
                case DATA_TYPE.Time:
                    res = DateTimeContent;
                    break;
                case DATA_TYPE.Date:
                    res = DateContent;
                    break;
                case DATA_TYPE.Guid:
                case DATA_TYPE.Binary:
                    res = BindingContent;
                    break;
                default:
                    throw new Error(RIAPP.utils.format(RIAPP.ERRS.ERR_FIELD_DATATYPE, fieldInfo.dataType));
            }
            return res;
        },
        createContent:function (parentEl, options, dctx, isEditing) {
            var contentType = this.getContentType(options);
            return contentType.create(parentEl, options, dctx, isEditing);
        },
        toString:function () {
            return 'Default BindingContentFactory';
        }
    }, null, null);

    app.bindingContentFactory = thisModule.BindingContentFactory;
};