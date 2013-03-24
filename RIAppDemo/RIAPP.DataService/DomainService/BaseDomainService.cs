using System;
using System.Collections.Generic;
using System.Collections.Concurrent;
using System.Linq;
using System.Text;
using System.Security.Principal;
using System.Linq.DynamicQuery;
using System.Reflection;
using System.Collections;
using StaThreadSyncronizer;
using RIAPP.DataService.Resources;
using RIAPP.DataService.Utils;
using RIAPP.DataService.Security;

namespace RIAPP.DataService
{
    public abstract class BaseDomainService: IDomainService
    {
        #region private members
        private static StaSynchronizationContext _synchronizer = new StaSynchronizationContext();
        private static MetadataCache _metadataCache = new MetadataCache();
        private static ConcurrentDictionary<Type, List<MethodDescription>> _tInvokesInfo = new ConcurrentDictionary<Type, List<MethodDescription>>();
        private static IShrededRequestManager _shrededRequestManager = new ShrededRequestManager();

        private ServiceMetadata _serviceMetadata;
        private ChangeSet _currentChangeSet;
        protected DbSet _currentDbSet;
        protected RowInfo _currentRowInfo;
        private ServiceOperationType _currentOperation;
        private IPrincipal _principal;
        private IAuthorizer _authorizer;

        protected IAuthorizer authorizer
        {
            get
            {
                if (this._authorizer == null)
                    this._authorizer = this.GetAuthorizer();
                return this._authorizer;
            }
        }
        #endregion

        public static string GetMetadata<T>(IPrincipal principal)
            where T:BaseDomainService
        {
            using (IDomainService svc = (IDomainService)Activator.CreateInstance(typeof(T), principal))
            {
                var info = svc.ServiceGetMetadata();
                return info.ToJSON();
            }
        }

        public BaseDomainService(IPrincipal principal)
        {
            this._principal = principal;
        }

      
        /// <summary>
        /// Utility method to obtain data from service query method
        /// mainly used to embed data on page load, and fill classifiers for lookup data
        /// </summary>
        /// <param name="dbSetName"></param>
        /// <param name="queryName"></param>
        /// <returns></returns>
        public GetDataResult GetQueryData(string dbSetName, string queryName)
        {
            GetDataInfo getInfo = new GetDataInfo { dbSetName = dbSetName, queryName = queryName };
            return ServiceGetData(getInfo);
        }

        protected IPrincipal CurrentPrincipal
        {
            get { return this._principal; }
        }

        protected ServiceOperationType CurrentOperation
        {
            get { return _currentOperation; }
        }

        protected ChangeSet CurrentChangeSet
        {
            get { return _currentChangeSet; }
        }

        protected EntityChangeState CurrentChangeState
        {
            get { return this._currentRowInfo.changeState; }
        }

        #region Helper Methods

        protected IEnumerable<Row> CreateRows(DbSetInfo dbSetInfo, IEnumerable<object> dataSource, int rowCount)
        {
            var fields = dbSetInfo.fieldInfos.Where(f => f._isIncludeInResult).OrderBy(f => f._ordinal).ToArray();
            int fieldsCnt = fields.Length;
            FieldInfo[] pkInfos = DataHelper.GetPKFieldInfos(dbSetInfo);
            Row[] rows = new Row[rowCount];

            int counter = 0;
            foreach (object entity in dataSource)
            {
                Row row = new Row();
                string[] pk = new string[pkInfos.Length];
                for (int i = 0; i < fieldsCnt; ++i)
                {
                    string fv = null;
                    FieldInfo fld = fields[i];

                    fv = DataHelper.GetFieldValueAsString(entity, fld.fieldName);
                  
                    int keyIndex = Array.IndexOf(pkInfos, fld);
                    if (keyIndex > -1)
                    {
                        pk[keyIndex] = fv;
                    }
                    row.values.Add(fv);
                }
                row.key = string.Join(";", pk);
                rows[counter] = row;
                ++counter;
            }
            return rows;
        }

      
        protected IEnumerable<IncludedResult> CreateIncludedResults(DbSetInfo dbSetInfo, IEnumerable<object> entities, string[] includePaths)
        {
            if (includePaths.Length == 0)
                return Enumerable.Empty<IncludedResult>();
            Dictionary<string, IncludedResult> visited = new Dictionary<string, IncludedResult>();
            var metadata = this.EnsureMetadataInitialized();
            foreach (string includePath in includePaths)
            {
                string[] pathParts = includePath.Split('.');
                string[] nextParts = pathParts.Skip(1).ToArray();
                this.CreateIncludedResult(dbSetInfo, entities, pathParts[0], nextParts, visited);
            }
            return visited.Values;
        }

