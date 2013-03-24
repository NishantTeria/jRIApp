using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.Serialization;
using System.Security.Principal;
using System.Web.Script.Serialization;
using System.Reflection;
using RIAPP.DataService.Utils;
using RIAPP.DataService.Security;

namespace RIAPP.DataService
{
    [DataContract]
    public partial class DbSetInfo
    {
       
        #region EqualityComparers
        private class FieldPKEqualityComparer : IEqualityComparer<FieldInfo>
        {
            #region IEqualityComparer<FieldInfo> Members

            public bool Equals(FieldInfo x, FieldInfo y)
            {
                return x.isPrimaryKey == y.isPrimaryKey;
            }

            public int GetHashCode(FieldInfo obj)
            {
                return obj.fieldName.GetHashCode();
            }

            #endregion
        }

        private class FieldNameEqualityComparer : IEqualityComparer<FieldInfo>
        {
            #region IEqualityComparer<FieldInfo> Members

            public bool Equals(FieldInfo x, FieldInfo y)
            {
                return string.Compare(x.fieldName, y.fieldName, StringComparison.CurrentCultureIgnoreCase) == 0;
            }

            public int GetHashCode(FieldInfo obj)
            {
                return obj.fieldName.GetHashCode();
            }

            #endregion
        }
        #endregion

        private List<FieldInfo> _fieldInfos = new List<FieldInfo>();
        private Dictionary<string, FieldInfo> _fieldsByNames;
        private Dictionary<int, FieldInfo> _fieldsByOrdinal;
        private MethodInfo _validateDataMethod;
        private MethodInfo _deleteDataMethod;
        private MethodInfo _insertDataMethod;
        private MethodInfo _updateDataMethod;
        private MethodInfo _refreshDataMethod;

        public DbSetInfo()
        {
            this.enablePaging = true;
            this.pageSize = 25;
            this.isTrackChanges = false;
            this.FetchSize = 0;
        }

        [DataMember]
        public List<FieldInfo> fieldInfos
        {
            get
            {
                return _fieldInfos;
            }
            set
            {
                this._fieldInfos = value;
            }
        }

        [DataMember]
        public bool enablePaging
        {
            get;
            set;
        }

        [DataMember]
        public int pageSize
        {
            get;
            set;
        }

        /// <summary>
        /// DbSet name- any unique name to reference this DbSet from code
        /// </summary>
        [DataMember]
        public string dbSetName
        {
            get;
            set;
        }

       
        [DataMember]
        public DbSetPermit permissions
        {
            get;
            set;
        }

        #region NonSerializable properties
        [ScriptIgnore]
        [IgnoreDataMember]
        public int FetchSize
        {
            get;
            set;
        }

        [ScriptIgnore]
        [IgnoreDataMember]
        public Type EntityType
        {
            get;
            set;
        }

        [ScriptIgnore]
        [IgnoreDataMember]
        public string deleteDataMethod
        {
            get;
            set;
        }

        [ScriptIgnore]
        [IgnoreDataMember]
        public string insertDataMethod
        {
            get;
            set;
        }

        [ScriptIgnore]
        [IgnoreDataMember]
        public string updateDataMethod
        {
            get;
            set;
        }

        [ScriptIgnore]
        [IgnoreDataMember]
        public string refreshDataMethod
        {
            get;
            set;
        }


        [ScriptIgnore]
        [IgnoreDataMember]
        public string validateDataMethod
        {
            get;
            set;
        }

        [ScriptIgnore]
        [IgnoreDataMember]
        public bool isTrackChanges
        {
            get;
            set;
        }
        #endregion

        #region Utility Methods
        internal void CalculatePermissions(IAuthorizer authorizer)
        {
            this.permissions = SecurityHelper.GetDbSetPermissions(this,authorizer);
        }

        internal MethodInfo getOperationMethodInfo(string oper)
        {
            switch (oper.ToLowerInvariant())
            {
                case OperationNames.REFRESH:
                    return this._refreshDataMethod;
                case OperationNames.CREATE:
                    return this._insertDataMethod;
                case OperationNames.UPDATE:
                    return this._updateDataMethod;
                case OperationNames.DELETE:
                    return this._deleteDataMethod;
                case OperationNames.VALIDATE:
                    return this._validateDataMethod;
                default:
                    throw new DomainServiceException(string.Format("Invalid Operation name {0}", oper));
            }
        }

