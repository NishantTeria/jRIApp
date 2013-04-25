'use strict';
if (!window['RIAPP']) {
    var RIAPP = {};
}

RIAPP.ERRS = {
    ERR_APP_NEED_JQUERY: 'The project is dependent on JQuery',
    ERR_ASSERTION_FAILED:'Assertion "{0}" check Has NOT been passed',
    ERR_DBSET_READONLY:'DbSet: {0} is readOnly and can not be edited',
    ERR_DBSET_INVALID_FIELDNAME:'DbSet: {0} has no field with the name: {1}',
    ERR_FIELD_READONLY:'Field is readOnly and can not be edited',
    ERR_FIELD_ISNOT_NULLABLE:'Field is not nullable and can not be set to null',
    ERR_FIELD_WRONG_TYPE:'Value: {0} can not be assigned to {1} type field',
    ERR_FIELD_MAXLEN:'Value exceeds field maxlength: {0}',
    ERR_FIELD_DATATYPE:'Unknown field data type: {0}',
    ERR_FIELD_REGEX:'Value {0} can not be accepted as the right value for this field',
    ERR_FIELD_RANGE:'Value {0} is outside the allowed range {1} for this field',
    ERR_EVENT_INVALID:'Invalid event name: {0}',
    ERR_EVENT_INVALID_FUNC:'Invalid event function value',
    ERR_MODULE_UNDEFINED:'User module: {0} is undefined',
    ERR_PROP_NAME_EMPTY:'Empty property name parameter',
    ERR_GLOBAL_SINGLTON:'There must be only one instance of Global object',
    ERR_OBJ_ALREADY_REGISTERED:'Object with the name: {0} is already registered in the type system',
    ERR_TEMPLATE_ALREADY_REGISTERED:'TEMPLATE with the name: {0} is already registered',
    ERR_TEMPLATE_NOTREGISTERED:'TEMPLATE with the name: {0} is not registered',
    ERR_TEMPLATE_GROUP_NOTREGISTERED:'TEMPLATE\'s group: {0} is not registered',
    ERR_CONVERTER_NOTREGISTERED:'Converter: {0} is not registered',
    ERR_JQUERY_DATEPICKER_NOTFOUND:'Application is dependent on JQuery.UI.datepicker',
    ERR_PARAM_INVALID:'Parameter: {0} has invalid value: {1}',
    ERR_PARAM_INVALID_TYPE:'Parameter: {0} has invalid type. Must be {1}',
    ERR_KEY_IS_EMPTY:'Key value must not be empty',
    ERR_KEY_IS_NOTFOUND:'Can not find item with the key: {0}',
    ERR_ITEM_IS_ATTACHED:'Operation invalid, reason: Item already has been attached',
    ERR_ITEM_IS_DETACHED:'Operation invalid, reason: Item is detached',
    ERR_ITEM_IS_NOTFOUND:'Operation invalid, reason: Item is not found',
    ERR_ITEM_NAME_COLLISION:'The "{0}" DbSet\'s field name: "{1}" is invalid, because a property with that name already exists on the entity type.',
    ERR_DICTKEY_IS_NOTFOUND:"Dictionary keyName: {0} does not exist in item's properties",
    ERR_DICTKEY_IS_EMPTY:'Dictionary key property: {0} must be not empty',
    ERR_CONV_INVALID_DATE:'Converter cannot parse datetime string value: {0}',
    ERR_CONV_INVALID_NUM:'Converter cannot parse numeric string value: {0}',
    ERR_QUERY_NAME_NOTFOUND:'Can not find Query with the name: {0}',
    ERR_QUERY_BETWEEN:'"BETWEEN" Query operator expects two values',
    ERR_QUERY_OPERATOR_INVALID:'Invalid query operator {0}',
    ERR_OPER_REFRESH_INVALID:'Refresh operation can not be done with items in Detached or Added State',
    ERR_CALC_FIELD_DEFINE:'Field: "{0}" definition error: Calculated fields can be dependent only on items fields',
    ERR_CALC_FIELD_SELF_DEPEND:'Field: "{0}" definition error: Calculated fields can not be dependent on themselves',
    ERR_DOMAIN_CONTEXT_INITIALIZED:'DbContext already initialized',
    ERR_DOMAIN_CONTEXT_NOT_INITIALIZED:'DbContext is not initialized',
    ERR_SVC_METH_PARAM_INVALID:'Invalid parameter {0} value {1} for service method: {2} invocation',
    ERR_DB_LOAD_NO_QUERY:'Query parameter is not supplied',
    ERR_DBSET_NAME_INVALID:'Invalid dbSet Name: {0}',
    ERR_APP_NAME_NOT_UNIQUE:'Application instance with the name: {0} already exists',
    ERR_ELVIEW_NOT_REGISTERED:'Can not find registered element view with the name: {0}',
    ERR_ELVIEW_NOT_CREATED:'Can not create element view for element with Tag Name: {0}',
    ERR_BIND_TARGET_EMPTY:'Binding target is empty',
    ERR_BIND_TGTPATH_INVALID:'Binding targetPath has invalid value: {0}',
    ERR_BIND_MODE_INVALID:'Binding mode has invalid value: {0}',
    ERR_BIND_TARGET_INVALID:'Binding target must be a descendant of BaseObject',
    ERR_APP_SETUP_INVALID:'Application\'s setUp method parameter must be a valid function',
    ERR_GRID_DATASRC_INVALID:'DataGrid\'s datasource must be a descendant of Collection type',
    ERR_COLLECTION_CHANGETYPE_INVALID:'Invalid Collection change type value: {0}',
    ERR_GRID_COLTYPE_INVALID:'Invalid Column type type value: {0}',
    ERR_PAGER_DATASRC_INVALID:'Pager datasource must be a descendant of Collection type',
    ERR_STACKPNL_DATASRC_INVALID:'StackPanel datasource must be a descendant of Collection type',
    ERR_STACKPNL_TEMPLATE_INVALID:'StackPanel templateID is not provided in the options',
    ERR_LISTBOX_DATASRC_INVALID:'ListBox datasource must be a descendant of Collection type',
    ERR_DATAFRM_DCTX_INVALID:'DataForm\'s dataContext must be a descendant of BaseObject type',
    ERR_DCTX_HAS_NO_FIELDINFO:'DataContext has no getFieldInfo method',
    ERR_TEMPLATE_ID_INVALID:'Element can not be found by TemplateID: {0}',
    ERR_STRING_FORMAT_INVALID:'String format has invalid expression value: {0}',
    ERR_ITEM_DELETED_BY_ANOTHER_USER:'The record was deleted by another user',
    ERR_ACCESS_DENIED:'The access is denied. Please, ask administrator to assign user rights to your account.',
    ERR_CONCURRENCY:'The record has been modified by another user. Please, refresh record before editing.',
    ERR_VALIDATION:'Data validation error',
    ERR_SVC_VALIDATION:'Data validation error: {0}',
    ERR_SVC_ERROR:'Service error: {0}',
    ERR_UNEXPECTED_SVC_ERROR:'Unexpected service error: {0}',
    ERR_ASSOC_NAME_INVALID:'Invalid association name: {0}',
    ERR_DATAVIEW_DATASRC_INVALID:'DataView datasource must not be null and should be descendant of Collection type',
    ERR_DATAVIEW_FILTER_INVALID:'DataView fn_filter option must be valid function which accepts entity and returns bool value'
};

RIAPP.localizable = (function () {
    var locale = {};
    locale.PAGER = {
        firstText:'<<',
        lastText:'>>',
        previousText:'<',
        nextText:'>',
        pageInfo:'Страница {0} of {1}',
        firstPageTip:'на первую',
        prevPageTip:'на страницу {0}',
        nextPageTip:'на страницу {0}',
        lastPageTip:'на последнюю',
        showingTip:'записи от {0} до {1} из {2}',
        showTip:'показать от {0} до {1} из {2}'
    };

    locale.VALIDATE = {
        errorInfo:'Некорректные данные:',
        errorField:'поле:'
    };

    locale.TEXT = {
        txtEdit:'Редактировать',
        txtAddNew:'Добавить новую',
        txtDelete:'Удалить',
        txtCancel:'Отмена',
        txtOk:'Ok',
        txtRefresh:'Обновить',
        txtAskDelete:'Вы уверены, что хотите удалить запись?',
        txtSubmitting: 'Отправка данных на сервер ...',
        txtSave: 'Сохранить',
        txtClose: 'Закрыть',
        txtField: 'Поле'
    };

    return locale;
})();