        private void CreateIncludedResult(DbSetInfo dbSetInfo, IEnumerable<object> inputEntities, string propertyName, string[] nextParts, Dictionary<string, IncludedResult> visited)
        {
            var metadata = this.EnsureMetadataInitialized();
            bool isChildProperty = false;
            DbSetInfo nextDbSetInfo = null;
            var assoc = metadata.associations.Values.Where(a=>a.parentDbSetName == dbSetInfo.dbSetName && a.parentToChildrenName == propertyName).FirstOrDefault();
            if (assoc != null)
            {
                isChildProperty = true;
                nextDbSetInfo = metadata.dbSets[assoc.childDbSetName];
            }
            else
            {
                assoc = metadata.associations.Values.Where(a => a.childDbSetName == dbSetInfo.dbSetName && a.childToParentName == propertyName).FirstOrDefault();
                if (assoc == null)
                {
                    throw new DomainServiceException(string.Format(ErrorStrings.ERR_INCL_NAVIG_INVALID,propertyName+(nextParts.Length>0?("."+string.Join(".",nextParts)):"")));
                } 
                
                nextDbSetInfo = metadata.dbSets[assoc.parentDbSetName];
            }
            if (visited.ContainsKey(nextDbSetInfo.dbSetName + "." + propertyName))
                return;

            int rowCount = 0;
            object propValue;
            LinkedList<object> resultEntities = new LinkedList<object>();
            foreach(object entity in inputEntities)
            {
                propValue = DataHelper.GetProperty(entity, propertyName);
                if (isChildProperty && propValue is IEnumerable)
                {
                    foreach (object childEntity in (IEnumerable)propValue)
                    {
                        resultEntities.AddLast(childEntity);
                        ++rowCount;
                    }
                }
                else if (!isChildProperty && propValue != null)
                {
                    resultEntities.AddLast(propValue);
                    ++rowCount;
                }
            }

            //create temporary result without rows
            //fills rows at the end of the method
            IncludedResult current = new IncludedResult { dbSetName = nextDbSetInfo.dbSetName, rows = new Row[0], names = nextDbSetInfo.fieldInfos.Where(f => f._isIncludeInResult).OrderBy(f => f._ordinal).Select(fi => fi.fieldName) };
            visited.Add(nextDbSetInfo.dbSetName + "." + propertyName, current);

            if (nextParts.Length>0)
                this.CreateIncludedResult(nextDbSetInfo, resultEntities, nextParts[0], nextParts.Skip(1).ToArray(), visited);

            //map rows by PK
            Dictionary<string, Row> rows = new Dictionary<string, Row>(rowCount);
            var fields = nextDbSetInfo.fieldInfos.Where(f => f._isIncludeInResult).OrderBy(f => f._ordinal).ToArray();
            int fieldCnt = fields.Length;
            FieldInfo[] pkInfos = DataHelper.GetPKFieldInfos(nextDbSetInfo);
            int counter = 0;
            foreach (object entity in resultEntities)
            {
                Row row = new Row();
                string[] pk = new string[pkInfos.Length];
                for (int i = 0; i < fieldCnt; ++i)
                {
                    string fv = null;
                    FieldInfo fld = fields[i];

                    fv = DataHelper.GetFieldValueAsString(entity, fld.fieldName);

                    int keyIndex = Array.IndexOf(pkInfos, fld);
                    if (keyIndex > -1)
                    {
                        pk[keyIndex] = fv;
                    }
                    row.values.Add(fv);
                }
                row.key = string.Join(";", pk);
                //here we filter out repeated rows
                if (!rows.ContainsKey(row.key))
                {
                    rows.Add(row.key, row);
                    ++counter;
                }
            }

            current.rows = rows.Values;
        }
        
        protected ServiceMetadata EnsureMetadataInitialized()
        {
            Func<ServiceMetadata> factory = () => { _synchronizer.Send(InitMetadata, this); return this._serviceMetadata; };
            System.Threading.LazyInitializer.EnsureInitialized<ServiceMetadata>(ref this._serviceMetadata, factory);
            return this._serviceMetadata;
        }

