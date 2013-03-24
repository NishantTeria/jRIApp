using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using RIAPP.DataService.Resources;

namespace RIAPP.DataService.Utils
{
    public static class DataHelper
    {
        private static ValueConverter _converter = new ValueConverter();

        private static IList CreateList<T>()
        {
            return new List<T>();
        }

        private static IEnumerable CreateArray<T>(List<T> list)
        {
            return list.ToArray();
        }

        public static bool SetProperty(object entity, string propertyName, object value)
        {
            Type enityType = entity.GetType();
            PropertyInfo pinfo = enityType.GetProperty(propertyName);
            if (pinfo == null)
                return false;
            if (!pinfo.CanWrite)
            {
                return false;
            }

            pinfo.SetValue(entity, value, null);
            return true;
        }

        public static object GetProperty(object entity, string propertyName)
        {
            Type enityType = entity.GetType();
            PropertyInfo pinfo = enityType.GetProperty(propertyName);
            if (pinfo == null)
                return null;
            return pinfo.GetValue(entity, null);
        }

        public static object CreateGenericInstance(Type propType, Type propMainType, object[] constructorArgs)
        {
            Type typeToConstruct = propType.GetGenericTypeDefinition();
            Type[] argsType = new Type[] { propMainType };
            Type nullableType = typeToConstruct.MakeGenericType(argsType);
            object val = Activator.CreateInstance(nullableType, constructorArgs);
            return val;
        }

        public static bool IsNullableType(Type propType)
        {
            return propType.IsGenericType && propType.GetGenericTypeDefinition() == typeof(Nullable<int>).GetGenericTypeDefinition();
        }

        public static MethodInfo GetMethodInfo(Type t, string name)
        {
            MethodInfo meth = null;
            if (!string.IsNullOrEmpty(name))
                meth = t.GetMethod(name, BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly);
            return meth;
        }

        public static DateTime ParseDateTimeValue(string val, DateConversion dateConversion)
        {
            string[] parts = val.Split("&".ToCharArray());
            if (parts.Length != 7)
            {
                throw new ArgumentException(string.Format(ErrorStrings.ERR_VAL_DATEFORMAT_INVALID,val));
            }
            DateTime dt = new DateTime(int.Parse(parts[0]), int.Parse(parts[1]), int.Parse(parts[2]), int.Parse(parts[3]), int.Parse(parts[4]), int.Parse(parts[5]), int.Parse(parts[6]), DateTimeKind.Unspecified);
            return dt;
        }

        public static DataType DataTypeFromType(Type type, out bool isArray)
        {
            return _converter.DataTypeFromType(type, out isArray);
        }

        public static string DateToValue(DateTime dt)
        {
            int fff = dt.Millisecond;
            string v = string.Format("{0}&{1}", dt.ToString("yyyy&M&d&H&m&s"), fff);
            return v;
        }

        public static int GetLocalDateTimezoneOffset(DateTime dt)
        {
            DateTime uval = dt.ToUniversalTime();
            TimeSpan tspn = uval - dt;
            return (int)tspn.TotalMinutes;
        }

        public static object SetValue(object entity, FieldInfo finfo, string value)
        {
            Type enityType = entity.GetType();
            PropertyInfo pinfo = enityType.GetProperty(finfo.fieldName);
            if (pinfo == null)
                throw new Exception(string.Format(ErrorStrings.ERR_PROPERTY_IS_MISSING, enityType.Name, finfo.fieldName));
            if (!pinfo.CanWrite) {
                throw new Exception(string.Format(ErrorStrings.ERR_PROPERTY_IS_READONLY, finfo.fieldName));
            }

            Type propType = pinfo.PropertyType;
            bool IsNullableType = DataHelper.IsNullableType(propType);
            object val = _converter.ConvertToTyped(propType, finfo.dataType, finfo.dateConversion, value);

