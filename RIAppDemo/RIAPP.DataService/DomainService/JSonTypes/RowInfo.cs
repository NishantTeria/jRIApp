using System;
using System.Runtime.Serialization;
using System.Collections.Generic;
using System.Linq;
using System.Web.Script.Serialization;
using RIAPP.DataService.Utils;

namespace RIAPP.DataService
{
    [DataContract]
    public class RowInfo
    {
        public RowInfo()
        {
            this.changeType = ChangeType.None;
            this.values = new List<ValueChange>();
            serverKey = string.Empty;
        }

        [DataMember]
        public List<ValueChange> values
        {
            get;
            set;
        }

        [DataMember]
        public ChangeType changeType
        {
            get;
            set;
        }

        /// <summary>
        /// Unique server row id in DbSet - primary key values concantenated by ;
        /// </summary>
        [DataMember]
        public string serverKey
        {
            get;
            set;
        }

        /// <summary>
        /// When row change type is added row has empty serverKey
        /// client assigns unique row id to the added row, so after executing insert operation on server
        /// the client could find the row in its rows store.
        /// </summary>
        [DataMember]
        public string clientKey
        {
            get;
            set;
        }

        [DataMember]
        public string error
        {
            get;
            set;
        }


        [DataMember]
        public ValidationErrorInfo[] invalid
        {
            get;
            set;
        }

        [ScriptIgnore]
        [IgnoreDataMember]
        public DbSetInfo dbSetInfo
        {
            get;
            set;
        }


        [ScriptIgnore]
        [IgnoreDataMember]
        public EntityChangeState changeState
        {
            get;
            set;
        }
       
        public ValueChange GetValue(string fieldName)
        {
            ValueChange fv = this.values.Single(v => v.fieldName == fieldName);
            return fv;
        }

        public string[] GetChangedFieldNames()
        {
            return this.values.Where(fv => (fv.flags & ValueFlags.Changed) == ValueFlags.Changed).Select(fv => fv.fieldName).ToArray();
        }

        public object[] GetPKValues()
        {
            Type entityType = this.dbSetInfo.EntityType;
            FieldInfo[] finfos = DataHelper.GetPKFieldInfos(this.dbSetInfo);
            object[] result = new object[finfos.Length];
            for (int i = 0; i < finfos.Length; ++i)
            {
                ValueChange fv = this.GetValue(finfos[i].fieldName);
                result[i] = fv.GetTypedValue(entityType, this.dbSetInfo);
            }
            return result;
        }

        public string GetRowKeyAsString(DbSetInfo dbSetInfo)
        {
            FieldInfo[] finfos =  DataHelper.GetPKFieldInfos(dbSetInfo);
            string[] vals = new string[finfos.Length];
            for (int i = 0; i < finfos.Length; ++i)
            {
                ValueChange fv =this.GetValue(finfos[i].fieldName);
                vals[i] = fv.val;
            }
            return string.Join(";", vals);
        }
        
        /// <summary>
        /// FieldNames which values has been changed by client
        /// </summary>
        /// <returns></returns>
        public string[] GetNamesOfChanged()
        {
            return this.values.Where(fv => (fv.flags | ValueFlags.Changed) == ValueFlags.Changed).Select(fv => fv.fieldName).ToArray();
        }
    }
}