        private void InitMetadata(object state)
        {
            BaseDomainService self = (BaseDomainService)state;
            ServiceMetadata metadata = null;
            if (BaseDomainService._metadataCache.TryGetValue(self.GetType(), out metadata))
            {
                self._serviceMetadata = metadata;
                return;
            }
            var metadataInfo = self.GetMetadata();
            metadata = new ServiceMetadata();
            foreach (var dbSetInfo in metadataInfo.DbSets)
            {
                dbSetInfo.Initialize(self.GetType());
                //indexed by dbSetName
                metadata.dbSets.Add(dbSetInfo.dbSetName, dbSetInfo);
            }

            foreach (var assoc in metadataInfo.Associations)
            {
                if (string.IsNullOrWhiteSpace(assoc.name))
                {
                    throw new DomainServiceException(ErrorStrings.ERR_ASSOC_EMPTY_NAME);
                }
                if (!metadata.dbSets.ContainsKey(assoc.parentDbSetName)) 
                {
                    throw new DomainServiceException(string.Format(ErrorStrings.ERR_ASSOC_INVALID_PARENT,assoc.name, assoc.parentDbSetName));
                }
                if (!metadata.dbSets.ContainsKey(assoc.childDbSetName))
                {
                    throw new DomainServiceException(string.Format(ErrorStrings.ERR_ASSOC_INVALID_CHILD, assoc.name, assoc.childDbSetName));
                }
                var childDb = metadata.dbSets[assoc.childDbSetName];
                var parentDb = metadata.dbSets[assoc.parentDbSetName];
                var parentDbFields = parentDb.GetFieldByNames();
                var childDbFields = childDb.GetFieldByNames();

                //check navigation field
                //dont allow to define  it explicitly, the association adds the field by itself (implicitly)
                if (!string.IsNullOrEmpty(assoc.childToParentName) && childDbFields.ContainsKey(assoc.childToParentName))
                {
                    throw new DomainServiceException(string.Format(ErrorStrings.ERR_ASSOC_INVALID_NAV_FIELD, assoc.name, assoc.childToParentName));
                }

                //check navigation field
                //dont allow to define  it explicitly, the association adds the field by itself (implicitly)
                if (!string.IsNullOrEmpty(assoc.parentToChildrenName) && parentDbFields.ContainsKey(assoc.parentToChildrenName))
                {
                    throw new DomainServiceException(string.Format(ErrorStrings.ERR_ASSOC_INVALID_NAV_FIELD, assoc.name, assoc.parentToChildrenName));
                }

                if (!string.IsNullOrEmpty(assoc.parentToChildrenName) && !string.IsNullOrEmpty(assoc.childToParentName) && assoc.childToParentName == assoc.parentToChildrenName)
                {
                    throw new DomainServiceException(string.Format(ErrorStrings.ERR_ASSOC_INVALID_NAV_FIELD, assoc.name, assoc.parentToChildrenName));
                }

                foreach (var frel in assoc.fieldRels)
                {
                    if (!parentDbFields.ContainsKey(frel.parentField))
                    {
                        throw new DomainServiceException(string.Format(ErrorStrings.ERR_ASSOC_INVALID_PARENT_FIELD, assoc.name, frel.parentField));
                    }
                    if (!childDbFields.ContainsKey(frel.childField))
                    {
                        throw new DomainServiceException(string.Format(ErrorStrings.ERR_ASSOC_INVALID_CHILD_FIELD, assoc.name, frel.childField));
                    }
                }
                //indexed by Name
                metadata.associations.Add(assoc.name, assoc);

                if (!string.IsNullOrEmpty(assoc.childToParentName))
                {
                    var sb = new System.Text.StringBuilder(120);
                    var dependentOn = assoc.fieldRels.Aggregate(sb, (a, b) => a.Append((a.Length == 0 ? "" : ",") + b.childField), a => a).ToString();
                    //add navigation field to dbSet's field collection
                    childDb.fieldInfos.Add(new FieldInfo() { fieldName= assoc.childToParentName, isNavigation= true, isClientOnly= true, dataType = DataType.None, dependentOn = dependentOn});
                }

                if (!string.IsNullOrEmpty(assoc.parentToChildrenName))
                {
                    var sb = new System.Text.StringBuilder(120);
                    //add navigation field to dbSet's field collection
                    parentDb.fieldInfos.Add(new FieldInfo() { fieldName = assoc.parentToChildrenName, isNavigation = true, isClientOnly = true, dataType = DataType.None });
                }
            }
            metadata.methodDescriptions = BaseDomainService.GetMethodDescriptions(self.GetType());
            self._serviceMetadata = metadata;
            BaseDomainService._metadataCache.TryAdd(self.GetType(), metadata);
        }

        protected MethodInfo GetMethodInfo(string name)
        {
            Type thisType = this.GetType();
            return DataHelper.GetMethodInfo(thisType, name);
        }

        protected MethodInfo GetOperMethodInfo(DbSetInfo dbSetInfo, string oper)
        {
            return dbSetInfo.getOperationMethodInfo(oper);
        }

        /// <summary>
        /// Test if public methods on the service has Invoke or Query Attribute
        /// and generates from this methods their invocation method descriptions 
        /// </summary>
        /// <returns></returns>
        private static List<MethodDescription> GetMethodDescriptions(Type thisType)
        {
             List<MethodDescription> res;
             if (BaseDomainService._tInvokesInfo.TryGetValue(thisType, out res))
                return res;
             res = new List<MethodDescription>();
             var methList = thisType.GetMethods(BindingFlags.Instance | BindingFlags.DeclaredOnly | BindingFlags.Public).Select(m => new { method = m, isQuery = m.IsDefined(typeof(QueryAttribute), false), isInvoke = m.IsDefined(typeof(InvokeAttribute), false) }).Where(m=>(m.isInvoke || m.isQuery)).ToArray();
             Array.ForEach(methList,(info) => {
                 res.Add(MethodDescription.FromMethodInfo(info.method, info.isQuery));
            });
            BaseDomainService._tInvokesInfo.TryAdd(thisType, res);
            return res;
        }

