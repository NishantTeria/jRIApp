RIAPP.Application.registerModule('browserDemoMod', function (app) {
    var global = app.global, utils = global.utils, consts = global.consts;
    var TEXT = RIAPP.localizable.TEXT;

    var FolderBrowser = RIAPP.BaseObject.extend({
             service_url:null, //static
             metadata: null, //static
            _create: function (options) {
                this._super();
                var self = this;
                self._includeFiles= options.includeFiles;
                self._$tree = options.$tree;
                self._dbContext = app.getType('DbContext').create();
                self._dbContext.addHandler('define_calc',function(s,args){
                    if (args.dbSetName == 'FoldersDB' && args.fieldName == 'fullPath') {
                        args.getFunc = function () {
                            return self.getFullPath(this);
                        };
                    }
                });
                self._dbContext.initialize({
                    serviceUrl:self.service_url,
                    metadata:self.metadata
                });
                this._assoc = self.dbContext.getAssociation('FolderToParent');

                self._foldersDb = this.dbContext.dbSets.FoldersDB;
                self._loadRootCommand = app.getType('Command').create(function (s, a) {
                        self.loadRootFolder();
                    }, self,
                    function (s, a) {
                        //if this function return false, then command is disabled
                        return true;
                    });
                this._createDynaTree();
            },
            //here we added custom event
            _getEventNames:function () {
                var base_events = this._super();
                return ['node_selected'].concat(base_events);
            },
            _createDynaTree: function(){
                var self = this;
                this._$tree.dynatree({
                    onActivate: function(node) {
                        self.raiseEvent('node_selected',{item:node.data.item});
                    },
                    onClick: function(node, event) {
                    },
                    onDblClick: function(node, event) {
                    },
                    onExpand: function(flag, node) {
                        if (!flag){
                            node.visit(function(child){
                                var item = child.data.item;
                                if (!item)
                                    return;
                                item.deleteItem();
                            }, false);

                            node.removeChildren(); //remove all child nodes when node collapsed
                            self._dbContext.acceptChanges();
                        }
                    },
                    onLazyRead: function(node){
                        self.loadChildren(node.data.item).done(function(){
                            self._addItemsToNode(node,node.data.item.Children);
                            node.setLazyNodeStatus(DTNodeStatus_Ok);
                        });
                    }
                });
                this._$treeRoot = this._$tree.dynatree("getRoot");
            },
            _addItemsToNode: function(node, items){
                var arr = items.map(function(item){
                    return {title:item.Name, isLazy:item.HasSubDirs, isFolder: item.IsFolder, item: item};
                });
                node.removeChildren();
                node.addChild(arr);
            },
            _addItemsToTree: function(items){
                this._addItemsToNode(this._$treeRoot,items);
            },
            _onLoaded: function(fetchedItems){
                var self = this;
                var topLevel = fetchedItems.filter(function(item){
                    return item.Level == 0;
                });
                if (topLevel.length > 0){
                    self._addItemsToTree(topLevel);
                }
            },
            _getFullPath: function(item, path){
                var self = this, part;
                if (utils.check_is.nt(path))
                    path='';
                if (!path)
                    part='';
                else
                    part = '\\' + path;
                var parent = this._assoc.getParentItem(item);
                if (!parent)
                {
                    return item.Name + part;
                }
                else
                {
                    return self._getFullPath(parent, item.Name + part);
                }
            },
            loadRootFolder: function(){
                var self = this, query = self._foldersDb.createQuery('ReadRoot');
                query.isClearPrevData = true;
                query.params = { includeFiles: self._includeFiles  };
                var promise = self.dbContext.load(query);
                promise.done(function(res){
                    self._onLoaded(res.fetchedItems);
                });
                return promise;
            },
            loadChildren: function(item){
                var self = this, query = self._foldersDb.createQuery('ReadChildren');
                query.isClearPrevData = false;
                query.params = { parentKey: item.Key, level:item.Level+1, path:item.fullPath, includeFiles: self._includeFiles  };
                var promise = self.dbContext.load(query);
                promise.done(function(res){
                    self._onLoaded(res.fetchedItems);
                });
                return promise;
            },
            getFullPath: function(item){
                return this._getFullPath(item,null);
            },
            destroy:function () {
                if (this._isDestroyed)
                    return;
                var self = this;
                this._isDestroying = true;
                if (!!this._dbContext){
                    this._dbContext.destroy();
                }
                if (!!this._$treeRoot)
                    this._$treeRoot.removeChildren();
                self._super();
            }
        },
        {
            dbContext: {
                get: function () {
                    return this._dbContext;
                }
            },
            loadRootCommand:{
                get:function () {
                    return this._loadRootCommand;
                }
            }
        }, function (obj) {
            app.registerType('custom.FolderBrowser', obj);
        });

    var fn_getTemplateElement = function(template, name){
        var t = template;
        var els = t.findElByDataName(name);
        if (els.length < 1)
            return null;
        return els[0];
    };

    var FolderBrowserVM = app.getType('BaseViewModel').extend({
            _create: function (includeFiles) {
                this._super();
                var self = this;
                this._selectedItem = null;
                //we defined this custom type in common.js
                this._dialogVM = app.getType('custom.DialogVM').create();
                this._folderBrowser= null;
                this._includeFiles = includeFiles;


                var dialogOptions = {
                    templateID:'treeTemplate',
                    width: 650,
                    height: 700,
                    title:self.includeFiles?'File Browser':'Folder Browser',
                    fn_OnTemplateCreated: function(template){
                        var dialog = this, $ = global.$; //executed in the context of the dialog
                        var $tree =global.$(fn_getTemplateElement(template, 'tree'));
                        self._folderBrowser = FolderBrowser.create({$tree:$tree, includeFiles:self.includeFiles});
                        self._folderBrowser.addHandler('node_selected', function(s,a){
                           self.selectedItem = a.item;
                        },self.uniqueID)
                    },
                    fn_OnShow: function(dialog){
                        self.selectedItem = null;
                        self._folderBrowser.loadRootFolder();
                    },
                    fn_OnClose: function(dialog){
                        if (dialog.result == 'ok' && !!self._selectedItem){
                            self._onSelected(self._selectedItem, self._selectedItem.fullPath);
                        }
                    }
                };
                this._dialogVM.createDialog('folderBrowser',dialogOptions);

                this._dialogCommand = app.getType('Command').create(function (sender, param) {
                    try {
                        self._dialogVM.showDialog('folderBrowser',self);
                    } catch (ex) {
                        self._onError(ex, this);
                    }
                }, self,  function (sender, param) {
                    return true;
                });
            },
            _onSelected:function (item, fullPath) {
                   alert("selected: " + fullPath);
            },
            destroy:function () {
                if (this._isDestroyed)
                    return;
                var self = this;
                this._isDestroying = true;
                if (!!self._folderBrowser){
                    self._folderBrowser.destroy();
                    self._folderBrowser = null;
                }
                if (!!self._dialogVM){
                    self._dialogVM.destroy();
                    self._dialogVM = null;
                }
                self._super();
            }
        },
        {
            folderBrowser: {
                get: function () {
                    return this._folderBrowser;
                }
            },
            selectedItem: {
                set: function (v) {
                    if (v !== this._selectedItem){
                        this._selectedItem = v;
                        this.raisePropertyChanged('selectedItem');
                    }
                },
                get: function () {
                    return this._selectedItem;
                }
            },
            dialogCommand:{
                get:function () {
                    return this._dialogCommand;
                }
            },
            includeFiles:{
                get: function () {
                    return this._includeFiles;
                }
            }
        }, function (obj) {
            app.registerType('custom.FolderBrowserVM', obj);
        });

});
