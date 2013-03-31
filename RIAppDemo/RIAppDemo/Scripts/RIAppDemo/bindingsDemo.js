RIAPP.Application.registerModule('bindingsDemoMod', function (app) {
    var global = app.global, utils = global.utils, consts = global.consts;
    var TEXT = RIAPP.localizable.TEXT;

    var UppercaseConverter = app.getConverter('BaseConverter').extend({
        convertToSource:function (val, param, dataContext) {
            if (utils.check_is.String(val))
                return val.toLowerCase();
            else
                return val;
        },
        convertToTarget:function (val, param, dataContext) {
            if (utils.check_is.String(val))
                return val.toUpperCase();
            else
                return val;
        }
    }, null, function (obj) {
        app.registerConverter('uppercaseConverter', obj);
    });

    /*
        Simple object with some properties, which can be bounded to UI elements on HTML page.
        P.S. - for validation error display support, this object must be decendant of BaseViewModel
        usage example: var TestObject = app.getType('BaseViewModel').extend(...
    */
    var TestObject = RIAPP.BaseObject.extend({
            _create: function (initPropValue) {
                this._super();
                var self = this;
                this._testProperty1 = initPropValue;
                this._testProperty2 = null;
                this._testCommand = app.getType('Command').create(function (sender, args) {
                    self._onTestCommandExecuted();
                }, self,
                 function (sender, args) {
                    //if this function return false, then command is disabled
                    return utils.check_is.String(self.testProperty1) && self.testProperty1.length > 3;
                });

                this._month = new Date().getMonth()+1;
                this._months = app.getType('Dictionary').create('MonthType',{key:0,val:''},'key');
                this._months.fillItems([{key:1,val:'January'},{key:2,val:'February'},{key:3,val:'March'},
                    {key:4,val:'April'},{key:5,val:'May'},{key:6,val:'June'},
                    {key:7,val:'July'},{key:8,val:'August'},{key:9,val:'September'},{key:10,val:'October'},
                    {key:11,val:'November'},{key:12,val:'December'}], true);

                this._format = 'PDF';
                this._formats = app.getType('Dictionary').create('format',{key:0,val:''},'key');
                this._formats.fillItems([{key:'PDF',val:'Acrobat Reader PDF'},{key:'WORD',val:'MS Word DOC'},{key:'EXCEL',val:'MS Excel XLS'}], true);
            },
            _onTestCommandExecuted: function(){
                alert(String.format("testProperty1:{0}, format:{1}, month: {2}",this.testProperty1,this.format,this.month));
            }
        },
        {
            testProperty1: {
                get: function () {
                    return this._testProperty1;
                },
                set: function (v) {
                    if (this._testProperty1 != v){
                        this._testProperty1 = v;
                        this.raisePropertyChanged('testProperty1');
                        //let command evaluate again its avalability
                        this._testCommand.raiseCanExecuteChanged();
                    }
                }
            },
            testProperty2: {
                get: function () {
                    return this._testProperty2;
                },
                set: function (v) {
                    if (this._testProperty2 != v){
                        this._testProperty2 = v;
                        this.raisePropertyChanged('testProperty2');
                    }
                }
            },
            testCommand:{
                get:function () {
                    return this._testCommand;
                }
            },
            testToolTip: {
                get:function () {
                    return "Click the button to execute command.<br/>" +
                        "P.S. <b>command is active when testProperty length > 3</b>";
                }
            },
            format:{
                set:function (v) {
                    if (this._format !== v){
                        this._format = v;
                        this.raisePropertyChanged('format');
                    }
                },
                get:function () {
                    return this._format;
                }
            },
            formats:{
                get:function () {
                    return this._formats;
                }
            },
            months:{
                get:function () {
                    return this._months;
                }
            },
            month:{
                set:function (v) {
                    if (v !== this._month){
                        this._month = v;
                        this.raisePropertyChanged('month');
                    }
                },
                get:function () {
                    return this._month;
                }
            }
        }, function (obj) {
            app.registerType('custom.TestObject', obj);
        });

});