        protected static void UpdateEntityFromRowInfo(object entity, RowInfo rowInfo, bool isOriginal)
        {
            DbSetInfo dbSetInfo = rowInfo.dbSetInfo;
            var values = rowInfo.values;
            var flds = dbSetInfo.GetFieldByNames();
          
            foreach (ValueChange fv in values)
            {
                FieldInfo finfo = flds[fv.fieldName];
           
                if (!finfo._isIncludeInResult)
                    continue;
                if (isOriginal){
                    if ((fv.flags & ValueFlags.Setted) == ValueFlags.Setted)
                        DataHelper.SetValue(entity, finfo, fv.orig);
                }
                else
                {
                    switch (rowInfo.changeType)
                    {
                        case ChangeType.Deleted:
                            {
                                //For delete fill only original values
                                if ((fv.flags & ValueFlags.Setted) == ValueFlags.Setted)
                                    DataHelper.SetValue(entity, finfo, fv.orig);
                            }
                            break;
                        case ChangeType.Added:
                            {
                                if (finfo.isAutoGenerated)
                                    continue;
                                if ((fv.flags & ValueFlags.Changed) == ValueFlags.Changed)
                                {
                                    if (finfo.isReadOnly && fv.val != null && !finfo.allowClientDefault)
                                    {
                                        throw new DomainServiceException(string.Format(ErrorStrings.ERR_PROPERTY_IS_READONLY, finfo.fieldName));
                                    }
                                    if (finfo.isAutoGenerated && fv.val != null)
                                    {
                                        throw new DomainServiceException(string.Format(ErrorStrings.ERR_PROPERTY_IS_READONLY, finfo.fieldName));
                                    }
                                    DataHelper.SetValue(entity, finfo, fv.val);
                                }
                            }
                            break;
                        case ChangeType.Updated:
                            {
                                if ((fv.flags & ValueFlags.Changed) == ValueFlags.Changed)
                                {
                                    if (finfo.isReadOnly || (finfo.isPrimaryKey > 0 || finfo.isRowTimeStamp || finfo.isAutoGenerated))
                                        throw new DomainServiceException(string.Format(ErrorStrings.ERR_PROPERTY_IS_READONLY, finfo.fieldName));
                                    if (!finfo.isNullable && fv.val == null)
                                    {
                                        throw new DomainServiceException(string.Format(ErrorStrings.ERR_FIELD_IS_NOT_NULLABLE, finfo.fieldName));
                                    }
                                    DataHelper.SetValue(entity, finfo, fv.val);
                                }
                                else if ((fv.flags & ValueFlags.Setted) == ValueFlags.Setted)
                                {
                                    if ((finfo.isPrimaryKey > 0 || finfo.isRowTimeStamp || finfo.isNeedOriginal) && fv.val != fv.orig)
                                    {
                                        throw new DomainServiceException(string.Format(ErrorStrings.ERR_VAL_ORIGINAL_INVALID, finfo.fieldName));
                                    }
                                    DataHelper.SetValue(entity, finfo, fv.val);
                                }
                            }
                            break;
                    }
                }
            }

            if (!isOriginal && rowInfo.changeType == ChangeType.Added)
            {
                foreach (var pn in rowInfo.changeState.ParentRows)
                {
                    if (!DataHelper.SetProperty(entity, pn.association.childToParentName, pn.ParentRow.changeState.Entity))
                    {
                        throw new DomainServiceException(string.Format(ErrorStrings.ERR_CAN_NOT_SET_PARENT_FIELD, pn.association.childToParentName, rowInfo.dbSetInfo.EntityType.Name));
                    }
                }
            }
        }

        protected static  void UpdateRowInfoFromEntity(object entity, RowInfo rowInfo)
        {
            DbSetInfo dbSetInfo = rowInfo.dbSetInfo;
            var values = rowInfo.values;
            var fields = dbSetInfo.GetFieldByNames();

            values.ForEach((fv) =>
            {
                FieldInfo finfo = fields[fv.fieldName];
                if (!finfo._isIncludeInResult)
                    return;
                fv.val = DataHelper.GetFieldValueAsString(entity, finfo.fieldName);
                fv.flags = fv.flags | ValueFlags.Refreshed;
            });

            if (rowInfo.changeType == ChangeType.Added)
            {
                rowInfo.serverKey = rowInfo.GetRowKeyAsString(dbSetInfo);
            }

        }

        private static bool isEntityValueChanged(RowInfo rowInfo, string fieldName, out string newVal) 
        {
            EntityChangeState changeState = rowInfo.changeState;
            string oldVal = null;
            newVal = DataHelper.GetFieldValueAsString(changeState.Entity, fieldName);
            if (changeState.OriginalEntity != null)
                oldVal = DataHelper.GetFieldValueAsString(changeState.OriginalEntity, fieldName);
            return (newVal != oldVal);
        }

        protected static void UpdateRowInfoAfterUpdates(RowInfo rowInfo)
        {
            DbSetInfo dbSetInfo = rowInfo.dbSetInfo;
            var fields = dbSetInfo.GetFieldByNames();

            rowInfo.values.ForEach((fv) =>
            {
                FieldInfo finfo = fields[fv.fieldName];
                if (!finfo._isIncludeInResult)
                    return;
                string newVal;
                if (isEntityValueChanged(rowInfo, finfo.fieldName, out newVal))
                {
                    fv.val = newVal;
                    fv.flags = fv.flags | ValueFlags.Refreshed;
                }
            });

            if (rowInfo.changeType == ChangeType.Added)
            {
                rowInfo.serverKey = rowInfo.GetRowKeyAsString(dbSetInfo);
            }

        }
    
        protected T GetOriginal<T>()
            where T : class
        {
            if (this._currentRowInfo == null) {
                throw new DomainServiceException(ErrorStrings.ERR_METH_APPLY_INVALID);
            }
            return (T)this._currentRowInfo.changeState.OriginalEntity;
        }

        private object GetOriginal(object entity)
        {
            object dbEntity = Activator.CreateInstance(entity.GetType());
            UpdateEntityFromRowInfo(dbEntity, this._currentRowInfo, true);
            return dbEntity;
        }

        protected T GetParent<T>()
            where T : class
        {
            if (this._currentRowInfo == null)
            {
                throw new DomainServiceException(ErrorStrings.ERR_METH_APPLY_INVALID);
            }
            var parents = this._currentRowInfo.changeState.ParentRows;
            if (parents.Length == 0)
                return (T)null;

            return (T)parents.Where(p => p.ParentRow.dbSetInfo.EntityType == typeof(T)).Select(p => p.ParentRow.changeState.Entity).FirstOrDefault();
        }

        protected void InsertEntity(RowInfo rowInfo)
        {
            DbSetInfo dbSetInfo = rowInfo.dbSetInfo;
            if (rowInfo.changeType != ChangeType.Added)
                throw new DomainServiceException(string.Format(ErrorStrings.ERR_REC_CHANGETYPE_INVALID, dbSetInfo.EntityType.Name, rowInfo.changeType));
            MethodInfo methInfo = this.GetOperMethodInfo(dbSetInfo, OperationNames.CREATE);
            if (methInfo == null)
                throw new DomainServiceException(string.Format(ErrorStrings.ERR_DB_INSERT_NOT_IMPLEMENTED, dbSetInfo.EntityType.Name, this.GetType().Name));
            object dbEntity = Activator.CreateInstance(dbSetInfo.EntityType);
            UpdateEntityFromRowInfo(dbEntity, rowInfo, false);
            rowInfo.changeState.Entity = dbEntity;
            methInfo.Invoke(this, new object[] { dbEntity });
        }

