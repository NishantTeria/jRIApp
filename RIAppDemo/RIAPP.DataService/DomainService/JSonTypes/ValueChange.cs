using System;
using System.Runtime.Serialization;
using System.Reflection;
using RIAPP.DataService.Resources;
using RIAPP.DataService.Utils;

namespace RIAPP.DataService
{
    [DataContract]
    public partial class ValueChange
    {
        public ValueChange()
        {
             val = null;
             orig = null;
             flags = ValueFlags.None;
             fieldName = string.Empty;
        }

        [DataMember]
        public string val
        {
            get;
            set;
        }

        [DataMember]
        public string orig
        {
            get;
            set;
        }


        [DataMember]
        public string fieldName
        {
            get;
            set;
        }

        [DataMember]
        public ValueFlags flags
        {
            get;
            set;
        }

        public object GetTypedValue(Type entityType, DbSetInfo dbSetInfo)
        {
            FieldInfo fi = dbSetInfo.GetFieldByNames()[this.fieldName];
            PropertyInfo pinfo = entityType.GetProperty(fi.fieldName);
            if (pinfo == null)
                throw new Exception(string.Format(ErrorStrings.ERR_PROPERTY_IS_MISSING, entityType.Name, fi.fieldName));

            Type propType = pinfo.PropertyType;
            return DataHelper.ConvertToTyped(propType, fi.dataType, fi.dateConversion, this.val);
        }
    }
}
