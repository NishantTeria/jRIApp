RIAPP.Application.registerModule('manyToManyDemo', function (app) {
    var global = app.global, utils = global.utils, consts = global.consts;
    var TEXT = RIAPP.localizable.TEXT, CustomerVM, CustomerAddressVM, AddAddressVM;
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

    CustomerVM = app.getType('BaseViewModel').extend({
            _create: function () {
                this._super();
                var self = this;
                this._includeDetailsOnLoad = false;
                this._dbSet = this.dbSets.Customer;
                this._dbSet.isSubmitOnDelete = true;

                this._dbSet.addOnPropertyChange('currentItem', function (sender, args) {
                    self._onCurrentChanged();
                }, self.uniqueID);

                this._dbSet.addHandler('item_deleting', function (s, a) {
                    if (!confirm('Are you sure that you want to delete customer ?'))
                        a.isCancel = true;
                }, self.uniqueID);

                this._dbSet.addHandler('end_edit', function (sender, args) {
                    if (!args.isCanceled){
                        self.dbContext.submitChanges();
                    }
                }, self.uniqueID);


                this._dbSet.addHandler('fill', function (sender, args) {
                    //when filled, it raise our custom event
                    if (!args.isBegin){
                        self.raiseEvent('data_filled',args);
                    }
                }, self.uniqueID);


                //initialize new item with default values
                this._dbSet.addHandler('item_added', function (sender, args) {
                    var item = args.item;
                    item.NameStyle = false;
                }, self.uniqueID);

                //adds new customer - uses dialog showed by datagrid to enter the data
                this._addNewCommand = app.getType('Command').create(function (sender, param) {
                        var item =  self._dbSet.addNew();
                    }, self,
                    function (sender, param) {
                        //command is always enabled
                        return true;
                    });

                //load data from the server
                this._loadCommand = app.getType('Command').create(function (sender, args) {
                    self.load();
                }, self, null);

                //example of using command parameter for a command
                this._helpCommand = app.getType('Command').create(function (sender, param) {
                    alert('Help command executed for AddressID: ' + (!!param ? param.AddressID : '???'));
                }, self, null);

                this._customerAddressVM = null;
            },
            //here we added custom event
            _getEventNames:function () {
                var base_events = this._super();
                return ['data_filled'].concat(base_events);
            },
            _onCurrentChanged: function () {
                this.raisePropertyChanged('currentItem');
            },
            load: function () {
                var query = this.dbSet.createQuery('ReadCustomer');
                query.pageSize = 50;
                //when loadPageCount > 1 the we preloading several pages at once
                //when moving to the next page, the data is retrived from local cache
                //when we include details in load we can use default 1 value
                //in other cases we can use value more than 1 (here we load 5 pages at once)
                query.loadPageCount = this.includeDetailsOnLoad?1:5;
                //we clear previous cache date for every loading data from the server
                query.isClearCacheOnEveryLoad = true;
                //to see how this parameter is used, see server side ReadCustomer method implementation
                query.params = { includeNav: this.includeDetailsOnLoad };
                query.orderBy('LastName', 'ASC').thenBy('MiddleName','ASC').thenBy('FirstName','ASC');
                return this.dbContext.load(query);
            },
            destroy:function () {
                if (this._isDestroyed)
                    return;

                if (!!this._customerAddressVM){
                    this._customerAddressVM.destroy();
                    this._customerAddressVM = null;
                }
                if (!!this._dbSet){
                    this._dbSet.removeNSHandlers(this.uniqueID);
                }
                this._super();
            }
        },
        {
            addNewCommand:{
                get:function () {
                    return this._addNewCommand;
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
            //Current Customer entity
            currentItem: {
                get: function () {
                    return this._dbSet.currentItem;
                }
            },
            loadCommand:{
                get:function () {
                    return this._loadCommand;
                }
            },
            helpCommand:{
                get:function () {
                    return this._helpCommand;
                }
            },
            customerAddressVM:{
                get:function () {
                    if (!this._customerAddressVM)
                        this._customerAddressVM = CustomerAddressVM.create(this);
                    return this._customerAddressVM;
                }
            },
            //if true then loading customer entity also loads included related CustomerAddress and Address entities
            //when false we load those entities separately, using our own load methods
            includeDetailsOnLoad: {
                set: function(v){
                    if (v !== this._includeDetailsOnLoad){
                        this._includeDetailsOnLoad = v;
                        this.raisePropertyChanged('includeDetailsOnLoad');
                    }
                },
                get: function () {
                    return this._includeDetailsOnLoad;
                }
            }
        },
        function (obj) {
            app.registerType('custom.CustomerVM', obj);
        });

    CustomerAddressVM = app.getType('BaseViewModel').extend({
            _create: function (customerVM) {
                this._super();
                var self = this;
                this._customerVM = customerVM;
                this._addAddressVM = null;
                this._currentCustomer = null;
                this._addressesDb = this.dbSets.Address;
                this._custAdressDb = this.dbSets.CustomerAddress;
                this._custAdressDb.addHandler('item_deleting', function (sender, args) {
                    if (!confirm('Are you sure that you want to unlink Address from this customer?'))
                        args.isCancel = true;
                }, self.uniqueID);

                this._custAdressDb.addHandler('begin_edit', function (sender, args) {
                    //start editing Address entity, when CustomerAddress begins editing
                    //p.s.- Address is navigation property
                    var address = args.item.Address;
                    if (!!address)
                        address.beginEdit();
                }, self.uniqueID);

                this._custAdressDb.addHandler('end_edit', function (sender, args) {
                    var address = args.item.Address;
                    if (!args.isCanceled){
                        if (!!address)
                            address.endEdit();
                    }
                    else {
                        if (address)
                            address.cancelEdit();
                    }
                }, self.uniqueID);

                this._addressesDb.addHandler('item_deleting', function (sender, args) {
                    if (!confirm('Are you sure that you want to delete Customer\'s Address ?'))
                        args.isCancel = true;
                }, self.uniqueID);

                //event handler for our custom event
                this._customerVM.addHandler('data_filled',function(sender,a){
                    //if details are not included with customers entities when they are loaded
                    //then load addresses related to the customers separately
                    if (!sender.includeDetailsOnLoad)
                        self.load(a.fetchedItems);
                },self.uniqueID);

                var custAssoc = self.dbContext.getAssociation('CustAddrToCustomer');

                //the view to filter CustomerAddresses related to the current customer only
                this._custAdressView = app.getType('ChildDataView').create(
                    {
                        association:custAssoc,
                        fn_sort: function(a,b){return a.AddressID - b.AddressID;}
                    });

                //the view to filter addresses related to current customer
                this._addressesView =  app.getType('DataView').create(
                    {
                        dataSource: this._addressesDb,
                        fn_sort: function(a,b){return a.AddressID - b.AddressID;},
                        fn_filter: function(item){
                           if (!self._currentCustomer)
                                return false;
                           return item.CustomerAddresses.some(function(ca){
                               return self._currentCustomer === ca.Customer;
                           });
                        },
                        fn_itemsProvider: function(ds){
                            if (!self._currentCustomer)
                                return [];
                            var custAdrs = self._currentCustomer.CustomerAddresses;
                            return custAdrs.map(function(m){
                                return m.Address;
                            }).filter(function(m){
                                    return !!m;
                                });
                        }
                    });

                this._custAdressView.addHandler('view_refreshed',function(s,a){
                    self._addressesView.refresh();
                },self.uniqueID);

                this._customerVM.addOnPropertyChange('currentItem', function (sender, args) {
                    self._currentCustomer = self._customerVM.currentItem;
                    self._custAdressView.parentItem =  self._currentCustomer;
                    self.raisePropertyChanged('currentCustomer');
                }, self.uniqueID);
            },
            //async load, returns promise
            _loadAddresses: function (addressIDs,isClearTable) {
                var  query = this._addressesDb.createQuery('ReadAddressByIds');
                //supply ids to service method which expects this custom parameter
                query.params = { addressIDs: addressIDs };
                //if true we clear all previous data in the DbSet
                query.isClearPrevData = isClearTable;
                //returns promise
                return this.dbContext.load(query);
            },
            _addNewAddress: function(){
                //use the DataView, not DbSet
                var adr = this.addressesView.addNew();
                return adr;
            },
            _addNewCustAddress: function(address){
                var cust = this.currentCustomer;
                //use the DataView, not DbSet
                var ca = this.custAdressView.addNew();
                ca.CustomerID = cust.CustomerID;
                ca.AddressType = "Main Office"; //this is default, can edit later
                //create relationship with address
                //if address is new , then the keys will be aquired when the data submitted to the server
                ca.Address = address;
                ca.endEdit();
                return ca;
            },
            load: function (customers) {
                var self = this, query = this._custAdressDb.createQuery('ReadAddressForCustomers'),
                    custArr = customers || [];
               //customerIDs for all loaded customers entities (for current page only, not which in cache if query.loadPageCount>1)
                var custIDs = custArr.map(function(item){
                    return item.CustomerID;
                });

                //send them to our service method which expects them (we defined our custom parameter, see the service method)
                query.params = { custIDs: custIDs };

                var promise = this.dbContext.load(query);
                //if we did not included details when we had loaded customers
                if (!this._customerVM.includeDetailsOnLoad)
                {
                    //then load related addresses based on what customerAddress items just loaded
                    promise.done(function(res){
                        var addressIDs = res.fetchedItems.map(function(item){
                            return item.AddressID;
                        });
                        //load new addresses and clear all previous addresses
                        self._loadAddresses(addressIDs, true);
                    });
                }
            },
            destroy:function () {
                if (this._isDestroyed)
                    return;
                if (!!this._addressesDb){
                    this._addressesDb.removeNSHandlers(this.uniqueID);
                }
                if (!!this._custAdressDb){
                    this._custAdressDb.removeNSHandlers(this.uniqueID);
                }
                if (!!this._customerVM){
                    this._customerVM.removeNSHandlers(this.uniqueID);
                }
                if (this._addAddressVM){
                    this._addAddressVM.destroy();
                    this._addAddressVM = null;
                }
                this._super();
            }
        },
        {
            dbContext: {
                get: function () {
                    return this.app.dbContext;
                }
            },
            addressesDb: {
                get: function () {
                    return this._addressesDb;
                }
            },
            custAdressDb: {
                get: function () {
                    return this._custAdressDb;
                }
            },
            addressesView: {
                get: function () {
                    return this._addressesView;
                }
            },
            custAdressView: {
                get: function () {
                    return this._custAdressView;
                }
            },
            dbSets: {
                get: function () {
                    return this.app.dbContext.dbSets;
                }
            },
            addAddressVM: {
                get: function () {
                    if (this._addAddressVM === null){
                        this._addAddressVM = AddAddressVM.create(this);
                    }
                    return this._addAddressVM;
                }
            },
            currentCustomer: {
                get: function () {
                    return this._currentCustomer;
                }
            }
        },
        function (obj) {
            app.registerType('custom.CustomerAddressVM', obj);
        });

    AddAddressVM = app.getType('BaseViewModel').extend(
        {
            _create: function (customerAddressVM) {
                this._super();
                var self = this;
                this._customerAddressVM = customerAddressVM;
                this._addressInfosDb = this.dbContext.dbSets.AddressInfo;
                this._currentCustomer = null;
                this._searchToolTip = 'enter any address part then press search button';
                this._newAddress = null;
                this._adressInfosGrid = null;
                this._searchString = null;
                this._isAddingNew = false;
                this._dialogVM = app.getType('custom.DialogVM').create();
                var dialogOptions = {
                    templateID:'addAddressTemplate',
                    width: 950,
                    height: 600,
                    title:'add new customer address',
                    submitOnOK: true,
                    fn_OnClose: function(dialog){
                        if (dialog.result != 'ok'){
                            //if new address is not explicitly accepted then reject added address
                            if (!!self._newAddress){
                                self._cancelAddNewAddress();
                            }
                            self.dbContext.rejectChanges();
                        }
                        self._addressInfosDb.clear();
                        self.searchString = null;
                    },
                    fn_OnOK: function(dialog){
                        var DIALOG_ACTION = dialog.DIALOG_ACTION;
                        if (!self._isAddingNew){
                            return DIALOG_ACTION.Default; //allow close dialog
                        }
                        if (!self._newAddress.endEdit())
                            return DIALOG_ACTION.StayOpen;
                        var custAdress = self._customerAddressVM._addNewCustAddress(self._newAddress);
                        custAdress.endEdit();
                        self._newAddress = null;
                        self._isAddingNew = false;
                        self.raisePropertyChanged('newAddress');
                        self.raisePropertyChanged('isAddingNew');
                        return DIALOG_ACTION.StayOpen;
                    },
                    fn_OnCancel: function(dialog){
                        var DIALOG_ACTION = dialog.DIALOG_ACTION;
                        if (!self._isAddingNew){
                            return DIALOG_ACTION.Default;
                        }
                        if (!!self._newAddress){
                            self._cancelAddNewAddress();
                        }
                        return DIALOG_ACTION.StayOpen;
                    }
                };
                this._dialogVM.createDialog('addressDialog', dialogOptions);

                //this data displayed in the right panel - contains available (existing in db) addresses
                this._addressInfosView = app.getType('DataView').create(
                    {
                        dataSource: this._addressInfosDb,
                        fn_sort: function(a,b){return a.AddressID - b.AddressID;},
                        fn_filter: function(item){
                            return !item.CustomerAddresses.some(function(CustAdr){
                                return self._currentCustomer === CustAdr.Customer;
                            });
                        }
                    });
                //enable paging in the view
                this._addressInfosView.isPagingEnabled = true;
                this._addressInfosView.pageSize = 50;

                this._addressInfosView.addOnPropertyChange('currentItem', function (sender, args) {
                    self.raisePropertyChanged('currentAddressInfo');
                    self._linkCommand.raiseCanExecuteChanged();
                }, self.uniqueID);

                this._customerAddressVM.addOnPropertyChange('currentCustomer', function (sender, args) {
                    self._currentCustomer = self._customerAddressVM.currentCustomer;
                    self.raisePropertyChanged('customer');
                    self._addNewCommand.raiseCanExecuteChanged();
                }, self.uniqueID);

                //this data is displayed on the left panel - addresses currently linked to the customer
                this.custAdressView.addOnPropertyChange('currentItem', function (sender, args) {
                    self._unLinkCommand.raiseCanExecuteChanged();
                }, self.uniqueID);

                //add new or existing address
                this._addNewCommand = app.getType('Command').create(function (sender, param) {
                        try {
                            self._dialogVM.showDialog('addressDialog',self);
                        } catch (ex) {
                            self._onError(ex, this);
                        }
                    }, self,
                    function (sender, param) {
                        //enable this command when customer is not null
                        return !!self.customer;
                    });

                //load searched address data from the server
                this._execSearchCommand = app.getType('Command').create(function (sender, args) {
                    self.loadAddressInfos();
                }, self, null);

                //adds new address to the customer
                this._addNewAddressCommand = app.getType('Command').create(function (sender, args) {
                    self._addNewAddress();
                }, self, null);

                //adds existed address to the customer
                this._linkCommand = app.getType('Command').create(function (sender, args) {
                    self._linkAddress();
                }, self, function (s, a) {
                    return !!self._addressInfosView.currentItem;
                });

                this._unLinkCommand = app.getType('Command').create(function (sender, args) {
                    self._unLinkAddress();
                }, self, function (s, a) {
                    return !!self.custAdressView.currentItem;
                });

                //this is bound to the grid element view on the page
                //by this command we can get hold of the datagrid control
                //this command executed when element view property changes
                //we grab grid property from the sender (which is element view, and has property - grid)
                this._propChangeCommand =  app.getType('Command').create(function (sender, args) {
                    if (args.property=='*' || args.property=='grid'){
                        self._adressInfosGrid = sender.grid;
                    }
                }, self, null);
            },
            _cancelAddNewAddress: function(){
               var self = this;
                self._newAddress.cancelEdit();
                self._newAddress.rejectChanges();
                self._newAddress = null;
                self._isAddingNew = false;
                self.raisePropertyChanged('newAddress');
                self.raisePropertyChanged('isAddingNew');
            },
            //returns promise
            loadAddressInfos: function () {
                var query = this._addressInfosDb.createQuery('ReadAddressInfo');
                query.isClearPrevData = true;
                addTextQuery(query,'AddressLine1','%'+this.searchString+'%');
                query.orderBy('AddressLine1', 'ASC');
                return this.dbContext.load(query);
            },
            _addNewAddress: function(){
                this._newAddress = this._customerAddressVM._addNewAddress();
                this._isAddingNew = true;
                this.raisePropertyChanged('newAddress');
                this.raisePropertyChanged('isAddingNew');
            },
            _linkAddress: function(){
               var self = this, adrInfoEntity = this.currentAddressInfo, adrView = self.custAdressView, adrID;
               if (!adrInfoEntity){
                   alert('_linkAddress error: adrInfoEntity is null');
                   return;
               }
               adrID = adrInfoEntity.AddressID;
               var existedAddr = adrView.items.some(function(item){
                    return item.AddressID === adrID;
               });

               if (existedAddr){
                   alert('Customer already has this address!');
                   return;
               }

                //dont clear, append to the existing
                var promise = this._customerAddressVM._loadAddresses([adrID],false);
                promise.done(function(){
                    var address;
                    address = self._customerAddressVM.addressesDb.findByPK(adrID);
                    if (!!address){
                        self._customerAddressVM._addNewCustAddress(address);
                        //remove address from right panel
                        self._removeAddressRP(adrID);
                    }
                });
            },
            _unLinkAddress: function(){
                var item = this.custAdressView.currentItem;
                if (!item){
                    return;
                }
                var id = item.AddressID;
                if (item.deleteItem())//delete from left panel
                    //and then add address to the right panel (really adds addressInfo, not address entity)
                    this._addAddressRP(id);
            },
            //adds addressInfo to the right panel
            _addAddressRP: function (addressID) {
                //if address already on client, just make it be displayed in the view
                if (this._checkAddressInRP(addressID)){
                    var deferred = new global.$.Deferred();
                    deferred.reject();
                    return deferred.promise();
                }
                //if we are here, we need to load address from the server
                var self = this, query = this._addressInfosDb.createQuery('ReadAddressInfo');
                //dont clear, append to the existing
                query.isClearPrevData = false;
                query.where('AddressID', '=', [addressID]);
                var promise = this.dbContext.load(query);
                promise.done(function(){
                    self._checkAddressInRP(addressID);
                });
                return promise;
            },
            //make sure if addressInfo already on the client, adds it to the view
            _checkAddressInRP: function(addressID){
                //try to find it in the DbSet
                var item = this._addressInfosDb.findByPK(addressID);
                if (!!item)
                {
                    //if found, try append to the view
                    var appended = this._addressInfosView.appendItems([item]);
                    this._addressInfosView.currentItem = item;
                    if (!!this._adressInfosGrid)
                        this._adressInfosGrid.scrollToCurrent(true);
                }
                return !!item;
            },
            //remove address from the right panel (it is done, removing item from the view)
            _removeAddressRP: function(addressID){
                var item = this._addressInfosView.findByPK(addressID);
                if (!!item){
                    this._addressInfosView.removeItem(item);
                }
            },
            destroy:function () {
                if (this._isDestroyed)
                    return;
                if (!!this._addressInfosDb){
                    this._addressInfosDb.removeNSHandlers(this.uniqueID);
                    this._addressInfosDb.clear();
                    this._addressInfosDb = null;
                }
                if (!!this._addressInfosView){
                    this._addressInfosView.destroy();
                    this._addressInfosView = null;
                }
                this.custAdressView.removeNSHandlers(this.uniqueID);
                if (!!this._customerAddressVM){
                    this._customerAddressVM.removeNSHandlers(this.uniqueID);
                    this._customerAddressVM = null;
                }
                this._super();
            }
        },
        {
            dbContext: {
                get: function () {
                    return this.app.dbContext;
                }
            },
            addressInfosDb: {
                get: function () {
                    return this._addressInfosDb;
                }
            },
            addressInfosView: {
                get: function () {
                    return this._addressInfosView;
                }
            },
            addressesView: {
                get: function () {
                    return this._customerAddressVM._addressesView;
                }
            },
            custAdressView: {
                get: function () {
                    return this._customerAddressVM.custAdressView;
                }
            },
            currentAddressInfo: {
                get: function () {
                    return this._addressInfosView.currentItem;
                }
            },
            searchString: {
                set: function (v) {
                    if (this._searchString !== v){
                        this._searchString = v;
                        this.raisePropertyChanged('searchString');
                    }
                },
                get: function () {
                    return this._searchString;
                }
            },
            addNewCommand:{
                get:function () {
                    return this._addNewCommand;
                }
            },
            execSearchCommand:{
                get:function () {
                    return this._execSearchCommand;
                }
            },
            addNewAddressCommand:{
                get:function () {
                    return this._addNewAddressCommand;
                }
            },
            //links address to the customer
            linkCommand:{
                get:function () {
                    return this._linkCommand;
                }
            },
            //unlinks address from the customer
            unLinkCommand:{
                get:function () {
                    return this._unLinkCommand;
                }
            },
            newAddress:{
                get:function () {
                    return this._newAddress;
                }
            },
            customer:{
                get:function () {
                    return this._currentCustomer;
                }
            },
            isAddingNew:{
                get:function () {
                    return this._isAddingNew;
                }
            },
            propChangeCommand: {
                get: function () {
                    return this._propChangeCommand;
                }
            },
            searchToolTip: {
                get: function () {
                    return this._searchToolTip;
                }
            }
        },
        function (obj) {
            app.registerType('custom.AddAddressVM', obj);
        }
    );
});