        protected void UpdateEntity(RowInfo rowInfo)
        {
            DbSetInfo dbSetInfo = rowInfo.dbSetInfo;
            if (rowInfo.changeType != ChangeType.Updated)
                throw new DomainServiceException(string.Format(ErrorStrings.ERR_REC_CHANGETYPE_INVALID, dbSetInfo.EntityType.Name, rowInfo.changeType));
            MethodInfo methInfo = this.GetOperMethodInfo(dbSetInfo, OperationNames.UPDATE);
            if (methInfo == null)
                throw new DomainServiceException(string.Format(ErrorStrings.ERR_DB_UPDATE_NOT_IMPLEMENTED, dbSetInfo.EntityType.Name, this.GetType().Name));
            object dbEntity = Activator.CreateInstance(dbSetInfo.EntityType);
            UpdateEntityFromRowInfo(dbEntity, this._currentRowInfo, false);
            var original = this.GetOriginal(dbEntity);
            rowInfo.changeState.Entity = dbEntity;
            rowInfo.changeState.OriginalEntity = original;
            //apply this changes to entity that is in the database (this is done in user domain service method)
            methInfo.Invoke(this, new object[] { dbEntity });
        }

        protected void DeleteEntity(RowInfo rowInfo)
        {
            DbSetInfo dbSetInfo = rowInfo.dbSetInfo;
            if (rowInfo.changeType != ChangeType.Deleted)
                throw new DomainServiceException(string.Format(ErrorStrings.ERR_REC_CHANGETYPE_INVALID, dbSetInfo.EntityType.Name, rowInfo.changeType));
          
            MethodInfo methInfo = this.GetOperMethodInfo(dbSetInfo, OperationNames.DELETE);
            if (methInfo == null)
                throw new DomainServiceException(string.Format(ErrorStrings.ERR_DB_DELETE_NOT_IMPLEMENTED, dbSetInfo.EntityType.Name, this.GetType().Name));

            object dbEntity = Activator.CreateInstance(dbSetInfo.EntityType);
            UpdateEntityFromRowInfo(dbEntity, this._currentRowInfo, true);
            rowInfo.changeState.Entity = dbEntity;
            rowInfo.changeState.OriginalEntity = dbEntity;
            methInfo.Invoke(this, new object[] { dbEntity });
        }

        protected bool ValidateEntity(RowInfo rowInfo)
        {
            DbSetInfo dbSetInfo = rowInfo.dbSetInfo;
            IEnumerable<ValidationErrorInfo> errs = null;
            LinkedList<string> mustBeChecked = new LinkedList<string>();
            LinkedList<string> skipCheckList = null;
            if (rowInfo.changeType == ChangeType.Added)
            {
                skipCheckList = new LinkedList<string>();
                foreach (var pn in rowInfo.changeState.ParentRows)
                {
                    foreach (var frel in pn.association.fieldRels)
                    {
                        skipCheckList.AddLast(frel.childField);
                    }
                }
            }

            foreach (var fieldInfo in dbSetInfo.fieldInfos)
            {
                if (!fieldInfo._isIncludeInResult)
                    continue;
                string value = DataHelper.GetFieldValueAsString(rowInfo.changeState.Entity, fieldInfo.fieldName);
                if (rowInfo.changeType == ChangeType.Added)
                {
                    bool isSkip = fieldInfo.isAutoGenerated || (skipCheckList != null && skipCheckList.Any(n => n == fieldInfo.fieldName));
                    if (!isSkip) 
                    {
                        ValidationHelper.CheckValue(fieldInfo, value);
                        mustBeChecked.AddLast(fieldInfo.fieldName);
                    }
                }
                else if (rowInfo.changeType == ChangeType.Updated) {
                    string newVal;
                    bool isChanged = isEntityValueChanged(rowInfo, fieldInfo.fieldName, out newVal);
                    if (isChanged) {
                       ValidationHelper.CheckValue(fieldInfo, newVal);
                    }
                    if (isChanged)
                        mustBeChecked.AddLast(fieldInfo.fieldName);
                }

                
            }

            rowInfo.changeState.NamesOfChangedFields = mustBeChecked.ToArray();
            MethodInfo methInfo = this.GetOperMethodInfo(dbSetInfo, OperationNames.VALIDATE);
            if (methInfo != null)
            {
                errs = (IEnumerable<ValidationErrorInfo>)methInfo.Invoke(this, new object[] { rowInfo.changeState.Entity, rowInfo.changeState.NamesOfChangedFields });
            }
            
            if (errs != null && errs.Count() > 0)
            {
                rowInfo.changeState.ValidationErrors = errs.ToArray();
                return false;
            }

            return true;
        }
        #endregion

        #region Overridable Methods
        protected abstract Metadata GetMetadata();

        protected virtual IAuthorizer GetAuthorizer()
        {
            return new Authorizer(this.GetType(), this.CurrentPrincipal);
        }

        /// <summary>
        /// Can be used for tracking what is changed by CRUD methods
        /// </summary>
        /// <param name="dbSetName">name of the entity which is currently tracked</param>
        /// <param name="changeType">enum meaning which CRUD method was invoked</param>
        /// <param name="diffgram">xml representing values as was before and after CRUD operation</param>
        protected virtual void OnTrackChange(string dbSetName, ChangeType changeType, string diffgram) 
        { 
        }