        /// <summary>
        /// typically methods names use templated scheme like: insert{0} or delete{0}
        /// where {0} later is replaced by dbSet's name, that will turn into something like: insertCustomer or deleteCustomer 
        /// </summary>
        /// <param name="methodNameTemplate"></param>
        /// <param name="dbSetName"></param>
        /// <returns></returns>
        private static string GenerateMethodName(string methodNameTemplate, string dbSetName)
        {
            try
            {
                return string.Format(methodNameTemplate, dbSetName);
            }
            catch
            {
                //return as is
                return methodNameTemplate;
            }
        }

        private string getOperationMethodName(string oper)
        {
            switch (oper.ToLowerInvariant())
            {
                case OperationNames.REFRESH:
                    if (string.IsNullOrWhiteSpace(this.refreshDataMethod))
                        return null;
                    return GenerateMethodName(this.refreshDataMethod, this.dbSetName);
                case OperationNames.CREATE:
                    if (string.IsNullOrWhiteSpace(this.insertDataMethod))
                        return null;
                    return GenerateMethodName(this.insertDataMethod, this.dbSetName);
                case OperationNames.UPDATE:
                    if (string.IsNullOrWhiteSpace(this.updateDataMethod))
                        return null;
                    return GenerateMethodName(this.updateDataMethod, this.dbSetName);
                case OperationNames.DELETE:
                    if (string.IsNullOrWhiteSpace(this.deleteDataMethod))
                        return null;
                    return GenerateMethodName(this.deleteDataMethod, this.dbSetName);
                case OperationNames.VALIDATE:
                    if (string.IsNullOrWhiteSpace(this.validateDataMethod))
                        return null;
                    return GenerateMethodName(this.validateDataMethod, this.dbSetName);
                default:
                    throw new DomainServiceException(string.Format("Invalid Operation name {0}", oper));
            }
        }

        public DbSetInfo ShallowCopy()
        {
            return (DbSetInfo)this.MemberwiseClone();
        }

        public Dictionary<string, FieldInfo> GetFieldByNames()
        {
            System.Threading.LazyInitializer.EnsureInitialized<Dictionary<string, FieldInfo>>(ref this._fieldsByNames, () => this.fieldInfos.ToDictionary(f => f.fieldName));
            return _fieldsByNames;
        }

        public Dictionary<int, FieldInfo> GetFieldByOrdinal()
        {
            System.Threading.LazyInitializer.EnsureInitialized<Dictionary<int, FieldInfo>>(ref this._fieldsByOrdinal, () => {
                int i = 0;
                for (i = 0; i < this.fieldInfos.Count(); ++i)
                {
                    this.fieldInfos[i]._ordinal = i;
                }
                return this.fieldInfos.ToDictionary(f => f._ordinal);
            });
            return _fieldsByOrdinal;
        }

        private void InitMethods(Type serviceType) {
            System.Reflection.FieldInfo[] fields = typeof(OperationNames).GetFields(BindingFlags.Public | BindingFlags.Static);
            Array.ForEach(fields, (fl) => {
                if (!fl.IsSpecialName && fl.IsLiteral && !fl.IsInitOnly) 
                {
                    string  operName = fl.GetValue(null).ToString();
                    string methodName = this.getOperationMethodName(operName);
                    MethodInfo minfo = DataHelper.GetMethodInfo(serviceType, methodName);
                    if (minfo != null) {
                        switch (operName)
                        {
                            case OperationNames.REFRESH:
                                this._refreshDataMethod = minfo;
                                break;
                            case OperationNames.CREATE:
                                this._insertDataMethod = minfo;
                                break;
                            case OperationNames.UPDATE:
                                this._updateDataMethod = minfo;
                                break;
                            case OperationNames.DELETE:
                                this._deleteDataMethod = minfo;
                                break;
                            case OperationNames.VALIDATE:
                                this._validateDataMethod = minfo;
                                break;
                            default:
                                throw new DomainServiceException(string.Format("Invalid Operation name {0}", operName));
                        }
                    }
                }
            });
        }

        public void Initialize(Type serviceType)
        {
            var fbo = this.GetFieldByOrdinal();
            var fbn = this.GetFieldByNames();
            this.InitMethods(serviceType);
        }
        #endregion
    }
}
