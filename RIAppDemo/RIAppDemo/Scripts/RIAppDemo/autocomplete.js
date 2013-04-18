'use strict';
RIAPP.Application.registerModule('autocompleteModule', function (app) {
    var global = app.global, utils = global.utils, consts = global.consts;
    var TEXT = RIAPP.localizable.TEXT;
    //private helper function (used inside this module only)
    var addTextQuery = function(query, fldName, val){
        var tmp;
        if (!!val){
            if (utils.str.startsWith(val,'%') && utils.str.endsWith(val,'%')){
                tmp = utils.str.trim(val,'% ');
                query.where(fldName, 'contains', [tmp])
            }
            else if (utils.str.startsWith(val,'%')){
                tmp = utils.str.trim(val,'% ');
                query.where(fldName, 'endswith', [tmp])
            }
            else if (utils.str.endsWith(val,'%')){
                tmp = utils.str.trim(val,'% ');
                query.where(fldName, 'startswith', [tmp])
            }
            else {
                tmp = utils.str.trim(val);
                query.where(fldName, '=', [tmp])
            }
        }
        return query;
    };

    var AutoCompleteElView = app.getType('EditableElView').extend({
            _init:function (options) {
                var self = this;
                //debugger;
                this._super(options);
                this._templateId = options.templateId;
                this._fieldName = options.fieldName;
                this._dbSetName = options.dbSetName;
                this._queryName = options.queryName;
                this._template = null;
                this._dbSet = null;
                this._value = null;
                this._prevText= null;
                this._selectedItem = null;
                this._template = null;
                this._$template = null;
                this._loadTimeout = null;
                this._dataContext = null;
                this._isLoading = false;
                this._$dlg= null;
                var $el = this.$el;

                $el.on('change.' + this._objId, function (e) {
                    e.stopPropagation();
                    self.raisePropertyChanged('value');
                });
                $el.on('keyup.' + this._objId, function (e) {
                    e.stopPropagation();
                    self._onTextChange(e.target.value);
                });
                $el.on('keypress.' + this._objId, function (e) {
                    e.stopPropagation();
                    self._onKeyPress(e.which);
                });

                this._isOpen = false;
                this._createDbSet();
                this._template = this._createTemplate();
                this._$template = global.$(this._template.el);
                this._lookupGrid = null;
                var gridElView = this._findElemViewInTemplate('lookupGrid');
                if (!!gridElView){
                    this._lookupGrid = gridElView.grid;
                }
                this._btnOk = this._findElemInTemplate('btnOk');
                this._btnCancel = this._findElemInTemplate('btnCancel');
                global.$(this._btnOk).click(function(){
                    self._updateSelection();
                    self._hide();
                });
                global.$(this._btnCancel).click(function(){
                    self._hide();
                });
                global.document.body.appendChild(this._template.el);
            },
            _findElemViewInTemplate: function(name){
                //look by data-name attribute value
                var arr = this._template.findElViewsByDataName(name);
                if (!!arr && arr.length>0)
                    return arr[0];
                else
                    return null;
            },
            _findElemInTemplate: function(name){
                var arr = this._template.findElByDataName(name);
                if (!!arr && arr.length>0)
                    return arr[0];
                else
                    return null;
            },
            _createDbSet: function(){
                this._dbSet = this.app.dbContext.dbSets[this._dbSetName];
                if (!this._dbSet){
                    throw new Error(String.format('dbContext does not contain dbSet with the name: {0}',this._dbSetName))
                }
            },
            _getEventNames:function () {
                var base_events = this._super();
                return ['hide','show'].concat(base_events);
            },
            _createTemplate:function () {
                var T = this.app.getType('Template'), t = T.create(this._templateId);
                t.dataContext = this;
                return t;
            },
            _onTextChange: function(text){
                var self = this;
                clearTimeout(this._loadTimeout);
                if (!!text && text.length>1){
                    this._loadTimeout = setTimeout(function(){
                        if (self._isDestroyCalled)
                            return;

                        if (self._prevText != text){
                            self._prevText = text;
                            if (!self._isOpen)
                                self._open();
                            self.load(text);
                        }
                    },500);
                }
            },
            _onKeyPress: function(keyCode){
                if (keyCode === consts.KEYS.esc){
                    this._hide();
                    return;
                }
                if (keyCode === consts.KEYS.enter){
                    this._updateSelection();
                    this._hide();
                    return;
                }
            },
            _updateSelection: function(){
                this.value = this.currentSelection;
            },
            _updatePosition: function(){
                this._$template.position({
                    my: "left top",
                    at: "left bottom",
                    of: global.$(this.el),
                    offset: "0 0"
                });
            },
            _onShow: function(){
                this.raiseEvent('show',{});
            },
            _onHide: function(){
              this.raiseEvent('hide',{});
            },
            _open: function() {
                if (this._isOpen)
                    return;
                var self = this;

                this._$dlg = this.$el.closest(".ui-dialog");
                this._$dlg.on( "dialogdrag." + this._objId, function( event, ui ) {
                    if (!self._isOpen)
                        return;
                    self._updatePosition();
                });

                this._updatePosition();
                this._$template.css({visibility: "visible", display: "none"});
                this._$template.slideDown('medium');

                if (!!this._lookupGrid){
                    this._lookupGrid.addHandler('cell_dblclicked',function(s,a){
                        self._updateSelection();
                        self._hide();
                    }, this._objId);

                    global.$(global.document).on('keyup.' + this._objId, function (e) {
                        e.stopPropagation();
                        if (global.currentSelectable === self._lookupGrid)
                            self._onKeyPress(e.which);
                    });
                }
                this._isOpen = true;
                this._onShow();
            },
            _hide: function(){
                var self = this;
                if (!this._isOpen)
                    return;
                global.$(global.document).off('.' + this._objId);
                this._$dlg.off('.' + this._objId);

                if (!!this._lookupGrid){
                    this._lookupGrid.removeNSHandlers(this._objId);
                }

                this._$template.slideUp('medium', function(){
                    if (self._isDestroyCalled)
                        return;
                    self._$template.css({visibility: "hidden", display: ""});
                });
                this._isOpen = false;
                this._onHide();
            },
            load: function(str){
                var self = this, query = this.dbSet.createQuery(this._queryName);
                query.pageSize = 50;
                query.isClearPrevData = true;
                addTextQuery(query,this._fieldName,str+'%');
                query.orderBy(this._fieldName, 'ASC');
                this._isLoading = true;
                this.raisePropertyChanged('isLoading');
                this.app.dbContext.load(query).always(function(){
                    self._isLoading = false;
                    self.raisePropertyChanged('isLoading');
                });
            },
            destroy:function () {
                if (this._isDestroyed)
                    return;
                this._hide();
                this.$el.off('.' + this._objId);
                if (!! this._lookupGrid){
                    this._lookupGrid = null;
                }
                if (!!this._template){
                    this._template.destroy();
                    this._template = null;
                    this._$template = null;
                }
                this._dbSet = null;
                this._dataContext = null;
                this._super();
            }
        },
        {   //field name for lookup in dbSet
            fieldName:{
                get:function () {
                    return this._fieldName;
                }
            },
            templateId:{
                get:function () {
                    return this._templateId;
                }
            },
            currentSelection:{
                get:function () {
                    if (this._dbSet.currentItem)
                        return this._dbSet.currentItem[this._fieldName];
                    else
                        return null;
                }
            },
            //template instance of drop down area (which contains grid) under textbox
            template:{
                get:function () {
                    return this._template;
                }
            },
            //Entity (args item) which is bound to the textbox
            dataContext:{
                set:function (v) {
                    if (this._dataContext !== v){
                        this._dataContext = v;
                        this.raisePropertyChanged('dataContext');
                    }
                },
                get:function () {
                    return this._dataContext;
                }
            },
            //dbSet for grid's dataSource (for lookup values)
            dbSet:{
                get:function () {
                    return this._dbSet;
                }
            },
            //current value of the textbox
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
                        this._prevText = v;
                        this.raisePropertyChanged('value');
                    }
                },
                get:function () {
                    var el = this._el;
                    if (!el)
                        return '';
                    return el.value;
                }
            },
            isLoading:{
                get:function () {
                    return this._isLoading;
                }
            }
        }, function (obj) {
            app.registerType('AutoCompleteElView', obj);
            app.registerElView('autocomplete', obj);
        });

});