        protected virtual void OnError(Exception ex)
        {
        }
     
        protected abstract void ExecuteChangeSet();

        protected virtual void ApplyChangesToEntity(RowInfo rowInfo)
        {
            DbSetInfo dbSetInfo = rowInfo.dbSetInfo;
            if (dbSetInfo.EntityType == null)
                throw new DomainServiceException(string.Format(ErrorStrings.ERR_DB_ENTITYTYPE_INVALID, dbSetInfo.dbSetName));
            try
            {
                switch (rowInfo.changeType)
                {
                    case ChangeType.Added:
                        this.InsertEntity(rowInfo);
                        break;
                    case ChangeType.Deleted:
                        this.DeleteEntity(rowInfo);
                        break;
                    case ChangeType.Updated:
                        this.UpdateEntity(rowInfo);
                        break;
                    default:
                        throw new DomainServiceException(string.Format(ErrorStrings.ERR_REC_CHANGETYPE_INVALID, dbSetInfo.EntityType.Name, rowInfo.changeType));
                }
            }
            catch (Exception ex)
            {
                object dbEntity = rowInfo.changeState == null ? null : rowInfo.changeState.Entity;
                rowInfo.changeState = new EntityChangeState { Entity = dbEntity, Error = ex };
                this.OnError(ex);
                throw;
            }
        }

        protected virtual void TrackChangesToEntity(RowInfo rowInfo)
        {
            if (!rowInfo.dbSetInfo.isTrackChanges)
                return;
            try
            {
                string diffgram = DiffGram.GetDiffGram(rowInfo.changeState.OriginalEntity, rowInfo.changeState.Entity, rowInfo.dbSetInfo.EntityType, rowInfo.changeState.NamesOfChangedFields);
                this.OnTrackChange(rowInfo.dbSetInfo.dbSetName, rowInfo.changeType, diffgram);
            }
            catch (Exception ex)
            {
                this.OnError(ex);
            }
        }
        #endregion

        protected GetDataResult GetData(GetDataInfo getInfo)
        {
            var metadata = this.EnsureMetadataInitialized();
            List<MethodDescription> methodList = metadata.methodDescriptions;
            MethodDescription method = methodList.Where((m) => m.methodName == getInfo.queryName && m.isQuery == true).FirstOrDefault();
            if (method == null)
            {
                throw new DomainServiceException(string.Format(ErrorStrings.ERR_QUERY_NAME_INVALID, getInfo.queryName));
            }

            this.authorizer.CheckUserRightsToExecute(method.methodInfo);
            getInfo.dbSetInfo = metadata.dbSets[getInfo.dbSetName];
            bool isMultyPageRequest = getInfo.dbSetInfo.enablePaging && getInfo.pageCount > 1;
      
            QueryResult queryResult = null;
            int? totalCount = null;
            if (!string.IsNullOrEmpty(getInfo.chunksID))
            {
                //return request result in chunks
                queryResult = BaseDomainService._shrededRequestManager.GetNextChunk(Guid.Parse(getInfo.chunksID));
                if (queryResult == null)
                {
                    throw new DomainServiceException(ErrorStrings.ERR_CHUNK_NOT_FOUND);
                }
            }
            else
            {
                List<object> methParams = new List<object>();
                methParams.Add(getInfo);
                for (var i = 0; i < method.parameters.Count; ++i)
                {
                    methParams.Add(getInfo.paramInfo.GetValue(method.parameters[i].name, method));
                }
                queryResult = (QueryResult)method.methodInfo.Invoke(this, methParams.ToArray());
                if (getInfo.dbSetInfo.FetchSize > 0)
                {
                    //shreds request result  into smaller chunks
                    queryResult = BaseDomainService._shrededRequestManager.AddQueryResult(queryResult, getInfo.dbSetInfo.FetchSize);
                }
            }

            IEnumerable entities = (IEnumerable)queryResult.Result;
            totalCount = queryResult.TotalCount;
            int rowCnt = 0;
            LinkedList<object> entityList = new LinkedList<object>();
            foreach (object entity in entities)
            {
                entityList.AddLast(entity);
                ++rowCnt;
            }
            var rows = this.CreateRows(getInfo.dbSetInfo, entityList, rowCnt);
            if (queryResult.includeNavigations.Length > 0 && isMultyPageRequest)
            {
                throw new DomainServiceException(ErrorStrings.ERR_MULTYPAGE_REQUEST);
            }
            IEnumerable<IncludedResult> subResults = this.CreateIncludedResults(getInfo.dbSetInfo, entityList, queryResult.includeNavigations);

            GetDataResult res = new GetDataResult()
            {
                pageIndex = getInfo.pageIndex,
                pageCount = getInfo.pageCount,
                dbSetName = getInfo.dbSetName,
                names = string.IsNullOrEmpty(getInfo.chunksID) ? getInfo.dbSetInfo.fieldInfos.Where(f => f._isIncludeInResult).OrderBy(f => f._ordinal).Select(fi => fi.fieldName) : null,
                totalCount = totalCount,
                chunksLeft = queryResult.ChunksLeft,
                chunksID = queryResult.ChunksID,
                extraInfo = string.IsNullOrEmpty(getInfo.chunksID)?queryResult.extraInfo : null,
                rows = rows,
                included = subResults,
                error = null
            };
            return (GetDataResult)res;
        }