            if (val != null)
                pinfo.SetValue(entity, val, null);
            else if (IsNullableType && val == null)
                pinfo.SetValue(entity, val, null);
            else if (!propType.IsValueType && val == null)
                pinfo.SetValue(entity, val, null);
            else
                throw new Exception(string.Format(ErrorStrings.ERR_FIELD_IS_NOT_NULLABLE, finfo.fieldName));
            return val;
        }

       
        public static string GetFieldValueAsString(object entity, string fieldName)
        {
            string val;
            bool isOK = GetFieldValueAsString(entity, fieldName, false, out val);
            return val;
        }

        /// <summary>
        /// extracts field value from entity, and converts value to string form
        /// </summary>
        public static bool GetFieldValueAsString(object entity, string fieldName, bool optional, out string val)
        {
            val = null;
            Type enityType = entity.GetType();
            PropertyInfo pinfo = enityType.GetProperty(fieldName);
            if (pinfo == null && !optional)
                throw new Exception(string.Format(ErrorStrings.ERR_PROPERTY_IS_MISSING, enityType.Name, fieldName));

            if (pinfo == null)
            {
                return false;
            }
            Type propType = pinfo.PropertyType;
            object fieldValue = pinfo.GetValue(entity, null);
            val = _converter.ConvertToString(fieldValue, propType);
            return true;
        }

        public static object GetValue(object entity, string fieldName)
        {
            Type enityType = entity.GetType();
            PropertyInfo pinfo = enityType.GetProperty(fieldName);
            if (pinfo == null)
                throw new Exception(string.Format(ErrorStrings.ERR_PROPERTY_IS_MISSING, enityType.Name, fieldName));

            Type propType = pinfo.PropertyType;
            object fieldValue = pinfo.GetValue(entity, null);
            return fieldValue;
        }

        public static object ConvertToTyped(Type propType, DataType dataType, DateConversion dateConversion, string value) 
        {
            return _converter.ConvertToTyped(propType, dataType, dateConversion, value);
        }

        public static object ConvertToTyped(Type entityType, FieldInfo finfo, string value)
        {
            PropertyInfo propInfo = entityType.GetProperty(finfo.fieldName);

            if (propInfo == null)
                throw new Exception(ErrorStrings.ERR_PROPERTY_IS_MISSING);

            Type propType = propInfo.PropertyType;

            return _converter.ConvertToTyped(propType, finfo.dataType, finfo.dateConversion, value);
        }

        public static string ConvertToString(object value, Type propType) 
        {
            return _converter.ConvertToString(value, propType);
        }


        public static object ParseParameter(Type paramType, ParamMetadataInfo pinfo, bool isArray, string val)
        {
            DataType dataType = pinfo.dataType;

            if (isArray && val != null)
            {
                string[] arr = (string[])SerializationHelper.DeSerialize(val, typeof(string[]));
                if (arr == null)
                    return null;
                IList list = (IList)typeof(DataHelper).GetMethod("CreateList", BindingFlags.NonPublic | BindingFlags.Static)
                    .MakeGenericMethod(paramType.GetElementType())
                    .Invoke(null, new object[] { });
                foreach (var v in arr)
                {
                    list.Add(ParseParameter(paramType.GetElementType(), pinfo, false, v));
                }

                return typeof(DataHelper).GetMethod("CreateArray", BindingFlags.NonPublic | BindingFlags.Static)
                    .MakeGenericMethod(paramType.GetElementType())
                    .Invoke(null, new object[] { list });
            }
            return DataHelper.ConvertToTyped(paramType, dataType, pinfo.dateConversion, val);
        }

   
        public static FieldInfo[] GetPKFieldInfos(DbSetInfo dbSetInfo)
        {
            return dbSetInfo.fieldInfos.Where(fi => fi.isPrimaryKey > 0).OrderBy(fi => fi.isPrimaryKey).ToArray();
        }

        public static FieldInfo GetRowTimeStampFieldInfo(DbSetInfo dbSetInfo)
        {
            return dbSetInfo.fieldInfos.Where(fi => fi.isRowTimeStamp == true).FirstOrDefault();
        }

    }
}
