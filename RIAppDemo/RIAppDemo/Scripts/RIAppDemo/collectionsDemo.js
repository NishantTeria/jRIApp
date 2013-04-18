'use strict';
RIAPP.Application.registerModule('collectionsDemoModule', function (app) {
    var global = app.global, utils = global.utils, consts = global.consts;
    var TEXT = RIAPP.localizable.TEXT;

    var radioValueConverter = app.getType('BaseConverter').extend({
        convertToSource:function (val, param, dataContext) {
            return !!val?param:undefined;
        },
        convertToTarget:function (val, param, dataContext) {
            return (val == param)?true:false;
        }
    }, null, function (obj) {
        app.registerConverter('radioValueConverter', obj);
    });

    var RadioDemoVM = app.getType('BaseViewModel').extend({
            _create:function () {
                this._super();
                this._radioValue = 'radioValue1';
                //one property in dictionary  must be unique and used as key (its name does not matter )
                this._radioValues = app.getType('Dictionary').create('RadioValueType', ['key', 'value', 'comment'], 'key');
                this._radioValues.fillItems([{ key: 'radioValue1', value: 'This is some text value #1', comment: 'This is some comment for value #1' },
                    { key: 'radioValue2', value: 'This is some text value #2', comment: 'This is some comment for value #2' },
                    { key: 'radioValue3', value: 'This is some text value #3', comment: 'This is some comment for value #3' },
                    { key: 'radioValue4', value: 'This is some text value #4', comment: 'This is some comment for value #4' }], false);
            },
            //define one custom event (for example only)
            //it is not nessesary here, because we can monitor property change directly using addOnPropertyChange
            _getEventNames:function () {
                var base_events = this._super();
                return ['radio_value_changed'].concat(base_events);
            },
            //can be overriden in descendants as in his example
            _onRadioValueChanged: function(){
                this.raiseEvent('radio_value_changed',{value: this.radioValue})
            }
        },
        {
            radioValue:{
                set:function (v) {
                    if (this._radioValue !== v){
                        this._radioValue = v;
                        this.raisePropertyChanged('radioValue');
                        this._onRadioValueChanged();
                    }
                },
                get:function () {
                    return this._radioValue;
                }
            },
            radioValues:{
                get:function () {
                    return this._radioValues;
                }
            }
        },
        function (obj) {
            app.registerType('custom.RadioDemoVM', obj);
        });

    var RadioDemo2VM = RadioDemoVM.extend({
            _create:function (currentValue) {
                this._super();
                var self = this;
                if (!!currentValue)
                    this.radioValue = currentValue;
                this._historyList = app.getType('List').create('ListItemType', ['radioValue', 'time']);
                this._historyList.addOnPropertyChange('count',function(s,a){
                   self._clearListCommand.raiseCanExecuteChanged();
                },this.uniqueID);
                this._clearListCommand = app.getType('Command').create(function (sender, param) {
                   self.clearList();
                }, self, function (sender, param) {
                    return self._historyList.count > 0;
                });

            },
            //override the base method
            _onRadioValueChanged: function(){
                this._super();
                var item = this._historyList.addNew();
                item.radioValue = this.radioValue;
                item.time = new Date();
                item.endEdit();
            },
            clearList: function(){
              this._historyList.clear();
            }
        },
        {
            historyList:{
                get:function () {
                    return this._historyList;
                }
            },
            clearListCommand:{
                get:function () {
                    return this._clearListCommand;
                }
            }
        },
        function (obj) {
            app.registerType('custom.RadioDemo2VM', obj);
        });

});