        protected virtual void AuthorizeChangeSet(ChangeSet changeSet)
        {
            try
            {
                var metadata = this.EnsureMetadataInitialized();
                foreach (var dbSet in changeSet.dbSets)
                {
                    //methods on domain service which are attempted to be executed by client (SaveChanges triggers their execution)
                    Dictionary<string, MethodInfo> domainServiceMethods = new Dictionary<string, MethodInfo>();
                    DbSetInfo dbInfo = metadata.dbSets[dbSet.dbSetName];
                    this._currentDbSet = dbSet;

                    foreach (RowInfo rowInfo in dbSet.rows)
                    {
                        this._currentRowInfo = rowInfo;
                        MethodInfo methInfo = null;
                        try
                        {
                            methInfo = SecurityHelper.GetCRUDMethodInfo(dbInfo, rowInfo);
                        }
                        finally
                        {
                            this._currentRowInfo = null;
                        }
                        
                        if (methInfo == null)
                            throw new DomainServiceException(string.Format(ErrorStrings.ERR_REC_CHANGETYPE_INVALID, dbInfo.EntityType.Name, rowInfo.changeType));

                        if (!domainServiceMethods.ContainsKey(methInfo.Name))
                        {
                            domainServiceMethods.Add(methInfo.Name, methInfo);
                        }
                    } // foreach (RowInfo rowInfo in dbSet.rows)

                    this.authorizer.CheckUserRightsToExecute(domainServiceMethods.Values.ToArray());
                } //foreach (var dbSet in changeSet.dbSets)
            }
            finally
            {
                this._currentDbSet = null;
            }
        }

        protected bool ApplyChangeSet(ChangeSet changeSet)
        {
            ServiceMetadata metadata = this.EnsureMetadataInitialized();
            ChangeSetGraph graph = new ChangeSetGraph(changeSet, metadata);
            graph.Prepare();

            foreach (var rowInfo in graph.insertList)
            {
                this._currentDbSet = changeSet.dbSets.Where(d => d.dbSetName == rowInfo.dbSetInfo.dbSetName).Single();
                this._currentRowInfo = rowInfo;
                try
                {
                    rowInfo.changeState = new EntityChangeState { ParentRows= graph.GetParents(rowInfo) };
                    this.ApplyChangesToEntity(rowInfo);
                }
                finally
                {
                    this._currentRowInfo = null;
                    this._currentDbSet = null;
                }
            }

            foreach (var rowInfo in graph.updateList)
            {
                this._currentDbSet = changeSet.dbSets.Where(d => d.dbSetName == rowInfo.dbSetInfo.dbSetName).Single();
                this._currentRowInfo = rowInfo;
                try
                {
                    rowInfo.changeState = new EntityChangeState();
                    this.ApplyChangesToEntity(rowInfo);
                }
                finally
                {
                    this._currentRowInfo = null;
                    this._currentDbSet = null;
                }
            }

            foreach (var rowInfo in graph.deleteList)
            {
                this._currentDbSet = changeSet.dbSets.Where(d => d.dbSetName == rowInfo.dbSetInfo.dbSetName).Single();
                this._currentRowInfo = rowInfo;
                try
                {
                    rowInfo.changeState = new EntityChangeState();
                    this.ApplyChangesToEntity(rowInfo);
                }
                finally
                {
                    this._currentRowInfo = null;
                    this._currentDbSet = null;
                }
            }
            
            bool hasErrors = false;
         
            //Validation step
            foreach (var rowInfo in graph.insertList)
            {
                this._currentDbSet = changeSet.dbSets.Where(d => d.dbSetName == rowInfo.dbSetInfo.dbSetName).Single();
                this._currentRowInfo = rowInfo;
                try
                {
                    if (!this.ValidateEntity(rowInfo))
                    {
                        rowInfo.invalid = rowInfo.changeState.ValidationErrors;
                        hasErrors = true;
                    }
                }
                finally
                {
                    this._currentRowInfo = null;
                    this._currentDbSet = null;
                }
            }

            //Validation step
            foreach (var rowInfo in graph.updateList)
            {
                this._currentDbSet = changeSet.dbSets.Where(d => d.dbSetName == rowInfo.dbSetInfo.dbSetName).Single();
                this._currentRowInfo = rowInfo;
                try
                {
                    if (!this.ValidateEntity(rowInfo))
                    {
                        rowInfo.invalid = rowInfo.changeState.ValidationErrors;
                        hasErrors = true;
                    }
                }
                finally
                {
                    this._currentRowInfo = null;
                    this._currentDbSet = null;
                }
            }

            if (hasErrors)
                return false;

            this.ExecuteChangeSet();

            foreach (var rowInfo in graph.allList)
            {
                if (rowInfo.changeType != ChangeType.Deleted)
                    UpdateRowInfoAfterUpdates(rowInfo);
                else
                    rowInfo.values = null;
            }
            
            //Track changes step
            foreach (var rowInfo in graph.allList)
            {
                this.TrackChangesToEntity(rowInfo);
            }

            //OK, All updates are commited
            return true;
        }

        protected InvokeResult InvokeMethod(InvokeInfo invokeInfo) {
            List<MethodDescription> methodList = this.EnsureMetadataInitialized().methodDescriptions;
            MethodDescription method = methodList.Where((m)=>m.methodName == invokeInfo.methodName && m.isQuery == false).FirstOrDefault();
            if (method == null) {
                throw new DomainServiceException(string.Format(ErrorStrings.ERR_METH_NAME_INVALID, invokeInfo.methodName));
            }
            this.authorizer.CheckUserRightsToExecute(method.methodInfo);
            List<object> methParams = new List<object>();
            for (var i = 0; i < method.parameters.Count; ++i) {
               methParams.Add(invokeInfo.paramInfo.GetValue(method.parameters[i].name, method));
            }
            object meth_result = method.methodInfo.Invoke(this, methParams.ToArray());
            InvokeResult res = new InvokeResult();
            if (method.methodResult)
                res.result = meth_result;
            return res;
        }

