RIAPP.Application.registerModule('masterDetailDemo', function (app) {
    var global = app.global, utils = global.utils, consts = global.consts;
    var TEXT = RIAPP.localizable.TEXT, CustomerVM, OrderVM, OrderDetailVM, ProductVM, AddressVM;

    CustomerVM = app.getType('BaseViewModel').extend({
            _create: function () {
                this._super();
                var self = this;
                this._dataGrid = null;
                this._dbSet = this.dbSets.Customer;
                this._dbSet.isSubmitOnDelete = true;
                this._propWatcher = app.getType('PropWatcher').create();

                this._dbSet.addHandler('item_deleting', function (sender, args) {
                    if (!confirm('Are you sure that you want to delete customer ?'))
                        args.isCancel = true;
                }, self.uniqueID);

                this._dbSet.addHandler('fill', function (sender, args) {
                    //when fill is ended
                    if (!args.isBegin){
                        self.raiseEvent('data_filled',args);
                    }
                    else {
                        if (args.isPageChanged)
                            self.raiseEvent('page_changed',{});
                    }
                }, self.uniqueID);

                //adds new customer - uses dialog to enter the data
                this._addNewCommand = app.getType('Command').create(function (sender, param) {
                        self._dbSet.addNew();  //showing of the dialog is handled by the datagrid
                    }, self,
                    function (sender, param) {
                        return true; //command is always enabled
                    });

                //saves changes (submitts them to the service)
                this._saveCommand = app.getType('Command').create(function (sender, param) {
                        self.dbContext.submitChanges();
                    }, self,
                    function (s, p) {
                        return self.dbContext.hasChanges; //command enabled when there are pending changes
                    });


                this._undoCommand = app.getType('Command').create(function (sender, param) {
                        self.dbContext.rejectChanges();
                    }, self,
                    function (s, p) {
                        return self.dbContext.hasChanges; //command enabled when there are pending changes
                    });

                //load data from the server
                this._loadCommand = app.getType('Command').create(function (sender, args) {
                    self.load();
                }, self, null);

                //example of getting instance of bounded dataGrid by using elView's propChangedCommand
                this._propChangeCommand =  app.getType('Command').create(function (sender, args) {
                    if (args.property=='*' || args.property=='grid'){
                        self._dataGrid = sender.grid;
                    }
                    //example of binding to dataGrid events
                    if (!!self._dataGrid){
                        self._dataGrid.addHandler('page_changed', function(s,a){
                            self._onGridPageChanged();
                        }, self.uniqueID);
                        self._dataGrid.addHandler('row_selected', function(s,a){
                            self._onGridRowSelected(a.row);
                        }, self.uniqueID);
                        self._dataGrid.addHandler('row_expanded', function(s,a){
                            self._onGridRowExpanded(a.old_expandedRow, a.expandedRow, a.isExpanded);
                        }, self.uniqueID);
                    }
                }, self, null);

                this._tabsEventCommand = app.getType('Command').create(function (sender, param) {
                    //alert(param.eventName);
                }, self, null);

                //the property watcher helps us handling properties changes
                //more convenient than using addOnPropertyChange
                this._propWatcher.addPropWatch(self.dbContext,'hasChanges',function(s,a){
                    self._saveCommand.raiseCanExecuteChanged();
                    self._undoCommand.raiseCanExecuteChanged();
                });
                this._propWatcher.addPropWatch(this._dbSet,'currentItem',function(s,a){
                    self._onCurrentChanged();
                });

                this._dbSet.addHandler('cleared',function(s,a){
                    self.dbSets.CustomerAddress.clear();
                    self.dbSets.Address.clear();
                }, self.uniqueID);

                var custAssoc = self.dbContext.getAssociation('CustAddrToCustomer');

                //the view to filter CustomerAddresses related to the current customer only
                this._custAdressView = app.getType('ChildDataView').create(
                    {
                        association:custAssoc,
                        fn_sort: function(a,b){return a.AddressID - b.AddressID;}
                    });
                this._ordersVM  = OrderVM.create(this);
            },
            _getEventNames:function () {
                var base_events = this._super();
                return ['data_filled', 'row_expanded','page_changed'].concat(base_events);
            },
            _onGridPageChanged: function(){
            },
            _onGridRowSelected: function(row){
            },
            _onGridRowExpanded: function(oldRow, row, isExpanded){
                var r = row;
                if (!isExpanded){
                    r = oldRow;
                }
                this.raiseEvent('row_expanded',{customer: r.item, isExpanded: isExpanded});
            },
            _onCurrentChanged: function () {
                this._custAdressView.parentItem =  this._dbSet.currentItem;
                this.raisePropertyChanged('currentItem');
            },
            //returns promise
            load: function () {
                var query = this.dbSet.createQuery('ReadCustomer');
                query.pageSize = 50;
                query.params = { includeNav: true };
                //load without filtering
                query.orderBy('LastName', 'ASC').thenBy('MiddleName','ASC').thenBy('FirstName','ASC');
                return this.dbContext.load(query);
            },
            destroy:function () {
                if (this._isDestroyed)
                    return;
                this._propWatcher.destroy();
                this._propWatcher =null;

                if (!!this._dbSet){
                    this._dbSet.removeNSHandlers(this.uniqueID);
                }
                if (!!this._dataGrid){
                    this._dataGrid.removeNSHandlers(this.uniqueID);
                }

                this._ordersVM.destroy()
                this._ordersVM = null;
                this._super();
            }
        },
        {
            addNewCommand:{
                get:function () {
                    return this._addNewCommand;
                }},
            saveCommand:{
                get:function () {
                    return this._saveCommand;
                }},
            undoCommand:{
                get:function () {
                    return this._undoCommand;
                }},
            tabsEventCommand: {
                get: function () {
                    return this._tabsEventCommand;
                }
            },
            propChangeCommand: {
                get: function () {
                    return this._propChangeCommand;
                }
            },
            dbContext: {
                get: function () {
                    return this.app.dbContext;
                }
            },
            //Customers DbSet
            dbSet: {
                get: function () {
                    return this._dbSet;
                }
            },
            dbSets: {
                get: function () {
                    return this.app.dbContext.dbSets;
                }
            },
            //Current Customer
            currentItem: {
                get: function () {
                    return this._dbSet.currentItem;
                }
            },
            loadCommand:{
                get:function () {
                    return this._loadCommand;
                }},
            ordersVM:{
                get:function () {
                    return this._ordersVM;
                }},
            custAdressView:{
                get:function () {
                    return this._custAdressView;
                }}
        },
        function (obj) {
            app.registerType('custom.CustomerVM', obj);
        });

    OrderVM = app.getType('BaseViewModel').extend({
            _create: function (customerVM) {
                this._super();
                var self = this;
                this._customerVM = customerVM;
                this._dbSet = this.dbSets.SalesOrderHeader;
                this._currentCustomer = null;
                this._dataGrid = null;
                this._selectedTabIndex = null;
                this._orderStatuses = app.getType('Dictionary').create('orderStatus',{key:0,val:''},'key');
                this._orderStatuses.fillItems([{key:0,val:'New Order'},{key:1,val:'Status 1'},{key:2,val:'Status 2'},{key:3,val:'Status 3'},
                    {key:4,val:'Status 4'},{key:5,val:'Completed Order'}], true);

                //loads the data only when customer's row is expanded
                this._customerVM.addHandler('row_expanded', function (sender, args) {
                    if (args.isExpanded){
                        self.currentCustomer = args.customer;
                    }
                    else
                    {
                        self.currentCustomer = null;
                    }
                }, self.uniqueID);

                this._dbSet.addOnPropertyChange('currentItem', function (sender, args) {
                    self._onCurrentChanged();
                }, self.uniqueID);

                this._dbSet.addHandler('item_deleting', function (sender, args) {
                    if (!confirm('Are you sure that you want to delete order ?'))
                        args.isCancel = true;
                }, self.uniqueID);


                this._dbSet.addHandler('item_added', function (sender, args) {
                    args.item.Customer =  self.currentCustomer;
                    args.item.OrderDate = Date.today(); //datejs extension
                    args.item.DueDate = Date.today().add(6).days(); //datejs extension
                    args.item.OnlineOrderFlag = false;
                }, self.uniqueID);

                this._dbSet.addHandler('fill', function (sender, args) {
                    //when fill is ended
                    if (!args.isBegin){
                        self.raiseEvent('data_filled',args);
                    }
                }, self.uniqueID);

                //adds new order - uses dialog to fill the data
                this._addNewCommand = app.getType('Command').create(function (sender, param) {
                        self._dbSet.addNew();  //showing of the dialog is handled by the datagrid
                    }, self,
                    function (sender, param) {
                        return true;  //always enabled
                    });

                //example of getting instance of bounded dataGrid by using elView's propChangedCommand
                this._propChangeCommand =  app.getType('Command').create(function (sender, args) {
                    if (args.property=='*' || args.property=='grid'){
                        self._dataGrid = sender.grid;
                    }
                    //example of binding to dataGrid events
                    if (!!self._dataGrid){
                        self._dataGrid.addHandler('page_changed', function(s,a){
                            self._onGridPageChanged();
                        }, self.uniqueID);
                        self._dataGrid.addHandler('row_selected', function(s,a){
                            self._onGridRowSelected(a.row);
                        }, self.uniqueID);
                        self._dataGrid.addHandler('row_expanded', function(s,a){
                            self._onGridRowExpanded(a.old_expandedRow, a.expandedRow, a.isExpanded);
                        }, self.uniqueID);
                    }
                }, self, null);

                this._tabsEventCommand = app.getType('Command').create(function (sender, param) {
                   //here we can handle tabs events
                    switch(param.eventName)
                    {
                       case "select":
                            this._onTabSelected(param.args.index);
                            break;
                       default:
                            break;
                    }
                }, self, null);

                this._addressVM = AddressVM.create(this);
                this._orderDetailVM = OrderDetailVM.create(this);
            },
            _getEventNames:function () {
                var base_events = this._super();
                return ['data_filled','row_expanded'].concat(base_events);
            },
            _onTabSelected: function(index){
                this._selectedTabIndex = index;
                this.raisePropertyChanged('selectedTabIndex');

                if (index === 2){  //load details only when tab which contain details grid is selected
                    this._orderDetailVM.currentOrder = this.dbSet.currentItem;
                }
            },
            _onGridPageChanged: function(){
            },
            _onGridRowSelected: function(row){
            },
            _onGridRowExpanded: function(oldRow, row, isExpanded){
                var r = row;
                if (!isExpanded){
                    r = oldRow;
                }
                this.raiseEvent('row_expanded',{order: r.item, isExpanded: isExpanded});
                if (isExpanded){
                   this._onTabSelected(this.selectedTabIndex);
                }
            },
            _onCurrentChanged: function () {
                this.raisePropertyChanged('currentItem');
            },
            clear: function(){
                this.dbSet.clear();
            },
            //returns promise
            load: function () {
                //explicitly clear on before every load
                this.clear();
                if (!this.currentCustomer || this.currentCustomer.getIsNew()){
                    var deferred = new global.$.Deferred();
                    deferred.reject();
                    return deferred.promise();
                }
                var query = this.dbSet.createQuery('ReadSalesOrderHeader');
                query.where('CustomerID', '=', [this.currentCustomer.CustomerID]);
                query.orderBy('OrderDate', 'ASC').thenBy('SalesOrderID','ASC');
                return this.dbContext.load(query);
            },
            destroy:function () {
                if (this._isDestroyed)
                    return;
                if (!!this._dbSet){
                    this._dbSet.removeNSHandlers(this.uniqueID);
                }
                if (!!this._dataGrid){
                    this._dataGrid.removeNSHandlers(this.uniqueID);
                }
                this.currentCustomer = null;
                this._addressVM.destroy();
                this._addressVM = null;
                this._orderDetailVM.destroy();
                this._orderDetailVM = null;
                this._customerVM = null;
                this._super();
            }
        },
        {
            addNewCommand:{
                get:function () {
                    return this._addNewCommand;
                }},
            tabsEventCommand: {
                get: function () {
                    return this._tabsEventCommand;
                }
            },
            propChangeCommand: {
                get: function () {
                    return this._propChangeCommand;
                }
            },
            dbContext: {
                get: function () {
                    return this.app.dbContext;
                }
            },
            //Orders DbSet
            dbSet: {
                get: function () {
                    return this._dbSet;
                }
            },
            dbSets: {
                get: function () {
                    return this.app.dbContext.dbSets;
                }
            },
            orderStatuses:{
                get:function () {
                    return this._orderStatuses;
                }},
            //Current Order
            currentItem: {
                get: function () {
                    return this._dbSet.currentItem;
                }
            },
            currentCustomer:{
                set:function (v) {
                    if (v !== this._currentCustomer){
                        this._currentCustomer = v;
                        this.raisePropertyChanged('currentCustomer');
                        this.load();
                    }
                },
                get:function () {
                    return this._currentCustomer;
                }},
            customerVM:{
                get:function () {
                    return this._customerVM;
                }},
            orderDetailsVM:{
                get:function () {
                    return this._orderDetailVM;
                }},
            selectedTabIndex:{
                get:function () {
                    return this._selectedTabIndex;
                }}
        },
        function (obj) {
            app.registerType('custom.OrderVM', obj);
        });

    OrderDetailVM = app.getType('BaseViewModel').extend({
            _create: function (orderVM) {
                this._super();
                var self = this;
                this._orderVM = orderVM;
                this._dbSet = this.dbSets.SalesOrderDetail;
                this._currentOrder = null;

                this._orderVM.dbSet.addHandler('cleared',function(s,a){
                    self.clear();
                }, self.uniqueID);

                this._dbSet.addHandler('fill', function (sender, args) {
                    //when fill is ended
                    if (!args.isBegin){
                        self.raiseEvent('data_filled',args);
                    }
                }, self.uniqueID);

                this._dbSet.addOnPropertyChange('currentItem', function (sender, args) {
                    self._onCurrentChanged();
                }, self.uniqueID);

                this._productVM = ProductVM.create(this);
            },
            _getEventNames:function () {
                var base_events = this._super();
                return ['data_filled'].concat(base_events);
            },
            _onCurrentChanged: function () {
                this.raisePropertyChanged('currentItem');
            },
           //returns promise
            load: function () {
                this.clear();

                if (!this.currentOrder || this.currentOrder.getIsNew()){
                    var deferred = new global.$.Deferred();
                    deferred.reject();
                    return deferred.promise();
                }
                var query = this.dbSet.createQuery('ReadSalesOrderDetail');
                query.where('SalesOrderID', '=', [this.currentOrder.SalesOrderID]);
                query.orderBy('SalesOrderDetailID', 'ASC');
                return this.dbContext.load(query);
            },
            clear: function(){
                this.dbSet.clear();
            },
            destroy:function () {
                if (this._isDestroyed)
                    return;

                if (!!this._dbSet){
                    this._dbSet.removeNSHandlers(this.uniqueID);
                }
                if (!!this._dataGrid){
                    this._dataGrid.removeNSHandlers(this.uniqueID);
                }
                this.currentOrder = null;
                this._productVM.destroy();
                this._orderVM.dbSet.removeNSHandlers(this.uniqueID);
                this._orderVM.removeNSHandlers(this.uniqueID);
                this._orderVM = null;
                this._super();
            }
        },
        {
            dbContext: {
                get: function () {
                    return this.app.dbContext;
                }
            },
            //OrderDetail DbSet
            dbSet: {
                get: function () {
                    return this._dbSet;
                }
            },
            dbSets: {
                get: function () {
                    return this.app.dbContext.dbSets;
                }
            },
            //Current OrderDetail
            currentItem: {
                get: function () {
                    return this._dbSet.currentItem;
                }
            },
            currentOrder:{
                set:function (v) {
                    if (v !== this._currentOrder){
                        this._currentOrder = v;
                        this.raisePropertyChanged('currentOrder');
                        this.load();
                    }
                },
                get:function () {
                    return this._currentOrder;
                }},
            orderVM:{
                get:function () {
                    return this._orderVM;
                }}
        },
        function (obj) {
            app.registerType('custom.OrderDetailVM', obj);
        });

    AddressVM = app.getType('BaseViewModel').extend({
            _create: function (orderVM) {
                this._super();
                var self = this;
                this._orderVM = orderVM;
                this._dbSet = this.dbSets.Address;
                this._customerDbSet = this._orderVM.customerVM.dbSet;

                this._orderVM.addHandler('data_filled', function (sender, args) {
                    self.loadAddressesForOrders(args.fetchedItems);
                }, self.uniqueID);

                this._dbSet.addOnPropertyChange('currentItem', function (sender, args) {
                    self._onCurrentChanged();
                }, self.uniqueID);
            },
            _onCurrentChanged: function () {
                this.raisePropertyChanged('currentItem');
            },
            //returns promise
            loadAddressesForOrders: function (orders) {
                var ids1 = orders.map(function(item){
                    return item.ShipToAddressID;
                });
                var ids2 = orders.map(function(item){
                    return item.BillToAddressID;
                });
                var ids = ids1.concat(ids2).filter(function(id){
                    return id !== null;
                }).distinct();
                return this.load(ids, false);
            },
           //returns promise
            load: function (ids, isClearTable) {
                var query = this.dbSet.createQuery('ReadAddressByIds');
                query.params = { addressIDs: ids };
                query.isClearPrevData = isClearTable; //if true, previous data will be cleared when new is loaded
                return this.dbContext.load(query);
            },
            clear: function(){
                this.dbSet.clear();
            },
            destroy:function () {
                if (this._isDestroyed)
                    return;

                if (!!this._dbSet){
                    this._dbSet.removeNSHandlers(this.uniqueID);
                }
                this._customerDbSet.removeNSHandlers(this.uniqueID);
                this._orderVM.removeNSHandlers(this.uniqueID);
                this._orderVM = null;
                this._customerDbSet = null;
                this._super();
            }
        },
        {
            dbContext: {
                get: function () {
                    return this.app.dbContext;
                }
            },
            //Address DbSet
            dbSet: {
                get: function () {
                    return this._dbSet;
                }
            },
            dbSets: {
                get: function () {
                    return this.app.dbContext.dbSets;
                }
            },
            //Current Address
            currentItem: {
                get: function () {
                    return this._dbSet.currentItem;
                }
            }
        },
        function (obj) {
            app.registerType('custom.AddressVM', obj);
        });

    //product lookup used in orderDetEditTemplate
    var ProductAutoComplete = app.getType('AutoCompleteElView').extend({
            _init:function (options){
                this._super(options);
                var self = this;
                this._lastLoadedID = null;
                this._lookupSource= this.app.dbContext.dbSets.Product;
                this._lookupSource.addHandler('coll_changed', function (sender, args) {
                    self._updateValue();
                }, self._objId);
            },
            //overriden base method
            _updateSelection: function(){
                if (!!this.dataContext) {
                    var id = this.currentSelection;
                    this.dataContext['ProductID'] = id;
                }
            },
            _onHide: function(){
                this._super();
                this._updateValue();
            },
            //new method
            _updateValue: function(){
                if (!this.dataContext){
                    this.value = '';
                    return;
                }
                var productID = this.dataContext['ProductID'];
                var product = this._lookupSource.findByPK(productID);
                if (!!product){
                    this.value = product.Name;
                }
                else {
                    this.value = '';
                    if (this._lastLoadedID !== productID){
                        this._lastLoadedID = productID; //prevents unending loading in some cases
                        var query = this._lookupSource.createQuery('ReadProductByIds');
                        query.params = { productIDs: [productID] };
                        query.isClearPrevData = false;
                        this.app.dbContext.load(query);
                    }
                }
            }
        },
        {
            //overriden base property
            dataContext:{
                set:function (v) {
                    var self = this;
                    if (this._dataContext !== v){
                        if (!!this._dataContext){
                            this._dataContext.removeNSHandlers(this.uniqueID);
                        }
                        this._dataContext = v;
                        if (!!this._dataContext){
                            this._dataContext.addOnPropertyChange('ProductID',function(sender,a){
                               self._updateValue();
                            },this.uniqueID);
                        }
                        self._updateValue();
                        this.raisePropertyChanged('dataContext');
                    }
                },
                get:function () {
                    return this._dataContext;
                }
            },
            //overriden base property
            currentSelection:{
                get:function () {
                    if (!!this._dbSet.currentItem)
                        return this._dbSet.currentItem['ProductID'];
                    else
                        return null;
                }
            }
        }
        , function (obj) {
            app.registerElView('productACV', obj);
        }
    );

    ProductVM = app.getType('BaseViewModel').extend({
            _create: function (orderDetailVM) {
                this._super();
                var self = this;
                this._orderDetailVM = orderDetailVM;
                this._dbSet = this.dbSets.Product;
                this._customerDbSet = this._orderDetailVM.orderVM.customerVM.dbSet;

                this._customerDbSet.addHandler('cleared',function(s,a){
                    self.clear();
                }, self.uniqueID);

                //here we load products which are referenced in order details
                this._orderDetailVM.addHandler('data_filled', function (sender, args) {
                    self.loadProductsForOrderDetails(args.fetchedItems);
                }, self.uniqueID);

                this._dbSet.addOnPropertyChange('currentItem', function (sender, args) {
                    self._onCurrentChanged();
                }, self.uniqueID);
            },
            _onCurrentChanged: function () {
                this.raisePropertyChanged('currentItem');
            },
            clear: function(){
                this.dbSet.clear();
            },
           //returns promise
           loadProductsForOrderDetails: function (orderDetails) {
               var ids = orderDetails.map(function(item){
                   return item.ProductID;
               }).filter(function(id){
                   return id !== null;
               }).distinct();

               return this.load(ids, false);
           },
           //returns promise
            load: function (ids, isClearTable) {
                var query = this.dbSet.createQuery('ReadProductByIds');
                query.params = { productIDs: ids };
                query.isClearPrevData = isClearTable;
                return this.dbContext.load(query);
            },
            destroy:function () {
                if (this._isDestroyed)
                    return;

                if (!!this._dbSet){
                    this._dbSet.removeNSHandlers(this.uniqueID);
                }
                this._customerDbSet.removeNSHandlers(this.uniqueID);
                this._orderDetailVM.removeNSHandlers(this.uniqueID);
                this._orderDetailVM = null;
                this._customerDbSet = null;
                this._super();
            }
        },
        {
            dbContext: {
                get: function () {
                    return this.app.dbContext;
                }
            },
            //Product DbSet
            dbSet: {
                get: function () {
                    return this._dbSet;
                }
            },
            dbSets: {
                get: function () {
                    return this.app.dbContext.dbSets;
                }
            },
            //Current Product
            currentItem: {
                get: function () {
                    return this._dbSet.currentItem;
                }
            }
        },
        function (obj) {
            app.registerType('custom.ProductVM', obj);
        });
});