        protected RefreshRowInfo RefreshRowInfo(RefreshRowInfo info)
        {
            var metadata = this.EnsureMetadataInitialized();
            info.dbSetInfo = metadata.dbSets[info.dbSetName];
            MethodInfo methInfo = this.GetOperMethodInfo(info.dbSetInfo, OperationNames.REFRESH);
            if (methInfo == null)
                throw new InvalidOperationException(string.Format(ErrorStrings.ERR_REC_REFRESH_INVALID, info.dbSetInfo.EntityType.Name, this.GetType().Name));
            info.rowInfo.dbSetInfo = info.dbSetInfo;
            this.authorizer.CheckUserRightsToExecute(methInfo);
            object dbEntity = methInfo.Invoke(this, new object[] { info });
            var rri = new RefreshRowInfo { rowInfo = info.rowInfo, dbSetName = info.dbSetName };
            if (dbEntity != null)
            {
                UpdateRowInfoFromEntity(dbEntity, info.rowInfo);
            }
            else
                rri.rowInfo = null;
            return rri; 
        }
        

        #region IDomainService Public Methods
        public MetadataInfo ServiceGetMetadata()
        {
            try
            {
                ServiceMetadata metadata = this.EnsureMetadataInitialized();
                var metadataInfo = new MetadataInfo();
                metadataInfo.methods = metadata.methodDescriptions;
                metadataInfo.associations.AddRange(metadata.associations.Values);
                foreach (var dbInfo in metadata.dbSets.Values)
                {
                    var copy = dbInfo.ShallowCopy();
                    copy.permissions = new DbSetPermit();
                    metadataInfo.dbSets.Add(copy);
                }
                metadataInfo.dbSets.ForEach((dbSetInfo) =>
                {
                    dbSetInfo.CalculatePermissions(this.authorizer);
                });
                return metadataInfo;
            }
            catch (Exception ex)
            {
                this.OnError(ex);
                throw;
            }
        }

        public GetDataResult ServiceGetData(GetDataInfo getInfo)
        {
            GetDataResult res = null;
            this._currentOperation = ServiceOperationType.GetData;
            try
            {
                res = this.GetData(getInfo);
            }
            catch (Exception ex)
            {
                while (ex.InnerException != null)
                    ex = ex.InnerException;
                res = new GetDataResult() { pageIndex = getInfo.pageIndex, pageCount = getInfo.pageCount,
                    rows = new Row[0], 
                    dbSetName = getInfo.dbSetName, totalCount = null, error = new ErrorInfo(ex.Message, ex.GetType().Name) };
                this.OnError(ex);
            }
            finally
            {
                this._currentOperation = ServiceOperationType.None;
            }
            return res;
        }

        public ChangeSet ServiceApplyChangeSet(ChangeSet changeSet)
        {
            bool res = true;
            this._currentOperation = ServiceOperationType.SaveChanges;
            this._currentChangeSet = changeSet;
            try
            {
                this.AuthorizeChangeSet(changeSet);
                res = this.ApplyChangeSet(changeSet);
                if (!res) {
                    throw new ValidationException(ErrorStrings.ERR_SVC_CHANGES_ARENOT_VALID);
                }
            }
            catch (Exception ex)
            {
                while (ex.InnerException != null)
                    ex = ex.InnerException;
                changeSet.error = new ErrorInfo(ex.Message, ex.GetType().Name);
                this.OnError(ex);
            }
            finally
            {
                this._currentOperation = ServiceOperationType.None;
                this._currentChangeSet = null;
            }
            return changeSet;
        }

        public RefreshRowInfo ServiceRefreshRow(RefreshRowInfo getInfo)
        {
            RefreshRowInfo res = null;
            this._currentOperation = ServiceOperationType.RefreshRowData;
            try
            {
                res = this.RefreshRowInfo(getInfo);
            }
            catch (Exception ex)
            {
                while (ex.InnerException != null)
                    ex = ex.InnerException;
                res = new RefreshRowInfo { dbSetName = getInfo.dbSetName, error = new ErrorInfo(ex.Message, ex.GetType().Name), rowInfo = null };
                this.OnError(ex);
            }
            finally
            {
                this._currentOperation = ServiceOperationType.None;
            }
            return res;
        }

        public InvokeResult ServiceInvokeMethod(InvokeInfo parameters) {
            InvokeResult res = null;
            this._currentOperation = ServiceOperationType.InvokeMethod;
            try
            {
                res = this.InvokeMethod(parameters);
            }
            catch (Exception ex)
            {
                while (ex.InnerException != null)
                    ex = ex.InnerException;
                res = new InvokeResult() { result= null , error = new ErrorInfo(ex.Message, ex.GetType().Name) };
                this.OnError(ex);
            }
            finally
            {
                this._currentOperation = ServiceOperationType.None;
            }
            return res;
        }
        #endregion

        #region IDisposable Members

        protected virtual void Dispose(bool isDisposing)
        {

        }

        #region IDisposable Members

        void IDisposable.Dispose()
        {
            this.Dispose(true);
        }

        #endregion
        #endregion
    }
}
